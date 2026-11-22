"""How a key opens a lock: soundtrack, composed with Audio as Code from public/key-lock/timeline.json.

Hard techno, 150 BPM, E Phrygian, 24 bars (38.4 s), the house sound (CLAUDE.md, Music direction): the swoop kick and
the fixed patches in music/_shared/target_sound.py, each clipped instrument rendered as its own bus.
Every sound is something on screen (plan: docs/plans/key-lock.md):
- all five pins dropping into the key's cuts together (a key step) is the kick; so are the turns, the pick's pushes
  on the beat, and the plug and tools in bar 12 (tl["kicks"], each one checked against a visible event in the sim)
- pin 1's height at every key step is the lead hook: its level picks a chord tone stacked up from the root, so the
  key's shape is the melody (in = the cuts tip to bow, out = the same notes backwards)
- in the build, each push of the pick lifts the pin one step: the lead climbs with it
- a pin whose split sits on the shear line (it glows green) plays its stab note, one bus per pin; a pin the pick has
  set holds its note while it stays caught
- the key itself, step by step, is the bass: the chord root, an octave up while the key moves out; in the build the
  tension wrench holds the root and re-strikes it on every set
- the springs squashing at every key step (and at every push of the pick) are the mid-saw octave dyad, louder the
  more they are squashed
- the shear line's glow is a held mid-saw chord (third and fifth), louder with more pins on the line
- a blocked turn is the CLUNK: root + octave on the stab, choked after one 16th; a turn that opens is the chord stab,
  held while the plug stays turned

Run from the repo root:  uv run --locked python music/key-lock/compose.py
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
PUBLIC = ROOT / "public" / "key-lock"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS = tl["bpm"], tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
LANDINGS = tl["landings"]
TURNS = tl["turns"]
PUSHES = tl["pushes"]
SETS = tl["sets"]

# Bus levels in dB after each bus's distortion. Kick and bass sit +3 dB over the band-balance fit (CLAUDE.md).
BOOST_DB = {"kick": 3.0, "bass": 3.0}
FADER_DB = {
    "kick": -15.5, "bass": -18.0, "lead": -14.0, "pin": -21.0, "line": -11.0, "springs": -10.0, "clunk": -15.0, "chord": -20.0,
}


def chord_at(beat: float) -> dict:
    return CHORDS[CHORD_OF_BAR[int(beat // 4) % BARS]]


def place(pc: int, low: int) -> int:
    """The pitch with pitch class pc at or above `low`."""
    return low + (pc - low) % 12


def stacked(chord: dict, low: int, k: int) -> int:
    """The k-th tone of the chord stacked up from its root (root at or above `low`)."""
    r = place(chord["root"], low)
    tones = sorted(place(t, r) for t in chord["tones"])
    return tones[k % 3] + 12 * (k // 3)


def lead_note(chord: dict, level: int) -> int:
    """Pin height level (0 = at rest, 1 = deepest cut .. 7 = blade top) -> a chord tone, higher pin = higher note."""
    return stacked(chord, 57, level - 1) if level >= 1 else place(chord["root"], 57) - 12


# ---------------------------------------------------------------- notes from the picture
lead, bass, line, clunk, springs = [], [], [], [], []
pins = [[] for _ in range(5)]
chord_v = ([], [], [])

events = sorted([(l["beat"], "land", l) for l in LANDINGS] + [(p["beat"], "push", p) for p in PUSHES])
beats = [e[0] for e in events]


def gap_after(b: float) -> float:
    nxt = [x for x in beats if x > b + 1e-9]
    return (nxt[0] - b) if nxt else 0.5


turn_beats = [t["beat"] for t in TURNS]

for b, kind, e in events:
    ch = chord_at(b)
    g = min(gap_after(b), 0.5)
    if kind == "land":
        lv = e["pin1"]
        lead.append((b, g * 0.9, lead_note(ch, lv), 0.95 if lv >= 1 else 0.75))
        # the springs squash as the pins rise: the mid dyad, louder the higher the pins sit on average
        lift = sum(p["level"] for p in e["pins"]) / (5 * 7)
        r = place(ch["root"], 50)
        springs += [(b, g * 0.85, r, 0.6 + 0.4 * lift), (b, g * 0.85, r + 12, 0.55 + 0.4 * lift)]
        on = [p for p in e["pins"] if p["lined"]]
        for p in on:  # a pin on the line flashes green: its stab note
            pins[p["i"]].append((b, max(0.2, g * 0.85), stacked(ch, 69, p["i"]), 0.9))
        if on:  # the line glows: a held mid chord, louder with more pins on it
            v = 0.45 + 0.1 * len(on)
            line += [(b, g * 0.95, stacked(ch, 52, 1), v), (b, g * 0.95, stacked(ch, 52, 2), v * 0.9)]
    else:  # the pick pushes a pin up one step, squashing its spring
        lead.append((b, g * 0.9, lead_note(ch, e["level"]), 0.95))
        r = place(ch["root"], 50)
        springs += [(b, g * 0.85, r, 0.8), (b, g * 0.85, r + 12, 0.75)]

# bass: one note per key step on the root; octave up while the key travels out (it is out between its turn and the
# next time it enters). The sim's key segments are not in the timeline, so the direction is read from D in frames.
FR = tl["frames"]
FPB = tl["framesPerBeat"]
for l in LANDINGS:
    b = l["beat"]
    f = l["frame"]
    d_prev = FR[(f - 1) % len(FR)]["D"]
    d_now = FR[f]["D"]
    out = d_prev is not None and d_now is not None and d_now > d_prev + 1e-9
    r = place(chord_at(b)["root"], 28)
    bass.append((b, min(gap_after(b), 0.5) * 0.95, r + (12 if out else 0), 0.9))

# the build: the tension wrench holds the root, re-struck on every set and every bar
build0, build1 = 8 * 4, 12 * 4
strikes = sorted(set([float(s["beat"]) for s in SETS] + [float(x) for x in range(build0, build1, 4)]))
for k, b in enumerate(strikes):
    end = strikes[k + 1] if k + 1 < len(strikes) else build1
    bass.append((b, (end - b) * 0.97, place(chord_at(b)["root"], 28), 0.85))
# a pin the pick has set holds its stab note while it is caught (until the plug returns, beat 49)
for s in SETS:
    b = s["beat"]
    for bar_b in [b] + [x for x in range(build0, 49, 4) if x > b]:
        end = min(49, (int(bar_b // 4) + 1) * 4)
        pins[s["pin"]].append((bar_b, end - bar_b - 0.02, stacked(chord_at(bar_b), 69, s["pin"]), 0.85))
for bar in range(8, 12):
    n = sum(1 for s in SETS if s["beat"] < (bar + 1) * 4)
    if n:
        b0 = max(bar * 4, min(s["beat"] for s in SETS))
        ch = chord_at(bar * 4)
        v = 0.45 + 0.1 * n
        ln = (bar + 1) * 4 - b0 - 0.02
        line += [(b0, ln, stacked(ch, 52, 1), v), (b0, ln, stacked(ch, 52, 2), v * 0.9)]

# turns: CLUNK (blocked) or the chord stab held while the plug is turned
for t in TURNS:
    b = t["beat"]
    ch = chord_at(b)
    if not t["ok"]:
        r = place(ch["root"], 64)
        clunk += [(b, 0.25, r, 1.0), (b, 0.25, r + 12, 0.9)]
    else:
        hold = 1.0 if t["key"] in ("pick",) else (0.75 if abs((b % 4) - 2.0) < 1e-6 else 1.0)
        for v, p in enumerate(sorted(place(x, 74) for x in ch["tones"])):
            chord_v[v].append((b, hold - 0.03, p, 1.0))
        bass.append((b, hold * 0.95, place(ch["root"], 28), 1.0))
# bar 12 after the picked turn: the plug returns (49), the tools come out (50)
for b in (49.0, 50.0):
    bass.append((b, 0.9, place(chord_at(b)["root"], 28) + (12 if b == 50 else 0), 0.9))
    lead.append((b, 0.45, lead_note(chord_at(b), 0), 0.8))

kick_steps = [int(round(k * 4)) for k in tl["kicks"]]
buses = {
    "kick": swoop_track(swoop_hits(kick_steps, end_step=BEATS * 4), gain=0.5),
    "bass": bass_track(notes_of(sorted(bass))),
    "lead": lead_track(notes_of(lead)),
    "line": mid_track(notes_of(line), name="Shear line"),
    "springs": mid_track(notes_of(springs), name="Springs"),
    "clunk": stab_track(notes_of(clunk), name="Clunk"),
    **{f"pin {i}": stab_track(notes_of(pins[i]), name=f"Pin {i + 1}") for i in range(5)},
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
    faders = {name: FADER_DB.get(name.split(" ")[0], 0.0) + BOOST_DB.get(name.split(" ")[0], 0.0) for name in buses}
    _, stems = render_buses(buses, BPM, BEATS, faders_db=faders, seed=29, sample_rate=SR)
    n = max(len(v) for v in stems.values())
    stems = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in stems.items()}
    stems["pins"] = sum(stems.pop(f"pin {i}") for i in range(5))
    stems["chord"] = sum(stems.pop(f"chord {v}") for v in range(3))
    mix = sum(stems.values())
    mix *= 0.5 / np.abs(mix).max()
    wav = PUBLIC / "track.wav"
    write_wav(wav, mix)
    loop = finish_loop(wav, BEATS * SPB)
    for name, x in stems.items():
        write_wav(OUT / "stems" / f"{name}.wav", x * 0.5 / np.abs(mix).max())

    plan = []
    for s in tl["sections"]:
        plan.append({"section": s["id"], "bars": f"{s['fromBar']}-{s['toBar'] - 1}", "what": s["what"],
                     "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]],
                     "balance_20_60_150_1k_5k": band_balance(mix, s["fromBar"], s["toBar"]).tolist()})

    def block(b0):
        sel = lambda ev: tuple((round(b - b0 * 4, 3), p) for b, _, p, _ in ev if b0 * 4 <= b < b0 * 4 + 16)  # noqa: E731
        return sel(lead), sel(sorted(bass))
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    OUT.mkdir(parents=True, exist_ok=True)
    counts = dict(springs=len(springs), lead=len(lead), bass=len(bass), line=len(line), clunk=len(clunk), pins=sum(map(len, pins)),
                  chord=sum(map(len, chord_v)), kicks=len(kick_steps))
    report = {"loop": loop, "plan": plan, "identical_neighbour_blocks": same, "notes": counts}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {' '.join(p['chords']):22s} balance {p['balance_20_60_150_1k_5k']}  | {p['what']}")
    print("identical neighbouring 4-bar blocks:", same or "none", "| notes:", counts)
    print("loop:", loop)


if __name__ == "__main__":
    main()
