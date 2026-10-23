# Landscape Composition and Animation Authoring Studies

Date: 2026-10-23. Status: native prototype and exported Rive and Lottie trials; additional tools and generated video remain researched options. This report contains synthetic artwork only.

## Research Question

Can a continuous illustrated landscape make the reading interface easier to approach while preserving legible text, discoverable controls, and deliberate motion? The companion question is which authoring workflow offers enough control for an original articulated traveler without imposing unnecessary rendering or maintenance costs.

The design playground separates landscape, composition, illustration color treatment, layout, overlay opacity, and motion. This permits comparing natural margins, monochrome margins, a continuous horizon, and a complete background beneath translucent controls while keeping schematic content constant. These are design studies, not evidence that a particular composition improves reading performance. The application’s functional narration phase follows design selection.

## Implemented Animation Studies

| Approach | Actual Work Completed | What the Comparison Establishes |
| --- | --- | --- |
| Native CSS/SVG | Separate atmospheric and character elements in the preview, including clouds, mist, vegetation, windmill sails, and a jointed traveler. | Direct control of illustration colors, motion intensity, pause, and reduced motion without an authoring runtime. |
| Rive | An original nine-part cutout was drawn and grouped through the desktop MCP. A 120-frame, 60-fps walking loop keys both legs, arms, cloak, head, and body position. The editor exported a 1,759-byte `.riv` runtime asset. | The actual editor connection, vector construction, timeline authoring, state-machine simulation, and runtime export work in this environment. |
| Lottie Creator | The same nine original vector shapes were imported as an SVG into a new Creator document. The UI authored opposite leg rotations and exported a 16,065-byte Lottie JSON animation at 600 × 400, 60 fps, and 120 frames. | The authenticated editor can import editable geometry, author keyframes, preview motion, and export standard JSON without a paid optimization step. |

The shared walking action uses opposing leg angles of approximately ±14 degrees over two seconds. This is a qualitative workflow comparison, not a controlled benchmark: the native drawing differs, Rive adds secondary movement and cubic easing, and the Lottie trial uses only leg rotation with its return key at frame 119 rather than 120. No claim of pixel equivalence, equivalent authoring time, or measured energy use follows from these trials.

The Rive state-machine simulation traversed Entry to `Traveler Walk` and continued for 120 frames. The exported file is distinct from the cloud authoring document; it is a runtime asset, not a complete `.rev` project backup. The Lottie export was checked for its dimensions, frame rate, duration, two animated rotation properties, and six expected keyframes. Its export preview displayed the original traveler. In the integrated Chromium preview, Rive canvas pixels, Lottie SVG transforms, and native limb transforms changed during playback and stopped under the shared pause control. The runtime check reported no page errors or external requests. This establishes local browser playback; it does not establish performance parity or cross-browser compatibility.

### Connection Findings

