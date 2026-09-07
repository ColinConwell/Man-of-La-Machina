import { ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { useExperience } from "../store";
import type { Branch, BranchMessage as Message } from "../types";
import { MessageText } from "./ConversationReader";
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
  onInspect,
  onExport,
  onRefresh,
}: {
  branch: Branch | null;
  busy: boolean;
  streamText: string;
  pendingText: string;
  onInspect: (m: Message) => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  return (
    <section
      className="branch-conversation"
      aria-label="Your counterfactual branch"
    >
      <p className="branch-explanation">
        You supply the human side. The companion’s responses are new
        simulations, each shaped by the context you choose.
      </p>
      {!branch?.messages.length && !pendingText && (
        <div className="empty-state">
          <h3>A pause in the record.</h3>
          <p>
            Write your intervention below to begin a different conversation.
          </p>
        </div>
      )}
      {branch?.messages.map((m) => (
        <BranchMessage key={m.id} message={m} onInspect={() => onInspect(m)} />
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
export function BranchComposer({
  busy,
  turns,
  limit,
  onSubmit,
}: {
  busy: boolean;
  turns: number;
  limit: number;
  onSubmit: () => void;
}) {
  const { text, setText, settings, options } = useExperience();
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
        <span>
          {turns} / {limit} exchanges
        </span>
      </div>
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
            onSubmit();
          }
        }}
      />
      <div className="composer-bottom">
        <small>
          {settings.provider === "demo"
            ? "Demo mode · no external model"
            : "Live · " + settings.provider + " / " + settings.model}
        </small>
        <button
          className="primary"
          type="submit"
          disabled={busy || !text.trim() || turns >= limit}
        >
          {busy
            ? "Generating…"
            : turns >= limit
              ? "Branch complete"
              : "Generate continuation"}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </form>
  );
}
