"""How fast can a heart beat? Soundtrack, composed with Audio as Code.

Drum and bass, 180 BPM, D# minor (D#m, B, F#, C#; one chord per bar), 24 bars (32 s). One groove, one grid.

Groove (not physics): the tuned "dem" kick in a two-step (1 and the "and" of 3), snare on 2 and 4, hats, a reese bass on the
chord roots locked to the kick, pad, riser, snare roll into the drop, a supersaw hook in the drop.

Physics: every heartbeat the scaling law predicts (241 x M^-1/4 per minute) is a monitor beep, in real time, snapped to the
nearest 16th (timeline.json). Each beep is the next note of the current chord's arpeggio, higher for smaller animals.
The Etruscan shrew's heart (1,170 per minute = 19.5 Hz) is faster than the 16th grid: it becomes a held D#4, whose
volume pulses at exactly 19.5 Hz (tremolo), pitched 4 octaves up (19.5 x 16 = 312 Hz = D#4). That is the drop.

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
# kick roots, chosen to keep the dem body between 39 and 70 Hz: D#1, B1, F#1, C#2
KICK_ROOT = {3: 27, 11: 35, 6: 30, 1: 37}
root_kick = lambda beat: KICK_ROOT[chord_of(beat)["root"]]  # noqa: E731

# ---------------------------------------------------------------- drums from the timeline
kicks = sorted(tl["kicks"])
kick_notes = []
for i, k in enumerate(kicks):
    nxt = kicks[i + 1] if i + 1 < len(kicks) else BEATS
    b = bar_of(k)
    vel = 0.85 if b in INTRO or b in OUTROS else 1.0
    kick_notes.append((k, root_kick(k), min(0.95, nxt - k), vel))

snare, clap, hats, hat_open, roll, crash, ghost = [], [], [], [], [], [], []
for s in tl["snares"]:
    b = bar_of(s)
    snare.append(n(38, s, 0.3, 0.95 if b in DROPS else 0.8))
    if b in DROPS:
        clap.append(n(39, s, 0.25, 0.7))
for b in range(BARS):
    t = b * 4
    if b in INTRO or b in OUTROS:
        hats += [n(42, t + q + 0.5, 0.08, 0.32) for q in range(4)]
    elif b in GROOVE:
        hats += [n(42, t + e / 2, 0.08, 0.45 if e % 2 else 0.3) for e in range(8)]
    else:
        hats += [n(42, t + s / 4, 0.06, (0.3, 0.5, 0.36, 0.55)[s % 4]) for s in range(16)]
    if b in DROPS:
        hat_open += [n(46, t + 1.5, 0.3, 0.5), n(46, t + 3.5, 0.3, 0.5)]
        ghost += [n(38, t + 1.75, 0.1, 0.28), n(38, t + 3.25, 0.1, 0.25)]  # DnB ghost notes on the same 16th grid
# snare roll into the drop (bar 11): 8ths, then 16ths, getting louder
rb = (DROP - 1) * 4
roll += [n(38, rb + 2 + e / 2, 0.1, 0.35) for e in range(2)]
roll += [n(38, rb + 3 + s / 4, 0.08, 0.45 + 0.5 * (s / 3)) for s in range(4)]
crash += [n(51, DROP * 4, 4, 0.9), n(51, (DROP + 4) * 4, 3, 0.6), n(51, 4 * 4, 3, 0.5)]
riser = [n(p, (DROP - 2) * 4, 7.9, 0.7) for p in (51, 58, 63)]

# ---------------------------------------------------------------- bass: chord roots an octave above the kick, on the kick's rhythm
bass = []
for k, root, dur, vel in kick_notes:
    b = bar_of(k)
    v = 0.6 if b in INTRO or b in OUTROS else (1.0 if b in DROPS else 0.85)
    bass.append(n(root + 12, k, max(0.4, dur - 0.05), v))

# pad: the chord, every bar
PAD = {"D#m": [51, 54, 58, 63], "B": [47, 51, 54, 59], "F#": [49, 54, 58, 61], "C#": [49, 53, 56, 61]}
pad = []
for b in range(BARS):
    pad += [n(p, b * 4, 3.95, 0.4 if b in INTRO or b in OUTROS else 0.5) for p in PAD[tl["chords"][b % 4]["name"]]]

# ---------------------------------------------------------------- the hearts
LEN = {"whale": 1.5, "elephant": 1.2, "human": 0.6, "cat": 0.4, "rabbit": 0.3, "mouse": 0.2}
beep, beep_body = [], []
for hb in tl["beats"]:
    if hb["pitch"] is None:
        continue
    beat = hb["snappedBeat"]
    dur = LEN[hb["animal"]]
    beep.append(n(hb["pitch"], beat, dur, 0.9))
    beep_body.append(n(hb["pitch"] + 12, beat, min(dur, 0.25), 0.6))

# the shrew: 19.5 heartbeats a second, too fast for the grid, so it is a note. D#4 (312 Hz = 19.5 Hz x 16), held over the
# drop; its volume pulses at the heart rate itself. The tremolo period, in beats at 180 BPM: (60/180) * 19.5 Hz -> 1/6.5
shrew_hz = next(a for a in tl["animals"] if a["id"] == "shrew")["hz"]
TREM_BEATS = round(1 / (SPB * shrew_hz), 6)
shrew = [n(63, b * 4, 4.0, 0.95) for b in DROPS]
shrew_oct = [n(75, b * 4, 4.0, 0.6) for b in DROPS]

# supersaw hook in the drop: chord tones, 8th/16th grid, answers the shrew note
HOOK_RHYTHM = [(0, 0, 0.5), (0.75, 2, 0.5), (1.5, 1, 0.5), (2.5, 0, 0.5), (3, 2, 0.25), (3.5, 1, 0.5)]


def chord_tones_from(register, tones):
    out = []
    m = register
    while len(out) < 3:
        if m % 12 in tones:
            out.append(m)
        m += 1
    return out


hook = []
for b in DROPS:
    tones = chord_tones_from(70, tl["chords"][b % 4]["tones"])
    rhythm = HOOK_RHYTHM if b % 2 == 0 else HOOK_RHYTHM[:4] + [(3.0, 1, 0.5), (3.5, 2, 0.5)]
    hook += [n(tones[i], b * 4 + off, dur, 0.85 if off == 0 else 0.72) for off, i, dur in rhythm]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.4, attack_seconds=0.002, release_seconds=0.14)
# drum and bass: the kick punches through the reese, so the bass ducks harder than the rest
bass_duck = Ducker(trigger_beats=side.trigger_beats, depth=0.65, attack_seconds=0.002, release_seconds=0.16)
space = Reverb(decay_seconds=1.6, mix=0.22)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)
groove_gain = Automation(parameter="gain", points=(
    AutomationPoint(beat=0.0, value=0.55), AutomationPoint(beat=15.9, value=0.55), AutomationPoint(beat=16.0, value=1.0),
    AutomationPoint(beat=OUTRO * 4 - 0.1, value=1.0), AutomationPoint(beat=OUTRO * 4, value=0.55), AutomationPoint(beat=float(BEATS), value=0.55)))

tracks = [
    # the "dem": the shared tuned kick on each chord's root, plus its top layer for phone speakers
    *dem_tracks(kick_notes),
    Track(name="Snare", instrument="electronic_snare", gain=0.62, tone=Tone(brightness=0.75), notes=tuple(snare), effects=(Reverb(decay_seconds=0.9, mix=0.18),)),
    Track(name="Clap", instrument="clap", gain=0.4, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Ghost snare", instrument="electronic_snare", gain=0.35, tone=Tone(brightness=0.6), notes=tuple(ghost)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.8, decay_seconds=0.1), notes=tuple(hats), automation=(groove_gain,)),
    Track(name="Hat open", instrument="open_hat", gain=0.24, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.65), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.24, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=(DROP - 2) * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Reese", instrument="reese_bass", gain=0.6, tone=Tone(brightness=0.7, cutoff_hz=1700, resonance=0.35, detune_cents=20),
          notes=tuple(bass), effects=(Distortion(drive=8.0, mix=0.7), Filter(mode="highpass", cutoff_hz=90), bass_duck)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.22, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=14), notes=tuple(pad), release_seconds=0.5,
          effects=(space, side)),
    # the hearts
    Track(name="Heart beep", instrument="triangle", gain=0.55, notes=tuple(beep), effects=(echo, space)),
    Track(name="Heart beep body", instrument="fm_bell", gain=0.3, tone=Tone(decay_seconds=0.4, fm_index=1.5, fm_ratio=2.0), notes=tuple(beep_body)),
    Track(name="Shrew heart", instrument="sync_lead", gain=0.62, tone=Tone(brightness=0.6, cutoff_hz=3800),
          notes=tuple(shrew), effects=(Tremolo(period_beats=TREM_BEATS, depth=0.85, shape="sine"), Distortion(drive=2.5, mix=0.35), side)),
    Track(name="Shrew heart octave", instrument="triangle", gain=0.3, notes=tuple(shrew_oct),
          effects=(Tremolo(period_beats=TREM_BEATS, depth=0.85, shape="sine"),)),
    Track(name="Hook", instrument="supersaw", gain=0.42, tone=Tone(brightness=0.65, cutoff_hz=4200, detune_cents=20), notes=tuple(hook),
          effects=(Distortion(drive=2.0, mix=0.3), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
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
