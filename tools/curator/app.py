"""Local source demarcation, with private atomic saves and conflict detection."""

import ipaddress
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from threading import Lock
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from packages.content.aliases import load_aliases
from packages.content.importer import extract_docx
from packages.content.beginnings import (
    BeginningCatalog,
    LOCAL_CATALOG,
    ROOT,
    apply_catalog,
    default_catalog,
)
from packages.domain.models import Bundle, Frozen, digest


class SaveCatalog(Frozen):
    revision: str
    catalog: BeginningCatalog


def create_curator(bundle=None, path=LOCAL_CATALOG, aliases=None, source_root=None):
    load_dotenv(ROOT / ".env.local", override=False)
    if os.getenv("MACHINA_DEPLOYMENT") == "hosted":
        raise RuntimeError("The annotation tool is only available locally")
    path = Path(path)
    if not path.name.endswith(".local.json"):
        raise ValueError("Annotation files must use the ignored .local.json suffix")
    bundle = bundle or Bundle.model_validate_json(
        Path(
            os.getenv("MACHINA_BUNDLE", ROOT / "content/generated/bundle.json")
        ).read_text()
    )
    aliases = aliases or load_aliases()
    source_root = Path(source_root or ROOT / "context").resolve()
    token = secrets.token_urlsafe(32)
    lock = Lock()
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]"]
    )

    def current():
        return (
            BeginningCatalog.model_validate_json(path.read_text())
            if path.exists()
            else default_catalog(bundle)
        )

    def snapshot():
        catalog = current()
        return {
            "revision": digest(catalog.model_dump()),
            "catalog": aliases.tree(catalog.model_dump()),
        }

    def source_file(thread_id):
        thread = next((t for t in bundle.threads if t.id == thread_id), None)
        if not thread:
            raise HTTPException(404, "Conversation not found")
        source = next(s for s in bundle.sources if s.id == thread.source_document_id)
        file = (ROOT / source.path).resolve()
        if (
            not file.is_relative_to(source_root)
            or not file.is_file()
            or file.suffix.lower() != ".docx"
        ):
            raise HTTPException(404, "Original source is unavailable on this computer")
        return source, file

    @app.get("/api/threads/{thread_id}/source")
    def source(thread_id: str):
        original, file = source_file(thread_id)
        paragraphs, _, _ = extract_docx(file)
        return {
            "title": aliases.text(original.title),
            "native_available": sys.platform == "darwin",
            "matches_archive": hashlib.sha256(file.read_bytes()).hexdigest()
            == original.sha256,
            "paragraphs": [
                {"index": i, "text": aliases.text(text)}
                for i, text in paragraphs
                if text.strip()
            ],
        }

    @app.post("/api/threads/{thread_id}/source/{action}")
    def open_source(thread_id: str, action: str):
        _, file = source_file(thread_id)
        if action not in ("reveal", "open"):
            raise HTTPException(422, "Unknown source action")
        if sys.platform != "darwin":
            raise HTTPException(409, "Native source actions require macOS")
        # Resolve only an archived source ID; never accept command text or a path from the browser.
        command = (
            ["/usr/bin/open", "-R", str(file)]
            if action == "reveal"
            else ["/usr/bin/open", str(file)]
        )
        try:
            subprocess.run(command, check=True, timeout=10, capture_output=True)
        except (OSError, subprocess.SubprocessError):
            raise HTTPException(
                503, "The source could not be opened on this computer"
            ) from None
        return {"opened": True}

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        try:
            local = ipaddress.ip_address(request.client.host).is_loopback
        except (ValueError, AttributeError):
            local = False
        origin = request.headers.get("origin")
        if not local or (
            origin and urlparse(origin).netloc != request.headers.get("host")
        ):
            return JSONResponse({"detail": "Local requests only"}, status_code=403)
        if request.url.path.startswith("/api/") and not secrets.compare_digest(
            request.headers.get("x-curator-token", ""), token
        ):
            return JSONResponse(
                {"detail": "Open the local annotation page first"}, status_code=403
            )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            f"default-src 'none'; script-src 'nonce-{token}'; style-src 'nonce-{token}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        )
        return response

    @app.get("/")
    def index():
        return HTMLResponse(
            Path(__file__)
            .with_name("index.html")
            .read_text()
            .replace("__NONCE__", token)
        )

    @app.get("/api/catalog")
    def catalog():
        with lock:
            return {
                **snapshot(),
                "threads": [t.model_dump() for t in aliases.bundle(bundle).threads],
                "entry_threads": {m.id: m.thread_id for m in bundle.messages},
            }

    @app.get("/api/threads/{thread_id}")
    def thread(thread_id: str):
        messages = [m for m in bundle.messages if m.thread_id == thread_id]
        if not messages:
            raise HTTPException(404, "Conversation not found")
        return aliases.tree(
            [
                {
                    "id": m.id,
                    "sequence": m.sequence,
                    "speaker": m.speaker,
                    "body": m.body,
                    "locator": m.provenance.locator,
                }
                for m in messages
            ]
        )

    @app.put("/api/catalog")
    def save(payload: SaveCatalog):
        with lock:
            if payload.revision != digest(current().model_dump()):
                raise HTTPException(409, "The catalog changed. Reload before saving.")
            try:
                apply_catalog(bundle, payload.catalog)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, temporary = tempfile.mkstemp(
                prefix=".beginnings-", suffix=".local.json", dir=path.parent
            )
            try:
                with os.fdopen(fd, "w") as f:
                    f.write(payload.catalog.model_dump_json(indent=2) + "\n")
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temporary, path)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
            return snapshot()

    return app
