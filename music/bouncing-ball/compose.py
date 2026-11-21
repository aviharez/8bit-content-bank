"""The Ball That Drum-Rolls: soundtrack, composed with Audio as Code.

Chiptune house, 120 BPM, F minor, 12 bars (24 s). 30 fps, 15 frames per beat. Chords, one per bar: Fm - Db - Ab - Eb.

Foundation (shared by every video):
- the kick is the "dem" (music/_shared/dem.py), tuned to each bar's chord root: F1, Db2, Ab1, Eb1
- the triangle bass plays the same roots an octave up, on the kick's rhythm
- everything else follows the same chords on the same grid

Physics: the bounces are the build. Each impact is a snare hit plus a "boing" note, and with bounciness 1/2 each
flight is half the last, so the hits fall on bar, half, quarter, 8th, 16th, 32nd, 64th... an accelerating roll that
ends exactly on the downbeat of bar 6, where the music drops. The boing climbs the chord one tone per bounce.
While the ball falls (bar 3) a saw glides down an octave; while the claw lifts it (bar 11) it glides back up.
The last bar is the intro texture, and the claw puts the ball back where it started, so the loop runs on.

Run from the repo root:  uv run --locked python music/bouncing-ball/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from dem import dem_tracks  # noqa: E402
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "bouncing-ball"

BPM = 120
BARS = 12
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
assert tl["bpm"] == BPM
impacts = [i for i in tl["impacts"] if i["k"] <= 8]  # after #8 the gaps are under 16 ms: a buzz, not hits


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# ---------------------------------------------------------------- harmony
ROOTS = [29, 37, 32, 27]  # F1, Db2, Ab1, Eb1: the kick's notes; the bass plays them an octave up
TRIADS = [(0, 3, 7), (0, 4, 7), (0, 4, 7), (0, 4, 7)]  # Fm, Db, Ab, Eb
root = lambda b: ROOTS[b % 4]  # noqa: E731

INTRO, FALL, BOUNCE, DROP, CLAW, OUTRO = range(0, 2), range(2, 3), range(3, 5), range(5, 9), range(9, 11), range(11, 12)
SOFT = set(INTRO) | set(OUTRO) | set(CLAW)


def chord_tones(b: int, lowest: int = 53, count: int = 12) -> list[int]:
    pcs = {(root(b) + i) % 12 for i in TRIADS[b % 4]}
    return [p for p in range(lowest, lowest + 60) if p % 12 in pcs][:count]


# ---------------------------------------------------------------- groove
kick_hits, bass, snare, clap, hat, open_hat, crash = [], [], [], [], [], [], []
for b in range(BARS):
    t = b * 4
    if b in BOUNCE:
        beats = []  # the bounces are the drums here
    elif b in FALL:
        beats = [0]
    elif b in SOFT:
        beats = [0, 2]
    else:
        beats = [0, 1, 2, 3]
    for i, q in enumerate(beats):
        nxt = beats[i + 1] if i + 1 < len(beats) else 4
        kick_hits.append((t + q, root(b), 0.9 * min(nxt - q, 2.0), 1.0 if q == 0 else 0.9))
    if b in DROP:
        bass += [n(root(b) + 12 + (12 if e % 2 else 0), t + e / 2, 0.42, 0.9 if e % 2 == 0 else 0.75) for e in range(8)]
        snare += [n(38, t + 1, 0.25, 0.75), n(38, t + 3, 0.25, 0.8)]
        clap += [n(39, t + 1, 0.25, 0.7), n(39, t + 3, 0.25, 0.7)]
        hat += [n(42, t + s / 4, 0.06, 0.5 if s % 2 == 0 else 0.3) for s in range(16)]
        open_hat += [n(46, t + q + 0.5, 0.25, 0.45) for q in range(4)]
    elif b in BOUNCE or b in FALL:
        bass.append(n(root(b) + 12, t, 3.9, 0.75))  # a held root under the fall and the roll
    else:
        bass += [n(root(b) + 12, t + q, 1.8, 0.8) for q in (0, 2)]
        hat += [n(42, t + e / 2, 0.08, (0.4 if e % 2 == 0 else 0.25) * 0.8) for e in range(8)]
        if b in CLAW:
            snare += [n(38, t + 1, 0.25, 0.6), n(38, t + 3, 0.25, 0.65)]
crash += [n(51, 5 * 4, 3.5, 0.85)]
pad = [n(p, b * 4, 3.9, 0.36) for b in range(BARS) for p in chord_tones(b, 56, 3)]
fall_glide = [n(p, 2 * 4, 3.9, 0.7) for p in (65, 72, 77)]  # glides down an octave as the ball falls
roll_riser = [n(p, b * 4, 3.95, 0.8) for b in BOUNCE for p in chord_tones(b, 60, 3)]  # swells under the roll
lift_glide = [n(p, 10 * 4, 3.9, 0.6) for p in (53, 60, 65)]  # glides up as the claw lifts it

# the drop's lead hook: chord tones, chiptune square
HOOK = {
    0: [(0, 77, 4), (4, 72, 2), (6, 68, 4), (10, 72, 2), (12, 77, 2), (14, 80, 2)],  # Fm
    1: [(0, 77, 4), (4, 73, 2), (6, 68, 4), (10, 73, 2), (12, 77, 2), (14, 80, 2)],  # Db
    2: [(0, 75, 4), (4, 72, 2), (6, 68, 4), (10, 72, 2), (12, 75, 2), (14, 79, 2)],  # Ab
    3: [(0, 79, 3), (3, 75, 3), (6, 70, 4), (10, 74, 2), (12, 75, 2), (14, 79, 2)],  # Eb
}
lead = [n(p, b * 4 + s / 4, ln / 4 * 0.92, 0.85 if s in (0, 6) else 0.72) for b in DROP for s, p, ln in HOOK[b % 4]]
# intro and outro: the hook's first bar, lowpassed (the same texture at both ends of the loop)
riff_dark = [n(p, b * 4 + s / 4, ln / 4 * 0.92, 0.6) for b in (*INTRO, *OUTRO) for s, p, ln in HOOK[b % 4]]

# ---------------------------------------------------------------- the bounces
hits, boing = [], []
for i in impacts:
    b = int(i["beat"] // 4)
    k = i["k"]
    hits.append(n(38, i["beat"], 0.12, min(1.0, 0.7 + 0.04 * k)))
    boing.append(n(chord_tones(b)[k], i["beat"], 0.25, 0.9))

# ---------------------------------------------------------------- song
kick_beats = tuple(sorted(h[0] for h in kick_hits))
duck = Ducker(trigger_beats=kick_beats, depth=0.5, attack_seconds=0.004, release_seconds=0.16)
rev_short, rev_long = Reverb(decay_seconds=1.1, mix=0.18), Reverb(decay_seconds=2.6, mix=0.3)
echo8 = Delay(time_seconds=0.5 * SPB, feedback=0.3, repeats=3, mix=0.18)


def glide(name, notes, semis, a, b):
    return Track(name=name, instrument="supersaw", gain=0.24, tone=Tone(brightness=0.6, glide_semitones=semis, glide_seconds=2.0, detune_cents=25),
                 notes=tuple(notes), effects=(Filter(mode="highpass", cutoff_hz=300), rev_long),
                 automation=(Automation(parameter="gain", points=(AutomationPoint(beat=a, value=0.2), AutomationPoint(beat=b - 0.1, value=1.0), AutomationPoint(beat=b, value=0.0))),))


tracks = [
    *dem_tracks(kick_hits),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.6, notes=tuple(bass), effects=(duck,)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.28, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12), notes=tuple(pad),
          release_seconds=0.6, effects=(rev_long, duck)),
    Track(name="Snare", instrument="electronic_snare", gain=1.0, tone=Tone(brightness=0.85), notes=tuple(snare), effects=(Distortion(drive=3.0, mix=0.5), rev_short)),
    Track(name="Clap", instrument="clap", gain=0.7, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hat", instrument="metal_hat", gain=0.9, pan=0.2, tone=Tone(brightness=0.6), notes=tuple(hat)),
    Track(name="Open hat", instrument="open_hat", gain=0.6, pan=-0.2, notes=tuple(open_hat)),
    Track(name="Crash", instrument="electronic_ride", gain=0.32, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crash), effects=(rev_long,)),
    glide("Fall (glide down)", fall_glide, -12, 8.0, 12.0),
    glide("Lift (glide up)", lift_glide, 12, 40.0, 44.0),
    Track(name="Roll riser", instrument="supersaw", gain=0.1, tone=Tone(brightness=0.7, detune_cents=25), notes=tuple(roll_riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=12.0, value=0.02), AutomationPoint(beat=19.9, value=0.12), AutomationPoint(beat=20.0, value=0.0))),)),  # automation sets the gain itself
    Track(name="Lead (square)", instrument="hoover", gain=0.35, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7), notes=tuple(lead),
          effects=(Distortion(drive=3.0, mix=0.5), echo8, rev_short, Ducker(trigger_beats=kick_beats, depth=0.25, release_seconds=0.12))),
    Track(name="Riff (filtered)", instrument="sync_lead", gain=0.45, tone=Tone(brightness=0.4, cutoff_hz=1400), notes=tuple(riff_dark), effects=(echo8, rev_long)),
    # the ball
    Track(name="Bounce hits", instrument="electronic_snare", gain=0.9, tone=Tone(brightness=0.75), notes=tuple(hits), effects=(Distortion(drive=3.0, mix=0.5), rev_short)),
    Track(name="Bounce boing", instrument="trance_pluck", gain=1.0, tone=Tone(brightness=0.7, decay_seconds=0.3), notes=tuple(boing), effects=(Distortion(drive=3.0, mix=0.5), rev_short)),
]

song = Song(title="The Ball That Drum-Rolls", bpm=float(BPM), beats=float(BEATS), seed=1122, master_gain=0.8, tracks=tuple(tracks))


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
