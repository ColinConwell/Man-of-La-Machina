# Getting started

## Requirements

- Python 3.11 or newer, managed with [uv](https://docs.astral.sh/uv/)
- Node.js 20.19 or newer
- [just](https://github.com/casey/just), for the short commands used throughout these docs

## Install

From the repository root:

```sh
uv sync --extra dev
npm ci --prefix apps/web
```

## Run it

Without the private archive, start the interface with invented material:

```sh
npm run build --prefix apps/web
.venv/bin/python -m tests.exploration_fixture
```

With the private archive in place under `context/`, build the content bundle and serve the real experience:

```sh
just explore
```

Either command prints the address it is serving. Each local server has a default port (8000 for the experience) and moves to the next free one when that is busy. `just ports` lists where everything is running.

## Check your work

```sh
just check            # backend tests and a production frontend build
just check-controls   # browser regressions with invented material
```

## Preview these docs

```sh
uv sync --extra dev --extra docs
just docs             # live preview, default http://127.0.0.1:8004
just docs-build       # strict build into site/
```

## Next

Pick a [vignette](vignettes/index.md), or look up a command in the [reference](reference/commands.md).
