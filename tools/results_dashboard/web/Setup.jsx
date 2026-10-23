import React, { useEffect, useMemo, useRef, useState } from 'react';
import './node-preview.css';
import { caseURL, getJSON, number, title } from './data';

function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Recipe({ graph }) {
  const [draft, setDraft] = useState(''), [error, setError] = useState('');
  useEffect(() => { setDraft(JSON.stringify(graph.clone_suite, null, 2)); setError(''); }, [graph.run_id]);
  return <details className="setup-clone"><summary>Clone as a new suite</summary>
    <p className="caption">Edit, then download for the runner. The saved result is not changed.</p>
    <textarea aria-label="Proposed experiment suite" spellCheck={false} value={draft} onChange={e => setDraft(e.target.value)} />
    <button className="text-button" onClick={() => { try { const suite = JSON.parse(draft); if (!Array.isArray(suite.events) || !Array.isArray(suite.conditions)) throw new Error('A suite needs events and conditions arrays.'); downloadJSON(suite, `proposed-${graph.run_id.slice(0,12)}.json`); setError(''); } catch(e) {setError(e.message);} }}>Download suite</button>
    {error && <p role="alert">{error}</p>}
  </details>;
}
function NodePreview({ node, call, receipt, error, items, graph, projection, onClose, onChooseCall }) {
  const dialog = useRef(null);
  const [query, setQuery] = useState(''), [itemKey, setItemKey] = useState('');
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({preventScroll: true}); };
  }, []);
  useEffect(() => { setQuery(''); setItemKey(''); }, [node.id, call.id]);
  const filtered = items.filter(item => `${item.id} ${item.role} ${item.origin} ${item.body}`.toLowerCase().includes(query.toLowerCase()));
  const active = filtered.find(item => `${item.position}:${item.id}` === itemKey) || filtered[0];
  const projected = Boolean(receipt?.display_projection || graph.display_projection || projection);
  return <dialog ref={dialog} className="node-preview" aria-labelledby="node-preview-title" aria-describedby="node-preview-description"
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="node-preview-shell">
      <header className="node-preview-header"><div><span className="node-preview-eyebrow">Request {call.ordinal + 1} · {call.settings.provider}</span><h2 id="node-preview-title">{node.label}</h2></div>
        <button autoFocus className="node-preview-close" onClick={onClose} aria-label="Close preview">Close <span aria-hidden="true">×</span></button></header>
      <p id="node-preview-description" className="node-preview-description">{node.kind === 'output' ? 'Saved response' : `${items.length} input ${items.length === 1 ? 'block' : 'blocks'}`}{projected ? ' · aliased' : ''}</p>
      {!receipt && !error && <p className="node-preview-loading" role="status">Loading…</p>}
      {error && <p className="node-preview-loading" role="alert">{error}</p>}
      {receipt && <div className="node-preview-content">
        {node.kind !== 'output' && items.length > 1 && <div className="node-preview-controls"><label>Find<input type="search" placeholder="Text, role, or source ID" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label>Block<select value={active ? `${active.position}:${active.id}` : ''} onChange={event => setItemKey(event.target.value)} aria-label="Preview input block">{filtered.map(item => <option key={`${item.position}:${item.id}`} value={`${item.position}:${item.id}`}>{item.position+1}. {title(item.role)} · {item.id}</option>)}</select></label>
          <span className="node-preview-count" aria-live="polite">{filtered.length} / {items.length}</span></div>}
        {node.kind === 'output' ? <article className="node-preview-body"><h3>Response</h3><pre>{receipt.text || 'No text.'}</pre></article> : active ? <article className="node-preview-body" key={`${active.position}:${active.id}`}>
          <h3>{active.position+1}. {title(active.role)} · {title(active.origin)}</h3><code>{active.id}</code><pre>{active.body}</pre>
          <details><summary>Provenance</summary><pre>{JSON.stringify(Object.fromEntries(Object.entries(active).filter(([key]) => key !== 'body')), null, 2)}</pre></details>
        </article> : <p className="node-preview-empty">No matches.</p>}
        {node.derived_from?.length > 0 && <div className="node-preview-lineage"><h3>Produced by</h3>{node.derived_from.map(id => <button key={id} className="text-button" onClick={() => onChooseCall(id)}>{graph.nodes.find(n => n.id === id)?.label || id} ↗</button>)}</div>}
        {node.kind !== 'output' && <details className="node-preview-all"><summary>All {items.length} blocks</summary>{items.map(item => <section key={`${item.position}:${item.id}`}><h3>{item.position+1}. {title(item.role)} · {item.id}</h3><pre>{item.body}</pre></section>)}</details>}
        <details className="node-preview-native"><summary>Provider payload{projected ? ' (aliased)' : ''}</summary><pre>{JSON.stringify(receipt.request_payload, null, 2)}</pre></details>
        <footer className="node-preview-provenance"><span>SHA-256</span><code>{call.payload_hash || 'Not recorded'}</code>{projected && receipt.display_payload_hash && <><span>Displayed</span><code>{receipt.display_payload_hash}</code></>}</footer>
      </div>}
    </div>
  </dialog>;
}

