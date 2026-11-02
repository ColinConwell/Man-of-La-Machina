import type { Experience } from "../types";
import { ArrowUpRight, Play } from "lucide-react";
import { useExperience } from "../store";
export function ExperienceThreshold({
  experience,
  onSelect,
}: {
  experience: Experience;
  onSelect: (entry: string, anchor?: string) => void | Promise<void>;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="threshold">
      <div className="threshold-copy">
        <h1>Every conversation is a fork in the road</h1>
        <p>
          An interactive exploration of one human's journey, the chatbot that
          guided it, and the power of language in shaping the journeys of
          tomorrow.
        </p>
        <a
          className="preview-video-link"
          href="https://youtu.be/mmqkF_sg0n4"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Play size={20} aria-hidden="true" />
          Watch the Preview
          <ArrowUpRight size={18} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="entry-invitation">
          Enter the conversation. Follow the journey. Or change it with a new reply....
        </p>
      </div>
      <div className="beginnings">
        <h2>Choose a Beginning</h2>
        {experience.profile.start_options.map((s) => (
          <button
            className="beginning"
            key={s.id}
            onClick={async () => {
              await onSelect(s.entry_message_id, s.anchor_id || "");
              useExperience.getState().setOptions({
                context_mode:
                  s.context_mode === "begin_context_here"
                    ? "begin_context_here"
                    : "inherit_history",
                include_summaries: s.context_mode === "curated_context",
              });
            }}
          >
            <span>
              <span className="beginning-title">
                {s.id === "naming-mirrows" ? "Naming the Bot" : s.title.split(" · ")[0]}
              </span>
              {s.title.includes(" · ") && (
                <small className="beginning-date">{s.title.split(" · ").slice(1).join(" · ")}</small>
              )}
              <small>{s.description}</small>
            </span>
            <ArrowUpRight size={22} />
          </button>
        ))}
        <p className="fine">
          Each beginning has pre-loaded context. The context workbench shows where
          it begins and lets you change it before branching.
        </p>
        <p className="mode-note">
          {experience.mode === "hosted"
            ? "Exploration prototype"
            : "Local curator edition"}{" "}
          · Source excerpts await author review. Branches expire after two
          hours; export anything you want to keep.
        </p>
      </div>
    </main>
  );
}
