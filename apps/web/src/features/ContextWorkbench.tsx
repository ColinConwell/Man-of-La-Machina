import { useState } from "react";
import { Eye, RotateCcw, Save } from "lucide-react";
import { useExperience } from "../store";
import { ContextManifest } from "./ContextManifest";
import type { Experience, HistoricalMessage, Manifest } from "../types";
export function ContextWorkbench({
  experience,
  cutoff,
  manifest,
  onPreview,
  busy,
  onRestart,
}: {
  experience: Experience;
  cutoff?: HistoricalMessage;
  manifest: Manifest | null;
  onPreview: () => void;
  busy: boolean;
  onRestart: () => void;
}) {
  const { options, setOptions, settings, setSettings, branchId } =
    useExperience();
  const [preset, setPreset] = useState("");
  const [notice, setNotice] = useState("");
  const presets = JSON.parse(
    localStorage.getItem("machina-presets") || "{}",
  ) as Record<string, typeof options>;
  function save() {
    if (!preset.trim()) return;
    localStorage.setItem(
      "machina-presets",
      JSON.stringify({ ...presets, [preset.trim()]: options }),
    );
    setNotice("Context settings saved on this browser.");
    setPreset("");
  }
  return (
    <aside className="context-workbench" aria-label="Context workbench">
      <h2>Context</h2>
      <p className="context-intro">What should the companion know?</p>
      <fieldset disabled={busy} className="context-controls">
        <legend className="sr-only">Context and generation controls</legend>
        <fieldset className="breadth">
          <legend className="sr-only">Context breadth</legend>
          {(["scene", "thread", "chapter", "journey"] as const).map((b) => (
            <label key={b} className={options.breadth === b ? "active" : ""}>
              <input
                type="radio"
                name="breadth"
                value={b}
                checked={options.breadth === b}
                onChange={() => setOptions({ breadth: b })}
              />
              {b[0].toUpperCase() + b.slice(1)}
            </label>
          ))}
        </fieldset>
        <div className="facet-group">
          <h3>Retain in context</h3>
          {experience.tags.map((t) => (
            <label className="facet" key={t.id}>
              <input
                type="checkbox"
                checked={!options.excluded_tags.includes(t.id)}
                onChange={(e) =>
                  setOptions({
                    excluded_tags: e.target.checked
                      ? options.excluded_tags.filter((id) => id !== t.id)
                      : [...options.excluded_tags, t.id],
                  })
                }
              />
              <span>
                {t.label}
                <small>
                  {t.id === "practical"
                    ? "Plans, money, travel, and everyday constraints."
                    : t.id === "intimate"
                      ? "Disclosures tagged as personal or relational."
                      : "The shared language of signs and pilgrimage."}
                </small>
              </span>
            </label>
          ))}
          <small className="fine">
            Tags are curator interpretations, currently applied to the first May
            8 exchanges. The protected local turn remains included even if its
            group is withheld.
          </small>
        </div>
        <label className="facet">
          <input
            type="checkbox"
            disabled={cutoff?.speaker !== "human"}
            checked={options.replace_cutoff && cutoff?.speaker === "human"}
            onChange={(e) => setOptions({ replace_cutoff: e.target.checked })}
          />
          <span>
            Replace the selected human turn
            <small>Otherwise, your intervention follows the cutoff.</small>
          </span>
        </label>
        <details className="advanced-context">
          <summary>More context controls</summary>
          <label>
            Where context begins
            <select
              value={options.context_mode}
              disabled={!!branchId}
              onChange={(e) =>
                setOptions({
                  context_mode: e.target.value as typeof options.context_mode,
                })
              }
            >
              <option value="inherit_history">Inherit eligible history</option>
              <option value="begin_context_here">Begin context here</option>
            </select>
          </label>
          {branchId && <small>Restart to change the context beginning.</small>}
          <label className="facet">
            <input
              type="checkbox"
              disabled={!experience.available_summaries}
              checked={options.include_summaries}
              onChange={(e) =>
                setOptions({ include_summaries: e.target.checked })
              }
            />
            Curated older summary ({experience.available_summaries} available)
          </label>
          <label className="facet">
            <input
              type="checkbox"
              disabled={!experience.available_documents}
              checked={options.include_documents}
              onChange={(e) =>
                setOptions({ include_documents: e.target.checked })
              }
            />
            Disclosed documents ({experience.available_documents} available)
          </label>
          {manifest?.items
            .filter((i) => i.origin === "historical")
            .map((i) => (
              <label className="facet individual-item" key={i.id}>
                <input
                  type="checkbox"
                  disabled={i.protected}
                  checked={!options.excluded_ids.includes(i.id)}
                  onChange={(e) =>
                    setOptions({
                      excluded_ids: e.target.checked
                        ? options.excluded_ids.filter((id) => id !== i.id)
                        : [...options.excluded_ids, i.id],
                    })
                  }
                />
                <span>
                  {i.body.slice(0, 85)}…
                  <small>{i.protected ? "Protected local turn" : i.id}</small>
                </span>
              </label>
            ))}
          {options.excluded_ids.length > 0 && (
            <button
              className="text-button"
              onClick={() => setOptions({ excluded_ids: [] })}
            >
              Restore {options.excluded_ids.length} withheld turns
            </button>
          )}
        </details>
        <div className="preview-action">
          <button
            className="secondary"
            onClick={onPreview}
            disabled={busy || !cutoff}
          >
            <Eye size={16} /> Preview context
          </button>
        </div>
        <details className="provider-settings">
          <summary>Generation settings</summary>
          <label>
            Provider
            <select
              value={settings.provider}
              onChange={(e) => {
                const p = experience.providers.find(
                  (p) => p.id === e.target.value,
                )!;
                setSettings({
                  provider: p.id,
                  model: p.default_model,
                  temperature: null,
                });
              }}
            >
              {experience.providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.name}
                  {!p.available ? " · unavailable" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model ID
            <input
              value={settings.model}
              disabled={settings.provider === "demo"}
              onChange={(e) => setSettings({ model: e.target.value })}
            />
          </label>
          <label>
            Maximum output tokens
            <input
              type="number"
              min="64"
              max="4096"
              value={settings.max_output_tokens}
              onChange={(e) =>
                setSettings({ max_output_tokens: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Temperature
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              placeholder="Provider default"
              value={settings.temperature ?? ""}
              onChange={(e) =>
                setSettings({
                  temperature:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <small className="fine">
            Model IDs are editable. Supported settings vary by model.
            Credentials stay on the server.
          </small>
        </details>
        <details className="saved-presets">
          <summary>Saved context presets</summary>
          {Object.keys(presets).map((name) => (
            <button
              className="text-button"
              key={name}
              onClick={() => {
                if (branchId) {
                  setNotice("Restart this branch before loading a preset.");
                  return;
                }
                setOptions(presets[name]);
                setNotice("Preset loaded.");
              }}
            >
              {name}
            </button>
          ))}
          <label>
            Preset name
            <input
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              maxLength={50}
            />
          </label>
          <button className="text-button" onClick={save}>
            <Save size={14} /> Save settings
          </button>
          <p className="fine" role="status">
            {notice}
          </p>
        </details>
      </fieldset>
      {manifest ? (
        <ContextManifest manifest={manifest} preview />
      ) : (
        <div className="receipt-empty">
          <h3>Every continuation leaves a receipt.</h3>
          <p>
            Preview the exact passages, their order, and why each one is
            included.
          </p>
        </div>
      )}
      <button className="restart-branch text-button" onClick={onRestart}>
        <RotateCcw size={14} /> Restart at this cutoff
      </button>
    </aside>
  );
}
