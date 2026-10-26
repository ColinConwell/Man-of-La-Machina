# Landscape Design Preview

## Scope and Entry Points

`tools/design_preview/` is an independent React/Vite application containing only invented passages and generated illustration studies. It is not mounted by `apps/api` and is not copied by the production Dockerfile. Functional narration, provider selection, voice cloning, generation budgets, and audio persistence remain the next milestone after design selection.

Run `just design` and use `just ports design` to resolve its address. `MACHINA_DESIGN_PORT` or `just design --port N` requests an exact port. The launcher binds loopback, reads only built static files, and imports neither application configuration nor the content loader. Run `just setup-web` first if the shared browser-test dependencies are missing. The preview has its own locked build/runtime dependencies.

## Controls and Content

The Design Controls drawer opens from the toolbar, focuses its close button, and closes with Escape while restoring focus. Scene, composition, illustration treatment, interface palette, layout, schematic state, opacity, blur, motion and viewport are independent. Four named presets set composition and surface values while preserving the current scene, layout and palette. Three composition masks plus independent natural/sepia/grayscale treatments implement the four studies.

Every scene is a single continuous image. Margin masks conceal the center; the horizon mask retains low terrain across the reading area; full composition leaves the scene underneath both translucent control groups. Interface typography and colors are outside the illustration filter. Default opacity supports legibility; deliberately lowering it can reduce contrast.

Veil Shape offers the original Soft Reading Column, Fit Window Automatically, Beveled Message Boxes and Follow Text Contours. The automatic surface uses each preview pane's available width and reading height, including mobile and A/B panes, with a maximum width for large windows. It hides the journey rail to give that space to the reading surface. Message boxes fit their content with adjustable breathing room; text contours use cloned inline decorations to reshape around wrapped lines. The heading and non-conversation schematic states retain a shared beveled panel for readability. Long content scrolls within the reading region above the audio/composer controls.

Traveler and Companion have independent Placement (full width, left, center, right) and Text Alignment (left, centered, right, fully justified) controls. Placed Message Width sets the width limit for non-full placements. A one-click opposing-voices setting puts the traveler on the left with left-aligned text and the companion on the right with right-aligned text. These settings apply to reading and comparison messages, including long continuations, and persist across layouts and palettes. Existing version-1 preset files remain compatible and receive defaults for the additional settings.

The illustration selector includes Natural Color, Deep Sepia Wash, Monochrome Wash, Sepia Ink & Hatching and Graphite & Hatching. Sepia Sketch now selects the ink study, and direct Sepia Ink/Graphite buttons make both new studies discoverable. Ink/graphite are programmatic rendering studies of the same six paintings: a pale monochrome underpainting, static SVG edge extraction, shadow-masked crosshatching and paper texture. They do not generate or replace the source artwork. Filters apply below the composition masks, so theme-colored veils and interface colors remain independent.

Reading, branching, comparison, event, editorial and first-visit states use synthetic passages. Depicted navigation, branching, composer and playback buttons are disabled. Audio illustrates message boundaries, previous/next messages, within-message progress, and Ready, Generating, Loading, Not Generated and Failed states. Nothing sends API/provider requests.

Versioned settings are stored only in localStorage. Export contains a schema version and allowlisted settings; import validates enums, numeric ranges, booleans and a 64 KB file limit. Invalid imports leave the current design intact. A/B pins the current appearance while sharing content, passage length and viewport with B.

## Artwork and Animation

### Typography Studies

Typography controls independently select App Font (schematic buttons, headings, navigation and labels), Reading Font (shared dialogue and reading prose), Human Font (Traveler or simulated human messages) and Machine Font (Companion or LLM messages). Both speaker controls can inherit the shared reading choice. The authoring panel retains its own UI type so every study remains configurable. The original Georgia remains the default; the library now has 25 choices grouped as Historical, Literary, Machine and Classic. All requested additions are included, with Google Fonts' spellings Uncial Antiqua, MonteCarlo and Monsieur La Doulaise. Lovers Quarrel appears once.

