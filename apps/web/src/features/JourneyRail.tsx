import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown } from "lucide-react";
import { api, dateLabel } from "../api";
import type { Anchor, Thread } from "../types";
interface Hit {
  message_id: string;
  thread_id: string;
  title: string;
  sequence: number;
  snippet: string;
  date: string;
}
export function JourneyRail({
  anchors,
  threads,
  selected,
  onSelect,
}: {
  anchors: Anchor[];
  threads: Thread[];
  selected: string;
  onSelect: (id: string, anchor?: string) => void;
}) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const results = useQuery({
    queryKey: ["search", search],
    queryFn: () => api<Hit[]>("/search?q=" + encodeURIComponent(search)),
    enabled: search.length >= 2,
  });
  return (
    <aside className="journey-rail" aria-label="Journey navigation">
      <div className="rail-heading">
        <h2>Journey</h2>
        <span>
          {dateLabel(threads[0]?.start_at || null)} —{" "}
          {dateLabel(threads.at(-1)?.start_at || null)}
        </span>
      </div>
      <form
        className="archive-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
        }}
      >
        <label className="sr-only" htmlFor="search">
          Search the transcript
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search the transcript"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) setSearch("");
          }}
        />
        <button aria-label="Search">
          <Search size={16} />
        </button>
      </form>
      {search ? (
        <div className="search-results">
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setQ("");
            }}
          >
            Clear search
          </button>
          {results.isError && <p role="alert">Search is unavailable.</p>}
          {results.data?.length === 0 && <p>No matching passages.</p>}
          {results.data?.map((h) => (
            <button key={h.message_id} onClick={() => onSelect(h.message_id)}>
              <strong>
                {h.title} · {h.sequence + 1}
              </strong>
              <small>{h.snippet}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <ol className="landmarks">
            {anchors.map((a) => {
              const t = threads.find((t) => t.id === selected);
              const active =
                !!t &&
                a.entry_message_id.startsWith(
                  t.entry_message_id.split("-p")[0],
                );
              return (
                <li key={a.id} className={active ? "selected" : ""}>
                  <button
                    onClick={() => onSelect(a.entry_message_id, a.id)}
                    aria-current={active ? "location" : undefined}
                  >
                    <time>{dateLabel(a.start_at, true)}</time>
                    <strong>{a.title}</strong>
                    <small>{a.subtitle}</small>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            className="all-threads"
            aria-expanded={all}
            onClick={() => setAll(!all)}
          >
            All {threads.length} threads <ChevronDown size={16} />
          </button>
          {all && (
            <ol className="thread-list">
              {threads.map((t) => (
                <li key={t.id}>
                  <button onClick={() => onSelect(t.entry_message_id)}>
                    <span>
                      {t.chapter_code} · {t.title}
                    </span>
                    <small>
                      {t.message_count} turns · {dateLabel(t.start_at)}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </aside>
  );
}
