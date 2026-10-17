import React, { useEffect, useMemo, useState } from "react";
import { FLOWS } from "./flows";
import { LAYOUTS } from "./Slides";
import { setSlideSetting, slideSetting, useDeck } from "./editing";

function lookup(slide, path) {
  // Resolve a path such as "s4.items.2.title" against the slide's default content.
  const parts = path.split(".").slice(1);
  let v = slide;
  for (const part of parts) v = v == null ? undefined : v[/^\d+$/.test(part) ? Number(part) : part];
  return typeof v === "string" ? v : undefined;
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function markdown(annotations, slides) {
  const title = (id) => {
    const i = slides.findIndex((s) => s.id === id);
    return i < 0 ? id : `Slide ${i + 1} (${id})`;
  };
  const lines = ["# Deck annotations", ""];
  for (const a of annotations) {
    lines.push(`- [${a.status === "resolved" ? "x" : " "}] **${title(a.slide)}** · \`${a.target}\` — ${a.text.replace(/\n/g, " ")}`);
  }
  return lines.join("\n");
}

function ElementTab({ slide }) {
  const deck = useDeck();
  const p = deck.selected;
  const [note, setNote] = useState("");
  if (!p) {
    return (
      <div className="hint">
        <p>Click any text or block on the slide to select it.</p>
        <ul>
          <li>Double-click text to edit it in place. <kbd>Enter</kbd> saves a heading; <kbd>⌘</kbd>+<kbd>Enter</kbd> saves a paragraph; <kbd>Esc</kbd> cancels.</li>
          <li>Drag a selected element to nudge it, or use <kbd>Alt</kbd>+arrows.</li>
          <li><kbd>Alt</kbd>+click selects even when the picker is off.</li>
        </ul>
        <AnnotateSlide slide={slide} />
      </div>
    );
  }
  const style = deck.edits.style[p] || {};
  const fallback = lookup(slide, p);
  const isText = fallback !== undefined || p in deck.edits.text || !/\.(items|flow|network)$/.test(p);
  const text = deck.edits.text[p] ?? fallback ?? "";
  const setStyle = (patch) =>
    deck.update((e) => {
      const next = { ...(e.style[p] || {}), ...patch };
      for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === null || next[k] === false || (k === "scale" && next[k] === 1)) delete next[k];
      if (Object.keys(next).length) e.style[p] = next;
      else delete e.style[p];
      return e;
    });
  return (
    <div className="element">
      <div className="path"><code>{p}</code><button className="link" onClick={() => deck.select(null)}>Deselect</button></div>
      {isText && (
        <label className="field">
          <span>Text {deck.edits.text[p] !== undefined && <em>edited</em>}</span>
          <textarea
            rows={Math.min(8, Math.max(2, Math.ceil(text.length / 38)))}
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              deck.update((ed) => {
                if (value === (fallback ?? "")) delete ed.text[p];
                else ed.text[p] = value;
                return ed;
              }, { snapshot: false });
            }}
            onFocus={() => deck.update((e) => e)}
          />
          <small>Use *asterisks* for emphasis.</small>
        </label>
      )}
      <div className="row">
        <span>Align</span>
        <Segmented label="Align" value={style.align || ""} onChange={(v) => setStyle({ align: v || undefined })} options={[["", "Auto"], ["left", "Left"], ["center", "Center"], ["right", "Right"]]} />
      </div>
      <div className="row">
        <span>Size</span>
        <div className="stepper">
          <button onClick={() => setStyle({ scale: Math.max(0.5, +((style.scale || 1) - 0.1).toFixed(2)) })} aria-label="Smaller">−</button>
          <output>{Math.round((style.scale || 1) * 100)}%</output>
          <button onClick={() => setStyle({ scale: Math.min(2.2, +((style.scale || 1) + 0.1).toFixed(2)) })} aria-label="Larger">+</button>
        </div>
      </div>
      <div className="row">
        <span>Width</span>
        <Segmented label="Width" value={style.width || ""} onChange={(v) => setStyle({ width: v || undefined })} options={[["", "Auto"], ["narrow", "Narrow"], ["wide", "Wide"], ["full", "Full"]]} />
      </div>
      <div className="row">
        <span>Offset</span>
        <span className="mono">{style.dx || 0}, {style.dy || 0}</span>
        {(style.dx || style.dy) ? <button className="link" onClick={() => setStyle({ dx: undefined, dy: undefined })}>Reset</button> : null}
      </div>
      <div className="row">
        <span>Visibility</span>
        <Segmented label="Visibility" value={style.hidden ? "hidden" : "shown"} onChange={(v) => setStyle({ hidden: v === "hidden" || undefined })} options={[["shown", "Shown"], ["hidden", "Hidden"]]} />
      </div>
      <button
        className="ghost"
        onClick={() =>
          deck.update((e) => {
            delete e.text[p];
            delete e.style[p];
            return e;
          })
        }
      >
        Reset this element
      </button>
      <form
        className="annotate"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          deck.addAnnotation(slide.id, p, note.trim());
          setNote("");
        }}
      >
        <label className="field">
          <span>Annotate this element</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for revision, a question, a change to make later…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form.requestSubmit(); }} />
        </label>
        <button type="submit" disabled={!note.trim()}>Add note</button>
      </form>
    </div>
  );
}

