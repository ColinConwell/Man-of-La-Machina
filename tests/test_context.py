import pytest
from pydantic import ValidationError
from packages.domain.models import *
from packages.domain.context import build_context


def ctx(bundle, options=ContextOptions(), prior=None, text="My intervention"):
    return build_context(bundle, "m2", options, GenerationSettings(), prior or [], text)


def test_cutoff_and_late_disclosure(bundle):
    m = ctx(bundle, ContextOptions(include_documents=True))
    assert {i.id for i in m.items} == {
        "system-framing",
        "m0",
        "m1",
        "m2",
        "visitor-current",
    }
    assert all("future knowledge" not in i.body for i in m.items)


def test_same_day_document_requires_boundary(bundle):
    d = bundle.documents[0].model_copy(
        update={"disclosed_at": "2026-04-01", "disclosed_in_message_id": "m4"}
    )
    assert "late-doc" not in [
        i.id
        for i in ctx(
            bundle.model_copy(update={"documents": (d,)}),
            ContextOptions(include_documents=True),
        ).items
    ]


def test_mutation_deterministic_and_theme_independent(bundle):
    base = ctx(bundle)
    changed = ctx(bundle, ContextOptions(excluded_tags=("practical",)))
    assert base.hash != changed.hash
    assert (
        changed.hash == ctx(bundle, ContextOptions(excluded_tags=("practical",))).hash
    )
    themed = bundle.model_copy(
        update={
            "profile": bundle.profile.model_copy(
                update={"default_theme": "context-lab"}
            )
        }
    )
    assert base.hash == ctx(themed).hash


def test_protected_and_replacement(bundle):
    m = ctx(bundle, ContextOptions(excluded_ids=("m2",)))
    assert next(i for i in m.items if i.id == "m2").protected
    m = ctx(bundle, ContextOptions(replace_cutoff=True))
    assert "m2" not in [i.id for i in m.items]
    assert next(i for i in m.items if i.id == "m1").protected


def test_budget_drops_old_optional_preserves_local_and_branch(bundle):
    large = bundle.messages[0].model_copy(update={"body": "old " * 6000})
    b = bundle.model_copy(update={"messages": (large,) + bundle.messages[1:]})
    m = ctx(b)
    assert "m0" not in [i.id for i in m.items]
    assert [i.id for i in m.items][-2:] == ["m2", "visitor-current"]
    assert m.token_estimate <= m.max_input_tokens
    with pytest.raises(ValueError, match="budget"):
        ctx(b, text="a" * 20000)


def test_origins_are_immutable(bundle):
    with pytest.raises(ValidationError):
        bundle.messages[0].origin = "generated"
    with pytest.raises(ValidationError):
        HistoricalMessage.model_validate(
            {**bundle.messages[0].model_dump(), "origin": "generated"}
        )
    with pytest.raises(ValidationError):
        BranchMessage(
            id="v",
            sequence=0,
            speaker="visitor",
            origin="generated",
            body="x",
            generation_id="g",
            created_at="today",
        )


def test_summaries_cannot_reintroduce_withheld_content(bundle):
    d = bundle.documents[0].model_copy(
        update={
            "origin": "summary",
            "disclosed_at": "2026-04-01",
            "disclosed_in_message_id": "m0",
            "based_on_ids": ("m0",),
        }
    )
    b = bundle.model_copy(update={"documents": (d,)})
    assert "late-doc" in [
        i.id for i in ctx(b, ContextOptions(include_summaries=True)).items
    ]
    assert "late-doc" not in [
        i.id
        for i in ctx(
            b, ContextOptions(include_summaries=True, excluded_ids=("m0",))
        ).items
    ]


def test_prior_branch_order(bundle):
    prior = [
        BranchMessage(
            id="v",
            sequence=0,
            speaker="visitor",
            origin="visitor",
            body="first",
            generation_id="g",
            created_at="today",
        ),
        BranchMessage(
            id="g",
            sequence=1,
            speaker="model",
            origin="generated",
            body="reply",
            generation_id="g",
            created_at="today",
        ),
    ]
    assert [i.id for i in ctx(bundle, prior=prior).items][-3:] == [
        "v",
        "g",
        "visitor-current",
    ]
