import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import Setup from "./Setup";
import ResultViewer from "./ResultViewer";
import ViewSettings, { SIZES, modelColor, useViewSettings } from "./ViewSettings";
import {
  caseURL,
  conditionName,
  comparisonCondition,
  eventName,
  getJSON,
  number,
  title,
} from "./data";

function Prose({ children }) {
  return (
    <div className="prose">
      <Markdown
        skipHtml
        components={{
          img: () => null,
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {children || ""}
      </Markdown>
    </div>
  );
}
function References({ ids = [] }) {
  return ids.length ? (
    <details className="references">
      <summary>{number(ids.length)} sources</summary>
      <pre>{ids.join("\n")}</pre>
    </details>
  ) : null;
}
function Anchor({ record, label }) {
  return (
    <details className="anchor-source">
      <summary>
        {label} · {record.speaker === "human" ? "Traveler" : "Companion"} ·{" "}
        {record.disclosed_at}
      </summary>
      <Prose>{record.body}</Prose>
    </details>
  );
}
function Path({ data }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [data.run_id]);
  const path = data.path,
    current = data.context_steps[step],
    spec = data.experiment_spec;
  return (
    <div className="path-view">
      <p className="note">
        {number(path.gap_ids.length)} recorded turns withheld
        {spec?.blind_gap === false ? "; annotations expose hindsight" : ""}.
      </p>
      <Anchor record={path.start} label="Start" />
      <Anchor record={path.endpoint} label="End" />
      {spec ? (
        <p className="note">
          {title(spec.architecture)} · {spec.length_policy} length ·{" "}
          {number(data.turns.length)} turns · ended by{" "}
          {(data.completion_reason || "unknown").replace(/[-_]/g, " ")}
        </p>
      ) : (
        <section>
          <h3>Endpoint visibility</h3>
          <div className="exposure-strip" aria-label="Endpoint exposure">
            {data.context_steps.map((s, i) => (
              <button
                key={i}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
                className={s.path?.endpoint_visible ? "exposed" : "withheld"}
                title={s.path?.endpoint_visible ? "Endpoint in this request" : "Endpoint withheld"}
                aria-label={`Turn ${i + 1}, ${s.actor}, endpoint ${s.path?.endpoint_visible ? "visible" : "withheld"}`}
              >
                <strong>{i + 1}</strong>
                <span>{s.actor === "traveler" ? "T" : "C"}</span>
              </button>
            ))}
          </div>
          {current && (
            <div className="path-turn">
              <Prose>{data.turns[step]?.text || "No completed turn."}</Prose>
            </div>
          )}
        </section>
      )}
      {path.plan && (
        <section>
          <h3>Waypoints</h3>
          <Prose>{path.plan.text}</Prose>
          <References ids={path.plan.source_ids} />
        </section>
      )}
      <section>
        <h3>Critique</h3>
        {path.review ? (
          <Prose>{path.review.text}</Prose>
        ) : (
          <p className="note">
            {title(path.review_status || "missing")}
            {path.review_error ? `: ${path.review_error}` : ""}
          </p>
        )}
      </section>
    </div>
  );
}
function Dialogue({ data, label }) {
  const [view] = useViewSettings();
  const chat = view.layout === "chat";
  const model = (t) => data.calls.find((c) => c.id === t.call_id)?.settings.model || "";
  return (
    <section
      className={`dialogue ${chat ? "rv-chat" : ""}`}
      aria-label={label}
      style={{
        "--rv-size": `${SIZES[view.size] - 2}px`,
        "--rv-font": view.font === "sans" ? "Inter, sans-serif" : "Georgia, serif",
      }}
    >
      <h3 className="comparison-label">{label}</h3>
      {data.turns.length ? (
        data.turns.map((t, index) => {
          const color = view.colorBy === "model" ? modelColor(model(t)) : t.actor === "traveler" ? "#e7ebf0" : "#2f6fd6";
          const light = view.colorBy === "speaker" && t.actor === "traveler";
          return chat ? (
            <article className={`rv-turn from-${t.actor}`} key={t.id} style={{ "--turn-color": color, "--turn-ink": light ? "#17202e" : "#fff" }}>
              <div className="rv-bubble">
                <Prose>{t.text}</Prose>
              </div>
            </article>
          ) : (
            <article className="turn" key={t.id} style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
              <h3>
                {title(t.actor)} {view.numbers && <span>{index + 1}</span>}
              </h3>
              <Prose>{t.text}</Prose>
            </article>
          );
        })
      ) : (
        <p className="empty">No completed turns.</p>
      )}
    </section>
  );
}
function Compare({ data, baseline, error, baseLabel }) {
  return (
    <>
      <div className="compare-bar">
        {baseline && (
          <p className="comparison-metrics">
            Mean input {number(data.metrics.mean_dialogue_input_bound)} vs.{" "}
            {number(baseline.metrics.mean_dialogue_input_bound)} bytes
          </p>
        )}
        <ViewSettings />
      </div>
      <div className="dialogue-columns">
        <Dialogue data={data} label={conditionName(data.case.condition.id)} />
        {baseline ? (
          <Dialogue data={baseline} label={baseLabel} />
        ) : (
          <p role={error ? "alert" : "status"}>{error || "Loading…"}</p>
        )}
      </div>
    </>
  );
}
function Context({ data }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [data.run_id]);
  const current = data.context_steps[step];
  const condition = data.case.condition;
  const facts = [
    ["Memory", condition.memory && title(condition.memory)],
    ["Character", condition.persona && title(condition.persona)],
    [data.path ? "Endpoint" : "Future", title(data.path?.policy || condition.forward || "")],
    ["History turns", number(data.historical_ids.length)],
    ["Future messages", data.metrics.future_cards_exposed || null],
    ["Retrieval changes", data.metrics.retrieval_changes || null],
    ["Branch compactions", data.metrics.branch_compactions || null],
    ["Hindsight sources", data.metrics.retrospective_persona_sources || null],
  ].filter(([, value]) => value);
  const anyCards = data.context_steps.some((s) => s.cards?.length || s.adaptation);
  return (
    <div className="context-view">
      <dl className="facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {data.persona.text && (
        <section>
          <h3>Character sketch</h3>
          <Prose>{data.persona.text}</Prose>
          <References ids={data.persona.source_ids} />
        </section>
      )}
      {data.memories.length > 0 && (
        <section>
          <h3>Derived memory</h3>
          {data.memories.map((m, index) => (
            <details className="memory-entry" key={m.id}>
              <summary>
                {title(m.method)} {index + 1}
              </summary>
              <Prose>{m.text}</Prose>
              <References ids={m.source_ids} />
            </details>
          ))}
        </section>
      )}
      {anyCards && (
        <section>
          <div className="section-heading">
            <h3>Future material</h3>
            <select
              aria-label="Context turn"
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
            >
              {data.context_steps.map((s, i) => (
                <option key={i} value={i}>
                  Turn {i + 1} · {s.actor}
                </option>
              ))}
            </select>
          </div>
          {current?.cards?.length ? (
            current.cards.map((card) => (
              <article className="future-card" key={card.id}>
                <div className="caption">
                  {card.disclosed_at || "Undated"} · {card.speaker}
                </div>
                <Prose>{card.body}</Prose>
                <details>
                  <summary>Why retrieved</summary>
                  <p className="caption">
                    {card.matched_terms?.join(", ")} · score {card.score}
                    {card.excerpted ? " · excerpt" : ""}
                  </p>
                  <code>{card.id}</code>
                </details>
              </article>
            ))
          ) : (
            <p className="caption">None for this turn.</p>
          )}
          {current?.adaptation && (
            <article className="future-card">
              <h4>Adaptation</h4>
              <Prose>{current.adaptation.text}</Prose>
            </article>
          )}
        </section>
      )}
    </div>
  );
}
function Receipts({ data, run }) {
  const [selected, setSelected] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setSelected("");
    setReceipt(null);
    setError("");
  }, [data.run_id]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setReceipt(null);
    setError("");
    getJSON(
      `${caseURL(run, data.run_id)}/receipts/${selected}`,
      controller.signal,
    )
      .then(setReceipt)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [selected, data.run_id, run]);
  return (
    <div className="receipt-view">
      <div className="section-heading">
        <span className="caption">
          {data.calls.length} requests
          {data.preserved_attempts > 0 ? ` · ${data.preserved_attempts} failed attempt saved` : ""}
        </span>
        <a
          className="text-button"
          href={`${caseURL(run, data.run_id)}/download`}
        >
          Download JSON
        </a>
      </div>
      <div className="receipt-list">
        {data.calls.map((c, i) => (
          <button
            key={`${c.id}-${i}`}
            className={`receipt-row ${selected === c.id ? "active" : ""}`}
            onClick={() => setSelected(c.id)}
            aria-pressed={selected === c.id}
          >
            <span>
              <strong>{title(c.purpose)}</strong>
              <small>
                {c.metadata.resolved_model || c.settings.model}
                {c.cache_hit ? " · shared" : ""}
              </small>
            </span>
            <span>
              {number(c.input_bound)}
              <small>
                {c.status === "completed" ? "" : `${c.status} · `}
                {c.elapsed_seconds.toFixed(1)}s
                {c.retries ? ` · ${c.retries} retry` : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {selected && !receipt && !error && <p role="status">Loading…</p>}
      {receipt && (
        <section className="receipt-detail">
          <p className="caption">
            {receipt.status} ·{" "}
            {receipt.metadata.finish_reason || receipt.error?.category || "unknown finish"}
          </p>
          <details open>
            <summary>Response</summary>
            <Prose>{receipt.text || "No text."}</Prose>
          </details>
          <details>
            <summary>Request{receipt.display_projection ? " (aliased)" : ""}</summary>
            <pre>{JSON.stringify(receipt.request_payload, null, 2)}</pre>
          </details>
          <details>
            <summary>Manifest</summary>
            <pre>{JSON.stringify(receipt.manifest, null, 2)}</pre>
          </details>
          {receipt.previous_attempts?.map((a, i) => (
            <details key={a.id}>
              <summary>
                Attempt {i + 1} · {a.error?.category || a.status}
              </summary>
              <Prose>{a.text || "No text."}</Prose>
              <pre>{JSON.stringify(a.metadata, null, 2)}</pre>
            </details>
          ))}
          <p className="caption hash-line" title={receipt.display_payload_hash ? `Displayed: ${receipt.display_payload_hash}` : undefined}>
            SHA-256 <code>{receipt.payload_hash}</code>
          </p>
        </section>
      )}
    </div>
  );
}

export default function Inspector({ run, selected, cases, reader = false }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const [tab, setTab] = useState("Dialogue");
  const [focusedCallId, setFocusedCallId] = useState("");
  const [baseline, setBaseline] = useState(null),
    [compareError, setCompareError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    setBaseline(null);
    setFocusedCallId("");
    if (!selected) return;
    const controller = new AbortController();
    getJSON(caseURL(run, selected), controller.signal)
      .then((result) => {
        setData(result);
        setTab((t) => (t === "Compare" || t === "Path" ? "Dialogue" : t));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [run, selected]);
  const row = cases.find((c) => c.id === selected);
  const baselineRow =
    row &&
    cases.find(
      (c) =>
        c.condition === comparisonCondition(row, data?.kind) &&
        c.event === row.event &&
        c.seed === row.seed &&
        c.repetition === row.repetition &&
        c.status === "completed",
    );
  const comparable = baselineRow && baselineRow.id !== row?.id;
  useEffect(() => {
    setBaseline(null);
    setCompareError("");
    if (tab !== "Compare" || !comparable) return;
    const controller = new AbortController();
    getJSON(caseURL(run, baselineRow.id), controller.signal)
      .then(setBaseline)
      .catch((e) => {
        if (e.name !== "AbortError") setCompareError(e.message);
      });
    return () => controller.abort();
  }, [tab, comparable, baselineRow?.id, run]);
  if (!selected)
    return <section className="inspector empty">Select a case.</section>;
  if (error)
    return (
      <section className="inspector empty" role="alert">
        {error}
      </section>
    );
  if (!data)
    return (
      <section className="inspector empty" role="status">
        Loading…
      </section>
    );
  const index = cases.findIndex((c) => c.id === selected);
  const link = (id) =>
    `?run=${encodeURIComponent(run)}&case=${encodeURIComponent(id)}&reader=1`;
  const tabs = [
    "Dialogue",
    ...(comparable ? ["Compare"] : []),
    ...(data.path ? ["Path"] : []),
    "Context",
    "Setup",
    "Requests",
  ];
  return (
    <section className="inspector" aria-label="Case">
      <header className="inspector-heading">
        <div>
          <p className="eyebrow">
            {eventName(data.case.event.id)}
            {data.case.repetition ? ` · run ${data.case.repetition + 1}` : ""}
            {data.offline ? " · offline fixture" : ""}
          </p>
          <h2>{conditionName(data.case.condition.id)}</h2>
        </div>
        {reader ? (
          <nav className="rv-case-nav" aria-label="Result navigation">
            {index > 0 && (
              <a className="text-button" href={link(cases[index - 1].id)}>
                ← Previous
              </a>
            )}
            <span>
              {index + 1} / {cases.length}
            </span>
            {index < cases.length - 1 && (
              <a className="text-button" href={link(cases[index + 1].id)}>
                Next →
              </a>
            )}
          </nav>
        ) : (
          <a className="text-button" href={link(data.run_id)}>
            Open ↗
          </a>
        )}
      </header>
      <div className="tabs" role="tablist" aria-label="Case details">
        {tabs.map((t) => (
          <button
            id={`tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="detail-panel"
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        className="inspector-scroll"
        id="detail-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {data.status !== "completed" && (
          <p className="error" role="alert">
            {title(data.status)}
            {data.error?.detail || data.error?.category
              ? `: ${data.error.detail || data.error.category}`
              : ""}
          </p>
        )}
        {tab === "Dialogue" && (
          <ResultViewer
            data={data}
            run={run}
            onSetup={(id) => {
              setFocusedCallId(id);
              setTab("Setup");
            }}
          />
        )}
        {tab === "Compare" && comparable && (
          <Compare data={data} baseline={baseline} error={compareError} baseLabel={conditionName(baselineRow.condition)} />
        )}
        {tab === "Setup" && (
          <Setup data={data} run={run} initialCallId={focusedCallId} />
        )}
        {tab === "Path" && data.path && <Path data={data} />}
        {tab === "Context" && <Context data={data} />}
        {tab === "Requests" && <Receipts data={data} run={run} />}
      </div>
    </section>
  );
}
