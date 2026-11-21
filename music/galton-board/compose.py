"""1,000 Balls, One Bell Curve: soundtrack for the Galton board, composed with Audio as Code.

Chiptune dance, 150 BPM, E minor, 22 bars (35.2 s). 30 fps, 12 frames per beat. Chords, one per bar: Em - C - G - D.

Foundation (shared by every video):
- the kick is the "dem" (music/_shared/dem.py), tuned to each bar's chord root: E1, C2, G1, D1
- the triangle bass plays the same roots an octave up, on the kick's rhythm (8ths in the drop)
- everything else follows the same chords on the same 16th grid

Physics: a ball entering bin k plays the k-th tone of the current chord counting up from E3 (bin 0 lowest, bin 12
highest). Every ball enters its bin exactly 13 sixteenths after release, so every note is on the grid without
moving anything. Balls entering the same bin on the same 16th are one note, a little louder. Because most balls
land in the middle, the middle notes play most and the edge notes almost never: you hear the bell curve.
Releases speed up through the track, so the physics is the build: 1 ball a beat in the intro, about 6 per 16th
in the drop. Bars 19-20 play the finished curve back as one sweep, each bin as loud as it is full.
The last 2 bars are the intro texture, so the loop runs on (the bins drain in the last bar).

Run from the repo root:  uv run --locked python music/galton-board/compose.py
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
PUBLIC = ROOT / "public" / "galton-board"

BPM = 150
BARS = 22
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
assert tl["bpm"] == BPM
events, counts = tl["events"], tl["counts"]


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- harmony
ROOTS = [28, 36, 31, 26]  # E1, C2, G1, D1: the kick's notes; the bass plays them an octave up
TRIADS = [(0, 3, 7), (0, 4, 7), (0, 4, 7), (0, 4, 7)]  # Em, C, G, D
root = lambda b: ROOTS[b % 4]  # noqa: E731

INTRO, VERSE, GROOVE, BUILD, DROP, REVEAL, OUTRO = range(0, 2), range(2, 6), range(6, 10), range(10, 12), range(12, 18), range(18, 20), range(20, 22)
SOFT = set(INTRO) | set(OUTRO)
FULL = set(DROP) | set(REVEAL)


def chord_tones(b: int, lowest: int = 52, count: int = 13) -> list[int]:
    """The chord of bar b, ascending from the first chord tone at or above `lowest` (E3)."""
    pcs = {(root(b) + i) % 12 for i in TRIADS[b % 4]}
    return [p for p in range(lowest, lowest + 60) if p % 12 in pcs][:count]


# ---------------------------------------------------------------- groove: kick, bass, drums
kick_hits, bass, snare, clap, hat, open_hat, crash = [], [], [], [], [], [], []
for b in range(BARS):
    t = b * 4
    beats = [0, 2] if b in SOFT else [0, 2, 2.5] if b in VERSE else [0, 1, 2] if b == 11 else [0, 1, 2, 3]
    for i, q in enumerate(beats):
        nxt = beats[i + 1] if i + 1 < len(beats) else 4
        kick_hits.append((t + q, root(b), 0.9 * min(nxt - q, 2.0), 1.0 if q == 0 else 0.9))
        if b not in FULL:
            bass.append(n(root(b) + 12, t + q, 0.9 * (nxt - q), 0.8 if b in SOFT else 0.9))
    if b in FULL:
        bass += [n(root(b) + 12 + (12 if e % 2 else 0), t + e / 2, 0.42, 0.9 if e % 2 == 0 else 0.75) for e in range(8)]
    if b not in SOFT and b not in INTRO:
        snare += [n(38, t + 1, 0.25, 0.75), n(38, t + 3, 0.25, 0.8)]
    if b in FULL:
        clap += [n(39, t + 1, 0.25, 0.7), n(39, t + 3, 0.25, 0.7)]
        open_hat += [n(46, t + q + 0.5, 0.25, 0.45) for q in range(4)]
    if b in FULL or b in GROOVE or b in BUILD:
        hat += [n(42, t + s / 4, 0.06, 0.5 if s % 2 == 0 else 0.3) for s in range(16)]
    else:
        hat += [n(42, t + e / 2, 0.08, (0.4 if e % 2 == 0 else 0.25) * (0.7 if b in SOFT else 1.0)) for e in range(8)]
snare += [n(38, 11 * 4 + s / 4, 0.12, 0.3 + 0.6 * (s / 15) ** 2) for s in range(16)]
crash += [n(51, 12 * 4, 3.5, 0.8), n(51, 18 * 4, 3.5, 0.6)]
riser = [n(p, 10 * 4, 7.9, 0.7) for p in (52, 59, 64)]
pad = [n(p, b * 4, 3.9, 0.38) for b in range(BARS) for p in chord_tones(b, 55, 3)]

# intro and outro: a soft chord riff through a lowpass (the same texture at both ends of the loop)
riff_dark = [n(chord_tones(b)[[3, 5, 4, 5, 6, 5, 4, 5][i]], b * 4 + i / 2, 0.4, 0.6) for b in (*INTRO, *OUTRO) for i in range(8)]

# ---------------------------------------------------------------- the balls
groups = {0: [], 1: [], 2: []}  # left, middle, right bins (as on screen)
for e in events:
    b = int(e["beat"] // 4)
    k = e["bin"]
    vel = (0.6 if b in SOFT else 0.8) + 0.06 * (e["balls"] - 1)
    groups[0 if k <= 4 else 1 if k <= 7 else 2].append(n(chord_tones(b)[k], e["beat"], 0.18, vel))

# the reveal: the finished curve played back, bin 0 -> 12 and back, each note as loud as its bin is full
peak = max(counts)
sweep = []
for i, k in enumerate(list(range(13)) + list(range(12, -1, -1))):
    beat = 18 * 4 + i * 0.25 + (0.25 if i >= 13 else 0)
    if counts[k]:
        sweep.append(n(chord_tones(int(beat // 4))[k], beat, 0.3, 0.35 + 0.65 * (counts[k] / peak) ** 0.5))

# ---------------------------------------------------------------- song
kick_beats = tuple(sorted(h[0] for h in kick_hits))
duck = Ducker(trigger_beats=kick_beats, depth=0.5, attack_seconds=0.004, release_seconds=0.15)
rev_short, rev_long = Reverb(decay_seconds=1.0, mix=0.16), Reverb(decay_seconds=2.4, mix=0.3)
dotted8 = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.2)


def balls_track(name, notes, pan):
    return Track(name=name, instrument="fm_bell", gain=0.28, pan=pan, tone=Tone(brightness=0.7, decay_seconds=0.25), notes=tuple(notes),
                 effects=(Distortion(drive=2.5, mix=0.4), rev_short))


tracks = [
    *dem_tracks(kick_hits),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.8, notes=tuple(bass), effects=(duck,)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.28, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12), notes=tuple(pad),
          release_seconds=0.6, effects=(Chorus(), rev_long, duck)),
    Track(name="Snare", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.85), notes=tuple(snare), effects=(Distortion(drive=3.0, mix=0.5), rev_short)),
    Track(name="Clap", instrument="clap", gain=0.7, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hat", instrument="metal_hat", gain=0.9, pan=0.2, tone=Tone(brightness=0.6), notes=tuple(hat)),
    Track(name="Open hat", instrument="open_hat", gain=0.6, pan=-0.2, notes=tuple(open_hat)),
    Track(name="Crash", instrument="electronic_ride", gain=0.3, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crash), effects=(rev_long,)),
    Track(name="Riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=350), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=40.0, value=0.0), AutomationPoint(beat=47.9, value=1.0), AutomationPoint(beat=48.0, value=0.0))),)),
    Track(name="Riff (filtered)", instrument="sync_lead", gain=0.45, tone=Tone(brightness=0.4, cutoff_hz=1400), notes=tuple(riff_dark), effects=(dotted8, rev_long)),
    Track(name="Curve sweep", instrument="hoover", gain=0.8, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7), notes=tuple(sweep),
          effects=(Chorus(mix=0.3), dotted8, rev_short)),
    # the balls: left, middle and right bins, panned as they sit on screen
    balls_track("Balls left bins", groups[0], -0.5),
    balls_track("Balls middle bins", groups[1], 0.0),
    balls_track("Balls right bins", groups[2], 0.5),
]

song = Song(title="1,000 Balls, One Bell Curve", bpm=float(BPM), beats=float(BEATS), seed=4096, master_gain=0.8, tracks=tuple(tracks))


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
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks)}, indent=2))


if __name__ == "__main__":
    main()
