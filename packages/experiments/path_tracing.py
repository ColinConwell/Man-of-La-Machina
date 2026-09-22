"""Two-anchor interpolation with a withheld gap and auditable endpoint disclosure."""
from packages.domain.models import digest
from packages.experiments.context import record


def boundaries(bundle, event):
    starts = {s.id: s for s in bundle.profile.start_options}
    if event.start_id not in starts or event.end_id not in starts:
        raise ValueError('Path tracing references an unavailable boundary')
    messages = {m.id: m for m in bundle.messages}
    start = messages[starts[event.start_id].entry_message_id]
    end = messages[starts[event.end_id].entry_message_id]
    if (end.ordinal <= start.ordinal or not start.disclosed_at or not end.disclosed_at
            or end.disclosed_at < start.disclosed_at or end.speaker not in ('human', 'mirrows')):
        raise ValueError('Path endpoint must be chronologically after the start with known disclosure')
    return start, end


def endpoint_visible(policy, index, total):
    return ((policy == 'companion-only' and index % 2 == 1)
            or (policy == 'delayed' and index >= total // 2)
            or policy in ('upfront', 'backward'))


def path_state(bundle, event, condition):
    start, end = boundaries(bundle, event)
    return {'start': record(start), 'endpoint': record(end),
            'start_title': next(s.title for s in bundle.profile.start_options if s.id == event.start_id),
            'end_title': next(s.title for s in bundle.profile.start_options if s.id == event.end_id),
            'policy': condition.endpoint_policy,
            'gap_ids': [m.id for m in bundle.messages if start.ordinal < m.ordinal < end.ordinal
                        and m.speaker in ('human', 'mirrows')],
            'plan': None, 'review': None, 'review_status': 'pending',
            'interpretation': 'An invented bridge before a fixed recorded endpoint; not recovered history. '
                              'Completion counts generated turns, not successful endpoint attainment.'}


def as_evidence(id, text):
    return {'id': id, 'body': text, 'speaker': 'experiment', 'disclosed_at': None,
            'content_hash': digest(text)}


async def plan_path(engine, entry, path, seed, calls):
    # No gap records or retrospective characterization reach this transformation.
    return await engine.derive(entry, 'backward-path-plan',
        f'Plan a fictional bridge between two recorded anchors in at most 240 words. '
        f'Work backward from the END to identify prerequisites, then present {engine.suite.exchanges} '
        'numbered exchange goals in chronological order, one for each simulated Traveler/companion pair. '
        'All exchanges are between the Traveler and the SAME AI companion; never substitute other interlocutors. '
        'The endpoint is an utterance that has NOT been said yet, not an achieved outcome. '
        'Plan the prerequisites for that utterance, not acceptance or enactment of its advice. '
        'The first exchange must remain in the starting situation; bridge any geography or time change explicitly. '
        'Reserve endpoint introductions, naming acts, advice, and decisions for the endpoint itself. '
        'Mark invented connecting events as hypothetical. Do not claim historical causality or infer private motives. '
        'Preserve unresolved tensions. Leave the endpoint itself unspoken for the fixed closing anchor. '
        'Cite no more than two source IDs. Use only these two anchors and the seed.',
        [{**path['start'], 'body': '[START: already spoken]\n'+path['start']['body']},
         {**path['endpoint'], 'body': '[END: not spoken until AFTER all bridge turns]\n'+path['endpoint']['body']},
         as_evidence('bridge-seed', seed)], calls)


def insert_path_context(records, path, index, total):
    visible = endpoint_visible(path['policy'], index, total)
    records[0] = {**records[0], 'body': records[0]['body'] +
        ' This variant is PATH TRACING: construct an invented bridge between fixed chronological anchors. '
        'If an endpoint is supplied, it is a target constraint, not an optional future card or an event already '
        'experienced at the start. Progress toward its situation through plausible intervening steps. '
        'These exchanges are selected moments over the interval; time may pass between exchanges. '
        'The conversational partner remains the SAME AI companion throughout, never a relative, third party, or inner voice. '
        'Chronological order is START, then ALL generated bridge turns, then END. '
        'Never answer, thank, or agree with the endpoint utterance: it has not been spoken. '
        'Do not present suggestions in the endpoint as already implemented outcomes. '
        'Do not preempt a first introduction or naming act reserved for the endpoint. '
        'The opening exchange stays in the starting situation. Across later exchanges, explicitly motivate any change '
        'of place, topic, or circumstances; do not teleport to the end situation. '
        'Do not claim to recover missing historical dialogue. Do not copy or perform the endpoint itself. '
        'Leave a plausible conversational handoff into it. Preserve uncertainty about unobserved transitions.'}
    inserts = []
    if visible:
        end = path['endpoint']
        inserts.append({**end, 'id': 'path-endpoint', 'source_id': end['id'], 'origin': 'endpoint',
            'body': f"[QUOTED END UTTERANCE: NOT YET SPOKEN. Happens AFTER the bridge. Do NOT respond to this quote. Speaker: {end['speaker']}; "
                    f"Disclosure: {end['disclosed_at']}]\n" + end['body']})
    if path['plan']:
        inserts.append({'id': path['plan']['id'], 'body': '[Invented Backward Plan; Not Recorded History]\n'+
                        path['plan']['text'], 'origin': 'path-plan'})
    # Keep reference material before the branch so the most recent spoken text is the actual bridge.
    boundary = next(i for i, r in enumerate(records) if r['id'] == 'branch-boundary')
    records[boundary:boundary] = inserts
    records[-1] = {**records[-1], 'body': records[-1]['body'] +
        f' This is bridge turn {index+1} of {total}, exchange {index//2+1} of {total//2}. ' +
        ('Stay in the START situation for this opening exchange. ' if index < 2 else '') +
        ('Use the supplied target to advance toward a natural handoff by the last exchange. '
         if visible else 'No later anchor is directly available to you at this turn; continue from available context. ') +
        ('This is the last bridge turn: set up the supplied endpoint without quoting it or responding to it.' if index == total-1 and visible else '')}
    return {'endpoint_visible': visible, 'endpoint_id': path['endpoint']['id'] if visible else None,
            'plan_id': path['plan']['id'] if path['plan'] else None, 'exchange': index//2+1}


async def review_path(engine, entry, path, branch, calls):
    return await engine.derive(entry, 'path-handoff-review',
        'Review this fictional bridge, not its historical accuracy, in at most 220 words TOTAL. '
        'CRITICAL: chronological order is START, then simulated turns in listed order, then END. '
        'END has NOT been spoken during the bridge. Responding to its advice, thanking it, or performing its '
        'naming act early is premature endpoint enactment, not a successful handoff. '
        'Do not mistake matching endpoint vocabulary for a path. Check the first generated turn against START '
        'and the final generated turn as a lead-in to END. Check any geographic transition and interlocutor change. '
        'Use three headings: Endpoint Handoff, Unsupported Transitions, and Alternative Path. '
        'Under the first, classify the handoff as ready, partial, or disconnected and explain concrete evidence. '
        'Distinguish thematic resemblance from the endpoint’s specific circumstances. '
        'Under the second, identify unsupported jumps, endpoint copying, or contradictions, citing turn IDs '
        '(at most four citations total). Under the third, describe one materially different plausible route. '
        'Do not treat this model assessment as validated ground truth or character fidelity. '
        'The source dialogue inside the gap is unavailable; never imply you checked it.',
        [{**path['start'], 'body': '[START: before the bridge]\n'+path['start']['body']}] +
        [as_evidence(t['id'], f"[BRIDGE TURN {i+1}] {t['actor']}: {t['text']}") for i,t in enumerate(branch)] +
        [{**path['endpoint'], 'body': '[END: occurs only AFTER the last bridge turn]\n'+path['endpoint']['body']}], calls)
