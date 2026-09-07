import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { List, ChevronLeft, ChevronRight } from "lucide-react";
import { api, dateLabel } from "../api";
import type { Timeline, Position, Experience, Cluster } from "../types";
import { useExperience } from "../store";
export function TimelineExplorer({
  experience,
  position,
  onSelect,
}: {
  experience: Experience;
  position?: Position;
  onSelect: (id: string, anchor?: string) => void;
}) {
  const { granularity, setGranularity, first, last, setRange } =
    useExperience();
  const [list, setList] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const drag = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["timeline", granularity, position?.thread_id, from, to],
    queryFn: () =>
      api<Timeline>(
        `/timeline?granularity=${granularity}&thread_id=${position?.thread_id || ""}&from=${from}&to=${to}`,
      ),
  });
  const d = query.data;
  const interval = useQuery({
    queryKey: ["interval", first, last],
    queryFn: () =>
      api<{ count: number; start_at: string; end_at: string }>(
        "/intervals/resolve",
        {
          method: "POST",
          body: JSON.stringify({
            first_message_id: first,
            last_message_id: last,
          }),
        },
      ),
    enabled: !!first && !!last,
  });
  const calendar = d?.axis === "calendar";
  const start = Date.parse(d?.bounds.start || "2026-04-01");
  const end = Date.parse(d?.bounds.end || "2026-05-19");
  const base = d?.clusters[0]?.ordinal || 0;
  const max = d?.clusters.at(-1)?.last_ordinal || 1;
  function x(c: Cluster) {
    return calendar
      ? 5 +
          90 *
            ((Date.parse(c.start_at || d!.bounds.start) - start) /
              Math.max(end - start, 1))
      : 5 + 90 * ((c.ordinal - base) / Math.max(max - base, 1));
  }
  function pan(direction: number) {
    if (!d) return;
    const levels = experience.profile.allowed_granularities;
    const idx = levels.indexOf(granularity);
    setGranularity(
      levels[Math.max(0, Math.min(levels.length - 1, idx + direction))],
    );
  }
  return (
    <section className="timeline-explorer" aria-label="Timeline explorer">
      <div className="timeline-tools">
        <div>
          <h2>Timeline</h2>
          <small>
            {d
              ? dateLabel(d.bounds.start) + " — " + dateLabel(d.bounds.end)
              : "Loading timeline"}
          </small>
        </div>
        <label>
          Resolution
          <select
            aria-label="Timeline resolution"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
          >
            {experience.profile.allowed_granularities.map((g) => (
              <option key={g} value={g}>
                {g[0].toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="zoom-buttons">
          <button aria-label="Zoom out" onClick={() => pan(-1)}>
            <ChevronLeft size={14} />
          </button>
          <button aria-label="Zoom in" onClick={() => pan(1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="timeline-main">
        {query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          <>
            <div
              className="timeline-axis"
              aria-label={
                calendar
                  ? "Chronological axis; real date spacing"
                  : "Ordinal conversation axis"
              }
            >
              <div className="axis-line" />
              {d?.clusters.map((c) => (
                <button
                  key={c.id}
                  className={
                    "density-marker " +
                    (c.artifact_count ? "has-artifacts " : "") +
                    (position &&
                    position.ordinal >= c.ordinal &&
                    position.ordinal <= c.last_ordinal
                      ? "current"
                      : "")
                  }
                  style={{
                    left: x(c) + "%",
                    height: Math.min(34, 10 + Math.sqrt(c.count) * 3),
                  }}
                  title={`${c.label} · ${c.count} turns${c.artifact_count ? ` · ${c.artifact_count} linked artifacts` : ""}`}
                  aria-label={`${c.label}, ${c.count} turns`}
                  onClick={() => onSelect(c.entry_message_id)}
                  onPointerDown={() => {
                    drag.current = c.entry_message_id;
                  }}
                  onPointerUp={() => {
                    if (drag.current && drag.current !== c.entry_message_id)
                      setRange(drag.current, c.entry_message_id);
                    drag.current = null;
                  }}
                />
              ))}
              {calendar &&
                d?.anchors.map((a, index) => (
                  <button
                    key={a.id}
                    className={
                      "anchor-marker " +
                      (a.id === useExperience.getState().anchor
                        ? "current"
                        : "")
                    }
                    style={{
                      top:
                        25 -
                        17 *
                          d.anchors
                            .slice(0, index)
                            .filter((other) => other.start_at === a.start_at)
                            .length,
                      left:
                        5 +
                        (90 * (Date.parse(a.start_at) - start)) /
                          Math.max(1, end - start) +
                        "%",
                    }}
                    title={a.title}
                    aria-label={`Anchor: ${a.title}`}
                    onClick={() => onSelect(a.entry_message_id, a.id)}
                  >
                    <span />
                  </button>
                ))}
            </div>
            <div className="axis-caption">
              <span>
                {calendar
                  ? "Calendar time · real chronological distance"
                  : "Conversation order · spacing is ordinal"}
              </span>
              <span>{d?.total_messages} turns · ◇ linked artifacts</span>
              <button
                className="text-button"
                aria-expanded={list}
                onClick={() => setList(!list)}
              >
                <List size={14} /> {list ? "Close list" : "List & range"}
              </button>
            </div>
          </>
        )}
        {list && (
          <div className="timeline-list">
            <div className="date-range">
              <label>
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Full journey
              </button>
            </div>
            <div className="range-inputs">
              <label>
                Range start
                <select
                  aria-label="Range start"
                  value={first}
                  onChange={(e) =>
                    setRange(e.target.value, last || e.target.value)
                  }
                >
                  <option value="">Select first boundary</option>
                  {d?.clusters.map((c) => (
                    <option value={c.entry_message_id} key={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Range end
                <select
                  aria-label="Range end"
                  value={last}
                  onChange={(e) =>
                    setRange(first || e.target.value, e.target.value)
                  }
                >
                  <option value="">Select last boundary</option>
                  {d?.clusters.map((c) => (
                    <option value={c.entry_message_id} key={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {interval.data && (
              <p>
                {interval.data.count} turns selected ·{" "}
                {dateLabel(interval.data.start_at)} to{" "}
                {dateLabel(interval.data.end_at)}{" "}
                <button onClick={() => onSelect(first)}>
                  Enter range start
                </button>
              </p>
            )}
            {interval.isError && <p role="alert">{interval.error.message}</p>}
            <ol>
              {d?.clusters.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onSelect(c.entry_message_id)}>
                    {dateLabel(c.start_at)} · {c.label}
                    <span>{c.count} turns</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
