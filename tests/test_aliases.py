import json
import random

import pytest
from fastapi.testclient import TestClient

from apps.api.main import create_app
from packages.content.aliases import AliasConfig, AliasRewriter, load_aliases
from packages.domain.models import Artifact, digest
from packages.domain.providers import ProviderEvent, ProviderError
from scripts.check_public_tree import is_alias_config


def rewriter():
    return AliasRewriter(
        AliasConfig.model_validate(
            {
                "people": [
                    {
                        "names": ["Aster Riley", "Aster", "Riley"],
                        "alias": "The Visitor",
                        "role": "participant",
                    },
                    {"names": ["Maren", "Marn"], "alias": "The Friend"},
                ],
                "preserve": ["Aster the fictional knight"],
                "contextual": {"River said": "The Neighbor said"},
            }
        )
    )


def test_matching_variants_boundaries_and_context():
    a = rewriter()
    assert (
        a.text("ASTER riley’s note: aStEr, RILEY, MARN; maren's.")
        == "The Visitor’s note: The Visitor, The Visitor, The Friend; The Friend's."
    )
    assert a.text("Aster\nRiley met River said") == "The Visitor met The Neighbor said"
    assert (
        a.text("asteroid and marenite; Aster the fictional knight; the river")
        == "asteroid and marenite; Aster the fictional knight; the river"
    )
    result = a.text("Aster / Maren")
    assert a.text(result) == result


def test_stream_all_boundaries_random_partitions_and_interruption():
    a = rewriter()
    source = (
        "asteroid, ASTER\nRiley’s MARN, Aster the fictional knight. River said hello. "
        * 3
    )
    expected = a.text(source)
    for cut in range(len(source) + 1):
        s = a.stream()
        assert (
            s.feed(source[:cut]) + s.feed(source[cut:]) + s.feed("", final=True)
            == expected
        )
    rng = random.Random(12)
    for _ in range(100):
        s, out, at = a.stream(), "", 0
        while at < len(source):
            size = rng.randint(1, 35)
            out += s.feed(source[at : at + size])
            at += size
        assert out + s.feed("", final=True) == expected
    s = a.stream()
    assert s.feed("A safe sentence. Ast") + s.interrupt() == "A safe sentence. "
    s = a.stream()
    assert s.feed("A safe sentence. Aster Ri") + s.interrupt() == "A safe sentence. "


def test_private_configuration_precedence_failure_and_guard(
    tmp_path, monkeypatch, bundle
):
    config = {
        "people": [
            {"names": ["Aster"], "alias": "Local Visitor", "role": "participant"}
        ]
    }
    path = tmp_path / "aliases.local.json"
    path.write_text(json.dumps(config))
    monkeypatch.setenv("MACHINA_ALIASES_FILE", str(path))
    assert load_aliases().text("Aster") == "The Visitor"  # server JSON wins
    monkeypatch.delenv("MACHINA_ALIASES_JSON")
    assert load_aliases().text("Aster") == "Local Visitor"
    assert is_alias_config(path.read_bytes())
    path.write_text('{"people": "DO NOT PRINT THIS PRIVATE NAME"}')
    with pytest.raises(
        RuntimeError,
        match="^Private alias configuration is missing or invalid; check server configuration$",
    ):
        load_aliases(required=True)
    path.unlink()
    with pytest.raises(RuntimeError):
        load_aliases(required=True)
    monkeypatch.setenv("MACHINA_DEPLOYMENT", "hosted")
    # Required hosted configuration cannot silently fall back to original names.
    with pytest.raises(RuntimeError, match="Private alias configuration"):
        create_app(bundle)


