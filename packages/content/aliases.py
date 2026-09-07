"""Private, deterministic name substitution before content enters the application."""

import json
import os
from pathlib import Path
import re
from typing import Literal

from pydantic import Field
from packages.domain.models import Bundle, Frozen, digest

DEFAULT_ALIAS_FILE = (
    Path(__file__).resolve().parents[2] / "content/curation/aliases.local.json"
)


class PersonAlias(Frozen):
    names: tuple[str, ...] = Field(min_length=1, max_length=50, repr=False)
    alias: str = Field(min_length=2, max_length=100)
    role: Literal["participant", "other"] = "other"


class AliasConfig(Frozen):
    version: Literal[1] = 1
    people: tuple[PersonAlias, ...] = Field(min_length=1, max_length=500, repr=False)
    contextual: dict[str, str] = Field(default_factory=dict, repr=False)
    preserve: tuple[str, ...] = Field(default=(), repr=False)


class AliasRewriter:
    def __init__(self, config: AliasConfig | None = None):
        self.pattern = None
        self.replacements = {}
        self.max_span = 0
        self.prefixes = set()
        self.participant = "Historical participant"
        self.version = "none"
        if config is None:
            return
        patterns = []
        names_seen = set()
        participants = [p for p in config.people if p.role == "participant"]
        if len(participants) != 1:
            raise ValueError("Alias configuration requires one participant")
        self.participant = participants[0].alias
        entries = []
        for person in config.people:
            if person.alias != person.alias.strip() or any(
                ord(c) < 32 for c in person.alias
            ):
                raise ValueError("Invalid alias label")
            entries.extend((name, person.alias) for name in person.names)
        entries.extend(config.contextual.items())
        entries.extend((phrase, None) for phrase in config.preserve)
        if len(entries) > 5000:
            raise ValueError("Too many alias rules")
        for name, replacement in entries:
            name = name.strip()
            if (
                not 2 <= len(name) <= 100
                or not name[0].isalnum()
                or not name[-1].isalnum()
            ):
                raise ValueError("Invalid alias name")
            key = re.sub(r"\s+", " ", name).casefold()
            if key in names_seen:
                raise ValueError("Duplicate alias name")
            names_seen.add(key)
            self.prefixes.update(key[:i] for i in range(1, len(key) + 1))
            # Bounded whitespace also covers line-wrapped full names in streams.
            parts = re.split(r"\s+", name)
            pattern = r"\s{1,8}".join(re.escape(p) for p in parts)
            patterns.append((len(name), pattern, replacement))
            self.max_span = max(
                self.max_span, sum(map(len, parts)) + 8 * (len(parts) - 1)
            )
        patterns.sort(key=lambda p: p[0], reverse=True)
        groups = []
        for i, (_, pattern, alias) in enumerate(patterns):
            group = f"n{i}"
            groups.append(f"(?P<{group}>{pattern})")
            self.replacements[group] = alias
        self.pattern = re.compile(
            r"(?<!\w)(?:" + "|".join(groups) + r")(?!\w)", re.IGNORECASE
        )
        if any(
            self.text(label) != label
            for label in [
                *(p.alias for p in config.people),
                *config.contextual.values(),
            ]
        ):
            raise ValueError("Alias labels must not contain configured names")
        self.version = digest({"engine": "aliases-v1", "config": config.model_dump()})[
            :20
        ]

    def text(self, value: str) -> str:
        if self.pattern is None:
            return value
        return self.pattern.sub(
            lambda m: (
                self.replacements[m.lastgroup]
                if self.replacements[m.lastgroup] is not None
                else m.group()
            ),
            value,
        )

    def tree(self, value):
        if isinstance(value, str):
            return self.text(value)
        if isinstance(value, dict):
            return {k: self.tree(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self.tree(v) for v in value]
        return value

    def bundle(self, source: Bundle) -> Bundle:
        if self.pattern is None:
            return source
        payload = self.tree(source.model_dump())
        payload["profile"]["human_label"] = self.participant
        for collection in ("messages", "documents"):
            for item in payload[collection]:
                item["content_hash"] = digest(item["body"])
        # The served version reflects the exact aliased projection; source stays immutable.
        payload["content_version"] = digest(
            {
                "source": source.content_version,
                "aliases": self.version,
                "projection": payload,
            }
        )[:20]
        try:
            return Bundle.model_validate(payload)
        except ValueError:
            raise ValueError("Aliased content validation failed") from None

    def stream(self):
        return AliasStream(self)


class AliasStream:
    """Retain enough lookahead to prevent a name split across SSE chunks leaking."""

    def __init__(self, aliases: AliasRewriter):
        self.aliases = aliases
        self.pending = ""
        self.left = " "

    def feed(self, text: str, *, final=False) -> str:
        if self.aliases.pattern is None:
            return text
        self.pending += text
        cutoff = (
            len(self.pending)
            if final
            else max(0, len(self.pending) - self.aliases.max_span - 1)
        )
        matches = list(self.aliases.pattern.finditer(self.left + self.pending))
        for match in matches:
            if match.start() - 1 < cutoff < match.end() - 1:
                cutoff = max(0, match.start() - 1)
        output, at = [], 0
        for match in matches:
            start, end = match.start() - 1, match.end() - 1
            if start < 0 or end > cutoff:
                continue
            replacement = self.aliases.replacements[match.lastgroup]
            output.extend(
                (
                    self.pending[at:start],
                    replacement if replacement is not None else match.group(),
                )
            )
            at = end
        output.append(self.pending[at:cutoff])
        if cutoff:
            self.left = self.pending[cutoff - 1]
        self.pending = self.pending[cutoff:]
        return "".join(output)

    def interrupt(self) -> str:
        # Preserve ordinary partial output but withhold an unfinished name.
        for match in re.finditer(r"(?<!\w)\w", self.left + self.pending):
            start = match.start() - 1
            if (
                start >= 0
                and re.sub(r"\s+", " ", self.pending[start:]).casefold().rstrip()
                in self.aliases.prefixes
            ):
                self.pending = self.pending[:start]
                break
        return self.feed("", final=True)


def load_aliases(*, required=False) -> AliasRewriter:
    """Server JSON overrides the ignored local file. Configuration never enters responses."""
    raw = os.getenv("MACHINA_ALIASES_JSON")
    path = Path(os.getenv("MACHINA_ALIASES_FILE", str(DEFAULT_ALIAS_FILE)))
    try:
        if raw is None and path.exists():
            raw = path.read_text()
        if raw is None:
            if required or os.getenv("MACHINA_ALIASES_FILE"):
                raise ValueError("Missing configuration")
            return AliasRewriter()
        if len(raw.encode()) > 128 * 1024:
            raise ValueError("Configuration too large")
        return AliasRewriter(AliasConfig.model_validate(json.loads(raw)))
    except Exception:
        raise RuntimeError(
            "Private alias configuration is missing or invalid; check server configuration"
        ) from None
