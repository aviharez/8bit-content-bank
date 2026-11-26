"""Red vs Blue: Beat Race: soundtrack, composed with Audio as Code from public/beat-race/timeline.json.

Hard techno, 128.57 BPM (14 frames a beat), A Phrygian, 24 bars (44.8 s). The sound the owner picked in the sketch
A/B (2026-11-26, version B): the clipped-sine family of the target sound (target_sound.py) for the hook, bass and
chords, with a hard kick_909. Against the last three (Beat Factory 150 F Aeolian swoop/clipped sine/acid 16ths;
Monty Hall 138.46 D Phrygian 909/acid lead/off-beat fm_bass; Birthday 163.64 G Aeolian punchy 909 + sub/trance_pluck/
off-beat fm_bass) it differs on tempo, key, the kick's sound, and the groove: a galloping bass on the second half of
each beat and a call and answer that changes hands with the race lead. Plan: docs/plans/beat-race.md.

Every note comes from a timeline event, and every event is something on screen:
- kick (kick_909, driven): the pacer hammer slamming the spine at the marbles' height; none in bar 16 (held breath)
- bass (target bass, chord root): the chevrons on every ramp stepping (the "and" and the 16th after it)
- red (target lead, clipped sine A3-E5): the red marble touching a pin, its bumper, the finish post, its bucket
- blue (target stab, the same synth an octave up): the blue marble's contacts; the leader plays the call
- mid (octave saw dyads, one bus per voice): the two halves of the board pulsing on the off-beat 8ths
- glow (held saw root in octaves, bars 17-20): the winner's half of the board lit full
- hats (metal_hat): the side chaser bulbs stepping
- stab (saw root in octaves) + clap: a marble landing on a bounce pad (the checkpoints)
- gate (electronic_snare): the gates swinging open (the start gate, then the two race gates), tuned to the chord
- roll (electronic_snare): the finish banner's lamps filling (bars 15-16)
Audio is placed on each event's exact beat, an even 16th grid; the picture draws it on the frame at or just before it.

Run from the repo root:  uv run --locked python music/beat-race/compose.py
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
from target_sound import bass_track, lead_track, mid_track, render_buses, stab_track  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "beat-race"
SR = 48000

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM, BARS, FPS, FPB = tl["bpm"], tl["bars"], tl["fps"], tl["framesPerBeat"]
BEATS = BARS * 4
SPB = 60 / BPM
CHORDS = tl["chords"]
CHORD_OF_BAR = tl["chordOfBar"]
EV = tl["events"]


def chord_end(beat: float) -> float:
    return (int(beat // 8) + 1) * 8.0  # chords last 2 bars


def note(e, length=None, pitch=None, vel=None, clip=True):
    """A note on its event's exact beat (an even 16th grid; the picture draws it on the nearest frame, at most half a
    frame away), clipped at the next chord change so nothing rings into the next chord."""
    start = e["beat"]
    length = e["durationBeats"] if length is None else length
    if clip:
        length = min(length, chord_end(e["beat"]) - start - 0.02)
    return Note(pitch=int(e["pitch"] if pitch is None else pitch), start=round(start, 6),
                duration=round(float(max(0.05, length)), 6), velocity=float(min(1.0, max(0.05, e["velocity"] if vel is None else vel))))


def of(inst: str):
    return [e for e in EV if e["instrument"] == inst]


# ---------------------------------------------------------------- the parts, straight from the events
kick = [note(e, 0.4, pitch=50, clip=False) for e in of("kick")]
bass = [note(e) for e in of("bass")]
red = [note(e) for e in of("red")]
blue = [note(e) for e in of("blue")]
mid_lo = [note(e) for e in of("mid")]
mid_hi = [note(e, pitch=e["pitch"] + 12) for e in of("mid")]
glow_lo = [note(e) for e in of("glow")]
glow_hi = [note(e, pitch=e["pitch"] + 12) for e in of("glow")]
stab_lo = [note(e) for e in of("stab")]
stab_hi = [note(e, pitch=e["pitch"] + 12) for e in of("stab")]
clap = [note(e, 0.3, pitch=39, clip=False) for e in of("clap")]
hats = [note(e, 0.08, pitch=42, clip=False) for e in of("hats")]
roll = [note(e, 0.15, pitch=38, clip=False) for e in of("roll")]
# the gate snare rings on F# untuned (measured on this track's stem): -1.8 semitones centres it on E for Am, +1 on G for Gm
gate_am = [note(e, 0.25, pitch=38, clip=False) for e in of("gate") if CHORD_OF_BAR[int(e["beat"] // 4)] == "Am"]
gate_gm = [note(e, 0.25, pitch=38, clip=False) for e in of("gate") if CHORD_OF_BAR[int(e["beat"] // 4)] == "Gm"]
if len(gate_am) + len(gate_gm) != len(of("gate")):
    raise SystemExit("a gate opens on a chord with no tuned snare")

buses: dict[str, Track] = {
    # the sketch-B kick, tuned to D2 (73 Hz): a tone of every chord in the song (the sketch's C#2 is not in the key)
    "kick": Track(name="Pacer hammer", instrument="kick_909", gain=1.0, notes=tuple(kick),
                  tone=Tone(brightness=0.9, decay_seconds=0.25, tuning_semitones=5.6),
                  effects=(Filter(mode="highpass", cutoff_hz=45, resonance=0.1), Distortion(drive=9.0, mix=1.0),
                           Filter(mode="lowpass", cutoff_hz=4000, resonance=0.1))),
    "bass": bass_track(bass, name="Track drive"),
    "red": lead_track(red, name="Red marble"),
    "blue": stab_track(blue, name="Blue marble"),
    "mid lo": mid_track(mid_lo, name="Board lo"),
    "mid hi": mid_track(mid_hi, name="Board hi"),
    "glow lo": mid_track(glow_lo, name="Winner glow lo"),
    "glow hi": mid_track(glow_hi, name="Winner glow hi"),
    "stab lo": mid_track(stab_lo, name="Checkpoint lo"),
    "stab hi": mid_track(stab_hi, name="Checkpoint hi"),
    "clap": Track(name="Checkpoint clap", instrument="clap", gain=1.0, tone=Tone(brightness=0.6), notes=tuple(clap)),
    # metal_hat rings near C# untuned (measured on this track's stem): -4 semitones puts it on A, the key's root
    "hats": Track(name="Chaser bulbs", instrument="metal_hat", gain=1.0, tone=Tone(brightness=0.7, decay_seconds=0.1, tuning_semitones=-4.0),
                  notes=tuple(hats)),
    "roll": Track(name="Finish banner", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.7, tuning_semitones=-1.0),  # rings on F (a tone of the Bb under it), not E
                  notes=tuple(roll)),
    "gate am": Track(name="Gate on Am", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.8, tuning_semitones=-1.8),
                     notes=tuple(gate_am)),
    "gate gm": Track(name="Gate on Gm", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.8, tuning_semitones=1.0),
                     notes=tuple(gate_gm)),
}
# Levels by stem RMS (dB vs the kick, where each plays): the sketch-B balance the owner picked, kick and bass forward,
# Red's lead over the mids; the checkpoint and banner parts loud enough to hear on a phone.
TARGET_DB = {"kick": 0.0, "bass": -4.0, "red": -3.5, "blue": -5.0, "mid": -7.0, "glow": -9.0, "hats": -10.0,
             "stab": -6.0, "clap": -5.0, "roll": -6.0, "gate": -4.0}


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
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


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
    pitched = red + blue + bass + mid_lo + mid_hi + glow_lo + glow_hi + stab_lo + stab_hi
    for n in pitched:
        ch = CHORD_OF_BAR[int(n.start // 4)]
        if n.pitch % 12 not in CHORDS[ch]:
            raise SystemExit(f"note {n.pitch} at beat {n.start} not in {ch}")
        if n.start + n.duration > chord_end(n.start) + 1e-6:
            raise SystemExit(f"note {n.pitch} at beat {n.start} rings into the next chord")
    _, raw = render_buses(buses, BPM, BEATS, seed=2, sample_rate=SR)
    n = max(len(v) for v in raw.values())
    stems: dict[str, np.ndarray] = {}
    for k, v in raw.items():
        stems[group(k)] = stems.get(group(k), 0) + np.pad(v, ((0, n - len(v)), (0, 0)))
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
    plan = [{"section": s["id"], "bars": f"{s['fromBar'] + 1}-{s['toBar']}", "what": s["what"],
             "chords": CHORD_OF_BAR[s["fromBar"]:s["toBar"]], "hook": tl["hookOfBar"][s["fromBar"]:s["toBar"]],
             "balance_20_60_150_1k_5k": band_balance(track, s["fromBar"], s["toBar"])} for s in tl["sections"]]

    def block(b0):
        sel = lambda ns: tuple(sorted((round(x.start - b0 * 4, 3), x.pitch) for x in ns if b0 * 4 <= x.start < b0 * 4 + 16))  # noqa: E731
        return sel(red + blue), sel(bass)
    same = [f"bars {b + 1}-{b + 4} = {b + 5}-{b + 8}" for b in range(0, BARS - 4, 4) if block(b) == block(b + 4)]
    max_frame_diff = max(abs(x.start * FPB - round(x.start * FPB)) for t in buses.values() for x in t.notes)
    mapping = {inst: len(of(inst)) for inst in sorted({e["instrument"] for e in EV})}
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"bpm": BPM, "bars": BARS, "seconds": BEATS * SPB, "winner": tl["winner"], "finishAt": tl["finishAt"],
              "loop": loop, "plan": plan, "stem_rms_db_vs_kick": final, "identical_neighbour_blocks": same,
              "sync": {"events": len(EV), "events_by_instrument": mapping, "max_note_off_frame_grid_frames": max_frame_diff},
              "notes_per_bus": {k: len(t.notes) for k, t in buses.items()}}
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    for p in plan:
        print(f"{p['section']:11s} bars {p['bars']:5s} {' '.join(p['chords']):12s} balance {p['balance_20_60_150_1k_5k']}  {' | '.join(p['hook'])}")
    print("stem RMS vs kick (dB):", final)
    print("identical neighbouring 4-bar blocks:", same or "none")
    print("sync: max note start off the frame grid (frames):", max_frame_diff, "events:", mapping)
    print("loop:", loop)


if __name__ == "__main__":
    main()
