import React, { useEffect, useRef, useState } from 'react';
import { title } from './data';

export default function EventPlayback({ data }) {
  const events = data.simulated_events || [];
  const track = useRef(null);
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => { setIndex(0); setPlaying(false); }, [data.run_id]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex(i => {
      if (i >= events.length - 1) { setPlaying(false); return i; } return i + 1;
    }), 2300);
    return () => clearInterval(timer);
  }, [playing, events.length]);
  useEffect(() => {
    const parent = track.current, selected = parent?.children[index];
    if (selected) parent.scrollTo({left: selected.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 + selected.clientWidth / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }, [index]);
  if (!events.length) return null;
  const event = events[index];
  return <section className="event-playback" aria-label="Simulated Event Timeline">
    <div className="section-heading"><h3>Simulated Event Timeline</h3><button className="text-button" onClick={() => { if (index >= events.length - 1) setIndex(0); setPlaying(v => !v); }} aria-pressed={playing}>{playing ? 'Pause' : 'Play Events'}</button></div>
    <p className="caption">Hypothetical events extracted from the generated script. Spacing represents sequence, not elapsed time.</p>
    <div className="event-track" ref={track} role="group" aria-label="Choose Simulated Event">{events.map((e,i) => <button key={e.id || i} aria-label={`Event ${i+1}: ${e.text}`} aria-pressed={i===index} onClick={() => {setIndex(i);setPlaying(false);}}><span>{i+1}</span></button>)}</div>
    <div className="event-current" key={event.id || index} aria-live={playing ? 'off' : 'polite'}><span className="caption">Turn {event.turn_index+1} · {title(event.actor || 'Narration')}{event.time_elapsed ? ` · ${event.time_elapsed}` : ''}</span><p>{event.text}</p>{event.place && <small>{event.place}</small>}</div>
  </section>;
}
