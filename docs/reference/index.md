# Reference

- **[Commands and configuration](commands.md)**: `just` recipes, local ports, and environment variables.
- **[HTTP API](http.md)**: the exploration server's endpoints, generated from its OpenAPI schema.
- **Python API**: generated from docstrings.
    - [`library`](python/library/index.md): configuration, Google Drive download, and local port allocation.
    - [`packages.content`](python/packages/content/index.md): import, aliasing, validation, and publication of the archive.
    - [`packages.domain`](python/packages/domain/index.md): models, the content repository, context selection, and generation providers.
    - [`packages.experiments`](python/packages/experiments/index.md): the scripted counterfactual runner.
    - [`packages.timeline`](python/packages/timeline/index.md): event timeline extraction and review.
    - [`apps.api`](python/apps/api/index.md): the FastAPI exploration server.
    - Local-only tools: the [annotation tool](python/tools/curator/index.md), [results dashboard](python/tools/results_dashboard/index.md), and [project deck](python/tools/deck/index.md).
