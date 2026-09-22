import React, { useEffect, useMemo, useRef, useState } from "react";
import MemoryChart from "./MemoryChart";
import Inspector from "./Inspector";
import { conditionName, eventName, getJSON, number, title } from "./data";

function Select({ label, value, onChange, children }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
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
  const isScript = data?.suite.kind === "script-path";
  const isPath = isScript || data?.suite.kind === "path-tracing";
  useEffect(() => {
    document.title = isPath ? "Path-Tracing Results" : "Counterfactual Results";
  }, [isPath]);
  const seeds = [
    ...new Set(
      cases.filter((c) => !event || c.event === event).map((c) => c.seed),
    ),
  ];
  return (
    <main className={reader ? "result-reader-mode" : ""}>
      <header className="page-header">
        <div>
          <h1>
            {reader
              ? "Simulation Result"
              : isPath
                ? "Path-Tracing Results"
                : "Counterfactual Results"}
          </h1>
          <p>
            {isPath
              ? "Simulated dialogue between two recorded events."
              : "Simulated conversations at three intervention points."}
          </p>
          {reader && (
            <a
              className="text-button"
              href={`?run=${encodeURIComponent(run)}&case=${encodeURIComponent(selected)}`}
            >
              ← All Results
            </a>
          )}
        </div>
        <div className="run-controls">
          <select
            aria-label="Result Run"
            value={run}
            onChange={(e) => setRun(e.target.value)}
          >
            {catalog.map((r) => (
              <option key={r.id} value={r.id}>
                {title(r.id)}
                {r.offline ? " · Offline" : ""}
              </option>
            ))}
          </select>
          <button
            className="text-button"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>
      {currentRun?.offline && (
        <p className="notice">
          Offline fixtures only. These responses test orchestration and do not
          contain model inference.
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Try Again
          </button>
        </div>
      )}
      {loading && (
        <p className="loading" role="status">
          Loading saved results…
        </p>
      )}
      {!loading && !error && !catalog.length && (
        <p className="empty">
          No saved experiment runs were found. Execute a counterfactual suite to
          create results.
        </p>
      )}
      {data && (
        <>
          {!reader && (
            <>
              <section className="metrics" aria-label="Filtered Result Summary">
                <div>
                  <strong>{number(filtered.length)}</strong>
                  <span>Scenarios</span>
                </div>
                <div>
                  <strong>
                    {number(
                      filtered.reduce(
                        (n, c) => n + (c.metrics.completed_turns || 0),
                        0,
                      ),
                    )}
                  </strong>
                  <span>Simulated Turns</span>
                </div>
                <div>
                  <strong>{providers.size}</strong>
                  <span>Providers</span>
                </div>
                <div>
                  <strong>
                    {filtered.filter((c) => c.status === "completed").length} /{" "}
                    {filtered.length}
                  </strong>
                  <span>Completed</span>
                </div>
              </section>
              {isPath ? (
                <section
                  className="path-overview"
                  aria-label="Path-Tracing Design"
                >
                  <h2>Two Anchors, An Invented Path</h2>
                  <p>
                    {isScript
                      ? "One or two agents bridge recorded events using dialogue, retrospective annotations, or parsed timelines. Fixed-length and model-selected stopping conditions are compared; safety caps remain explicit."
                      : `The recorded dialogue inside each gap is withheld. ${data.suite.exchanges * 2} generated turns lead toward a fixed later endpoint; completion does not establish a successful handoff.`}
                  </p>
                  <div className="path-pairs">
                    {[...new Set(filtered.map((c) => c.event))].map((id) => {
                      const rows = filtered.filter((c) => c.event === id);
                      const gap = rows.find((c) => c.path)?.path.gap_turns;
                      return (
                        <div key={id}>
                          <strong>{eventName(id)}</strong>
                          <span>
                            {number(gap)} source turns in gap ·{" "}
                            {
                              rows.filter((c) => c.status === "completed")
                                .length
                            }
                            /{rows.length} completed
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="caption">
                    {isScript
                      ? "Annotated conditions deliberately expose hindsight"
                      : `${new Set(data.suite.conditions.map((c) => c.endpoint_policy)).size} endpoint strategies`}{" "}
                    · {data.suite.conditions.length} conditions. Handoff reviews
                    are model critiques, not validated quality scores.
                  </p>
                </section>
              ) : (
                <MemoryChart cases={cases} event={event} seed={seed} />
              )}
              <div className="filters">
                <Select
                  label={isPath ? "Interval" : "Event"}
                  value={event}
                  onChange={(value) => {
                    setEvent(value);
                    setSeed("");
                  }}
                >
                  <option value="">All Events</option>
                  {[...new Set(cases.map((c) => c.event))].map((id) => (
                    <option key={id} value={id}>
                      {eventName(id)}
                    </option>
                  ))}
                </Select>
                <Select label="Seed" value={seed} onChange={setSeed}>
                  <option value="">All Seeds</option>
                  {seeds.map((id) => (
                    <option key={id} value={id}>
                      {title(id)}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Condition"
                  value={condition}
                  onChange={setCondition}
                >
                  <option value="">All Conditions</option>
                  {[...new Set(cases.map((c) => c.condition))].map((id) => (
                    <option key={id} value={id}>
                      {conditionName(id)}
                    </option>
                  ))}
                </Select>
                <label className="filter search">
                  <span>Search</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search scenarios…"
                  />
                </label>
              </div>
            </>
          )}
          <div className="workspace">
            {!reader && (
              <section className="case-browser" aria-label="Scenarios">
                <div className="list-heading">
                  <span>Event</span>
                  <span>Condition</span>
                  <button
                    onClick={() => setSort((v) => (v === 1 ? -1 : 1))}
                    aria-label={`Sort by input ${sort === 1 ? "descending" : "ascending"}`}
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
                              <small>
                                {title(c.seed)}
                                {c.repetition ? ` · ${c.repetition + 1}` : ""}
                              </small>
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
                      <p>No scenarios match these filters.</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEvent("");
                          setSeed("");
                          setCondition("");
                          setQuery("");
                        }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
                <footer aria-live="polite">
                  {filtered.length} of {cases.length} scenarios · input is a
                  byte bound
                </footer>
              </section>
            )}
            <Inspector
              run={run}
              selected={selected}
              cases={cases}
              reader={reader}
            />
          </div>
          <p className="page-note">
            Private local results · Read-only · {data.content_version}
          </p>
        </>
      )}
    </main>
  );
}
