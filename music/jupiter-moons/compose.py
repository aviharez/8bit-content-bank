"""Jupiter's moons, 1:2:4: soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, A minor, 24 bars (38.4 s). One groove, one grid.

Groove (not physics): a tuned four-on-the-floor kick (the deep "dem", F1) with rumble, a distorted reese line above it (F, E, D), clap on 2 and 4,
16th hats, offbeat open hat, dark pad, riser and roll into the drop.

Physics: the moons write the riff. One Europa-Ganymede cycle (7.05 days) = 6 beats, so every conjunction
lands on the 8th-note grid, and the 6-beat riff turns against the 4-beat bar (a polymeter):
  Europa-Ganymede (1 per cycle, beat 0)        -> A  (root, low)
  Io-Ganymede     (3 per cycle, beats 1, 3, 5) -> E
  Io-Europa       (2 per cycle, beats 1.5, 4.5)-> C
Together the three moons spell an A minor chord.
The last 4 bars are the intro texture, so the loop runs on.

Run from the repo root:  uv run --locked python music/jupiter-moons/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "jupiter-moons"

BPM = 150
BARS = 24
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
events = tl["events"]


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


INTRO, GROOVE, BREAK, BUILD, DROP, OUTRO = range(0, 4), range(4, 12), range(12, 14), range(14, 16), range(16, 20), range(20, 24)
KICK_BARS = set(INTRO) | set(GROOVE) | set(BUILD) | set(DROP) | set(OUTRO)
FULL = set(GROOVE) | set(DROP)
bar_of = lambda beat: int(beat // 4)  # noqa: E731

# ---------------------------------------------------------------- groove
kick, rumble, clap, hat16, hat_open, sub, grit, roll, crash = [], [], [], [], [], [], [], [], []
# bass line by bar (8-bar cycle): F, F, E, E, F, F, D, E  (F1 = 29, E1 = 28, D1 = 26), dark half-step moves like the reference
BASS_LINE = [29, 29, 28, 28, 29, 29, 26, 28]
for b in range(BARS):
    t = b * 4
    if b in KICK_BARS:
        for q in range(4):
            if b == 15 and q == 3:
                continue  # one beat of air before the drop
            kick.append(n(33, t + q, 0.9, 1.0))  # long note: the tuned tail rings for most of the beat ("dem")
            rumble.append(n(33, t + q, 0.9, 0.9))
    if b in FULL or b in BUILD:
        clap += [n(39, t + 1, 0.25, 0.85), n(39, t + 3, 0.25, 0.9)]
    if b in FULL:
        hat16 += [n(42, t + s / 4, 0.06, 0.55 if s % 4 == 2 else 0.32) for s in range(16)]
    if b in KICK_BARS:
        hat_open += [n(46, t + q + 0.5, 0.22, 0.55 if b in FULL else 0.4) for q in range(4)]
    # bass wall: legato 16ths, loudest on the offbeat, never silent (the reference's low end never drops below ~70%)
    root = BASS_LINE[b % 8] if b not in BREAK else 26  # D in the breakdown
    for q in range(4):
        for s16 in range(4):
            v = (0.62, 0.8, 1.0, 0.82)[s16] * (0.8 if b in INTRO or b in OUTRO else 1.0)
            sub.append(n(root, t + q + s16 / 4, 0.25, v))
            if b not in BREAK:
                grit.append(n(root + 12, t + q + s16 / 4, 0.24, v))
roll += [n(38, 15 * 4 + s / 4, 0.1, 0.3 + 0.65 * (s / 15) ** 2) for s in range(16)]
crash += [n(51, 4 * 4, 3, 0.6), n(51, 16 * 4, 4, 0.85)]
riser = [n(p, 14 * 4, 7.9, 0.7) for p in (45, 52, 57)]

# dark pad follows the bass: Fmaj7 over F (contains the moons' A, C, E), Em over E, Dm over D
PAD = {29: [53, 57, 60, 64], 28: [52, 55, 59, 64], 26: [50, 53, 57, 62]}
pad = []
for b in range(BARS):
    root = BASS_LINE[b % 8] if b not in BREAK else 26
    pad += [n(p, b * 4, 3.95, 0.45) for p in PAD[root]]

# ---------------------------------------------------------------- the moons' riff
NOTE = {"EG": 57, "IG": 64, "IE": 60}  # A3, E4, C4
LEN = {"EG": 0.45, "IG": 0.3, "IE": 0.3}
riff_main, riff_low, riff_dark = [], [], []
for e in events:
    beat = e["beat"]
    b = bar_of(beat)
    p = NOTE[e["pair"]]
    accent = 1.0 if e["pair"] == "EG" else 0.85
    if b in FULL or b in BREAK or b in BUILD:
        riff_main.append(n(p, beat, LEN[e["pair"]], accent))
        if b in DROP:
            riff_main.append(n(p + 12, beat, LEN[e["pair"]], accent * 0.7))
        if e["pair"] == "EG":
            riff_low.append(n(45, beat, 0.9, 1.0))
    else:  # intro / outro: the same riff, filtered and quieter
        riff_dark.append(n(p, beat, LEN[e["pair"]], accent * 0.75))

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(x.start for x in kick), depth=0.45, attack_seconds=0.002, release_seconds=0.18)
space = Reverb(decay_seconds=1.8, mix=0.22)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.4, repeats=5, mix=0.25)

tracks = [
    # the "dem": a tuned kick at about F1 (43 Hz, sweeping down from ~65 Hz), distorted so its tail rings ~300 ms,
    # like the reference (59 -> 43 Hz, -6 dB at 325 ms). It carries the low end, so there is no separate sub.
    Track(name="Kick (dem)", instrument="kick_909", gain=0.85, tone=Tone(decay_seconds=2.0, tuning_semitones=-3.5, brightness=0.75),
          notes=tuple(kick), effects=(Distortion(drive=12.0, mix=0.9), Filter(mode="highpass", cutoff_hz=36))),
    Track(name="Rumble", instrument="kick_909", gain=0.28, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
    Track(name="Hat 16ths", instrument="metal_hat", gain=0.26, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hat16)),
    Track(name="Hat open", instrument="open_hat", gain=0.3, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.45, tone=Tone(brightness=0.6), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Riser", instrument="supersaw", gain=0.2, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=500), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=56.0, value=0.0), AutomationPoint(beat=63.9, value=1.0), AutomationPoint(beat=64.0, value=0.0))),)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.85, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=10.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.26, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pad), release_seconds=0.6, effects=(space, side)),
    # the moons
    Track(name="Moon riff", instrument="sync_lead", gain=0.75, tone=Tone(brightness=0.6, cutoff_hz=4500),
          notes=tuple(riff_main), effects=(Distortion(drive=3.0, mix=0.4), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
    Track(name="Moon riff body", instrument="hoover", gain=0.3, pan=-0.1, tone=Tone(brightness=0.6, cutoff_hz=4000, detune_cents=12),
          notes=tuple(riff_main), effects=(Filter(mode="highpass", cutoff_hz=250), echo, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
    Track(name="Moon riff (filtered)", instrument="sync_lead", gain=0.5, tone=Tone(brightness=0.4, cutoff_hz=1400),
          notes=tuple(riff_dark), effects=(echo, space)),
]

song = Song(title="Jupiter's Moons 1:2:4", bpm=float(BPM), beats=float(BEATS), seed=124, master_gain=0.8, tracks=tuple(tracks))


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
