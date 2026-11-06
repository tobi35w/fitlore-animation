"""Run the original bridge score/effects against the configured local narration."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / 'templates/audio'
sys.path.insert(0, str(TEMPLATES))


def mix(project: Path) -> None:
    config = json.loads((project / 'project.json').read_text(encoding='utf-8'))
    cues_file = project / 'sound.json'
    cues = json.loads(cues_file.read_text(encoding='utf-8'))
    duration = config['durationInFrames'] / config['fps']
    voice_file = project / 'voice/voice.wav'
    words_file = project / 'voice/words.json'
    words = json.loads(words_file.read_text(encoding='utf-8'))
    if abs(duration - 67.5) > 0.001:
        raise ValueError('The original bridge score requires a 67.5-second picture.')
    with wave.open(str(voice_file), 'rb') as wav:
        if wav.getframerate() != 48000 or wav.getnframes() / 48000 > duration + 0.001:
            raise ValueError('Bridge narration must be 48 kHz and fit within the picture.')
    if not words or words[-1]['e'] > duration:
        raise ValueError('Missing words or speech outside the bridge picture.')
    output = project / 'audio'
    output.mkdir(parents=True, exist_ok=True)
    fingerprint = hashlib.sha256(voice_file.read_bytes() + cues_file.read_bytes())
    for file in sorted(TEMPLATES.glob('*.py')):
        fingerprint.update(file.read_bytes())
    spec = importlib.util.spec_from_file_location('bridge_mix', TEMPLATES / 'mix.py')
    engine = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(engine)
    engine.ROOT = str(project)
    engine.HERE = str(output)
    engine.CACHE = str(output / '_cache' / fingerprint.hexdigest()[:20])
    engine.TARGET_LUFS = float(cues.get('targetLufs', -16))
    # The original limiter captures its -1.2 dB ceiling as a default argument.
    engine.CEIL_DBTP = -1.2
    gain = float(cues.get('musicGainDb', -3))
    engine.MUSIC_TARGET = {name: level + gain for name, level in engine.MUSIC_TARGET.items()}
    engine.main()
    report = {'durationSeconds': duration, 'sampleRate': 48000, 'channels': 2,
        'engine': 'original bridge music and synchronized procedural effects',
        'targetLufs': engine.TARGET_LUFS, 'truePeakCeilingDb': engine.CEIL_DBTP,
        'voiceSha256': hashlib.sha256(voice_file.read_bytes()).hexdigest(),
        'wordsSha256': hashlib.sha256(words_file.read_bytes()).hexdigest(),
        'cuesSha256': hashlib.sha256(cues_file.read_bytes()).hexdigest()}
    (output / 'audio-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True, type=Path)
    mix(parser.parse_args().project)
