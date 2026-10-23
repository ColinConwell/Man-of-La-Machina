import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Per-viewer reading preferences. Browser storage is only a convenience: the
// defaults render correctly when it is unavailable.
const KEY = "results-view-settings";
export const DEFAULTS = {
  layout: "reading",
  size: "medium",
  font: "serif",
  colorBy: "speaker",
  numbers: true,
  models: true,
  events: true,
  anchors: true,
};
const listeners = new Set();
let current = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
})();

function save(next) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((fn) => fn());
}

export function useViewSettings() {
  const settings = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
  return [settings, (patch) => save({ ...current, ...patch })];
}

export const SIZES = { small: 14, medium: 16, large: 19 };

// Stable, readable bubble colors for models in "color by model" mode.
const PALETTE = ["#2f6fd6", "#7b4fd0", "#16865f", "#c2571a", "#b0306a", "#3d7f99"];
export function modelColor(model = "") {
  let h = 0;
  for (const c of model) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function Choice({ label, value, options, onChange }) {
  return (
    <div className="vs-row">
      <span>{label}</span>
      <div className="vs-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text, name]) => (
          <button key={v} role="radio" aria-checked={value === v} aria-label={name} title={name} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`vs-toggle ${disabled ? "disabled" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function ViewSettings() {
  const [settings, set] = useViewSettings();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="view-settings" ref={root}>
      <button className="vs-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        View ▾
      </button>
      {open && (
        <div className="vs-panel" role="dialog" aria-label="View settings">
          <Choice label="Layout" value={settings.layout} onChange={(layout) => set({ layout })} options={[["reading", "Reading"], ["chat", "Chat"]]} />
          <Choice label="Text" value={settings.size} onChange={(size) => set({ size })} options={[["small", "S", "Small"], ["medium", "M", "Medium"], ["large", "L", "Large"]]} />
          <Choice label="Font" value={settings.font} onChange={(font) => set({ font })} options={[["serif", "Serif"], ["sans", "Sans"]]} />
          <Choice label="Color" value={settings.colorBy} onChange={(colorBy) => set({ colorBy })} options={[["speaker", "Speaker"], ["model", "Model"]]} />
          <div className="vs-toggles">
            <Toggle label="Turn numbers" checked={settings.numbers} onChange={(numbers) => set({ numbers })} />
            <Toggle label="Model labels" checked={settings.models} onChange={(models) => set({ models })} />
            <Toggle label="Event strip" checked={settings.events} onChange={(events) => set({ events })} />
            <Toggle label="Start and end anchors" checked={settings.anchors} onChange={(anchors) => set({ anchors })} />
          </div>
          <button className="text-button" onClick={() => set(DEFAULTS)}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
