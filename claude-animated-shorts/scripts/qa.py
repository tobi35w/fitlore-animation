"""Decode every frame using bounded memory and write a visual/audio QA report."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw


def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def inspect(video, output, metadata=None, expected=None, frame_offset=0):
    output.mkdir(parents=True, exist_ok=True)
    probe = json.loads(command(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)]).stdout)
    stream = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)
    if stream is None:
        raise ValueError("No video stream")
    audio = [s for s in probe["streams"] if s["codec_type"] == "audio"]
    numerator, denominator = map(int, stream["r_frame_rate"].split("/"))
    fps = numerator / denominator
    errors, warnings, planned = [], [], set()
    metadata = metadata or {}
    expected = expected or {}
    for a, b in metadata.get("planned", []) + metadata.get("xfade", []) + ([metadata["flash"]] if "flash" in metadata else []):
        planned.update(range(a - 1 - frame_offset, b + 1 - frame_offset))
    for shot in metadata.get("shots", []):
        planned.update([shot["a"] - frame_offset - 1, shot["a"] - frame_offset])
    for key in ("width", "height"):
        if expected.get(key) and stream[key] != expected[key]:
            errors.append(f"Expected {key}={expected[key]}, found {stream[key]}")
    if expected.get("fps") and abs(fps - expected["fps"]) > 0.001:
        errors.append(f"Expected {expected['fps']} fps, found {fps}")
    if expected.get("audio") and not audio:
        errors.append("Expected an audio stream, but the video is silent")
    width, height = 180, 320
    frame_bytes = width * height * 3
    decoder = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-map", "0:v:0", "-vf",
        f"scale={width}:{height}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    previous, frozen_start = None, None
    black, white, blank, frozen, motion, brightness = [], [], [], [], [], []
    count, sheet = 0, None
    while True:
        raw = decoder.stdout.read(frame_bytes)
        if not raw:
            break
        if len(raw) != frame_bytes:
            errors.append("Truncated decoded frame")
            break
        frame = np.frombuffer(raw, np.uint8).reshape(height, width, 3)
        value = float((frame.astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)).mean() / 255)
        brightness.append(value)
        if float(frame.std(axis=(0, 1)).mean()) < 0.75 and count not in planned:
            blank.append(count)
        if value < 0.04 and count not in planned:
            black.append(count)
        if value > 0.93 and count not in planned:
            white.append(count)
        if previous is not None:
            difference = float(np.abs(frame.astype(np.int16) - previous.astype(np.int16)).mean())
            motion.append(difference)
            if difference < 0.02 and count not in planned:
                if frozen_start is None:
                    frozen_start = count - 1
            else:
                if frozen_start is not None and count - 1 - frozen_start >= 12:
                    frozen.append([frozen_start, count - 1])
                frozen_start = None
        previous = frame
        if count % 60 == 0:
            sheet = Image.new("RGB", (1080, 1152), "#161616")
        index = count % 60
        x, y = (index % 10) * 108, (index // 10) * 192
        sheet.paste(Image.fromarray(frame).resize((108, 192)), (x, y))
        draw = ImageDraw.Draw(sheet)
        draw.rectangle([x, y, x + 48, y + 14], fill="black")
        draw.text((x + 2, y + 1), str(count + frame_offset), fill="#ffe885")
        count += 1
        if count % 60 == 0:
            sheet.save(output / f"sheet_{count - 60:04d}.jpg", quality=85)
    if count % 60 and sheet is not None:
        sheet.save(output / f"sheet_{(count // 60) * 60:04d}.jpg", quality=85)
    if frozen_start is not None and count - 1 - frozen_start >= 12:
        frozen.append([frozen_start, count - 1])
    decode_error = decoder.stderr.read().decode("utf-8", errors="replace")
    if decoder.wait() != 0:
        errors.append("FFmpeg decoding failed: " + decode_error[-1000:])
    if count == 0:
        errors.append("No frames decoded")
    if expected.get("frames") and count != expected["frames"]:
        errors.append(f"Expected {expected['frames']} frames, decoded {count}")
    if black:
        errors.append(f"Unplanned black frames: {black[:20]}")
    if white:
        errors.append(f"Unplanned white frames: {white[:20]}")
    if blank:
        errors.append(f"Unplanned uniform-color frames: {blank[:20]}")
    if frozen:
        errors.append(f"Frozen spans of at least 12 frames: {frozen[:20]}")
    pops = [i + 1 for i, value in enumerate(motion) if value > 3 * float(np.median(motion[max(0, i - 8):i + 9])) + 1 and i + 1 not in planned]
    if pops:
        warnings.append(f"Review possible unplanned cuts/pops: {pops[:40]}")
    loudness = None
    if audio:
        measured = command(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-map", "0:a:0", "-af",
                            "ebur128=peak=true", "-f", "null", "-"]).stderr
        summary = measured[measured.rfind("Summary:"):]
        loudness = " | ".join(line.strip() for line in summary.splitlines() if line.strip().startswith(("I:", "LRA:", "Peak:")))
        peak = re.search(r"Peak:\s*([-\d.]+)\s*dBFS", summary)
        if peak and float(peak[1]) > 0:
            errors.append(f"Audio true peak exceeds 0 dBFS: {peak[1]}")
        if expected.get("audio") and re.search(r"I:\s*-inf", summary):
            errors.append("The audio track contains only silence")
    report = {"video": str(video), "passed": not errors, "width": stream["width"], "height": stream["height"],
              "fps": fps, "decodedFrames": count, "durationSeconds": float(probe["format"]["duration"]),
              "audioStreams": len(audio), "loudness": loudness, "blackFrames": black, "whiteFrames": white, "blankFrames": blank,
              "frozenSpans": frozen, "possiblePops": pops, "errors": errors, "warnings": warnings}
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# Render check", "", f"Result: {'PASS' if not errors else 'FAIL'}", "",
             f"{stream['width']} x {stream['height']}, {fps:g} fps, {count} decoded frames, {report['durationSeconds']:.3f} seconds.",
             f"Audio streams: {len(audio)}. {loudness or 'No audio measurement.'}", "",
             "Every frame was decoded. Contact sheets are beside this report; visual review is still required.", ""]
    lines.extend(f"- ERROR: {item}" for item in errors)
    lines.extend(f"- REVIEW: {item}" for item in warnings)
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    np.savez_compressed(output / "per-frame.npz", brightness=brightness, motion=motion)
    print(json.dumps(report, indent=2))
    return not errors


def inspect_still(image, output):
    output.mkdir(parents=True, exist_ok=True)
    picture = Image.open(image).convert("RGB")
    spatial_deviation = float(np.asarray(picture.resize((180, 320))).std(axis=(0, 1)).mean())
    report = {"image": str(image), "width": picture.width, "height": picture.height,
              "spatialDeviation": spatial_deviation, "passed": spatial_deviation >= 0.75}
    (output / (image.stem + ".json")).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report["passed"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--expected", type=Path)
    parser.add_argument("--frame-offset", type=int, default=0)
    parser.add_argument("--still", action="store_true")
    args = parser.parse_args()
    meta = json.loads(args.metadata.read_text(encoding="utf-8")) if args.metadata else None
    expected = json.loads(args.expected.read_text(encoding="utf-8")) if args.expected else None
    passed = inspect_still(args.video, args.out) if args.still else inspect(args.video, args.out, meta, expected, args.frame_offset)
    sys.exit(0 if passed else 1)
