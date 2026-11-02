"""Single-worker durable queue; interrupted paid requests are never replayed implicitly."""

from __future__ import annotations
import asyncio
import os
import threading
import numpy as np
from packages.audio.models import Source, Generation, Recipe, identity, now
from packages.audio import providers, dsp, analysis
from packages.audio.effects import validate_recipe


class Queue:
    def __init__(self, store, remote, fixture=False):
        self.store = store
        self.remote = remote
        self.fixture = fixture
        self.wake = asyncio.Event()
        self.task = None
        self.cancel_events = {}
        for job in store.list("jobs"):
            if job["status"] in {"running", "queued"}:
                job.update(
                    status="interrupted",
                    error="Interrupted by restart. Review and explicitly retry; a provider request may have been billed.",
                )
                store.save("jobs", job)

    def start(self):
        self.task = asyncio.create_task(self.loop())

    async def close(self):
        for event in self.cancel_events.values():
            event.set()
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    def submit(self, operation, payload, batch_id=None, project_id=None):
        if operation == "generate":
            Source.model_validate(payload["source"])
            providers.validate(Generation.model_validate(payload["generation"]))
        elif operation == "render":
            validate_recipe(Recipe.model_validate(payload["recipe"]))
        elif operation not in {"analyze", "align", "warp", "upload", "download"}:
            raise ValueError("Unknown operation")
        if (
            len(
                [
                    j
                    for j in self.store.list("jobs")
                    if j["status"] in {"queued", "running", "paused"}
                ]
            )
            >= 1000
        ):
            raise ValueError("Queue is full")
        job = dict(
            id=identity(),
            version=1,
            created=now(),
            operation=operation,
            payload=payload,
            status="queued",
            progress=0,
            error=None,
            result=None,
            batch_id=batch_id,
            project_id=project_id,
            parts=[],
        )
        self.store.save("jobs", job)
        self.wake.set()
        return job

    def batch_plan(self, batch):
        jobs = []
        characters = 0
        requests = 0
        for recipe in batch.recipes:
            validate_recipe(recipe)
        for repeat in range(batch.repeats):
            for source in batch.sources:
                for spec in batch.generations:
                    providers.validate(spec)
                    count = len(
                        list(
                            providers.chunks(
                                source.text, providers.REGISTRY[spec.provider]["limit"]
                            )
                        )
                    )
                    jobs.append(
                        dict(
                            operation="generate",
                            title=source.title,
                            provider=spec.provider,
                            model=spec.model,
                            voice=spec.voice,
                            take=repeat + 1,
                            characters=len(source.text),
                            requests=count,
                        )
                    )
                    characters += len(source.text)
                    requests += count
            jobs.extend(
                dict(
                    operation="render",
                    title=f"Effect Recipe {i + 1}",
                    take=repeat + 1,
                    characters=0,
                    requests=0,
                )
                for i in range(len(batch.recipes))
            )
        # Rates are explicit local configuration, not invented provider prices.
        rates = {}
        try:
            rates = __import__("json").loads(
                os.getenv("MACHINA_SOUND_PRICES_PER_MILLION_CHARACTERS", "{}")
            )
        except ValueError:
            pass
        cost = sum(
            j["characters"] * rates.get(j.get("provider"), 0) / 1e6 for j in jobs
        )
        known = all(
            j.get("provider") in rates for j in jobs if j["operation"] == "generate"
        )
        return dict(
            jobs=jobs,
            characters=characters,
            requests=requests,
            estimated_cost=cost if known else None,
            cost_note="Configured estimate; actual billing depends on provider usage."
            if known
            else "Not available: set per-provider rates to estimate cost. Character/request limits still apply.",
        )

    def batch_start(self, batch):
        plan = self.batch_plan(batch)
        bid = identity()
        if (
            sum(
                j["status"] in {"queued", "running", "paused"}
                for j in self.store.list("jobs")
            )
            + len(plan["jobs"])
            > 1000
        ):
            raise ValueError("Queue capacity exceeded")
        record = dict(
            id=bid,
            version=1,
            created=now(),
            plan=plan,
            spec=batch.model_dump(),
            job_ids=[],
        )
        for _ in range(batch.repeats):
            for source in batch.sources:
                for spec in batch.generations:
                    j = self.submit(
                        "generate",
                        dict(source=source.model_dump(), generation=spec.model_dump()),
                        bid,
                        batch.project_id,
                    )
                    record["job_ids"].append(j["id"])
            for recipe in batch.recipes:
                j = self.submit(
                    "render", dict(recipe=recipe.model_dump()), bid, batch.project_id
                )
                record["job_ids"].append(j["id"])
        return self.store.save("batches", record)

    def action(self, id, action):
        job = self.store.get("jobs", id)
        if action == "pause" and job["status"] == "queued":
            job["status"] = "paused"
        elif action == "resume" and job["status"] == "paused":
            job["status"] = "queued"
        elif action == "cancel" and job["status"] in {"queued", "running", "paused"}:
            job["status"] = "cancelled"
            if id in self.cancel_events:
                self.cancel_events[id].set()
        elif action == "retry" and job["status"] in {
            "failed",
            "interrupted",
            "cancelled",
        }:
            if id in self.cancel_events:
                raise ValueError(
                    "Wait for the cancelled request to finish before retrying"
                )
            job.update(status="complete" if job.get("result") else "queued", error=None)
        else:
            raise ValueError("This action does not apply to the current job state")
        self.store.save("jobs", job)
        self.wake.set()
        return job

    def update(self, id, **values):
        with self.store.lock:
            current = self.store.get("jobs", id)
            if current["status"] == "cancelled":
                values = {k: v for k, v in values.items() if k in {"parts", "result"}}
                if not values:
                    return current
            return self.store.save("jobs", {**current, **values})

    async def loop(self):
        while True:
            pending = [
                j for j in reversed(self.store.list("jobs")) if j["status"] == "queued"
            ]
            if not pending:
                self.wake.clear()
                await self.wake.wait()
                continue
            job = pending[0]
            event = threading.Event()
            self.cancel_events[job["id"]] = event
            self.update(job["id"], status="running", started=now())
            try:
                result = await self.execute(job, event)
                if event.is_set():
                    self.update(job["id"], result=result)
                    continue
                self.update(
                    job["id"],
                    status="complete",
                    progress=1,
                    result=result,
                    finished=now(),
                )
                if job.get("project_id") and job["operation"] in {
                    "generate",
                    "render",
                    "warp",
                }:
                    project = self.store.get("projects", job["project_id"])
                    if project["auto_upload"]:
                        self.submit("upload", dict(kind="samples", id=result["id"]))
            except asyncio.CancelledError:
                self.update(
                    job["id"],
                    status="interrupted",
                    error="Interrupted; review before retrying a possibly billed request.",
                )
                raise
            except Exception as error:
                # Only application-controlled ValueError messages are exposed; never provider bodies or paths.
                message = (
                    str(error)
                    if isinstance(error, ValueError)
                    and not isinstance(error, __import__("pydantic").ValidationError)
                    else f"{job['operation'].title()} failed ({type(error).__name__}). Originals are unchanged."
                )
                self.update(job["id"], status="failed", error=message[:400])
            finally:
                self.cancel_events.pop(job["id"], None)

    async def execute(self, job, event):
        op = job["operation"]
        p = job["payload"]
        if op == "generate":
            source = Source.model_validate(p["source"])
            spec = Generation.model_validate(p["generation"])
            parts = list(
                providers.chunks(
                    source.text, providers.REGISTRY[spec.provider]["limit"]
                )
            )
            if not source.text.strip():
                raise ValueError("Supply text before generation")
            completed = list(job.get("parts", []))
            arrays = []
            original_files = []
            timings = []
            receipts = []
            seconds = 0
            for i, (start, text) in enumerate(parts):
                if event.is_set():
                    raise InterruptedError()
                if i < len(completed):
                    part = completed[i]
                    audio, rate = __import__("soundfile").read(
                        self.store.path(part["audio"]), dtype="float32", always_2d=True
                    )
                else:
                    if self.fixture:
                        audio = np.repeat(
                            (
                                0.12
                                * np.sin(np.arange(48000 * 3) * 2 * np.pi * 220 / 48000)
                            )[:, None],
                            2,
                            axis=1,
                        ).astype(np.float32)
                        response = providers.Speech(
                            dsp.wav(audio),
                            receipt={
                                "kind": "fixture-tone",
                                "provider": spec.provider,
                                "model": spec.model,
                            },
                        )
                    else:
                        response = await providers.synthesize(
                            spec,
                            providers.chunk_request_text(
                                spec, source.text, start, text
                            ),
                        )
                    audio, rate = await asyncio.to_thread(
                        dsp.decode, response.audio, response.extension
                    )
                    part = dict(
                        audio=self.store.blob(dsp.wav(audio), "wav", "part"),
                        original=self.store.blob(
                            response.audio, response.extension, "original"
                        ),
                        receipt=response.receipt,
                        timing=response.timing,
                        text_offset=start,
                        text_length=len(text),
                    )
                    completed.append(part)
                    self.update(
                        job["id"], parts=completed, progress=(i + 1) / len(parts) * 0.95
                    )
                arrays.append(audio)
                original_files.append(part["original"])
                timings.append(
                    dict(text_offset=start, audio_offset=seconds, timing=part["timing"])
                )
                seconds += len(audio) / 48000
                receipts.append(part["receipt"])
            result = await asyncio.to_thread(
                dsp.save_sample,
                self.store,
                source.title
                + " · "
                + providers.REGISTRY[spec.provider]["name"]
                + (
                    " / " + spec.voice
                    if spec.voice in providers.REGISTRY[spec.provider]["voices"]
                    else ""
                ),
                source,
                np.concatenate(arrays),
                48000,
                None,
                "wav",
                dict(
                    kind="generation",
                    spec=spec.model_dump(),
                    requests=receipts,
                    job_id=job["id"],
                ),
                dict(parts=timings),
            )
            result["files"].extend(original_files)
            self.store.save("samples", result)
            return {"id": result["id"], "kind": "samples"}
        if op == "render":
            result = await asyncio.to_thread(
                dsp.render,
                self.store,
                Recipe.model_validate(p["recipe"]),
                lambda progress: self.update(job["id"], progress=progress),
                event.is_set,
            )
            return {"id": result["id"], "kind": "samples"}
        if op == "analyze":
            source = Source.model_validate(p["source"])
            result = (
                await analysis.model_features(source, **p.get("model_options", {}))
                if p.get("method") == "model"
                else await asyncio.to_thread(analysis.local_features, source)
            )
            self.store.save("features", result)
            return {"id": result["id"], "kind": "features"}
        if op == "align":
            result = await asyncio.to_thread(
                analysis.align, self.store, p["sample_id"], p.get("language", "en")
            )
            return {"id": result["id"], "kind": "alignments"}
        if op == "warp":
            result = await asyncio.to_thread(
                analysis.align_to_reference,
                self.store,
                p["sample_id"],
                p["reference_id"],
                p.get("anchors"),
            )
            return {"id": result["id"], "kind": "samples"}
        if op == "upload":
            return await asyncio.to_thread(self.remote.upload, p["kind"], p["id"])
        if op == "download":
            result = await asyncio.to_thread(self.remote.download, p["key"])
            return {"id": result["id"]}
