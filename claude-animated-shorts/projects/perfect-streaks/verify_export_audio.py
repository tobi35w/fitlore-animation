"""Compare encoded audio against the exact mix approved by the user."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import numpy as np
from scipy import signal

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "templates/audio"))
from dsp import read_wav


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    approval = json.loads((HERE / "voice/listening-review.json").read_text(encoding="utf-8"))
    mix_path = HERE / "audio/mix.wav"
    assert approval["status"] == "pass" and approval["reviewer"] == "user"
    assert approval["mixSha256"] == digest(mix_path) == digest(ROOT / "public/projects/perfect-streaks/audio/mix.wav")
    source, rate = read_wav(str(mix_path))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(args.video), "-map", "0:a:0",
                          "-ac", "2", "-ar", "48000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    encoded = np.frombuffer(raw, dtype="<f4").reshape(-1, 2).T.astype(np.float64)
    assert rate == 48000 and source.shape == (2, 3009600)
    assert encoded.shape[1] >= source.shape[1], "Encoded audio is shorter than the approved mix."
    tail_samples = encoded.shape[1] - source.shape[1]
    decoded = encoded[:, :source.shape[1]]
    mono_source, mono_decoded = source.mean(axis=0), decoded.mean(axis=0)
    seconds = 8 * rate
    sparse_source, sparse_decoded = mono_source[:seconds:8], mono_decoded[:seconds:8]
    correlation = signal.correlate(sparse_decoded, sparse_source, mode="full", method="fft")
    coarse = (int(np.argmax(correlation)) - len(sparse_source) + 1) * 8
    candidates = list(range(coarse - 8, coarse + 9))
    scores = []
    for lag in candidates:
        a, b = max(16, -lag + 16), seconds - max(16, lag + 16)
        scores.append(float(np.dot(mono_source[a:b], mono_decoded[a + lag:b + lag])))
    lag = candidates[int(np.argmax(scores))]
    error = decoded - source
    energy = float(np.sum(source ** 2))
    snr = float(10 * np.log10(energy / np.sum(error ** 2)))
    agreement = float(np.sum(source * decoded) / np.sqrt(energy * np.sum(decoded ** 2)))
    blocks = []
    for start in range(0, source.shape[1], rate):
        a, b = source[:, start:start + rate], decoded[:, start:start + rate]
        norm = float(np.sqrt(np.sum(a ** 2) * np.sum(b ** 2)))
        blocks.append(float(np.sum(a * b) / norm) if norm else 1.0)
    report = {
        "status": "pass" if abs(lag) <= 1 and agreement >= .99 and snr >= 18 and min(blocks) >= .97 else "investigate",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "video": str(args.video.resolve()), "videoSha256": digest(args.video),
        "approvedMixSha256": digest(mix_path), "listeningReviewer": "user", "userResponse": approval["userResponse"],
        "assistantListeningClaim": False,
        "method": "Decode the AAC track; compare all source samples and one-second windows to the approved 48 kHz stereo mix; measure start alignment independently.",
        "sourceSamplesPerChannel": source.shape[1], "decodedSamplesPerChannel": encoded.shape[1],
        "aacTailPaddingSamples": tail_samples, "alignmentLagSamples": lag,
        "waveformCorrelation": agreement, "signalToEncodingErrorDb": snr,
        "minimumOneSecondCorrelation": min(blocks), "oneSecondCorrelations": blocks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "alignmentLagSamples", "waveformCorrelation", "signalToEncodingErrorDb", "minimumOneSecondCorrelation", "aacTailPaddingSamples")}))
    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
