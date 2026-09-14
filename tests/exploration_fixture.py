"""Invented multi-chapter archive for deterministic browser and API tests."""

from packages.domain.models import *
from packages.content.beginnings import apply_catalog, default_catalog


def exploration_bundle():
    sources, threads, messages, anchors = [], [], [], []
    for n, (code, title, day, anchor) in enumerate(
        [
            ("A1", "Pink Moon", "2026-04-01", "pink-moon"),
            ("B1", "Red Door to Japan", "2026-05-01", "red-door"),
            ("B5", "Rain in Spain", "2026-05-08", "rain-in-spain"),
            ("B7", "Naming Mirrows", "2026-05-10", "naming-mirrows"),
        ]
    ):
        sid, tid = f"invented-source-{n}", f"thread-{code.lower()}"
        sources.append(
            Source(
                id=sid,
                path=f"invented-{n}.docx",
                title="Invented source",
                sha256="test",
            )
        )
        threads.append(
            Thread(
                id=tid,
                source_document_id=sid,
                chapter_code=code,
                title=title,
                start_at=day,
                sequence=n,
            )
        )
        for seq in range(10):
            body = f"Invented dialogue {n}, turn {seq}: let us consider a modest next step."
            messages.append(
                HistoricalMessage(
                    id=f"test-{n}-{seq}",
                    thread_id=tid,
                    sequence=seq,
                    ordinal=len(messages),
                    speaker="human" if seq % 2 == 0 else "mirrows",
                    body=body,
                    raw_body=body,
                    content_hash=digest(body),
                    disclosed_at=day,
                    recorded_at=day,
                    tags=("practical",) if seq % 2 == 0 else (),
                    provenance=Provenance(
                        source_id=sid,
                        source_path=f"invented-{n}.docx",
                        source_sha256="test",
                        locator=f"p{seq}",
                    ),
                )
            )
        anchors.append(
            Anchor(
                id=anchor,
                slug=anchor,
                title=title,
                subtitle="An invented test boundary",
                entry_message_id=f"test-{n}-2" if n else "test-0-0",
                start_at=day,
            )
        )
    bundle = Bundle(
        content_version="invented",
        mode="curator",
        sources=tuple(sources),
        threads=tuple(threads),
        messages=tuple(messages),
        anchors=tuple(anchors),
        profile=Profile(
            default_start="earliest",
            start_options=(
                StartOption(id="earliest", title="Start", entry_message_id="test-0-0"),
            ),
        ),
    )
    return apply_catalog(bundle, default_catalog(bundle))


if __name__ == "__main__":
    import os
    import uvicorn
    from apps.api.main import create_app
    from packages.content.aliases import AliasRewriter

    uvicorn.run(
        create_app(exploration_bundle(), aliases=AliasRewriter()),
        host="127.0.0.1",
        port=int(os.getenv("PORT", "8002")),
        access_log=False,
    )
