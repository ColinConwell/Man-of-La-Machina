"""Local curator API. Single worker, ephemeral owned sessions, no transcript logging."""

from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from packages.domain.models import *
from apps.api.contracts import (
    DisplayMessage,
    ThreadPage,
    ThreadSummary,
    ExperienceResponse,
    Position,
    TimelineResponse,
    IntervalRequest,
    IntervalResponse,
    BranchResponse,
    GenerationStart,
)
from packages.domain.repository import ContentRepository
from packages.content.storage import load_private_bundle
from packages.content.aliases import AliasRewriter, load_aliases
from apps.api.limits import GenerationLimits
from packages.domain.context import build_context
from packages.domain.providers import (
    capabilities,
    get_provider,
    validate_settings,
    ProviderError,
    registry,
    request_payload,
)

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", override=False)


def now():
    return datetime.now(timezone.utc).isoformat()


def uid(prefix):
    return prefix + "-" + secrets.token_urlsafe(24)


class Sessions:
    def __init__(self, ttl):
        self.branches = {}
        self.jobs = {}
        self.ttl = ttl

    def remove(self, id):
        branch = self.branches.pop(id, None)
        if branch:
            for gid in branch["generation_ids"]:
                job = self.jobs.pop(gid, None)
                if job and job.get("task"):
                    if job["status"] in ("pending", "streaming"):
                        job["status"] = "cancelled"
                        job["error_category"] = "cancelled"
                        job["events"].append(
                            (
                                "failure",
                                {
                                    "category": "cancelled",
                                    "message": "Generation was cancelled.",
                                },
                            )
                        )
                    job["task"].cancel()

    def clean(self):
        for id, b in list(self.branches.items()):
            if time.time() > b["expires"]:
                self.remove(id)

    def owned(self, id, owner):
        self.clean()
        b = self.branches.get(id)
        if not b or b["owner"] != owner:
            raise HTTPException(404, "Branch not found or expired")
        return b

    def public(self, b):
        return {
            k: v
            for k, v in b.items()
            if k not in ("owner", "expires", "active", "requests")
        }


