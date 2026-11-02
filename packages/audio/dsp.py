"""Offline DSP: immutable input, continuous automation, and explicit render receipts."""

from __future__ import annotations
import io
import math
import os
import subprocess
import tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from packages.audio.models import Source, Recipe, identity, now, digest
from packages.audio.effects import EFFECTS, validate_recipe

RATE = 48000


def command(args):
    result = subprocess.run(args, capture_output=True, timeout=600)
    if result.returncode:
        raise ValueError(f"{Path(args[0]).name} could not process this audio")
    return result.stdout


def decode(data, extension="wav"):
    with tempfile.TemporaryDirectory(prefix="machina-sound-") as directory:
        source = Path(directory) / ("source." + extension)
        target = Path(directory) / "decoded.wav"
        source.write_bytes(data)
        command(
            [
                os.getenv("MACHINA_FFMPEG", "ffmpeg"),
                "-v",
                "error",
                "-nostdin",
                "-i",
                str(source),
                "-t",
                "7201",
                "-ar",
                str(RATE),
                "-ac",
                "2",
                "-c:a",
                "pcm_f32le",
                str(target),
            ]
        )
        audio, rate = sf.read(target, dtype="float32", always_2d=True)
        if len(audio) / rate > 7200:
            raise ValueError("A single audio asset may not exceed two hours")
        if not len(audio) or not np.isfinite(audio).all():
            raise ValueError("Invalid or empty audio")
        return audio, rate


def wav(audio, rate=RATE):
    out = io.BytesIO()
    sf.write(out, audio, rate, format="WAV", subtype="FLOAT")
    return out.getvalue()


def measurements(audio, rate):
    mono = np.mean(audio, axis=1)
    stride = max(1, math.ceil(len(mono) / 1200))
    peaks = [
        round(float(np.max(np.abs(mono[i : i + stride]))), 5)
        for i in range(0, len(mono), stride)
    ]
    return dict(
        duration=len(audio) / rate,
        sample_rate=rate,
        channels=audio.shape[1],
        peaks=peaks,
        peak_db=round(float(20 * np.log10(max(1e-9, np.max(np.abs(audio))))), 2),
        rms_db=round(float(20 * np.log10(max(1e-9, np.sqrt(np.mean(audio**2))))), 2),
    )


def save_sample(
    store,
    title,
    source,
    audio,
    rate=RATE,
    original=None,
    extension="wav",
    receipt=None,
    timing=None,
):
    files = [store.blob(wav(audio, rate), "wav", "audio")]
    if original:
        files.append(store.blob(original, extension, "original"))
    record = dict(
        id=identity(),
        version=1,
        title=title,
        created=now(),
        source=source.model_dump(),
        text_hash=source.text_hash,
        files=files,
        **measurements(audio, rate),
        receipt=receipt or {},
        timing=timing or {},
        tags=[],
        notes="",
        favorite=False,
    )
    return store.save("samples", record)


def curve(lane, times, base):
    if not lane.points:
        return np.full_like(times, base, dtype=float)
    ts = [p.time for p in lane.points]
    vs = [p.value for p in lane.points]
    if lane.interpolation == "step":
        values = np.array(vs)[
            np.maximum(0, np.searchsorted(ts, times, side="right") - 1)
        ]
    else:
        values = np.interp(times, ts, vs)
    values = base + lane.depth * (values - base)
    if lane.smoothing and len(times) > 1:
        from scipy.signal import lfilter

        a = math.exp(-(times[1] - times[0]) / lane.smoothing)
        values, _ = lfilter([1 - a], [1, -a], values, zi=[values[0] * a])
    return values


def rubber(audio, rate, ratio=1, semitones=0, formant=True, points=None, time_map=None):
    with tempfile.TemporaryDirectory(prefix="machina-stretch-") as directory:
        root = Path(directory)
        src = root / "in.wav"
        dst = root / "out.wav"
        sf.write(src, audio, rate, subtype="FLOAT")
        args = [
            os.getenv("MACHINA_RUBBERBAND", "rubberband"),
            "-3",
            "-t",
            str(ratio),
            "-p",
            str(semitones),
        ]
        if formant:
            args += ["-F"]
        if points:
            (root / "pitch.txt").write_text(
                "\n".join(f"{int(t * rate)} {v}" for t, v in points)
            )
            args += ["--pitchmap", str(root / "pitch.txt")]
        if time_map:
            # R3 already anchors frame zero. Repeating (0, 0) creates a 0/0 ratio in its CLI.
            (root / "map.txt").write_text(
                "\n".join(
                    f"{int(a * rate)} {int(b * rate)}" for a, b in time_map if a > 0
                )
                + "\n"
            )
            args += ["--timemap", str(root / "map.txt")]
        command(args + [str(src), str(dst)])
        result, _ = sf.read(dst, dtype="float32", always_2d=True)
        expected = round(len(audio) * ratio)
        # The CLI compensates algorithmic latency; dynamic pitch can vary the final length.
        return np.pad(result, ((0, max(0, expected - len(result))), (0, 0)))[:expected]


