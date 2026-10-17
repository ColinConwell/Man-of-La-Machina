"""Convert a saved experiment case into ordered beats for the deck's flow graphs.

Node ids match the graphs in web/flows.js. The output carries generated dialogue and
derived summaries, so it is served only by the loopback deck server, after alias
projection, and is never written into deck files.
"""
from __future__ import annotations

ORIGIN_KIND = {
    'instruction': 'instruction', 'persona': 'persona', 'summary': 'memory', 'historical': 'history',
    'parallel': 'future', 'adaptation': 'future', 'simulated': 'branch', 'endpoint': 'endpoint',
    'path-plan': 'plan', 'start-anchor': 'anchor', 'timeline-event': 'events', 'annotation': 'annotation',
    'experiment': 'evidence', 'invalid-output': 'repair',
}
DIALOGUE = {'traveler', 'companion', 'script-traveler', 'script-companion', 'script-author'}
PREP = {
    'persona-past': ('persona', 'builder', 'Persona builder · past only'),
    'persona-retrospective': ('persona', 'builder', 'Persona builder · retrospective'),
    'history-compaction': ('compactor', 'builder', 'History compaction'),
    'branch-compaction': ('compactor', 'builder', 'Branch compaction'),
    'future-adaptation': ('adapter', 'builder', 'Future adapter'),
    'backward-path-plan': ('planner', 'planner', 'Backward planner'),
    'script-state-plan': ('planner', 'planner', 'State-first contract'),
    'path-handoff-review': ('critic', 'critic', 'Handoff critic'),
}
PREP_TEXT_LIMIT = 900


def purpose(call):
    return call['manifest']['policy_id'].split(':', 1)[-1]


def composition(call):
    sizes = {}
    for item in call['manifest'].get('items', []):
        kind = ORIGIN_KIND.get(item.get('origin'), 'evidence')
        sizes[kind] = sizes.get(kind, 0) + int(item.get('token_estimate') or 0)
    order = list(ORIGIN_KIND.values())
    return [{'kind': k, 'size': v} for k, v in sorted(sizes.items(), key=lambda kv: order.index(kv[0]))]


def model(call):
    settings = call['manifest'].get('settings', {})
    return (call.get('metadata') or {}).get('resolved_model') or settings.get('model')


def clip(text, limit=PREP_TEXT_LIMIT):
    text = (text or '').strip()
    return text if len(text) <= limit else text[:limit - 1].rstrip() + '…'


# Path and script graphs fold persona and compaction into their memory/representation node.
REMAP = {'path-tracing': {'persona': 'memory', 'compactor': 'memory'}, 'script-path': {'persona': 'rep', 'compactor': 'rep'}}


def prep_node(name, kind):
    if name.startswith('plain-events'):
        label = 'Event review' if 'review' in name else 'Event extraction'
        return ('timeline', 'builder', label)
    if name.endswith('-repair'):
        base = name[:-len('-repair')]
        node = 'author' if base == 'script-author' else base.removeprefix('script-')
        return (node, 'system', 'Structured-output repair')
    node, role, label = PREP.get(name, ('compactor', 'builder', name))
    return REMAP.get(kind, {}).get(node, node), role, label


def anchor_beat(node, record, speaker, note):
    return {'node': node, 'role': 'archive', 'speaker': speaker, 'text': record.get('body', ''),
            'context': [{'kind': 'anchor' if node == 'start' else 'endpoint', 'size': len((record.get('body') or '').encode())}],
            'note': note}


