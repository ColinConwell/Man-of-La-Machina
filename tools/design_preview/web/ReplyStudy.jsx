import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { CornerDownLeft, ChevronDown } from "lucide-react";

const invitations = ["What if I...", "I wonder whether...", "Perhaps we could..."];

const directions = [
  ["Challenge the Premise", "Must I choose only one path?"],
  ["Take Another Perspective", "What might my companion notice that I have overlooked?"],
  ["Follow My Curiosity", "I want to follow the unfamiliar road and see where it leads."],
];

function OriginalReply() {
  return <div className="reply-reveal"><small>Original Reply · Illustrative</small><p>“Begin with what matters to you, then consider what each path makes possible.”</p></div>;
}
function Context() {
  return <div className="reply-reveal"><small>Context · Illustrative</small><p>The traveler and companion have reached a fork in the road. Their conversation considers how to choose between a familiar route and an uncertain one.</p></div>;
}
export function ReplyDisclosure({ kind = "original", children }) {
  const label = kind === "context" ? "Explore Context" : kind === "respond" ? "Try Your Own Reply" : "Read Original Reply";
  return <details className={`reply-disclosure disclosure-${kind}`}>
    <summary>{label}<ChevronDown size={15} aria-hidden="true" /></summary>
    {children || (kind === "context" ? <Context /> : <OriginalReply />)}
  </details>;
}
export function ReplyComposer({ suggestions = false, footer = false }) {
  const id = useId();
  const input = useRef(null);
  const [draft, setDraft] = useState("");
  useLayoutEffect(() => {
    const field = input.current;
    let alive = true;
    const fit = () => {
      if (!alive || !field.getClientRects().length) return;
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight}px`;
    };
    fit();
    // Only width changes trigger a refit; our height updates must not form a resize loop.
    let width = field.parentElement.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== width) { width = entry.contentRect.width; fit(); }
    });
    observer.observe(field.parentElement);
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => { alive = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  });
  return <div className="reply-entry">
    <label className="reply-entry-label" htmlFor={id}>Enter the journey with your own reply...</label>
    <div className="reply-composer">
    <div className="reply-draft">
      <div className="reply-input-wrap" data-empty={!draft}>
        <textarea id={id} ref={input} rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder={invitations[0]} aria-describedby={`${id}-note`} />
        <div className="reply-placeholders" aria-hidden="true">
          {invitations.map((text, index) => <span key={text} style={{ "--placeholder-index": index }}>{text}</span>)}
        </div>
      </div>
      {suggestions && <div className="reply-suggestions" aria-label="Suggested Starting Points">
        {directions.map(([label, text]) => <button type="button" key={label} onClick={() => { setDraft(text); input.current?.focus(); }}>{label}</button>)}
      </div>}
      <div className="reply-submit-row"><small id={`${id}-note`}>Draft only · Not saved or sent</small><button type="button" disabled title="Send · Keyboard shortcut preview"><span>Send</span><kbd aria-hidden="true"><CornerDownLeft size={15} /></kbd></button></div>
    </div>
    {footer && <div className="reply-footer"><ReplyDisclosure /><ReplyDisclosure kind="context" /></div>}
    </div>
  </div>;
}

function IntentTabs() {
  const [active, setActive] = useState("respond");
  const id = useId();
  const refs = useRef([]);
  const tabs = [["respond", "Try Your Own Reply"], ["original", "Read Original Reply"], ["context", "Explore Context"]];
  const move = (e, i) => {
    const next = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : null;
    if (next === null) return;
    e.preventDefault(); setActive(tabs[next][0]); refs.current[next]?.focus();
  };
  return <div className="reply-tab-study">
    <div className="reply-tabs" role="tablist" aria-label="Conversation Actions">
      {tabs.map(([key, label], i) => <button key={key} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`${id}-${key}`} aria-controls={`${id}-${key}-panel`} aria-selected={active === key} tabIndex={active === key ? 0 : -1} onClick={() => setActive(key)} onKeyDown={e => move(e, i)}>{label}</button>)}
    </div>
    {tabs.map(([key]) => <div key={key} role="tabpanel" id={`${id}-${key}-panel`} aria-labelledby={`${id}-${key}`} hidden={active !== key} tabIndex={0}>
      {key === "respond" ? <ReplyComposer /> : key === "original" ? <OriginalReply /> : <Context />}
    </div>)}
  </div>;
}

export default function ReplyStudy({ layout }) {
  return <section className={`reply-study reply-study-${layout}`} aria-label="Reply Actions">
    {layout === "tabs" ? <IntentTabs /> : layout === "reading" ? <>
      <ReplyDisclosure />
      <p className="reply-invitation">Or take the conversation somewhere else.</p>
      <ReplyDisclosure kind="respond"><ReplyComposer /></ReplyDisclosure>
      <ReplyDisclosure kind="context" />
    </> : <ReplyComposer suggestions={layout === "suggestions"} footer />}
  </section>;
}
