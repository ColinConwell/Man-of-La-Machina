# Changelog

Add a new timestamped entry after implementing changes. Record user-visible behavior, meaningful verification, and material limitations. Research and design discussion belong in the indexed [reports](reports/README.md); private manuscript and transcript content never belong in this log.

## 2026-09-14 17:56 UTC

- Renamed the local tool to **Annotate + Demarcate • Local Development**, revised titles and styling, and added pseudonymized source previews plus scoped macOS Finder/original-document actions.
- Added an indexed report on historical consumer Copilot memory, other conversational interfaces, and a proposed memory-representation intervention. Original Copilot memory internals remain unknown; automatic summarization is a documented proposal, not an implemented control.
- Added About and Read the Essay navigation, preserving the current exploration and unfinished intervention. The essay's backend toggle hides its tab and disables direct content access. The reading is enabled locally; public essay access remains off pending confirmation.
- Added a private TeX/BibTeX-to-HTML workflow with citations, bibliography, editable name macros, standalone aliased HTML export, pinned private storage, and shared pseudonymization for both readings. Manuscript files, About text, and generated releases stay outside Git and the frontend build.
- Added backend and browser regressions for source actions, editorial visibility, aliases, HTML safety, citations, navigation, mobile accessibility, and content boundaries. CI now exercises Pandoc conversion using invented material. Local verification: 48 backend tests, eight browser regressions, and a production frontend build.
- Added report-index and timestamped changelog guidance to development documentation and the local agent notes.
