import pytest
from packages.domain.models import StartOption
from packages.domain.profiles import resolve_profile
from packages.content.validation import assert_valid


def test_beginning_strategies_resolve_to_source_boundaries(bundle):
    starts = (
        StartOption(id="earliest", title="Earliest", strategy="earliest"),
        StartOption(id="anchor", title="Anchor", strategy="anchor_id", anchor_id="a"),
        StartOption(id="first", title="First", strategy="first_major_anchor"),
        StartOption(
            id="date",
            title="Date",
            strategy="timestamp",
            timestamp="2026-04-01T12:00:00",
        ),
        StartOption(id="visitor", title="Explore", strategy="visitor_selects"),
        StartOption(
            id="message",
            title="Boundary",
            entry_message_id="m4",
            context_mode="begin_context_here",
        ),
    )
    resolved = resolve_profile(
        bundle,
        bundle.profile.model_copy(
            update={"start_options": starts, "default_start": "earliest"}
        ),
    )
    assert [s.entry_message_id for s in resolved.start_options] == [
        "m0",
        "m0",
        "m0",
        "m0",
        "m0",
        "m4",
    ]
    assert resolved.start_options[-1].context_mode == "begin_context_here"
    assert resolved.start_options[1].anchor_id == "a"
    assert_valid(bundle.model_copy(update={"profile": resolved}))


def test_invalid_profile_fails_early(bundle):
    for start in (
        StartOption(id="bad", title="Bad", strategy="anchor_id", anchor_id="missing"),
        StartOption(
            id="bad", title="Bad", strategy="timestamp", timestamp="2040-01-01"
        ),
        StartOption(id="bad", title="Bad", entry_message_id="missing"),
    ):
        with pytest.raises(ValueError):
            resolve_profile(
                bundle, bundle.profile.model_copy(update={"start_options": (start,)})
            )
    with pytest.raises(ValueError):
        assert_valid(
            bundle.model_copy(
                update={
                    "profile": bundle.profile.model_copy(
                        update={"default_theme": "missing"}
                    )
                }
            )
        )
