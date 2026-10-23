import React, { useRef } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Columns2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { OPTIONS, PRESETS } from "./settings.mjs";
import { TYPE_PRESETS, fontFor } from "./typography.mjs";

function Select({ field, label, settings, onChange }) {
  return (
    <label className="field-label" htmlFor={`setting-${field}`}>
      <span>{label}</span>
      <select
        aria-label={label}
        id={`setting-${field}`}
        value={settings[field]}
        onChange={(e) => onChange(field, e.target.value)}
      >
        {OPTIONS[field].map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}
function Slider({
  field,
  label,
  settings,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  unit = "%",
}) {
  return (
    <label className="slider-field" htmlFor={`setting-${field}`}>
      <span>
        {label}
        <output>
          {unit === "%" ? Math.round(settings[field] * 100) : settings[field]}
          {unit}
        </output>
      </span>
      <input
        aria-label={label}
        id={`setting-${field}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[field]}
        onChange={(e) => onChange(field, Number(e.target.value))}
      />
    </label>
  );
}
export default function ControlPanel({
  settings,
  onChange,
  onClose,
  onPreset,
  onReset,
  onImport,
  onExport,
  onCompare,
  comparing,
  status,
  reducedMotion,
  onAnimationStudy,
}) {
  const file = useRef(null);
  return (
    <aside
      id="design-controls"
      className="design-panel"
      aria-label="Design Controls"
    >
      <div className="panel-heading">
        <div>
          <h2>Design Study</h2>
          <p>Landscape, Light & Movement</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="icon-button"
          aria-label="Close Design Controls"
        >
          <X size={18} />
        </button>
      </div>
      <section className="panel-section">
        <h3>Starting Points</h3>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.name}
              title={p.detail}
              onClick={() => onPreset(p)}
              className={
                Object.entries(p.settings).every(([k, v]) => settings[k] === v)
                  ? "selected"
                  : ""
              }
            >
              <span
                className={`preset-swatch swatch-${p.settings.composition} swatch-${p.settings.treatment}`}
              />
              {p.name}
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section">
        <h3>Landscape</h3>
        <Select field="scene" label="Scene" {...{ settings, onChange }} />
        <Select
          field="composition"
          label="Composition"
          {...{ settings, onChange }}
        />
        <Select
          field="treatment"
          label="Illustration"
          {...{ settings, onChange }}
        />
        <Select
          field="theme"
          label="Interface Palette"
          {...{ settings, onChange }}
        />
        <div className="treatment-shortcuts" aria-label="Sketch Studies">
          <button type="button" className="panel-button" onClick={() => onChange("treatment", "ink-sepia")} aria-pressed={settings.treatment === "ink-sepia"}>Sepia Ink</button>
          <button type="button" className="panel-button" onClick={() => onChange("treatment", "graphite")} aria-pressed={settings.treatment === "graphite"}>Graphite</button>
        </div>
      </section>
      <section className="panel-section">
        <h3>Surface & Legibility</h3>
        <Select field="veilMode" label="Veil Shape" {...{ settings, onChange }} />
        <p className="field-note">
          {settings.veilMode === "window" ? "Fits the available reading window as you resize, including each A/B pane." : settings.veilMode === "messages" ? "A soft, beveled surface fits each message and its speaker label." : settings.veilMode === "contours" ? "The surface follows each wrapped line and reshapes as text reflows." : "A broad, feathered veil keeps the reading column quiet."}
        </p>
        <Slider
          field="readingOpacity"
          label="Reading Veil"
          {...{ settings, onChange }}
        />
        {(settings.veilMode === "messages" || settings.veilMode === "contours") && <Slider field="veilPadding" label="Veil Breathing Room" min={8} max={40} step={1} unit="px" {...{ settings, onChange }} />}
        <Slider
          field="controlOpacity"
          label="Control Opacity"
          {...{ settings, onChange }}
        />
        <Slider
          field="blur"
          label="Glass Blur"
          min={0}
          max={30}
          step={1}
          unit="px"
          {...{ settings, onChange }}
        />
        <p className="field-note">
          Illustration color changes independently of text and controls. Low
          opacities are exploratory.
        </p>
      </section>
      <section className="panel-section">
        <h3>Typography</h3>
        <Select field="headingFont" label="Heading Font" {...{ settings, onChange }} />
        <Select field="readingFont" label="Reading Font" {...{ settings, onChange }} />
        <div className="type-specimen" aria-label="Selected Font Specimen">
          <div style={{fontFamily: fontFor(settings.headingFont).family, fontSize: `${24 * fontFor(settings.headingFont).scale}px`}}>The Unwritten Road</div>
          <p style={{fontFamily: fontFor(settings.readingFont).family, fontSize: `${19 * fontFor(settings.readingFont).scale}px`}}>Every journey begins with a possibility.</p>
        </div>
        <p className="field-note">{fontFor(settings.readingFont).note}</p>
        <Slider field="textScale" label="Reading Text Size" min={0.85} max={1.35} step={0.05} {...{ settings, onChange }} />
        <div className="type-pairings" aria-label="Type Pairings">
          {TYPE_PRESETS.map(p => <button key={p.name} type="button" className="panel-button" onClick={() => onPreset({...p, settings: {...p.settings, travelerFont: "inherit", companionFont: "inherit"}})}>{p.name}</button>)}
        </div>
        <p className="field-note">Pairings change headings and reading text. Speaker overrides return to Use Reading Font. Interface controls keep their familiar type.</p>
        <a className="font-license-link" href="./font-licenses/index.html" target="_blank" rel="noreferrer">Font Credits & Licenses</a>
      </section>
      <section className="panel-section">
        <h3>Conversation Voices</h3>
        <button type="button" className="panel-button" onClick={() => onPreset({name:"Opposing Voices", settings:{travelerPosition:"left", travelerAlign:"left", companionPosition:"right", companionAlign:"right"}})}>Traveler Left · Companion Right</button>
        {[["traveler", "Traveler"], ["companion", "Companion"]].map(([speaker, name]) => <fieldset className="speaker-settings" key={speaker}>
          <legend>{name}</legend>
          <Select field={`${speaker}Position`} label={`${name} Placement`} {...{ settings, onChange }} />
          <Select field={`${speaker}Align`} label={`${name} Text Alignment`} {...{ settings, onChange }} />
          <Select field={`${speaker}Font`} label={`${name} Font`} {...{ settings, onChange }} />
        </fieldset>)}
        <Slider field="messageWidth" label="Placed Message Width" min={0.55} max={1} step={0.01} {...{ settings, onChange }} />
        <p className="field-note">Placement moves the message. Alignment sets its text edges. Width applies to left, center and right placements; Full Width fills the column.</p>
      </section>
      <section className="panel-section">
        <h3>Movement</h3>
        <Select
          field="motion"
          label="Animation Layers"
          {...{ settings, onChange }}
        />
        <Slider
          field="intensity"
          label="Intensity"
          {...{ settings, onChange }}
        />
        <Slider
          field="speed"
          label="Speed"
          min={0.25}
          max={2}
          step={0.05}
          unit="×"
          {...{ settings, onChange }}
        />
        <button
          type="button"
          className="panel-button"
          onClick={() => onChange("paused", !settings.paused)}
          aria-pressed={settings.paused}
        >
          {settings.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
          {settings.paused ? "Resume Animation" : "Pause Animation"}
        </button>
        {reducedMotion && (
          <p className="field-note">
            Your reduced-motion preference is active. The landscape stays still.
          </p>
        )}
        <p className="field-note">
          Artwork stays still; separate clouds, plants, sails and articulated
          silhouette provide the movement.
        </p>
      </section>
      <section className="panel-section">
        <h3>Schematic Content</h3>
        <Select field="layout" label="Layout" {...{ settings, onChange }} />
        <Select
          field="schematic"
          label="App State"
          {...{ settings, onChange }}
        />
        <Select field="density" label="Passages" {...{ settings, onChange }} />
        <Select field="viewport" label="Viewport" {...{ settings, onChange }} />
        <p className="field-note">
          Story and audio controls are intentionally inert. Only this design
          panel changes the preview.
        </p>
      </section>
      <section className="panel-section">
        <h3>Authoring Study</h3>
        <button
          type="button"
          className="panel-button"
          onClick={onAnimationStudy}
        >
          <Play size={14} /> Compare Animation Tools
        </button>
        <p className="field-note">
          Compare native SVG with working Rive and Lottie Creator exports. Their
          local players load only when opened.
        </p>
      </section>
      <section className="panel-section">
        <h3>Compare & Keep</h3>
        <button
          type="button"
          className="panel-button"
          onClick={onCompare}
          aria-pressed={comparing}
        >
          <Columns2 size={15} />
          {comparing ? "End Comparison" : "Pin Current Design as A"}
        </button>
        <p className="field-note">
          Pin a design, then adjust B. Both views always use the same schematic
          content.
        </p>
        <div className="panel-button-row">
          <button type="button" className="panel-button" onClick={onExport}>
            <ArrowDownToLine size={14} /> Export
          </button>
          <button
            type="button"
            className="panel-button"
            onClick={() => file.current?.click()}
          >
            <ArrowUpFromLine size={14} /> Import
          </button>
        </div>
        <input
          ref={file}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-label="Import Preset JSON"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await onImport(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="panel-button reset-button"
          onClick={onReset}
        >
          <RotateCcw size={13} /> Reset All Settings
        </button>
        <p className="preset-status" role="status">
          {status || "Settings are saved on this device."}
        </p>
      </section>
    </aside>
  );
}
