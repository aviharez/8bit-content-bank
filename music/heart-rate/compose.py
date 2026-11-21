"""How fast can a heart beat? Soundtrack, composed with Audio as Code.

Drum and bass, 180 BPM, D# minor (D#m, B, F#, C#; one chord per bar), 24 bars (32 s). One groove, one grid.
Dense from the first frame: the groove and the riff start at 0 s; the drop is where the heart turns into a note.

Groove (not physics): the tuned "dem" kick in a two-step (1 and the "and" of 3), snare on 2 and 4, ghost snares, 16th hats,
a rolling reese bass on the chord roots locked to the kick, a 16th pluck arpeggio, a lead hook, pad, riser, snare roll.

Physics: every heartbeat the scaling law predicts (241 x M^-1/4 per minute) is a chord stab, in real time, snapped to the
nearest 16th (timeline.json): the whale gets one huge stab, the mouse almost every 16th. The Etruscan shrew's heart
(1,170 per minute = 19.5 Hz) is faster than the 16th grid, so its stabs merge into one held chord whose volume pulses at
exactly 19.5 Hz (tremolo), topped by D#4 (19.5 Hz x 16 = 312 Hz). That chord is the drop.

Run from the repo root:  uv run --locked python music/heart-rate/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, Tremolo, export_midi, render,
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
INTRO, GROOVE, BUILD, DROPS, OUTROS = range(0, 4), range(4, 8), range(8, DROP), range(DROP, OUTRO), range(OUTRO, BARS)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


bar_of = lambda beat: int(beat // 4)  # noqa: E731
chord_of = lambda beat: tl["chords"][bar_of(beat) % 4]  # noqa: E731
KICK_ROOT = {3: 27, 11: 35, 6: 30, 1: 37}  # dem body between 39 and 70 Hz: D#1, B1, F#1, C#2


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


# ---------------------------------------------------------------- drums from the timeline
kicks = sorted(tl["kicks"])
kick_notes = []
for i, k in enumerate(kicks):
    nxt = kicks[i + 1] if i + 1 < len(kicks) else BEATS
    kick_notes.append((k, KICK_ROOT[chord_of(k)["root"]], min(0.95, nxt - k), 1.0))

snare, clap, hats, hat_open, roll, crash, ghost, impact = [], [], [], [], [], [], [], []
for s in tl["snares"]:
    snare.append(n(38, s, 0.3, 0.95))
    if bar_of(s) in DROPS:
        clap.append(n(39, s, 0.25, 0.75))
for b in range(BARS):
    t = b * 4
    if b == DROP - 1:
        continue
    hats += [n(42, t + s / 4, 0.06, (0.32, 0.5, 0.38, 0.58)[s % 4]) for s in range(16)]
    hat_open += [n(46, t + 1.5, 0.3, 0.45), n(46, t + 3.5, 0.3, 0.45)]
    ghost += [n(38, t + 1.75, 0.1, 0.3), n(38, t + 2.75, 0.1, 0.22), n(38, t + 3.25, 0.1, 0.26)]  # rolling DnB ghosts, same grid
    if b % 4 == 3:  # a fill every 4th bar
        ghost += [n(38, t + 3.5, 0.08, 0.5), n(38, t + 3.75, 0.08, 0.65)]
rb = (DROP - 1) * 4  # bar 11: the roll into the drop, 8ths then 16ths, getting louder
roll += [n(38, rb + e / 2, 0.1, 0.3 + 0.05 * e) for e in range(4)]
roll += [n(38, rb + 2 + s / 4, 0.08, 0.5 + 0.5 * (s / 7)) for s in range(8)]
crash += [n(51, 0, 4, 0.8), n(51, 4 * 4, 3, 0.5), n(51, 8 * 4, 3, 0.55), n(51, DROP * 4, 4, 0.95), n(51, (DROP + 4) * 4, 3, 0.6), n(51, OUTRO * 4, 3, 0.5)]
impact += [n(33, 0, 2.0, 1.0), n(33, DROP * 4, 2.0, 1.0)]  # deep boom under the whale's beat and the drop
riser = [n(p, (DROP - 2) * 4, 7.9, 0.75) for p in (51, 58, 63)]

# ---------------------------------------------------------------- bass: chord roots locked to the kick, rolling 8ths in between
bass = []
for k, root, dur, _ in kick_notes:
    bass.append(n(root + 12, k, max(0.4, min(dur, 1.4) - 0.05), 1.0))
for b in range(BARS):
    if b == DROP - 1:
        continue
    root = KICK_ROOT[tl["chords"][b % 4]["root"]] + 12
    t = b * 4
    # the roll between kicks: root and its octave on offbeat 8ths (the kick keeps the downbeats)
    bass += [n(root + 12, t + 1.5, 0.4, 0.7), n(root, t + 2.0, 0.4, 0.6), n(root + 12, t + 3.5, 0.4, 0.75)]

# pad: the chord, every bar
PAD = {"D#m": [51, 54, 58, 63], "B": [47, 51, 54, 59], "F#": [49, 54, 58, 61], "C#": [49, 53, 56, 61]}
pad = []
for b in range(BARS):
    pad += [n(p, b * 4, 3.95, 0.5) for p in PAD[tl["chords"][b % 4]["name"]]]

# 16th pluck arpeggio, up and down the chord: the motor of the track from 0 s
arp = []
for b in range(BARS):
    if b in DROPS:
        continue  # the shrew's chord owns the drop
    ts = tones_from(63, tl["chords"][b % 4]["tones"], 4)
    order = [0, 1, 2, 3, 2, 1, 2, 3]
    arp += [n(ts[order[s % 8]], b * 4 + s / 4, 0.22, 0.55 if s % 4 == 0 else 0.4) for s in range(16)]

# lead hook: one-bar phrases on the chord tones (8th grid), from bar 4; doubled an octave up in the drop
HOOK = {
    "D#m": [(0, 78, 0.5), (0.5, 75, 0.5), (1, 70, 0.5), (1.5, 75, 0.5), (2.5, 78, 0.5), (3, 80, 0.25), (3.25, 78, 0.25), (3.5, 75, 0.5)],
    "B": [(0, 78, 0.5), (0.5, 75, 0.5), (1, 71, 0.5), (1.5, 75, 0.5), (2.5, 78, 0.5), (3, 75, 0.5), (3.5, 73, 0.5)],
    "F#": [(0, 73, 0.5), (0.5, 70, 0.5), (1, 66, 0.5), (1.5, 70, 0.5), (2.5, 73, 0.5), (3, 75, 0.5), (3.5, 73, 0.5)],
    "C#": [(0, 77, 0.5), (0.5, 73, 0.5), (1, 68, 0.5), (1.5, 73, 0.5), (2.5, 77, 0.5), (3, 80, 0.5), (3.5, 77, 0.5)],
}
hook, hook_hi = [], []
for b in range(BARS):
    if b in INTRO or b == DROP - 1:
        continue
    for off, p, d in HOOK[tl["chords"][b % 4]["name"]]:
        v = 0.9 if off == 0 else 0.75
        hook.append(n(p, b * 4 + off, d, v * (0.8 if b in OUTROS else 1.0)))
        if b in DROPS:
            hook_hi.append(n(p + 12, b * 4 + off, d, v * 0.7))

# ---------------------------------------------------------------- the hearts: every predicted heartbeat is a chord stab
LEN = {"whale": 3.0, "elephant": 1.5, "human": 0.5, "cat": 0.35, "rabbit": 0.3, "mouse": 0.2}
stab, stab_top = [], []
for hb in tl["beats"]:
    if hb["pitch"] is None:
        continue
    beat = hb["snappedBeat"]
    dur = LEN[hb["animal"]]
    for p in tones_from(58, chord_of(beat)["tones"], 3):
        stab.append(n(p, beat, dur, 0.95))
    stab_top.append(n(hb["pitch"] + 12, beat, min(dur, 0.25), 0.8))

# the shrew: 19.5 heartbeats a second, too fast for the grid, so the stabs merge into one chord whose volume pulses at the
# heart rate. Tremolo period in beats at 180 BPM: 1 / ((60/180) * 19.5) = 1/6.5
shrew_hz = next(a for a in tl["animals"] if a["id"] == "shrew")["hz"]
TREM_BEATS = round(1 / (SPB * shrew_hz), 6)
shrew_chord, shrew_note = [], []
for b in DROPS:
    shrew_chord += [n(p, b * 4, 4.0, 0.95) for p in tones_from(58, tl["chords"][b % 4]["tones"], 3)]
    shrew_note.append(n(63, b * 4, 4.0, 1.0))  # D#4 = 19.5 Hz x 16

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.4, attack_seconds=0.002, release_seconds=0.14)
bass_duck = Ducker(trigger_beats=side.trigger_beats, depth=0.6, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.6, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)
trem = Tremolo(period_beats=TREM_BEATS, depth=0.9, shape="sine")
# the intro opens up: arp and pad reach full level at bar 4
open_up = Automation(parameter="gain", points=(AutomationPoint(beat=0.0, value=0.55), AutomationPoint(beat=16.0, value=1.0), AutomationPoint(beat=float(BEATS), value=1.0)))

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Impact", instrument="kick_808", gain=0.5, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Snare", instrument="electronic_snare", gain=0.66, tone=Tone(brightness=0.8), notes=tuple(snare), effects=(Reverb(decay_seconds=0.9, mix=0.18),)),
    Track(name="Clap", instrument="clap", gain=0.4, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Ghost snare", instrument="electronic_snare", gain=0.38, tone=Tone(brightness=0.65), notes=tuple(ghost)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.8, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.22, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.55, tone=Tone(brightness=0.7), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.26, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Riser", instrument="supersaw", gain=0.24, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=(DROP - 2) * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Reese", instrument="reese_bass", gain=0.55, tone=Tone(brightness=0.75, cutoff_hz=1900, resonance=0.4, detune_cents=22),
          notes=tuple(bass), effects=(Distortion(drive=9.0, mix=0.75), Filter(mode="highpass", cutoff_hz=90), bass_duck)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.2, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=14), notes=tuple(pad), release_seconds=0.5,
          effects=(space, side), automation=(open_up,)),
    Track(name="Arp", instrument="trance_pluck", gain=0.34, pan=-0.1, tone=Tone(brightness=0.6, cutoff_hz=1600, resonance=0.35, decay_seconds=0.4), notes=tuple(arp),
          effects=(echo, side), automation=(open_up,)),
    Track(name="Hook", instrument="sync_lead", gain=0.5, tone=Tone(brightness=0.65, cutoff_hz=4200), notes=tuple(hook),
          effects=(Distortion(drive=2.5, mix=0.35), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.3, release_seconds=0.12))),
    Track(name="Hook octave", instrument="supersaw", gain=0.3, pan=0.1, tone=Tone(brightness=0.6, cutoff_hz=5000, detune_cents=20), notes=tuple(hook_hi),
          effects=(echo, space)),
    # the hearts
    Track(name="Heart stab", instrument="supersaw", gain=0.5, tone=Tone(brightness=0.7, cutoff_hz=3200, detune_cents=24), notes=tuple(stab),
          effects=(Distortion(drive=2.0, mix=0.3), big_space, side)),
    Track(name="Heart stab top", instrument="fm_bell", gain=0.32, tone=Tone(decay_seconds=0.5, fm_index=1.8, fm_ratio=2.0), notes=tuple(stab_top), effects=(echo,)),
    Track(name="Shrew chord", instrument="supersaw", gain=0.5, tone=Tone(brightness=0.7, cutoff_hz=3600, detune_cents=24), notes=tuple(shrew_chord),
          effects=(trem, Distortion(drive=3.0, mix=0.4), side)),
    Track(name="Shrew note", instrument="hoover", gain=0.42, tone=Tone(brightness=0.65, cutoff_hz=3800, detune_cents=18), notes=tuple(shrew_note),
          effects=(trem, Filter(mode="highpass", cutoff_hz=200), side)),
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
