"""Sync check: does every scheduled hit sound on its frame, in the stems and in the encoded MP4?

Usage (repo root):  uv run --locked python scripts/check_sync.py <slug>

For timelines in the common event shape (docs/production-workflow.md: `events` with `frame` and `instrument`).
1. Encode offset: cross-correlates the MP4's decoded audio with public/<slug>/track.wav (includes AAC priming).
2. Per instrument: on its isolated stem (music/<slug>/output/stems/<instrument>.wav, which is the same timeline as
   track.wav), finds the attack of each event as the 1 ms hop of steepest envelope rise within -10..+40 ms of the
   frame time (works for held sounds too, whose previous note is still ringing when the next one starts).
PASS when the encode offset and every instrument's 95th-percentile |offset| are within one frame (33.3 ms at 30 fps).
Stems are checked only for the instruments that have one with the same name as the event `instrument`.
This measures audio placement on the frame grid. Whether the picture shows the event on that frame is checked by
stepping through frames (CLAUDE.md, Sync).
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import hilbert

ROOT = Path(__file__).resolve().parents[1]
SR = 48000


def read_wav(p: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(p)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    dt = {2: np.int16, 4: np.int32}[sw]
    x = np.frombuffer(raw, dtype=dt).astype(np.float64).reshape(-1, ch).mean(1) / np.iinfo(dt).max
    return x, sr


def env_ms(x: np.ndarray, sr: int) -> np.ndarray:
    hop = sr // 1000
    n = len(x) // hop
    return np.sqrt((x[: n * hop] ** 2).reshape(n, hop).mean(1))


def main() -> None:
    slug = sys.argv[1]
    tl = json.loads((ROOT / "public" / slug / "timeline.json").read_text())
    fps = tl["fps"]
    frame_ms = 1000 / fps
    ok = True

    # 1. encode offset of the MP4 against the master WAV (envelopes at 1 ms, cross-correlated over +-200 ms)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "renders" / f"{slug}.mp4"), "-vn", "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    mp4 = env_ms(np.frombuffer(raw, dtype=np.float32).astype(np.float64), SR)
    wav_x, wav_sr = read_wav(ROOT / "public" / slug / "track.wav")
    wav = env_ms(wav_x, wav_sr)
    n = min(len(mp4), len(wav))
    a, b = mp4[:n] - mp4[:n].mean(), wav[:n] - wav[:n].mean()
    lags = range(-200, 201)
    corr = [float(np.dot(a[max(0, L):n + min(0, L)], b[max(0, -L):n - max(0, L)])) for L in lags]
    lag = list(lags)[int(np.argmax(corr))]
    print(f"encode offset (MP4 audio vs track.wav): {lag:+d} ms")
    ok &= abs(lag) <= frame_ms

    # 2. per-instrument attack times on the stems
    stems = ROOT / "music" / slug / "output" / "stems"
    for inst in sorted({e["instrument"] for e in tl["events"]}):
        p = stems / f"{inst}.wav"
        if not p.exists():
            print(f"{inst:6s} no stem, skipped")
            continue
        x, sr = read_wav(p)
        # analytic envelope (no ripple at the wave's own period on low notes), smoothed over 5 ms so a resonant or
        # distorted tone's inner wobble does not outrank its attack
        env = np.convolve(env_ms(np.abs(hilbert(x)), sr), np.ones(5) / 5, mode="same")
        offs = []
        for e in (e for e in tl["events"] if e["instrument"] == inst):
            t = int(round(e["frame"] / fps * 1000))
            lo, hi = max(0, t - 10), min(len(env), t + 40)
            if hi <= lo:
                continue
            seg = env[max(0, lo - 3):hi]
            rise = seg[3:] - seg[:-3] if lo >= 3 else np.diff(env[lo:hi], prepend=env[lo])  # rise over 3 ms
            k = int(np.argmax(rise))
            offs.append(lo + k - t)
        o = np.abs(np.array(offs))
        p95 = float(np.percentile(o, 95))
        print(f"{inst:6s} {len(offs):4d} events: attack - frame time median {np.median(offs):+.0f} ms, "
              f"|p95| {p95:.0f} ms, |max| {o.max():.0f} ms ({o.max() / frame_ms:.2f} frames)")
        ok &= p95 <= frame_ms
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