def create_app(
    bundle: Bundle | None = None,
    provider_factory=get_provider,
    aliases: AliasRewriter | None = None,
):
    @asynccontextmanager
    async def lifespan(app):
        async def sweep():
            while True:
                await asyncio.sleep(30)
                sessions.clean()

        task = asyncio.create_task(sweep())
        yield
        task.cancel()
        for id in list(sessions.branches):
            sessions.remove(id)

    repo = (
        ContentRepository(bundle)
        if bundle
        else ContentRepository(load_private_bundle())
        if os.getenv("MACHINA_CONTENT_BUCKET")
        else ContentRepository.load(
            os.getenv("MACHINA_BUNDLE", str(ROOT / "content/generated/bundle.json"))
        )
    )
    if not bundle and os.getenv("MACHINA_PROFILE"):
        configured = Profile.model_validate_json(
            Path(os.environ["MACHINA_PROFILE"]).read_text()
        )
        repo = ContentRepository(repo.bundle.model_copy(update={"profile": configured}))
    if (
        os.getenv("MACHINA_MODE", "curator") == "public"
        and repo.bundle.mode != "public"
    ):
        raise ValueError("Public mode requires an approved public bundle")
    hosted = os.getenv("MACHINA_DEPLOYMENT") == "hosted"
    aliases = aliases if aliases is not None else load_aliases(required=hosted)
    repo = ContentRepository(aliases.bundle(repo.bundle))
    sessions = Sessions(repo.bundle.profile.session_ttl_seconds)
    generation_limits = GenerationLimits(
        per_hour=int(os.getenv("MACHINA_LIVE_GENERATIONS_PER_HOUR", "60")),
        per_owner=int(os.getenv("MACHINA_SESSION_GENERATIONS_PER_HOUR", "20")),
    )
    allowed_hosts = ["localhost", "127.0.0.1", "[::1]", "testserver"]
    allowed_hosts.extend(
        h.strip()
        for h in os.getenv("MACHINA_ALLOWED_HOSTS", "").split(",")
        if h.strip()
    )
    if hosted and len(allowed_hosts) == 4:
        raise ValueError("Hosted mode requires explicit allowed hosts")
    app = FastAPI(
        title="Man of La Machina",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if hosted else "/docs",
        redoc_url=None if hosted else "/redoc",
        openapi_url=None if hosted else "/openapi.json",
    )
    app.state.repo = repo
    app.state.sessions = sessions
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts,
    )

    @app.middleware("http")
    async def session(request, call_next):
        # Reject browser cross-origin writes, including hostile pages targeting loopback.
        origin = request.headers.get("origin")
        if (
            request.method not in ("GET", "HEAD", "OPTIONS")
            and origin
            and urlparse(origin).netloc != request.headers.get("host")
        ):
            return JSONResponse(
                {"detail": "Cross-origin write rejected"}, status_code=403
            )
        owner = request.cookies.get("machina_session")
        fresh = not owner or len(owner) != 43
        if fresh:
            owner = secrets.token_urlsafe(32)
        request.state.owner = owner
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        if hosted:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        if fresh:
            response.set_cookie(
                "machina_session",
                owner,
                httponly=True,
                samesite="strict",
                secure=hosted,
            )
        return response

    @app.exception_handler(ValueError)
    async def invalid(request, exc):
        return JSONResponse({"detail": aliases.text(str(exc))}, status_code=422)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        # Validation errors must not reflect submitted names or private input.
        return JSONResponse({"detail": "Invalid request parameters"}, status_code=422)

    def display_message(m):
        label = (
            repo.bundle.profile.human_label
            if m.speaker == "human"
            else "Copilot / Mirrows"
            if m.speaker == "mirrows"
            else "Unresolved speaker"
        )
        return DisplayMessage(**m.model_dump(), speaker_label=label)

    def message(id):
        if id not in repo.messages:
            raise HTTPException(404, "Message not found")
        return repo.messages[id]

    def branch(id, request):
        return sessions.owned(id, request.state.owner)

    def job_record(j):
        return {k: v for k, v in j.items() if k not in ("task", "events", "branch_id")}

    api = "/api/v1"

    @app.api_route(api + "/health", methods=["GET", "HEAD"])
    def health():
        return {"status": "ok", "content_version": repo.bundle.content_version}

    @app.get(api + "/experience", response_model=ExperienceResponse)
    def experience():
        return dict(
            profile=repo.bundle.profile,
            content_version=repo.bundle.content_version,
            mode="hosted" if hosted else repo.bundle.mode,
            providers=capabilities(),
            counts={
                "threads": len(repo.bundle.threads),
                "messages": len(repo.bundle.messages),
                "anchors": len(repo.anchors),
                "review_items": len(repo.bundle.issues),
            },
            tags=[
                {"id": "practical", "label": "Practical details"},
                {"id": "intimate", "label": "Intimate disclosures"},
                {"id": "motifs", "label": "Recurring motifs"},
            ],
            available_summaries=sum(
                d.origin == "summary" for d in repo.bundle.documents
            ),
            available_documents=sum(
                d.origin == "document" for d in repo.bundle.documents
            ),
        )

    @app.get(api + "/threads", response_model=list[ThreadSummary])
    def threads():
        return [
            dict(
                **t.model_dump(),
                message_count=sum(m.thread_id == t.id for m in repo.bundle.messages),
                entry_message_id=next(
                    m.id for m in repo.bundle.messages if m.thread_id == t.id
                ),
            )
            for t in repo.bundle.threads
        ]

    @app.get(api + "/timeline", response_model=TimelineResponse)
    def timeline(
        granularity: str = "journey",
        from_: str | None = Query(None, alias="from"),
        to: str | None = None,
        thread_id: str | None = None,
    ):
        if granularity not in repo.bundle.profile.allowed_granularities:
            raise HTTPException(422, "Unknown granularity")
        return repo.timeline(granularity, from_, to, thread_id)

    @app.get(api + "/timeline/resolve", response_model=Position)
    def resolve(message_id: str):
        message(message_id)
        return repo.position(message_id)

    @app.get(api + "/anchors", response_model=list[Anchor])
    def anchors():
        return list(repo.anchors.values())

    @app.get(api + "/anchors/{id}", response_model=Anchor)
    def anchor(id: str):
        if id not in repo.anchors:
            raise HTTPException(404, "Anchor not found")
        return repo.anchors[id]

    @app.get(api + "/threads/{id}", response_model=ThreadPage)
    def thread(
        id: str,
        after: int | None = None,
        before: int | None = None,
        around: str | None = None,
        limit: int = Query(8, ge=1, le=40),
    ):
        if id not in repo.threads:
            raise HTTPException(404, "Thread not found")
        all_messages = [m for m in repo.bundle.messages if m.thread_id == id]
        if around:
            focus = message(around)
            if focus.thread_id != id:
                raise HTTPException(422, "Message belongs to another thread")
            start = max(0, focus.sequence - 1)
            items = all_messages[start : start + limit]
        elif before is not None:
            items = [m for m in all_messages if m.sequence < before][-limit:]
        else:
            items = [m for m in all_messages if after is None or m.sequence > after][
                :limit
            ]
        return dict(
            thread=repo.threads[id],
            messages=[display_message(m) for m in items],
            total=len(all_messages),
            has_before=bool(items and items[0].sequence > 0),
            has_after=bool(items and items[-1].sequence < len(all_messages) - 1),
        )

    @app.post(api + "/intervals/resolve", response_model=IntervalResponse)
    def interval(payload: IntervalRequest):
        a = message(payload.first_message_id)
        b = message(payload.last_message_id)
        if a.ordinal > b.ordinal:
            raise HTTPException(422, "Range is reversed")
        return dict(
            id=f"interval-{a.id}--{b.id}",
            first_message_id=a.id,
            last_message_id=b.id,
            count=b.ordinal - a.ordinal + 1,
            start_at=repo.span(a)[0],
            end_at=repo.span(b)[1],
        )

    @app.get(api + "/search")
    def search(q: str = Query(min_length=2, max_length=200)):
        return repo.search(q)

    @app.get(api + "/artifacts", response_model=list[Artifact])
    def artifacts(
        thread_id: str | None = None,
        message_id: str | None = None,
        anchor_id: str | None = None,
    ):
        return repo.artifacts(thread_id, message_id, anchor_id)

    @app.get(api + "/continuations/{id}", response_model=list[DisplayMessage])
    def continuation(
        id: str, limit: int = Query(4, ge=1, le=20), include_cutoff: bool = False
    ):
        m = message(id)
        return [
            display_message(x)
            for x in repo.bundle.messages
            if x.thread_id == m.thread_id
            and (
                x.sequence >= m.sequence if include_cutoff else x.sequence > m.sequence
            )
        ][:limit]

    @app.post(api + "/branches", status_code=201, response_model=BranchResponse)
    def create(payload: CreateBranch, request: Request):
        message(payload.entry_message_id)
        sessions.clean()
        if (
            hosted
            and sum(
                b["owner"] == request.state.owner for b in sessions.branches.values()
            )
            >= 5
        ):
            raise HTTPException(429, "Reset an existing branch before opening another.")
        if len(sessions.branches) >= 200:
            raise HTTPException(
                429, "Session capacity reached; reset a branch or wait for expiry"
            )
        id = uid("branch")
        b = dict(
            id=id,
            owner=request.state.owner,
            entry_message_id=payload.entry_message_id,
            context_mode=payload.context_mode,
            profile_id=repo.bundle.profile.id,
            profile_version=repo.bundle.profile.version,
            content_version=repo.bundle.content_version,
            created_at=now(),
            expires=time.time() + sessions.ttl,
            expires_at=datetime.fromtimestamp(
                time.time() + sessions.ttl, timezone.utc
            ).isoformat(),
            messages=[],
            generation_ids=[],
            active=None,
            requests={},
            persistence_policy="ephemeral",
        )
        sessions.branches[id] = b
        return sessions.public(b)

    @app.get(api + "/branches/{id}", response_model=BranchResponse)
    def get_branch(id: str, request: Request):
        return sessions.public(branch(id, request))

    @app.delete(api + "/branches/{id}")
    def delete(id: str, request: Request):
        branch(id, request)
        sessions.remove(id)
        return {"deleted": True}

    @app.post(api + "/branches/{id}/context/preview", response_model=Manifest)
    def preview(id: str, payload: PreviewRequest, request: Request):
        b = branch(id, request)
        validate_settings(payload.settings)
        if payload.options.context_mode != b["context_mode"]:
            raise HTTPException(
                422, "Context mode belongs to the branch; restart to change it"
            )
        return build_context(
            repo.bundle,
            b["entry_message_id"],
            payload.options,
            payload.settings,
            b["messages"],
            aliases.text(payload.text),
        )

    async def generate(b, j, provider, visitor):
        started = time.perf_counter()
        output = ""
        filtered = aliases.stream()

        def emit(text):
            nonlocal output
            if text:
                output += text
                j["events"].append(("delta", {"text": text}))

        try:
            j["status"] = "streaming"
            async for event in provider.stream(j["manifest"]):
                if event.type == "delta":
                    emit(filtered.feed(event.text))
                elif event.metadata:
                    j["provider_metadata"].update(aliases.tree(event.metadata))
            emit(filtered.feed("", final=True))
            model = BranchMessage(
                id=uid("generated"),
                sequence=len(b["messages"]) + 1,
                speaker="model",
                origin="generated",
                body=output,
                generation_id=j["id"],
                created_at=now(),
            )
            b["messages"].extend([visitor, model])
            j["status"] = "completed"
            j["output"] = output
            j["safety_outcome"] = (
                "not_evaluated_demo"
                if j["provider"] == "demo"
                else "no_structured_refusal_reported"
            )
            j["events"].append(
                (
                    "done",
                    {"message": model.model_dump(), "manifest_id": j["manifest"].id},
                )
            )
        except asyncio.CancelledError:
            emit(filtered.interrupt())
            already_cancelled = j["status"] == "cancelled"
            j["status"] = "cancelled"
            j["error_category"] = "cancelled"
            j["output"] = output
            if not already_cancelled:
                j["events"].append(
                    (
                        "failure",
                        {
                            "category": "cancelled",
                            "message": "Generation was cancelled.",
                        },
                    )
                )
        except Exception as exc:
            emit(filtered.interrupt())
            category = (
                exc.category if isinstance(exc, ProviderError) else "internal_error"
            )
            msg = (
                str(exc)
                if isinstance(exc, ProviderError)
                else "Generation failed. Retry or return to recorded history."
            )
            j["status"] = "refused" if category == "refusal" else "failed"
            j["error_category"] = category
            j["output"] = output
            j["safety_outcome"] = (
                "provider_refusal" if category == "refusal" else "unknown"
            )
            j["events"].append(
                ("failure", {"category": category, "message": aliases.text(msg)})
            )
        finally:
            b["active"] = None
            j["latency_ms"] = round((time.perf_counter() - started) * 1000)
            j["finished_at"] = now()

    @app.post(
        api + "/branches/{id}/messages", status_code=202, response_model=GenerationStart
    )
    async def submit(id: str, payload: SubmitRequest, request: Request):
        b = branch(id, request)
        fingerprint = digest(payload.model_dump())
        if payload.request_id in b["requests"]:
            old = b["requests"][payload.request_id]
            if old["fingerprint"] != fingerprint:
                raise HTTPException(409, "Request ID already used for different input")
            return old["response"]
        if b["active"]:
            raise HTTPException(409, "A generation is already running in this branch")
        if len(b["messages"]) // 2 >= repo.bundle.profile.branch_turn_limit:
            raise HTTPException(409, "Branch exchange limit reached; restart or export")
        if not payload.text.strip():
            raise HTTPException(422, "Write a human turn first")
        if payload.options.context_mode != b["context_mode"]:
            raise HTTPException(422, "Restart to change the context start mode")
        provider = provider_factory(payload.settings)
        manifest = build_context(
            repo.bundle,
            b["entry_message_id"],
            payload.options,
            payload.settings,
            b["messages"],
            aliases.text(payload.text),
        )
        if hosted:
            if (
                sum(
                    j["status"] in ("pending", "streaming")
                    for j in sessions.jobs.values()
                )
                >= 4
            ):
                raise HTTPException(
                    429, "The companion is busy. Please try again shortly."
                )
            if payload.settings.provider != "demo":
                generation_limits.admit(request.state.owner)
        gid = uid("generation")
        visitor = BranchMessage(
            id=uid("visitor"),
            sequence=len(b["messages"]),
            speaker="visitor",
            origin="visitor",
            body=aliases.text(payload.text.strip()),
            generation_id=gid,
            created_at=now(),
        )
        wire = (
            request_payload(manifest, registry()[payload.settings.provider])[1]
            if payload.settings.provider != "demo"
            else {"demo_manifest_hash": manifest.hash}
        )
        j = dict(
            id=gid,
            branch_id=id,
            provider=payload.settings.provider,
            model=payload.settings.model,
            status="pending",
            manifest=manifest,
            request_time=now(),
            parameters=payload.settings.model_dump(),
            policy_version=manifest.policy_version,
            provider_metadata={},
            output="",
            safety_outcome="pending",
            error_category=None,
            latency_ms=None,
            events=[],
            visitor=visitor,
            transport_version="adapters-v1",
            request_payload=wire,
            request_hash=digest(wire),
        )
        j["events"].append(
            (
                "receipt",
                {
                    "generation_id": gid,
                    "manifest_id": manifest.id,
                    "hash": manifest.hash,
                },
            )
        )
        sessions.jobs[gid] = j
        b["generation_ids"].append(gid)
        b["active"] = gid
        response = {
            "generation_id": gid,
            "manifest_id": manifest.id,
            "stream_url": api + f"/branches/{id}/generations/{gid}/stream",
            "visitor_text": visitor.body,
        }
        b["requests"][payload.request_id] = {
            "fingerprint": fingerprint,
            "response": response,
        }
        j["task"] = asyncio.create_task(generate(b, j, provider, visitor))
        return response

    @app.get(api + "/branches/{id}/generations/{gid}/stream")
    async def stream(id: str, gid: str, request: Request):
        b = branch(id, request)
        if gid not in b["generation_ids"]:
            raise HTTPException(404, "Generation not found")
        j = sessions.jobs[gid]
        try:
            start = max(0, int(request.headers.get("last-event-id", "-1")) + 1)
        except ValueError:
            start = 0

        async def events():
            index = start
            ticks = 0
            while True:
                while index < len(j["events"]):
                    kind, data = j["events"][index]
                    yield f"id: {index}\nevent: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                    index += 1
                if j["status"] in ("completed", "failed", "refused", "cancelled"):
                    break
                if await request.is_disconnected():
                    break
                await asyncio.sleep(0.1)
                ticks += 1
                if ticks % 100 == 0:
                    yield ": keepalive\n\n"

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )

    @app.get(api + "/context-manifests/{mid}", response_model=Manifest)
    def receipt(mid: str, request: Request):
        sessions.clean()
        for j in sessions.jobs.values():
            if (
                j["manifest"].id == mid
                and sessions.branches[j["branch_id"]]["owner"] == request.state.owner
            ):
                return j["manifest"]
        raise HTTPException(404, "Receipt not found or expired")

    @app.get(api + "/branches/{id}/export")
    def export(id: str, request: Request):
        b = branch(id, request)
        return dict(
            branch=sessions.public(b),
            generations=[job_record(sessions.jobs[gid]) for gid in b["generation_ids"]],
            notice="Visitor and generated material are counterfactual. Personal names use aliases. Context receipts describe the aliased material actually sent to the provider.",
        )

    @app.get(api + "/review")
    def review():
        if hosted:
            raise HTTPException(404, "Not found")
        return {
            "mode": repo.bundle.mode,
            "content_version": repo.bundle.content_version,
            "issues": repo.bundle.issues,
        }

    dist = ROOT / "apps/web/dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.api_route("/", methods=["GET", "HEAD"])
        def index():
            return FileResponse(dist / "index.html")

    return app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        create_app(),
        host=os.getenv("MACHINA_HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", os.getenv("MACHINA_PORT", "8000"))),
        access_log=False,
    )
