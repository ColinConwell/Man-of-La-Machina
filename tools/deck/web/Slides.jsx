import React, { useEffect, useState } from "react";
import FlowViz from "./FlowViz";
import { FLOWS } from "./flows";
import { Box, T, slideSetting, setSlideSetting, useDeck } from "./editing";

export const LAYOUTS = ["title", "statement", "quote", "split", "list", "timeline", "network", "stats", "flow", "closing"];

function Body({ s, className = "body" }) {
  const deck = useDeck();
  const paragraphs = Array.isArray(s.body) ? s.body : s.body ? [s.body] : [];
  if (!paragraphs.length && deck.mode !== "edit") return null;
  return (
    <div className={className}>
      {(paragraphs.length ? paragraphs : [""]).map((text, i) => (
        <T key={i} p={`${s.id}.body.${i}`} v={text} as="p" />
      ))}
    </div>
  );
}

function Head({ s, as = "h2" }) {
  return (
    <header className="slide-head">
      <T p={`${s.id}.kicker`} v={s.kicker} className="kicker" />
      <T p={`${s.id}.title`} v={s.title} as={as} className="title" />
      {s.subtitle !== undefined && <T p={`${s.id}.subtitle`} v={s.subtitle} className="subtitle" />}
    </header>
  );
}

function Items({ s, className = "items", numbered = false }) {
  return (
    <Box p={`${s.id}.items`} className={className} as={numbered ? "ol" : "ul"}>
      {(s.items || []).map((it, i) => (
        <li key={i} className="item">
          {it.label !== undefined && <T p={`${s.id}.items.${i}.label`} v={it.label} className="item-label" />}
          <T p={`${s.id}.items.${i}.title`} v={it.title} className="item-title" />
          {it.text !== undefined && <T p={`${s.id}.items.${i}.text`} v={it.text} className="item-text" />}
        </li>
      ))}
    </Box>
  );
}

