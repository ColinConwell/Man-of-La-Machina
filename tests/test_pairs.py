"""Paired-context comparison: one visitor turn, two receipts, one exchange."""

import asyncio
import itertools
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.limits import GenerationLimits
from packages.domain.context import (
    build_context,
    compare_contexts,
    tokens,
    withheld_options,
)
from packages.domain.models import (
    ContextOptions,
    GenerationSettings,
    PairWithholding,
)
from packages.domain.providers import ProviderError, ProviderEvent
from tests.test_api import Stub, make_branch, submit

TEXT = "An invented paired intervention."


def pair(c, id, request_id="pair-request-1", tags=("practical",), ids=(), **extra):
    return c.post(
        f"/api/v1/branches/{id}/pairs",
        json={
            "text": TEXT,
            "request_id": request_id,
            "withheld": {"excluded_tags": list(tags), "excluded_ids": list(ids)},
            **extra,
        },
    )


def drain(c, run):
    return {s["label"]: c.get(s["stream_url"]).text for s in run["conditions"]}


def test_pair_holds_turn_fixed_and_varies_only_withheld_context(bundle):
    with TestClient(create_app(bundle, lambda s: Stub())) as c:
        id = make_branch(c)
        r = pair(c, id)
        assert r.status_code == 202
        run = r.json()
        assert [s["label"] for s in run["conditions"]] == ["A", "B"]
        streams = drain(c, run)
        assert all("event: done" in s for s in streams.values())
        a, b = (
            c.get("/api/v1/context-manifests/" + s["manifest_id"]).json()
            for s in run["conditions"]
        )
        # Same visitor turn, settings and prior branch; only the withheld group differs.
        turn = lambda m: {k: v for k, v in m["items"][-1].items() if k != "position"}
        assert turn(a) == turn(b) and turn(a)["origin"] == "visitor"
        assert a["settings"] == b["settings"]
        assert a["options"]["excluded_tags"] == []
        assert b["options"]["excluded_tags"] == ["practical"]
        assert "m0" in [i["id"] for i in a["items"]]
        assert "m0" not in [i["id"] for i in b["items"]]
        assert a["hash"] != b["hash"]

        branch = c.get("/api/v1/branches/" + id).json()
        assert branch["messages"] == []  # pairs sit beside the linear branch
        assert branch["exchange_count"] == 1
        (p,) = branch["pairs"]
        assert p["visitor"]["origin"] == "visitor" and p["visitor"]["body"] == TEXT
        assert [c_["status"] for c_ in p["conditions"]] == ["completed", "completed"]
        assert all(c_["reply"]["origin"] == "generated" for c_ in p["conditions"])
        assert [c_["composition"]["hash"] for c_ in p["conditions"]] == [
            a["hash"],
            b["hash"],
        ]
        assert p["difference"]["removed"] == [
            {
                "id": "m0",
                "origin": "historical",
                "tags": ["practical"],
                "reason": "visitor withheld",
            }
        ]
        assert p["difference"]["added"] == []
        assert p["conditions"][0]["composition"]["counts"]["historical"] == 3
        assert p["conditions"][1]["composition"]["counts"]["historical"] == 2

        assert pair(c, id).json() == run  # idempotent replay issues no new calls
        export = c.get(f"/api/v1/branches/{id}/export").json()
        assert [g["condition"] for g in export["generations"]] == ["A", "B"]
        assert {g["pair_id"] for g in export["generations"]} == {run["pair_id"]}
        assert export["branch"]["pairs"][0]["id"] == run["pair_id"]

        # A later single turn still builds on the linear branch, not on a pair reply.
        follow = submit(c, id, "after-pair").json()
        c.get(follow["stream_url"])
        later = c.get("/api/v1/context-manifests/" + follow["manifest_id"]).json()
        assert [i["origin"] for i in later["items"]].count("generated") == 0
        assert c.get("/api/v1/branches/" + id).json()["exchange_count"] == 2
        assert c.delete("/api/v1/branches/" + id).status_code == 200
        for s in run["conditions"]:
            assert (
                c.get("/api/v1/context-manifests/" + s["manifest_id"]).status_code
                == 404
            )


def test_demo_pair_needs_no_model_calls_and_replies_differ(bundle):
    with TestClient(create_app(bundle)) as c:
        id = make_branch(c)
        run = pair(c, id).json()
        drain(c, run)
        a, b = c.get("/api/v1/branches/" + id).json()["pairs"][0]["conditions"]
        assert "practical details" in a["reply"]["body"]
        assert "less of the earlier detail" in b["reply"]["body"]
        export = c.get(f"/api/v1/branches/{id}/export").json()
        assert all(g["provider"] == "demo" for g in export["generations"])


