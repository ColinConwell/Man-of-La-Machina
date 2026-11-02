import { useState, useEffect } from "react";
import { Plus, Trash2, HelpCircle, ArrowUp, ArrowDown } from "lucide-react";
import type {
  Layer,
  Effect,
  EffectDef,
  Sample,
  Lane,
  Feature,
  Capabilities,
} from "./types";
import { newEffect } from "./types";
import {
  Button,
  Slider,
  NumberControl,
  EffectHelp,
  Modal,
  Mechanism,
} from "./controls";
import { api, downloadJson } from "./api";
import { valueAt } from "./audio";

export function Inspector({
  layer,
  definitions,
  samples,
  onChange,
  time,
}: {
  layer: Layer | undefined;
  definitions: Record<string, EffectDef>;
  samples: Sample[];
  onChange: (l: Layer) => void;
  time: number;
}) {
  const [kind, setKind] = useState("chorus"),
    [help, setHelp] = useState<string | null>(null);
  if (!layer)
    return (
      <aside className="panel inspector">
        <h2>Effect Rack</h2>
        <p className="empty reading">
          Add a recording to Voice Layers, then select it to shape its sound.
        </p>
        <Mechanism kind="chorus" />
        <p className="muted">
          Every effect includes a mechanism explanation and a bypass control.
        </p>
      </aside>
    );
  const edit = (index: number, e: Effect) =>
    onChange({
      ...layer,
      effects: layer.effects.map((x, i) => (i === index ? e : x)),
    });
  return (
    <aside className="panel inspector">
      <div className="section-head">
        <h2>Effect Rack</h2>
        <small>{layer.effects.length} effects</small>
      </div>
      <p className="muted selected-name">{layer.name}</p>
      <div className="actions">
        <select
          aria-label="Choose Effect"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {Object.entries(definitions).map(([k, d]) => (
            <option key={k} value={k}>
              {d.name}
            </option>
          ))}
        </select>
        <Button
          title="Add Effect"
          onClick={() =>
            onChange({
              ...layer,
              effects: [...layer.effects, newEffect(kind, definitions[kind])],
            })
          }
        >
          <Plus size={17} />
        </Button>
      </div>
      {layer.effects.map((e, i) => {
        const def = definitions[e.kind],
          active =
            e.enabled &&
            time - layer.offset >= e.start &&
            (e.end === null || time - layer.offset < e.end);
        return (
          <section
            className={`effect ${active ? "effect-active" : ""}`}
            key={e.id}
          >
            <div className="section-head">
              <label className="effect-toggle">
                <input
                  type="checkbox"
                  checked={e.enabled}
                  onChange={(v) => edit(i, { ...e, enabled: v.target.checked })}
                />
                <h3>{def.name}</h3>
              </label>
              <Button
                title={`Explain ${def.name}`}
                onClick={() => setHelp(e.kind)}
              >
                <HelpCircle size={17} />
              </Button>
            </div>
            <small>
              {def.live ? "Live Preview + Render" : "Render Required"} ·{" "}
              {e.start.toFixed(1)}–{e.end?.toFixed(1) ?? "end"} s
            </small>
            {Object.entries(def.params).map(([key, p]) => (
              <Slider
                key={key}
                label={p.label}
                value={Number(e.params[key] ?? p.default)}
                min={p.min}
                max={p.max}
                step={p.step}
                unit={p.unit}
                onChange={(v) =>
                  edit(i, { ...e, params: { ...e.params, [key]: v } })
                }
              />
            ))}
            {e.kind === "convolution" && (
              <label>
                Impulse Response
                <select
                  value={String(e.params.impulse_id || "")}
                  onChange={(v) =>
                    edit(i, {
                      ...e,
                      params: { ...e.params, impulse_id: v.target.value },
                    })
                  }
                >
                  <option value="">Choose Imported Audio</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {e.automation.map((a) => (
              <small className="automation-origin" key={a.parameter}>
                {a.parameter} ← {a.feature || "Manual Curve"} ·{" "}
                {a.points.length} anchors · now{" "}
                {valueAt(
                  a,
                  Math.max(0, time - layer.offset),
                  Number(
                    e.params[a.parameter] ?? def.params[a.parameter].default,
                  ),
                ).toFixed(2)}{" "}
                {def.params[a.parameter].unit}
              </small>
            ))}
            <details>
              <summary>Timing And Order</summary>
              <div className="two">
                <NumberControl
                  label="Start"
                  value={e.start}
                  min={0}
                  max={86400}
                  onChange={(v) => edit(i, { ...e, start: v })}
                />
                <label>
                  End (Blank = Entire Clip)
                  <input
                    type="number"
                    min={e.start + 0.01}
                    step=".1"
                    value={e.end ?? ""}
                    onChange={(v) =>
                      edit(i, {
                        ...e,
                        end: v.target.value === "" ? null : +v.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="actions">
                <Button
                  title="Move Effect Earlier"
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...layer.effects];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    onChange({ ...layer, effects: a });
                  }}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  title="Move Effect Later"
                  disabled={i === layer.effects.length - 1}
                  onClick={() => {
                    const a = [...layer.effects];
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    onChange({ ...layer, effects: a });
                  }}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  title="Remove Effect"
                  onClick={() =>
                    onChange({
                      ...layer,
                      effects: layer.effects.filter((_, n) => n !== i),
                    })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </details>
          </section>
        );
      })}
      {!layer.effects.length && (
        <p className="empty reading">
          Start with a subtle chorus, a shifting pitch, or an evolving room.
        </p>
      )}
      {layer.effects.length > 0 && (
        <section className="explanation">
          <h3>How It Works</h3>
          <Mechanism kind={layer.effects[0].kind} />
          <p className="reading">
            {definitions[layer.effects[0].kind].explanation}
          </p>
        </section>
      )}
      {help && (
        <EffectHelp
          kind={help}
          definition={definitions[help]}
          onClose={() => setHelp(null)}
        />
      )}
    </aside>
  );
}

export function AutomationEditor({
  layer,
  sample,
  definitions,
  onChange,
  notify,
  features,
}: {
  layer: Layer;
  sample: Sample;
  definitions: Record<string, EffectDef>;
  onChange: (l: Layer) => void;
  notify: (s: string) => void;
  features: Feature[];
}) {
  const [target, setTarget] = useState("layer"),
    [parameter, setParameter] = useState("gain"),
    [mapping, setMapping] = useState(false),
    [trackId, setTrackId] = useState(""),
    [feature, setFeature] = useState("sentiment"),
    [lower, setLower] = useState(-12),
    [upper, setUpper] = useState(0),
    [invert, setInvert] = useState(false),
    [busy, setBusy] = useState(false);
  const effect = layer.effects.find((e) => e.id === target);
  const params = effect
    ? definitions[effect.kind].params
    : {
        gain: {
          label: "Layer Gain",
          min: -60,
          max: 12,
          default: layer.gain,
          unit: "dB",
          step: 0.1,
        },
        pan: {
          label: "Stereo Pan",
          min: -1,
          max: 1,
          default: layer.pan,
          unit: "",
          step: 0.01,
        },
      };
  const param = params[parameter] || Object.values(params)[0];
  const paramKey = params[parameter] ? parameter : Object.keys(params)[0];
  const lane =
    (effect ? effect.automation : layer.automation).find(
      (a) => a.parameter === paramKey,
    ) ||
    ({
      parameter: paramKey,
      points: [],
      interpolation: "linear",
      smoothing: 0.04,
      depth: 1,
    } as Lane);
  const duration = Math.max(sample.duration, 1);
  const save = (a: Lane) => {
    const update = (lanes: Lane[]) => [
      ...lanes.filter((l) => l.parameter !== paramKey),
      a,
    ];
    onChange(
      effect
        ? {
            ...layer,
            effects: layer.effects.map((e) =>
              e.id === effect.id
                ? { ...e, automation: update(e.automation) }
                : e,
            ),
          }
        : { ...layer, automation: update(layer.automation) },
    );
  };
  const setPoints = (points: Lane["points"]) => {
    const unique = new Map(points.map((p) => [p.time, p]));
    save({
      ...lane,
      points: [...unique.values()].sort((a, b) => a.time - b.time),
      feature: undefined,
      feature_track_id: undefined,
    });
  };
  const matching = features.filter((f) => f.text_hash === sample.text_hash);
  const track = matching.find((f) => f.id === trackId) || matching[0];
  const path = lane.points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${(Math.min(duration, p.time) / duration) * 900} ${150 - ((p.value - param.min) / (param.max - param.min)) * 140}`,
    )
    .join(" ");
  return (
    <section className="automation-panel">
      <div className="section-head">
        <h2>Automation</h2>
        <Button
          onClick={() => {
            setLower(param.min);
            setUpper(param.max);
            setMapping(true);
          }}
          disabled={!matching.length}
        >
          Map Text Feature
        </Button>
      </div>
      <div className="actions">
        <select
          aria-label="Automation Target"
          value={effect ? target : "layer"}
          onChange={(e) => {
            setTarget(e.target.value);
            const fx = layer.effects.find((x) => x.id === e.target.value);
            setParameter(
              fx ? Object.keys(definitions[fx.kind].params)[0] : "gain",
            );
          }}
        >
          <option value="layer">Layer</option>
          {layer.effects
            .filter((e) => !["stretch", "convolution"].includes(e.kind))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {definitions[e.kind].name}
              </option>
            ))}
        </select>
        <select
          aria-label="Automated Parameter"
          value={paramKey}
          onChange={(e) => setParameter(e.target.value)}
        >
          {Object.entries(params)
            .filter(([k]) => k !== "formant")
            .map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
        </select>
        <select
          aria-label="Curve Interpolation"
          value={lane.interpolation}
          onChange={(e) =>
            save({
              ...lane,
              interpolation: e.target.value as Lane["interpolation"],
            })
          }
        >
          <option value="linear">Linear</option>
          <option value="step">Step</option>
        </select>
      </div>
      <small>
        {lane.feature
          ? `${lane.feature} → ${param.label}`
          : "Click the curve area to add a point, or use the accessible point controls below."}{" "}
        · {param.min}–{param.max} {param.unit}
      </small>
      <svg
        className="automation-chart"
        viewBox="0 0 900 170"
        role="img"
        aria-label={`${param.label} automation curve`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const time = Math.max(
            0,
            Math.min(duration, ((e.clientX - r.left) / r.width) * duration),
          );
          const value =
            param.min +
            Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) *
              (param.max - param.min);
          setPoints([
            ...lane.points,
            { time: +time.toFixed(2), value: +value.toFixed(3) },
          ]);
        }}
      >
        <defs>
          <pattern
            id="grid"
            width="90"
            height="35"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M90 0H0V35"
              fill="none"
              stroke="currentColor"
              opacity=".12"
            />
          </pattern>
        </defs>
        <rect width="900" height="160" fill="url(#grid)" />
        <path d={path} stroke="var(--accent)" strokeWidth="2.5" fill="none" />
        {lane.points.map((p, i) => (
          <circle
            key={i}
            cx={(Math.min(duration, p.time) / duration) * 900}
            cy={150 - ((p.value - param.min) / (param.max - param.min)) * 140}
            r="4"
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="section-head">
        <small>0 s</small>
        <small>{duration.toFixed(1)} s · layer time</small>
      </div>
      <div className="two">
        <Slider
          label="Modulation Depth"
          value={lane.depth}
          min={0}
          max={1}
          onChange={(v) => save({ ...lane, depth: v })}
        />
        <NumberControl
          label="Smoothing"
          value={lane.smoothing}
          min={0}
          max={10}
          step={0.01}
          unit="s"
          onChange={(v) => save({ ...lane, smoothing: v })}
        />
      </div>
      <details>
        <summary>Edit Curve Points ({lane.points.length})</summary>
        {lane.points.map((p, i) => (
          <div className="point-row" key={i}>
            <NumberControl
              label={`Point ${i + 1} Time`}
              value={p.time}
              min={0}
              max={86400}
              onChange={(v) =>
                setPoints(
                  lane.points.map((x, n) => (n === i ? { ...x, time: v } : x)),
                )
              }
            />
            <NumberControl
              label={`Point ${i + 1} Value`}
              value={p.value}
              min={param.min}
              max={param.max}
              step={param.step}
              onChange={(v) =>
                setPoints(
                  lane.points.map((x, n) => (n === i ? { ...x, value: v } : x)),
                )
              }
            />
            <Button
              title="Remove Curve Point"
              onClick={() => setPoints(lane.points.filter((_, n) => n !== i))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <div className="actions">
          <Button
            onClick={() =>
              setPoints([
                ...lane.points,
                {
                  time: lane.points.length
                    ? Math.min(duration, lane.points.at(-1)!.time + 1)
                    : 0,
                  value: param.default,
                },
              ])
            }
          >
            Add Curve Point
          </Button>
          <Button onClick={() => setPoints([])}>Clear Curve</Button>
        </div>
      </details>
      {mapping && (
        <Modal title="Map Text To Sound" onClose={() => setMapping(false)}>
          <p>
            Aligned sentence times connect a saved text feature to this
            parameter. Feature values are interpretations, not measurements of
            the speaker’s internal state.
          </p>
          <label>
            Feature Track
            <select
              value={track?.id || ""}
              onChange={(e) => setTrackId(e.target.value)}
            >
              {matching.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.method} · {f.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Feature
            <select
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
            >
              {Object.keys(track?.definitions || {}).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <div className="two">
            <NumberControl
              label="Output Minimum"
              value={lower}
              min={param.min}
              max={param.max}
              step={param.step}
              onChange={setLower}
            />
            <NumberControl
              label="Output Maximum"
              value={upper}
              min={param.min}
              max={param.max}
              step={param.step}
              onChange={setUpper}
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
            />{" "}
            Invert Mapping
          </label>
          <Button
            className="primary"
            disabled={busy || !track}
            onClick={async () => {
              setBusy(true);
              try {
                const key = track.definitions[feature]
                  ? feature
                  : Object.keys(track.definitions)[0];
                const rows = await api(
                  `/features/${track.id}/sample/${sample.id}`,
                );
                const d = track.definitions[key];
                const points = rows.map((s: any) => {
                  let v = (s.values[key] - d.min) / (d.max - d.min || 1);
                  if (invert) v = 1 - v;
                  return {
                    time: s.start,
                    value:
                      lower + Math.max(0, Math.min(1, v)) * (upper - lower),
                    sentence_id: s.id,
                  };
                });
                save({
                  ...lane,
                  points,
                  feature: key,
                  feature_track_id: track.id,
                });
                setMapping(false);
                notify("Sentence feature mapped to " + param.label);
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Apply Sentence Mapping
          </Button>
        </Modal>
      )}
    </section>
  );
}

export function TextTiming({
  sample,
  samples,
  caps,
  features,
  notify,
  refresh,
}: {
  sample: Sample;
  samples: Sample[];
  caps: Capabilities;
  features: Feature[];
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [modelMode, setModelMode] = useState(false),
    [provider, setProvider] = useState("openai"),
    [model, setModel] = useState("gpt-4.1-mini"),
    [definitions, setDefinitions] = useState(
      '{"valence":{"min":-1,"max":1},"arousal":{"min":0,"max":1},"tension":{"min":0,"max":1}}',
    ),
    [instructions, setInstructions] = useState(""),
    [reference, setReference] = useState(""),
    [editor, setEditor] = useState<{ kind: string; data: string } | null>(null),
    [busy, setBusy] = useState(false),
    [alignment, setAlignment] = useState<any>(null);
  useEffect(() => {
    setAlignment(null);
    api(`/catalog/alignments/${sample.id}`)
      .then(setAlignment)
      .catch(() => {});
  }, [sample.id, features.length]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const job = (operation: string, payload: any) =>
    run(async () => {
      await api("/jobs", "POST", { operation, payload });
      refresh();
      notify(`${operation} queued; see Batches for progress.`);
    });
  const matching = features.filter((f) => f.text_hash === sample.text_hash);
  return (
    <details className="text-timing">
      <summary>Text Features And Timing</summary>
      <p className="reading source-excerpt">
        {sample.source.text ||
          "This recording has no supplied text. Add the narrated text in Library → Inspect before using text features or alignment."}
      </p>
      <div className="actions">
        <Button
          disabled={!sample.source.text || busy}
          onClick={() => job("analyze", { source: sample.source })}
        >
          Analyze Locally
        </Button>
        <Button onClick={() => setModelMode(!modelMode)}>Model Analysis</Button>
        <Button
          disabled={!sample.source.text || busy}
          onClick={() => job("align", { sample_id: sample.id })}
        >
          Align Words
        </Button>
        <Button
          onClick={() =>
            run(async () => {
              const a = await api(`/catalog/alignments/${sample.id}`);
              setAlignment(a);
              setEditor({
                kind: "alignment",
                data: JSON.stringify(a, null, 2),
              });
            })
          }
        >
          Inspect Timing
        </Button>
      </div>
      <small>
        Local analysis uses VADER sentiment and structural features. Alignment
        prefers provider timings, otherwise WhisperX on CPU.{" "}
        {caps.alignment
          ? "Local alignment is installed."
          : "Local alignment requires the optional dependency setup."}
      </small>
      {alignment && (
        <p>
          {alignment.method} · {alignment.words.length} words ·{" "}
          {alignment.needs_review
            ? "Review required"
            : "No unmatched words reported"}
        </p>
      )}
      {modelMode && (
        <section className="model-analysis">
          <div className="two">
            <label>
              Analysis Provider
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(
                    caps.analysis_providers.find((x) => x.id === e.target.value)
                      ?.default_model || "",
                  );
                }}
              >
                {caps.analysis_providers
                  .filter((p) => p.id !== "demo")
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                      {!p.available ? " · Unavailable" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Analysis Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
          </div>
          <label>
            Feature Definitions (JSON)
            <textarea
              value={definitions}
              onChange={(e) => setDefinitions(e.target.value)}
            />
          </label>
          <label>
            Analysis Instructions
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || !sample.source.text}
            onClick={() =>
              run(async () => {
                await api("/jobs", "POST", {
                  operation: "analyze",
                  payload: {
                    source: sample.source,
                    method: "model",
                    model_options: {
                      provider,
                      model,
                      definitions: JSON.parse(definitions),
                      instructions,
                    },
                  },
                });
                refresh();
                notify(
                  "Model analysis queued; this uses the selected provider.",
                );
              })
            }
          >
            Run Model Analysis
          </Button>
        </section>
      )}
      {matching.map((f) => (
        <div className="section-head" key={f.id}>
          <span>
            {f.method} · {Object.keys(f.definitions).join(", ")}
          </span>
          <div className="actions">
            <Button
              onClick={() =>
                setEditor({
                  kind: "features",
                  data: JSON.stringify(f, null, 2),
                })
              }
            >
              Edit Features
            </Button>
            <Button onClick={() => downloadJson(f, "sound-features.json")}>
              Export
            </Button>
          </div>
        </div>
      ))}
      <label className="file-button">
        Import Feature JSON / CSV
        <input
          type="file"
          accept=".json,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              run(async () => {
                const text = await file.text();
                let track: any;
                if (file.name.endsWith(".json")) track = JSON.parse(text);
                else {
                  const rows = text
                    .trim()
                    .split(/\r?\n/)
                    .map((r) => r.split(","));
                  const keys = rows.shift()!;
                  if (keys[0] !== "id")
                    throw new Error(
                      "CSV header must start with id; remaining columns are numeric features.",
                    );
                  const basis = matching[0];
                  if (!basis)
                    throw new Error(
                      "Run local analysis first, then import a CSV with matching sentence IDs.",
                    );
                  track = {
                    ...basis,
                    id: undefined,
                    method: "imported CSV",
                    segments: rows.map((row) => ({
                      id: row[0],
                      values: Object.fromEntries(
                        keys.slice(1).map((k, i) => [k, +row[i + 1]]),
                      ),
                    })),
                    definitions: Object.fromEntries(
                      keys
                        .slice(1)
                        .map((k) => [
                          k,
                          basis.definitions[k] || { min: -1, max: 1 },
                        ]),
                    ),
                  };
                }
                await api("/features", "POST", {
                  source: sample.source,
                  track,
                });
                refresh();
                notify("Feature track imported.");
              });
            e.target.value = "";
          }}
        />
      </label>
      <h3>Align Alternative Readings</h3>
      <div className="actions">
        <select
          aria-label="Reference Recording"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        >
          <option value="">Select Reference</option>
          {samples
            .filter(
              (s) => s.id !== sample.id && s.text_hash === sample.text_hash,
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
        </select>
        <Button
          disabled={!reference || busy}
          onClick={() =>
            job("warp", { sample_id: sample.id, reference_id: reference })
          }
        >
          Render Aligned Copy
        </Button>
      </div>
      <small>
        Align words in both recordings first. Stretch ratios outside 0.5–2×
        require corrected anchors. Originals stay available for comparison.
      </small>
      <Button
        disabled={!reference}
        onClick={() =>
          setEditor({
            kind: "warp",
            data: JSON.stringify(
              [
                [0, 0],
                [
                  sample.duration,
                  samples.find((s) => s.id === reference)?.duration,
                ],
              ],
              null,
              2,
            ),
          })
        }
      >
        Custom Time Map
      </Button>
      {editor && (
        <Modal
          title={
            editor.kind === "features"
              ? "Edit Sentence Features"
              : editor.kind === "warp"
                ? "Edit Source → Reference Anchors"
                : "Edit Word Timing"
          }
          onClose={() => setEditor(null)}
        >
          <p>
            Values are validated against this recording and text revision. Times
            are in seconds.
          </p>
          <textarea
            className="json-editor"
            aria-label="Structured Editor"
            value={editor.data}
            onChange={(e) => setEditor({ ...editor, data: e.target.value })}
          />
          <Button
            disabled={busy}
            className="primary"
            onClick={() =>
              run(async () => {
                const value = JSON.parse(editor.data);
                if (editor.kind === "features")
                  await api("/features", "POST", {
                    source: sample.source,
                    track: value,
                  });
                else if (editor.kind === "alignment")
                  await api(`/alignments/${sample.id}`, "POST", value);
                else
                  await api("/jobs", "POST", {
                    operation: "warp",
                    payload: {
                      sample_id: sample.id,
                      reference_id: reference,
                      anchors: value,
                    },
                  });
                setEditor(null);
                refresh();
                notify("Saved; any requested render is queued.");
              })
            }
          >
            Save
          </Button>
        </Modal>
      )}
    </details>
  );
}