def test_aliased_projection_api_context_stream_export_and_source_immutability(bundle):
    a = rewriter()
    original = bundle.messages[0].model_copy(
        update={
            "body": "ASTER Riley spoke to Maren.",
            "raw_body": "Aster private extraction",
        }
    )
    provenance = original.provenance.model_copy(
        update={"source_path": "private/Aster Riley.docx"}
    )
    original = original.model_copy(update={"provenance": provenance})
    artifact = Artifact(
        id="art",
        kind="annotation",
        title="Maren's note",
        body="Aster",
        alt_text="Marn",
        credits="Aster Riley",
        provenance=provenance,
    )
    bundle = bundle.model_copy(
        update={"messages": (original, *bundle.messages[1:]), "artifacts": (artifact,)}
    )
    untouched = bundle.model_dump_json()
    served = a.bundle(bundle)
    assert bundle.model_dump_json() == untouched
    assert served.messages[0].content_hash == digest(served.messages[0].body)
    assert served.content_version != bundle.content_version
    assert a.bundle(bundle).content_version == served.content_version
    assert "aster" not in served.model_dump_json().casefold()

    class Provider:
        async def stream(self, manifest):
            assert "aster" not in manifest.model_dump_json().casefold()
            assert "maren" not in manifest.model_dump_json().casefold()
            for part in ["Hello AS", "TER Ri", "ley and Ma", "ren."]:
                yield ProviderEvent("delta", part)
            yield ProviderEvent("metadata", metadata={"detail": "Aster"})

    with TestClient(create_app(bundle, lambda s: Provider(), aliases=a)) as c:
        for path in [
            "/api/v1/experience",
            "/api/v1/threads/t",
            "/api/v1/continuations/m0?include_cutoff=true",
            "/api/v1/artifacts",
            "/api/v1/timeline?granularity=message",
            "/api/v1/search?q=Visitor",
        ]:
            r = c.get(path)
            assert r.status_code == 200
            assert not any(
                n in r.text.casefold() for n in ["aster", "maren", "riley", "marn"]
            )
        assert c.get("/api/v1/search?q=Aster").json() == []
        for path in [
            "/content/curation/aliases.local.json",
            "/api/v1/aliases",
            "/.env.local",
        ]:
            assert c.get(path).status_code == 404
        bid = c.post("/api/v1/branches", json={"entry_message_id": "m2"}).json()["id"]
        preview = c.post(
            f"/api/v1/branches/{bid}/context/preview",
            json={"text": "Ask ASTER and Maren."},
        ).json()
        run = c.post(
            f"/api/v1/branches/{bid}/messages",
            json={"text": "Ask ASTER and Maren.", "request_id": "alias-check-1"},
        ).json()
        stream = c.get(run["stream_url"]).text
        assert "event: done" in stream
        assert run["visitor_text"] == "Ask The Visitor and The Friend."
        assert not any(n in stream.casefold() for n in ["aster", "maren", "riley"])
        receipt = c.get("/api/v1/context-manifests/" + run["manifest_id"]).json()
        assert receipt["hash"] == preview["hash"]
        export = c.get(f"/api/v1/branches/{bid}/export")
        assert not any(n in export.text.casefold() for n in ["aster", "maren", "riley"])
        assert (
            export.json()["generations"][0]["output"]
            == "Hello The Visitor and The Friend."
        )
        invalid = c.post(
            f"/api/v1/branches/{bid}/messages",
            json={"text": "ASTER", "request_id": "bad"},
        )
        assert invalid.status_code == 422 and "ASTER" not in invalid.text


def test_failed_stream_never_emits_partial_name(bundle):
    class Provider:
        async def stream(self, manifest):
            yield ProviderEvent("delta", "A safe sentence. Ast")
            raise ProviderError("refusal", "Aster cannot continue")

    with TestClient(create_app(bundle, lambda s: Provider(), aliases=rewriter())) as c:
        bid = c.post("/api/v1/branches", json={"entry_message_id": "m2"}).json()["id"]
        run = c.post(
            f"/api/v1/branches/{bid}/messages",
            json={"text": "Continue.", "request_id": "alias-failure"},
        ).json()
        stream = c.get(run["stream_url"]).text
        assert "Ast" not in stream
        data = c.get(f"/api/v1/branches/{bid}/export").json()
        assert data["generations"][0]["output"] == "A safe sentence. "
        assert data["branch"]["messages"] == []
