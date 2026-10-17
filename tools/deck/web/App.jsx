import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Editor from "./Editor";
import { Slide } from "./Slides";
import { DeckProvider, normalizeEdits, slideSetting, useEdits } from "./editing";

const W = 1600, H = 900;
const mode = new URLSearchParams(location.search).get("mode") === "edit" ? "edit" : "present";

const SHORTCUTS = [
  ["→ / Space / PgDn", "Next slide"],
  ["← / PgUp", "Previous slide"],
  ["Home / End", "First or last slide"],
  ["P", "Play or pause the simulation"],
  ["[ / ]", "Previous or next simulation beat"],
  ["O", "Slide overview"],
  ["F", "Full screen"],
  ["E", "Open or close the editor (edit mode)"],
  ["Alt + arrows", "Nudge the selected element (edit mode)"],
  ["⌘Z", "Undo (edit mode)"],
  ["Esc", "Close overlay or deselect"],
];

function useFit(ref) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / W, height / H));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return scale;
}

function typing(target) {
  return target?.closest?.("input, textarea, select, [contenteditable=true]");
}

function Deck({ content, initialEdits, canSave }) {
  const { edits, update, revert, status, canUndo } = useEdits(initialEdits, canSave);
  const [editorOpen, setEditorOpen] = useState(false);
  const [picking, setPicking] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [overview, setOverview] = useState(false);
  const [help, setHelp] = useState(false);
  const [idle, setIdle] = useState(false);
  const viewport = useRef(null);
  const scale = useFit(viewport);
  const flowControl = useRef(null);

  const ordered = useMemo(() => {
    const byId = Object.fromEntries(content.slides.map((s) => [s.id, s]));
    const order = (edits.slides.order || []).filter((id) => byId[id]);
    const rest = content.slides.map((s) => s.id).filter((id) => !order.includes(id));
    return [...order, ...rest].map((id) => byId[id]);
  }, [content, edits.slides.order]);
  const slides = useMemo(
    () => (mode === "edit" ? ordered : ordered.filter((s) => !slideSetting(edits, "hidden", s.id, s.hidden || false))),
    [ordered, edits],
  );

  const fromHash = () => Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  const [index, setIndex] = useState(fromHash);
  const slide = slides[Math.min(index, slides.length - 1)];
  useEffect(() => {
    const onHash = () => setIndex(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [slides.length]);
  const go = useCallback(
    (i) => {
      const next = Math.max(0, Math.min(slides.length - 1, i));
      setIndex(next);
      setSelected(null);
      setEditingText(null);
      flowControl.current = null;
      history.replaceState(null, "", `${location.search}#${next + 1}`);
    },
    [slides.length],
  );

  const select = useCallback((p) => {
    setSelected(p);
    setEditingText(null);
  }, []);

  const addAnnotation = useCallback(
    (slideId, target, text) =>
      update((e) => {
        e.annotations.push({ id: crypto.randomUUID(), slide: slideId, target, text, created: new Date().toISOString(), status: "open" });
        return e;
      }),
    [update],
  );

  const moveSlide = useCallback(
    (id, delta) =>
      update((e) => {
        const ids = ordered.map((s) => s.id);
        const i = ids.indexOf(id), j = i + delta;
        if (i < 0 || j < 0 || j >= ids.length) return e;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        e.slides.order = ids;
        setTimeout(() => go(j), 0);
        return e;
      }),
    [ordered, update, go],
  );

  const focusAnnotation = useCallback(
    (a) => {
      const i = slides.findIndex((s) => s.id === a.slide);
      if (i >= 0) go(i);
      setTimeout(() => setSelected(a.target === a.slide ? null : a.target), 0);
    },
    [slides, go],
  );

  // Keyboard map shared by both modes; editing keys only act in edit mode.
  useEffect(() => {
    const onKey = (e) => {
      if (typing(e.target)) return;
      const k = e.key;
      if (mode === "edit" && (e.metaKey || e.ctrlKey) && k.toLowerCase() === "z") {
        e.preventDefault();
        revert();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if ((k === " " || k === "Enter") && e.target.closest?.("button")) return;
      if (mode === "edit" && e.altKey && selected && k.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
        update((ed) => {
          const s = { ...(ed.style[selected] || {}) };
          s.dx = (s.dx || 0) + dx;
          s.dy = (s.dy || 0) + dy;
          ed.style[selected] = s;
          return ed;
        });
        return;
      }
      if (["ArrowRight", "PageDown", " ", "ArrowDown"].includes(k)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "PageUp", "ArrowUp"].includes(k)) {
        e.preventDefault();
        go(index - 1);
      } else if (k === "Home") go(0);
      else if (k === "End") go(slides.length - 1);
      else if (k === "p" || k === "P") flowControl.current?.toggle();
      else if (k === "]") flowControl.current?.next();
      else if (k === "[") flowControl.current?.prev();
      else if (k === "o" || k === "O") setOverview((o) => !o);
      else if (k === "?") setHelp((h) => !h);
      else if (k === "f" || k === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      } else if ((k === "e" || k === "E") && mode === "edit") setEditorOpen((o) => !o);
      else if (k === "Escape") {
        if (help) setHelp(false);
        else if (overview) setOverview(false);
        else if (selected) setSelected(null);
        else if (editorOpen) setEditorOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, slides.length, go, selected, editorOpen, overview, help, revert, update]);

  // Hide the pointer while presenting.
  useEffect(() => {
    if (mode !== "present") return;
    let t;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener("pointermove", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
    };
  }, []);

  // Picker: capture clicks on the stage before slide content handles them.
  const pickActive = mode === "edit" && editorOpen && picking;
  const onStageClick = (e) => {
    if (mode !== "edit") return;
    if (!pickActive && !e.altKey) return;
    if (e.target.closest(".editor, .edit-fab")) return;
    const el = e.target.closest("[data-eid]");
    if (!el) {
      setSelected(null);
      return;
    }
    if (editingText === el.dataset.eid) return;
    e.preventDefault();
    e.stopPropagation();
    if (!editorOpen) setEditorOpen(true);
    setSelected(el.dataset.eid);
  };

  const deck = {
    mode, edits, update, revert, status, canUndo, scale,
    picking: pickActive, setPicking, selected, select, editingText, setEditingText,
    addAnnotation, moveSlide, focusAnnotation,
    registerFlow: (c) => (flowControl.current = c),
  };
  if (!slide) return <div className="empty-deck">This deck has no slides.</div>;
  const skipped = slideSetting(edits, "hidden", slide.id, slide.hidden || false);
  return (
    <DeckProvider value={deck}>
      <div className={`app mode-${mode} ${editorOpen ? "editor-open" : ""} ${pickActive ? "picking" : ""} ${idle ? "idle" : ""}`}>
        <div className="viewport" ref={viewport}>
          <div className="stage" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }} onClickCapture={onStageClick}>
            <div className="slide-wrap" key={slide.id}>
              <Slide s={slide} />
            </div>
            {skipped && <div className="skipped-flag">Skipped in presentation</div>}
          </div>
        </div>
        <div className="progress" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
        <div className="counter">{index + 1} / {slides.length}</div>
        {mode === "edit" && <Editor open={editorOpen} setOpen={setEditorOpen} slides={slides} index={index} slide={slide} />}
        {overview && (
          <div className="overview" role="dialog" aria-label="Slide overview" onClick={() => setOverview(false)}>
            <ol>
              {slides.map((s, i) => (
                <li key={s.id} className={i === index ? "on" : ""}>
                  <button onClick={(e) => { e.stopPropagation(); go(i); setOverview(false); }}>
                    <span className="n">{i + 1}</span>
                    <span className="t">{edits.text[`${s.id}.title`] ?? s.title ?? s.quote ?? s.id}</span>
                    <span className="l">{slideSetting(edits, "layout", s.id, s.layout)}{slideSetting(edits, "hidden", s.id, false) ? " · skipped" : ""}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        {help && (
          <div className="help" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setHelp(false)}>
            <dl>
              {SHORTCUTS.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt><kbd>{k}</kbd></dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        )}
      </div>
    </DeckProvider>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  useEffect(() => {
    fetch("/api/deck")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setState({ content: d.content, edits: d.edits, source: d.source, canSave: true }))
      .catch(async () => {
        // Opened without the deck server: fall back to the committed example.
        const example = await fetch("./example-deck.json").then((r) => r.json()).catch(() => ({ slides: [] }));
        let edits = null;
        try {
          edits = JSON.parse(localStorage.getItem("deck-edits") || "null");
        } catch {}
        setState({ content: example, edits: normalizeEdits(edits), source: "example", canSave: false });
      });
  }, []);
  useEffect(() => {
    if (state?.content?.title) document.title = `${state.content.title}${mode === "edit" ? " · Editing" : ""}`;
  }, [state]);
  if (!state) return <div className="loading">Loading deck…</div>;
  return <Deck content={state.content} initialEdits={state.edits} canSave={state.canSave} />;
}
