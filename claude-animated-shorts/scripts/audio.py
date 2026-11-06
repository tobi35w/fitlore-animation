"""Mix narration, a small original music bed and timed effects; normalize to -16 LUFS."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "templates/audio"))
from dsp import SR, read_wav, write_wav, st  # noqa: E402


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def load_audio(path: Path, cache: Path) -> np.ndarray:
    cache.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(cache)])
    data, rate = read_wav(str(cache))
    if rate != SR:
        raise ValueError(f"Expected {SR} Hz, got {rate}")
    return st(data) if data.ndim == 1 else data


def midi(note: float) -> float:
    return 440 * 2 ** ((note - 69) / 12)


def music_bed(duration: float, bpm: float = 96) -> np.ndarray:
    """A deterministic C-Am-F-G score with soft keys, bass and brushed percussion."""
    if not 30 <= bpm <= 240:
        raise ValueError("Music BPM must be between 30 and 240")
    count = round(duration * SR)
    out = np.zeros((2, count), np.float64)
    beat = 60 / bpm
    rng = np.random.default_rng(1831)
    chords = [(60, 64, 67), (57, 60, 64), (53, 57, 60), (55, 59, 62)]
    for i, at in enumerate(np.arange(0, duration, beat)):
        start = round(at * SR)
        length = min(round(beat * 1.8 * SR), count - start)
        time = np.arange(length) / SR
        chord = chords[(i // 4) % len(chords)]
        note = chord[i % 3] + (12 if i % 4 in (1, 3) else 0)
        envelope = (1 - np.exp(-time * 100)) * np.exp(-time * 4)
        tone = (np.sin(2 * np.pi * midi(note) * time) + 0.22 * np.sin(4 * np.pi * midi(note) * time)) * envelope * 0.13
        bass = np.sin(2 * np.pi * midi(chord[0] - 24) * time) * np.exp(-time * 5) * 0.10
        brush = rng.normal(0, 1, length) * np.exp(-time * 45) * 0.015
        sound = tone + bass + brush
        pan = -0.25 if i % 2 else 0.25
        out[0, start:start + length] += sound * (1 - pan)
        out[1, start:start + length] += sound * (1 + pan)
    fade = min(round(0.35 * SR), count // 2)
    if fade:
        out[:, :fade] *= np.linspace(0, 1, fade)
        out[:, -fade:] *= np.linspace(1, 0, fade)
    return out


def effect(kind: str, duration: float, seed: int) -> np.ndarray:
    if duration <= 0 or duration > 30:
        raise ValueError("Effect duration must be between 0 and 30 seconds")
    time = np.arange(round(duration * SR)) / SR
    rng = np.random.default_rng(seed)
    if kind == "pop":
        sound = np.sin(2 * np.pi * (650 * time - 600 * time**2)) * np.exp(-time * 22)
    elif kind == "whoosh":
        noise = rng.normal(0, 1, len(time))
        sound = np.convolve(noise, np.ones(12) / 12, mode="same") * np.sin(np.pi * time / duration) ** 2
    elif kind == "impact":
        sound = (np.sin(2 * np.pi * 70 * time) + rng.normal(0, 0.2, len(time))) * np.exp(-time * 14)
    elif kind == "chime":
        sound = (np.sin(2 * np.pi * 880 * time) + 0.35 * np.sin(2 * np.pi * 1320 * time)) * np.exp(-time * 5)
    else:
        raise ValueError(f"Unknown effect {kind!r}; use pop, whoosh, impact, chime, or a file.")
    sound *= np.minimum(time / 0.008, 1) * 0.25
    return np.stack([sound, sound])


def mix(voice_path: Path, words_path: Path, cue_path: Path, output: Path, duration: float) -> dict:
    if not np.isfinite(duration) or duration <= 0:
        raise ValueError("Duration must be a positive number")
    output.mkdir(parents=True, exist_ok=True)
    cues = json.loads(cue_path.read_text(encoding="utf-8")) if cue_path.exists() else {}
    count = round(duration * SR)
    voice = load_audio(voice_path, output / "stem-voice.wav")
    if voice.shape[1] > count + round(0.02 * SR):
        raise ValueError("Narration is longer than the picture. Extend the project duration; no speech has been truncated.")
    voice_track = np.zeros((2, count))
    voice_track[:, :min(count, voice.shape[1])] = voice[:, :count]
    music_settings = cues.get("music", {"enabled": True})
    music = np.zeros((2, count))
    if music_settings.get("enabled", True):
        if music_settings.get("file"):
            source = load_audio(ROOT / music_settings["file"], output / "music-source.wav")
            if not source.shape[1]:
                raise ValueError("The music file is empty")
            music = np.tile(source, (1, int(np.ceil(count / source.shape[1]))))[:, :count]
        else:
            music = music_bed(duration, float(music_settings.get("bpm", 96)))
        music *= 10 ** (float(music_settings.get("gainDb", -10)) / 20)
        words = json.loads(words_path.read_text(encoding="utf-8-sig"))
        gain = np.ones(count)
        for word in words:
            a = max(0, round((float(word["s"]) - 0.08) * SR))
            b = min(count, round((float(word["e"]) + 0.15) * SR))
            gain[a:b] = 10 ** (float(music_settings.get("duckDb", -7)) / 20)
        # Smooth level changes so ducking never clicks.
        from scipy.ndimage import gaussian_filter1d
        gain = gaussian_filter1d(gain[::48], 35)
        music *= np.interp(np.arange(count), np.arange(len(gain)) * 48, gain)
    effects = np.zeros((2, count))
    for index, cue in enumerate(cues.get("sfx", [])):
        at = float(cue["at"])
        if not np.isfinite(at) or not 0 <= at < duration:
            raise ValueError(f"Effect {index} starts outside the picture")
        sound = (load_audio(ROOT / cue["file"], output / f"effect-source-{index}.wav") if cue.get("file")
                 else effect(cue.get("type", "pop"), float(cue.get("duration", 0.4)), index))
        start = round(at * SR)
        length = min(count - start, sound.shape[1])
        effects[:, start:start + length] += sound[:, :length] * 10 ** (float(cue.get("gainDb", -9)) / 20)
    raw = voice_track + music + effects
    peak = float(np.max(np.abs(raw)))
    if peak == 0:
        raise ValueError("The mix is silent")
    # Preserve relative levels while keeping the intermediate PCM from clipping.
    raw *= min(1, 0.90 / peak)
    write_wav(str(output / "stem-music.wav"), music)
    write_wav(str(output / "stem-sfx.wav"), effects)
    write_wav(str(output / "premix.wav"), raw)
    target = float(cues.get("targetLufs", -16))
    if not -30 <= target <= -9:
        raise ValueError("targetLufs must be between -30 and -9")
    run(["ffmpeg", "-v", "error", "-y", "-i", str(output / "premix.wav"), "-af",
         f"loudnorm=I={target}:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2", "-t", str(duration),
         "-c:a", "pcm_s24le", str(output / "mix.wav")])
    report = {"durationSeconds": duration, "sampleRate": SR, "channels": 2, "targetLufs": target,
              "truePeakCeilingDb": -1.5, "effects": len(cues.get("sfx", [])), "mix": str(output / "mix.wav"),
              "voiceSha256": hashlib.sha256(voice_path.read_bytes()).hexdigest(),
              "wordsSha256": hashlib.sha256(words_path.read_bytes()).hexdigest(),
              "cuesSha256": hashlib.sha256(cue_path.read_bytes()).hexdigest()}
    (output / "audio-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", required=True, type=Path)
    parser.add_argument("--words", required=True, type=Path)
    parser.add_argument("--cues", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--duration", required=True, type=float)
    args = parser.parse_args()
    mix(args.voice, args.words, args.cues, args.out, args.duration)
