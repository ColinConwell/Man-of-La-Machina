import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from tools.results_dashboard.app import create_dashboard

ID = 'a' * 64
OTHER = 'b' * 64


@pytest.fixture
def saved(tmp_path):
    root = tmp_path / 'results'
    run = root / 'final-screening'
    run.mkdir(parents=True)
    settings = {'provider': 'demo', 'model': 'documentary-demo-v1'}
    condition = {'id': 'baseline', 'traveler': settings, 'companion': settings}
    plan = {'cases': [{'id': ID, 'event': 'april-1', 'seed': 'practical', 'condition': 'baseline', 'repetition': 0}],
            'suite': {'conditions': [condition]}, 'content_version': 'invented', 'engine_hash': 'abc'}
    result = {'run_id': ID, 'case': {'condition': condition}, 'status': 'completed', 'offline': True,
              'metrics': {'completed_turns': 2}, 'turns': [{'text': 'Invented simulated text.'}],
              'persona': {'text': 'Invented sketch', 'evidence': [{'body': 'Private invented evidence'}]},
              'memories': [], 'calls': [{'id': 'call-1', 'manifest': {'policy_id': 'test:traveler',
              'settings': settings, 'token_estimate': 100}, 'metadata': {}, 'status': 'completed',
              'elapsed_seconds': 1.0, 'payload_hash': 'hash', 'request_payload': {'messages': ['Invented large payload']},
              'text': 'Invented simulated text.'}]}
    (run/'plan.json').write_text(json.dumps(plan))
    (run/(ID+'.json')).write_text(json.dumps(result))
    web = tmp_path/'web'
    web.mkdir()
    (web/'index.html').write_text('<h1>Results</h1>')
    return root, run, web, result


def client(saved, **kwargs):
    return TestClient(create_dashboard(saved[0], saved[2]), base_url='http://127.0.0.1:8002',
                      client=('127.0.0.1', 50000), **kwargs)


def test_catalog_and_lightweight_detail(saved):
    with client(saved) as c:
        catalog = c.get('/api/runs').json()
        assert catalog['default'] == 'final-screening'
        assert catalog['runs'][0]['offline']
        response = c.get('/api/runs/final-screening')
        assert response.status_code == 200
        assert response.json()['cases'][0]['metrics']['completed_turns'] == 2
        detail = c.get(f'/api/runs/final-screening/cases/{ID}').json()
        assert 'evidence' not in detail['persona']
        assert 'request_payload' not in detail['calls'][0]
        receipt = c.get(f'/api/runs/final-screening/cases/{ID}/receipts/call-1').json()
        assert receipt['request_payload']['messages'] == ['Invented large payload']
        download = c.get(f'/api/runs/final-screening/cases/{ID}/download')
        assert 'attachment' in download.headers['content-disposition']
        assert download.json() == saved[3]
        assert response.headers['cache-control'] == 'no-store'


def test_refresh_reads_changed_result_and_marks_missing(saved):
    with client(saved) as c:
        assert c.get('/api/runs/final-screening').json()['cases'][0]['status'] == 'completed'
        r = saved[3]
        r['status'] = 'failed'
        (saved[1]/(ID+'.json')).write_text(json.dumps(r))
        assert c.get('/api/runs/final-screening').json()['cases'][0]['status'] == 'failed'
        (saved[1]/(ID+'.json')).unlink()
        assert c.get('/api/runs/final-screening').json()['cases'][0]['status'] == 'missing'


def test_origin_host_and_client_boundaries(saved):
    with client(saved) as c:
        assert c.get('/api/runs', headers={'origin': 'https://foreign.example'}).status_code == 403
        assert c.get('/api/runs', headers={'sec-fetch-site': 'cross-site'}).status_code == 403
        assert c.get('/api/runs', headers={'host': 'foreign.example'}).status_code == 400
        assert c.get('/api/runs', headers={'origin': 'http://127.0.0.1:8002'}).status_code == 200
        assert c.post('/api/runs').status_code == 405
    remote = TestClient(create_dashboard(saved[0], saved[2]), base_url='http://127.0.0.1', client=('10.1.2.3', 5))
    assert remote.get('/api/runs').status_code == 403


def test_unknown_cases_symlinks_and_static_escape(saved, tmp_path):
    (saved[1]/(OTHER+'.json')).write_text(json.dumps({'run_id': OTHER}))
    with client(saved) as c:
        assert c.get(f'/api/runs/final-screening/cases/{OTHER}').status_code == 404
        assert c.get(f'/api/runs/final-screening/cases/{ID}/receipts/missing').status_code == 404
        assert c.get('/').status_code == 200
        assert c.get('/%2e%2e/%2e%2e/pyproject.toml').status_code == 404
        external = tmp_path/'external.json'
        external.write_text(json.dumps(saved[3]))
        (saved[1]/(ID+'.json')).unlink()
        (saved[1]/(ID+'.json')).symlink_to(external)
        assert c.get(f'/api/runs/final-screening/cases/{ID}').status_code == 404
        (saved[0]/'linked-run').symlink_to(saved[1], target_is_directory=True)
        assert c.get('/api/runs/linked-run').status_code == 404