def test_pair_must_remove_something_from_condition_a(bundle):
    with TestClient(create_app(bundle, lambda s: Stub())) as c:
        id = make_branch(c)
        # No message carries this tag, and the protected local turn cannot be withheld.
        assert pair(c, id, "request-none", tags=("motifs",)).status_code == 422
        assert pair(c, id, "request-protected", tags=(), ids=("m2",)).status_code == 422
        # Already withheld in A: B would be identical.
        already = pair(c, id, "request-same", options={"excluded_tags": ["practical"]})
        assert already.status_code == 422
        assert "withholds nothing" in already.json()["detail"]
        assert pair(c, id, "request-ids", tags=(), ids=("m1",)).status_code == 202
        b = c.get("/api/v1/branches/" + id).json()
        assert len(b["pairs"]) == 1 and b["pairs"][0]["withheld"]["excluded_ids"] == [
            "m1"
        ]


def test_pair_counts_as_one_exchange_toward_the_cap(bundle):
    with TestClient(create_app(bundle, lambda s: Stub())) as c:
        id = make_branch(c)
        for i in range(4):
            c.get(submit(c, id, f"request-{i}").json()["stream_url"])
        drain(c, pair(c, id).json())
        assert c.get("/api/v1/branches/" + id).json()["exchange_count"] == 5
        assert submit(c, id, "request-over").status_code == 409
        assert pair(c, id, "pair-over").status_code == 409


def test_partial_pair_failure_stays_distinct(bundle):
    class Refusal:
        async def stream(self, m):
            yield ProviderEvent("delta", "Partial")
            raise ProviderError("refusal", "Present provider refusal.")

    made = itertools.chain([Stub(), Refusal()], itertools.repeat(Stub()))
    with TestClient(create_app(bundle, lambda s: next(made))) as c:
        id = make_branch(c)
        streams = drain(c, pair(c, id).json())
        assert "event: done" in streams["A"]
        assert "event: failure" in streams["B"] and "event: done" not in streams["B"]
        b = c.get("/api/v1/branches/" + id).json()
        a_, b_ = b["pairs"][0]["conditions"]
        assert a_["status"] == "completed" and a_["reply"]
        assert b_["status"] == "refused" and b_["reply"] is None
        assert b_["error_category"] == "refusal"
        assert b["exchange_count"] == 1
        # The branch is free again once both conditions finish.
        assert submit(c, id, "after-partial").status_code == 202


def test_running_pair_blocks_other_submissions_and_reset_cancels(bundle):
    class Slow:
        async def stream(self, m):
            yield ProviderEvent("delta", "Starting")
            await asyncio.sleep(5)

    app = create_app(bundle, lambda s: Slow())
    with TestClient(app) as c:
        id = make_branch(c)
        assert pair(c, id).status_code == 202
        assert submit(c, id, "other-request").status_code == 409
        assert pair(c, id, "other-pair").status_code == 409
        assert len(app.state.sessions.jobs) == 2
        assert c.delete("/api/v1/branches/" + id).status_code == 200
        assert not app.state.sessions.jobs


def test_live_pair_admits_both_generations_or_neither():
    limits = GenerationLimits(per_hour=3, per_owner=3, clock=lambda: 0)
    limits.admit("owner", 2)
    try:
        limits.admit("owner", 2)
        raise AssertionError("expected the pair to be refused")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
    assert len(limits.attempts) == 2
    limits.admit("owner")


def test_withholding_can_free_budget_for_older_items(bundle):
    policy = bundle.profile.policy
    visitor = "My intervention"
    room = (
        policy.max_input_tokens
        - tokens(policy.system_framing)
        - tokens(bundle.messages[2].body)
        - tokens(visitor)
    )
    old = bundle.messages[0].model_copy(update={"body": "o" * 1000})
    large = bundle.messages[1].model_copy(update={"body": "l" * (room - 500)})
    b = bundle.model_copy(update={"messages": (old, large) + bundle.messages[2:]})
    a_options = ContextOptions()
    b_options = withheld_options(a_options, PairWithholding(excluded_ids=("m1",)))
    a = build_context(b, "m2", a_options, GenerationSettings(), [], visitor)
    m = build_context(b, "m2", b_options, GenerationSettings(), [], visitor)
    diff = compare_contexts(a, m)
    assert [r["id"] for r in diff.removed] == ["m1"]
    assert [r["id"] for r in diff.added] == ["m0"]
    assert withheld_options(
        ContextOptions(excluded_tags=("practical",)),
        PairWithholding(excluded_tags=("practical", "motifs")),
    ).excluded_tags == ("practical", "motifs")
