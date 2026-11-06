"""Extract exact encoded frames for this episode's visual review."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
TIMELINE = json.loads((HERE / "timeline.json").read_text(encoding="utf-8"))
FONT = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)


def extract(video: Path, folder: Path, frames: list[int]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    terms = [f"eq(n\\,{frame})" for frame in frames]
    expression = "+".join("(" + "+".join(terms[start:start + 20]) + ")" for start in range(0, len(terms), 20))
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", "select=" + expression,
                    "-fps_mode", "passthrough", str(folder / "sample-%04d.png")], check=True)
    for index, frame in enumerate(frames, 1):
        source = folder / f"sample-{index:04d}.png"
        target = folder / f"frame-{frame:04d}.png"
        if target.exists():
            raise FileExistsError(target)
        source.rename(target)


def sheet(folder: Path, output: Path, frames: list[int], labels: list[str], columns: int = 3) -> None:
    width, height, caption = 320, 569, 32
    rows = (len(frames) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * width, rows * (height + caption)), "#211c23")
    draw = ImageDraw.Draw(canvas)
    for index, (frame, label) in enumerate(zip(frames, labels)):
        x, y = (index % columns) * width, (index // columns) * (height + caption)
        picture = Image.open(folder / f"frame-{frame:04d}.png").convert("RGB")
        canvas.paste(picture.resize((width, height), Image.Resampling.LANCZOS), (x, y + caption))
        draw.text((x + 8, y + 7), label, font=FONT, fill="#f5e4bf")
    canvas.save(output, quality=93)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise FileExistsError("Use a fresh review folder to preserve prior versions.")
    samples = {shot["id"]: [shot["a"] + 15, (shot["a"] + shot["b"] - 1) // 2, shot["b"] - 1]
               for shot in TIMELINE["shots"]}
    impacts = [event for event in TIMELINE["events"] if event["name"] in ("brick-land", "shoes-set", "paperweight")]
    extra = [0, 1, 15, 35, 48, 70, 160, 432, 665, 760, 1010, 1123, 1376, 1480, 1660, 1760, 1841]
    for event in impacts:
        extra += [event["frame"] + delta for delta in (-3, 0, 6, 12, 20, 23, 24, 25)]
    qa_path = args.video.with_suffix("").with_name(args.video.stem + "-qa") / "report.json"
    pops = json.loads(qa_path.read_text(encoding="utf-8"))["possiblePops"] if qa_path.exists() else []
    extra += [max(0, min(TIMELINE["total"] - 1, frame + delta)) for frame in pops for delta in (-1, 0, 1)]
    frames = sorted(set(extra + [f for triple in samples.values() for f in triple]))
    extract(args.video, args.output, frames)
    manifest = {"video": str(args.video.resolve()), "sampleFrames": frames, "shots": samples, "sheets": []}
    for first in range(1, 19, 3):
        selected = [frame for shot in range(first, first + 3) for frame in samples[shot]]
        labels = [f"Shot {shot:02d} / f{frame:04d} / {frame / 30:.2f}s"
                  for shot in range(first, first + 3) for frame in samples[shot]]
        output = args.output / f"shots-{first:02d}-{first + 2:02d}.jpg"
        sheet(args.output, output, selected, labels)
        manifest["sheets"].append(output.name)
    for event in impacts:
        selected = [event["frame"] + delta for delta in (-3, 0, 6, 12, 20, 23, 24, 25)]
        output = args.output / (event["name"] + "-release.jpg")
        sheet(args.output, output, selected, [f"{event['name']} / f{frame:04d}" for frame in selected], 4)
        manifest["sheets"].append(output.name)
    for first in range(0, len(pops), 3):
        selected = [max(0, min(TIMELINE["total"] - 1, frame + delta)) for frame in pops[first:first + 3] for delta in (-1, 0, 1)]
        output = args.output / f"pop-review-{first // 3 + 1:02d}.jpg"
        sheet(args.output, output, selected, [f"Flagged transition / f{frame:04d}" for frame in selected])
        manifest["sheets"].append(output.name)
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"frames": len(frames), "sheets": len(manifest["sheets"]), "output": str(args.output)}))


if __name__ == "__main__":
    main()
