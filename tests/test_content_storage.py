import hashlib
import io
import traceback

import pytest

from packages.content import storage


PRIVATE = "invented-private-source-and-credential"


@pytest.fixture
def release(bundle, monkeypatch):
    data = bundle.model_dump_json().encode()
    monkeypatch.setenv("MACHINA_CONTENT_BUCKET", PRIVATE)
    monkeypatch.setenv("MACHINA_CONTENT_KEY", PRIVATE)
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", hashlib.sha256(data).hexdigest())
    return data


class ObjectClient:
    def __init__(self, body):
        self.body = body

    def get_object(self, **kwargs):
        return {"Body": self.body}


def assert_safe_failure(client, stage, code):
    with pytest.raises(RuntimeError) as caught:
        storage.load_private_bundle(client)
    assert str(caught.value) == (
        f"Private content could not be loaded [stage={stage} code={code}]"
    )
    rendered = "".join(traceback.format_exception(caught.value))
    assert PRIVATE not in rendered
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__


def test_success_closes_response_body(release, bundle):
    body = io.BytesIO(release)
    assert storage.load_private_bundle(ObjectClient(body)) == bundle
    assert body.closed


def test_configuration_failure_is_sanitized(release, monkeypatch):
    def broken_client():
        raise ValueError(PRIVATE)

    monkeypatch.setattr(storage, "content_client", broken_client)
    assert_safe_failure(None, "configuration", "invalid-configuration")
    monkeypatch.delenv("MACHINA_CONTENT_KEY")
    assert_safe_failure(ObjectClient(io.BytesIO(release)), "configuration", "missing-variable")


def test_missing_storage_dependency_has_safe_diagnostic(release, monkeypatch):
    def broken_client():
        raise ModuleNotFoundError(PRIVATE)

    monkeypatch.setattr(storage, "content_client", broken_client)
    assert_safe_failure(None, "configuration", "missing-storage-dependency")


def test_addressing_style_has_safe_diagnostic(release, monkeypatch):
    class InvalidS3AddressingStyleError(Exception):
        pass

    def broken_client():
        raise InvalidS3AddressingStyleError(PRIVATE)

    monkeypatch.setattr(storage, "content_client", broken_client)
    assert_safe_failure(None, "configuration", "invalid-addressing-style")


@pytest.mark.parametrize(
    ("remote_code", "expected_code"),
    [
        ("AccessDenied", "access-denied"),
        ("InvalidAccessKeyId", "access-denied"),
        ("SignatureDoesNotMatch", "access-denied"),
        ("ExpiredToken", "access-denied"),
        ("NoSuchKey", "not-found"),
        ("NoSuchBucket", "not-found"),
        (PRIVATE, "request-failed"),
    ],
)
def test_remote_errors_only_emit_allowlisted_codes(release, remote_code, expected_code):
    class RemoteError(Exception):
        response = {"Error": {"Code": remote_code, "Message": PRIVATE}}

    class BrokenClient:
        def get_object(self, **kwargs):
            raise RemoteError(PRIVATE)

    assert_safe_failure(BrokenClient(), "storage-access", expected_code)


def test_network_error_is_sanitized(release):
    class BrokenClient:
        def get_object(self, **kwargs):
            raise ConnectionError(PRIVATE)

    assert_safe_failure(BrokenClient(), "storage-access", "request-failed")


@pytest.mark.parametrize("failure", ["read", "close"])
def test_body_failure_is_sanitized_and_closes_stream(release, failure):
    class BrokenBody(io.BytesIO):
        def read(self, size):
            if failure == "read":
                raise OSError(PRIVATE)
            return super().read(size)

        def close(self):
            super().close()
            if failure == "close":
                raise OSError(PRIVATE)

    body = BrokenBody(release)
    assert_safe_failure(ObjectClient(body), "object-read", "read-failed")
    assert body.closed


def test_checksum_is_enforced_before_parsing(release, monkeypatch):
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", "0" * 64)
    assert_safe_failure(ObjectClient(io.BytesIO(b"not-json")), "checksum", "mismatch")


def test_oversized_reads_are_bounded_and_rejected(release, monkeypatch):
    monkeypatch.setattr(storage, "MAX_BUNDLE_BYTES", 5)
    body = io.BytesIO(release)
    assert_safe_failure(ObjectClient(body), "object-read", "size-limit")
    assert body.closed


@pytest.mark.parametrize("data", [b"not-json", ('{"messages": "' + PRIVATE + '"}').encode()])
def test_schema_failure_does_not_disclose_inputs(release, monkeypatch, data):
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", hashlib.sha256(data).hexdigest())
    assert_safe_failure(ObjectClient(io.BytesIO(data)), "schema", "invalid-bundle")


def test_semantic_failure_does_not_disclose_identifiers(release, bundle, monkeypatch):
    messages = (bundle.messages[0].model_copy(update={"thread_id": PRIVATE}), *bundle.messages[1:])
    data = bundle.model_copy(update={"messages": messages}).model_dump_json().encode()
    monkeypatch.setenv("MACHINA_CONTENT_SHA256", hashlib.sha256(data).hexdigest())
    assert_safe_failure(ObjectClient(io.BytesIO(data)), "semantic-validation", "invalid-bundle")
