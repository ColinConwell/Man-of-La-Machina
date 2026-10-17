import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CONTEXT_KINDS, ROLE_STYLE } from "./flows";

const NODE_W = 184, NODE_H = 64;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function size(bytes) {
  if (!bytes) return "0";
  return bytes >= 1024 * 10 ? `${Math.round(bytes / 1024)} KB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function edgeId(e) {
  return `${e.from}>${e.to}`;
}

// Edges lit by a beat: explicit ids when given, otherwise inferred from the context
// kinds the active node received (saved cases arrive without explicit edges).
function litEdges(flow, beat) {
  if (!beat) return new Set();
  if (beat.edges) return new Set(beat.edges);
  const kinds = new Set((beat.context || []).map((c) => c.kind));
  const lit = flow.edges.filter((e) => e.to === beat.node && e.carries?.some((k) => kinds.has(k))).map(edgeId);
  const out = flow.edges.find((e) => e.from === beat.node && e.carries?.includes("branch"));
  if (out) lit.push(edgeId(out));
  return new Set(lit);
}

function geometry(flow) {
  const nodes = Object.fromEntries(flow.nodes.map((n) => [n.id, n]));
  const pairs = new Set(flow.edges.map(edgeId));
  return flow.edges
    .filter((e) => nodes[e.from] && nodes[e.to])
    .map((e) => {
      const a = nodes[e.from], b = nodes[e.to];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // Clip the segment at the node boxes so arrowheads stay visible.
      const clip = (n, sx, sy) => {
        const tx = Math.abs(sx) > 1e-6 ? NODE_W / 2 / Math.abs(sx) : Infinity;
        const ty = Math.abs(sy) > 1e-6 ? NODE_H / 2 / Math.abs(sy) : Infinity;
        const t = Math.min(tx, ty) + 6;
        return [n.x + sx * t, n.y + sy * t];
      };
      const ux = dx / len, uy = dy / len;
      const [x1, y1] = clip(a, ux, uy);
      const [x2, y2] = clip(b, -ux, -uy);
      const bend = pairs.has(`${e.to}>${e.from}`) ? 26 : 0;
      const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
      return { ...e, id: edgeId(e), d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, mx, my };
    });
}

function ContextBar({ context, open, onToggle }) {
  const items = (context || []).filter((c) => c.kind in CONTEXT_KINDS);
  if (!items.length) return null;
  const total = items.reduce((s, c) => s + (c.size || 0), 0);
  // Square-root scale keeps a 370 KB history from erasing a 1 KB sketch.
  const weights = items.map((c) => Math.sqrt(Math.max(c.size || 0, 0)));
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  return (
    <div className="ctx">
      <button className="ctx-bar" onClick={onToggle} aria-expanded={open} title="What this call received">
        {items.map((c, i) =>
          c.size ? (
            <span key={i} style={{ flexGrow: weights[i] / sum, background: CONTEXT_KINDS[c.kind].color }} />
          ) : null,
        )}
        <em>{size(total)}</em>
      </button>
      {open && (
        <ul className="ctx-list">
          {items.map((c, i) => (
            <li key={i} className={c.size ? "" : "withheld"}>
              <i style={{ background: CONTEXT_KINDS[c.kind].color }} />
              <b>{CONTEXT_KINDS[c.kind].label}</b>
              <span>{c.note || ""}</span>
              <em>{c.size ? size(c.size) : "withheld"}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Typed({ text, active, speed, onDone }) {
  const [n, setN] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) {
      setN(text.length);
      return;
    }
    if (reduced()) {
      setN(text.length);
      onDone?.();
      return;
    }
    setN(0);
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 90));
    const timer = setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      if (i >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, 22 / speed);
    return () => clearInterval(timer);
  }, [text, active, speed]);
  // Inactive cards always render in full so layout is final before scrolling.
  const shown = active ? n : text.length;
  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length && <span className="caret" />}
    </>
  );
}

function BeatCard({ beat, index, current, speed, onTyped, onSelect, cardRef }) {
  const [open, setOpen] = useState(false);
  const role = ROLE_STYLE[beat.role] || ROLE_STYLE.system;
  const turn = ["traveler", "companion", "visitor"].includes(beat.role) && beat.kind !== "prep";
  return (
    <li
      ref={cardRef}
      className={`beat ${turn ? "turn" : "prep"} side-${role.side} role-${beat.role} ${current ? "current" : ""}`}
      onClick={() => onSelect(index)}
    >
      <header>
        <span className="who">{beat.speaker || role.label}</span>
        {beat.model && <span className="model">{beat.model}</span>}
        {beat.endpointVisible !== undefined && (
          <span className={`eye ${beat.endpointVisible ? "on" : ""}`} title={beat.endpointVisible ? "Endpoint visible to this call" : "Endpoint hidden from this call"}>
            {beat.endpointVisible ? "◉ end" : "○ end"}
          </span>
        )}
        {beat.sameCall && <span className="model">same call</span>}
        {beat.count > 1 && <span className="model">× {beat.count}</span>}
        <span className="n">{index + 1}</span>
      </header>
      <div className="body">
        <Typed text={beat.text || ""} active={current} speed={speed} onDone={onTyped} />
      </div>
      {beat.state && (
        <div className="state">
          {beat.state.location && <span>⌖ {beat.state.location}</span>}
          {beat.state.elapsed && <span>◷ {beat.state.elapsed}</span>}
          {beat.state.event && <span className="event">◆ {beat.state.event}</span>}
          {beat.done && <span className="event">⇥ handoff</span>}
        </div>
      )}
      {beat.withheld?.length > 0 && <div className="withheld-row">{beat.withheld.map((w) => <s key={w}>{w}</s>)}</div>}
      {beat.warn && <div className="warn">⚠ {beat.warn}</div>}
      <ContextBar context={beat.context} open={open} onToggle={(e) => { e.stopPropagation(); setOpen((o) => !o); }} />
      {beat.note && <p className="note">{beat.note}</p>}
    </li>
  );
}

export default function FlowViz({ flow, sample, variant, onVariant, sourceMode, onSourceMode, register, autoplay }) {
  const variants = flow.variants;
  const variantId = variant && variants[variant] ? variant : Object.keys(variants)[0];
  const saved = sourceMode === "saved" && sample?.beats?.length;
  const beats = saved ? sample.beats : variants[variantId].beats;
  const [at, setAt] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [typed, setTyped] = useState(true);
  const cards = useRef([]);
  const list = useRef(null);
  const edges = useMemo(() => geometry(flow), [flow]);
  const beat = beats[at];
  const lit = useMemo(() => litEdges(flow, beat), [flow, beat]);
  const visited = useMemo(() => new Set(beats.slice(0, at + 1).map((b) => b.node)), [beats, at]);

  useEffect(() => {
    setAt(-1);
    setPlaying(false);
  }, [variantId, saved, sample]);
  useEffect(() => {
    if (autoplay) setPlaying(true);
  }, [autoplay]);

  // Advance after the current beat finishes typing, plus a reading pause.
  useEffect(() => {
    if (!playing) return;
    if (at >= beats.length - 1 && at !== -1) {
      setPlaying(false);
      return;
    }
    if (at >= 0 && !typed) return;
    const words = (beat?.text || "").split(/\s+/).length;
    const dwell = at < 0 ? 200 : Math.min(5200, 900 + words * 110) / speed;
    const t = setTimeout(() => {
      setTyped(false);
      setAt((i) => i + 1);
    }, dwell);
    return () => clearTimeout(t);
  }, [playing, at, typed, speed, beats.length]);

  useLayoutEffect(() => {
    const el = cards.current[at];
    // The list is the offset parent, so offsets stay in unscaled stage pixels.
    // Instant: Chrome abandons smooth scrolls while the typed card keeps resizing.
    if (el && list.current) list.current.scrollTop = Math.max(0, el.offsetTop - 12);
  }, [at]);

  const go = (i) => {
    setTyped(true);
    setAt(Math.max(-1, Math.min(beats.length - 1, i)));
  };
  const toggle = () => {
    if (at >= beats.length - 1) go(-1);
    setPlaying((p) => !p);
  };
  useEffect(() => {
    register?.({ toggle, next: () => { setPlaying(false); go(at + 1); }, prev: () => { setPlaying(false); go(at - 1); } });
  });

  const node = flow.nodes.find((n) => n.id === beat?.node);
  const bubbleText = beat?.text ? (beat.text.length > 120 ? beat.text.slice(0, 118) + "…" : beat.text) : "";
  return (
    <div className="flow" data-flow={flow.id}>
      <div className="flow-head">
        <div className="flow-controls" role="toolbar" aria-label="Simulation controls">
          <button onClick={() => { setPlaying(false); go(-1); }} title="Restart" aria-label="Restart">⟲</button>
          <button onClick={() => { setPlaying(false); go(at - 1); }} title="Previous beat ([)" aria-label="Previous beat">◂</button>
          <button className="play" onClick={toggle} title="Play or pause (P)" aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button onClick={() => { setPlaying(false); go(at + 1); }} title="Next beat (])" aria-label="Next beat">▸</button>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
            {[0.5, 1, 1.5, 2, 3].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </div>
        {!saved && Object.keys(variants).length > 1 && (
          <select className="variant" value={variantId} onChange={(e) => onVariant?.(e.target.value)} aria-label="Condition">
            {Object.entries(variants).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
          </select>
        )}
        {sample && (
          <div className="source-toggle" role="group" aria-label="Simulation source">
            <button className={!saved ? "on" : ""} onClick={() => onSourceMode?.("illustrative")}>Illustrative</button>
            <button className={saved ? "on" : ""} onClick={() => onSourceMode?.("saved")} disabled={!sample.beats?.length}>Saved run</button>
          </div>
        )}
        <span className="legend">{saved ? sample.meta?.label || "Saved case · alias projection" : flow.legend}</span>
      </div>
      <div className="flow-body">
        <svg viewBox="0 0 1000 600" className="graph" role="img" aria-label={`${flow.title} workflow graph`}>
          <defs>
            <marker id={`arrow-${flow.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
            </marker>
            <pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" className="hatch-line" />
            </pattern>
          </defs>
          {edges.map((e) => (
            <g key={e.id} className={`edge ${lit.has(e.id) ? "lit" : ""}`}>
              <path id={`p-${flow.id}-${e.id}`} d={e.d} markerEnd={`url(#arrow-${flow.id})`} />
              {e.label && <text x={e.mx} y={e.my - 6}>{e.label}</text>}
              {lit.has(e.id) && !reduced() && (
                <circle r="5" className="pulse" key={`${at}-${e.id}`}>
                  <animateMotion dur={`${1.1 / speed}s`} repeatCount="indefinite" path={e.d} />
                </circle>
              )}
            </g>
          ))}
          {flow.nodes.map((n) => (
            <g
              key={n.id}
              className={`node kind-${n.kind} ${beat?.node === n.id ? "active" : ""} ${visited.has(n.id) ? "visited" : ""}`}
              transform={`translate(${n.x - NODE_W / 2},${n.y - NODE_H / 2})`}
            >
              <rect width={NODE_W} height={NODE_H} rx={n.kind === "human" ? 32 : n.kind === "gate" ? 4 : 12} />
              {n.kind === "withheld" && <rect width={NODE_W} height={NODE_H} rx="12" fill="url(#hatch)" className="hatch" />}
              <text x={NODE_W / 2} y={28} className="label">{n.label}</text>
              <text x={NODE_W / 2} y={48} className="sub">{n.sub}</text>
            </g>
          ))}
          {node && bubbleText && (
            <foreignObject
              x={Math.min(Math.max(node.x - 160, 4), 676)}
              y={node.y > 300 ? node.y - NODE_H / 2 - 108 : node.y + NODE_H / 2 + 10}
              width="320"
              height="110"
              className="bubble-wrap"
            >
              <div className={`bubble role-${beat.role}`} key={at}>{bubbleText}</div>
            </foreignObject>
          )}
        </svg>
        <ol className="beats" ref={list} aria-live="polite">
          {at < 0 && (
            <li className="beat empty">
              <p>Press <kbd>▶</kbd> or <kbd>P</kbd> to run the workflow. Each step lights the graph and adds the message it produced, with the context that call received.</p>
            </li>
          )}
          {beats.slice(0, at + 1).map((b, i) => (
            <BeatCard
              key={`${variantId}-${saved ? "s" : "i"}-${i}`}
              beat={b}
              index={i}
              current={i === at}
              speed={speed}
              onTyped={() => setTyped(true)}
              onSelect={(j) => { setPlaying(false); go(j); }}
              cardRef={(el) => (cards.current[i] = el)}
            />
          ))}
        </ol>
      </div>
      <div className="scrub" role="group" aria-label="Beats">
        {beats.map((b, i) => (
          <button
            key={i}
            className={`tick role-${b.role} ${i === at ? "on" : ""} ${i < at ? "past" : ""}`}
            onClick={() => { setPlaying(false); go(i); }}
            title={`${i + 1}. ${b.speaker || b.role}`}
            aria-label={`Beat ${i + 1}: ${b.speaker || b.role}`}
          />
        ))}
        <span className="count">{at + 1} / {beats.length}</span>
      </div>
    </div>
  );
}
