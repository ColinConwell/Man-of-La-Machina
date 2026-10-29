# Guided Reading and Narration

Updated October 27, 2026. This implementation is prepared for local review; production deployment requires the user's final review.

## Selected Design

The visible Landscape Studio settings were inspected through its rendered controls before implementation: Rose & Graphite Windmills, Full Landscape, Natural Color, Rose & Graphite palette, 50% background opacity, 90% reading/control opacity, Beveled Message Boxes, 8-pixel breathing room, 40% reading bevel, 100% control/navbar bevel, Text Only footer, and 8-pixel blur. Typography is Tektur / IBM Plex Serif / Allison / Tektur at 100% size and 1.6 line spacing. Both speakers use full-width boxes with their names above, left/right text alignment and defined outer edges. The roadmap is responsive, the reply action is inline, and animation is placeholder-only.

The main app implements this selected combination in `apps/web/src/design/` and `GuidedConversation.tsx`. Four approved landscape files and three licensed fonts are copied into the production-owned asset directory; their provenance is recorded in `assets/manifest.json` and licenses are distributed under `/font-licenses/`. Production imports no preview runtime, controls, synthetic dialogue, credentials, or tool routes. The full experimental studio catalog remains separate. The main app offers a bounded set of landscape, palette, surface and typography settings, independently persisted in a versioned browser entry. It does not persist conversation text there.

Both studio and main app center compact roadmap labels beneath their points, extend the timeline across its container, highlight the selected event, hide the duplicate title, and pin the roadmap above scrolling text. The studio's inline original link now fills and focuses its editable textbox.

## Conversation Semantics

Guided Reading is the default after choosing a beginning. It shows the recent recorded exchange and reveals earlier context on demand. Selecting a roadmap stop resets the previous ephemeral branch through the existing API. Explore Context opens the existing context controls; Compare, Search & More opens the existing workbench without losing the current draft or branch. `?view=advanced` opens that workbench directly.

The inline original link copies the immediate next recorded turn into the composer. Leaving it unchanged and pressing Send advances the recorded cutoff without a model request. Editing it or writing a different reply sends a visitor intervention using the current context policy. The label states whether Send advances the record or creates a branch. The recorded speaker is identified when the copied text is a companion turn. Original progression is disabled once a branch exists. Branch limits, streaming failures, receipts, comparison, exports, and deletion use the existing backend contracts. Only completed branch messages enter narration.

## Narration and Retention

`apps/api/narration.py` supplies an owned, in-memory cache and a background generation task per message. Requests identify a recorded message or an owned branch message; visitors cannot submit arbitrary text or choose an external API URL. The server resolves already-aliased display content. It uses the OpenAI Python SDK and built-in Cedar/Marin voices, with the pinned default `gpt-4o-mini-tts-2025-12-15` and a neutral, steady reading instruction. Text is partitioned at sentence/word boundaries into at most 3,500-character requests; the browser plays the resulting parts sequentially. There is no silent truncation. Messages above 24,000 characters return an explicit error.

Read Aloud does nothing until Play is selected. While active it advances through displayed messages and narrates a newly completed branch reply. Pause stops automatic narration; navigation or leaving the view also stops playback. Previous/next controls select message boundaries; seeking, speed and volume operate on actual HTML audio. Long messages expose a part indicator and seek within the current part. Ready, Generating, Loading, Not Generated and Failed reflect real request/player states. A browser autoplay rejection offers an explicit Play action.

The disclosure identifies AI-generated narration, OpenAI processing, the anonymous session allowance and retention. Audio is owner-isolated, `no-store`, and held only in server memory, with range responses for seeking. It expires with the session TTL (normally two hours), server restart or explicit deletion. Deleting a branch cancels/removes its audio. Delete Session Audio also cancels pending narration. Deletion never replenishes the hourly paid-generation allowance. Provider errors are sanitized. Provider-side data policies still apply; local deletion cannot retract a completed provider request.

| Environment Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Existing server credential | Speech provider authentication; never sent to the browser |
| `MACHINA_TTS_ENABLED` | `true` when a key exists | Set `false` to disable narration |
| `MACHINA_TTS_MODEL` | `gpt-4o-mini-tts-2025-12-15` | Server-selected speech model |
| `MACHINA_TTS_SESSION_CHARACTERS` | `24000` | Per-session hourly character allowance |
| `MACHINA_TTS_HOURLY_CHARACTERS` | `120000` | Process-wide hourly character allowance |
| `MACHINA_TTS_CACHE_BYTES` | `67108864` | Global in-memory audio capacity |

The server allows three simultaneous narration tasks globally and one per owner. The deployment remains a single-worker application. Anonymous allowances are a prototype control, not account-based abuse prevention; creating another browser session can obtain another per-session allowance, while the process-wide cap remains in effect.

## Validation and Review

Validation combines Python tests, fixture browser tests with invented conversations, existing local-archive browser regressions using demo generation, and manual in-app inspection. Browser audio state tests use a short generated WAV served with byte-range support; those tests do not establish speech-provider quality.

Real provider validation generated two invented samples through the speech skill CLI: Cedar (5.400 seconds) and Marin (5.304 seconds), both 24 kHz MP3. Independent transcription recovered both supplied passages exactly. A third invented visitor reply was narrated through the actual app API (4.656 seconds), decoded successfully, and became inaccessible (404) immediately after deleting its branch. Sample text, hashes and transcripts are retained with local review artifacts outside the repository, not in production assets.

