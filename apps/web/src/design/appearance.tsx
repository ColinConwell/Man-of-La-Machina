import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import rose from "./assets/rose-windmills.webp";
import olive from "./assets/olive-plains.webp";
import celadon from "./assets/celadon-circuitry.webp";
import lilac from "./assets/lilac-automata.webp";

export const scenes = { rose, olive, celadon, lilac };
export const fonts = {
  tektur: '"Tektur", sans-serif',
  plex: '"IBM Plex Serif", Georgia, serif',
  allison: '"Allison", cursive',
  classic: "Georgia, serif",
};
export type Appearance = {
  palette: "rose" | "linen" | "moonlight";
  scene: keyof typeof scenes;
  appFont: keyof typeof fonts;
  readingFont: keyof typeof fonts;
  humanFont: keyof typeof fonts;
  machineFont: keyof typeof fonts;
  backgroundOpacity: number;
  readingOpacity: number;
  controlOpacity: number;
  textScale: number;
  lineHeight: number;
  readingBevel: number;
  blur: number;
  motion: "play" | "pause" | "off";
};
export const selectedDesign: Appearance = {
  palette: "rose",
  scene: "rose",
  appFont: "tektur",
  readingFont: "plex",
  humanFont: "allison",
  machineFont: "tektur",
  backgroundOpacity: 0.5,
  readingOpacity: 0.9,
  controlOpacity: 0.9,
  textScale: 1,
  lineHeight: 1.6,
  readingBevel: 0.4,
  blur: 8,
  motion: "play",
};
const key = "machina-appearance-v1";
export function sanitizeAppearance(input: unknown): Appearance {
  const result = { ...selectedDesign };
  if (!input || typeof input !== "object") return result;
  const data = input as Record<string, unknown>;
  const enums = {
    palette: ["rose", "linen", "moonlight"],
    scene: Object.keys(scenes),
    appFont: Object.keys(fonts),
    readingFont: Object.keys(fonts),
    humanFont: Object.keys(fonts),
    machineFont: Object.keys(fonts),
    motion: ["play", "pause", "off"],
  };
  for (const [k, choices] of Object.entries(enums))
    if (choices.includes(String(data[k])))
      Object.assign(result, { [k]: data[k] });
  for (const [k, min, max] of [
    ["backgroundOpacity", 0, 1],
    ["readingOpacity", 0.7, 1],
    ["controlOpacity", 0.7, 1],
    ["textScale", 0.85, 1.35],
    ["lineHeight", 1.35, 2.1],
    ["readingBevel", 0, 2],
    ["blur", 0, 24],
  ] as const) {
    const v = data[k];
    if (typeof v === "number" && Number.isFinite(v))
      Object.assign(result, { [k]: Math.min(max, Math.max(min, v)) });
  }
  return result;
}
export function useAppearance() {
  const [value, setValue] = useState<Appearance>(() => {
    try {
      return sanitizeAppearance(
        JSON.parse(localStorage.getItem(key) || "null"),
      );
    } catch {
      return { ...selectedDesign };
    }
  });
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError("");
    } catch {
      setStorageError("Settings apply now, but this browser cannot save them.");
    }
  }, [value]);
  return {
    value,
    storageError,
    setValue,
    style: {
      "--landscape": `url("${scenes[value.scene]}")`,
      "--landscape-opacity": value.backgroundOpacity,
      "--ui": fonts[value.appFont],
      "--display": fonts[value.appFont],
      "--body": fonts[value.readingFont],
      "--human-font": fonts[value.humanFont],
      "--machine-font": fonts[value.machineFont],
      "--human-scale": value.humanFont === "allison" ? 1.4 : 1,
      "--machine-scale": value.machineFont === "allison" ? 1.4 : 1,
      "--reading-opacity": value.readingOpacity,
      "--control-opacity": value.controlOpacity,
      "--text-scale": value.textScale,
      "--reading-leading": value.lineHeight,
      "--reading-radius": `${value.readingBevel * 14}px`,
      "--glass-blur": `${value.blur}px`,
    } as CSSProperties,
  };
}
export function AppearanceSettings({
  value,
  onChange,
  storageError,
  record,
  onClose,
}: {
  value: Appearance;
  onChange: (v: Appearance) => void;
  storageError: string;
  record: { messages: number; version: string };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const select = (
    field: keyof Appearance,
    label: string,
    options: Record<string, string>,
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value[field]}
        onChange={(e) => onChange({ ...value, [field]: e.target.value })}
      >
        {Object.entries(options).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const range = (
    field: keyof Appearance,
    label: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label>
      {label} <output>{Number(value[field]).toFixed(2)}</output>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[field]}
        onChange={(e) =>
          onChange({ ...value, [field]: Number(e.target.value) })
        }
      />
    </label>
  );
  const fontOptions = {
    tektur: "Tektur",
    plex: "IBM Plex Serif",
    allison: "Allison",
    classic: "Classic Serif",
  };
  return (
    <dialog
      ref={dialog}
      className="appearance-dialog"
      aria-labelledby="appearance-heading"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="settings-heading">
        <h2 id="appearance-heading">Appearance & Settings</h2>
        <button onClick={onClose} aria-label="Close Settings">
          ×
        </button>
      </div>
      <p>Appearance is saved on this device. Conversation drafts are not.</p>
      <fieldset>
        <legend>Landscape & Surfaces</legend>
        {select("scene", "Landscape", {
          rose: "Rose & Graphite Windmills",
          olive: "Andalusian Olive Plains",
          celadon: "Celadon Circuitry",
          lilac: "Lilac Automata",
        })}
        {select("palette", "Interface Palette", {
          rose: "Rose & Graphite",
          linen: "Linen & Sage",
          moonlight: "Moonlight & Copper",
        })}
        {range("backgroundOpacity", "Background Opacity", 0, 1, 0.05)}
        {range("readingOpacity", "Reading Surface Opacity", 0.7, 1, 0.05)}
        {range("controlOpacity", "Control Opacity", 0.7, 1, 0.05)}
        {range("readingBevel", "Reading Bevel", 0, 2, 0.1)}
        {range("blur", "Glass Blur", 0, 24, 1)}
      </fieldset>
      <fieldset>
        <legend>Typography</legend>
        {select("appFont", "App Font", fontOptions)}
        {select("readingFont", "Reading Font", fontOptions)}
        {select("humanFont", "Human Font", fontOptions)}
        {select("machineFont", "Machine Font", fontOptions)}
        {range("textScale", "Reading Text Size", 0.85, 1.35, 0.05)}
        {range("lineHeight", "Line Spacing", 1.35, 2.1, 0.05)}
        <a href="/font-licenses/index.html" target="_blank" rel="noreferrer">
          Font Credits & Licenses
        </a>
      </fieldset>
      <p>Reduced-motion preferences take priority.</p>
      <button onClick={() => onChange({ ...selectedDesign })}>
        Restore Default Settings
      </button>
      <details className="record-details">
        <summary>Record Details</summary>
        <p>Recorded history and generated branches remain distinct.</p>
        <p>
          {record.messages} Recorded Turns · Archive Version {record.version}
        </p>
      </details>
      {storageError && <p role="status">{storageError}</p>}
    </dialog>
  );
}
