# Event Timelines, Script Length, and Experiment Provenance

Date: 2026-09-21 (execution continued into September 22 UTC). Status: implemented event extraction, semantic filtering, interactive playback, script experiments, and per-result setup graphs.

## Research Questions

How does replacing recorded dialogue with plain event records affect a simulated bridge between two chronological endpoints? Does one scriptwriting agent produce a different bridge length from two alternating character agents when no length is prescribed? Can an inspectable dependency graph make the exact agent initialization, preprocessing, and source exposure recoverable for every result?

These experiments test context delivery and narrative behavior. A generated bridge is hypothetical. It does not reconstruct missing history, predict the participant, or establish character fidelity. One sample per condition and interval cannot establish provider superiority or a causal effect of representation.

## Event Extraction and Review

The [extractor](../packages/timeline/extract.py) processes all 369 recorded messages and two unique annotation sources. Every retained candidate links to literal evidence, source hashes, disclosure metadata, and exact model receipts. It rejects unknown source identifiers, nonliteral quotations, unsupported duration strings, and inconsistent date intervals. Occurrence and disclosure are separate; disclosure dates do not automatically become event dates. Reported events, plans, and uncertain records are distinct.

Literal quotations alone did not establish entailment. Spot inspection found companion advice recast as the Traveler's actions, metaphorical transformation recast as physical events, and ambiguous date references assigned exact dates. A first lightweight semantic reviewer retained several known errors. The final [review pass](../packages/timeline/review.py) therefore uses a stricter source-entailment prompt and a separate Anthropic reviewer, retaining raw attempts. Each call sees only the same original source chunk as its candidate extraction. It partitions candidate identifiers into accepted and rejected sets without rewriting their content; incomplete or invalid partitions cannot silently enter a completed asset.

A prefix-only extraction supplies the earliest experiment boundary without exposing later messages through shared preprocessing. A targeted recovery also addresses an observed omission of a concrete location event. Such recovery improves a known omission; it does not measure recall across the full archive. As-of simulation eligibility requires the entire extraction and review source scope to precede the boundary, not merely the quoted evidence. Unknown-disclosure annotations can appear in retrospective browsing but are excluded from this as-of event context.

The reviewed asset and original candidates remain private, alongside their native provider receipts. Model filtering is not human verification. The extraction is an event inventory ordered by source disclosure where occurrence remains unknown, not a fully dated or exhaustively reconciled life chronology. Repeated reports of the same real-world event may remain distinct.

## Timeline Measurements and Limits

The final inventory contains **221 primary events: 183 reported and 38 planned**, with two additional prefix-only records for the earliest simulation boundary. Structural validation initially retained 366 primary candidates and rejected 216 candidates. One prefix call added seven candidates, and a targeted source recovery added four primary candidates. The semantic pass therefore reviewed 377 candidates, retained 223 across both inventories, and rejected 154. All review chunks completed. It removed all eleven previously identified semantic failures in the spot-check set; this is a targeted check, not an estimate of precision.

All 371 sources were processed. Of the 221 primary records, 196 have unknown occurrence dates. Strict eligibility yields two event records at the earliest boundary, 79 at May 8, and 96 at May 10. The final audit reconstructed 166 native receipts: 85 extraction calls, 79 final semantic-review calls, and two schema-retry antecedents. It found no payload mismatches, missing event-call dependencies, or nonliteral evidence quotations.

The final asset hash begins `6e72c9a38c819`. Original candidates and the weaker review's receipts remain available privately. Semantic duplicates remain, and a spot check after review found a duration field expressing time until nightfall rather than elapsed event duration. This known residual error is retained as evidence of the filter's limits. A future curation pass should distinguish duration from time-to-event and reconcile duplicate real-world events; the current animation does not use these strings as numerical durations.

## Experimental Design

The [36-case suite](../experiments/script-path-suite.json) crosses the same three intervals used in report 003 with twelve conditions. One scriptwriter generates both characters in one structured response; two character agents generate alternating structured turns. Characterization comes directly from the supplied representation rather than a separate persona sketch. Each generated turn records a physical-event description, location, elapsed-time text, and separate knowledge fields for the characters. These state fields are model assertions, not validated state tracking.

