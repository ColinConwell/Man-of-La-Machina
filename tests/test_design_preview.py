from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from apps.api.main import create_app
from tools.design_preview.__main__ import create_preview


def test_design_routes_are_absent_from_production(bundle, monkeypatch):
    monkeypatch.setenv("MACHINA_DEPLOYMENT", "hosted")
    monkeypatch.setenv("MACHINA_ALLOWED_HOSTS", "man-of-la-machina.com")
    with TestClient(create_app(bundle), base_url="https://man-of-la-machina.com") as client:
        for path in ["/design", "/design-preview", "/tools/design_preview/index.html",
                     "/tools/design_preview/web/assets/olive-plains.webp"]:
            assert client.get(path).status_code == 404


def test_design_server_serves_only_built_synthetic_files(monkeypatch):
    dist = Path(__file__).resolve().parents[1] / "tools/design_preview/dist"
    if not (dist / "index.html").exists():
        pytest.skip("Build the isolated preview with just design-build first")
    # The design server does not read credentials even when these names exist.
    monkeypatch.setenv("MACHINA_CONTENT_BUCKET", "must-not-be-read")
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", "must-not-be-read")
    with TestClient(create_preview()) as client:
        assert client.get("/").status_code == 200
        assert client.get("/design").status_code == 200
        assert client.get("/healthz").json()["service"] == "design-preview"
        for path in ["/.env.local", "/api/v1/experience", "/api/v1/generate", "/openapi.json",
                     "/asset-manifest.json", "/content/generated/bundle.json", "/web/App.jsx"]:
            assert client.get(path).status_code == 404
        asset = next((dist / "assets").glob("*.webp"))
        assert client.get(f"/assets/{asset.name}").status_code == 200
        assert client.get("/assets/../Caddyfile").status_code == 404
