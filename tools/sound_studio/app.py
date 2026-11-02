"""Loopback-only Sound Studio HTTP API and compiled frontend."""

from __future__ import annotations
import asyncio
import importlib.util
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, ConfigDict
from packages.audio.models import Source, Project, Batch, now
from packages.audio.storage import Store, Remote
from packages.audio.content import Content, ROOT
from packages.audio.effects import EFFECTS, validate_recipe
from packages.audio import providers, dsp, analysis
from packages.audio.jobs import Queue

API = "/api/sound/v1"


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation: str
    payload: dict
    project_id: str | None = None


def create_app(data_dir=None, fixture=False):
    if not fixture:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env.local", override=False)
        load_dotenv(ROOT / "content/curation/storage.local.env", override=False)
        load_dotenv(ROOT / ".machina/sound-studio/storage.local.env", override=False)
    store = Store(
        data_dir or os.getenv("MACHINA_SOUND_DATA", ROOT / ".machina/sound-studio")
    )
    remote = Remote(store)
    queue = Queue(store, remote, fixture)
    content = Content(fixture)

    @asynccontextmanager
    async def lifespan(app):
        queue.start()
        yield
        await queue.close()

    app = FastAPI(title="Sound Studio · Man of La Machina", lifespan=lifespan)
    app.state.store = store
    app.state.queue = queue
    app.state.remote = remote
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["127.0.0.1", "localhost", "[::1]", "testserver"],
    )

    @app.middleware("http")
    async def private(request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if (
                (origin and urlsplit(origin).netloc != request.headers.get("host"))
                or request.headers.get("sec-fetch-site") == "cross-site"
                or request.headers.get("x-sound-studio") != "1"
            ):
                return JSONResponse(
                    {"detail": "Sound Studio accepts same-origin studio actions only"},
                    403,
                )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(ValueError)
    async def bad(request, error):
        return JSONResponse({"detail": str(error)[:400]}, 422)

    @app.exception_handler(KeyError)
    async def missing(request, error):
        return JSONResponse({"detail": "Record not found"}, 404)

    @app.exception_handler(RequestValidationError)
    async def validation(request, error):
        return JSONResponse({"detail": "Invalid Sound Studio request"}, 422)

    @app.get("/healthz")
    def health():
        return dict(status="ok", service="sound-studio")

    @app.get(API + "/capabilities")
    def capabilities():
        from packages.domain.providers import capabilities as text_capabilities
        from apps.api.narration import MODEL, INSTRUCTIONS

        return dict(
            providers=providers.capabilities(),
            effects=EFFECTS,
            remote=remote.available,
            alignment=importlib.util.find_spec("whisperx") is not None,
            analysis_providers=text_capabilities(),
            fixture=fixture,
            baseline_presets=[
                dict(
                    provider="openai",
                    model=MODEL,
                    voice=v,
                    settings={
                        "instructions": INSTRUCTIONS,
                        "response_format": "mp3",
                        "speed": 1,
                    },
                )
                for v in ("cedar", "marin")
            ],
        )

    @app.get(API + "/voices/{provider}")
    async def voices(provider: str):
        if provider not in providers.REGISTRY:
            raise ValueError("Unknown provider")
        return await providers.voices(provider)

    @app.get(API + "/content")
    def sources(q: str = "", kind: str = "", offset: int = 0):
        return content.list(q, kind, max(0, offset))

    @app.get(API + "/content/{id}")
    def source(
        id: str,
        headings: bool = True,
        citations: bool = False,
        footnotes: bool = False,
        bibliography: bool = False,
    ):
        return content.get(
            id,
            headings=headings,
            citations=citations,
            footnotes=footnotes,
            bibliography=bibliography,
        ).model_dump()

    @app.get(API + "/catalog/{kind}")
    def catalog(kind: str):
        rows = store.list(kind)
        if kind == "samples":
            return [
                {
                    **s,
                    "local": store.path(
                        next(f for f in s["files"] if f["role"] == "audio")
                    ).is_file(),
                }
                for s in rows
            ]
        return rows

    @app.get(API + "/catalog/{kind}/{id}")
    def record(kind: str, id: str):
        return store.get(kind, id)

    @app.post(API + "/projects")
    def project(project: Project):
        validate_recipe(project.recipe)
        for layer in project.recipe.layers:
            store.get("samples", layer.sample_id)
        try:
            previous = store.get("projects", project.id)
            if previous["revision"] != project.revision:
                raise HTTPException(409, "Project changed; reload before saving")
        except KeyError:
            pass
        project.revision += 1
        project.updated = now()
        result = store.save("projects", project.model_dump())
        if project.auto_upload:
            queue.submit("upload", dict(kind="projects", id=project.id))
        return result

    @app.post(API + "/samples/import")
    async def upload(
        file: UploadFile = File(...),
        text: str = Form(""),
        title: str = Form("Imported Recording"),
    ):
        extension = Path(file.filename or "").suffix.lower().lstrip(".")
        if extension not in {"wav", "mp3", "flac", "ogg", "opus", "aac", "m4a"}:
            raise ValueError("Import WAV, MP3, FLAC, OGG, Opus, AAC, or M4A")
        data = await file.read(512 * 1024 * 1024 + 1)
        if len(data) > 512 * 1024 * 1024:
            raise ValueError("Import limit is 512 MiB")
        audio, rate = await asyncio.to_thread(dsp.decode, data, extension)
        return await asyncio.to_thread(
            dsp.save_sample,
            store,
            title,
            Source(title=title, text=text, kind="imported"),
            audio,
            rate,
            data,
            extension,
            {"kind": "import"},
        )

    @app.get(API + "/review-samples")
    def review_samples():
        if fixture:
            return []
        return [
            {"id": str(i), "name": p.stem}
            for i, p in enumerate(sorted((ROOT / ".machina/review").rglob("*.mp3")))
        ]

    @app.post(API + "/review-samples/{index}")
    async def import_review(index: int):
        if fixture:
            raise ValueError("Review imports are disabled in fixtures")
        paths = sorted((ROOT / ".machina/review").rglob("*.mp3"))
        if not 0 <= index < len(paths):
            raise ValueError("Review sample not found")
        path = paths[index]
        data = path.read_bytes()
        audio, rate = await asyncio.to_thread(dsp.decode, data, "mp3")
        return await asyncio.to_thread(
            dsp.save_sample,
            store,
            path.stem,
            Source(title=path.stem, kind="review-import"),
            audio,
            rate,
            data,
            "mp3",
            {"kind": "review-import", "text_status": "not supplied"},
        )

    @app.patch(API + "/samples/{id}")
    async def metadata(id: str, payload: dict):
        allowed = {"title", "tags", "notes", "favorite", "text"}
        if set(payload) - allowed:
            raise ValueError("Unsupported metadata field")
        s = store.get("samples", id)
        for key in ("title", "notes"):
            if key in payload and (
                not isinstance(payload[key], str) or len(payload[key]) > 20000
            ):
                raise ValueError("Invalid metadata")
        if "tags" in payload and (
            not isinstance(payload["tags"], list)
            or any(not isinstance(t, str) or len(t) > 100 for t in payload["tags"])
        ):
            raise ValueError("Invalid tags")
        if "favorite" in payload and not isinstance(payload["favorite"], bool):
            raise ValueError("Invalid favorite")
        if "text" in payload:
            source = Source.model_validate({**s["source"], "text": payload.pop("text")})
            s.update(source=source.model_dump(), text_hash=source.text_hash, timing={})
            # Old feature/alignment records remain provenance but cannot match the new text hash.
        return store.save("samples", {**s, **payload})

    @app.get(API + "/samples/{id}/audio")
    def audio(id: str):
        return FileResponse(store.audio_path(id), media_type="audio/wav")

    @app.get(API + "/samples/{id}/spectrogram")
    def spectrogram(id: str):
        import numpy as np
        import soundfile as sf
        from scipy.fft import rfft, rfftfreq

        audio, rate = sf.read(store.audio_path(id), dtype="float32", always_2d=True)
        mono = np.mean(audio, axis=1)
        size = min(512, len(mono))
        if size < 8:
            raise ValueError("Audio is too short for a spectrogram")
        # Sample windows in time, never decimate the audio: the frequency axis stays truthful for long recordings.
        positions = np.linspace(
            0, len(mono) - size, min(512, max(1, len(mono) // size)), dtype=int
        )
        frames = np.stack([mono[p : p + size] for p in positions]) * np.hanning(size)
        frequencies = rfftfreq(size, 1 / rate)
        spectrum = (rfft(frames, axis=1) / (size / 2)).T[frequencies <= 12000]
        db = np.clip(
            (20 * np.log10(np.maximum(1e-6, np.abs(spectrum))) + 80) / 80, 0, 1
        )
        db = db[:: max(1, db.shape[0] // 128), :: max(1, db.shape[1] // 512)][::-1]
        return dict(
            width=db.shape[1],
            height=db.shape[0],
            values=np.round(db, 3).ravel().tolist(),
        )

    @app.get(API + "/samples/{id}/export")
    async def export(id: str, format: str = "wav"):
        if format not in {"wav", "flac", "mp3"}:
            raise ValueError("Choose WAV, FLAC, or MP3")
        path = store.audio_path(id)
        if format == "wav":
            return FileResponse(
                path, media_type="audio/wav", filename=f"sound-studio-{id}.wav"
            )
        data = await asyncio.to_thread(
            dsp.command,
            [
                os.getenv("MACHINA_FFMPEG", "ffmpeg"),
                "-v",
                "error",
                "-nostdin",
                "-i",
                str(path),
                "-f",
                format,
                "pipe:1",
            ],
        )
        return Response(
            data,
            media_type="audio/" + format,
            headers={
                "Content-Disposition": f'attachment; filename="sound-studio-{id}.{format}"'
            },
        )

    @app.get(API + "/samples/{id}/dependencies")
    async def dependencies(id: str, include_remote: bool = False):
        return store.dependencies(id) + (
            await asyncio.to_thread(remote.dependencies, id) if include_remote else []
        )

    @app.delete(API + "/samples/{id}")
    async def remove(id: str, scope: str = "local"):
        if scope in {"remote", "remote-purge"}:
            return await asyncio.to_thread(remote.delete, id, scope == "remote-purge")
        if scope == "evict":
            sample = store.get("samples", id)
            for f in sample["files"]:
                body = remote.s3().get_object(
                    Bucket=remote.bucket, Key=remote.object_key(f)
                )["Body"]
                try:
                    from packages.audio.models import digest

                    if digest(body.read()) != f["sha256"]:
                        raise ValueError("Remote checksum mismatch; eviction refused")
                finally:
                    body.close()
            return store.delete_local(id, evict=True)
        if scope != "local":
            raise ValueError("Choose local, remote, or evict")
        return store.delete_local(id)

    @app.post(API + "/jobs", status_code=202)
    def job(payload: JobRequest):
        return queue.submit(
            payload.operation, payload.payload, project_id=payload.project_id
        )

    @app.post(API + "/jobs/{id}/{action}")
    def job_action(id: str, action: str):
        return queue.action(id, action)

    @app.post(API + "/batches/plan")
    def plan(batch: Batch):
        return queue.batch_plan(batch)

    @app.post(API + "/batches", status_code=202)
    def batch(batch: Batch):
        return queue.batch_start(batch)

    @app.post(API + "/batches/{id}/{action}")
    def batch_action(id: str, action: str):
        batch = store.get("batches", id)
        updated = []
        for jid in batch["job_ids"]:
            try:
                updated.append(queue.action(jid, action))
            except ValueError:
                pass
        return updated

    @app.get(API + "/events")
    async def events(request: Request):
        async def stream():
            previous = ""
            while not await request.is_disconnected():
                value = json.dumps(
                    [
                        {
                            k: j.get(k)
                            for k in (
                                "id",
                                "operation",
                                "status",
                                "progress",
                                "error",
                                "result",
                                "batch_id",
                                "project_id",
                            )
                        }
                        for j in store.list("jobs")
                    ]
                )
                if value != previous:
                    yield "data: " + value + "\n\n"
                    previous = value
                else:
                    yield ": heartbeat\n\n"
                await asyncio.sleep(1)

        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.post(API + "/features")
    def features(payload: dict):
        source = Source.model_validate(payload["source"])
        return store.save(
            "features", analysis.validate_features(payload["track"], source)
        )

    @app.post(API + "/alignments/{id}")
    def alignment_update(id: str, payload: dict):
        s = store.get("samples", id)
        if payload.get("text_hash") != s["text_hash"]:
            raise ValueError("Alignment text is stale")
        words = payload.get("words", [])
        end = 0
        for w in words:
            if (
                not 0 <= w["start"] < w["end"] <= s["duration"] + 0.05
                or w["start"] < end
            ):
                raise ValueError("Word times must be ordered within the sample")
            end = w["start"]
        unmatched = analysis.attach_offsets(words, s["source"]["text"])
        return store.save(
            "alignments",
            dict(
                id=id,
                version=1,
                sample_id=id,
                text_hash=s["text_hash"],
                words=words,
                unmatched=unmatched,
                needs_review=bool(unmatched),
                method="manual anchors",
                created=now(),
            ),
        )

    @app.get(API + "/features/{track_id}/sample/{sample_id}")
    def timed_features(track_id: str, sample_id: str):
        return analysis.sentence_times(
            store.get("features", track_id), store.get("alignments", sample_id)
        )

    @app.get(API + "/storage")
    def storage():
        return {**store.stats(), "remote_available": remote.available}

    @app.post(API + "/storage/rebuild")
    def rebuild():
        return {"records": store.rebuild()}

    @app.get(API + "/storage/remote")
    async def remote_catalog():
        return await asyncio.to_thread(remote.catalog)

    dist = Path(__file__).parent / "dist"
    if dist.is_dir():
        app.mount(
            "/assets", StaticFiles(directory=dist / "assets"), name="sound-assets"
        )

        @app.get("/")
        def index():
            return FileResponse(dist / "index.html")

    return app
