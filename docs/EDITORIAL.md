# About and Essay Readings

The main navigation offers **Explore**, **About**, and optionally **Read the Essay**. Reading pages preserve the current exploration and unsent intervention. Links use `?page=about` and `?page=essay`; citations and the contents list link to stable section targets.

## Editable Private Sources

The canonical local essay is `manuscript/essay/main.tex`, with `main.bib` and `names.tex`. These were copied from the current Overleaf source editor on September 14, 2026. The private `provenance.local.json` records provenance and hashes. The original files remain unchanged by the reading conversion. Keep citations and bibliography edits in TeX/BibTeX; do not maintain a separate hand-edited HTML essay. The workshop style is retained for the existing TeX workflow.

Edit About in `manuscript/about.md`. The entire `manuscript/` directory is ignored and excluded from the deployment build. Do not copy its contents into the public repository, a frontend module, `public/`, an issue, or a report.

## Build a Reading Edition

Install Pandoc locally, then run from the repository root:

```sh
.venv/bin/python -m scripts.build_editorial
# Optional standalone HTML, with current private aliases applied:
.venv/bin/python -m scripts.build_editorial --html-dir manuscript/reading
```

This creates `manuscript/editorial.local.json` with owner-only permissions. It retains the abstract, section text, citations, and cited bibliography, while omitting the TeX author metadata and review-name note from the web edition. Paragraph headings become reading sections. The original review draft remains in the TeX files. The conversion uses Pandoc's citation processor; it does not execute TeX, shell escape, or the manuscript's Python scripts. Pandoc is a local/CI dependency, not a production runtime dependency.

`manuscript/essay/macros.local.json` maps the manuscript's semantic name macros to canonical names for conversion. This mapping stays private. The server applies the current [alias configuration](ALIASES.md) to both About and Essay, including titles and text. Updating aliases therefore does not require rebuilding TeX. When importing a revision, review new personal names and new macros. Keep cultural references and bibliography authors readable, subject to explicit private disambiguation rules where needed.

The server strips unsupported markup, scripts, embedded media, active attributes, comments, and unsafe links before display. Alias replacements are escaped as text. The public API returns only the resulting reading document; it never returns TeX, BibTeX, macro mappings, original source paths, or the private release itself.

## Visibility and Local Use

`MACHINA_ESSAY_ENABLED=true` shows the essay tab and enables `/api/v1/editorial/essay`. `false` (the default) hides the tab **and returns 404 from the endpoint**, including for direct links. About remains available when an editorial release is loaded. Changing server environment variables requires restarting/redeploying the API. Already delivered text cannot be recalled from a browser that has read it.

Locally the API loads `manuscript/editorial.local.json`; `MACHINA_EDITORIAL_FILE` can select another private path. A checkout without private editorial files still runs normally, with the reading tabs absent. Injected test archives never load the owner's manuscript.

## Railway Release

Upload the private generated JSON to the existing private content bucket under a new immutable `editorial/…json` key, using server-side credentials. Set the web service's `MACHINA_EDITORIAL_KEY` and `MACHINA_EDITORIAL_SHA256` to the object key and exact SHA-256 checksum. The existing `MACHINA_CONTENT_*` storage settings supply the connection. Set `MACHINA_ESSAY_ENABLED=true` or `false` and redeploy. A configured release with missing content, invalid schema, or an incorrect checksum fails startup without printing unpublished text.

The essay is enabled locally and initially disabled on the public service pending explicit confirmation. To remove it quickly after enabling it, change **only** `MACHINA_ESSAY_ENABLED` to `false` on the existing Railway web service and redeploy. Restore `true` to show it again. No Git change, source conversion, or DNS change is needed. Keep the prior private object/key/checksum for rollback. Content release and alias variables are independent of GitHub code deployment.

## Verification

Backend tests cover the toggle, direct-route protection, aliases, safe HTML, reference targets, private-error handling, and a TeX/BibTeX conversion with invented text. Browser tests cover About/Essay navigation, preserved intervention text, direct links, citations, mobile layout, accessibility, and the hidden-tab condition. CI installs Pandoc to exercise conversion. All committed fixtures are invented.
