"""Capability-driven speech adapters. Requests never accept provider URLs or secrets."""

from __future__ import annotations
import base64
import io
import json
import os
import re
import wave
from dataclasses import dataclass, field
import httpx
from packages.audio.models import Generation


def control(label, default, minimum=None, maximum=None, choices=None, help=""):
    return dict(
        label=label,
        default=default,
        min=minimum,
        max=maximum,
        choices=choices,
        help=help,
    )


REGISTRY = {
    "openai": dict(
        name="OpenAI",
        env="OPENAI_API_KEY",
        models=["gpt-4o-mini-tts-2025-12-15", "gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
        voice="cedar",
        limit=3500,
        voices=[
            "cedar",
            "marin",
            "alloy",
            "ash",
            "ballad",
            "coral",
            "echo",
            "fable",
            "nova",
            "onyx",
            "sage",
            "shimmer",
            "verse",
        ],
        controls={
            "instructions": control(
                "Delivery Instructions",
                "Read faithfully, clearly and conversationally.",
            ),
            "speed": control("Speaking Speed", 1.0, 0.25, 4.0),
            "response_format": control(
                "Output Format",
                "wav",
                choices=["wav", "mp3", "flac", "opus", "aac", "pcm"],
            ),
        },
        docs="https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create",
    ),
    "elevenlabs": dict(
        name="ElevenLabs",
        env="ELEVENLABS_API_KEY",
        models=[
            "eleven_multilingual_v2",
            "eleven_v3",
            "eleven_flash_v2_5",
            "eleven_turbo_v2_5",
        ],
        voice="JBFqnCBsd6RMkjVDRZzb",
        limit=3000,
        voices=[],
        controls={
            "stability": control("Stability", 0.5, 0, 1),
            "similarity_boost": control("Voice Similarity", 0.75, 0, 1),
            "style": control("Style", 0.0, 0, 1),
            "use_speaker_boost": control("Speaker Boost", True),
            "speed": control("Speaking Speed", 1.0, 0.7, 1.2),
            "seed": control("Seed (Optional)", ""),
            "language_code": control("Language (Optional)", ""),
            "apply_text_normalization": control(
                "Text Normalization", "auto", choices=["auto", "on", "off"]
            ),
            "pronunciation_dictionary_locators": control(
                "Pronunciation Dictionaries (JSON)", "[]"
            ),
            "previous_text": control("Previous Text", ""),
            "next_text": control("Next Text", ""),
            "output_format": control(
                "Output Format",
                "mp3_44100_128",
                choices=["mp3_44100_128", "pcm_24000", "pcm_44100", "wav_44100"],
            ),
        },
        docs="https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps",
    ),
    "cartesia": dict(
        name="Cartesia",
        env="CARTESIA_API_KEY",
        models=["sonic-3.6", "sonic-3.5", "sonic-3"],
        voice="694f9389-aac1-45b6-b726-9d9369183238",
        limit=3000,
        voices=[],
        controls={
            "speed": control("Speaking Speed", 1.0, 0.6, 2.0),
            "volume": control("Generation Volume", 1.0, 0.5, 2.0),
            "language": control("Language", "en"),
            "emotion": control("Emotion (Sonic 3)", ""),
            "normalization": control("Normalization", "auto", choices=["auto", "off"]),
            "pronunciation_dict_id": control("Pronunciation Dictionary ID", ""),
            "sample_rate": control("Sample Rate", 44100, choices=[24000, 44100, 48000]),
            "add_phoneme_timestamps": control("Phoneme Timings", False),
        },
        docs="https://docs.cartesia.ai/api-reference/tts/sse",
    ),
    "gemini": dict(
        name="Gemini",
        env="GEMINI_API_KEY",
        models=[
            "gemini-3.8-flash-tts",
            "gemini-3.8-flash-lite-tts",
            "gemini-2.5-flash-preview-tts",
            "gemini-2.5-pro-preview-tts",
        ],
        voice="Kore",
        limit=3000,
        voices=["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"],
        controls={
            "style": control("Delivery Style", "Clear and conversational"),
            "speakers": control(
                "Speaker Assignments (JSON)",
                "[]",
                help='Optional [{"speaker":"Narrator","voice":"Kore"}]. Use Speaker: text lines for dialogue.',
            ),
        },
        docs="https://ai.google.dev/gemini-api/docs/speech-generation",
    ),
}


def controls_for(provider, model):
    controls = dict(REGISTRY[provider]["controls"])
    if provider == "openai" and model.startswith("tts-1"):
        controls.pop("instructions")
    if provider == "elevenlabs":
        if model == "eleven_v3":
            controls.pop("use_speaker_boost")
        if model == "eleven_multilingual_v2":
            controls.pop("language_code")
    if provider == "cartesia" and model != "sonic-3":
        controls.pop("emotion")
    return controls


def capabilities():
    return [
        {
            "id": name,
            **{k: v for k, v in cfg.items() if k != "env"},
            "available": bool(os.getenv(cfg["env"])),
            "model_controls": {m: controls_for(name, m) for m in cfg["models"]},
        }
        for name, cfg in REGISTRY.items()
    ]


def validate(spec: Generation):
    cfg = REGISTRY[spec.provider]
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,150}", spec.voice):
        raise ValueError("Invalid voice identifier")
    if spec.model not in cfg["models"]:
        raise ValueError("Choose a model from this adapter's supported catalog")
    supported = controls_for(spec.provider, spec.model)
    if set(spec.settings) - supported.keys():
        raise ValueError("Settings include a control unsupported by this model")
    for key, value in spec.settings.items():
        c = supported[key]
        if c["choices"] is not None and value not in c["choices"]:
            raise ValueError(f"Unsupported {key}")
        if c["min"] is not None and (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not c["min"] <= value <= c["max"]
        ):
            raise ValueError(f"Out-of-range {key}")
        if isinstance(c["default"], bool) and not isinstance(value, bool):
            raise ValueError(f"Expected boolean {key}")
        if (
            isinstance(c["default"], str)
            and key not in {"seed", "speakers", "pronunciation_dictionary_locators"}
            and not isinstance(value, str)
        ):
            raise ValueError(f"Expected text for {key}")
        if isinstance(value, str) and len(value) > 10000:
            raise ValueError("Setting is too long")
    if (
        spec.provider == "openai"
        and spec.model.startswith("tts-1")
        and spec.voice in {"cedar", "marin", "ballad", "verse"}
    ):
        raise ValueError("This voice requires a GPT speech model")
    if spec.provider == "elevenlabs" and spec.settings.get("seed", "") != "":
        if (
            not str(spec.settings["seed"]).isdigit()
            or not 0 <= int(spec.settings["seed"]) <= 4294967295
        ):
            raise ValueError("Seed must be an unsigned 32-bit integer")
    for key in ("speakers", "pronunciation_dictionary_locators"):
        if key in spec.settings:
            parsed = (
                json.loads(spec.settings[key])
                if isinstance(spec.settings[key], str)
                else spec.settings[key]
            )
            if not isinstance(parsed, list) or len(parsed) > (
                2 if key == "speakers" else 3
            ):
                raise ValueError("Invalid speaker/dictionary list")
            required = (
                {"speaker", "voice"}
                if key == "speakers"
                else {"pronunciation_dictionary_id", "version_id"}
            )
            if any(
                not isinstance(x, dict)
                or set(x) != required
                or any(
                    not isinstance(v, str) or not v or len(v) > 150 for v in x.values()
                )
                for x in parsed
            ):
                raise ValueError("Invalid speaker/dictionary entry")
    return spec