The [official Rive MCP](https://rive.app/docs/editor/ai/mcp) is a desktop-editor connection. A real initialization and tool exchange succeeded against its documented local endpoint, followed by creating a new document. Export to a chosen filesystem path was rejected by the desktop application’s sandbox; the tool’s supported inline export returned the same runtime file, which was saved locally. This avoided changing desktop security settings.

The [official Lottie Creator MCP](https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-mcp) package was installed locally, but no Lottie tools were exposed in this chat’s tool registry. The Creator UI reported that its existing local bridge connected. A second diagnostic MCP process could list tools but could not access that connected scene because the bridge port was already owned. The existing bridge was preserved; actual authoring and export proceeded through the authenticated Creator UI. Thus UI export is verified, while an end-to-end Lottie MCP authoring call from this chat is still unverified. The [documented formats](https://docs.lottiefiles.com/en/creator/10_exporting/formats) include JSON, dotLottie, and rendered formats; only standard JSON was downloaded for this trial.

### Original Artwork and Provenance

The traveler is an original angular cutout with a broad hat, cloak, staff, and separate limbs. It is not traced from a historical illustration. The referenced 1965 attachment was unavailable, so historical visual matching remains unassessed. No external illustration, font, or private source passage was included in these character assets.

The common source geometry, exported animations, and static poster live in [`tools/design_preview/web/assets/trials/`](../tools/design_preview/web/assets/trials/). The adjacent [`manifest.json`](../tools/design_preview/web/assets/trials/manifest.json) records hashes, authoring methods, and sequence differences. Landscape prompts and generated-image provenance are recorded separately with the preview artwork.

## Other Authoring Options

| Option | Sourced Capability | Proposed Role and Limitation |
| --- | --- | --- |
| [Spline Hana](https://docs.spline.design/hana-a-canvas-for-interactivity/basics/what-is-hana) | Vector drawing, state-based animation, interactive events, and web embedding. | Explore editable landscape treatments or interactive light. No Hana scene was authored in this study, and export/runtime independence has not been measured. |
| [Blender Grease Pencil](https://www.blender.org/features/story-artist/) | Two-dimensional drawing and animation within a three-dimensional scene. | Useful for hand-drawn lines, layered scenery, and authored parallax. A heavier authoring workflow; no Blender trial or web export was produced here. |
| [OpenToonz Plastic](https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html) | Skeleton-driven mesh deformation of drawings, including cutout work. | Useful when an illustrated cloak or vegetation needs deformation rather than rigid rotation. No OpenToonz trial was run. |
| [PixiJS/Spine](https://us.esotericsoftware.com/spine-pixi) | Runtime skeletal animation, skins, and mesh rendering; editor/runtime versions must match. | Reserve for more complex character scenes. The runtime documentation requires reviewing its license before integration. No Spine dependency was added. |

**Interpretation.** Native SVG is the simplest baseline for sparse atmosphere and theme-aware silhouettes. Rive is a credible next step for a character with multiple interactive states. Lottie is a credible export path for short vector loops and sketch reveals. The present trials establish feasibility, not a final tool selection. A sketch-reveal animation and a true idle-to-walk transition remain subsequent experiments.

## Generated Atmospheric Video

Research was refreshed on 2026-10-23. No provider generation was submitted, and account entitlements or existing API keys were not tested.

- **Runway:** Its [Dev MCP documentation](https://docs.dev.runwayml.com/guides/mcp/) now distinguishes the developer-account MCP at `https://dev.runwayml.com/mcp` from the media-generation MCP at `https://mcp.runwayml.com`. The former handles account tasks, model routers, and documentation; it should not be described as the video-generation tool. A later trial can use a fixed camera and a supplied landscape with restrained cloud movement.
- **Luma:** The older [Dream Machine generation reference](https://docs.lumalabs.ai/reference/creategeneration) exposes a loop flag, but directs new work toward the [Luma Agents API](https://docs.agents.lumalabs.ai/). The current quickstart uses `POST /v1/generations`, asynchronous status polling, and Ray 3.2 for video. A future integration should verify current request options and account access instead of assuming the old Dream Machine schema or credentials still apply.
- **Google:** The [Veo page](https://ai.google.dev/gemini-api/docs/veo) explicitly states that the three Veo 3.1 preview endpoints shut down on October 22, 2026. Some examples lower on the same page still name those endpoints. Its migration notice points to `gemini-omni-1.1-flash` or generally available models on the Gemini Enterprise Agent Platform. No trial should reuse the retired preview identifiers.

**Proposed evaluation.** Render a short locked-camera atmospheric loop from one of the approved landscapes. Compare the first and last frames for seams, watch terrain and architecture for unwanted deformation, and inspect text readability through the brightest and darkest frames. Store the returned media, model identifier, exact prompt, generation date, and checksum. Use a static poster, pause control, reduced-motion behavior, and hidden-tab suspension. Generated video remains a prerecorded background asset; it does not provide editable character joints or independently controllable scenery layers.

## Selection Criteria

Before adopting an animation engine for the main application, compare the same final drawing and timing under the same viewport and device conditions. Record compressed transfer size including runtime and WASM, startup delay, frame timing, memory use, and behavior after repeated pause/resume and tab hiding. Test a long reading passage and both light and dark themes. The small exported artwork sizes above exclude runtime costs and must not be interpreted as total page weight.

The immediate design decision is the landscape composition and amount of motion. Character authoring choice can follow once the preferred composition demonstrates legibility and the interaction design survives every layout. Functional narration, voice selection, generation budgets, caching, and persisted audio remain a separate implementation phase.

## Adaptive Veil and Monochrome Follow-Up

The October 23 follow-up adds three alternatives to the original feathered reading column. The automatic veil fits the available preview window, while beveled message boxes fit their contents and inline text contours follow line wrapping. Independent speaker placement and text alignment allow opposing traveler/companion positioning without coupling the typographic choices to the interface theme. These are selectable design proposals rather than evidence of improved comprehension.

The same six paintings now support fully desaturated sepia and monochrome washes, plus sepia-ink and graphite rendering studies. The latter use a pale tonal underpainting, static SVG edge extraction, shadow-masked crosshatching and a paper texture. No image-generation request or new source artwork was required. The methods remain separate from interface text, theme-colored composition masks and animated overlay layers.

Thirteen browser acceptance tests passed, including measured responsive sizing, long-passage containment, speaker alignment, line-contour reflow, preset compatibility, A/B consistency and unchanged interface colors under sketch treatments. Desktop and mobile-sized Chromium screenshots were visually inspected. This establishes working exploratory controls, not a controlled reading study or physical-device performance evaluation. Extremely low opacity, narrow message widths, and fully justified small-screen passages may be less comfortable to read and remain available for comparison.

## Calligraphic and Printing Studies

The typography follow-up compares the same synthetic content with six reading choices: the original Georgia plus five locally served, openly licensed faces. Heading and reading fonts are independent, and each speaker can override the shared reading face. Four named pairings permit quick comparisons while preserving the current landscape and veil. These are aesthetic studies; no reading-speed, comprehension or preference measurement has been collected.

| Typeface | Study Role | Historical Scope |
| --- | --- | --- |
| [EB Garamond](https://github.com/octaviopardo/EBGaramond12) | Renaissance book typography | Revival of sixteenth-century roman type. |
| [IM Fell English](https://github.com/google/fonts/tree/main/ofl/imfellenglish) | Worn letterpress | Based on later Oxford types; not a Renaissance facsimile. |
| [Quintessential](https://github.com/google/fonts/tree/main/ofl/quintessential) | Calligraphic hand | Modern lettering based on the Italic Hand. |
| [Italianno](https://github.com/google/fonts/tree/main/ofl/italianno) | Flowing cursive | Modern connected script. |
| [UnifrakturMaguntia](https://github.com/google/fonts/tree/main/ofl/unifrakturmaguntia) | Blackletter headings and short passages | Based on a 1901 design; an aesthetic comparison rather than a period reconstruction. |

The [font manifest](../tools/design_preview/web/assets/fonts/manifest.json) pins sources, licenses, checksums, subset limits and glyph verification. All five normal-weight Latin WOFF2s total 157,260 bytes; the preview serves them and their complete OFL licenses from its own origin. English and Spanish characters, quotation marks, dashes and ellipsis were verified against the actual font maps. Script-specific size adjustments and an independent reading-size slider support comparison, while control labels and narration states retain familiar type. Desktop/mobile inspection and automated font-loading/layout checks establish implementation behavior, not the suitability of cursive or blackletter for long-form reading.
