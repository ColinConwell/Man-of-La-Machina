# Commands and configuration

## `just` recipes

Run `just --list` for the current set. Recipes that take `*args` pass extra flags through.

| Recipe | What it does |
| --- | --- |
| `just setup` | Create `.venv` and install the project in editable mode |
| `just setup-web` | Install frontend and browser-test dependencies |
| `just content` | Build the private normalized archive and validation report from `context/` |
| `just explore` | Build content and frontend, then serve the experience |
| `just api` / `just web` | Run the API and the Vite development frontend separately |
| `just check` | Backend tests and a production frontend build |
| `just check-browser` | Browser acceptance tests against a running `api` and `web` |
| `just check-controls` | Browser regressions with invented material; starts its own servers |
| `just counterfactual` | Plan or run scripted counterfactual experiments |
| `just results` | Build and serve the results dashboard |
| `just curate` | Run the Annotate + Demarcate beginnings tool |
| `just deck` | Build and serve the project deck |
| `just docs` / `just docs-build` | Preview or strictly build this documentation site |
| `just ports` | List local servers, their default ports, and where they are running |
| `just download-data` | Download the project's Google Drive folder into `context/data` |
| `just generate-config` | Write default download settings into `config.json` |

## Experiment runner flags

`just counterfactual` (or `.venv/bin/python -m packages.experiments`) accepts:

| Flag | Meaning |
| --- | --- |
| `--suite PATH` | Use a suite JSON instead of the default paired design |
| `--path-tracing` | Use the two-anchor path-tracing design |
| `--script-paths` | Use the model-chosen script-length design |
| `--write-default PATH` | Write the selected design as an editable suite JSON and exit |
| `--event`, `--condition`, `--seed` | Comma-separated filters |
| `--exchanges N` | Number of simulated exchanges |
| `--concurrency N` | Concurrent cases, 1–8 (default 2) |
| `--offline` | Deterministic stand-ins instead of model calls |
| `--execute` | Run the selected cases; without it, only print the plan |
| `--resume` | Reuse completed cases with matching content, code, and configuration |
| `--output DIR` | Where to save results (default `experiments/results/latest`) |
| `--bundle PATH` | Content bundle to read |

## Local ports

Defaults live in `library/ports.json`. When a default is busy, a server takes the next free port and logs it. Setting the variable, or passing `--port` where supported, binds that exact port or fails.

| Service | Started by | Default | Exact-port variable |
| --- | --- | --- | --- |
| Experience API | `just api`, `just explore` | 8000 | `MACHINA_API_PORT` (also `PORT`) |
| Annotation tool | `just curate` | 8001 | `MACHINA_CURATOR_PORT` |
| Results dashboard | `just results` | 8002 | `MACHINA_RESULTS_PORT` |
| Project deck | `just deck` | 8003 | `MACHINA_DECK_PORT` |
| Documentation preview | `just docs` | 8004 | `MACHINA_DOCS_PORT` |
| Vite frontend | `just web` | 5173 | `MACHINA_WEB_PORT` |
| Invented-material fixture | `python -m tests.exploration_fixture` | 8102 | `MACHINA_EXPLORATION_FIXTURE_PORT` |

## Environment variables

Server settings are read from the environment and from `.env.local`, which Git ignores. Secrets stay on the server and never enter the frontend build.

### Generation providers

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` | Enable each remote provider |
| `MACHINA_<PROVIDER>_MODEL` | Override a provider's default model |
| `MACHINA_LOCAL_BASE_URL`, `MACHINA_LOCAL_MODEL`, `MACHINA_LOCAL_API_KEY` | Connect a local, OpenAI-compatible server |

### Content and curation

| Variable | Purpose |
| --- | --- |
| `MACHINA_BUNDLE` | Content bundle to serve (default `content/generated/bundle.json`) |
| `MACHINA_PROFILE` | Experience profile JSON: beginnings, context policy, limits, themes |
| `MACHINA_ALIASES_FILE`, `MACHINA_ALIASES_JSON` | Private personal-name alias configuration |
| `MACHINA_BEGINNINGS_FILE`, `MACHINA_BEGINNINGS_JSON` | Beginning catalog |
| `MACHINA_EDITORIAL_FILE` | Private About and Essay release |
| `MACHINA_ESSAY_ENABLED` | Show **Read the Essay** (`true` or `false`) |
| `MACHINA_DECK_FILE`, `MACHINA_DECK_EDITS` | Project deck content and edits |

### Serving

| Variable | Purpose |
| --- | --- |
| `MACHINA_HOST` | Address the API binds (default `127.0.0.1`) |
| `MACHINA_MODE` | `curator` (default) or `public`, which requires an approved public bundle |
| `MACHINA_DEPLOYMENT` | `hosted` enables production safeguards |
| `MACHINA_ALLOWED_HOSTS` | Comma-separated hostnames accepted in hosted mode |
| `MACHINA_LIVE_GENERATIONS_PER_HOUR`, `MACHINA_SESSION_GENERATIONS_PER_HOUR` | Generation limits |

Hosted storage variables (`MACHINA_CONTENT_*`, `MACHINA_EDITORIAL_KEY`, `MACHINA_EDITORIAL_SHA`) are covered in the maintainer notes in `.agents/docs/HOSTING.md`.
