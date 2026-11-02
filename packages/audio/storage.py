"""Private local catalog and checksummed, prefix-scoped S3 interchange."""

from __future__ import annotations
import json
import os
import re
import sqlite3
import threading
from pathlib import Path
from packages.audio.models import digest, identity, Project, Source

KINDS = {"samples", "projects", "jobs", "batches", "features", "alignments"}
ID = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")
EXTENSIONS = {"wav", "mp3", "flac", "ogg", "opus", "aac", "m4a", "json"}


def project_sample_ids(project):
    return {layer["sample_id"] for layer in project["recipe"]["layers"]} | {
        effect["params"]["impulse_id"]
        for layer in project["recipe"]["layers"]
        for effect in layer["effects"]
        if effect.get("params", {}).get("impulse_id")
    }


class Store:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        for area in ("objects", "manifests", "tmp", "revisions"):
            (self.root / area).mkdir(exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.root / "catalog.sqlite", check_same_thread=False)
        os.chmod(self.root / "catalog.sqlite", 0o600)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS records(kind TEXT, id TEXT, payload TEXT NOT NULL, PRIMARY KEY(kind,id))"
        )
        self.db.commit()
        self.rebuild()

    def _check(self, kind, id):
        if kind not in KINDS or not ID.fullmatch(id):
            raise ValueError("Invalid catalog identity")

    def save(self, kind, record):
        self._check(kind, record["id"])
        record = {**record, "version": 1}
        data = json.dumps(record, ensure_ascii=False, allow_nan=False, sort_keys=True)
        with self.lock:
            folder = self.root / "manifests" / kind
            folder.mkdir(exist_ok=True, mode=0o700)
            target = folder / (record["id"] + ".json")
            if target.exists() and kind in {"projects", "features", "alignments"}:
                old = target.read_bytes()
                history = (
                    self.root
                    / "revisions"
                    / f"{kind}-{record['id']}-{digest(old)}.json"
                )
                if not history.exists():
                    self._write(history, old)
            self._write(target, data.encode())
            self.db.execute(
                "INSERT OR REPLACE INTO records VALUES (?,?,?)",
                (kind, record["id"], data),
            )
            self.db.commit()
        return record

    def _write(self, target, data):
        temporary = target.with_name(target.name + "." + identity() + ".tmp")
        with open(temporary, "xb") as f:
            os.chmod(temporary, 0o600)
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, target)

    def get(self, kind, id):
        self._check(kind, id)
        with self.lock:
            row = self.db.execute(
                "SELECT payload FROM records WHERE kind=? AND id=?", (kind, id)
            ).fetchone()
        if row is None:
            raise KeyError("Record not found")
        return json.loads(row[0])

    def list(self, kind):
        if kind not in KINDS:
            raise ValueError("Unknown catalog")
        with self.lock:
            rows = self.db.execute(
                "SELECT payload FROM records WHERE kind=? ORDER BY rowid DESC", (kind,)
            ).fetchall()
        return [json.loads(r[0]) for r in rows]

    def rebuild(self):
        n = 0
        with self.lock:
            self.db.execute("DELETE FROM records")
            for kind in KINDS:
                for path in (self.root / "manifests" / kind).glob("*.json"):
                    data = json.loads(path.read_text())
                    self._check(kind, data["id"])
                    self.db.execute(
                        "INSERT OR REPLACE INTO records VALUES (?,?,?)",
                        (kind, data["id"], json.dumps(data)),
                    )
                    n += 1
            self.db.commit()
        return n

    def blob(self, data, extension, role="audio"):
        if extension not in EXTENSIONS:
            raise ValueError("Unsupported audio format")
        entry = dict(
            sha256=digest(data), extension=extension, bytes=len(data), role=role
        )
        path = self.path(entry)
        if not path.exists():
            self._write(path, data)
        elif digest(path.read_bytes()) != entry["sha256"]:
            raise ValueError("Local object checksum mismatch")
        return entry

    def path(self, entry):
        if (
            not re.fullmatch(r"[a-f0-9]{64}", entry.get("sha256", ""))
            or entry.get("extension") not in EXTENSIONS
        ):
            raise ValueError("Invalid object identity")
        path = self.root / "objects" / (entry["sha256"] + "." + entry["extension"])
        if path.is_symlink():
            raise ValueError("Symlink audio objects are not supported")
        return path

    def audio_path(self, id):
        sample = self.get("samples", id)
        entry = next(f for f in sample["files"] if f["role"] == "audio")
        path = self.path(entry)
        if not path.is_file():
            raise ValueError("Audio is remote-only; download it first")
        return path

    def dependencies(self, sample_id):
        return [
            {"id": p["id"], "name": p["name"]}
            for p in self.list("projects")
            if any(
                layer["sample_id"] == sample_id
                or any(
                    effect.get("params", {}).get("impulse_id") == sample_id
                    for effect in layer["effects"]
                )
                for layer in p["recipe"]["layers"]
            )
        ]

    def delete_local(self, sample_id, evict=False):
        sample = self.get("samples", sample_id)
        dependencies = self.dependencies(sample_id)
        if dependencies and not evict:
            raise ValueError(
                "Sample is referenced by a project; remove its layers first"
            )
        others = {
            f["sha256"]
            for s in self.list("samples")
            if s["id"] != sample_id
            for f in s["files"]
        }
        for f in sample["files"]:
            if f["sha256"] not in others:
                self.path(f).unlink(missing_ok=True)
        if not evict:
            with self.lock:
                (self.root / "manifests/samples" / f"{sample_id}.json").unlink(
                    missing_ok=True
                )
                self.db.execute(
                    "DELETE FROM records WHERE kind='samples' AND id=?", (sample_id,)
                )
                self.db.commit()
        return {"deleted": True, "evicted": evict}

    def stats(self):
        objects = list((self.root / "objects").glob("*"))
        return {
            "samples": len(self.list("samples")),
            "projects": len(self.list("projects")),
            "bytes": sum(p.stat().st_size for p in objects if p.is_file()),
            "objects": len(objects),
        }


