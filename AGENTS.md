# Man of La Machina — Agent Notes

Interactive components for *Don Qui-CoPilot: Man of La Machina*, a generative-adversarial collaboration between humans and machines.

## Directory structure

```
.
├── AGENTS.md                       # repository guidance
├── CHANGELOG.md
├── JUSTFile
├── README.md
├── mkdocs.yml                      # human-facing documentation site
├── pyproject.toml
├── config.json                     # gitignored; generated locally
├── .agents/
│   └── docs/                       # agent- and maintainer-facing docs (tracked)
├── .github/
│   ├── INDEX.md
│   └── workflows/
├── apps/
│   ├── api/                        # FastAPI exploration server
│   └── web/                        # React/Vite frontend
├── content/
│   ├── README.md
│   ├── curation/                   # archive.json tracked; *.local.json private
│   └── generated/                  # private bundles and indexes (gitignored)
├── docs/                           # MkDocs sources: vignettes and API reference
├── experiments/                    # suites tracked; results/ gitignored
├── library/                        # config, Drive download, ports registry
├── packages/                       # content, domain, experiments, timeline
├── reports/                        # numbered research reports
├── scripts/
├── tests/
├── themes/
├── tools/                          # curator, results dashboard, deck, synthetic design preview
├── credentials/                    # gitignored
├── context/                        # gitignored private source archive
└── manuscript/                     # tracked essay sources; private releases, mappings and deck
```

## Documentation

- Put every agent-facing or maintainer-facing document (implementation records, verification logs, plans, hosting and curation procedures, detailed tool guides) in `.agents/docs/`, and list it in `.agents/docs/README.md`. Never add such documents to `docs/` or the repository root.
- `docs/` is the human-facing MkDocs site only: short, task-based vignettes under `docs/vignettes/`, plus the reference under `docs/reference/`. Python and HTTP API pages are generated at build time by `docs/scripts/gen_reference.py`; do not hand-write them. Add new vignettes to the `nav` in `mkdocs.yml`.
- Keep human docs simple and free of private material: no transcript or manuscript excerpts, private names, or local paths outside the repository. Link to `.agents/docs/` with absolute GitHub URLs, since it is outside the MkDocs `docs_dir`.
- After changing documentation or public docstrings, run `just docs-build` (strict) and fix every warning. Preview with `just docs`.

## Development notes

- Python package layout is `library/` (hatchling). Setup: `just setup`.
- Local settings live in `config.json`, keyed by section. Download variables are under `downloads`. Generate or refresh with `just generate-config` or `just generate-config-interactive`. Do not clobber unrelated top-level keys when adding sections later.
- `config.json` is gitignored. Generate it with `just generate-config`; print a sample with `python scripts/generate_config.py --example` (stdout only; do not add example configs to the repo root).
- Google Drive pull: `just download-data` / `python scripts/download_gdrive.py`. Precedence is hardcoded defaults → `config.json` `downloads` → CLI flags.
- Default identity is the service-account `client_email` from `credentials/google-drive.json`. `impersonate: true` means that account. A different email uses domain-wide delegation (`with_subject`). `--no-impersonate` uses the key directly.
- Default filters skip files over 100 MB and video extensions (plus `video/*` MIME when those extensions are excluded).
- `downloads.filters` is a list of gitignore patterns (`*`, `**`, trailing `/`, `!` negation, `#` comments) matched against paths relative to the Drive folder root. `--filter PATTERN` on the CLI replaces the config list. Ignored directories are not walked.
- Download output uses Rich progress bars.
- Server ports come from `library/ports.json`: defaults move to the next free port, and explicit variables or `--port` bind exactly. Start servers with `library.ports.serve` (JS tooling: `apps/web/ports.mjs`); `just ports` shows where they run. Do not hard-code ports. See `.agents/docs/DEVELOPMENT.md#local-ports`.
- Overleaf manuscript paths are noted in `credentials/README.md`; they are not part of this repo.

## Lingering issues

- The Drive folder is inaccessible unless it has been shared with the service-account email in `credentials/google-drive.json` (currently `google-drive-access@cocopack-workspace.iam.gserviceaccount.com`). A 404 from `files.get` usually means the folder is not shared with that identity.
- `context/data` is intentionally unversioned; regenerate it with the download script rather than checking binaries in.

## Research and Change History

- Add high-level research or discussion as a numbered, dated report in `reports/` and update `reports/README.md`. Distinguish evidence, interpretation, proposals, and implemented behavior; cite primary sources and omit private source excerpts.
- After implementing changes, append a new timestamped entry to the root `CHANGELOG.md` describing behavior, validation, and material limitations. See `.agents/docs/DEVELOPMENT.md` for the current application workflow.

## Design Preview

- `just design` launches the isolated synthetic Landscape Studio via the port registry. See `.agents/docs/DESIGN_PREVIEW.md` for the private hosted service and preview-only subtree workflow. Production excludes these routes and assets. Only the design controls operate; app and narration controls are schematic. Never load production content or provider credentials into this tool.

## Sound Studio

- `tools/sound_studio/` is the separate local narration laboratory; `packages/audio/` holds reusable contracts, providers, analysis, DSP, jobs, and storage. Launch with `just sound`; prepare its isolated Python 3.11 environment with `just sound-setup`. The main app remains on its existing Python environment.
- Studio data defaults to ignored `.machina/sound-studio/`, configurable through `MACHINA_SOUND_DATA`. Never put provider audio, source snapshots, receipts, catalogs, or alignment weights in Git.
- Saved/exported effects come from the backend renderer. Browser preview algorithms differ; preserve the per-effect disclosure. Pitch, time stretching, convolution and reference alignment require rendering.
- Read `.agents/docs/SOUND_STUDIO.md` before changing providers, storage contracts, or audio processing. Run `just check-sound` in addition to relevant main-app regressions and strict docs builds. Never mount these routes/assets in the production app or synthetic Landscape Studio.
