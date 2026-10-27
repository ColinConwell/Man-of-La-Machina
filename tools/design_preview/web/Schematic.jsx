import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { readingFontStyle } from "./typography.mjs";
import ReplyStudy, { ReplyComposer, ReplyDisclosure } from "./ReplyStudy.jsx";
import { Roadmap, ContextSidebar } from "./Roadmap.jsx";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  Clock3,
  GitBranch,
  Headphones,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Play,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
} from "lucide-react";

export function MockButton({ children, className = "", label }) {
  return (
    <button
      type="button"
      disabled
      className={`mock-button ${className}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}
const paragraphs = [
  "At the edge of the olive groves, the road divided. One path led toward the familiar towers of the town; the other disappeared into the hills, where the light was still gathering.",
  "\u201cA road need not promise a destination,\u201d the traveler said. \u201cSometimes it is enough that it invites us to begin.\u201d",
  "His companion studied the map, then the unmarked country ahead. Between what had been written and what remained possible, there was room for another story.",
  "They walked until the shadows reached across the stones. Far away, a windmill turned with a patience that neither traveler could quite imitate. Each revolution seemed to repeat an old question, though the wind supplied a different answer.",
  "The town behind them was growing small. A bell sounded across the valley, and for a moment both imagined returning: the same doorway, the same table, the reassuring weight of a story already told. Then a bird lifted from the grass beside the road.",
  "\u201cWe could follow it,\u201d said the companion. \u201cOr we could leave it free to go where it wishes.\u201d The traveler folded the map. For once, there was no need to decide which of them had spoken more wisely.",
];
function Passage({ long = false }) {
  return (
    <div className="passage">
      {paragraphs.slice(0, long ? 6 : 3).map((p, i) => (
        <p key={i}><span className="veil-text">{p}</span></p>
      ))}
    </div>
  );
}
function ConversationMessage({ speaker, settings, className = "", children }) {
  const choice = settings[speaker === "traveler" ? "humanFont" : "machineFont"];
  const font = choice === "inherit" ? settings.readingFont : choice;
  const node = useRef(null);
  const [clouds, setClouds] = useState([]);
  useLayoutEffect(() => {
    if (settings.veilMode !== "contour-clouds") { setClouds([]); return; }
    let active = true;
    const measure = () => {
      if (!active || !node.current) return;
      const box = node.current.getBoundingClientRect();
      const padding = settings.veilPadding * .45;
      const rects = [...node.current.querySelectorAll(".veil-text")].flatMap(span =>
        [...span.getClientRects()].filter(r => r.width && r.height).map(r => ({
          left: r.left - box.left - node.current.clientLeft - padding,
          top: r.top - box.top - node.current.clientTop - 3,
          width: r.width + padding * 2, height: r.height + 6,
        })));
      setClouds(rects);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node.current);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, [settings]);
  const alignment = settings[`${speaker}Align`];
  const edge = alignment === "right" ? "right" : alignment === "center" ? "center" : "left";
  return <div ref={node}
    className={`message label-${settings[`${speaker}Label`]} edge-${edge} ${speaker === "traveler" ? "human-message" : "machine-message"} position-${settings[`${speaker}Position`]} align-${settings[`${speaker}Align`]} ${className}`}
    data-speaker={speaker}
    data-font={font}
    style={{...readingFontStyle(font), "--speaker-width": `${settings[`${speaker}Width`] * 100}%`, "--outer-inset": `${settings[`${speaker}Inset`] * 100}%`}}
  >{clouds.length > 0 && <div className="contour-underlay" aria-hidden="true">{clouds.map((rect, i) => <i key={i} style={rect} />)}</div>}{children}</div>;
}
function ReplyActions() {
  const group = useRef(null);
  const [width, setWidth] = useState(null);
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const buttons = [...group.current.querySelectorAll("button")];
      setWidth(Math.ceil(Math.max(...buttons.map(button => {
        const style = getComputedStyle(button);
        return button.querySelector("span").getBoundingClientRect().width + 18 + 20 + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
      }))));
    };
    const observer = new ResizeObserver(measure);
    group.current.querySelectorAll("button span").forEach(el => observer.observe(el));
    measure(); document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { alive = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, []);
  return <div className="reply-actions" ref={group} style={{"--reply-width": width ? `${width}px` : "max-content"}}>
    <div className="story-actions"><MockButton className="primary-story"><span>Try Your Own Reply</span><ArrowRight size={18} /></MockButton></div>
    <div className="secondary-actions"><MockButton className="recorded-link"><span>Read Original Reply</span><ArrowRight size={18} /></MockButton></div>
  </div>;
}
function Reader({ long, settings }) {
  return (
    <>
      <ConversationMessage speaker="traveler" settings={settings}>
        <div className="message-byline">
          <span className="veil-text">Traveler</span>
        </div>
        <p className="dialogue">
          <span className="veil-text">
          “I have reached a place where the road divides. How should I choose
          what comes next?”
          </span>
        </p>
      </ConversationMessage>
      {settings.replyLayout === "attached" && <div className="reply-study attached-reply"><ReplyDisclosure kind="respond"><ReplyComposer /></ReplyDisclosure></div>}
      <ConversationMessage speaker="companion" settings={settings}>
        <div className="message-byline">
          <span className="veil-text">Companion</span>
        </div>
        <p className="dialogue">
          <span className="veil-text">
            “Begin with what matters to you, then consider what each path makes
            possible.”
          </span>
        </p>
      </ConversationMessage>
      {settings.replyLayout === "buttons" ? <ReplyActions /> : settings.replyLayout === "attached" ? <div className="reply-study attached-original"><ReplyDisclosure /></div> : <ReplyStudy key={settings.replyLayout} layout={settings.replyLayout} />}
      {long && (
        <>
        <ConversationMessage speaker="traveler" settings={settings} className="long-continuation">
          <div className="message-byline">
            <span className="veil-text">The Story Continues · Traveler</span>
          </div>
          <Passage long />
        </ConversationMessage>
        <ConversationMessage speaker="companion" settings={settings}>
          <div className="message-byline">
            <span className="veil-text">The Companion</span>
          </div>
          <Passage long />
        </ConversationMessage>
        </>
      )}
    </>
  );
}
function Branches({ long }) {
  return (
    <>
      <div className="branch-root">
        <p>“What if we took the road that wasn’t on the map?”</p>
        <span>Three Possible Continuations</span>
      </div>
      <div className="branch-options">
        {[
          [
            "01",
            "Toward the Hills",
            "Follow the traveler beyond the familiar road.",
          ],
          [
            "02",
            "Back to the Town",
            "Return with a different question for an old friend.",
          ],
          [
            "03",
            "An Unwritten Path",
            "Let the companion choose what happens next.",
          ],
        ].map(([n, t, d]) => (
          <div className="branch-option" key={n}>
            <span className="branch-number">{n}</span>
            <div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
            <GitBranch size={17} />
          </div>
        ))}
      </div>
      {long && <Passage long />}
    </>
  );
}
function Comparison({ long, settings }) {
  return (
    <div className="comparison-passages">
      {[
        [
          "The Human’s Version",
          "A map is a record of where someone else has been. The traveler turned it over and began to draw.",
        ],
        [
          "The Machine’s Version",
          "Beyond the final inked line, the hills opened into a country without a name. The traveler stepped forward.",
        ],
      ].map(([t, p], index) => (
        <section key={t}>
        <ConversationMessage speaker={index === 0 ? "traveler" : "companion"} settings={settings}>
          <div className="section-caption"><span className="veil-text">{t}</span></div>
          <p><span className="veil-text">{p}</span></p>
          {long && <Passage />}
        </ConversationMessage>
        </section>
      ))}
    </div>
  );
}
function Events({ long }) {
  return (
    <div className="event-list">
      {[
        [
          "01",
          "The Question",
          "The human imagines an unfamiliar road.",
          "Human Prompt",
        ],
        [
          "02",
          "The Departure",
          "The machine offers a possible beginning.",
          "Generated Continuation",
        ],
        [
          "03",
          "The Fork",
          "Three directions open from the same moment.",
          "Branch Point",
        ],
        [
          "04",
          "Your Next Chapter",
          "A new response will shape what follows.",
          "Not Yet Written",
        ],
      ].map(([n, t, p, l]) => (
        <div className="event" key={n}>
          <span>{n}</span>
          <div>
            <small>{l}</small>
            <h3>{t}</h3>
            <p>{p}</p>
            {long && <p>{paragraphs[+n - 1]}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
function Editorial({ long }) {
  return (
    <div className="editorial-passage">
      <div className="section-caption">An Editorial Conversation</div>
      <p>
        At the edge of the olive groves, the road <del>came to an end</del>{" "}
        <ins>opened into possibility</ins>.
      </p>
      <aside>
        <MessageCircle size={16} />
        <div>
          <strong>A Note on Possibility</strong>
          <p>
            The revision makes the landscape an invitation. How does this change
            the traveler’s agency?
          </p>
        </div>
      </aside>
      <Passage long={long} />
    </div>
  );
}
function Onboarding({ long }) {
  return (
    <div className="first-visit">
      <div className="onboarding-icon">
        <BookOpen size={32} strokeWidth={1} />
      </div>
      <h2>
        Every Story Begins
        <br />
        With a Conversation.
      </h2>
      <p>
        Follow a dialogue between human and machine.
        <br />
        Then discover where your own question might lead.
      </p>
      <div className="tour-steps">
        {[
          [
            "01",
            "Read a Conversation",
            "Move through the story at your own pace.",
          ],
          [
            "02",
            "Explore a Branch",
            "See how one question can open several paths.",
          ],
          [
            "03",
            "Add Your Voice",
            "Write a response and imagine what comes next.",
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <MockButton className="tour-start">
        Begin Exploring <ChevronRight size={14} />
      </MockButton>
      <span className="tour-dots">
        <i />
        <i />
        <i />
      </span>
      {long && <Passage long />}
    </div>
  );
}
const titles = {
  reader: ["A Turning Point", "Illustrative Passage"],
  branching: ["Where Might the Story Go?", "Explore the Possibilities"],
  comparison: ["Two Ways of Seeing", "The Same Beginning, Different Voices"],
  events: ["A Story Taking Shape", "Moments in the Conversation"],
  editorial: ["Between the Lines", "The Conversation Behind the Words"],
  onboarding: ["A Human. A Machine. A Story.", "Welcome to Man of La Machina"],
};
const layouts = {
  reader: Reader,
  branching: Branches,
  comparison: Comparison,
  events: Events,
  editorial: Editorial,
  onboarding: Onboarding,
};
export function AppHeader() {
  return (
    <header className="app-header">
      <div className="wordmark">Man of La Machina</div>
      <nav aria-label="Schematic Navigation">
        <MockButton className="active-nav">Explore</MockButton>
        <MockButton>Events</MockButton>
        <MockButton>About</MockButton>
        <MockButton>Essay</MockButton>
        <MockButton>Appearance</MockButton>
      </nav>
    </header>
  );
}
export function SchematicContent({ settings }) {
  const Content = layouts[settings.schematic];
  const [selected, setSelected] = useState(1);
  const [contextOpen, setContextOpen] = useState(false);
  const contextId = useId();
  const trigger = useRef(null);
  const permanent = settings.roadmapLayout === "sidebar";
  const showContext = permanent || contextOpen;
  return (
    <div className={`journey-workspace roadmap-${settings.roadmapLayout} ${showContext ? "has-context" : ""}`}>
    <div className={`reading-area layout-${settings.layout} veil-${settings.veilMode} message-edges-${settings.messageEdges}`}
      style={{"--veil-padding": `${settings.veilPadding}px`, "--message-width": `${settings.messageWidth * 100}%`}}
    >
      <Roadmap selected={selected} onSelect={setSelected} contextId={contextId} onExplore={(index, element) => { setSelected(index); trigger.current = element; setContextOpen(true); }} />
      <div className="reading-inner">
        <div className="chapter-heading">
          <h1><span className="veil-text">{titles[settings.schematic][0]}</span></h1>
          <p className="section-caption">{titles[settings.schematic][1]}</p>
        </div>
        <div className={`schematic-body state-${settings.schematic}`}>
          <Content long={settings.density === "long"} settings={settings} />
        </div>
      </div>
    </div>
    <ContextSidebar id={contextId} selected={selected} open={showContext} permanent={permanent} onClose={() => { setContextOpen(false); trigger.current?.focus(); }} />
    </div>
  );
}
const audioStates = [
  { label: "Ready", Icon: Check, detail: "Message 01 · Audio Ready" },
  {
    label: "Generating",
    Icon: LoaderCircle,
    detail: "Message 02 · Generating Audio",
  },
  {
    label: "Loading",
    Icon: Clock3,
    detail: "Message 03 · Loading Saved Audio",
  },
  {
    label: "Not Generated",
    Icon: Circle,
    detail: "Message 04 · Text Has No Audio Yet",
  },
  {
    label: "Failed",
    Icon: CircleAlert,
    detail: "Message 05 · Generation Failed",
  },
];
export function PlaybackControls({ showComposer = true }) {
  return (
    <div className="controls-zone">
      <div className="playback-panel">
        <div className="playback-top">
          <span className="read-aloud-label">
            <Headphones size={15} /> Read Aloud
          </span>
          <span className="audio-current">
            <i /> Message 01 <span>of 05</span>
          </span>
          <span className="audio-voice">
            The Narrator <ChevronDown size={12} />
          </span>
        </div>
        <div className="audio-messages" aria-label="Message Audio States">
          {audioStates.map(({ label, Icon, detail }, i) => (
            <div
              className={`audio-message audio-${label.toLowerCase().replaceAll(" ", "-")}`}
              key={label}
              title={detail}
            >
              <span className="message-marker">
                <i />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </span>
              <small>
                <Icon size={11} />
                {label}
              </small>
            </div>
          ))}
        </div>
        <div className="audio-transport">
          <div className="transport-buttons">
            <MockButton label="Previous Message (schematic)">
              <SkipBack size={16} />
            </MockButton>
            <MockButton label="Play (schematic)" className="play-button">
              <Play size={14} fill="currentColor" />
            </MockButton>
            <MockButton label="Next Message (schematic)">
              <SkipForward size={16} />
            </MockButton>
          </div>
          <span className="audio-time">0:24</span>
          <div
            className="seek-track"
            role="img"
            aria-label="Within-Message Audio Progress: 24 of 68 Seconds"
          >
            <span />
            <i />
          </div>
          <span className="audio-time">1:08</span>
          <MockButton label="Playback Speed (schematic)">1×</MockButton>
          <MockButton label="Volume (schematic)">
            <Volume2 size={15} />
          </MockButton>
        </div>
      </div>
      {showComposer && <div className="composer-panel">
        <span>Where will you take the story?</span>
        <div>
          <MockButton label="Create a Branch (schematic)">
            <GitBranch size={16} />
          </MockButton>
          <MockButton label="Send Message (schematic)" className="send-button">
            <ArrowUp size={16} />
          </MockButton>
        </div>
      </div>}
      <div className="schematic-note">
        Illustrative content only · Playback and conversation controls are a
        visual study
      </div>
    </div>
  );
}
