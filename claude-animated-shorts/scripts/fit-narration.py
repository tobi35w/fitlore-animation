"""Fit one narration line per shot, preserving pitch and every spoken word."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import wave
import numpy as np

SR = 48000


def read_pcm(path: Path) -> np.ndarray:
    with wave.open(str(path), 'rb') as wav:
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (SR, 1, 2):
            raise ValueError('Expected 48 kHz mono, 16-bit speech')
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float64) / 32768


def fit(source: Path, words_file: Path, text_file: Path, plan_file: Path, output: Path) -> dict:
    plan = json.loads(plan_file.read_text(encoding='utf-8-sig'))
    words = json.loads(words_file.read_text(encoding='utf-8-sig'))
    lines = [line.strip() for line in text_file.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    expected = [token for line in lines for token in line.split()]
    if expected != [word['w'] for word in words]:
        raise ValueError('Character alignment differs from the script. Review the cached source alignment before fitting shots.')
    segments = plan['segments']
    duration = float(plan['durationSeconds'])
    if len(lines) != len(segments):
        raise ValueError('Use exactly one non-empty narration line per timing segment.')
    source_pcm = read_pcm(source)
    source_duration = len(source_pcm) / SR
    if not np.isfinite(duration) or duration <= 0:
        raise ValueError('Invalid target duration')
    output.mkdir(parents=True, exist_ok=True)
    track = np.zeros(round(duration * SR))
    remapped = []
    reports = []
    cursor = 0
    last_end = 0
    for index, (line, segment) in enumerate(zip(lines, segments)):
        a, b = float(segment['a']), float(segment['b'])
        if not all(np.isfinite([a, b])) or a < last_end or b <= a or b > duration:
            raise ValueError(f'Invalid or overlapping shot window {index + 1}')
        count = len(line.split())
        selected = words[cursor:cursor + count]
        # Keep up to 40 ms before and 65 ms after speech without clipping a neighbouring line.
        previous_end = words[cursor - 1]['e'] if cursor else 0
        next_start = words[cursor + count]['s'] if cursor + count < len(words) else source_duration
        source_start = max(previous_end, selected[0]['s'] - 0.04, 0)
        source_end = min(next_start, selected[-1]['e'] + 0.065, source_duration)
        available = b - a - 0.14
        tempo = max(1.0, (source_end - source_start) / available)
        if not np.isfinite(tempo) or tempo > float(plan.get('maxTempo', 1.5)):
            raise ValueError(f'Shot {index + 1} needs {tempo:.2f}x tempo. Extend its window or use a faster source voice; speech was not truncated.')
        target_start = a + 0.04
        piece = output / f'segment-{index + 1:02d}.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-af',
            f'atrim=start={source_start:.8f}:end={source_end:.8f},asetpts=PTS-STARTPTS,atempo={tempo:.8f}',
            '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(piece)], check=True, capture_output=True)
        pcm = read_pcm(piece)
        start = round(target_start * SR)
        end = start + len(pcm)
        if end > round(b * SR):
            raise ValueError(f'FFmpeg segment {index + 1} exceeds its shot; no audio was cut.')
        # Four-millisecond ramps at the trimmed silence boundaries prevent splice clicks.
        fade = min(round(0.004 * SR), len(pcm) // 2)
        if fade:
            pcm[:fade] *= np.linspace(0, 1, fade)
            pcm[-fade:] *= np.linspace(1, 0, fade)
        track[start:end] = pcm
        for word in selected:
            s = target_start + (word['s'] - source_start) / tempo
            e = target_start + (word['e'] - source_start) / tempo
            if e > b + 0.01:
                raise ValueError(f'Word timing escaped shot {index + 1}')
            remapped.append({'w': word['w'], 's': round(s, 6), 'e': round(e, 6)})
        reports.append({'shot': index + 1, 'a': a, 'b': b, 'sourceStart': source_start,
            'sourceEnd': source_end, 'tempo': round(tempo, 5), 'speechEnd': remapped[-1]['e'], 'words': count})
        cursor += count
        last_end = b
    with wave.open(str(output / 'voice.wav'), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes((np.clip(track, -1, 0.999969) * 32768).astype('<i2').tobytes())
    (output / 'words.json').write_text(json.dumps(remapped, indent=2) + '\n', encoding='utf-8')
    report = {'durationSeconds': duration, 'wordCount': len(remapped), 'segments': reports,
              'method': 'Pitch-preserving FFmpeg atempo per shot; word timings are approximately remapped'}
    (output / 'timing-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(f'Fitted {len(remapped)} words to {len(segments)} shots, {duration:.3f} s; maximum tempo {max(r["tempo"] for r in reports):.2f}x.')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['source', 'words', 'text', 'plan', 'out']:
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    fit(args.source, args.words, args.text, args.plan, args.out)
