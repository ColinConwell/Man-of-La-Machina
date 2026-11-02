# About and Essay Readings

The main navigation offers **Explore**, **About**, and optionally **Read the Essay**. Reading pages preserve the current exploration and unsent intervention. Links use `?page=about` and `?page=essay`; citations and the contents list link to stable section targets.

## Editable Sources

The canonical local essay is `manuscript/essay/main.tex`, with `main.bib` and the required `neurips_2026.sty`. These three source files are versioned at the owner’s request. Legacy `names.tex`, private macro/policy files, backups and generated releases remain ignored. The initial September 14 source was replaced by the user-supplied October 31 revision, imported on November 2. The private `provenance.local.json` records input hashes, requested local edits and release hashes. The source files remain unchanged by the reading conversion. Keep citations and bibliography edits in TeX/BibTeX; do not maintain a separate hand-edited HTML essay. The workshop style is retained for the existing TeX workflow.

Edit About in `manuscript/about.md`. About, mappings, generated reading editions and backups remain ignored. Only the three approved essay source files are allowlisted for Git. The entire directory remains excluded from the application image; the rendered edition is loaded from private storage at runtime. Do not copy private configuration or releases into frontend assets.

## Build a Reading Edition

Install Pandoc locally, then run from the repository root:

```sh
.venv/bin/python -m scripts.build_editorial
# Optional standalone HTML, with current private aliases applied:
.venv/bin/python -m scripts.build_editorial --html-dir manuscript/reading
```

This creates `manuscript/editorial.local.json` with owner-only permissions. It retains the abstract, section text, citations, and cited bibliography, while omitting the TeX author metadata and review-name note from the web edition. Paragraph headings become reading sections. The original review draft remains in the TeX files. The conversion uses Pandoc's citation processor; it does not execute TeX, shell escape, or the manuscript's Python scripts. Pandoc is a local/CI dependency, not a production runtime dependency.

`manuscript/essay/macros.local.json` maps the manuscript's semantic name macros to canonical names for conversion. This optional mapping stays private; the current source uses ordinary names and can be converted without it. The server applies the current [alias configuration](ALIASES.md) to both About and Essay, including titles and text. Updating aliases therefore does not require rebuilding TeX. When importing a revision, review new personal names and new macros. Keep cultural references and bibliography authors readable, subject to explicit private disambiguation rules where needed.

The server strips unsupported markup, scripts, embedded media, active attributes, comments, and unsafe links before display. Alias replacements are escaped as text. The public API returns only the resulting reading document; it never returns TeX, BibTeX, macro mappings, original source paths, or the private release itself.

## Pseudonymization Exceptions

Citation text and bibliography entries must retain their original author names. The reading projection automatically exempts Pandoc `citation`, `references`, `csl-bib-body` and `csl-entry` elements and their descendants. Safe citation links and titles are retained; HTML sanitization and opaque internal IDs still apply.

The optional private `manuscript/essay/reading.local.json` configures two fields copied into the private editorial release:

- `unaliased_sections`: original HTML heading IDs. A matching heading and its section keep names verbatim through subordinate headings, ending at the next heading of equal or higher rank. The builder defaults to `["author-biographies"]`. An explicit list replaces that default; include it when adding further sections.
- `preserve_phrases`: case-insensitive, word-bounded phrases to retain in otherwise aliased editorial prose. These are document-specific exceptions, including ambiguous cultural references, and do not change archive aliases.

Both fields are omitted from public API responses. Section and phrase exemptions preserve text, link titles and safe external destinations without allowing scripts or other unsupported HTML. Keep actual names and exception phrases private. Add role parentheticals to the TeX biography text; the renderer does not hard-code names or reverse pseudonyms. Rebuild and restart the API after editing this policy. Existing releases without either field remain readable.

For deployment, the server must support these policy fields before selecting the new release. Older server schemas reject them. Roll back to a compatible prior code/release pair if reverting the parser.

## Visibility and Local Use

`MACHINA_ESSAY_ENABLED=true` shows the essay tab and enables `/api/v1/editorial/essay`. `false` (the default) hides the tab **and returns 404 from the endpoint**, including for direct links. About remains available when an editorial release is loaded. Changing server environment variables requires restarting/redeploying the API. Already delivered text cannot be recalled from a browser that has read it.

Locally the API loads `manuscript/editorial.local.json`; `MACHINA_EDITORIAL_FILE` can select another private path. A checkout without private editorial files still runs normally, with the reading tabs absent. Injected test archives never load the owner's manuscript.

## Railway Release

Upload the private generated JSON to the existing private content bucket under a new immutable `editorial/…json` key, using server-side credentials. Set the web service's `MACHINA_EDITORIAL_KEY` and `MACHINA_EDITORIAL_SHA256` to the object key and exact SHA-256 checksum. The existing `MACHINA_CONTENT_*` storage settings supply the connection. Set `MACHINA_ESSAY_ENABLED=true` or `false` and redeploy. A configured release with missing content, invalid schema, or an incorrect checksum fails startup without printing unpublished text.

The essay is enabled locally and on the public service following the owner-approved November 2 release. To remove it quickly after enabling it, change **only** `MACHINA_ESSAY_ENABLED` to `false` on the existing Railway web service and redeploy. Restore `true` to show it again. No Git change, source conversion, or DNS change is needed. Keep the prior private object/key/checksum for rollback. Content release and alias variables are independent of GitHub code deployment.

## Verification

Backend tests cover the toggle, direct-route protection, aliases, safe HTML, reference targets, private-error handling, and a TeX/BibTeX conversion with invented text. Browser tests cover About/Essay navigation, preserved intervention text, direct links, citations, mobile layout, accessibility, and the hidden-tab condition. CI installs Pandoc to exercise conversion. All committed fixtures are invented.
