"""Checksum-pinned event releases from the existing private content bucket."""

from functools import lru_cache
import hashlib
import json

from packages.content.storage import MAX_BUNDLE_BYTES, content_client


@lru_cache(maxsize=4)
def load_private_timeline(bucket, key, checksum):
    try:
        if not bucket or not key or not checksum:
            raise ValueError("Missing release configuration")
        body = content_client().get_object(Bucket=bucket, Key=key)["Body"]
        try:
            data = body.read(MAX_BUNDLE_BYTES + 1)
        finally:
            body.close()
        if len(data) > MAX_BUNDLE_BYTES or hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError("Invalid release bytes")
        timeline = json.loads(data)
        if not isinstance(timeline, dict) or timeline.get("status") not in {"completed", "partial"} or not isinstance(timeline.get("events"), list):
            raise ValueError("Invalid event release")
        return timeline
    except Exception:
        raise RuntimeError("Private event release could not be loaded; check configuration and checksum") from None
