# Review of the Experience, Agentic Setups, and Exploration Interfaces

Date: 2026-10-16. Status: review with prioritized proposals; one implemented companion tool, the local [project deck](../.agents/docs/DECK.md). This report contains no private transcript or manuscript excerpts.

## Method

I read the repository documentation, reports [001](001-2026-09-14-conversation-memory.md)–[004](004-2026-09-21-event-timelines-and-script-paths.md), the experiment configuration and runner, and the frontend features. I then ran the hosted experience locally with the deterministic demo provider at 1440×900: a beginning, a branch, Compare, and Events. I also ran the results dashboard on the saved screenings. No provider calls were made. Mobile and kiosk layouts were not retested; earlier verification covered them.

## What Exists

**Evidence.** The public experience offers three beginnings, a four-tab reader (Transcript, Branch, Compare, Artifacts), a context workbench (breadth from scene to journey, tag-level withholding, replacement of the selected human turn, presets), exact receipts, a five-exchange branch cap, and an animated Events view over 221 reviewed events. Locally, the counterfactual runner implements three suites: 72 counterfactual cases, 18 path-tracing cases, and 36 script-path cases. The dashboard exposes every saved case with a setup graph, exact requests, and a formatted viewer.

**Interpretation.** The infrastructure is unusually careful about provenance: chronology, alias projection, receipts, and the separation of recorded, visitor, and generated text are all enforced in code. The agentic experiments, however, live entirely in researcher tooling. The public piece still exposes only one generated voice, the companion. The richest finding from the simulations is that models gravitate toward the ending they are shown, as the companion gravitated toward the story it was told. That finding is not yet visible to a visitor.

## Agentic Setups: Proposals

Ordered by expected value for the research question.

1. **Separate a director from the actors.** Reports 003 and 004 both found premature endpoint enactment, and instructions alone did not prevent it. A director should receive both anchors and emit per-exchange goals from independently checked prerequisites. The actors should see only those goals, never the END wording, and a separate final step should render the terminal utterance. A code-side state ledger can check monotonic elapsed time, location continuity, and knowledge-set growth rather than trusting the model's own `transition` fields.
2. **Replace the single permissive critic with targeted, blinded checks.** Ask narrow yes/no questions per turn: does turn *k* enact END, did a speaker's role drift, does elapsed time contradict an earlier turn? Hide condition labels from the judge. Calibrate on a small, human-labeled set and report agreement before using any judge as a measure. The current critiques tracked thematic overlap more than prerequisites.
3. **Repeat samples.** Every screening used one stochastic branch per cell. Run at least five per condition with recorded temperature, and report intervals on structural measures: turn count, the first turn that overlaps END, and future-card exposure. Without repeats, condition differences cannot be separated from sampling noise.
4. **Make memory a visible, editable object in the public experience.** The runner already produces attributed compaction summaries. Offering *derived memory* as a context option, with the summary shown and individual claims strikable, answers the visitor's natural question, "what did it remember?" It also realizes the proposal in report 001 without claiming to reproduce Copilot's memory.
5. **Bring a second simulated voice into the public piece, explicitly labeled.** For example, a visitor could ask the simulated Traveler to *propose* a next human turn, then edit or reject it before sending. This keeps human authorship explicit while exposing the two-agent dynamic the essay discusses. Any fully automatic two-voice mode should be labeled as fiction and kept out of the exhibition until reviewed.
6. **Curate the rupture.** The red-line moment involves crisis-related content. For exhibition use, prefer a human-reviewed presentation of that moment over live generation. Keep surfacing provider safety outcomes as distinct states, as the adapters already do.
7. **Improve retrieval and events.** Replace lexical future retrieval with retrieval over reviewed, deduplicated event cards. Add salience to the event inventory so playback can foreground turning points: the Events view currently opens on minor logistics.
8. **Add a current-generation model condition, not a replacement.** Baselines use `gpt-4.1-mini`, `claude-sonnet-4-6`, and `gemini-2.5-flash`. Adding newer models as separate conditions preserves comparability with the saved screenings.
9. **Fix the script-path seed's stray comma.** The seed in `packages/experiments/config.py` reads "between the Traveler, and the same AI companion", a residue of removing the participant's name. Saved runs predate that removal, so their alias projection displays "The Traveler, the Traveler." Correcting the text changes the suite fingerprint, so do it with the next run rather than silently. A test could flag duplicated appositive role phrases after projection.

## Exploration Interfaces: Proposals

### Main Experience

1. **Progressive disclosure on entry.** After a beginning is chosen, three dense columns and a timeline appear at once. Lead with the reading and the composer. Then introduce the context workbench as a second, named step ("What should the companion know?"), with advanced controls collapsed.
2. **Show the run-up, not one turn.** The transcript shows only the selected turn behind "Read full passage." A short scroll of the preceding exchanges, ending at a visible pause line, would give the visitor the context the model receives.
3. **Make the two interventions first-class.** The essay's design separates *a different next move* (replace a human turn) from *a different inherited past* (withhold earlier disclosures). In the interface these are a checkbox and a set of tags. A paired mode would help: hold the visitor's turn fixed, generate under two contexts, and compare. That is the essay's core comparison, and today it requires manual repetition.
4. **Default to side-by-side once a branch exists.** Comparison is the point of the piece, but it sits behind its own tab. Recorded continuation on one side and the branch on the other, aligned at the pause, matches the "beside the recorded history" framing.
5. **Show context composition at generation time.** A compact bar of what the request contained (thread, withheld groups, the visitor's turn), with what withholding removed, would connect the receipt to its meaning. The deck's context bar demonstrates the idea.
6. **Clarify status language.** "Local Curator / Demo" reads as a role. "Demo: no model calls" or the active provider name is clearer.
7. **Timeline legibility.** Label the three beginnings on the axis, show anchor names on hover, and make the resolution control's effect visible.

### Results Dashboard

1. **Add an animated replay of a case.** The setup graph is exact but static. The deck's beat player (`tools/deck/web/FlowViz.jsx`, fed by `tools/deck/samples.py`) already replays saved cases in call order and could be embedded.
2. **Add a condition × interval matrix.** Show report 004's turn-count table as an interactive grid: status, completion reason, and (once proposal 2 exists) first premature-enactment turn per cell, each linking to its case.
3. **Name the page by run kind.** Script-path runs currently appear under a "Path-Tracing Results" heading.

## Implemented in This Session

A local-only project deck (`just deck`, port 8003) presents the work in presentation and edit modes. Six interactive simulations cover the recursive conversation, the hosted branch flow with both interventions, scripted counterfactuals (ten conditions), path tracing (six policies plus the pilot failure mode), script paths (five variants), and event extraction. Each beat shows the producing agent, its model, and the composition of the context that call received. Any experiment slide can be bound to a saved case, which is converted to beats in real call order and alias-projected by the server. Slide content and edits stay under the ignored `manuscript/deck/`. See the [deck guide](../.agents/docs/DECK.md) and the [CHANGELOG](../CHANGELOG.md).
