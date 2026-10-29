"""Owned, bounded, ephemeral message narration; no visitor text or audio on disk."""
from __future__ import annotations

import asyncio
from collections import deque
import hashlib
import os
import re
import secrets
import time
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

VOICES = ("cedar", "marin")
MODEL = "gpt-4o-mini-tts-2025-12-15"
INSTRUCTIONS = "Read the supplied text faithfully. Tone: clear and conversational. Pacing: steady and moderate."


class NarrationRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=200)
    branch_id: str | None = Field(default=None, max_length=200)
    voice: Literal["cedar", "marin"] = "cedar"


async def synthesize(text, voice, model):
    from openai import AsyncOpenAI
    async with AsyncOpenAI(timeout=90, max_retries=0) as client:
        result = await client.audio.speech.create(
            model=model, voice=voice, input=text,
            instructions=INSTRUCTIONS, response_format="mp3",
        )
        return result.content


def chunks(text, limit=3500):
    """Partition without dropping any text, preferring a sentence or word boundary."""
    while text:
        end = min(len(text), limit)
        if end < len(text):
            split = max(text.rfind(". ", 0, end), text.rfind("\n", 0, end))
            if split < end // 2:
                split = text.rfind(" ", 0, end)
            if split > 0:
                end = split + 1
        yield text[:end]
        text = text[end:]


class NarrationStore:
    def __init__(self, sessions, repo, synthesizer=None):
        self.sessions, self.repo = sessions, repo
        self.synthesizer = synthesizer or synthesize
        self.enabled = synthesizer is not None or (
            bool(os.getenv("OPENAI_API_KEY")) and os.getenv("MACHINA_TTS_ENABLED", "true").lower() == "true"
        )
        self.model = os.getenv("MACHINA_TTS_MODEL", MODEL)
        self.jobs = {}
        self.usage = deque()
        self.owner_budget = int(os.getenv("MACHINA_TTS_SESSION_CHARACTERS", "24000"))
        self.total_budget = int(os.getenv("MACHINA_TTS_HOURLY_CHARACTERS", "120000"))
        self.max_bytes = int(os.getenv("MACHINA_TTS_CACHE_BYTES", "67108864"))

    def remove(self, id):
        job = self.jobs.pop(id, None)
        if job and job.get("task") and not job["task"].done():
            job["task"].cancel()

    def clean(self):
        now = time.time()
        for id, job in list(self.jobs.items()):
            branch = self.sessions.branches.get(job["branch_id"]) if job["branch_id"] else None
            if job["expires"] <= now or (job["branch_id"] and (not branch or branch["expires"] <= now)):
                self.remove(id)
        while self.usage and self.usage[0][0] <= now - 3600:
            self.usage.popleft()

    def clear(self, owner=None):
        for id, job in list(self.jobs.items()):
            if owner is None or job["owner"] == owner:
                self.remove(id)

    def owned(self, id, owner):
        self.clean()
        job = self.jobs.get(id)
        if not job or job["owner"] != owner:
            raise HTTPException(404, "Audio not found or expired")
        return job

    def public(self, job):
        return {k: job[k] for k in ("id", "message_id", "voice", "status", "error", "characters", "text_hash", "model")} | {
            "parts": [f"/api/v1/narration/{job['id']}/audio/{i}" for i in range(len(job["audio"]))] if job["status"] == "ready" else [],
        }

    def start(self, payload, owner):
        self.clean()
        if not self.enabled:
            raise HTTPException(503, "Read Aloud is unavailable on this server.")
        expiry = time.time() + self.sessions.ttl
        if payload.branch_id:
            branch = self.sessions.owned(payload.branch_id, owner)
            message = next((m for m in branch["messages"] if m.id == payload.message_id), None)
            expiry = min(expiry, branch["expires"])
        else:
            message = next((m for m in self.repo.bundle.messages if m.id == payload.message_id), None)
        if message is None:
            raise HTTPException(404, "Message not found")
        text = message.body
        if not text.strip() or len(text) > 24000:
            raise HTTPException(422, "Read Aloud supports complete messages of 1–24,000 characters.")
        digest = hashlib.sha256(text.encode()).hexdigest()
        for job in self.jobs.values():
            if (job["owner"], job["message_id"], job["branch_id"], job["voice"], job["text_hash"]) == (owner, payload.message_id, payload.branch_id, payload.voice, digest) and job["status"] != "failed":
                return self.public(job)
        if len(self.jobs) >= 200 or sum(j["status"] == "generating" for j in self.jobs.values()) >= 3:
            raise HTTPException(429, "Read Aloud is busy. Please try again shortly.")
        if any(j["owner"] == owner and j["status"] == "generating" for j in self.jobs.values()):
            raise HTTPException(429, "Please wait for this session's current narration.")
        if sum(n for _, who, n in self.usage if who == owner) + len(text) > self.owner_budget or sum(n for _, _, n in self.usage) + len(text) > self.total_budget:
            raise HTTPException(429, "The hourly narration allowance is full. Please try again later.")
        if sum(sum(map(len, j["audio"])) for j in self.jobs.values()) >= self.max_bytes:
            raise HTTPException(429, "Audio storage is full. Delete saved audio or try again later.")
        self.usage.append((time.time(), owner, len(text)))
        id = "audio-" + secrets.token_urlsafe(24)
        job = dict(id=id, owner=owner, message_id=payload.message_id, branch_id=payload.branch_id,
                   voice=payload.voice, status="generating", error=None, characters=len(text),
                   text_hash=digest, model=self.model, expires=expiry, audio=[])
        self.jobs[id] = job
        job["task"] = asyncio.create_task(self.generate(job, text))
        return self.public(job)

    async def generate(self, job, text):
        try:
            for chunk in chunks(text):
                data = await self.synthesizer(chunk, job["voice"], self.model)
                if not data or len(data) > 12_000_000:
                    raise ValueError("Invalid audio response")
                if sum(sum(map(len, j["audio"])) for j in self.jobs.values()) + len(data) > self.max_bytes:
                    raise ValueError("Audio storage full")
                job["audio"].append(data)
            job["status"] = "ready"
        except asyncio.CancelledError:
            job["audio"].clear()
            raise
        except Exception:
            job["audio"].clear()
            job["status"] = "failed"
            job["error"] = "Narration failed. Please retry; the message has not changed."


