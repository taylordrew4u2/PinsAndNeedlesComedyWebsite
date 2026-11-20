#!/usr/bin/env python3
"""Render the original Bad Decisions intro score (Python + NumPy + FFmpeg).

No recordings or third-party samples: kick, snare, hats, bass and keys are
synthesized here. Scene boundaries come from the same timeline as the screen.
Run from any directory: python scripts/generate-intro-score.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/sounds/intro/bad-decisions-score.mp3"
RATE = 44_100
RNG = np.random.default_rng(20261119)
BEAT = 0.5  # 120 BPM; a relaxed, swung breakbeat.


def timeline() -> tuple[dict[str, tuple[float, float]], float]:
    source = (ROOT / "src/lib/explainer.ts").read_text()
    entries = re.findall(r'\{ step: "([a-z]+)", ms: ([\d_]+) \}', source)
    if [name for name, _ in entries] != ["title", "how", "listen", "intro", "example", "roast"]:
        raise SystemExit("Review the arrangement before rendering a changed intro sequence.")
    result = {}
    cursor = 0.0
    for name, ms in entries:
        duration = int(ms.replace("_", "")) / 1000
        result[name] = (cursor, cursor + duration)
        cursor += duration
    return result, cursor


SCENES, DURATION = timeline()
MIX = np.zeros((round(DURATION * RATE), 2), dtype=np.float64)


def axis(seconds: float) -> np.ndarray:
    return np.arange(round(seconds * RATE)) / RATE


def shaped(signal: np.ndarray, attack: float = 0.004, release: float = 0.035) -> np.ndarray:
    envelope = np.ones(len(signal))
    a, r = min(len(signal), round(attack * RATE)), min(len(signal), round(release * RATE))
    if a:
        envelope[:a] *= np.linspace(0, 1, a) ** 1.5
    if r:
        envelope[-r:] *= np.linspace(1, 0, r) ** 1.5
    return signal * envelope


def add(signal: np.ndarray, at: float, gain: float = 1, pan: float = 0) -> None:
    start = round(at * RATE)
    end = min(start + len(signal), len(MIX))
    if end <= start or start < 0:
        return
    # Small stereo moves; the rhythm and low end stay centered and mono-safe.
    stereo = np.array([math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)])
    MIX[start:end] += signal[:end - start, None] * gain * stereo


def kick() -> np.ndarray:
    t = axis(0.36)
    frequency = 48 + 86 * np.exp(-t * 45)
    body = np.sin(2 * np.pi * np.cumsum(frequency) / RATE) * np.exp(-t * 15)
    click = RNG.uniform(-1, 1, len(t)) * np.exp(-t * 420) * 0.08
    return shaped(np.tanh((body + click) * 1.6) * 0.7, 0.002, 0.03)


def snare(ghost: bool = False) -> np.ndarray:
    t = axis(0.2 if ghost else 0.28)
    white = RNG.normal(0, 0.5, len(t))
    # A short moving average removes hiss; subtract a broader average for body.
    noise = np.convolve(white, np.ones(4) / 4, mode="same")
    noise -= np.convolve(noise, np.ones(80) / 80, mode="same")
    body = np.sin(2 * np.pi * 178 * t) * np.exp(-t * 36) * 0.18
    return shaped((noise * np.exp(-t * 21) + body) * 1.5, 0.002, 0.03)


def hat(opened: bool = False) -> np.ndarray:
    t = axis(0.2 if opened else 0.075)
    noise = RNG.normal(0, 0.5, len(t))
    noise -= np.convolve(noise, np.ones(7) / 7, mode="same")
    return shaped(noise * np.exp(-t * (25 if opened else 65)), 0.002, 0.015)


def note(midi: int) -> float:
    return 440 * 2 ** ((midi - 69) / 12)


def bass(midi: int, seconds: float = 0.28) -> np.ndarray:
    t = axis(seconds)
    phase = 2 * np.pi * note(midi) * t
    tone = np.sin(phase) + 0.28 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
    return shaped(np.tanh(tone * 1.3) * np.exp(-t * 3.5), 0.009, 0.045)


def keys(midis: tuple[int, ...], seconds: float = 0.62) -> np.ndarray:
    t = axis(seconds)
    signal = np.zeros(len(t))
    for midi in midis:
        phase = 2 * np.pi * note(midi) * t
        # Warm, slightly detuned electric-organ stabs; no bright lead melody.
        signal += (np.sin(phase) + 0.2 * np.sin(2.002 * phase) + 0.09 * np.sin(3 * phase)) / len(midis)
    return shaped(signal * np.exp(-t * 5) * (0.95 + 0.05 * np.sin(2 * np.pi * 5 * t)), 0.009, 0.08)


def sweep(seconds: float = 0.32) -> np.ndarray:
    t = axis(seconds)
    noise = RNG.normal(0, 0.4, len(t))
    filtered = np.convolve(noise, np.ones(18) / 18, mode="same")
    envelope = np.sin(np.pi * t / seconds) ** 2
    return shaped(filtered * envelope, 0.03, 0.06)


def groove(start: float, end: float, variation: int = 0, strength: float = 1) -> None:
    chords = [(57, 60, 64), (53, 57, 60), (55, 59, 62), (52, 55, 59)]
    roots = [33, 29, 31, 28]  # A1, F1, G1, E1.
    bar = 0
    while start + bar * 4 * BEAT < end:
        origin = start + bar * 4 * BEAT
        chord = chords[(bar + variation) % 4]
        root = roots[(bar + variation) % 4]
        for beat, velocity in [(0, 0.50), (1.5, 0.37), (2, 0.46), (3.5, 0.30)]:
            at = origin + beat * BEAT
            if at < end:
                add(kick(), at, velocity * strength)
        for beat in [1, 3]:
            at = origin + beat * BEAT
            if at < end:
                add(snare(), at, 0.26 * strength)
        for beat in [2.75, 3.75]:
            at = origin + beat * BEAT
            if at < end:
                add(snare(True), at, 0.055 * strength, -0.1)
        for eighth in range(8):
            # Swing the offbeats by 26ms, and vary their velocity.
            at = origin + eighth * BEAT / 2 + (0.026 if eighth % 2 else 0)
            if at < end:
                add(hat(opened=eighth == 7), at, (0.07 if eighth % 2 else 0.10) * strength, 0.12 if eighth % 2 else -0.12)
        for beat, pitch, length in [(0, root, 0.33), (0.75, root + 12, 0.19), (1.5, root, 0.25), (2.5, root + 7, 0.24), (3.25, root, 0.25)]:
            at = origin + beat * BEAT
            if at < end:
                add(bass(pitch, length), at, 0.23 * strength)
        for beat in [0.5, 2.75]:
            at = origin + beat * BEAT
            if at < end:
                stab = keys(chord)
                add(stab, at, 0.11 * strength, -0.18)
                add(stab, at + 0.19, 0.025 * strength, 0.2)
        bar += 1


# An opening downbeat, then a pickup into the rules' four-bar groove.
groove(0, SCENES["listen"][0])
add(keys((45, 52, 57, 60, 64), 0.9), 0, 0.12)
add(sweep(0.42), SCENES["how"][0] - 0.21, 0.15)
# Soft tactile ticks with the three illustrated rule reveals.
for offset in (0.4, 1.8, 3.2):
    at = SCENES["how"][0] + offset
    add(snare(True), at, 0.13)
    add(keys((69, 72), 0.14), at, 0.025)

# Leave room for the actual question sound. The example's backing is restrained.
groove(SCENES["listen"][0], SCENES["listen"][1], variation=2, strength=0.45)
groove(SCENES["example"][0], SCENES["example"][1], variation=1, strength=0.65)
groove(SCENES["roast"][0], DURATION, variation=0)
add(sweep(0.44), SCENES["roast"][0] - 0.20, 0.14)
add(keys((45, 52, 57, 60, 64), 1.0), SCENES["roast"][0], 0.12)

# Gain is applied after every instrument/tail: nothing bleeds into the cue gap.
t = np.arange(len(MIX)) / RATE
listen, intro, example, closing = (SCENES[key][0] for key in ("listen", "intro", "example", "roast"))
points = [(0, 0), (0.04, 1), (listen - 0.18, 1), (listen + 0.15, 0.18),
          (intro - 0.20, 0.18), (intro - 0.05, 0), (example + 0.05, 0),
          (example + 0.25, 0.24), (closing - 0.20, 0.24), (closing + 0.08, 1),
          (DURATION - 1.0, 1), (DURATION - 0.05, 0), (DURATION, 0)]
MIX *= np.interp(t, *zip(*points))[:, None]
# Mild soft saturation glues the original instruments without clipped transients.
MIX = np.tanh(MIX * 1.15) / 1.15


def render() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pnc-score-") as temp:
        raw = Path(temp) / "original.wav"
        with wave.open(str(raw), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes((np.clip(MIX, -1, 1) * 32767).astype("<i2").tobytes())
        first = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af",
                                "loudnorm=I=-23:TP=-6:LRA=6:print_format=json", "-f", "null", "-"],
                               capture_output=True, text=True, check=True)
        measured = json.JSONDecoder().raw_decode(first.stderr[first.stderr.rfind("{"):])[0]
        settings = ("loudnorm=I=-23:TP=-6:LRA=6:linear=true:"
                    f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                    f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                    f"offset={measured['target_offset']}")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw), "-af", settings,
                        "-ar", str(RATE), "-c:a", "libmp3lame", "-b:a", "192k", "-map_metadata", "-1",
                        "-metadata", "title=Bad Decisions — Intro Score",
                        "-metadata", "comment=Original procedural composition; scripts/generate-intro-score.py",
                        str(OUT)], check=True)
    print(json.dumps({"file": str(OUT.relative_to(ROOT)), "score_seconds": DURATION,
                      "cue_silence_seconds": [intro, example], "scenes": SCENES}, indent=2))


if __name__ == "__main__":
    render()
