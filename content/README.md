# Content

Curation metadata and generated content for the interactive experience. The transcript archive itself is private: only metadata without transcript text is committed here.

| Path | In Git | Contents |
| --- | --- | --- |
| `curation/archive.json` | Yes | Source selectors, documentary dates and places, chapter codes, entry boundaries, and a small tag map. No transcript text. |
| `curation/aliases.local.json` | No | Private personal-name aliases applied before display and model context. |
| `curation/beginnings.local.json` | No | Beginning candidates and private annotations saved by `just curate`. |
| `curation/*.local.json` | No | Other private overlays and profiles, such as review overrides. |
| `generated/` | No | Normalized bundles (`bundle-<version>.json`, with `bundle.json` as the current one), `validation.json`, the `search.sqlite` index, and the event timeline with its cached model receipts. |

## Rebuilding

With the private source archive under `context/`:

```sh
just content                                  # all configured threads
just content --overlay content/curation/review.local.json
```

`scripts/build_event_timeline.py` builds and reviews the event timeline; it calls the configured model providers.

## Rules

- Never commit anything under `generated/` or any `*.local.*` file. `scripts/check_public_tree.py` and the pre-commit hook reject them.
- `content/` is excluded from Docker, Railway uploads, and the frontend build. Hosted content is served from private storage at runtime.
- Detailed procedures are in `.agents/docs/CURATION.md`, `ALIASES.md`, and `BEGINNINGS.md`.
