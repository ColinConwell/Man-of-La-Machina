import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, List, ArrowBigUp } from "lucide-react";
import { api } from "../api";

interface Reading {
  title: string;
  deck: string;
  edition: string;
  body_html: string;
  version: string;
}

export function EditorialReader({
  page,
  available,
}: {
  page: "about" | "essay";
  available: boolean;
}) {
  const [contentsOpen, setContentsOpen] = useState(
    () => !matchMedia("(max-width: 760px)").matches,
  );
  const [currentSection, setCurrentSection] = useState("");
  const toggle = useRef<HTMLButtonElement>(null);
  const article = useRef<HTMLElement>(null);
  const reading = useQuery({
    queryKey: ["editorial", page],
    queryFn: () => api<Reading>("/editorial/" + page),
    enabled: available,
    gcTime: 0,
  });
  const projected = useMemo(() => {
    if (!reading.data)
      return { html: "", contents: [] as { id: string; title: string }[] };
    const doc = new DOMParser().parseFromString(
      reading.data.body_html,
      "text/html",
    );
    const headings = Array.from(doc.querySelectorAll("h2[id]"));
    for (const h of headings)
      if (h.textContent?.trim() === "References")
        h.textContent = "References (Bibliography)";
    return {
      html: doc.body.innerHTML,
      contents: headings.map((h) => ({ id: h.id, title: h.textContent || "" })),
    };
  }, [reading.data]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "c" ||
        !event.shiftKey ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest(
          "input, textarea, select, [contenteditable='true'], dialog",
        ) ||
        document.querySelector("dialog[open], [popover]:popover-open")
      )
        return;
      event.preventDefault();
      setContentsOpen((value) => !value);
      toggle.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!projected.contents.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const headings = Array.from(
        article.current?.querySelectorAll<HTMLElement>("h2[id]") || [],
      );
      let active = headings[0]?.id || "";
      for (const h of headings)
        if (h.getBoundingClientRect().top <= 120) active = h.id;
      if (
        window.scrollY > 0 &&
        window.scrollY + innerHeight >=
          document.documentElement.scrollHeight - 2
      )
        active = headings.at(-1)?.id || active;
      setCurrentSection(active);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    if (article.current) observer.observe(article.current);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [projected]);
  return (
    <main id="main-content" className="editorial-page" tabIndex={-1}>
      {!available ? (
        <h1>This Reading Is Unavailable</h1>
      ) : reading.isError ? (
        <>
          <h1>The Reading Could Not Be Loaded</h1>
          <p>{reading.error.message}</p>
          <button onClick={() => reading.refetch()}>Try Again</button>
        </>
      ) : !reading.data ? (
        <h1>Opening the Reading…</h1>
      ) : (
        <>
          <header className="editorial-heading">
            <p className="editorial-kicker">
              {page === "about" ? "The Project" : "Read the Essay"}
            </p>
            <h1>{reading.data.title}</h1>
            {page === "about" && (
              <p className="editorial-deck">{reading.data.deck}</p>
            )}
            {reading.data.edition && (
              <p
                className={
                  page === "essay" ? "editorial-deck editorial-edition" : "fine"
                }
              >
                {reading.data.edition.replace(
                  /Reading edition/gi,
                  "Reading Edition",
                )}
              </p>
            )}
          </header>
          <div
            className={`editorial-layout ${contentsOpen ? "contents-open" : "contents-closed"}`}
          >
            <nav aria-label="Reading contents" className="editorial-contents">
              <button
                ref={toggle}
                className="contents-toggle"
                aria-label="Table of Contents"
                aria-expanded={contentsOpen}
                aria-controls="reading-contents"
                aria-keyshortcuts="Shift+C"
                title={`${contentsOpen ? "Hide" : "Show"} Table of Contents (Shift + C)`}
                onClick={() => setContentsOpen(!contentsOpen)}
              >
                {contentsOpen ? (
                  <>
                    <span>Table of Contents</span>
                    <ChevronLeft size={15} />
                  </>
                ) : (
                  <>
                    <List size={16} />
                    <ChevronRight size={14} />
                    <span>Contents</span>
                    <ChevronLeft size={14} aria-hidden="true" />
                  </>
                )}
              </button>
              <div id="reading-contents" hidden={!contentsOpen}>
                {projected.contents.map((item) => (
                  <a
                    key={item.id}
                    href={"#" + item.id}
                    aria-current={
                      currentSection === item.id ? "location" : undefined
                    }
                  >
                    {item.title}
                  </a>
                ))}
                <button
                  className="contents-shortcut"
                  aria-label="Hide Contents (Shift + C)"
                  aria-keyshortcuts="Shift+C"
                  aria-controls="reading-contents"
                  onClick={() => {
                    setContentsOpen(false);
                    toggle.current?.focus({ preventScroll: true });
                  }}
                >
                  <ChevronLeft size={14} aria-hidden="true" /> Hide Contents
                  <kbd aria-hidden="true"><ArrowBigUp size={13} /> C</kbd>
                </button>
              </div>
            </nav>
            {/* Server-allowlisted HTML; only the bibliography heading label changes locally. */}
            <article
              ref={article}
              className="editorial-prose"
              aria-label={page === "essay" ? "Essay" : "About the project"}
              dangerouslySetInnerHTML={{ __html: projected.html }}
            />
          </div>
        </>
      )}
    </main>
  );
}
