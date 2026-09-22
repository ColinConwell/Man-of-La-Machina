"""Invented evidence only: cutoff leakage, role reversal, provenance, and failures."""
import json
from pathlib import Path
import pytest
from packages.domain.models import GenerationSettings, digest
from packages.domain.providers import ProviderEvent, ProviderError, request_payload, PROVIDERS
from packages.experiments.config import Suite, Condition, Event, Seed, default_suite, cases
from packages.experiments.context import split_history, retrieve, make_manifest, dialogue_records
from packages.experiments.runner import Engine
from packages.experiments.__main__ import identity, private_write


def setup(bundle, **updates):
    settings = GenerationSettings(provider='openai', model='invented-model', max_output_tokens=100)
    condition = Condition(id='test', traveler=settings, companion=settings, **updates)
    suite = Suite(events=(Event(id='event',start_id='test',seeds=(Seed(id='seed',prompt='Ask about invented evidence'),)),),
                  conditions=(condition,), builder=settings, exchanges=3, recent_turns=1, rolling_every=2)
    # Branch immediately after m2. m3 onward are future, despite sharing a date.
    start=bundle.profile.start_options[0].model_copy(update={'entry_message_id':'m2'})
    bundle=bundle.model_copy(update={'profile':bundle.profile.model_copy(update={'start_options':(start,)})})
    return bundle,suite,next(cases(suite))


class Fake:
    def __init__(self, seen):
        self.seen=seen
    async def stream(self,manifest):
        self.seen.append(manifest)
        role=manifest.policy_id.split(':')[1]
        yield ProviderEvent('delta', 'Fictional '+role+' reply without future details.')
        yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})


def test_cutoff_and_later_disclosure(bundle):
    late=bundle.messages[1].model_copy(update={'disclosed_at':'2026-05-01'})
    bundle=bundle.model_copy(update={'messages':(bundle.messages[0],late,*bundle.messages[2:])})
    past,future,excluded=split_history(bundle,'m2')
    assert [m.id for m in past]==['m0','m2']
    assert [m.id for m in future]==['m1','m3','m4','m5']
    assert 'late-doc' not in [m.id for m in past+future]
    assert any(e['id']=='m1' for e in excluded)


@pytest.mark.parametrize('memory',['full','compact','rolling'])
async def test_no_future_and_role_reversal(bundle,memory):
    bundle,suite,case=setup(bundle,memory=memory)
    before=bundle.model_dump_json()
    seen=[]
    result=await Engine(bundle,suite,provider_factory=lambda _:Fake(seen)).run(case)
    assert result['status']=='completed'
    assert bundle.model_dump_json()==before
    assert [t['actor'] for t in result['turns']]==['traveler','companion']*3
    assert all(t['origin']=='simulated' for t in result['turns'])
    wire=json.dumps([m.model_dump(mode='json')['items'] for m in seen])
    assert all(f'Invented turn {i}' not in wire for i in (3,4,5))
    assert 'Do not leak this future knowledge.' not in wire
    traveler=next(m for m in seen if m.policy_id.endswith(':traveler'))
    companion=next(m for m in seen if m.policy_id.endswith(':companion'))
    assert next(i for i in traveler.items if i.id=='m2').role=='assistant'
    assert next(i for i in companion.items if i.id=='m2').role=='user'
    if memory=='rolling':
        assert result['metrics']['branch_compactions']>=1
        assert result['context_steps'][-1]['compacted_until']>0
    if memory!='full':
        assert set(result['memories'][0]['source_ids'])=={'m0','m1'}
    for call in result['calls']:
        assert call['payload_hash']==digest(call['request_payload'])


@pytest.mark.parametrize('mode',['minimal','past','retrospective'])
async def test_character_evidence_scope(bundle,mode):
    bundle,suite,case=setup(bundle,persona=mode)
    seen=[]
    result=await Engine(bundle,suite,provider_factory=lambda _:Fake(seen)).run(case)
    ids=set(result['persona']['source_ids'])
    assert ids==({'m0','m2','m4'} if mode=='retrospective' else {'m0','m2'} if mode=='past' else set())
    companion=next(m for m in seen if m.policy_id.endswith(':companion'))
    assert not any(i.origin=='persona' for i in companion.items)
    assert result['metrics']['retrospective_persona_sources']==(1 if mode=='retrospective' else 0)