def chunks(text, limit):
    """Partition text exactly; offsets preserve the original text even across chunks."""
    start = 0
    while start < len(text):
        end = min(len(text), start + limit)
        if end < len(text):
            boundary = max(
                text.rfind("\n", start, end),
                text.rfind(". ", start, end),
                text.rfind("? ", start, end),
                text.rfind("! ", start, end),
            )
            if boundary <= start + limit // 3:
                boundary = text.rfind(" ", start, end)
            if boundary > start + limit // 3:
                end = boundary + 1
        yield start, text[start:end]
        start = end


def chunk_request_text(spec, source, start, part):
    """Retain speaker context when a long dialogue turn crosses request boundaries."""
    speakers = spec.settings.get("speakers", [])
    if spec.provider != "gemini" or not speakers or not start:
        return part
    if isinstance(speakers, str):
        speakers = json.loads(speakers)
    names = {entry["speaker"] for entry in speakers}
    if part.lstrip().partition(":")[0] in names:
        return part
    matches = [
        m
        for m in re.finditer(r"(?m)^([^:\n]+):", source[:start])
        if m.group(1) in names
    ]
    return matches[-1].group(1) + ": " + part if matches else part


def pcm_wav(data, rate):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(data)
    return buf.getvalue()


@dataclass
class Speech:
    audio: bytes
    extension: str = "wav"
    timing: dict = field(default_factory=dict)
    receipt: dict = field(default_factory=dict)