class Remote:
    """Only content-addressed objects and manifests beneath sound-studio/ are writable."""

    prefix = "sound-studio/v1/"

    def __init__(self, store, client=None, bucket=None):
        self.store = store
        self.client = client
        self.bucket = bucket or os.getenv(
            "MACHINA_SOUND_BUCKET", os.getenv("MACHINA_CONTENT_BUCKET", "")
        )

    @property
    def available(self):
        return bool(
            self.bucket and (self.client or os.getenv("MACHINA_CONTENT_ACCESS_KEY_ID"))
        )

    def s3(self):
        if not self.available:
            raise ValueError("Private S3 storage is not configured")
        if self.client is None:
            from packages.content.storage import content_client

            self.client = content_client()
        return self.client

    def object_key(self, f):
        self.store.path(f)  # validate before constructing any external key
        return self.prefix + "objects/" + f["sha256"] + "." + f["extension"]

    def upload(self, kind, id):
        if kind not in {"samples", "projects", "features", "alignments"}:
            raise ValueError("Only studio assets are transferable")
        record = self.store.get(kind, id)
        if kind == "projects":
            for sid in project_sample_ids(record):
                self.upload("samples", sid)
        if kind == "samples":
            for track in self.store.list("features"):
                if track["text_hash"] == record["text_hash"]:
                    self.upload("features", track["id"])
            for alignment in self.store.list("alignments"):
                if alignment["sample_id"] == id:
                    self.upload("alignments", alignment["id"])
        client = self.s3()
        for f in record.get("files", []):
            data = self.store.path(f).read_bytes()
            if digest(data) != f["sha256"]:
                raise ValueError("Local checksum mismatch; upload stopped")
            client.put_object(
                Bucket=self.bucket,
                Key=self.object_key(f),
                Body=data,
                Metadata={"sha256": f["sha256"]},
            )
            check = client.get_object(Bucket=self.bucket, Key=self.object_key(f))[
                "Body"
            ]
            try:
                verified = digest(check.read()) == f["sha256"]
            finally:
                check.close()
            if not verified:
                raise ValueError("Remote object checksum mismatch")
        data = json.dumps(record, sort_keys=True, ensure_ascii=False).encode()
        key = f"{self.prefix}manifests/{kind}/{id}/{digest(data)}.json"
        client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType="application/json"
        )
        return {"uploaded": True, "key": key, "id": id}

    def catalog(self):
        client = self.s3()
        found = {}
        token = None
        while True:
            page = client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=self.prefix + "manifests/",
                **({"ContinuationToken": token} if token else {}),
            )
            for item in page.get("Contents", []):
                key = item["Key"]
                match = re.fullmatch(
                    re.escape(self.prefix)
                    + r"manifests/(samples|projects|features|alignments)/([a-zA-Z0-9_-]{1,100})/([a-f0-9]{64})\.json",
                    key,
                )
                if not match:
                    continue
                group = (match[1], match[2])
                if (
                    group not in found
                    or str(item.get("LastModified", "")) > found[group]["modified"]
                ):
                    found[group] = {
                        "kind": group[0],
                        "id": group[1],
                        "key": key,
                        "modified": str(item.get("LastModified", "")),
                    }
            if not page.get("IsTruncated"):
                break
            token = page["NextContinuationToken"]
        return list(found.values())

    def read_manifest(self, key):
        match = re.fullmatch(
            re.escape(self.prefix)
            + r"manifests/(samples|projects|features|alignments)/([a-zA-Z0-9_-]{1,100})/([a-f0-9]{64})\.json",
            key,
        )
        if not match:
            raise ValueError("Only Sound Studio manifests are accepted")
        body = self.s3().get_object(Bucket=self.bucket, Key=key)["Body"]
        try:
            data = body.read(32 * 1024 * 1024 + 1)
        finally:
            body.close()
        if len(data) > 32 * 1024 * 1024 or digest(data) != match[3]:
            raise ValueError("Remote manifest checksum mismatch")
        record = json.loads(data)
        if record.get("version") != 1 or record.get("id") != match[2]:
            raise ValueError("Incompatible remote manifest")
        if match[1] == "projects":
            Project.model_validate(record)
        elif match[1] == "samples":
            Source.model_validate(record["source"])
            for f in record["files"]:
                self.store.path(f)
        return match[1], record

    def download(self, key):
        kind, record = self.read_manifest(key)
        if kind == "projects":
            rows = self.catalog()
            for sid in project_sample_ids(record):
                row = next(
                    (r for r in rows if r["kind"] == "samples" and r["id"] == sid), None
                )
                if not row:
                    raise ValueError("Remote project has missing sample manifests")
                self.download(row["key"])
        try:
            existing = self.store.get(kind, record["id"])
            if existing != record:
                raise ValueError(
                    "Local metadata differs; export or rename the local project before restoring this revision"
                )
        except KeyError:
            pass
        for f in record.get("files", []):
            body = self.s3().get_object(Bucket=self.bucket, Key=self.object_key(f))[
                "Body"
            ]
            try:
                data = body.read(512 * 1024 * 1024 + 1)
            finally:
                body.close()
            if len(data) > 512 * 1024 * 1024 or digest(data) != f["sha256"]:
                raise ValueError("Remote audio checksum mismatch")
            self.store.blob(data, f["extension"], f["role"])
        saved = self.store.save(kind, record)
        if kind == "samples":
            for row in self.catalog():
                if row["kind"] in {"features", "alignments"}:
                    related_kind, related = self.read_manifest(row["key"])
                    if (
                        related_kind == "features"
                        and related.get("text_hash") == record["text_hash"]
                    ) or (
                        related_kind == "alignments"
                        and related.get("sample_id") == record["id"]
                    ):
                        if related_kind == "features":
                            from packages.audio.analysis import validate_features

                            validate_features(
                                related, Source.model_validate(record["source"])
                            )
                        self.store.save(related_kind, related)
        return saved

    def manifest_keys(self):
        client = self.s3()
        token = None
        keys = []
        while True:
            page = client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=self.prefix + "manifests/",
                **({"ContinuationToken": token} if token else {}),
            )
            keys.extend(item["Key"] for item in page.get("Contents", []))
            if not page.get("IsTruncated"):
                return keys
            token = page["NextContinuationToken"]

    def dependencies(self, sample_id):
        self.store._check("samples", sample_id)
        found = {}
        for key in self.manifest_keys():
            if "/manifests/projects/" not in key:
                continue
            _, project = self.read_manifest(key)
            if any(
                layer["sample_id"] == sample_id
                or any(
                    effect.get("params", {}).get("impulse_id") == sample_id
                    for effect in layer["effects"]
                )
                for layer in project["recipe"]["layers"]
            ):
                found[project["id"]] = {
                    "id": project["id"],
                    "name": project["name"] + " (remote revision)",
                    "remote": True,
                }
        return list(found.values())

    def delete(self, sample_id, purge_objects=False):
        self.store._check("samples", sample_id)
        if self.store.dependencies(sample_id) or self.dependencies(sample_id):
            raise ValueError(
                "Sample is referenced by a local or remote project revision"
            )
        targets = []
        candidates = set()
        shared = set()
        # Inspect every manifest revision before deleting anything. Old projects and samples retain their objects.
        for key in self.manifest_keys():
            kind, record = self.read_manifest(key)
            if kind != "samples":
                continue
            objects = {self.object_key(f) for f in record.get("files", [])}
            if record["id"] == sample_id:
                targets.append(key)
                candidates.update(objects)
            else:
                shared.update(objects)
        client = self.s3()
        for key in targets:
            client.delete_object(Bucket=self.bucket, Key=key)
        removed = 0
        if purge_objects:
            for key in candidates - shared:
                client.delete_object(Bucket=self.bucket, Key=key)
                removed += 1
        return {
            "deleted_manifests": len(targets),
            "deleted_objects": removed,
            "objects_retained": not purge_objects,
        }