@pytest.mark.parametrize('mode',['static','dynamic','adapted'])
async def test_forward_labeled_and_audience_limited(bundle,mode):
    bundle,suite,case=setup(bundle,forward=mode,forward_audience='traveler')
    seen=[]
    result=await Engine(bundle,suite,provider_factory=lambda _:Fake(seen)).run(case)
    assert result['status']=='completed'
    for call in result['calls']:
        m=call['manifest']
        if m['policy_id'].endswith(':companion'):
            assert not any(i['origin'] in ('parallel','adaptation') for i in m['items'])
        if m['policy_id'].endswith(':traveler'):
            assert any(i['origin']=='parallel' and 'Out-of-Sequence' in i['body'] for i in m['items'])
    assert result['metrics']['future_cards_exposed']==3
    if mode=='adapted':
        assert any(s['adaptation'] for s in result['context_steps'])


def test_retrieval_changes_and_deterministic_ties(bundle):
    future=[bundle.messages[i].model_copy(update={'body':body}) for i,body in [(3,'shelter shelter'),(4,'shelter'),(5,'music')]]
    assert [r['id'] for r in retrieve(future,'shelter',2,100)]==['m3','m4']
    assert [r['id'] for r in retrieve(future,'music',2,100)]==['m5']
    assert retrieve(future,'unmatched',2,100)==[]


async def test_partial_failure_is_not_a_turn_or_memory(bundle):
    bundle,suite,case=setup(bundle,persona='minimal')
    class Broken:
        async def stream(self,m):
            yield ProviderEvent('delta','Partial reply')
            raise ProviderError('interrupted','sensitive provider message')
    result=await Engine(bundle,suite,provider_factory=lambda _:Broken()).run(case)
    assert result['status']=='failed' and result['turns']==[]
    assert result['calls'][0]['text']=='Partial reply'
    assert 'sensitive provider message' not in json.dumps(result)
    bundle,suite,case=setup(bundle,persona='past')
    result=await Engine(bundle,suite,provider_factory=lambda _:Broken()).run(case)
    assert result['status']=='failed' and 'persona' not in result


async def test_output_limit_stops_branch(bundle):
    bundle,suite,case=setup(bundle,persona='minimal')
    class Truncated:
        async def stream(self,m):
            yield ProviderEvent('delta','Truncated')
            yield ProviderEvent('metadata',metadata={'finish_reason':'MAX_TOKENS'})
    result=await Engine(bundle,suite,provider_factory=lambda _:Truncated()).run(case)
    assert result['status']=='failed' and result['turns']==[]
    assert result['calls'][0]['error']['category']=='output_limit'


async def test_cache_depends_on_source_content(bundle):
    bundle,suite,case=setup(bundle)
    seen=[]
    engine=Engine(bundle,suite,provider_factory=lambda _:Fake(seen))
    one=await engine.run(case)
    two=await engine.run(case)
    assert two['calls'][0]['cache_hit'] and one['persona']['id']==two['persona']['id']
    changed=bundle.messages[0].model_copy(update={'body':'Changed human evidence','content_hash':digest('Changed human evidence')})
    engine.bundle=bundle.model_copy(update={'messages':(changed,*bundle.messages[1:])})
    three=await engine.run(case)
    assert not three['calls'][0]['cache_hit']
    assert one['persona']['id']!=three['persona']['id']


def test_full_history_never_silently_truncates(bundle):
    with pytest.raises(ValueError,match='no silent truncation'):
        make_manifest(bundle,'m0',GenerationSettings(),[{'id':'huge','body':'x'*5000}],2000,purpose='test')


@pytest.mark.parametrize('provider',['openai','anthropic','gemini','xai','openrouter'])
def test_actor_context_reaches_all_native_payloads(bundle,provider):
    rs=dialogue_records('traveler',list(bundle.messages[:3]),None,None,[],None,[],'Intervene now')
    settings=GenerationSettings(provider=provider,model=PROVIDERS[provider]['model'])
    manifest=make_manifest(bundle,'m2',settings,rs,10000,purpose='traveler')
    _,payload=request_payload(manifest,PROVIDERS[provider])
    wire=json.dumps(payload)
    assert 'Invented turn 2' in wire and 'Intervene now' in wire
    assert 'Invented turn 3' not in wire


