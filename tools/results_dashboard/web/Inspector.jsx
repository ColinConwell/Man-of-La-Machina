import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import Setup from "./Setup";
import EventPlayback from "./EventPlayback";
import ResultViewer from "./ResultViewer";
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
      <summary>{number(ids.length)} Source References</summary>
      <pre>{ids.join("\n")}</pre>
    </details>
  ) : null;
}
function Anchor({ record, label }) {
  return (
    <details className="anchor-source">
      <summary>
        {label} · {record.disclosed_at} ·{" "}
        {record.speaker === "human" ? "Traveler" : "Companion"}
      </summary>
      <p className="caption">Recorded source, not generated dialogue.</p>
      <Prose>{record.body}</Prose>
      <References ids={[record.id]} />
    </details>
  );
}
function Path({ data }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [data.run_id]);
  const path = data.path,
    current = data.context_steps[step];
  return (
    <div className="path-view">
      <EventPlayback data={data} />
      <h3>Recorded Anchors</h3>
      <Anchor record={path.start} label="Starting Event" />
      <Anchor record={path.endpoint} label="Fixed Later Endpoint" />
      <p className="note">
        {number(path.gap_ids.length)} recorded turns fall inside this gap.{" "}
        {data.experiment_spec?.blind_gap === false
          ? "Retrospective annotations are exposed in this condition; the gap is not a blind holdout."
          : "These turns were withheld from the actors, planner, and reviewer."}{" "}
        The endpoint is a target supplied according to the selected strategy.
        The generated turns are selected moments, not a continuous transcript of
        the whole interval.
      </p>
      <section>
        <h3>
          {data.experiment_spec
            ? "Script Stopping and Endpoint"
            : "Endpoint Visibility by Turn"}
        </h3>
        {data.experiment_spec ? (
          <>
            <p className="note">
              {title(data.experiment_spec.architecture)} ·{" "}
              {title(data.experiment_spec.length_policy)} length ·{" "}
              {number(data.turns.length)} simulated turns ·{" "}
              {title(data.completion_reason || "Not Recorded")}
            </p>
            <p className="caption">
              The terminal dialogue is supplied as a target. Inspect Setup to
              see the exact endpoint and context delivered in each request. The
              safety limit is separate from model-selected stopping.
            </p>
          </>
        ) : (
          <>
            <p className="caption">
              Filled cells received the endpoint directly. Either character may
              convey it through subsequent dialogue.
            </p>
            <div className="exposure-strip" aria-label="Endpoint Exposure">
              {data.context_steps.map((s, i) => (
                <button
                  key={i}
                  aria-pressed={step === i}
                  onClick={() => setStep(i)}
                  className={s.path?.endpoint_visible ? "exposed" : "withheld"}
                  aria-label={`Turn ${i + 1}, ${s.actor}, endpoint ${s.path?.endpoint_visible ? "visible" : "withheld"}`}
                >
                  <strong>{i + 1}</strong>
                  <span>{s.actor === "traveler" ? "T" : "C"}</span>
                </button>
              ))}
            </div>
            {current && (
              <div className="path-turn">
                <p className="caption">
                  Turn {step + 1} · {title(current.actor)} · Endpoint{" "}
                  {current.path?.endpoint_visible
                    ? "Directly Visible"
                    : "Withheld"}
                </p>
                <Prose>
                  {data.turns[step]?.text ||
                    "This request did not produce a completed turn. See its receipt."}
                </Prose>
              </div>
            )}
          </>
        )}
      </section>
      <section>
        <h3>Backward Waypoints</h3>
        {path.plan ? (
          <>
            <Prose>{path.plan.text}</Prose>
            <References ids={path.plan.source_ids} />
          </>
        ) : (
          <p className="caption">
            No advance waypoint plan was supplied in this condition.
          </p>
        )}
      </section>
      <section>
        <h3>Model Handoff Review</h3>
        <p className="caption">
          A separate builder call critiques the completed bridge. It cannot
          establish historical accuracy or character fidelity.
        </p>
        {path.review ? (
          <Prose>{path.review.text}</Prose>
        ) : (
          <p className="note">
            Review {path.review_status}.{" "}
            {path.review_error || "No completed assessment is available."}
          </p>
        )}
      </section>
    </div>
  );
}
function Dialogue({ data, label }) {
  return (
    <section className="dialogue" aria-label={label}>
      {label && <h3 className="comparison-label">{label}</h3>}
      {data.turns.length ? (
        data.turns.map((t, index) => (
          <article className="turn" key={t.id}>
            <h3>
              {title(t.actor)} <span>· Simulated · {index + 1}</span>
            </h3>
            <Prose>{t.text}</Prose>
          </article>
        ))
      ) : (
        <p className="empty">
          No completed dialogue turns were saved for this case.
        </p>
      )}
    </section>
  );
}
function Context({ data }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [data.run_id]);
  const current = data.context_steps[step];
  return (
    <div className="context-view">
      <dl className="facts">
        <div>
          <dt>Memory</dt>
          <dd>{title(data.case.condition.memory)}</dd>
        </div>
        <div>
          <dt>Character Evidence</dt>
          <dd>{title(data.case.condition.persona)}</dd>
        </div>
        <div>
          <dt>{data.path ? "Endpoint Policy" : "Future Insertion"}</dt>
          <dd>{title(data.path?.policy || data.case.condition.forward)}</dd>
        </div>
        <div>
          <dt>Historical Turns</dt>
          <dd>{number(data.historical_ids.length)}</dd>
        </div>
        <div>
          <dt>Future Messages Used</dt>
          <dd>{number(data.metrics.future_cards_exposed)}</dd>
        </div>
        <div>
          <dt>Retrieval Changes</dt>
          <dd>{number(data.metrics.retrieval_changes)}</dd>
        </div>
        <div>
          <dt>Branch Compactions</dt>
          <dd>{number(data.metrics.branch_compactions)}</dd>
        </div>
        <div>
          <dt>Retrospective Persona Sources</dt>
          <dd>{number(data.metrics.retrospective_persona_sources)}</dd>
        </div>
      </dl>
      <section>
        <h3>Character Sketch</h3>
        <p className="caption">
          Inferred characterization supplied directly to the Traveler.
        </p>
        <Prose>
          {data.persona.text || "No character sketch was completed."}
        </Prose>
        <References ids={data.persona.source_ids} />
        {data.persona.future_source_ids?.length > 0 && (
          <p className="note">
            Includes {data.persona.future_source_ids.length} retrospective
            source references.
          </p>
        )}
      </section>
      <section>
        <h3>Derived Memory</h3>
        {data.memories.length ? (
          data.memories.map((m, index) => (
            <details className="memory-entry" key={m.id}>
              <summary>
                {title(m.method)} · {index + 1}
              </summary>
              <Prose>{m.text}</Prose>
              <References ids={m.source_ids} />
            </details>
          ))
        ) : (
          <p className="caption">No derived memory was used in this case.</p>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>Future Material by Turn</h3>
          <select
            aria-label="Context Turn"
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          >
            {data.context_steps.map((s, i) => (
              <option key={i} value={i}>
                {i + 1} · {title(s.actor)}
              </option>
            ))}
          </select>
        </div>
        {current?.cards?.length ? (
          current.cards.map((card) => (
            <article className="future-card" key={card.id}>
              <div className="caption">
                Out of sequence · {card.disclosed_at || "Disclosure unknown"} ·{" "}
                {card.speaker}
              </div>
              <Prose>{card.body}</Prose>
              <details>
                <summary>Retrieval Evidence</summary>
                <p className="caption">
                  Shared terms: {card.matched_terms?.join(", ")}. Score:{" "}
                  {card.score}.{" "}
                  {card.excerpted
                    ? "Excerpted source."
                    : "Complete source turn."}
                </p>
                <code>{card.id}</code>
              </details>
            </article>
          ))
        ) : (
          <p className="caption">
            No future material was inserted for this turn.
          </p>
        )}
        {current?.adaptation && (
          <article className="future-card">
            <h4>Hypothetical Adaptation</h4>
            <Prose>{current.adaptation.text}</Prose>
          </article>
        )}
        {current?.path && (
          <p className="note">
            Endpoint{" "}
            {current.path.endpoint_visible ? "directly supplied" : "withheld"}{" "}
            for this turn. Inspect the Path tab for the anchor and disclosure
            schedule.
          </p>
        )}
      </section>
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
        <p className="caption">
          Exact requests, preparation calls, and retained retry attempts.
        </p>
        <a
          className="text-button"
          href={`${caseURL(run, data.run_id)}/download`}
        >
          Download Case JSON
        </a>
      </div>
      {data.preserved_attempts > 0 && (
        <p className="note">
          {data.preserved_attempts} earlier failed case receipt is preserved in
          this run’s local attempts directory.
        </p>
      )}
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
                {c.settings.provider} ·{" "}
                {c.metadata.resolved_model || c.settings.model}
                {c.cache_hit ? " · shared preparation" : ""}
              </small>
            </span>
            <span>
              {number(c.input_bound)}
              <small>
                {c.status} · {c.elapsed_seconds.toFixed(1)}s
                {c.retries ? ` · ${c.retries} retry` : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {selected && !receipt && !error && <p role="status">Loading receipt…</p>}
      {receipt && (
        <section className="receipt-detail">
          <h3>Receipt Details</h3>
          <dl className="facts">
            <div>
              <dt>Status</dt>
              <dd>{receipt.status}</dd>
            </div>
            <div>
              <dt>Completion</dt>
              <dd>
                {receipt.metadata.finish_reason ||
                  receipt.error?.category ||
                  "Unknown"}
              </dd>
            </div>
          </dl>
          {receipt.display_projection && (
            <p className="note">{receipt.display_projection.note}</p>
          )}
          <p className="caption">Original Saved Payload SHA-256</p>
          <code className="hash">{receipt.payload_hash}</code>
          {receipt.display_payload_hash && (
            <>
              <p className="caption">Displayed Payload SHA-256</p>
              <code className="hash">{receipt.display_payload_hash}</code>
            </>
          )}
          <details>
            <summary>
              {receipt.display_projection
                ? "Provider Request With Display Aliases"
                : "Exact Provider Request"}
            </summary>
            <pre>{JSON.stringify(receipt.request_payload, null, 2)}</pre>
          </details>
          <details>
            <summary>Context Manifest and Source References</summary>
            <pre>{JSON.stringify(receipt.manifest, null, 2)}</pre>
          </details>
          <details>
            <summary>Response Text</summary>
            <Prose>{receipt.text || "No response text was received."}</Prose>
          </details>
          {receipt.previous_attempts?.map((a, i) => (
            <details key={a.id}>
              <summary>
                Prior Attempt {i + 1} · {a.error?.category || a.status}
              </summary>
              <Prose>{a.text || "No visible text was received."}</Prose>
              <pre>{JSON.stringify(a.metadata, null, 2)}</pre>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

export default function Inspector({ run, selected, cases, reader = false }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const [tab, setTab] = useState("Viewer"),
    [compare, setCompare] = useState(false);
  const [focusedCallId, setFocusedCallId] = useState("");
  const [baseline, setBaseline] = useState(null),
    [compareError, setCompareError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    setCompare(false);
    setBaseline(null);
    setFocusedCallId("");
    if (!selected) return;
    const controller = new AbortController();
    getJSON(caseURL(run, selected), controller.signal)
      .then((result) => {
        setData(result);
        setTab("Viewer");
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
  useEffect(() => {
    setBaseline(null);
    setCompareError("");
    if (!compare || !baselineRow) return;
    const controller = new AbortController();
    getJSON(caseURL(run, baselineRow.id), controller.signal)
      .then(setBaseline)
      .catch((e) => {
        if (e.name !== "AbortError") setCompareError(e.message);
      });
    return () => controller.abort();
  }, [compare, baselineRow?.id, run]);
  if (!selected)
    return (
      <section className="inspector empty">
        Select a scenario to inspect its results.
      </section>
    );
  if (error)
    return (
      <section className="inspector empty" role="alert">
        {error}
      </section>
    );
  if (!data)
    return (
      <section className="inspector empty" role="status">
        Loading scenario…
      </section>
    );
  const metrics = data.metrics;
  return (
    <section className="inspector" aria-label="Scenario Inspector">
      <header className="inspector-heading">
        <div>
          <h2>
            {eventName(data.case.event.id)} ·{" "}
            {conditionName(data.case.condition.id)}
          </h2>
          <p>
            Seed: {title(data.case.seed.id)}
            {data.case.repetition
              ? ` · Repetition ${data.case.repetition + 1}`
              : ""}
          </p>
        </div>
        <div className="result-actions">
          {!reader && (
            <a
              className="open-result"
              href={`?run=${encodeURIComponent(run)}&case=${encodeURIComponent(data.run_id)}&reader=1`}
            >
              Open Result ↗
            </a>
          )}
          {reader && (
            <nav className="rv-case-nav" aria-label="Result Navigation">
              {cases.findIndex((c) => c.id === selected) > 0 && (
                <a
                  className="text-button"
                  href={`?run=${encodeURIComponent(run)}&case=${encodeURIComponent(cases[cases.findIndex((c) => c.id === selected) - 1].id)}&reader=1`}
                >
                  ← Previous Result
                </a>
              )}
              <span>
                {cases.findIndex((c) => c.id === selected) + 1} / {cases.length}
              </span>
              {cases.findIndex((c) => c.id === selected) < cases.length - 1 && (
                <a
                  className="text-button"
                  href={`?run=${encodeURIComponent(run)}&case=${encodeURIComponent(cases[cases.findIndex((c) => c.id === selected) + 1].id)}&reader=1`}
                >
                  Next Result →
                </a>
              )}
            </nav>
          )}
          <button
            className="text-button"
            disabled={!baselineRow || row.id === baselineRow.id}
            onClick={() => {
              setCompare((v) => !v);
              setTab("Dialogue");
            }}
          >
            {compare
              ? "Close Comparison"
              : data.kind === "script-path"
                ? "Compare With Adaptive Dialogue"
                : data.path
                  ? "Compare With Upfront"
                  : "Compare With Baseline"}
          </button>
        </div>
      </header>
      <div className="tabs" role="tablist" aria-label="Scenario Details">
        {[
          "Viewer",
          "Setup",
          ...(data.path ? ["Path"] : []),
          "Dialogue",
          "Context",
          "Receipts",
        ].map((t) => (
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
            {title(data.status)}:{" "}
            {data.error?.detail ||
              data.error?.category ||
              "See receipts for details."}{" "}
            Partial responses remain in their receipts.
          </p>
        )}
        {tab === "Viewer" && (
          <ResultViewer
            data={data}
            run={run}
            onSetup={(id) => {
              setFocusedCallId(id);
              setTab("Setup");
            }}
          />
        )}
        {tab === "Dialogue" && (
          <>
            <EventPlayback data={data} />
            <div className="intervention">
              <h3>
                {data.path ? "Bridge Instruction" : "Original Intervention"}
              </h3>
              <p>{data.case.seed.prompt}</p>
            </div>
            {data.path && (
              <div className="dialogue-anchors">
                <Anchor record={data.path.start} label="Starting Event" />
                <p className="caption">
                  The following turns are invented. Their target endpoint
                  appears after the bridge.
                </p>
              </div>
            )}
            <p className="model-line">
              {data.experiment_spec?.architecture === "single-author"
                ? "Script Author"
                : "Traveler"}
              : {data.case.condition.traveler.model}
              {data.experiment_spec?.architecture !== "single-author" && (
                <> · Companion: {data.case.condition.companion.model}</>
              )}
            </p>
            {compare && (
              <p className="comparison-metrics">
                Mean input: {number(metrics.mean_dialogue_input_bound)}
                {baseline &&
                  ` · Baseline: ${number(baseline.metrics.mean_dialogue_input_bound)}`}{" "}
                · Same event, seed, and repetition.
              </p>
            )}
            <div className={compare ? "dialogue-columns" : ""}>
              <Dialogue
                data={data}
                label={
                  compare ? conditionName(data.case.condition.id) : undefined
                }
              />
              {compare &&
                (baseline ? (
                  <Dialogue
                    data={baseline}
                    label={
                      data.kind === "script-path"
                        ? "Adaptive Dialogue"
                        : data.path
                          ? "Endpoint Upfront"
                          : "Baseline"
                    }
                  />
                ) : (
                  <p role={compareError ? "alert" : "status"}>
                    {compareError || "Loading baseline…"}
                  </p>
                ))}
            </div>
            {data.path && (
              <div className="dialogue-anchors">
                <Anchor
                  record={data.path.endpoint}
                  label="Fixed Later Endpoint"
                />
              </div>
            )}
          </>
        )}
        {tab === "Setup" && (
          <Setup data={data} run={run} initialCallId={focusedCallId} />
        )}
        {tab === "Path" && data.path && <Path data={data} />}
        {tab === "Context" && <Context data={data} />}
        {tab === "Receipts" && <Receipts data={data} run={run} />}
      </div>
      <footer>
        These experiments measure context behavior, not character fidelity.
      </footer>
    </section>
  );
}
