"""Compose Fourteen Mondays original score and foley without external recordings.

Uses numpy/scipy and the prepared project's generic DSP. The resulting
WAV files are inputs to the standard Remotion audio mixer.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from scipy import ndimage, signal
import timeline as T

sys.path.insert(0, str(T.ROOT / "templates/audio"))
from dsp import SR, fades, integrated, momentary_max, pan, place, read_wav, st, write_wav

ASSETS = T.HERE / "generated"
ASSETS.mkdir(parents=True, exist_ok=True)
VOICE, voice_rate = read_wav(str(T.PROJECT / "voice/voice.wav"))
assert voice_rate == SR
VOICE_LUFS = float(integrated(st(VOICE)))


def hz(note: float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def soft_string(note: float, duration: float, seed: int, bass: bool = False) -> np.ndarray:
    rng = np.random.default_rng(seed)
    time = np.arange(round(duration * SR)) / SR
    fundamental = hz(note)
    sound = np.zeros_like(time)
    for partial in range(1, 8 if bass else 13):
        decay = (0.45 if bass else 0.9) / (1 + (partial - 1) * 0.45)
        sound += np.sin(2 * np.pi * fundamental * partial * time + rng.uniform(0, 2 * np.pi)) * np.exp(-time / decay) / partial**1.7
    envelope = (1 - np.exp(-time / 0.006)) * np.clip((duration - time) / 0.12, 0, 1)
    return sound * envelope * (0.16 if bass else 0.10)


def soft_bell(note: float, duration: float) -> np.ndarray:
    time = np.arange(round(duration * SR)) / SR
    fundamental = hz(note)
    sound = np.sin(2 * np.pi * fundamental * time) * np.exp(-time / 0.72)
    sound += 0.16 * np.sin(2 * np.pi * fundamental * 3.98 * time) * np.exp(-time / 0.19)
    return fades(sound * (1 - np.exp(-time / 0.009)) * 0.05, 0.004, 0.12)


def make_score() -> np.ndarray:
    """A motivating C/Am/F/G motif resolving into Thursday's pushup triumph."""
    score = np.zeros((2, T.SAMPLES), np.float64)
    beat = 60 / 100
    chords = [(36, 60, 64, 67), (33, 57, 60, 64), (29, 53, 57, 60), (31, 55, 59, 62)]
    motif = [0, 2, 1, 2, 1, 0, 2, 1]
    bar = beat * 4
    for bar_number, at in enumerate(np.arange(0.04, T.DURATION, bar)):
        chord = chords[bar_number % len(chords)]
        frame = round(at * T.FPS)
        in_analogy = T.SHOTS[14]["a"] <= frame < T.SHOTS[18]["a"]
        rhythm = (0, 2.0) if in_analogy else (0, 1.5, 2.5)
        for j, pulse in enumerate(rhythm):
            note = chord[1 + motif[(bar_number * 3 + j) % len(motif)]]
            place(score, pan(soft_string(note, 1.1, 9100 + bar_number * 13 + j), -0.18 if j % 2 else 0.18), at + pulse * beat)
        place(score, pan(soft_string(chord[0], 1.05, 9200 + bar_number, True), -0.04), at, 0.62)
        if bar_number % 3 == 2:
            place(score, pan(soft_bell(chord[2] + (0 if in_analogy else 12), 1.3), 0.20), at + 3 * beat, 0.5)

    time = np.arange(T.SAMPLES) / SR
    ride = np.ones(T.SAMPLES)
    ranges = [(6, 9, -4.0), (11, 13, -3.0), (14, 17, -2.5)]
    for first, last, db in ranges:
        ride[(time >= T.seconds(T.SHOTS[first]["a"])) & (time < T.seconds(T.SHOTS[last]["b"]))] = 10 ** (db / 20)
    ride = ndimage.gaussian_filter1d(ride[::48], 75)
    score *= np.interp(np.arange(T.SAMPLES), np.arange(len(ride)) * 48, ride)

    end_frame = T.event_frame("tally-tick")
    for note, gain, position in ((48, 0.75, -0.05), (60, 0.7, 0.05), (64, 0.35, 0.15)):
        place(score, pan(soft_string(note, 1.8, 9300 + note), position), T.seconds(end_frame), gain)

    score = fades(score, 0.18, 0.19)
    score *= 10 ** ((VOICE_LUFS + 4.0 - integrated(score)) / 20)
    score *= min(1.0, 0.82 / float(np.max(np.abs(score))))
    return score


def filtered_noise(duration: float, seed: int, low: float, high: float) -> tuple[np.ndarray, np.ndarray]:
    count = round(duration * SR)
    rng = np.random.default_rng(seed)
    time = np.arange(count) / SR
    noise = signal.sosfilt(signal.butter(2, [low, high], fs=SR, btype="bandpass", output="sos"), rng.normal(size=count))
    return noise, time


def thud(duration: float, seed: int, hard: bool = True) -> np.ndarray:
    noise, time = filtered_noise(duration, seed, 280, 3900 if hard else 1600)
    body = np.sin(2 * np.pi * (96 * time - 25 * time**2)) * np.exp(-time * (24 if hard else 32))
    tap = noise * np.exp(-time * (48 if hard else 37)) * (0.65 if hard else 0.32)
    return fades(body * 0.8 + tap, 0.001, 0.035)


