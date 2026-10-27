# Landscape Design Preview

## Scope and Entry Points

`tools/design_preview/` is an independent React/Vite application containing only invented passages and generated illustration studies. It is not mounted by `apps/api` and is not copied by the production Dockerfile. Functional narration, provider selection, voice cloning, generation budgets, and audio persistence remain the next milestone after design selection.

Run `just design` and use `just ports design` to resolve its address. `MACHINA_DESIGN_PORT` or `just design --port N` requests an exact port. The launcher binds loopback, reads only built static files, and imports neither application configuration nor the content loader. Run `just setup-web` first if the shared browser-test dependencies are missing. The preview has its own locked build/runtime dependencies.

## Controls and Content

The Design Controls drawer opens from the toolbar, focuses its close button, and closes with Escape while restoring focus. Scene, composition, illustration treatment, interface palette, layout, schematic state, opacity, blur, motion and viewport are independent. The four original starting points coordinate composition, veil, opacity, blur and motion while preserving the current scene, layout and palette. Liquid Landscape explicitly selects Beveled Message Boxes. Three additional starting points pair new drawings with interface palettes and cloud surfaces: Rose Reverie, Copper & Code and Mechanical Dusk. All starting points preserve font and speaker choices. Three composition masks plus independent natural/sepia/grayscale treatments implement the four studies.

Every scene is a single continuous image. Margin masks conceal the center; the horizon mask retains low terrain across the reading area; full composition leaves the scene underneath both translucent control groups. Interface typography and colors are outside the illustration filter. Default opacity supports legibility; deliberately lowering it can reduce contrast.

Veil Shape offers the original Soft Reading Column, Fit Window Automatically, Beveled Message Boxes and Follow Text Contours. The automatic surface uses each preview pane's available width and reading height, including mobile and A/B panes, with a maximum width for large windows. It hides the journey rail to give that space to the reading surface. Message boxes fit their content with adjustable breathing room; text contours use cloned inline decorations to reshape around wrapped lines. The heading and non-conversation schematic states retain a shared beveled panel for readability. Long content scrolls within the reading region above the audio/composer controls.

Traveler and Companion have independent Placement (full width, left, center, right) and Text Alignment (left, centered, right, fully justified) controls. Placed Message Width sets the width limit for non-full placements. A one-click opposing-voices setting puts the traveler on the left with left-aligned text and the companion on the right with right-aligned text. These settings apply to reading and comparison messages, including long continuations, and persist across layouts and palettes. Existing version-1 preset files remain compatible and receive defaults for the additional settings.

The illustration selector includes Natural Color, Deep Sepia Wash, Monochrome Wash, Sepia Ink & Hatching and Graphite & Hatching. Sepia Sketch now selects the ink study, and direct Sepia Ink/Graphite buttons make both new studies discoverable. Ink/graphite are programmatic rendering studies of the same six paintings: a pale monochrome underpainting, static SVG edge extraction, shadow-masked crosshatching and paper texture. They do not generate or replace the source artwork. Filters apply below the composition masks, so theme-colored veils and interface colors remain independent.

Reading, branching, comparison, event, editorial and first-visit states use synthetic passages. Depicted app navigation, generation and playback buttons are disabled. Reply studies support in-memory draft typing, suggestion selection, tabs and disclosures with synthetic content. Audio illustrates message boundaries, previous/next messages, within-message progress, and Ready, Generating, Loading, Not Generated and Failed states. Nothing sends API/provider requests.

Versioned settings are stored only in localStorage. Export contains a schema version and allowlisted settings; import validates enums, numeric ranges, booleans and a 64 KB file limit. Invalid imports leave the current design intact. A/B pins the current appearance while sharing content, passage length and viewport with B.

## Artwork and Animation

### Typography Studies

Typography controls independently select App Font (schematic buttons, headings, navigation and labels), Reading Font (shared dialogue and reading prose), Human Font (Traveler or simulated human messages) and Machine Font (Companion or LLM messages). Both speaker controls can inherit the shared reading choice. The authoring panel retains its own UI type so every study remains configurable. Tektur is the default app and machine face, IBM Plex Serif is the shared reading face, and Allison is the human face. A Man of La Machina font set reapplies these defaults without resetting the landscape or speaker alignment. Explicit saved font choices are preserved; the library now has 25 choices grouped as Historical, Literary, Machine and Classic. All requested additions are included, with Google Fonts' spellings Uncial Antiqua, MonteCarlo and Monsieur La Doulaise. Lovers Quarrel appears once.

