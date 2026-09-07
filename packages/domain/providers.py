"""Provider-neutral streaming protocol with native Anthropic/Gemini adapters."""

from __future__ import annotations
import asyncio
from dataclasses import dataclass
import json
import os
import re
from typing import AsyncIterator, Protocol
import httpx
from packages.domain.models import Manifest


@dataclass(frozen=True)
class ProviderEvent:
    type: str
    text: str = ""
    metadata: dict | None = None


class GenerationProvider(Protocol):
    async def stream(self, manifest: Manifest) -> AsyncIterator[ProviderEvent]: ...


class ProviderError(Exception):
    def __init__(self, category: str, message: str):
        self.category = category
        super().__init__(message)


PROVIDERS = {
    "demo": dict(
        name="Deterministic demo",
        env=None,
        adapter="demo",
        model="documentary-demo-v1",
        url="",
    ),
    "openai": dict(
        name="OpenAI",
        env="OPENAI_API_KEY",
        adapter="chat",
        model="gpt-4.1-mini",
        url="https://api.openai.com/v1",
    ),
    "anthropic": dict(
        name="Anthropic",
        env="ANTHROPIC_API_KEY",
        adapter="anthropic",
        model="claude-sonnet-4-6",
        url="https://api.anthropic.com/v1",
    ),
    "gemini": dict(
        name="Google Gemini",
        env="GEMINI_API_KEY",
        adapter="gemini",
        model="gemini-2.5-flash",
        url="https://generativelanguage.googleapis.com/v1beta",
    ),
    "xai": dict(
        name="xAI",
        env="XAI_API_KEY",
        adapter="chat",
        model="grok-4.20-0309-non-reasoning",
        url="https://api.x.ai/v1",
    ),
    "openrouter": dict(
        name="OpenRouter",
        env="OPENROUTER_API_KEY",
        adapter="chat",
        model="openai/gpt-4.1-mini",
        url="https://openrouter.ai/api/v1",
    ),
}


def registry():
    configs = {k: dict(v) for k, v in PROVIDERS.items()}
    if os.getenv("MACHINA_LOCAL_BASE_URL"):
        configs["local"] = dict(
            name="Local compatible endpoint",
            env="MACHINA_LOCAL_API_KEY",
            adapter="chat",
            model=os.getenv("MACHINA_LOCAL_MODEL", "local-model"),
            url=os.environ["MACHINA_LOCAL_BASE_URL"],
        )
    return configs


def capabilities():
    return [
        dict(
            id=k,
            name=v["name"],
            adapter=v["adapter"],
            default_model=os.getenv("MACHINA_" + k.upper() + "_MODEL", v["model"]),
            available=k in ("demo", "local") or bool(os.getenv(v["env"] or "")),
        )
        for k, v in registry().items()
    ]


def validate_settings(settings):
    cfg = registry().get(settings.provider)
    if not cfg:
        raise ValueError("Unknown provider")
    if settings.provider not in ("demo", "local") and not os.getenv(cfg["env"]):
        raise ValueError("This provider has no configured server credential")
    if not re.fullmatch(r"[a-zA-Z0-9_./:@+-]{1,150}", settings.model):
        raise ValueError("Invalid model ID")
    if settings.provider == "demo" and settings.model != "documentary-demo-v1":
        raise ValueError("Unknown demo model")


class DemoProvider:
    async def stream(self, manifest):
        history = [i for i in manifest.items if i.origin == "historical"]
        current = next(
            (i.body for i in reversed(manifest.items) if i.role == "user"), ""
        )
        practical = any("practical" in i.tags for i in history)
        response = (
            "You are holding several possibilities open. "
            + (
                "The practical details in this context suggest separating where to rest tonight from the larger journey. "
                if practical
                else "With less of the earlier detail available, I would first ask what constraints matter most to you now. "
            )
            + "What would make the next small decision feel deliberate?\n\n"
            + "You wrote: “"
            + current[:200]
            + "”\n\n"
            + f"This is a deterministic demonstration using {len(history)} historical turns. A live provider will produce its own response to this exact context."
        )
        for part in re.findall(r"\S+\s*", response):
            await asyncio.sleep(0.014)
            yield ProviderEvent("delta", part)
        yield ProviderEvent(
            "metadata",
            metadata={
                "resolved_model": "documentary-demo-v1",
                "finish_reason": "stop",
                "safety_outcome": "not_evaluated_demo",
            },
        )


