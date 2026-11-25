"""Should you switch doors? Soundtrack, composed with Audio as Code from public/monty-hall/timeline.json.

Hard techno, 138.46 BPM (13 frames a beat), D Phrygian, 22 bars (38.1 s). Its own flavour (CLAUDE.md, Music direction;
the last 3 were 150 BPM E Phrygian swoop/clipped sine, 128.57 BPM C# Phrygian dominant rumble/sync_lead, 163.64 BPM
G Aeolian punchy kick/trance_pluck): kick_909 driven hard, an acid_bass lead whose filter opens as the games pile up,
supersaw reveal stabs, an off-beat fm_bass. Every sound is something on screen (plan: docs/plans/monty-hall.md):
- kick: every beat a step you can see: a game's pick, the host opening a door, the stay/switch, the reveal (bars
  0-11), a round's pick on the wall (12-18), the winners flashing (19), a row folding away (20), a door closing (21)
- off-beat bass (fm_bass, root): the stage lights flashing on the off-beat 8ths; dark in bar 20
- hook (acid_bass): the marquee light chase over the doors; the lit bulb is the note's step on the chord ladder
  (tl hook), the reveal's note is the result (high = win). One bus per section, the filter a little more open each
  time: the more games played, the brighter the acid
- goat note (fm_bass, the chord's 5th): the host swinging a goat door open
- reveal: a car is a supersaw chord stab (one bus per voice) + clap; a goat is the stab's low root alone. On the
  wall the stab is louder the more stages win that round
- hats (metal_hat on D): a switcher hopping to the other door; snare roll: the wall's stages appearing (bars 10-11)

Run from the repo root:  uv run --locked python music/monty-hall/compose.py
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
PUBLIC = ROOT / "public" / "monty-hall"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS = tl["bpm"], tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
ROOT_PC = {"Dm": 2, "Eb": 3, "Bb": 10, "Cm": 0, "Gm": 7}
FIFTH_PC = {k: (v + 7) % 12 for k, v in ROOT_PC.items()}


def chord_at(beat: float) -> str:
    return CHORD_OF_BAR[int(beat // 4) % BARS]


def bar_end(beat: float) -> float:
    return (int(beat // 4) + 1) * 4


def place(pc: int, floor: int) -> int:
    """Lowest MIDI note with pitch class pc at or above floor."""
    return floor + (pc - floor) % 12


def ladder(chord: str, lo: int = 62, hi: int = 96) -> list[int]:
    """Every chord tone from D4 up, low to high: bulb k of the marquee is ladder[k]."""
    return [p for p in range(lo, hi + 1) if p % 12 in CHORDS[chord]]


def note(beat, length, pitch, vel, **kw):
    """A note clipped at the next chord change (bar line), so nothing rings into the next chord."""
    beat = beat % BEATS
    length = min(length, bar_end(beat) - beat)
    return Note(pitch=int(pitch), start=round(float(beat), 6), duration=round(float(max(0.05, length)), 6),
                velocity=float(min(1.0, max(0.05, vel))), **kw)


def section_of(beat: float) -> str:
    bar = int(beat // 4)
    return next(s["id"] for s in tl["sections"] if s["fromBar"] <= bar < s["toBar"])


# ---------------------------------------------------------------- the hook: one bus per section, the acid opening up
HOOK_CUTOFF = {"intro": 700.0, "rule": 950.0, "build": 1300.0, "drop1": 1900.0, "drop2": 2600.0, "turn": 800.0}
HOOK_NAME = {"intro": "A/B", "rule": "A'/B'", "build": "B''", "drop1": "C", "drop2": "C'", "turn": "A''"}
hook = {k: [] for k in HOOK_CUTOFF}
for h in tl["hook"]:
    b = h["beat"]
    lad = ladder(chord_at(b))
    accent = abs(b - round(b)) < 1e-6  # the notes on the beat (the steps you see) are accented
    kw = {"articulation": "accented"} if accent else {}
    hook[section_of(b)].append(note(b, 0.2, lad[h["deg"]], 0.95 if accent else 0.8, **kw))
hook_of_bar = [HOOK_NAME[section_of(b * 4)] for b in range(BARS)]

# ---------------------------------------------------------------- reveal stab + clap, goat note
stab = [[], [], []]
clap = []
for r in tl["reveals"]:
    b = r["beat"]
    tri = sorted(place(pc, 50) for pc in CHORDS[chord_at(b)])
    if r["single"] and not r["win"]:
        stab[0].append(note(b, 0.35, tri[0] if tri[0] % 12 == ROOT_PC[chord_at(b)] else place(ROOT_PC[chord_at(b)], 50), 0.6))
        continue
    share = r["wins"] / r["games"]
    vel = 1.0 if r["single"] else 0.55 + 0.9 * share  # a round where more stages win hits harder
    for v, p in enumerate(tri):
        stab[v].append(note(b, 0.75 if r["single"] else 0.24, p, vel))
    clap.append(note(b, 0.3, 39, 0.95))
for fl in tl["flashes"]:  # bar 19: the winners of one side flash on the beat
    b = fl["beat"]
    tri = sorted(place(pc, 50) for pc in CHORDS[chord_at(b)])
    for v, p in enumerate(tri):
        stab[v].append(note(b, 0.5, p, 0.6 + 0.4 * len(fl["stages"]) / 18))
goat = [note(b, 0.3, place(FIFTH_PC[chord_at(b)], 53), 0.85) for b in tl["opens"]]

# ---------------------------------------------------------------- drums and bass
kick = [note(k["beat"], 0.5, 36, 1.0 if k["kind"] in ("step", "round") else 0.92) for k in tl["kicks"]]
bass = [note(b, 0.32, place(ROOT_PC[chord_at(b)], 38), 0.95) for b in tl["lights"]]
hats = [note(b, 0.08, 42, 0.75) for b in tl["hops"]]
roll = [note(b, 0.15, 38, 0.35 + 0.6 * k / len(tl["roll"])) for k, b in enumerate(tl["roll"])]

acid = dict(brightness=0.85, resonance=0.65, filter_env_octaves=2.2, filter_decay_seconds=0.14)
buses = {
    # the 909's body sits near 52.7 Hz untuned; +5.7 semitones puts it on D2 (73.4 Hz), the key's root. Driven hard.
    "kick": Track(name="Kick", instrument="kick_909", gain=1.0, notes=tuple(kick),
                  tone=Tone(brightness=0.9, decay_seconds=0.2, tuning_semitones=5.7),
                  effects=(Distortion(drive=8.0, mix=1.0), Filter(mode="highpass", cutoff_hz=40, resonance=0.1),
                           Filter(mode="lowpass", cutoff_hz=4500, resonance=0.1))),
    "bass": Track(name="Stage-light bass", instrument="fm_bass", gain=1.0, notes=tuple(bass), release_seconds=0.03,
                  tone=Tone(brightness=0.7, fm_index=1.8),  # low-passed at 300 Hz: its 5th harmonic (a major 3rd up) clashes with minor chords
                  effects=(Distortion(drive=4, mix=1.0), Filter(mode="highpass", cutoff_hz=40, resonance=0.1),
                           Filter(mode="lowpass", cutoff_hz=300, resonance=0.1))),
    **{f"hook {sec}": Track(name=f"Marquee {sec}", instrument="acid_bass", gain=1.0, notes=tuple(ns), release_seconds=0.03,
                            tone=Tone(cutoff_hz=HOOK_CUTOFF[sec], **acid),
                            effects=(Distortion(drive=2.5, mix=1.0), Filter(mode="highpass", cutoff_hz=220, resonance=0.1)))
       for sec, ns in hook.items() if ns},
    "goat": Track(name="Goat door", instrument="fm_bass", gain=1.0, notes=tuple(goat), release_seconds=0.03,
                  tone=Tone(brightness=0.5, fm_index=1.6, fm_ratio=1.0),
                  effects=(Distortion(drive=3, mix=1.0), Filter(mode="highpass", cutoff_hz=90, resonance=0.1),
                           Filter(mode="lowpass", cutoff_hz=1000, resonance=0.2))),
    **{f"stab {v}": Track(name=f"Reveal stab {v}", instrument="supersaw", gain=0.8, notes=tuple(stab[v]), release_seconds=0.05,
                          tone=Tone(brightness=0.8, cutoff_hz=3200.0, detune_cents=12),
                          effects=(Distortion(drive=3.0, mix=1.0), Filter(mode="highpass", cutoff_hz=140, resonance=0.1)))
       for v in range(3)},
    "clap": Track(name="Car clap", instrument="clap", gain=1.0, tone=Tone(brightness=0.6), notes=tuple(clap)),
    # the hats' metal ring already sits on D (measured: 4.8 kHz peak, D7), the root
    "hats": Track(name="Switch hop", instrument="metal_hat", gain=1.0, notes=tuple(hats),
                  tone=Tone(brightness=0.7, decay_seconds=0.1, tuning_semitones=0.0)),
    "roll": Track(name="Wall builds", instrument="electronic_snare", gain=1.0, notes=tuple(roll),
                  tone=Tone(brightness=0.7, tuning_semitones=-4.0)),
}

# Levels by stem RMS (dB relative to the kick, where each plays): kick the loudest, bass forward, the hook ~4 dB under
# the kick (memory: kick-loudest-stem; CLAUDE.md: kick and bass forward)
TARGET_DB = {"kick": 0.0, "bass": -2.0, "hook": -4.0, "goat": -6.0, "stab": -5.0, "clap": -8.0, "hats": -10.0, "roll": -11.0}


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
    every_hook = [n for ns in hook.values() for n in ns]
    for n in every_hook + goat + [x for v in stab for x in v] + bass:
        if n.pitch % 12 not in CHORDS[chord_at(n.start)]:
            raise SystemExit(f"note {n.pitch} at beat {n.start} not in {chord_at(n.start)}")
    _, raw = render_buses(buses, BPM, BEATS, seed=27, sample_rate=SR)
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
        return sel(every_hook), sel(bass)
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
