import React, { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Pause, Play, SlidersHorizontal, CircleOff } from "lucide-react";
import {
  DEFAULTS,
  PRESETS,
  STORAGE_KEY,
  loadSettings,
  parsePreset,
  serializePreset,
} from "./settings.mjs";
import { readSavedDesigns, saveDesign, quickNames, STARTING_POINT_KEY } from "./saved-designs.mjs";
import Landscape from "./Landscape.jsx";
import ControlPanel from "./ControlPanel.jsx";
import { fontFor, readingFontStyle } from "./typography.mjs";
import { AppHeader, PlaybackControls, SchematicContent } from "./Schematic.jsx";
const AnimationStudy = React.lazy(() => import("./AnimationStudy.jsx"));

function useMotionPolicy() {
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setHidden(document.hidden);
    const preference = () => setReduced(media.matches);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", preference);
    };
  }, []);
  return { hidden, reduced };
}
function Preview({ settings, policy, label }) {
  const humanFont = fontFor(settings.humanFont === "inherit" ? settings.readingFont : settings.humanFont);
  const stopped =
    !settings.animationsEnabled || settings.paused ||
    policy.hidden ||
    policy.reduced ||
    settings.motion === "none" || settings.motion === "placeholder";
  return (
    <section
      className={`preview-frame viewport-${settings.viewport} theme-${settings.theme} composition-${settings.composition} ${settings.density === "none" ? "landscape-only" : ""}`}
      aria-label={label ? `Design ${label}` : "Design Preview"}
      data-animations={settings.animationsEnabled ? "on" : "off"}
      data-placeholder-motion={!settings.animationsEnabled || policy.reduced || settings.motion === "none" ? "off" : settings.paused || policy.hidden ? "paused" : "play"}
      data-navbar-surface={settings.navbarSurface}
      data-footer-surface={settings.footerSurface}
      data-veil-mode={settings.veilMode}
      data-app-font={settings.appFont}
      data-reading-font={settings.readingFont}
      style={{
        ...readingFontStyle(settings.readingFont),
        "--app-font": fontFor(settings.appFont).family,
        "--app-weight": fontFor(settings.appFont).weight,
        "--app-scale": fontFor(settings.appFont).scale,
        "--human-font": humanFont.family,
        "--human-weight": humanFont.weight,
        "--human-scale": humanFont.scale,
        "--placeholder-duration": `${12 / settings.speed}s`,
        "--placeholder-step": `${4 / settings.speed}s`,
        "--heading-tracking": settings.appFont === "classic" ? "-.035em" : "0px",
        "--text-scale": settings.textScale,
        "--reading-leading": settings.lineHeight,
        "--reading-bevel": settings.readingBevel,
        "--navbar-bevel": settings.navbarBevel,
        "--footer-bevel": settings.footerBevel,
        "--control-bevel": settings.controlBevel,
        "--background-opacity": settings.backgroundOpacity,
        "--reading-alpha": settings.readingOpacity,
        "--control-alpha": settings.controlOpacity,
        "--glass-blur": `${settings.blur}px`,
      }}
    >
      {label && (
        <div className="compare-label">
          {label}
          {label === "A" ? " · Pinned Design" : " · Current Design"}
        </div>
      )}
      <div className="preview-canvas">
        <Landscape settings={settings} stopped={stopped} />
        {settings.density !== "none" && (
          <>
            <AppHeader />
            <div
              className="story-scroll"
              tabIndex={0}
              aria-label="Scrollable Schematic Story"
            >
              <SchematicContent settings={settings} />
            </div>
            <PlaybackControls showComposer={settings.schematic !== "reader" || settings.replyLayout === "buttons"} />
          </>
        )}
        <div className="scene-caption">
          {settings.density === "none"
            ? "Landscape Study · Original Generated Artwork"
            : ""}
        </div>
      </div>
    </section>
  );
}
export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [savedDesigns, setSavedDesigns] = useState(readSavedDesigns);
  const [startingPoint, setStartingPoint] = useState(() => {
    try { const name = localStorage.getItem(STARTING_POINT_KEY); return PRESETS.some(p => p.name === name) ? name : "Default"; } catch { return "Default"; }
  });
  useEffect(() => { try { localStorage.setItem(STARTING_POINT_KEY, startingPoint); } catch {} }, [startingPoint]);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [animationStudy, setAnimationStudy] = useState(false);
  const [status, setStatus] = useState("");
  const toggle = useRef(null);
  const policy = useMotionPolicy();
  const animationState = !settings.animationsEnabled ? "Off" : settings.paused ? "Pause" : "Play";
  const nextAnimationState = { Play: "Pause", Pause: "Off", Off: "Play" }[animationState];
  const cycleAnimation = () => setSettings(s => !s.animationsEnabled
    ? { ...s, animationsEnabled: true, paused: false }
    : s.paused ? { ...s, animationsEnabled: false, paused: false } : { ...s, paused: true });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializePreset(settings));
    } catch {
      setStatus(
        "Browser storage is unavailable. Export a preset to keep your settings.",
      );
    }
  }, [settings]);
  const close = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape" && open && !animationStudy) close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close, animationStudy]);
  useEffect(() => {
    if (open) document.querySelector("#design-controls button")?.focus();
  }, [open]);
  const change = (field, value) => {
    setSettings((s) => ({ ...s, [field]: value }));
    setStatus("");
  };
  const exportPreset = () => {
    const blob = new Blob([serializePreset(settings)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "la-machina-landscape-preset.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Preset exported. It contains design settings only.");
  };
  const importPreset = async (file) => {
    try {
      if (file.size > 65536)
        throw new Error("Choose a preset smaller than 64 KB.");
      setSettings(parsePreset(await file.text()));
      setStartingPoint("Default");
      setStatus("Preset imported successfully.");
    } catch (error) {
      setStatus(
        error instanceof SyntaxError
          ? "That file is not valid JSON."
          : error.message,
      );
    }
  };
  const keepDesign = (name) => {
    try {
      setSavedDesigns(saveDesign(savedDesigns, name, settings, startingPoint));
      setStatus(`Saved “${name.trim()}” on this device.`);
    } catch (error) {
      setStatus(error.name === "QuotaExceededError" || error.name === "SecurityError" ? "Browser storage is unavailable or full. Export this design to keep it." : error.message);
    }
  };
  const a = pinned
    ? {
        ...pinned,
        schematic: settings.schematic,
        density: settings.density,
        viewport: settings.viewport,
        paused: settings.paused,
        animationsEnabled: settings.animationsEnabled,
      }
    : null;
  return (
    <main
      className={`studio ${pinned ? "is-comparing" : ""} ${open ? "panel-open" : ""}`}
    >
      <div className="studio-toolbar">
        <span className="studio-title">
          Landscape Studio <span>Development Preview</span>
        </span>
        <div className="studio-toolbar-actions">
          <button
            type="button"
            className="toolbar-button animation-cycle"
            onClick={cycleAnimation}
            aria-label={`Animation: ${animationState}. Switch to ${nextAnimationState}`}
            title={`Play → Pause → Off. Next: ${nextAnimationState}`}
          >
            {animationState === "Off" ? <CircleOff size={14} /> : animationState === "Pause" ? <Pause size={14} /> : <Play size={14} />}
            <span>Animation · {animationState}</span>
          </button>
          <button
            type="button"
            className="toolbar-button compare-toggle"
            onClick={() => setPinned(pinned ? null : { ...settings })}
            aria-pressed={!!pinned}
          >
            <Columns2 size={14} />
            <span>{pinned ? "End Comparison" : "Compare"}</span>
          </button>
          <button
            type="button"
            className={`toolbar-button design-toggle ${open ? "active" : ""}`}
            ref={toggle}
            aria-expanded={open}
            aria-controls="design-controls"
            onClick={() => (open ? close() : setOpen(true))}
          >
            <SlidersHorizontal size={14} />
            <span>Design Controls</span>
          </button>
        </div>
      </div>
      <div className="preview-workspace">
        {a && <Preview settings={a} policy={policy} label="A" />}
        <Preview
          settings={settings}
          policy={policy}
          label={pinned ? "B" : null}
        />
      </div>
      {open && (
        <ControlPanel
          settings={settings}
          onChange={change}
          onClose={close}
          onPreset={(p) => {
            if (PRESETS.some(preset => preset.name === p.name)) setStartingPoint(p.name);
            setSettings((s) => ({ ...s, ...p.settings }));
            setStatus(
              `${p.name} applied. Other controls stay as chosen.`,
            );
          }}
          onReset={() => {
            setStartingPoint("Default");
            setSettings({ ...DEFAULTS });
            setPinned(null);
            setStatus("Restored the original landscape study.");
          }}
          onImport={importPreset}
          onExport={exportPreset}
          onCompare={() => setPinned(pinned ? null : { ...settings })}
          comparing={!!pinned}
          status={status}
          savedDesigns={savedDesigns}
          quickSaveNames={quickNames(savedDesigns, startingPoint)}
          onSave={keepDesign}
          onLoad={(name) => {
            const saved = savedDesigns.find(item => item.name === name);
            if (saved) { setSettings({ ...saved.settings }); setStartingPoint(saved.startingPoint); setStatus(`Loaded “${name}”.`); }
          }}
          reducedMotion={policy.reduced}
          onAnimationStudy={() => setAnimationStudy(true)}
        />
      )}
      <React.Suspense
        fallback={
          <div className="trial-loading" role="status">
            Loading Animation Study…
          </div>
        }
      >
        {animationStudy && (
          <AnimationStudy
            onClose={() => setAnimationStudy(false)}
            animationsEnabled={settings.animationsEnabled}
            paused={settings.paused}
            onTogglePause={() => { if (settings.animationsEnabled) change("paused", !settings.paused); }}
            policy={policy}
          />
        )}
      </React.Suspense>
    </main>
  );
}
