"""Versioned Sound Studio contracts, independent of visitor narration sessions."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


def identity():
    return uuid.uuid4().hex


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    data = (
        value
        if isinstance(value, bytes)
        else json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    )
    return hashlib.sha256(data).hexdigest()


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    version: Literal[1] = 1


class Source(Contract):
    id: str = Field(default_factory=identity, max_length=300)
    title: str = Field(default="Untitled Passage", max_length=500)
    text: str = Field(default="", max_length=1_000_000)
    kind: str = "pasted"
    source_version: str = ""
    options: dict = Field(default_factory=dict)

    @property
    def text_hash(self):
        return digest(self.text)


class Generation(Contract):
    provider: Literal["openai", "elevenlabs", "cartesia", "gemini"] = "openai"
    model: str = Field(
        default="gpt-4o-mini-tts-2025-12-15", pattern=r"^[a-zA-Z0-9_.:/+-]{1,150}$"
    )
    voice: str = Field(default="cedar", min_length=1, max_length=150)
    settings: dict = Field(default_factory=dict)


class Point(Contract):
    time: float = Field(ge=0, le=86400)
    value: float
    sentence_id: str | None = None


class Automation(Contract):
    parameter: str = "amount"
    points: list[Point] = Field(default_factory=list, max_length=20000)
    interpolation: Literal["linear", "step"] = "linear"
    smoothing: float = Field(default=0.04, ge=0, le=10)
    feature: str | None = None
    feature_track_id: str | None = None
    depth: float = Field(default=1, ge=0, le=1)

    @model_validator(mode="after")
    def ordered(self):
        if any(a.time >= b.time for a, b in zip(self.points, self.points[1:])):
            raise ValueError("Automation times must be strictly increasing")
        return self


class Effect(Contract):
    id: str = Field(default_factory=identity)
    kind: str
    enabled: bool = True
    params: dict[str, float | str | bool] = Field(default_factory=dict)
    start: float = Field(default=0, ge=0, le=86400)
    end: float | None = Field(default=None, gt=0, le=86400)
    automation: list[Automation] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def bounds(self):
        if self.end is not None and self.end <= self.start:
            raise ValueError("Effect end must follow its start")
        return self


class Layer(Contract):
    id: str = Field(default_factory=identity)
    sample_id: str
    name: str = Field(default="Voice Layer", max_length=300)
    offset: float = Field(default=0, ge=0, le=86400)
    gain: float = Field(default=-6, ge=-60, le=12)
    pan: float = Field(default=0, ge=-1, le=1)
    mute: bool = False
    solo: bool = False
    fade_in: float = Field(default=0.02, ge=0, le=300)
    fade_out: float = Field(default=0.05, ge=0, le=300)
    effects: list[Effect] = Field(default_factory=list, max_length=32)
    automation: list[Automation] = Field(default_factory=list, max_length=10)


class Recipe(Contract):
    layers: list[Layer] = Field(default_factory=list, max_length=32)
    master_gain: float = Field(default=0, ge=-60, le=6)
    limiter: bool = True
    sample_rate: Literal[44100, 48000] = 48000
    tail: float = Field(default=2, ge=0, le=30)


class Project(Contract):
    id: str = Field(default_factory=identity, pattern=r"^[a-zA-Z0-9_-]{1,100}$")
    name: str = Field(default="Untitled Voice Study", min_length=1, max_length=300)
    revision: int = Field(default=0, ge=0)
    recipe: Recipe = Field(default_factory=Recipe)
    auto_upload: bool = False
    notes: str = Field(default="", max_length=20000)
    updated: str = Field(default_factory=now)


class Batch(Contract):
    sources: list[Source] = Field(default_factory=list, max_length=200)
    generations: list[Generation] = Field(default_factory=list, max_length=100)
    recipes: list[Recipe] = Field(default_factory=list, max_length=200)
    repeats: int = Field(default=1, ge=1, le=50)
    max_jobs: int = Field(default=100, ge=1, le=1000)
    max_characters: int = Field(default=100000, ge=1, le=5000000)
    project_id: str | None = None

    @model_validator(mode="after")
    def bounded(self):
        n = (
            len(self.sources) * len(self.generations) + len(self.recipes)
        ) * self.repeats
        chars = (
            sum(len(s.text) for s in self.sources)
            * len(self.generations)
            * self.repeats
        )
        if not n or n > self.max_jobs or chars > self.max_characters:
            raise ValueError("Batch is empty or exceeds its job/character limits")
        if any(not s.text.strip() for s in self.sources):
            raise ValueError("Generation input must contain text")
        return self