def narration_router(store):
    router = APIRouter(prefix="/api/v1/narration")

    @router.get("/capabilities")
    def capabilities():
        return dict(available=store.enabled, voices=VOICES, model=store.model,
                    session_characters_per_hour=store.owner_budget, max_message_characters=24000,
                    retention_seconds=store.sessions.ttl)

    @router.post("", status_code=202)
    async def create(payload: NarrationRequest, request: Request):
        return store.start(payload, request.state.owner)

    @router.delete("")
    async def clear(request: Request):
        store.clear(request.state.owner)
        return {"deleted": True}

    @router.get("/{id}")
    def status(id: str, request: Request):
        return store.public(store.owned(id, request.state.owner))

    @router.get("/{id}/audio/{part}")
    def audio(id: str, part: int, request: Request):
        job = store.owned(id, request.state.owner)
        if job["status"] != "ready" or part < 0 or part >= len(job["audio"]):
            raise HTTPException(404, "Audio not ready or part unavailable")
        data = job["audio"][part]
        headers = {"Accept-Ranges": "bytes"}
        value = request.headers.get("range")
        if value:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", value)
            if not match or not any(match.groups()):
                return Response(status_code=416, headers={"Content-Range": f"bytes */{len(data)}"})
            first, last = match.groups()
            start = int(first) if first else max(0, len(data) - int(last))
            end = min(int(last), len(data) - 1) if first and last else len(data) - 1
            if start > end or start >= len(data):
                return Response(status_code=416, headers={"Content-Range": f"bytes */{len(data)}"})
            headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
            return Response(data[start:end + 1], status_code=206, media_type="audio/mpeg", headers=headers)
        return Response(data, media_type="audio/mpeg", headers=headers)

    return router
