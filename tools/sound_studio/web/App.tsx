import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Square,
  Repeat2,
  Save,
  Sun,
  Moon,
  Plus,
  Copy,
  Trash2,
  Volume2,
  Cloud,
  Download,
} from "lucide-react";
import type {
  Capabilities,
  Sample,
  Project,
  Layer,
  Job,
  Feature,
  Recipe,
} from "./types";
import { newProject, newLayer, newEffect, uid } from "./types";
import { api, base, downloadJson, audioUrl } from "./api";
import { Button, Slider, NumberControl, Modal } from "./controls";
import { Wave } from "./Wave";
import { Inspector, AutomationEditor, TextTiming } from "./Inspector";
import { Generate } from "./Generate";
import { Library } from "./Library";
import { AudioEngine } from "./audio";

export default function App() {
  const [caps, setCaps] = useState<Capabilities | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project>(newProject),
    [jobs, setJobs] = useState<Job[]>([]),
    [features, setFeatures] = useState<Feature[]>([]),
    [tab, setTab] = useState("Compose"),
    [selected, setSelected] = useState(""),
    [notice, setNotice] = useState(""),
    [dark, setDark] = useState(
      localStorage.getItem("sound-appearance") === "dark",
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [sampleQuery, setSampleQuery] = useState("");
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [loop, setLoop] = useState(false),
    [dry, setDry] = useState(false),
    [level, setLevel] = useState({ input: -60, output: -60 }),
    [effectBatch, setEffectBatch] = useState(false),
    [batchValues, setBatchValues] = useState("0.1, 0.3, 0.6"),
    [batchParameter, setBatchParameter] = useState(""),
    [batchPlan, setBatchPlan] = useState<any>(null),
    [audition, setAudition] = useState<Sample | null>(null);
  const engine = useRef(new AudioEngine()),
    projectRef = useRef(project),
    samplesRef = useRef(samples),
    timeRef = useRef(time);
  projectRef.current = project;
  samplesRef.current = samples;
  timeRef.current = time;
  const restored = useRef(false);
  const notify = useCallback((s: string) => setNotice(s), []);
  const refresh = useCallback(() => {
    Promise.all([
      api<Sample[]>("/catalog/samples"),
      api<Project[]>("/catalog/projects"),
      api<Feature[]>("/catalog/features"),
      api<Job[]>("/catalog/jobs"),
    ])
      .then(([s, p, f, j]) => {
        setSamples(s);
        setProjects(p);
        setFeatures(f);
        setJobs(j);
        if (!restored.current) {
          restored.current = true;
          const last = p.find(
            (x) => x.id === localStorage.getItem("sound-project"),
          );
          if (last) {
            setProject(last);
            setSelected(last.recipe.layers[0]?.id || "");
          }
        }
      })
      .catch((e) => notify(e.message));
  }, [notify]);
  useEffect(() => {
    api<Capabilities>("/capabilities")
      .then(setCaps)
      .catch((e) => notify(e.message));
    refresh();
    const events = new EventSource(base + "/events");
    let previous = "";
    events.onmessage = (e) => {
      const value = JSON.parse(e.data);
      setJobs(value);
      const done = JSON.stringify(
        value.filter((j: Job) => j.status === "complete").map((j: Job) => j.id),
      );
      if (done !== previous) {
        previous = done;
        refresh();
      }
    };
    return () => {
      events.close();
      engine.current.stop();
    };
  }, [refresh]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const stop = useCallback(() => {
    engine.current.stop();
    setPlaying(false);
  }, []);
  const change = useCallback((p: Project) => {
    setProject(p);
    setDirty(true);
    engine.current.update(p.recipe);
  }, []);
  const updateLayer = (l: Layer) =>
    change({
      ...project,
      recipe: {
        ...project.recipe,
        layers: project.recipe.layers.map((x) => (x.id === l.id ? l : x)),
      },
    });
  const structure = JSON.stringify(
    project.recipe.layers.map((l) => [
      l.id,
      l.sample_id,
      l.offset,
      l.mute,
      l.solo,
      l.effects.map((e) => [e.id, e.kind, e.enabled]),
    ]),
  );
  useEffect(() => {
    if (engine.current.running) {
      stop();
      notify(
        "Layer routing changed. Press Play to audition the updated chain.",
      );
    }
  }, [structure]);
  const duration = Math.max(
    0,
    ...project.recipe.layers.map(
      (l) =>
        l.offset +
        ((samples.find((s) => s.id === l.sample_id)?.duration || 0) +
          project.recipe.tail) *
          l.effects
            .filter((e) => e.enabled && e.kind === "stretch")
            .reduce((r, e) => r * Number(e.params.ratio), 1),
    ),
  );
  const play = useCallback(
    async (position?: number, asDry?: boolean) => {
      try {
        setAudition(null);
        for (const l of projectRef.current.recipe.layers) {
          const s = samplesRef.current.find((s) => s.id === l.sample_id);
          for (const a of [
            ...l.automation,
            ...l.effects.flatMap((e) => e.automation),
          ])
            if (
              a.feature_track_id &&
              features.find((f) => f.id === a.feature_track_id)?.text_hash !==
                s?.text_hash
            )
              throw new Error(
                "Text feature mapping is stale. Analyze and map the current text before playback.",
              );
        }
        await engine.current.play(
          projectRef.current.recipe,
          samplesRef.current,
          position ?? timeRef.current,
          asDry ?? dry,
        );
        setPlaying(true);
        setNotice("");
      } catch (e) {
        engine.current.stop();
        setPlaying(false);
        notify((e as Error).message);
      }
    },
    [dry, notify, features],
  );
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const t = engine.current.time;
      setTime(t);
      setLevel(engine.current.levels);
      if (t >= duration) {
        stop();
        setTime(0);
        if (loop) void play(0);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [playing, duration, loop, play, stop]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        /INPUT|TEXTAREA|SELECT|BUTTON/.test(
          (e.target as HTMLElement).tagName,
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      e.preventDefault();
      if (engine.current.running) stop();
      else void play();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [play, stop]);
  const save = async () => {
    setBusy(true);
    try {
      const p = await api<Project>("/projects", "POST", project);
      setProject(p);
      localStorage.setItem("sound-project", p.id);
      setDirty(false);
      refresh();
      notify(`Saved revision ${p.revision}.`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const add = (s: Sample) => {
    stop();
    const l = newLayer(s);
    change({
      ...project,
      recipe: { ...project.recipe, layers: [...project.recipe.layers, l] },
    });
    setSelected(l.id);
    setTab("Compose");
    setNotice("");
  };
  const active =
    project.recipe.layers.find((l) => l.id === selected) ||
    project.recipe.layers[0];
  const sample = samples.find((s) => s.id === active?.sample_id);
  const job = async (operation: string, payload: unknown) => {
    setBusy(true);
    try {
      await api("/jobs", "POST", {
        operation,
        payload,
        project_id: project.revision ? project.id : null,
      });
      refresh();
      notify(
        `${operation === "render" ? "Render" : operation} queued. Its result will appear in the sample library and Batches.`,
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const preset = (kind: string) => {
    if (!active || !sample || !caps) return;
    stop();
    let layers = [...project.recipe.layers];
    const duration = sample.duration;
    if (kind === "unison") {
      const copies = [-0.12, 0.12].map((pitch, i) => ({
        ...structuredClone(active),
        id: uid(),
        name: `${active.name} · ${i ? "High" : "Low"} Double`,
        gain: -12,
        pan: i ? 0.4 : -0.4,
        effects: [
          {
            ...newEffect("pitch", caps.effects.pitch),
            params: { semitones: pitch, formant: 1 },
          },
          newEffect("chorus", caps.effects.chorus),
        ],
      }));
      layers.push(...copies);
    } else if (kind === "contrast") {
      const alt = samples.find(
        (s) => s.id !== sample.id && s.text_hash === sample.text_hash,
      );
      if (!alt)
        return notify(
          "Generate or import another reading of exactly the same text first.",
        );
      layers.push({ ...newLayer(alt), pan: 0.3, gain: -9 });
      notify(
        "Alternative reading added. Use Text Features And Timing to align both recordings, then render an aligned copy.",
      );
    } else {
      const effect = newEffect(
        kind === "spatial" ? "reverb" : "pitch",
        caps.effects[kind === "spatial" ? "reverb" : "pitch"],
      );
      effect.automation = [
        {
          parameter: kind === "spatial" ? "mix" : "semitones",
          interpolation: "linear",
          smoothing: 0.15,
          depth: 1,
          points:
            kind === "spatial"
              ? [
                  { time: 0, value: 0.05 },
                  { time: duration / 2, value: 0.5 },
                  { time: duration, value: 0.1 },
                ]
              : [
                  { time: 0, value: 0 },
                  { time: duration, value: 0 },
                ],
        },
      ];
      layers = layers.map((l) =>
        l.id === active.id ? { ...l, effects: [...l.effects, effect] } : l,
      );
      if (kind === "sentiment")
        notify(
          "Pitch lane added. Analyze and align the text, then use Map Text Feature to map sentiment to pitch.",
        );
    }
    change({ ...project, recipe: { ...project.recipe, layers } });
  };
  const previewEffectBatch = async () => {
    if (!active || !caps) return;
    try {
      const [id, key] = batchParameter.split(":");
      const vals = batchValues.split(",").map(Number);
      if (vals.some((v) => !Number.isFinite(v)))
        throw new Error("Supply numeric variation values.");
      const recipes = vals.map((v) => ({
        ...structuredClone(project.recipe),
        layers: project.recipe.layers.map((l) =>
          l.id === active.id
            ? {
                ...structuredClone(l),
                effects: l.effects.map((e) =>
                  e.id === id
                    ? {
                        ...structuredClone(e),
                        params: { ...e.params, [key]: v },
                      }
                    : e,
                ),
              }
            : structuredClone(l),
        ),
      }));
      const spec = {
        recipes,
        repeats: 1,
        max_jobs: 100,
        max_characters: 1,
        project_id: project.revision ? project.id : null,
      };
      setBatchPlan({ ...(await api("/batches/plan", "POST", spec)), spec });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  if (!caps)
    return (
      <main className="loading">
        <h1>Sound Studio</h1>
        <p role="status">{notice || "Opening the local audio workspace…"}</p>
      </main>
    );
  return (
    <main className="studio" data-theme={dark ? "dark" : "light"}>
      <header className="masthead">
        <div className="brand">
          <h1>Sound Studio</h1>
          <span>Man of La Machina</span>
        </div>
        <nav aria-label="Studio Sections">
          {["Compose", "Generate", "Library", "Batches"].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Batches" &&
              jobs.some((j) => j.status === "running" || j.status === "queued")
                ? " · " +
                  jobs.filter((j) => ["running", "queued"].includes(j.status))
                    .length
                : ""}
            </button>
          ))}
        </nav>
        <div className="project-tools">
          <input
            aria-label="Project Name"
            value={project.name}
            onChange={(e) => change({ ...project, name: e.target.value })}
          />
          <Button
            title={dirty ? "Save Project (Unsaved Changes)" : "Save Project"}
            disabled={busy}
            onClick={save}
          >
            <Save size={17} />
            <span>{dirty ? "Save *" : "Save"}</span>
          </Button>
          <Button
            title={dark ? "Light Appearance" : "Dark Appearance"}
            onClick={() => {
              setDark(!dark);
              localStorage.setItem("sound-appearance", dark ? "light" : "dark");
            }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss Notice" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      <div className="workspace-toolbar">
        <div className="actions">
          <label className="inline-label">
            Project
            <select
              aria-label="Load Project"
              value={project.revision ? project.id : ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value);
                if (p) {
                  if (
                    dirty &&
                    !window.confirm(
                      "Discard unsaved project edits and load this project?",
                    )
                  )
                    return;
                  stop();
                  setProject(structuredClone(p));
                  localStorage.setItem("sound-project", p.id);
                  setSelected(p.recipe.layers[0]?.id || "");
                  setDirty(false);
                  setTime(0);
                }
              }}
            >
              <option value="">Unsaved Study</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · r{p.revision}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved project edits?"))
                return;
              stop();
              setProject(newProject());
              setDirty(false);
              setTime(0);
            }}
          >
            New
          </Button>
          <Button
            title="Export Project Recipe"
            onClick={() => downloadJson(project, "sound-studio-project.json")}
          >
            <Download size={14} />
          </Button>
          <label className="file-button">
            Import Recipe
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const p = JSON.parse(await f.text());
                  p.id = uid();
                  p.revision = 0;
                  const saved = await api<Project>("/projects", "POST", p);
                  stop();
                  setProject(saved);
                  setDirty(false);
                  refresh();
                } catch (err) {
                  notify((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <label className="inline-label">
          <input
            type="checkbox"
            checked={project.auto_upload}
            disabled={!caps.remote}
            onChange={(e) =>
              change({ ...project, auto_upload: e.target.checked })
            }
          />
          <Cloud size={14} /> Upload Saved Project Automatically
        </label>
      </div>
      {tab === "Compose" && (
        <div className="compose-layout">
          <aside className="panel samples-rail">
            <div className="section-head">
              <h2>Samples</h2>
              <Button
                title="Generate Or Import Audio"
                onClick={() => setTab("Generate")}
              >
                <Plus size={18} />
              </Button>
            </div>
            <input
              aria-label="Filter Layer Samples"
              placeholder="Search samples…"
              value={sampleQuery}
              onChange={(e) => setSampleQuery(e.target.value)}
            />
            <div className="sample-list">
              {samples
                .filter((s) =>
                  s.title.toLowerCase().includes(sampleQuery.toLowerCase()),
                )
                .map((s, i) => (
                  <div className="sample-row" key={s.id}>
                    <svg
                      viewBox="0 0 50 50"
                      aria-hidden="true"
                      style={{
                        color: ["var(--accent)", "var(--olive)", "#687681"][
                          i % 3
                        ],
                      }}
                    >
                      {Array.from({ length: 16 }, (_, n) => (
                        <line
                          key={n}
                          x1={n * 3 + 1}
                          x2={n * 3 + 1}
                          y1={
                            25 -
                            (s.peaks[Math.floor((n * s.peaks.length) / 16)] ||
                              0) *
                              35
                          }
                          y2={
                            25 +
                            (s.peaks[Math.floor((n * s.peaks.length) / 16)] ||
                              0) *
                              35
                          }
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {s.duration.toFixed(1)} s{!s.local ? " · Remote" : ""}
                      </small>
                      <Button disabled={!s.local} onClick={() => add(s)}>
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
            {!samples.length && (
              <p className="empty reading">
                Generate a voice or import a recording to begin.
              </p>
            )}
            <Button onClick={() => setTab("Library")}>
              Open Sample Library
            </Button>
          </aside>
          <section className="panel timeline">
            <div className="section-head">
              <h2>Voice Layers</h2>
              <span className="muted">
                {project.recipe.layers.length} layers ·{" "}
                {dry ? "Original Audio" : "Effect Preview"}
              </span>
            </div>
            <div className="timeline-ruler">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i}>{((duration * i) / 5).toFixed(1)} s</span>
              ))}
            </div>
            {!project.recipe.layers.length && (
              <div className="empty-timeline">
                <Volume2 size={40} />
                <h2>Begin With A Voice</h2>
                <p className="reading">
                  Choose a recording from the library, or generate a reading of
                  any passage. Layer it, reshape it, and follow how the sound
                  changes.
                </p>
                <div className="actions">
                  <Button
                    className="primary"
                    onClick={() => setTab("Generate")}
                  >
                    Generate Narration
                  </Button>
                  <Button onClick={() => setTab("Library")}>
                    Import Audio
                  </Button>
                </div>
              </div>
            )}
            {project.recipe.layers.map((l, i) => {
              const s = samples.find((s) => s.id === l.sample_id);
              return (
                <article
                  key={l.id}
                  className={`voice-layer ${active?.id === l.id ? "selected" : ""}`}
                  onClick={() => setSelected(l.id)}
                >
                  <div className="layer-heading">
                    <input
                      aria-label={`Layer ${i + 1} Name`}
                      value={l.name}
                      onChange={(e) =>
                        updateLayer({ ...l, name: e.target.value })
                      }
                    />
                    <div className="actions">
                      <button
                        aria-label={`Mute Layer ${i + 1}`}
                        aria-pressed={l.mute}
                        onClick={() => updateLayer({ ...l, mute: !l.mute })}
                      >
                        M
                      </button>
                      <button
                        aria-label={`Solo Layer ${i + 1}`}
                        aria-pressed={l.solo}
                        onClick={() => updateLayer({ ...l, solo: !l.solo })}
                      >
                        S
                      </button>
                      <Button
                        title="Duplicate Layer"
                        onClick={() => {
                          const copy = {
                            ...structuredClone(l),
                            id: uid(),
                            name: l.name + " · Double",
                            effects: l.effects.map((e) => ({
                              ...structuredClone(e),
                              id: uid(),
                            })),
                          };
                          change({
                            ...project,
                            recipe: {
                              ...project.recipe,
                              layers: [...project.recipe.layers, copy],
                            },
                          });
                        }}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        title="Remove Layer"
                        onClick={() =>
                          change({
                            ...project,
                            recipe: {
                              ...project.recipe,
                              layers: project.recipe.layers.filter(
                                (x) => x.id !== l.id,
                              ),
                            },
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  {s ? (
                    <div
                      style={{
                        marginLeft: `${(l.offset / duration) * 100}%`,
                        width: `${Math.min(100, (s.duration / duration) * 100)}%`,
                      }}
                    >
                      <Wave
                        sample={s}
                        time={time - l.offset}
                        color={["#9a5961", "#7e8466", "#687681"][i % 3]}
                        onSeek={(t) => {
                          stop();
                          setTime(t + l.offset);
                        }}
                      />
                    </div>
                  ) : (
                    <p>
                      Sample metadata is missing. Restore this project’s
                      recordings.
                    </p>
                  )}
                  <div className="effect-regions">
                    {l.effects
                      .filter((e) => e.enabled)
                      .map((e) => (
                        <span
                          key={e.id}
                          style={{
                            opacity:
                              time - l.offset >= e.start &&
                              (e.end === null || time - l.offset < e.end)
                                ? 1
                                : 0.55,
                          }}
                          title={`${e.start}s to ${e.end ?? "end"}; ${e.automation.length} automation lanes`}
                        >
                          {caps.effects[e.kind]?.name}
                          {e.automation.length ? " ↝" : ""}
                        </span>
                      ))}
                  </div>
                  {active?.id === l.id && (
                    <details className="layer-settings">
                      <summary>Gain, Pan And Timing</summary>
                      <div className="layer-mix">
                        <Slider
                          label="Layer Gain"
                          value={l.gain}
                          min={-60}
                          max={12}
                          step={0.1}
                          unit="dB"
                          onChange={(v) => updateLayer({ ...l, gain: v })}
                        />
                        <Slider
                          label="Stereo Pan"
                          value={l.pan}
                          min={-1}
                          max={1}
                          onChange={(v) => updateLayer({ ...l, pan: v })}
                        />
                        <NumberControl
                          label="Offset"
                          value={l.offset}
                          min={0}
                          unit="s"
                          onChange={(v) => updateLayer({ ...l, offset: v })}
                        />
                        <NumberControl
                          label="Fade In"
                          value={l.fade_in}
                          min={0}
                          max={300}
                          step={0.01}
                          onChange={(v) => updateLayer({ ...l, fade_in: v })}
                        />
                        <NumberControl
                          label="Fade Out"
                          value={l.fade_out}
                          min={0}
                          max={300}
                          step={0.01}
                          onChange={(v) => updateLayer({ ...l, fade_out: v })}
                        />
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
            {active && sample && (
              <>
                <details className="starting-recipes">
                  <summary>Starting Recipes</summary>
                  <div className="actions">
                    <Button onClick={() => preset("unison")}>
                      Detuned Unison
                    </Button>
                    <Button onClick={() => preset("contrast")}>
                      Contrasting Readings
                    </Button>
                    <Button onClick={() => preset("spatial")}>
                      Evolving Space
                    </Button>
                    <Button onClick={() => preset("sentiment")}>
                      Text-Driven Pitch
                    </Button>
                  </div>
                </details>
                <AutomationEditor
                  key={active.id}
                  layer={active}
                  sample={sample}
                  definitions={caps.effects}
                  onChange={updateLayer}
                  notify={notify}
                  features={features}
                />
                <TextTiming
                  key={sample.id}
                  sample={sample}
                  samples={samples}
                  caps={caps}
                  features={features}
                  notify={notify}
                  refresh={refresh}
                />
                <Button
                  onClick={() => {
                    const fx = active.effects[0];
                    if (!fx)
                      return notify(
                        "Add an effect before creating an effect sweep.",
                      );
                    setBatchParameter(
                      fx.id +
                        ":" +
                        Object.keys(caps.effects[fx.kind].params)[0],
                    );
                    setEffectBatch(true);
                  }}
                >
                  Batch Effect Variations
                </Button>
              </>
            )}
          </section>
          <Inspector
            layer={active}
            definitions={caps.effects}
            samples={samples}
            onChange={updateLayer}
            time={time}
          />
        </div>
      )}
      {tab === "Generate" && (
        <Generate
          caps={caps}
          project={project}
          notify={notify}
          refresh={refresh}
        />
      )}
      {tab === "Library" && (
        <Library
          samples={samples}
          onAdd={add}
          refresh={refresh}
          notify={notify}
          remote={caps.remote}
          stop={stop}
        />
      )}
      {tab === "Batches" && (
        <section className="panel batches">
          <h2>Jobs And Batches</h2>
          <p>
            Pause stops pending jobs; the current provider request may finish.
            Cancelled or interrupted calls can still incur charges. Retry
            explicitly to keep completed chunks and attempt the remaining work.
          </p>
          <div className="actions">
            {["pause", "resume", "cancel", "retry"].map((action) => (
              <Button
                key={action}
                onClick={async () => {
                  const ids = [
                    ...new Set(jobs.map((j) => j.batch_id).filter(Boolean)),
                  ];
                  try {
                    for (const id of ids)
                      await api(`/batches/${id}/${action}`, "POST");
                    refresh();
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                {action[0].toUpperCase() + action.slice(1)} Batches
              </Button>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Result / Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      {j.operation}
                      <small>{j.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      {j.status}
                      {j.error && <p className="error">{j.error}</p>}
                    </td>
                    <td>
                      <progress value={j.progress} max={1} />
                    </td>
                    <td>
                      <div className="actions">
                        {j.result?.kind === "samples" &&
                          samples.find((s) => s.id === j.result?.id) && (
                            <>
                              <Button
                                onClick={() =>
                                  add(
                                    samples.find((s) => s.id === j.result?.id)!,
                                  )
                                }
                              >
                                Add Result
                              </Button>
                              <Button
                                onClick={() => {
                                  stop();
                                  setAudition(
                                    samples.find((s) => s.id === j.result?.id)!,
                                  );
                                }}
                              >
                                Listen
                              </Button>
                            </>
                          )}
                        {(j.status === "queued"
                          ? ["pause", "cancel"]
                          : j.status === "paused"
                            ? ["resume", "cancel"]
                            : j.status === "running"
                              ? ["cancel"]
                              : ["failed", "interrupted", "cancelled"].includes(
                                    j.status,
                                  )
                                ? ["retry"]
                                : []
                        ).map((action) => (
                          <Button
                            key={action}
                            onClick={async () => {
                              try {
                                await api(`/jobs/${j.id}/${action}`, "POST");
                                refresh();
                              } catch (e) {
                                notify((e as Error).message);
                              }
                            }}
                          >
                            {action}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!jobs.length && (
              <p className="empty">
                No jobs yet. Generation, rendering, alignment, and transfers
                appear here.
              </p>
            )}
          </div>
        </section>
      )}
      <footer className="transport">
        <div className="transport-buttons">
          <Button
            title={playing ? "Pause Playback" : "Play Layers"}
            className="primary"
            disabled={!project.recipe.layers.length}
            onClick={() => (playing ? stop() : void play())}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </Button>
          <Button
            title="Stop And Rewind"
            onClick={() => {
              stop();
              setTime(0);
            }}
          >
            <Square size={20} />
          </Button>
          <button
            title="Loop Playback"
            aria-label="Loop Playback"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            <Repeat2 size={20} />
          </button>
        </div>
        <div className="position">
          <span>
            {time.toFixed(1)} / {duration.toFixed(1)} s
          </span>
          <input
            aria-label="Playback Position"
            type="range"
            min={0}
            max={duration}
            step=".01"
            value={Math.min(time, duration)}
            onChange={(e) => {
              stop();
              setTime(+e.target.value);
            }}
          />
        </div>
        <div className="meters">
          <label>
            Pre-Limiter
            <meter min={-60} max={0} value={level.input} />
          </label>
          <label>
            Output
            <meter min={-60} max={0} value={level.output} />
          </label>
        </div>
        <label className="inline-label">
          <input
            type="checkbox"
            checked={dry}
            onChange={(e) => {
              const value = e.target.checked;
              setDry(value);
              if (playing) void play(time, value);
            }}
          />{" "}
          Dry
        </label>
        <label className="inline-label">
          Master
          <input
            aria-label="Master Gain"
            type="number"
            min="-60"
            max="6"
            step="1"
            style={{ width: 50 }}
            value={project.recipe.master_gain}
            onChange={(e) =>
              change({
                ...project,
                recipe: { ...project.recipe, master_gain: +e.target.value },
              })
            }
          />{" "}
          dB
        </label>
        <label className="inline-label">
          Tail
          <input
            aria-label="Effect Tail"
            type="number"
            min="0"
            max="30"
            step=".5"
            style={{ width: 50 }}
            value={project.recipe.tail}
            onChange={(e) =>
              change({
                ...project,
                recipe: { ...project.recipe, tail: +e.target.value },
              })
            }
          />{" "}
          s
        </label>
        <label className="inline-label">
          <input
            type="checkbox"
            checked={project.recipe.limiter}
            onChange={(e) => {
              stop();
              change({
                ...project,
                recipe: { ...project.recipe, limiter: e.target.checked },
              });
            }}
          />{" "}
          Limiter
        </label>
        <Button
          className="primary"
          disabled={busy || !project.recipe.layers.length}
          onClick={() => job("render", { recipe: project.recipe })}
        >
          Render Mix
        </Button>
      </footer>
      {effectBatch && active && (
        <Modal
          title="Effect-Only Batch"
          onClose={() => {
            setEffectBatch(false);
            setBatchPlan(null);
          }}
        >
          <p>
            Render variations from the same saved audio. No speech-provider
            requests are made.
          </p>
          <label>
            Parameter
            <select
              value={batchParameter}
              onChange={(e) => setBatchParameter(e.target.value)}
            >
              {active.effects.flatMap((e) =>
                Object.entries(caps.effects[e.kind].params).map(([k, p]) => (
                  <option key={e.id + k} value={e.id + ":" + k}>
                    {caps.effects[e.kind].name} · {p.label}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            Values
            <input
              value={batchValues}
              onChange={(e) => setBatchValues(e.target.value)}
            />
          </label>
          <Button onClick={previewEffectBatch}>Preview Variations</Button>
          {batchPlan && (
            <>
              <p>{batchPlan.jobs.length} render jobs · 0 speech requests</p>
              <Button
                className="primary"
                onClick={async () => {
                  try {
                    await api("/batches", "POST", batchPlan.spec);
                    setEffectBatch(false);
                    setBatchPlan(null);
                    refresh();
                    setTab("Batches");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Start Effect Batch
              </Button>
            </>
          )}
        </Modal>
      )}
      {audition && (
        <Modal title={audition.title} onClose={() => setAudition(null)}>
          <audio autoPlay controls src={audioUrl(audition.id)} />
          <p>
            Saved audio · {audition.duration.toFixed(2)} s · {audition.peak_db}{" "}
            dBFS peak
          </p>
          <Button
            onClick={() => {
              add(audition);
              setAudition(null);
            }}
          >
            Add To Timeline
          </Button>
        </Modal>
      )}
    </main>
  );
}