Eleven Font Sets appear at the top of Typography, before the four font selectors. Quixotic Chronicle, Letters & Logic, Courtly Correspondence, Human & Automaton, Flourished Letters and Light & Mechanical join the original four sets. Sets specify all four font roles, Reading Text Size and Reading Line Spacing while preserving landscape, veil, placement and alignment. Size ranges from 85% to 135%, with face-specific compensation for smaller apparent script sizes. Spacing ranges from 1.35× to 2.1×; text-contour veils retain a disclosed minimum of 1.65× to separate adjacent line surfaces. A specimen displays the app, shared reading and two effective speaker faces.

The 24 unmodified Latin WOFF2 assets total 509,016 bytes and load from the preview origin only when used. Noto Serif uses actual Light 300; all other bundled faces use Normal 400. Ballet is a static instance at optical size 16. `web/assets/fonts/manifest.json` records download URLs, pinned upstream descriptions/licenses, versions, SHA-256 checksums and verified English/Spanish glyph coverage. The build emits all 24 full OFL licenses and attribution into `dist/font-licenses/`; both the local server and hosted Caddy serve them. Other scripts and unbundled weights/styles are not covered; browser fallbacks apply to unsupported glyphs. These options explore reading comfort but have not been evaluated in a controlled readability study.

Typography fields participate in local persistence, validated JSON import/export and pinned A/B appearance. Older version-1 presets receive defaults for absent fields. Saved `headingFont`, `travelerFont` and `companionFont` choices migrate to `appFont`, `humanFont` and `machineFont`, respectively; explicitly supplied new fields take precedence. New exports contain only canonical fields. Artwork filters never affect text.

The initial six-face implementation passed eight typography tests and twenty-one preview cases in total. The expanded suite adds grouped choice coverage, saved-field migration, category isolation, light-weight rendering and line-spacing behavior. Font loading is verified through actual `FontFace` objects rather than fallback-tolerant `check()` alone. Responsive geometry checks complement screenshot inspection; they cannot establish comfort, historical accuracy or absence of every decorative glyph's painted overhang.

`asset-manifest.json` records the twelve independent generation identifiers, prompts, original/output SHA-256 checksums and WebP sizes. Original PNGs remain in the image-generation output directory rather than the public application; the checked-in WebP assets are format conversions, not crops of UI mockups. The shared visual direction is Romanticist watercolor and engraving, pale sky and a low horizon, restrained Iberian/alpine ecology, occasional historical architecture, and no people or text.

The painting stays static. Living Brushstrokes animates separate SVG pigment and pencil paths in both lower corners through gradual drawing and fading. Intensity, speed, pause, reduced motion and hidden-document policy apply. These are authored overlays; they do not animate individual objects inside the generated raster paintings. Separate DOM/SVG cloud, mist, reed, windmill and original articulated-traveler layers animate. Baked scenery cannot be articulated independently; the windmill study adds a separate schematic windmill. Pause, reduced motion and document visibility stop animation. No background video is used. The animation report and `web/assets/trials/` distinguish actual exported Rive/Lottie trials from researched candidate tools. The unavailable 1965 attachment has not been visually matched.

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

### Expanded Font Roles and Library

