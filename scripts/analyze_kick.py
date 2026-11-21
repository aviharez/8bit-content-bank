"""Kick check against the reference: pitch of the kick body, its sweep, how long the tail rings,
and how loud the kick window is against the rest of the beat.

Usage: python3 scripts/analyze_kick.py <file.wav> <bpm> <start_s> <end_s> [phase_s]
  phase_s: time of a kick inside the window if known (our tracks: 0 when kicks sit on the grid).
Reference "dem": body 43 Hz (sweeping down from ~59 Hz), tail -6 dB at 250-325 ms.
"""
import numpy as np, wave, sys
def load(p):
    w=wave.open(p);sr=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float).reshape(-1,w.getnchannels()).mean(1)/32768;return x,sr
def lp(x,sr,cut):
    F=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/sr);F[f>cut]=0;return np.fft.irfft(F,len(x))
def shape(p,bpm,t0,t1,label,phase=None):
    x,sr=load(p); seg=x[int(t0*sr):int(t1*sr)]; low=lp(seg,sr,200)
    spb=60/bpm; L=int(spb*sr)
    # find phase that maximises the averaged low-band onset at beat start
    best=None
    for ph in np.linspace(0,spb,96,endpoint=False):
        st=int(ph*sr); n=(len(low)-st)//L
        if n<4: continue
        avg=np.abs(low[st:st+n*L]).reshape(n,L).mean(0)
        sc=avg[:int(0.03*sr)].mean()-avg[int(0.3*L):int(0.45*L)].mean()
        if best is None or sc>best[0]: best=(sc,ph,n)
    _,ph,n=best
    if phase is not None: ph=phase
    st=int(ph*sr)
    n=n-1
    beats=low[st:st+n*L].reshape(n,L); full=seg[st:st+n*L].reshape(n,L)
    avg=np.abs(beats).mean(0); env=np.convolve(avg,np.ones(int(0.005*sr))/int(0.005*sr),'same')
    pk=env[:int(0.1*sr)].max(); i0=np.argmax(env[:int(0.1*sr)])
    def t_at(fr):
        j=np.where(env[i0:]<pk*fr)[0]; return 1000*j[0]/sr if len(j) else None
    # pitch of the kick body: spectrum of 20-150 ms after the hit, averaged over beats
    a,b=i0+int(0.02*sr),i0+int(0.15*sr)
    sp=np.abs(np.fft.rfft(beats[:,a:b]*np.hanning(b-a),n=16384,axis=1)).mean(0);f=np.fft.rfftfreq(16384,1/sr)
    m=(f>30)&(f<150); f0=f[m][np.argmax(sp[m])]
    # pitch sweep: peak frequency in 0-20 ms vs 60-120 ms
    def peakf(a,b):
        s=np.abs(np.fft.rfft(beats[:,a:b]*np.hanning(b-a),n=16384,axis=1)).mean(0);mm=(f>30)&(f<400);return f[mm][np.argmax(s[mm])]
    f_start=peakf(i0,i0+int(0.02*sr)); f_tail=peakf(i0+int(0.06*sr),i0+int(0.12*sr))
    # kick vs rest: low-band energy in first 120 ms vs remainder of the beat
    ratio=(avg[i0:i0+int(0.12*sr)]**2).mean()/((avg[i0+int(0.2*sr):]**2).mean()+1e-12)
    print(f"[{label}] beats averaged: {n}")
    print(f"   kick body pitch: {f0:.1f} Hz  (start {f_start:.0f} Hz -> tail {f_tail:.0f} Hz)")
    print(f"   decay: -6 dB at {t_at(0.5)} ms, -12 dB at {t_at(0.25)} ms, -20 dB at {t_at(0.1)} ms")
    print(f"   punch: low-band power first 120 ms vs rest of beat = {10*np.log10(ratio):.1f} dB")
    # how much of the whole mix is the kick: level of 0-120 ms window vs mid-beat, full band
    fa=np.abs(full).mean(0)
    print(f"   full-mix level, kick window vs mid-beat: {20*np.log10(fa[i0:i0+int(0.12*sr)].mean()/fa[int(0.4*L):int(0.6*L)].mean()):.1f} dB")
if __name__ == '__main__':
    a = sys.argv
    shape(a[1], float(a[2]), float(a[3]), float(a[4]), a[1], phase=float(a[5]) if len(a) > 5 else None)