Review limitations: Chromium desktop/mobile emulation does not establish Safari, Firefox or physical-device behavior. Transcription agreement establishes content recovery, not human-rated pronunciation or aesthetic voice preference. Samples use built-in voices; custom voices are not implemented. Hosted deployment, multi-worker scaling, account-based quotas and durable cross-session audio are outside this local review.

Final recorded checks: 172 Python tests; 47 studio browser cases, followed by four final roadmap regressions; 12 main fixture cases, followed by five final guided cases including two additional activation/storage tests; seven local-archive browser regressions; both frontend builds; strict documentation build; public-tree and whitespace checks. Manual in-app interaction confirmed original insertion, generation, audio decoding/playback (readyState 4 and advancing currentTime), pause, speed changes, settings and deletion with no captured console warnings/errors. The anonymous test branch used for manual narration was deleted afterward.

The API integration follows the [OpenAI speech guide](https://developers.openai.com/api/docs/guides/text-to-speech) and [speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create). Voice quality still requires the user's listening review.


## October 27 Annotation Refinements

The compact roadmap is wider than the reading column and narrower than the navbar. Its title is padded; opening All Journey Stops does not move Explore Context. Focused stop buttons accept Left/Right arrows, preserve focus after asynchronous selection, and stop at each end. Shrinking dots indicate additional stops outside the three labeled positions. Traveler bubbles have a right inset and companion bubbles a matching left inset, including generated exchanges. Companion text is smaller with left alignment and a ragged right edge.

The original link includes a trailing ellipsis; placeholder writing cycles at 7.5 seconds instead of 12. The main settings dialog dismisses on backdrop clicks and no longer exposes Placeholder Animation. The design studio retains that control. About and Essay body typography follows Reading Font independently of App Font; both contents lists collapse, and the essay heading uses its edition/date instead of the former deck.

Event review metadata is available in an accessible popover beside Sources Processed. Record Sequence preserves equal ordinal spacing while taller marks indicate longer disclosure gaps. Elapsed Time normalizes known disclosure dates across the available width; it deliberately uses disclosure dates rather than inventing occurrence dates. Unknown disclosure dates appear in a separate selectable group. Same-date records share a position; the ordinal scrubber, previous/next controls and index retain access to every record. No dated records produces an explicit empty date axis.

Validation added three fixture browser cases covering these interactions and geometry, including keyboard boundaries, backdrop dismissal, independent editorial font selection, accessibility, proportional spacing, same-day dates and unknown dates. All 17 main fixture cases passed across targeted runs; three existing event regressions passed against the local app with invented responses. Manual in-app checks confirmed the actual 997-pixel layout and both editorial fonts. Review screenshots use invented fixture content. Production remains unchanged pending final review.

## Roadmap and Chrome Follow-Up

A second annotation pass removes the structural main-container focus ring while preserving control focus rings, aligns roadmap grid rows to content during delayed loading, and places the compact scroll viewport 16 pixels below the navbar so content cannot peek through the sticky gap. Previous/Next controls expose arrow-key hints on hover and focus; coarse/touch interfaces show them continuously. Unavailable directions are omitted. Speaker accent strokes follow the rounded box borders. The narration privacy disclosure has a small left inset.

The always-visible diagnostic footer is removed. Its record count, archive version and distinction between recorded/generated text are disclosed under Settings → Record Details. A delayed-response browser fixture checks compact roadmap height at 966 and 390 pixels alongside navigation, structural/control focus, sticky gap, speaker edge geometry and hidden-by-default diagnostics. Manual in-app inspection confirms the matching layout and disclosure, with no captured console warnings/errors.

## October 28 Reading and Player Refinements

Read Aloud has three presentation sizes: full controls, a compact previous/play-pause/next bar, and a narrow bottom tab. Minimize steps down one size; expand restores the preceding size. Animated grid collapse respects reduced motion, hides inactive controls from focus/accessibility, and moves focus to the corresponding size toggle. The audio element stays mounted, so changing size does not pause, restart or regenerate narration. Hidden-panel errors remain available through a live status and the tab's accessible description.

About and Essay now use a horizontally collapsing contents rail. C toggles it outside editable fields, dialogs and popovers; the shortcut is visible in both states. Phones begin collapsed and expand a bounded overlay without moving prose offscreen. Scroll tracking follows the current section and accounts for font loading, resizing and the final section at the page bottom. Editorial prose is justified using the independent Reading Font. References (Bibliography) changes only the visible heading, retaining the existing anchor ID. The smaller edition label reads Reading Edition.

Recorded messages use an icon with a title and native popover for Recorded, Turn and Reviewed/Unreviewed Source metadata. Source disclosures have a small left inset. Traveler text is smaller while preserving the user's independent font scale. Journey selection uses a subtle underline instead of stacked shadow/border treatments. Appearance reset reads Restore Default Settings. A shared display helper title-cases metadata tags without changing stored identifiers or source prose.

All 20 main fixture browser cases passed after the final label changes. New cases cover contents geometry, C toggling and dialog exclusion, both editorial routes, scroll selection, preserved bibliography targets, source status disclosure, smaller type, audio-size bounds at desktop/phone widths, focus, reduced motion and accessibility. The existing narration case now plays a deterministic 12-second WAV continuously through both minimization steps and verifies the same audio element and advancing playback time. Manual in-app inspection confirmed the real archive's quiet roadmap selection, smaller Traveler text, padded disclosure, bibliography tracking and 180-pixel bottom tab. No additional provider speech generation was needed for these presentation changes. Deployment and non-Chromium/physical-device validation remain pending user review.