def case_beats(result):
    kind = result.get('kind') or 'counterfactual'
    calls = result.get('preprocessing_calls', []) + result.get('calls', [])
    by_call = {}
    for turn in result.get('turns', []):
        by_call.setdefault(turn.get('call_id'), []).append(turn)
    steps = result.get('context_steps', [])
    beats = []
    path = result.get('path') or {}

    if kind == 'counterfactual':
        boundary = result.get('boundary') or {}
        beats.append({'node': 'archive', 'role': 'archive', 'speaker': f"Boundary · {boundary.get('title', '')}".strip(' ·'),
                      'text': f"{len(result.get('historical_ids', []))} recorded turns eligible; "
                              f"{len(result.get('future_pool_ids', []))} later turns held in the future pool.",
                      'context': [], 'note': ''})
    elif path.get('start'):
        beats.append(anchor_beat('start', path['start'], 'START · recorded anchor', ''))
        beats.append({'node': 'gap' if kind == 'path-tracing' else 'start', 'role': 'archive', 'speaker': 'Withheld gap',
                      'text': f"{len(path.get('gap_ids', []))} recorded turns between the anchors are withheld.",
                      'context': [], 'withheld': [f"{len(path.get('gap_ids', []))} gap turns"], 'note': ''})
        if kind == 'path-tracing':
            beats.append(anchor_beat('end', path['endpoint'], 'END · recorded anchor', f"Endpoint policy: {path.get('policy')}"))

    turn_index = 0
    previous = None
    for call in calls:
        name = purpose(call)
        if name in DIALOGUE:
            turns = by_call.get(call['id'], [])
            for j, turn in enumerate(turns):
                step = steps[turn_index] if turn_index < len(steps) else {}
                actor = turn.get('actor', 'traveler')
                single = name == 'script-author'
                beat = {
                    'node': 'author' if single else actor, 'role': actor, 'kind': 'turn',
                    'speaker': (f"{actor.title()} (written by author)" if single else f"{actor.title()} agent"),
                    'model': model(call), 'text': turn.get('text', ''),
                    'context': composition(call) if not (single and j) else [],
                    'sameCall': bool(single and j),
                }
                visible = (step.get('path') or {}).get('endpoint_visible')
                if visible is not None:
                    beat['endpointVisible'] = bool(visible)
                cards = step.get('cards') or []
                if cards:
                    beat['note'] = f"{len(cards)} future card{'s' if len(cards) != 1 else ''} in context"
                transition = turn.get('transition')
                if transition:
                    beat['state'] = {'location': transition.get('location'), 'elapsed': transition.get('time_elapsed'),
                                     'event': transition.get('event')}
                beats.append(beat)
                turn_index += 1
            previous = None
            continue
        node, role, label = prep_node(name, kind)
        if previous and previous['purpose'] == name:
            previous['beat']['count'] += 1
            previous['beat']['speaker'] = f"{label} × {previous['beat']['count']}"
            continue
        beat = {'node': node, 'role': role, 'kind': 'prep', 'speaker': label, 'model': model(call),
                'text': clip(call.get('text') or (call.get('error') or {}).get('detail') or ''),
                'context': composition(call), 'count': 1}
        if call.get('cache_hit'):
            beat['note'] = 'Shared preparation reused across cases.'
        if name == 'path-handoff-review':
            beat['warn'] = 'A model critique, not a validated score.'
        beats.append(beat)
        previous = {'purpose': name, 'beat': beat}

    if kind == 'script-path' and path.get('endpoint'):
        # The critique, when present, is last; the appended END belongs before it.
        end = anchor_beat('end', path['endpoint'], 'END · appended', f"Completion: {result.get('completion_reason', 'unknown')}")
        at = len(beats) - 1 if beats and beats[-1].get('node') == 'critic' else len(beats)
        beats.insert(at, end)

    case = result.get('case') or {}
    condition = case.get('condition') if isinstance(case.get('condition'), str) else (case.get('condition') or {}).get('id')
    event = case.get('event') if isinstance(case.get('event'), str) else (case.get('event') or {}).get('id')
    meta = {
        'kind': kind, 'status': result.get('status'), 'condition': condition, 'event': event,
        'completion_reason': result.get('completion_reason'), 'turns': len(result.get('turns', [])),
        'label': f"Saved case · {event or ''} · {condition or ''} · alias projection".replace(' ·  ·', ' ·'),
    }
    return {'beats': beats, 'meta': meta}