def test_suite_design_resume_identity_and_private_files(bundle,tmp_path):
    suite=default_suite()
    assert len(list(cases(suite)))==72
    bundle,suite,case=setup(bundle)
    base=identity(bundle,suite,case,'v1')
    assert base!=identity(bundle,suite,case,'v2')
    assert base!=identity(bundle,suite.model_copy(update={'exchanges':4}),case,'v1')
    path=tmp_path/'results'/'example.json'
    private_write(path,'{}')
    assert path.stat().st_mode & 0o777==0o600
    assert path.parent.stat().st_mode & 0o777==0o700


def test_provenance_does_not_become_actor_dialogue_example(bundle):
    records=dialogue_records('traveler',list(bundle.messages[:3]),None,None,[],None,[],'Intervene now')
    historical=[r for r in records if r.get('origin')=='historical']
    assert [r['body'] for r in historical]==[m.body for m in bundle.messages[:3]]
    assert [r['id'] for r in historical]==['m0','m1','m2']
    assert any(r['id']=='branch-boundary' for r in records)


def test_result_guard_blocks_forced_add_and_renamed_export():
    from scripts.check_public_tree import forbidden_path,is_experiment_result
    assert forbidden_path('experiments/results/private.json')
    assert not forbidden_path('experiments/counterfactual-suite.json')
    assert is_experiment_result(b'{"case":{},"turns":[],"calls":[]}')
    assert not is_experiment_result(b'{"conditions":[]}')


async def test_resume_skips_provider_calls(bundle,tmp_path):
    from packages.experiments.__main__ import plan,execute
    bundle,suite,case=setup(bundle,persona='minimal')
    demo=GenerationSettings()
    condition=case['condition'].model_copy(update={'traveler':demo,'companion':demo})
    suite=suite.model_copy(update={'builder':demo,'conditions':(condition,)})
    case={**case,'condition':condition}
    execution_plan=plan(bundle,suite,[case],'test-code')
    first=await execute(bundle,suite,[case],execution_plan,tmp_path,1,False)
    second=await execute(bundle,suite,[case],execution_plan,tmp_path,1,True)
    assert first==second
    assert (tmp_path/'metrics.csv').exists()


async def test_unicode_chunks_keep_all_source_dependencies(bundle):
    bundle,suite,case=setup(bundle,memory='compact')
    huge=bundle.messages[0].model_copy(update={'body':'Invented 漢字 '*1000,'content_hash':digest('large')})
    bundle=bundle.model_copy(update={'messages':(huge,*bundle.messages[1:])})
    suite=suite.model_copy(update={'chunk_budget':2000})
    seen=[]
    result=await Engine(bundle,suite,provider_factory=lambda _:Fake(seen)).run(case)
    assert result['status']=='completed'
    parts=result['memories'][0]['parts']
    assert len(parts)>1
    assert set(result['memories'][0]['source_ids'])=={'m0','m1'}
    fragments=[r for part in parts for r in part['evidence'] if r['id']=='m0']
    assert ''.join(r['body'] for r in fragments)==huge.body
    assert all(r['content_hash']==huge.content_hash for r in fragments)


async def test_transient_retry_keeps_partial_receipt(bundle):
    bundle,suite,case=setup(bundle,persona='minimal')
    count=0
    class SometimesBroken:
        async def stream(self,m):
            nonlocal count
            count+=1
            if count==1:
                yield ProviderEvent('delta','Discarded partial response')
                raise ProviderError('interrupted','interrupted')
            yield ProviderEvent('delta','Completed response')
            yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})
    result=await Engine(bundle,suite,provider_factory=lambda _:SometimesBroken()).run(case)
    assert result['status']=='completed'
    assert result['calls'][0]['previous_attempts'][0]['text']=='Discarded partial response'
    assert all(t['text']=='Completed response' for t in result['turns'])
    assert result['metrics']['request_attempts']==7
    assert result['metrics']['retried_calls']==1


async def test_saved_receipt_audit_detects_payload_tampering(bundle):
    import copy
    from scripts.audit_counterfactual_results import audit
    bundle,suite,case=setup(bundle,memory='rolling')
    result=await Engine(bundle,suite,provider_factory=lambda _:Fake([])).run(case)
    assert audit(result,suite.model_dump(mode='json'))>6
    changed=copy.deepcopy(result)
    changed['calls'][0]['request_payload']['model']='tampered-model'
    with pytest.raises(AssertionError,match='hash mismatch'):
        audit(changed,suite.model_dump(mode='json'))
