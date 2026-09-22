"""Verify saved experiment factors and exact native payloads without calling models."""
import argparse
import json
from pathlib import Path
from packages.domain.context import tokens
from packages.domain.models import Manifest, digest
from packages.domain.providers import registry, request_payload
from packages.experiments.path_tracing import endpoint_visible


def audit(result, suite):
    if result.get('kind') == 'script-path':
        from scripts.audit_script_paths import audit_script
        return audit_script(result, suite)
    condition = result['case']['condition']
    past, future = set(result['historical_ids']), set(result['future_pool_ids'])
    assert not past & future, 'Historical and future source sets overlap'
    assert all(t['origin']=='simulated' for t in result['turns']), 'Missing simulated origin'
    assert [t['actor'] for t in result['turns']] == [
        'traveler' if i%2==0 else 'companion' for i in range(len(result['turns']))], 'Actor order changed'
    if result['status']=='completed':
        assert len(result['turns'])==suite['exchanges']*2, 'Incomplete completed case'
    persona=result.get('persona')
    if persona:
        permitted=past|future if condition['persona']=='retrospective' else past
        assert set(persona['source_ids'])<=permitted, 'Persona evidence outside allowed scope'
        if condition['persona']=='minimal':
            assert not persona['source_ids'], 'Minimal persona has source evidence'
    calls={c['id']:c for c in result['calls']}
    path = result.get('path')
    if path:
        assert not future, 'Path tracing must disable future retrieval'
        assert path['endpoint']['ordinal'] > path['start']['ordinal'], 'Reversed path boundaries'
        assert not set(path['gap_ids']) & past, 'Withheld gap appears in history'
        assert path['endpoint']['id'] not in past, 'Endpoint appears in history'
        assert condition['persona'] != 'retrospective', 'Retrospective persona leaks the withheld gap'
        if path.get('plan'):
            assert set(path['plan']['source_ids']) == {path['start']['id'], path['endpoint']['id'], 'bridge-seed'}
        for step in result['context_steps']:
            visible = endpoint_visible(condition['endpoint_policy'], step['index'], suite['exchanges']*2)
            assert step['path']['endpoint_visible'] == visible, 'Endpoint disclosure schedule changed'
            call = next(c for c in result['calls'] if c['manifest']['hash'] == step['manifest_hash'])
            items = call['manifest']['items']
            endpoints = [i for i in items if i['origin'] == 'endpoint']
            assert len(endpoints) == int(visible), 'Endpoint injection violates schedule'
            if visible:
                assert endpoints[0]['body'].endswith(path['endpoint']['body']), 'Endpoint text changed'
                assert endpoints[0]['source_id'] == path['endpoint']['id'], 'Endpoint provenance changed'
            assert bool([i for i in items if i['origin'] == 'path-plan']) == (condition['endpoint_policy'] == 'backward')
        for call in result['calls']:
            assert not {i['source_id'] for i in call['manifest']['items']} & set(path['gap_ids']), 'Gap source inserted'
    for turn in result['turns']:
        call=calls[turn['call_id']]
        assert call['status']=='completed' and call['text']==turn['text'], 'Failed or changed branch output'
    for memory in result['memories']:
        if memory['method']=='history-compaction':
            assert memory['source_ids']==result['historical_ids'][:-suite['recent_turns']], 'Compaction coverage changed'
            assert set(r['id'] for p in memory['parts'] for r in p['evidence'])==set(memory['source_ids']), 'Missing chunk dependencies'
    for step in result['context_steps']:
        card_ids={c['id'] for c in step['cards']}
        assert card_ids<=future, 'Forward retrieval contains a historical source'
        allowed=condition['forward']!='none' and condition['forward_audience'] in ('both',step['actor'])
        assert allowed or not card_ids, 'Future cards violate condition or audience'
    checked=0
    for final in result['calls']:
        for call in [*final.get('previous_attempts',[]),final]:
            m=Manifest.model_validate(call['manifest'])
            assert call['payload_hash']==digest(call['request_payload']), 'Native payload hash mismatch'
            assert m.token_estimate==sum(tokens(i.body) for i in m.items), 'Input bound mismatch'
            if m.settings.provider=='demo':
                payload={'manifest':m.model_dump(mode='json')}
            else:
                _,payload=request_payload(m,registry()[m.settings.provider])
            assert payload==call['request_payload'], 'Manifest and native payload disagree'
            actor=m.policy_id.split(':',1)[1]
            if actor in ('traveler','companion'):
                assert m.settings.model_dump(mode='json')==condition[actor], 'Actor settings changed'
                expected=result['historical_ids'] if condition['memory']=='full' else result['historical_ids'][-suite['recent_turns']:]
                history=[i for i in m.items if i.origin=='historical']
                assert [i.id for i in history]==expected, 'History representation changed'
                assert all(i.source_version==digest(i.body) for i in history), 'Historical body changed'
                if actor=='companion':
                    assert not any(i.origin=='persona' for i in m.items), 'Companion directly receives persona'
            else:
                assert m.settings.model_dump(mode='json')==suite['builder'], 'Builder settings changed'
            checked+=1
    return checked


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    args=parser.parse_args()
    plan=json.loads((args.directory/'plan.json').read_text())
    completed=failed=receipts=0
    for case in plan['cases']:
        result=json.loads((args.directory/(case['id']+'.json')).read_text())
        assert result['run_id']==case['id'], 'Run identity differs from plan'
        receipts+=audit(result,plan['suite'])
        completed+=result['status']=='completed'
        failed+=result['status']!='completed'
    print(json.dumps({'cases_checked':len(plan['cases']), 'completed':completed,
                      'failed':failed, 'receipts_checked_including_shared_copies':receipts,
                      'scope':'Structural and payload integrity; not semantic fidelity or temporal consistency'}))


if __name__=='__main__':
    main()
