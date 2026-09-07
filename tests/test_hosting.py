import hashlib
import io
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from packages.content.storage import decode_bundle, load_private_bundle
from scripts.check_public_tree import forbidden_path, is_content_bundle
from apps.api.limits import GenerationLimits
from fastapi import HTTPException


def test_private_content_checksums_and_errors_do_not_reveal_source(bundle, monkeypatch):
    data = bundle.model_dump_json().encode()
    sha = hashlib.sha256(data).hexdigest()
    assert decode_bundle(data, sha).content_version == bundle.content_version
    with pytest.raises(ValueError, match="checksum"):
        decode_bundle(data, "bad")
    bad = b'{"messages": "private text must not leak"}'
    with pytest.raises(ValueError, match="^Content bundle validation failed$"):
        decode_bundle(bad, hashlib.sha256(bad).hexdigest())
    monkeypatch.setenv("MACHINA_CONTENT_BUCKET", "invented-private-bucket")
    monkeypatch.setenv("MACHINA_CONTENT_KEY", "release.json")
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", sha)

    class Storage:
        def get_object(self, **kwargs):
            assert kwargs == {
                "Bucket": "invented-private-bucket",
                "Key": "release.json",
            }
            return {"Body": io.BytesIO(data)}

    assert load_private_bundle(Storage()).content_version == bundle.content_version


def test_hosted_boundary_and_private_files(bundle, monkeypatch):
    monkeypatch.setenv("MACHINA_DEPLOYMENT", "hosted")
    monkeypatch.setenv("MACHINA_ALLOWED_HOSTS", "man-of-la-machina.com")
    with TestClient(create_app(bundle), base_url="https://man-of-la-machina.com") as c:
        r = c.get("/api/v1/experience")
        assert r.json()["mode"] == "hosted"
        assert "Secure" in r.headers["set-cookie"]
        assert r.headers["x-robots-tag"] == "noindex, nofollow, noarchive"
        health = c.head("/api/v1/health")
        assert health.status_code == 200 and health.content == b""
        for path in [
            "/api/v1/review",
            "/openapi.json",
            "/.env.local",
            "/content/generated/bundle.json",
            "/context/raw_data",
            "/docs",
        ]:
            assert c.get(path).status_code == 404
        assert (
            c.get("/api/v1/health", headers={"host": "hostile.example"}).status_code
            == 400
        )
        assert (
            c.post(
                "/api/v1/branches",
                json={"entry_message_id": "m0"},
                headers={"origin": "https://hostile.example"},
            ).status_code
            == 403
        )


def test_repository_content_guard():
    for path in [
        "context/source.docx",
        "content/generated/bundle.json",
        "content/curation/review.local.json",
        ".env.local",
        "screenshots/private.pdf",
        "apps/web/test-results/capture.json",
    ]:
        assert forbidden_path(path)
    assert not forbidden_path("content/curation/archive.json")
    assert not forbidden_path("apps/api/main.py")
    assert is_content_bundle(b'{"messages":[],"content_version":"test"}')
    assert not is_content_bundle(b'{"threads":[],"note":"Metadata only"}')


def test_hosted_generation_allowances_expire_and_do_not_grow_on_rejection():
    now = [100.0]
    limits = GenerationLimits(per_hour=2, per_owner=1, clock=lambda: now[0])
    limits.admit("one")
    with pytest.raises(HTTPException) as exc:
        limits.admit("one")
    assert exc.value.status_code == 429
    limits.admit("two")
    with pytest.raises(HTTPException):
        limits.admit("three")
    assert len(limits.attempts) == 2
    now[0] += 3600
    limits.admit("three")
    assert len(limits.attempts) == 1
