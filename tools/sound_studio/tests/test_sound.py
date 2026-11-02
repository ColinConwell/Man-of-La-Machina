"""Signal-level, persistence, job-recovery, and API-boundary acceptance tests."""

import io
import json
import threading
import pytest

pytest.importorskip("pedalboard")
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from packages.audio.models import (
    Source,
    Generation,
    Recipe,
    Layer,
    Effect,
    Automation,
    Point,
    Batch,
    Project,
)
from packages.audio import dsp, providers, analysis
from packages.audio.storage import Store, Remote
from packages.audio.effects import EFFECTS
from packages.audio.jobs import Queue
from tools.sound_studio.app import create_app, API


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "catalog")


def tone(store, seconds=1, frequency=220):
    x = 0.1 * np.sin(np.arange(int(48000 * seconds)) * 2 * np.pi * frequency / 48000)
    return dsp.save_sample(
        store,
        "Test Tone",
        Source(text="A hopeful morning. A difficult evening."),
        np.repeat(x[:, None], 2, axis=1).astype("float32"),
    )


def test_long_input_exact_coverage():
    text = ("An unusually long sentence with Unicode — café.\n" * 1000) + "z" * 9000
    parts = list(providers.chunks(text, 3500))
    assert "".join(t for _, t in parts) == text
    for start, part in parts:
        assert text[start : start + len(part)] == part
        assert len(part) <= 3500


@pytest.mark.parametrize("provider", providers.REGISTRY)
def test_payloads_and_model_controls(provider):
    cfg = providers.REGISTRY[provider]
    for model in cfg["models"]:
        settings = {
            k: c["default"] for k, c in providers.controls_for(provider, model).items()
        }
        voice = "alloy" if model.startswith("tts-1") else cfg["voice"]
        spec = Generation(
            provider=provider, model=model, voice=voice, settings=settings
        )
        payload = providers.request_for(spec, "A bounded test.")
        assert payload and "api_key" not in json.dumps(payload)
        with pytest.raises(ValueError):
            providers.validate(
                spec.model_copy(update={"settings": {"unsupported": True}})
            )
    if provider == "openai":
        with pytest.raises(ValueError):
            providers.validate(
                Generation(model="tts-1", voice="alloy", settings={"instructions": "x"})
            )
    if provider == "elevenlabs":
        with pytest.raises(ValueError):
            providers.validate(
                Generation(
                    provider=provider,
                    model="eleven_v3",
                    voice=cfg["voice"],
                    settings={"use_speaker_boost": True},
                )
            )


def test_feature_corrections_and_stale_text():
    source = Source(text="I love this beautiful day! This is terrible.")
    features = analysis.local_features(source)
    assert features["segments"][0]["values"]["sentiment"] > 0
    assert features["segments"][1]["values"]["sentiment"] < 0
    features["segments"][0]["values"]["sentiment"] = 0.2
    assert (
        analysis.validate_features(features, source)["segments"][0]["values"][
            "sentiment"
        ]
        == 0.2
    )
    with pytest.raises(ValueError):
        analysis.validate_features(
            features, source.model_copy(update={"text": "Changed."})
        )
    features["segments"][0]["values"]["sentiment"] = float("nan")
    with pytest.raises(ValueError):
        analysis.validate_features(features, source)


def test_automation_smoothing_depth():
    lane = Automation(
        parameter="gain",
        points=[Point(time=0, value=0), Point(time=0.5, value=1)],
        interpolation="step",
        smoothing=0.05,
        depth=0.5,
    )
    y = dsp.curve(lane, np.arange(1000) / 1000, 0)
    assert y[499] == 0 and 0 < y[500] < 0.02 and 0.49 < y[-1] <= 0.5