On October 25, 2026 (21:57 EDT; October 26 at 01:57 UTC), deployment `877763e2-6927-4a08-ab13-406d31248fa6` reached SUCCESS with isolated subtree commit `2a00ea6ef1007f1e69ba108150466b7ddb7c80da`, from implementation commit `7099be5`. All 25 local browser tests passed, including twelve typography cases, and the strict documentation build succeeded. [Full Linux application CI also passed at the implementation commit](https://github.com/ColinConwell/Man-of-La-Machina/actions/runs/40256551297).

Live HTTP checks confirmed 401 anonymously and 200 with credentials for all 62 emitted asset/attribution files, with every downloaded SHA-256 matching the local build. The total includes all 24 WOFF2s, 24 OFL files, the credits page and font manifest. Hosted Chromium rendered five new sets and independent human/machine fonts at desktop and mobile dimensions without console/page errors or external requests. Representative screenshots were inspected. The in-app local tab preserved its saved Garamond choice, 90% size, landscape and alignment while exposing the four new roles and ten sets. Production remains on deployment `dfd69788-8d6b-4266-bae0-b1a1a36a1cf9`.

### Cloud Surfaces and Sparse Landscape Studies

Added October 25, 2026: Soft Reading Cloud follows the content-sized reading block rather than the full-height scroll region. Message Clouds fit each message and speaker label. Text Contour Clouds clone a soft halo around each wrapped inline fragment. Cloud backgrounds are feathered independently of text; line contours retain a minimum 1.65× line height. Breathing room remains adjustable, and all four previous veil shapes remain available.

Three independently generated illustrations extend the six original scenes: Rose & Graphite Windmills, Celadon Circuitry and Lilac Automata. Their upper portions are quiet; detail is concentrated at the bottom edges. Copper root traces, mechanical windmill joints and brass aqueduct arcs introduce restrained technological motifs. The artwork manifest records complete built-in generation prompts, identifiers, original and converted SHA-256s, and file sizes. Originals remain in the generation output directory; the preview consumes local WebP format conversions. New Rose & Graphite, Celadon & Copper, and Lilac & Brass interface palettes can also be selected independently.

These changes are local preview work. The hosted deployment entries above describe earlier published builds, not this revision. The existing cover crop remains in use: narrow portrait panes show less of the original landscape edges. Reading comfort, physical-phone performance and Safari/Firefox behavior have not been established.

Validation for this local update: the preview build and all 30 browser cases passed. Two typography cases were then expanded and rerun successfully across all 25 font choices, five veil shapes, two content states and desktop/mobile sizes. Two Python preview-isolation tests and the strict documentation build passed. In-app interaction selected Copper & Code and reported no warning/error logs. Screenshots of the three new presets at desktop/mobile sizes and cloud-versus-box A/B views were inspected.

### Browser Review Refinements

The preset and font-set grids center an unmatched final card without widening it. The font specimen labels the app sample App (Default). Cloud-mode Journey backgrounds now fade to transparency within rounded bounds; the header has no background panel or bottom border, and the story viewport feathers its upper clipping edge. The intentional heading separator and journey connectors remain. View Recorded Continuation uses an opaque palette-colored secondary button to protect contrast against every background.

Clockwork Windmills, The Circuit Orchard and The Brass Aqueduct extend the scene list to twelve. Their cutaway gears, articulated copper olive limbs, circuit-root networks and geared aqueduct arches make the machine motifs more prominent. Existing scenes and presets are retained; complete generation prompts and hashes are appended to the asset manifest.

Motion Preview, near the top of Design Controls, reports the selected mode and pause/reduced-motion state. Preview Living Brushstrokes selects brush motion at 75% intensity and 1× speed, resumes user-paused motion and closes the drawer. It preserves the scene, fonts, reading state and veil, and never overrides the system reduced-motion preference. Brush layers now sit above playback controls and use a 16-second base cycle with staggered starts. The paintings themselves are still raster images: no generated video or animation of their embedded machinery is implemented. The separate windmill, vegetation, atmospheric and traveler animation modes remain available.

Follow-up verification: 29 browser cases passed on the final render, and the updated motion case passed three consecutive targeted runs after waiting for the asynchronous visibility-policy update. This includes desktop/mobile all-font containment checks. Two Python isolation cases and the strict documentation build passed. In-app measurements confirmed both odd grids center their last card at the original width. The app-font label and new scene choices were verified, console warnings/errors were absent, and desktop/mobile screenshots plus an eight-second real-time brushstroke capture were inspected.

### Message Controls and Named Configurations

Added October 26, 2026: the toolbar Animation On/Off switch and Enable All Animation checkbox are a persistent master control. Turning it off disables preview CSS animation and transitions and pauses native SVG, Rive and Lottie studies. Starting points preserve this choice, the brushstroke shortcut is disabled while off, and both comparison panes share the master state. Pause, Still Landscape, system reduced motion and background-tab policies remain available.

Background Opacity fades the complete landscape layer, including animated overlays, independently of reading surfaces and controls. Moonlight retains its existing additional darkening. Soft Reading Column now fades vertically at both ends. The Journey cloud covers its complete rectangular content before feathering outward. Text Contour Clouds measure wrapped inline fragments and render separate blurred backdrops behind crisp text; resize, font loading and settings changes update the geometry. Font-set subtitles list effective App, Reading, Human and Machine fonts in that order, omitting duplicate faces.

Each speaker has Enclosed in Message, Above Message and Hidden name placements, a width limit and an outer inset. Defined Outer Edges draws a firm boundary on the text-aligned side; opposite alignments create opposing speaker boundaries. Existing placement and alignment options remain independent. Navbar Surface and Footer Surface offer matching opaque beveled bars, with a compact footer. The default schematic note is also opaque. The Journey/The Beginning labels and the two action rows follow browser review feedback: the primary action is indented and the recorded-continuation/context row is centered.

Saved Designs stores named, validated configurations in a separate browser-local library. Quick saves propose the next unused starting-point modification letter (A through Z, then AA) or Default version number (v01, v02, and onward). Loading restores all settings and the starting-point name. Duplicate names are rejected without overwriting; storage failures are reported without adding a phantom saved entry. Resetting the current design does not erase the library. Version-1 JSON import/export includes the new settings and supplies defaults for older exports. Saved names and the library stay browser-local; exporting the loaded configuration provides a portable individual preset.

Validation: the production preview bundle, 35 Chromium acceptance cases, two Python isolation tests and strict documentation build passed. New cases exercise named-save reload/restoration, duplicate protection, numbering rollover, storage failure, invalid imports, animation-off across all three runtimes, independent background opacity, desktop/mobile label and action geometry, and contour remeasurement after resizing. In-app browser inspection confirms the new controls and rendered surfaces. This remains a local synthetic preview; no hosted or production deployment, physical-device performance measurement or Safari/Firefox validation was performed.

### Control Hierarchy and Bevel Refinement

Updated October 26, 2026: Preview Structure (layout, content state, passage length and viewport) now precedes Starting Points, which preserves those settings. Landscape and surfaces follow, with Veil Shape before navbar/footer choices. Typography precedes Conversation Text; shared message width/edge rules precede per-speaker overrides. Motion Preview, Movement and Animation Tools are adjacent. Saved Designs uses one Naming Style selector, one proposed-name field and one Save Configuration button. Custom makes the name field editable; the two generated naming styles continue to auto-increment after saving.

Animation Off now removes all separately rendered animation layers instead of leaving frozen brushstrokes or figures visible. The static painting, static ink/graphite treatments and grain remain. Pause and reduced-motion policy still freeze overlays without removing their content. The animation-tools dialog does not mount its three animation renderers while the master switch is off.

Reading, navbar, footer, and playback/composer surfaces have independent bevel amounts from 0% to 200%, saved and exported with the design. Amount scales corner rounding and edge relief together; 0% produces flat square surfaces and 100% retains the baseline treatment. Reading bevel controls appear for Window, Beveled Message Boxes and Follow Text Contours; navbar/footer amounts appear with the corresponding beveled surface. Defined message-edge lines start and end inside the message bevel's corner inset, on either speaker side.

Explore Context is beneath the existing Journey rail. Where mobile, A/B, Folio or Window layouts hide that rail, the action remains available below the reply actions. Read Original Reply replaces View Recorded Continuation. Both reply buttons share the larger intrinsic width and the same height, with arrows aligned right; the primary retains its indent and the original-reply action remains centered.

Verification: all 36 Chromium browser acceptance cases passed, followed by the six configuration cases after the final shared-control ordering adjustment. The preview bundle, two Python isolation tests and strict documentation build passed. In-app review confirmed removal of animated layers, the panel hierarchy, matching buttons and inset edge lines. These changes remain local to the synthetic preview, with no deployment or additional browser/physical-device coverage.

### Surface Grouping and Reading Polish

Updated October 26, 2026: Surface & Legibility now groups Reading View, Playback & Composer, Header & Footer, and Shared Surface Effects. The last group makes the shared blur control's scope explicit. Conversation Thread replaces Conversation Text. Animation combines the previous three panels under Preview, Movement, and Tools & Comparison subsections, retaining their controls and motion policies.

The reading bevel default is 40% (approximately the original navbar corner radius); explicit saved values remain unchanged. Footer Surface offers Compact Note, Beveled Bar (retaining its thin geometry), and Text Only. Text Only removes the footer background, border, shadow and padding while keeping the note readable and in the layout. All footer choices round-trip through presets and named designs.

The companion's illustrative highlight markup has been removed. Reply buttons retain equal dimensions and right-aligned arrows, and now share the same indented left edge. Explore Context is centered within the Journey content width with a 12-pixel gap after the roadmap, removing the old combined bottom padding and margin.

Validation: preview build, all 36 Chromium acceptance cases, two Python isolation tests and strict documentation build passed. Updated assertions cover subsection structure, the new reading default, footer mode persistence, unhighlighted dialogue, action alignment and Journey geometry. Live in-app inspection confirmed the grouped controls, Text Only footer and 40% reading selection without warning/error logs. No deployment or additional browser/device coverage was performed.

### Reply Action Studies and Animation Cycle

Updated October 26, 2026: Conversation Thread → Reply Actions offers Original Buttons, Open Composer, Three Intent Tabs, Reading First, Suggested Directions and Attached to Messages. The original arrangement remains the default for old presets. All studies use Try Your Own Reply, Read Original Reply and Explore Context. New arrangements replace the separate bottom composer in the Reading state and remove the duplicate Journey context action. Other app states retain their previous controls.

Open Composer places both disclosures in its footer. Three Intent Tabs switches a shared panel using clicks or Left/Right/Home/End keys. Reading First gives the original reply priority and expands the composer on request. Suggested Directions fills editable example replies. Attached to Messages places the reply invitation below the Traveler, the original-reply disclosure below the Companion and context beside the chapter heading. Inputs and disclosure content remain synthetic previews; drafts live only in component state, are not saved or sent, and disappear on reload or when their study unmounts. Send stays disabled.

The layout setting participates in validated imports/exports, local persistence, named designs and independent A/B appearances. Drafts and open disclosures are not part of saved designs. Shared typography, palette and control-surface settings apply to the studies; the composer footer stacks at narrow widths.

One toolbar control now cycles Animation · Play → Animation · Pause → Animation · Off → Play. Its accessible name and tooltip identify the next action. Pause freezes the overlays; Off removes them. Returning to Play retains the selected layers, speed and intensity. The existing saved animation booleans remain compatible, the advanced controls stay synchronized, and reduced-motion and hidden-document policies still override playback.

Validation: `just check-design` passed all 40 Chromium cases; `pytest -q tests/test_design_preview.py` passed both isolation checks; `just docs-build` passed in strict mode. New cases cover all five layouts at 390, 820 and 1440 pixels, disclosure visibility, keyboard navigation, draft non-persistence, suggestions, saved designs, invalid imports, independent A/B layouts and the animation cycle. Live in-app review confirmed these controls and the mobile suggestion layout without warning/error console logs. Existing dependency notices remain unrelated to the changes. The study is local only; no deployment, physical-phone or Safari/Firefox validation was performed.

### Compact Reply Entry

Updated October 26, 2026: The composer invitation now reads “Enter the journey with your own reply...” above the input surface. The textarea starts at one line, expands to its content and contracts after deletion, refitting after width or font changes. The manual resize handle is removed. Send includes a Return-key badge; it remains a disabled visual study and no sending shortcut is registered.

The input and rotating prompt examples use the selected Human Font, falling back to Reading Font when inherited. Empty, unfocused fields cycle three short prompts. Focus or entered text hides the prompts and pauses their animation. The global Pause state freezes rotation; Off and reduced motion show one static prompt; hidden documents pause it. The animated overlay is hidden from assistive technology while the textarea retains its persistent external label and a static placeholder. The toolbar animation button now fits its contents, removing the oversized gap before Compare.

### Placeholder-Only Writing Animation

Updated October 26, 2026: Animation Layers now includes Placeholder Text-Only as the default for new settings, resets and presets that omit a motion choice. Explicit saved animation choices remain intact. This mode does not mount the atmospheric, figure or brushstroke overlays, leaving only the static artwork and optional static illustration treatment. Starting Points still apply their intentionally chosen animation modes.

Placeholders now unfurl left to right through a continuous reveal across the actual text width, preserving connected Human Font letterforms. Each prompt is written, held briefly, then cleared before the next begins. This is a directional text reveal, not a reconstruction of individual pen strokes. Speed controls the writing cycle; Intensity is hidden in Placeholder Text-Only because there are no landscape overlays to adjust. Still Landscape now keeps the prompt static too. Pause, Off, reduced motion, hidden-document and focus/typing behavior remain supported.
