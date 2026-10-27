import React, { useState } from "react";
import { X } from "lucide-react";

export const journeyStops = [
  { title: "The Beginning", text: "The traveler sets out with a map and a companion. Their first exchange asks what makes a journey worth taking." },
  { title: "A Turning Point", text: "At a fork in the road, the traveler weighs familiarity against curiosity. The companion offers a way to take a first step without deciding the entire journey." },
  { title: "Naming the Companion", text: "The conversation turns to names: how a name can express a role, a relationship, or the hope of becoming something new." },
];

export function Roadmap({ selected, onSelect, onExplore, contextId }) {
  const [unveiled, setUnveiled] = useState(null);
  return <nav className="journey-rail" aria-label="The Journey Roadmap">
    <h2>The Journey</h2>
    <ol>{journeyStops.map((stop, index) => <li key={stop.title} className={`${selected === index ? "current" : ""} ${unveiled === index ? "is-unveiled" : ""}`}>
      <button type="button" className="journey-stop" aria-current={selected === index ? "step" : undefined} aria-expanded={unveiled === index} onClick={() => { onSelect(index); setUnveiled(unveiled === index ? null : index); }}>{stop.title}</button>
      <div className="journey-branch"><button type="button" className="journey-context-link" aria-label={`Explore Context: ${stop.title}`} aria-controls={contextId} onClick={e => onExplore(index, e.currentTarget)}>Explore Context</button></div>
    </li>)}</ol>
  </nav>;
}

export function ContextSidebar({ id, selected, open, permanent, onClose }) {
  return <aside id={id} className="journey-context-sidebar" aria-label="Journey Context" aria-hidden={!open} inert={!open}>
    <div className="journey-context-content">
      <div className="journey-context-heading"><h2>Explore Context</h2>{!permanent && <button type="button" aria-label="Close Context" onClick={onClose}><X size={16} /></button>}</div>
      <small>Context · Illustrative</small>
      <h3>{journeyStops[selected].title}</h3>
      <p>{journeyStops[selected].text}</p>
      <p className="journey-context-note">This context belongs to the selected point in the journey.</p>
    </div>
  </aside>;
}