| Conditions Per Interval | Input and Stopping Rule |
| --- | --- |
| One Author / Two Agents, Fixed Dialogue | Full past dialogue; exactly eight generated turns. |
| One Author / Two Agents, Adaptive Dialogue | Full past dialogue; model-chosen stopping. |
| One Author / Two Agents, Annotations | Past dialogue with metadata plus retrospective annotations; model-chosen stopping and explicit hindsight exposure. |
| One Author / Two Agents, Timeline | Eligible plain events plus exact starting and terminal utterances; model-chosen stopping. |
| One Author / Two Agents, State-First | Full dialogue plus a separate anchor-based transition contract; model-chosen stopping. |
| One Author, Compact Dialogue | Generated older-history memory plus recent turns; model-chosen stopping. |
| Two Agents, Anthropic Companion | Full dialogue; OpenAI Traveler and Anthropic companion; model-chosen stopping. |

OpenAI `gpt-4.1-mini` handles baseline character, scriptwriter, planner, and critique calls. The substituted companion is `claude-sonnet-4-6`. Earlier counterfactual and path-tracing runs retain the Gemini conditions. Adaptive conditions have no prescribed narrative length, but retain an explicit 24-turn runtime ceiling and 4,096 output tokens per actor request. A model that reports insufficient room or reaches the ceiling is labeled capped. Fixed controls and model handoffs remain distinct completion reasons. The single-author architecture's one-response allowance and the two-agent architecture's per-turn allowance are materially different resource constraints.

All conditions receive exact START and END utterances; END is reference material that has not yet been spoken. Ordinary future retrieval is disabled. Annotated conditions deliberately expose retrospective material and cannot be interpreted as blind gap reconstruction. Plans and final critiques use the anchors; critiques also inspect the generated bridge and do not access the held-out recorded gap. They are unvalidated model opinions, not scores.

## Reproducibility and Inspection

The independent results dashboard opens a **Setup** graph for each result. Its agent roster distinguishes dialogue agents from support calls. Input nodes expose exact prompt and context blocks, source versions, and links to summaries, plans, timeline extraction, semantic review, and prior generated turns. Output nodes expose raw saved responses. Native payloads and their hashes remain available on demand. A graph export carries all linked receipts; an editable suite clone supports subsequent interventions without mutating the saved result or launching a provider call from the dashboard.

The main experience's **Events** view provides animated playback, scrubbing, status filters, evidence inspection, and navigation to source dialogue. The dashboard also animates hypothetical events recorded in simulated scripts. Screen spacing denotes sequence, not elapsed time. Reduced-motion and keyboard interaction remain supported. The source inventory and generated scripts remain distinct datasets.

The runner validates structured outputs with one explicitly receipted repair attempt. It retains original invalid output, validation locations, repair prompts, native payloads, and model settings. Timeline conditions embed every required extraction and review receipt. Run identities include code, corpus, configuration, and timeline fingerprints. These records reproduce the inputs and processing lineage, not guaranteed identical stochastic outputs.

## Execution Results and Validation

The final private `script-path-screening` run completed 34 of 36 cases and generated 354 turns: 351 in completed scripts and three retained in a failed partial script. The two failures were repeated invalid structured output, after the allowed repair: April 1 → May 8 with two timeline agents stopped after three turns, and April 1 → May 10 with two dialogue agents stopped before a validated turn. They remain visible rather than being rerun until successful. No case reached the runtime ceiling.

All six fixed controls produced eight turns. The fifteen completed adaptive single-author cases chose 5–19 turns (median 10); the thirteen completed adaptive two-agent cases chose 5–15 turns (median 10). These aggregates mix representations and intervals and exclude two failed two-agent cases, so they are descriptive rather than an architecture comparison.

