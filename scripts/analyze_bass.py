"""Bass check against the reference: low-end level folded over one beat (does it drop out between kicks?),
bass grit (150-600 Hz vs 30-150 Hz energy) and the bass notes.

Usage: python3 scripts/analyze_bass.py <file.wav> <bpm> <start_s> <end_s>
Targets (reference): lowest/highest across the beat >= 0.65, grit >= 1.0.
"""
import numpy as np, wave, sys
def load(p):
    w=wave.open(p);sr=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float).reshape(-1,w.getnchannels());return x.mean(1)/32768,x,sr
def report(p,bpm,t0,t1,label):
    m,x,sr=load(p); m=m[int(t0*sr):int(t1*sr)]
    N=8192;hop=256
    fr=np.lib.stride_tricks.sliding_window_view(m,N)[::hop]*np.hanning(N);S=np.abs(np.fft.rfft(fr,axis=1));f=np.fft.rfftfreq(N,1/sr)
    t=np.arange(len(S))*hop/sr+N/2/sr
    low=S[:,(f>=30)&(f<150)].sum(1); up=S[:,(f>=150)&(f<600)].sum(1)
    spb=60/bpm
    # fold low-band envelope over one beat in 16 slices
    ph=((t/spb)%1*16).astype(int); fold=np.array([low[ph==i].mean() for i in range(16)]); fold=fold/fold.max()
    print(f"[{label}] low-band (30-150 Hz) level across one beat (16 slices):")
    print("   "+" ".join(f"{v:.2f}" for v in fold), f"  min/max = {fold.min():.2f}")
    print(f"   bass harmonics ratio (150-600 Hz / 30-150 Hz energy): {up.sum()/low.sum():.2f}")
    # pitch track of the bass: strongest bin 35-130 Hz per frame
    band=(f>=35)&(f<130); pk=f[band][np.argmax(S[:,band],axis=1)]
    notes=np.round(12*np.log2(pk/440)+69).astype(int)
    names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    vals,counts=np.unique(notes,return_counts=True); order=np.argsort(-counts)[:6]
    print("   bass notes (share of frames):",", ".join(f"{names[v%12]}{v//12-1} {100*counts[i]/len(notes):.0f}%" for i,v in zip(order,vals[order])))
    # how often the bass note changes (per beat)
    ch=(np.diff(notes)!=0).sum()/((t1-t0)/spb); print(f"   bass note changes per beat: {ch:.2f}")
if __name__ == '__main__':
    report(sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[1])
