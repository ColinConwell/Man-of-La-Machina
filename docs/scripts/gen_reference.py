"""Generate the API reference pages when MkDocs builds the site.

Python pages are rendered by mkdocstrings from the code's docstrings. The HTTP
page comes from the FastAPI OpenAPI schema, built against the invented test
archive so that no private content is read.
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path

import mkdocs_gen_files

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
PACKAGES = ["library", "packages", "apps/api", "tools"]
METHODS = ["get", "post", "put", "patch", "delete"]


def python_pages(nav: mkdocs_gen_files.Nav) -> None:
    for package in PACKAGES:
        for path in sorted((ROOT / package).rglob("*.py")):
            module = path.relative_to(ROOT).with_suffix("")
            parts = tuple(module.parts)
            if parts[-1] == "__main__" or "node_modules" in parts:
                continue
            doc = Path("python", *parts).with_suffix(".md")
            if parts[-1] == "__init__":
                parts = parts[:-1]
                doc = doc.with_name("index.md")
            nav[parts] = doc.as_posix()
            with mkdocs_gen_files.open(Path("reference") / doc, "w") as page:
                page.write(f"::: {'.'.join(parts)}\n")
            mkdocs_gen_files.set_edit_path(Path("reference") / doc, path.relative_to(ROOT))


def schema_name(schema: dict | None) -> str:
    if not schema:
        return ""
    ref = schema.get("$ref") or schema.get("items", {}).get("$ref", "")
    return f"`{ref.rsplit('/', 1)[-1]}`" if ref else f"`{schema.get('type', 'object')}`"


def http_page() -> str:
    from apps.api.main import create_app
    from packages.content.aliases import AliasRewriter
    from tests.exploration_fixture import exploration_bundle

    with warnings.catch_warnings():
        # HEAD aliases of GET routes share operation IDs; harmless here.
        warnings.simplefilter("ignore")
        spec = create_app(exploration_bundle(), aliases=AliasRewriter()).openapi()

    lines = [
        "# HTTP API",
        "",
        "The exploration server is a FastAPI application (`apps/api/main.py`). "
        "This page is generated from its OpenAPI schema. A running local server "
        "also serves interactive documentation at `/docs` and the raw schema at "
        "`/openapi.json`; hosted deployments disable both.",
        "",
        "| Method | Path | Summary |",
        "| --- | --- | --- |",
    ]
    details = []
    for route, operations in spec["paths"].items():
        if not route.startswith("/api/"):
            continue
        for method in METHODS:
            if method not in operations:
                continue
            op = operations[method]
            anchor = op["operationId"].lower()
            lines.append(f"| `{method.upper()}` | [`{route}`](#{anchor}) | {op.get('summary', '')} |")
            details += ["", f"## `{method.upper()} {route}` {{ #{anchor} }}", ""]
            if op.get("description"):
                details += [op["description"].strip(), ""]
            if op.get("parameters"):
                details += ["| Parameter | In | Required | Type |", "| --- | --- | --- | --- |"]
                for param in op["parameters"]:
                    details.append(
                        f"| `{param['name']}` | {param['in']} | "
                        f"{'yes' if param.get('required') else 'no'} | "
                        f"{schema_name(param.get('schema'))} |"
                    )
                details.append("")
            body = op.get("requestBody", {}).get("content", {}).get("application/json")
            if body:
                details += [f"**Request body:** {schema_name(body.get('schema'))}", ""]
            codes = ", ".join(f"`{code}`" for code in op.get("responses", {}))
            if codes:
                details += [f"**Responses:** {codes}", ""]
    return "\n".join(lines + details) + "\n"


nav = mkdocs_gen_files.Nav()
python_pages(nav)
with mkdocs_gen_files.open("reference/http.md", "w") as page:
    page.write(http_page())
with mkdocs_gen_files.open("reference/SUMMARY.md", "w") as summary:
    summary.writelines(
        [
            "* [Overview](index.md)\n",
            "* [Commands and configuration](commands.md)\n",
            "* [HTTP API](http.md)\n",
            "* Python API\n",
        ]
    )
    summary.writelines("    " + line for line in nav.build_literate_nav())
