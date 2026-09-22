"""The graph must describe receipts, never reconstruct prompts from current code."""
from tools.results_dashboard.graph import setup_graph


def call(id, purpose, items, text='response'):
    return {'id': id, 'manifest': {'policy_id': 'saved-v1:'+purpose, 'settings': {'provider': 'fixture', 'model': 'saved-model'},
            'hash': 'manifest-'+id, 'items': items}, 'payload_hash': 'payload-'+id, 'text': text, 'status': 'completed'}


def item(id, origin, body, role='user'):
    return {'id': id, 'source_id': id, 'source_version': 'version-'+id, 'origin': origin, 'body': body, 'role': role}


def test_exact_manifest_groups_and_recorded_compaction_lineage():
    preparation = call('prepare', 'history-compaction', [item('instruction', 'instruction', 'Summarize.'), item('source', 'historical', 'Private evidence')])
    actor = call('actor', 'traveler', [item('system', 'instruction', 'Actual original prompt', 'system'), item('memory', 'summary', 'Derived summary'), item('source', 'historical', 'Excerpt')])
    r = {'calls': [preparation, actor], 'memories': [{'id': 'memory', 'parts': [{'id': 'part', 'call_id': 'prepare', 'source_ids': ['source']}]}],
         'turns': [{'id': 'turn', 'actor': 'traveler', 'call_id': 'actor'}], 'case': {'condition': {'memory': 'compact'}}}
    graph = setup_graph(r, {'suite': {}})
    assert graph['dialogue_agent_count'] == 1
    assert graph['support_call_count'] == 1
    actor_inputs = [e for e in graph['edges'] if e['target'] == 'actor']
    summary = next(n for n in graph['nodes'] if n.get('origin') == 'summary')
    assert summary['derived_from'] == ['prepare']
    assert {'source': 'output-prepare', 'target': summary['id'], 'kind': 'recorded-derivation'} in graph['edges']
    assert sum(len(e['positions']) for e in actor_inputs) == 3
    assert 'Private evidence' not in str(graph)  # bodies are fetched only from exact receipts
    histories = [n for n in graph['nodes'] if n.get('origin') == 'historical']
    assert len(histories) == 2  # excerpts cannot be collapsed into whole source turns


def test_one_author_is_one_agent_despite_two_roles_and_unused_config():
    r = {'calls': [call('writer', 'script-author', []), call('reviewer', 'handoff-review', [])],
         'turns': [{'id': 'a', 'actor': 'traveler', 'call_id': 'writer'}, {'id': 'b', 'actor': 'companion', 'call_id': 'writer'}],
         'case': {'condition': {'architecture': 'single-author', 'traveler': {'provider': 'fixture'}, 'companion': {'provider': 'unused'}}}}
    graph = setup_graph(r, {'suite': {}})
    assert graph['dialogue_agent_count'] == 1
    assert graph['agents'][0]['role'] == 'script-author'
    assert graph['support_call_count'] == 1
    assert next(n for n in graph['nodes'] if n['id'] == 'output-writer')['label'] == '2 Simulated Turns'


def test_shared_preprocessing_receipts_deduplicate_and_unknown_lineage_is_absent():
    prep = call('extract', 'timeline-extraction', [])
    actor = call('actor', 'script-companion', [item('event-1', 'timeline-event', 'An event.')])
    r = {'preprocessing_calls': [prep], 'calls': [prep, actor], 'turns': [],
         'experiment_spec': {'prepared_context': [{'id': 'event-1', 'call_id': 'extract'}]}}
    graph = setup_graph(r, {'suite': {}})
    assert graph['call_count'] == 2 and graph['support_call_count'] == 1
    timeline = next(n for n in graph['nodes'] if n.get('origin') == 'timeline-event')
    assert timeline['derived_from'] == ['extract']
    assert graph['dialogue_agent_count'] == 1  # failed/empty actor still actually called
    r['experiment_spec'] = {}
    graph = setup_graph(r, {'suite': {}})
    assert not any(e['kind'] == 'recorded-derivation' for e in graph['edges'])


