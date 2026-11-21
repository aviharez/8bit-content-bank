"""Mastering helpers shared by every soundtrack in the bank.

- to_scientific_pitch: retune a render so every C is an exact power of two in hertz (C4 = 256 Hz)
- finish_loop: fold the tail past the loop point onto the start, set loudness, limit peaks
"""

import subprocess
import wave
from pathlib import Path

import numpy as np

from audio_as_code import measure_loudness

# Equal temperament at A440 puts C4 at 261.6256 Hz; scientific pitch puts it at 256 Hz.
SCIENTIFIC_RATIO = 256 / 261.6255653


def render_bpm_for_scientific_pitch(bpm: float) -> float:
    """Render at this tempo, then call to_scientific_pitch: the result plays at `bpm` exactly."""
    return bpm / SCIENTIFIC_RATIO


def to_scientific_pitch(path: Path) -> None:
    """Play the file back slower by SCIENTIFIC_RATIO (pitch -37.6 cents, tempo x0.9785), no time-stretch."""
    with wave.open(str(path)) as w:
        sr = w.getframerate()
    tmp = path.with_suffix(".sci.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path),
         "-af", f"asetrate={sr * SCIENTIFIC_RATIO:.4f},aresample={sr}:resampler=soxr", str(tmp)],
        check=True,
    )
    tmp.replace(path)


def limit(x: np.ndarray, sr: int, ceiling: float, release_s: float = 0.08, lookahead_s: float = 0.003) -> np.ndarray:
    """Simple lookahead peak limiter: gain follows the loudest sample ahead, releases smoothly."""
    peak = np.abs(x).max(axis=1)
    la = max(1, int(lookahead_s * sr))
    ahead = np.maximum.reduce([np.roll(peak, -k) for k in range(la)])
    target = np.minimum(1.0, ceiling / np.maximum(ahead, 1e-9))
    rel = np.exp(-1 / (release_s * sr))
    g = np.empty_like(target)
    cur = 1.0
    for i, t in enumerate(target):
        cur = t if t < cur else t + (cur - t) * rel
        g[i] = cur
    return x * g[:, None]


def finish_loop(path: Path, loop_seconds: float, target_lufs: float = -14.0, ceiling_dbfs: float = -1.0) -> dict:
    """Fold the tail past the loop point onto the start, set loudness, limit peaks."""
    with wave.open(str(path)) as w:
        sr, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    dtype = {2: np.int16, 4: np.int32}[width]
    data = np.frombuffer(raw, dtype=dtype).astype(np.float64).reshape(-1, ch) / float(2 ** (8 * width - 1))
    n_loop = int(round(loop_seconds * sr))
    out = data[:n_loop].copy()
    if len(out) < n_loop:
        out = np.vstack([out, np.zeros((n_loop - len(out), ch))])
    tail = data[n_loop:]
    out[: len(tail)] += tail[:n_loop]
    lufs = measure_loudness(out, sr)["integrated_lufs"]
    out *= 10 ** ((target_lufs - lufs) / 20)
    out = limit(out, sr, 10 ** (ceiling_dbfs / 20))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
    return {"seconds": n_loop / sr, "tail_folded_seconds": round(len(tail) / sr, 3),
            "lufs": round(measure_loudness(out, sr)["integrated_lufs"], 1),
            "peak_dbfs": round(20 * np.log10(np.abs(out).max()), 2)}
