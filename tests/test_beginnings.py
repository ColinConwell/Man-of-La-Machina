import re
import stat
import pytest
from fastapi.testclient import TestClient
from packages.content.beginnings import apply_catalog, default_catalog, load_catalog
from packages.domain.models import digest
from tests.exploration_fixture import exploration_bundle
from tools.curator.app import create_curator


def test_selected_beginnings_and_anchor_share_validated_boundaries():
    b = exploration_bundle()
    starts = b.profile.start_options
    assert [s.id for s in starts] == ["earliest", "rain-in-spain", "naming-mirrows"]
    assert starts[1].entry_message_id == "test-2-1"
    assert (
        next(a for a in b.anchors if a.id == "rain-in-spain").entry_message_id
        == starts[1].entry_message_id
    )
    assert starts[2].entry_message_id == "test-3-2"
    assert apply_catalog(b, default_catalog(b)) == b


def test_private_notes_never_reach_experience_or_content_hash(tmp_path):
    b = exploration_bundle()
    catalog = default_catalog(b)
    edited = catalog.model_copy(
        update={
            "candidates": tuple(
                c.model_copy(update={"private_note": "An invented PRIVATE ANNOTATION"})
                for c in catalog.candidates
            )
        }
    )
    path = tmp_path / "beginnings.local.json"
    path.write_text(edited.model_dump_json())
    loaded = load_catalog(b, path)
    assert loaded == edited
    assert apply_catalog(b, loaded) == b
    assert "PRIVATE ANNOTATION" not in apply_catalog(b, loaded).model_dump_json()


def test_catalog_configuration_precedence_and_missing_explicit_file(
    tmp_path, monkeypatch
):
    b = exploration_bundle()
    path = tmp_path / "beginnings.local.json"
    monkeypatch.setenv("MACHINA_BEGINNINGS_FILE", str(path))
    with pytest.raises(FileNotFoundError):
        load_catalog(b)
    catalog = default_catalog(b)
    path.write_text(catalog.model_dump_json())
    assert load_catalog(b) == catalog
    override = catalog.model_copy(update={"default_start": "earliest"})
    monkeypatch.setenv("MACHINA_BEGINNINGS_JSON", override.model_dump_json())
    assert load_catalog(b) == override


def test_local_annotation_save_conflicts_and_boundaries(tmp_path):
    b = exploration_bundle()
    path = tmp_path / "beginnings.local.json"
    with TestClient(
        create_curator(b, path),
        base_url="http://127.0.0.1:8001",
        client=("127.0.0.1", 12345),
    ) as c:
        html = c.get("/").text
        token = re.search(r'nonce="([^"]+)"', html)[1]
        assert c.get("/api/catalog").status_code == 403
        c.headers["X-Curator-Token"] = token
        initial = c.get("/api/catalog").json()
        assert len(initial["catalog"]["candidates"]) == 4
        assert c.get("/api/threads/thread-b5").json()[1]["id"] == "test-2-1"
        payload = {"revision": initial["revision"], "catalog": initial["catalog"]}
        payload["catalog"]["candidates"][2]["entry_message_id"] = "test-2-3"
        payload["catalog"]["candidates"][2]["private_note"] = "Invented private note"
        assert (
            c.put(
                "/api/catalog",
                json=payload,
                headers={"Origin": "https://hostile.example"},
            ).status_code
            == 403
        )
        result = c.put("/api/catalog", json=payload)
        assert result.status_code == 200
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert c.put("/api/catalog", json=payload).status_code == 409
        payload["revision"] = result.json()["revision"]
        payload["catalog"]["candidates"][2]["entry_message_id"] = "missing"
        assert c.put("/api/catalog", json=payload).status_code == 422
        payload["catalog"]["candidates"][2]["entry_message_id"] = "test-1-3"
        assert c.put("/api/catalog", json=payload).status_code == 422
        assert load_catalog(b, path).candidates[2].entry_message_id == "test-2-3"
        projected = apply_catalog(b, load_catalog(b, path))
        assert projected.profile.start_options[1].entry_message_id == "test-2-3"


def test_annotation_tool_refuses_hosted_or_remote_clients(monkeypatch, tmp_path):
    b = exploration_bundle()
    with TestClient(
        create_curator(b, tmp_path / "notes.local.json"),
        base_url="http://127.0.0.1:8001",
        client=("192.0.2.1", 12345),
    ) as c:
        assert c.get("/").status_code == 403
    monkeypatch.setenv("MACHINA_DEPLOYMENT", "hosted")
    with pytest.raises(RuntimeError, match="only available locally"):
        create_curator(b, tmp_path / "notes.local.json")