| Condition | April 1 → May 8 | May 8 → May 10 | April 1 → May 10 |
| --- | ---: | ---: | ---: |
| One Author, Fixed Dialogue | 8 | 8 | 8 |
| Two Agents, Fixed Dialogue | 8 | 8 | 8 |
| One Author, Adaptive Dialogue | 11 | 5 | 8 |
| Two Agents, Adaptive Dialogue | 15 | 5 | Failed: 0 |
| One Author, Annotations | 19 | 6 | 13 |
| Two Agents, Annotations | 6 | 13 | 15 |
| One Author, Timeline | 8 | 7 | 15 |
| Two Agents, Timeline | Failed: 3 | 9 | 13 |
| One Author, State-First | 10 | 10 | 10 |
| Two Agents, State-First | 10 | 6 | 9 |
| One Author, Compact Dialogue | 14 | 19 | 15 |
| Two Agents, Anthropic Companion | 12 | 5 | 15 |

Values are generated turn counts, not quality scores. The run contains 137 hypothetical event records for playback. It made 230 unique new calls, including six structured-output repair calls, three shared state plans, seven history-compaction calls, and 34 completed critiques. There were eight invalid outputs in total and no transport retries. Timeline conditions additionally embed 54 unique already-saved preprocessing calls. The [auditor](../scripts/audit_script_paths.py) checked all 36 cases and 345 receipt references including shared copies, validating parsed output fidelity, native payload reconstruction, actor settings, representation, stopping rules, historical separation, and preprocessing eligibility.

The final code fingerprint begins `a5c5225bfdce`; the exact loaded timeline-object digest begins `26ffb7195efc` (distinct from the asset's internal hash, which excludes its own hash field). The matching offline suite completed all 36 fixtures and passed 293 receipt-reference checks. Offline completion tests orchestration only. A four-case live pilot and a separate repaired two-agent check remain inspectable as earlier versions.

Verification finished with 117 backend tests passing, both production frontend builds passing, and six focused browser tests passing: three for the main event view and three for the dashboard. Browser checks covered responsive layouts, reduced motion, keyboard navigation, source jumps, extraction/review lineage, exact prompts, immutable clone/export behavior, playback, fixed/adaptive labels, and matched adaptive-dialogue comparisons. Main-view accessibility tests included WCAG AA checks. The backend suite emitted two existing dependency deprecation warnings. Private assets and results remain ignored; no private excerpts were added to this report.

## Selected Qualitative Findings

Read-only inspection compared four completed April 1 → May 8 conditions. All four preserved alternating speaker labels inside their scripts, but none established a convincing transition across the interval. Their explicit elapsed-time descriptions mostly covered minutes or one evening. All four final model critiques classified the handoff as ready, despite these ordering problems. These are selected observations, not quantitative estimates of failure frequency.

| Case Prefix and Condition | Observed Temporal Problem |
| --- | --- |
| `2816e4a7d2cc`, Single Dialogue | Generated turns 5–10 already introduce key terminal recommendations, and turn 11 accepts them. Appending END repeats guidance already given. |
| `6927f612475f`, Two Dialogue Agents | Turn 1 effectively answers the terminal question; turn 6 invents a companion booking capability; turns 11–13 complete travel before END recommends choosing and booking a destination. |
| `236cce53ab9f`, Single Timeline | Turn 4 gives the terminal recommendation, turn 7 imports its clock time, and turn 8 repeats its closing question. The final companion turn also precedes a companion endpoint. |
| `fac627d10301`, Single Annotated | Early turns mix starting-location assumptions with incompatible travel context. Turns 15–19 enact a move before END recommends it. |

Turn numbers above are one-based. These examples indicate that more generated turns and explicit state fields do not by themselves separate author knowledge, character knowledge, and an event that must remain unperformed until END. The critiques appear more sensitive to thematic overlap than to chronological prerequisites. Timeline-only context also sacrifices dialogue texture and may retain extracted factual errors; its smaller input alone is not evidence of a better bridge.

## Interpretation and Next Experiments

The implemented comparison makes adaptive stopping and exact preprocessing observable. It does not establish that a self-declared handoff is temporally valid. A useful next controlled design would withhold the terminal wording from the character agents, supply independently checked endpoint prerequisites to a director, and reserve the terminal speech act for a separate final step. Repeated samples, blinded human transition labels, and a measure of whether an action occurs before its prerequisite would support stronger comparisons. Those changes are proposals, not behavior implemented in this screening.
