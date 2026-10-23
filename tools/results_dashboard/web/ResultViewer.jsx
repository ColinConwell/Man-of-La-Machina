import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import { caseURL, getJSON, number, title } from "./data";
import EventPlayback from "./EventPlayback";
import ViewSettings, { SIZES, modelColor, useViewSettings } from "./ViewSettings";
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
          Recorded · {record.speaker === "human" ? "Traveler" : "Companion"}
          {record.disclosed_at ? ` · ${record.disclosed_at}` : ""}
        </small>
      </summary>
      <Prose>{record.body}</Prose>
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
          {author ? "Author · " : ""}
          {call?.metadata?.resolved_model || settings?.model || "No request"}
        </span>
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <section
          ref={previewRef}
          popover="manual"
          id={`rv-agent-${index}`}
          className="rv-agent-popover"
          aria-label={`Turn ${index + 1} agent`}
        >
          <div className="rv-popover-heading">
            <strong>
              {author ? "One author writes both roles" : `${title(turn.actor)} agent`}
              {pinned ? <small> · pinned</small> : null}
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
          <dl>
            <div>
              <dt>Model</dt>
              <dd>
                {settings
                  ? `${settings.provider} / ${call.metadata?.resolved_model || settings.model}`
                  : "Not saved"}
              </dd>
            </div>
            <div>
              <dt>Context</dt>
              <dd>
                {spec?.representation ? title(spec.representation) : "Dialogue"}
                {data.case.condition.memory ? ` · ${data.case.condition.memory} memory` : ""}
              </dd>
            </div>
            {!spec && data.case.condition.persona && (
              <div>
                <dt>Character</dt>
                <dd>{title(data.case.condition.persona)}</dd>
              </div>
            )}
            {step?.path && (
              <div>
                <dt>Endpoint</dt>
                <dd>{step.path.endpoint_visible ? "Visible" : "Withheld"}</dd>
              </div>
            )}
            {step?.cards?.length > 0 && (
              <div>
                <dt>Future cards</dt>
                <dd>{step.cards.length}</dd>
              </div>
            )}
            <div>
              <dt>Request</dt>
              <dd>
                <code>{turn.call_id || "Not saved"}</code>
              </dd>
            </div>
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
              Prompt and context
            </button>
            <button disabled={!call} onClick={() => onSetup(turn.call_id)}>
              Open in Setup ↗
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
function RequestDetails({ receipt, error, loading }) {
  return (
    <section className="rv-request" aria-label="Turn request details">
      <h4>Prompt and context</h4>
      {loading && <p role="status">Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {receipt && (
        <>
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
            <summary>Provider payload{receipt.display_projection ? " (aliased)" : ""}</summary>
            <pre>{JSON.stringify(receipt.request_payload, null, 2)}</pre>
          </details>
          <p className="caption hash-line" title={receipt.display_payload_hash ? `Displayed: ${receipt.display_payload_hash}` : undefined}>
            SHA-256 <code>{receipt.payload_hash}</code>
          </p>
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
  const [view] = useViewSettings();
  const chat = view.layout === "chat";
  // Color by the requested model ID so Dialogue and Compare agree.
  const modelOf = (turn) =>
    calls.get(turn.call_id)?.settings?.model || data.case.condition[turn.actor]?.model || "";
  const colorOf = (turn) =>
    view.colorBy === "model" ? modelColor(modelOf(turn)) : turn.actor === "traveler" ? "#e7ebf0" : "#2f6fd6";
  const style = {
    "--rv-size": `${SIZES[view.size] - (chat ? 1 : 0)}px`,
    "--rv-font": view.font === "sans" ? "Inter, -apple-system, BlinkMacSystemFont, sans-serif" : 'Georgia, "Times New Roman", serif',
  };
  return (
    <div className={`result-viewer ${chat ? "rv-chat" : ""}`} style={style}>
      <div className="rv-introduction">
        <span>
          {author ? "One author" : "Two agents"} · {number(turns.length)} turns
        </span>
        {data.display_projection && (
          <span className="rv-alias-note" title={data.display_projection.note}>
            Aliased
          </span>
        )}
        <details className="rv-instruction">
          <summary>Instruction</summary>
          <Prose>{data.case.seed.prompt}</Prose>
        </details>
        <ViewSettings />
      </div>
      {view.events && <EventPlayback data={data} />}
      {data.path && view.anchors && <RecordedAnchor record={data.path.start} label="Start" />}
      {!!turns.length && !chat && (
        <nav className="rv-turn-nav" aria-label="Turn navigation">
          <button onClick={() => jump(index - 1)} disabled={!index}>
            ← Previous
          </button>
          <label>
            <span className="rv-sr-only">Jump to turn</span>
            <select
              aria-label="Jump to turn"
              value={index}
              onChange={(e) => jump(Number(e.target.value))}
            >
              {turns.map((t, i) => (
                <option value={i} key={t.id}>
                  {i + 1} / {turns.length} · {t.actor}
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
      <section className="rv-script" aria-label="Generated script">
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
            const color = colorOf(turn);
            const light = chat && view.colorBy === "speaker" && turn.actor === "traveler";
            const continued = chat && i > 0 && turns[i - 1].actor === turn.actor;
            return (
              <article
                key={turn.id || i}
                ref={(element) => (refs.current[i] = element)}
                tabIndex={-1}
                className={`rv-turn from-${turn.actor} ${index === i ? "rv-current" : ""} ${continued ? "continued" : ""}`}
                id={`result-turn-${i + 1}`}
                style={{ "--turn-color": color, "--turn-ink": light ? "#17202e" : "#fff" }}
              >
                <header>
                  <div className="rv-speaker">
                    {view.numbers && (
                      <span className="rv-turn-number">
                        {chat ? i + 1 : String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    {!continued && <h4>{title(turn.actor)}</h4>}
                  </div>
                  {view.models && <AgentPreview
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
                  />}
                </header>
                {chat ? (
                  <div className="rv-bubble">
                    <Prose>{turn.text}</Prose>
                  </div>
                ) : (
                  <Prose>{turn.text}</Prose>
                )}
                {request?.turn === i && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => setRequest(null)}
                    >
                      Close
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
          <p className="empty">No completed turns. Partial output is under Requests.</p>
        )}
      </section>
      {data.path && view.anchors && <RecordedAnchor record={data.path.endpoint} label="End" />}
      {data.completion_reason && (
        <footer className="rv-end">
          Ended by {data.completion_reason.replace(/[-_]/g, " ")}
        </footer>
      )}
    </div>
  );
}