Ten Font Sets appear at the top of Typography, before the four font selectors. Quixotic Chronicle, Letters & Logic, Courtly Correspondence, Human & Automaton, Flourished Letters and Light & Mechanical join the original four sets. Sets specify all four font roles, Reading Text Size and Reading Line Spacing while preserving landscape, veil, placement and alignment. Size ranges from 85% to 135%, with face-specific compensation for smaller apparent script sizes. Spacing ranges from 1.35× to 2.1×; text-contour veils retain a disclosed minimum of 1.65× to separate adjacent line surfaces. A specimen displays the app, shared reading and two effective speaker faces.

The 24 unmodified Latin WOFF2 assets total 509,016 bytes and load from the preview origin only when used. Noto Serif uses actual Light 300; all other bundled faces use Normal 400. Ballet is a static instance at optical size 16. `web/assets/fonts/manifest.json` records download URLs, pinned upstream descriptions/licenses, versions, SHA-256 checksums and verified English/Spanish glyph coverage. The build emits all 24 full OFL licenses and attribution into `dist/font-licenses/`; both the local server and hosted Caddy serve them. Other scripts and unbundled weights/styles are not covered; browser fallbacks apply to unsupported glyphs. These options explore reading comfort but have not been evaluated in a controlled readability study.

Typography fields participate in local persistence, validated JSON import/export and pinned A/B appearance. Older version-1 presets receive defaults for absent fields. Saved `headingFont`, `travelerFont` and `companionFont` choices migrate to `appFont`, `humanFont` and `machineFont`, respectively; explicitly supplied new fields take precedence. New exports contain only canonical fields. Artwork filters never affect text.

The initial six-face implementation passed eight typography tests and twenty-one preview cases in total. The expanded suite adds grouped choice coverage, saved-field migration, category isolation, light-weight rendering and line-spacing behavior. Font loading is verified through actual `FontFace` objects rather than fallback-tolerant `check()` alone. Responsive geometry checks complement screenshot inspection; they cannot establish comfort, historical accuracy or absence of every decorative glyph's painted overhang.

`asset-manifest.json` records the six independent generation identifiers, prompts, original/output SHA-256 checksums and WebP sizes. Original PNGs remain in the image-generation output directory rather than the public application; the checked-in WebP assets are format conversions, not crops of UI mockups. The shared visual direction is Romanticist watercolor and engraving, pale sky and a low horizon, restrained Iberian/alpine ecology, occasional historical architecture, and no people or text.

The painting stays static. Separate DOM/SVG cloud, mist, reed, windmill and original articulated-traveler layers animate. Baked scenery cannot be articulated independently; the windmill study adds a separate schematic windmill. Pause, reduced motion and document visibility stop animation. No background video is used. The animation report and `web/assets/trials/` distinguish actual exported Rive/Lottie trials from researched candidate tools. The unavailable 1965 attachment has not been visually matched.

## Private Hosted Preview

The hosted build uses only an exported `tools/design_preview` Git subtree on `codex/landscape-preview-hosted`. It does not receive the rest of the repository as source. `hosting.json` records the settings applied through the Railway service API. New custom Config as Code paths are rejected by the current Railway connector, so this service uses explicit Dockerfile/health settings rather than changing production configuration.

Docker build context is the preview directory, not the repository root:

```sh
docker build -f tools/design_preview/Dockerfile tools/design_preview
```

Its Dockerfile-specific allowlist admits the standalone package, Vite entry, synthetic web source, Caddyfile and startup script. The runtime contains only `dist`, Caddy and the startup script. No content, provider keys, Python API or production source is included. The production Dockerfile and its allowlist remain separate and exclude all tools.

