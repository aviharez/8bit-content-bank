"""Loop check for a finished video: does the end flow into the start, in sound and picture?

Usage (repo root):  uv run --locked python scripts/check_loop.py <slug>

Audio (public/<slug>/track.wav):
  - seam jump: the sample step across the loop point vs the typical step (no click)
  - level: RMS of the last 2 s vs the first 2 s
Video (renders/<slug>.mp4):
  - seam diff: mean pixel change from the last frame to the first, vs the median change
    between consecutive frames (a cut shows up as a large ratio)
"""

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def audio_check(path: Path) -> dict:
    with wave.open(str(path)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, ch) / 32768
    steps = np.abs(np.diff(a, axis=0)).max(axis=1)
    seam = np.abs(a[0] - a[-1]).max()
    typical = np.percentile(steps, 99)
    n = int(2.0 * sr)  # one bar at 120 BPM: same rhythmic content on both sides
    rms = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)  # noqa: E731
    level = rms(a[:n]) - rms(a[-n:])
    return {"seam_jump_vs_p99_step": round(seam / typical, 2), "level_start_minus_end_db": round(level, 1),
            "ok": seam <= typical * 1.5 and abs(level) <= 6}


def frames(path: Path, at: list[str]) -> list[np.ndarray]:
    out = []
    for t in at:
        raw = subprocess.run(["ffmpeg", "-v", "error", *t.split(), "-i", str(path), "-frames:v", "1", "-vf", "scale=180:320",
                              "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
        out.append(np.frombuffer(raw, dtype=np.uint8).astype(np.float64))
    return out


def video_check(path: Path) -> dict:
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                               capture_output=True, text=True, check=True).stdout)
    fps = 30
    last = f"-sseof -{1.5 / fps:.4f}"
    first, end = frames(path, ["-ss 0", last])
    seam = np.abs(first - end).mean()
    samples = []
    for t in np.linspace(1, dur - 1, 12):
        a, b = frames(path, [f"-ss {t:.3f}", f"-ss {t + 1 / fps:.3f}"])
        samples.append(np.abs(a - b).mean())
    typical = float(np.median(samples))
    return {"seam_diff": round(seam, 2), "typical_frame_diff": round(typical, 2),
            "ratio": round(seam / max(typical, 1e-6), 2), "ok": seam <= max(3 * typical, 2.0)}


def main() -> None:
    slug = sys.argv[1]
    a = audio_check(ROOT / "public" / slug / "track.wav")
    v = video_check(ROOT / "renders" / f"{slug}.mp4")
    print(f"audio  {a}")
    print(f"video  {v}")
    ok = a["ok"] and v["ok"]
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
