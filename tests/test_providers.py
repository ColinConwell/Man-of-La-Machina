import json
import httpx
import pytest
from packages.domain.context import build_context
from packages.domain.models import *
from packages.domain.providers import (
    RemoteProvider,
    PROVIDERS,
    request_payload,
    ProviderError,
)


@pytest.mark.parametrize(
    "provider,events,expected",
    [
        (
            "openai",
            [
                {
                    "model": "resolved",
                    "choices": [{"delta": {"content": "hello"}, "finish_reason": None}],
                },
                {"choices": [{"delta": {}, "finish_reason": "stop"}]},
            ],
            "hello",
        ),
        (
            "anthropic",
            [
                {
                    "type": "message_start",
                    "message": {"model": "resolved", "id": "req"},
                },
                {
                    "type": "content_block_delta",
                    "delta": {"type": "text_delta", "text": "hello"},
                },
                {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
                {"type": "message_stop"},
            ],
            "hello",
        ),
        (
            "gemini",
            [
                {
                    "candidates": [
                        {
                            "content": {"parts": [{"text": "hello"}]},
                            "finishReason": "STOP",
                        }
                    ],
                    "modelVersion": "resolved",
                }
            ],
            "hello",
        ),
    ],
)
async def test_native_stream_adapters(bundle, provider, events, expected):
    manifest = build_context(
        bundle,
        "m2",
        ContextOptions(),
        GenerationSettings(provider=provider, model=PROVIDERS[provider]["model"]),
        [],
        "Invented test.",
    )
    data = "".join("data: " + json.dumps(e) + "\n\n" for e in events)
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, text=data)

    adapter = RemoteProvider(
        PROVIDERS[provider],
        lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kw),
    )
    output = [e async for e in adapter.stream(manifest)]
    assert "".join(e.text for e in output if e.type == "delta") == expected
    wire = json.dumps(seen[0])
    assert "Invented test." in wire and "Invented turn 3" not in wire


async def test_failed_http_and_truncated_stream(bundle):
    m = build_context(bundle, "m2", ContextOptions(), GenerationSettings(), [], "test")
    for status, text, category in [
        (429, "secret provider response", "rate_limit"),
        (200, 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', "interrupted"),
    ]:
        p = RemoteProvider(
            PROVIDERS["openai"],
            lambda **kw: httpx.AsyncClient(
                transport=httpx.MockTransport(
                    lambda req: httpx.Response(status, text=text)
                ),
                **kw,
            ),
        )
        with pytest.raises(ProviderError) as err:
            [e async for e in p.stream(m)]
        assert err.value.category == category and "secret" not in str(err.value)
