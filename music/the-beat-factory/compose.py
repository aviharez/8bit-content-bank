"""The Beat Factory: soundtrack, composed with Audio as Code from public/the-beat-factory/timeline.json.

Hard techno, industrial flavour: 150 BPM (12 frames a beat), F Aeolian, 24 bars (38.4 s). Its own sound against the
last three (Lightning 128.57 C# Phrygian dominant rumble/sync_lead; Birthday 163.64 G Aeolian punchy kick/trance_pluck;
Monty Hall 138.46 D Phrygian kick_909/acid lead): the swoop kick re-tuned to every chord root, a rolling 16th acid
bass whose filter opens as the reactor fills, a clipped-sine call (left arm) and answer (right arm), supersaw chord
stabs + clap on 2 and 4, metal hats, a held high whine. Plan: docs/plans/the-beat-factory.md.

Every note comes from a timeline event, and every event is a machine you can see:
- kick (swoop, tuned to the bar's root): the hydraulic press slamming onto a crate; none in bar 16 (ram held up)
- bass (acid_bass, chord root/octave/5th): the indexing belt jerking the line forward on the 3 16ths after each slam
- lead L / lead R (target_sound clipped sine, own buses): the robot arms jabbing a lamp; lamp height = chord tone
- hats (metal_hat): the laser cutter's pulses
- stab (supersaw triad, one bus per voice) + clap: the sorter gate snapping
- whine (target_sound stab patch, held): the reactor core's glow; one bus per section, louder as the glow rises
- roll (electronic_snare): the reactor's charge ring lighting lamp by lamp (bars 15-16)

Run from the repo root:  uv run --locked python music/the-beat-factory/compose.py
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
from swoop import swoop_track  # noqa: E402
from target_sound import lead_track, mid_track, render_buses, stab_track  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "the-beat-factory"
SR = 48000
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS, FPS, FPB = tl["bpm"], tl["bars"], tl["fps"], tl["framesPerBeat"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
EV = tl["events"]


def chord_at(beat: float) -> str:
    return CHORD_OF_BAR[int(beat // 4) % BARS]


def bar_end(beat: float) -> float:
    return (int(beat // 4) + 1) * 4


def place(pc: int, floor: int) -> int:
    return floor + (pc - floor) % 12


def note(beat, length, pitch, vel, clip=True):
    """A note clipped at the next chord change (bar line), so nothing rings into the next chord."""
    if clip:
        length = min(length, bar_end(beat) - beat - 0.01)
    return Note(pitch=int(pitch), start=round(float(beat), 6), duration=round(float(max(0.05, length)), 6),
                velocity=float(min(1.0, max(0.05, vel))))


def of(inst: str):
    return [e for e in EV if e["instrument"] == inst]


# ---------------------------------------------------------------- the parts, straight from the events
# kick: one swoop track per root (its pitch is per track); each hit holds to the next beat (the swoop's long body)
kick_by_root: dict[int, list] = {}
for e in of("kick"):
    kick_by_root.setdefault(e["pitch"], []).append((e["beat"], e["velocity"], 0.98))
# bass: acid, one bus per section, the filter opening as the reactor fills
BASS_CUTOFF = {"start": 520.0, "sorter": 700.0, "cutter": 950.0, "build": 1300.0, "drop": 2400.0, "cooldown": 620.0}
bass = {k: [] for k in BASS_CUTOFF}
for e in of("bass"):
    bass[e["section"]].append(note(e["beat"], e["durationBeats"], e["pitch"], e["velocity"]))
lead = {"L": [], "R": []}
for e in of("lead"):
    lead[e["side"]].append(note(e["beat"], e["durationBeats"], e["pitch"], e["velocity"]))
# sorter snap: the bar's triad from F3 up, one bus per voice (no intermodulation inside a clipped bus), + clap
stab = [[], [], []]
clap = []
for e in of("stab"):
    tri = sorted(place(pc, 53) for pc in CHORDS[chord_at(e["beat"])])
    for v, p in enumerate(tri):
        stab[v].append(note(e["beat"], e["durationBeats"], p, e["velocity"]))
    clap.append(note(e["beat"], 0.3, 39, 0.95))
# reactor whine: held, re-struck at each bar line; one bus per section so its level follows the glow
WHINE_DB = {"start": -5.0, "sorter": -3.5, "cutter": -2.5, "build": 0.0, "drop": 1.0, "cooldown": -4.5}
whine = {k: [] for k in WHINE_DB}
for e in of("whine"):
    whine[e["section"]].append(note(e["beat"], e["durationBeats"], e["pitch"], e["velocity"]))
hats = [note(e["beat"], 0.08, 42, e["velocity"], clip=False) for e in of("hats")]
roll = [note(e["beat"], 0.15, 38, e["velocity"], clip=False) for e in of("roll")]

acid = dict(brightness=0.8, resonance=0.55, filter_env_octaves=2.0, filter_decay_seconds=0.12)
buses: dict[str, Track] = {
    **{f"kick {NAMES[p % 12]}{p // 12 - 1}": swoop_track(h, name=f"Press {NAMES[p % 12]}{p // 12 - 1}", pitch=p)
       for p, h in sorted(kick_by_root.items())},
    **{f"bass {sec}": Track(name=f"Belt {sec}", instrument="acid_bass", gain=1.0, notes=tuple(ns), release_seconds=0.02,
                            tone=Tone(cutoff_hz=BASS_CUTOFF[sec], **acid),
                            effects=(Distortion(drive=3.0, mix=1.0), Filter(mode="highpass", cutoff_hz=30, resonance=0.1)))
       for sec, ns in bass.items() if ns},
    "lead L": lead_track(lead["L"], name="Left arm"),
    "lead R": lead_track(lead["R"], name="Right arm"),
    **{f"stab {v}": mid_track(stab[v], name=f"Sorter stab {v}") for v in range(3)},
    "clap": Track(name="Sorter clap", instrument="clap", gain=1.0, tone=Tone(brightness=0.6), notes=tuple(clap)),
    **{f"whine {sec}": stab_track(ns, name=f"Reactor {sec}") for sec, ns in whine.items() if ns},
    # +3 semitones puts the metal ring near F (it sits on D untuned, measured for Monty Hall)
    "hats": Track(name="Laser cutter", instrument="metal_hat", gain=1.0, notes=tuple(hats),
                  tone=Tone(brightness=0.7, decay_seconds=0.1, tuning_semitones=3.0)),
    "roll": Track(name="Charge ring", instrument="electronic_snare", gain=1.0, notes=tuple(roll),
                  tone=Tone(brightness=0.7, tuning_semitones=-2.0)),
}
BUS_DB = {f"whine {k}": v for k, v in WHINE_DB.items()}

# Levels by stem RMS (dB vs the kick, where each plays). Kick loudest, bass forward (+3 dB over the lead-led fit, the
# owner's preference), the hook ~4 dB under the kick and over the mids. The laser (hats), gate (clap) and charge ring
# (roll) are visible machines, so they must be heard on a phone: at -9/-11/-10 they sat 13-19 dB under the lead in the
# 200 Hz-5 kHz band; raised so they sit within ~10 dB of it there.
TARGET_DB = {"kick": 0.0, "bass": -2.0, "lead": -3.5, "stab": -6.0, "clap": -3.5, "whine": -8.0, "hats": -5.0, "roll": -4.5}


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
    pitched = [n for ns in bass.values() for n in ns] + lead["L"] + lead["R"] + [x for v in stab for x in v] + \
        [n for ns in whine.values() for n in ns]
    for n in pitched:
        if n.pitch % 12 not in CHORDS[chord_at(n.start)]:
            raise SystemExit(f"note {n.pitch} at beat {n.start} not in {chord_at(n.start)}")
        if n.start + n.duration > bar_end(n.start) + 1e-6:
            raise SystemExit(f"note {n.pitch} at beat {n.start} rings into the next chord")
    for p in kick_by_root:
        if p % 12 not in {v[0] for v in CHORDS.values()}:  # every chord is listed root first
            raise SystemExit(f"kick pitch {p} is not a chord root")
    _, raw = render_buses(buses, BPM, BEATS, faders_db=BUS_DB, seed=1, sample_rate=SR)
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
        plan.append({"section": s["id"], "bars": f"{s['fromBar'] + 1}-{s['toBar']}", "what": s["what"],
                     "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]], "hook": tl["hookOfBar"][s["fromBar"]:s["toBar"]],
                     "bass_cutoff_hz": BASS_CUTOFF[s["id"]],
                     "balance_20_60_150_1k_5k": band_balance(track, s["fromBar"], s["toBar"])})

    every_hook = lead["L"] + lead["R"]
    every_bass = [x for ns in bass.values() for x in ns]

    def block(b0):
        sel = lambda ns: tuple(sorted((round(x.start - b0 * 4, 3), x.pitch) for x in ns if b0 * 4 <= x.start < b0 * 4 + 16))  # noqa: E731
        return sel(every_hook), sel(every_bass)
    same = [f"bars {b + 1}-{b + 4} = {b + 5}-{b + 8}" for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    # sync manifest: every note's start against its event's frame (the audio is placed in beats, the picture in frames)
    max_frame_diff = max(abs(e["beat"] * SPB * FPS - e["frame"]) for e in EV)
    mapping = {inst: len(of(inst)) for inst in sorted({e["instrument"] for e in EV})}
    notes = {k: len(t.notes) for k, t in buses.items()}
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"bpm": BPM, "bars": BARS, "seconds": BEATS * SPB, "loop": loop, "plan": plan,
              "stem_rms_db_vs_kick": final, "identical_neighbour_blocks": same,
              "sync": {"events": len(EV), "events_by_instrument": mapping, "max_note_vs_frame_diff_frames": max_frame_diff},
              "notes_per_bus": notes}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:8s} bars {p['bars']:5s} {' '.join(p['chords']):16s} hook {' '.join(p['hook']):28s} balance {p['balance_20_60_150_1k_5k']}")
    print("stem RMS vs kick (dB):", final)
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("sync: max note-vs-frame diff (frames):", max_frame_diff, "events:", mapping)
    print("loop:", loop)


if __name__ == "__main__":
    main()
