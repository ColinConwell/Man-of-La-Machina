"""Invented fixtures for unconstrained stopping, context representations, and script provenance."""
import json
import pytest
from packages.domain.models import GenerationSettings, digest
from packages.domain.providers import ProviderEvent
from packages.experiments.config import Condition, Event, Seed, Suite, cases, script_path_suite
from packages.experiments.script_paths import ScriptEngine, parse_output, Script


def setup(bundle, **options):
    start=bundle.profile.start_options[0].model_copy(update={'entry_message_id':'m2'})
    end=start.model_copy(update={'id':'end','entry_message_id':'m4'})
    bundle=bundle.model_copy(update={'profile':bundle.profile.model_copy(update={'start_options':(start,end)})})
    settings=GenerationSettings(provider='openai',model='invented-model',max_output_tokens=1000)
    condition=Condition(id='test',architecture='single-author',length_policy='adaptive',traveler=settings,companion=settings,**options)
    suite=Suite(kind='script-path',events=(Event(id='pair',start_id='test',end_id='end',seeds=(Seed(id='bridge',prompt='Invent a bridge.'),)),),
                conditions=(condition,),builder=settings,exchanges=4,safety_max_turns=12)
    return bundle,suite,next(cases(suite))


def turn(actor):
    return {'actor':actor,'text':'Fictional spoken dialogue.', 'transition':{'event':'The Traveler visits an invented location.',
        'location':'Invented location','time_elapsed':'Some time passes','traveler_knows':['A place was visited'], 'companion_knows':[]}}


class Fake:
    def __init__(self, seen, *, count=5, stop=True):
        self.seen,self.count,self.stop=seen,count,stop
    async def stream(self,m):
        self.seen.append(m)
        purpose=m.policy_id.split(':')[1]
        if purpose.startswith('script-author'):
            output={'turns':[turn('traveler' if i%2==0 else 'companion') for i in range(self.count)],
                    'stop_reason':'endpoint-ready' if self.stop else 'needs-more','handoff_reason':'The ending can follow.'}
            text=json.dumps(output)
        elif purpose.startswith(('script-traveler','script-companion')):
            actor='traveler' if purpose.startswith('script-traveler') else 'companion'
            index=sum(i.origin=='simulated' for i in m.items)
            text=json.dumps({'turn':turn(actor),'done':self.stop and index>=2,'handoff_reason':'The ending can follow.'})
        else:
            text='A derived preparation or review using only supplied sources.'
        yield ProviderEvent('delta',text)
        yield ProviderEvent('metadata',metadata={'finish_reason':'stop'})


async def test_single_author_natural_length_and_exact_response_link(bundle):
    bundle,suite,case=setup(bundle)
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='completed' and len(result['turns'])==5
    assert result['completion_reason']=='model_handoff'
    assert len({t['call_id'] for t in result['turns']})==1
    assert result['metrics']['dialogue_agents']==1 and len(result['simulated_events'])==5
    response=next(c for c in result['calls'] if c['id']==result['turns'][0]['call_id'])
    parsed=parse_output(response['text'],Script)
    assert parsed.turns[0].text==result['turns'][0]['text']
    wire=json.dumps([c['request_payload'] for c in result['calls']])
    assert 'Invented turn 3' not in wire and 'Invented turn 5' not in wire
    assert 'Do not leak this future knowledge.' not in wire
    from scripts.audit_script_paths import audit_script
    assert audit_script(result,suite.model_dump(mode='json'))==2


async def test_two_agents_stop_after_either_actor_and_mark_ceiling(bundle):
    bundle,suite,case=setup(bundle)
    c=case['condition'].model_copy(update={'architecture':'two-agent'})
    suite=suite.model_copy(update={'conditions':(c,), 'safety_max_turns':4})
    case={**case,'condition':c}
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='completed' and len(result['turns'])==3
    assert result['metrics']['dialogue_agents']==2
    capped=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([],stop=False)).run(case)
    assert capped['status']=='capped' and len(capped['turns'])==4
    assert capped['completion_reason']=='safety_turn_limit' and capped['metrics']['length_capped']


