"""Fit the requested Liam take to the approved picture; preserve the George version."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
VOICE = PROJECT / 'voice'
OUT = ROOT / 'out/ten-thousand-steps-3d/social-voice-v3'
SR = 48000


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_json(p, data):
    p.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    backup = PROJECT / 'versions/george-v2'
    if not backup.exists():
        backup.mkdir(parents=True)
        for name in ['project.json', 'sound.json', 'voice/voice.wav', 'voice/words.json',
                     'voice/voice-info.json', 'voice/planned-pauses.json',
                     'audio/mix.wav', 'audio/audio-report.json']:
            dest = backup / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(PROJECT / name, dest)
    old = json.loads((backup / 'voice/words.json').read_text())
    # Move the intact offered-hand sentence 20 ms earlier so the reaction leads its word.
    old[209]['s'] -= .020
    old[213]['e'] -= .020
    old[140]['s'] -= .020
    old[146]['e'] -= .020
    source = json.loads((ROOT / 'out/ten-thousand-steps-3d/liam-source.json').read_text())
    words = source['words']
    assert [w['w'] for w in words] == [w['w'] for w in old]
    clean = OUT / 'source-declicked.wav'
    # Conservative impulse repair on narration only; transients in intentional SFX remain intact.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', source['wav'], '-af',
                    'adeclick=t=4', '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(clean)], check=True)
    config = json.loads((PROJECT / 'project.json').read_text())
    duration = config['durationInFrames'] / config['fps']
    track = np.zeros(round(duration * SR), dtype=np.float64)
    remapped = []
    reports = []
    # Whole sentences retain their delivery; two extra boundaries pin physical reactions.
    starts = [0] + [i + 1 for i, w in enumerate(old[:-1]) if re.search(r'[.!?]$', w['w'])]
    starts = sorted(set(starts + [71, 158]))
    for n, (a, end) in enumerate(zip(starts, starts[1:] + [len(words)])):
        b = end - 1
        tempo = (words[b]['e'] - words[a]['s']) / (old[b]['e'] - old[a]['s'])
        if not .80 <= tempo <= 1.25:
            raise ValueError(f'Unsafe speech tempo {tempo:.3f} in segment {n + 1}')
        before = min(.025, (words[a]['s'] - (words[a - 1]['e'] if a else 0)) / 2,
                     old[a]['s'] * tempo)
        after = min(.030, ((words[b + 1]['s'] if b + 1 < len(words) else source['durationSeconds']) - words[b]['e']) / 2)
        sa, sb = words[a]['s'] - before, words[b]['e'] + after
        target = old[a]['s'] - before / tempo
        piece = OUT / f'phrase-{n + 1:02}.wav'
        filters = (f'atrim=start={sa:.8f}:end={sb:.8f},asetpts=PTS-STARTPTS,'
                   f'rubberband=tempo={tempo:.8f}:transients=smooth:detector=soft:formant=preserved:pitchq=quality')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(clean), '-af', filters,
                        '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_f32le', str(piece)], check=True)
        rate, pcm = wavfile.read(piece)
        assert rate == SR
        pcm = pcm.astype(np.float64)
        # Ramps only touch the small retained silence margins. Every phrase starts/ends at zero.
        fi = max(1, min(round(.004 * SR), round(before / tempo * SR)))
        fo = max(1, min(round(.004 * SR), round(after / tempo * SR)))
        pcm[:fi] *= np.linspace(0, 1, fi)
        pcm[-fo:] *= np.linspace(1, 0, fo)
        start = round(target * SR)
        keep = min(len(pcm), len(track) - start)
        track[start:start + keep] += pcm[:keep]
        for w in words[a:end]:
            remapped.append({'w': w['w'], 's': round(old[a]['s'] + (w['s'] - words[a]['s']) / tempo, 6),
                             'e': round(old[a]['s'] + (w['e'] - words[a]['s']) / tempo, 6)})
        reports.append({'firstWord': a, 'lastWord': b, 'tempo': tempo, 'start': target,
                        'sourceStart': sa, 'sourceEnd': sb, 'samples': keep})
    assert np.isfinite(track).all() and np.max(np.abs(track)) < 1
    fade = round(.005 * SR)
    track[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(VOICE / 'voice.wav', SR, (track * 32767).astype(np.int16))
    write_json(VOICE / 'words.json', remapped)
    plan = OUT / 'timing-report.json'
    write_json(plan, {'voice': 'Liam', 'durationSeconds': duration, 'wordCount': len(words),
                     'sourceFingerprint': source['fingerprint'], 'segments': reports,
                     'method': 'Conservative impulse repair; pitch-preserving phrase fitting; 4 ms silence ramps',
                     'reviewStatus': 'Listening review pending'})
    info = { 'provider': 'elevenlabs', 'voice': 'Liam', 'voiceId': source['voiceId'], 'modelId': source['modelId'],
             'settings': source['settings'], 'durationSeconds': duration, 'sourceDurationSeconds': source['durationSeconds'],
             'sampleRate': SR, 'channels': 1, 'wordCount': len(words), 'sourceFingerprint': source['fingerprint'],
             'generatedAt': source['generatedAt'], 'requestId': source['requestId'],
             'scriptPath': str(PROJECT / 'narration.txt'), 'scriptSha256': sha(PROJECT / 'narration.txt'),
             'timingPath': str(plan), 'timingSha256': sha(plan),
             'voiceProcessing': 'Conservative click repair and pitch-preserving phrase timing; silence-boundary fades',
             'alignmentMethod': 'ElevenLabs alignment remapped through phrase fitting; reaction words pinned to picture'}
    write_json(VOICE / 'voice-info.json', info)
    config.update(voice='Liam', voiceId=source['voiceId'], voiceSettings=source['settings'])
    write_json(PROJECT / 'project.json', config)
    gaps = [{'after': remapped[i - 1]['w'], 'before': w['w'], 'start': remapped[i - 1]['e'], 'end': w['s'],
             'reason': 'Retained approved sentence/beat pause'} for i, w in enumerate(remapped)
            if i and w['s'] - remapped[i - 1]['e'] > .25]
    write_json(VOICE / 'planned-pauses.json', gaps)
    print(json.dumps({'wordCount': len(words), 'duration': duration, 'minTempo': min(r['tempo'] for r in reports),
                      'maxTempo': max(r['tempo'] for r in reports), 'samplePeak': float(np.max(np.abs(track))),
                      'report': str(plan)}))


if __name__ == '__main__':
    main()
