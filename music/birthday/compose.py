"""How many people till two share a birthday? Soundtrack, composed with Audio as Code from public/birthday/timeline.json.

Hard techno, 163.64 BPM (11 frames a beat), G Aeolian, 24 bars (35.2 s). Its own flavour (CLAUDE.md, Music direction;
the last 3 were 150 BPM E Phrygian swoop/clipped sine twice, and 128.57 BPM C# Phrygian dominant rumble/sync_lead): a
short punchy kick_909 with its own sub, a bouncy off-beat fm_bass, a trance_pluck hook, sync_lead chord stabs.
Every sound is something on screen (plan: docs/plans/birthday.md):
- kick + sub: every beat something lands: a month panel group, the door opening, a guest's day tile, the door as
  guests leave (tl kicks); beat 80 is the break
- off-beat bass (fm_bass, root, bouncing an octave): the party lights over the wall blinking on the off-beat 8ths
- hook (trance_pluck): the pair lines flashing from the new tile to the lit ones (tl lines), the month panels lighting
  at the start and going dark at the end, the tiles going dark as guests leave. A (call) for odd guests, B (answer) for
  even, B' a register up in the build, C in the first drop, C' an octave up in the second, A'' falling in the turn.
  The more guests in the room, the more 16ths of the phrase have a line, so the hook fills in as the pairs pile up
- match (two tiles on one day): a sync_lead chord stab (one bus per voice) + a clap
- hats: guests' footsteps from the door to their place; snare roll: the chance meter filling in the build (bars 10-11)

Run from the repo root:  uv run --locked python music/birthday/compose.py
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import Distortion, Filter, Note, Tone, Track  # noqa: E402
from mastering import finish_loop  # noqa: E402
from target_sound import render_buses  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "birthday"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS = tl["bpm"], tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
ROOT_PC = {"Gm": 7, "Eb": 3, "Bb": 10, "F": 5, "Cm": 0, "D": 2}
GUESTS = {g["n"]: g for g in tl["guests"]}


def chord_at(beat: float) -> str:
    return CHORD_OF_BAR[int(beat // 4) % BARS]


def bar_end(beat: float) -> float:
    return (int(beat // 4) + 1) * 4


def place(pc: int, floor: int) -> int:
    """Lowest MIDI note with pitch class pc at or above floor."""
    return floor + (pc - floor) % 12


def ladder(chord: str, lo: int = 62, hi: int = 100) -> list[int]:
    """Every chord tone between lo and hi, low to high."""
    return [p for p in range(lo, hi + 1) if p % 12 in CHORDS[chord]]


def note(beat, length, pitch, vel):
    """A note clipped at the next chord change (bar line), so nothing rings into the next chord."""
    beat = beat % BEATS
    length = min(length, bar_end(beat) - beat)
    return Note(pitch=int(pitch), start=round(float(beat), 6), duration=round(float(max(0.05, length)), 6),
                velocity=float(min(1.0, max(0.05, vel))))


# ---------------------------------------------------------------- the hook
# degrees on the chord-tone ladder (from D4) per 16th slot after a tile
A = {1: 2, 2: 4, 3: 3, 4: 2, 5: 4, 6: 5, 7: 4}  # call: up and back
B = {1: 4, 2: 3, 3: 2, 4: 1, 5: 2, 6: 0, 7: 1}  # answer: down to the root
C = [{1: 5, 2: 4, 3: 6}, {1: 4, 2: 3, 3: 2}]  # the first drop, one guest a beat, alternating
C2 = [6, 5, 4, 5]  # the second drop, one line after each of two guests a beat, an octave up


def hook_name(beat: float) -> str:
    bar = int(beat // 4)
    return "A/B" if bar < 8 else "B'" if bar < 12 else "C" if bar < 16 else "C'" if bar < 20 else "A''"


hook = []
for ln in tl["lines"]:
    b, g, s = ln["beat"], GUESTS[ln["guest"]], ln["slot"]
    lad = ladder(chord_at(b))
    many = len(ln["to"])
    vel = min(1.0, 0.7 + 0.04 * many)  # a slot holding more lines is a little louder
    if g["n"] <= 23:
        deg = (A if g["n"] % 2 else B)[s] + (3 if b >= 32 else 0)
        hook.append(note(b, 0.22, lad[deg], vel))
    elif g["n"] <= 38:
        deg = C[g["n"] % 2][s]
        hook.append(note(b, 0.22, lad[deg], vel))
    else:
        deg = C2[(g["n"] - 39) % 4] + 3
        hook.append(note(b, 0.22, lad[deg], vel))
# the month panels lighting up (bar 0) and going dark (bar 23): an arc up, a fall down
ARC = [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5]
for m, b in enumerate(tl["panelsOn"]):
    hook.append(note(b, 0.22, ladder(chord_at(b))[ARC[m]], 0.8))
for m, b in enumerate(tl["panelsOff"]):
    hook.append(note(b, 0.22, ladder(chord_at(b))[max(0, (m % 6))], 0.7))
# guests leaving (bars 20-22): each tile going dark, falling through the chord in runs of 6
leaves = sorted({g["leave"] for g in tl["guests"]})
for k, b in enumerate(leaves):
    hook.append(note(b, 0.2, ladder(chord_at(b))[6 - (k % 6)], 0.72))
hook_of_bar = [hook_name(b * 4) for b in range(BARS)]

# ---------------------------------------------------------------- the match: a chord stab + clap
stab = [[], [], []]
clap = []
for m in tl["matches"]:
    b = m["beat"]
    first = m["guest"] == tl["matches"][0]["guest"]
    tri = sorted(place(pc, 55) for pc in CHORDS[chord_at(b)])
    for v, p in enumerate(tri):
        stab[v].append(note(b, 1.5 if first else 0.5, p, 1.0 if first else 0.85))
    clap.append(note(b, 0.3, 39, 1.0))

# ---------------------------------------------------------------- drums and bass
kick = [note(k["beat"], 0.5, 36, 1.0 if k["kind"] == "tile" else 0.9) for k in tl["kicks"]]
sub = [note(k["beat"], 0.4, place(ROOT_PC[chord_at(k["beat"])], 36), 1.0) for k in tl["kicks"]]
bass = []
for k, b in enumerate(tl["blinks"]):
    r = place(ROOT_PC[chord_at(b)], 40)
    bass.append(note(b, 0.3, r + (12 if int(b) % 2 else 0), 0.95))  # the bounce: root, octave, root, octave
hats = [note(b, 0.08, 42, 0.7) for b in tl["footsteps"]]
roll = [note(b, 0.15, 38, 0.35 + 0.6 * k / len(tl["roll"])) for k, b in enumerate(tl["roll"])]

buses = {
    "kick": Track(name="Kick", instrument="kick_909", gain=1.0, notes=tuple(kick),
                  tone=Tone(brightness=0.95, decay_seconds=0.12, tuning_semitones=10.8),  # a short punch on G2 (98 Hz)
                  effects=(Distortion(drive=4.0, mix=1.0), Filter(mode="highpass", cutoff_hz=60, resonance=0.1),
                           Filter(mode="lowpass", cutoff_hz=5000, resonance=0.1))),
    "sub": Track(name="Sub", instrument="sub_bass", gain=1.0, tone=Tone(brightness=0.6), notes=tuple(sub),
                 release_seconds=0.03, effects=(Distortion(drive=3, mix=1.0), Filter(mode="lowpass", cutoff_hz=180, resonance=0.1))),
    "bass": Track(name="Party-light bass", instrument="fm_bass", gain=1.0, notes=tuple(bass), release_seconds=0.03,
                  tone=Tone(brightness=0.7, fm_index=2.0),
                  effects=(Distortion(drive=4, mix=1.0), Filter(mode="highpass", cutoff_hz=45, resonance=0.1),
                           Filter(mode="lowpass", cutoff_hz=1400, resonance=0.25))),
    "hook": Track(name="Pair lines", instrument="trance_pluck", gain=1.0, notes=tuple(hook), release_seconds=0.03,
                  tone=Tone(brightness=0.8, cutoff_hz=4500.0, resonance=0.4),
                  effects=(Distortion(drive=2.0, mix=1.0), Filter(mode="highpass", cutoff_hz=200, resonance=0.1))),
    **{f"stab {v}": Track(name=f"Match stab {v}", instrument="sync_lead", gain=0.8, notes=tuple(stab[v]), release_seconds=0.05,
                          tone=Tone(brightness=0.7, cutoff_hz=3800.0),
                          effects=(Distortion(drive=4.0, mix=1.0), Filter(mode="highpass", cutoff_hz=150, resonance=0.1)))
       for v in range(3)},
    "clap": Track(name="Match clap", instrument="clap", gain=1.0, tone=Tone(brightness=0.6), notes=tuple(clap)),
    # the hats' metal ring sits on F# untuned; up a semitone it sits on G, the root
    "hats": Track(name="Footsteps", instrument="metal_hat", gain=1.0, notes=tuple(hats),
                  tone=Tone(brightness=0.7, decay_seconds=0.1, tuning_semitones=1.0)),
    "roll": Track(name="Meter roll", instrument="electronic_snare", gain=1.0, notes=tuple(roll),
                  tone=Tone(brightness=0.7, tuning_semitones=1.0)),
}

# Levels by stem RMS (dB relative to the kick, where each plays): kick the loudest, sub and bass forward, the hook 4 dB
# under the kick (memory: kick-loudest-stem; CLAUDE.md: kick and bass forward)
TARGET_DB = {"kick": 0.0, "sub": -4.0, "bass": -1.5, "hook": -4.5, "stab": -4.5, "clap": -9.0, "hats": -13.0, "roll": -11.0}


def group(name: str) -> str:
    return name.split(" ")[0]


def rms_db(x: np.ndarray) -> float:
    """RMS over the parts where the stem is playing (50 ms windows above -50 dB of its peak)."""
    w = int(0.05 * SR)
    n = len(x) // w
    win = np.sqrt((x[: n * w] ** 2).mean(1).reshape(n, w).mean(1))
    act = win[win > win.max() * 10 ** (-50 / 20)]
    return 20 * np.log10(np.sqrt((act ** 2).mean()) + 1e-12)


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


def band_balance(x: np.ndarray, b0: int, b1: int) -> list[int]:
    seg = x[int(b0 * 4 * SPB * SR): int(b1 * 4 * SPB * SR)].mean(1)
    s = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    e = np.array([s[(f >= lo) & (f < hi)].sum() for lo, hi in ((20, 60), (60, 150), (150, 1000), (1000, 5000))])
    return np.round(100 * e / e.sum()).astype(int).tolist()


def main() -> None:
    # every hook note is a tone of its bar's chord
    for n in hook:
        if n.pitch % 12 not in CHORDS[chord_at(n.start)]:
            raise SystemExit(f"hook note {n.pitch} at beat {n.start} not in {chord_at(n.start)}")
    _, raw = render_buses(buses, BPM, BEATS, seed=31, sample_rate=SR)
    n = max(len(v) for v in raw.values())
    raw = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in raw.items()}
    stems: dict[str, np.ndarray] = {}
    for k, v in raw.items():
        stems[group(k)] = stems.get(group(k), 0) + v
    level = {k: rms_db(v) for k, v in stems.items()}
    for k in stems:
        stems[k] *= 10 ** ((TARGET_DB[k] - (level[k] - level["kick"])) / 20)
    mix = sum(stems.values())
    scale = 0.5 / np.abs(mix).max()
    mix *= scale
    wav = PUBLIC / "track.wav"
    write_wav(wav, mix)
    loop = finish_loop(wav, BEATS * SPB)
    for name, x in stems.items():
        write_wav(OUT / "stems" / f"{name}.wav", x * scale)
    final = {k: round(rms_db(v * scale) - rms_db(stems["kick"] * scale), 1) for k, v in stems.items()}

    track = read_wav(wav)
    plan = []
    for s in tl["sections"]:
        plan.append({"section": s["id"], "bars": f"{s['fromBar']}-{s['toBar'] - 1}", "what": s["what"],
                     "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]], "hook": hook_of_bar[s["fromBar"]:s["toBar"]],
                     "balance_20_60_150_1k_5k": band_balance(track, s["fromBar"], s["toBar"])})

    def block(b0):
        sel = lambda ns: tuple(sorted((round(x.start - b0 * 4, 3), x.pitch) for x in ns if b0 * 4 <= x.start < b0 * 4 + 16))  # noqa: E731
        return sel(hook), sel(bass)
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"loop": loop, "plan": plan, "stem_rms_db_vs_kick": final, "identical_neighbour_blocks": same,
              "notes": {k: len(t.notes) for k, t in buses.items()}}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {' '.join(p['chords']):14s} hook {' '.join(p['hook']):26s} balance {p['balance_20_60_150_1k_5k']}")
    print("stem RMS vs kick (dB):", final)
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("loop:", loop)


if __name__ == "__main__":
    main()
