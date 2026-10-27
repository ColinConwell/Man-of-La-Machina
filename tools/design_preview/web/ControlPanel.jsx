import React, { useRef, useState } from "react";
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
import { FONT_GROUPS, TYPE_PRESETS, fontFor } from "./typography.mjs";

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
        {field.endsWith("Font") ? <>
          {OPTIONS[field].some(([id]) => id === "inherit") && <option value="inherit">Use Reading Font</option>}
          {FONT_GROUPS.map(group => <optgroup key={group} label={group}>
            {OPTIONS[field].filter(([id]) => id !== "inherit" && fontFor(id).group === group).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </optgroup>)}
        </> : OPTIONS[field].map(([id, title]) => (
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
  status, savedDesigns, quickSaveNames, onSave, onLoad,
  reducedMotion,
  onAnimationStudy,
}) {
  const file = useRef(null);
  const [saveName, setSaveName] = useState("");
  const [nameMode, setNameMode] = useState("modification");
  const proposedName = nameMode === "custom" ? saveName : quickSaveNames[nameMode === "modification" ? 0 : 1];
  const [loadName, setLoadName] = useState("");
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
        <h3>Preview Structure</h3>
        <Select field="layout" label="Layout" {...{ settings, onChange }} />
        <Select
          field="schematic"
          label="App State"
          {...{ settings, onChange }}
        />
        <Select field="density" label="Passages" {...{ settings, onChange }} />
        <Select field="viewport" label="Viewport" {...{ settings, onChange }} />
        <p className="field-note">
          Choose the layout and content first. Starting Points preserves these structure choices. Reply studies allow local typing and navigation; generation and audio remain schematic.
        </p>
      </section>
      <section className="panel-section">
        <h3>Starting Points</h3>
        <p className="field-note">The first four studies coordinate surface and movement, keeping your scene and palette. The last three also pair a new landscape with its palette. All preserve your preview structure, fonts and text alignment.</p>
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
        <Slider field="backgroundOpacity" label="Background Opacity" {...{ settings, onChange }} />
        <p className="field-note">Fades the whole landscape, including moving layers, without fading the reading or interface.</p>
        <div className="treatment-shortcuts" aria-label="Sketch Studies">
          <button type="button" className="panel-button" onClick={() => onChange("treatment", "ink-sepia")} aria-pressed={settings.treatment === "ink-sepia"}>Sepia Ink</button>
          <button type="button" className="panel-button" onClick={() => onChange("treatment", "graphite")} aria-pressed={settings.treatment === "graphite"}>Graphite</button>
        </div>
      </section>
      <section className="panel-section">
        <h3>Surface & Legibility</h3>
        <div className="panel-subsection">
          <h4>Reading View</h4>
        <Select field="veilMode" label="Veil Shape" {...{ settings, onChange }} />
        <p className="field-note">
          {settings.veilMode === "cloud" ? "A feathered cloud wraps the heading and reading content, growing with the text." : settings.veilMode === "message-clouds" ? "Separate feathered clouds hug each speaker and message." : settings.veilMode === "contour-clouds" ? "Soft halos follow individual wrapped lines without blurring the letters." : settings.veilMode === "window" ? "Fits the available reading window as you resize, including each A/B pane." : settings.veilMode === "messages" ? "A soft, beveled surface fits each message and its speaker label." : settings.veilMode === "contours" ? "The surface follows each wrapped line and reshapes as text reflows." : "A broad, feathered veil keeps the reading column quiet."}
        </p>
        <Slider
          field="readingOpacity"
          label="Reading Veil"
          {...{ settings, onChange }}
        />
        {(["messages", "contours", "cloud", "message-clouds", "contour-clouds"].includes(settings.veilMode)) && <Slider field="veilPadding" label="Veil Breathing Room" min={8} max={40} step={1} unit="px" {...{ settings, onChange }} />}
        {["window", "messages", "contours"].includes(settings.veilMode) && <Slider field="readingBevel" label="Reading Bevel Amount" max={2} {...{ settings, onChange }} />}
        </div>
        <div className="panel-subsection">
          <h4>Playback & Composer</h4>
        <Slider field="controlBevel" label="Playback & Composer Bevel Amount" max={2} {...{ settings, onChange }} />
        <Slider
          field="controlOpacity"
          label="Control Opacity"
          {...{ settings, onChange }}
        />
        </div>
        <div className="panel-subsection">
          <h4>Header & Footer</h4>
        <Select field="navbarSurface" label="Navbar Surface" {...{ settings, onChange }} />
        {settings.navbarSurface === "beveled" && <Slider field="navbarBevel" label="Navbar Bevel Amount" max={2} {...{ settings, onChange }} />}
        <Select field="footerSurface" label="Footer Surface" {...{ settings, onChange }} />
        {settings.footerSurface === "beveled" && <Slider field="footerBevel" label="Footer Bevel Amount" max={2} {...{ settings, onChange }} />}
        </div>
        <div className="panel-subsection">
          <h4>Shared Surface Effects</h4>
        <Slider
          field="blur"
          label="Glass Blur"
          min={0}
          max={30}
          step={1}
          unit="px"
          {...{ settings, onChange }}
        />
        <p className="field-note">Glass Blur affects translucent reading and playback surfaces. Bevel amounts adjust rounding and edge depth together; zero gives flat, square edges. Reading defaults to 40%.</p>
        </div>
      </section>
      <section className="panel-section">
        <h3>Typography</h3>
        <div className="type-pairings" aria-label="Font Sets">
          {TYPE_PRESETS.map(p => <button key={p.name} type="button" className="panel-button" aria-pressed={Object.entries(p.settings).every(([key, value]) => settings[key] === value)} onClick={() => onPreset(p)}><span>{p.name}</span><small>{p.detail}</small></button>)}
        </div>
        <p className="field-note">Sets combine app, reading and speaker fonts with size and line spacing. Your landscape, veil and alignment stay as chosen.</p>
        <Select field="appFont" label="App Font" {...{ settings, onChange }} />
        <p className="field-note">Buttons, headings and labels throughout the schematic app.</p>
        <Select field="readingFont" label="Reading Font" {...{ settings, onChange }} />
        <p className="field-note">The shared dialogue font, unless a speaker overrides it.</p>
        <Select field="humanFont" label="Human Font" {...{ settings, onChange }} />
        <Select field="machineFont" label="Machine Font" {...{ settings, onChange }} />
        <p className="field-note">Human: the Traveler or simulated human. Machine: the Companion or LLM.</p>
        <div className="type-specimen" aria-label="Selected Font Specimen">
          <div className="voice-specimen app-specimen"><small>App (Default)</small><p style={{fontFamily: fontFor(settings.appFont).family, fontWeight: fontFor(settings.appFont).weight, fontSize: `${24 * fontFor(settings.appFont).scale}px`}}>The Unwritten Road</p></div>
          {[["Reading", settings.readingFont, "Every journey begins with a possibility."], ["Human", settings.humanFont === "inherit" ? settings.readingFont : settings.humanFont, "Where might this road take us?"], ["Machine", settings.machineFont === "inherit" ? settings.readingFont : settings.machineFont, "Let us consider what lies ahead."]].map(([label, id, text]) => <div key={label} className="voice-specimen"><small>{label}</small><p style={{fontFamily: fontFor(id).family, fontWeight: fontFor(id).weight, fontSize: `${19 * fontFor(id).scale}px`}}>{text}</p></div>)}
        </div>
        <p className="field-note">{fontFor(settings.readingFont).note}</p>
        <Slider field="textScale" label="Reading Text Size" min={0.85} max={1.35} step={0.05} {...{ settings, onChange }} />
        <Slider field="lineHeight" label="Reading Line Spacing" min={1.35} max={2.1} step={0.05} unit="×" {...{ settings, onChange }} />
        {["contours", "contour-clouds"].includes(settings.veilMode) && <p className="field-note">Text-contour veils use at least 1.65× spacing to keep adjacent line surfaces apart.</p>}
        <a className="font-license-link" href="./font-licenses/index.html" target="_blank" rel="noreferrer">Font Credits & Licenses</a>
      </section>
      <section className="panel-section">
        <h3>Conversation Thread</h3>
        <Select field="replyLayout" label="Reply Actions" {...{ settings, onChange }} />
        <p className="field-note">Compare reply and original-continuation controls in the Reading state. Inline Original Link places the continuation beside the invitation. Drafts are never submitted or saved.</p>
        <Select field="roadmapLayout" label="Roadmap & Context" {...{ settings, onChange }} />
        <p className="field-note">Context lives in The Journey. Vertical Roadmap is hidden in compact layouts. Responsive Roadmap moves above the reading area with context links on hover, keyboard focus or tap. The sidebar study keeps context open, pushing the chat left on wide screens and stacking above it on phones.</p>
        <Select field="messageEdges" label="Message Edges" {...{ settings, onChange }} />
        <p className="field-note">Width limits cap each box. Outer insets move it inward from its aligned side. Defined Outer Edges adds a firm left or right boundary following text alignment; opposing alignments distinguish the voices.</p>
        <Slider field="messageWidth" label="Placed Message Width" min={0.55} max={1} step={0.01} {...{ settings, onChange }} />
        <p className="field-note">Placement moves the message. Alignment sets its text edges. Width applies to left, center and right placements; Full Width fills the column up to the speaker’s width limit.</p>
        <button type="button" className="panel-button" onClick={() => onPreset({name:"Opposing Voices", settings:{travelerPosition:"left", travelerAlign:"left", companionPosition:"right", companionAlign:"right"}})}>Traveler Left · Companion Right</button>
        {[["traveler", "Traveler"], ["companion", "Companion"]].map(([speaker, name]) => <fieldset className="speaker-settings" key={speaker}>
          <legend>{name}</legend>
          <Select field={`${speaker}Position`} label={`${name} Placement`} {...{ settings, onChange }} />
          <Select field={`${speaker}Align`} label={`${name} Text Alignment`} {...{ settings, onChange }} />
          <Select field={`${speaker}Label`} label={`${name} Name Placement`} {...{ settings, onChange }} />
          <Slider field={`${speaker}Width`} label={`${name} Width Limit`} min={.55} {...{ settings, onChange }} />
          <Slider field={`${speaker}Inset`} label={`${name} Outer Inset`} max={.2} {...{ settings, onChange }} />
        </fieldset>)}
      </section>
      <section className="panel-section animation-section" aria-label="Animation">
        <h3>Animation</h3>
        <div className="panel-subsection">
          <h4>Preview</h4>
        <p className="field-note">{!settings.animationsEnabled ? "Animation Off" : settings.paused ? "Paused" : reducedMotion ? "Reduced Motion · Still" : "Selected"}: {OPTIONS.motion.find(([id]) => id === settings.motion)?.[1]}</p>
        <label className="animation-switch"><input type="checkbox" checked={settings.animationsEnabled} onChange={e => onChange("animationsEnabled", e.target.checked)} /> Enable All Animation</label>
        <button type="button" className="panel-button" disabled={!settings.animationsEnabled} onClick={() => {
          onPreset({ name: "Brushstroke Preview", settings: { motion: "brush", intensity: .75, speed: 1, paused: false } });
          onClose();
        }}><Play size={14} /> Preview Living Brushstrokes</button>
        <p className="field-note">Shows stronger drawing and fading above the playback controls. Your scene, reading and veil stay unchanged. Fine-tune it below in Movement.{reducedMotion ? " Your system's reduced-motion preference keeps this preview still." : ""}</p>
        </div>
        <div className="panel-subsection">
          <h4>Movement</h4>
        <fieldset className="motion-settings" disabled={!settings.animationsEnabled}>
        <Select
          field="motion"
          label="Animation Layers"
          {...{ settings, onChange }}
        />
        {settings.motion !== "placeholder" && <Slider
          field="intensity"
          label="Intensity"
          {...{ settings, onChange }}
        />}
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
          disabled={!settings.animationsEnabled}
          onClick={() => onChange("paused", !settings.paused)}
          aria-pressed={settings.paused}
        >
          {settings.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
          {settings.paused ? "Resume Animation" : "Pause Animation"}
        </button>
        </fieldset>
        {reducedMotion && (
          <p className="field-note">
            Your reduced-motion preference is active. The landscape stays still.
          </p>
        )}
        <p className="field-note">
          Placeholder Text-Only keeps the landscape still and writes the empty reply prompts from left to right. Speed controls the writing cycle. Living Brushstrokes draws separate pigment and pencil strokes; other modes animate clouds, plants, sails or the traveler. Pause freezes movement. Animation Off and Still Landscape keep one static prompt.
        </p>
        </div>
        <div className="panel-subsection">
          <h4>Tools & Comparison</h4>
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
        </div>
      </section>
      <section className="panel-section">
        <h3>Saved Designs</h3>
        <div className="save-name-group">
          <label className="save-name">Naming Style<select aria-label="Naming Style" value={nameMode} onChange={e => setNameMode(e.target.value)}>
            <option value="modification">Starting Point Modification</option>
            <option value="version">Default Version</option>
            <option value="custom">Custom</option>
          </select></label>
          <label className="save-name">Configuration Name<input aria-label="Configuration Name" maxLength={80} readOnly={nameMode !== "custom"} value={proposedName} onChange={e => setSaveName(e.target.value)} /></label>
          <button type="button" className="panel-button" disabled={!proposedName.trim()} onClick={() => onSave(proposedName)}>Save Configuration</button>
        </div>
        <label className="save-name">Saved Configurations<select aria-label="Saved Configurations" value={loadName} onChange={e => setLoadName(e.target.value)}><option value="">Choose a Saved Design</option>{savedDesigns.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <button type="button" className="panel-button" disabled={!loadName} onClick={() => onLoad(loadName)}>Load Configuration</button>
        <p className="field-note">Saved in this browser on this device. Export a loaded design below to keep a portable copy. Existing names are never overwritten.</p>
        <p className="save-status">{status}</p>
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
