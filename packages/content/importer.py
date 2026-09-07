"""Conservative DOCX extraction in paragraph/table order with stable structural IDs."""

from pathlib import Path
from hashlib import sha256
import re
import zipfile
import xml.etree.ElementTree as ET
from packages.domain.models import Source, Provenance, HistoricalMessage, digest

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
LABEL = re.compile(
    r"^\s*(BEAVEN|CO[\s‐‑–-]?PILOT|MIR{1,3}OWS|MIROS)\s*[:：]?\s*$", re.I
)
INLINE = re.compile(
    r"^\s*(BEAVEN|CO[\s‐‑–-]?PILOT|MIR{1,3}OWS|MIROS)\s*[:：]\s*(.+)$", re.I
)


def extract_docx(path: Path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
        paragraphs = []
        # Global paragraph indexes preserve table-cell position; runs are retained in raw XML.
        for i, p in enumerate(root.findall(".//w:p", NS)):
            text = "".join(
                "\t"
                if e.tag.endswith("}tab")
                else "\n"
                if e.tag.endswith("}br")
                else (e.text or "")
                if e.tag.endswith("}t")
                else ""
                for e in p.iter()
            )
            paragraphs.append((i, text))
        media = [
            {
                "path": n,
                "sha256": sha256(z.read(n)).hexdigest(),
                "bytes": z.getinfo(n).file_size,
            }
            for n in z.namelist()
            if n.startswith("word/media/")
        ]
        rels = (
            z.read("word/_rels/document.xml.rels").decode()
            if "word/_rels/document.xml.rels" in z.namelist()
            else ""
        )
        return paragraphs, media, rels


def import_thread(
    path: Path,
    source_identity: str,
    thread_id: str,
    date: str | None,
    ordinal: int = 0,
    start_paragraph: int = 3,
):
    file_hash = sha256(path.read_bytes()).hexdigest()
    source_id = "source-" + digest(source_identity)[:16]
    source = Source(id=source_id, path=str(path), title=path.stem, sha256=file_hash)
    paragraphs, media, rels = extract_docx(path)
    messages = []
    issues = []
    speaker = "unknown"
    start = start_paragraph
    lines = []

    def flush():
        nonlocal lines
        raw = "\n".join(lines).strip("\n")
        body = "\n\n".join(line.rstrip() for line in lines if line.strip()).strip()
        if not body:
            return
        m = HistoricalMessage(
            id=f"{source_id}-p{start}",
            thread_id=thread_id,
            sequence=len(messages),
            ordinal=ordinal + len(messages),
            speaker=speaker,
            body=body,
            raw_body=raw,
            recorded_at=date,
            disclosed_at=date,
            time_precision="day" if date else "sequence_only",
            content_hash=digest(body),
            provenance=Provenance(
                source_id=source_id,
                source_path=str(path),
                source_sha256=file_hash,
                locator=f"word/document.xml#paragraph={start}",
            ),
        )
        messages.append(m)
        if speaker == "unknown":
            issues.append({"code": "unknown-speaker", "id": m.id, "severity": "review"})
        if len(messages) > 1 and messages[-2].speaker == speaker:
            issues.append(
                {"code": "consecutive-speaker", "id": m.id, "severity": "review"}
            )

    for i, text in paragraphs:
        if i < start_paragraph:
            continue
        match = LABEL.match(text)
        inline = INLINE.match(text)
        if match or inline:
            flush()
            lines = []
            start = i
            name = (match or inline).group(1).upper()
            speaker = "human" if name == "BEAVEN" else "mirrows"
            if inline:
                lines.append(inline.group(2))
        else:
            lines.append(text)
            if re.match(r"^[A-Z -]{3,24}:$", text.strip()):
                issues.append(
                    {
                        "code": "ambiguous-label",
                        "paragraph": i,
                        "source_id": source_id,
                        "severity": "review",
                    }
                )
    flush()
    for asset in media:
        issues.append(
            {
                "code": "embedded-media-unreviewed",
                "source_id": source_id,
                "severity": "review",
                **asset,
            }
        )
    return source, messages, issues
