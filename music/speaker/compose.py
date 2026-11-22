"""How a speaker makes sound: soundtrack, composed with Audio as Code from public/speaker/timeline.json.

Hard techno, 150 BPM, E Phrygian, 24 bars (38.4 s), the house sound (CLAUDE.md, Music direction): the swoop kick and
the fixed patches in music/_shared/target_sound.py, each clipped instrument rendered as its own bus.
The picture follows this track from the phone to the ear (plan: docs/plans/speaker.md), and every sound is something
you see happen:
- the kick is the cable's surge, the coil's jump and a wide white wave in the air (tl["kicks"])
- the bass is the coil's glow and a blue wave (tl["bass"])
- the mid-saw octave dyad on the 8ths (tl["mids"]) is an orange wave
- the hook is the small cone: a glow and tight yellow rings per note (tl["lead"])
- the drop's chord stabs are white flashes and rings, one bus per voice (tl["stabs"])

After mastering, the track is split by the speaker's crossover and each cone's motion is written per video frame to
public/speaker/cone.json (swing range, pushes a second, and the scope trace), so the cones on screen move with
exactly the sound you hear.

Run from the repo root:  uv run --locked python music/speaker/compose.py
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from mastering import finish_loop  # noqa: E402
from swoop import swoop_hits, swoop_track  # noqa: E402
from target_sound import bass_track, lead_track, mid_track, notes_of, render_buses, stab_track  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "speaker"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS, FPS = tl["bpm"], tl["bars"], tl["fps"]
BEATS = BARS * 4
SPB = 60 / BPM
FRAMES = tl["totalFrames"]
CHORD_OF_BAR = tl["chordOfBar"]

# Bus levels in dB after each bus's distortion. Kick and bass sit +3 dB over the band-balance fit (CLAUDE.md).
BOOST_DB = {"kick": 3.0, "bass": 3.0}
FADER_DB = {"kick": -15.5, "bass": -16.7, "lead": -14.0, "sand": -11.5, "stab": -20.0}

CROSSOVER_HZ = 700  # the speaker's crossover: below to the big cone, above to the small one


def ev(notes):
    return [(n["beat"], n["len"] * 0.95, n["pitch"], n["vel"]) for n in notes]


kick_steps = [int(round(k["beat"] * 4)) for k in tl["kicks"]]
buses = {
    "kick": swoop_track(swoop_hits(kick_steps, end_step=BEATS * 4 + kick_steps[0]), gain=0.5),
    "bass": bass_track(notes_of(ev(tl["bass"]))),
    "lead": lead_track(notes_of(ev(tl["lead"]))),
    "sand": mid_track(notes_of(ev(tl["mids"])), name="Sand"),
    **{f"stab {v}": stab_track(notes_of(ev(tl["stabs"][v])), name=f"Stab {v}") for v in range(3)},
}


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes(y.tobytes())


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        raw = w.readframes(w.getnframes())
        ch = w.getnchannels()
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64).reshape(-1, ch) / 32768


def band_balance(x: np.ndarray, b0: int, b1: int) -> np.ndarray:
    seg = x[int(b0 * 4 * SPB * SR): int(b1 * 4 * SPB * SR)].mean(1)
    s = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    e = np.array([s[(f >= lo) & (f < hi)].sum() for lo, hi in ((20, 60), (60, 150), (150, 1000), (1000, 5000))])
    return np.round(100 * e / e.sum()).astype(int)


# ---------------------------------------------------------------- the cones, from the finished track
SCOPE_POINTS = 240
SCOPE_LEVELS = 57  # chars 35..91


def crossover(x: np.ndarray):
    """Linkwitz-Riley 4th order: two 2nd-order Butterworths in series, low and high at the same cutoff.
    The track loops, so it is filtered three times round and the middle copy kept (no start-up transient at the seam)."""
    lo = butter(2, CROSSOVER_HZ, "lowpass", fs=SR, output="sos")
    hi = butter(2, CROSSOVER_HZ, "highpass", fs=SR, output="sos")
    n = len(x)
    x3 = np.concatenate([x, x, x])
    low = sosfilt(lo, sosfilt(lo, x3))[n:2 * n]
    high = sosfilt(hi, sosfilt(hi, x3))[n:2 * n]
    return low, high


def peak_hz(sig: np.ndarray, centre: int, lo: float, hi: float, n: int = 8192) -> int:
    i0 = centre - n // 2
    idx = np.arange(i0, i0 + n) % len(sig)
    seg = sig[idx] * np.hanning(n)
    s = np.abs(np.fft.rfft(seg))
    f = np.fft.rfftfreq(n, 1 / SR)
    m = (f >= lo) & (f <= hi)
    if s[m].max() < 1e-4:
        return 0
    k = np.argmax(np.where(m, s, 0))
    # parabolic interpolation for a finer peak
    a, b, c = s[k - 1], s[k], s[k + 1]
    d = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
    return int(round((k + d) * SR / n))


def cone_motion(track: np.ndarray) -> dict:
    mono = track.mean(1)
    low, high = crossover(mono)
    spf = SR // FPS  # 1600 samples a frame
    # the big cone: scaled so the kick's steady swing (bars 0-3, the kick alone rings the cone at E2) is 1.9 mm,
    # the swing that throws the sand at 1 m/s (2 pi 82.4 Hz x 1.9 mm = 0.98 m/s)
    per_frame = np.array([np.abs(low[f * spf:(f + 1) * spf]).max() for f in range(FRAMES)])
    mm_per_unit = 1.9 / np.median(per_frame[: 4 * 48])
    w_mm = low * mm_per_unit
    # the small cone: its real swing is tiny (a few hundredths of a mm); shown relative to its loudest notes
    t_rel = high / np.percentile(np.abs(high), 99.5)
    w_scope_scale = 1 / 2.5  # +-2.5 mm fills the scope lane
    frames = []
    for f in range(FRAMES):
        a, b = f * spf, (f + 1) * spf
        wseg, tseg = w_mm[a:b], t_rel[a:b]
        pick = np.linspace(a, b - 1, SCOPE_POINTS).astype(int)

        def enc(v):
            q = np.clip(np.round((np.clip(v, -1, 1) + 1) / 2 * (SCOPE_LEVELS - 1)), 0, SCOPE_LEVELS - 1).astype(int)
            return "".join(chr(35 + int(x)) for x in q)

        c = (a + b) // 2
        frames.append({
            "w": [round(float(wseg.min()), 2), round(float(wseg.max()), 2)],
            "t": [round(float(tseg.min()), 2), round(float(tseg.max()), 2)],
            "wHz": peak_hz(low, c, 30, 600), "tHz": peak_hz(high, c, CROSSOVER_HZ, 6000),
            "ws": enc(w_mm[pick] * w_scope_scale), "ts": enc(t_rel[pick]),
        })
    return {"crossoverHz": CROSSOVER_HZ, "mmPerUnit": float(mm_per_unit), "scopePoints": SCOPE_POINTS,
            "scopeLevels": SCOPE_LEVELS, "scopeMm": 2.5, "frames": frames}


def main() -> None:
    faders = {name: FADER_DB.get(name.split(" ")[0], 0.0) + BOOST_DB.get(name.split(" ")[0], 0.0) for name in buses}
    _, stems = render_buses(buses, BPM, BEATS, faders_db=faders, seed=14, sample_rate=SR)
    n = max(len(v) for v in stems.values())
    stems = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in stems.items()}
    stems["stab"] = sum(stems.pop(f"stab {v}") for v in range(3))
    mix = sum(stems.values())
    mix *= 0.5 / np.abs(mix).max()
    wav = PUBLIC / "track.wav"
    write_wav(wav, mix)
    loop = finish_loop(wav, BEATS * SPB)
    for name, x in stems.items():
        write_wav(OUT / "stems" / f"{name}.wav", x * 0.5 / np.abs(mix).max())

    track = read_wav(wav)
    cone = cone_motion(track)
    (PUBLIC / "cone.json").write_text(json.dumps(cone, separators=(",", ":")))

    plan = []
    for s in tl["sections"]:
        plan.append({"section": s["id"], "bars": f"{s['fromBar']}-{s['toBar'] - 1}", "what": s["what"],
                     "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]], "hook": sorted(set(tl["hook"][s["fromBar"]:s["toBar"]])),
                     "balance_20_60_150_1k_5k": band_balance(track, s["fromBar"], s["toBar"]).tolist()})

    def block(b0):
        sel = lambda notes: tuple((round(x["beat"] - b0 * 4, 3), x["pitch"]) for x in notes if b0 * 4 <= x["beat"] < b0 * 4 + 16)  # noqa: E731
        return sel(tl["lead"]), sel(tl["bass"])
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    fr = cone["frames"]
    swing = {s["id"]: round(float(np.median([fr[f]["w"][1] - fr[f]["w"][0] for f in range(s["fromBar"] * 48, s["toBar"] * 48)])), 2) for s in tl["sections"]}
    hz = {s["id"]: (int(np.median([fr[f]["wHz"] for f in range(s["fromBar"] * 48, s["toBar"] * 48)])),
                    int(np.median([fr[f]["tHz"] for f in range(s["fromBar"] * 48, s["toBar"] * 48)]))) for s in tl["sections"]}
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"loop": loop, "plan": plan, "identical_neighbour_blocks": same, "big_cone_swing_mm": swing,
              "pushes_a_second_big_small": hz, "mm_per_unit": cone["mmPerUnit"]}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {' '.join(p['chords']):16s} hook {', '.join(p['hook']):22s} balance {p['balance_20_60_150_1k_5k']}  | {p['what']}")
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("big cone swing (mm, median per frame):", swing)
    print("pushes a second (big, small):", hz)
    print("loop:", loop)


if __name__ == "__main__":
    main()
