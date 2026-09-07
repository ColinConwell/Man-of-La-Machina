"""Read-only queries over a validated, immutable content version."""

from datetime import date, timedelta
from pathlib import Path
from packages.domain.models import Bundle
from packages.domain.profiles import resolve_profile
from packages.content.validation import assert_valid


class ContentRepository:
    def __init__(self, bundle: Bundle):
        bundle = bundle.model_copy(update={"profile": resolve_profile(bundle)})
        assert_valid(bundle)
        self.bundle = bundle
        self.messages = {m.id: m for m in bundle.messages}
        self.threads = {t.id: t for t in bundle.threads}
        self.anchors = {a.id: a for a in bundle.anchors if a.enabled}
        self.exchange = {}
        for t in bundle.threads:
            index = -1
            for m in bundle.messages:
                if m.thread_id != t.id:
                    continue
                if m.speaker == "human" or index < 0:
                    index += 1
                self.exchange[m.id] = index

    @classmethod
    def load(cls, path):
        return cls(Bundle.model_validate_json(Path(path).read_text()))

    def span(self, m):
        t = self.threads[m.thread_id]
        return (
            m.recorded_at or m.disclosed_at or t.start_at,
            m.disclosed_end_at
            or m.recorded_at
            or m.disclosed_at
            or t.end_at
            or t.start_at,
        )

    def position(self, id):
        m = self.messages[id]
        return dict(
            message_id=m.id,
            thread_id=m.thread_id,
            sequence=m.sequence,
            ordinal=m.ordinal,
            date=self.span(m)[0],
            end_at=self.span(m)[1],
            time_precision=m.time_precision,
            speaker=m.speaker,
            granularities=self.bundle.profile.allowed_granularities,
        )

    def timeline(self, granularity="journey", start=None, end=None, thread_id=None):
        if start:
            date.fromisoformat(start)
        if end:
            date.fromisoformat(end)
        if start and end and start > end:
            raise ValueError("The date range is reversed")
        if thread_id and thread_id not in self.threads:
            raise ValueError("Unknown thread")
        messages = [
            m
            for m in self.bundle.messages
            if (not start or (self.span(m)[1] and self.span(m)[1] >= start))
            and (not end or (self.span(m)[0] and self.span(m)[0] <= end))
        ]
        if granularity in ("thread", "exchange", "message") and thread_id:
            messages = [m for m in messages if m.thread_id == thread_id]
        groups = {}
        for m in messages:
            dated = self.span(m)[0]
            if granularity in ("journey", "thread"):
                key = m.thread_id
            elif granularity == "chapter":
                key = (dated or "unknown")[:7]
            elif granularity == "week":
                d = date.fromisoformat(dated[:10]) if dated else None
                key = (d - timedelta(days=d.weekday())).isoformat() if d else "unknown"
            elif granularity == "day":
                key = dated or "unknown"
            elif granularity == "exchange":
                key = f"{m.thread_id}-exchange-{self.exchange[m.id]}"
            else:
                key = m.id
            groups.setdefault(key, []).append(m)
        clusters = []
        for id, ms in groups.items():
            first = ms[0]
            t = self.threads[first.thread_id]
            label = (
                t.title
                if granularity in ("journey", "thread")
                else f"Turn {first.sequence + 1} · {self.bundle.profile.human_label if first.speaker == 'human' else first.speaker}"
                if granularity == "message"
                else f"Exchange {self.exchange[first.id] + 1}"
                if granularity == "exchange"
                else id
            )
            clusters.append(
                dict(
                    id=id,
                    label=label,
                    entry_message_id=first.id,
                    thread_id=first.thread_id,
                    start_at=self.span(first)[0],
                    end_at=self.span(ms[-1])[1],
                    ordinal=first.ordinal,
                    last_ordinal=ms[-1].ordinal,
                    count=len(ms),
                    artifact_count=sum(
                        bool(set(a.thread_ids) & {m.thread_id for m in ms})
                        or bool(set(a.message_ids) & {m.id for m in ms})
                        for a in self.bundle.artifacts
                    ),
                )
            )
        anchors = [
            a.model_dump()
            for a in self.anchors.values()
            if (not start or (a.start_at and a.start_at >= start))
            and (not end or (a.start_at and a.start_at <= end))
        ]
        return dict(
            granularity=granularity,
            axis="ordinal"
            if granularity in ("thread", "exchange", "message")
            else "calendar",
            clusters=clusters,
            anchors=anchors,
            total_messages=len(messages),
            bounds=dict(
                start=self.span(self.bundle.messages[0])[0],
                end=self.span(self.bundle.messages[-1])[1],
            ),
        )

    def search(self, q, limit=30):
        # Literal matching is safe for all query syntax; normalized bundle remains authoritative.
        needle = q.casefold()
        results = []
        for m in self.bundle.messages:
            at = m.body.casefold().find(needle)
            if at >= 0:
                results.append(
                    dict(
                        message_id=m.id,
                        thread_id=m.thread_id,
                        title=self.threads[m.thread_id].title,
                        sequence=m.sequence,
                        speaker=m.speaker,
                        snippet=m.body[max(0, at - 65) : at + 150],
                        date=self.span(m)[0],
                    )
                )
                if len(results) >= limit:
                    break
        return results

    def artifacts(self, thread_id=None, message_id=None, anchor_id=None):
        return [
            a
            for a in self.bundle.artifacts
            if (
                not any((thread_id, message_id, anchor_id))
                or (thread_id and thread_id in a.thread_ids)
                or (message_id and message_id in a.message_ids)
                or (anchor_id and anchor_id in a.anchor_ids)
            )
        ]
