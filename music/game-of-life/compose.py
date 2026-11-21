"""Game of Life Sequencer: soundtrack, composed with Audio as Code.

Synth-pop, 120 BPM, C minor, 16 bars (32 s = 64 generations, one per beat). 30 fps, 15 frames per beat.
Chords, one per bar: Cm7 - Abmaj7 - Ebmaj7 - Bb7.

Foundation (shared by every video):
- the kick is the "dem" (music/_shared/dem.py), tuned to each bar's chord root: C2, Ab1, Eb1, Bb1
- the triangle bass plays the same roots an octave up, on the kick's rhythm
- everything else follows the same chords on the same 16th grid

Physics: the board is the step sequencer. The playhead reads one column per 16th; every live cell under it plays
a note, row = pitch (bottom row lowest), each row a tone of the current 7th chord, so any set of live cells is a
chord tone stack. The glider's cells play a lead synth (the melody that travels); the blinkers' and beacons' cells
play a pluck (they repeat every 2 generations, so they make the riff).
The last 2 bars are the intro texture, and generation 64 is generation 0 again, so the loop runs on.

Run from the repo root:  uv run --locked python music/game-of-life/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Chorus, Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from dem import dem_tracks  # noqa: E402
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "game-of-life"

BPM = 120
BARS = 16
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
assert tl["bpm"] == BPM
events, SIZE = tl["events"], tl["size"]


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- harmony
ROOTS = [36, 32, 27, 34]  # C2, Ab1, Eb1, Bb1: the kick's notes; the bass plays them an octave up
CHORDS = [(0, 3, 7, 10), (0, 4, 7, 11), (0, 4, 7, 11), (0, 4, 7, 10)]  # Cm7, Abmaj7, Ebmaj7, Bb7
root = lambda b: ROOTS[b % 4]  # noqa: E731

INTRO, VERSE, BUILD, DROP, OUTRO = range(0, 2), range(2, 6), range(6, 8), range(8, 14), range(14, 16)
SOFT = set(INTRO) | set(OUTRO)


def chord_tones(b: int, lowest: int = 48, count: int = SIZE) -> list[int]:
    pcs = {(root(b) + i) % 12 for i in CHORDS[b % 4]}
    return [p for p in range(lowest, lowest + 60) if p % 12 in pcs][:count]


# ---------------------------------------------------------------- groove
kick_hits, bass, snare, clap, hat, open_hat, crash = [], [], [], [], [], [], []
for b in range(BARS):
    t = b * 4
    beats = [0, 2] if b in SOFT else [0, 2, 2.5] if b in VERSE else [0, 1, 2] if b == 7 else [0, 1, 2, 3]
    for i, q in enumerate(beats):
        nxt = beats[i + 1] if i + 1 < len(beats) else 4
        kick_hits.append((t + q, root(b), 0.9 * min(nxt - q, 2.0), 1.0 if q == 0 else 0.9))
        if b not in DROP:
            bass.append(n(root(b) + 12, t + q, 0.9 * (nxt - q), 0.8 if b in SOFT else 0.9))
    if b in DROP:
        bass += [n(root(b) + 12 + (12 if e % 2 else 0), t + e / 2, 0.42, 0.9 if e % 2 == 0 else 0.75) for e in range(8)]
    if b not in SOFT:
        snare += [n(38, t + 1, 0.25, 0.75), n(38, t + 3, 0.25, 0.8)]
    if b in DROP:
        clap += [n(39, t + 1, 0.25, 0.7), n(39, t + 3, 0.25, 0.7)]
        open_hat += [n(46, t + q + 0.5, 0.25, 0.45) for q in range(4)]
        hat += [n(42, t + s / 4, 0.06, 0.5 if s % 2 == 0 else 0.3) for s in range(16)]
    else:
        hat += [n(42, t + e / 2, 0.08, (0.4 if e % 2 == 0 else 0.25) * (0.7 if b in SOFT else 1.0)) for e in range(8)]
snare += [n(38, 7 * 4 + s / 4, 0.12, 0.3 + 0.6 * (s / 15) ** 2) for s in range(16)]
crash += [n(51, 8 * 4, 3.5, 0.8)]
riser = [n(p, 6 * 4, 7.9, 0.7) for p in (48, 55, 60)]
pad = [n(p, b * 4, 3.9, 0.36) for b in range(BARS) for p in chord_tones(b, 55, 4)]

# ---------------------------------------------------------------- the board
def glider_cell(e) -> bool:
    """The glider starts at (0..2, 0..2) and moves one cell down-right every 4 generations; its cells stay on
    the diagonals x - y = -2..1 (mod 16). The oscillators sit 7 diagonals away."""
    return ((e["col"] - e["row"]) % SIZE) in (14, 15, 0, 1, 2)


lead, pluck = [], []
for e in events:
    b = int(e["beat"] // 4)
    tones = chord_tones(b)
    pitch = tones[SIZE - 1 - e["row"]]  # top row highest
    soft = 0.75 if b in SOFT else 1.0
    if glider_cell(e):
        lead.append(n(pitch + 12, e["beat"], 0.22, 0.9 * soft))
    else:
        pluck.append(n(pitch, e["beat"], 0.2, 0.8 * soft))

# ---------------------------------------------------------------- song
kick_beats = tuple(sorted(h[0] for h in kick_hits))
duck = Ducker(trigger_beats=kick_beats, depth=0.5, attack_seconds=0.004, release_seconds=0.16)
rev_short, rev_long = Reverb(decay_seconds=1.1, mix=0.18), Reverb(decay_seconds=2.6, mix=0.3)
dotted8 = Delay(time_seconds=0.5 * SPB, feedback=0.3, repeats=3, mix=0.18)  # straight 8ths: a dotted-8th echo read as 80 BPM in the hat band

tracks = [
    *dem_tracks(kick_hits),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.55, notes=tuple(bass), effects=(duck,)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.28, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12), notes=tuple(pad),
          release_seconds=0.6, effects=(Chorus(), rev_long, duck)),
    Track(name="Snare", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.85), notes=tuple(snare), effects=(Distortion(drive=3.0, mix=0.5), rev_short)),
    Track(name="Clap", instrument="clap", gain=0.7, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hat", instrument="metal_hat", gain=0.9, pan=0.2, tone=Tone(brightness=0.6), notes=tuple(hat)),
    Track(name="Open hat", instrument="open_hat", gain=0.6, pan=-0.2, notes=tuple(open_hat)),
    Track(name="Crash", instrument="electronic_ride", gain=0.3, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crash), effects=(rev_long,)),
    Track(name="Riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=350), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=24.0, value=0.0), AutomationPoint(beat=31.9, value=1.0), AutomationPoint(beat=32.0, value=0.0))),)),
    # the board: the glider sings, the oscillators pluck the riff
    Track(name="Glider (lead)", instrument="hoover", gain=0.5, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7), notes=tuple(lead),
          effects=(Distortion(drive=3.0, mix=0.5), dotted8, rev_short, Ducker(trigger_beats=kick_beats, depth=0.25, release_seconds=0.12))),
    Track(name="Oscillators (pluck)", instrument="trance_pluck", gain=0.55, tone=Tone(brightness=0.65, decay_seconds=0.3), notes=tuple(pluck),
          effects=(Distortion(drive=3.0, mix=0.5), dotted8, rev_short)),
]

song = Song(title="Game of Life Sequencer", bpm=float(BPM), beats=float(BEATS), seed=6464, master_gain=0.8, tracks=tuple(tracks))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    song.save(OUT / "score.json")
    wav = PUBLIC / "track.wav"
    report = render(song, wav, target_lufs=-14.0, peak_ceiling_dbfs=-1.0)
    loop = finish_loop(wav, BEATS * SPB)
    try:
        midi = export_midi(song, OUT / "song.mid")
    except ValueError as err:
        midi = {"skipped": str(err)}
    (OUT / "report.json").write_text(json.dumps({"render": report, "loop": loop, "midi": midi}, indent=2, default=str) + "\n")
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks), "lead": len(lead), "pluck": len(pluck)}, indent=2))


if __name__ == "__main__":
    main()