def request_payload(manifest: Manifest, cfg: dict):
    s = manifest.settings
    system = "\n\n".join(i.body for i in manifest.items if i.role == "system")
    messages = [
        {"role": i.role, "content": i.body}
        for i in manifest.items
        if i.role != "system"
    ]
    # Native APIs can merge consecutive same-role messages; text and order are unchanged.
    if cfg["adapter"] == "anthropic":
        merged = []
        for m in messages:
            if merged and merged[-1]["role"] == m["role"]:
                merged[-1]["content"].append({"type": "text", "text": m["content"]})
            else:
                merged.append(
                    {
                        "role": m["role"],
                        "content": [{"type": "text", "text": m["content"]}],
                    }
                )
        # Context can begin with a recorded companion. Represent it as a clearly labeled document, without fabricating a visitor turn.
        if merged and merged[0]["role"] == "assistant":
            merged[0] = {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "[Recorded companion context]\n" + p["text"],
                    }
                    for p in merged[0]["content"]
                ],
            }
        payload = {
            "model": s.model,
            "system": system,
            "messages": merged,
            "max_tokens": s.max_output_tokens,
            "stream": True,
        }
        if s.temperature is not None:
            payload["temperature"] = s.temperature
        return cfg["url"] + "/messages", payload
    if cfg["adapter"] == "gemini":
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
        ]
        config = {"maxOutputTokens": s.max_output_tokens}
        if s.temperature is not None:
            config["temperature"] = s.temperature
        # Disable optional internal thinking for the default Flash to reserve output for visible dialogue.
        if s.model.startswith("gemini-2.5-flash"):
            config["thinkingConfig"] = {"thinkingBudget": 0}
        return cfg[
            "url"
        ] + "/models/" + s.model + ":streamGenerateContent?alt=sse", dict(
            systemInstruction={"parts": [{"text": system}]},
            contents=contents,
            generationConfig=config,
        )
    payload = {
        "model": s.model,
        "messages": [{"role": "system", "content": system}] + messages,
        "stream": True,
    }
    limit_key = (
        "max_completion_tokens"
        if manifest.settings.provider == "openai"
        else "max_tokens"
    )
    payload[limit_key] = s.max_output_tokens
    if manifest.settings.provider == "openai":
        payload["store"] = False
    if s.temperature is not None:
        payload["temperature"] = s.temperature
    return cfg["url"] + "/chat/completions", payload


