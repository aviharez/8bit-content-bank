"""15 Pendulums, 1 Cycle: soundtrack, composed with Audio as Code.

Chiptune pop, 120 BPM, G minor, 16 bars (32 s = one full pendulum-wave cycle, real time). 30 fps, 15 frames per beat.
Chords, one per bar: Gm - Eb - Bb - F.

Foundation (shared by every video):
- the kick is the "dem" (music/_shared/dem.py), tuned to each bar's chord root: G1, Eb1, Bb1, F1
- the triangle bass plays the same roots an octave up, on the kick's rhythm
- everything else follows the same chords on the same 16th grid

Physics: each pendulum plays a note every time its bob passes the centre moving right (snapped to the nearest 16th,
at most 62.5 ms). Pendulum k (k = 0 the longest, lowest) plays the k-th tone of the current chord counting up from
the root two octaves down, so the 15 bobs span five octaves of the chord, low on the left, high on the right.
When they line up, their notes stack into chords; when they look random, they shimmer like an arpeggio.
The drop lands on t = 16 s, half a cycle, when the row splits into two lines.
The last 2 bars are the intro texture, so the loop runs on (and at t = 32 s the pendulums are back in line).

Run from the repo root:  uv run --locked python music/pendulum-wave/compose.py
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
PUBLIC = ROOT / "public" / "pendulum-wave"

BPM = 120
BARS = 16
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
assert tl["bpm"] == BPM
events = tl["events"]


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- harmony
ROOTS = [31, 27, 34, 29]  # G1, Eb1, Bb1, F1: the kick's notes; the bass plays them an octave up
TRIADS = [(0, 3, 7), (0, 4, 7), (0, 4, 7), (0, 4, 7)]  # Gm, Eb, Bb, F
root = lambda b: ROOTS[b % 4]  # noqa: E731
triad = lambda b: TRIADS[b % 4]  # noqa: E731

INTRO, VERSE, BUILD, DROP, OUTRO = range(0, 2), range(2, 7), range(7, 8), range(8, 14), range(14, 16)
SOFT = set(INTRO) | set(OUTRO)


def chord_tone(b: int, i: int) -> int:
    """The i-th tone of bar b's chord, counting up from the root at octave 2 (G2 for Gm)."""
    iv = triad(b)
    return root(b) + 12 + 12 * (i // 3) + iv[i % 3]


# ---------------------------------------------------------------- groove: kick, bass, drums
kick_hits, bass, snare, clap, hat, open_hat, crash = [], [], [], [], [], [], []
for b in range(BARS):
    t = b * 4
    if b in SOFT:
        beats = [0, 2]
    elif b in VERSE:
        beats = [0, 2, 2.5]
    elif b in BUILD:
        beats = [0, 1, 2]
    else:
        beats = [0, 1, 2, 3]
    for i, q in enumerate(beats):
        nxt = beats[i + 1] if i + 1 < len(beats) else 4
        kick_hits.append((t + q, root(b), 0.9 * min(nxt - q, 2.0), 1.0 if q == 0 else 0.9))
        # bass: the kick's root an octave up, on the kick's rhythm; 8ths in the drop
        if b in DROP:
            continue
        bass.append(n(root(b) + 12, t + q, 0.9 * (nxt - q), 0.8 if b in SOFT else 0.9))
    if b in DROP:
        bass += [n(root(b) + 12 + (12 if e % 2 else 0), t + e / 2, 0.42, 0.9 if e % 2 == 0 else 0.75) for e in range(8)]
    if b in VERSE or b in DROP:
        snare += [n(38, t + 1, 0.25, 0.75), n(38, t + 3, 0.25, 0.8)]
    if b in DROP:
        clap += [n(39, t + 1, 0.25, 0.7), n(39, t + 3, 0.25, 0.7)]
        hat += [n(42, t + s / 4, 0.06, 0.5 if s % 2 == 0 else 0.3) for s in range(16)]
        open_hat += [n(46, t + q + 0.5, 0.25, 0.45) for q in range(4)]
    else:
        hat += [n(42, t + e / 2, 0.08, (0.4 if e % 2 == 0 else 0.25) * (0.7 if b in SOFT else 1.0)) for e in range(8)]
snare += [n(38, 7 * 4 + s / 4, 0.12, 0.3 + 0.6 * (s / 15) ** 2) for s in range(16)]
crash += [n(51, 0, 3.5, 0.45), n(51, 8 * 4, 3.5, 0.8), n(51, 12 * 4, 3.5, 0.6)]
riser = [n(p, 7 * 4, 3.9, 0.7) for p in (55, 62, 67)]

# pad: the chord, held
pad = [n(chord_tone(b, i), b * 4, 3.9, 0.4) for b in range(BARS) for i in (3, 4, 5)]

# ---------------------------------------------------------------- lead hook (the drop): chord tones, chiptune square
HOOK = [
    [(0, 74, 4), (4, 70, 2), (6, 67, 4), (10, 70, 2), (12, 74, 2), (14, 77, 2)],  # Gm
    [(0, 75, 4), (4, 70, 2), (6, 67, 4), (10, 67, 2), (12, 70, 2), (14, 72, 2)],  # Eb
    [(0, 74, 4), (4, 70, 2), (6, 65, 4), (10, 65, 2), (12, 70, 2), (14, 74, 2)],  # Bb
    [(0, 72, 3), (3, 69, 3), (6, 65, 4), (10, 72, 2), (12, 74, 2), (14, 77, 2)],  # F
]
lead = [n(p + (12 if b >= 12 else 0), b * 4 + s / 4, ln / 4 * 0.92, 0.85 if s in (0, 6) else 0.72)
        for b in DROP for s, p, ln in HOOK[b % 4]]

# ---------------------------------------------------------------- the pendulums
groups = {0: [], 1: [], 2: []}  # left, middle, right (as on screen)
for e in events:
    beat = e["beat"]
    b = int(beat // 4) % BARS
    k = e["k"]
    vel = (0.7 if b in SOFT else 0.95) * (1.0 if k >= 3 else 0.9)
    groups[min(2, k // 5)].append(n(chord_tone(b, k), beat, 0.2, vel))

# ---------------------------------------------------------------- song
kick_beats = tuple(sorted(h[0] for h in kick_hits))
duck = Ducker(trigger_beats=kick_beats, depth=0.5, attack_seconds=0.004, release_seconds=0.16)
rev_short, rev_long = Reverb(decay_seconds=1.1, mix=0.18), Reverb(decay_seconds=2.6, mix=0.3)
dotted8 = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.2)

tracks = [
    *dem_tracks(kick_hits),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.6, notes=tuple(bass), effects=(duck,)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.3, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12), notes=tuple(pad),
          release_seconds=0.6, effects=(Chorus(), rev_long, duck)),
    Track(name="Snare", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.85), notes=tuple(snare), effects=(rev_short,)),
    Track(name="Clap", instrument="clap", gain=0.7, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hat", instrument="metal_hat", gain=0.9, pan=0.2, tone=Tone(brightness=0.6), notes=tuple(hat)),
    Track(name="Open hat", instrument="open_hat", gain=0.6, pan=-0.2, notes=tuple(open_hat)),
    Track(name="Crash", instrument="electronic_ride", gain=0.3, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crash), effects=(rev_long,)),
    Track(name="Riser", instrument="supersaw", gain=0.24, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=1.2, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=350), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=28.0, value=0.0), AutomationPoint(beat=31.9, value=1.0), AutomationPoint(beat=32.0, value=0.0))),)),
    Track(name="Lead (square)", instrument="hoover", gain=0.9, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7), notes=tuple(lead),
          effects=(Chorus(mix=0.3), dotted8, rev_short, Ducker(trigger_beats=kick_beats, depth=0.25, release_seconds=0.12))),
    # the pendulums: left, middle and right of the row, panned as they stand on screen
    Track(name="Pendulums left", instrument="trance_pluck", gain=0.65, pan=-0.5, tone=Tone(brightness=0.6, decay_seconds=0.35), notes=tuple(groups[0]), effects=(Distortion(drive=3.0, mix=0.5), dotted8, rev_short)),
    Track(name="Pendulums middle", instrument="trance_pluck", gain=0.65, pan=0.0, tone=Tone(brightness=0.65, decay_seconds=0.3), notes=tuple(groups[1]), effects=(Distortion(drive=3.0, mix=0.5), dotted8, rev_short)),
    Track(name="Pendulums right", instrument="trance_pluck", gain=0.65, pan=0.5, tone=Tone(brightness=0.7, decay_seconds=0.25), notes=tuple(groups[2]), effects=(Distortion(drive=3.0, mix=0.5), dotted8, rev_short)),
]

song = Song(title="15 Pendulums, 1 Cycle", bpm=float(BPM), beats=float(BEATS), seed=1530, master_gain=0.8, tracks=tuple(tracks))


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