def test_empty_results_and_hosted_guard(tmp_path, monkeypatch):
    c = TestClient(create_dashboard(tmp_path), base_url='http://localhost', client=('127.0.0.1', 5))
    assert c.get('/api/runs').json() == {'runs': [], 'default': None}
    monkeypatch.setenv('MACHINA_DEPLOYMENT', 'hosted')
    with pytest.raises(RuntimeError, match='only locally'):
        create_dashboard(tmp_path)


def test_path_summary_and_detail_preserve_anchors_without_duplicate_evidence(saved):
    root, old, web, result = saved
    run = root/'path-tracing-screening'
    run.mkdir()
    plan = json.loads((old/'plan.json').read_text())
    plan['suite']['kind'] = 'path-tracing'
    (run/'plan.json').write_text(json.dumps(plan))
    result['kind'] = 'path-tracing'
    result['path'] = {'start_title': 'Invented Start', 'end_title': 'Invented End',
        'start': {'body': 'Invented starting evidence'}, 'endpoint': {'body': 'Invented endpoint'},
        'policy': 'backward', 'gap_ids': ['gap-1'], 'review_status': 'completed',
        'plan': {'text': 'Invented waypoint plan', 'evidence': ['large duplicate']},
        'review': {'text': 'Invented review', 'evidence': ['large duplicate']}}
    (run/(ID+'.json')).write_text(json.dumps(result))
    with client(saved) as c:
        assert c.get('/api/runs').json()['default'] == 'path-tracing-screening'
        row = c.get('/api/runs/path-tracing-screening').json()['cases'][0]
        assert row['path']['gap_turns'] == 1 and 'endpoint' not in row['path']
        detail = c.get(f'/api/runs/path-tracing-screening/cases/{ID}').json()
        assert detail['path']['endpoint']['body'] == 'Invented endpoint'
        assert 'evidence' not in detail['path']['plan'] and 'evidence' not in detail['path']['review']


def test_setup_and_export_include_all_receipts_without_modifying_original(saved):
    saved[3]['preprocessing_calls'] = [{'id': 'extraction', 'manifest': {'policy_id': 'test:timeline-extraction',
        'settings': {'provider': 'demo', 'model': 'fixture'}, 'items': []}, 'text': 'Extracted', 'status': 'completed'}]
    (saved[1]/(ID+'.json')).write_text(json.dumps(saved[3]))
    original = (saved[1]/(ID+'.json')).read_bytes()
    with client(saved) as c:
        endpoint = f'/api/runs/final-screening/cases/{ID}'
        graph = c.get(endpoint+'/setup')
        assert graph.status_code == 200 and graph.json()['call_count'] == 2
        assert 'receipts' not in graph.json()
        export = c.get(endpoint+'/setup/download')
        assert 'attachment' in export.headers['content-disposition']
        assert len(export.json()['receipts']) == 2
        assert export.json()['saved_result'] == saved[3]
        assert c.get(endpoint+'/receipts/extraction').json()['text'] == 'Extracted'
    assert (saved[1]/(ID+'.json')).read_bytes() == original


def test_every_saved_result_surface_and_download_uses_alias_projection(saved):
    from packages.domain.models import digest
    r=saved[3]
    r['turns']=[{'id':'turn-1','actor':'traveler','call_id':'call-1','text':'Aster arrives. The Visitor stays.'}]
    r['persona']['text']='Aster Riley speaks.'
    r['calls'][0]['manifest']['items']=[{'id':'prompt','origin':'instruction','body':'Play Aster.','role':'system'}]
    r['calls'][0]['request_payload']={'messages':[{'content':'Aster Riley speaks.'}]}
    r['calls'][0]['payload_hash']=digest(r['calls'][0]['request_payload'])
    r['calls'][0]['text']='Aster arrives.'
    r['case']['condition']['label']='Aster condition'
    path=saved[1]/(ID+'.json')
    path.write_text(json.dumps(r))
    original=path.read_bytes()
    base=f'/api/runs/final-screening/cases/{ID}'
    with client(saved) as c:
        for suffix in ['', '/receipts/call-1','/setup','/setup/download','/download']:
            response=c.get(base+suffix)
            assert response.status_code==200
            assert 'aster' not in response.text.casefold()
            assert 'riley' not in response.text.casefold()
            assert response.json()['display_projection']['content_changed']
        receipt=c.get(base+'/receipts/call-1').json()
        assert receipt['payload_hash']==r['calls'][0]['payload_hash']
        assert receipt['display_payload_hash']==digest(receipt['request_payload'])
        assert 'aster' not in c.get('/api/runs/final-screening').text.casefold()
    assert path.read_bytes()==original
