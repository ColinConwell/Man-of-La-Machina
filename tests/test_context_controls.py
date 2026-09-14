from fastapi.testclient import TestClient
from apps.api.main import create_app
from packages.domain.context import build_context
from packages.domain.models import ContextOptions, GenerationSettings
from tests.exploration_fixture import exploration_bundle
from tests.test_api import Stub


def history(manifest):
    return [i["id"] for i in manifest["items"] if i["origin"] == "historical"]


def test_every_breadth_changes_exact_history_and_preview_matches_generation():
    app = create_app(exploration_bundle(), lambda s: Stub())
    with TestClient(app) as c:
        previous = set()
        for scope, count in [
            ("scene", 6),
            ("thread", 10),
            ("chapter", 30),
            ("journey", 40),
        ]:
            payload = {
                "entry_message_id": "test-3-9",
                "options": {"breadth": scope},
                "text": "An invented visitor turn",
            }
            preview = c.post("/api/v1/context/preview", json=payload)
            assert preview.status_code == 200
            m = preview.json()
            ids = set(history(m))
            assert len(ids) == count and previous < ids
            assert m["included_history_count"] == m["eligible_history_count"] == count
            previous = ids
            assert not app.state.sessions.branches
        branch = c.post(
            "/api/v1/branches", json={"entry_message_id": "test-3-9"}
        ).json()["id"]
        payload.pop("entry_message_id")
        run = c.post(
            f"/api/v1/branches/{branch}/messages",
            json={**payload, "request_id": "context-controls-1"},
        ).json()
        c.get(run["stream_url"])
        receipt = c.get("/api/v1/context-manifests/" + run["manifest_id"]).json()
        assert receipt == m


def test_budget_equivalence_reported_and_filters_never_include_future():
    b = exploration_bundle()
    b = b.model_copy(
        update={
            "profile": b.profile.model_copy(
                update={
                    "policy": b.profile.policy.model_copy(
                        update={"max_input_tokens": 1100}
                    )
                }
            )
        }
    )
    scopes = [
        build_context(
            b, "test-3-8", ContextOptions(breadth=s), GenerationSettings(), [], ""
        )
        for s in ("thread", "chapter", "journey")
    ]
    assert len({tuple(history(m.model_dump())) for m in scopes}) == 1
    assert [m.eligible_history_count for m in scopes] == [9, 29, 39]
    assert all(m.included_history_count < m.eligible_history_count for m in scopes)
    assert all("test-3-9" not in history(m.model_dump()) for m in scopes)
    filtered = build_context(
        exploration_bundle(),
        "test-3-8",
        ContextOptions(breadth="journey", excluded_tags=("practical",)),
        GenerationSettings(),
        [],
        "",
    )
    assert all(i.id == "test-3-8" or "practical" not in i.tags for i in filtered.items)


def test_stateless_preview_validates_boundary_replacement_and_origin():
    with TestClient(create_app(exploration_bundle())) as c:
        assert (
            c.post(
                "/api/v1/context/preview", json={"entry_message_id": "missing"}
            ).status_code
            == 404
        )
        assert (
            c.post(
                "/api/v1/context/preview",
                json={
                    "entry_message_id": "test-2-1",
                    "options": {"replace_cutoff": True},
                },
            ).status_code
            == 422
        )
        assert (
            c.post(
                "/api/v1/context/preview",
                json={
                    "entry_message_id": "test-2-1",
                    "options": {"breadth": "invalid"},
                },
            ).status_code
            == 422
        )
        assert (
            c.post(
                "/api/v1/context/preview",
                json={"entry_message_id": "test-2-1"},
                headers={"Origin": "https://hostile.example"},
            ).status_code
            == 403
        )
