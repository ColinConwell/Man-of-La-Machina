from collections import Counter
from datetime import date
from packages.domain.models import Bundle


def validate(bundle: Bundle) -> list[dict]:
    issues = []

    def add(code, id, severity="error"):
        issues.append({"code": code, "id": id, "severity": severity})

    mids = {m.id: m for m in bundle.messages}
    tids = {t.id for t in bundle.threads}
    sids = {s.id for s in bundle.sources}
    for kind, objects in [
        ("message", bundle.messages),
        ("thread", bundle.threads),
        ("anchor", bundle.anchors),
        ("source", bundle.sources),
    ]:
        for id, n in Counter(o.id for o in objects).items():
            if n > 1:
                add("duplicate-" + kind + "-id", id)
    for m in bundle.messages:
        if m.thread_id not in tids or m.provenance.source_id not in sids:
            add("dangling-message-reference", m.id)
        if m.speaker == "unknown":
            add("unknown-speaker", m.id, "review")
        if m.review_status != "reviewed" or m.visibility != "public":
            add("private-unreviewed-message", m.id, "review")
        for value in [m.disclosed_at, m.disclosed_end_at, m.recorded_at, m.occurred_at]:
            if value:
                try:
                    date.fromisoformat(value[:10])
                except ValueError:
                    add("invalid-date", m.id)
    for t in bundle.threads:
        seq = [m.sequence for m in bundle.messages if m.thread_id == t.id]
        if seq != list(range(len(seq))):
            add("message-sequence-gap", t.id)
        if t.end_at and t.start_at and t.end_at < t.start_at:
            add("reversed-date-range", t.id)
    if len({m.ordinal for m in bundle.messages}) != len(bundle.messages):
        add("overlapping-order", "messages")
    for a in bundle.anchors:
        if a.entry_message_id not in mids:
            add("dangling-anchor", a.id)
    for slug, n in Counter(a.slug for a in bundle.anchors).items():
        if n > 1:
            add("duplicate-slug", slug)
    starts = {s.id for s in bundle.profile.start_options}
    if len(starts) != len(bundle.profile.start_options):
        add("duplicate-start-id", bundle.profile.id)
    if bundle.profile.default_theme not in bundle.profile.enabled_themes:
        add("disabled-default-theme", bundle.profile.id)
    if set(bundle.profile.enabled_themes) - {
        "archive",
        "western-gothic",
        "context-lab",
    }:
        add("unknown-theme", bundle.profile.id)
    if not bundle.profile.allowed_granularities or set(
        bundle.profile.allowed_granularities
    ) - {"journey", "chapter", "week", "day", "thread", "exchange", "message"}:
        add("invalid-granularities", bundle.profile.id)
    if bundle.profile.default_start not in starts:
        add("dangling-default-start", bundle.profile.default_start)
    for s in bundle.profile.start_options:
        if s.entry_message_id not in mids:
            add("dangling-start", s.id)
    for d in bundle.documents:
        if not d.disclosed_at:
            add("missing-document-disclosure", d.id, "review")
        if set(d.based_on_ids) - mids.keys():
            add("dangling-summary-source", d.id)
        if d.disclosed_in_message_id and d.disclosed_in_message_id not in mids:
            add("dangling-disclosure", d.id)
    for a in bundle.artifacts:
        if not a.alt_text or not a.credits:
            add("artifact-accessibility-provenance", a.id)
        if set(a.thread_ids) - tids or set(a.message_ids) - mids.keys():
            add("dangling-artifact-link", a.id)
        if a.kind in ("audio", "video") and not a.transcript:
            add("missing-transcript", a.id, "review")
        if a.rights_status not in ("approved", "original"):
            add("artifact-rights-unreviewed", a.id, "review")
    for h, n in Counter(m.content_hash for m in bundle.messages).items():
        if n > 1:
            add("duplicate-content", h, "review")
    if bundle.mode == "public":
        for m in bundle.messages:
            if m.review_status != "reviewed" or m.visibility != "public":
                add("public-content-not-approved", m.id)
        for d in bundle.documents:
            if d.review_status != "reviewed" or d.visibility != "public":
                add("public-document-not-approved", d.id)
        for a in bundle.artifacts:
            if (
                a.review_status != "reviewed"
                or a.default_visibility != "public"
                or a.rights_status not in ("approved", "original")
            ):
                add("public-artifact-not-approved", a.id)
    return issues


def assert_valid(bundle: Bundle):
    errors = [i for i in validate(bundle) if i["severity"] == "error"]
    if errors:
        raise ValueError(f"Invalid content bundle: {errors[:8]}")
