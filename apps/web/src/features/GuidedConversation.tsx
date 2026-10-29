import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CornerDownLeft } from "lucide-react";
import { api, dateLabel } from "../api";
import type {
  Anchor,
  Experience,
  HistoricalMessage,
  Position,
  Thread,
  ThreadPage,
} from "../types";
import { useExperience } from "../store";
import type { useBranch } from "../useBranch";
import { RecordStatus } from "./RecordStatus";
import { MessageText } from "./ConversationReader";
import { BranchConversation } from "./BranchComposer";
import { ContextWorkbench } from "./ContextWorkbench";
import { ReadAloud } from "./ReadAloud";
import type { SpokenMessage } from "./ReadAloud";

type Props = {
  experience: Experience;
  anchors: Anchor[];
  threads: Thread[];
  position?: Position;
  branch: ReturnType<typeof useBranch>;
  onSelect: (id: string, anchor?: string) => Promise<void>;
  onAdvanced: () => void;
};
export function GuidedConversation({
  experience,
  anchors,
  threads,
  position,
  branch,
  onSelect,
  onAdvanced,
}: Props) {
  const s = useExperience();
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const contextButton = useRef<HTMLButtonElement>(null);
  const [context, setContext] = useState(false);
  const [inserted, setInserted] = useState<HistoricalMessage>();
  const [notice, setNotice] = useState("");
  const [earlier, setEarlier] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const history = useQuery({
    queryKey: ["guided-history", s.entry, position?.thread_id],
    enabled: !!position,
    queryFn: () =>
      api<ThreadPage>(
        `/threads/${position!.thread_id}?around=${s.entry}&limit=6`,
      ),
  });
  const future = useQuery({
    queryKey: ["guided-next", s.entry],
    queryFn: () =>
      api<HistoricalMessage[]>(`/continuations/${s.entry}?limit=1`),
  });
  const thread = threads.find((t) => t.id === position?.thread_id);
  const cutoff = history.data?.messages.find((m) => m.id === s.entry);
  const recorded = (history.data?.messages || []).filter(
    (m) => m.sequence <= (position?.sequence ?? -1),
  );
  const shown = earlier ? recorded : recorded.slice(-2);
  const next = future.data?.[0];
  const lastBranch = branch.branch?.messages.at(-1)?.id;
  useEffect(() => {
    setInserted(undefined);
    setNotice("");
    setEarlier(false);
    scroll.current?.scrollTo({ top: 0 });
  }, [s.entry]);
  useEffect(() => {
    if (lastBranch)
      requestAnimationFrame(() =>
        document
          .getElementById("guided-compose")
          ?.scrollIntoView({ block: "end", behavior: "instant" }),
      );
  }, [lastBranch]);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    const fit = () => {
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight}px`;
    };
    fit();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth;
        fit();
      }
    });
    observer.observe(field);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [s.text]);
  const spoken = useMemo<SpokenMessage[]>(
    () => [
      ...shown.map((m) => ({
        id: m.id,
        body: m.body,
        label: `${m.speaker === "human" ? experience.profile.human_label : "Companion"} · Recorded`,
      })),
      ...(branch.branch?.messages || []).map((m) => ({
        id: m.id,
        body: m.body,
        branch_id: branch.branch!.id,
        label:
          m.speaker === "visitor"
            ? "You · Visitor Reply"
            : "Companion · Generated Reply",
      })),
    ],
    [
      history.data,
      earlier,
      position?.sequence,
      branch.branch,
      experience.profile.human_label,
    ],
  );
  const threadIndex = threads.findIndex((t) => t.id === thread?.id);
  const neighborStart = Math.max(
    0,
    Math.min(threadIndex - 1, threads.length - 3),
  );
  const neighbors = threads.slice(neighborStart, neighborStart + 3);
  const roadmap = useRef<HTMLElement>(null);
  const navigating = useRef(false);
  const focusStop = useRef<string | null>(null);
  useEffect(() => {
    if (advancing || focusStop.current !== thread?.id) return;
    focusStop.current = null;
    roadmap.current
      ?.querySelector<HTMLButtonElement>("[aria-current='step']")
      ?.focus();
  }, [thread?.id, advancing]);
  async function moveJourney(direction: number) {
    const target = threads[threadIndex + direction];
    if (!target || branch.busy || advancing || navigating.current) return;
    navigating.current = true;
    focusStop.current = target.id;
    setAdvancing(true);
    try {
      await onSelect(target.entry_message_id);
    } catch {
      focusStop.current = null;
      setNotice("This journey stop could not be opened. Please try again.");
    } finally {
      navigating.current = false;
      setAdvancing(false);
    }
  }
  const original =
    !!inserted && inserted.body === s.text && !branch.branch?.exchange_count;
  const limit =
    (branch.branch?.exchange_count || 0) >=
    experience.profile.branch_turn_limit;
  const submit = async () => {
    if (!s.text.trim() || branch.busy || advancing || limit) return;
    if (original) {
      setAdvancing(true);
      try {
        await onSelect(inserted!.id);
      } finally {
        setAdvancing(false);
      }
    } else {
      s.setPairMode(false);
      void branch.submit();
    }
  };
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`guided-experience ${context ? "context-visible" : ""}`}
    >
      <div className="guided-scroll" ref={scroll}>
        <div className="guided-layout">
          <nav
            ref={roadmap}
            className="guided-roadmap"
            aria-label="The Journey Roadmap"
            onKeyDown={(e) => {
              if (
                !(e.target as HTMLElement).closest(
                  ".journey-stops, .journey-navigation",
                )
              )
                return;
              if (
                e.altKey ||
                e.ctrlKey ||
                e.metaKey ||
                !["ArrowLeft", "ArrowRight"].includes(e.key)
              )
                return;
              e.preventDefault();
              void moveJourney(e.key === "ArrowRight" ? 1 : -1);
            }}
          >
            <div className="journey-heading">
              <h2>The Journey</h2>
              <div
                className="journey-navigation"
                role="group"
                aria-label="Journey navigation"
              >
                {threadIndex > 0 && (
                  <button
                    type="button"
                    aria-label="Previous Journey Stop"
                    aria-keyshortcuts="ArrowLeft"
                    title="Previous Journey Stop (Left Arrow)"
                    disabled={branch.busy || advancing}
                    onClick={() => void moveJourney(-1)}
                  >
                    <kbd>←</kbd> Previous
                  </button>
                )}
                {threadIndex >= 0 && threadIndex < threads.length - 1 && (
                  <button
                    type="button"
                    aria-label="Next Journey Stop"
                    aria-keyshortcuts="ArrowRight"
                    title="Next Journey Stop (Right Arrow)"
                    disabled={branch.busy || advancing}
                    onClick={() => void moveJourney(1)}
                  >
                    Next <kbd>→</kbd>
                  </button>
                )}
              </div>
            </div>
            <div className="journey-stops">
              {neighborStart > 0 && (
                <span
                  role="img"
                  className="journey-overflow before"
                  aria-label={`${neighborStart} earlier journey stops`}
                >
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <ol>
                {neighbors.map((t) => (
                  <li
                    key={t.id}
                    className={t.id === thread?.id ? "current" : ""}
                  >
                    <button
                      aria-current={t.id === thread?.id ? "step" : undefined}
                      disabled={branch.busy || advancing}
                      onClick={() => void onSelect(t.entry_message_id)}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ol>
              {neighborStart + neighbors.length < threads.length && (
                <span
                  role="img"
                  className="journey-overflow after"
                  aria-label={`${threads.length - neighborStart - neighbors.length} later journey stops`}
                >
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
            <div className="roadmap-actions">
              <button
                ref={contextButton}
                aria-expanded={context}
                aria-controls="guided-context"
                onClick={() => setContext(!context)}
              >
                Explore Context
              </button>
              <details>
                <summary>All Journey Stops</summary>
                <div className="journey-menu">
                  {anchors.map((a) => (
                    <button
                      key={a.id}
                      disabled={branch.busy || advancing}
                      onClick={() => void onSelect(a.entry_message_id, a.id)}
                    >
                      {a.title}
                    </button>
                  ))}
                  <label>
                    Conversation
                    <select
                      aria-label="Choose Conversation"
                      value={thread?.id || ""}
                      disabled={branch.busy || advancing}
                      onChange={(e) => {
                        const t = threads.find((t) => t.id === e.target.value);
                        if (t) void onSelect(t.entry_message_id);
                      }}
                    >
                      {threads.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
            </div>
          </nav>
          <div className="guided-reading">
            <header className="guided-title">
              <h1>{thread?.title || "Opening the record…"}</h1>
              <p>
                {dateLabel(thread?.start_at || null, true)}
                {thread?.place ? ` · ${thread.place}` : ""}
              </p>
            </header>
            <span className="sr-only" aria-live="polite">
              {thread?.title}
            </span>
            {history.isPending && (
              <p role="status">Opening the recorded conversation…</p>
            )}
            {(history.isError || future.isError) && (
              <p role="alert">
                Could not open this conversation.{" "}
                <button
                  onClick={() => {
                    void history.refetch();
                    void future.refetch();
                  }}
                >
                  Try Again
                </button>
              </p>
            )}
            {recorded.length > 2 && (
              <button
                className="earlier-turns"
                onClick={() => setEarlier(!earlier)}
              >
                {earlier ? "Show Recent Exchange" : "Read Earlier Turns"}
              </button>
            )}
            {shown.map((m) => (
              <article
                key={m.id}
                className={`guided-message ${m.speaker === "human" ? "human" : "machine"}`}
                aria-label={`${m.speaker === "human" ? experience.profile.human_label : "Companion"}, recorded turn ${m.sequence + 1}`}
              >
                <div className="guided-byline">
                  <span>
                    {m.speaker === "human"
                      ? experience.profile.human_label
                      : "Companion"}
                  </span>
                  <RecordStatus
                    sequence={m.sequence}
                    reviewed={m.review_status === "reviewed"}
                  />
                </div>
                <div className="guided-message-box">
                  <MessageText body={m.body} />
                  <details className="guided-source">
                    <summary>Source</summary>
                    <small>
                      {m.provenance.source_path.split("/").at(-1)} ·{" "}
                      {m.provenance.locator}
                    </small>
                  </details>
                </div>
              </article>
            ))}
            {(branch.branch || branch.busy || branch.pendingText) && (
              <BranchConversation
                branch={branch.branch}
                busy={branch.busy}
                streamText={branch.streamText}
                pendingText={branch.pendingText}
                pendingPair={branch.pendingPair}
                tags={Object.fromEntries(
                  experience.tags.map((t) => [t.id, t.label]),
                )}
                onInspect={branch.inspect}
                onExport={branch.exportBranch}
                onRefresh={branch.refresh}
              />
            )}
            {branch.error && <p role="alert">{branch.error}</p>}
            <form
              id="guided-compose"
              className="guided-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="guided-invitation">
                <label htmlFor="guided-reply">
                  Enter the journey with your own reply...
                </label>
                {next && !branch.branch?.exchange_count && (
                  <button
                    type="button"
                    className="original-link"
                    disabled={branch.busy || advancing}
                    onClick={() => {
                      setInserted(next);
                      s.setText(next.body);
                      setNotice(
                        "Original text inserted. You can edit it before sending.",
                      );
                      input.current?.focus();
                    }}
                  >
                    or continue with the original...
                  </button>
                )}
              </div>
              <div className="guided-input-surface">
                <div
                  className="guided-input-wrap"
                  data-empty={!s.text}
                  data-hidden={hidden}
                >
                  <textarea
                    ref={input}
                    id="guided-reply"
                    rows={1}
                    maxLength={24000}
                    value={s.text}
                    disabled={branch.busy || limit || advancing}
                    onChange={(e) => s.setText(e.target.value)}
                    placeholder="What if I..."
                    aria-describedby="guided-reply-note"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                  />
                  <div className="guided-placeholders" aria-hidden="true">
                    {[
                      "What if I...",
                      "I wonder whether...",
                      "Perhaps we could...",
                    ].map((text, i) => (
                      <span
                        style={{ animationDelay: `${i * 2.5}s` }}
                        key={text}
                      >
                        {text}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="guided-send-row">
                  <small id="guided-reply-note">
                    {original
                      ? `Recorded ${inserted?.speaker === "human" ? "Human" : "Companion"} Turn · Send advances the record`
                      : s.settings.provider === "demo"
                        ? "Demo · Your reply creates a new branch"
                        : `Live · ${s.settings.provider} · Your reply creates a new branch`}
                  </small>
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      !s.text.trim() || branch.busy || advancing || limit
                    }
                  >
                    {branch.busy
                      ? "Generating…"
                      : advancing
                        ? "Opening…"
                        : limit
                          ? "Branch Complete"
                          : "Send"}
                    <kbd title="Command or Control + Enter">
                      <CornerDownLeft size={16} />
                    </kbd>
                  </button>
                </div>
              </div>
              <p className="sr-only" role="status">
                {notice}
              </p>
              {!next && !future.isPending && !future.isError && (
                <small>
                  The recorded thread ends here. You can continue with your own
                  reply.
                </small>
              )}
            </form>
            <div className="guided-tools">
              <button onClick={onAdvanced}>
                Compare, Search & More <ArrowRight size={14} />
              </button>
              {branch.branch && (
                <button onClick={() => void branch.reset()}>
                  Delete Branch & Its Audio
                </button>
              )}
              <small>
                {branch.branch?.exchange_count || 0} /{" "}
                {experience.profile.branch_turn_limit} Exchanges
              </small>
            </div>
          </div>
          {context && (
            <aside
              id="guided-context"
              className="guided-context"
              aria-label="Journey Context"
            >
              <button
                className="close-context"
                onClick={() => {
                  setContext(false);
                  contextButton.current?.focus();
                }}
              >
                Close Context ×
              </button>
              <ContextWorkbench
                experience={experience}
                cutoff={cutoff}
                manifest={branch.preview}
                previewError={branch.previewError}
                onPreview={branch.previewContext}
                busy={branch.busy}
                onRestart={async () => {
                  await branch.reset();
                  s.setText("");
                }}
              />
            </aside>
          )}
        </div>
      </div>
      <ReadAloud messages={spoken} scope={s.entry} />
    </main>
  );
}
