# Man of La Machina

*Don Qui-CoPilot: Man of La Machina* is an experiment in agency, companionship, and the stories through which we become ourselves. Multimedia artist Beaven Waller set out on a journey guided by Microsoft Copilot, a companion he came to call Miros. The project, created by Beaven Waller and Colin Conwell, brings that lived experiment into performance, documentary, and an interactive work built from the surviving conversations.

This site documents the code behind the interactive work. **[Enter the experience](https://man-of-la-machina.com)** to see it running.

## What the software does

The interactive experience opens the conversation archive at a chosen moment. A visitor reads what led there, decides which earlier exchanges the model may see, and writes the next human turn. A new continuation unfolds beside the recorded history, with a receipt showing exactly what the model was given.

Around that experience sit a few research tools: a runner for scripted counterfactual experiments, a dashboard for reading their results, an annotation tool for choosing where a visit begins, and a presentation deck.

## Where to start

- **[Getting started](getting-started.md)**: install the project and run it locally.
- **[Vignettes](vignettes/index.md)**: short walkthroughs of the things you can do.
- **[Reference](reference/index.md)**: commands, configuration, the HTTP API, and the Python API.

!!! note "The archive is private"
    The transcripts, manuscript, and generated content bundles are not part of the public repository. Every vignette that needs them says so. [Try it with invented material](vignettes/invented-material.md) runs the full interface without them.

Maintainer and agent notes, such as hosting procedures and implementation records, live in [`.agents/docs/`](https://github.com/colinconwell/Man-of-La-Machina/tree/main/.agents/docs) in the repository. Research discussion lives in [`reports/`](https://github.com/colinconwell/Man-of-La-Machina/tree/main/reports).
