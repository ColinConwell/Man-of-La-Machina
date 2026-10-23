# Run a counterfactual experiment

The experience lets a visitor play the human. The experiment runner simulates **both** sides instead: a characterized Traveler and the companion, branching from the curated beginnings after a seed intervention. Conditions vary what the simulated companion remembers, how the Traveler is characterized, which models play each role, and whether later events leak in.

The simulations are fictional characterizations. They are not reconstructions of history or predictions about a real person.

## 1. Inspect the plan

```sh
just counterfactual
```

Planning is the default and makes no model calls. It prints every case in the shareable suite, `experiments/counterfactual-suite.json`: three events, two seeds, and twelve conditions.

## 2. Rehearse offline

```sh
just counterfactual --offline --execute --output experiments/results/offline
```

Offline runs use deterministic stand-ins for every model call, so you can check the plumbing end to end for free.

## 3. Run a small live comparison

Narrow the run with comma-separated filters, then execute:

```sh
just counterfactual --execute \
  --condition baseline,memory-compact \
  --output experiments/results/memory
```

Live runs need provider keys in `.env.local` and the private archive. Add `--resume` to reuse completed cases after an interruption.

## 4. Read the results

```sh
just results
```

The results dashboard (default **http://127.0.0.1:8002**) lists saved runs. Filter by event, seed, or condition, open a case to read the simulated dialogue, put it beside its matching baseline, and inspect the context and exact provider requests behind each turn. It calls no models and changes nothing.

Results stay under the ignored `experiments/results/` directory.

## Other designs

- `--path-tracing` generates turns between two fixed recorded moments, varying when the model learns where the conversation must end.
- `--script-paths` lets a model choose script lengths from a reviewed event timeline.

Run either without `--execute` first to see its plan. The [command reference](../reference/commands.md) lists the flags, and the [Python reference](../reference/python/packages/experiments/index.md) covers the runner.
