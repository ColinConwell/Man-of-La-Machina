"""Build a private reading release from editable TeX/BibTeX and About Markdown.

Requires Pandoc with citeproc. No TeX programs or shell escape are executed.
The original files are retained unchanged; only the derived reading is normalized.
"""

import argparse
from html import escape
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from packages.content.editorial import (
    EditorialDocument,
    EditorialRelease,
    reading_document,
)
from packages.content.aliases import load_aliases

ROOT = Path(__file__).resolve().parents[1]


def pandoc(text, *arguments, cwd):
    result = subprocess.run(
        ["pandoc", *arguments],
        input=text,
        text=True,
        capture_output=True,
        cwd=cwd,
        timeout=60,
        check=False,
    )
    # Warnings can include unpublished manuscript text. Fail without logging it.
    if result.returncode or result.stderr.strip():
        raise ValueError(
            "Pandoc reported a conversion problem; inspect the private source and references locally"
        )
    return result.stdout


def prepare_tex(text, macros):
    # Name macros are an explicit private mapping. Keep their real values in the
    # private release so the server's current alias configuration remains authoritative.
    text = re.sub(r"\\input\{names\.tex\}", "", text)
    text = re.sub(r"\\pseudonymize\{(?:true|false)\}", "", text)
    text = re.sub(r"\\NameReviewNote(?:\{\})?", "", text)
    for key in sorted(macros, key=len, reverse=True):
        if not re.fullmatch(r"[A-Za-z]+", key):
            raise ValueError("Invalid name macro")
        text = re.sub(
            r"\\" + key + r"(?![A-Za-z])(?:\{\})?", lambda _: macros[key], text
        )
    return text


def build(source, about, output, edition):
    source = source.resolve()
    macros = json.loads((source / "macros.local.json").read_text())
    text = prepare_tex((source / "main.tex").read_text(), macros)
    ast = json.loads(
        pandoc(
            text,
            "--from=latex",
            "--to=json",
            "--citeproc",
            "--bibliography=main.bib",
            "--metadata=link-citations:true",
            cwd=source,
        )
    )
    title = ast["meta"]["title"]
    title_ast = {**ast, "meta": {}, "blocks": [{"t": "Plain", "c": title["c"]}]}
    title_text = pandoc(
        json.dumps(title_ast), "--from=json", "--to=plain", "--wrap=none", cwd=source
    ).strip()
    blocks = []
    if "abstract" in ast["meta"]:
        abstract = ast["meta"]["abstract"]
        blocks.append(
            {
                "t": "Header",
                "c": [2, ["abstract", [], []], [{"t": "Str", "c": "Abstract"}]],
            }
        )
        blocks.extend(
            abstract["c"]
            if abstract["t"] == "MetaBlocks"
            else [{"t": "Para", "c": abstract["c"]}]
        )
    for block in ast["blocks"]:
        if block["t"] == "Header":
            block["c"][0] = 2
        if block["t"] == "Div" and "references" in block["c"][0][1]:
            blocks.append(
                {
                    "t": "Header",
                    "c": [2, ["references", [], []], [{"t": "Str", "c": "References"}]],
                }
            )
        blocks.append(block)
    reading_ast = {**ast, "meta": {}, "blocks": blocks}
    html = pandoc(
        json.dumps(reading_ast), "--from=json", "--to=html5", "--wrap=none", cwd=source
    )
    about_text = about.read_text()
    about_html = pandoc(
        about_text, "--from=markdown", "--to=html5", "--wrap=none", cwd=source
    )
    release = EditorialRelease(
        about=EditorialDocument(
            title="About Man of La Machina",
            deck="A lived journey. An open conversation. A chance to choose again.",
            body_html=about_html,
        ),
        essay=EditorialDocument(
            title=title_text,
            deck="The essay behind the experience",
            body_html=html,
            edition=edition,
        ),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=output.parent, suffix=".local.json")
    try:
        with os.fdopen(fd, "w") as file:
            file.write(release.model_dump_json(indent=2) + "\n")
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(
        "Private editorial release built; source TeX and bibliography retained unchanged."
    )
    return release


def export_html(release, directory, aliases):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for page in ("about", "essay"):
        if not (document := getattr(release, page)):
            continue
        reading = reading_document(document, aliases)
        title = escape(reading["title"])
        html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><style>body{{max-width:48rem;margin:4rem auto;padding:0 1.5rem;font:19px/1.7 Georgia,serif;color:#292923}}h1{{line-height:1.15}}h2{{margin-top:2.5rem}}a{{color:#8b4534}}.csl-entry{{font-size:15px;margin-bottom:1rem}}</style></head><body><main><h1>{title}</h1><p>{escape(reading["edition"])}</p>{reading["body_html"]}</main></body></html>'
        file = directory / f"{page}.html"
        fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as output:
            output.write(html)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "manuscript/essay")
    parser.add_argument("--about", type=Path, default=ROOT / "manuscript/about.md")
    parser.add_argument(
        "--output", type=Path, default=ROOT / "manuscript/editorial.local.json"
    )
    parser.add_argument("--edition", default="Reading edition · September 14, 2026")
    parser.add_argument(
        "--html-dir",
        type=Path,
        help="Optionally export standalone, aliased HTML into a private directory",
    )
    args = parser.parse_args()
    release = build(args.source, args.about, args.output, args.edition)
    if args.html_dir:
        export_html(release, args.html_dir, load_aliases(required=True))
