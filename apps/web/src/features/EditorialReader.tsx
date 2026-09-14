import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const reading = useQuery({
    queryKey: ["editorial", page],
    queryFn: () => api<Reading>("/editorial/" + page),
    enabled: available,
    gcTime: 0,
  });
  const contents = useMemo(() => {
    if (!reading.data) return [];
    const document = new DOMParser().parseFromString(
      reading.data.body_html,
      "text/html",
    );
    return Array.from(document.querySelectorAll("h2[id]")).map((h) => ({
      id: h.id,
      title: h.textContent || "",
    }));
  }, [reading.data]);
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
            <p className="editorial-deck">{reading.data.deck}</p>
            {reading.data.edition && (
              <p className="fine">{reading.data.edition}</p>
            )}
          </header>
          <div className="editorial-layout">
            <nav aria-label="Reading contents" className="editorial-contents">
              <span>In This Reading</span>
              {contents.map((item) => (
                <a key={item.id} href={"#" + item.id}>
                  {item.title}
                </a>
              ))}
            </nav>
            {/* HTML is projected by the server's strict element/attribute allowlist,
            after pseudonymization. The private release is never served directly. */}
            <article
              className="editorial-prose"
              aria-label={page === "essay" ? "Essay" : "About the project"}
              dangerouslySetInnerHTML={{ __html: reading.data.body_html }}
            />
          </div>
        </>
      )}
    </main>
  );
}
