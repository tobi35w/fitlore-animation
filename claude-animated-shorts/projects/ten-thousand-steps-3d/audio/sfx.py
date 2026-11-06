"""Effects land on picture frames; sparse ambience leaves the fast narration clear."""
import numpy as np
from dsp import ns, rng, place, pan, norm_to, fades, bp
import timeline as T
import sfx_gen as G

def build():
    x=np.zeros((2,ns(T.DUR))); r=rng(529); cues=[]
    def add(f,y,lufs,pan_at,description):
        place(x,pan(norm_to(y,lufs),pan_at),f/T.FPS)
        cues.append((f,description))
    for f,shot,foot in T.footfalls():
        add(f,G.step(r),-23 if shot not in [2,16] else -29,(-.12 if foot else .12),'sneaker contact')
    add(T.EVENTS['watch-celebrate'],G.chime(r),-17,0,'watch ring completes')
    add(T.SHOTS[8]['a']+4,G.hinge(r),-25,.3,'refrigerator hinge')
    for i,n in enumerate(['coin-one','coin-two','coin-three']):
        add(T.EVENTS[n],G.coin(r,i),-18,-.12+i*.12,n+' glass impact')
    add(T.EVENTS['turn'],G.cloth(r),-25,0,'turn and wrist cloth')
    add(T.EVENTS['hands-meet'],G.cloth(r,.18),-26,0,'hands meet')
    return fades(x,.005,.04),cues
