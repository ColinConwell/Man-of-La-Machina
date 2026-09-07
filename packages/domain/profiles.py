"""Resolve human-authored beginnings to validated, stable message boundaries."""

from datetime import datetime
from packages.domain.models import Bundle, Profile


def resolve_profile(bundle: Bundle, profile: Profile | None = None) -> Profile:
    profile = profile or bundle.profile
    messages = sorted(bundle.messages, key=lambda m: m.ordinal)
    if not messages:
        raise ValueError("An experience needs at least one historical message")
    by_id = {m.id: m for m in messages}
    anchors = {a.id: a for a in bundle.anchors if a.enabled}
    ordered_anchors = sorted(
        anchors.values(),
        key=lambda a: (
            by_id[a.entry_message_id].ordinal if a.entry_message_id in by_id else -1
        ),
    )
    resolved = []
    for start in profile.start_options:
        entry = start.entry_message_id
        anchor = start.anchor_id
        if start.strategy in ("earliest", "visitor_selects"):
            # Visitor selection enters the complete navigator with every configured beginning visible.
            entry = messages[0].id
        elif start.strategy == "first_major_anchor":
            if not ordered_anchors:
                raise ValueError("No enabled major anchor is available")
            anchor = ordered_anchors[0].id
            entry = ordered_anchors[0].entry_message_id
        elif start.strategy == "anchor_id":
            anchor = anchor or start.id
            if anchor not in anchors:
                raise ValueError(f"Unknown beginning anchor: {anchor}")
            entry = anchors[anchor].entry_message_id
        elif start.strategy == "timestamp":
            if not start.timestamp:
                raise ValueError("A timestamp beginning needs a timestamp")
            datetime.fromisoformat(start.timestamp.replace("Z", "+00:00"))
            # Date/range sources cannot resolve an hour. Preserve their precision and choose
            # the first source boundary overlapping or following that calendar date.
            candidate = next(
                (
                    m
                    for m in messages
                    if (m.disclosed_end_at or m.recorded_at or m.disclosed_at or "")[
                        :10
                    ]
                    >= start.timestamp[:10]
                ),
                None,
            )
            if candidate is None:
                raise ValueError(
                    "The beginning timestamp is beyond the historical record"
                )
            entry = candidate.id
        if entry not in by_id:
            raise ValueError(f"Unknown beginning message: {entry}")
        if not anchor:
            anchor = next(
                (a.id for a in ordered_anchors if a.entry_message_id == entry), None
            )
        resolved.append(
            start.model_copy(update={"entry_message_id": entry, "anchor_id": anchor})
        )
    return profile.model_copy(update={"start_options": tuple(resolved)})