export default function Setup({ data, run, initialCallId }) {
  const [graph, setGraph] = useState(null), [error, setError] = useState('');
  const [callId, setCallId] = useState(''), [selected, setSelected] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [receipt, setReceipt] = useState(null), [receiptError, setReceiptError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setGraph(null); setError(''); setPreviewOpen(false);
    getJSON(`${caseURL(run, data.run_id)}/setup`, controller.signal).then(g => {
      setGraph(g); const first = g.call_order.includes(initialCallId) ? initialCallId : g.nodes.find(n => n.stage === 'dialogue')?.id || g.call_order[0];
      setCallId(first || ''); setSelected(first || '');
    }).catch(e => { if(e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [run, data.run_id]);
  useEffect(() => {
    setReceipt(null); setReceiptError(''); if (!callId) return;
    const controller = new AbortController();
    getJSON(`${caseURL(run, data.run_id)}/receipts/${callId}`, controller.signal).then(setReceipt).catch(e => { if(e.name !== 'AbortError') setReceiptError(e.message); });
    return () => controller.abort();
  }, [run, data.run_id, callId]);
  useEffect(() => {
    if (!graph || !initialCallId) return;
    const id = graph.call_order.includes(initialCallId) ? initialCallId : graph.nodes.find(n => n.stage === 'dialogue')?.id || graph.call_order[0] || '';
    setCallId(id); setSelected(id); setPreviewOpen(false);
  }, [graph, initialCallId]);
  const byId = useMemo(() => new Map(graph?.nodes.map(n => [n.id, n]) || []), [graph]);
  if (error) return <p role="alert">{error}</p>;
  if (!graph) return <p role="status">Loading…</p>;
  const call = byId.get(callId), picked = byId.get(selected) || call;
  const inputs = graph.edges.filter(e => e.target === callId && e.kind === 'manifest-input').map(e => byId.get(e.source));
  const output = byId.get(`output-${callId}`);
  const positions = picked?.kind === 'input' ? picked.references.find(r => r.call_id === callId)?.positions || [] : [];
  const items = (receipt?.manifest.items || []).filter((_, i) => picked?.kind !== 'input' || positions.includes(i));
  const chooseCall = id => { if (id !== callId) setReceipt(null); setCallId(id); setSelected(id); };
  const previewNode = id => { setSelected(id); setPreviewOpen(true); };
  const height = Math.max(inputs.length * 82 + 12, 190);
  const spec = graph.experiment_spec;
  const projected = Boolean(receipt?.display_projection || graph.display_projection || data.display_projection);
  return <div className="setup-view">
    
    
    <dl className="facts setup-facts">
      <div><dt>Dialogue agents</dt><dd>{graph.dialogue_agent_count}</dd></div>
      <div><dt>Support calls</dt><dd>{graph.support_call_count} of {graph.call_count}</dd></div>
      <div><dt>Context</dt><dd>{graph.representation === 'annotated' ? 'Annotations (hindsight)' : graph.representation === 'timeline' ? 'Event timeline' : 'Dialogue'}</dd></div>
      <div><dt>Stopping</dt><dd>{spec ? `${title(spec.length_policy)} · ${(graph.completion_reason || 'not recorded').replace(/[-_]/g, ' ')}` : 'Fixed turns'}</dd></div>
    </dl>
    <div className="agent-roster">{graph.agents.map(a => <div key={a.id}><strong>{title(a.role)}</strong><span>{a.settings.model}</span><small>{a.call_ids.length} requests</small></div>)}</div>
    
    <div className="request-picker"><label>Request<select aria-label="Inspect request" value={callId} onChange={e => chooseCall(e.target.value)}>{graph.call_order.map((id, i) => <option value={id} key={id}>{i+1}. {byId.get(id).label} · {byId.get(id).settings.provider}</option>)}</select></label></div>
    <div className="request-stages" aria-label="Request sequence">{['preparation','dialogue','review'].map(stage => <div key={stage}><h4>{title(stage)}</h4>{graph.nodes.filter(n => n.stage === stage).map(n => <button key={n.id} aria-pressed={n.id === callId} onClick={() => chooseCall(n.id)} title={`${n.settings.provider} · ${n.settings.model}`}>{n.ordinal+1}. {n.label}</button>)}</div>)}</div>
    {call && <><div className="setup-graph-scroll"><div className="setup-graph" style={{height}} aria-label="Request graph">
      <svg width="100%" height={height} viewBox={`0 0 690 ${height}`} aria-hidden="true" preserveAspectRatio="none"><defs><marker id="setup-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#8398ae" /></marker></defs>
        {inputs.map((n,i) => <path key={n.id} className={selected === n.id || selected === callId ? 'edge-focus' : ''} d={`M210 ${i*82+46} C240 ${i*82+46},245 ${height/2},275 ${height/2}`} markerEnd="url(#setup-arrow)" />)}
        <path className={selected === output?.id || selected === callId ? 'edge-focus' : ''} d={`M465 ${height/2} L505 ${height/2}`} markerEnd="url(#setup-arrow)" />
      </svg>
      {inputs.map((n,i) => <button key={n.id} style={{top:i*82+10,left:0,width:210}} className="graph-node graph-input" aria-pressed={selected === n.id} aria-haspopup="dialog" onClick={() => previewNode(n.id)}><strong>{n.label}</strong><small>{n.item_count} {n.item_count === 1 ? 'item' : 'items'}{n.derived_from.length ? ' · derived' : ''}</small></button>)}
      <button style={{top:height/2-40,left:275,width:190}} className="graph-node graph-call" aria-pressed={selected === callId} aria-haspopup="dialog" onClick={() => previewNode(callId)}><strong>{call.label}</strong><small>{call.settings.provider} · {call.resolved_model || call.settings.model}</small></button>
      {output && <button style={{top:height/2-40,left:505,width:185}} className="graph-node graph-output" aria-pressed={selected === output.id} aria-haspopup="dialog" onClick={() => previewNode(output.id)}><strong>{output.label}</strong><small>{call.status === 'completed' ? '' : `${call.status} · `}{number(output.characters)} chars</small></button>}
    </div></div>
    <section className="setup-sidecar" aria-label="Selected node"><div className="section-heading"><h3>{picked?.label}</h3><span className="caption">{picked?.kind === 'input' ? picked.origin : call.settings.model}</span></div>
      {picked?.derived_from?.length > 0 && <div className="derived-links"><p className="caption">From</p>{picked.derived_from.map(id => <button className="text-button" key={id} title={id} onClick={() => chooseCall(id)}>{byId.has(id) ? `${byId.get(id).ordinal + 1}. ${byId.get(id).label}` : id} ↗</button>)}</div>}
      {picked?.kind === 'input' && <details><summary>{picked.source_ids.length} sources</summary><pre>{JSON.stringify({items: picked.items, source_ids: picked.source_ids, evidence_source_hashes: picked.evidence_source_hashes}, null, 2)}</pre></details>}
      {receiptError && <p role="alert">{receiptError}</p>}{!receipt && !receiptError && <p role="status">Loading…</p>}
      {receipt && (picked?.kind === 'output' ? <pre>{receipt.text || 'No text.'}</pre> : <>
        
        {items.map((item,index) => <details key={`${item.id}-${index}`} open={picked?.kind === 'input' && items.length === 1}><summary>{item.position+1}. {title(item.role)} · {item.origin} · {item.id}</summary><pre>{item.body}</pre></details>)}
        <details><summary>Provider payload{projected ? ' (aliased)' : ''}</summary><pre>{JSON.stringify(receipt.request_payload,null,2)}</pre></details>
        <p className="caption hash-line">SHA-256 <code>{call.payload_hash || 'not recorded'}</code></p>
      </>)}
    </section></>}
    {spec && <details><summary>Specification</summary><pre>{JSON.stringify(spec, null, 2)}</pre></details>}
    {previewOpen && picked && call && <NodePreview node={picked} call={call} receipt={receipt?.id === callId ? receipt : null} error={receiptError} items={receipt?.id === callId ? items : []} graph={graph} projection={data.display_projection} onClose={() => setPreviewOpen(false)} onChooseCall={chooseCall} />}
    <div className="setup-footer"><Recipe graph={graph} /><a className="text-button" href={`${caseURL(run, data.run_id)}/setup/download`}>Export graph and requests</a></div>
  </div>;
}
