import json
import hashlib
from io import BytesIO
import re
import shutil
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from packages.content.aliases import AliasConfig, AliasRewriter
from packages.content.editorial import (
    EditorialDocument,
    EditorialRelease,
    reading_document,
    load_editorial,
)
from tests.exploration_fixture import exploration_bundle


def invented_editorial():
    return EditorialRelease(
        about=EditorialDocument(
            title="About the Invented Project",
            body_html='<h2 id="origin">An Invented Origin</h2><p>Aster Riley reopens a choice.</p>',
        ),
        essay=EditorialDocument(
            title="An Invented Essay",
            edition="Test edition",
            body_html='<h2 id="argument">An Invented Argument</h2><p>Aster Riley considers <a href="#ref-example">a reference</a>.</p><h2 id="references">References</h2><div id="ref-example" class="csl-entry">An invented reference.</div>',
        ),
    )


def test_reading_toggle_hides_navigation_and_direct_endpoint(monkeypatch):
    monkeypatch.setenv("MACHINA_ESSAY_ENABLED", "true")
    with TestClient(
        create_app(exploration_bundle(), editorial=invented_editorial())
    ) as client:
        assert client.get("/api/v1/experience").json()["editorial"] == {
            "about": True,
            "essay": True,
        }
        for page in ("about", "essay"):
            result = client.get("/api/v1/editorial/" + page)
            assert result.status_code == 200
            assert "Aster" not in result.text and "The Visitor" in result.text
            assert result.headers["cache-control"] == "no-store"
        html = client.get("/api/v1/editorial/essay").json()["body_html"]
        assert re.search(r'href="#([^"]+)"', html)[1] in re.findall(
            r'id="([^"]+)"', html
        )
        monkeypatch.setenv("MACHINA_ESSAY_ENABLED", "false")
        assert not client.get("/api/v1/experience").json()["editorial"]["essay"]
        assert client.get("/api/v1/editorial/essay").status_code == 404
        assert client.get("/api/v1/editorial/about").status_code == 200
        for path in (
            "/manuscript/main.tex",
            "/manuscript/editorial.local.json",
            "/api/v1/editorial/source",
            "/api/v1/editorial/macros",
        ):
            assert client.get(path).status_code == 404


def test_html_and_aliases_cannot_introduce_active_markup():
    aliases = AliasRewriter(
        AliasConfig.model_validate(
            {
                "people": [
                    {
                        "names": ["Aster Riley"],
                        "alias": '<img src=x onerror="alert(1)">',
                        "role": "participant",
                    }
                ]
            }
        )
    )
    doc = EditorialDocument(
        title="Aster Riley",
        body_html='<script>alert(1)</script><!-- Aster Riley --><p onclick="alert(1)">Aster&#32;Riley</p><a href="javascript:alert(1)">Bad link</a><img src="https://example.org/pixel"><iframe src="https://example.org">Hidden</iframe><a href="https://example.org/Aster Riley">Personal link</a>',
    )
    html = reading_document(doc, aliases)["body_html"]
    assert "&lt;img" in html
    assert not any(
        term in html
        for term in (
            "<script",
            "<img",
            "onclick=",
            "<iframe",
            "href=",
            "Aster",
            "Hidden",
        )
    )


def test_private_release_failure_does_not_echo_source(tmp_path, monkeypatch):
    file = tmp_path / "editorial.local.json"
    file.write_text('{"private":"DO-NOT-ECHO"}')
    monkeypatch.delenv("MACHINA_EDITORIAL_KEY", raising=False)
    monkeypatch.setenv("MACHINA_EDITORIAL_FILE", str(file))
    with pytest.raises(RuntimeError, match="Private editorial release") as error:
        load_editorial()
    assert "DO-NOT-ECHO" not in str(error.value)


def test_private_storage_pins_editorial_bytes_and_closes_stream(monkeypatch):
    body = invented_editorial().model_dump_json().encode()
    streams = []

    class Storage:
        def get_object(self, **kwargs):
            assert kwargs == {"Bucket": "invented-bucket", "Key": "editorial/test.json"}
            stream = BytesIO(body)
            streams.append(stream)
            return {"Body": stream}

    monkeypatch.setattr("packages.content.editorial.content_client", Storage)
    monkeypatch.setenv("MACHINA_CONTENT_BUCKET", "invented-bucket")
    monkeypatch.setenv("MACHINA_EDITORIAL_KEY", "editorial/test.json")
    monkeypatch.setenv("MACHINA_EDITORIAL_SHA256", hashlib.sha256(body).hexdigest())
    assert load_editorial() == invented_editorial()
    monkeypatch.setenv("MACHINA_EDITORIAL_SHA256", "wrong")
    with pytest.raises(RuntimeError, match="Private editorial release"):
        load_editorial()
    assert all(stream.closed for stream in streams)


@pytest.mark.skipif(
    shutil.which("pandoc") is None,
    reason="Pandoc is needed for the editorial conversion integration test",
)
def test_tex_export_keeps_citations_and_original_source(tmp_path):
    from scripts.build_editorial import build, export_html
    from packages.content.aliases import load_aliases

    original = r"""\documentclass{article}
\input{names.tex}
\pseudonymize{true}
\title{An Invented Essay}
\author{Private Author private@example.org}
\begin{document}
\maketitle
\begin{abstract}An invented abstract with \Person{}.\end{abstract}
\paragraph{An Argument}A choice with a reference \cite{example}.
\bibliography{main}
\end{document}"""
    (tmp_path / "main.tex").write_text(original)
    (tmp_path / "main.bib").write_text(
        "@book{example,author={Author, Example},title={Invented Reference},year={2020},publisher={Example Press}}"
    )
    (tmp_path / "macros.local.json").write_text(json.dumps({"Person": "Aster Riley"}))
    about = tmp_path / "about.md"
    about.write_text("## Origin\n\nAn invented origin.")
    output = tmp_path / "editorial.local.json"
    build(tmp_path, about, output, "Test edition")
    release = EditorialRelease.model_validate_json(output.read_text())
    assert (tmp_path / "main.tex").read_text() == original
    assert "An invented abstract" in release.essay.body_html
    assert 'class="citation"' in release.essay.body_html
    assert 'id="ref-example"' in release.essay.body_html
    assert "Private Author" not in release.essay.body_html
    assert "private@example.org" not in output.read_text()
    assert output.stat().st_mode & 0o777 == 0o600
    export_html(release, tmp_path / "reading", load_aliases())
    exported = (tmp_path / "reading/essay.html").read_text()
    assert "<!doctype html>" in exported and "The Visitor" in exported
    assert "Aster" not in exported and 'class="citation"' in exported
