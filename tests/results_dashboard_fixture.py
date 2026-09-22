"""Entirely invented saved results for isolated dashboard browser checks."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import uvicorn
from tools.results_dashboard.app import create_dashboard

SETTINGS = {'provider': 'demo', 'model': 'invented-offline-model', 'max_output_tokens': 1024}


def item(id, origin, body, role='user'):
    return {'id': id, 'source_id': id, 'source_version': 'invented-'+id, 'origin': origin,
            'body': body, 'role': role, 'position': 0}


def call(id, purpose, items, text):
    for i, value in enumerate(items):
        value['position'] = i
    return {'id': id, 'manifest': {'policy_id': 'fixture:'+purpose, 'settings': SETTINGS,
        'hash': id+'-manifest', 'items': items, 'token_estimate': 500}, 'request_payload': {'messages': items},
        'payload_hash': id+'-payload', 'text': text, 'status': 'completed', 'metadata': {'finish_reason': 'stop'},
        'elapsed_seconds': 0.1}


def save_fixture(root):
    directory = root/'script-path-screening'
    directory.mkdir(parents=True)
    cases, conditions = [], []
    for n, policy in enumerate(('adaptive', 'fixed')):
        id = ('a' if n == 0 else 'b')*64
        condition = {'id': 'single-timeline-adaptive' if not n else 'single-dialogue-fixed', 'architecture': 'single-author',
                     'representation': 'timeline' if not n else 'dialogue', 'length_policy': policy,
                     'memory': 'full', 'persona': 'minimal', 'forward': 'none', 'traveler': SETTINGS, 'companion': SETTINGS}
        conditions.append(condition)
        event = {'id': 'may-8-to-may-10', 'start_id': 'rain-in-spain', 'end_id': 'naming-mirrows', 'seeds': []}
        seed = {'id': 'invented-bridge', 'prompt': 'Invent a bridge between the harbor and the inn.'}
        turns = [{'id': f'turn-{i}', 'actor': 'traveler' if i % 2 == 0 else 'companion',
                  'text': f'Invented spoken turn {i+1}.', 'origin': 'simulated', 'call_id': 'author'} for i in range(4 if not n else 8)]
        extraction = call('extract', 'timeline-extraction', [item('source', 'historical', 'Invented source: the Traveler reached the harbor.')], 'Extracted harbor event.')
        review = call('entailment', 'event-entailment-review', [item('event-review-candidates', 'derived-event-candidates', '[{"id":"event-harbor"}]')], 'Accepted event-harbor.')
        author = call('author', 'script-author', [item('author-system', 'instruction', 'EXACT AUTHOR PROMPT: create a fictional script.', 'system'),
            item('event-harbor', 'timeline-event' if not n else 'historical', 'The Traveler reached the harbor.'),
            item('terminal', 'endpoint-anchor', 'The Traveler arrives at an inn.')], 'Invented complete script.')
        result = {'run_id': id, 'kind': 'script-path', 'case': {'event': event, 'seed': seed, 'condition': condition, 'repetition': 0},
            'status': 'completed', 'offline': True, 'completion_reason': 'model_handoff' if not n else 'fixed_turn_budget',
            'calls': [author], 'preprocessing_calls': [extraction, review] if not n else [],
            'turns': turns, 'context_steps': [], 'memories': [], 'historical_ids': ['source'], 'future_pool_ids': [],
            'metrics': {'completed_turns': len(turns), 'mean_dialogue_input_bound': 500}, 'persona': {'text': 'No separate sketch.'},
            'experiment_spec': {'architecture': 'single-author', 'representation': condition['representation'], 'length_policy': policy,
                'fixed_turns': 8 if n else None, 'safety_max_turns': 24, 'blind_gap': True,
                'timeline_dependency': {'extraction': {'review_chunks': [{'extraction_call_id': 'extract', 'call_id': 'entailment', 'source_ids': ['source']}]}}},
            'timeline_events': [{'id': 'event-harbor', 'source_ids': ['source'], 'provenance': {'call_ids': ['extract', 'entailment']}}] if not n else [],
            'simulated_events': [{'id': 'e1', 'text': 'The Traveler leaves the harbor.', 'turn_index': 0, 'actor': 'traveler'},
                                 {'id': 'e2', 'text': 'The Traveler stops at a café.', 'turn_index': 1, 'actor': 'companion'},
                                 {'id': 'e3', 'text': 'The Traveler approaches the inn.', 'turn_index': 3, 'actor': 'traveler'}]}
        (directory/(id+'.json')).write_text(json.dumps(result))
        cases.append({'id': id, 'event': event['id'], 'seed': seed['id'], 'condition': condition['id'], 'repetition': 0})
    # Same-architecture adaptive dialogue is the comparison control for script runs.
    from copy import deepcopy
    control = deepcopy(result)
    control['run_id'] = 'c'*64
    control['case']['condition']['id'] = 'single-dialogue-adaptive'
    control['case']['condition']['length_policy'] = 'adaptive'
    control['completion_reason'] = 'model_handoff'
    control['experiment_spec'].update(length_policy='adaptive', fixed_turns=None)
    control['turns'] = control['turns'][:4]
    control['turns'][0]['text'] = 'Invented adaptive dialogue control.'
    control['metrics']['completed_turns'] = 4
    conditions.append(control['case']['condition'])
    cases.append({'id': control['run_id'], 'event': event['id'], 'seed': seed['id'], 'condition': 'single-dialogue-adaptive', 'repetition': 0})
    (directory/(control['run_id']+'.json')).write_text(json.dumps(control))
    plan = {'cases': cases, 'content_version': 'invented-only', 'engine_hash': 'invented-code',
            'suite': {'version': 1, 'kind': 'script-path', 'exchanges': 4, 'events': [event], 'conditions': conditions}}
    (directory/'plan.json').write_text(json.dumps(plan))
    legacy = root/'final-screening'; legacy.mkdir()
    (legacy/'plan.json').write_text(json.dumps({**plan, 'cases': [], 'suite': {**plan['suite'], 'kind': 'counterfactual'}}))


if __name__ == '__main__':
    with TemporaryDirectory(prefix='machina-dashboard-browser-') as directory:
        root = Path(directory)
        save_fixture(root)
        uvicorn.run(create_dashboard(root), host='127.0.0.1', port=8137, access_log=False)
