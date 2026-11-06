"""Compose this episode's original score and foley without external recordings.

Only numpy/scipy and the prepared project's generic DSP are used. The resulting
WAV files are inputs to the unchanged standard Remotion audio mixer.
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
    """A new G/Em/C/D pizzicato motif; blue explanation uses slower open fifths."""
    score = np.zeros((2, T.SAMPLES), np.float64)
    beat = 60 / 96
    chords = [(43, 67, 71, 74), (40, 64, 67, 71), (36, 64, 67, 72), (38, 66, 69, 74)]
    motif = [0, 2, 1, 2, 1, 0, 2, 1]
    bar = beat * 4
    for bar_number, at in enumerate(np.arange(0.04, T.DURATION, bar)):
        chord = chords[bar_number % len(chords)]
        frame = round(at * T.FPS)
        in_explanation = T.SHOTS[10]["a"] <= frame < T.SHOTS[14]["a"]
        rhythm = (0, 2.0) if in_explanation else (0, 1.5, 2.5)
        for j, pulse in enumerate(rhythm):
            note = chord[1 + motif[(bar_number * 3 + j) % len(motif)]]
            place(score, pan(soft_string(note, 1.1, 9100 + bar_number * 13 + j), -0.18 if j % 2 else 0.18), at + pulse * beat)
        place(score, pan(soft_string(chord[0], 1.05, 9200 + bar_number, True), -0.04), at, 0.62)
        if bar_number % 3 == 2:
            place(score, pan(soft_bell(chord[2] + (0 if in_explanation else 12), 1.3), 0.20), at + 3 * beat, 0.5)

    # Level rides follow the story: leave the storm and deadpan lines room;
    # explanation is sparse, and the return resolves warmly into the paperweight.
    time = np.arange(T.SAMPLES) / SR
    ride = np.ones(T.SAMPLES)
    ranges = [(4, 5, -5.0), (7, 8, -3.0), (10, 13, -2.5)]
    for first, last, db in ranges:
        ride[(time >= T.seconds(T.SHOTS[first]["a"])) & (time < T.seconds(T.SHOTS[last]["b"]))] = 10 ** (db / 20)
    ride = ndimage.gaussian_filter1d(ride[::48], 75)
    score *= np.interp(np.arange(T.SAMPLES), np.arange(len(ride)) * 48, ride)
    end_frame = T.event_frame("paperweight")
    for note, gain, position in ((55, 0.75, -0.05), (67, 0.7, 0.05), (71, 0.35, 0.15)):
        place(score, pan(soft_string(note, 1.7, 9300 + note), position), T.seconds(end_frame), gain)
    score = fades(score, 0.18, 0.19)
    score *= 10 ** ((VOICE_LUFS + 4.0 - integrated(score)) / 20)
    score *= min(1.0, 0.82 / float(np.max(np.abs(score))))
    # First objective mix identified quiet phrase endings in these shots.
    # Apply local rides after calibration so other sections are not raised.
    clarity = np.ones(T.SAMPLES)
    for number, db in ((1, -2.5), (6, -3.0), (15, -3.5), (17, -5.0)):
        shot = T.SHOTS[number]
        clarity[(time >= T.seconds(shot["a"])) & (time < T.seconds(shot["b"]))] = 10 ** (db / 20)
    clarity = ndimage.gaussian_filter1d(clarity[::48], 45)
    score *= np.interp(np.arange(T.SAMPLES), np.arange(len(clarity)) * 48, clarity)
    return score


def filtered_noise(duration: float, seed: int, low: float, high: float) -> tuple[np.ndarray, np.ndarray]:
    count = round(duration * SR)
    rng = np.random.default_rng(seed)
    time = np.arange(count) / SR
    noise = signal.sosfilt(signal.butter(2, [low, high], fs=SR, btype="bandpass", output="sos"), rng.normal(size=count))
    return noise, time


def paper(duration: float, seed: int, roll: bool = False) -> np.ndarray:
    noise, time = filtered_noise(duration, seed, 650, 6200)
    envelope = np.sin(np.pi * np.clip(time / duration, 0, 1)) ** 1.7
    envelope *= 0.28 + 0.72 * np.sin(2 * np.pi * (11 if roll else 17) * time) ** 6
    return fades(noise * envelope, 0.012, 0.06)


def thud(duration: float, seed: int, hard: bool = True) -> np.ndarray:
    noise, time = filtered_noise(duration, seed, 280, 3900 if hard else 1600)
    body = np.sin(2 * np.pi * (96 * time - 25 * time**2)) * np.exp(-time * (24 if hard else 32))
    tap = noise * np.exp(-time * (48 if hard else 37)) * (0.65 if hard else 0.32)
    if hard:
        tap += 0.2 * np.sin(2 * np.pi * 580 * time) * np.exp(-time * 57)
    return fades(body * 0.8 + tap, 0.001, 0.035)


def marker(duration: float, seed: int) -> np.ndarray:
    noise, time = filtered_noise(duration, seed, 950, 4300)
    contact = np.sin(2 * np.pi * (410 * time - 100 * time**2)) * np.exp(-time * 45)
    swipe = noise * np.sin(np.pi * time / duration) ** 2 * 0.25
    return fades(contact * 0.5 + swipe, 0.001, 0.03)


def thunder() -> np.ndarray:
    noise, time = filtered_noise(2.1, 9450, 40, 800)
    # Low, distant rumble without a startling crack or sharp high-frequency burst.
    envelope = np.clip(time / 0.07, 0, 1) * np.exp(-time / 0.52)
    envelope *= 0.8 + 0.2 * np.sin(2 * np.pi * 3.3 * time)
    return fades(noise * envelope, 0.006, 0.18)


def rain() -> np.ndarray:
    duration = T.seconds(T.SHOTS[5]["b"] - T.SHOTS[4]["a"])
    channels = []
    for seed in (9451, 9452):
        noise, time = filtered_noise(duration, seed, 1000, 6500)
        channels.append(noise * (0.90 + 0.1 * np.sin(2 * np.pi * 0.7 * time)))
    return fades(np.stack(channels), 0.2, 0.25)


def swish() -> np.ndarray:
    noise, time = filtered_noise(0.34, 9453, 300, 3600)
    return fades(noise * np.sin(np.pi * time / 0.34) ** 2, 0.015, 0.05)


def save_effect(name: str, sound: np.ndarray, target: float, pan_to: float = 0.0, bed: bool = False) -> dict:
    sound = pan(sound, pan_to) if sound.ndim == 1 else sound
    current = integrated(sound) if bed else momentary_max(sound)
    sound *= 10 ** ((target - current) / 20)
    sound *= min(1.0, 0.82 / float(np.max(np.abs(sound))))
    path = ASSETS / (name + ".wav")
    write_wav(str(path), sound)
    return {"file": path.relative_to(T.ROOT).as_posix(), "duration": sound.shape[-1] / SR,
            "sourceLufs": float(integrated(sound)), "sourceMomentaryMaxLufs": float(momentary_max(sound)),
            "sourcePeakDbfs": float(20 * np.log10(np.max(np.abs(sound))))}


def main() -> None:
    score = make_score()
    score_path = ASSETS / "original-score.wav"
    write_wav(str(score_path), score)
    source_target = VOICE_LUFS + 6
    assets = {
        "paper-flutter": save_effect("paper-flutter", paper(0.38, 9401), source_target - 2),
        "paper-roll": save_effect("paper-roll", paper(0.62, 9402, True), source_target - 2),
        "paper-unroll": save_effect("paper-unroll", paper(0.71, 9403, True), source_target - 2),
        "brick-thud": save_effect("brick-thud", thud(0.34, 9404), source_target),
        "paperweight-tap": save_effect("paperweight-tap", thud(0.27, 9405), source_target - 1),
        "shoe-set": save_effect("shoe-set", thud(0.28, 9406, False), source_target - 1),
        "footstep": save_effect("footstep", thud(0.19, 9407, False), source_target - 1),
        "green-stamp": save_effect("green-stamp", marker(0.18, 9408), source_target - 2),
        "thunder": save_effect("thunder", thunder(), source_target - 2),
        "rain": save_effect("rain", rain(), source_target - 3, bed=True),
        "transition": save_effect("transition", swish(), source_target - 3),
    }
    cues = []

    def cue(name: str, asset: str, frame: int, gain: float = -15.0, reason: str = "") -> None:
        source = assets[asset]
        cues.append({"name": name, "frame": frame, "shot": T.shot_at(frame), "at": round(T.seconds(frame), 9),
                     "file": source["file"], "duration": source["duration"], "gainDb": gain, "reason": reason})

    for event, asset, gain, description in [
        ("failure", "paper-flutter", -18, "Calendar trembles as Marcus declares failure."),
        ("green-stamp", "green-stamp", -15, "Marker contacts the calendar on green."),
        ("thunder", "thunder", -18, "Distant thunder follows the storm's visual arrival."),
        ("roll-calendar", "paper-roll", -19, "Rolled calendar remains in the visible hand; lowered for quiet narration."),
        ("brick-land", "brick-thud", -15, "Brick makes physical contact at frame 1123."),
        ("shoes-set", "shoe-set", -15, "Trainers touch the mat at frame 1376."),
        ("seven-green", "green-stamp", -17, "Restrained marker accent starts the seven later green squares."),
        ("calendar-flat", "paper-unroll", -22, "Paper unrolls across the table; lowered for the quiet final word."),
        ("paperweight", "paperweight-tap", -15, "Brick contacts the calendar at frame 1830."),
    ]:
        cue(event, asset, T.event_frame(event), gain, description)
    cue("rain-bed", "rain", T.SHOTS[4]["a"], -22, "Rain fades across the storm and blank-square shots, then ends.")
    # Selected spatial changes only; no whoosh on every edit.
    for shot in (7, 10, 14, 17):
        cue("transition-" + str(shot), "transition", T.SHOTS[shot]["a"], -22, "Quiet air movement across the six-frame location/light transition.")
    for frame, shot in T.selected_footfalls():
        cue("footstep-" + str(frame), "footstep", frame, -19 if shot != 4 else -22,
            "Agreed planted-foot contact; a restrained subset of the cast's deterministic gait.")
    cues.sort(key=lambda item: (item["frame"], item["name"]))
    settings = {"targetLufs": -14, "music": {"enabled": True, "bpm": 96,
                "file": score_path.relative_to(T.ROOT).as_posix(), "gainDb": -7, "duckDb": -7},
                "sfx": cues,
                "productionNotes": {"timelineSha256": T.SOURCE_SHA256,
                    "musicGainPolicy": "Default -10 dB plus 3 dB = -7 dB; speech duck remains -7 dB.",
                    "sfxGainPolicy": "Default -9 dB minus 6 dB = -15 dB; distance and subtlety offsets reduce selected cues further.",
                    "provenance": "Original local numpy/scipy synthesis; no recordings, external assets, additional voices, or bridge score."}}
    (T.PROJECT / "sound.json").write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    manifest = {"timelineSha256": T.SOURCE_SHA256, "voiceLufsStereo": VOICE_LUFS,
                "scoreLufsBeforeMixer": float(integrated(score)), "effects": assets, "cueCount": len(cues),
                "durationSeconds": T.DURATION, "samples": T.SAMPLES, "sampleRate": SR}
    (T.HERE / "generation-report.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    lines = ["# Perfect Streaks — sound cue sheet", "", "Original score and foley synthesized locally by He-MAN with numpy/scipy and the prepared generic DSP.",
        "The unchanged standard mixer combines these sources with Liam, ducks music, and normalizes the exact 62.7-second mix to -14 LUFS with a -1.5 dBTP ceiling.",
        "No subjective listening is claimed here. Final listening remains a separate required review.", "", "## Shared timing", "",
        f"Source: projects/perfect-streaks/timeline.json; SHA-256: {T.SOURCE_SHA256}.",
        "30 fps; 1881 frames; 3,009,600 samples at 48 kHz. audio/timeline.py reads the source directly.", "",
        "| Shot | Frames | Words / beat |", "|---|---|---|"]
    lines += [f"| {number} | {shot['a']}–{shot['b'] - 1} | {shot['words']} |" for number, shot in T.SHOTS.items()]
    lines += ["", "## Mix and music", "", "Music gain -7 dB = default -10 +3 dB; speech duck -7 dB. SFX base -15 dB = default -9 -6 dB, with documented quieter offsets.",
        "New 96 bpm G/Em/C/D pizzicato motif with sparse bells and warm bass. Storm and deadpan beats dip; explanation uses a sparse open rhythm; the final chord lands with the paperweight.",
        "Objective masking checks prompted additional score rides of -2.5/-3/-3.5/-5 dB in shots 1/6/15/17, plus lower paper foley in shots 6 and 17. Other sections retain their first-mix levels.",
        "The voice is not EQ'd, replaced, sped up or otherwise edited here. Final master normalization affects the complete mix.", "",
        "## Events", "", "| Cue | Frame | Time s | Shot | Gain dB | Picture anchor |", "|---|---|---|---|---|---|"]
    lines += [f"| {c['name']} | {c['frame']} | {c['at']:.3f} | {c['shot']} | {c['gainDb']:+g} | {c['reason']} |" for c in cues]
    lines += ["", "Footsteps use the agreed cast contacts: ordinary side-walk contacts every 15 frames relative to the shot start, with shot 2 ending at local frame 45. Shot 15 uses round(a+2+16.5*n), including frame 1540.", ""]
    (T.HERE / "cues.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"generatedSources": len(assets) + 1, "cueCount": len(cues), "durationSeconds": T.DURATION,
                      "scoreLufsBeforeMixer": round(float(integrated(score)), 2), "timelineSha256": T.SOURCE_SHA256}))


if __name__ == "__main__":
    main()
