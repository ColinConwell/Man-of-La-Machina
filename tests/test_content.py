from pathlib import Path
from zipfile import ZipFile
import pytest
from packages.content.importer import import_thread
from packages.content.validation import assert_valid, validate
from packages.domain.models import *


def test_docx_tables_labels_ambiguity_and_stability(tmp_path):
    p = tmp_path / "invented.docx"
    with ZipFile(p, "w") as z:
        z.writestr(
            "word/document.xml",
            """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Invented fixture</w:t></w:r></w:p><w:p><w:r><w:t>Unattributed passage</w:t></w:r></w:p><w:p><w:r><w:t>BEAVEN:</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>I could take the train.</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>MIROWS:</w:t></w:r></w:p><w:p><w:r><w:t>What would that change?</w:t></w:r></w:p></w:body></w:document>""",
        )
        z.writestr("word/media/image1.png", b"invented image bytes")
    a = import_thread(p, "stable-source", "t", "2026-04-01", start_paragraph=1)
    b = import_thread(p, "stable-source", "t", "2026-04-01", start_paragraph=1)
    assert [m.id for m in a[1]] == [m.id for m in b[1]]
    assert [m.speaker for m in a[1]] == ["unknown", "human", "mirrows"]
    assert a[1][1].body == "I could take the train."
    assert {w["code"] for w in a[2]} == {"unknown-speaker", "embedded-media-unreviewed"}


def test_public_bundle_fails_closed(bundle):
    with pytest.raises(ValueError, match="public-content-not-approved"):
        assert_valid(bundle.model_copy(update={"mode": "public"}))


def test_dangling_configuration_and_duplicate_content(bundle):
    a = bundle.anchors[0].model_copy(update={"entry_message_id": "missing"})
    b = bundle.model_copy(
        update={"anchors": (a,), "messages": bundle.messages + (bundle.messages[0],)}
    )
    codes = {i["code"] for i in validate(b)}
    assert {
        "dangling-anchor",
        "duplicate-message-id",
        "overlapping-order",
        "duplicate-content",
    }.issubset(codes)


def test_real_slice_optional():
    from packages.content.build import ROOT, build

    if not (ROOT / "context/raw_data").exists():
        pytest.skip("Private archive not available")
    b = build(slice_only=True)
    m = next(
        m
        for m in b.messages
        if m.id
        == next(a.entry_message_id for a in b.anchors if a.id == "rain-in-spain")
    )
    assert m.sequence == 2 and m.speaker == "human"
    before = next(
        x for x in b.messages if x.thread_id == m.thread_id and x.sequence == 1
    )
    after = next(
        x for x in b.messages if x.thread_id == m.thread_id and x.sequence == 3
    )
    assert "Do NOT rent a car today." in before.body
    assert "Rent a car today" in after.body


def test_retrospective_preface_and_range_precision():
    from packages.content.build import ROOT, build

    if not (ROOT / "context/raw_data").exists():
        pytest.skip("Private archive not available")
    b = build()
    assert all(
        "paragraph=3" != m.provenance.locator.split("#")[-1]
        for m in b.messages
        if m.thread_id == "thread-c1"
    )
    d = next(d for d in b.documents if d.id == "long-update-preface")
    assert (
        d.origin == "annotation"
        and d.authored_at == "2026-07-11"
        and d.disclosed_at is None
    )
    night = [m for m in b.messages if m.thread_id == "thread-b9"]
    assert all(
        m.recorded_at is None
        and m.time_precision == "range"
        and m.disclosed_end_at == "2026-05-12"
        for m in night
    )
    from packages.domain.context import build_context

    manifest = build_context(
        b,
        night[-1].id,
        ContextOptions(breadth="journey"),
        GenerationSettings(),
        [],
        "Invented turn",
    )
    assert not any(i.id == "long-update-preface" for i in manifest.items)
    assert not any(
        i.disclosed_at and i.disclosed_at > "2026-05-11" for i in manifest.items
    )
