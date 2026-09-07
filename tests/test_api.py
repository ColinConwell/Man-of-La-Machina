import asyncio, json
from fastapi.testclient import TestClient
from apps.api.main import create_app
from packages.domain.providers import ProviderEvent, ProviderError


class Stub:
    async def stream(self, manifest):
        yield ProviderEvent("delta", "An invented ")
        await asyncio.sleep(0.01)
        yield ProviderEvent("delta", "continuation.")
        yield ProviderEvent(
            "metadata", metadata={"resolved_model": "stub-v1", "finish_reason": "stop"}
        )


def make_branch(c):
    return c.post("/api/v1/branches", json={"entry_message_id": "m2"}).json()["id"]


def submit(c, id, request_id="test-request-1"):
    return c.post(
        f"/api/v1/branches/{id}/messages",
        json={"text": "An invented intervention.", "request_id": request_id},
    )


def test_stream_manifest_multi_turn_export_and_delete(bundle):
    with TestClient(create_app(bundle, lambda s: Stub())) as c:
        id = make_branch(c)
        preview = c.post(
            f"/api/v1/branches/{id}/context/preview",
            json={"text": "An invented intervention."},
        ).json()
        r = submit(c, id)
        assert r.status_code == 202
        run = r.json()
        stream = c.get(run["stream_url"]).text
        assert (
            "event: receipt" in stream
            and "event: delta" in stream
            and "event: done" in stream
        )
        receipt = c.get("/api/v1/context-manifests/" + run["manifest_id"]).json()
        assert receipt["hash"] == preview["hash"]
        assert len(c.get("/api/v1/branches/" + id).json()["messages"]) == 2
        assert submit(c, id).json() == run  # idempotency does not issue a second call
        run2 = submit(c, id, "test-request-2").json()
        c.get(run2["stream_url"])
        second = c.get("/api/v1/context-manifests/" + run2["manifest_id"]).json()
        assert [m["origin"] for m in second["items"]][-3:] == [
            "visitor",
            "generated",
            "visitor",
        ]
        export = c.get(f"/api/v1/branches/{id}/export").json()
        assert len(export["generations"]) == 2 and "owner" not in export["branch"]
        assert export["generations"][0]["request_hash"]
        assert c.delete("/api/v1/branches/" + id).status_code == 200
        assert c.get("/api/v1/branches/" + id).status_code == 404
        assert (
            c.get("/api/v1/context-manifests/" + run["manifest_id"]).status_code == 404
        )


def test_owner_isolation_and_cross_origin(bundle):
    app = create_app(bundle, lambda s: Stub())
    with TestClient(app) as a, TestClient(app) as b:
        id = make_branch(a)
        assert b.get("/api/v1/branches/" + id).status_code == 404
        assert (
            a.post(
                "/api/v1/branches",
                json={"entry_message_id": "m0"},
                headers={"origin": "https://hostile.example"},
            ).status_code
            == 403
        )
        assert (
            a.get("/api/v1/health", headers={"host": "hostile.example"}).status_code
            == 400
        )


def test_pagination_timeline_interval(bundle):
    with TestClient(create_app(bundle)) as c:
        ids = []
        after = -1
        while True:
            page = c.get(f"/api/v1/threads/t?after={after}&limit=2").json()
            ids.extend(m["id"] for m in page["messages"])
            if not page["has_after"]:
                break
            after = page["messages"][-1]["sequence"]
        assert ids == [f"m{i}" for i in range(6)]
        assert "raw_body" not in c.get("/api/v1/threads/t").json()["messages"][0]
        assert "raw_body" not in c.get("/api/v1/continuations/m0").json()[0]
        assert (
            c.get("/api/v1/timeline?granularity=message").json()["total_messages"] == 6
        )
        assert (
            c.get("/api/v1/timeline?granularity=day").json()["anchors"][0]["id"] == "a"
        )
        assert (
            c.post(
                "/api/v1/intervals/resolve",
                json={"first_message_id": "m1", "last_message_id": "m4"},
            ).json()["count"]
            == 4
        )
        assert (
            c.post(
                "/api/v1/intervals/resolve",
                json={"first_message_id": "m4", "last_message_id": "m1"},
            ).status_code
            == 422
        )
        assert c.get("/api/v1/timeline?granularity=invalid").status_code == 422


def test_refusal_is_not_historical_or_successful_branch_turn(bundle):
    class Refusal:
        async def stream(self, m):
            yield ProviderEvent("delta", "Partial text")
            raise ProviderError("refusal", "Present provider refusal.")

    with TestClient(create_app(bundle, lambda s: Refusal())) as c:
        id = make_branch(c)
        run = submit(c, id).json()
        stream = c.get(run["stream_url"]).text
        assert "event: failure" in stream and "event: done" not in stream
        assert c.get("/api/v1/branches/" + id).json()["messages"] == []
        result = c.get(f"/api/v1/branches/{id}/export").json()["generations"][0]
        assert result["status"] == "refused" and result["output"] == "Partial text"
        assert result["manifest"]["hash"]


def test_expiry_and_turn_limit(bundle):
    app = create_app(bundle, lambda s: Stub())
    with TestClient(app) as c:
        id = make_branch(c)
        for i in range(5):
            r = submit(c, id, f"request-{i}").json()
            c.get(r["stream_url"])
        assert submit(c, id, "request-over-limit").status_code == 409
        app.state.sessions.branches[id]["expires"] = 0
        assert c.get("/api/v1/branches/" + id).status_code == 404
        assert not app.state.sessions.jobs


def test_concurrent_submission_and_reset_cancels(bundle):
    class Slow:
        async def stream(self, m):
            yield ProviderEvent("delta", "Starting")
            await asyncio.sleep(5)
            yield ProviderEvent("delta", "Finished")

    app = create_app(bundle, lambda s: Slow())
    with TestClient(app) as c:
        id = make_branch(c)
        submit(c, id)
        assert submit(c, id, "other-request").status_code == 409
        assert c.delete("/api/v1/branches/" + id).status_code == 200
        assert not app.state.sessions.jobs
