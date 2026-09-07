import pytest
import json
from packages.domain.models import *


@pytest.fixture(autouse=True)
def isolated_alias_configuration(monkeypatch):
    # Real names and locally chosen aliases must never enter test snapshots or CI.
    monkeypatch.setenv(
        "MACHINA_ALIASES_JSON",
        json.dumps(
            {
                "version": 1,
                "people": [
                    {
                        "names": ["Aster Riley", "Aster", "Riley"],
                        "alias": "The Visitor",
                        "role": "participant",
                    }
                ],
            }
        ),
    )


@pytest.fixture
def bundle():
    src = Source(
        id="s", path="invented.docx", title="Invented test dialogue", sha256="abc"
    )
    prov = Provenance(
        source_id="s", source_path=src.path, source_sha256=src.sha256, locator="p0"
    )
    messages = tuple(
        HistoricalMessage(
            id=f"m{i}",
            thread_id="t",
            sequence=i,
            ordinal=i,
            speaker="human" if i % 2 == 0 else "mirrows",
            body=f"Invented turn {i}",
            raw_body=f"Invented turn {i}",
            content_hash=digest(f"Invented turn {i}"),
            recorded_at="2026-04-01",
            disclosed_at="2026-04-01",
            provenance=prov,
            tags=("practical",) if i == 0 else (),
        )
        for i in range(6)
    )
    doc = ContextDocument(
        id="late-doc",
        title="Earlier occurrence, later disclosure",
        body="Do not leak this future knowledge.",
        origin="document",
        occurred_at="2026-03-01",
        disclosed_at="2026-05-19",
        provenance=prov,
        content_hash="future",
    )
    return Bundle(
        content_version="test",
        mode="curator",
        sources=(src,),
        threads=(
            Thread(
                id="t",
                source_document_id="s",
                chapter_code="A1",
                title="Test",
                start_at="2026-04-01",
                sequence=0,
            ),
        ),
        messages=messages,
        documents=(doc,),
        anchors=(
            Anchor(
                id="a",
                slug="a",
                title="Start",
                subtitle="",
                entry_message_id="m0",
                start_at="2026-04-01",
            ),
        ),
        profile=Profile(
            default_start="test",
            start_options=(
                StartOption(id="test", title="Start", entry_message_id="m0"),
            ),
        ),
    )
