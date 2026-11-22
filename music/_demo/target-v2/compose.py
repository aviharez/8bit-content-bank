"""Sound check for the owner's target sound (Nov 2026), not a video: 16 bars to listen to before the next video.

What it copies from the reference (docs/music-reference.md, "Target sound v2"):
- the swoop kick (music/_shared/swoop.py): 275 -> 87 Hz, short and driven; syncopated 8th-note runs in the intro,
  four on the floor in the main part, 3+3+2 in the last bars
- a rolling, chromatic bass on E1: 16th pickups crawling D#-E-F-F# into a held E, octave jumps to E2/F2;
  a sine with a filtered saw an octave up, no reese
- snare on 2 and 4, hats on the offbeat 8ths, little else above 5 kHz
- an octave-doubled saw stab lead on 3+3+2 in E Phrygian (the half step E-F is the colour); the FM ostinato that
  came in at 3 s sounded bad to the owner and is gone
- drums, bass and ostinato at about the same level (the reference's three stems measure -23.6, -21.9, -22.1 dB RMS)

Run from the repo root:  uv run --locked python music/_demo/target-v2/compose.py   (writes out/target-v2.wav)
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import Delay, Distortion, Filter, Note, Reverb, Song, Tone, Track, render  # noqa: E402
from mastering import finish_loop  # noqa: E402
from swoop import swoop_hits, swoop_track  # noqa: E402

BPM = 150
BARS = 16
BEATS = BARS * 4
SPB = 60 / BPM
OUT = ROOT / "out" / "target-v2.wav"


def n(p, start, dur, vel=0.8):
    return Note(pitch=int(p), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- kick (16th steps per bar)
INTRO = ["x.x.....x.x.x.x.", "x.x.x.....x...x."]
FOUR = "X...X...X...X..."
THREE = "X..X..X.X.x.x..."
kick_steps, kick_vel = [], {}
for b in range(BARS):
    pat = INTRO[b % 2] if b < 4 else THREE if b >= 12 else FOUR
    for s, c in enumerate(pat):
        if c in "xX":
            kick_steps.append(b * 16 + s)
            kick_vel[b * 16 + s] = 1.0 if c == "X" else 0.85

# ---------------------------------------------------------------- bass: rolling, chromatic around E1 (28)
E1 = 28
CRAWL = [(0, 1, -1), (1, 1, 0), (2, 1, 1), (3, 1, 2), (4, 4, 0), (8, 1, -1), (9, 1, 0), (10, 2, 1), (12, 4, 0)]  # (step, len, semis)
JUMP = [(0, 2, 0), (2, 2, 1), (4, 2, 0), (6, 2, 1), (8, 1, 13), (9, 1, 12), (10, 2, 13), (12, 2, 1), (14, 2, 0)]
bass = []
for b in range(BARS):
    pat = JUMP if 4 <= b < 12 and b % 2 else CRAWL
    for st, ln, semi in pat:
        bass.append(n(E1 + semi, b * 4 + st / 4, ln / 4 * 0.95, 0.9 if ln >= 2 else 0.75))

# ---------------------------------------------------------------- drums
snare, hats, hat16 = [], [], []
for b in range(BARS):
    if b < 4:
        snare += [n(38, b * 4 + s / 4, 0.1, 0.45 if s % 4 else 0.65) for s in range(0, 16, 2)]
    else:
        snare += [n(38, b * 4 + 1, 0.2, 0.9), n(38, b * 4 + 3, 0.2, 0.9)]
    hats += [n(42, b * 4 + q + 0.5, 0.06, 0.8) for q in range(4)]
    hat16 += [n(42, b * 4 + s / 4, 0.03, 0.25) for s in range(16) if s % 4 in (1, 3)]

# ---------------------------------------------------------------- stab lead, E Phrygian
# The sample's lead is not FM: its stem fits 3 detuned saws, low-passed at ~6x the note, a 12 ms attack and a pluck
# decay to ~30% (harmonics 0, -8, -6, -17, -14 dB). It plays octave-doubled stabs on 3+3+2 (steps 0, 3, 6 of each
# half bar), each held 2-3 sixteenths, stepping down through the chord.
HALVES = [[76, 71, 67], [76, 72, 69], [74, 69, 65], [72, 67, 64]]  # E5 B4 G4 | E5 C5 A4 | D5 A4 F4 | C5 G4 E4
lead = []
for b in range(2, BARS):
    for h in range(2):
        notes = HALVES[(b * 2 + h) % 4]
        for (st, ln), p in zip(((0, 3), (3, 3), (6, 2)), notes):
            beat = b * 4 + h * 2 + st / 4
            v = 0.95 if st == 0 else 0.8
            lead += [n(p, beat, ln / 4 * 0.9, v), n(p - 12, beat, ln / 4 * 0.9, v * 0.8)]

# ---------------------------------------------------------------- mid riff: octave dyads on the 8ths (the reference's mid band)
DYADS = [40, 47, 48, 47, 40, 50, 48, 41]  # E2 B2 C3 B2 E2 D3 C3 F2, each with its octave
mid = []
for b in range(4, BARS):
    for e, p in enumerate(DYADS):
        mid += [n(p, b * 4 + e / 2, 0.4, 0.85), n(p + 12, b * 4 + e / 2, 0.4, 0.7)]

side = tuple(s / 4 for s in kick_steps)
tracks = [
    swoop_track(swoop_hits(kick_steps, kick_vel), gain=0.09),
    Track(name="Bass sine", instrument="sub_bass", gain=0.28, tone=Tone(brightness=0.3), notes=tuple(bass), release_seconds=0.03),
    Track(name="Bass saw", instrument="acid_bass", gain=0.6, tone=Tone(cutoff_hz=420, resonance=0.25, filter_env_octaves=1.5, filter_decay_seconds=0.25),
          notes=tuple(n(x.pitch + 12, x.start, x.duration, x.velocity) for x in bass), effects=(Distortion(drive=2.0, mix=0.3),)),
    Track(name="Snare", instrument="electronic_snare", gain=0.9, tone=Tone(brightness=0.7), notes=tuple(snare), effects=(Reverb(decay_seconds=0.8, mix=0.15),)),
    Track(name="Hat", instrument="metal_hat", gain=0.3, tone=Tone(brightness=0.6, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat 16", instrument="metal_hat", gain=0.18, tone=Tone(brightness=0.6, decay_seconds=0.1), notes=tuple(hat16)),
    Track(name="Mid riff", instrument="supersaw", gain=0.45, tone=Tone(brightness=0.55, cutoff_hz=1800, detune_cents=12), notes=tuple(mid),
          release_seconds=0.05, effects=(Distortion(drive=3.0, mix=0.4),)),
    Track(name="Stab lead", instrument="supersaw", gain=1.0, tone=Tone(brightness=1.0, cutoff_hz=4800, resonance=0.15, detune_cents=9,
          filter_env_octaves=1.0, filter_decay_seconds=0.15), notes=tuple(lead), release_seconds=0.05,
          effects=(Distortion(drive=2.5, mix=0.35), Delay(time_seconds=0.75 * SPB, feedback=0.2, repeats=2, mix=0.1), Reverb(decay_seconds=0.6, mix=0.12))),
]
song = Song(title="Target v2 sound check", bpm=float(BPM), beats=float(BEATS), seed=143, master_gain=0.8, tracks=tuple(tracks))

if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    render(song, OUT, target_lufs=-14.0, peak_ceiling_dbfs=-1.0)
    print(finish_loop(OUT, BEATS * SPB))
