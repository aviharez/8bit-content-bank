"""How far away is the lightning? Soundtrack, composed with Audio as Code from public/lightning/timeline.json.

Hard techno, 128.57 BPM (14 frames a beat), C# Phrygian dominant, 20 bars (37.3 s). Its own flavour (CLAUDE.md,
Music direction; the last 3 videos were 150 BPM, E Phrygian, swoop kick, clipped-sine lead): a rumble kick
(kick_909 driven hard + an off-beat bass tail), a sync_lead hook, hoover flash chords, metal hats, a snare roll.
Every sound is something on screen (plan: docs/plans/lightning.md):
- kick: the thunder ring passing a tower (its lamp flashes white), or reaching the ridge, or a bolt hitting (tl kicks)
- bass: the rumble band clearing the tower half a second later (tl swings), on the chord root
- BOOM: the thunder reaching the listener (they flinch): a clap driven into noise + a short fm_bass stab
- hook (sync_lead): the leader stepping down from the cloud (falling chord tones, the jag's side picks the step),
  then the return strokes flickering up the bolt (rising); bars 4-15 the side branches add a harmony a tone below
- flash chord (hoover, no detune, one bus per voice): the land lit white on each strike
- ring (fm_bass growl, root + fifth): the thunder ring travelling, struck each second, louder as it comes closer
- hats: drips landing in the puddle on the deck; snare roll: strikes a second apart (bars 10-11)

Run from the repo root:  uv run --locked python music/lightning/compose.py
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
PUBLIC = ROOT / "public" / "lightning"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS = tl["bpm"], tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
ROOT_PC = {"C#": 1, "D": 2, "F#m": 6, "Bm": 11}


def chord_at(beat: float) -> str:
    return CHORD_OF_BAR[int(beat // 4) % BARS]


def bar_end(beat: float) -> float:
    return (int(beat // 4) + 1) * 4


def place(pc: int, floor: int) -> int:
    """Lowest MIDI note with pitch class pc at or above floor."""
    return floor + (pc - floor) % 12


def ladder(chord: str, lo: int = 61, hi: int = 88) -> list[int]:
    """Every chord tone between lo and hi, low to high."""
    return [p for p in range(lo, hi + 1) if p % 12 in CHORDS[chord]]


def note(beat, length, pitch, vel):
    """A note clipped at the next chord change (bar line), so nothing rings into the next chord."""
    beat = beat % BEATS
    length = min(length, bar_end(beat) - beat)
    return Note(pitch=int(pitch), start=round(float(beat), 6), duration=round(float(max(0.05, length)), 6),
                velocity=float(min(1.0, max(0.05, vel))))


# ---------------------------------------------------------------- the hook: leader down, strokes up
lead, harmony, flash = [], [], [[], [], []]
hook_of_bar = [""] * BARS
for s in tl["strikes"]:
    gap, n = s["gap"], len(s["leader"])
    # register: far strikes start high and fall a long way; in the drop the tree sits a step lower than the pole
    top = {8: 9, 4: 8, 2: 7, 1: 6, 0: 6 if s["target"]["kind"] == "tower" else 4}[gap]
    idx = top
    landing = None
    for k, step in enumerate(s["leader"]):
        lad = ladder(chord_at(step["beat"]))
        idx = max(0, min(len(lad) - 1, idx - (1 if step["side"] > 0 else 2) if k else idx))
        length = 0.45 if gap == 8 else 0.22
        p = lad[idx]
        lead.append(note(step["beat"], length, p, 0.75 + 0.2 * k / max(1, n - 1)))
        if 16 <= step["beat"] < 64 and idx >= 1:
            harmony.append(note(step["beat"], length, lad[idx - 1], 0.6))
        landing = idx
    for k, st in enumerate(s["strokes"]):
        lad = ladder(chord_at(st["beat"]))
        p = lad[max(0, min(len(lad) - 1, landing + k))]
        length = 0.45 if s["strokes"][-1]["beat"] - s["beat"] >= 1.5 else 0.22
        lead.append(note(st["beat"], length, p, 1.0 if k == 0 else 0.85))
        if 16 <= st["beat"] < 64:
            harmony.append(note(st["beat"], length, ladder(chord_at(st["beat"]))[max(0, landing + k - 1)], 0.6))
    # the flash: the chord in a middle register, held while the bolt flickers
    hold = s["strokes"][-1]["beat"] - s["beat"] + 0.25
    tri = sorted(place(pc, 54) for pc in CHORDS[chord_at(s["beat"])])
    for v, p in enumerate(tri):
        flash[v].append(note(s["beat"], hold, p, 0.9 if gap > 0 else 0.8))
    b = int(s["beat"] // 4)
    hook_of_bar[b] = {8: "A", 4: "A'", 2: "B", 1: "B'", 0: "C"}[gap] if b < 16 else "A''"

# ---------------------------------------------------------------- drums, bass, the BOOM
kick = [note(k["beat"], 0.9, 36, 1.0 if k["kind"] != "pass" else 0.88) for k in tl["kicks"]]
bass = []
for sw in tl["swings"]:
    b = sw["beat"] % BEATS
    r = place(ROOT_PC[chord_at(b)], 28)
    bass.append(note(b, 0.42, r, 0.95))
booms = []
boom_bass = []
for x in tl["booms"]:
    drop = 48 <= x["beat"] < 64
    booms.append(note(x["beat"], 0.5, 39, 0.55 if drop else 1.0))
    boom_bass.append(note(x["beat"], 0.3 if drop else 0.45, place(ROOT_PC[chord_at(x["beat"])], 40), 0.7 if drop else 0.95))
# the thunder ring on its way: a growl on the chord's root and fifth, struck each second, louder as it comes closer
ring = []
for s in tl["strikes"]:
    for j in range(s["gap"]):
        b = s["beat"] + j
        ch = chord_at(b)
        r = place(ROOT_PC[ch], 49)
        fifth = r + 7
        v = 0.45 + 0.5 * (j + 1) / s["gap"]
        ring += [note(b, 0.95, r, v), note(b, 0.95, fifth, v * 0.8)]
hats = [note(d, 0.12, 42, 0.8 if (d % 1) > 0.5 else 0.6) for d in tl["drips"]]
roll = [note(b, 0.2, 38, 0.35 + 0.6 * k / len(tl["roll"])) for k, b in enumerate(tl["roll"])]

buses = {
    "kick": Track(name="Kick", instrument="kick_909", gain=1.0, notes=tuple(kick),
                  tone=Tone(brightness=0.9, decay_seconds=0.28, tuning_semitones=4.6),  # body on C#2 (69 Hz), the key's root
                  effects=(Filter(mode="highpass", cutoff_hz=48, resonance=0.1), Distortion(drive=9.0, mix=1.0),
                           Filter(mode="highpass", cutoff_hz=45, resonance=0.1), Filter(mode="lowpass", cutoff_hz=4000, resonance=0.1))),
    "bass": Track(name="Rumble bass", instrument="sub_bass", gain=1.0, tone=Tone(brightness=1.0), notes=tuple(bass),
                  release_seconds=0.03, effects=(Distortion(drive=8, mix=1.0), Filter(mode="highpass", cutoff_hz=40, resonance=0.1), Filter(mode="lowpass", cutoff_hz=420, resonance=0.2))),  # passes h3, h5; cuts h7 (a flat 7th)
    "boom": Track(name="Boom", instrument="clap", gain=1.0, tone=Tone(brightness=0.4, decay_seconds=0.4), notes=tuple(booms),
                  effects=(Distortion(drive=6.0, mix=1.0), Filter(mode="lowpass", cutoff_hz=2500, resonance=0.1))),
    "boom_bass": Track(name="Boom stab", instrument="fm_bass", gain=0.9, tone=Tone(brightness=0.6, fm_index=1.5), notes=tuple(boom_bass),
                       release_seconds=0.04, effects=(Filter(mode="lowpass", cutoff_hz=1800, resonance=0.2),)),
    "ring": Track(name="Thunder ring", instrument="fm_bass", gain=1.0, notes=tuple(ring), release_seconds=0.05,
                  tone=Tone(brightness=0.55, fm_index=1.5), effects=(Filter(mode="highpass", cutoff_hz=120, resonance=0.1),
                                                     Filter(mode="lowpass", cutoff_hz=1400, resonance=0.2))),
    "lead": Track(name="Leader + strokes", instrument="sync_lead", gain=1.0, tone=Tone(brightness=0.65, cutoff_hz=4200),
                  notes=tuple(lead), release_seconds=0.03),
    "harmony": Track(name="Branches", instrument="sync_lead", gain=1.0, tone=Tone(brightness=0.45, cutoff_hz=2600),
                     notes=tuple(harmony), release_seconds=0.03),
    **{f"flash {v}": Track(name=f"Flash {v}", instrument="hoover", gain=1.0, notes=tuple(flash[v]), release_seconds=0.04,
                           tone=Tone(brightness=0.6, cutoff_hz=3500, detune_cents=0.0)) for v in range(3)},
    "hats": Track(name="Drips", instrument="metal_hat", gain=1.0, tone=Tone(brightness=0.7, decay_seconds=0.1), notes=tuple(hats)),
    "roll": Track(name="Roll", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.7), notes=tuple(roll)),
}

# Levels by stem RMS (dB relative to the kick): kick the loudest stem, bass 3 dB under it, the hook about 4 dB under
# it (memory: kick-loudest-stem; CLAUDE.md: kick and bass forward).
TARGET_DB = {"kick": 0.0, "bass": -3.0, "lead": -4.0, "flash": -5.0, "harmony": -7.0, "boom": -8.0, "boom_bass": -7.0,
             "hats": -15.0, "roll": -12.0, "ring": -6.0}


def group(name: str) -> str:
    return name.split(" ")[0]


def rms_db(x: np.ndarray) -> float:
    """RMS over the parts where the stem is playing (50 ms windows above -50 dB of its peak)."""
    m = np.abs(x).max(1)
    w = int(0.05 * SR)
    n = len(m) // w
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
    _, stems = render_buses(buses, BPM, BEATS, seed=11, sample_rate=SR)
    n = max(len(v) for v in stems.values())
    stems = {k: np.pad(v, ((0, n - len(v)), (0, 0))) for k, v in stems.items()}
    stems["flash"] = sum(stems.pop(f"flash {v}") for v in range(3))
    level = {k: rms_db(v) for k, v in stems.items()}
    for k in stems:
        stems[k] *= 10 ** ((TARGET_DB[k] - (level[k] - level["kick"])) / 20)
    mix = sum(stems.values())
    scale = 0.5 / np.abs(mix).max()
    mix *= scale
    wav = PUBLIC / "track.wav"
    write_wav(wav, mix)
    loop = finish_loop(wav, BEATS * SPB)
    # open the track tl["openLeadFrames"] before beat 0, like the picture: the loop point is a rotation, so roll it
    shift = round(tl["openLeadFrames"] / tl["fps"] * SR)
    write_wav(wav, np.roll(read_wav(wav), shift, axis=0))
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
        sel = lambda ns: tuple((round(x.start - b0 * 4, 3), x.pitch) for x in ns if b0 * 4 <= x.start < b0 * 4 + 16)  # noqa: E731
        return sel(lead), sel(bass)
    same = [b for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"loop": loop, "plan": plan, "stem_rms_db_vs_kick": final, "identical_neighbour_blocks": same,
              "notes": {k: len(t.notes) for k, t in buses.items()}}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:6s} bars {p['bars']:5s} {' '.join(p['chords']):20s} hook {' '.join(p['hook']):24s} balance {p['balance_20_60_150_1k_5k']}  | {p['what']}")
    print("stem RMS vs kick (dB):", final)
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("loop:", loop)


if __name__ == "__main__":
    main()