Railway terminates HTTPS; Caddy protects every file route with shared-password Basic authentication. Only `/healthz` is anonymous and returns the constant `ok`. Missing `PREVIEW_PASSWORD_HASH` fails startup. The server stores a bcrypt hash and username, never the plaintext password. Credentials for the owner are retained in ignored, mode-0600 `credentials/design-preview.local.json`; do not commit or log them. The only application variables are `PREVIEW_USER` and `PREVIEW_PASSWORD_HASH`; `RAILWAY_DOCKERFILE_PATH=Dockerfile` explicitly selects the build. Do not inherit production content or provider variables. Password rotation requires replacing the hash and redeploying this service; it does not touch production.

Caddy sets private/no-store caching, no framing, no referrer, nosniff and a same-origin CSP, including local WASM for the Rive study. Vite emits the small Rive rig as a separate file (`assetsInlineLimit: 0`), because Rive fetches its URL and the CSP deliberately excludes data-URL connections. No remote fonts, runtime CDN assets or provider calls are required.

To publish a new reviewed preview from an implementation branch, commit only the intended preview files, then export that commit with `git subtree split --prefix=tools/design_preview`. Push the resulting commit to the hosted preview branch after confirming its ancestry; do not force-push or merge the generated subtree branch into main. Keep build dependencies and assets inside the preview directory. The regular implementation branch retains the launcher, registry, tests and documentation.

## Validation

Run `just check-design`, `pytest -q tests/test_design_preview.py`, and `just docs-build`. Browser coverage includes six scenes across four presets at 1440×1000 and 390×844, long passages, 54 theme/layout/content combinations, A/B content identity, inert controls, absence of API/provider requests, keyboard drawer navigation, preset round trip/rejection, persistence, reduced motion, pause and simulated hidden-document policy. Browser plugin was unavailable; existing Playwright Chromium provides the rendered checks. Chromium requires execution outside the macOS sandbox on this machine.

The veil/typography follow-up passes thirteen browser tests, including six additional acceptance cases for measured window resizing, rendered text containment at mobile width, independent speaker placement/alignment, adaptive message heights and inline contours, backward-compatible preset round trips, pinned A/B appearance and sketch-only palette changes. Desktop/mobile screenshots of all three new veil shapes and both sketch treatments were visually inspected without page or console errors. Actual phone hardware and Safari/Firefox remain untested.

Local Caddy integration confirmed anonymous HTML/artwork 401, incorrect credentials 401, authenticated HTML/artwork 200, missing private files 404 and generic health 200. Both authored players loaded and paused under the actual Caddy CSP without console errors. The standalone Docker image built successfully, started, enforced authentication and contained neither source nor production application paths. Default-palette automated accessibility checks passed; arbitrary user-selected low opacity and background-image contrast still require visual judgment. Actual phone hardware, Safari and Firefox are not yet covered.