def test_clone_is_independent_and_keeps_reproducible_original_configuration():
    original = {'events': [{'id': 'old'}], 'conditions': [{'id': 'old'}], 'repetitions': 4, 'builder': {'model': 'builder'}, 'safety_max_turns': 24}
    r = {'case': {'event': {'id': 'chosen', 'seeds': [{'id': 's1'}, {'id': 's2'}]}, 'seed': {'id': 's1', 'prompt': 'Original'}, 'condition': {'id': 'condition'}}}
    graph = setup_graph(r, {'suite': original, 'engine_hash': 'original-code', 'content_version': 'source-version'})
    assert graph['clone_suite']['events'][0]['seeds'] == [r['case']['seed']]
    graph['clone_suite']['events'][0]['seeds'][0]['prompt'] = 'Intervention'
    assert r['case']['seed']['prompt'] == 'Original'
    assert original['repetitions'] == 4
    assert graph['engine_hash'] == 'original-code' and graph['content_version'] == 'source-version'


def test_builder_evidence_dependencies_follow_saved_source_ids():
    r = {'calls': [call('actor', 'traveler', []), call('review', 'path-review', [item('evidence', 'experiment', 'Combined evidence')])],
         'turns': [{'id': 'turn-1', 'actor': 'traveler', 'call_id': 'actor'}],
         'path': {'review': {'id': 'review-artifact', 'call_id': 'review', 'source_ids': ['turn-1'], 'source_hashes': {'turn-1': 'original-turn-hash'}}}}
    graph = setup_graph(r, {'suite': {}})
    evidence = next(n for n in graph['nodes'] if n.get('origin') == 'experiment')
    assert evidence['derived_from'] == ['actor']
    assert evidence['evidence_source_hashes'] == {'turn-1': 'original-turn-hash'}


def test_timeline_event_provenance_links_extraction_receipt():
    r = {'preprocessing_calls': [call('extract', 'event-extraction', [])],
         'calls': [call('author', 'script-author', [item('event-1', 'timeline-event', 'Event')])],
         'timeline_events': [{'id': 'event-1', 'source_ids': ['source-1'], 'provenance': {'call_ids': ['extract']}}]}
    graph = setup_graph(r, {'suite': {}})
    assert next(n for n in graph['nodes'] if n.get('origin') == 'timeline-event')['derived_from'] == ['extract']


def test_repair_calls_belong_to_original_actor_and_keep_invalid_output_dependency():
    original = call('writer', 'script-author', [], 'not json')
    repair = {**call('repair', 'script-author-repair', [item('invalid-writer', 'invalid-output', 'not json')]), 'repair_of': 'writer'}
    graph = setup_graph({'calls': [original, repair]}, {'suite': {}})
    assert graph['dialogue_agent_count'] == 1
    assert graph['support_call_count'] == 0
    assert graph['agents'][0]['call_ids'] == ['writer', 'repair']
    assert next(n for n in graph['nodes'] if n.get('origin') == 'invalid-output')['derived_from'] == ['writer']


def test_semantic_review_candidates_link_to_their_extraction_call():
    extraction = call('extract', 'timeline-extraction', [])
    review = call('review', 'event-entailment-review', [item('event-review-candidates', 'derived-event-candidates', 'Candidates')])
    author = call('author', 'script-author', [item('event-1', 'timeline-event', 'Accepted event')])
    r = {'calls': [author], 'preprocessing_calls': [extraction, review],
         'timeline_events': [{'id': 'event-1', 'provenance': {'call_ids': ['extract', 'review']}}],
         'experiment_spec': {'timeline_dependency': {'extraction': {'review_chunks': [
             {'extraction_call_id': 'extract', 'call_id': 'review', 'source_ids': ['source-1']} ]}}}}
    graph = setup_graph(r, {'suite': {}})
    candidates = next(n for n in graph['nodes'] if n.get('origin') == 'derived-event-candidates')
    assert candidates['derived_from'] == ['extract']
    event = next(n for n in graph['nodes'] if n.get('origin') == 'timeline-event')
    assert event['derived_from'] == ['extract', 'review']
    assert next(n for n in graph['nodes'] if n['id'] == 'review')['stage'] == 'review'
    assert graph['dialogue_agent_count'] == 1 and graph['support_call_count'] == 2
