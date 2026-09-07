"""Public HTTP representations; raw extraction text is never sent to the browser."""

from typing import Literal
from pydantic import Field
from packages.domain.models import (
    Frozen,
    HistoricalMessage,
    Thread,
    Anchor,
    Profile,
    BranchMessage,
)


class DisplayMessage(HistoricalMessage):
    raw_body: str = Field(exclude=True, repr=False)


class ThreadPage(Frozen):
    thread: Thread
    messages: tuple[DisplayMessage, ...]
    total: int
    has_before: bool
    has_after: bool


class ThreadSummary(Thread):
    message_count: int
    entry_message_id: str


class ProviderCapability(Frozen):
    id: str
    name: str
    adapter: str
    default_model: str
    available: bool


class ExperienceResponse(Frozen):
    profile: Profile
    content_version: str
    mode: str
    providers: tuple[ProviderCapability, ...]
    counts: dict[str, int]
    tags: tuple[dict[str, str], ...]
    available_summaries: int
    available_documents: int


class Position(Frozen):
    message_id: str
    thread_id: str
    sequence: int
    ordinal: int
    date: str | None
    end_at: str | None
    time_precision: str
    speaker: str
    granularities: tuple[str, ...]


class Cluster(Frozen):
    id: str
    label: str
    entry_message_id: str
    thread_id: str
    start_at: str | None
    end_at: str | None
    ordinal: int
    last_ordinal: int
    count: int
    artifact_count: int


class TimelineResponse(Frozen):
    granularity: str
    axis: Literal["ordinal", "calendar"]
    clusters: tuple[Cluster, ...]
    anchors: tuple[Anchor, ...]
    total_messages: int
    bounds: dict[str, str | None]


class IntervalRequest(Frozen):
    first_message_id: str
    last_message_id: str


class IntervalResponse(IntervalRequest):
    id: str
    count: int
    start_at: str | None
    end_at: str | None


class BranchResponse(Frozen):
    id: str
    entry_message_id: str
    context_mode: str
    profile_id: str
    profile_version: int
    content_version: str
    created_at: str
    expires_at: str
    messages: tuple[BranchMessage, ...]
    generation_ids: tuple[str, ...]
    persistence_policy: Literal["ephemeral"]


class GenerationStart(Frozen):
    generation_id: str
    manifest_id: str
    stream_url: str
