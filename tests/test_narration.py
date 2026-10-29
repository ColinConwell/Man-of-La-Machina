import asyncio
import time
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.narration import chunks
from tests.test_api import Stub, make_branch, submit


async def audio(text, voice, model):
    return b'ID3-invented-audio'


def ready(client, result):
    for _ in range(100):
        job = client.get('/api/v1/narration/' + result['id']).json()
        if job['status'] != 'generating':
            return job
        time.sleep(.01)
    raise AssertionError('Narration did not settle')


def test_audio_owned_cached_and_deleted(bundle):
    app = create_app(bundle, speech_synthesizer=audio)
    with TestClient(app) as a, TestClient(app) as b:
        # Establish each browser session before making concurrent mutations.
        a.get('/api/v1/experience'); b.get('/api/v1/experience')
        payload = {'message_id':'m0', 'voice':'cedar'}
        created = a.post('/api/v1/narration', json=payload)
        assert created.status_code == 202
        job = ready(a, created.json())
        assert job['status'] == 'ready'
        assert 'owner' not in job and 'body' not in job
        assert a.post('/api/v1/narration', json=payload).json()['id'] == job['id']
        assert a.get(job['parts'][0]).content == b'ID3-invented-audio'
        assert a.get(job['parts'][0]).headers['cache-control'] == 'no-store'
        partial = a.get(job['parts'][0], headers={'Range':'bytes=3-8'})
        assert partial.status_code == 206 and partial.content == b'-inven'
        assert partial.headers['content-range'] == 'bytes 3-8/18'
        assert a.get(job['parts'][0], headers={'Range':'bytes=999-'}).status_code == 416
        assert b.get(job['parts'][0]).status_code == 404
        assert b.get('/api/v1/narration/' + job['id']).status_code == 404
        assert a.post('/api/v1/narration', json=payload, headers={'Origin':'https://example.com'}).status_code == 403
        assert b.delete('/api/v1/narration').status_code == 200
        assert a.get(job['parts'][0]).status_code == 200
        assert a.delete('/api/v1/narration').status_code == 200
        assert a.get(job['parts'][0]).status_code == 404
        assert len(app.state.narration.usage) == 1  # Deletion cannot replenish paid budget.


def test_branch_audio_obeys_branch_ownership_and_deletion(bundle):
    app = create_app(bundle, lambda _: Stub(), speech_synthesizer=audio)
    with TestClient(app) as a, TestClient(app) as b:
        id = make_branch(a); run = submit(a, id).json(); a.get(run['stream_url'])
        messages = a.get('/api/v1/branches/' + id).json()['messages']
        for m in messages:
            payload = {'message_id':m['id'], 'branch_id':id}
            assert b.post('/api/v1/narration',json=payload).status_code == 404
            job = ready(a,a.post('/api/v1/narration',json=payload).json())
            assert job['status'] == 'ready'
        a.delete('/api/v1/branches/' + id)
        assert a.get(job['parts'][0]).status_code == 404
        assert not app.state.narration.jobs


def test_audio_budget_failure_and_expiry(bundle):
    async def fail(*_): raise RuntimeError('secret-provider-details')
    app = create_app(bundle, speech_synthesizer=fail)
    with TestClient(app) as c:
        c.get('/api/v1/experience')
        assert c.post('/api/v1/narration',json={'message_id':'missing'}).status_code == 404
        assert c.post('/api/v1/narration',json={'message_id':'m0','voice':'unknown'}).status_code == 422
        job=ready(c,c.post('/api/v1/narration',json={'message_id':'m0'}).json())
        assert job['status']=='failed' and not job['parts']
        assert 'secret' not in job['error']
        app.state.narration.owner_budget=1
        assert c.post('/api/v1/narration',json={'message_id':'m0'}).status_code==429
        app.state.narration.jobs[job['id']]['expires']=0
        assert c.get('/api/v1/narration/'+job['id']).status_code==404


def test_chunking_keeps_all_text():
    text=('A modest sentence. Another sentence with a longer clause.\n' * 200)
    parts=list(chunks(text))
    assert ''.join(parts)==text and max(map(len,parts))<=3500
    assert ''.join(chunks('a'*8000))=='a'*8000


def test_inflight_delete_cancels_and_never_restores_audio(bundle):
    async def slow(*_):
        await asyncio.sleep(30)
        return b'ID3'
    app=create_app(bundle,speech_synthesizer=slow)
    with TestClient(app) as c:
        c.get('/api/v1/experience')
        job=c.post('/api/v1/narration',json={'message_id':'m0'}).json()
        assert c.post('/api/v1/narration',json={'message_id':'m1'}).status_code==429
        c.delete('/api/v1/narration')
        assert c.get('/api/v1/narration/'+job['id']).status_code==404
        assert not app.state.narration.jobs


def test_multichunk_audio_and_storage_budget(bundle):
    from packages.domain.repository import ContentRepository
    app=create_app(bundle,speech_synthesizer=audio)
    with TestClient(app) as c:
        c.get('/api/v1/experience')
        text='This is an invented long passage. ' * 230
        long_message=bundle.messages[0].model_copy(update={'body':text})
        app.state.narration.repo=ContentRepository(bundle.model_copy(update={'messages':(long_message,)+bundle.messages[1:]}))
        job=ready(c,c.post('/api/v1/narration',json={'message_id':'m0'}).json())
        assert len(job['parts'])==len(list(chunks(text)))
        assert all(c.get(url).status_code==200 for url in job['parts'])
        app.state.narration.max_bytes=1
        assert c.post('/api/v1/narration',json={'message_id':'m1'}).status_code==429
