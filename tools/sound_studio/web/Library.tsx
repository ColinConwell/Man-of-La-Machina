import { useState, useEffect } from "react";
import { Upload, Plus, Star, Download, Cloud, Trash2 } from "lucide-react";
import type { Sample } from "./types";
import { api, audioUrl, base, downloadJson } from "./api";
import { Button, Modal } from "./controls";
import { Spectrogram } from "./Wave";

export function Library({
  samples,
  onAdd,
  refresh,
  notify,
  remote,
  stop,
}: {
  samples: Sample[];
  onAdd: (s: Sample) => void;
  refresh: () => void;
  notify: (s: string) => void;
  remote: boolean;
  stop: () => void;
}) {
  const [q, setQ] = useState(""),
    [favorite, setFavorite] = useState(false),
    [selected, setSelected] = useState<Sample | null>(null),
    [remoteRows, setRemoteRows] = useState<any[]>([]),
    [reviews, setReviews] = useState<any[]>([]),
    [storage, setStorage] = useState<any>(null),
    [text, setText] = useState(""),
    [notes, setNotes] = useState(""),
    [tags, setTags] = useState(""),
    [showSpectrum, setShowSpectrum] = useState(false),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<{
      sample: Sample;
      dependencies: any[];
    } | null>(null),
    [scope, setScope] = useState("local");
  useEffect(() => {
    api("/review-samples")
      .then(setReviews)
      .catch((e) => notify(e.message));
    api("/storage")
      .then(setStorage)
      .catch((e) => notify(e.message));
  }, [samples.length]);
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
  const choose = (s: Sample) => {
    setSelected(s);
    setText(s.source.text);
    setNotes(s.notes);
    setTags(s.tags.join(", "));
    setShowSpectrum(false);
  };
  const filtered = samples.filter(
    (s) =>
      (!favorite || s.favorite) &&
      (!q ||
        (s.title + " " + s.tags.join(" ") + " " + s.source.text)
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <section className="panel library-page">
      <div className="section-head">
        <div>
          <h2>Sample Library</h2>
          <small>
            {storage
              ? `${storage.samples} samples · ${(storage.bytes / 1024 / 1024).toFixed(1)} MiB locally`
              : ""}{" "}
            · Originals are preserved
          </small>
        </div>
        <label className="file-button">
          <Upload size={16} /> Import Audio
          <input
            type="file"
            accept="audio/*,.flac,.wav,.mp3,.ogg,.m4a"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                run(async () => {
                  const data = new FormData();
                  data.append("file", f);
                  data.append("title", f.name);
                  await api("/samples/import", "POST", data);
                  refresh();
                  notify(
                    "Audio imported. Supply its text in Inspect before alignment.",
                  );
                });
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="search-row">
        <input
          aria-label="Search Samples"
          placeholder="Search titles, tags, or text…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />{" "}
          Favorites
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Recording</th>
              <th>Duration</th>
              <th>Peak / RMS</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.title}</strong>
                  <small>
                    {s.tags.join(" · ")} · {s.source.kind}
                  </small>
                </td>
                <td>{s.duration.toFixed(1)} s</td>
                <td>
                  {s.peak_db} / {s.rms_db} dBFS
                </td>
                <td>{s.local ? "Local" : "Remote Audio"}</td>
                <td>
                  <div className="actions">
                    <Button
                      title={`Add ${s.title}`}
                      disabled={!s.local}
                      onClick={() => onAdd(s)}
                    >
                      <Plus size={15} />
                    </Button>
                    <Button onClick={() => choose(s)}>Inspect</Button>
                    <Button
                      title="Toggle Favorite"
                      onClick={() =>
                        run(async () => {
                          await api(`/samples/${s.id}`, "PATCH", {
                            favorite: !s.favorite,
                          });
                          refresh();
                        })
                      }
                    >
                      <Star
                        size={15}
                        fill={s.favorite ? "currentColor" : "none"}
                      />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="empty">
            Generate a narration or import a recording to begin. Audio stays
            private to this studio.
          </p>
        )}
      </div>
      <details>
        <summary>Existing Review Recordings</summary>
        <p>
          These existing local recordings can be copied into the studio without
          changing their originals. Their narration text must be supplied before
          alignment.
        </p>
        {reviews.map((r) => (
          <div className="section-head" key={r.id}>
            <span>{r.name}</span>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api(`/review-samples/${r.id}`, "POST");
                  refresh();
                })
              }
            >
              Import Copy
            </Button>
          </div>
        ))}
      </details>
      <details>
        <summary>Private S3 Storage</summary>
        <p>
          Transfers use the separate Sound Studio prefix. Uploads verify
          checksums before publishing a manifest. Remote audio is downloaded
          explicitly.
        </p>
        <div className="actions">
          <Button
            disabled={!remote || busy}
            onClick={() =>
              run(async () => setRemoteRows(await api("/storage/remote")))
            }
          >
            <Cloud size={16} /> Refresh Remote Catalog
          </Button>
          <Button
            onClick={() =>
              run(async () => {
                await api("/storage/rebuild", "POST");
                refresh();
                notify("Local catalog rebuilt from manifests.");
              })
            }
          >
            Rebuild Local Catalog
          </Button>
        </div>
        {!remote && (
          <p>
            The existing private content store is not configured for this
            server.
          </p>
        )}
        {remoteRows.map((r) => (
          <div className="section-head" key={r.key}>
            <small>
              {r.kind} · {r.id} · {r.modified}
            </small>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/jobs", "POST", {
                    operation: "download",
                    payload: { key: r.key },
                  });
                  notify("Download queued.");
                  refresh();
                })
              }
            >
              <Download size={14} /> Download
            </Button>
          </div>
        ))}
      </details>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <audio controls src={audioUrl(selected.id)} onPlay={stop} />
          <p>
            {selected.duration.toFixed(2)} seconds · {selected.sample_rate} Hz ·{" "}
            {selected.channels} channels
          </p>
          <div className="actions">
            <Button onClick={() => setShowSpectrum(!showSpectrum)}>
              Measured Spectrogram
            </Button>
            {["wav", "flac", "mp3"].map((format) => (
              <a
                key={format}
                className="button"
                href={`${base}/samples/${selected.id}/export?format=${format}`}
                download
              >
                {format.toUpperCase()}
              </a>
            ))}
            <Button
              onClick={() =>
                downloadJson(selected, `sound-studio-${selected.id}.json`)
              }
            >
              Export Manifest
            </Button>
          </div>
          {showSpectrum && <Spectrogram sample={selected} />}
          <label>
            Narrated Text
            <textarea
              className="reading"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <small>
            Changing text invalidates prior alignment/feature mappings; saved
            recordings remain unchanged.
          </small>
          <label>
            Tags
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          <label>
            Listening Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const payload: any = {
                    notes,
                    tags: tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  };
                  if (text !== selected.source.text) payload.text = text;
                  const s = await api(
                    `/samples/${selected.id}`,
                    "PATCH",
                    payload,
                  );
                  choose({ ...s, local: selected.local });
                  refresh();
                  notify("Sample metadata saved.");
                })
              }
            >
              Save Notes And Text
            </Button>
            <Button
              disabled={!remote || busy}
              onClick={() =>
                run(async () => {
                  await api("/jobs", "POST", {
                    operation: "upload",
                    payload: { kind: "samples", id: selected.id },
                  });
                  refresh();
                  notify("Verified upload queued.");
                })
              }
            >
              <Cloud size={15} /> Upload
            </Button>
            <Button
              onClick={() =>
                run(async () => {
                  setDeleting({
                    sample: selected,
                    dependencies: await api(
                      `/samples/${selected.id}/dependencies?include_remote=${remote}`,
                    ),
                  });
                  setScope("local");
                })
              }
            >
              <Trash2 size={15} /> Manage Copies
            </Button>
          </div>
          <details>
            <summary>Generation / Render Receipt</summary>
            <pre>{JSON.stringify(selected.receipt, null, 2)}</pre>
          </details>
        </Modal>
      )}
      {deleting && (
        <Modal title="Manage Sample Copies" onClose={() => setDeleting(null)}>
          <p>{deleting.sample.title}</p>
          <p>
            {deleting.dependencies.length
              ? `Referenced by: ${deleting.dependencies.map((p) => p.name).join(", ")}. Remove those layers before deleting the record.`
              : "No current local project references this sample."}
          </p>
          <label>
            Operation
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="local">
                Delete Local Record And Unshared Audio
              </option>
              <option value="evict" disabled={!remote}>
                Evict Local Audio After Remote Verification
              </option>
              <option value="remote" disabled={!remote}>
                Delete Remote Sample Manifests
              </option>
              <option value="remote-purge" disabled={!remote}>
                Delete Remote Manifests And Unshared Audio
              </option>
            </select>
          </label>
          <p>
            Remote deletion removes sample manifests. Shared immutable objects
            are retained for other recordings and historical projects.
          </p>
          <Button
            disabled={busy}
            className="danger"
            onClick={() =>
              run(async () => {
                await api(
                  `/samples/${deleting.sample.id}?scope=${scope}`,
                  "DELETE",
                );
                setDeleting(null);
                setSelected(null);
                refresh();
                notify("Selected storage operation completed.");
              })
            }
          >
            Apply To This Sample
          </Button>
        </Modal>
      )}
    </section>
  );
}
