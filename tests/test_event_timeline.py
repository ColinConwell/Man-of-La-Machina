"""Invented evidence validates source grounding, chronology, and asset boundaries."""
import json
from pathlib import Path
from packages.domain.models import digest
from packages.timeline import source_records, validate_events, eligible_events, load_timeline, corpus_hash
from packages.timeline.extract import chunk_records


def candidate(**updates):
    return {'actor':'The Traveler','action':'stays','text':'The Traveler stays one night at the invented harbor.',
            'place':'Invented Harbor','occurred_at':None,'occurred_end_at':None,'duration_text':'one night',
            'date_basis':'unknown','status':'reported',
            'evidence':[{'source_id':'m0','quote':'I spent one night at the invented harbor.'}],**updates}


def source(id='m0',ordinal=0,disclosed_at='2026-01-01',kind='dialogue'):
    return {'id':id,'body':'I spent one night at the invented harbor.','ordinal':ordinal,'kind':kind,
            'disclosed_at':disclosed_at,'disclosed_end_at':None,'content_hash':'invented'}


def test_exact_evidence_and_duration_are_required():
    good=candidate()
    bad_id=candidate(evidence=[{'source_id':'absent','quote':'I spent one night at the invented harbor.'}])
    bad_quote=candidate(evidence=[{'source_id':'m0','quote':'I spent two nights at the invented harbor.'}])
    bad_duration=candidate(duration_text='three nights')
    accepted,rejected=validate_events({'events':[good,bad_id,bad_quote,bad_duration]},[source()])
    assert len(accepted)==1 and len(rejected)==3
    assert accepted[0]['entry_message_id']=='m0'
    assert accepted[0]['occurred_at'] is None
    assert accepted[0]['disclosed_at']=='2026-01-01'


def test_annotation_unknown_disclosure_and_same_day_ordinal_do_not_leak(bundle):
    cutoff=bundle.messages[2].model_copy(update={'disclosed_at':'2026-01-03'})
    events=[]
    for r in [source(),source('later',3),source('annotation',None,None,'annotation'),source('known-annotation',None,'2026-01-04','annotation')]:
        c=candidate(evidence=[{'source_id':r['id'],'quote':r['body']}])
        result,_=validate_events({'events':[c]},[r])
        events.extend(result)
    eligible=eligible_events({'status':'completed','events':events},cutoff)
    assert [e['source_ids'] for e in eligible]==[['m0']]
    assert eligible_events({'status':'completed','events':events},cutoff,allowed_source_ids=[])==[]
    assert next(e for e in events if e['source_ids']==['annotation'])['annotation_source_ids']==['annotation']


def test_disclosure_interval_uses_end_not_start(bundle):
    r={**source(),'disclosed_end_at':'2026-02-01'}
    events,_=validate_events({'events':[candidate()]},[r])
    cutoff=bundle.messages[2].model_copy(update={'disclosed_at':'2026-01-03'})
    assert eligible_events({'status':'completed','events':events},cutoff)==[]


def test_invalid_occurrence_and_unknown_date_basis_rejected():
    bad=candidate(occurred_at='2026-02-30',date_basis='explicit')
    reversed_dates=candidate(occurred_at='2026-02-03',occurred_end_at='2026-02-01',date_basis='explicit')
    unknown_dated=candidate(occurred_at='2026-02-01')
    assert validate_events({'events':[bad,reversed_dates,unknown_dated]},[source()])[0]==[]


def test_source_coverage_and_annotation_deduplication(bundle):
    records=source_records(bundle)
    assert len(records)==len(bundle.messages)+len([d for d in bundle.documents if d.origin=='annotation'])
    chunks=chunk_records(records,max_chars=20)
    for r in records:
        fragments=[f for c in chunks for f in c if f['id']==r['id']]
        assert ''.join(f['body'] for f in fragments)==r['body']
        assert fragments[0]['fragment_offset']==0
        assert fragments[-1]['fragment_end']==len(r['body'])


def test_stale_or_absent_assets_are_never_served(bundle,tmp_path):
    path=tmp_path/'events.json'
    assert load_timeline(bundle,path)['status']=='unavailable'
    timeline={'status':'completed','content_version':bundle.content_version,'corpus_hash':corpus_hash(bundle),'events':[{'id':'invented'}]}
    path.write_text(json.dumps(timeline))
    assert load_timeline(bundle,path)['events']==[{'id':'invented'}]
    timeline['corpus_hash']='other-private-archive'
    path.write_text(json.dumps(timeline))
    assert load_timeline(bundle,path)['status']=='stale'
    assert load_timeline(bundle,path)['events']==[]


async def test_extraction_saves_exact_receipts_and_resumes(bundle,tmp_path):
    from packages.domain.providers import ProviderEvent
    from packages.timeline.extract import extract
    calls=[]
    class Fake:
        async def stream(self,manifest):
            calls.append(manifest)
            yield ProviderEvent('delta','{"events":[]}')
            yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})
    path=tmp_path/'timeline.json'
    first=await extract(bundle,path,provider_factory=lambda _:Fake())
    assert first['status']=='completed'
    assert first['coverage']['sources_processed']==first['coverage']['sources_total']
    receipts=list((tmp_path/'event-timeline-receipts').glob('*.json'))
    receipt=json.loads(receipts[0].read_text())
    assert receipt['payload_hash']==digest(receipt['request_payload'])
    count=len(calls)
    second=await extract(bundle,path,provider_factory=lambda _:Fake())
    assert len(calls)==count
    assert second['events']==[]
    assert path.stat().st_mode & 0o777==0o600


