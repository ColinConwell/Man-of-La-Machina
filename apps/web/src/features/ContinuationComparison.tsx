import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Branch,
  HistoricalMessage as Message,
  BranchMessage as BranchTurn,
} from "../types";
import { HistoricalMessage } from "./ConversationReader";
import { BranchMessage } from "./BranchComposer";
export function ContinuationComparison({
  entry,
  branch,
  replace,
  onInspect,
}: {
  entry: string;
  branch: Branch | null;
  replace: boolean;
  onInspect: (m: BranchTurn) => void;
}) {
  const query = useQuery({
    queryKey: ["continuation", entry, replace],
    queryFn: () =>
      api<Message[]>(
        `/continuations/${entry}?include_cutoff=${replace}&limit=4`,
      ),
  });
  const recorded = query.data || [];
  const generated = branch?.messages || [];
  const words = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z]{5,}/g) || []);
  const r = words(
    recorded
      .filter((m) => m.speaker === "mirrows")
      .map((m) => m.body)
      .join(" "),
  );
  const g = words(
    generated
      .filter((m) => m.speaker === "model")
      .map((m) => m.body)
      .join(" "),
  );
  const shared = [...r].filter((w) => g.has(w)).slice(0, 12);
  return (
    <section className="comparison">
      <p className="branch-explanation">
        Two continuations, one starting point. What changes in the language, the
        confidence, or the invitation to act?
      </p>
      <div className="comparison-columns">
        <div>
          <h3>Recorded continuation</h3>
          {query.isPending && <p>Opening the record…</p>}
          {query.isError && <p role="alert">{query.error.message}</p>}
          {recorded.length === 0 && !query.isPending && (
            <p>No later recorded turns in this thread.</p>
          )}
          {recorded.map((m) => (
            <HistoricalMessage key={m.id} message={m} />
          ))}
        </div>
        <div>
          <h3>Generated branch</h3>
          {generated.length === 0 && (
            <p className="empty-state">
              Begin a branch to place its continuation beside the record.
            </p>
          )}
          {generated.map((m) => (
            <BranchMessage
              key={m.id}
              message={m}
              onInspect={() => onInspect(m)}
            />
          ))}
        </div>
      </div>
      {generated.length > 0 && (
        <details className="comparison-lenses">
          <summary>Observe recurring language</summary>
          <p>Shared words: {shared.join(", ") || "none in this excerpt"}.</p>
          <small>
            This is a literal vocabulary overlap, not a psychological or causal
            assessment. Compare practical detail, mythic framing, confidence,
            and references to prior disclosures as you read.
          </small>
        </details>
      )}
    </section>
  );
}
