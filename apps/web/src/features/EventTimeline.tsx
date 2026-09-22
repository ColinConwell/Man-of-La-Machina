import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { api, dateLabel } from "../api";
import type { EventTimelineData, PlainEvent } from "../types";
import "./event-timeline.css";

type Filter = "reported" | "all" | "planned" | "uncertain";
const statusLabels = {
  reported: "Reported",
  planned: "Planned",
  uncertain: "Uncertain",
};
function readState() {
  const q = new URLSearchParams(location.search);
  const raw = q.get("event-status");
  return {
    id: q.get("event") || "",
    filter: (["all", "planned", "uncertain"].includes(raw || "")
      ? raw
      : "reported") as Filter,
  };
}
function eventDate(event: PlainEvent, year = false) {
  if (!event.occurred_at) return "Occurrence date unknown";
  return (
    dateLabel(event.occurred_at, year) +
    (event.occurred_end_at && event.occurred_end_at !== event.occurred_at
      ? " – " + dateLabel(event.occurred_end_at, year)
      : "")
  );
}
function disclosureTime(value: string | null) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function EventTimeline({
  onOpenSource,
}: {
  onOpenSource: (id: string) => void | Promise<void>;
}) {
  const initial = useMemo(readState, []);
  const [selectedId, setSelectedId] = useState(initial.id);
  const [filter, setFilter] = useState<Filter>(initial.filter);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(4);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [opening, setOpening] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const indexRef = useRef<HTMLOListElement>(null);
  const query = useQuery({
    queryKey: ["event-timeline"],
    queryFn: () => api<EventTimelineData>("/event-timeline"),
    staleTime: 60_000,
  });
  const events = useMemo(
    () =>
      (query.data?.events || [])
        .map((event, originalIndex) => ({
          event,
          originalIndex,
          disclosure: disclosureTime(
            event.disclosed_at || event.disclosed_end_at,
          ),
          disclosureEnd: disclosureTime(
            event.disclosed_end_at || event.disclosed_at,
          ),
          ordinal: Math.min(...event.source_ordinals.filter(Number.isFinite)),
        }))
        .filter(({ event }) => filter === "all" || event.status === filter)
        .sort(
          (a, b) =>
            a.disclosure - b.disclosure ||
            a.disclosureEnd - b.disclosureEnd ||
            a.ordinal - b.ordinal ||
            a.originalIndex - b.originalIndex,
        )
        .map(({ event }) => event),
    [query.data, filter],
  );
  const index = Math.max(
    0,
    events.findIndex((e) => e.id === selectedId),
  );
  const selected = events[index];
  const progress = events.length > 1 ? index / (events.length - 1) : 0;
  const counts = useMemo(() => {
    const values = { reported: 0, planned: 0, uncertain: 0 };
    for (const event of query.data?.events || []) values[event.status]++;
    return values;
  }, [query.data]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReducedMotion(media.matches);
      setPlaying(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const pop = () => {
      const next = readState();
      setSelectedId(next.id);
      setFilter(next.filter);
      setPlaying(false);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const url = new URL(location.href);
    url.searchParams.set("event", selected.id);
    url.searchParams.set("event-status", filter);
    history.replaceState(null, "", url);
  }, [selected, filter]);
  useEffect(() => {
    if (!playing || events.length < 2) return;
    const timer = window.setTimeout(() => {
      if (index >= events.length - 1) setPlaying(false);
      else setSelectedId(events[index + 1].id);
    }, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, index, events, seconds]);
  useEffect(() => {
    const list = indexRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current='step']");
    if (!list || !active) return;
    const top = active.offsetTop - list.offsetTop;
    if (
      top < list.scrollTop ||
      top + active.offsetHeight > list.scrollTop + list.clientHeight
    ) {
      list.scrollTo({
        top: Math.max(0, top - list.clientHeight / 3),
        behavior: reducedMotion ? "instant" : "smooth",
      });
    }
  }, [selected?.id, reducedMotion]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  function choose(next: number) {
    setPlaying(false);
    if (events[next]) setSelectedId(events[next].id);
  }
  function changeFilter(value: Filter) {
    setPlaying(false);
    setFilter(value);
  }
  async function openSource(id: string) {
    setPlaying(false);
    setOpening(true);
    setSourceError("");
    try {
      await onOpenSource(id);
    } catch {
      setSourceError("The conversation could not be opened. Please try again.");
    } finally {
      setOpening(false);
    }
  }
  return (
    <main id="main-content" className="event-page" tabIndex={-1}>
      <header className="event-page-heading">
        <div>
          <p className="event-eyebrow">The Traveler’s Journey</p>
          <h1>Event Timeline</h1>
          <p className="event-intro">
            Plain events extracted by a model from the conversations and
            annotations. Each account remains linked to its source evidence.
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setPlaying(false);
            void query.refetch();
          }}
          disabled={query.isFetching}
        >
          <RefreshCw
            size={14}
            className={query.isFetching ? "event-refreshing" : ""}
          />
          Refresh Events
        </button>
      </header>
      {query.isPending ? (
        <section className="event-empty" aria-live="polite">
          <h2>Opening the Event Record…</h2>
          <p>Loading extracted events and their source references.</p>
        </section>
      ) : !query.data && query.isError ? (
        <section className="event-empty" role="alert">
          <h2>The Event Record Is Unavailable</h2>
          <p>{query.error.message}</p>
          <button onClick={() => query.refetch()}>Try Again</button>
        </section>
      ) : (
        query.data && (
          <>
            {(query.data.status !== "completed" || query.isError) && (
              <div className="event-notice" role="status">
                {query.isError
                  ? "Refresh failed. The previously loaded event record remains visible."
                  : query.data.status === "unavailable"
                    ? "An event extraction has not been made available for this archive yet."
                    : query.data.status === "stale"
                      ? "The saved extraction does not match this archive version. Rebuild it to inspect events from the current record."
                      : "This extraction is incomplete. The events shown cover only the processed sources."}
              </div>
            )}
            {!!query.data.events.length && (
              <div className="event-review-note">
                <span>
                  {query.data.semantic_review
                    ? query.data.semantic_review.status === "completed"
                      ? "Model Review Complete"
                      : "Model Review Partial"
                    : "Model-Extracted · Review Not Recorded"}
                </span>
                <p>
                  {query.data.semantic_review
                    ? `${query.data.semantic_review.provider} / ${query.data.semantic_review.model} reviewed the extraction. Model review does not constitute human verification.`
                    : "The extracted events have not passed a recorded semantic review and may contain interpretation errors."}
                </p>
              </div>
            )}
            <div className="event-toolbar">
              <div
                className="event-filters"
                role="group"
                aria-label="Event status"
              >
                {(["reported", "planned", "uncertain", "all"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => changeFilter(value)}
                    >
                      {value === "all" ? "All Events" : statusLabels[value]}
                      <span>
                        {value === "all"
                          ? query.data.events.length
                          : counts[value]}
                      </span>
                    </button>
                  ),
                )}
              </div>
              <span className="event-coverage">
                {typeof query.data.coverage.sources_total === "number"
                  ? `${query.data.coverage.sources_processed} / ${query.data.coverage.sources_total} sources processed`
                  : "No extraction coverage available"}
              </span>
            </div>
            {!selected ? (
              <section className="event-empty">
                <h2>No {filter === "all" ? "" : filter + " "}events to show</h2>
                <p>
                  {query.data.events.length
                    ? "Choose another status to explore the record."
                    : "No events are available. Refresh after the extraction has completed."}
                </p>
              </section>
            ) : (
              <>
                <section
                  className="event-sequence"
                  aria-label="Event sequence playback"
                >
                  <div className="event-sequence-top">
                    <p>
                      <strong>{String(index + 1).padStart(2, "0")}</strong>
                      <span> / {events.length} events</span>
                    </p>
                    <span>
                      Record sequence · spacing does not represent elapsed time
                    </span>
                  </div>
                  <div className="event-trace" aria-hidden="true">
                    <svg viewBox="0 0 1000 52" preserveAspectRatio="none">
                      <path className="event-trace-base" d="M 12 26 H 988" />
                      <path
                        className="event-trace-progress"
                        d="M 12 26 H 988"
                        pathLength="1"
                        strokeDasharray="1"
                        strokeDashoffset={1 - progress}
                      />
                      {events.map((event, i) => (
                        <line
                          key={event.id}
                          x1={12 + (976 * i) / Math.max(1, events.length - 1)}
                          x2={12 + (976 * i) / Math.max(1, events.length - 1)}
                          y1={i === index ? 13 : 21}
                          y2={i === index ? 39 : 31}
                          className={
                            (i <= index ? "reached " : "") +
                            (event.status !== "reported" ? "tentative" : "")
                          }
                        />
                      ))}
                    </svg>
                    <span
                      className="event-trace-head"
                      style={{ left: `${1.2 + 97.6 * progress}%` }}
                    />
                  </div>
                  <label className="event-scrubber">
                    <span className="sr-only">Select event in sequence</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, events.length - 1)}
                      value={index}
                      disabled={events.length < 2}
                      aria-valuetext={`Event ${index + 1}: ${selected.text}`}
                      onChange={(e) => choose(Number(e.target.value))}
                    />
                  </label>
                  <div className="event-playback">
                    <div>
                      <button
                        aria-label="Previous event"
                        onClick={() => choose(index - 1)}
                        disabled={!index}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        className="event-play"
                        onClick={() => {
                          if (playing) setPlaying(false);
                          else {
                            if (index === events.length - 1)
                              setSelectedId(events[0].id);
                            setPlaying(true);
                          }
                        }}
                        disabled={events.length < 2}
                      >
                        {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
                        {playing
                          ? "Pause"
                          : events.length > 1 && index === events.length - 1
                            ? "Replay"
                            : "Play Journey"}
                      </button>
                      <button
                        aria-label="Next event"
                        onClick={() => choose(index + 1)}
                        disabled={index >= events.length - 1}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    <label>
                      Reading Pace{" "}
                      <select
                        aria-label="Playback reading pace"
                        value={seconds}
                        onChange={(e) => setSeconds(Number(e.target.value))}
                      >
                        <option value={4}>4 seconds</option>
                        <option value={7}>7 seconds</option>
                        <option value={12}>12 seconds</option>
                      </select>
                    </label>
                  </div>
                </section>
                <div className="event-reading-layout">
                  <section className="event-detail" aria-label="Selected event">
                    <article className="event-card" key={selected.id}>
                      <div className="event-card-meta">
                        <span className={`event-status ${selected.status}`}>
                          {statusLabels[selected.status]}
                        </span>
                        <span>{eventDate(selected, true)}</span>
                      </div>
                      <h2>{selected.text}</h2>
                      <div className="event-facts">
                        {selected.place && (
                          <span>
                            <MapPin size={14} />
                            {selected.place}
                          </span>
                        )}
                        {selected.duration_text && (
                          <span>{selected.duration_text}</span>
                        )}
                      </div>
                      <p className="event-date-note">
                        {selected.occurred_at
                          ? selected.date_basis === "relative"
                            ? "Occurrence date inferred from a relative time reference."
                            : "Occurrence as dated in the source evidence."
                          : "The source does not establish an occurrence date."}{" "}
                        {selected.disclosed_at
                          ? `Disclosed ${dateLabel(selected.disclosed_at, true)}${selected.disclosed_end_at && selected.disclosed_end_at !== selected.disclosed_at ? " – " + dateLabel(selected.disclosed_end_at, true) : ""}.`
                          : "Disclosure date unknown."}
                      </p>
                      {selected.status !== "reported" && (
                        <p className="event-uncertainty">
                          {selected.status === "planned"
                            ? "This was described as a plan. The record does not establish that it happened."
                            : "This event was extracted as uncertain. Its occurrence remains unconfirmed."}
                        </p>
                      )}
                      <div className="event-evidence">
                        <h3>Source Evidence</h3>
                        <p className="fine">
                          {selected.annotation_source_ids.length
                            ? "Includes retrospective annotation evidence."
                            : "Extracted from the recorded conversation."}{" "}
                          A model-derived event is an interpretation of these
                          sources.
                        </p>
                        {selected.evidence.length ? (
                          selected.evidence.map((evidence, i) => (
                            <figure key={`${evidence.source_id}-${i}`}>
                              <blockquote>{evidence.quote}</blockquote>
                              <figcaption>
                                {selected.annotation_source_ids.includes(
                                  evidence.source_id,
                                )
                                  ? "Annotation"
                                  : "Conversation"}{" "}
                                · <code>{evidence.source_id}</code>
                              </figcaption>
                            </figure>
                          ))
                        ) : (
                          <p>
                            No evidence excerpt is available for this event.
                          </p>
                        )}
                        {selected.entry_message_id ? (
                          <button
                            className="event-source-button"
                            disabled={opening}
                            onClick={() =>
                              openSource(selected.entry_message_id!)
                            }
                          >
                            Open Source Conversation <ArrowUpRight size={15} />
                          </button>
                        ) : (
                          <p className="fine">
                            This event has no direct conversation link.
                          </p>
                        )}
                        {sourceError && <p role="alert">{sourceError}</p>}
                        <details className="event-provenance">
                          <summary>Extraction Provenance</summary>
                          <dl>
                            <div>
                              <dt>Event ID</dt>
                              <dd>{selected.id}</dd>
                            </div>
                            <div>
                              <dt>Method</dt>
                              <dd>{selected.provenance.method}</dd>
                            </div>
                            {selected.provenance.semantic_entailment && (
                              <div>
                                <dt>Evidence Review</dt>
                                <dd>
                                  {selected.provenance.semantic_entailment}
                                </dd>
                              </div>
                            )}
                            {query.data.semantic_review && (
                              <div>
                                <dt>Review Model</dt>
                                <dd>
                                  {query.data.semantic_review.provider} /{" "}
                                  {query.data.semantic_review.model} ·{" "}
                                  {query.data.semantic_review.version}
                                </dd>
                              </div>
                            )}
                            <div>
                              <dt>Source IDs</dt>
                              <dd>{selected.source_ids.join(", ")}</dd>
                            </div>
                            <div>
                              <dt>Extraction Calls</dt>
                              <dd>{selected.provenance.call_ids.join(", ")}</dd>
                            </div>
                            <div>
                              <dt>Archive Version</dt>
                              <dd>{query.data.content_version}</dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                    </article>
                  </section>
                  <nav className="event-index" aria-label="Event index">
                    <div className="event-index-heading">
                      <h2>Along the Record</h2>
                      <span>
                        {events.length} {filter === "all" ? "total" : filter}
                      </span>
                    </div>
                    <ol ref={indexRef}>
                      {events.map((event, i) => (
                        <li
                          key={event.id}
                          className={i <= index ? "event-reached" : ""}
                        >
                          <button
                            aria-current={
                              event.id === selected.id ? "step" : undefined
                            }
                            onClick={() => choose(i)}
                          >
                            <span className="event-index-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>
                              <small>
                                {eventDate(event)}
                                {event.status !== "reported" && (
                                  <> · {statusLabels[event.status]}</>
                                )}
                              </small>
                              <span className="event-index-text">
                                {event.text}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </div>
                <p className="sr-only" aria-live={playing ? "off" : "polite"}>
                  Event {index + 1} of {events.length}. {selected.text}
                </p>
              </>
            )}
            <footer className="event-method-note">
              <strong>Reading This Timeline</strong>
              <p>
                Events are extracted interpretations, not an independently
                verified travel log. Reported events, plans, and uncertainties
                remain separate. Sequence follows source disclosure dates and
                ranges, then conversation order. Undated sources appear last; an
                unknown occurrence date stays unknown. The connecting line shows
                navigation through the record, not a causal relationship.
              </p>
              <p>
                Processing every source does not establish complete event
                recall. Extraction and model review can omit events or retain
                errors; their coverage is not a measure of historical accuracy.
              </p>
              {!!query.data.extraction?.limitations?.length && (
                <details>
                  <summary>Extraction Limitations</summary>
                  {query.data.extraction.limitations.map((limitation, i) => (
                    <p key={i}>{limitation}</p>
                  ))}
                </details>
              )}
              {reducedMotion && (
                <p>
                  Reduced motion is enabled. Playback advances between static
                  event views.
                </p>
              )}
            </footer>
          </>
        )
      )}
    </main>
  );
}
