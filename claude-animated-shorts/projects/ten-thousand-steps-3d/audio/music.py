"""Original plucked-string/vibraphone score: an impatient motif becomes a relaxed walk."""
import numpy as np
from dsp import SR, ns, rng, place, pan, fades, norm_to
import instruments as I
import timeline as T

def build():
    out = np.zeros((2, ns(T.DUR)))
    r = rng(17129)
    beat = T.WALK_CYCLE / 2
    # D major / B minor / G major / A: original six-note melody, no borrowed theme.
    chords = [(50,57,62,66), (47,54,59,62), (43,55,59,62), (45,57,61,64)]
    motif = [74,78,76,81,78,74,73,76]
    for i, t in enumerate(np.arange(0, T.DUR, beat)):
        ch = chords[(i//8)%4]
        explain = T.SHOTS[9]['a']/T.FPS <= t < T.SHOTS[14]['a']/T.FPS
        quiet = T.SHOTS[7]['a']/T.FPS <= t < T.SHOTS[9]['a']/T.FPS
        if quiet:
            continue
        if explain:
            if i%4 == 0:
                place(out, pan(I.vibes(I.m2f(ch[2]+12), .36, r, dur=1.2, trem_depth=.08), -.22), t, .55)
            if i%8 == 0:
                place(out, pan(I.pluck(I.m2f(ch[0]), .5, r, dur=1.1), .1), t, .65)
            continue
        place(out, pan(I.pluck(I.m2f(ch[0] if i%2==0 else ch[1]), .6, r, dur=.5), -.12), t, .8)
        note = motif[i%8] - (12 if t < 3 else 0)
        place(out, pan(I.musicbox(I.m2f(note), .42, r, dur=.6), .26), t+.05, .48)
        if i%2:
            for m in ch[1:]:
                place(out, pan(I.pluck(I.m2f(m), .3, r, dur=.3), -.3), t+.02, .45)
        place(out, pan(I.brush(.35, r, dur=.13), .18), t, .5)
    # A warm, modest final cadence; its tail ends with the last spoken word.
    for t, notes in [(60.9,[45,61,64]), (62.35,[50,62,66,69])]:
        for m in notes:
            place(out, pan(I.vibes(I.m2f(m),.35,r,dur=.75,trem_depth=.08),.15),t,.7)
    out = fades(out, .025, .16)
    return norm_to(out, -29, mode='integrated')
