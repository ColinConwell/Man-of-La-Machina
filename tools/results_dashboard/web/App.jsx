import React, { useEffect, useMemo, useRef, useState } from "react";
import MemoryChart from "./MemoryChart";
import Inspector from "./Inspector";
import { conditionName, eventName, getJSON, number, title } from "./data";

export default function App() {
  const [catalog, setCatalog] = useState([]),
    [run, setRun] = useState(
      () => new URLSearchParams(location.search).get("run") || "",
    );
  const [reader, setReader] = useState(
    () => new URLSearchParams(location.search).get("reader") === "1",
  );
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(""),
    [seed, setSeed] = useState(""),
    [condition, setCondition] = useState(""),
    [query, setQuery] = useState("");
  const [selected, setSelected] = useState(""),
    [sort, setSort] = useState(0),
    [refresh, setRefresh] = useState(0);
  const list = useRef(null);
  useEffect(() => {
    const restore = () => {
      const q = new URLSearchParams(location.search);
      setRun((value) => q.get("run") || value);
      setSelected(q.get("case") || "");
      setReader(q.get("reader") === "1");
      setEvent("");
      setSeed("");
      setCondition("");
      setQuery("");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    getJSON("/api/runs", controller.signal)
      .then((result) => {
        setCatalog(result.runs);
        setRun((value) =>
          result.runs.some((r) => r.id === value)
            ? value
            : result.default || "",
        );
        if (!result.runs.length) {
          setLoading(false);
          setData(null);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!run) return;
    const controller = new AbortController();
    const requestedURL = new URLSearchParams(location.search);
    const requestedCase = requestedURL.get("run") === run ? requestedURL.get("case") : "";
    setLoading(true);
    setError("");
    setData(null);
    setSelected("");
    setEvent("");
    setSeed("");
    setCondition("");
    setQuery("");
    setSort(0);
    getJSON(`/api/runs/${encodeURIComponent(run)}`, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
        setSelected(
          (
            result.cases.find((c) => c.id === requestedCase) ||
            result.cases.find(
              (c) =>
                c.event === "may-8" &&
                c.condition === "memory-compact" &&
                c.seed === "constraints" &&
                c.status === "completed",
            ) ||
            result.cases[0]
          )?.id || "",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [run, refresh]);
  const cases = data?.cases || [];
  useEffect(() => {
    if (loading || !run || !selected || !cases.some((c) => c.id === selected))
      return;
    const url = new URL(location.href);
    url.searchParams.set("run", run);
    url.searchParams.set("case", selected);
    history.replaceState(null, "", url);
  }, [run, selected, loading, cases]);
  const filtered = useMemo(() => {
    const rows = cases.filter(
      (c) =>
        (!event || c.event === event) &&
        (!seed || c.seed === seed) &&
        (!condition || c.condition === condition) &&
        `${eventName(c.event)} ${conditionName(c.condition)} ${c.seed} ${c.status} ${c.settings?.traveler.model || ""} ${c.settings?.companion.model || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (sort)
      rows.sort(
        (a, b) =>
          sort *
          ((a.metrics.mean_dialogue_input_bound ?? Infinity) -
            (b.metrics.mean_dialogue_input_bound ?? Infinity)),
      );
    return rows;
  }, [cases, event, seed, condition, query, sort]);
  useEffect(() => {
    if (loading || !data) return;
    if (!filtered.some((c) => c.id === selected))
      setSelected(filtered[0]?.id || "");
  }, [filtered, selected, loading, data]);
  useEffect(() => {
    const row = list.current?.querySelector('[aria-pressed="true"]');
    if (row) {
      const parent = list.current;
      const y =
        row.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        parent.scrollTop;
      if (
        y < parent.scrollTop ||
        y + row.offsetHeight > parent.scrollTop + parent.clientHeight
      )
        parent.scrollTop = Math.max(0, y - parent.clientHeight / 3);
    }
  }, [selected, loading]);
  const providers = new Set(
    filtered
      .flatMap((c) => [
        c.settings?.traveler.provider,
        ...(c.settings?.architecture === "single-author"
          ? []
          : [c.settings?.companion.provider]),
      ])
      .filter(Boolean),
  );
  const currentRun = catalog.find((r) => r.id === run);
  const isPath = ["script-path", "path-tracing"].includes(data?.suite.kind);
  useEffect(() => {
    document.title = reader ? "Result" : "Results";
  }, [reader]);
  const seeds = [
    ...new Set(
      cases.filter((c) => !event || c.event === event).map((c) => c.seed),
    ),
  ];
  const manySeeds = new Set(cases.map((c) => c.seed)).size > 1;
  const gap = (id) => cases.find((c) => c.event === id && c.path)?.path.gap_turns;
  const completed = filtered.filter((c) => c.status === "completed").length;
  const turns = filtered.reduce((n, c) => n + (c.metrics.completed_turns || 0), 0);
  const clear = () => {
    setEvent("");
    setSeed("");
    setCondition("");
    setQuery("");
  };
  return (
    <main className={reader ? "result-reader-mode" : ""}>
      <header className="page-header">
        <h1>{reader ? "Result" : "Results"}</h1>
        {reader ? (
          <a
            className="text-button"
            href={`?run=${encodeURIComponent(run)}&case=${encodeURIComponent(selected)}`}
          >
            ← All results
          </a>
        ) : (
          <select
            aria-label="Result run"
            value={run}
            onChange={(e) => setRun(e.target.value)}
          >
            {catalog.map((r) => (
              <option key={r.id} value={r.id}>
                {title(r.id)}
                {r.offline ? " (offline)" : ""}
              </option>
            ))}
          </select>
        )}
        {data && !reader && (
          <p className="summary" aria-label="Filtered result summary">
            {number(filtered.length)} Cases · {number(turns)} Turns ·{" "}
            {completed} of {filtered.length} Completed · {providers.size}{" "}
            {providers.size === 1 ? "Provider" : "Providers"}
            {currentRun?.offline && (
              <span className="badge" title="Offline fixtures exercise orchestration without model calls.">
                No model calls
              </span>
            )}
          </p>
        )}
        <button
          className="icon-button"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={loading}
          aria-label="Reload results"
          title="Reload results"
        >
          ↻
        </button>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {loading && (
        <p className="loading" role="status">
          Loading…
        </p>
      )}
      {!loading && !error && !catalog.length && (
        <p className="empty">No saved runs. Run an experiment suite first.</p>
      )}
      {data && (
        <>
          {!reader && (
            <div className="filters">
              <select
                aria-label={isPath ? "Interval" : "Event"}
                value={event}
                onChange={(e) => {
                  setEvent(e.target.value);
                  setSeed("");
                }}
              >
                <option value="">{isPath ? "All intervals" : "All events"}</option>
                {[...new Set(cases.map((c) => c.event))].map((id) => (
                  <option key={id} value={id}>
                    {eventName(id)}
                    {gap(id) ? ` · ${number(gap(id))}-turn gap` : ""}
                  </option>
                ))}
              </select>
              {manySeeds && (
                <select aria-label="Seed" value={seed} onChange={(e) => setSeed(e.target.value)}>
                  <option value="">All seeds</option>
                  {seeds.map((id) => (
                    <option key={id} value={id}>
                      {title(id)}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label="Condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="">All conditions</option>
                {[...new Set(cases.map((c) => c.condition))].map((id) => (
                  <option key={id} value={id}>
                    {conditionName(id)}
                  </option>
                ))}
              </select>
              <input
                type="search"
                aria-label="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
              />
              {!isPath && <MemoryChart cases={cases} event={event} seed={seed} />}
            </div>
          )}
          <div className="workspace">
            {!reader && (
              <section className="case-browser" aria-label="Cases">
                <div className="list-heading">
                  <span>{isPath ? "Interval" : "Event"}</span>
                  <span>Condition</span>
                  <button
                    onClick={() => setSort((v) => (v === 1 ? -1 : 1))}
                    aria-label={`Sort by input ${sort === 1 ? "descending" : "ascending"}`}
                    title="Mean input per dialogue request, in bytes"
                  >
                    Input{" "}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      style={{
                        transform: sort === 1 ? "rotate(180deg)" : undefined,
                      }}
                    >
                      <path
                        d="M2 4l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </button>
                </div>
                <div className="case-list" ref={list}>
                  {filtered.length ? (
                    <ul>
                      {filtered.map((c) => (
                        <li key={c.id}>
                          <button
                            className="case-row"
                            aria-pressed={selected === c.id}
                            onClick={() => setSelected(c.id)}
                          >
                            <span>
                              {eventName(c.event)}
                              {(manySeeds || c.repetition) ? (
                                <small>
                                  {manySeeds ? title(c.seed) : ""}
                                  {c.repetition ? ` · ${c.repetition + 1}` : ""}
                                </small>
                              ) : null}
                            </span>
                            <span>
                              {conditionName(c.condition)}
                              {c.status !== "completed" && (
                                <small className="failure-label">
                                  {title(c.status)}
                                </small>
                              )}
                            </span>
                            <span className="numeric">
                              {number(c.metrics.mean_dialogue_input_bound)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty">
                      <p>No matches.</p>
                      <button className="text-button" onClick={clear}>
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                {filtered.length !== cases.length && (
                  <footer aria-live="polite">
                    {filtered.length} of {cases.length}
                  </footer>
                )}
              </section>
            )}
            <Inspector
              run={run}
              selected={selected}
              cases={cases}
              reader={reader}
            />
          </div>
        </>
      )}
    </main>
  );
}