def plugin_for(kind, p):
    import pedalboard as pb

    if kind == "chorus":
        return pb.Chorus(rate_hz=p["rate"], depth=p["depth"], mix=p["mix"])
    if kind == "phaser":
        return pb.Phaser(rate_hz=p["rate"], depth=p["depth"], mix=p["mix"])
    if kind == "delay":
        return pb.Delay(
            delay_seconds=p["seconds"], feedback=p["feedback"], mix=p["mix"]
        )
    if kind == "reverb":
        return pb.Reverb(
            room_size=p["size"],
            damping=p["damping"],
            wet_level=p["mix"],
            dry_level=1 - p["mix"],
        )
    if kind == "lowpass":
        return pb.LowpassFilter(cutoff_frequency_hz=p["frequency"])
    if kind == "highpass":
        return pb.HighpassFilter(cutoff_frequency_hz=p["frequency"])
    if kind == "eq":
        return pb.PeakFilter(
            cutoff_frequency_hz=p["frequency"], gain_db=p["gain"], q=p["q"]
        )
    if kind == "distortion":
        return pb.Distortion(drive_db=p["drive"])
    if kind == "bitcrush":
        return pb.Bitcrush(bit_depth=p["bits"])
    if kind == "compressor":
        return pb.Compressor(
            threshold_db=p["threshold"],
            ratio=p["ratio"],
            attack_ms=p["attack"],
            release_ms=p["release"],
        )
    if kind == "limiter":
        return pb.Limiter(threshold_db=p["threshold"])
    return None


ATTRIBUTES = {
    "rate": "rate_hz",
    "depth": "depth",
    "mix": "mix",
    "seconds": "delay_seconds",
    "feedback": "feedback",
    "size": "room_size",
    "damping": "damping",
    "frequency": "cutoff_frequency_hz",
    "gain": "gain_db",
    "q": "q",
    "drive": "drive_db",
    "bits": "bit_depth",
    "threshold": "threshold_db",
    "ratio": "ratio",
    "attack": "attack_ms",
    "release": "release_ms",
}


def apply_effect(audio, rate, effect, store):
    if not effect.enabled:
        return audio
    p = {
        k: v["default"] for k, v in EFFECTS[effect.kind]["params"].items()
    } | effect.params
    kind = effect.kind
    times = np.arange(len(audio)) / rate
    lanes = {a.parameter: a for a in effect.automation}
    if kind == "stretch":
        return rubber(audio, rate, ratio=p["ratio"])
    if kind == "pitch":
        lane = lanes.get("semitones")
        if lane:
            ts = np.arange(0, len(audio) / rate, 0.01)
            values = curve(lane, ts, p["semitones"])
            wet = rubber(
                audio,
                rate,
                semitones=0,
                formant=bool(p["formant"]),
                points=list(zip(ts, values)),
            )
        else:
            wet = rubber(
                audio, rate, semitones=p["semitones"], formant=bool(p["formant"])
            )
    elif kind == "convolution":
        from pedalboard import Convolution

        if not p.get("impulse_id"):
            raise ValueError("Choose an imported impulse-response sample")
        wet = Convolution(str(store.audio_path(p["impulse_id"])), mix=p["mix"])(
            audio.T.copy(), rate
        ).T
    elif kind in {"vibrato", "tremolo"}:
        rates = (
            curve(lanes["rate"], times, p["rate"])
            if "rate" in lanes
            else np.full(len(times), p["rate"])
        )
        depths = (
            curve(lanes["depth"], times, p["depth"])
            if "depth" in lanes
            else np.full(len(times), p["depth"])
        )
        phase = np.cumsum(rates) * 2 * np.pi / rate
        if kind == "tremolo":
            wet = audio * (1 - depths * (0.5 + 0.5 * np.sin(phase)))[:, None]
        else:
            indices = np.arange(len(audio))
            shifted = indices + depths * rate * np.sin(phase)
            wet = np.column_stack(
                [
                    np.interp(shifted, indices, audio[:, c], left=0, right=0)
                    for c in range(audio.shape[1])
                ]
            )
    else:
        plugin = plugin_for(kind, p)
        if lanes:
            block = 256
            wet = np.empty_like(audio)
            block_times = np.arange(0, len(audio), block) / rate
            values = {
                key: curve(lane, block_times, p[key]) for key, lane in lanes.items()
            }
            for idx, offset in enumerate(range(0, len(audio), block)):
                for key, value in values.items():
                    if key == "mix" and kind in {"distortion", "bitcrush"}:
                        continue
                    if key == "mix" and kind == "reverb":
                        plugin.wet_level = float(value[idx])
                        plugin.dry_level = 1 - float(value[idx])
                    else:
                        setattr(plugin, ATTRIBUTES[key], float(value[idx]))
                wet[offset : offset + block] = plugin(
                    audio[offset : offset + block].T.copy(), rate, reset=False
                ).T
        else:
            wet = plugin(audio.T.copy(), rate).T
        if kind in {"distortion", "bitcrush"}:
            mix = (
                curve(lanes["mix"], times, p["mix"])
                if "mix" in lanes
                else np.full(len(times), p["mix"])
            )
            wet = wet * mix[:, None] + audio * (1 - mix[:, None])
    # Fade the effect in/out at region boundaries without resetting its internal state.
    envelope = np.ones(len(audio))
    if effect.start:
        envelope *= np.clip((times - effect.start) / 0.02, 0, 1)
    if effect.end is not None:
        envelope *= np.clip((effect.end - times) / 0.02, 0, 1)
    return (audio * (1 - envelope[:, None]) + wet * envelope[:, None]).astype(
        np.float32
    )


