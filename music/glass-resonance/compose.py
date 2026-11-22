"""Which note breaks this glass? Soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, A minor (Am, F, C, G; one chord per bar), 24 bars (38.4 s). One groove, one grid.
The house sound (docs/music-reference.md): four-on-the-floor dem with rumble, distorted reese wall in legato 16ths,
clap on 2 and 4, 16th hats, offbeat open hat, dense from the first frame.

Physics:
- The lead IS the speaker: the same notes that drive the glass in the simulation (timeline.json "probe").
- The glass's own voice is a held A5 (its natural frequency, 880 Hz) whose volume follows the simulated rim amplitude:
  it swells every time the melody lands on A5, climbs while the speaker holds A5 and gets louder (x4), and stops dead
  on the downbeat of bar 16, when the glass breaks.
- Every shard landing (slow motion x8) is a high chord tone, snapped to the nearest 16th: the glass rain in the drop.
Groove (not physics): the tuned "dem" kick four on the floor with rumble, clap on 2 and 4, 16th hats, offbeat open hat,
reese wall on the chord roots, pad, the hook again as a distorted lead in the drop, riser, snare roll, impact, rewind sweep.

Run from the repo root:  uv run --locked python music/glass-resonance/compose.py
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
PUBLIC = ROOT / "public" / "glass-resonance"

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM = tl["bpm"]
BARS = tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
FPB = tl["framesPerBeat"]
HOLD, DROP, REWIND = tl["holdBar"], tl["dropBar"], tl["rewindBar"]
INTRO, SEARCH, HOLDS, DROPS, REWINDS = range(0, 4), range(4, HOLD), range(HOLD, DROP), range(DROP, REWIND), range(REWIND, BARS)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


chord = lambda b: tl["chords"][b % 4]  # noqa: E731
KICK_ROOT = {9: 33, 5: 29, 0: 36, 7: 31}  # A1, F1, C2, G1: dem body 44-65 Hz


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


# ---------------------------------------------------------------- drums
kick, clap, hats, hat_open, roll, crash, impact = [], [], [], [], [], [], []
for b in range(BARS):
    t = b * 4
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue  # one beat of air before the glass goes
        kick.append((t + q, KICK_ROOT[chord(b)["root"]], 0.9, 1.0))
    if b not in INTRO:
        clap += [n(39, t + 1, 0.25, 0.8), n(39, t + 3, 0.25, 0.85)]
        hats += [n(42, t + s / 4, 0.06, (0.3, 0.45, 0.35, 0.5)[s % 4]) for s in range(16)]
    else:
        hats += [n(42, t + e / 2, 0.06, 0.35) for e in range(8)]
    hat_open += [n(46, t + q + 0.5, 0.22, 0.5 if b in DROPS else 0.38) for q in range(4)]
rb = (DROP - 1) * 4
roll += [n(38, rb + s / 4, 0.08, 0.3 + 0.65 * (s / 11) ** 2) for s in range(12)]
crash += [n(51, 0, 3, 0.7), n(51, 4 * 4, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, (DROP + 4) * 4, 3, 0.6)]
impact += [n(33, DROP * 4, 2.0, 1.0)]
riser = [n(p, (HOLD + 2) * 4, 7.9, 0.75) for p in (57, 64, 69)]
rewind_sweep = [n(p, REWIND * 4, 7.8, 0.7) for p in (81, 76)]

# ---------------------------------------------------------------- bass and harmony
grit, rumble = [], []
for b in range(BARS):
    root = KICK_ROOT[chord(b)["root"]] + 12
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue
        grit += [n(root, b * 4 + q + s / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s]) for s in range(4)]
for k, *_ in kick:
    rumble.append(n(33, k, 0.9, 0.85))
PAD = {"Am": [57, 60, 64, 69], "F": [53, 57, 60, 65], "C": [55, 60, 64, 67], "G": [55, 59, 62, 67]}
pad = []
for b in range(BARS):
    pad += [n(p, b * 4, 3.95, 0.5) for p in PAD[chord(b)["name"]]]
# ---------------------------------------------------------------- the speaker (the lead) and the glass
lead = [n(p["midi"], p["beat"], p["dur"] * 0.95, 0.9) for p in tl["probe"]]
hold_notes = [n(p["midi"], p["beat"], p["dur"] * 0.95, 0.9) for p in tl["probe"] if p["beat"] >= HOLD * 4]
# drive x1 for the melody, rising to x4 while the speaker holds A5. The speaker's level is 0.5 x drive, split over two
# identical tracks (a track's gain stops at 1): the main one carries up to drive 2, the second one adds the rest.
# x1 sits level with the hook of the mix (scripts/analyze_stems.py); x4 is 12 dB above it.
lead_gain, boost_gain = [AutomationPoint(beat=0.0, value=0.5)], [AutomationPoint(beat=HOLD * 4.0 - 0.01, value=0.0)]
for p in tl["probe"]:
    if p["beat"] >= HOLD * 4:
        lead_gain.append(AutomationPoint(beat=float(p["beat"]), value=round(min(1.0, 0.5 * p["drive"]), 4)))
        boost_gain.append(AutomationPoint(beat=float(p["beat"]), value=round(max(0.0, 0.5 * p["drive"] - 1.0), 4)))
lead_gain += [AutomationPoint(beat=DROP * 4 - 0.01, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0)]
boost_gain += [AutomationPoint(beat=DROP * 4 - 0.01, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0)]
# the hook comes back in the drop on a supersaw: the tune that broke the glass
drop_lead = []
for b in DROPS:
    src = [p for p in tl["probe"] if (b % 4) * 4 <= p["beat"] < (b % 4) * 4 + 4]
    drop_lead += [n(p["midi"], b * 4 + (p["beat"] - (b % 4) * 4), p["dur"] * 0.9, 0.85) for p in src]
# the glass's voice: A5 held until it breaks, its volume = the simulated rim amplitude
amp = [fr["amp"] for fr in tl["frames"]]
brk = tl["breakAmp"]
glass = [n(81, b * 4, 4.0, 1.0) for b in range(DROP)]
glass_hi = [n(93, b * 4, 4.0, 0.6) for b in range(DROP)]
gpts = []
for f in range(0, DROP * 4 * FPB, 2):
    gpts.append(AutomationPoint(beat=round(f / FPB, 4), value=round(min(1.0, (amp[f] / brk) ** 0.6), 4)))
gpts += [AutomationPoint(beat=DROP * 4 - 0.01, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0)]
glass_gain = Automation(parameter="gain", points=tuple(gpts))
# shards landing: glass rain on the 16th grid (several shards on one 16th become one louder note)
rain = {}
for ld in tl["landings"]:
    key = (ld["snappedBeat"], ld["pitch"])
    rain[key] = min(1.0, rain.get(key, 0) + (0.35 if ld["second"] else 0.6))
rain_notes = [n(p, beat, 0.4, v) for (beat, p), v in sorted(rain.items())]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick), depth=0.3, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.8, mix=0.24)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)

tracks = [
    *dem_tracks(kick),
    Track(name="Impact", instrument="kick_808", gain=0.55, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Clap", instrument="clap", gain=0.6, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.8, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.26, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.7), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.26, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Riser", instrument="supersaw", gain=0.12, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=(HOLD + 2) * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Rewind sweep", instrument="supersaw", gain=0.2, tone=Tone(brightness=0.6, glide_semitones=12, glide_seconds=2.0, detune_cents=25), notes=tuple(rewind_sweep),
          effects=(Filter(mode="highpass", cutoff_hz=500), space)),
    Track(name="Rumble", instrument="kick_909", gain=0.15, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.35, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=4.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.2, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=14), notes=tuple(pad), release_seconds=0.5, effects=(space, side)),
    # the speaker
    Track(name="Speaker lead", instrument="sync_lead", gain=1.0, tone=Tone(brightness=0.6, cutoff_hz=4200), notes=tuple(lead),
          effects=(Distortion(drive=2.0, mix=0.3), echo, space), automation=(Automation(parameter="gain", points=tuple(lead_gain)),)),
    Track(name="Speaker lead (x2 to x4)", instrument="sync_lead", gain=1.0, tone=Tone(brightness=0.6, cutoff_hz=4200), notes=tuple(hold_notes),
          effects=(Distortion(drive=2.0, mix=0.3), echo, space), automation=(Automation(parameter="gain", points=tuple(boost_gain)),)),
    Track(name="Drop lead", instrument="sync_lead", gain=0.6, pan=0.05, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(drop_lead),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, side)),
    # the glass
    Track(name="Glass A5", instrument="sine", gain=0.55, notes=tuple(glass), effects=(Reverb(decay_seconds=2.0, mix=0.2),), automation=(glass_gain,)),
    Track(name="Glass A6", instrument="triangle", gain=0.22, notes=tuple(glass_hi), automation=(glass_gain,)),
    Track(name="Glass rain", instrument="glockenspiel", gain=0.5, tone=Tone(brightness=0.8, decay_seconds=1.2), notes=tuple(rain_notes), effects=(echo, big_space)),
]

song = Song(title="Which Note Breaks This Glass", bpm=float(BPM), beats=float(BEATS), seed=880, master_gain=0.8, tracks=tuple(tracks))


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
