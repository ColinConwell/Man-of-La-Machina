# Scripted Counterfactual Experiments

The backend runner branches at the three curated beginnings, intervenes with a seed instruction, and alternates a simulated Beaven (the Traveler) with a simulated companion. These are fictional characterizations grounded in selected documentary evidence. They are neither historical reconstructions nor predictions of the participant.

## Run an Experiment

The runner uses the existing `.env.local` credentials, provider adapters, alias projection, normalized bundle, and beginning catalog. It does not need a running web server. From the repository root:

```sh
# Inspect the complete plan without making model calls.
.venv/bin/python -m packages.experiments --suite experiments/counterfactual-suite.json

# Exercise every case with deterministic plumbing fixtures.
.venv/bin/python -m packages.experiments --offline --execute \
  --output experiments/results/offline

# Start a small live comparison across all three events and both seeds.
.venv/bin/python -m packages.experiments --execute \
  --condition baseline,memory-compact --output experiments/results/memory

# Reuse completed cases with exactly matching code, corpus, configuration, and factors.
.venv/bin/python -m packages.experiments --execute --resume \
  --condition baseline,memory-compact --output experiments/results/memory

# Produce a readable private comparison of completed and failed cases.
.venv/bin/python -m packages.experiments.review experiments/results/memory

# Audit factor boundaries and reconstruct every native payload from its manifest.
.venv/bin/python -m scripts.audit_counterfactual_results experiments/results/memory
```

`just counterfactual` also accepts the runner's flags. Planning is the default. `--execute` calls the configured providers, except when `--offline` is supplied. A full default run contains **72 cases and 432 dialogue calls**, plus preparation calls. Filter with comma-separated `--event`, `--condition`, and `--seed` values. `--exchanges` changes the number of pairs; `--concurrency` bounds concurrent cases. The default of two concurrent cases keeps request pressure modest. Missing credentials fail preflight. Transient network, SSL, timeout, rate-limit, and interrupted-stream failures receive one retry, with every failed attempt retained. Other failures, or an exhausted retry, stop that case, preserve partial responses, and allow the remaining cases to finish. The process exits nonzero if any case fails.

The initial boundary is inclusive: all eligible dialogue through the selected entry turn is historical context. The first generated Traveler turn enacts the seed intervention **after** that boundary. If the entry itself is a human turn, the intervention is a further human turn; the runner does not silently replace it. Every later turn is simulated. Ordinals determine order within a date, while disclosure dates exclude evidence unavailable at the boundary. The same curation catalog used by the app resolves boundaries, including the revised May 8 companion-advice turn. An edited local catalog can therefore change the experiment; the resolved ID and content fingerprint are saved.

## Factors and Initial Design

The shareable [suite](../experiments/counterfactual-suite.json) contains original experimental prompts, model settings, and the following paired conditions. Each condition changes one factor from the baseline. It is a screening design, not the full interaction factorial.

| Factor | Conditions | Implemented Behavior |
| --- | --- | --- |
| Past context | `full`, `compact`, `rolling` | Full replays every eligible historical turn. Compact replaces older turns with attributed chunk summaries and retains recent turns. Rolling also compacts completed simulated dialogue as the branch advances. |
| Traveler initialization | `minimal`, `past`, `retrospective` | Minimal supplies only the role. Past derives a tentative character sketch from eligible human statements. Retrospective also samples human statements beyond the boundary. |
| Future insertion | `none`, `static`, `dynamic`, `adapted` | None supplies no future cards. Static retrieves once using the seed. Dynamic retrieves again using the seed and two latest branch turns. Adapted also asks a separate model to propose hypothetical adaptations and identify contradictions. |
| Actor model | Independent Traveler and companion settings | Baseline uses OpenAI `gpt-4.1-mini`. Paired variants switch either actor to Anthropic `claude-sonnet-4-6` or Gemini `gemini-2.5-flash`. |
| Seed | Two original instructions per event | April 1 compares practical constraints and uncertainty. May 8 compares feasible alternatives and pausing overnight. May 10 compares boundaries around naming and an invitation to disagree. |