class RemoteProvider:
    def __init__(self, cfg, client_factory=None):
        self.cfg = cfg
        self.client_factory = client_factory or httpx.AsyncClient

    async def stream(self, manifest):
        cfg = self.cfg
        key = os.getenv(cfg["env"], "")
        url, payload = request_payload(manifest, cfg)
        headers = {"Content-Type": "application/json", "Authorization": "Bearer " + key}
        if cfg["adapter"] == "anthropic":
            headers = {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
        if cfg["adapter"] == "gemini":
            headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
        seen = False
        finished = False
        try:
            async with self.client_factory(
                timeout=httpx.Timeout(90, connect=15)
            ) as client:
                async with client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code >= 400:
                        category = {
                            401: "authentication",
                            403: "permission",
                            429: "rate_limit",
                            400: "invalid_request",
                            404: "model_unavailable",
                        }.get(response.status_code, "provider_failure")
                        raise ProviderError(
                            category,
                            f"Provider returned HTTP {response.status_code}. Check model access and server configuration; no historical text was changed.",
                        )
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            finished = True
                            continue
                        if not raw:
                            continue
                        data = json.loads(raw)
                        if data.get("error") or data.get("type") == "error":
                            raise ProviderError(
                                "provider_failure",
                                "The provider reported a streaming error.",
                            )
                        if cfg["adapter"] == "anthropic":
                            typ = data.get("type")
                            if (
                                typ == "content_block_delta"
                                and data.get("delta", {}).get("type") == "text_delta"
                            ):
                                seen = True
                                yield ProviderEvent("delta", data["delta"]["text"])
                            elif typ == "message_start":
                                yield ProviderEvent(
                                    "metadata",
                                    metadata={
                                        "resolved_model": data["message"].get("model"),
                                        "provider_request_id": data["message"].get(
                                            "id"
                                        ),
                                    },
                                )
                            elif typ == "message_delta":
                                finish = data.get("delta", {}).get("stop_reason")
                                if finish == "refusal":
                                    raise ProviderError(
                                        "refusal",
                                        "The present provider declined this continuation.",
                                    )
                                yield ProviderEvent(
                                    "metadata",
                                    metadata={
                                        "finish_reason": finish,
                                        "usage": data.get("usage"),
                                    },
                                )
                            elif typ == "message_stop":
                                finished = True
                        elif cfg["adapter"] == "gemini":
                            if data.get("promptFeedback", {}).get("blockReason"):
                                raise ProviderError(
                                    "refusal",
                                    "The present provider blocked this continuation.",
                                )
                            for candidate in data.get("candidates", []):
                                finish = candidate.get("finishReason")
                                if finish in (
                                    "SAFETY",
                                    "RECITATION",
                                    "BLOCKLIST",
                                    "PROHIBITED_CONTENT",
                                ):
                                    raise ProviderError(
                                        "refusal",
                                        "The present provider declined this continuation.",
                                    )
                                for part in candidate.get("content", {}).get(
                                    "parts", []
                                ):
                                    if part.get("text") and not part.get("thought"):
                                        seen = True
                                        yield ProviderEvent("delta", part["text"])
                                if finish:
                                    finished = True
                                    yield ProviderEvent(
                                        "metadata",
                                        metadata={
                                            "finish_reason": finish,
                                            "usage": data.get("usageMetadata"),
                                            "resolved_model": data.get(
                                                "modelVersion", manifest.settings.model
                                            ),
                                        },
                                    )
                        else:
                            if data.get("model"):
                                yield ProviderEvent(
                                    "metadata",
                                    metadata={
                                        "resolved_model": data["model"],
                                        "provider_request_id": data.get("id"),
                                    },
                                )
                            for choice in data.get("choices", []):
                                delta = choice.get("delta", {})
                                if (
                                    delta.get("refusal")
                                    or choice.get("finish_reason") == "content_filter"
                                ):
                                    raise ProviderError(
                                        "refusal",
                                        "The present provider declined this continuation.",
                                    )
                                if delta.get("content"):
                                    seen = True
                                    yield ProviderEvent("delta", delta["content"])
                                if choice.get("finish_reason"):
                                    finished = True
                                    yield ProviderEvent(
                                        "metadata",
                                        metadata={
                                            "finish_reason": choice["finish_reason"]
                                        },
                                    )
            if not seen:
                raise ProviderError(
                    "empty_output",
                    "The provider returned no visible text. Try another model or a larger output budget.",
                )
            if not finished:
                raise ProviderError(
                    "interrupted", "The provider stream ended before completion."
                )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                "timeout",
                "The provider timed out. You can retry or return to the record.",
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                "network",
                "The provider could not be reached. You can retry or use demo mode.",
            ) from exc


def get_provider(settings) -> GenerationProvider:
    validate_settings(settings)
    return (
        DemoProvider()
        if settings.provider == "demo"
        else RemoteProvider(registry()[settings.provider])
    )
