# Railway hosting and private content

The application is hosted at `https://man-of-la-machina.com`, with `www.man-of-la-machina.com` as an additional host. Railway runs one Python service containing the compiled React frontend. Porkbun manages DNS. Railway handles HTTPS certificates.

## Code and content are separate releases

GitHub contains application code, schemas, invented test fixtures, curation metadata, theme tokens and deployment configuration. It must never contain source DOCX/PDF/media, normalized transcript bundles, search databases, exported branches, API credentials or screenshots showing private passages.

The normalized archive lives in the private Railway bucket `private-transcripts`. Anonymous object access is denied. The application authenticates to the bucket on server startup and verifies the object's SHA-256 against the pinned release before parsing it. It does not expose a bucket URL, presigned download, raw bundle endpoint or raw extraction field. Browser requests retrieve the normalized passages needed by the experience. A visitor can read/copy displayed passages; server-side storage is not access control over text that the website displays.

The Docker build uses explicit code-only copies and an allowlist `.dockerignore`. The content is not in the source checkout, Docker build context, container image, frontend JavaScript or GitHub Actions artifacts. `.railwayignore` also excludes content from manual CLI uploads. The public-tree CI check rejects private paths and recognizable bundle/credential structures. When run locally with the private archive available, it additionally detects matching source-text excerpts. Run it **before** pushing; CI can detect a bad push but cannot undo publication.

```sh
git add <code-files>
python3 scripts/check_public_tree.py
git diff --cached --check
git push
```

This working checkout also uses the repository's pre-commit guard. Enable it on another checkout with `git config core.hooksPath .githooks`. The guard prints paths and reasons, never matching private text.

## Server configuration

Only Railway receives these values; no `VITE_` variables contain secrets:

- `MACHINA_CONTENT_ENDPOINT`, `MACHINA_CONTENT_BUCKET`, `MACHINA_CONTENT_REGION`, `MACHINA_CONTENT_URL_STYLE`
- `MACHINA_CONTENT_ACCESS_KEY_ID`, `MACHINA_CONTENT_SECRET_ACCESS_KEY`
- `MACHINA_CONTENT_KEY`, `MACHINA_CONTENT_SHA256`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`
- `MACHINA_DEPLOYMENT=hosted`, `MACHINA_HOST=0.0.0.0`, `PORT=8000`, `MACHINA_ALLOWED_HOSTS`

Railway/Porkbun management tokens are not needed by the application and are not deployed. Bucket credentials are specific to this bucket. A GitHub application deployment does not rebuild, upload or overwrite content.

The initial content version is `325ae43dd6bf48dabd2b`, with object checksum `5a0ff67cf783cc09f25d7f91ca2bf649c9de459a0ac6689c7a629c2cd07162c7`. The original review flags remain intact. Hosted mode is an exploration prototype; it does not declare author review completed or bypass the separate `public` curation validation gate.

## Update the content privately

Build locally from the private documents and private overlays. Put the bucket credentials in a private environment file, then upload directly from your computer:

```sh
uv sync --extra hosting --extra dev
.venv/bin/python -m packages.content.build
.venv/bin/python -m packages.content.publish --env-file content/curation/storage.local.env
```

The publish command prints only the immutable object key, content version and checksum. Update `MACHINA_CONTENT_KEY` and `MACHINA_CONTENT_SHA256` in Railway, then redeploy. Previous objects remain available for rollback. Restore an older key/checksum pair to roll back content independently of code. Never download bucket content into a GitHub workflow.

## Runtime behavior

The service runs one replica because branches and SSE jobs live in process memory. Branches expire after two hours and are deleted on Reset or server restart/deployment. Visitors should export work they want to retain. No transcript request/response logging is enabled. Hosted mode disables curator review and OpenAPI endpoints, sets secure HttpOnly cookies, rejects unexpected hosts and cross-origin writes, and asks crawlers not to index the prototype.

Hosted admission defaults allow four simultaneous generations, 60 live generation attempts per hour across the running service, 20 per session per hour, and five active branches per session. Demo requests do not consume live allowances. The hourly limits can be changed with `MACHINA_LIVE_GENERATIONS_PER_HOUR` and `MACHINA_SESSION_GENERATIONS_PER_HOUR`; these in-memory limits reset when the service restarts and are not a provider billing cap.

## Infrastructure

- Railway project: `dba7650e-7c6d-443a-817b-4ba75275efb2`
- Production environment: `3a99817c-2a62-4dd4-933b-1657d1484a36`
- Web service: `5a896b72-5a41-4c60-8384-2af009c7ab1a`
- Private bucket: `d3689940-2dbe-4e24-a2c4-a79309c41e2c`
- Railway hostname: `web-production-09abd.up.railway.app`

The Railway service is connected directly to `ColinConwell/Man-of-La-Machina`, branch `main`, for automatic code deployments. GitHub Actions runs the public-tree guard, fixture-based backend tests and frontend build without receiving bucket credentials or content.

Porkbun's apex ALIAS is changed from parking to the Railway-provided target. A `www` CNAME points to its Railway target. Existing mail, nameserver and verification records are preserved.

References: [Railway private buckets](https://docs.railway.com/storage-buckets), [Railway API](https://docs.railway.com/integrations/api), [Porkbun DNS API](https://porkbun.com/api/json/v3/documentation).
