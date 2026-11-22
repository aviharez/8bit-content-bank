"""Average a kick over many hits and print its pitch sweep, level envelope and harmonics.

Usage: python3 scripts/analyze_swoop.py <wav> <bpm> <offset_s> '[16th steps...]' [label]
Compare with the target in music/_shared/swoop.py (the owner's reference kick).
"""
import wave, numpy as np, sys, json
from scipy.signal import stft
def load(p):
    w=wave.open(p); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float).reshape(-1,w.getnchannels()).mean(1)/32768; return x,sr
def measure(x,sr,starts,dur=0.3,label=''):
    acc=None; wav=None
    for t0 in starts:
        seg=x[int(t0*sr):int((t0+dur)*sr)]
        if len(seg)<int(dur*sr): continue
        f,t,Z=stft(seg,sr,nperseg=1024,noverlap=1024-32,nfft=16384,boundary=None)
        P=np.abs(Z)**2; acc=P if acc is None else acc+P
        wav=seg**2 if wav is None else wav+seg**2
    sel=(f>60)&(f<400); ff=f[sel]
    f0=np.array([ff[acc[sel][:,j].argmax()] for j in range(acc.shape[1])])
    lv=10*np.log10(acc.sum(0)+1e-20); lv-=lv.max()
    j=np.searchsorted(t,0.04); col=acc[:,j]; F=f0[j]
    h=[round(10*np.log10(col[(f>F*k*0.93)&(f<F*k*1.07)].max()/col[(f>F*0.93)&(f<F*1.07)].max())) for k in range(1,7)]
    pick=[0.005,0.01,0.02,0.04,0.06,0.09,0.12,0.16,0.2]
    print(label)
    print('  f0 Hz :',[(int(p*1000),int(f0[np.searchsorted(t,p)])) for p in pick])
    print('  lvl dB:',[(int(p*1000),round(lv[np.searchsorted(t,p)])) for p in pick])
    print('  harm@40ms (h1..h6 dB):',h)
    # share of kick energy above 200 Hz (phone audible) in first 120 ms
    tot=acc[:, t<0.12].sum(); hi=acc[f>200][:, t<0.12].sum(); print('  energy >200Hz in first 120ms: %.0f%%'%(100*hi/tot))
if __name__=='__main__':
    x,sr=load(sys.argv[1]); bpm=float(sys.argv[2]); off=float(sys.argv[3]); steps=json.loads(sys.argv[4])
    step=60/bpm/4; measure(x,sr,[off+i*step-0.003 for i in steps],label=sys.argv[5] if len(sys.argv)>5 else '')