def request_for(spec, text):
    """Return a testable provider payload without credentials."""
    validate(spec)
    s = dict(spec.settings)
    p = spec.provider
    if p == "openai":
        return {
            "model": spec.model,
            "voice": {"id": spec.voice}
            if spec.voice.startswith("voice_")
            else spec.voice,
            "input": text,
            "response_format": "wav",
            **s,
        }
    if p == "elevenlabs":
        payload = dict(
            text=text,
            model_id=spec.model,
            voice_settings={
                k: s[k]
                for k in (
                    "stability",
                    "similarity_boost",
                    "style",
                    "use_speaker_boost",
                    "speed",
                )
                if k in s
            },
        )
        for k in (
            "language_code",
            "apply_text_normalization",
            "previous_text",
            "next_text",
        ):
            if s.get(k):
                payload[k] = s[k]
        if s.get("seed", "") != "":
            payload["seed"] = int(s["seed"])
        v = s.get("pronunciation_dictionary_locators", [])
        payload["pronunciation_dictionary_locators"] = (
            json.loads(v) if isinstance(v, str) else v
        )
        return payload
    if p == "cartesia":
        return dict(
            model_id=spec.model,
            transcript=text,
            voice={"mode": "id", "id": spec.voice}
            if spec.model == "sonic-3"
            else spec.voice,
            output_format=dict(
                container="raw",
                encoding="pcm_s16le",
                sample_rate=s.get("sample_rate", 44100),
            ),
            add_timestamps=True,
            add_phoneme_timestamps=s.get("add_phoneme_timestamps", False),
            language=s.get("language", "en"),
            normalization=s.get("normalization", "auto"),
            **(
                {"pronunciation_dict_id": s["pronunciation_dict_id"]}
                if s.get("pronunciation_dict_id")
                else {}
            ),
            generation_config={
                k: s[k]
                for k in ("speed", "volume", "emotion")
                if s.get(k) not in (None, "")
            },
        )
    speakers = s.get("speakers", [])
    speakers = json.loads(speakers) if isinstance(speakers, str) else speakers
    if spec.model.startswith("gemini-3"):
        content = [
            {
                "type": "text",
                "text": text,
                "annotations": [
                    {"type": "speech_metadata", "style": s.get("style", "")}
                ],
            }
        ]
        if speakers:
            content = []
            for line in text.splitlines():
                if not line.strip():
                    continue
                who, sep, words = line.partition(":")
                if not sep or who not in {x["speaker"] for x in speakers}:
                    raise ValueError(
                        "Dialogue lines must start with a configured speaker name and colon"
                    )
                content.append(
                    {
                        "type": "text",
                        "text": words.lstrip(),
                        "annotations": [
                            {
                                "type": "speech_metadata",
                                "speaker": who,
                                "style": s.get("style", ""),
                            }
                        ],
                    }
                )
        return dict(
            model=spec.model,
            input=[{"type": "user_input", "content": content}],
            response_format={"type": "audio"},
            generation_config={
                "speech_config": {"speakers": speakers}
                if speakers
                else [{"voice": spec.voice}]
            },
        )
    config = {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": spec.voice}}}
    if speakers:
        config = {
            "multiSpeakerVoiceConfig": {
                "speakerVoiceConfigs": [
                    {
                        "speaker": x["speaker"],
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {"voiceName": x["voice"]}
                        },
                    }
                    for x in speakers
                ]
            }
        }
    return {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Read the following verbatim. Delivery: {s.get('style', 'Clear')}\n\n{text}"
                    }
                ]
            }
        ],
        "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": config},
    }


