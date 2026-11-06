"""Exact-length 48 kHz mix. Voice samples are unchanged before the common mastering pass."""
import hashlib,json,subprocess
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter1d
from dsp import SR,ns,st,dbg,read_wav,write_wav,integrated,true_peak
import timeline as T
import music,sfx

HERE=Path(__file__).resolve().parent
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    settings=json.loads((T.PROJECT/'sound.json').read_text())
    voice,rate=read_wav(str(T.PROJECT/'voice/voice.wav'))
    if rate!=SR or voice.shape[-1]!=ns(T.DUR): raise ValueError('Voice must match picture exactly.')
    words=json.loads((T.PROJECT/'voice/words.json').read_text())
    music_raw=music.build();fx_raw,cues=sfx.build()
    duck=np.ones(ns(T.DUR))
    for w in words:
        a=max(0,ns(w['s']-.065));b=min(len(duck),ns(w['e']+.1));duck[a:b]=dbg(settings['duckDb'])
    duck=np.interp(np.arange(len(duck)),np.arange(len(duck[::48]))*48,gaussian_filter1d(duck[::48],25))
    m=music_raw*dbg(settings['musicGainDb'])*duck
    e=fx_raw*dbg(settings['sfxGainDb'])
    v=st(voice)
    # FLOAT premix avoids clipping without applying gain to the voice stem.
    from scipy.io import wavfile
    wavfile.write(HERE/'premix.wav',SR,(v+m+e).T.astype(np.float32))
    write_wav(str(HERE/'stem-voice.wav'),v);write_wav(str(HERE/'stem-music.wav'),m);write_wav(str(HERE/'stem-sfx.wav'),e)
    command=['ffmpeg','-v','error','-y','-i',str(HERE/'premix.wav'),'-af',f"loudnorm=I={settings['targetLufs']}:TP=-1.5:LRA=9,aresample=48000,apad,atrim=end_sample={ns(T.DUR)}",'-ar',str(SR),'-ac','2','-c:a','pcm_s24le',str(HERE/'mix.wav')]
    subprocess.run(command,check=True)
    mixed,_=read_wav(str(HERE/'mix.wav'))
    report=dict(durationSeconds=T.DUR,sampleRate=SR,channels=2,targetLufs=settings['targetLufs'],integratedLufs=round(float(integrated(mixed)),2),truePeakDb=round(float(true_peak(mixed)),2),
        voiceSha256=sha(T.PROJECT/'voice/voice.wav'),wordsSha256=sha(T.PROJECT/'voice/words.json'),cuesSha256=sha(T.PROJECT/'sound.json'),timelineSha256=sha(T.PROJECT/'timeline.json'),
        musicGainDb=settings['musicGainDb'],sfxGainDb=settings['sfxGainDb'],duckDb=settings['duckDb'],effects=len(cues),mix=str(HERE/'mix.wav'),voiceProcessing=json.loads((T.PROJECT/'voice/voice-info.json').read_text()).get('voiceProcessing','None before common loudness mastering'))
    if mixed.shape[-1]!=ns(T.DUR) or not -15<=report['integratedLufs']<=-13 or report['truePeakDb']>-1: raise ValueError(report)
    (HERE/'audio-report.json').write_text(json.dumps(report,indent=2)+'\n')
    (HERE/'cues.md').write_text('# Ten Thousand Steps — sound cues\n\nOriginal plucked motif, sparse blue-scene vibes, warm final cadence. Music +3 dB; effects -6 dB; music ducked 6 dB under voice.\n\n| Frame | Seconds | Cue |\n|---|---|---|\n'+'\n'.join(f'| {f} | {f/T.FPS:.3f} | {label} |' for f,label in sorted(cues))+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
