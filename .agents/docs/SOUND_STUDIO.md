# Sound Studio

## Scope And Entry Points

The local studio lives in `tools/sound_studio/`, with reusable backend code in `packages/audio/`. It is independent of `apps/api/app.py`, the production frontend, and the synthetic Landscape Studio. Production's Railway ignore file excludes all tools. Audio dependencies are intentionally absent from the application's Python 3.14 environment.

- `just sound-setup` creates `tools/sound_studio/.venv` with Python 3.11 and installs the core lockfile plus frontend packages. `uv`, Node, FFmpeg and Rubber Band must be installed.
- `just sound-alignment` adds WhisperX 3.8.6 for CPU forced alignment. Existing model caches are reused. Weights and NLTK tokenizer data stay beneath the configured model cache. First use can download missing files.
- `just sound` builds the frontend and starts FastAPI on loopback through `library.ports`. `--port` binds exactly; otherwise the port registry selects an available port. `just ports` lists running services.
- `just check-sound` runs the isolated Python and browser tests. Browser tests default to installed Chrome; override `SOUND_TEST_BROWSER_CHANNEL` if required. They use a fresh temporary data directory, invented text, generated tones, and no paid provider calls.

## Configuration

Environment variables override defaults. `.env.local`, `content/curation/storage.local.env`, and `.machina/sound-studio/storage.local.env` are loaded server-side without overriding the process environment. The last path is a convenience for this checkout; exported variables remain the portable interface. Never copy credentials into Vite variables, manifests, recipes, reports, or fixtures.

