"""Effect definitions shared by validation, rendering, and explanatory controls."""

from packages.audio.models import Recipe


def knob(label, default, low, high, unit="", step=0.01):
    return dict(label=label, default=default, min=low, max=high, unit=unit, step=step)


def definition(name, explanation, params, live=True):
    return dict(
        name=name,
        explanation=explanation,
        params=params,
        live=live,
        preview="Live preview uses Web Audio; render uses the backend algorithm."
        if live
        else "Render this effect before auditioning; no silent live approximation.",
    )


EFFECTS = {
    "pitch": definition(
        "Pitch Shift",
        "Moves harmonics up or down without intentionally changing duration. Formant preservation retains the broad resonances associated with vocal identity; it is not voice cloning.",
        {
            "semitones": knob("Pitch", 0, -24, 24, "st", 0.1),
            "formant": knob("Preserve Formants", 1, 0, 1, "", 1),
        },
        False,
    ),
    "stretch": definition(
        "Time Stretch",
        "Changes duration while preserving pitch. A ratio of 1.25 makes the passage 25% longer. Alignment uses a changing ratio anchored to spoken words.",
        {"ratio": knob("Duration Ratio", 1, 0.5, 2, "×")},
        False,
    ),
    "chorus": definition(
        "Chorus / Doubling",
        "Blends the voice with short, continuously varying delayed copies. Small delay changes create small pitch differences; depth and mix determine how many voices you perceive.",
        {
            "rate": knob("Rate", 0.7, 0.05, 8, "Hz"),
            "depth": knob("Depth", 0.25, 0, 1),
            "mix": knob("Wet Mix", 0.35, 0, 1),
        },
    ),
    "vibrato": definition(
        "Vibrato",
        "Periodically changes pitch using a modulated delay. Unlike tremolo, it changes the timing of the waveform rather than simply its amplitude.",
        {
            "rate": knob("Rate", 4, 0.1, 12, "Hz"),
            "depth": knob("Delay Excursion", 0.002, 0, 0.008, "s", 0.0001),
        },
    ),
    "tremolo": definition(
        "Tremolo",
        "An oscillator multiplies the amplitude of the voice. The waveform grows and shrinks without shifting its fundamental pitch.",
        {"rate": knob("Rate", 3, 0.05, 20, "Hz"), "depth": knob("Depth", 0.3, 0, 1)},
    ),
    "phaser": definition(
        "Phaser",
        "A moving series of phase shifts is mixed with the original. Interference produces notches in the spectrum that sweep through the voice.",
        {
            "rate": knob("Rate", 0.5, 0.05, 8, "Hz"),
            "depth": knob("Depth", 0.4, 0, 1),
            "mix": knob("Wet Mix", 0.3, 0, 1),
        },
    ),
    "delay": definition(
        "Delay",
        "Adds a delayed copy. Feedback sends some output back through the delay, making repeated echoes; wet mix controls their prominence.",
        {
            "seconds": knob("Delay", 0.25, 0.01, 2, "s"),
            "feedback": knob("Feedback", 0.25, 0, 0.85),
            "mix": knob("Wet Mix", 0.25, 0, 1),
        },
    ),
    "reverb": definition(
        "Reverb",
        "A dense field of decaying reflections creates the impression of space. Room size changes the reflection pattern; wet mix sets the voice's apparent distance.",
        {
            "size": knob("Room Size", 0.5, 0, 1),
            "damping": knob("Damping", 0.5, 0, 1),
            "mix": knob("Wet Mix", 0.25, 0, 1),
        },
    ),
    "convolution": definition(
        "Convolution",
        "Combines the voice with an impulse response: the measured or designed response of a space. Import an audio sample as the impulse; the effect is rendered on the backend.",
        {"mix": knob("Wet Mix", 0.25, 0, 1)},
        False,
    ),
    "lowpass": definition(
        "Low-Pass Filter",
        "Attenuates frequencies above the cutoff. Moving the cutoff down removes brightness and can make a voice sound distant or enclosed.",
        {"frequency": knob("Cutoff", 4500, 80, 18000, "Hz", 10)},
    ),
    "highpass": definition(
        "High-Pass Filter",
        "Attenuates frequencies below the cutoff. Raising it removes low-frequency body and rumble.",
        {"frequency": knob("Cutoff", 120, 20, 10000, "Hz", 10)},
    ),
    "eq": definition(
        "Peak EQ",
        "Boosts or cuts a band around a center frequency. Q controls bandwidth: a higher Q concentrates the change into a narrower region.",
        {
            "frequency": knob("Center", 1500, 40, 18000, "Hz", 10),
            "gain": knob("Gain", 0, -18, 18, "dB", 0.1),
            "q": knob("Q", 1, 0.1, 10),
        },
    ),
    "distortion": definition(
        "Distortion",
        "A nonlinear amplitude curve adds harmonics. Drive increases the nonlinear change; compare at similar loudness to avoid confusing loudness with timbre.",
        {
            "drive": knob("Drive", 6, 0, 36, "dB", 0.1),
            "mix": knob("Wet Mix", 0.3, 0, 1),
        },
    ),
    "bitcrush": definition(
        "Bitcrush",
        "Reduces the number of amplitude levels. Quantization error introduces a gritty texture; fewer bits produce a stronger change.",
        {
            "bits": knob("Bit Depth", 10, 2, 16, "bits", 1),
            "mix": knob("Wet Mix", 0.4, 0, 1),
        },
    ),
    "compressor": definition(
        "Compressor",
        "Reduces gain when the signal exceeds a threshold. Ratio sets the strength; attack and release control how quickly the gain responds.",
        {
            "threshold": knob("Threshold", -18, -60, 0, "dB", 0.1),
            "ratio": knob("Ratio", 3, 1, 20),
            "attack": knob("Attack", 10, 0.1, 100, "ms"),
            "release": knob("Release", 100, 10, 1000, "ms", 1),
        },
    ),
    "limiter": definition(
        "Limiter",
        "A high-ratio dynamics processor restrains peaks. The master limiter is a separate final stage; neither stage changes the saved original recording.",
        {"threshold": knob("Ceiling", -1, -24, 0, "dB", 0.1)},
    ),
}


