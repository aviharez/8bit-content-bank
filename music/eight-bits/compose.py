"""8 bits count to 255: soundtrack, composed with Audio as Code from public/eight-bits/timeline.json.

Hard techno, 150 BPM, E Phrygian, 22 bars (35.2 s), the house sound (CLAUDE.md, Music direction): the swoop kick and
the fixed patches in music/_shared/target_sound.py, each clipped instrument rendered as its own bus.
Every sound is a light on screen (plan: docs/plans/eight-bits.md):
- a light switching on plays its note: light k = the k-th tone of the current chord stacked up from the root
  (lights 1-8 on the lead, 16-128 on the stab); in counting order that is the ruler sequence, R 3 R 5 R 3 R 8 ...
- the light that flips once per beat (1, then 2, then 4) is the kick
- every count (the number changes) is a bass note: the chord root, an octave up while light 2 is lit
- light 2 switching on is the mid saws pulse (an octave dyad of the root)
- three or more lights going off at once (a big carry) is a chord stab, one bus per voice
- light 64 lit holds a mid saws chord; light 128 lit holds the stab whine on E5
- the chord is lights 16, 32, 64 read as a number (timeline.json)

Run from the repo root:  uv run --locked python music/eight-bits/compose.py
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
PUBLIC = ROOT / "public" / "eight-bits"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS = tl["bpm"], tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
COUNTS = tl["counts"]

# Bus levels in dB after each bus's distortion, set against the replica's fitted levels and checked with the
# band balance printed below (target: the sample's main section, ~3 / 29 / 48 / 21 % in 20-60 / 60-150 / 150-1k /
# 1-5k Hz).
FADER_DB = {
    "kick": -15.5, "bass": -18.0, "lead": -12.0, "stab": -17.0, "pulse": -12.0,
    "chord": -25.5, "pad": -17.0, "whine": -27.0,
}


def place(pc: int, low: int) -> int:
    """The pitch with pitch class pc at or above `low`."""
    return low + (pc - low) % 12


def light_note(chord: dict, k: int) -> int:
    """Light k (0 = the "1" light) -> the k-th tone of the chord stacked up from its root, root in A3-G#4."""
    r = place(chord["root"], 57)
    tones = sorted(place(t, r) for t in chord["tones"])
    return tones[k % 3] + 12 * (k // 3)


# ---------------------------------------------------------------- notes from the counter
lead, stab, bass, pulse, chord_v, pad, whine = [], [], [], [], ([], [], []), [], []
for c in COUNTS:
    ch = CHORDS[c["chord"]]
    b, step = c["beat"], c["step"]
    k = c["on"]
    if k is not None:  # a light switches on: its note
        p = light_note(ch, k)
        if k < 4:
            lead.append((b, step * 0.9 if step < 1 else 0.6, p, 0.95 if k else 0.8))
        else:
            stab.append((b, max(0.45, step * 0.9), p, 1.0))
    # every count: a bass note on the root, an octave up while light 2 is lit
    r = place(ch["root"], 28)
    bass.append((b, step * 0.95 if step < 1 else 0.7, r + (12 if c["n"] & 2 else 0), 0.9))
    if k == 1:  # light 2 switches on: the mid pulse
        d = min(step * 1.5, 0.75)
        pulse += [(b, d, place(ch["root"], 40), 0.8), (b, d, place(ch["root"], 40) + 12, 0.7)]
    if len(c["off"]) >= 3:  # a big carry: the chord stab, one voice per bus
        for v, t in enumerate(sorted(place(t, 74) for t in ch["tones"])):
            chord_v[v].append((b, 0.45, t, 1.0 if len(c["off"]) >= 6 else 0.85))

# held layers follow a lit light: light 64 (value 64) -> mid saws chord, light 128 -> the whine on E5
for bar in range(BARS):
    c = next(x for x in COUNTS if x["beat"] >= bar * 4)
    ch = CHORDS[c["chord"]]
    if c["n"] & 64:
        pad += [(bar * 4, 3.95, place(t, 48), 0.8) for t in ch["tones"]]
    if c["n"] & 128:
        whine.append((bar * 4, 3.98, 76, 0.9))

kick_steps = [int(round(k * 4)) for k in tl["kicks"]]
buses = {
    "kick": swoop_track(swoop_hits(kick_steps, end_step=BEATS * 4), gain=0.5),
    "bass": bass_track(notes_of(bass)),
    "lead": lead_track(notes_of(lead)),
    "stab": stab_track(notes_of(stab)),
    "pulse": mid_track(notes_of(pulse), name="Pulse"),
    "pad": mid_track(notes_of(pad), name="Light 64 chord"),
    "whine": stab_track(notes_of(whine), name="Light 128 whine"),
    **{f"chord {v}": stab_track(notes_of(chord_v[v]), name=f"Chord {v}") for v in range(3)},
}


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes(y.tobytes())


def band_balance(x: np.ndarray, b0: int, b1: int) -> np.ndarray:
    seg = x[int(b0 * 4 * SPB * SR): int(b1 * 4 * SPB * SR)].mean(1)
    s = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    e = np.array([s[(f >= lo) & (f < hi)].sum() for lo, hi in ((20, 60), (60, 150), (150, 1000), (1000, 5000))])
    return np.round(100 * e / e.sum()).astype(int)


def main() -> None:
    faders = {name: FADER_DB.get(name.split(" ")[0], 0.0) for name in buses}
    _, stems = render_buses(buses, BPM, BEATS, faders_db=faders, seed=255, sample_rate=SR)
    n = max(len(v) for v in stems.values())
    stems = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in stems.items()}
    stems["chord"] = sum(stems.pop(f"chord {v}") for v in range(3))
    mix = sum(stems.values())
    mix *= 0.5 / np.abs(mix).max()
    wav = PUBLIC / "track.wav"
    write_wav(wav, mix)
    loop = finish_loop(wav, BEATS * SPB)
    for name, x in stems.items():
        write_wav(OUT / "stems" / f"{name}.wav", x * 0.5 / np.abs(mix).max())

    # the section plan, to read against the picture's event list
    plan = []
    for s in tl["sections"]:
        bars = range(s["fromBar"], s["toBar"])
        names = [CHORDS[next(x for x in COUNTS if x["beat"] >= b * 4)["chord"]]["name"] for b in bars]
        plan.append({"section": s["id"], "bars": f"{s['fromBar']}-{s['toBar'] - 1}", "speed": s["speed"], "chords": names,
                     "balance_20_60_150_1k_5k": band_balance(mix, s["fromBar"], s["toBar"]).tolist()})
    # neighbouring 4-bar blocks of hook + bass must not be identical (CLAUDE.md, arrangement)
    def block(b0):
        sel = lambda ev: tuple((round(b - b0 * 4, 3), p) for b, _, p, _ in ev if b0 * 4 <= b < b0 * 4 + 16)  # noqa: E731
        return sel(lead) + sel(stab), sel(bass)
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"loop": loop, "plan": plan, "identical_neighbour_blocks": same,
              "notes": {k: len(v) for k, v in dict(lead=lead, stab=stab, bass=bass, pulse=pulse, pad=pad, whine=whine).items()}}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {p['speed']:9s} {' '.join(p['chords']):28s} balance {p['balance_20_60_150_1k_5k']}")
    print("identical neighbouring 4-bar blocks:", same or "none", "| notes:", report["notes"])
    print("loop:", loop)


if __name__ == "__main__":
    main()
