import React, { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Pause, Play, SlidersHorizontal } from "lucide-react";
import {
  DEFAULTS,
  STORAGE_KEY,
  loadSettings,
  parsePreset,
  serializePreset,
} from "./settings.mjs";
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
  const stopped =
    settings.paused ||
    policy.hidden ||
    policy.reduced ||
    settings.motion === "none";
  return (
    <section
      className={`preview-frame viewport-${settings.viewport} theme-${settings.theme} composition-${settings.composition} ${settings.density === "none" ? "landscape-only" : ""}`}
      aria-label={label ? `Design ${label}` : "Design Preview"}
      data-app-font={settings.appFont}
      data-reading-font={settings.readingFont}
      style={{
        ...readingFontStyle(settings.readingFont),
        "--app-font": fontFor(settings.appFont).family,
        "--app-weight": fontFor(settings.appFont).weight,
        "--app-scale": fontFor(settings.appFont).scale,
        "--heading-tracking": settings.appFont === "classic" ? "-.035em" : "0px",
        "--text-scale": settings.textScale,
        "--reading-leading": settings.lineHeight,
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
            <PlaybackControls />
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
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [animationStudy, setAnimationStudy] = useState(false);
  const [status, setStatus] = useState("");
  const toggle = useRef(null);
  const policy = useMotionPolicy();
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
      setStatus("Preset imported successfully.");
    } catch (error) {
      setStatus(
        error instanceof SyntaxError
          ? "That file is not valid JSON."
          : error.message,
      );
    }
  };
  const a = pinned
    ? {
        ...pinned,
        schematic: settings.schematic,
        density: settings.density,
        viewport: settings.viewport,
        paused: settings.paused,
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
            className="toolbar-button"
            onClick={() => change("paused", !settings.paused)}
            aria-label={
              settings.paused ? "Resume All Animation" : "Pause All Animation"
            }
            aria-pressed={settings.paused}
          >
            {settings.paused ? <Play size={14} /> : <Pause size={14} />}
            <span>{settings.paused ? "Resume" : "Pause"}</span>
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
            setSettings((s) => ({ ...s, ...p.settings }));
            setStatus(
              `${p.name} applied. Your scene, layout and palette are preserved.`,
            );
          }}
          onReset={() => {
            setSettings({ ...DEFAULTS });
            setPinned(null);
            setStatus("Restored the original landscape study.");
          }}
          onImport={importPreset}
          onExport={exportPreset}
          onCompare={() => setPinned(pinned ? null : { ...settings })}
          comparing={!!pinned}
          status={status}
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
            paused={settings.paused}
            onTogglePause={() => change("paused", !settings.paused)}
            policy={policy}
          />
        )}
      </React.Suspense>
    </main>
  );
}
