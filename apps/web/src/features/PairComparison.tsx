import { MessageText } from "./ConversationReader";
import type { PendingPair } from "../useBranch";
import type {
  ContextComposition,
  ContextPair,
  PairWithholding,
} from "../types";
interface ConditionView {
  label: "A" | "B";
  generation_id: string;
  composition: ContextComposition;
  status: string;
  body: string;
}
interface PairView {
  visitor: string;
  withheld: PairWithholding;
  difference: ContextPair["difference"];
  conditions: ConditionView[];
  pending: boolean;
}
const branchOrigins = ["visitor", "generated"];
// Segment counts share one scale so the kept span lines up across A and B.
function segments(view: PairView, label: "A" | "B") {
  const { removed, added } = view.difference;
  const c = view.conditions.find((x) => x.label === label)!.composition.counts;
  const framing = c.instruction || 0;
  const branch = branchOrigins.reduce((n, o) => n + (c[o] || 0), 0);
  const total = Object.values(c).reduce((n, v) => n + v, 0);
  const own = label === "A" ? removed.length : added.length;
  return {
    framing,
    kept: total - framing - branch - own,
    removed: removed.length,
    added: added.length,
    branch,
  };
}
export function CompositionBar({
  view,
  label,
}: {
  view: PairView;
  label: "A" | "B";
}) {
  const s = segments(view, label);
  const parts =
    label === "A"
      ? [
          ["framing", s.framing],
          ["kept", s.kept],
          ["withheld", s.removed],
          ["branch", s.branch],
        ]
      : [
          ["framing", s.framing],
          ["kept", s.kept],
          ["added", s.added],
          ["gap", s.removed],
          ["branch", s.branch],
        ];
  const description =
    label === "A"
      ? `Condition A context: ${s.kept + s.removed} recorded or document items, of which ${s.removed} are withheld in B.`
      : `Condition B context: ${s.kept + s.added} recorded or document items; ${s.removed} withheld${s.added ? `, ${s.added} older items admitted by the freed budget` : ""}.`;
  return (
    <div
      className="composition-bar"
      role="img"
      aria-label={description}
      data-testid={`composition-${label}`}
    >
      {parts
        .filter(([, n]) => (n as number) > 0)
        .map(([kind, n]) => (
          <span
            key={kind as string}
            className={"segment " + kind}
            style={{ flexGrow: n as number }}
          />
        ))}
    </div>
  );
}
function withheldLabel(w: PairWithholding, tags: Record<string, string>) {
  const groups = w.excluded_tags.map((t) => tags[t] || t);
  if (w.excluded_ids.length)
    groups.push(
      `${w.excluded_ids.length} selected turn${w.excluded_ids.length === 1 ? "" : "s"}`,
    );
  return groups.join(" + ");
}
export function viewFromPair(p: ContextPair): PairView {
  return {
    visitor: p.visitor.body,
    withheld: p.withheld,
    difference: p.difference,
    pending: false,
    conditions: p.conditions.map((c) => ({
      label: c.label,
      generation_id: c.generation_id,
      composition: c.composition,
      status: c.status,
      body: c.reply?.body || "",
    })),
  };
}
export function viewFromPending(p: PendingPair): PairView | null {
  if (!p.start) return null;
  return {
    visitor: p.visitor,
    withheld: p.start.withheld,
    difference: p.start.difference,
    pending: true,
    conditions: p.start.conditions.map((c) => ({
      label: c.label,
      generation_id: c.generation_id,
      composition: c.composition,
      status: p.conditions[c.label].status,
      body: p.conditions[c.label].text,
    })),
  };
}
const statusLabel: Record<string, string> = {
  pending: "waiting",
  streaming: "streaming",
  completed: "simulation",
  failed: "failed · not a reply",
  refused: "provider refusal · not a reply",
  cancelled: "cancelled",
};
export function PairComparison({
  view,
  tags,
  onInspect,
}: {
  view: PairView;
  tags: Record<string, string>;
  onInspect: (generationId: string) => void;
}) {
  const withheld = withheldLabel(view.withheld, tags);
  const { removed, added } = view.difference;
  const recordedRemoved = removed.filter((r) => r.origin === "historical");
  return (
    <section
      className="context-pair"
      aria-label="Paired context comparison"
      data-testid="context-pair"
    >
      <article
        className="branch-message visitor"
        aria-label="Visitor intervention"
      >
        <div className="message-meta">
          <strong>You</strong>
          <span>Visitor intervention · held fixed for both contexts</span>
        </div>
        <MessageText body={view.visitor} />
      </article>
      <p className="pair-summary">
        Same turn, model, and settings. B withholds <strong>{withheld}</strong>:{" "}
        {recordedRemoved.length} recorded turn
        {recordedRemoved.length === 1 ? "" : "s"}
        {removed.length > recordedRemoved.length &&
          ` and ${removed.length - recordedRemoved.length} other item${removed.length - recordedRemoved.length === 1 ? "" : "s"}`}{" "}
        removed
        {added.length > 0 &&
          `; ${added.length} older item${added.length === 1 ? "" : "s"} admitted by the freed budget`}
        .
      </p>
      <div className="pair-columns">
        {view.conditions.map((c) => (
          <div
            className="pair-condition"
            key={c.label}
            data-testid={`condition-${c.label}`}
          >
            <h3>
              <span className="condition-label">{c.label}</span>
              {c.label === "A" ? "Current selection" : `Without ${withheld}`}
            </h3>
            <CompositionBar view={view} label={c.label} />
            <p className="fine composition-facts">
              {c.composition.item_count} items ·{" "}
              {c.composition.token_estimate.toLocaleString()} est. tokens ·{" "}
              <code title={c.composition.hash}>
                {c.composition.hash.slice(0, 12)}
              </code>
            </p>
            <article
              className={
                "branch-message generated" +
                (c.status === "completed" || c.status === "streaming"
                  ? ""
                  : " incomplete")
              }
              aria-label={`Generated reply, condition ${c.label}`}
            >
              <div className="message-meta">
                <strong>Companion</strong>
                <span>Generated · {statusLabel[c.status] || c.status}</span>
              </div>
              <div aria-live={view.pending ? "polite" : undefined}>
                <MessageText
                  body={
                    c.body ||
                    (view.pending
                      ? "The companion is considering this context…"
                      : "No reply was produced under this condition.")
                  }
                />
              </div>
              {!view.pending && (
                <button
                  className="text-button"
                  onClick={() => onInspect(c.generation_id)}
                >
                  Inspect receipt {c.label}
                </button>
              )}
            </article>
          </div>
        ))}
      </div>
      <ul className="composition-legend fine" aria-label="Composition key">
        <li>
          <i className="segment framing" /> Framing
        </li>
        <li>
          <i className="segment kept" /> Shared recorded context
        </li>
        <li>
          <i className="segment withheld" />
          <i className="segment gap" /> Present in A, withheld in B
        </li>
        {added.length > 0 && (
          <li>
            <i className="segment added" /> Admitted in B by freed budget
          </li>
        )}
        <li>
          <i className="segment branch" /> Your turns and earlier replies
        </li>
      </ul>
    </section>
  );
}
