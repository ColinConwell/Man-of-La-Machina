# Content curation

The application consumes a normalized bundle, independently of the frontend build. Raw documents and generated bundles stay private and ignored. `content/curation/archive.json` contains source selectors, documentary dates/places, stable chapter codes, entry boundaries, and a small manually assigned tag map; it contains no transcript excerpts.

## Import and source audit

The first build used only A1 and B5. The May 8 branch is source paragraph 142, the second Beaven turn. Paragraph 38 begins Copilot’s advice against renting; paragraph 146 begins the reversal after Beaven’s added logistics. The browser offers append or replace behavior explicitly. No author publication approval is implied by structural/source checks.

After that slice passed the context tests, the importer expanded to A1–A5, A7–A8, B1–B9, and the Long Update. A6 is a documented chronology gap, not a conversation. The undated/unformatted “Untitled document” is omitted pending speaker and chronology review. The Long Update begins at paragraph 18; paragraphs 4–12 are a July 11 retrospective introduction and are stored separately as an annotation. “BEV” in A2’s first turn is explicitly mapped to Beaven with a recorded curation note. “MIROWS,” “MIRROWS,” and Copilot spelling variants are recognized labels.

The manuscript, thread table, May 8 source, A6 gap note, early conversation/product/creative notes, and video synopsis informed the prototype. The remaining thread bodies were imported conservatively; they have not all received line-by-line author review.

The importer walks paragraphs in OOXML document order, including table cells. IDs combine a stable configured source identity and structural paragraph position. Source bytes and source hash retain the original run-level evidence. Body normalization preserves paragraph breaks; `raw_body` is kept in the bundle but excluded from HTTP display responses. Embedded media is inventoried by hash and relationship data, and flagged for rights/accessibility review. It is not automatically published.

## Private overlays

An overlay is a JSON object with optional `overrides`, `documents`, `artifacts`, and `profile` fields. Store it under `content/curation/*.local.json` so private material stays ignored.

```json
{
  "overrides": {
    "messages": {
      "existing-stable-message-id": {
        "review_status": "reviewed",
        "visibility": "public",
        "tags": ["practical"]
      }
    },
    "anchors": {
      "rain-in-spain": {"importance": 5}
    }
  }
}
```

Allowed override collections are messages, threads, anchors, documents, and artifacts. IDs must resolve. A correction to display `body` creates a new content hash and bundle version; the raw extraction and historical origin cannot be overridden. To remap a source reformatted in Word, use explicit ID changes and update all dependent entry/disclosure/artifact/profile references in the same overlay. Validation rejects unresolved references or duplicate IDs. IDs are not derived from mutable display titles.

Additional context documents use the `ContextDocument` schema. A summary must declare its source message IDs in `based_on_ids`. The context engine suppresses it if any dependency was withheld, outside the selected breadth, or beyond the cutoff. A same-day document requires an explicit `disclosed_in_message_id`; an occurrence date alone never makes it eligible. Retrospective annotations are always documentary viewing material in this prototype. There is no privileged/hindsight generation mode.

For media, add an `Artifact` with kind, URI, credits, alt text, rights/review status, captions/transcript, and linked thread/message/anchor IDs. The viewer supports image, audio, video, and written material; audio/video do not autoplay. The initial build includes only actual written annotations. The archive’s image/audio assets have not been assumed approved.

## Experience configuration

An overlay's `profile` section is embedded in the versioned bundle. Alternatively, set `MACHINA_PROFILE=content/curation/profile.local.json` when starting the API to select a full profile JSON file without rebuilding the archive. Use a distinct profile ID/version when changing behavior. `MACHINA_BUNDLE` selects a different content bundle. Configuration errors stop startup.

For example:

```json
{
  "id": "beginning-study",
  "version": 1,
  "default_start": "complete-history",
  "start_options": [
    {
      "id": "complete-history",
      "title": "Start with the earliest conversation",
      "description": "Explore the complete documented sequence.",
      "strategy": "earliest",
      "context_mode": "inherit_history"
    },
    {
      "id": "may-eight",
      "title": "Rain in Spain",
      "strategy": "anchor_id",
      "anchor_id": "rain-in-spain",
      "context_mode": "begin_context_here"
    }
  ],
  "enabled_themes": ["archive", "context-lab"],
  "default_theme": "archive",
  "branch_turn_limit": 5
}
```

Other strategies are `first_major_anchor`, `message_id` (with `entry_message_id`), `timestamp` (with an ISO `timestamp`), and `visitor_selects` (opens the complete navigator from its earliest boundary). Every resolved option includes its exact entry ID and associated anchor, when one exists. Date/range records cannot establish an hour: a timestamp selects the first message overlapping or following its calendar date. No timestamp beyond the corpus is accepted.

`curated_context` enables eligible curated summaries with the profile's context policy; it does not create a summary. `visitor_decides` starts with eligible inherited history and exposes the choice in the workbench before the first branch request. Beginning descriptions, anchor associations, and context modes are supplied by the backend.

## Validation and publication

Every build writes a versioned bundle, `bundle.json`, `validation.json`, and an FTS5 search index under `content/generated/`. The in-process query service uses literal matching against the authoritative bundle for this small corpus; the FTS5 index is available for larger query implementations.

Validation checks speaker ambiguity, ordering, dates, content duplication, disclosure references, summaries, anchors, start options, and artifact metadata. Review-level issues remain visible in curator mode. Errors stop the build.

`--mode public` is a fail-closed validation gate: all included messages/documents/artifacts must be explicitly approved and public, and artifacts must have acceptable rights status. It does not silently discard unapproved history, which could change a scene’s meaning or context. Select and curate a coherent bundle before public use. The server additionally refuses a curator bundle when `MACHINA_MODE=public`.