def marker(duration: float, seed: int) -> np.ndarray:
    noise, time = filtered_noise(duration, seed, 950, 4300)
    contact = np.sin(2 * np.pi * (410 * time - 100 * time**2)) * np.exp(-time * 45)
    swipe = noise * np.sin(np.pi * time / duration) ** 2 * 0.25
    return fades(contact * 0.5 + swipe, 0.001, 0.03)


def clatter() -> np.ndarray:
    """Ceramic cup spill clatter."""
    noise, time = filtered_noise(0.45, 9420, 600, 5000)
    ring = np.sin(2 * np.pi * 1200 * time) * np.exp(-time * 30)
    clack = np.sin(2 * np.pi * 480 * time) * np.exp(-time * 45)
    return fades(noise * 0.4 + ring * 0.35 + clack * 0.35, 0.002, 0.08)


def engine_puff() -> np.ndarray:
    """Cold car engine cough and puff."""
    noise, time = filtered_noise(0.85, 9430, 80, 1800)
    rumble = np.sin(2 * np.pi * (45 + 15 * np.sin(time * 25)) * time) * np.exp(-time * 3)
    cough = noise * np.sin(np.pi * time / 0.85) ** 1.5
    return fades(rumble * 0.6 + cough * 0.5, 0.01, 0.12)


def rug_impact() -> np.ndarray:
    """Soft muffled knee/body drop onto thick rug."""
    noise, time = filtered_noise(0.32, 9440, 60, 600)
    body = np.sin(2 * np.pi * 75 * time) * np.exp(-time * 28)
    return fades(body * 0.7 + noise * 0.4, 0.002, 0.05)


def save_effect(name: str, sound: np.ndarray, target: float, pan_to: float = 0.0) -> dict:
    sound = pan(sound, pan_to) if sound.ndim == 1 else sound
    current = momentary_max(sound)
    sound *= 10 ** ((target - current) / 20)
    sound *= min(1.0, 0.82 / float(np.max(np.abs(sound))))
    path = ASSETS / (name + ".wav")
    write_wav(str(path), sound)
    return {
        "file": path.relative_to(T.ROOT).as_posix(),
        "duration": sound.shape[-1] / SR,
        "sourceLufs": float(integrated(sound)),
        "sourceMomentaryMaxLufs": float(momentary_max(sound)),
        "sourcePeakDbfs": float(20 * np.log10(np.max(np.abs(sound))))
    }


def main() -> None:
    score = make_score()
    score_path = ASSETS / "original-score.wav"
    write_wav(str(score_path), score)
    source_target = VOICE_LUFS + 6

    assets = {
        "coffee-clatter": save_effect("coffee-clatter", clatter(), source_target - 1),
        "marker-tick": save_effect("marker-tick", marker(0.22, 9408), source_target - 2),
        "engine-cough": save_effect("engine-cough", engine_puff(), source_target - 1),
        "rug-drop": save_effect("rug-drop", rug_impact(), source_target - 1),
        "pushup-thud": save_effect("pushup-thud", thud(0.24, 9409, False), source_target - 2),
        "footstep": save_effect("footstep", thud(0.18, 9410, False), source_target - 2),
    }

    cues = []

    def cue(name: str, asset: str, frame: int, gain: float = -15.0, reason: str = "") -> None:
        source = assets[asset]
        cues.append({
            "name": name, "frame": frame, "shot": T.shot_at(frame),
            "at": round(T.seconds(frame), 9), "file": source["file"],
            "duration": source["duration"], "gainDb": gain, "reason": reason
        })

    cue("coffee-spill", "coffee-clatter", T.event_frame("coffee-spill"), -16, "Mug tips on Monday morning.")
    cue("engine-puff", "engine-cough", T.event_frame("engine-puff"), -15, "Cold engine rumbles to life.")
    cue("rug-drop", "rug-drop", T.event_frame("rug-drop"), -15, "Marcus drops onto living room rug.")
    cue("pushup-rep", "pushup-thud", T.event_frame("pushup-rep"), -16, "Hand palm contacts floor on pushup.")
    cue("tally-tick", "marker-tick", T.event_frame("tally-tick"), -15, "Marker records Thursday completion.")

    for frame, shot in T.selected_footfalls():
        cue(f"footstep-{frame}", "footstep", frame, -20, "Planted gait contact.")

    cues.sort(key=lambda item: (item["frame"], item["name"]))

    settings = {
        "targetLufs": -14,
        "music": {
            "enabled": True, "bpm": 100,
            "file": score_path.relative_to(T.ROOT).as_posix(),
            "gainDb": -7, "duckDb": -7
        },
        "sfx": cues,
        "productionNotes": {
            "timelineSha256": T.SOURCE_SHA256,
            "provenance": "Original local numpy/scipy synthesis; no recordings or external assets."
        }
    }
    (T.PROJECT / "sound.json").write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")

    manifest = {
        "timelineSha256": T.SOURCE_SHA256, "voiceLufsStereo": VOICE_LUFS,
        "scoreLufsBeforeMixer": float(integrated(score)), "effects": assets, "cueCount": len(cues),
        "durationSeconds": T.DURATION, "samples": T.SAMPLES, "sampleRate": SR
    }
    (T.HERE / "generation-report.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Sound generation complete:")
    print(f"  Score: {score_path}")
    print(f"  Cues: {len(cues)}")
    print(f"  Target LUFS: -14")


if __name__ == "__main__":
    main()