function FlowSlide({ s }) {
  const deck = useDeck();
  const flow = FLOWS[s.flow];
  const binding = slideSetting(deck.edits, "sample", s.id, s.sample || null);
  const [sample, setSample] = useState(null);
  const [variant, setVariant] = useState(() => slideSetting(deck.edits, "variant", s.id, s.variant));
  const [source, setSource] = useState(() => slideSetting(deck.edits, "source", s.id, binding ? "saved" : "illustrative"));
  useEffect(() => {
    if (!binding?.run || !binding?.case) {
      setSample(null);
      return;
    }
    const controller = new AbortController();
    const q = new URLSearchParams({ run: binding.run, case: binding.case });
    fetch(`/api/sample?${q}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setSample)
      .catch(() => !controller.signal.aborted && setSample({ beats: [], meta: { label: "Saved case unavailable" } }));
    return () => controller.abort();
  }, [binding?.run, binding?.case]);
  if (!flow) return <div className="missing">Unknown flow “{s.flow}”.</div>;
  const choose = (v) => {
    setVariant(v);
    if (deck.mode === "edit") setSlideSetting(deck.update, "variant", s.id, v);
  };
  const pickSource = (v) => {
    setSource(v);
    if (deck.mode === "edit") setSlideSetting(deck.update, "source", s.id, v);
  };
  return (
    <Box p={`${s.id}.flow`} className="flow-box">
      <FlowViz
        flow={flow}
        sample={sample}
        variant={variant}
        onVariant={choose}
        sourceMode={source}
        onSourceMode={pickSource}
        register={deck.registerFlow}
        autoplay={slideSetting(deck.edits, "autoplay", s.id, false) && deck.mode === "present"}
      />
    </Box>
  );
}

function Network({ s }) {
  const items = s.items || [];
  return (
    <Box p={`${s.id}.network`} className="network">
      <svg viewBox="0 0 700 520" aria-hidden="true">
        {items.map((_, i) => {
          const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
          return <line key={i} x1="350" y1="260" x2={350 + Math.cos(a) * 210} y2={260 + Math.sin(a) * 190} />;
        })}
        {items.map((_, i) => {
          const a = (i / items.length) * Math.PI * 2 - Math.PI / 2, b = ((i + 1) / items.length) * Math.PI * 2 - Math.PI / 2;
          return <line key={`r${i}`} className="ring" x1={350 + Math.cos(a) * 210} y1={260 + Math.sin(a) * 190} x2={350 + Math.cos(b) * 210} y2={260 + Math.sin(b) * 190} />;
        })}
      </svg>
      <T p={`${s.id}.center`} v={s.center} className="hub" />
      {items.map((it, i) => {
        const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={i} className="spoke" style={{ left: `${50 + Math.cos(a) * 30}%`, top: `${50 + Math.sin(a) * 36.5}%` }}>
            <T p={`${s.id}.items.${i}.title`} v={it.title} className="item-title" />
            <T p={`${s.id}.items.${i}.text`} v={it.text} className="item-text" />
          </div>
        );
      })}
    </Box>
  );
}

export function Slide({ s }) {
  const deck = useDeck();
  const layout = slideSetting(deck.edits, "layout", s.id, s.layout);
  const theme = slideSetting(deck.edits, "theme", s.id, s.theme || "dark");
  const align = slideSetting(deck.edits, "align", s.id, s.align || "center");
  const flip = slideSetting(deck.edits, "flip", s.id, false);
  const cls = `slide layout-${layout} theme-${theme} align-${align} ${flip ? "flip" : ""}`;
  let inner;
  switch (layout) {
    case "title":
      inner = (
        <div className="frame">
          <T p={`${s.id}.kicker`} v={s.kicker} className="kicker" />
          <T p={`${s.id}.title`} v={s.title} as="h1" className="title" />
          <T p={`${s.id}.subtitle`} v={s.subtitle} className="subtitle" />
          <T p={`${s.id}.byline`} v={s.byline} className="byline" />
          <T p={`${s.id}.footnote`} v={s.footnote} className="footnote" />
        </div>
      );
      break;
    case "quote":
      inner = (
        <div className="frame">
          <T p={`${s.id}.kicker`} v={s.kicker} className="kicker" />
          <T p={`${s.id}.quote`} v={s.quote} as="blockquote" className="quote" />
          <T p={`${s.id}.cite`} v={s.cite} className="cite" />
          <Body s={s} />
        </div>
      );
      break;
    case "split":
      inner = (
        <div className="frame cols">
          <div className="col text">
            <Head s={s} />
            <Body s={s} />
          </div>
          <div className="col">
            <Items s={s} className="items cards" />
          </div>
        </div>
      );
      break;
    case "list":
      inner = (
        <div className="frame">
          <Head s={s} />
          <Items s={s} className="items numbered" numbered />
          <Body s={s} className="body after" />
        </div>
      );
      break;
    case "timeline":
      inner = (
        <div className="frame">
          <Head s={s} />
          <Items s={s} className="items rail" />
          <Body s={s} className="body after" />
        </div>
      );
      break;
    case "network":
      inner = (
        <div className="frame cols">
          <div className="col text narrow">
            <Head s={s} />
            <Body s={s} />
          </div>
          <div className="col wide">
            <Network s={s} />
          </div>
        </div>
      );
      break;
    case "stats":
      inner = (
        <div className="frame">
          <Head s={s} />
          <Items s={s} className="items tiles" />
          <Body s={s} className="body after" />
        </div>
      );
      break;
    case "flow":
      inner = (
        <div className="frame flowframe">
          <div className="flow-intro">
            <Head s={s} />
            <Body s={s} />
          </div>
          {s.flow ? <FlowSlide s={s} /> : <div className="missing">This slide has no flow.</div>}
        </div>
      );
      break;
    case "closing":
    case "statement":
    default:
      inner = (
        <div className="frame">
          <Head s={s} as={layout === "closing" ? "h1" : "h2"} />
          <Body s={s} />
          {s.items?.length ? <Items s={s} className="items inline" /> : null}
        </div>
      );
  }
  return (
    <section className={cls} data-slide={s.id} aria-roledescription="slide">
      {inner}
    </section>
  );
}