All existing configured providers can be used in a custom suite, including xAI, OpenRouter, and a configured local compatible endpoint. Model IDs and provider availability are checked by the shared adapter. These named models are tested configurations, not a claim of equivalent capabilities or current best performance. The `builder` model separately controls character sketches, compaction, and future adaptation. It remains fixed in actor-model comparisons.

Edit a copied suite or generate a fresh template with `--write-default PATH`. Conditions can combine factors to study interactions, assign different providers to both actors, and set `forward_audience` to `both`, `traveler`, or `companion`. An audience limit controls direct insertion only: a simulated character can subsequently convey that information in dialogue. `repetitions` supports repeated samples; preparation objects are intentionally shared across repetitions when their inputs match, while dialogue is regenerated. No vendor-independent random seed or deterministic live replay is promised.

## Evidence and Transformations

Characterization uses human statements only, evenly sampled across the eligible range, with explicit excerpt limits. The sketch records selected, omitted, and retrospective source IDs. Its prompt asks for attributed observations, tentative inferences, and unresolved tensions while omitting concrete future outcomes. That instruction does not prove semantic removal of future knowledge; retrospective characterization is itself a future-information intervention. The companion does not directly receive the character sketch.

Compaction includes all older eligible history, divided into bounded chunks. Oversized messages are split explicitly. Every part records the exact evidence, source hashes, prompt, builder settings, output, and provider receipt. Summaries separate human statements, companion suggestions, practical constraints, corrections, and uncertainty. Chunk summaries are concatenated transparently, rather than silently reduced again. This can exceed a small budget; the runner then fails explicitly. Recent history and recent simulated turns remain verbatim. Rolling memory summarizes only completed older branch turns and prior branch memory, preserving dependency links through the saved memory objects.

Future retrieval is a deterministic lexical baseline over later or otherwise unavailable conversation turns. It ranks distinct shared terms, breaks ties by source ordinal, and returns bounded leading excerpts. Scoring considers the entire message, so a leading excerpt may omit the matching passage; the receipt exposes matched terms and the excerpt flag. It does not use embeddings, independent event summaries, manuscript documents, or retrospective annotations. Unknown disclosure is labeled unavailable rather than assigned an invented timestamp. Static and dynamic retrieval share the same query on the first turn and can select identical cards later; a zero change count is a valid observed result.

Adaptation receives the cards plus the seed and two latest branch turns. It proposes possible analogues, identifies contradictions, and labels its output hypothetical. Raw cards remain available beside the adaptation for inspection. No automated semantic validator guarantees that a model respects these instructions. In particular, a later recorded event is never programmatically promoted into branch history, but dialogue can still contain mistaken temporal claims that need human review.

Each actor sees history and simulated messages using its own assistant role: human/Traveler turns are assistant-role examples for the Traveler; companion turns are assistant-role examples for the companion. Historical message bodies remain verbatim in actor-role examples, while source metadata stays in the manifest. The system framing and an explicit branch boundary distinguish evidence from active instructions; source headers are not added to actor dialogue examples. The interactive experience's companion-only policy is unchanged; this experiment uses a separate simulation policy and records its version.

## Budgets, Results, and Interpretation

The input bound follows the existing backend's conservative UTF-8-byte estimate, with an additional output reserve. It is not a provider tokenizer or automatic model-window lookup. The default allows the current full prefix at all three beginnings; provider-specific limits can still reject a request. Nothing is silently dropped from a `full` condition. A length-limited, refused, empty, or interrupted response does not become a completed simulated turn or reusable memory.

Results default to ignored `experiments/results/`. New directories are owner-only and result files use mode `0600`. The files contain private aliased source material and generated dialogue. Share only deliberately reviewed exports. A result includes the exact native request payload and hash, manifest, resolved model metadata when supplied, timings, completion status, character evidence, compaction lineage, retrieved cards, adaptation, and simulated turns. Credentials and request headers are excluded. The alias projection happens before evidence selection or provider calls.

