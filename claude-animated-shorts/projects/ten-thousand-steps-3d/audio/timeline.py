"""One timeline for picture, footsteps, effects and musical scene changes."""
import json
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
PLAN = json.loads((PROJECT / 'timeline.json').read_text())
FPS, TOTAL = PLAN['fps'], PLAN['total']
DUR = TOTAL / FPS
SHOTS = {s['id']: s for s in PLAN['shots']}
EVENTS = {e['name']: e['frame'] for e in PLAN['events']}
WALK_CYCLE = 1.05
FAMILY_CYCLE = 1.18

def footfalls():
    for s in SHOTS.values():
        if s['id'] in [5, 7, 10, 11, 12, 13, 17]:
            continue
        cycle = FAMILY_CYCLE if s['id'] == 18 else WALK_CYCLE
        first = 0
        for k in range(int((s['b']-s['a']) / FPS / cycle * 2)+1):
            f = s['a'] + round(k*cycle/2*FPS)
            if f >= s['b'] or (s['id'] == 18 and f <= EVENTS['hands-meet']):
                continue
            yield f, s['id'], k % 2

def sec(name):
    return EVENTS[name] / FPS
