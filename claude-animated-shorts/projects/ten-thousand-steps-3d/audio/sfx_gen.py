"""Locally synthesized sneakers, cloth, glass/coin impacts and an unbranded watch chime."""
import numpy as np
from dsp import tt, bp, hp, lp, modal, fades, TAU

def step(r, kid=False):
    t=tt(.19)
    thud=np.sin(TAU*(125 if kid else 88)*t)*np.exp(-t/.024)
    grit=bp(r.standard_normal(len(t)),700,4500)*np.exp(-t/.013)*.4
    return fades(thud+grit,.001,.012)

def coin(r, variant=0):
    t=tt(.42)
    metal=modal(.42,[(1850+130*variant,1,.055),(3190,.42,.04),(5450,.24,.025)],r)
    glass=modal(.42,[(820,.5,.09),(1410,.3,.07),(2590,.25,.05)],r)
    return fades(metal+glass+hp(r.standard_normal(len(t)),4500)*np.exp(-t/.002)*.12,.001,.025)

def chime(r):
    t=tt(.58)
    y=np.sin(TAU*880*t)*np.exp(-t/.18)
    j=np.maximum(t-.14,0)
    y+=(t>=.14)*np.sin(TAU*1320*j)*np.exp(-j/.20)*.7
    return fades(y,.004,.05)

def cloth(r, duration=.25):
    t=tt(duration)
    return fades(bp(r.standard_normal(len(t)),350,3200)*np.sin(np.pi*t/duration)**2,.02,.035)

def hinge(r):
    t=tt(.55)
    return fades(lp(r.standard_normal(len(t)),800)*.15+np.sin(TAU*(150*t+30*t*t))*np.sin(np.pi*t/.55)**2*.25,.03,.04)