`plan.json` records the selected case matrix and initial history sizes. Individual JSON files checkpoint completed or failed cases. `metrics.csv` and `index.json` summarize the last invocation's selection; `review.md` can include every case file currently in a directory. Use a separate output directory for each configuration. `--resume` reuses only completed cases whose identities match the entire suite, aliased bundle, and implementation fingerprint; failed cases restart from the boundary and replace their case file. Copy failed case files to a separate directory before restarting if you need their earlier complete-case receipts; transport retries within a case always retain prior attempts. Preparation is cached within an invocation, not across processes. Native payload receipts identify actual inputs, but do not guarantee identical future model output.

Metrics measure input bounds, completed turns, new versus reused calls, actual request attempts and retries, retrieval changes, retrospective persona exposure, branch-compaction counts, and source-ID echoes in generated speech. They do not score character fidelity or causal validity. Compare the same event and seed across conditions; April 1 has almost no older history to compact, which is a useful boundary case rather than a strong memory test. Human review should separately assess correction retention, attribution, continuity, character plausibility, temporal leakage, and whether an adapted motif fits the changed branch. At least several repetitions and a defined evaluation rubric are needed before drawing comparative model conclusions.

## Verification

```sh
.venv/bin/python -m pytest -q tests/test_experiments.py tests/test_providers.py
.venv/bin/python -m pytest -q
```

Invented fixtures test chronology, unavailable disclosure, actor-relative roles, future-free preparation, characterization scope, direct-insertion audience controls, compaction lineage, dynamic retrieval, explicit budget rejection, partial and length-limited outputs, bounded retry receipts, resume behavior, Unicode chunk coverage, cache invalidation, all five native remote payload routes, and private result permissions. Offline runs exercise orchestration but do not test model quality. See the [experiment report](../reports/002-2026-09-21-scripted-counterfactuals.md) for the initial live screening and its limitations.

## Independent Results Dashboard

```sh
# Requires the existing frontend dependencies: npm ci --prefix apps/web
just results
# Or build once, then serve a chosen results root or port:
just results-build
.venv/bin/python -m tools.results_dashboard --port 8002 --results experiments/results
```

Open **http://127.0.0.1:8002/**. The dashboard is a separate React/Vite build and a local, read-only FastAPI process under `tools/results_dashboard/`. It shares build dependencies with the prototype but does not change its UI, routes, generation policy, or server. It calls no models and writes no simulation data.

The path-tracing screening opens by default when present; otherwise the final counterfactual screening opens. Select another saved run to inspect earlier failures or explicitly labeled offline fixtures. Event, seed, condition, and search filters update the scenario list and summary counts. The memory chart compares completed baseline and compact-history cases matched by event, seed, and repetition; it follows event and seed filters, independently of condition and search filters. Displayed sizes are conservative input bounds, not vendor tokens.

Select a scenario to read all simulated turns. **Compare With Baseline** loads the matching event, seed, and repetition beside it. **Context** shows characterization, derived memories, source references, and per-turn future retrieval and adaptation. **Receipts** loads exact native payloads and manifests on demand, including retained transport attempts. **Download Case JSON** exports the original complete case. Earlier case-level failures in a local `attempts/` directory are counted in the inspector and remain accessible on disk.

The server reads only runs with a plan, checks case membership and file identity, prevents symlink/path escape, binds to loopback, and rejects remote, foreign-origin, and cross-site requests. Hosted mode is disabled. Browser responses are not cached, and the frontend uses no external assets or analytics. Source and generated text are rendered as text/Markdown without raw HTML or remote images. The production build contains interface code only; private results stay under the ignored results directory.

## Path-Tracing Experiments

Path tracing provides two ordered recorded events and generates an invented conversational bridge between them. The starting turn is included in past context. The ending turn is a fixed later utterance, supplied as reference material according to the condition; it is not generated, not a completed outcome, and not a turn the actors should answer prematurely. Eight simulated turns represent selected moments across the interval. This first design does not reconstruct every missing exchange or require equal time between turns.