def test_preprocessing_context_cannot_secretly_look_forward(bundle):
    cutoff=bundle.messages[2].model_copy(update={'disclosed_at':'2026-01-03'})
    past=source()
    future=source('future',3,'2026-01-03')
    # The quote is past-only, but the extraction call also received a later turn.
    events,_=validate_events({'events':[candidate()]},[past,future])
    assert events[0]['source_ids']==['m0']
    assert eligible_events({'status':'completed','events':events},cutoff)==[]
    annotation=source('annotation',None,None,'annotation')
    events,_=validate_events({'events':[candidate()]},[past,annotation])
    assert eligible_events({'status':'completed','events':events},cutoff)==[]


async def test_prefix_supplement_is_separate_and_as_of_safe(bundle,tmp_path):
    from packages.domain.providers import ProviderEvent
    from packages.timeline.extract import supplement_boundary
    m0=bundle.messages[0].model_copy(update={'body':source()['body'],'disclosed_at':'2026-01-01'})
    bundle=bundle.model_copy(update={'messages':(m0,*bundle.messages[1:])})
    timeline={'status':'completed','content_version':bundle.content_version,'corpus_hash':corpus_hash(bundle),
              'events':[],'extraction':{'receipt_directory':str(tmp_path/'receipts')}}
    seen=[]
    class Fake:
        async def stream(self,manifest):
            seen.append(manifest)
            yield ProviderEvent('delta',json.dumps({'events':[candidate()]}))
            yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})
    result=await supplement_boundary(bundle,timeline,'m0',tmp_path/'timeline.json',provider_factory=lambda _:Fake())
    assert result['events']==[]
    assert len(eligible_events(result,m0))==1
    assert result['extraction']['supplement_chunks'][0]['source_ids']==['m0']
    assert 'Invented turn 1' not in seen[0].model_dump_json()
    assert eligible_events(result,bundle.messages[1])==[]
    assert result['asset_hash']==digest({k:v for k,v in result.items() if k!='asset_hash'})


def test_review_requires_exhaustive_unique_known_ids():
    import pytest
    from packages.timeline.review import validate_review
    candidates=[{'id':'e1'},{'id':'e2'}]
    assert validate_review({'accepted_ids':['e1'],'rejected':[{'id':'e2','reason':'unsupported plan'}]},candidates)[0]==['e1']
    for raw in [
        {'accepted_ids':['e1','invented'],'rejected':[]},
        {'accepted_ids':['e1'],'rejected':[]},
        {'accepted_ids':['e1','e1'],'rejected':[{'id':'e2','reason':'bad'}]},
    ]:
        with pytest.raises(ValueError):
            validate_review(raw,candidates)


async def test_semantic_review_preserves_scopes_receipts_and_fails_closed(bundle,tmp_path):
    from copy import deepcopy
    from packages.domain.providers import ProviderEvent
    from packages.timeline.extract import extract
    from packages.timeline.review import review_timeline
    m0=bundle.messages[0].model_copy(update={'body':source()['body'],'disclosed_at':'2026-01-01'})
    bundle=bundle.model_copy(update={'messages':(m0,*bundle.messages[1:])})
    class Fake:
        async def stream(self,manifest):
            if manifest.policy_id.endswith('semantic-review-v2'):
                ids=[e['id'] for e in json.loads(manifest.items[2].body)]
                yield ProviderEvent('delta',json.dumps({'accepted_ids':ids,'rejected':[]}))
            else:
                yield ProviderEvent('delta',json.dumps({'events':[candidate()]}))
            yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})
    output=tmp_path/'events.json'
    original=await extract(bundle,output,provider_factory=lambda _:Fake())
    final=await review_timeline(bundle,original,output,provider_factory=lambda _:Fake())
    assert len(final['events'])==1
    assert len(final['events'][0]['provenance']['call_ids'])==2
    assert final['events'][0]['provenance']['processing_source_ids']==original['events'][0]['provenance']['processing_source_ids']
    assert final['semantic_review']['status']=='completed'
    assert json.loads((tmp_path/'event-timeline-candidates.json').read_text())['asset_hash']==original['asset_hash']
    # A cached malformed review is not permission to keep unreviewed candidates.
    mapping=final['extraction']['review_chunks'][0]
    receipt_path=Path(original['extraction']['receipt_directory'])/mapping['receipt_file']
    receipt=json.loads(receipt_path.read_text())
    receipt['text']='{"accepted_ids":["unsupported"],"rejected":[]}'
    receipt_path.write_text(json.dumps(receipt))
    failed=await review_timeline(bundle,original,output,provider_factory=lambda _:Fake())
    assert failed['status']=='partial'
    assert failed['events']==[]
    assert failed['semantic_review']['failed_chunks']==1


def test_review_accepts_only_whole_response_json_fence():
    import pytest
    from packages.timeline.review import parse_review
    assert parse_review('```json\n{"accepted_ids":[],"rejected":[]}\n```')=={'accepted_ids':[],'rejected':[]}
    with pytest.raises(ValueError):
        parse_review('Here is a review: ```json\n{"accepted_ids":[],"rejected":[]}\n```')
