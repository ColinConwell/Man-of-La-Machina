"""Backend entry-point catalog. Only selected public fields reach the experience.

Candidates contain message references, never copies of the source. Private notes
and local edits live in an ignored file or a server environment variable.
"""

from datetime import date
import os
from pathlib import Path
from pydantic import Field, model_validator
from packages.domain.models import Bundle, Frozen, StartOption, digest
from packages.domain.profiles import resolve_profile

ROOT = Path(__file__).resolve().parents[2]
LOCAL_CATALOG = ROOT / "content/curation/beginnings.local.json"
RAIN_NOTE = (
    "Begin with Copilot's advice, before the participant's logistical response. "
    "Write your own next turn to explore how the advice might develop. "
    "The recorded response and subsequent change in advice remain available in Compare."
)


class BeginningCandidate(Frozen):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    entry_message_id: str = Field(min_length=1, max_length=200)
    anchor_id: str | None = None
    selected: bool = False
    context_mode: str = "inherit_history"
    private_note: str = Field(default="", max_length=12000)


class BeginningCatalog(Frozen):
    version: int = 1
    default_start: str
    candidates: tuple[BeginningCandidate, ...] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def validate_catalog(self):
        ids = [c.id for c in self.candidates]
        if len(ids) != len(set(ids)):
            raise ValueError("Candidate IDs must be unique")
        if self.default_start not in {c.id for c in self.candidates if c.selected}:
            raise ValueError("The default beginning must be selected")
        if any(
            c.context_mode
            not in ("inherit_history", "begin_context_here", "curated_context")
            for c in self.candidates
        ):
            raise ValueError("Unknown context mode")
        anchors = [c.anchor_id for c in self.candidates if c.anchor_id]
        if len(anchors) != len(set(anchors)):
            raise ValueError("Each anchor may have only one candidate boundary")
        return self


def default_catalog(bundle: Bundle) -> BeginningCatalog:
    by_id = {m.id: m for m in bundle.messages}
    candidates = []
    for index, thread in enumerate(sorted(bundle.threads, key=lambda t: t.sequence)):
        messages = sorted(
            (m for m in bundle.messages if m.thread_id == thread.id),
            key=lambda m: m.sequence,
        )
        anchor = next(
            (
                a
                for a in bundle.anchors
                if by_id[a.entry_message_id].thread_id == thread.id and a.enabled
            ),
            None,
        )
        entry = by_id[anchor.entry_message_id] if anchor and index else messages[0]
        # The event opens on the companion's advice, before the human reply.
        if anchor and anchor.id == "rain-in-spain":
            entry = next(m for m in messages if m.sequence == 1)
            if entry.speaker != "mirrows":
                raise ValueError(
                    "Rain in Spain must begin on the companion's second recorded turn"
                )
        cid = "earliest" if index == 0 else anchor.id if anchor else thread.id
        day = date.fromisoformat(thread.start_at[:10]) if thread.start_at else None
        label = f"{day.strftime('%B')} {day.day}" if day else "Sequence only"
        title = "From the beginning" if index == 0 else thread.title
        description = (
            anchor.subtitle
            if anchor
            else "Explore this conversation from its opening turn."
        )
        if index == 0:
            description = "Follow the documented journey from its first conversation."
        elif cid == "rain-in-spain":
            description = "Begin with the companion's advice, before the reply that changes its direction."
        elif cid == "naming-mirrows":
            description = "A name gives the companion a new place in the conversation."
        candidates.append(
            BeginningCandidate(
                id=cid,
                title=f"{title} · {label}",
                description=description,
                entry_message_id=entry.id,
                anchor_id=anchor.id if anchor else None,
                selected=cid in ("earliest", "rain-in-spain", "naming-mirrows"),
            )
        )
    return BeginningCatalog(
        default_start="rain-in-spain"
        if any(c.id == "rain-in-spain" for c in candidates)
        else "earliest",
        candidates=tuple(candidates),
    )


def load_catalog(bundle: Bundle, path: Path = LOCAL_CATALOG) -> BeginningCatalog:
    if os.getenv("MACHINA_BEGINNINGS_JSON"):
        return BeginningCatalog.model_validate_json(
            os.environ["MACHINA_BEGINNINGS_JSON"]
        )
    if os.getenv("MACHINA_BEGINNINGS_FILE"):
        return BeginningCatalog.model_validate_json(
            Path(os.environ["MACHINA_BEGINNINGS_FILE"]).read_text()
        )
    return (
        BeginningCatalog.model_validate_json(path.read_text())
        if path.exists()
        else default_catalog(bundle)
    )


def apply_catalog(bundle: Bundle, catalog: BeginningCatalog) -> Bundle:
    by_id = {m.id: m for m in bundle.messages}
    anchors = {a.id: a for a in bundle.anchors}
    starts = []
    for c in catalog.candidates:
        if c.entry_message_id not in by_id:
            raise ValueError("Candidate references an unknown message")
        if c.anchor_id:
            if c.anchor_id not in anchors:
                raise ValueError("Candidate references an unknown anchor")
            anchor = anchors[c.anchor_id]
            if (
                by_id[anchor.entry_message_id].thread_id
                != by_id[c.entry_message_id].thread_id
            ):
                raise ValueError(
                    "Candidate boundary must belong to its anchor's conversation"
                )
            changes = {"entry_message_id": c.entry_message_id}
            if c.anchor_id == "rain-in-spain":
                changes["curatorial_note"] = RAIN_NOTE
            anchors[c.anchor_id] = anchor.model_copy(update=changes)
        if c.selected:
            starts.append(
                StartOption(
                    id=c.id,
                    title=c.title,
                    description=c.description,
                    entry_message_id=c.entry_message_id,
                    anchor_id=c.anchor_id,
                    strategy="message_id",
                    context_mode=c.context_mode,
                )
            )
    profile = bundle.profile.model_copy(
        update={"start_options": tuple(starts), "default_start": catalog.default_start}
    )
    result = bundle.model_copy(
        update={"anchors": tuple(anchors.values()), "profile": profile}
    )
    result = result.model_copy(update={"profile": resolve_profile(result)})
    if result == bundle:
        return bundle
    # Private annotations are deliberately absent from both projection and hash.
    version = digest(result.model_dump(exclude={"content_version"}))[:20]
    return result.model_copy(update={"content_version": version})
