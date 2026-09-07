import type { Experience } from "../types";
import { ArrowUpRight } from "lucide-react";
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
        <h1>
          Every conversation
          <br />
          could turn another way.
        </h1>
        <p>
          A counterfactual documentary drawn from Beaven’s conversations with
          Copilot, the companion he came to call Mirrows.
        </p>
        <p>
          Enter the record. Choose what the model knows. Write the next human
          turn, and see what follows.
        </p>
      </div>
      <div className="beginnings">
        <h2>Choose a beginning</h2>
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
              {s.title}
              <small>{s.description}</small>
            </span>
            <ArrowUpRight size={22} />
          </button>
        ))}
        <p className="fine">
          Each beginning has a context policy. The context workbench shows where
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
