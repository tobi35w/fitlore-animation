"""Read the episode's shared frame timeline; never keep a second shot schedule."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
ROOT = HERE.parents[2]
SOURCE = PROJECT / "timeline.json"
DATA = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
FPS = int(DATA["fps"])
TOTAL = int(DATA["total"])
DURATION = TOTAL / FPS
SAMPLE_RATE = 48000
SAMPLES = round(DURATION * SAMPLE_RATE)
SHOTS = {int(shot["id"]): shot for shot in DATA["shots"]}
EVENTS = {event["name"]: event for event in DATA["events"]}
SOURCE_SHA256 = hashlib.sha256(SOURCE.read_bytes()).hexdigest()

assert FPS == 30 and TOTAL == 1981
assert [SHOTS[n]["b"] for n in range(1, len(SHOTS))] == [SHOTS[n]["a"] for n in range(2, len(SHOTS) + 1)]
assert SHOTS[1]["a"] == 0 and SHOTS[len(SHOTS)]["b"] == TOTAL


def seconds(frame: int | float) -> float:
    return frame / FPS


def event_frame(name: str) -> int:
    return int(EVENTS[name]["frame"])


def shot_at(frame: int) -> int:
    return next(number for number, shot in SHOTS.items() if shot["a"] <= frame < shot["b"])


def selected_footfalls() -> list[tuple[int, int]]:
    """Footfall contacts aligned with walking shots."""
    # Shots 3, 6, 10: walking shots
    frames = []
    for shot_id in [3, 6, 10]:
        s = SHOTS[shot_id]
        for f in range(s["a"] + 15, s["b"] - 10, 16):
            frames.append((f, shot_id))
    return sorted(frames)
