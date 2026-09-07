"""Fail if the Git index contains source archives, secrets, or transcript bundles."""

from pathlib import PurePosixPath, Path
import json
import re
import subprocess
import sys


def forbidden_path(name: str) -> bool:
    p = PurePosixPath(name)
    return (
        p.parts[0] in {"context", "manuscript", "credentials"}
        or name.startswith(("content/generated/", "apps/web/dist/"))
        or p.name in {"config.json", "PLAN.md"}
        or (p.name.startswith(".env") and p.name != ".env.example")
        or ".local." in p.name
        or p.suffix.lower()
        in {".docx", ".doc", ".pdf", ".sqlite", ".db", ".mp3", ".wav", ".mp4"}
        or any(part in {"test-results", "playwright-report"} for part in p.parts)
    )


def is_content_bundle(data: bytes) -> bool:
    try:
        obj = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        return False
    return (
        isinstance(obj, dict)
        and "messages" in obj
        and any(k in obj for k in ("sources", "content_version", "generation_ids"))
    )


def is_alias_config(data: bytes) -> bool:
    try:
        obj = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        return False
    return (
        isinstance(obj, dict)
        and isinstance(obj.get("people"), list)
        and any(
            isinstance(person, dict) and "names" in person and "alias" in person
            for person in obj["people"]
        )
    )


def main():
    paths = (
        subprocess.check_output(["git", "ls-files", "--cached", "-z"])
        .decode()
        .split("\0")
    )
    excerpts = []
    private = Path("content/generated/bundle.json")
    if private.exists():
        corpus = json.loads(private.read_text())
        for item in [
            *corpus.get("messages", []),
            *corpus.get("documents", []),
            *corpus.get("artifacts", []),
        ]:
            for paragraph in item.get("body", "").splitlines():
                if len(paragraph) >= 100:
                    sample = paragraph[:100]
                    excerpts.extend(
                        [
                            sample.encode(),
                            json.dumps(sample, ensure_ascii=False)[1:-1].encode(),
                        ]
                    )
    problems = []
    for name in filter(None, paths):
        if forbidden_path(name):
            problems.append(name + ": private/generated path")
            continue
        data = subprocess.check_output(["git", "show", ":" + name])
        if is_content_bundle(data):
            problems.append(name + ": transcript or branch bundle")
        if is_alias_config(data):
            problems.append(name + ": private alias configuration")
        if re.search(
            rb"(?:sk-proj-|sk-ant-api\d+-|ghp_|pk1_|sk1_)[A-Za-z0-9_-]{24,}", data
        ):
            problems.append(name + ": credential-shaped value")
        if any(sample in data for sample in excerpts):
            problems.append(name + ": source-text excerpt")
    if problems:
        print("Public-tree check failed:\n" + "\n".join(problems), file=sys.stderr)
        raise SystemExit(1)
    print(
        "Public-tree check passed: no archive paths, bundles, credentials, or locally matched source excerpts."
    )


if __name__ == "__main__":
    main()
