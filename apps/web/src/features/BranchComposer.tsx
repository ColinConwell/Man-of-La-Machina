import { Fragment } from "react";
import { ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { useExperience } from "../store";
import type { PendingPair } from "../useBranch";
import type { Branch, BranchMessage as Message, Manifest } from "../types";
import { MessageText } from "./ConversationReader";
import {
  PairComparison,
  viewFromPair,
  viewFromPending,
} from "./PairComparison";
export function BranchMessage({
  message,
  onInspect,
}: {
  message: Message;
  onInspect: () => void;
}) {
  return (
    <article
      className={"branch-message " + message.origin}
      aria-label={
        message.origin === "visitor"
          ? "Visitor intervention"
          : "Generated model reply"
      }
    >
      <div className="message-meta">
        <strong>{message.speaker === "visitor" ? "You" : "Companion"}</strong>
        <span>
          {message.origin === "visitor"
            ? "Visitor intervention"
            : "Generated · simulation"}
        </span>
      </div>
      <MessageText body={message.body} />
      {message.speaker === "model" && (
        <button className="text-button" onClick={onInspect}>
          Inspect this turn’s receipt
        </button>
      )}
    </article>
  );
}
export function BranchConversation({
  branch,
  busy,
  streamText,
  pendingText,
  pendingPair,
  tags,
  onInspect,
  onExport,
  onRefresh,
}: {
  branch: Branch | null;
  busy: boolean;
  streamText: string;
  pendingText: string;
  pendingPair: PendingPair | null;
  tags: Record<string, string>;
  onInspect: (m: { generation_id: string }) => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  const messages = branch?.messages || [];
  const pairs = branch?.pairs || [];
  const pairsAt = (position: number) =>
    pairs
      .filter((p) => p.position === position)
      .map((p) => (
        <PairComparison
          key={p.id}
          view={viewFromPair(p)}
          tags={tags}
          onInspect={(generation_id) => onInspect({ generation_id })}
        />
      ));
  const pending = pendingPair && viewFromPending(pendingPair);
  return (
    <section
      className="branch-conversation"
      aria-label="Your counterfactual branch"
    >
      <p className="branch-explanation">
        You supply the human side. The companion’s responses are new
        simulations, each shaped by the context you choose.
      </p>
      {!messages.length && !pairs.length && !pendingText && !pendingPair && (
        <div className="empty-state">
          <h3>A pause in the record.</h3>
          <p>
            Write your intervention below to begin a different conversation.
          </p>
        </div>
      )}
      {pairsAt(0)}
      {messages.map((m, i) => (
        <Fragment key={m.id}>
          <BranchMessage message={m} onInspect={() => onInspect(m)} />
          {/* Pairs sit beside the linear branch at the point they were taken. */}
          {i % 2 === 1 && pairsAt(i + 1)}
        </Fragment>
      ))}
      {pendingPair &&
        (pending ? (
          <PairComparison view={pending} tags={tags} onInspect={() => {}} />
        ) : (
          <p className="pair-summary" role="status">
            {pendingPair.visitor}
          </p>
        ))}
      {pendingText && (
        <>
          <article className="branch-message visitor">
            <div className="message-meta">
              <strong>You</strong>
              <span>
                Visitor intervention ·{" "}
                {busy ? "in progress" : "uncommitted attempt"}
              </span>
            </div>
            <MessageText body={pendingText} />
          </article>
          <article className="branch-message generated">
            <div className="message-meta">
              <strong>Companion</strong>
              <span>
                Generated · {busy ? "streaming" : "partial / interrupted"}
              </span>
            </div>
            <div aria-live="polite" aria-atomic="false">
              <MessageText
                body={streamText || "The companion is considering the context…"}
              />
            </div>
          </article>
        </>
      )}
      {branch && (
        <div className="branch-tools">
          <button className="text-button" onClick={onExport}>
            <Download size={15} /> Export branch & receipts
          </button>
          <button className="text-button" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} /> Refresh branch
          </button>
        </div>
      )}
    </section>
  );
}
function PairControls({
  tags,
  preview,
  disabled,
}: {
  tags: { id: string; label: string }[];
  preview: Manifest | null;
  disabled: boolean;
}) {
  const { options, pairWithheld, setPairWithheld } = useExperience();
  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id);
  const candidates =
    preview?.items.filter((i) => i.origin === "historical" && !i.protected) ||
    [];
  return (
    <fieldset className="pair-controls" disabled={disabled}>
      <legend className="sr-only">Condition B also withholds</legend>
      <span aria-hidden="true">B also withholds</span>
      {tags
        .filter((t) => !options.excluded_tags.includes(t.id))
        .map((t) => (
          <label className="chip" key={t.id}>
            <input
              type="checkbox"
              checked={pairWithheld.excluded_tags.includes(t.id)}
              onChange={(e) =>
                setPairWithheld({
                  excluded_tags: toggle(
                    pairWithheld.excluded_tags,
                    t.id,
                    e.target.checked,
                  ),
                })
              }
            />
            {t.label}
          </label>
        ))}
      <details className="pair-turns">
        <summary>Turns ({pairWithheld.excluded_ids.length})</summary>
        <div className="pair-turn-list">
          {candidates.map((i) => (
            <label className="facet individual-item" key={i.id}>
              <input
                type="checkbox"
                checked={pairWithheld.excluded_ids.includes(i.id)}
                onChange={(e) =>
                  setPairWithheld({
                    excluded_ids: toggle(
                      pairWithheld.excluded_ids,
                      i.id,
                      e.target.checked,
                    ),
                  })
                }
              />
              <span>
                {i.body.slice(0, 85)}…<small>{i.id}</small>
              </span>
            </label>
          ))}
        </div>
      </details>
    </fieldset>
  );
}
// Client-side estimate from A's preview; the server computes the authoritative difference.
export function pairRemovalEstimate(
  preview: Manifest | null,
  withheld: { excluded_tags: string[]; excluded_ids: string[] },
) {
  return (
    preview?.items.filter(
      (i) =>
        !i.protected &&
        i.origin !== "instruction" &&
        (withheld.excluded_ids.includes(i.id) ||
          i.tags.some((t) => withheld.excluded_tags.includes(t))),
    ).length ?? 0
  );
}
export function BranchComposer({
  busy,
  turns,
  limit,
  tags,
  preview,
  onSubmit,
}: {
  busy: boolean;
  turns: number;
  limit: number;
  tags: { id: string; label: string }[];
  preview: Manifest | null;
  onSubmit: () => void;
}) {
  const {
    text,
    setText,
    settings,
    options,
    pairMode,
    setPairMode,
    pairWithheld,
  } = useExperience();
  const removal = pairRemovalEstimate(preview, pairWithheld);
  const pairReady = !pairMode || removal > 0;
  return (
    <form
      className="branch-composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="composer-label">
        <label htmlFor="intervention">
          {options.replace_cutoff
            ? "Rewrite the human turn"
            : "Write your next turn"}
        </label>
        <div className="reply-mode" role="radiogroup" aria-label="Reply mode">
          {(
            [
              [false, "One reply"],
              [true, "Compare two contexts"],
            ] as const
          ).map(([value, label]) => (
            <label key={label} className={pairMode === value ? "active" : ""}>
              <input
                type="radio"
                name="reply-mode"
                checked={pairMode === value}
                disabled={busy}
                onChange={() => setPairMode(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <span>
          {turns} / {limit} exchanges
        </span>
      </div>
      {pairMode && (
        <PairControls tags={tags} preview={preview} disabled={busy} />
      )}
      <textarea
        id="intervention"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What would you say here?"
        maxLength={24000}
        disabled={busy || turns >= limit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (pairReady) onSubmit();
          }
        }}
      />
      <div className="composer-bottom">
        <small>
          {settings.provider === "demo"
            ? "Demo mode · no external model"
            : "Live · " + settings.provider + " / " + settings.model}
          {pairMode && (
            <span role="status" data-testid="pair-estimate">
              {" · "}
              {removal
                ? `B withholds ${removal} item${removal === 1 ? "" : "s"} A includes · two generations, one exchange`
                : "Choose what B withholds from the current context"}
            </span>
          )}
        </small>
        <button
          className="primary"
          type="submit"
          disabled={busy || !text.trim() || turns >= limit || !pairReady}
        >
          {busy
            ? "Generating…"
            : turns >= limit
              ? "Branch complete"
              : pairMode
                ? "Generate both replies"
                : "Generate continuation"}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </form>
  );
}