async def test_fixed_and_adaptive_are_distinct(bundle):
    bundle,suite,case=setup(bundle)
    c=case['condition'].model_copy(update={'length_policy':'fixed'})
    suite=suite.model_copy(update={'conditions':(c,)})
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([],count=8)).run({**case,'condition':c})
    assert result['status']=='completed' and len(result['turns'])==8
    assert result['completion_reason']=='fixed_turn_budget'
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([],count=3)).run({**case,'condition':c})
    assert result['status']=='failed' and not result['turns']
    assert result['calls'][-1]['repair_of']==result['calls'][-2]['id']
    assert result['calls'][-1]['parse_status']=='invalid'


async def test_retrospective_annotations_are_explicit_hindsight(bundle):
    bundle,suite,case=setup(bundle,representation='annotated',annotation_policy='retrospective-reference')
    annotation=bundle.documents[0].model_copy(update={'origin':'annotation'})
    bundle=bundle.model_copy(update={'documents':(annotation,)})
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='completed' and not result['experiment_spec']['blind_gap']
    records=result['experiment_spec']['prepared_context']
    extra=next(r for r in records if r['origin']=='annotation')
    assert 'Do not leak this future knowledge.' in extra['body'] and not extra['available_at_start']
    assert any('review_status' in r['body'] for r in records if r['origin']=='historical')


async def test_compaction_is_a_saved_preprocessing_stage(bundle):
    bundle,suite,case=setup(bundle,memory='compact')
    result=await ScriptEngine(bundle,suite,provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='completed' and result['memories']
    assert any(r['origin']=='summary' for r in result['experiment_spec']['prepared_context'])
    assert result['memories'][0]['source_ids']==['m0']


async def test_timeline_requires_matching_complete_asset(bundle):
    bundle,suite,case=setup(bundle,representation='timeline')
    result=await ScriptEngine(bundle,suite,timeline={'status':'partial','events':[]},provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='failed' and not result['calls']
    empty={'status':'completed','events':[],'extraction':{},'coverage':{}}
    result=await ScriptEngine(bundle,suite,timeline=empty,provider_factory=lambda _:Fake([])).run(case)
    assert result['status']=='completed'
    assert result['experiment_spec']['timeline_dependency']['asset_hash']==digest(empty)
    assert result['preprocessing_calls']==[]
    assert not any(r['origin']=='historical' for r in result['experiment_spec']['prepared_context'])


def test_script_design_and_invalid_combinations():
    suite=script_path_suite()
    assert len(list(cases(suite)))==36
    assert {c.architecture for c in suite.conditions}=={'single-author','two-agent'}
    assert {c.representation for c in suite.conditions}=={'dialogue','annotated','timeline'}
    with pytest.raises(ValueError,match='upfront'):
        Suite.model_validate({**suite.model_dump(),'conditions':[{**suite.conditions[0].model_dump(),'endpoint_policy':'delayed'}]})


def test_timeline_receipts_include_primary_supplement_and_review(bundle, tmp_path):
    bundle,suite,case=setup(bundle,representation='timeline')
    suite=suite.model_copy(update={'timeline_file':str(tmp_path/'event-timeline.json')})
    directory=tmp_path/'event-timeline-receipts'
    directory.mkdir()
    chunks=[]
    for purpose in ('primary','prefix','review'):
        payload={'purpose':purpose}
        receipt={'id':'call-'+purpose,'request_payload':payload,'payload_hash':digest(payload)}
        filename=digest(purpose)+'.json'
        (directory/filename).write_text(json.dumps(receipt))
        chunks.append({'call_id':receipt['id'],'receipt_file':filename})
    timeline={'chunks':[chunks[0]],'extraction':{'supplement_chunks':[chunks[1]],'review_chunks':[chunks[2]]}}
    result={'experiment_spec':{'timeline_dependency':{'call_ids':[c['call_id'] for c in chunks]}}}
    engine=ScriptEngine(bundle,suite,timeline=timeline)
    engine.attach_extraction_receipts(result)
    assert {c['id'] for c in result['preprocessing_calls']}=={'call-primary','call-prefix','call-review'}
    timeline['extraction']['review_chunks']=[]
    with pytest.raises(ValueError,match='Missing provenance'):
        engine.attach_extraction_receipts(result)
