"""Private S3 content. Credentials and original bundles never enter web builds."""

import hashlib
import os
from urllib.parse import urlparse
from packages.domain.models import Bundle
from packages.content.validation import assert_valid

MAX_BUNDLE_BYTES = 32 * 1024 * 1024


def content_client():
    import boto3
    from botocore.config import Config

    endpoint = os.environ["MACHINA_CONTENT_ENDPOINT"]
    if urlparse(endpoint).scheme != "https":
        raise ValueError("Content storage requires HTTPS")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["MACHINA_CONTENT_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["MACHINA_CONTENT_SECRET_ACCESS_KEY"],
        region_name=os.getenv("MACHINA_CONTENT_REGION", "auto"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": os.getenv("MACHINA_CONTENT_URL_STYLE", "virtual")},
            connect_timeout=10,
            read_timeout=30,
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


def decode_bundle(data: bytes, expected_sha256: str) -> Bundle:
    if len(data) > MAX_BUNDLE_BYTES:
        raise ValueError("Content bundle is too large")
    if not expected_sha256 or hashlib.sha256(data).hexdigest() != expected_sha256:
        raise ValueError("Content bundle checksum does not match the pinned release")
    try:
        bundle = Bundle.model_validate_json(data)
        assert_valid(bundle)
        return bundle
    except ValueError:
        # Pydantic errors can contain source text; never print it into deployment logs.
        raise ValueError("Content bundle validation failed") from None


def load_private_bundle(client=None) -> Bundle:
    try:
        client = client or content_client()
        response = client.get_object(
            Bucket=os.environ["MACHINA_CONTENT_BUCKET"],
            Key=os.environ["MACHINA_CONTENT_KEY"],
        )
        stream = response["Body"]
        try:
            data = stream.read(MAX_BUNDLE_BYTES + 1)
        finally:
            stream.close()
        return decode_bundle(data, os.environ["MACHINA_CONTENT_SHA256"])
    except Exception:
        raise RuntimeError(
            "Private content could not be loaded; check server storage configuration and the pinned checksum"
        ) from None
