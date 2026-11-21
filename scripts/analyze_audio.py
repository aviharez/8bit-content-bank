"""Measure a track the way we measured the reference: tempo (onset autocorrelation per band),
spectral balance, key estimate, stereo width and loudness per 4 s.

Usage: uv run --locked python scripts/analyze_audio.py <file.wav>
Compare a new soundtrack against docs/music-reference.md before shipping.
"""
import numpy as np, wave, sys
p=sys.argv[1]; w=wave.open(p); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float).reshape(-1,w.getnchannels())/32768
m=x.mean(1); side=(x[:,0]-x[:,1])/2
hop=512; N=2048
frames=np.lib.stride_tricks.sliding_window_view(m,N)[::hop]*np.hanning(N)
S=np.abs(np.fft.rfft(frames,axis=1)); f=np.fft.rfftfreq(N,1/sr)
def band(lo,hi): return S[:,(f>=lo)&(f<hi)].sum(1)
def onset(e): d=np.diff(np.log1p(e*50)); d[d<0]=0; return d
fr=sr/hop
def bpm(o,lo=70,hi=200):
    o=o-o.mean(); ac=np.correlate(o,o,'full')[len(o)-1:]
    lags=np.arange(len(ac)); b=60*fr/np.maximum(lags,1); mask=(b>=lo)&(b<=hi)
    i=np.argmax(ac*mask); return 60*fr/i, [round(60*fr/l,1) for l in np.argsort(-(ac*mask))[:6]]
kick=onset(band(30,120)); snare=onset(band(1500,5000)); hat=onset(band(7000,16000))
print("BPM full:",bpm(onset(S.sum(1))))
print("BPM kick:",bpm(kick)); print("BPM hat:",bpm(hat))
# energy split
tot=S.sum()
for lo,hi,name in [(20,60,'sub'),(60,250,'bass'),(250,2000,'mid'),(2000,6000,'presence'),(6000,20000,'air')]:
    print(f"{name:9s} {100*band(lo,hi).sum()/tot:5.1f}%")
# chroma key
chroma=np.zeros(12)
for i,ff in enumerate(f):
    if 60<ff<2000: chroma[int(round(12*np.log2(ff/440)))%12]+=S[:,i].sum()
names=['A','A#','B','C','C#','D','D#','E','F','F#','G','G#']
order=np.argsort(-chroma); print("chroma top:",[names[i] for i in order[:6]])
maj=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); mnr=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
best=max([(np.corrcoef(np.roll(maj,k),chroma)[0,1],names[k%12]+' major') for k in range(12)]+[(np.corrcoef(np.roll(mnr,k),chroma)[0,1],names[k%12]+' minor') for k in range(12)])
print("key estimate:",best[1],round(best[0],2))
print("stereo width (side/mid rms):",round(np.sqrt((side**2).mean())/np.sqrt((m**2).mean()),3))
# short-term loudness profile per 4s
seg=int(4*sr); print("RMS dB per 4s:",[round(20*np.log10(np.sqrt((m[i:i+seg]**2).mean())+1e-9),1) for i in range(0,len(m),seg)])
