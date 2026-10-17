import json
import stat

import pytest
from fastapi.testclient import TestClient

from packages.content.aliases import AliasConfig, AliasRewriter
from tools.deck.app import create_deck
from tools.deck.samples import case_beats

ID = 'c' * 64
SETTINGS = {'provider': 'demo', 'model': 'invented-model'}


def call(id, purpose, items, text):
    return {'id': id, 'manifest': {'policy_id': 'counterfactual-v1:' + purpose, 'settings': SETTINGS, 'hash': id,
            'items': items, 'token_estimate': sum(i['token_estimate'] for i in items)},
            'metadata': {}, 'status': 'completed', 'text': text}


def item(origin, size):
    return {'id': origin, 'origin': origin, 'body': 'x', 'token_estimate': size}


def path_result():
    turns = [{'id': f't{i}', 'actor': 'traveler' if i % 2 == 0 else 'companion', 'text': f'Invented turn {i} with Zed.',
              'call_id': f'd{i}'} for i in range(4)]
    calls = [call('p', 'persona-past', [item('experiment', 300)], 'Invented sketch.')]
    calls += [call('h1', 'history-compaction', [item('historical', 900)], 'Chunk one.'),
              call('h2', 'history-compaction', [item('historical', 800)], 'Chunk two.')]
    calls += [call(f'd{i}', t['actor'], [item('instruction', 50), item('summary', 400), item('endpoint', 30)], t['text'])
              for i, t in enumerate(turns)]
    calls.append(call('r', 'path-handoff-review', [item('simulated', 200)], 'Ready.'))
    steps = [{'path': {'endpoint_visible': t['actor'] == 'companion'}, 'cards': []} for t in turns]
    record = lambda body: {'id': 'm', 'body': body, 'speaker': 'human'}
    return {'run_id': ID, 'kind': 'path-tracing', 'status': 'completed', 'turns': turns, 'calls': calls,
            'context_steps': steps, 'case': {'event': 'invented-interval', 'condition': {'id': 'endpoint-companion-only'}},
            'path': {'start': record('Invented start.'), 'endpoint': record('Invented end with Zed.'),
                     'gap_ids': ['g1', 'g2', 'g3'], 'policy': 'companion-only'}}


def test_case_beats_follow_call_order_and_collapse_preparation():
    out = case_beats(path_result())
    nodes = [b['node'] for b in out['beats']]
    assert nodes == ['start', 'gap', 'end', 'memory', 'memory', 'traveler', 'companion', 'traveler', 'companion', 'critic']
    compaction = out['beats'][4]
    assert compaction['count'] == 2 and compaction['speaker'].endswith('× 2')
    turn = out['beats'][5]
    assert turn['kind'] == 'turn' and turn['endpointVisible'] is False
    assert out['beats'][6]['endpointVisible'] is True
    assert {c['kind'] for c in turn['context']} == {'instruction', 'memory', 'endpoint'}
    assert out['beats'][-1]['warn']
    assert out['meta']['condition'] == 'endpoint-companion-only'


def test_single_author_turns_share_one_call():
    turns = [{'id': f't{i}', 'actor': 'traveler' if i % 2 == 0 else 'companion', 'text': f'Turn {i}', 'call_id': 'a',
              'transition': {'location': 'harbor', 'time_elapsed': 'minutes', 'event': None}} for i in range(3)]
    result = {'run_id': ID, 'kind': 'script-path', 'turns': turns, 'context_steps': [],
              'calls': [call('a', 'script-author', [item('historical', 500)], 'json')],
              'path': {'start': {'body': 'Start'}, 'endpoint': {'body': 'End'}, 'gap_ids': []}, 'completion_reason': 'model_handoff'}
    beats = case_beats(result)['beats']
    authored = [b for b in beats if b['node'] == 'author']
    assert len(authored) == 3 and authored[0]['context'] and not authored[1]['context'] and authored[1]['sameCall']
    assert authored[0]['state']['location'] == 'harbor'
    assert beats[-1]['node'] == 'end'


