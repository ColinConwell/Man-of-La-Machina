"""Project config.json helpers.

Top-level keys are independent sections. Download settings live under
``downloads``; other sections will be added later and must be preserved
when this file is rewritten.
"""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

DEFAULT_CONFIG_PATH = Path("config.json")
DEFAULT_CREDENTIALS = "credentials/google-drive.json"
DEFAULT_FOLDER_URL = (
    "https://drive.google.com/drive/folders/1OqaoZOOb5hYL6HuNwEYxGOdCb5uC5gkU"
)
DEFAULT_OUTPUT_DIR = "context/data"
DEFAULT_MAX_SIZE_MB = 100

VIDEO_EXTENSIONS = (
    ".mp4",
    ".m4v",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
    ".wmv",
    ".flv",
    ".mpeg",
    ".mpg",
    ".3gp",
    ".ogv",
    ".mts",
    ".m2ts",
    ".ts",
    ".vob",
    ".asf",
)

DOWNLOADS_DEFAULTS: dict[str, Any] = {
    "credentials": DEFAULT_CREDENTIALS,
    "folder_url": DEFAULT_FOLDER_URL,
    "folder_id": "",
    "output_dir": DEFAULT_OUTPUT_DIR,
    "impersonate": True,
    "overwrite": False,
    "dry_run": False,
    "recursive": True,
    "max_size_mb": DEFAULT_MAX_SIZE_MB,
    "exclude_extensions": list(VIDEO_EXTENSIONS),
    "include_extensions": [],
}

SECTION_DEFAULTS: dict[str, dict[str, Any]] = {
    "downloads": DOWNLOADS_DEFAULTS,
}

DOWNLOAD_FIELD_HELP: dict[str, str] = {
    "credentials": "Service-account JSON path",
    "folder_url": "Google Drive folder URL",
    "folder_id": "Folder ID (blank = parse from URL)",
    "output_dir": "Local download directory",
    "impersonate": "True, a Workspace user email, or false to disable",
    "overwrite": "Replace files that already exist locally",
    "dry_run": "List remote files without downloading",
    "recursive": "Include nested folders",
    "max_size_mb": "Skip files larger than this many MB (0 = no limit)",
    "exclude_extensions": "Comma-separated extensions to skip",
    "include_extensions": "If set, only download these extensions",
}


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def dump_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def service_account_email(credentials_path: Path | str) -> str:
    path = Path(credentials_path).expanduser()
    if not path.is_file():
        return ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ""
    return str(payload.get("client_email") or "")


def normalize_extensions(value: Any) -> list[str]:
    if value is None or value is False:
        return []
    if isinstance(value, str):
        items = [part.strip() for part in value.split(",")]
    elif isinstance(value, (list, tuple)):
        items = [str(part).strip() for part in value]
    else:
        raise ValueError(f"Could not parse extensions from {value!r}")
    normalized: list[str] = []
    for item in items:
        if not item:
            continue
        ext = item.lower()
        if not ext.startswith("."):
            ext = f".{ext}"
        if ext not in normalized:
            normalized.append(ext)
    return normalized


def merge_section(section: str, overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = deepcopy(SECTION_DEFAULTS.get(section, {}))
    if overrides:
        merged.update(overrides)
    if section == "downloads":
        merged["exclude_extensions"] = normalize_extensions(
            merged.get("exclude_extensions")
        )
        merged["include_extensions"] = normalize_extensions(
            merged.get("include_extensions")
        )
        max_size = merged.get("max_size_mb", DEFAULT_MAX_SIZE_MB)
        merged["max_size_mb"] = float(max_size) if max_size not in (None, "") else 0
        impersonate = merged.get("impersonate", True)
        if isinstance(impersonate, str) and impersonate.strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }:
            merged["impersonate"] = True
        elif isinstance(impersonate, str) and impersonate.strip().lower() in {
            "0",
            "false",
            "no",
            "off",
            "",
        }:
            merged["impersonate"] = False
    return merged


