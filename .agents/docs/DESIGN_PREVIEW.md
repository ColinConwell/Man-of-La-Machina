# Landscape Design Preview

## Scope and Entry Points

`tools/design_preview/` is an independent React/Vite application containing only invented passages and generated illustration studies. It is not mounted by `apps/api` and is not copied by the production Dockerfile. Functional narration, provider selection, voice cloning, generation budgets, and audio persistence remain the next milestone after design selection.

Run `just design` and use `just ports design` to resolve its address. `MACHINA_DESIGN_PORT` or `just design --port N` requests an exact port. The launcher binds loopback, reads only built static files, and imports neither application configuration nor the content loader. Run `just setup-web` first if the shared browser-test dependencies are missing. The preview has its own locked build/runtime dependencies.

## Controls and Content

The Design Controls drawer opens from the toolbar, focuses its close button, and closes with Escape while restoring focus. Scene, composition, illustration treatment, interface palette, layout, schematic state, opacity, blur, motion and viewport are independent. Four named presets set composition and surface values while preserving the current scene, layout and palette. Three composition masks plus independent natural/sepia/grayscale treatments implement the four studies.

Every scene is a single continuous image. Margin masks conceal the center; the horizon mask retains low terrain across the reading area; full composition leaves the scene underneath both translucent control groups. Interface typography and colors are outside the illustration filter. Default opacity supports legibility; deliberately lowering it can reduce contrast.

Reading, branching, comparison, event, editorial and first-visit states use synthetic passages. Depicted navigation, branching, composer and playback buttons are disabled. Audio illustrates message boundaries, previous/next messages, within-message progress, and Ready, Generating, Loading, Not Generated and Failed states. Nothing sends API/provider requests.

Versioned settings are stored only in localStorage. Export contains a schema version and allowlisted settings; import validates enums, numeric ranges, booleans and a 64 KB file limit. Invalid imports leave the current design intact. A/B pins the current appearance while sharing content, passage length and viewport with B.

## Artwork and Animation

`asset-manifest.json` records the six independent generation identifiers, prompts, original/output SHA-256 checksums and WebP sizes. Original PNGs remain in the image-generation output directory rather than the public application; the checked-in WebP assets are format conversions, not crops of UI mockups. The shared visual direction is Romanticist watercolor and engraving, pale sky and a low horizon, restrained Iberian/alpine ecology, occasional historical architecture, and no people or text.

The painting stays static. Separate DOM/SVG cloud, mist, reed, windmill and original articulated-traveler layers animate. Baked scenery cannot be articulated independently; the windmill study adds a separate schematic windmill. Pause, reduced motion and document visibility stop animation. No background video is used. The animation report and `web/assets/trials/` distinguish actual exported Rive/Lottie trials from researched candidate tools. The unavailable 1965 attachment has not been visually matched.

## Private Hosted Preview

The hosted build uses only an exported `tools/design_preview` Git subtree on `codex/landscape-preview-hosted`. It does not receive the rest of the repository as source. `hosting.json` records the settings applied through the Railway service API. New custom Config as Code paths are rejected by the current Railway connector, so this service uses explicit Dockerfile/health settings rather than changing production configuration.

Docker build context is the preview directory, not the repository root:

```sh
docker build -f tools/design_preview/Dockerfile tools/design_preview
```

Its Dockerfile-specific allowlist admits the standalone package, Vite entry, synthetic web source, Caddyfile and startup script. The runtime contains only `dist`, Caddy and the startup script. No content, provider keys, Python API or production source is included. The production Dockerfile and its allowlist remain separate and exclude all tools.

Railway terminates HTTPS; Caddy protects every file route with shared-password Basic authentication. Only `/healthz` is anonymous and returns the constant `ok`. Missing `PREVIEW_PASSWORD_HASH` fails startup. The server stores a bcrypt hash and username, never the plaintext password. Credentials for the owner are retained in ignored, mode-0600 `credentials/design-preview.local.json`; do not commit or log them. Set only `PREVIEW_USER` and `PREVIEW_PASSWORD_HASH` on this service. Do not inherit production content or provider variables. Password rotation requires replacing the hash and redeploying this service; it does not touch production.

Caddy sets private/no-store caching, no framing, no referrer, nosniff and a same-origin CSP, including local WASM for the Rive study. No remote fonts, runtime CDN assets or provider calls are required.

To publish a new reviewed preview from an implementation branch, commit only the intended preview files, then export that commit with `git subtree split --prefix=tools/design_preview`. Push the resulting commit to the hosted preview branch after confirming its ancestry; do not force-push or merge the generated subtree branch into main. Keep build dependencies and assets inside the preview directory. The regular implementation branch retains the launcher, registry, tests and documentation.

## Validation

Run `just check-design`, `pytest -q tests/test_design_preview.py`, and `just docs-build`. Browser coverage includes six scenes across four presets at 1440×1000 and 390×844, long passages, 54 theme/layout/content combinations, A/B content identity, inert controls, absence of API/provider requests, keyboard drawer navigation, preset round trip/rejection, persistence, reduced motion, pause and simulated hidden-document policy. Browser plugin was unavailable; existing Playwright Chromium provides the rendered checks. Chromium requires execution outside the macOS sandbox on this machine.

Local Caddy integration confirmed anonymous HTML/artwork 401, incorrect credentials 401, authenticated HTML/artwork 200, missing private files 404 and generic health 200. Default-palette automated accessibility checks passed; arbitrary user-selected low opacity and background-image contrast still require visual judgment. Actual phone hardware, Safari and Firefox are not yet covered.

Deployment identifiers and final hosted verification are recorded below after deployment.
