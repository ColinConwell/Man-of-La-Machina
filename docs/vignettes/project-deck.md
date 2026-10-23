# Present the project deck

The project deck is a local slide deck that presents the work and replays its agentic workflows as animated simulations. Without the private deck it shows a short example with invented content.

## 1. Start the deck

```sh
just deck
```

Open the address it prints, by default **http://127.0.0.1:8003**. Add `#7` to the address to open slide 7.

## 2. Present

| Key | Action |
| --- | --- |
| → Space PgDn / ← PgUp | Next or previous slide |
| Home / End | First or last slide |
| P | Play or pause the slide's simulation |
| [ / ] | Previous or next simulation beat |
| O | Slide overview |
| F | Full screen |
| ? | All shortcuts |

On a workflow slide, playing the simulation lights each agent in turn and adds the message it produced. Each beat shows who spoke, which model, and a bar of what that call received. A menu switches between conditions, such as different memory or disclosure policies.

## 3. Edit

Open **http://127.0.0.1:8003/?mode=edit**, or press **E**. With **Pick** on, click any element to select it.

- Double-click text to edit it in place.
- Drag a selected element, or nudge it with Alt and the arrow keys.
- **Annotate** leaves a numbered note on an element or slide.
- **Slide** changes layout, theme, order, and whether the slide is shown.
- **Notes** holds speaker notes.

Edits and annotations save to the ignored `manuscript/deck/` directory, never to the repository.
