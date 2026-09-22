"""Verify saved script structure, stopping, representations, and native payloads."""
import json
from packages.domain.models import Manifest, digest
from packages.domain.context import tokens
from packages.domain.providers import request_payload, registry
from packages.experiments.script_paths import parse_output, Script, ActorStep


def audit_script(result, suite):
    condition = result['case']['condition']
    spec = result['experiment_spec']
    turns = result['turns']
    assert not result['future_pool_ids'], 'Ordinary future retrieval must be disabled'
    assert not set(result['historical_ids']) & set(result['path']['gap_ids']), 'Gap in historical context'
    if result['status'] == 'completed':
        if condition['length_policy'] == 'fixed':
            assert len(turns) == suite['exchanges']*2, 'Fixed script count changed'
            assert result['completion_reason'] == 'fixed_turn_budget'
        else:
            assert 2 <= len(turns) <= suite['safety_max_turns']
            assert result['completion_reason'] == 'model_handoff'
    if result['status'] == 'capped':
        assert result['completion_reason'] in ('safety_turn_limit', 'model_incomplete')
    calls = {c['id']: c for c in result.get('preprocessing_calls', []) + result['calls']}
    for turn in turns:
        call = calls[turn['call_id']]
        assert call['status'] == 'completed' and call.get('parse_status') == 'validated'
        assert turn['origin'] == 'simulated'
        purpose = call['manifest']['policy_id'].split(':', 1)[1].removesuffix('-repair')
        if purpose == 'script-author':
            parsed = parse_output(call['text'], Script)
            index = turns.index(turn)
            actual = parsed.turns[index]
        else:
            actual = parse_output(call['text'], ActorStep).turn
        assert actual.model_dump(mode='json') == {k: turn[k] for k in ('actor', 'text', 'transition')}, 'Parsed turn changed'
    if condition['architecture'] == 'two-agent':
        assert [t['actor'] for t in turns] == ['traveler' if i%2==0 else 'companion' for i in range(len(turns))]
    else:
        assert len({t['call_id'] for t in turns}) <= 1, 'Single-author script has multiple authors'
    if condition['representation'] == 'timeline':
        for event in result.get('timeline_events', []):
            scope = event['provenance']
            assert set(scope['processing_source_ids']) <= set(result['historical_ids']), 'Timeline preprocessing saw unavailable sources'
            assert set(scope['call_ids']) <= set(calls), 'Missing event extraction receipts'
    assert spec['blind_gap'] == (condition['annotation_policy'] != 'retrospective-reference')
    checked = 0
    for final in calls.values():
        for call in [*final.get('previous_attempts', []), final]:
            manifest = Manifest.model_validate(call['manifest'])
            assert digest(call['request_payload']) == call['payload_hash'], 'Native payload hash mismatch'
            assert manifest.token_estimate == sum(tokens(i.body) for i in manifest.items)
            payload = {'manifest': manifest.model_dump(mode='json')} if manifest.settings.provider == 'demo' else request_payload(manifest, registry()[manifest.settings.provider])[1]
            assert payload == call['request_payload'], 'Manifest and request differ'
            purpose = manifest.policy_id.split(':', 1)[1].removesuffix('-repair')
            if purpose in ('script-author', 'script-traveler', 'script-companion'):
                actor = 'companion' if purpose == 'script-companion' else 'traveler'
                assert manifest.settings.model_dump(mode='json') == condition[actor], 'Actor settings changed'
                history = [i for i in manifest.items if i.origin == 'historical']
                expected = [] if condition['representation'] == 'timeline' else result['historical_ids'] if condition['memory'] == 'full' else result['historical_ids'][-suite['recent_turns']:]
                assert [i.id for i in history] == expected, 'Wrong historical representation'
                assert all(digest(json.loads(i.body)['text']) == i.source_version for i in history), 'Historical text changed'
                endpoint = [i for i in manifest.items if i.origin == 'endpoint']
                assert len(endpoint) == 1 and endpoint[0].body.endswith(result['path']['endpoint']['body']), 'Endpoint changed'
                annotation = [i for i in manifest.items if i.origin == 'annotation']
                assert condition['representation'] == 'annotated' or not annotation
                if spec['blind_gap']:
                    assert not annotation, 'Blind context contains retrospective annotations'
            checked += 1
    for step in result['context_steps']:
        assert step['manifest_hash'] == calls[turns[step['index']]['call_id']]['manifest']['hash']
    for event in result['simulated_events']:
        turn = turns[event['turn_index']]
        assert event['text'] == turn['transition']['event'] and event['call_id'] == turn['call_id']
    return checked
