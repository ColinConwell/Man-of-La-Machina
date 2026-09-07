# Development guide

Setup, configuration, content preparation, and verification for the interactive prototype. For the project's artistic framing, see the [project overview](../README.md). For the deployed service and private content releases, see [hosting](HOSTING.md).

## Run the prototype

From the repository root, with Python 3.11+ and Node.js 20.19+:

```sh
uv sync --extra dev
npm ci --prefix apps/web
just explore
```

Open **http://127.0.0.1:8000**. `just explore` builds the local content bundle and frontend, then serves both from FastAPI. Without `just`, run:

```sh
.venv/bin/python -m packages.content.build
npm run build --prefix apps/web
.venv/bin/python -m apps.api.main
```

The private source archive must already be present under `context/raw_data/Don-Qui-Co-Pilot/`. It is intentionally excluded from Git. Existing downloader and configuration commands remain available; they have not been moved or rewritten. A checkout without the archive can still run the automated backend tests using invented fixtures.

For development, run `just api` and `just web` in separate terminals and use **http://127.0.0.1:5173**. The Vite server proxies `/api` to port 8000. Restart the API after rebuilding content. Run one API worker: prototype sessions live in process memory.

## Explore

1. Choose April 1 or the May 8 *Rain in Spain* pause.
2. Navigate through configured anchors, all threads, search, or the timeline. Change resolution from journey to individual message without changing the cutoff. Every normalized turn has an **Enter here** action. **List & range** offers date filtering and keyboard-accessible interval selection.
3. In **Context**, select scene/thread/chapter/journey breadth, withhold tagged groups or individual messages, and optionally replace the selected Beaven turn. **More context controls** exposes the context beginning and saved presets.
4. Write your human turn. **Preview context** shows the exact ordered material and SHA-256 receipt. **Generation settings** selects a provider and editable model ID. Demo mode is the initial default.
5. Generate a streamed companion response. Continue for up to five exchanges, inspect any generated turn’s receipt, and open **Compare** or **Artifacts**.
6. **Export branch & receipts** preserves your experiment as JSON. **Reset** erases the current server branch. Sessions expire after two hours and disappear on server shutdown; no visitor text is stored in browser local storage or an on-disk application log.

The current corpus contains **369 recorded turns in 17 threads, 10 anchors, and two linked retrospective annotations**. Source excerpts remain explicitly marked unreviewed. The May 19 Long Update’s July 11 introduction is an annotation, not an historical turn. Nightfall in Janovas retains a May 11–12 disclosure range; no midnight timestamps are invented.

## Generation providers

The backend reads existing server-side credentials from `.env.local` without changing them. Available adapters:

| Provider | Interface | Default model |
| --- | --- | --- |
| Demo | Deterministic local stream | `documentary-demo-v1` |
| OpenAI | Chat Completions | `gpt-4.1-mini` |
| Anthropic | Native Messages | `claude-sonnet-4-6` |
| Gemini | Native streaming generateContent | `gemini-2.5-flash` |
| xAI | Compatible Chat Completions | `grok-4.20-0309-non-reasoning` |
| OpenRouter | Compatible Chat Completions | `openai/gpt-4.1-mini` |

All five remote adapters were exercised with a small invented dialogue. A real May 8 context was also streamed through OpenAI. Defaults are starting points, not claims that models have identical capabilities. The model ID and output budget are editable; temperature defaults to the provider’s behavior. Provider refusals, failed streams, and partial output stay distinct from completed companion turns.

To connect an existing local server, configure `MACHINA_LOCAL_BASE_URL` and `MACHINA_LOCAL_MODEL` in the server environment; `MACHINA_LOCAL_API_KEY` is optional. URLs cannot be supplied by visitors. Default model overrides use `MACHINA_<PROVIDER>_MODEL`. Secrets never enter Vite configuration or browser bundles.

The generation interface is in `packages/domain/providers.py`. Native payloads and their hashes accompany each generation export, including adapter version, resolved model when reported, timing, completion reason, and structured safety outcome. These receipts show what was sent; they cannot guarantee identical future model output.

## Content and curation

```sh
# Reproduce the initial April 1 / May 8 slice
.venv/bin/python -m packages.content.build --slice

# Rebuild all configured threads
.venv/bin/python -m packages.content.build

# Apply a private curation overlay
.venv/bin/python -m packages.content.build --overlay content/curation/review.local.json
```

The importer retains document hashes, structural paragraph locations (including tables), raw extraction text, normalized text, and stable source identities. The browser receives normalized display messages, not raw files or the full bundle. Generated bundles, SQLite search indexes, validation reports, and private overlays are ignored.

Set `MACHINA_PROFILE` to a private profile JSON path to change beginnings, context policy, turn limits, and enabled themes at server startup. `MACHINA_BUNDLE` selects another normalized content version. Configured beginnings resolve to validated message boundaries on the backend.

See [curation instructions](CURATION.md), [implementation decisions and remaining exhibition work](IMPLEMENTATION.md), and [design and verification notes](VERIFICATION.md). Public-mode validation rejects unreviewed/private content. The hosted exploration edition preserves the review flags and is not certified for exhibition.

## Verification

```sh
just check

# First-time browser test setup
cd apps/web
npx playwright install chromium
cd ../..

# With just api and just web already running
just check-browser
```

The browser suite uses deterministic demo generation, tests the complete exploration workflow, and checks accessibility, reduced motion, and mobile/kiosk geometry. OpenAPI contracts are available at **http://127.0.0.1:8000/docs**. Content review issues are available locally at `/api/v1/review` and in `content/generated/validation.json`.
