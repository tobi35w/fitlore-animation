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

assert FPS == 30 and TOTAL == 1881
assert [SHOTS[n]["b"] for n in range(1, len(SHOTS))] == [SHOTS[n]["a"] for n in range(2, len(SHOTS) + 1)]
assert SHOTS[1]["a"] == 0 and SHOTS[len(SHOTS)]["b"] == TOTAL
assert {name: EVENTS[name]["frame"] for name in ("brick-land", "shoes-set", "paperweight")} == {
    "brick-land": 1123, "shoes-set": 1376, "paperweight": 1830,
}


def seconds(frame: int | float) -> float:
    return frame / FPS


def event_frame(name: str) -> int:
    return int(EVENTS[name]["frame"])


def shot_at(frame: int) -> int:
    return next(number for number, shot in SHOTS.items() if shot["a"] <= frame < shot["b"])


def selected_footfalls() -> list[tuple[int, int]]:
    """Subset of visible contacts, matching the cast's agreed deterministic gait.

    Shots 2/4/6/7/10/13/16: phase=(frame-shot.a)/30, contacts every 15 frames.
    Shot 2 stops at local frame 45. Shot 15: phase=(frame-shot.a-2)/33.
    Some contacts intentionally stay silent to preserve narration clarity.
    """
    selected = {2: [1, 2, 3], 4: [2], 6: [2, 4], 7: [1, 3], 10: [1, 3], 13: [1, 3], 16: [1, 3]}
    frames = [(SHOTS[shot]["a"] + 15 * count, shot) for shot, counts in selected.items() for count in counts]
    frames += [(round(SHOTS[15]["a"] + 2 + 16.5 * count), 15) for count in (2, 4, 8)]
    assert (event_frame("sensible-step"), 15) in frames
    assert all(SHOTS[shot]["a"] <= frame < SHOTS[shot]["b"] for frame, shot in frames)
    return sorted(frames)
