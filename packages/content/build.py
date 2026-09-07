"""Build a private versioned bundle; source files never become web assets."""

import argparse
import json
from pathlib import Path
import sqlite3
from packages.content.importer import import_thread, extract_docx
from packages.content.validation import validate, assert_valid
from packages.domain.models import *

ROOT = Path(__file__).resolve().parents[2]


def build(root=ROOT, slice_only=False, mode="curator", overlay_path=None):
    cfg = json.loads((root / "content/curation/archive.json").read_text())
    raw = root / "context/raw_data/Don-Qui-Co-Pilot"
    sources = []
    threads = []
    messages = []
    anchors = []
    artifacts = []
    issues = []
    for meta in cfg["threads"]:
        if slice_only and meta["code"] not in ("A1", "B5"):
            continue
        matches = list(raw.glob(meta["pattern"] + ".docx"))
        if len(matches) != 1:
            raise ValueError(
                f"Expected one source for {meta['code']}; found {len(matches)}"
            )
        p = matches[0]
        tid = "thread-" + meta["code"].lower()
        source, imported, warnings = import_thread(
            p.relative_to(root),
            f"archive/{meta['code']}",
            tid,
            meta["date"],
            len(messages),
            start_paragraph=meta.get("start_paragraph", 3),
        )
        sources.append(source)
        issues.extend(warnings)
        tags = cfg.get("message_tags", {}).get(meta["code"], {})
        imported = [
            m.model_copy(update={"tags": tuple(tags.get(str(m.sequence), []))})
            for m in imported
        ]
        speaker_overrides = cfg.get("speaker_overrides", {}).get(meta["code"], {})
        imported = [
            m.model_copy(update={"speaker": speaker_overrides[str(m.sequence)]})
            if str(m.sequence) in speaker_overrides
            else m
            for m in imported
        ]
        if meta.get("end"):
            imported = [
                m.model_copy(
                    update={
                        "recorded_at": None,
                        "disclosed_end_at": meta["end"],
                        "time_precision": "range",
                    }
                )
                for m in imported
            ]
        messages.extend(imported)
        threads.append(
            Thread(
                id=tid,
                source_document_id=source.id,
                chapter_code=meta["code"],
                title=meta["title"],
                place=meta.get("place"),
                start_at=meta["date"],
                end_at=meta.get("end"),
                time_precision="range" if meta.get("end") else "day",
                sequence=len(threads),
            )
        )
        if meta.get("anchor"):
            entry = imported[meta.get("entry", 0)]
            anchors.append(
                Anchor(
                    id=meta["anchor"],
                    slug=meta["anchor"],
                    title=meta["title"],
                    subtitle=meta["subtitle"],
                    entry_message_id=entry.id,
                    start_at=meta["date"],
                    importance=5
                    if meta["code"] in ("A1", "B5", "B7", "B9", "C1")
                    else 3,
                    curatorial_note=cfg.get("anchor_notes", {}).get(meta["anchor"], ""),
                )
            )
    # Retrospective documentary artifact, explicitly ineligible for historical model context.
    table = raw / "1 . Mirrrows Threads Table.docx"
    paras, _, _ = extract_docx(table)
    text = "\n".join(t for i, t in paras if 289 <= i <= 319 and t.strip())
    sh = __import__("hashlib").sha256(table.read_bytes()).hexdigest()
    artifacts.append(
        Artifact(
            id="may8-thread-map",
            kind="annotation",
            title="The author’s thread map",
            body=text,
            alt_text="Retrospective author notes about the May 8 conversation and its shift in car-rental advice.",
            credits="Beaven Waller · Mirrrows Threads Table",
            thread_ids=("thread-b5",),
            anchor_ids=("rain-in-spain",),
            occurred_at="2026-05-08",
            curatorial_note="Retrospective annotation. Date of authorship/disclosure is unknown; never included in historical model context.",
            provenance=Provenance(
                source_id="source-thread-map",
                source_path=str(table.relative_to(root)),
                source_sha256=sh,
                locator="word/document.xml#paragraph=289-319",
                text_kind="author_supplied",
            ),
        )
    )
    sources.append(
        Source(
            id="source-thread-map",
            path=str(table.relative_to(root)),
            title="Mirrrows Threads Table",
            sha256=sh,
        )
    )
    a1 = next(a for a in anchors if a.id == "pink-moon")
    b5 = next(a for a in anchors if a.id == "rain-in-spain")
    profile = Profile(
        start_options=(
            StartOption(
                id="complete-history",
                title="From the beginning · April 1",
                description="Follow the documented journey from its first conversation.",
                entry_message_id=a1.entry_message_id,
                strategy="earliest",
            ),
            StartOption(
                id="rain-in-spain",
                title="Rain in Spain · May 8",
                description="Pause at a moment when practical advice changes direction.",
                anchor_id="rain-in-spain",
                entry_message_id=b5.entry_message_id,
                strategy="anchor_id",
            ),
        )
    )
    documents = []
    if not slice_only:
        long_source = next(s for s in sources if s.title.startswith("The Long Update"))
        preface = "\n\n".join(
            text
            for i, text in extract_docx(Path(long_source.path))[0]
            if 4 <= i <= 12 and text.strip()
        )
        provenance = Provenance(
            source_id=long_source.id,
            source_path=long_source.path,
            source_sha256=long_source.sha256,
            locator="word/document.xml#paragraph=4-12",
            text_kind="author_supplied",
        )
        documents.append(
            ContextDocument(
                id="long-update-preface",
                title="A later view of the Long Update",
                body=preface,
                origin="annotation",
                authored_at="2026-07-11",
                disclosed_at=None,
                provenance=provenance,
                content_hash=digest(preface),
            )
        )
        artifacts.append(
            Artifact(
                id="long-update-preface",
                kind="annotation",
                title="A later view of the Long Update",
                body=preface,
                alt_text="Retrospective introduction written by Beaven in Yamanashi on July 11, 2026.",
                credits="Beaven Waller · Long Update introduction",
                thread_ids=("thread-c1",),
                anchor_ids=("long-update",),
                curatorial_note="Written July 11, after the events. This introduction is kept separate from the May 19 conversation and is never model context.",
                provenance=provenance,
            )
        )
    payload = dict(
        schema_version=1,
        mode=mode,
        sources=[s.model_dump() for s in sources],
        threads=[t.model_dump() for t in threads],
        messages=[m.model_dump() for m in messages],
        anchors=[a.model_dump() for a in anchors],
        artifacts=[a.model_dump() for a in artifacts],
        documents=[d.model_dump() for d in documents],
        profile=profile.model_dump(),
        issues=issues,
    )
    if overlay_path:
        overlay = json.loads(Path(overlay_path).read_text())
        # Explicit ID remapping supports reformatted documents. All references must be updated by the curator.
        for collection, updates in overlay.get("overrides", {}).items():
            if collection not in (
                "messages",
                "threads",
                "anchors",
                "documents",
                "artifacts",
            ):
                raise ValueError("Unsupported overlay collection")
            objects = {o["id"]: o for o in payload[collection]}
            if set(updates) - objects.keys():
                raise ValueError(f"Dangling overlay IDs in {collection}")
            for id, changes in updates.items():
                if "raw_body" in changes or "origin" in changes:
                    raise ValueError("Cannot overwrite raw historical text or origin")
                objects[id].update(changes)
                if collection == "messages" and "body" in changes:
                    objects[id]["content_hash"] = digest(changes["body"])
        payload["documents"].extend(overlay.get("documents", []))
        payload["artifacts"].extend(overlay.get("artifacts", []))
        if "profile" in overlay:
            payload["profile"].update(overlay["profile"])
    from packages.domain.profiles import resolve_profile

    payload["profile"] = resolve_profile(
        Bundle.model_validate({**payload, "content_version": "pending"})
    ).model_dump()
    payload["content_version"] = digest(payload)[:20]
    bundle = Bundle.model_validate(payload)
    assert_valid(bundle)
    combined = {digest(i): i for i in issues + validate(bundle)}
    return bundle.model_copy(update={"issues": tuple(combined.values())})


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--slice", action="store_true")
    p.add_argument("--mode", choices=["curator", "public"], default="curator")
    p.add_argument("--overlay")
    p.add_argument("--output", default="content/generated")
    args = p.parse_args()
    bundle = build(slice_only=args.slice, mode=args.mode, overlay_path=args.overlay)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    data = bundle.model_dump_json(indent=2)
    (out / "bundle.json").write_text(data)
    (out / f"bundle-{bundle.content_version}.json").write_text(data)
    (out / "validation.json").write_text(json.dumps(bundle.issues, indent=2))
    with sqlite3.connect(out / "search.sqlite") as db:
        db.execute("DROP TABLE IF EXISTS messages")
        db.execute(
            "CREATE VIRTUAL TABLE messages USING fts5(id UNINDEXED, thread_id UNINDEXED, body)"
        )
        db.executemany(
            "INSERT INTO messages VALUES (?,?,?)",
            [(m.id, m.thread_id, m.body) for m in bundle.messages],
        )
        db.execute("CREATE TABLE IF NOT EXISTS metadata (version TEXT)")
        db.execute("DELETE FROM metadata")
        db.execute("INSERT INTO metadata VALUES (?)", (bundle.content_version,))
    print(
        json.dumps(
            {
                "version": bundle.content_version,
                "threads": len(bundle.threads),
                "messages": len(bundle.messages),
                "anchors": len(bundle.anchors),
                "review_items": len(bundle.issues),
                "mode": bundle.mode,
                "output": str(out / "bundle.json"),
            }
        )
    )


if __name__ == "__main__":
    main()
