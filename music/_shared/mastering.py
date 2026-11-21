"""Mastering helpers shared by every soundtrack in the bank.

- to_scientific_pitch: retune a render so every C is an exact power of two in hertz (C4 = 256 Hz)
- finish_loop: fold the tail past the loop point onto the start, master to a phone-speaker loudness, limit peaks
"""

import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

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


# Reels and TikTok play loud, mastered audio. At -14 LUFS (the YouTube standard) our videos sounded quiet next to the
# rest of the feed on a phone at 40% volume. And a phone speaker plays almost nothing below ~200 Hz, so equal LUFS is
# not equal loudness on a phone: a sub-heavy track sounds quieter. So we master to a loudness measured above 200 Hz
# (PHONE_LUFS), with a soft clip ahead of the limiter. That lands the whole track around -10 LUFS.
PHONE_LUFS = -15.5
PHONE_HZ = 200
SOFT_CLIP = 0.8


def phone_loudness(x: np.ndarray, sr: int) -> float:
    """Integrated loudness of what a phone speaker plays (everything above PHONE_HZ)."""
    sos = butter(4, PHONE_HZ, "highpass", fs=sr, output="sos")
    return measure_loudness(sosfilt(sos, x, axis=0), sr)["integrated_lufs"]


def finish_loop(path: Path, loop_seconds: float, target_phone_lufs: float = PHONE_LUFS, ceiling_dbfs: float = -1.5) -> dict:
    """Fold the tail past the loop point onto the start, set the phone loudness (soft clip + limiter), limit peaks."""
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
    folded = out
    pre = path.parents[2] / "out" / "premaster" / f"{path.parent.name}.npy"  # for trying masters without re-rendering
    pre.parent.mkdir(parents=True, exist_ok=True)
    np.save(pre, folded.astype(np.float32))
    gain_db = target_phone_lufs - phone_loudness(folded, sr)
    for _ in range(6):  # clip and limiter take some loudness back: raise the gain until the result hits the target
        driven = folded * 10 ** (gain_db / 20)
        out = limit(SOFT_CLIP * np.tanh(driven / SOFT_CLIP), sr, 10 ** (ceiling_dbfs / 20))
        miss = target_phone_lufs - phone_loudness(out, sr)
        if abs(miss) < 0.15:
            break
        gain_db += miss
    with wave.open(str(path), "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
    return {"seconds": n_loop / sr, "tail_folded_seconds": round(len(tail) / sr, 3),
            "lufs": round(measure_loudness(out, sr)["integrated_lufs"], 1),
            "phone_lufs": round(phone_loudness(out, sr), 1),
            "peak_dbfs": round(20 * np.log10(np.abs(out).max()), 2),
            "gain_reduction": limiter_stats(driven, out)}


def limiter_stats(before: np.ndarray, after: np.ndarray) -> dict:
    """How hard the limiter worked: share of time (20 ms windows) with more than 1, 3 and 6 dB of gain reduction."""
    a, b = np.abs(before).max(axis=1), np.abs(after).max(axis=1)
    w = 882
    n = len(a) // w
    pa, pb = a[: n * w].reshape(n, w).max(1), b[: n * w].reshape(n, w).max(1)
    gr = 20 * np.log10((pa + 1e-9) / (pb + 1e-9))
    gr = gr[pa > 1e-3]
    return {f"over_{k}db_pct": round(float((gr > k).mean() * 100), 1) for k in (1, 3, 6)} | {"max_db": round(float(gr.max()), 1)}
