# Project Deck

A local-only, interactive slide deck that presents the project and replays its agentic workflows. It is a separate tool, like the [results dashboard](COUNTERFACTUALS.md): the server binds to loopback, refuses hosted deployment, and `tools/` is excluded from the Docker and Railway builds.

```sh
just deck
```

Open **http://127.0.0.1:8003** to present, or **http://127.0.0.1:8003/?mode=edit** to edit. `#7` opens slide 7. If port 8003 is busy, the deck takes the next free port and logs it; `just ports deck` prints the address. `just deck --port PORT` or `MACHINA_DECK_PORT` requests an exact port instead (see [local ports](DEVELOPMENT.md#local-ports)).

## Where Content Lives

| File | Committed | Contents |
| --- | --- | --- |
| `tools/deck/web/flows.js` | Yes | Workflow graphs and illustrative beats. All dialogue there is invented. |
| `tools/deck/web/public/example-deck.json` | Yes | A short example deck with invented content, served when no private deck exists. |
| `manuscript/deck/deck.local.json` | No | The real slides, drawn from the essay. `MACHINA_DECK_FILE` selects another path. |
| `manuscript/deck/edits.local.json` | No | Edits, layout changes, slide settings, and annotations made in edit mode. |
| `manuscript/deck/annotations.local.md` | No | A readable mirror of the annotations, rewritten on every save. |

The `manuscript/` directory is ignored by Git and excluded from deployment. Keep essay text, quotations, and names there, never in `tools/deck/`. Saved files are written with owner-only permissions.

## Presenting

| Key | Action |
| --- | --- |
| → Space PgDn / ← PgUp | Next or previous slide |
| Home / End | First or last slide |
| P | Play or pause the current slide's simulation |
| [ / ] | Previous or next simulation beat |
| O | Slide overview |
| F | Full screen |
| ? | Shortcut list |

The pointer hides after a few idle seconds. Slides marked **Skipped** in edit mode are omitted.

## Simulations

Each `flow` slide shows a workflow graph beside a conversation column. Playing it lights each agent in turn, animates the edges that carried its input, and adds the message the call produced. Each beat card shows:

- the speaker, model, and, for endpoint experiments, whether the endpoint was visible to that call;
- a context bar showing what the call received (instructions, sketch, recorded history, derived memory, future cards, endpoint, plan, branch so far). Click it for the itemized list. Widths use a square-root scale so small inputs stay visible; exact sizes are shown in text;
- structured state (place, elapsed time, event) for script turns, warnings for known failure modes, and a short note on why the beat matters.

The condition menu switches among illustrative variants, for example memory and future-material conditions, endpoint-disclosure policies, or one author versus two agents.

### Replaying a Saved Case

In edit mode, open **Slide → Saved run**, choose a local run and case, and the slide gains an **Illustrative / Saved run** toggle. The server converts the saved case into beats in its actual call order (`tools/deck/samples.py`), collapses repeated preparation calls, and applies the private alias projection before responding. Saved dialogue is read on demand and is never written into deck files. Only the run and case identifiers are stored in your edits.

## Editing

Press **E** or the small ✎ button at the lower right to open the panel. With **Pick** on, click any text or block to select it.

- **Double-click** text to edit it in place. Enter saves a heading; ⌘Enter saves a paragraph; Esc cancels. The panel's text field edits the same value. `*asterisks*` produce emphasis.
- **Drag** a selected element, or use Alt+arrows (Shift for larger steps), to nudge it.
- Adjust alignment, size, width, or visibility, or reset the element.
- **Annotate** the selected element, or the whole slide when nothing is selected. Numbered pins mark open notes. The **Annotations** tab lists them, jumps to their targets, resolves or deletes them, and copies them as Markdown.
- **Slide** changes the layout, Night/Paper theme, vertical alignment, column mirroring, order, inclusion, flow autoplay, and the saved-run binding.
- **Notes** holds speaker notes.
- ⌘Z undoes. Edits save automatically; the panel shows the save state.

Edits are overrides keyed by stable paths such as `agency.items.2.title`; the base deck file is never rewritten. To fold edits into the base content, ask an agent to apply `edits.local.json` to `deck.local.json`, then clear the applied entries.

## Slide Schema

`deck.local.json` holds `{ "title": "…", "slides": [ … ] }`. Each slide has an `id` and a `layout`, plus fields that layout uses:

| Layout | Fields |
| --- | --- |
| `title` | `kicker`, `title`, `subtitle`, `byline`, `footnote` |
| `statement`, `closing` | `kicker`, `title`, `subtitle`, `body` (list of paragraphs), optional `items` |
| `quote` | `kicker`, `quote`, `cite`, `body` |
| `split` | `kicker`, `title`, `body`, `items` (`label`, `title`, `text`) |
| `list`, `timeline`, `stats` | `kicker`, `title`, `items`, `body` |
| `network` | `kicker`, `title`, `center`, `items` (`title`, `text`), `body` |
| `flow` | `kicker`, `title`, `body`, `flow` (`loop`, `branch`, `counterfactual`, `path-tracing`, `script-paths`, `events`), optional `variant` |

Optional on any slide: `theme` (`dark` or `paper`), `align` (`top` or `center`), `hidden`, `notes`.

## Verification

`tests/test_deck.py` covers beat conversion, private edit persistence and validation, the example fallback, alias projection of saved samples, path checks, loopback/same-origin enforcement, and refusal under hosted deployment.
