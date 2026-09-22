"""Invented anchors verify that interpolation never reads its held-out answer."""
import copy
import json
import pytest
from packages.experiments.config import Suite, Event, Seed, Condition, cases, path_tracing_suite
from packages.experiments.path_tracing import boundaries, endpoint_visible
from packages.experiments.runner import Engine
from packages.domain.models import GenerationSettings
from packages.domain.providers import ProviderEvent, ProviderError
from scripts.audit_counterfactual_results import audit


def setup(bundle, policy='upfront'):
    start = bundle.profile.start_options[0].model_copy(update={'entry_message_id': 'm0'})
    end = start.model_copy(update={'id': 'end', 'entry_message_id': 'm4'})
    bundle = bundle.model_copy(update={'profile': bundle.profile.model_copy(update={'start_options': (start, end)})})
    settings = GenerationSettings(provider='openai', model='invented', max_output_tokens=100)
    suite = Suite(kind='path-tracing', exchanges=4, builder=settings,
        events=(Event(id='pair', start_id='test', end_id='end', seeds=(Seed(id='bridge', prompt='Invent a bridge.'),)),),
        conditions=(Condition(id='path', endpoint_policy=policy, traveler=settings, companion=settings),))
    return bundle, suite, next(cases(suite))


class Fake:
    async def stream(self, manifest):
        yield ProviderEvent('delta', 'A fictional transition with uncertainty.')
        yield ProviderEvent('metadata', metadata={'finish_reason': 'stop'})


@pytest.mark.parametrize('policy', ['upfront', 'backward', 'delayed', 'companion-only'])
async def test_path_holdout_and_endpoint_schedule(bundle, policy):
    bundle, suite, case = setup(bundle, policy)
    result = await Engine(bundle, suite, provider_factory=lambda _: Fake()).run(case)
    assert result['status'] == 'completed'
    assert result['path']['gap_ids'] == ['m1', 'm2', 'm3']
    assert result['path']['review_status'] == 'completed'
    assert result['future_pool_ids'] == []
    assert result['metrics']['endpoint_direct_turns'] == (8 if policy in ('upfront', 'backward') else 4)
    wire = json.dumps([c['request_payload'] for c in result['calls']])
    assert all(f'Invented turn {i}' not in wire for i in (1, 2, 3, 5))
    assert 'Do not leak this future knowledge.' not in wire
    dialogue = [c for c in result['calls'] if c['manifest']['policy_id'].split(':')[1] in ('traveler', 'companion')]
    for index, call in enumerate(dialogue):
        assert ('Invented turn 4' in json.dumps(call['request_payload'])) == endpoint_visible(policy, index, 8)
    assert audit(result, suite.model_dump(mode='json')) >= 10
    changed = copy.deepcopy(result)
    changed['context_steps'][0]['path']['endpoint_visible'] = not changed['context_steps'][0]['path']['endpoint_visible']
    with pytest.raises(AssertionError, match='schedule'):
        audit(changed, suite.model_dump(mode='json'))


def test_invalid_path_config_and_chronology(bundle):
    bundle, suite, case = setup(bundle)
    assert len(list(cases(path_tracing_suite()))) == 18
    for updates in ({'persona': 'retrospective'}, {'forward': 'static'}):
        with pytest.raises(ValueError, match='withholds'):
            Suite.model_validate({**suite.model_dump(), 'conditions': [{**suite.conditions[0].model_dump(), **updates}]})
    reversed_event = case['event'].model_copy(update={'start_id': 'end', 'end_id': 'test'})
    with pytest.raises(ValueError, match='chronologically'):
        boundaries(bundle, reversed_event)
    with pytest.raises(ValueError, match='unavailable'):
        boundaries(bundle, case['event'].model_copy(update={'end_id': 'missing'}))
    with pytest.raises(ValueError, match='distinct'):
        Suite.model_validate({**suite.model_dump(), 'events': [{**suite.events[0].model_dump(), 'end_id': None}]})


async def test_review_failure_preserves_completed_bridge(bundle):
    bundle, suite, case = setup(bundle)
    class FailedReview(Fake):
        async def stream(self, manifest):
            if manifest.policy_id.endswith(':path-handoff-review'):
                raise ProviderError('output_limit', 'too long')
            async for event in super().stream(manifest):
                yield event
    result = await Engine(bundle, suite, provider_factory=lambda _: FailedReview()).run(case)
    assert result['status'] == 'completed' and len(result['turns']) == 8
    assert result['path']['review_status'] == 'failed' and result['path']['review'] is None


async def test_failed_plan_never_supplies_partial_waypoints(bundle):
    bundle, suite, case = setup(bundle, 'backward')
    class FailedPlan(Fake):
        async def stream(self, manifest):
            if manifest.policy_id.endswith(':backward-path-plan'):
                yield ProviderEvent('delta', 'Incomplete plan')
                yield ProviderEvent('metadata', metadata={'finish_reason': 'length'})
            else:
                async for event in super().stream(manifest):
                    yield event
    result = await Engine(bundle, suite, provider_factory=lambda _: FailedPlan()).run(case)
    assert result['status'] == 'failed' and not result['turns'] and result['path']['plan'] is None
