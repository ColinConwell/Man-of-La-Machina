import hashlib
import io
import json

import pytest
from fastapi.testclient import TestClient

from apps.api.main import create_app
from packages.content.aliases import AliasRewriter
from packages.timeline import corpus_hash, load_timeline
from packages.timeline import storage


@pytest.fixture
def event_release(bundle, monkeypatch):
    storage.load_private_timeline.cache_clear()
    timeline = {
        "version": 1, "status": "completed", "content_version": bundle.content_version,
        "corpus_hash": corpus_hash(bundle), "events": [{"id": "invented-event"}],
        "coverage": {"sources_total": 1, "sources_processed": 1},
        "chunks": [{"receipt_file": "private-receipt.json"}],
        "extraction": {"receipt_directory": "/private/receipts", "limitations": ["Invented review"]},
    }
    data = json.dumps(timeline).encode()
    reads = []

    class Bucket:
        def get_object(self, **kwargs):
            reads.append(kwargs)
            return {"Body": io.BytesIO(data)}

    monkeypatch.setattr(storage, "content_client", Bucket)
    monkeypatch.setenv("MACHINA_CONTENT_BUCKET", "invented-bucket")
    monkeypatch.setenv("MACHINA_TIMELINE_KEY", "events/invented.json")
    monkeypatch.setenv("MACHINA_TIMELINE_SHA256", hashlib.sha256(data).hexdigest())
    yield timeline, reads
    storage.load_private_timeline.cache_clear()


def test_hosted_events_load_without_local_files_and_omit_private_receipts(bundle, event_release):
    timeline, reads = event_release
    with TestClient(create_app(bundle, aliases=AliasRewriter())) as client:
        for _ in range(2):
            response = client.get("/api/v1/event-timeline")
            assert response.status_code == 200
            assert response.json()["events"] == timeline["events"]
            assert "private-receipt" not in response.text
            assert "/private/receipts" not in response.text
            assert response.json()["extraction"] == {"limitations": ["Invented review"]}
    assert reads == [{"Bucket": "invented-bucket", "Key": "events/invented.json"}]


def test_bad_event_pin_fails_startup_without_private_error_details(bundle, event_release, monkeypatch):
    monkeypatch.setenv("MACHINA_TIMELINE_SHA256", "wrong")
    with pytest.raises(RuntimeError, match="^Private event release could not be loaded; check configuration and checksum$"):
        create_app(bundle, aliases=AliasRewriter())


def test_stale_hosted_events_fail_startup_but_explicit_local_paths_remain_isolated(bundle, event_release, tmp_path):
    changed = bundle.model_copy(update={"content_version": "another-release"})
    with pytest.raises(RuntimeError, match="does not match"):
        create_app(changed, aliases=AliasRewriter())
    assert load_timeline(bundle, tmp_path / "missing.json")["status"] == "unavailable"


def test_event_storage_errors_do_not_expose_provider_messages(bundle, event_release, monkeypatch):
    def fail():
        raise ValueError("secret credential and private source")
    monkeypatch.setattr(storage, "content_client", fail)
    with pytest.raises(RuntimeError, match="^Private event release could not be loaded; check configuration and checksum$"):
        load_timeline(bundle)