The seven preview acceptance tests and full application CI passed at [run 40011857329](https://github.com/ColinConwell/Man-of-La-Machina/actions/runs/40011857329). In-app browser inspection also verified page identity, meaningful rendered content, a working composition change and zero console warnings/errors. A bounded local Chromium 153 check at 390×844, DPR 1, sampled 120 frames: default atmosphere had a 16.7 ms median / 16.8 ms p95; all native layers had a 16.7 ms median / p95. Neither sample exceeded 25 ms. Initial HTML/JS/CSS/one landscape transferred 623,806 bytes from the local server, excluding the lazy Rive/Lottie study. These desktop-machine measurements do not establish physical-phone performance.

## Hosted Deployment Evidence

Verified on October 23, 2026 at 19:40 UTC:

| Item | Verified Value |
| --- | --- |
| Preview | <https://landscape-design-preview-production.up.railway.app> |
| Railway Service | `7a989e73-d36a-48a4-be00-263d4eddf9b0` (`landscape-design-preview`) |
| Successful Deployment | `e2ac7497-c54a-4e02-a626-472ede7f9d35` |
| Preview Subtree Commit | `df0f323046e9224faffc46eb67ac7e4521e044bd` |
| Container Image | `sha256:ea788e0ad08e26f8a558a1dd5aa4e466a90e02dd17756f23c229f2652229c0db` |
| Implementation Review | [Pull Request 1](https://github.com/ColinConwell/Man-of-La-Machina/pull/1) |

The first preview deployment (`5a224cbc-16f8-496e-a938-c4ed023146fc`) failed at BUILD_IMAGE before any Docker build log appeared. Its snapshot reported RAILPACK despite the service's Dockerfile setting. Setting `RAILWAY_DOCKERFILE_PATH=Dockerfile` and reconnecting the same preview source produced a fresh successful Docker build and health check. The earlier build's underlying platform failure is not established.

Live HTTPS verification returned 401 for anonymous `/`, `/design`, and all twelve emitted assets (JavaScript, CSS, all six paintings, Rive WASM, rig and poster). Incorrect credentials returned 401; authenticated requests returned 200. `/healthz` returned 200 with the generic response. HTTP redirected to HTTPS with 301. Authenticated requests for `.env.local`, `.git/config`, source JSX, the asset manifest and the application API returned 404. Responses use `Cache-Control: private, no-store`.

Authenticated Chromium checks at 1440×1000 and 390×844 confirmed the rendered page identity, working scene/composition controls, no horizontal overflow, no browser errors and no external-origin requests. Both Rive and Lottie loaded, played and paused under the hosted CSP. Screenshots were visually inspected at both sizes and for the three-player comparison. These checks cover the deployed subtree above; later documentation-only commits on the implementation branch do not change that hosted source.

### Adaptive Veil Update

The update reached SUCCESS in deployment `e8e558fe-6af9-409a-9dd0-203a03095ab8`, using subtree commit `92ad213813604658bc2c56634e6df543f6f45e75` and image `sha256:980b5e2a539edf574815c613582636a851cb26e8f9650ce955042f120ff3f449`. The implementation at `9143cb4` passed [full Linux CI, including all thirteen preview tests](https://github.com/ColinConwell/Man-of-La-Machina/actions/runs/40027962364). CI exposed a three-pixel mobile highlight overflow under Linux font metrics; removing the highlight's horizontal padding corrected it without relaxing the text-containment assertion.

Two earlier build attempts were SKIPPED with “no changes detected in watch paths” despite source changes. Changing the broad pattern alone did not resolve this. Removing watch filtering entirely and pushing the corrected source produced the verified Docker build; service read-back confirms no watch patterns remain. This preview receives only its dedicated subtree, so every source update should build. `hosting.json` records the cleared watch setting.

At 21:38 UTC, live authenticated Chromium checks exercised the new message boxes, text contours, automatic window fitting, opposing speaker alignment and sepia-ink treatment at 1440×1000 and 390×844 without page or console errors. Screenshots were inspected. The refreshed in-app local tab also showed the new controls and no console warnings/errors while preserving saved settings. Repeated hosted HTTP checks confirmed anonymous/wrong-password 401, authenticated HTML and all twelve emitted assets 200, private/source/API paths 404, health 200 and HTTP-to-HTTPS redirection. The production service remained on its earlier successful deployment.

### Typography Update

Verified at 21:51 UTC: deployment `dee5c69f-bd2c-420c-8b04-6afbcd846d4f` reached SUCCESS with subtree commit `b16db4fa6608efcc597f9450aeb7181b5ed94717` and Docker image `sha256:92ea8e7f1311f0af7b1f8e3c47cdaec3e43d79906a028af98346da969a7df893`. Implementation commit `dd1db02` passed [full Linux CI, including all twenty-one preview tests](https://github.com/ColinConwell/Man-of-La-Machina/actions/runs/40029491985).

All twenty-four emitted assets and attribution files returned 401 anonymously and 200 with preview credentials; their downloaded SHA-256s matched the local build. This includes every WOFF2 and all five full OFL licenses. Authenticated desktop/mobile Chromium checks exercised the four pairings and individual speaker faces without page/console errors or external-origin requests. Screenshots were inspected. The local in-app tab was refreshed, its saved scene/veil/alignment choices remained intact, and the Typography controls are available. The production service remains at its earlier successful deployment.
