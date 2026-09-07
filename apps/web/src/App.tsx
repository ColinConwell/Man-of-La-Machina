import { useCallback, useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, X, ArrowUpRight, PanelRightOpen } from "lucide-react";
import { api, dateLabel } from "./api";
import type {
  Anchor,
  Experience,
  HistoricalMessage,
  Position,
  Thread,
} from "./types";
import { useExperience } from "./store";
import { useBranch } from "./useBranch";
import { ExperienceThreshold } from "./features/ExperienceThreshold";
import { JourneyRail } from "./features/JourneyRail";
import { ConversationReader } from "./features/ConversationReader";
import { ContextWorkbench } from "./features/ContextWorkbench";
import { ReceiptDialog } from "./features/ReceiptDialog";
import { BranchComposer, BranchConversation } from "./features/BranchComposer";
import { ContinuationComparison } from "./features/ContinuationComparison";
import { ArtifactViewer } from "./features/ArtifactViewer";
import { TimelineExplorer } from "./features/TimelineExplorer";
const names: Record<string, string> = {
  archive: "Archive",
  "western-gothic": "Western Gothic",
  "context-lab": "Context Lab",
};
export default function App() {
  const s = useExperience();
  const readingSurface = useRef<HTMLDivElement>(null);
  const transcriptOffset = useRef(0);
  function goToTab(tab: string) {
    if (s.tab === "transcript")
      transcriptOffset.current = readingSurface.current?.scrollTop || 0;
    s.setTab(tab);
    if (tab === "transcript")
      requestAnimationFrame(() => {
        if (readingSurface.current)
          readingSurface.current.scrollTop = transcriptOffset.current;
      });
  }
  const branch = useBranch();
  const [cutoff, setCutoff] = useState<HistoricalMessage>();
  const [contextOpen, setContextOpen] = useState(false);
  const exp = useQuery({
    queryKey: ["experience"],
    queryFn: () => api<Experience>("/experience"),
  });
  const anchors = useQuery({
    queryKey: ["anchors"],
    queryFn: () => api<Anchor[]>("/anchors"),
  });
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => api<Thread[]>("/threads"),
  });
  const position = useQuery({
    queryKey: ["position", s.entry],
    queryFn: () => api<Position>("/timeline/resolve?message_id=" + s.entry),
    enabled: !!s.entry,
  });
  const onMessage = useCallback((m: HistoricalMessage) => setCutoff(m), []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);
  useEffect(() => {
    if (exp.data && !exp.data.profile.enabled_themes.includes(s.theme))
      s.setTheme(exp.data.profile.default_theme);
  }, [exp.data, s.theme, s.setTheme]);
  async function select(id: string, anchor = "") {
    try {
      await branch.reset();
      setCutoff(undefined);
      s.select(id, anchor);
    } catch {
      /* Deletion error stays visible. */
    }
  }
  async function restart() {
    try {
      await branch.reset();
      s.setText("");
      s.setTab("branch");
    } catch {
      /* Error shown above. */
    }
  }
  async function resetAll() {
    try {
      await branch.reset();
      s.setRange("", "");
      s.setGranularity("journey");
      s.setEntered(false);
      s.setText("");
      history.replaceState(null, "", location.pathname);
    } catch {
      /* Error shown above. */
    }
  }
  const selectedThread = threads.data?.find(
    (t) => t.id === position.data?.thread_id,
  );
  const selectedAnchor = anchors.data?.find((a) => a.id === s.anchor);
  const rangeAction = (id: string, end: boolean) =>
    end ? s.setRange(s.first || id, id) : s.setRange(id, s.last || id);
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to conversation
      </a>
      <header className="masthead">
        <button className="wordmark" onClick={resetAll}>
          Man of La Machina<span>Don Qui-CoPilot</span>
        </button>
        <div className="header-actions">
          <label className="theme-picker">
            <span className="sr-only">Theme</span>
            <select
              aria-label="Theme"
              value={s.theme}
              onChange={(e) => s.setTheme(e.target.value)}
            >
              {(
                exp.data?.profile.enabled_themes || [
                  "archive",
                  "western-gothic",
                  "context-lab",
                ]
              ).map((t) => (
                <option value={t} key={t}>
                  {names[t] || t}
                </option>
              ))}
            </select>
          </label>
          <button className="text-button reset" onClick={resetAll}>
            <RotateCcw size={16} /> Reset
          </button>
          <span className="mode-indicator">
            <i />{" "}
            {exp.data?.mode === "hosted"
              ? "Exploration prototype"
              : exp.data?.mode === "curator"
                ? "Local curator"
                : "Exhibition"}{" "}
            / {s.settings.provider === "demo" ? "Demo" : s.settings.provider}
          </span>
        </div>
      </header>
      {exp.isPending ? (
        <main className="loading">
          <h1>Opening the archive…</h1>
        </main>
      ) : exp.isError ? (
        <main className="loading">
          <h1>The archive is unavailable.</h1>
          <p>{exp.error.message}</p>
          <button onClick={() => exp.refetch()}>Try again</button>
        </main>
      ) : !s.entered ? (
        <ExperienceThreshold experience={exp.data!} onSelect={select} />
      ) : (
        <>
          <div
            className={
              "workspace " + (s.tab === "compare" ? "comparison-mode" : "")
            }
          >
            <JourneyRail
              anchors={anchors.data || []}
              threads={threads.data || []}
              selected={position.data?.thread_id || ""}
              onSelect={select}
            />
            <main id="main-content" className="main-content" tabIndex={-1}>
              <div className="mobile-journey">
                <label>
                  Journey
                  <select
                    aria-label="Choose conversation"
                    value={selectedThread?.id || ""}
                    onChange={(e) => {
                      const t = threads.data?.find(
                        (t) => t.id === e.target.value,
                      );
                      if (t) void select(t.entry_message_id);
                    }}
                  >
                    {threads.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={() => setContextOpen(!contextOpen)}>
                  <PanelRightOpen size={16} /> Context
                </button>
              </div>
              <nav className="view-tabs" aria-label="Experience views">
                {["transcript", "branch", "compare", "artifacts"].map((t) => (
                  <button
                    aria-current={s.tab === t ? "page" : undefined}
                    className={s.tab === t ? "active" : ""}
                    onClick={() => goToTab(t)}
                    key={t}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </nav>
              <div className="scene-heading">
                <h1>{selectedThread?.title || "Opening the record…"}</h1>
                <p>
                  {dateLabel(selectedThread?.start_at || null, true)}{" "}
                  {selectedThread?.place && " / " + selectedThread.place}
                  {selectedThread?.end_at &&
                    " · through " + dateLabel(selectedThread.end_at)}
                </p>
                {selectedAnchor?.curatorial_note && (
                  <details className="scene-note">
                    <summary>
                      About this pause <ArrowUpRight size={13} />
                    </summary>
                    <p>{selectedAnchor.curatorial_note}</p>
                  </details>
                )}
              </div>
              {branch.error && (
                <div className="error-banner" role="alert">
                  <span>{branch.error}</span>
                  <button
                    aria-label="Dismiss error"
                    onClick={() => branch.setError("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {position.isError && (
                <p role="alert">
                  {position.error.message}{" "}
                  <button onClick={resetAll}>Choose a beginning</button>
                </p>
              )}
              <div
                className="reading-surface"
                ref={readingSurface}
                key={s.entry}
              >
                <div hidden={s.tab !== "transcript"}>
                  {position.data && (
                    <ConversationReader
                      position={position.data}
                      onSelect={select}
                      onMessage={onMessage}
                      rangeAction={rangeAction}
                    />
                  )}
                </div>
                {s.tab === "branch" && (
                  <BranchConversation
                    branch={branch.branch}
                    busy={branch.busy}
                    streamText={branch.streamText}
                    pendingText={branch.pendingText}
                    onInspect={branch.inspect}
                    onExport={branch.exportBranch}
                    onRefresh={branch.refresh}
                  />
                )}{" "}
                {s.tab === "compare" && (
                  <ContinuationComparison
                    entry={s.entry}
                    branch={branch.branch}
                    replace={s.options.replace_cutoff}
                    onInspect={branch.inspect}
                  />
                )}{" "}
                {s.tab === "artifacts" && position.data && (
                  <ArtifactViewer threadId={position.data.thread_id} />
                )}
              </div>
              {(s.tab === "transcript" || s.tab === "branch") && (
                <BranchComposer
                  busy={branch.busy}
                  turns={(branch.branch?.messages.length || 0) / 2}
                  limit={exp.data!.profile.branch_turn_limit}
                  onSubmit={() => {
                    goToTab("branch");
                    void branch.submit();
                  }}
                />
              )}
            </main>
            <div
              className={
                "context-container " + (contextOpen ? "mobile-open" : "")
              }
            >
              <button
                className="mobile-context-close"
                onClick={() => setContextOpen(false)}
              >
                Close context <X size={16} />
              </button>
              <ContextWorkbench
                experience={exp.data!}
                cutoff={cutoff}
                manifest={branch.preview}
                onPreview={branch.previewContext}
                busy={branch.busy}
                onRestart={restart}
              />
            </div>
          </div>
          <TimelineExplorer
            experience={exp.data!}
            position={position.data}
            onSelect={select}
          />
        </>
      )}
      <footer className="status-bar">
        <span>
          <i /> Recorded history and generated branches remain distinct.
        </span>
        <span>
          {exp.data?.counts.messages || 0} recorded turns ·{" "}
          {exp.data?.content_version.slice(0, 8) || "…"}
        </span>
      </footer>
      {branch.receipt && (
        <ReceiptDialog
          receipt={branch.receipt}
          onClose={() => branch.setReceipt(null)}
        />
      )}
    </>
  );
}