def load_section(path: Path, section: str) -> dict[str, Any]:
    raw = load_json(path)
    stored = raw.get(section)
    if stored is not None and not isinstance(stored, dict):
        raise ValueError(f"{path}: '{section}' must be an object")
    return merge_section(section, stored)


def write_section(path: Path, section: str, values: dict[str, Any]) -> dict[str, Any]:
    data = load_json(path)
    data[section] = merge_section(section, values)
    dump_json(path, data)
    return data


def resolve_impersonate(value: Any, credentials_path: Path | str) -> str:
    if value is False or value == "" or (
        isinstance(value, str) and value.strip().lower() in {"0", "false", "no", "off"}
    ):
        return ""
    email = service_account_email(credentials_path)
    if value is True or value is None or (
        isinstance(value, str) and value.strip().lower() in {"1", "true", "yes", "on"}
    ):
        return email
    return str(value).strip()


def _format_default(value: Any) -> str:
    if isinstance(value, list):
        return ",".join(str(item) for item in value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def _parse_prompted(current: Any, typed: str) -> Any:
    if typed == "":
        return current
    if isinstance(current, bool):
        lowered = typed.lower()
        if lowered in {"1", "true", "yes", "y", "on"}:
            return True
        if lowered in {"0", "false", "no", "n", "off"}:
            return False
        return typed
    if isinstance(current, list):
        return normalize_extensions(typed)
    if isinstance(current, (int, float)) and not isinstance(current, bool):
        return type(current)(typed)
    return typed


def prompt_section(section: str, current: dict[str, Any]) -> dict[str, Any]:
    from rich.console import Console
    from rich.prompt import Prompt

    console = Console()
    console.print(
        f"[bold]Interactive config:[/bold] section [cyan]{section}[/cyan]. "
        "Press Enter to keep the current value."
    )
    updated = deepcopy(current)
    help_map = DOWNLOAD_FIELD_HELP if section == "downloads" else {}
    for key, value in current.items():
        label = help_map.get(key, key)
        typed = Prompt.ask(f"{label} ({key})", default=_format_default(value))
        updated[key] = _parse_prompted(value, typed if typed is not None else "")
    return merge_section(section, updated)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate or update config.json section by section.",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Config path (default: config.json)",
    )
    parser.add_argument(
        "--section",
        default="downloads",
        choices=sorted(SECTION_DEFAULTS),
        help="Section to write (default: downloads)",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Prompt for each field in the section",
    )
    parser.add_argument("--credentials", default=None)
    parser.add_argument("--folder-url", default=None)
    parser.add_argument("--folder-id", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--impersonate", default=None)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-recursive", dest="recursive", action="store_false")
    parser.add_argument("--max-size-mb", type=float, default=None)
    parser.add_argument("--exclude-extensions", default=None)
    parser.add_argument("--include-extensions", default=None)
    parser.set_defaults(recursive=None)
    return parser


def _cli_overrides(args: argparse.Namespace) -> dict[str, Any]:
    mapping = {
        "credentials": args.credentials,
        "folder_url": args.folder_url,
        "folder_id": args.folder_id,
        "output_dir": args.output_dir,
        "impersonate": args.impersonate,
        "max_size_mb": args.max_size_mb,
        "exclude_extensions": args.exclude_extensions,
        "include_extensions": args.include_extensions,
    }
    overrides = {key: value for key, value in mapping.items() if value is not None}
    if args.overwrite:
        overrides["overwrite"] = True
    if args.dry_run:
        overrides["dry_run"] = True
    if args.recursive is False:
        overrides["recursive"] = False
    return overrides


def main(argv: list[str] | None = None) -> int:
    from rich.console import Console
    from rich.json import JSON

    args = build_parser().parse_args(argv)
    path = Path(args.config).expanduser()
    current = load_section(path, args.section)
    current.update(_cli_overrides(args))
    current = merge_section(args.section, current)
    if args.interactive:
        current = prompt_section(args.section, current)
    data = write_section(path, args.section, current)
    console = Console()
    console.print(f"Wrote [cyan]{path}[/cyan] section [cyan]{args.section}[/cyan]:")
    console.print(JSON.from_data(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
