"""How fast can a heart beat? Soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, D# minor (D#m, B, G#m, A#; one chord per bar), 24 bars (38.4 s). One groove, one grid.
The house sound (docs/music-reference.md): four-on-the-floor dem with rumble, distorted reese wall in legato 16ths,
clap on 2 and 4, 16th hats, offbeat open hat, dense from the first frame. Every thing on screen is an instrument:
- each heartbeat (and the red pulse it sends round the vessels) is the heart monitor: a bleep on the next note of the
  chord, higher for smaller animals, plus a chord stab. The whale gets one huge stab, the hamster seven a second.
  In real time, snapped to the nearest 16th (timeline.json).
- the Etruscan shrew's heart (1,170 a minute = 19.5 a second) is faster than the 16th grid, so its stabs merge into
  one held chord whose volume pulses at exactly 19.5 Hz (tremolo), topped by D#4 (19.5 Hz x 16 = 312 Hz). That is the
  drop, with a dark riff on top.
- the heart's light in the room is the pad; the groove is the room.

Run from the repo root:  uv run --locked python music/heart-rate/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, Tremolo, Automation, AutomationPoint, export_midi, render,
)
from dem import dem_tracks  # noqa: E402
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "heart-rate"

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM = tl["bpm"]
BARS = tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
DROP, OUTRO = tl["dropBar"], tl["outroBar"]
DROPS = range(DROP, OUTRO)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


bar_of = lambda beat: int(beat // 4)  # noqa: E731
chord_of = lambda beat: tl["chords"][bar_of(beat) % 4]  # noqa: E731
KICK_ROOT = {3: 39, 11: 35, 8: 32, 10: 34}  # D#2, B1, G#1, A#1: dem body 52-78 Hz


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


# ---------------------------------------------------------------- drums
kicks = sorted(tl["kicks"])
kick_notes = [(k, KICK_ROOT[chord_of(k)["root"]], 0.9, 1.0) for k in kicks]
clap, hats, hat_open, rumble, roll, crash, impact = [], [], [], [], [], [], []
for s in tl["snares"]:
    if not (bar_of(s) == DROP - 1 and s % 4 >= 2):
        clap.append(n(39, s, 0.25, 0.9))
for k in kicks:
    rumble.append(n(33, k, 0.9, 0.85))
for b in range(BARS):
    t = b * 4
    if b == DROP - 1:
        hats += [n(42, t + s / 4, 0.05, 0.3) for s in range(8)]
        continue
    hats += [n(42, t + s / 4, 0.05, (0.3, 0.45, 0.35, 0.5)[s % 4]) for s in range(16)]
    hat_open += [n(46, t + q + 0.5, 0.22, 0.5) for q in range(4)]
rb = (DROP - 1) * 4
roll += [n(38, rb + 2 + s / 4, 0.08, 0.4 + 0.55 * (s / 7) ** 2) for s in range(8)]
crash += [n(51, 0, 3, 0.8), n(51, 16, 3, 0.5), n(51, 32, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, (DROP + 4) * 4, 3, 0.6), n(51, OUTRO * 4, 3, 0.5)]
impact += [n(33, 0, 2.0, 1.0), n(33, DROP * 4, 2.5, 1.0)]  # the whale's one beat, and the drop
riser = [n(p, (DROP - 2) * 4, 7.9, 0.75) for p in (51, 58, 63)]

# ---------------------------------------------------------------- the low end: reese wall on the roots, legato 16ths
grit = []
for b in range(BARS):
    root = KICK_ROOT[tl["chords"][b % 4]["root"]] + 12
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue
        grit += [n(root, b * 4 + q + s / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s]) for s in range(4)]

PAD = {"D#m": [51, 54, 58, 63], "B": [51, 54, 59, 63], "G#m": [51, 56, 59, 63], "A#": [50, 53, 58, 62]}
pad = [n(p, b * 4, 3.95, 0.45) for b in range(BARS) for p in PAD[tl["chords"][b % 4]["name"]]]

# ---------------------------------------------------------------- the hearts: the heart monitor (bleep) + a chord stab per beat
LEN = {"whale": 3.0, "elephant": 1.5, "human": 0.5, "cat": 0.35, "rabbit": 0.3, "hamster": 0.2}
stab, bleep = [], []
for hb in tl["beats"]:
    if hb["pitch"] is None:
        continue
    beat = hb["snappedBeat"]
    dur = LEN[hb["animal"]]
    stab += [n(p, beat, dur, 0.95) for p in tones_from(58, chord_of(beat)["tones"], 3)]
    bleep.append(n(hb["pitch"] + 12, beat, min(dur, 0.25), 0.9))

# the shrew: 19.5 heartbeats a second, too fast for the grid; its stabs merge into one chord pulsing at the heart rate
shrew_hz = next(a for a in tl["animals"] if a["id"] == "shrew")["hz"]
TREM_BEATS = round(1 / (SPB * shrew_hz), 6)  # 0.128 beats
shrew_chord, shrew_note = [], []
for b in DROPS:
    shrew_chord += [n(p, b * 4, 4.0, 0.95) for p in tones_from(58, tl["chords"][b % 4]["tones"], 3)]
    shrew_note.append(n(63, b * 4, 4.0, 1.0))  # D#4 = 19.5 Hz x 16
# dark riff in the drop, chord tones on the 8th/16th grid
RIFF = [(0, 0, 0.5), (0.75, 2, 0.25), (1, 1, 0.5), (1.5, 0, 0.5), (2.25, 2, 0.25), (2.5, 1, 0.5), (3, 2, 0.5), (3.5, 1, 0.5)]
riff = []
for b in DROPS:
    ts = tones_from(70, tl["chords"][b % 4]["tones"], 3)
    riff += [n(ts[i], b * 4 + off, d, 0.9 if off == 0 else 0.75) for off, i, d in RIFF]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.3, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.8, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)
trem = Tremolo(period_beats=TREM_BEATS, depth=0.9, shape="sine")

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Rumble", instrument="kick_909", gain=0.15, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Impact", instrument="kick_808", gain=0.55, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
    Track(name="Hats", instrument="metal_hat", gain=0.25, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.28, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.6), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=(DROP - 2) * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.85, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=10.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.2, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pad), release_seconds=0.6, effects=(space, side)),
    # the hearts
    Track(name="Heart monitor", instrument="sync_lead", gain=0.55, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(bleep),
          effects=(Distortion(drive=2.0, mix=0.3), echo, Ducker(trigger_beats=side.trigger_beats, depth=0.3, release_seconds=0.12))),
    Track(name="Heart stab", instrument="supersaw", gain=0.45, tone=Tone(brightness=0.7, cutoff_hz=3200, detune_cents=24), notes=tuple(stab),
          effects=(Distortion(drive=2.0, mix=0.3), big_space, side)),
    Track(name="Shrew chord", instrument="supersaw", gain=0.5, tone=Tone(brightness=0.7, cutoff_hz=3600, detune_cents=24), notes=tuple(shrew_chord),
          effects=(trem, Distortion(drive=3.0, mix=0.4), side)),
    Track(name="Shrew note", instrument="hoover", gain=0.42, tone=Tone(brightness=0.65, cutoff_hz=3800, detune_cents=18), notes=tuple(shrew_note),
          effects=(trem, Filter(mode="highpass", cutoff_hz=200), side)),
    Track(name="Drop riff", instrument="sync_lead", gain=0.55, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(riff),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
]

song = Song(title="How Fast Can a Heart Beat", bpm=float(BPM), beats=float(BEATS), seed=241, master_gain=0.8, tracks=tuple(tracks))


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
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks), "tremolo_beats": TREM_BEATS}, indent=2))


if __name__ == "__main__":
    main()
