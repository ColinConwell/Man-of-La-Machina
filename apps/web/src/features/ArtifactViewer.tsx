import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { Artifact } from "../types";
import { MessageText } from "./ConversationReader";
export function ArtifactViewer({ threadId }: { threadId: string }) {
  const q = useQuery({
    queryKey: ["artifacts", threadId],
    queryFn: () => api<Artifact[]>("/artifacts?thread_id=" + threadId),
  });
  return (
    <section className="artifacts" aria-label="Documentary artifacts">
      <p className="branch-explanation">
        Documentary material linked to this moment. Opening an artifact does not
        add it to model context.
      </p>
      {q.isPending && <p>Loading linked material…</p>}
      {q.isError && <p role="alert">{q.error.message}</p>}
      {q.data?.length === 0 && (
        <div className="empty-state">
          <h3>No linked artifacts yet.</h3>
          <p>
            This scene’s media can be added through a curation overlay, with
            captions, credits, and rights information.
          </p>
        </div>
      )}
      {q.data?.map((a) => (
        <article key={a.id}>
          <p className="origin-label">
            {a.kind === "annotation"
              ? "Retrospective annotation"
              : "Documentary artifact"}{" "}
            ·{" "}
            {a.rights_status === "approved"
              ? "Approved"
              : "Curator review pending"}
          </p>
          <h3>{a.title}</h3>
          <p className="artifact-note">{a.curatorial_note}</p>
          {a.kind === "image" && a.uri && (
            <img src={a.uri} alt={a.alt_text} />
          )}{" "}
          {a.kind === "audio" && a.uri && (
            <audio controls preload="metadata" src={a.uri} />
          )}{" "}
          {a.kind === "video" && a.uri && (
            <video
              controls
              preload="metadata"
              src={a.uri}
              poster={a.poster_uri || undefined}
              aria-label={a.alt_text}
            />
          )}
          <MessageText body={a.body} />
          {a.transcript && (
            <details>
              <summary>Transcript</summary>
              <p>{a.transcript}</p>
            </details>
          )}
          <footer>
            {a.credits}
            <details>
              <summary>Source provenance</summary>
              <p>
                {a.provenance.source_path.split("/").at(-1)}
                <br />
                {a.provenance.locator}
              </p>
            </details>
          </footer>
        </article>
      ))}
    </section>
  );
}