| Variable | Purpose |
| --- | --- |
| `MACHINA_SOUND_DATA` | Local catalog, immutable objects, manifests, recipe revisions, and alignment model cache; defaults to `.machina/sound-studio`. CLI `--data-dir` takes precedence. |
| `MACHINA_SOUND_PORT` | Explicit local service port; normally leave unset and use the registry. |
| `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `GEMINI_API_KEY` | Existing speech-provider credentials. Missing credentials disable generation for that provider, not editing. |
| `MACHINA_SOUND_MODEL_CACHE` | Alternative alignment-weight/tokenizer cache. |
| `MACHINA_FFMPEG`, `MACHINA_RUBBERBAND` | Executable names or configured executable locations. |
| `MACHINA_SOUND_MAX_RENDER_SECONDS` | Upper bound on a completed mix; defaults to 7200 seconds. Imports have a two-hour / 512 MiB bound. |
| `MACHINA_SOUND_PRICES_PER_MILLION_CHARACTERS` | JSON object mapping provider names to explicitly configured dollar estimates. Unknown rates remain unknown. Actual billing can use other units. |
| `MACHINA_SOUND_BUCKET` | Optional bucket override; otherwise reuse `MACHINA_CONTENT_BUCKET`. |
| `MACHINA_CONTENT_ENDPOINT`, `MACHINA_CONTENT_ACCESS_KEY_ID`, `MACHINA_CONTENT_SECRET_ACCESS_KEY`, `MACHINA_CONTENT_REGION`, `MACHINA_CONTENT_URL_STYLE` | Existing private S3 connection, using `packages.content.storage.content_client`. HTTPS is required. |

The storage prefix is fixed to `sound-studio/v1/`. Content and editorial release keys are not accepted. Single-user local operation is assumed; do not bind this server publicly or use it as an authenticated hosted service.

## Contracts And Catalog

Version 1 source snapshots retain text, source identity/version, extraction choices and a text hash. Generation records retain the exact adapter/model/voice/settings and request receipts. Sources and recordings are separate from project recipes. Each completed take has its own identity even if its bytes are identical to another take.

Projects have optimistic revision checks. Older project, feature and alignment manifests are kept in `revisions/`; current manifests are authoritative for rebuilding SQLite. Audio objects are content addressed by SHA-256 and never edited in place. Catalog records include jobs, batches, projects, samples, feature tracks and alignments. SQLite uses WAL and the catalog directory/file permissions are private. Back up the entire configured data directory, not only the database file.

A saved project JSON export is a recipe and references sample IDs. Audio/manifest exports or a private S3 round trip are needed to transfer the referenced assets. S3 project upload includes directly referenced samples and convolution impulses, plus matching analysis/alignment records. Uploads publish the manifest only after audio checksum verification. Retrying an interrupted upload is idempotent at content-addressed keys. Local and remote metadata conflicts cause a clear refusal rather than silent overwrite.

Local deletion checks project dependencies. Verified eviction retains metadata and requires the remote audio checksum to match. Remote deletion has distinct manifest-only and manifest-plus-unshared-audio modes. It checks every project revision and preserves objects referenced by other sample manifests. It never performs general bucket garbage collection or touches foreign prefixes. Remote project history can keep a sample protected even when the latest project no longer uses it.

## Studio API

All endpoints are under `/api/sound/v1`. The OpenAPI document is available on the local server. Mutations require `X-Sound-Studio: 1`, a matching Origin when supplied, and a non-cross-site fetch context. Only loopback hosts are accepted. No CORS allowance is installed. Audio responses support byte ranges; responses are private/no-store.

| Group | Operations |
| --- | --- |
| Capabilities / voices | Model-specific controls, credential availability, effect definitions and baseline presets; provider voice listing. |
| Content | Search/list archive and editorial items; load exact aliased extraction with inclusion toggles. |
| Catalog / projects | List and retrieve versioned records; save a validated project with revision conflict detection. |
| Samples | Import recordings, copy review samples, update notes/tags/text, inspect audio/spectrogram, export, inspect dependencies and manage copies. |
| Jobs / batches / events | Preview a bounded job expansion, submit work, pause/resume/cancel/retry, and observe durable statuses through SSE. |
| Features / alignments | Save validated manual tracks and word anchors; map saved sentence features onto recording time. |
| Storage | Usage, catalog reconstruction, remote catalog and queued transfers. |

The queue runs one job at a time. Completed chunks are durable, and retries reuse them. Restart marks unfinished queued/running jobs interrupted; paid provider requests are never automatically replayed. A cancelled request may still finish and incur a charge. Its returned audio is retained, and retry is refused until the in-flight operation has ended. Pause holds pending jobs while the current request completes. Per-job progress is durable, but cancellation of a long native DSP call is observed between processing stages.

## Rendering And Alignment

Tone.js uses one AudioContext and a shared scheduled start for all active layers. WaveSurfer is a visualization/seek surface only. Browser automation runs at a control rate; backend gain/pan/oscillator curves are sample-based, while Pedalboard parameters update in 256-frame blocks. Interpolation, depth and smoothing are persisted. Per-effect help identifies algorithm differences. Export always reads saved backend audio.

Pitch, stretch and convolution are render-only. The effect rack order is authoritative. Fades precede the effects; a configurable silence tail is appended before processing. A time-stretch effect also stretches that tail. The output length is reconciled with the recipe duration. Stereo panning uses equal-power crossfeed; center pan preserves stereo input. The optional master limiter enforces a final sample-peak ceiling. Peak/RMS meters are not integrated LUFS or an artistic loudness judgment.

Rubber Band R3 implicitly anchors zero: do not include `(0, 0)` in the CLI time-map file even though it remains required in the user-facing contract. The explicit zero anchor produced an invalid ratio in local testing. Dynamic pitch mode has small transient/length differences; the test fixture checks onset within 20 ms and normalizes final length. This is not proof of perfect phase coherence between generated voices.

Provider timing is preferred. WhisperX aligns the supplied text on CPU when timing is absent; it does not infer missing text for unidentified imports. Both normalized provider data and the original text snapshot are retained. Missing source words, unmatched normalized forms, or local stretch ratios outside 0.5–2 require review. Edit word timing JSON or use a custom source/reference map. Word anchors can be too restrictive across voices; inspected sentence anchors are a useful starting point. Reference timings on derived alignment samples represent requested anchors, not a second measured forced-alignment pass.

VADER and model-emotion features are explicitly interpretations. Imported JSON/CSV tracks and manual edits are checked for sentence coverage, finite values and declared ranges. Source edits invalidate stale mappings at rendering/playback. The first model-analysis implementation uses one structured response and can fail on very long texts; use sections or local analysis. It does not silently truncate or accept malformed output.

## Verification Record

On October 29, 2026, each default provider completed one short invented-text live request: OpenAI GPT-4o-mini TTS / Cedar, ElevenLabs multilingual v2, Cartesia Sonic 3.6, and Gemini 3.8 Flash TTS. Receipts and audio are in the ignored local catalog. The three existing MP3 review recordings were imported as independent copies. Archive browsing loaded 402 available items without modifying their sources.

Provider timestamp alignment completed for ElevenLabs and Cartesia. CPU WhisperX aligned the OpenAI recording into 17 matched words. Automatic word-level reference stretching correctly flagged excessive local ratios; an explicitly reviewed sentence-anchor render completed separately. These checks are bounded functional evidence, not perceptual evaluation.

The isolated backend tests cover audio signals, contracts, batches, recovery, integrity and isolation. The browser suite covers the full generation/import-to-render-to-reload workflow and mobile/keyboard/reduced-motion behavior. Existing main-app backend regressions also run separately. Live S3 verification remains blocked: no local content-store credentials were configured, and the available Railway authentication did not authorize account discovery. Do not claim a live S3 round trip based on fixture tests.

## Visual Verification And Deliberate Differences

The generated concept is preserved privately in `.machina/review/sound-studio/concept.png`. Browser-test captures in the ignored test-results directory document light/dark desktop and mobile layouts. The concept and implementation were inspected with `view_image`; IAB was used for direct live interaction, and isolated Chrome runs provide repeatable acceptance.

| Comparison | Concept Evidence | Implemented Evidence / Decision |
| --- | --- | --- |
| Structure | Source rail, multitrack center, effects inspector, bottom transport. | Same three-part structure on desktop. Inspector moves beneath the timeline on smaller widths. A sticky-rail overlap at intermediate width was repaired. |
| Palette And Artwork | Rose/cream panels over a muted landscape. | Reuses bundled Rose & Graphite landscape artwork, with quiet reading/control surfaces and dark appearance. |
| Typography | Geometric app labels with serif explanation text. | Bundled Tektur and IBM Plex Serif are reused; no font/CDN fetch is needed. |
| Timeline Density | Several voices and automation visible together. | Layer gain/timing details now collapse by default to keep more automation visible. Real waveform peaks replace concept placeholders. |
| Mechanisms | An explanatory voice/effect diagram. | Distinct conceptual response/transfer/echo/modulation plots, adjustable amount, examples, and explicit labels distinguish illustrations from measured spectrograms. |
| Copy And Controls | Compose, Generate, Library, Batches, Save and Render Mix. | Those labels are retained. Project transfer, revision, tail/master, status and model-specific controls are intentional additions required by the implemented workflow. |
| Transport | Continuous playback and dry/wet comparison. | Persistent playback, dry comparison, loop, peak meters and render. Loop seams are not sample-accurate; saved renders are authoritative. |

The image is a design reference, not a screenshot of available capabilities. No synthetic waveforms are presented as live provider results. Concept-only zoom chrome was not added as an inert control. Small icons use the repository-compatible Lucide family. Reduced motion suppresses diagram animation.

## Deferred Work

Live pitch/formant processing, integrated LUFS metering, gapless loops, richer graphical anchor dragging, external plugin hosting, voice-clone enrollment, hosted authentication and main-app integration are future work. Existing authorized custom voice IDs can be used. An installation/distribution review should examine the dependency licenses before shipping a packaged application; this change installs no native service or OS permission flow.