function AnnotateSlide({ slide }) {
  const deck = useDeck();
  const [note, setNote] = useState("");
  return (
    <form
      className="annotate"
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        deck.addAnnotation(slide.id, slide.id, note.trim());
        setNote("");
      }}
    >
      <label className="field">
        <span>Annotate this slide</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note about the whole slide…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form.requestSubmit(); }} />
      </label>
      <button type="submit" disabled={!note.trim()}>Add note</button>
    </form>
  );
}

function SampleBinding({ slide }) {
  const deck = useDeck();
  const flow = FLOWS[slide.flow];
  const binding = slideSetting(deck.edits, "sample", slide.id, slide.sample || null);
  const [runs, setRuns] = useState(null);
  const [run, setRun] = useState(binding?.run || "");
  const [cases, setCases] = useState([]);
  useEffect(() => {
    fetch("/api/runs").then((r) => (r.ok ? r.json() : { runs: [] })).then((d) => setRuns(d.runs || [])).catch(() => setRuns([]));
  }, []);
  useEffect(() => {
    if (!run) return setCases([]);
    fetch(`/api/runs/${encodeURIComponent(run)}/cases`).then((r) => (r.ok ? r.json() : { cases: [] })).then((d) => setCases(d.cases || [])).catch(() => setCases([]));
  }, [run]);
  if (!flow?.sampleKind) return null;
  const eligible = (runs || []).filter((r) => r.kind === flow.sampleKind);
  return (
    <fieldset className="binding">
      <legend>Saved run</legend>
      {runs === null ? <p className="muted">Loading runs…</p> : !eligible.length ? <p className="muted">No saved {flow.sampleKind} runs are available locally.</p> : (
        <>
          <label className="field">
            <span>Run</span>
            <select value={run} onChange={(e) => setRun(e.target.value)}>
              <option value="">Choose a run</option>
              {eligible.map((r) => <option key={r.id} value={r.id}>{r.id}{r.offline ? " · offline fixture" : ""} ({r.cases})</option>)}
            </select>
          </label>
          {run && (
            <label className="field">
              <span>Case</span>
              <select
                value={binding?.run === run ? binding.case : ""}
                onChange={(e) => setSlideSetting(deck.update, "sample", slide.id, e.target.value ? { run, case: e.target.value } : null)}
              >
                <option value="">Choose a case</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.event} · {c.condition}{c.seed ? ` · ${c.seed}` : ""}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {binding && (
        <p className="muted">
          Bound to <code>{binding.run}/{binding.case.slice(0, 12)}</code>.{" "}
          <button className="link" onClick={() => setSlideSetting(deck.update, "sample", slide.id, null)}>Unbind</button>
        </p>
      )}
      <p className="muted small">Saved dialogue is private. It is read from local results with aliases applied and never written into the deck files.</p>
    </fieldset>
  );
}

function SlideTab({ slide, index, total }) {
  const deck = useDeck();
  const id = slide.id;
  const layout = slideSetting(deck.edits, "layout", id, slide.layout);
  return (
    <div className="slide-tab">
      <div className="row"><span>Slide</span><span className="mono">{index + 1} / {total} · {id}</span></div>
      <label className="field">
        <span>Layout</span>
        <select value={layout} onChange={(e) => setSlideSetting(deck.update, "layout", id, e.target.value === slide.layout ? undefined : e.target.value)}>
          {LAYOUTS.map((l) => <option key={l} value={l}>{l}{l === slide.layout ? " (default)" : ""}</option>)}
        </select>
      </label>
      <div className="row">
        <span>Theme</span>
        <Segmented label="Theme" value={slideSetting(deck.edits, "theme", id, slide.theme || "dark")} onChange={(v) => setSlideSetting(deck.update, "theme", id, v === (slide.theme || "dark") ? undefined : v)} options={[["dark", "Night"], ["paper", "Paper"]]} />
      </div>
      <div className="row">
        <span>Vertical</span>
        <Segmented label="Vertical alignment" value={slideSetting(deck.edits, "align", id, slide.align || "center")} onChange={(v) => setSlideSetting(deck.update, "align", id, v === (slide.align || "center") ? undefined : v)} options={[["top", "Top"], ["center", "Center"]]} />
      </div>
      <div className="row">
        <span>Mirror</span>
        <Segmented label="Mirror columns" value={slideSetting(deck.edits, "flip", id, false) ? "on" : "off"} onChange={(v) => setSlideSetting(deck.update, "flip", id, v === "on" || undefined)} options={[["off", "Off"], ["on", "On"]]} />
      </div>
      <div className="row">
        <span>In deck</span>
        <Segmented label="Hide slide" value={slideSetting(deck.edits, "hidden", id, false) ? "hidden" : "shown"} onChange={(v) => setSlideSetting(deck.update, "hidden", id, v === "hidden" || undefined)} options={[["shown", "Shown"], ["hidden", "Skipped"]]} />
      </div>
      <div className="row">
        <span>Order</span>
        <div className="stepper">
          <button onClick={() => deck.moveSlide(id, -1)} disabled={index === 0} aria-label="Move earlier">↑</button>
          <button onClick={() => deck.moveSlide(id, 1)} disabled={index === total - 1} aria-label="Move later">↓</button>
        </div>
      </div>
      {layout === "flow" && slide.flow && (
        <div className="row">
          <span>Autoplay</span>
          <Segmented label="Autoplay in presentation" value={slideSetting(deck.edits, "autoplay", id, false) ? "on" : "off"} onChange={(v) => setSlideSetting(deck.update, "autoplay", id, v === "on" || undefined)} options={[["off", "Off"], ["on", "On"]]} />
        </div>
      )}
      {slide.flow && <SampleBinding slide={slide} />}
      <button
        className="ghost"
        onClick={() =>
          deck.update((e) => {
            for (const k of Object.keys(e.text)) if (k === id || k.startsWith(id + ".")) delete e.text[k];
            for (const k of Object.keys(e.style)) if (k === id || k.startsWith(id + ".")) delete e.style[k];
            for (const key of Object.keys(e.slides)) if (key !== "order" && e.slides[key]) delete e.slides[key][id];
            return e;
          })
        }
      >
        Reset all edits on this slide
      </button>
    </div>
  );
}

function NotesTab({ slide }) {
  const deck = useDeck();
  const value = slideSetting(deck.edits, "notes", slide.id, slide.notes || "");
  return (
    <label className="field notes">
      <span>Speaker notes</span>
      <textarea
        rows={14}
        value={value}
        onChange={(e) => setSlideSetting(deck.update, "notes", slide.id, e.target.value === (slide.notes || "") ? undefined : e.target.value)}
      />
    </label>
  );
}

function AnnotationsTab({ slides, current }) {
  const deck = useDeck();
  const [scope, setScope] = useState("slide");
  const [copied, setCopied] = useState(false);
  const all = deck.edits.annotations;
  const shown = all.filter((a) => scope === "all" || a.slide === current.id);
  return (
    <div className="annotations">
      <div className="row">
        <Segmented label="Scope" value={scope} onChange={setScope} options={[["slide", "This slide"], ["all", `All (${all.length})`]]} />
        <button
          className="link"
          disabled={!all.length}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(markdown(all, slides));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>
      {!shown.length && <p className="muted">No notes yet. Select an element and add one from the Element tab.</p>}
      <ol>
        {shown.map((a) => (
          <li key={a.id} className={a.status === "resolved" ? "resolved" : ""}>
            <button className="target" onClick={() => deck.focusAnnotation(a)} title="Go to this element">
              <b>{all.indexOf(a) + 1}</b> <code>{a.target}</code>
            </button>
            <p>{a.text}</p>
            <div className="meta">
              <time>{new Date(a.created).toLocaleString()}</time>
              <button className="link" onClick={() => deck.update((e) => { const x = e.annotations.find((y) => y.id === a.id); x.status = x.status === "resolved" ? "open" : "resolved"; return e; })}>
                {a.status === "resolved" ? "Reopen" : "Resolve"}
              </button>
              <button className="link danger" onClick={() => deck.update((e) => { e.annotations = e.annotations.filter((y) => y.id !== a.id); return e; })}>Delete</button>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted small">Saved with your edits in <code>manuscript/deck/edits.local.json</code> and mirrored to <code>annotations.local.md</code>.</p>
    </div>
  );
}

export default function Editor({ open, setOpen, slides, index, slide }) {
  const deck = useDeck();
  const [tab, setTab] = useState("element");
  useEffect(() => {
    if (deck.selected) setTab("element");
  }, [deck.selected]);
  const openNotes = useMemo(() => deck.edits.annotations.filter((a) => a.status !== "resolved").length, [deck.edits.annotations]);
  return (
    <>
      <button
        className={`edit-fab ${open ? "on" : ""}`}
        onClick={() => setOpen(!open)}
        title={open ? "Close editor (E)" : "Open editor (E)"}
        aria-label={open ? "Close editor" : "Open editor"}
        aria-expanded={open}
      >
        ✎{openNotes ? <span className="badge">{openNotes}</span> : null}
      </button>
      {open && (
        <aside className="editor" aria-label="Deck editor" onKeyDown={(e) => e.stopPropagation()}>
          <header>
            <strong>Edit</strong>
            <button className={`pick ${deck.picking ? "on" : ""}`} onClick={() => deck.setPicking(!deck.picking)} title="Select elements on the slide">
              {deck.picking ? "◎ Picking" : "○ Pick"}
            </button>
            <span className={`status ${deck.status}`}>{{ saved: "Saved", saving: "Saving…", error: "Not saved", local: "Saved in browser" }[deck.status]}</span>
            <button className="icon" onClick={deck.revert} disabled={!deck.canUndo} title="Undo (⌘Z)" aria-label="Undo">↶</button>
            <button className="icon" onClick={() => setOpen(false)} title="Close (E)" aria-label="Close editor">×</button>
          </header>
          <nav className="tabs" role="tablist">
            {[["element", "Element"], ["slide", "Slide"], ["notes", "Notes"], ["annotations", `Annotations${openNotes ? ` · ${openNotes}` : ""}`]].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{id === "notes" ? "Speaker" : label}</button>
            ))}
          </nav>
          <div className="tab-body">
            {tab === "element" && <ElementTab slide={slide} />}
            {tab === "slide" && <SlideTab slide={slide} index={index} total={slides.length} />}
            {tab === "notes" && <NotesTab slide={slide} />}
            {tab === "annotations" && <AnnotationsTab slides={slides} current={slide} />}
          </div>
          <footer>
            <a href={`?mode=present#${index + 1}`}>Open presentation mode</a>
            <span><kbd>?</kbd> shortcuts</span>
          </footer>
        </aside>
      )}
    </>
  );
}
