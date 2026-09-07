# Implementation decisions

This delivers a local exploration prototype, with the May 8 intervention as the end-to-end reference flow. It does not assert that author approval, publication rights, or final exhibition art direction have been completed.

## Architecture

- FastAPI and typed Pydantic contracts under `apps/api`; read-only bundle repository, context engine, and generation adapters under `packages/domain`.
- Reproducible DOCX importer, metadata overlays, bundle validation, and index builder under `packages/content`.
- React/Vite/TypeScript with React Query for server data and Zustand for exploration state. Transcript, timeline, context, artifacts, branches, and comparison are separate features.
- Immutable JSON bundles replace normalized relational content tables for this prototype. SQLite stores the generated search index. Branches and generation records are ephemeral in-memory objects, so one API worker is required. A database-backed repository can replace that implementation without changing the API or context engine.
- Existing `library/` downloader/configuration code is unchanged. Existing ignore rules, including the user-authored manuscript entry, are preserved.

## Documentary and temporal decisions

- A source header establishes date-level conversation disclosure; it does not supply an hour or time zone. Source order establishes relative conversational order. Nightfall retains a May 11–12 range with no invented per-message recorded timestamp.
- A6 is a chronology gap. The Long Update becomes available on May 19, despite earlier events and writing. Its July 11 introduction is an annotation excluded from model context.
- The May 8 entry is a Beaven turn, allowing either replacement or an appended intervention. Recorded continuation includes the original cutoff when replacement is selected. The first six May 8 turns have manually assigned guided tags; the UI states this limited coverage.
- Historical display messages are immutable. Visitor/generated messages are separate types. Failed or refused output remains a generation attempt and is excluded from subsequent branch dialogue.

## Context policy

- Selection is deterministic and chronological. Later dialogue never enters an earlier cutoff. Documents need disclosure evidence, and same-day documents need an exact boundary.
- The system framing and cutoff turn are protected. When replacing a Beaven turn, the preceding local turn is protected. This deliberately protects one local turn rather than an entire exchange, so visitors can withhold earlier material in a compact slice. The workbench explains that tagged information may still occur in protected turns; withholding a group is not a claim of semantic erasure.
- Context fitting removes oldest optional items first and retains exact protected/branch turns. It raises a visible error instead of silently clipping required material. The input budget uses a conservative UTF-8 byte bound, not a falsely precise provider token count.
- Curated summaries and disclosed documents are supported and independently tested; none are enabled in the initial corpus because they lack an author-reviewed summary/disclosure overlay. Retrospective annotations cannot be enabled as historical context.
- Each generation saves a canonical, content-addressed manifest before the provider call. A second receipt contains the exact transport payload/hash and adapter version. Native provider formatting differences are therefore inspectable in the export.

## Exploration and presentation

- Seven resolutions: journey, month/chapter, week, day, thread, exchange, message. Broad views use real date distance; detailed views use ordinal conversation spacing. Exchanges begin with a human turn and retain successive companion replies.
- Message-boundary entry, thread navigation, literal transcript search, range start/end controls, date filtering, and deep links are implemented. Drag selection is an enhancement; the list and native controls are complete alternatives. Deep links contain only stable IDs and view settings.
- Starts resolve to explicit message IDs on the backend: earliest, first enabled major anchor, named anchor, timestamp, exact message, or visitor selection through the complete navigator. Date-only sources resolve timestamp requests to the first boundary overlapping or following that calendar date, preserving the source's precision. The initial profile exposes earliest history and the May 8 anchor. `MACHINA_PROFILE` selects another schema-validated profile at startup. Speculative context, retrieval weighting, and simultaneous model comparison remain future extensions.
- Three provisional token themes share identical semantics: Archive, Western Gothic, Context Lab. These are exploration themes, not author-approved production exhibition designs. The plan’s final design approval is not represented as complete.
- Artifact viewing preserves the reader’s place. Two retrospective written artifacts are connected; unapproved media has not been fabricated or published. Literal vocabulary overlap is available as a comparison lens and is labeled as a limited observation.

## Provider and session behavior

- A provider-neutral asynchronous stream protocol supports a deterministic stub, compatible chat providers, native Anthropic Messages, and native Gemini generation. The server uses the user-provided credentials, without changing them or exposing them to the client.
- Requests are idempotent by branch/request ID. A branch allows one active generation; duplicate requests replay the existing stream rather than starting another model call. SSE events have sequence IDs for reconnect/replay.
- Error/refusal/partial-stream outcomes are distinct. Failed attempts are exportable with receipts but do not become completed dialogue. Provider text/errors are not emitted to application logs.
- Sessions are owned by an HttpOnly SameSite cookie, expire after two hours, and are erased on reset/deletion or server shutdown. No identity/account is required. Local storage contains theme and context settings only.
- Local development binds to loopback. Hosted deployment uses explicit allowed hosts, secure cookies, private runtime content storage, content checksums and generation admission limits; see [hosting](HOSTING.md).

## Remaining exhibition work

The functional prototype is ready for exploration, including its separately requested Railway deployment. Exhibition release still needs author review and redaction of selected passages and third-party references, approved media and captions, curated summaries and broader tag coverage, final visual concept selection, consent/retention choices if research logging is introduced, and exhibition operations review. No branch-sharing service was created.
