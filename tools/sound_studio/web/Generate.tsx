import { useEffect, useState, useRef } from "react";
import { Plus, Search, FileText, Play, Upload } from "lucide-react";
import { api } from "./api";
import type { Capabilities, Source, Generation, Project } from "./types";
import { uid } from "./types";
import { Button, NumberControl, Modal } from "./controls";

export function Generate({
  caps,
  project,
  notify,
  refresh,
}: {
  caps: Capabilities;
  project: Project;
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [source, setSource] = useState<Source>({
    id: uid(),
    title: "Untitled Passage",
    text: "",
    kind: "pasted",
  });
  const [q, setQ] = useState(""),
    [kind, setKind] = useState(""),
    [rows, setRows] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0);
  const [options, setOptions] = useState({
    headings: true,
    citations: false,
    footnotes: false,
    bibliography: false,
  });
  const [spec, setSpec] = useState<Generation>({
    provider: "openai",
    model: caps.providers[0].models[0],
    voice: "cedar",
    settings: {
      instructions: "Read faithfully, clearly and conversationally.",
      speed: 1,
      response_format: "wav",
    },
  });
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]),
    [inputs, setInputs] = useState<Source[]>([]),
    [variants, setVariants] = useState<Generation[]>([]),
    [repeats, setRepeats] = useState(1),
    [maxJobs, setMaxJobs] = useState(100),
    [maxChars, setMaxChars] = useState(100000),
    [plan, setPlan] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [sweep, setSweep] = useState("speed"),
    [values, setValues] = useState("0.8, 1, 1.2");
  const provider = caps.providers.find((p) => p.id === spec.provider)!;
  const controls = provider.model_controls[spec.model] || {};
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
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api(`/content?q=${encodeURIComponent(q)}&kind=${kind}&offset=${offset}`)
          .then((r) => {
            if (active) {
              setRows(r.items);
              setTotal(r.total);
              if (r.errors?.length) notify(r.errors.join(" "));
            }
          })
          .catch((e) => notify(e.message)),
      180,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, kind, offset]);
  useEffect(() => {
    setVoices(provider.voices.map((v) => ({ id: v, name: v })));
    api(`/voices/${provider.id}`)
      .then(setVoices)
      .catch((e) => notify(e.message));
  }, [provider.id]);
  const changeProvider = (id: string) => {
    const p = caps.providers.find((x) => x.id === id)!;
    const model = p.models[0];
    setSpec({
      provider: id,
      model,
      voice: p.voice,
      settings: Object.fromEntries(
        Object.entries(p.model_controls[model]).map(([k, c]) => [k, c.default]),
      ),
    });
  };
  const load = async (id: string) => {
    const p = new URLSearchParams(
      Object.entries(options).map(([k, v]) => [k, String(v)]),
    );
    setSource(await api(`/content/${encodeURIComponent(id)}?${p}`));
  };
  const batch = () => ({
    sources: inputs.length ? inputs : [source],
    generations: variants.length ? variants : [spec],
    repeats,
    max_jobs: maxJobs,
    max_characters: maxChars,
    project_id: project.revision ? project.id : null,
  });
  const generate = () =>
    run(async () => {
      await api("/batches", "POST", {
        sources: [source],
        generations: [spec],
        repeats: 1,
        max_jobs: 1,
        max_characters: maxChars,
        project_id: project.revision ? project.id : null,
      });
      notify("Generation queued. Progress is available in Batches.");
      refresh();
    });
  return (
    <div className="generation-layout">
      <section className="panel source-editor">
        <div className="section-head">
          <h2>Narration Input</h2>
          <label className="file-button">
            <Upload size={15} /> Import Text
            <input
              type="file"
              accept=".txt,.md"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setSource({
                    id: uid(),
                    title: f.name,
                    text: await f.text(),
                    kind: "text-import",
                  });
                }
              }}
            />
          </label>
        </div>
        <label>
          Passage Name
          <input
            value={source.title}
            onChange={(e) => setSource({ ...source, title: e.target.value })}
          />
        </label>
        <textarea
          className="passage reading"
          ref={editor}
          aria-label="Narration Text"
          placeholder="Write a passage, import a text file, or choose from the archive below."
          value={source.text}
          onChange={(e) =>
            setSource({
              ...source,
              id: uid(),
              text: e.target.value,
              kind: "edited",
            })
          }
        />
        <div className="section-head">
          <small>
            {source.text.length.toLocaleString()} characters · {source.kind}
          </small>
          <Button
            onClick={() => {
              if (!source.text.trim())
                return notify("Choose or enter text first.");
              setInputs([...inputs, structuredClone(source)]);
              notify("Input added to the batch.");
            }}
          >
            <Plus size={15} /> Add Input To Batch
          </Button>
        </div>
        <Button
          onClick={() => {
            const a = editor.current?.selectionStart ?? 0,
              b = editor.current?.selectionEnd ?? 0;
            if (a === b) return notify("Select a passage in the editor first.");
            setSource({
              ...source,
              id: uid(),
              text: source.text.slice(a, b),
              options: {
                ...source.options,
                selection_start: a,
                selection_end: b,
                parent_source_id: source.id,
              },
              kind: "selected-passage",
            });
          }}
        >
          Use Selected Passage
        </Button>
        <details open>
          <summary>Browse The Archive And Essay</summary>
          <div className="search-row">
            <Search size={16} />
            <input
              aria-label="Search Text Content"
              placeholder="Search passages…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
            <select
              aria-label="Content Type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All Content</option>
              {["message", "thread", "document", "artifact", "editorial"].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </select>
          </div>
          <div className="check-row">
            {Object.entries(options).map(([k, v]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) =>
                    setOptions({ ...options, [k]: e.target.checked })
                  }
                />
                {k[0].toUpperCase() + k.slice(1)}
              </label>
            ))}
          </div>
          <small>
            Inclusion choices apply when loading an editorial passage. The
            editor always shows the exact spoken input.
          </small>
          <div className="source-results">
            {rows.map((r) => (
              <button key={r.id} onClick={() => run(() => load(r.id))}>
                <FileText size={16} />
                <span>
                  {r.title}
                  <small>
                    {r.kind} · {r.characters.toLocaleString()} characters
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="section-head">
            <Button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 60))}
            >
              Previous
            </Button>
            <small>
              {Math.min(offset + rows.length, total)} of {total}
            </small>
            <Button
              disabled={offset + 60 >= total}
              onClick={() => setOffset(offset + 60)}
            >
              Next
            </Button>
          </div>
        </details>
      </section>
      <section className="panel provider-editor">
        <h2>Voice Generation</h2>
        <div className="actions">
          {caps.baseline_presets?.map((p) => (
            <Button key={p.voice} onClick={() => setSpec(structuredClone(p))}>
              App Baseline · {p.voice}
            </Button>
          ))}
        </div>
        <div className="two">
          <label>
            Provider
            <select
              value={spec.provider}
              onChange={(e) => changeProvider(e.target.value)}
            >
              {caps.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.available ? " · Not Configured" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select
              value={spec.model}
              onChange={(e) =>
                setSpec({
                  ...spec,
                  model: e.target.value,
                  settings: Object.fromEntries(
                    Object.entries(provider.model_controls[e.target.value]).map(
                      ([k, c]) => [k, c.default],
                    ),
                  ),
                })
              }
            >
              {provider.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Voice Or Authorized Custom Voice ID
          <input
            list="voices"
            value={spec.voice}
            onChange={(e) => setSpec({ ...spec, voice: e.target.value })}
          />
          <datalist id="voices">
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </datalist>
        </label>
        {Object.entries(controls).map(([k, c]) => (
          <label key={k} title={c.help}>
            {c.label}
            {typeof c.default === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(spec.settings[k])}
                onChange={(e) =>
                  setSpec({
                    ...spec,
                    settings: { ...spec.settings, [k]: e.target.checked },
                  })
                }
              />
            ) : c.choices ? (
              <select
                value={String(spec.settings[k] ?? c.default)}
                onChange={(e) =>
                  setSpec({
                    ...spec,
                    settings: {
                      ...spec.settings,
                      [k]:
                        typeof c.default === "number"
                          ? +e.target.value
                          : e.target.value,
                    },
                  })
                }
              >
                {c.choices.map((x) => (
                  <option key={String(x)}>{x}</option>
                ))}
              </select>
            ) : typeof c.default === "number" ? (
              <input
                type="number"
                min={c.min ?? undefined}
                max={c.max ?? undefined}
                step="0.01"
                value={Number(spec.settings[k] ?? c.default)}
                onChange={(e) =>
                  setSpec({
                    ...spec,
                    settings: { ...spec.settings, [k]: +e.target.value },
                  })
                }
              />
            ) : (
              <textarea
                rows={k === "instructions" || k === "style" ? 2 : 1}
                value={String(spec.settings[k] ?? c.default)}
                onChange={(e) =>
                  setSpec({
                    ...spec,
                    settings: { ...spec.settings, [k]: e.target.value },
                  })
                }
              />
            )}
          </label>
        ))}
        <small>
          Controls are specific to this model.{" "}
          {provider.available
            ? "Credentials are configured on the server."
            : "No credential configured; other studio tools remain available."}{" "}
          <a href={provider.docs} target="_blank" rel="noreferrer">
            API Reference
          </a>
        </small>
        <div className="actions">
          <Button
            className="primary"
            disabled={
              busy ||
              !source.text.trim() ||
              (!provider.available && !caps.fixture)
            }
            onClick={generate}
          >
            <Play size={16} /> Generate One Take
          </Button>
          <Button
            onClick={() => {
              setVariants([...variants, structuredClone(spec)]);
              notify("Voice configuration added to the batch.");
            }}
          >
            <Plus size={16} /> Add Voice To Batch
          </Button>
        </div>
        <details>
          <summary>Batch Experiment</summary>
          <p>
            Combine chosen inputs and voice configurations. Repeated takes
            remain separate recordings. Generation uses paid provider requests.
          </p>
          <div className="two">
            <NumberControl
              label="Takes Per Condition"
              value={repeats}
              min={1}
              max={50}
              step={1}
              onChange={setRepeats}
            />
            <NumberControl
              label="Maximum Jobs"
              value={maxJobs}
              min={1}
              max={1000}
              step={1}
              onChange={setMaxJobs}
            />
          </div>
          <NumberControl
            label="Character Budget"
            value={maxChars}
            min={1}
            max={5000000}
            step={1000}
            onChange={setMaxChars}
          />
          <p>
            {inputs.length || 1} input(s) × {variants.length || 1}{" "}
            configuration(s) × {repeats} take(s)
          </p>
          <div className="batch-items">
            {inputs.map((s, i) => (
              <button
                key={i}
                onClick={() => setInputs(inputs.filter((_, n) => n !== i))}
              >
                {s.title} ×
              </button>
            ))}
            {variants.map((s, i) => (
              <button
                key={i}
                onClick={() => setVariants(variants.filter((_, n) => n !== i))}
              >
                {s.provider} · {s.voice} · {JSON.stringify(s.settings)} ×
              </button>
            ))}
          </div>
          <h3>Vary One Parameter</h3>
          <div className="two">
            <label>
              Parameter
              <select value={sweep} onChange={(e) => setSweep(e.target.value)}>
                {Object.entries(controls)
                  .filter(([, c]) => typeof c.default === "number")
                  .map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Values (Comma Separated)
              <input
                value={values}
                onChange={(e) => setValues(e.target.value)}
              />
            </label>
          </div>
          <Button
            onClick={() => {
              const nums = values.split(",").map(Number);
              if (
                !nums.length ||
                nums.some((x) => !Number.isFinite(x)) ||
                !controls[sweep]
              )
                return notify(
                  "Enter numeric values for a supported parameter.",
                );
              setVariants(
                nums.map((v) => ({
                  ...structuredClone(spec),
                  settings: { ...spec.settings, [sweep]: v },
                })),
              );
            }}
          >
            Set Sweep Configurations
          </Button>
          <Button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () =>
                setPlan({
                  ...(await api("/batches/plan", "POST", batch())),
                  spec: batch(),
                }),
              )
            }
          >
            Preview Batch
          </Button>
        </details>
      </section>
      {plan && (
        <Modal title="Review Batch" onClose={() => setPlan(null)}>
          <p>
            {plan.jobs.length} jobs · {plan.requests} provider requests ·{" "}
            {plan.characters.toLocaleString()} characters
          </p>
          <p>
            {plan.estimated_cost === null
              ? plan.cost_note
              : `Estimated cost: $${plan.estimated_cost.toFixed(3)}. ${plan.cost_note}`}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Provider</th>
                  <th>Voice</th>
                  <th>Take</th>
                  <th>Requests</th>
                </tr>
              </thead>
              <tbody>
                {plan.jobs.map((j: any, i: number) => (
                  <tr key={i}>
                    <td>{j.title}</td>
                    <td>{j.provider}</td>
                    <td>{j.voice}</td>
                    <td>{j.take}</td>
                    <td>{j.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={busy}
            className="primary"
            onClick={() =>
              run(async () => {
                await api("/batches", "POST", plan.spec);
                setPlan(null);
                refresh();
                notify(
                  "Batch started. Open Batches to pause, cancel, or retry jobs.",
                );
              })
            }
          >
            Start This Batch
          </Button>
        </Modal>
      )}
    </div>
  );
}
