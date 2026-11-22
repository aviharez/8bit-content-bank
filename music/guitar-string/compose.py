"""Why does a guitar string sing? Soundtrack, composed with Audio as Code from public/guitar-string/timeline.json.

Hard techno, 150 BPM, E Phrygian, 24 bars (38.4 s), the house sound (CLAUDE.md, Music direction): the swoop kick and
the fixed patches in music/_shared/target_sound.py, each clipped instrument rendered as its own bus.
Every sound is one string on screen, at that string's real pitch (plan: docs/plans/guitar-string.md):
- the kick is the guitar's open low E string plucked (the swoop settles on E2, 82.4 Hz: that string's note)
- the bass is the bass guitar, each note on the string and fret that makes it (tl["bass"])
- the mid-saw octave dyad (tl["mids"]) is strings 5 and 4 fretted an octave apart
- the hook (tl["lead"]) is the high strings at their frets; in the build, string 1's harmonics (n x 329.6 Hz)
- the drop's chord stabs (tl["stabs"]) are strings 1-3 strummed together, one bus per voice

Run from the repo root:  uv run --locked python music/guitar-string/compose.py
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from mastering import finish_loop  # noqa: E402
from swoop import swoop_hits, swoop_track  # noqa: E402
from target_sound import bass_track, lead_track, mid_track, notes_of, render_buses, stab_track  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "guitar-string"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS, FPS = tl["bpm"], tl["bars"], tl["fps"]
BEATS = BARS * 4
SPB = 60 / BPM
FRAMES = tl["totalFrames"]
CHORD_OF_BAR = tl["chordOfBar"]

# Bus levels in dB after each bus's distortion. Kick and bass sit +3 dB over the band-balance fit (CLAUDE.md).
BOOST_DB = {"kick": 3.0, "bass": 3.0}
FADER_DB = {"kick": -15.5, "bass": -16.7, "lead": -14.0, "mids": -11.5, "stab": -20.0}



def ev(notes):
    return [(n["beat"], n["len"] * 0.95, n["pitch"], n["vel"]) for n in notes]


kick_steps = [int(round(k["beat"] * 4)) for k in tl["kicks"]]
buses = {
    "kick": swoop_track(swoop_hits(kick_steps, end_step=BEATS * 4 + kick_steps[0]), gain=0.5),
    "bass": bass_track(notes_of(ev(tl["bass"]))),
    "lead": lead_track(notes_of(ev(tl["lead"]))),
    "mids": mid_track(notes_of(ev(tl["mids"])), name="Mids"),
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


def main() -> None:
    faders = {name: FADER_DB.get(name.split(" ")[0], 0.0) + BOOST_DB.get(name.split(" ")[0], 0.0) for name in buses}
    _, stems = render_buses(buses, BPM, BEATS, faders_db=faders, seed=7, sample_rate=SR)
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

    plan = []
    for s in tl["sections"]:
        plan.append({"section": s["id"], "bars": f"{s['fromBar']}-{s['toBar'] - 1}", "what": s["what"],
                     "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]], "hook": sorted(set(tl["hook"][s["fromBar"]:s["toBar"]])),
                     "balance_20_60_150_1k_5k": band_balance(track, s["fromBar"], s["toBar"]).tolist()})

    def block(b0):
        sel = lambda notes: tuple((round(x["beat"] - b0 * 4, 3), x["pitch"]) for x in notes if b0 * 4 <= x["beat"] < b0 * 4 + 16)  # noqa: E731
        return sel(tl["lead"]), sel(tl["bass"])
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"loop": loop, "plan": plan, "identical_neighbour_blocks": same}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {' '.join(p['chords']):16s} hook {', '.join(p['hook']):22s} balance {p['balance_20_60_150_1k_5k']}  | {p['what']}")
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("loop:", loop)


if __name__ == "__main__":
    main()
