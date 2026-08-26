"""Download a Google Drive folder via a service-account credential.

Variable resolution, lowest to highest precedence:
  1. Hardcoded defaults
  2. config.json ``downloads`` section
  3. Explicit CLI flags
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from rich.console import Console
from rich.text import Text
from rich.progress import (
    BarColumn,
    DownloadColumn,
    MofNCompleteColumn,
    Progress,
    ProgressColumn,
    SpinnerColumn,
    Task,
    TextColumn,
    TimeRemainingColumn,
    TransferSpeedColumn,
)
from rich.table import Table

from library.config import (
    DEFAULT_CONFIG_PATH,
    DEFAULT_MAX_SIZE_MB,
    VIDEO_EXTENSIONS,
    load_section,
    matching_filter,
    normalize_extensions,
    normalize_patterns,
    resolve_impersonate,
    service_account_email,
)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_MIME = "application/vnd.google-apps.folder"
SHORTCUT_MIME = "application/vnd.google-apps.shortcut"
VIDEO_MIME_PREFIX = "video/"

EXPORT_TARGETS: dict[str, tuple[str, str]] = {
    "application/vnd.google-apps.document": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".pptx",
    ),
    "application/vnd.google-apps.drawing": ("image/png", ".png"),
    "application/vnd.google-apps.jam": ("application/pdf", ".pdf"),
    "application/vnd.google-apps.script": (
        "application/vnd.google-apps.script+json",
        ".json",
    ),
}

FOLDER_ID_PATTERNS = (
    re.compile(r"/folders/([a-zA-Z0-9_-]+)"),
    re.compile(r"/file/d/([a-zA-Z0-9_-]+)"),
    re.compile(r"[?&]id=([a-zA-Z0-9_-]+)"),
)
UNSAFE_NAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
console = Console()


class CountOrDownloadColumn(ProgressColumn):
    def __init__(self) -> None:
        super().__init__()
        self._count = MofNCompleteColumn()
        self._download = DownloadColumn()

    def render(self, task: Task):
        if task.fields.get("bytes"):
            return self._download.render(task)
        return self._count.render(task)


class OptionalSpeedColumn(ProgressColumn):
    def __init__(self) -> None:
        super().__init__()
        self._speed = TransferSpeedColumn()

    def render(self, task: Task):
        if task.fields.get("bytes"):
            return self._speed.render(task)
        return Text("")


@dataclass
class DownloadConfig:
    config_path: Path
    credentials: Path
    folder_url: str
    folder_id: str
    output_dir: Path
    impersonate: str
    overwrite: bool
    dry_run: bool
    recursive: bool
    max_size_mb: float
    exclude_extensions: list[str]
    include_extensions: list[str]
    filters: list[str]


@dataclass
class PlannedFile:
    file_id: str
    name: str
    mime_type: str
    size: int | None
    dest: Path
    skip_reason: str | None = None


def parse_folder_id(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if re.fullmatch(r"[a-zA-Z0-9_-]{10,}", text) and "://" not in text:
        return text
    for pattern in FOLDER_ID_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    raise ValueError(f"Could not parse a Drive folder ID from: {value}")


def _cli_list(value: str | None) -> list[str] | None:
    if value is None:
        return None
    return normalize_extensions(value)


def resolve_config(args: argparse.Namespace) -> DownloadConfig:
    config_path = Path(args.config).expanduser()
    stored = load_section(config_path, "downloads")

    credentials = Path(args.credentials or stored["credentials"]).expanduser()
    folder_url = args.folder_url or stored["folder_url"]
    folder_id = args.folder_id if args.folder_id is not None else stored["folder_id"]
    output_dir = Path(args.output_dir or stored["output_dir"]).expanduser()
    overwrite = True if args.overwrite else bool(stored["overwrite"])
    dry_run = True if args.dry_run else bool(stored["dry_run"])
    recursive = stored["recursive"] if args.recursive is None else args.recursive
    max_size_mb = (
        stored["max_size_mb"] if args.max_size_mb is None else args.max_size_mb
    )
    exclude_extensions = (
        stored["exclude_extensions"]
        if args.exclude_extensions is None
        else _cli_list(args.exclude_extensions)
    )
    include_extensions = (
        stored["include_extensions"]
        if args.include_extensions is None
        else _cli_list(args.include_extensions)
    )
    filters = (
        stored["filters"]
        if args.filters is None
        else normalize_patterns(args.filters)
    )
    impersonate_value = (
        stored["impersonate"] if args.impersonate is None else args.impersonate
    )
    if args.no_impersonate:
        impersonate_value = False

    if not folder_id:
        folder_id = parse_folder_id(folder_url)

    return DownloadConfig(
        config_path=config_path,
        credentials=credentials,
        folder_url=folder_url,
        folder_id=folder_id,
        output_dir=output_dir,
        impersonate=resolve_impersonate(impersonate_value, credentials),
        overwrite=overwrite,
        dry_run=dry_run,
        recursive=bool(recursive),
        max_size_mb=float(max_size_mb or 0),
        exclude_extensions=exclude_extensions or [],
        include_extensions=include_extensions or [],
        filters=filters or [],
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Download a Google Drive folder using local service-account credentials.",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Config JSON path (default: config.json)",
    )
    parser.add_argument("--credentials", default=None)
    parser.add_argument("--folder-url", default=None)
    parser.add_argument("--folder-id", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument(
        "--impersonate",
        default=None,
        help="Workspace user email, or true to use the service-account email",
    )
    parser.add_argument(
        "--no-impersonate",
        action="store_true",
        help="Use the service account directly, without with_subject()",
    )
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-recursive", dest="recursive", action="store_false")
    parser.add_argument(
        "--max-size-mb",
        type=float,
        default=None,
        help=f"Skip files larger than this (default: {DEFAULT_MAX_SIZE_MB}; 0 = no limit)",
    )
    parser.add_argument(
        "--exclude-extensions",
        default=None,
        help="Comma-separated extensions to skip (default: video extensions)",
    )
    parser.add_argument(
        "--include-extensions",
        default=None,
        help="If set, only download these extensions",
    )
    parser.add_argument(
        "--filter",
        action="append",
        dest="filters",
        default=None,
        help="gitignore-style pattern relative to the folder root (repeatable)",
    )
    parser.set_defaults(recursive=None)
    return parser


def load_credentials(credentials_path: Path, impersonate: str = ""):
    if not credentials_path.is_file():
        raise FileNotFoundError(
            f"Service-account credentials not found: {credentials_path}"
        )
    creds = service_account.Credentials.from_service_account_file(
        str(credentials_path), scopes=SCOPES
    )
    account_email = service_account_email(credentials_path)
    if impersonate and impersonate != account_email:
        creds = creds.with_subject(impersonate)
    return creds


def _list_children(service: Any, folder_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    token = None
    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields=(
                    "nextPageToken, files(id, name, mimeType, size, md5Checksum, "
                    "shortcutDetails)"
                ),
                pageToken=token,
                pageSize=1000,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            )
            .execute()
        )
        items.extend(response.get("files", []))
        token = response.get("nextPageToken")
        if not token:
            break
    return items


def _safe_name(name: str) -> str:
    cleaned = UNSAFE_NAME.sub("_", name).strip().strip(".")
    return cleaned or "untitled"


def _unique_path(path: Path, used: set[str]) -> Path:
    if path.name not in used:
        return path
    stem, suffix = path.stem, path.suffix
    index = 1
    while True:
        candidate = path.with_name(f"{stem}_{index}{suffix}")
        if candidate.name not in used:
            return candidate
        index += 1


def _resolve_item(service: Any, item: dict[str, Any]) -> dict[str, Any]:
    if item.get("mimeType") != SHORTCUT_MIME:
        return item
    target_id = (item.get("shortcutDetails") or {}).get("targetId")
    if not target_id:
        return item
    return (
        service.files()
        .get(
            fileId=target_id,
            fields="id, name, mimeType, size, md5Checksum, shortcutDetails",
            supportsAllDrives=True,
        )
        .execute()
    )


def _local_file_path(directory: Path, name: str, mime_type: str) -> Path:
    safe = _safe_name(name)
    path = directory / safe
    export = EXPORT_TARGETS.get(mime_type)
    if export and path.suffix.lower() != export[1]:
        path = path.with_name(path.name + export[1])
    return path


def _item_extension(name: str, mime_type: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix:
        return suffix
    export = EXPORT_TARGETS.get(mime_type)
    if export:
        return export[1]
    return ""


def _item_size(item: dict[str, Any]) -> int | None:
    raw = item.get("size")
    if raw in (None, ""):
        return None
    return int(raw)


def skip_reason(
    config: DownloadConfig,
    name: str,
    mime_type: str,
    size: int | None,
    rel_path: str,
) -> str | None:
    ignored = matching_filter(config.filters, rel_path)
    if ignored:
        return f"filter {ignored}"
    extension = _item_extension(name, mime_type)
    if config.include_extensions and extension not in config.include_extensions:
        return f"extension {extension or 'none'} not in include list"
    if extension and extension in config.exclude_extensions:
        return f"excluded extension {extension}"
    video_exts = set(VIDEO_EXTENSIONS) & set(config.exclude_extensions)
    if video_exts and mime_type.startswith(VIDEO_MIME_PREFIX):
        return f"video mime {mime_type}"
    if (
        config.max_size_mb > 0
        and size is not None
        and size > config.max_size_mb * 1024 * 1024
    ):
        return f"size {size / (1024 * 1024):.1f} MB over {config.max_size_mb:g} MB limit"
    return None


def _download_file(
    service: Any,
    item: PlannedFile,
    progress: Progress,
    task_id: Any,
) -> None:
    item.dest.parent.mkdir(parents=True, exist_ok=True)
    export = EXPORT_TARGETS.get(item.mime_type)
    if item.mime_type.startswith("application/vnd.google-apps.") and not export:
        raise RuntimeError(f"unsupported Google type: {item.mime_type}")
    request = (
        service.files().export_media(fileId=item.file_id, mimeType=export[0])
        if export
        else service.files().get_media(fileId=item.file_id, supportsAllDrives=True)
    )
    total = item.size or 0
    progress.update(task_id, total=max(total, 1), completed=0)
    with item.dest.open("wb") as handle:
        downloader = MediaIoBaseDownload(handle, request, chunksize=1024 * 1024)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status is not None:
                completed = int(status.resumable_progress or 0)
                reported_total = int(status.total_size or total or completed or 1)
                progress.update(task_id, completed=completed, total=reported_total)


def collect_files(
    service: Any,
    folder_id: str,
    dest: Path,
    config: DownloadConfig,
) -> list[PlannedFile]:
    planned: list[PlannedFile] = []
    dest.mkdir(parents=True, exist_ok=True)

    def walk(current_id: str, current_dest: Path) -> None:
        children = _list_children(service, current_id)
        local_used: set[str] = set()
        for raw in children:
            item = _resolve_item(service, raw)
            name = item.get("name") or raw.get("name") or "untitled"
            mime_type = item.get("mimeType", "")
            if mime_type == FOLDER_MIME:
                child_dir = current_dest / _safe_name(name)
                rel_dir = child_dir.relative_to(dest).as_posix()
                folder_filter = matching_filter(config.filters, rel_dir, is_dir=True)
                if folder_filter:
                    planned.append(
                        PlannedFile(
                            file_id=item["id"],
                            name=name,
                            mime_type=mime_type,
                            size=None,
                            dest=child_dir,
                            skip_reason=f"filter {folder_filter}",
                        )
                    )
                    continue
                if config.recursive:
                    walk(item["id"], child_dir)
                continue
            path = _unique_path(
                _local_file_path(current_dest, name, mime_type),
                local_used,
            )
            local_used.add(path.name)
            size = _item_size(item)
            rel_path = path.relative_to(dest).as_posix()
            reason = skip_reason(config, name, mime_type, size, rel_path)
            if path.exists() and not config.overwrite and reason is None:
                reason = "already exists"
            planned.append(
                PlannedFile(
                    file_id=item["id"],
                    name=name,
                    mime_type=mime_type,
                    size=size,
                    dest=path,
                    skip_reason=reason,
                )
            )

    walk(folder_id, dest)
    return planned


def describe_config(config: DownloadConfig) -> None:
    table = Table(title="Download settings", show_header=False, box=None, padding=(0, 2))
    table.add_column(style="dim")
    table.add_column()
    rows = [
        ("config", str(config.config_path)),
        ("credentials", str(config.credentials)),
        ("folder_url", config.folder_url),
        ("folder_id", config.folder_id),
        ("output_dir", str(config.output_dir)),
        ("impersonate", config.impersonate or "(service account)"),
        ("overwrite", str(config.overwrite)),
        ("dry_run", str(config.dry_run)),
        ("recursive", str(config.recursive)),
        ("max_size_mb", f"{config.max_size_mb:g}" if config.max_size_mb else "none"),
        ("exclude_extensions", ",".join(config.exclude_extensions) or "none"),
        ("include_extensions", ",".join(config.include_extensions) or "all"),
        ("filters", ", ".join(config.filters) or "none"),
    ]
    for key, value in rows:
        table.add_row(key, value)
    console.print(table)


def render_plan(files: list[PlannedFile]) -> None:
    table = Table(title="Remote files")
    table.add_column("Action")
    table.add_column("Path")
    table.add_column("Size", justify="right")
    table.add_column("Note")
    for item in files:
        size = f"{item.size:,} B" if item.size is not None else "unknown"
        if item.skip_reason:
            table.add_row("[yellow]skip[/yellow]", str(item.dest), size, item.skip_reason)
        else:
            table.add_row("[green]get[/green]", str(item.dest), size, item.mime_type)
    console.print(table)


def run(config: DownloadConfig) -> int:
    describe_config(config)
    creds = load_credentials(config.credentials, config.impersonate)
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    try:
        meta = (
            service.files()
            .get(
                fileId=config.folder_id,
                fields="id, name, mimeType",
                supportsAllDrives=True,
            )
            .execute()
        )
    except HttpError as exc:
        share_as = config.impersonate or creds.service_account_email
        console.print(
            f"[red]Could not open Drive folder[/red] {config.folder_id}.\n"
            "Share that folder (Viewer is enough) with:\n"
            f"  [bold]{share_as}[/bold]\n"
            f"Credential file: {config.credentials}\n{exc}"
        )
        return 1

    console.print(
        f"Remote folder: [bold]{meta.get('name')}[/bold] ({meta.get('id')})"
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as spinner:
        spinner.add_task("Scanning Drive folder", total=None)
        planned = collect_files(service, config.folder_id, config.output_dir, config)

    queued = [item for item in planned if item.skip_reason is None]
    skipped = [item for item in planned if item.skip_reason is not None]
    render_plan(planned)

    if config.dry_run:
        console.print(
            f"[bold]Dry run.[/bold] would_download={len(queued)} "
            f"skipped={len(skipped)} dest={config.output_dir}"
        )
        return 0

    failed = 0
    downloaded = 0
    columns = (
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        CountOrDownloadColumn(),
        OptionalSpeedColumn(),
        TimeRemainingColumn(),
    )
    with Progress(*columns, console=console) as progress:
        overall = progress.add_task("Downloading", total=len(queued))
        file_task = progress.add_task("File", total=1, bytes=True)
        for item in queued:
            progress.update(file_task, description=item.dest.name, completed=0)
            try:
                _download_file(service, item, progress, file_task)
                downloaded += 1
            except (HttpError, OSError, RuntimeError) as exc:
                console.print(f"[red]fail[/red] {item.dest}: {exc}")
                failed += 1
            progress.advance(overall)

    console.print(
        f"[bold]Done.[/bold] downloaded={downloaded} skipped={len(skipped)} "
        f"failed={failed} dest={config.output_dir}"
    )
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        config = resolve_config(args)
    except ValueError as exc:
        console.print(f"[red]{exc}[/red]")
        return 2
    try:
        return run(config)
    except FileNotFoundError as exc:
        console.print(f"[red]{exc}[/red]")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