```sh
# Inspect the 18-case plan without calling providers.
.venv/bin/python -m packages.experiments --path-tracing
# Save an editable public configuration.
.venv/bin/python -m packages.experiments --path-tracing --write-default experiments/path-tracing-suite.json
# Exercise orchestration with explicit fixtures, then execute real models.
.venv/bin/python -m packages.experiments --path-tracing --offline --execute --output experiments/results/path-tracing-offline
.venv/bin/python -m packages.experiments --suite experiments/path-tracing-suite.json --execute --concurrency 3 --output experiments/results/path-tracing-screening
.venv/bin/python -m scripts.audit_counterfactual_results experiments/results/path-tracing-screening
```

The three intervals are April 1 → May 8, May 8 → May 10, and April 1 → May 10. Each uses the same bridge seed, four exchanges, compact older history, and characterization from past human statements. Six conditions isolate four disclosure strategies and two actor-provider substitutions:

| Condition | Endpoint Disclosure and Planning |
| --- | --- |
| Endpoint Upfront | Both actors receive the endpoint on every turn. This is the comparison baseline. |
| Backward Waypoints | Both receive the endpoint and a shared model-generated plan. The planner reasons backward about prerequisites and presents four exchange goals in chronological order. |
| Midpoint Reveal | Neither actor receives the endpoint on turns 1–4; both receive it on turns 5–8. No endpoint-derived plan is supplied early. |
| Companion-Only Endpoint | Only companion requests receive the endpoint directly. Information may subsequently propagate through simulated dialogue. |
| Anthropic Companion | Upfront endpoint with `claude-sonnet-4-6` as companion and `gpt-4.1-mini` as Traveler. |
| Gemini Traveler | Upfront endpoint with `gemini-2.5-flash` as Traveler and `gpt-4.1-mini` as companion. |

All other actor calls and all preparation/review calls use `gpt-4.1-mini`. Past-only characterization and compact memory are held constant. The recorded gap and later archive are unavailable to retrieval, actors, plans, and reviews. A path suite rejects retrospective personas and ordinary future-card insertion to keep this holdout explicit. Endpoints must be ordered by ordinal and known disclosure; same-day endpoints can be ordered by ordinal. A custom path suite can specify any two registered beginning IDs using `start_id` and `end_id`; the initial design uses the three primary demarcations.

Each case saves both exact anchors, withheld gap IDs, preparation provenance, the direct-disclosure schedule, every simulated turn, and exact provider receipts. The planner receives only the anchors and seed; the actors also receive allowed past context. A final model call critiques endpoint handoff, unsupported transitions, and an alternative path. Reviews are unvalidated text, not scores. A failed review leaves the completed bridge available with a separate failure status; an incomplete actor or planner response stops that case. Dialogue completion means the requested number of turns were generated, not that the endpoint was reached convincingly.

The dashboard defaults to `path-tracing-screening` when present. Its **Path** tab shows source anchors, clickable direct-exposure cells, waypoint plans, and model reviews. **Dialogue** brackets invented turns with separately labeled recorded anchors. **Compare With Upfront** matches interval, seed, and repetition. The original counterfactual run remains selectable. `path-tracing-pilot` preserves an earlier prompt version that exposed premature endpoint enactment; code fingerprints distinguish that version from the refined screening.

The [path-tracing report](../reports/003-2026-09-21-path-tracing.md) records the initial findings and limitations. Structural audits verify input separation and exact payload integrity; they cannot detect all semantic leakage, inferential foreknowledge, chronology errors, or inaccurate reviewer conclusions.

## Event Timelines and Model-Chosen Scripts

The next design compares one scriptwriting agent that writes both characters with two agents that alternate character turns. Both receive past context and the exact terminal utterance. Adaptive conditions prescribe no turn count; models decide when the terminal utterance has a plausible lead-in. Operational limits remain explicit: 24 turns and 4,096 output tokens per actor request. Reaching a limit without a handoff is labeled capped, not successful completion. Fixed controls request eight turns.

