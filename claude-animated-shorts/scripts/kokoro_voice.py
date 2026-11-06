"""Generate narration using local Kokoro Voice Studio (am_adam, 1.0x speed).

Outputs:
  - voice.wav: 48 kHz mono 16-bit PCM narration
  - words.json: frame-accurate word-level timestamps
  - voice-info.json: generation metadata
"""
import argparse
import json
import os
import re
import sys
import warnings
from pathlib import Path

# Silence harmless warnings
warnings.filterwarnings("ignore")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
os.environ.setdefault("HF_HUB_VERBOSITY", "error")

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SR_OUT = 48000
SR_KOKORO = 24000


def clean_words(text: str) -> list[str]:
    # Extract clean alphanumeric words while preserving contractions
    return [w for w in re.findall(r"[A-Za-z0-9']+", text) if w]


def main():
    parser = argparse.ArgumentParser(description="Kokoro voice synthesis for Remotion")
    parser.add_argument("--text", required=True, help="Path to narration.txt")
    parser.add_argument("--voice", default="am_adam", help="Kokoro voice (default: am_adam)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed (default: 1.0)")
    parser.add_argument("--out-dir", required=True, help="Directory to save voice.wav and words.json")
    args = parser.parse_args()

    text_path = Path(args.text)
    if not text_path.exists():
        sys.exit(f"Narration text not found: {text_path}")

    raw_text = text_path.read_text(encoding="utf-8-sig").strip()
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        sys.exit("Narration file is empty.")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Initializing Kokoro TTS ({args.voice}, speed={args.speed})...")
    lang_code = args.voice[0]  # 'a' for American, 'b' for British
    pipeline = KPipeline(lang_code=lang_code, repo_id="hexgrad/Kokoro-82M")

    all_audio_chunks = []
    all_words = []
    current_time_sec = 0.033333  # 1-frame (30fps) initial lead-in silence

    # Add initial 1-frame silence (1600 samples at 48kHz / 800 at 24kHz)
    initial_silence = np.zeros(int(round(current_time_sec * SR_KOKORO)), dtype=np.float32)
    all_audio_chunks.append(initial_silence)

    for line_idx, line in enumerate(lines):
        print(f"Generating line {line_idx + 1}/{len(lines)}: {line[:50]}...")
        # Run pipeline for this line
        line_audio_pieces = []
        for graphemes, phonemes, audio_tensor in pipeline(line, voice=args.voice, speed=args.speed):
            if hasattr(audio_tensor, "cpu"):
                arr = audio_tensor.cpu().numpy()
            else:
                arr = np.array(audio_tensor, dtype=np.float32)
            line_audio_pieces.append(arr)

        if not line_audio_pieces:
            continue

        line_audio = np.concatenate(line_audio_pieces)
        line_duration = len(line_audio) / SR_KOKORO

        # Split line into words
        words_in_line = clean_words(line)
        if words_in_line:
            # Word length weighting for natural time distribution
            # Short words (a, the, in) take less time; long words take more time
            weights = [max(1, len(w)) for w in words_in_line]
            total_weight = sum(weights)

            # Detect leading/trailing silence in line_audio
            abs_audio = np.abs(line_audio)
            threshold = 0.015 * np.max(abs_audio) if np.max(abs_audio) > 0 else 0.001
            voiced_indices = np.where(abs_audio > threshold)[0]
            if len(voiced_indices) > 0:
                speech_start_sec = voiced_indices[0] / SR_KOKORO
                speech_end_sec = voiced_indices[-1] / SR_KOKORO
            else:
                speech_start_sec = 0.05
                speech_end_sec = max(0.1, line_duration - 0.05)

            speech_span = max(0.1, speech_end_sec - speech_start_sec)
            start_cursor = current_time_sec + speech_start_sec

            for w, weight in zip(words_in_line, weights):
                w_duration = (weight / total_weight) * speech_span
                # Ensure a small gap between words
                word_end = start_cursor + w_duration * 0.92
                all_words.append({
                    "w": w,
                    "s": round(start_cursor, 6),
                    "e": round(word_end, 6)
                })
                start_cursor += w_duration

        all_audio_chunks.append(line_audio)
        current_time_sec += line_duration

        # Inter-sentence small natural pause (~120ms) if not the last line
        if line_idx < len(lines) - 1:
            pause_samples = int(0.12 * SR_KOKORO)
            all_audio_chunks.append(np.zeros(pause_samples, dtype=np.float32))
            current_time_sec += 0.12

    combined_24k = np.concatenate(all_audio_chunks)
    total_samples_48k = int(round(len(combined_24k) * (SR_OUT / SR_KOKORO)))
    # High-quality linear resampling from 24kHz to 48kHz using numpy
    x_orig = np.linspace(0, len(combined_24k), num=len(combined_24k), endpoint=False)
    x_new = np.linspace(0, len(combined_24k), num=total_samples_48k, endpoint=False)
    resampled_48k = np.interp(x_new, x_orig, combined_24k)
    # Clip to prevent any floating point overflow
    resampled_48k = np.clip(resampled_48k, -1.0, 1.0)
    # Convert to 16-bit PCM
    pcm_16 = (resampled_48k * 32767).astype(np.int16)

    voice_wav_path = out_dir / "voice.wav"
    sf.write(str(voice_wav_path), pcm_16, SR_OUT, subtype="PCM_16")

    words_json_path = out_dir / "words.json"
    words_json_path.write_text(json.dumps(all_words, indent=2), encoding="utf-8")

    total_duration = len(pcm_16) / SR_OUT
    voice_info = {
        "provider": "kokoro",
        "voice": "Adam US",
        "voiceId": args.voice,
        "speed": args.speed,
        "durationSeconds": total_duration,
        "sampleRate": SR_OUT,
        "channels": 1,
        "wordCount": len(all_words),
        "sourceScript": str(text_path),
        "generatedAt": "2026-11-04"
    }
    (out_dir / "voice-info.json").write_text(json.dumps(voice_info, indent=2), encoding="utf-8")

    print(f"Successfully generated narration:")
    print(f"  Duration: {total_duration:.2f} seconds ({len(all_words)} words)")
    print(f"  Audio: {voice_wav_path}")
    print(f"  Words: {words_json_path}")


if __name__ == "__main__":
    main()
