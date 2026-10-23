"""Private S3 content. Credentials and original bundles never enter web builds."""

import hashlib
import os
from urllib.parse import urlparse
from packages.domain.models import Bundle
from packages.content.validation import assert_valid

MAX_BUNDLE_BYTES = 32 * 1024 * 1024


class _BundleDecodeError(ValueError):
    """A fixed diagnostic category without any private validation detail."""

    def __init__(self, stage: str, code: str, message: str):
        super().__init__(message)
        self.stage = stage
        self.code = code


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
        raise _BundleDecodeError(
            "object-read", "size-limit", "Content bundle is too large"
        )
    if not expected_sha256 or hashlib.sha256(data).hexdigest() != expected_sha256:
        raise _BundleDecodeError(
            "checksum",
            "mismatch",
            "Content bundle checksum does not match the pinned release",
        )
    try:
        bundle = Bundle.model_validate_json(data)
    except Exception:
        # Pydantic errors can contain source text; never print them into deployment logs.
        raise _BundleDecodeError(
            "schema", "invalid-bundle", "Content bundle schema validation failed"
        ) from None
    try:
        assert_valid(bundle)
    except Exception:
        # Semantic errors can contain private identifiers as well as source text.
        raise _BundleDecodeError(
            "semantic-validation",
            "invalid-bundle",
            "Content bundle semantic validation failed",
        ) from None
    return bundle


def _storage_error_code(error: Exception) -> str:
    # Never interpolate a server-supplied error, object key, endpoint or credential.
    # Only known S3 error codes are mapped to our fixed diagnostic vocabulary.
    response = getattr(error, "response", None)
    if isinstance(response, dict):
        detail = response.get("Error")
        if isinstance(detail, dict):
            code = detail.get("Code")
            if code in (
                "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken"
            ):
                return "access-denied"
            if code in ("NoSuchKey", "NoSuchBucket", "NotFound", "404"):
                return "not-found"
    return "request-failed"


def _configuration_error_code(error: Exception) -> str:
    if isinstance(error, KeyError):
        return "missing-variable"
    if isinstance(error, ImportError):
        return "missing-storage-dependency"
    # The hosting extra is optional locally, so do not import botocore at module load.
    if type(error).__name__ == "InvalidS3AddressingStyleError":
        return "invalid-addressing-style"
    return "invalid-configuration"


def load_private_bundle(client=None) -> Bundle:
    stage = "configuration"
    try:
        bucket = os.environ["MACHINA_CONTENT_BUCKET"]
        key = os.environ["MACHINA_CONTENT_KEY"]
        expected_sha256 = os.environ["MACHINA_CONTENT_SHA256"]
        if not bucket or not key or not expected_sha256:
            raise ValueError("Missing content release configuration")
        if client is None:
            client = content_client()
        stage = "storage-access"
        response = client.get_object(
            Bucket=bucket,
            Key=key,
        )
        stage = "object-read"
        stream = response["Body"]
        try:
            data = stream.read(MAX_BUNDLE_BYTES + 1)
        finally:
            stream.close()
        return decode_bundle(data, expected_sha256)
    except _BundleDecodeError as error:
        raise RuntimeError(
            f"Private content could not be loaded [stage={error.stage} code={error.code}]"
        ) from None
    except Exception as error:
        if stage == "storage-access":
            code = _storage_error_code(error)
        elif stage == "configuration":
            code = _configuration_error_code(error)
        else:
            code = "read-failed"
        raise RuntimeError(
            f"Private content could not be loaded [stage={stage} code={code}]"
        ) from None
