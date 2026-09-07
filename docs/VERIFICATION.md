# Prototype verification

Verified locally on September 6–7, 2026. Content version: `325ae43dd6bf48dabd2b`; profile: `local-curator`, version 1. This is a working exploration prototype. Publication approval and final exhibition design review remain author decisions.

## Functional evidence

- **25 backend tests pass**: deterministic context selection and hashing; disclosure boundaries; withheld summary dependencies; immutable origins; protected context and budget errors; DOCX/table import and stable IDs; source range and retrospective-preface handling; profile/start resolvers and invalid configuration; public validation; API pagination and absence of raw extraction text; cookie ownership and origins; idempotency; SSE streaming; multi-turn receipts/export; refusal and partial failure; concurrency, cancellation, expiry, deletion and turn limits; native provider payloads and streaming adapters.
- **Four browser scenarios pass** using Playwright Chromium and the running local services. They cover April 1 entry, all seven timeline resolutions, arbitrary message boundaries, URL restoration, range selection, transcript search, May 8 intervention, context mutation, theme-invariant receipts, replacement, two generated exchanges, receipt dialog/Escape, comparison, annotations, reader-position preservation, JSON export, reset, provider failure/retry and an expired branch reset.
- Accessibility checks report zero axe violations for the exercised WCAG 2 A/AA and 2.1 AA rules in all three themes. Keyboard entry, Ctrl/Command+Enter submission and reduced motion are exercised. Geometry checks pass at 1440×1000, 1920×1080 and 390×844. These automated checks do not replace an exhibition accessibility audit.
- TypeScript checking and the production Vite build pass. Production JavaScript is about 400 kB (123 kB gzip); CSS is about 25 kB (6 kB gzip). Transcript pages load six turns initially; long passages expand on demand. No archive is embedded in the static bundle.
- Live streams succeeded for OpenAI, Anthropic, Gemini, xAI and OpenRouter using a small invented dialogue. One actual May 8 request also completed through OpenAI with a hashed context receipt, withholding the two earlier intimate-tagged turns. The test branch was deleted afterward. Native/local-compatible endpoints beyond these five configured providers were not exercised against external servers.

`just check` runs backend tests and the production build. `just check-browser` runs browser scenarios with API/Vite running. Browser launch required an approved sandbox escalation because macOS denied Chromium's MachPort creation; this was supplemental to manual in-app-browser verification.

## In-app-browser and visual evidence

The Codex in-app browser was the primary manual QA surface. The production build on port 8000 was opened at the exact May 8 deep link. Context preview, generation, comparison and responsive reading were exercised; the earlier development pass also exercised withholding and receipt hashes. Screenshots were captured directly with the browser's screenshot API, without screenshot editing.

Reference concepts:

- [Archive concept](design/archive-concept.png), native **1505×1045**.
- [Comparison/mobile concept board](design/comparison-mobile-concept.png), **1586×992**. This is a board containing multiple viewports, not a single webpage viewport.

The archive implementation was inspected at its concept's native 1505×1045 viewport. The mobile implementation was inspected at 390×844. Both concepts and the latest desktop, comparison and mobile implementation screenshots were opened with `view_image` in the final QA pass. Temporary screenshot evidence lives outside version control under `/private/tmp/la-machina-*-final.png`; it contains private source excerpts and is not a publication asset.

### Comparison ledger

| Inspected point | Result and deliberate interpretation |
| --- | --- |
| Layout | Retains the three-column archive, dominant transcript, adjacent context controls and full-width timeline. The reader is wider and journey/context rails narrower to accommodate real, long passages. Comparison uses separate recorded/generated columns. |
| Typography | Serif scene titles and documentary text retain the editorial direction. Compact system sans labels and provenance distinguish controls from source text. Context Lab deliberately uses diagnostic mono/sans tokens. |
| Palette | Warm paper, rust actions, olive markers and hairline rules follow the archive concept. Western Gothic and Context Lab are independent prototype token sets. |
| Transcript semantics | Permanent recorded, visitor and generated labels are present. The concept's invented dialogue, fake clock times and mixed visitor/recorded column were replaced with actual normalized source turns and separate origins. |
| Timeline | Preserves the overview band, selection and density. Real calendar spacing replaces the concept's nearly equal scene spacing. Ten configured landmarks replace six illustrative scenes; coincident May 11 anchors are staggered. Artifact diamonds supplement the markers. |
| Controls and icons | Lucide outline controls use explicit labels. The nonfunctional concept actions (bookmark, add scene, more menu) were omitted; range, model settings and receipts expose implemented behavior. |
| Responsive behavior | Mobile keeps the wordmark, scene, origin labels and full-width reading. Journey becomes a select; context becomes a secondary drawer; comparison stacks. No horizontal overflow was found. |

**Above-the-fold copy diff:** not a literal text match. The wordmark, Rain in Spain title, Context, Preview context and Generate continuation remain. Actual source text replaces concept filler. The subtitle, source review labels, context-tag coverage note, explicit cutoff, provider state and ephemeral-session wording describe the real prototype. No fictional clock times or “all changes saved locally” promise were copied into the product.

**Material fixes:** contrast for selected landmark descriptions; transient low contrast while changing themes; overlapping same-date anchors; mobile control geometry; range-select labels; receipt focus/Escape; reader position across artifact viewing; stale-session reset. Current automated interaction/contrast checks pass. The implementation was visually verified against the provisional concept direction, with the deviations above. There is no author-accepted final design yet, so this is not a claim of pixel fidelity to an approved exhibition design.

## Scope remaining for exhibition

The ingestion, navigation, context, live generation, receipt, comparison, annotation and session flows are implemented. The initial guided tags cover only the first May 8 exchanges. Other passages remain searchable and individually selectable but need broader curation. Summary/document controls are implemented and tested but have no approved initial content. Image/audio/video components exist; only two real written retrospective artifacts are currently linked, so playback of approved documentary media remains unverified. Author review, redaction, media rights/accessibility, final aesthetic selection, research retention/consent if introduced and a hosting choice remain open. The prototype stays local and ephemeral.