def test_pitch_duration_and_immutable_original(store):
    sample = tone(store, 2)
    original = store.audio_path(sample["id"]).read_bytes()
    recipe = Recipe(
        layers=[
            Layer(
                sample_id=sample["id"],
                gain=0,
                fade_in=0,
                fade_out=0,
                effects=[Effect(kind="pitch", params={"semitones": 12, "formant": 0})],
            )
        ],
        tail=0,
        limiter=False,
    )
    result = dsp.render(store, recipe)
    audio, rate = sf.read(store.audio_path(result["id"]))
    spectrum = np.abs(np.fft.rfft(audio[rate // 2 : rate * 3 // 2, 0]))
    assert abs(np.argmax(spectrum) - 440) < 3
    assert result["duration"] == pytest.approx(2, abs=0.002)
    assert store.audio_path(sample["id"]).read_bytes() == original
    assert result["receipt"]["parents"] == [sample["id"]]


def test_stereo_gain_tails_and_clipping(store):
    audio = np.zeros((4800, 2), np.float32)
    audio[100] = 0.5
    sample = dsp.save_sample(store, "Impulse", Source(text="Impulse."), audio)
    recipe = Recipe(
        layers=[
            Layer(
                sample_id=sample["id"],
                gain=0,
                fade_in=0,
                fade_out=0,
                effects=[
                    Effect(
                        kind="delay",
                        params={"seconds": 0.2, "feedback": 0.4, "mix": 0.5},
                    )
                ],
            )
        ],
        tail=1,
        limiter=False,
    )
    result = dsp.render(store, recipe)
    y, rate = sf.read(store.audio_path(result["id"]))
    assert np.max(abs(y[rate // 5 : rate // 2])) > 0.01
    assert result["duration"] == pytest.approx(1.1)
    recipe.layers[0].effects = []
    recipe.tail = 0
    dry = dsp.render(store, recipe)
    y, _ = sf.read(store.audio_path(dry["id"]))
    assert y[100, 0] == pytest.approx(0.5) and y[100, 1] == pytest.approx(0.5)
    recipe.layers *= 8
    recipe.limiter = True
    limited = dsp.render(store, recipe)
    assert limited["peak_db"] <= -0.99


@pytest.mark.parametrize("kind", EFFECTS)
def test_effect_finite_and_decodable(store, kind):
    sample = tone(store, 0.3)
    params = {k: v["default"] for k, v in EFFECTS[kind]["params"].items()}
    if kind == "convolution":
        params["impulse_id"] = sample["id"]
    out = dsp.render(
        store,
        Recipe(
            layers=[
                Layer(
                    sample_id=sample["id"], effects=[Effect(kind=kind, params=params)]
                )
            ],
            tail=0.05,
        ),
    )
    decoded, rate = dsp.decode(store.audio_path(out["id"]).read_bytes())
    assert rate == 48000 and decoded.shape[1] == 2 and np.isfinite(decoded).all()


def test_catalog_rebuild_and_dependency_deletion(store):
    sample = tone(store)
    project = Project(recipe=Recipe(layers=[Layer(sample_id=sample["id"])]))
    store.save("projects", project.model_dump())
    with pytest.raises(ValueError):
        store.delete_local(sample["id"])
    store.db.execute("DELETE FROM records")
    store.db.commit()
    store.rebuild()
    assert store.get("samples", sample["id"])["id"] == sample["id"]
    with pytest.raises(ValueError):
        store.path({"sha256": "../../secret", "extension": "wav"})


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.calls = []
        self.corrupt = False
        self.fail = False

    def put_object(self, **kw):
        if self.fail and "/objects/" in kw["Key"]:
            raise RuntimeError("Interrupted transfer")
        self.objects[kw["Key"]] = bytes(kw["Body"])
        self.calls.append(kw["Key"])

    def get_object(self, **kw):
        return {"Body": io.BytesIO(b"bad" if self.corrupt else self.objects[kw["Key"]])}

    def list_objects_v2(self, **kw):
        return {
            "Contents": [
                {"Key": k, "LastModified": str(i)}
                for i, k in enumerate(self.objects)
                if k.startswith(kw["Prefix"])
            ]
        }

    def delete_object(self, **kw):
        del self.objects[kw["Key"]]


def test_remote_roundtrip_checksum_and_prefix(store, tmp_path):
    sample = tone(store)
    features = analysis.local_features(Source.model_validate(sample["source"]))
    store.save("features", features)
    client = FakeS3()
    remote = Remote(store, client, "test")
    client.fail = True
    with pytest.raises(RuntimeError):
        remote.upload("samples", sample["id"])
    assert not any("/manifests/samples/" in k for k in client.objects)
    client.fail = False
    receipt = remote.upload("samples", sample["id"])
    assert all(k.startswith("sound-studio/v1/") for k in client.calls)
    other = Store(tmp_path / "other")
    download = Remote(other, client, "test")
    assert download.download(receipt["key"])["id"] == sample["id"]
    assert (
        other.audio_path(sample["id"]).read_bytes()
        == store.audio_path(sample["id"]).read_bytes()
    )
    assert other.list("features")[0]["text_hash"] == sample["text_hash"]
    client.corrupt = True
    with pytest.raises(ValueError):
        download.download(receipt["key"])
    with pytest.raises(ValueError):
        download.read_manifest("content/releases/anything.json")


def test_batch_distinct_limits_recovery_and_cancel(store):
    q = Queue(store, Remote(store), True)
    batch = Batch(
        sources=[Source(text="Same input.")], generations=[Generation()], repeats=3
    )
    result = q.batch_start(batch)
    assert len(set(result["job_ids"])) == 3
    q.action(result["job_ids"][0], "pause")
    q.action(result["job_ids"][1], "cancel")
    restarted = Queue(store, Remote(store), True)
    assert store.get("jobs", result["job_ids"][0])["status"] == "paused"
    assert store.get("jobs", result["job_ids"][1])["status"] == "cancelled"
    assert store.get("jobs", result["job_ids"][2])["status"] == "interrupted"
    restarted.action(result["job_ids"][2], "retry")
    with pytest.raises(ValueError):
        Batch(
            sources=batch.sources, generations=batch.generations, repeats=3, max_jobs=2
        )
    with pytest.raises(ValueError):
        Batch(sources=batch.sources, generations=batch.generations, max_characters=1)


@pytest.mark.asyncio
async def test_completed_job_survives_restart_and_partial_retry(store):
    q = Queue(store, Remote(store), True)
    job = q.submit(
        "generate",
        {
            "source": Source(text="A repeated take.").model_dump(),
            "generation": Generation().model_dump(),
        },
    )
    first = await q.execute(job, threading.Event())
    q.update(job["id"], status="complete", result=first)
    Queue(store, Remote(store), True)
    assert store.get("jobs", job["id"])["result"] == first
    part_job = store.get("jobs", job["id"])
    result = await q.execute(part_job, threading.Event())
    assert result["id"] != first["id"]
    assert len(store.get("jobs", job["id"])["parts"]) == 1


def test_api_origin_import_save_reload_and_export(tmp_path):
    with TestClient(create_app(tmp_path / "api", fixture=True)) as client:
        assert client.get("/healthz").json()["status"] == "ok"
        p = Project().model_dump()
        assert client.post(API + "/projects", json=p).status_code == 403
        h = {"X-Sound-Studio": "1"}
        assert (
            client.post(
                API + "/projects",
                json=p,
                headers={**h, "Origin": "https://foreign.example"},
            ).status_code
            == 403
        )
        saved = client.post(API + "/projects", json=p, headers=h).json()
        assert saved["revision"] == 1
        assert client.post(API + "/projects", json=p, headers=h).status_code == 409
        audio = np.zeros((4800, 1), np.float32)
        imported = client.post(
            API + "/samples/import",
            headers=h,
            files={"file": ("tone.wav", dsp.wav(audio))},
            data={"text": "A test.", "title": "Fixture"},
        ).json()
        response = client.get(
            API + "/samples/" + imported["id"] + "/audio",
            headers={"Range": "bytes=0-99"},
        )
        assert response.status_code == 206 and len(response.content) == 100
        assert (
            client.get(
                API + "/samples/" + imported["id"] + "/export?format=flac"
            ).status_code
            == 200
        )
        assert (
            client.get(API + "/samples/" + imported["id"] + "/spectrogram").status_code
            == 200
        )


def test_line_sentences_and_missing_alignment_words():
    assert len(analysis.sentences("A line\nAnother line.")) == 2
    words = [
        {"word": "A", "start": 0, "end": 0.1},
        {"word": "morning", "start": 0.5, "end": 1},
    ]
    assert analysis.attach_offsets(words, "A hopeful morning.") == [
        "Unaligned text: hopeful"
    ]


def test_dynamic_pitch_onset_and_time_map():
    rate = 48000
    x = np.zeros((rate * 2, 2), np.float32)
    x[24000:28800] = (0.2 * np.sin(np.arange(4800) * 2 * np.pi * 440 / rate))[:, None]
    y = dsp.rubber(x, rate, points=[(0, 0), (2, 0)])

    def start(z):
        return np.where(np.max(abs(z), axis=1) > 0.01)[0][0] / rate

    assert abs(start(y) - start(x)) < 0.02
    warped = dsp.rubber(x, rate, ratio=1.25, time_map=[(0, 0), (2, 2.5)])
    assert len(warped) == int(rate * 2.5)
    assert abs(start(warped) - 0.625) < 0.05


def test_remote_delete_protects_projects_shared_objects_and_foreign_prefix(store):
    a = tone(store)
    b = tone(store)
    client = FakeS3()
    client.objects["content/releases/protected.json"] = b"private-release"
    remote = Remote(store, client, "test")
    remote.upload("samples", a["id"])
    remote.upload("samples", b["id"])
    project = Project(recipe=Recipe(layers=[Layer(sample_id=a["id"])]))
    store.save("projects", project.model_dump())
    remote.upload("projects", project.id)
    with pytest.raises(ValueError):
        remote.delete(a["id"], True)
    result = remote.delete(b["id"], True)
    assert result["deleted_objects"] == 0
    assert client.objects[remote.object_key(a["files"][0])]
    assert client.objects["content/releases/protected.json"] == b"private-release"


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", providers.REGISTRY)
async def test_provider_response_fixtures(provider, monkeypatch):
    import base64
    import httpx

    cfg = providers.REGISTRY[provider]
    monkeypatch.setenv(cfg["env"], "fixture-credential")
    spec = Generation(provider=provider, model=cfg["models"][0], voice=cfg["voice"])
    pcm = b"\0\0" * 2400
    encoded = base64.b64encode(pcm).decode()
    alignment = {
        "characters": ["H", "i"],
        "character_start_times_seconds": [0, 0.05],
        "character_end_times_seconds": [0.05, 0.1],
    }

    def respond(request):
        assert request.method == "POST"
        payload = json.loads(request.content)
        if provider == "openai":
            assert payload["input"] == "Hi" and payload["voice"] == "cedar"
            return httpx.Response(
                200,
                content=providers.pcm_wav(pcm, 24000),
                headers={"x-request-id": "fixture-id"},
            )
        if provider == "elevenlabs":
            assert payload["model_id"] == spec.model
            return httpx.Response(
                200,
                json={
                    "audio_base64": base64.b64encode(
                        providers.pcm_wav(pcm, 24000)
                    ).decode(),
                    "alignment": alignment,
                    "normalized_alignment": alignment,
                },
            )
        if provider == "cartesia":
            assert isinstance(payload["voice"], str) and payload["add_timestamps"]
            return httpx.Response(
                200,
                text="data: "
                + json.dumps({"type": "chunk", "data": encoded})
                + "\n\ndata: "
                + json.dumps(
                    {
                        "type": "timestamps",
                        "word_timestamps": {
                            "words": ["Hi"],
                            "start": [0],
                            "end": [0.1],
                        },
                    }
                )
                + '\n\ndata: {"type":"done","done":true}\n',
            )
        assert payload["model"] == spec.model
        return httpx.Response(
            200,
            json={
                "steps": [
                    {
                        "type": "model_output",
                        "content": [{"type": "audio", "data": encoded}],
                    }
                ],
                "usage": {"total_tokens": 12},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        response = await providers.synthesize(spec, "Hi", client)
    audio, rate = dsp.decode(response.audio, response.extension)
    assert rate == 48000 and len(audio) > 0 and np.isfinite(audio).all()
    assert "fixture-credential" not in json.dumps(response.receipt)
    if provider == "elevenlabs":
        assert response.timing["alignment"] == alignment
    if provider == "gemini":
        assert response.receipt["usage"]["total_tokens"] == 12


@pytest.mark.asyncio
async def test_provider_error_is_sanitized_and_not_retried(monkeypatch):
    import httpx

    monkeypatch.setenv("OPENAI_API_KEY", "fixture-key")
    calls = []

    def failure(request):
        calls.append(request)
        return httpx.Response(429, json={"error": "private text and credential detail"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(failure)) as client:
        with pytest.raises(ValueError, match="HTTP 429") as error:
            await providers.synthesize(Generation(), "Hi", client)
    assert len(calls) == 1 and "private text" not in str(error.value)


def test_long_dialogue_retains_speaker_context_without_losing_source_spans():
    spec = Generation(
        provider="gemini",
        model="gemini-3.8-flash-tts",
        voice="Kore",
        settings={"speakers": '[{"speaker":"Narrator","voice":"Kore"}]'},
    )
    source = "Narrator: " + ("A long, hopeful thought. " * 300)
    parts = list(providers.chunks(source, 3000))
    assert "".join(part for _, part in parts) == source
    for start, part in parts:
        payload = providers.request_for(
            spec, providers.chunk_request_text(spec, source, start, part)
        )
        assert (
            payload["input"][0]["content"][0]["annotations"][0]["speaker"] == "Narrator"
        )