async def synthesize(spec: Generation, text: str, client=None):
    payload = request_for(spec, text)
    key = os.getenv(REGISTRY[spec.provider]["env"])
    if not key:
        raise ValueError("Provider credential is not configured")
    own = client is None
    client = client or httpx.AsyncClient(timeout=180)
    try:
        p = spec.provider
        headers = {}
        if p == "openai":
            url = "https://api.openai.com/v1/audio/speech"
            headers = {"Authorization": f"Bearer {key}"}
        elif p == "elevenlabs":
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{spec.voice}/with-timestamps"
            headers = {"xi-api-key": key}
        elif p == "cartesia":
            url = "https://api.cartesia.ai/tts/sse"
            headers = {
                "Authorization": f"Bearer {key}",
                "Cartesia-Version": "2026-08-14"
                if spec.model != "sonic-3"
                else "2025-04-16",
            }
        else:
            url = "https://generativelanguage.googleapis.com/v1beta/" + (
                "interactions"
                if spec.model.startswith("gemini-3")
                else f"models/{spec.model}:generateContent"
            )
            headers = {"x-goog-api-key": key}
        params = (
            {"output_format": spec.settings.get("output_format", "mp3_44100_128")}
            if p == "elevenlabs"
            else None
        )
        response = await client.post(url, headers=headers, json=payload, params=params)
        if response.status_code >= 400:
            raise ValueError(
                f"{REGISTRY[p]['name']} returned HTTP {response.status_code}; check model access, quota, and settings"
            )
        receipt = dict(
            provider=p,
            model=spec.model,
            request_id=response.headers.get(
                "x-request-id", response.headers.get("request-id", "")
            ),
            settings=spec.settings,
            api_version=headers.get(
                "Cartesia-Version", "v1beta" if p == "gemini" else "v1"
            ),
            usage={
                k: response.headers[k]
                for k in ("character-cost", "x-character-count", "x-usage-tokens")
                if k in response.headers
            },
            request=payload,
        )
        if p == "openai":
            fmt = payload["response_format"]
            return Speech(
                pcm_wav(response.content, 24000) if fmt == "pcm" else response.content,
                "wav" if fmt == "pcm" else fmt,
                receipt=receipt,
            )
        if p == "elevenlabs":
            data = response.json()
            audio = base64.b64decode(data["audio_base64"])
            fmt = spec.settings.get("output_format", "mp3_44100_128")
            if fmt.startswith("pcm_"):
                audio = pcm_wav(audio, int(fmt.split("_")[1]))
            return Speech(
                audio,
                "mp3" if fmt.startswith("mp3") else "wav",
                {
                    k: data[k]
                    for k in ("alignment", "normalized_alignment")
                    if k in data
                },
                receipt,
            )
        if p == "cartesia":
            audio = bytearray()
            events = []
            finished = False
            for line in response.text.splitlines():
                if not line.startswith("data:"):
                    continue
                item = json.loads(line[5:].strip())
                if item.get("type") == "error" or item.get("error"):
                    raise ValueError("Cartesia stream failed")
                if item.get("data"):
                    audio.extend(base64.b64decode(item["data"]))
                if item.get("word_timestamps") or item.get("phoneme_timestamps"):
                    events.append(item)
                if item.get("done") or item.get("type") == "done":
                    finished = True
            if not audio or not finished:
                raise ValueError("Cartesia stream was incomplete")
            return Speech(
                pcm_wav(bytes(audio), spec.settings.get("sample_rate", 44100)),
                timing={"events": events},
                receipt=receipt,
            )
        data = response.json()
        receipt["usage"] = data.get("usageMetadata", data.get("usage", {}))
        if spec.model.startswith("gemini-3"):
            parts = [
                c
                for step in data.get("steps", [])
                if step.get("type") == "model_output"
                for c in step.get("content", [])
                if c.get("type") == "audio"
            ]
            if not parts:
                raise ValueError("Gemini returned no audio")
            part = parts[-1]
            raw = base64.b64decode(part["data"])
            return Speech(
                raw if raw[:4] == b"RIFF" else pcm_wav(raw, 24000), receipt=receipt
            )
        parts = [
            part
            for candidate in data.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
            if "inlineData" in part
        ]
        if not parts:
            raise ValueError("Gemini returned no audio")
        raw = b"".join(base64.b64decode(x["inlineData"]["data"]) for x in parts)
        return Speech(pcm_wav(raw, 24000), receipt=receipt)
    finally:
        if own:
            await client.aclose()


async def voices(provider):
    cfg = REGISTRY[provider]
    if provider in ("openai", "gemini"):
        return [{"id": v, "name": v.title()} for v in cfg["voices"]]
    key = os.getenv(cfg["env"])
    if not key:
        return []
    async with httpx.AsyncClient(timeout=30) as client:
        if provider == "elevenlabs":
            r = await client.get(
                "https://api.elevenlabs.io/v2/voices",
                headers={"xi-api-key": key},
                params={"page_size": 100},
            )
        else:
            r = await client.get(
                "https://api.cartesia.ai/voices",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Cartesia-Version": "2026-08-14",
                },
                params={"limit": 100},
            )
        if r.status_code >= 400:
            raise ValueError(f"Voice listing returned HTTP {r.status_code}")
        data = r.json()
        rows = (
            data if isinstance(data, list) else data.get("voices", data.get("data", []))
        )
        return [
            {"id": x.get("voice_id", x.get("id")), "name": x.get("name", "Voice")}
            for x in rows
        ]