@pytest.fixture
def deck(tmp_path):
    content = tmp_path / 'deck' / 'deck.local.json'
    content.parent.mkdir()
    content.write_text(json.dumps({'title': 'Invented', 'slides': [{'id': 'one', 'layout': 'title', 'title': 'Invented'}]}))
    results = tmp_path / 'results'
    run = results / 'path-tracing-screening'
    run.mkdir(parents=True)
    plan = {'cases': [{'id': ID, 'event': 'invented-interval', 'condition': 'endpoint-companion-only', 'seed': 'bridge'}],
            'suite': {'kind': 'path-tracing', 'conditions': [{'traveler': SETTINGS, 'companion': SETTINGS}]}}
    (run / 'plan.json').write_text(json.dumps(plan))
    (run / f'{ID}.json').write_text(json.dumps(path_result()))
    web = tmp_path / 'web'
    web.mkdir()
    (web / 'index.html').write_text('<h1>Deck</h1>')
    aliases = AliasRewriter(AliasConfig(people=({'names': ('Quill',), 'alias': 'The Invented Traveler', 'role': 'participant'},
                                                 {'names': ('Zed',), 'alias': 'The Invented Friend'})))
    return content, results, web, aliases


def client(deck, host='127.0.0.1'):
    content, results, web, aliases = deck
    return TestClient(create_deck(content, results_root=results, web_root=web, aliases=aliases),
                      base_url='http://127.0.0.1:8003', client=(host, 50000))


def test_deck_serves_private_content_and_saves_private_edits(deck):
    with client(deck) as c:
        body = c.get('/api/deck').json()
        assert body['source'] == 'private' and body['content']['slides'][0]['id'] == 'one'
        edits = {'version': 1, 'text': {'one.title': 'Changed'}, 'style': {}, 'slides': {},
                 'annotations': [{'id': 'a', 'slide': 'one', 'target': 'one.title', 'text': 'Tighten this.', 'status': 'open', 'created': '2026-10-16T00:00'}]}
        assert c.put('/api/edits', json=edits).status_code == 200
        assert c.get('/api/deck').json()['edits']['text'] == {'one.title': 'Changed'}
    saved = deck[0].with_name('edits.local.json')
    notes = deck[0].with_name('annotations.local.md')
    assert stat.S_IMODE(saved.stat().st_mode) == 0o600
    assert 'Slide 1 (one)' in notes.read_text() and 'Tighten this.' in notes.read_text()


def test_edit_structure_is_validated(deck):
    with client(deck) as c:
        assert c.put('/api/edits', json={'unexpected': 1}).status_code == 422
        assert c.put('/api/edits', json={'text': []}).status_code == 422
        assert c.put('/api/edits', content=b'not json').status_code == 422


def test_example_deck_when_private_content_is_absent(deck, tmp_path):
    content, results, web, aliases = deck
    (web / 'example-deck.json').write_text(json.dumps({'slides': [{'id': 'example'}]}))
    app = create_deck(tmp_path / 'missing' / 'deck.local.json', results_root=results, web_root=web, aliases=aliases)
    with TestClient(app, base_url='http://127.0.0.1:8003', client=('127.0.0.1', 1)) as c:
        body = c.get('/api/deck').json()
        assert body['source'] == 'example' and body['content']['slides'][0]['id'] == 'example'


def test_saved_samples_are_aliased_and_path_checked(deck):
    with client(deck) as c:
        assert c.get('/api/runs').json()['runs'][0]['kind'] == 'path-tracing'
        assert c.get('/api/runs/path-tracing-screening/cases').json()['cases'][0]['id'] == ID
        sample = c.get('/api/sample', params={'run': 'path-tracing-screening', 'case': ID}).json()
        text = json.dumps(sample)
        assert 'Zed' not in text and 'The Invented Friend' in text
        assert c.get('/api/sample', params={'run': '../results', 'case': ID}).status_code == 404
        assert c.get('/api/sample', params={'run': 'path-tracing-screening', 'case': 'd' * 64}).status_code == 404


def test_remote_and_cross_site_requests_are_refused(deck):
    with client(deck, host='10.0.0.5') as c:
        assert c.get('/api/deck').status_code == 403
    with client(deck) as c:
        assert c.put('/api/edits', json={}, headers={'Origin': 'https://example.com'}).status_code == 403
        assert c.get('/api/deck', headers={'Sec-Fetch-Site': 'cross-site'}).status_code == 403


def test_hosted_deployment_refuses_the_deck(deck, monkeypatch):
    monkeypatch.setenv('MACHINA_DEPLOYMENT', 'hosted')
    with pytest.raises(RuntimeError):
        client(deck)
