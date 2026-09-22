"""Lossless request references and explicitly recorded derivation edges for saved runs.

The overview groups inputs by origin; positions point back into the exact saved
manifest. It never substitutes current prompts or reconstructs missing evidence.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json


def key(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def setup_graph(result, plan):
    calls = {c['id']: c for c in result.get('preprocessing_calls', []) + result.get('calls', [])}
    producers = {}
    artifacts = {}
    call_sources = {}
    review_dependencies = {}

    def collect(value):
        if isinstance(value, dict):
            if value.get('call_id') in calls and value.get('extraction_call_id') in calls:
                review_dependencies[value['call_id']] = value['extraction_call_id']
            if value.get('call_id') in calls and value.get('source_ids'):
                call_sources.setdefault(value['call_id'], {}).update({sid: value.get('source_hashes', {}).get(sid) for sid in value['source_ids']})
            recorded_calls = value.get('provenance', {}).get('call_ids', []) if isinstance(value.get('provenance'), dict) else []
            if value.get('id') and (value.get('call_id') or value.get('parts') or recorded_calls):
                dependencies = [value['call_id']] if value.get('call_id') in calls else []
                dependencies += [p['call_id'] for p in value.get('parts', []) if p.get('call_id') in calls]
                dependencies += [cid for cid in recorded_calls if cid in calls]
                if dependencies:
                    producers[value['id']] = sorted(set(dependencies))
                    artifacts[value['id']] = {k: v for k, v in value.items() if k not in ('evidence', 'parts', 'text', 'body')}
            for k, v in value.items():
                if k not in ('calls', 'previous_attempts', 'evidence'):
                    collect(v)
        elif isinstance(value, list):
            for v in value:
                collect(v)
    collect(result)
    generated = {}
    for index, turn in enumerate(result.get('turns', [])):
        if turn.get('call_id'):
            generated.setdefault(turn['call_id'], []).append({'id': turn.get('id'), 'actor': turn.get('actor'), 'index': index})
    nodes, edges, agents = [], [], {}
    input_nodes = {}
    call_order = list(calls)
    for ordinal, (cid, call) in enumerate(calls.items()):
        manifest = call.get('manifest', {})
        purpose = manifest.get('policy_id', '').split(':', 1)[-1]
        actor_purpose = purpose.removesuffix('-repair')
        turns = generated.get(cid, [])
        roles = sorted({t['actor'] for t in turns if t.get('actor')})
        if actor_purpose == 'script-author':
            actor = 'script-author'
        elif roles:
            actor = roles[0] if len(roles) == 1 else 'script-author'
        elif actor_purpose in ('traveler', 'companion', 'script-traveler', 'script-companion'):
            actor = actor_purpose.removeprefix('script-')
        else:
            actor = None
        settings = manifest.get('settings', {})
        agent_id = f'{actor}:{settings.get("provider")}:{settings.get("model")}' if actor else None
        if actor:
            agents.setdefault(agent_id, {'id': agent_id, 'role': actor, 'settings': settings, 'call_ids': []})['call_ids'].append(cid)
        node = {'id': cid, 'kind': 'call', 'label': purpose.replace('-', ' ').title(),
                'ordinal': ordinal, 'purpose': purpose, 'stage': 'dialogue' if actor else ('review' if 'review' in purpose else 'preparation'),
                'agent_id': agent_id, 'settings': settings, 'status': call.get('status'),
                'resolved_model': call.get('metadata', {}).get('resolved_model'),
                'manifest_hash': manifest.get('hash'), 'payload_hash': call.get('payload_hash'),
                'input_bound': manifest.get('token_estimate'), 'cache_hit': call.get('cache_hit', False),
                'retry_count': len(call.get('previous_attempts', [])), 'repair_of': call.get('repair_of'),
                'parse_status': call.get('parse_status'), 'generated_turns': turns}
        nodes.append(node)
        groups = {}
        for position, item in enumerate(manifest.get('items', [])):
            groups.setdefault(item.get('origin', 'unspecified'), []).append((position, item))
        for origin, items in groups.items():
            evidence_sources = call_sources.get(cid, {}) if any(i.get('id') == 'evidence' for _, i in items) else {}
            source_refs = list(dict.fromkeys([i.get('source_id', i.get('id')) for _, i in items] + list(evidence_sources)))
            deps = sorted({p for sid in [i.get('id') for _, i in items] + list(evidence_sources) for p in producers.get(sid, []) if p != cid})
            if origin == 'derived-event-candidates' and cid in review_dependencies:
                deps = sorted(set(deps + [review_dependencies[cid]]))
            if origin == 'invalid-output' and call.get('repair_of') in calls:
                deps = sorted(set(deps + [call['repair_of']]))
            # Source version plus role/body hash disambiguates aliases, excerpts and wrappers.
            signature = [(i.get('id'), i.get('source_version'), i.get('role'), key(i.get('body', ''))) for _, i in items]
            iid = 'input-' + key([origin, signature, evidence_sources, deps])
            if iid not in input_nodes:
                label = {'historical': 'Recorded Dialogue', 'history': 'Recorded Dialogue', 'instruction': 'Instructions',
                         'summary': 'Compacted Memory', 'persona': 'Character Sketch', 'parallel': 'Future Material',
                         'simulated': 'Earlier Simulated Turns', 'timeline': 'Parsed Event Timeline',
                         'annotation': 'Retrospective Annotations', 'timeline-event': 'Parsed Timeline Events', 'annotated': 'Annotated Dialogue',
                         'endpoint': 'Terminal Event', 'endpoint-anchor': 'Terminal Event', 'start-anchor': 'Starting Event', 'path-anchor': 'Terminal Event'}.get(origin, origin.replace('-', ' ').title())
                input_nodes[iid] = {'id': iid, 'kind': 'input', 'label': label, 'origin': origin,
                    'item_count': len(items), 'references': [],
                    'items': [{k: v for k, v in i.items() if k != 'body'} for _, i in items],
                    'source_ids': source_refs, 'evidence_source_hashes': evidence_sources,
                    'derived_from': deps}
            input_nodes[iid]['references'].append({'call_id': cid, 'positions': [p for p, _ in items]})
            edges.append({'source': iid, 'target': cid, 'kind': 'manifest-input', 'origin': origin,
                          'positions': [p for p, _ in items]})
        out_id = 'output-' + cid
        nodes.append({'id': out_id, 'kind': 'output', 'label': f'{len(turns)} Simulated Turns' if turns else 'Saved Response',
                      'call_id': cid, 'status': call.get('status'), 'generated_turns': turns,
                      'characters': len(call.get('text', ''))})
        edges.append({'source': cid, 'target': out_id, 'kind': 'response'})
    for node in input_nodes.values():
        for cid in node['derived_from']:
            edges.append({'source': 'output-' + cid, 'target': node['id'], 'kind': 'recorded-derivation'})
    nodes.extend(input_nodes.values())
    condition = result.get('case', {}).get('condition', {})
    cloned = deepcopy(plan.get('suite', {}))
    case = result.get('case', {})
    if case.get('event'):
        cloned['events'] = [deepcopy(case['event'])]
        if case.get('seed'):
            cloned['events'][0]['seeds'] = [deepcopy(case['seed'])]
    if condition:
        cloned['conditions'] = [deepcopy(condition)]
    cloned['repetitions'] = 1
    return {'version': 1, 'run_id': result.get('run_id'), 'nodes': nodes, 'edges': edges,
            'call_order': call_order, 'agents': list(agents.values()),
            'dialogue_agent_count': len(agents), 'support_call_count': sum(n.get('stage') in ('preparation', 'review') for n in nodes),
            'call_count': len(calls), 'artifacts': artifacts, 'case': case,
            'experiment_spec': result.get('experiment_spec'), 'completion_reason': result.get('completion_reason'),
            'content_version': plan.get('content_version'), 'engine_hash': plan.get('engine_hash'),
            'suite': plan.get('suite'), 'clone_suite': cloned,
            'lineage_note': 'Edges show saved manifest inputs and derivations linked by recorded artifact IDs. Missing lineage is not inferred. Exact bodies and native payloads remain in the linked receipts.',
            'representation': condition.get('representation', 'dialogue'),
            'input_origins': sorted({n['origin'] for n in input_nodes.values()})}
