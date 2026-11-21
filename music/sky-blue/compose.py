"""Why is the sky blue? Soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, F# minor (F#m, D, Bm, C#; one chord per bar), 24 bars (38.4 s). One groove, one grid.
The house sound (docs/music-reference.md): four-on-the-floor dem with rumble, distorted reese wall in legato 16ths,
clap on 2 and 4, 16th hats, offbeat open hat, dense from the first frame. Every thing on screen is an instrument:
- the photons (timeline.json): one red, one green, one blue every 8th note. A photon that reaches her on the hill is a
  pluck on a chord tone (red = the root, green = the next tone up, blue = the one above); a photon the air scatters
  away is a high bell, at the moment it scatters. Both snapped to the nearest 16th. At noon most get through and the
  blue ones ring in the sky; at sunset nearly everything scatters early and only red gets through: the plucks thin out
  to the red root while the bells fill the sky. That change is the drop.
- the sun going down is the riser (bars 8-11); the drop lands as it touches the horizon.
- the sky's colour is the pad.

Run from the repo root:  uv run --locked python music/sky-blue/compose.py
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
PUBLIC = ROOT / "public" / "sky-blue"

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM = tl["bpm"]
BARS = tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
SET, DROP, RISE = tl["setBar"], tl["dropBar"], tl["riseBar"]
DROPS = range(DROP, RISE)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


CHORDS = [("F#m", 6, [6, 9, 1]), ("D", 2, [2, 6, 9]), ("Bm", 11, [11, 2, 6]), ("C#", 1, [1, 5, 8])]
chord = lambda beat: CHORDS[int(beat // 4) % 4]  # noqa: E731
KICK_ROOT = {6: 30, 2: 38, 11: 35, 1: 37}  # F#1, D2, B1, C#2: dem body 46-73 Hz
COLOUR_INDEX = {"red": 0, "green": 1, "blue": 2}


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


def chord_tone(beat, register, colour):
    _, root, pcs = chord(beat)
    order = [pcs[0], pcs[1], pcs[2]]  # root, third, fifth
    m = register
    while m % 12 != order[COLOUR_INDEX[colour]]:
        m += 1
    return m


# ---------------------------------------------------------------- drums
kicks = sorted(tl["kicks"])
kick_notes = [(k, KICK_ROOT[chord(k)[1]], 0.9, 1.0) for k in kicks]
clap = [n(39, c, 0.25, 0.9) for c in tl["claps"] if not (int(c // 4) == DROP - 1 and c % 4 >= 2)]
rumble = [n(33, k, 0.9, 0.85) for k in kicks]
hats, hat_open = [], []
for b in range(BARS):
    if b == DROP - 1:
        hats += [n(42, b * 4 + s / 4, 0.05, 0.3) for s in range(8)]
        continue
    hats += [n(42, b * 4 + s / 4, 0.05, (0.3, 0.45, 0.35, 0.5)[s % 4]) for s in range(16)]
    hat_open += [n(46, b * 4 + q + 0.5, 0.22, 0.5) for q in range(4)]
rb = (DROP - 1) * 4
roll = [n(38, rb + 2 + s / 4, 0.08, 0.4 + 0.55 * (s / 7) ** 2) for s in range(8)]
crash = [n(51, 0, 3, 0.7), n(51, 16, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, (DROP + 4) * 4, 3, 0.6), n(51, RISE * 4, 3, 0.6)]
impact = [n(33, DROP * 4, 2.5, 1.0)]
riser = [n(p, SET * 4, (DROP - SET) * 4 - 0.1, 0.7) for p in (54, 61, 66)]

# ---------------------------------------------------------------- low end and pad
grit = []
for b in range(BARS):
    root = KICK_ROOT[CHORDS[b % 4][1]] + 12
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue
        grit += [n(root, b * 4 + q + s / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s]) for s in range(4)]
PAD = {"F#m": [54, 57, 61, 66], "D": [54, 57, 62, 66], "Bm": [54, 59, 62, 66], "C#": [53, 56, 61, 65]}
pad = [n(p, b * 4, 3.95, 0.45) for b in range(BARS) for p in PAD[CHORDS[b % 4][0]]]

# ---------------------------------------------------------------- the photons
pluck, bell = {}, {}
for ph in tl["photons"]:
    beat = ph["noteBeat"]
    if beat >= BEATS:
        continue
    if ph["scatterAt"] is None:  # reached her
        key = (beat, chord_tone(beat, 62, ph["col"]))
        pluck[key] = min(1.0, pluck.get(key, 0) + 0.75)
    else:  # scattered into the sky
        key = (beat, chord_tone(beat, 86, ph["col"]))
        bell[key] = min(1.0, bell.get(key, 0) + 0.45)
pluck_notes = [n(p, b, 0.22, v) for (b, p), v in sorted(pluck.items())]
bell_notes = [n(p, b, 0.35, v) for (b, p), v in sorted(bell.items())]
# the drop: the red that gets through, doubled as a dark riff on the roots (red = root)
RIFF = [(0, 0.5), (0.75, 0.25), (1.5, 0.5), (2.25, 0.25), (2.5, 0.5), (3.5, 0.5)]
riff = []
for b in DROPS:
    root = chord_tone(b * 4, 66, "red")
    riff += [n(root + (12 if i == 3 else 0), b * 4 + off, d, 0.9 if off == 0 else 0.75) for i, (off, d) in enumerate(RIFF)]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.3, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.8, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Rumble", instrument="kick_909", gain=0.15, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Impact", instrument="kick_808", gain=0.55, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.26, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.6), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Sunset riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=SET * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.85, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=10.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
    Track(name="Sky pad", instrument="wavetable_pad", gain=0.22, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pad), release_seconds=0.6, effects=(space, side)),
    # the photons
    Track(name="Photons that reach her", instrument="trance_pluck", gain=0.5, tone=Tone(brightness=0.65, cutoff_hz=2400, resonance=0.35, decay_seconds=0.35),
          notes=tuple(pluck_notes), effects=(echo, side)),
    Track(name="Photons scattered", instrument="glockenspiel", gain=0.42, pan=0.15, tone=Tone(brightness=0.8, decay_seconds=0.9), notes=tuple(bell_notes), effects=(echo, big_space)),
    Track(name="Red riff", instrument="sync_lead", gain=0.6, tone=Tone(brightness=0.6, cutoff_hz=4200), notes=tuple(riff),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
]

song = Song(title="Why Is the Sky Blue", bpm=float(BPM), beats=float(BEATS), seed=450, master_gain=0.8, tracks=tuple(tracks))


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
