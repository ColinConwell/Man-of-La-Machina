import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type {
  HistoricalMessage as Message,
  Position,
  ThreadPage,
} from "../types";
import { api } from "../api";
export function MessageText({
  body,
  collapsible = false,
}: {
  body: string;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = collapsible && body.length > 1800;
  return (
    <div>
      <div className={"message-body " + (long && !expanded ? "collapsed" : "")}>
        <ReactMarkdown
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            img: ({ alt }) => <span>[Source image reference: {alt}]</span>,
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
      {long && (
        <button
          className="text-button expand-text"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse passage" : "Read full passage"}{" "}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  );
}
export function HistoricalMessage({
  message,
  selected = false,
  onSelect,
  rangeAction,
}: {
  message: Message;
  selected?: boolean;
  onSelect?: (id: string) => void;
  rangeAction?: (id: string, end: boolean) => void;
}) {
  const name =
    message.speaker === "beaven"
      ? "Beaven"
      : message.speaker === "mirrows"
        ? "Copilot / Mirrows"
        : "Unresolved speaker";
  return (
    <article
      className={"historical-message " + (selected ? "at-cutoff" : "")}
      id={"turn-" + message.id}
      aria-label={`${name}, recorded turn ${message.sequence + 1}`}
    >
      <div className="message-meta">
        <strong>{name}</strong>
        <span>Recorded · {message.sequence + 1}</span>
        {message.review_status !== "reviewed" && (
          <small>Unreviewed source</small>
        )}
      </div>
      <div className="message-content">
        <MessageText body={message.body} collapsible />
        <div className="message-actions">
          {onSelect && (
            <button
              className={selected ? "cutoff-label" : "text-button"}
              onClick={() => onSelect(message.id)}
            >
              {selected ? "Selected cutoff" : "Enter here"}{" "}
              {!selected && <ArrowRight size={13} />}
            </button>
          )}
          <details className="provenance">
            <summary>Source</summary>
            <small>
              {message.provenance.source_path.split("/").at(-1)}
              <br />
              {message.provenance.locator}
              <br />
              Disclosed: {message.disclosed_at || "Unknown"} ·{" "}
              {message.time_precision} precision
              <br />
              {message.provenance.text_kind} ·{" "}
              {message.content_hash.slice(0, 12)}
            </small>
          </details>
          {rangeAction && (
            <details className="range-actions">
              <summary>Range</summary>
              <button onClick={() => rangeAction(message.id, false)}>
                Set range start
              </button>
              <button onClick={() => rangeAction(message.id, true)}>
                Set range end
              </button>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
export function ConversationReader({
  position,
  onSelect,
  onMessage,
  rangeAction,
}: {
  position: Position;
  onSelect: (id: string) => void;
  onMessage: (m: Message) => void;
  rangeAction: (id: string, end: boolean) => void;
}) {
  const [items, setItems] = useState<Message[]>([]);
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFuture, setShowFuture] = useState(false);
  const root = useRef<HTMLElement>(null);
  const focused = useRef("");
  const query = useQuery({
    queryKey: ["thread", position.thread_id, position.message_id],
    queryFn: () =>
      api<ThreadPage>(
        `/threads/${position.thread_id}?around=${position.message_id}&limit=6`,
      ),
  });
  useEffect(() => {
    if (query.data) {
      setItems(query.data.messages);
      const m = query.data.messages.find((m) => m.id === position.message_id);
      if (m) onMessage(m);
      setShowFuture(false);
    }
  }, [query.data, position.message_id, onMessage]);
  useEffect(() => {
    if (items.length && focused.current !== position.message_id) {
      focused.current = position.message_id;
      const target = root.current?.querySelector<HTMLElement>(".at-cutoff");
      const scroller = root.current?.closest(".reading-surface");
      if (target && scroller && window.innerWidth > 640)
        scroller.scrollTop =
          target.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          12;
    }
  }, [position.message_id, items.length]);
  async function load(older: boolean) {
    setLoading(true);
    setPageError("");
    try {
      const page = await api<ThreadPage>(
        `/threads/${position.thread_id}?${older ? "before=" + items[0].sequence : "after=" + items.at(-1)!.sequence}&limit=6`,
      );
      const scroller = root.current?.closest(".reading-surface");
      const height = scroller?.scrollHeight || 0;
      const top = scroller?.scrollTop || 0;
      setItems((old) =>
        older ? [...page.messages, ...old] : [...old, ...page.messages],
      );
      if (older && scroller)
        requestAnimationFrame(() => {
          scroller.scrollTop = top + scroller.scrollHeight - height;
        });
    } catch (e) {
      setPageError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const visible = items.filter(
    (m) => showFuture || m.sequence <= position.sequence,
  );
  return (
    <section
      ref={root}
      aria-label="Recorded history"
      className="conversation-reader"
    >
      {query.isPending && <p className="empty-state">Opening the record…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {items[0]?.sequence > 0 && (
        <button
          className="load-history"
          disabled={loading}
          onClick={() => load(true)}
        >
          Read earlier turns
        </button>
      )}
      {visible.map((m) => (
        <HistoricalMessage
          key={m.id}
          message={m}
          selected={m.id === position.message_id}
          onSelect={onSelect}
          rangeAction={rangeAction}
        />
      ))}
      {items.length > 0 && (
        <div className="cutoff-rule">
          <span>The branch begins at turn {position.sequence + 1}.</span>
          <small>Reading ahead does not change what the model knows.</small>
        </div>
      )}
      {!showFuture ? (
        <button
          className="text-button reveal-history"
          onClick={() => setShowFuture(true)}
        >
          Reveal recorded continuation <ArrowRight size={15} />
        </button>
      ) : (
        items.at(-1)!.sequence < (query.data?.total || 0) - 1 && (
          <button
            className="load-history"
            disabled={loading}
            onClick={() => load(false)}
          >
            Continue reading history
          </button>
        )
      )}
      {pageError && <p role="alert">{pageError}</p>}
    </section>
  );
}
