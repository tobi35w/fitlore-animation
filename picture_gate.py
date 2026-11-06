#!/usr/bin/env python3
"""
picture_gate.py - objective pass/fail gate for a vertical animated short.

Usage:  python picture_gate.py final.mp4 [--min-dur 55 --max-dur 70]
Needs:  python3, numpy, ffmpeg/ffprobe on PATH.  Exit code 0 = PASS, 1 = FAIL.

It exists because "looks fine to me" is not a check. A video that is a slideshow of
stills with a voice-over MUST fail here, and a short with a living camera and
animated characters must pass.
"""
import argparse, json, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--min-dur", type=float, default=55)
ap.add_argument("--max-dur", type=float, default=70)
ap.add_argument("--frozen-diff", type=float, default=0.05, help="mean |frame delta| (0-255 luma) below this = frozen")
ap.add_argument("--frozen-run", type=int, default=12, help="a frozen span this many frames or longer counts")
ap.add_argument("--max-frozen-pct", type=float, default=8.0, help="max %% of frames inside frozen spans")
ap.add_argument("--max-frozen-sec", type=float, default=0.8, help="longest allowed single frozen span (s)")
ap.add_argument("--max-shot-sec", type=float, default=7.0, help="longest allowed shot between hard cuts (s)")
ap.add_argument("--min-shots-per-min", type=float, default=8.0)
ap.add_argument("--cut-diff", type=float, default=12.0)
a = ap.parse_args()

run = lambda *c: subprocess.run(c, capture_output=True, text=True)
pr = json.loads(run("ffprobe", "-v", "error", "-show_entries",
                    "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", a.video).stdout)
v = next(s for s in pr["streams"] if s["codec_type"] == "video")
has_audio = any(s["codec_type"] == "audio" for s in pr["streams"])
W, H, dur = int(v["width"]), int(v["height"]), float(pr["format"]["duration"])
num, den = map(int, v["r_frame_rate"].split("/"))
fps = num / den

# --- decode small gray frames -------------------------------------------------
w, h = 96, 160
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={w}:{h},format=gray",
                      "-f", "rawvideo", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
n = len(d)

# --- frozen spans -------------------------------------------------------------
spans, s = [], None
for i, x in enumerate(d < a.frozen_diff):
    if x and s is None: s = i
    if (not x) and s is not None: spans.append((s, i - s)); s = None
if s is not None: spans.append((s, n - s))
spans = [(s0, l) for s0, l in spans if l >= a.frozen_run]
frozen_frames = sum(l for _, l in spans)
frozen_pct = 100.0 * frozen_frames / max(n, 1)
longest = max((l for _, l in spans), default=0) / fps

# --- hard cuts / shot lengths -------------------------------------------------
cuts = [0] + [i + 1 for i in np.where(d > a.cut_diff)[0]] + [n + 1]
shots = [(cuts[i], cuts[i + 1]) for i in range(len(cuts) - 1)]
lens = [(b - a_) / fps for a_, b in shots]
longest_shot = max(lens)
shots_per_min = len(shots) / (dur / 60)

# --- near-black / near-white / pop frames ------------------------------------
m = fr.mean(axis=(1, 2))
black = int((m < 8).sum()); white = int((m > 247).sum())

# --- audio --------------------------------------------------------------------
lufs = tp = None
if has_audio:
    e = run("ffmpeg", "-nostats", "-i", a.video, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-").stderr
    tail = e[e.rfind("Summary:"):]
    for line in tail.splitlines():
        t = line.strip()
        if t.startswith("I:"): lufs = float(t.split()[1])
        if t.startswith("Peak:"): tp = float(t.split()[1])

checks = [
    ("resolution is 9:16 (1080x1920 or 1440x2560)", (W, H) in [(1080, 1920), (1440, 2560)], f"{W}x{H}"),
    (f"duration {a.min_dur:.0f}-{a.max_dur:.0f} s", a.min_dur <= dur <= a.max_dur, f"{dur:.1f} s"),
    ("30 fps", abs(fps - 30) < 0.01, f"{fps:.2f}"),
    (f"frozen frames <= {a.max_frozen_pct}%", frozen_pct <= a.max_frozen_pct, f"{frozen_pct:.1f}%"),
    (f"longest frozen span <= {a.max_frozen_sec} s", longest <= a.max_frozen_sec, f"{longest:.1f} s"),
    (f"longest shot <= {a.max_shot_sec} s", longest_shot <= a.max_shot_sec, f"{longest_shot:.1f} s"),
    (f">= {a.min_shots_per_min} shots/min", shots_per_min >= a.min_shots_per_min, f"{shots_per_min:.1f}"),
    ("no black/white frames", black == 0 and white == 0, f"black {black}, white {white}"),
    ("has audio", has_audio, str(has_audio)),
    ("loudness -16..-12 LUFS", lufs is not None and -16 <= lufs <= -12, f"{lufs}"),
    ("true peak <= -1 dBTP", tp is not None and tp <= -1.0, f"{tp}"),
]
ok = True
print(f"GATE REPORT  {a.video}")
for name, passed, val in checks:
    print(f"  [{'PASS' if passed else 'FAIL'}] {name:<48} {val}")
    ok &= bool(passed)
if spans:
    worst = sorted(spans, key=lambda x: -x[1])[:5]
    print("  worst frozen spans (start s, length s):", [(round(s0 / fps, 1), round(l / fps, 1)) for s0, l in worst])
print("RESULT:", "PASS" if ok else "FAIL - fix and re-render; do not deliver")
sys.exit(0 if ok else 1)