```sh
# Build the private event inventory, then conservatively review its candidates.
.venv/bin/python scripts/build_event_timeline.py --help
.venv/bin/python scripts/build_event_timeline.py --concurrency 6
.venv/bin/python scripts/build_event_timeline.py --review-only --concurrency 6
# Inspect, exercise, execute, and audit the 36-case script design.
.venv/bin/python -m packages.experiments --script-paths
.venv/bin/python -m packages.experiments --script-paths --offline --execute --output experiments/results/script-path-offline-final
.venv/bin/python -m packages.experiments --suite experiments/script-path-suite.json --execute --concurrency 3 --output experiments/results/script-path-screening
.venv/bin/python -m scripts.audit_counterfactual_results experiments/results/script-path-screening
```

Across each interval, the twelve conditions are one/two agents × fixed/adaptive dialogue, one/two agents × adaptive annotated context, one/two agents × adaptive event-only context, one/two agents with a state-first planning pass, a compact-history scriptwriter, and an adaptive two-agent condition with an Anthropic companion. Other actor calls use OpenAI; provider IDs and generation settings are saved in the public suite. This is a small screening design with one sample per condition and interval, not a full factorial or a provider ranking.

The input representations are explicit:

- **Dialogue** preserves the eligible recorded bodies, with speaker labels, up to and including START. Compaction substitutes a generated memory for older bodies and retains recent turns.
- **Annotated** adds available source tags and metadata plus the two retrospective annotation bodies. Because those annotations have unknown disclosure dates, these conditions are deliberately labeled hindsight-exposed and are not blind holdouts.
- **Event-Only** supplies plain event records extracted from the archive. Literal evidence quotes stay in provenance rather than in actor inputs. Exact START and END utterances are still provided. An event is eligible only if every source seen by its extraction and review calls was available at START; this prevents a seemingly early event from importing future-aware preprocessing.

Characterization comes from these inputs. No separately generated character sketch is added in this design. State-first planners derive a hypothetical transition contract from the anchors. All bridges carry per-turn physical-event and knowledge metadata; generated events are explicitly hypothetical and remain separate from the source timeline.

The main experience adds **Events** at `http://127.0.0.1:8000/?page=events`. Play, pause, scrub, and filter the event sequence; open evidence and jump to its source conversation. The sequence follows disclosure order when occurrence dates are unknown. It does not infer elapsed time from screen spacing or turn order. Reported events, plans, and uncertain records remain separate. Extraction and semantic review are model-assisted filters, not human verification or guarantees of exhaustive recall.

Each dashboard result opens a **Setup** panel with a graph of exact input → request → output dependencies. Select an input to inspect its exact prompt/context blocks and source versions, follow derived material to its preprocessing call, and inspect native payloads. The roster distinguishes dialogue agents from supporting requests. **Export Graph + Receipts** preserves the graph and all linked native calls; **Clone and Intervene** downloads an editable suite for the backend runner. It neither launches models nor modifies the saved result. **Dialogue** includes animated hypothetical event playback when transition events were generated.

The dashboard defaults to `script-path-screening` when present. Previous runs, pilots, failures, and offline fixtures remain selectable. Completion records a model handoff or the fixed turn budget, not a validated chronological bridge. Exact receipts make prompts reproducible, but stochastic model outputs and changing provider snapshots prevent guaranteed identical reruns.

## Reading Individual Results and Previewing Nodes

The results dashboard provides a dedicated result viewer for selected saved cases, with formatted dialogue and separately marked recorded anchors. Per-turn agent/setup details are available on hover or keyboard focus and can be pinned by clicking for touch access. Request links connect the displayed turn to its saved context. Individual result URLs identify their run and case for direct loading and sharing within the local dashboard.

Selecting a setup graph node opens a visible preview of its associated content. The preview supports reading individual prompt/context blocks without locating a collapsed section below the graph; larger groups can be searched. Keyboard and touch controls provide the same inspection path.

All displayed and downloaded artifacts use the current private aliases. A substituted receipt is explicitly a display projection: original identifiers and hashes remain attached to the immutable saved record, and a changed native payload includes its separate display hash. This preserves historical evidence while preventing original names from reappearing in generated prose or prompt previews. The original private files remain the source for byte-for-byte audits.
