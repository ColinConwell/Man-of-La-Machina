"""Read-only projections of the real archive and editorial reading edition."""

from pathlib import Path
import os
from bs4 import BeautifulSoup
from packages.audio.models import Source

ROOT = Path(__file__).resolve().parents[2]


class Content:
    def __init__(self, fixture=False):
        self.rows = {}
        self.editorial = {}
        self.errors = []
        if fixture:
            s = Source(
                id="fixture",
                title="Quiet Morning",
                text="A quiet morning settles over the valley. The wind moves through the fields. Voices carry across the stone.",
                kind="fixture",
            )
            self.rows[s.id] = s
            return
        try:
            from packages.domain.repository import ContentRepository
            from packages.content.storage import load_private_bundle
            from packages.content.aliases import load_aliases

            aliases = load_aliases(required=False)
            bundle = (
                load_private_bundle()
                if os.getenv("MACHINA_CONTENT_KEY")
                else ContentRepository.load(
                    os.getenv("MACHINA_BUNDLE", ROOT / "content/generated/bundle.json")
                ).bundle
            )
            bundle = aliases.bundle(bundle)
            titles = {t.id: t.title for t in bundle.threads}
            for m in bundle.messages:
                self.rows[m.id] = Source(
                    id=m.id,
                    title=f"{titles[m.thread_id]} · {m.speaker} · {m.sequence + 1}",
                    text=m.body,
                    kind="message",
                    source_version=bundle.content_version,
                )
            for thread in bundle.threads:
                self.rows[thread.id] = Source(
                    id=thread.id,
                    title=thread.title,
                    text="\n\n".join(
                        m.body for m in bundle.messages if m.thread_id == thread.id
                    ),
                    kind="thread",
                    source_version=bundle.content_version,
                )
            for d in bundle.documents:
                self.rows[d.id] = Source(
                    id=d.id,
                    title=d.title,
                    text=d.body,
                    kind="document",
                    source_version=bundle.content_version,
                )
            for a in bundle.artifacts:
                if a.body or a.transcript:
                    self.rows[a.id] = Source(
                        id=a.id,
                        title=a.title,
                        text=a.body or a.transcript,
                        kind="artifact",
                        source_version=bundle.content_version,
                    )
        except Exception:
            self.errors.append(
                "Archive unavailable; check the local bundle or pinned private release."
            )
        try:
            from packages.content.editorial import load_editorial, reading_document
            from packages.content.aliases import load_aliases

            editorial = load_editorial()
            if editorial:
                for name in ("about", "essay"):
                    doc = getattr(editorial, name)
                    if not doc:
                        continue
                    projection = reading_document(doc, load_aliases(required=False))
                    self.editorial[name] = projection
                    self.rows[name] = self.editorial_source(name)
                    soup = BeautifulSoup(projection["body_html"], "html.parser")
                    for index, heading in enumerate(soup.find_all(["h2", "h3"])):
                        key = f"{name}-section-{index}"
                        self.rows[key] = self.editorial_source(name, section=index)
                        self.rows[key].id = key
        except Exception:
            self.errors.append(
                "Editorial reading unavailable; check its local or pinned private release."
            )

    def editorial_source(
        self,
        name,
        headings=True,
        citations=False,
        footnotes=False,
        bibliography=False,
        section=None,
    ):
        projection = self.editorial[name]
        soup = BeautifulSoup(projection["body_html"], "html.parser")
        title = projection["title"]
        if section is not None:
            hs = soup.find_all(["h2", "h3"])
            if not 0 <= section < len(hs):
                raise ValueError("Section not found")
            heading = hs[section]
            title = heading.get_text(" ", strip=True)
            parts = [str(heading)]
            for sibling in heading.next_siblings:
                if getattr(sibling, "name", None) in {"h2", "h3"}:
                    break
                parts.append(str(sibling))
            soup = BeautifulSoup("".join(parts), "html.parser")
        for selector, include in [
            ("h1,h2,h3,h4,h5,h6", headings),
            (".citation", citations),
            (".footnotes", footnotes),
            (".references,.csl-bib-body", bibliography),
        ]:
            if not include:
                for element in soup.select(selector):
                    element.decompose()
        for tag in soup.select("script,style"):
            tag.decompose()
        text = "\n\n".join(
            x.get_text(" ", strip=True)
            for x in soup.find_all(["p", "h1", "h2", "h3", "h4", "li", "pre"])
            if not x.find_parent(["li", "pre"])
        )
        return Source(
            id=name,
            title=title,
            text=text,
            kind="editorial",
            source_version=projection["version"],
            options=dict(
                headings=headings,
                citations=citations,
                footnotes=footnotes,
                bibliography=bibliography,
                section=section,
            ),
        )

    def list(self, q="", kind="", offset=0, limit=60):
        rows = [
            s
            for s in self.rows.values()
            if (not kind or s.kind == kind)
            and (not q or q.casefold() in (s.title + " " + s.text).casefold())
        ]
        return dict(
            total=len(rows),
            items=[
                dict(id=s.id, title=s.title, kind=s.kind, characters=len(s.text))
                for s in rows[offset : offset + limit]
            ],
            errors=self.errors,
        )

    def get(self, id, **options):
        if id not in self.rows:
            raise KeyError("Source not found")
        source = self.rows[id]
        if source.kind == "editorial":
            return self.editorial_source(
                id.split("-section-")[0],
                section=source.options.get("section"),
                **options,
            )
        return source
