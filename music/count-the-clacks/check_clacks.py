"""Mix check: how loud the clack layers are against the music right after every hit, per level.
Run from the repo root: uv run --locked python music/count-the-clacks/check_clacks.py
Aim for 0 dB or louder at every level: the clacks are the point of the video."""
import importlib.util, numpy as np, wave, json
from pathlib import Path
spec=importlib.util.spec_from_file_location("c","music/count-the-clacks/compose.py");c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
from audio_as_code import render
out=Path("out/stems");out.mkdir(parents=True, exist_ok=True)
render(c.song,out/"mix.wav",stems_dir=out,normalize=False)
def load(p):
    w=wave.open(str(p));a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float).reshape(-1,w.getnchannels())/32768;return a.mean(1),w.getframerate()
names=[t.name for t in c.tracks];clack_idx=[i for i,nm in enumerate(names) if nm.startswith(("Clack","Squeeze"))]
stems=sorted(f for f in out.glob("*.wav") if f.name!="mix.wav")
sr=44100;L=max(len(load(f)[0]) for f in stems)
clk=np.zeros(L);rest=np.zeros(L)
for i,f in enumerate(stems):
    a,_=load(f);(clk if i in clack_idx else rest)[:len(a)]+=a
res={}
for e in c.events:
    s=int(e["sec"]*sr);w=int(0.05*sr)
    r=20*np.log10(np.sqrt((clk[s:s+w]**2).mean())+1e-9)-20*np.log10(np.sqrt((rest[s:s+w]**2).mean())+1e-9)
    res.setdefault(e["level"],[]).append(r)
for k,v in res.items(): print(f"level {k}: clack vs music in the 50 ms after each hit = {np.mean(v):+.1f} dB (min {np.min(v):+.1f})")
