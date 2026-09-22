import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import {
  caseURL,
  conditionName,
  eventName,
  getJSON,
  number,
  title,
} from "./data";
import "./result-viewer.css";

function Prose({ children }) {
  return (
    <div className="rv-prose">
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
function RecordedAnchor({ record, label }) {
  if (!record) return null;
  return (
    <details className="rv-anchor">
      <summary>
        <span>{label}</span>
        <small>
          Recorded Source ·{" "}
          {record.speaker === "human" ? "Traveler" : "Companion"} ·{" "}
          {record.disclosed_at || "Disclosure Unknown"}
        </small>
      </summary>
      <Prose>{record.body}</Prose>
      <p className="caption">
        Source: {record.id}. This is recorded anchor material, not a generated
        turn.
      </p>
    </details>
  );
}
function AgentPreview({ turn, index, call, step, data, onReceipt, onSetup }) {
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [pinned, setPinned] = useState(false);
  const open = pinned || hover || focus;
  const triggerRef = useRef(null),
    previewRef = useRef(null);
  useLayoutEffect(() => {
    const node = previewRef.current,
      trigger = triggerRef.current;
    if (!open || !node || !trigger) return;
    if (node.showPopover && !node.matches(":popover-open")) node.showPopover();
    const place = () => {
      const anchor = trigger.getBoundingClientRect(),
        bounds = node.getBoundingClientRect();
      const margin = 12,
        below = innerHeight - anchor.bottom - margin;
      const top =
        below >= Math.min(bounds.height, 280)
          ? anchor.bottom + 5
          : anchor.top - bounds.height - 5;
      node.style.left = `${Math.max(margin, Math.min(innerWidth - bounds.width - margin, anchor.right - bounds.width))}px`;
      node.style.top = `${Math.max(margin, Math.min(innerHeight - bounds.height - margin, top))}px`;
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);
  const author =
    call?.purpose?.includes("script-author") ||
    data.experiment_spec?.architecture === "single-author";
  const spec = data.experiment_spec;
  const settings = call?.settings;
  return (
    <div
      className="rv-agent"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setPinned(false);
          setHover(false);
          setFocus(false);
          e.currentTarget.querySelector("button")?.blur();
        }
      }}
    >
      <button
        ref={triggerRef}
        className="rv-agent-trigger"
        aria-expanded={open}
        aria-controls={`rv-agent-${index}`}
        onClick={() => setPinned((v) => !v)}
      >
        <span>
          {author ? "Script Author" : title(turn.actor)} ·{" "}
          {settings?.provider || "Request Unavailable"}
        </span>
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <section
          ref={previewRef}
          popover="manual"
          id={`rv-agent-${index}`}
          className="rv-agent-popover"
          aria-label={`Turn ${index + 1} Agent and Setup`}
        >
          <div className="rv-popover-heading">
            <strong>
              {author
                ? "One Author, Both Characters"
                : `${title(turn.actor)} Agent`}
            </strong>
            <button
              aria-label={`Close turn ${index + 1} setup preview`}
              onClick={() => {
                setPinned(false);
                setHover(false);
                setFocus(false);
              }}
            >
              ×
            </button>
          </div>
          <p>
            {pinned
              ? "Pinned. Select the agent label again to unpin."
              : "Hover or focus previews this request. Select the label to pin."}
          </p>
          <dl>
            <div>
              <dt>Request Model</dt>
              <dd>
                {settings
                  ? `${settings.provider} / ${call.metadata?.resolved_model || settings.model}`
                  : "No linked request metadata was saved."}
              </dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>
                <code>{turn.call_id || "Not Recorded"}</code>
              </dd>
            </div>
            <div>
              <dt>Role in This Turn</dt>
              <dd>
                {title(turn.actor)} is the spoken character.
                {author ? " The same author model writes both roles." : ""}
              </dd>
            </div>
            <div>
              <dt>Context Form</dt>
              <dd>
                {spec?.representation
                  ? title(spec.representation)
                  : "Historical Dialogue"}{" "}
                · {title(data.case.condition.memory || "Not Recorded")} memory
              </dd>
            </div>
            <div>
              <dt>Character Initialization</dt>
              <dd>
                {spec
                  ? "Input-Only · No Separate Character Sketch"
                  : title(data.case.condition.persona || "Not Recorded")}
              </dd>
            </div>
            <div>
              <dt>Endpoint Exposure</dt>
              <dd>
                {step?.path
                  ? step.path.endpoint_visible
                    ? "Directly supplied in this request"
                    : "Withheld from this request"
                  : spec
                    ? "See the saved request for the exact terminal context"
                    : data.path
                      ? "See the saved request for the exact exposure"
                      : "No path endpoint"}
              </dd>
            </div>
            {step?.cards?.length > 0 && (
              <div>
                <dt>Parallel Material</dt>
                <dd>{step.cards.length} saved future-context cards</dd>
              </div>
            )}
          </dl>
          <div className="rv-preview-actions">
            <button
              disabled={!call}
              onClick={() => {
                setPinned(false);
                setHover(false);
                setFocus(false);
                onReceipt(turn.call_id);
              }}
            >
              Read Prompt and Context
            </button>
            <button disabled={!call} onClick={() => onSetup(turn.call_id)}>
              Inspect Request in Setup ↗
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
function RequestDetails({ receipt, error, loading }) {
  return (
    <section className="rv-request" aria-label="Turn Request Details">
      <h4>Prompt and Context for This Request</h4>
      {loading && <p role="status">Loading saved request…</p>}
      {error && <p role="alert">{error}</p>}
      {receipt && (
        <>
          <p className="caption">
            {receipt.display_projection?.note ||
              "These are the saved request blocks in their original order."}
          </p>
          {(receipt.manifest?.items || []).map((item, i) => (
            <details key={`${item.id}-${i}`}>
              <summary>
                {i + 1}. {title(item.role)} · {title(item.origin)}
              </summary>
              <Prose>{item.body}</Prose>
              <code>{item.id}</code>
            </details>
          ))}
          <details>
            <summary>
              {receipt.display_projection
                ? "Provider Payload With Display Aliases"
                : "Exact Provider Payload"}
            </summary>
            <pre>{JSON.stringify(receipt.request_payload, null, 2)}</pre>
          </details>
          <p className="caption">Original Saved Payload SHA-256</p>
          <code className="hash">{receipt.payload_hash}</code>
          {receipt.display_payload_hash && (
            <>
              <p className="caption">Displayed Payload SHA-256</p>
              <code className="hash">{receipt.display_payload_hash}</code>
            </>
          )}
        </>
      )}
    </section>
  );
}
export default function ResultViewer({ data, run, onSetup }) {
  const [index, setIndex] = useState(0),
    [request, setRequest] = useState(null),
    [receipt, setReceipt] = useState(null),
    [error, setError] = useState("");
  const turns = data.turns || [],
    refs = useRef([]);
  const calls = useMemo(
    () => new Map((data.calls || []).map((c) => [c.id, c])),
    [data],
  );
  useEffect(() => {
    setIndex(0);
    setRequest(null);
    setReceipt(null);
    setError("");
  }, [data.run_id]);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setReceipt(null);
    setError("");
    getJSON(
      `${caseURL(run, data.run_id)}/receipts/${encodeURIComponent(request.callId)}`,
      controller.signal,
    )
      .then(setReceipt)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [request, run, data.run_id]);
  function jump(next) {
    if (next < 0 || next >= turns.length) return;
    setIndex(next);
    refs.current[next]?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    requestAnimationFrame(() =>
      refs.current[next]?.focus({ preventScroll: true }),
    );
  }
  const author = data.experiment_spec?.architecture === "single-author";
  const usedCalls = new Set(turns.map((t) => t.call_id).filter(Boolean));
  return (
    <div className="result-viewer">
      <header className="rv-introduction">
        <p className="rv-eyebrow">
          Saved Simulation ·{" "}
          {data.offline ? "Offline Fixture" : "Model-Generated Dialogue"}
        </p>
        <h3>{eventName(data.case.event.id)}</h3>
        <p>
          {conditionName(data.case.condition.id)} ·{" "}
          {author
            ? "One script author writes both characters"
            : "Character agents exchange dialogue"}{" "}
          · {number(turns.length)} turns
        </p>
        <p className="caption">
          {usedCalls.size} dialogue request{usedCalls.size === 1 ? "" : "s"}{" "}
          linked to these turns. Character names identify the speakers; the
          agent label opens the model and request details.
        </p>
        {data.display_projection && (
          <p className="rv-alias-note">{data.display_projection.note}</p>
        )}
      </header>
      <section className="rv-instruction">
        <h4>{data.path ? "Bridge Instruction" : "Intervention Instruction"}</h4>
        <Prose>{data.case.seed.prompt}</Prose>
      </section>
      {data.path && (
        <RecordedAnchor record={data.path.start} label="Starting Anchor" />
      )}
      {!!turns.length && (
        <nav className="rv-turn-nav" aria-label="Result Turn Navigation">
          <button onClick={() => jump(index - 1)} disabled={!index}>
            ← Previous
          </button>
          <label>
            <span className="rv-sr-only">Jump to Turn</span>
            <select
              aria-label="Jump to Turn"
              value={index}
              onChange={(e) => jump(Number(e.target.value))}
            >
              {turns.map((t, i) => (
                <option value={i} key={t.id}>
                  {i + 1} / {turns.length} · {title(t.actor)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => jump(index + 1)}
            disabled={index === turns.length - 1}
          >
            Next →
          </button>
        </nav>
      )}
      <section className="rv-script" aria-label="Generated Script">
        {turns.length ? (
          turns.map((turn, i) => {
            const call = calls.get(turn.call_id);
            const step =
              (data.context_steps || []).find(
                (s) =>
                  s.call_id === turn.call_id &&
                  (s.turn_index === i || s.index === i),
              ) ||
              (data.context_steps || []).find(
                (s) =>
                  s.manifest_hash && s.manifest_hash === call?.manifest_hash,
              ) ||
              data.context_steps?.[i];
            return (
              <article
                key={turn.id || i}
                ref={(element) => (refs.current[i] = element)}
                tabIndex={-1}
                className={`rv-turn ${index === i ? "rv-current" : ""}`}
                id={`result-turn-${i + 1}`}
              >
                <header>
                  <div className="rv-speaker">
                    <span className="rv-turn-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h4>
                      {title(turn.actor)}
                      <small>Simulated Character</small>
                    </h4>
                  </div>
                  <AgentPreview
                    turn={turn}
                    index={i}
                    call={call}
                    step={step}
                    data={data}
                    onReceipt={(callId) =>
                      setRequest((value) =>
                        value?.turn === i ? null : { callId, turn: i },
                      )
                    }
                    onSetup={onSetup}
                  />
                </header>
                <Prose>{turn.text}</Prose>
                {request?.turn === i && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => setRequest(null)}
                    >
                      Close Request Details
                    </button>
                    <RequestDetails
                      receipt={receipt}
                      error={error}
                      loading={!receipt && !error}
                    />
                  </>
                )}
              </article>
            );
          })
        ) : (
          <p className="empty">
            No completed turns were saved. Inspect the request receipts for
            partial output.
          </p>
        )}
      </section>
      {data.path && (
        <RecordedAnchor
          record={data.path.endpoint}
          label="Terminal Anchor · Fixed Target"
        />
      )}
      <footer className="rv-end">
        <span>{title(data.completion_reason || data.status)}</span>
        <p>
          The dialogue above is simulated. Reaching a stopping condition does
          not establish a historically faithful or logically complete bridge.
        </p>
      </footer>
    </div>
  );
}