def render(store, recipe: Recipe, progress=lambda value: None, cancelled=lambda: False):
    validate_recipe(recipe)
    layers = [
        layer
        for layer in recipe.layers
        if not layer.mute and (not any(x.solo for x in recipe.layers) or layer.solo)
    ]
    if not layers:
        raise ValueError("Add an audible layer before rendering")
    rate = recipe.sample_rate
    mix = np.zeros((0, 2), np.float32)
    sources = []
    for idx, layer in enumerate(layers):
        if cancelled():
            raise InterruptedError("Render cancelled")
        sample = store.get("samples", layer.sample_id)
        sources.append(sample["id"])
        for lane in layer.automation + [
            a for effect in layer.effects for a in effect.automation
        ]:
            if (
                lane.feature_track_id
                and store.get("features", lane.feature_track_id)["text_hash"]
                != sample["text_hash"]
            ):
                raise ValueError(
                    "Text feature mapping is stale; remap the current text before rendering"
                )
        audio, sr = sf.read(
            store.audio_path(layer.sample_id), dtype="float32", always_2d=True
        )
        if sr != rate:
            audio = resample_poly(
                audio, rate // math.gcd(sr, rate), sr // math.gcd(sr, rate), axis=0
            ).astype(np.float32)
        if audio.shape[1] == 1:
            audio = np.repeat(audio, 2, axis=1)
        # Envelope applies to the voice; append silence before reverbs/delays to preserve their tails.
        for n, reverse in [
            (int(layer.fade_in * rate), False),
            (int(layer.fade_out * rate), True),
        ]:
            n = min(n, len(audio))
            if n:
                fade = np.linspace(0, 1, n, dtype=np.float32)
                if reverse:
                    audio[-n:] *= fade[::-1, None]
                else:
                    audio[:n] *= fade[:, None]
        audio = np.pad(audio, ((0, int(recipe.tail * rate)), (0, 0)))
        for effect in layer.effects:
            if cancelled():
                raise InterruptedError("Render cancelled")
            audio = apply_effect(audio, rate, effect, store)
        times = np.arange(len(audio)) / rate
        gain = np.full(len(audio), layer.gain)
        pan = np.full(len(audio), layer.pan)
        for lane in layer.automation:
            if lane.parameter == "gain":
                gain = curve(lane, times, layer.gain)
            else:
                pan = curve(lane, times, layer.pan)
        audio *= (10 ** (gain / 20))[:, None]
        # StereoPanner equal-power crossfeed, matching the browser at center.
        left = audio[:, 0].copy()
        right = audio[:, 1].copy()
        negative = pan < 0
        audio[:, 0] = np.where(
            negative,
            left + right * np.cos((pan + 1) * np.pi / 2),
            left * np.cos(pan * np.pi / 2),
        )
        audio[:, 1] = np.where(
            negative,
            right * np.sin((pan + 1) * np.pi / 2),
            right + left * np.sin(pan * np.pi / 2),
        )
        offset = round(layer.offset * rate)
        length = offset + len(audio)
        if length > int(os.getenv("MACHINA_SOUND_MAX_RENDER_SECONDS", "7200")) * rate:
            raise ValueError("Render exceeds configured duration limit")
        if length > len(mix):
            mix = np.pad(mix, ((0, length - len(mix)), (0, 0)))
        mix[offset:length] += audio
        progress((idx + 1) / len(layers) * 0.9)
    mix *= 10 ** (recipe.master_gain / 20)
    before = measurements(mix, rate)
    if recipe.limiter:
        from pedalboard import Limiter

        mix = Limiter(threshold_db=-1)(mix.T.copy(), rate).T
        mix = np.clip(mix, -(10 ** (-1 / 20)), 10 ** (-1 / 20))
    if not np.isfinite(mix).all():
        raise ValueError("Render produced invalid samples")
    first = store.get("samples", layers[0].sample_id)
    hashes = {store.get("samples", layer.sample_id)["text_hash"] for layer in layers}
    source = (
        Source.model_validate(first["source"])
        if len(hashes) == 1
        else Source(title="Mixed Passages", kind="mix")
    )
    import importlib.metadata as md

    receipt = dict(
        kind="render",
        recipe=recipe.model_dump(),
        recipe_hash=digest(recipe.model_dump()),
        parents=sources,
        engine="pedalboard/rubberband",
        engine_version=md.version("pedalboard"),
        pre_limiter_peak_db=before["peak_db"],
        processing_rate=rate,
    )
    progress(1)
    return save_sample(store, "Rendered Mix", source, mix, rate, receipt=receipt)