def validate_recipe(recipe: Recipe):
    for layer in recipe.layers:
        for lane in layer.automation:
            if lane.parameter not in {"gain", "pan"}:
                raise ValueError("Layer automation supports gain and pan")
            low, high = (-60, 12) if lane.parameter == "gain" else (-1, 1)
            if any(not low <= p.value <= high for p in lane.points):
                raise ValueError("Layer automation out of range")
        for effect in layer.effects:
            if effect.kind not in EFFECTS:
                raise ValueError("Unknown effect")
            controls = EFFECTS[effect.kind]["params"]
            if effect.kind == "stretch" and (effect.start or effect.end is not None):
                raise ValueError(
                    "Time stretching applies to the whole layer; edit alignment anchors for local timing"
                )
            for key, value in effect.params.items():
                if key == "impulse_id" and effect.kind == "convolution":
                    continue
                if (
                    key not in controls
                    or not isinstance(value, (int, float))
                    or not controls[key]["min"] <= value <= controls[key]["max"]
                ):
                    raise ValueError("Invalid effect parameter")
            for lane in effect.automation:
                if lane.parameter not in controls:
                    raise ValueError("Invalid automated parameter")
                if (
                    effect.kind in {"stretch", "convolution"}
                    or lane.parameter == "formant"
                ):
                    raise ValueError(
                        "This parameter is static; use alignment or region controls"
                    )
                c = controls[lane.parameter]
                if any(not c["min"] <= p.value <= c["max"] for p in lane.points):
                    raise ValueError("Automation value out of range")
    return recipe


# Display the actual engine choice beside each explanation; shared settings are not an audio-equivalence promise.
_PREVIEW_ENGINES = {
    "chorus": "Tone.Chorus preview; Pedalboard.Chorus render. Delay networks and depth scaling differ.",
    "vibrato": "Tone.Vibrato preview; interpolated modulated delay render. Phase and interpolation differ.",
    "tremolo": "Tone.Tremolo preview; sample-wise amplitude oscillator render. Stereo oscillator phase may differ.",
    "phaser": "Tone.Phaser preview; Pedalboard.Phaser render. Filter stages and notch motion differ.",
    "delay": "Tone.FeedbackDelay preview; Pedalboard.Delay render. Feedback timing and interpolation can differ.",
    "reverb": "Tone.Freeverb preview; Pedalboard.Reverb render. Reflection networks and decay are different.",
    "lowpass": "Tone.Filter preview; Pedalboard.LowpassFilter render. Filter slope and resonance differ.",
    "highpass": "Tone.Filter preview; Pedalboard.HighpassFilter render. Filter slope and resonance differ.",
    "eq": "Tone peaking filter preview; Pedalboard.PeakFilter render. Compare the saved render before export.",
    "distortion": "Tone.Distortion preview; Pedalboard.Distortion render. Nonlinear transfer curves differ.",
    "bitcrush": "Tone.BitCrusher preview; Pedalboard.Bitcrush render. Wet mix is applied explicitly in both.",
    "compressor": "Tone.Compressor preview; Pedalboard.Compressor render. Detector, knee and envelope response differ.",
    "limiter": "Tone.Limiter preview; Pedalboard.Limiter render. The saved mix also enforces a −1 dBFS sample ceiling when its master limiter is enabled.",
}
for _kind, _explanation in _PREVIEW_ENGINES.items():
    EFFECTS[_kind]["preview"] = _explanation
