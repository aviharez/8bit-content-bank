"""Phone-speaker balance of a track: each layer's level in the 200 Hz-5 kHz band, from its own stem.

A phone plays almost nothing below ~200 Hz, so this is roughly what each layer weighs on a phone. The rule in
CLAUDE.md: the lead melody, the kick's top, the bass and the physics sounds sit within a few dB of each other.

Usage: uv run --locked python scripts/analyze_stems.py <slug> [start_bar end_bar ...]
Renders the song in music/<slug>/compose.py to /tmp/stems-<slug>/ and prints, per layer and per section,
the RMS in the band (dB, relative to the loudest layer), measured over the 16ths where the layer is playing.
"""

import importlib.util
import sys
from pathlib import Path

import wave

import numpy as np

from audio_as_code import render

ROOT = Path(__file__).resolve().parents[1]
slug = sys.argv[1]
bars = [int(x) for x in sys.argv[2:]] or None
spec = importlib.util.spec_from_file_location("compose", ROOT / "music" / slug / "compose.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
song = mod.song
out = Path(f"/tmp/stems-{slug}")
out.mkdir(exist_ok=True)
for f in out.glob("*.wav"):
    f.unlink()
render(song, out / "mix.wav", stems_dir=out, normalize=False)

spb = 60 / song.bpm


def read(path):
    with wave.open(str(path)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    dt = {2: np.int16, 4: np.int32}[sw]
    x = np.frombuffer(raw, dtype=dt).astype(np.float64) / np.iinfo(dt).max
    return x.reshape(-1, ch).mean(axis=1), sr


def band(x, sr, lo=200.0, hi=5000.0):
    X = np.fft.rfft(x)
    fq = np.fft.rfftfreq(len(x), 1 / sr)
    X[(fq < lo) | (fq > hi)] = 0
    return np.fft.irfft(X, len(x))


groups: dict[str, np.ndarray] = {}
sr = None
for f in sorted(out.glob("*.wav")):
    if f.name == "mix.wav":
        continue
    x, sr = read(f)
    idx = int(f.stem.split("_")[0]) - 1 if f.stem.split("_")[0].isdigit() else -1
    name = song.tracks[idx].name if 0 <= idx < len(song.tracks) else f.stem
    key = "Kick top" if name.lower().startswith("kick") and name.endswith("top") else "Kick body" if name.lower().startswith("kick") else name
    groups[key] = groups.get(key, 0) + x

n_bars = int(round(song.beats / 4))
sections = [(bars[i], bars[i + 1]) for i in range(0, len(bars) - 1, 2)] if bars else [(0, n_bars)]
step = int(sr * spb / 4)  # one 16th
rows = {}
for key, x in groups.items():
    y = band(x, sr)
    vals = []
    for a, b in sections:
        seg = y[int(a * 4 * spb * sr): int(b * 4 * spb * sr)]
        chunks = [seg[i:i + step] for i in range(0, len(seg) - step, step)]
        rms = np.array([np.sqrt(np.mean(c ** 2)) for c in chunks]) if chunks else np.array([0.0])
        peak = rms.max() if rms.size else 0
        on = rms[rms > peak * 0.1] if peak > 0 else rms
        vals.append(20 * np.log10(np.sqrt(np.mean(on ** 2)) + 1e-12) if peak > 0 else -120.0)
    rows[key] = vals
top = max(max(v) for v in rows.values())
print(f"{'layer':32s}" + "".join(f"  bars {a:>2}-{b:<2}" for a, b in sections))
for key, vals in sorted(rows.items(), key=lambda kv: -max(kv[1])):
    print(f"{key:32s}" + "".join(f"  {v - top:8.1f} " if v > -100 else "        -  " for v in vals))
