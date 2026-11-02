import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, HelpCircle } from "lucide-react";
import type { EffectDef, Knob } from "./types";
export function Button({
  children,
  title,
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function NumberControl({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v))
            onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)));
        }}
      />
      <small>{unit}</small>
    </label>
  );
}
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(+e.target.value)}
      />
      <output>
        {Number(value.toFixed(3))} {unit}
      </output>
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="section-head">
        <h2>{title}</h2>
        <Button title="Close Dialog" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
const examples: Record<string, string> = {
  pitch: "Try ±0.12 semitones on quiet duplicate layers for a detuned unison.",
  stretch:
    "Try 1.1× for a more deliberate reading, then compare consonant clarity.",
  chorus: "Try 0.3 Hz, shallow depth and 15% wet mix for a subtle double.",
  vibrato: "Try 4 Hz with a small excursion on the last word of a sentence.",
  tremolo: "Try 0.5 Hz and 20% depth for a slowly breathing amplitude.",
  phaser:
    "Try a slow sweep at 15% mix to move resonant notches through a held vowel.",
  delay:
    "Try 180 ms and low feedback for a short echo behind the original voice.",
  reverb:
    "Automate wet mix from 5% to 35% to move gradually into a larger apparent space.",
  convolution:
    "Import a short impulse response, then compare it with the algorithmic reverb.",
  lowpass:
    "Move the cutoff from 6 kHz to 1 kHz as a passage becomes more distant.",
  highpass:
    "Raise the cutoff gently to reduce rumble; a large move creates a thin telephone-like tone.",
  eq: "Try a broad 2 dB cut around 2 kHz, then compare at the same output level.",
  distortion:
    "Begin at 3 dB drive and 10% mix; listen for new harmonics on vowels.",
  bitcrush:
    "Compare 12 and 6 bits with the same gain to hear quantization texture.",
  compressor:
    "Start at 3:1 with a moderate threshold; compare quiet and emphatic words.",
  limiter:
    "Use a −1 dB ceiling on the final mix, then inspect the measured peak.",
};
export function Mechanism({
  kind,
  value = 0.4,
}: {
  kind: string;
  value?: number;
}) {
  const [phase, setPhase] = useState(0),
    [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const id = setInterval(() => setPhase((t) => t + 0.12), 60);
    return () => clearInterval(id);
  }, [animate]);
  const path = (fn: (x: number) => number) =>
    Array.from(
      { length: 281 },
      (_, i) => `${i ? "L" : "M"}${i + 15},${65 - fn(i / 280) * 35}`,
    ).join(" ");
  const wave = (x: number) => Math.sin(x * 36 + phase);
  let dry = path(wave),
    wet = "",
    axis = "Time →",
    caption = "Original / Processed";
  if (["lowpass", "highpass", "eq", "phaser"].includes(kind)) {
    dry = path(() => 0.8);
    axis = "Frequency →";
    caption = "Conceptual frequency response";
    wet = path((x) =>
      kind === "lowpass"
        ? 1 / (1 + Math.exp((x - (0.15 + 0.7 * value)) * 18))
        : kind === "highpass"
          ? 1 - 1 / (1 + Math.exp((x - (0.15 + 0.7 * value)) * 18))
          : kind === "eq"
            ? value * Math.exp(-(((x - 0.5) / 0.14) ** 2))
            : 0.8 - 0.6 * Math.sin(x * 12 + phase + value * 3) ** 8,
    );
  } else if (["compressor", "limiter", "distortion"].includes(kind)) {
    dry = path((x) => x * 2 - 1);
    axis = "Input Level →";
    caption = "Output level transfer curve";
    wet = path((x) => {
      const a = x * 2 - 1,
        t = 0.9 - value * 0.65;
      return kind === "distortion"
        ? Math.tanh(a * (1 + value * 5))
        : Math.sign(a) *
            (Math.min(Math.abs(a), t) +
              Math.max(0, Math.abs(a) - t) /
                (kind === "limiter" ? 40 : 2 + value * 10));
    });
  } else if (["reverb", "convolution", "delay"].includes(kind)) {
    dry = "M15 65 L35 65 L36 25 L37 65 L295 65";
    caption = kind === "delay" ? "Repeated echoes" : "Decaying reflections";
    wet = path((x) =>
      x < 0.07
        ? 0
        : kind === "delay"
          ? Math.abs((x - 0.07) % (0.08 + value * 0.15)) < 0.007
            ? Math.exp(-x * 3)
            : 0
          : Math.sin(x * 165) *
            Math.sin(x * 53) *
            Math.exp(-x * (7 - value * 5)),
    );
  } else
    wet = path((x) =>
      kind === "pitch"
        ? Math.sin(x * 36 * (1 + value) + phase)
        : kind === "stretch"
          ? Math.sin((x * 36) / (1 + value) + phase)
          : kind === "tremolo"
            ? wave(x) * (1 - value * (0.5 + 0.5 * Math.sin(x * 13 + phase)))
            : kind === "vibrato"
              ? Math.sin(x * 36 + phase + value * Math.sin(x * 18 + phase))
              : kind === "bitcrush"
                ? Math.round(wave(x) * (2 + (1 - value) * 14)) /
                  (2 + (1 - value) * 14)
                : (wave(x) +
                    value *
                      Math.sin(x * 36 + phase + Math.sin(x * 8 + phase))) /
                  (1 + value),
    );
  return (
    <div className="mechanism">
      <svg
        viewBox="0 0 310 120"
        role="img"
        aria-label={`Conceptual ${kind} mechanism; not measured audio`}
      >
        <path d={dry} fill="none" stroke="currentColor" opacity=".25" />
        <path d={wet} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <text x="15" y="12" fontSize="9" fill="currentColor">
          {caption}
        </text>
        <text x="220" y="112" fontSize="9" fill="currentColor">
          {axis}
        </text>
      </svg>
      <small>Conceptual illustration · not measured audio</small>
      <button type="button" onClick={() => setAnimate(!animate)}>
        {animate ? "Pause" : "Animate"} Diagram
      </button>
    </div>
  );
}
export function EffectHelp({
  kind,
  definition,
  onClose,
}: {
  kind: string;
  definition: EffectDef;
  onClose: () => void;
}) {
  const [v, setV] = useState(0.4);
  return (
    <Modal title={`How ${definition.name} Works`} onClose={onClose}>
      <p className="reading">{definition.explanation}</p>
      <Mechanism kind={kind} value={v} />
      <Slider
        label="Illustration Amount"
        value={v}
        min={0}
        max={1}
        onChange={setV}
      />
      <p>{definition.preview}</p>
      <p>
        Use the effect’s enable switch to bypass it, then compare the same
        passage. Dry playback keeps the unprocessed voice; Render Mix includes
        every enabled effect.
      </p>
      <h3>Starting Experiment</h3>
      <p>{examples[kind]}</p>
      <h3>Parameters</h3>
      {Object.entries(definition.params).map(([k, p]) => (
        <p key={k}>
          <strong>{p.label}:</strong> {p.min}–{p.max} {p.unit}. Starting value:{" "}
          {p.default}.
        </p>
      ))}
    </Modal>
  );
}
