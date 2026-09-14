"""Private editorial releases and a safe, pseudonymized reading projection."""

import hashlib
from html import escape
from html.parser import HTMLParser
import os
from pathlib import Path
from urllib.parse import urlsplit
from pydantic import Field
from packages.domain.models import Frozen, digest
from packages.content.storage import content_client, MAX_BUNDLE_BYTES

LOCAL_EDITORIAL = (
    Path(__file__).resolve().parents[2] / "manuscript/editorial.local.json"
)


class EditorialDocument(Frozen):
    title: str = Field(min_length=1, max_length=500)
    deck: str = Field(default="", max_length=2000)
    body_html: str = Field(min_length=1, max_length=2_000_000, repr=False)
    edition: str = Field(default="", max_length=200)


class EditorialRelease(Frozen):
    about: EditorialDocument
    essay: EditorialDocument | None = None


class ReadingHTML(HTMLParser):
    """No scripts, embeds, styles, source paths, comments, or active attributes.

    Replacements happen in decoded text, then are escaped, so even an alias
    containing HTML remains text. IDs are opaque and keep citation links intact.
    """

    allowed = set(
        "p h2 h3 h4 h5 h6 em strong i b blockquote ul ol li a span div sup sub br hr code pre table thead tbody tr th td caption dl dt dd section".split()
    )
    blocked = {"script", "style", "iframe", "object", "svg", "math", "template"}
    classes = {
        "references",
        "csl-bib-body",
        "csl-entry",
        "csl-left-margin",
        "csl-right-inline",
        "citation",
        "footnotes",
        "abstract",
    }

    def __init__(self, aliases):
        super().__init__(convert_charrefs=True)
        self.aliases = aliases
        self.output = []
        self.depth = 0

    @staticmethod
    def identifier(value):
        return "reading-" + hashlib.sha256(value.encode()).hexdigest()[:20]

    def handle_starttag(self, tag, attrs):
        if tag in self.blocked:
            self.depth += 1
        if self.depth or tag not in self.allowed:
            return
        safe = []
        for key, value in attrs:
            if not value:
                continue
            if key == "id":
                safe.append((key, self.identifier(value)))
            elif key == "class":
                safe.append(
                    (key, " ".join(c for c in value.split() if c in self.classes))
                )
            elif key == "title":
                safe.append((key, self.aliases.text(value)))
            elif tag == "a" and key == "href":
                if value.startswith("#"):
                    safe.append((key, "#" + self.identifier(value[1:])))
                elif (
                    urlsplit(value).scheme in {"https", "http"}
                    and self.aliases.text(value) == value
                ):
                    safe.append((key, value))
        attributes = "".join(f' {k}="{escape(v, quote=True)}"' for k, v in safe)
        self.output.append(f"<{tag}{attributes}>")

    def handle_endtag(self, tag):
        if tag in self.blocked:
            self.depth = max(0, self.depth - 1)
            return
        if not self.depth and tag in self.allowed and tag not in {"hr", "br"}:
            self.output.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.depth:
            self.output.append(escape(self.aliases.text(data)))


def reading_document(document, aliases):
    parser = ReadingHTML(aliases)
    parser.feed(document.body_html)
    parser.close()
    projection = {
        "title": aliases.text(document.title),
        "deck": aliases.text(document.deck),
        "edition": aliases.text(document.edition),
        "body_html": "".join(parser.output),
    }
    return {**projection, "version": digest(projection)[:20]}


def load_editorial():
    """No raw release or source documents are exposed through an HTTP route."""
    try:
        key = os.getenv("MACHINA_EDITORIAL_KEY")
        if key:
            stream = content_client().get_object(
                Bucket=os.environ["MACHINA_CONTENT_BUCKET"], Key=key
            )["Body"]
            try:
                data = stream.read(MAX_BUNDLE_BYTES + 1)
            finally:
                stream.close()
            if (
                hashlib.sha256(data).hexdigest()
                != os.environ["MACHINA_EDITORIAL_SHA256"]
            ):
                raise ValueError("Checksum mismatch")
        else:
            file = Path(os.getenv("MACHINA_EDITORIAL_FILE", LOCAL_EDITORIAL))
            if not file.exists() and not os.getenv("MACHINA_EDITORIAL_FILE"):
                return None
            data = file.read_bytes()
        if len(data) > MAX_BUNDLE_BYTES:
            raise ValueError("Release too large")
        return EditorialRelease.model_validate_json(data)
    except Exception:
        raise RuntimeError(
            "Private editorial release could not be loaded; check configuration and checksum"
        ) from None
