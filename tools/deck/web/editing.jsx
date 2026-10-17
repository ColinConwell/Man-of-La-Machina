import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const EMPTY_EDITS = { version: 1, text: {}, style: {}, slides: {}, annotations: [] };
const Ctx = createContext(null);
export const useDeck = () => useContext(Ctx);
export const DeckProvider = Ctx.Provider;

export function normalizeEdits(raw) {
  const e = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    text: e.text || {},
    style: e.style || {},
    slides: e.slides || {},
    annotations: Array.isArray(e.annotations) ? e.annotations : [],
  };
}

// Edits are saved to the private file behind the local server. Browser storage is
// only a fallback for a deck opened without that server.
export function useEdits(initial, canSave) {
  const [edits, setState] = useState(() => normalizeEdits(initial));
  const [status, setStatus] = useState("saved");
  const undo = useRef([]);
  const timer = useRef(null);
  const latest = useRef(edits);

  const persist = useCallback(
    (value) => {
      clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(async () => {
        if (!canSave) {
          try {
            localStorage.setItem("deck-edits", JSON.stringify(value));
            setStatus("local");
          } catch {
            setStatus("error");
          }
          return;
        }
        try {
          const response = await fetch("/api/edits", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          });
          setStatus(response.ok ? "saved" : "error");
        } catch {
          setStatus("error");
        }
      }, 450);
    },
    [canSave],
  );

  const update = useCallback(
    (fn, { snapshot = true } = {}) => {
      setState((prev) => {
        const next = normalizeEdits(fn(structuredClone(prev)));
        if (snapshot) undo.current = [...undo.current.slice(-80), prev];
        latest.current = next;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const revert = useCallback(() => {
    const prev = undo.current.pop();
    if (!prev) return;
    latest.current = prev;
    setState(prev);
    persist(prev);
  }, [persist]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { edits, update, revert, status, canUndo: undo.current.length > 0 };
}

export function slideSetting(edits, key, id, fallback) {
  const v = edits.slides?.[key]?.[id];
  return v === undefined ? fallback : v;
}

export function setSlideSetting(update, key, id, value) {
  update((e) => {
    e.slides[key] = { ...(e.slides[key] || {}) };
    if (value === undefined || value === null || value === "") delete e.slides[key][id];
    else e.slides[key][id] = value;
    return e;
  });
}

// Minimal inline markup: *emphasis* and line breaks.
export function rich(text) {
  return String(text ?? "")
    .split("\n")
    .flatMap((line, i) => {
      const parts = line.split(/(\*[^*\n]+\*)/g).map((part, j) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <em key={j}>{part.slice(1, -1)}</em> : part,
      );
      return i ? [<br key={`br${i}`} />, ...parts] : parts;
    });
}

function styleFor(style) {
  if (!style) return undefined;
  const s = {};
  if (style.align) s.textAlign = style.align;
  if (style.scale && style.scale !== 1) s["--s"] = style.scale;
  if (style.width) s.maxWidth = { narrow: "60%", wide: "92%", full: "100%" }[style.width];
  if (style.dx || style.dy) s.transform = `translate(${style.dx || 0}px, ${style.dy || 0}px)`;
  return s;
}

function useDrag(p) {
  const deck = useDeck();
  const start = useRef(null);
  return (event) => {
    if (!deck.picking || deck.selected !== p || deck.editingText === p || event.button !== 0) return;
    const base = deck.edits.style[p] || {};
    start.current = { x: event.clientX, y: event.clientY, dx: base.dx || 0, dy: base.dy || 0, moved: false };
    const move = (e) => {
      const s = start.current;
      const dx = Math.round(s.dx + (e.clientX - s.x) / deck.scale);
      const dy = Math.round(s.dy + (e.clientY - s.y) / deck.scale);
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 4) return;
      deck.update((ed) => {
        ed.style[p] = { ...(ed.style[p] || {}), dx, dy };
        return ed;
      }, { snapshot: !s.moved });
      s.moved = true;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

function Pins({ p }) {
  const deck = useDeck();
  if (deck.mode !== "edit") return null;
  const notes = deck.edits.annotations.filter((a) => a.target === p && a.status !== "resolved");
  if (!notes.length) return null;
  return (
    <span className="pins" aria-hidden="true">
      {notes.map((a) => (
        <span key={a.id} className="pin" title={a.text}>
          {deck.edits.annotations.indexOf(a) + 1}
        </span>
      ))}
    </span>
  );
}

function InlineEditor({ value, multiline, onCommit, onCancel }) {
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    // Focus only: the native double-click selection (a word) is kept, as in Keynote.
    ref.current.focus();
  }, []);
  const finish = (commit) => {
    if (done.current) return;
    done.current = true;
    commit ? onCommit(ref.current.value.replace(/\n+$/, "")) : onCancel();
  };
  return (
    <textarea
      ref={ref}
      className="inline-editor"
      defaultValue={value}
      rows={1}
      aria-label="Edit text"
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish(false);
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (!multiline && !e.shiftKey))) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}

// Editable text element. `p` is its stable path; `v` the default content.
export function T({ p, v, as: Tag = "div", className = "", children }) {
  const deck = useDeck();
  const drag = useDrag(p);
  const style = deck.edits.style[p];
  const value = deck.edits.text[p] ?? v ?? "";
  const hidden = style?.hidden;
  const editing = deck.editingText === p;
  if (hidden && deck.mode !== "edit") return null;
  if (!value && !children && deck.mode !== "edit") return null;
  const commit = (text) => {
    deck.setEditingText(null);
    if (text !== value) deck.update((e) => {
      if (text === (v ?? "")) delete e.text[p];
      else e.text[p] = text;
      return e;
    });
  };
  return (
    <Tag
      data-eid={p}
      className={`${className} eid ${deck.selected === p ? "sel" : ""} ${hidden ? "is-hidden" : ""} ${editing ? "editing" : ""} ${!value ? "is-empty" : ""}`}
      style={styleFor(style)}
      onPointerDown={editing ? undefined : drag}
      onDoubleClick={() => deck.picking && deck.mode === "edit" && deck.setEditingText(p)}
    >
      {editing ? (
        <InlineEditor value={value} multiline={Tag === "p" || Tag === "div" || Tag === "blockquote"} onCommit={commit} onCancel={() => deck.setEditingText(null)} />
      ) : (
        <>
          {children ?? (value ? rich(value) : deck.mode === "edit" ? <span className="placeholder">empty</span> : null)}
          <Pins p={p} />
        </>
      )}
    </Tag>
  );
}

// Non-text block that can still be selected, nudged, resized, hidden, and annotated.
export function Box({ p, className = "", children, as: Tag = "div" }) {
  const deck = useDeck();
  const drag = useDrag(p);
  const style = deck.edits.style[p];
  if (style?.hidden && deck.mode !== "edit") return null;
  return (
    <Tag
      data-eid={p}
      className={`${className} eid box ${deck.selected === p ? "sel" : ""} ${style?.hidden ? "is-hidden" : ""}`}
      style={styleFor(style)}
      onPointerDown={drag}
    >
      {children}
      <Pins p={p} />
    </Tag>
  );
}
