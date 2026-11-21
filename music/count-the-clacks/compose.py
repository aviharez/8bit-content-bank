"""Count the Clacks: soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, A minor, 16 bars (25.6 s), 30 fps (12 frames per beat). One groove, one grid.

Groove (not physics): the channel's hard-techno groove (music/_shared/hard_techno.py): the tuned "dem" kick,
a distorted reese wall on F-E-D, clap on 2 and 4, 16th hats, offbeat open hat, dark pad, roll and riser.

Physics: every clack is a hit you see, playing notes of one chord (A minor: A, C, E).
  level 1 (1:1, 3 clacks)        -> on beats 1, 2, 3 of bar 4: A, E, C
  level 2 (1:100, 31 clacks)     -> time-warped onto the 32nd grid; the notes climb the A minor chord
  level 3 (1:10,000, 314 clacks) -> time-warped roll; clacks that fall in the same 32nd share one hit,
                                    so the roll stays on the grid while it accelerates
  outro                          -> the digits of pi as A minor chord tones, one per 8th
The last 2 bars are the intro texture (soft groove + filtered riff), so the loop runs on.

Run from the repo root:  uv run --locked python music/count-the-clacks/compose.py
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import Delay, Distortion, Ducker, Filter, Reverb, Song, Tone, Track, export_midi, render  # noqa: E402
from hard_techno import bass_wall, claps, groove_tracks, hats16, kick, n, open_hats, pad, roll  # noqa: E402
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "count-the-clacks"

BPM = 150
BARS = 16
BEATS = BARS * 4
SPB = 60 / BPM

timeline = json.loads((PUBLIC / "timeline.json").read_text())
assert timeline["bpm"] == BPM, "re-run sims/count-the-clacks.ts"
events = timeline["audioEvents"]

INTRO, L1, L2, BUILD, DROP, OUTRO = range(0, 2), range(2, 4), range(4, 8), range(8, 9), range(9, 14), range(14, 16)
SOFT = set(INTRO) | set(OUTRO)
SQUEEZE = range(9, 13)  # level 3's roll: the groove steps back so the clacks stay on top

# ---------------------------------------------------------------- groove
BASS_LINE = [29, 29, 28, 28, 29, 29, 26, 28]  # F, F, E, E, F, F, D, E (F1 = 29)
root = lambda b: BASS_LINE[b % 8]  # noqa: E731
PADS = {29: [53, 57, 60, 64], 28: [52, 55, 59, 64], 26: [50, 53, 57, 62]}  # Fmaj7, Em, Dm: all hold A, C or E

kicks, clap, hat16, hat_open = [], [], [], []
for b in range(BARS):
    for q in range(4):
        if b == 8 and q == 3:
            continue  # one beat of air before the drop
        kicks.append(kick(b * 4 + q))
    if b in L2 or b in BUILD or b in DROP:
        clap += claps(b)
    if b in L2 or b in DROP:
        hat16 += hats16(b, 0.45 if b in SQUEEZE else 1.0)
    hat_open += open_hats(b, 0.55 if b in L2 or b in DROP else 0.4)
grit = bass_wall(root, range(BARS), soft_bars=SOFT)
pads = pad(root, PADS, range(BARS))
riser = [n(p, 8 * 4, 3.9, 0.7) for p in (45, 52, 57)]
groove, side = groove_tracks(kicks=kicks, clap=clap, hat16=hat16, hat_open=hat_open, grit=grit, pads=pads,
                             rolls=roll(8), crashes=[n(51, 4 * 4, 3, 0.6), n(51, 13 * 4, 4, 0.85)],
                             riser=riser, riser_span=(32.0, 36.0), kick_gain=0.7, grit_gain=0.7)

# ---------------------------------------------------------------- the clacks
AM = [45, 48, 52, 57, 60, 64, 69, 72, 76, 81, 84, 88, 93]  # A minor chord tones, A2 to A6
hits_wall, hits_block, bell, pluck_wall, pluck_block, roll_wall, roll_block = [], [], [], [], [], [], []
l3_slots = defaultdict(list)
for e in events:
    beat = e["sec"] / SPB
    wall = e["type"] == "wall"
    if e["level"] == 1:
        (hits_wall if wall else hits_block).append(n(84, beat, 0.25, 1.0))
        bell.append(n([81, 76, 84][e["index"]], beat, 0.9, 0.9))
    elif e["level"] == 2:
        (hits_wall if wall else hits_block).append(n(84, beat, 0.2, 0.95))
        k = 3 + round(e["index"] / 30 * 6)  # climbs A3 -> A5
        (pluck_wall if wall else pluck_block).append(n(AM[k] - (12 if wall else 0), beat, 0.3, 0.95))
    else:
        l3_slots[round(beat * 8) / 8].append(e)
for beat, es in sorted(l3_slots.items()):
    e = es[-1]
    wall = e["type"] == "wall"
    k = int(e["index"] / (e["total"] - 1) * 8)  # climbs two octaves over the roll
    (hits_wall if wall else hits_block).append(n(84 + k, beat, 0.12, 0.8 + 0.2 * k / 8))
    (roll_wall if wall else roll_block).append(n(AM[3 + k // 2] + (0 if wall else 12), beat, 0.12, 0.85 + 0.15 * k / 8))

# outro: pi's digits as A minor chord tones, one per 8th (the picture shows one digit per 8th)
PI10 = AM[3:13]  # digit d -> the d-th chord tone from A3
pi_mel = [n(PI10[int(d)], 14 * 4 + i / 2, 0.42, 0.85) for i, d in enumerate("3141592653589793")]
# intro and outro: the same chord riff through a lowpass, so the end runs into the start
RIFF = [57, 64, 60, 64, 69, 64, 60, 64]
riff_dark = [n(p, b * 4 + i / 2, 0.4, 0.6) for b in (*INTRO, *OUTRO) for i, p in enumerate(RIFF)]

# ---------------------------------------------------------------- song
space = Reverb(decay_seconds=1.8, mix=0.22)
short = Reverb(decay_seconds=0.9, mix=0.15)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.4, repeats=5, mix=0.25)
pump = lambda: Ducker(trigger_beats=side.trigger_beats, depth=0.3, release_seconds=0.12)  # noqa: E731

physics = [
    Track(name="Clack wall", instrument="fm_percussion", gain=1.0, pan=-0.45, tone=Tone(brightness=0.75), notes=tuple(hits_wall),
          effects=(Distortion(drive=4.0, mix=0.5), short)),
    Track(name="Clack block", instrument="fm_percussion", gain=1.0, pan=0.45, tone=Tone(brightness=0.8), notes=tuple(hits_block),
          effects=(Distortion(drive=4.0, mix=0.5), short)),
    Track(name="Clack notes L1", instrument="sync_lead", gain=0.7, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(bell),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space)),
    Track(name="Clack notes wall", instrument="sync_lead", gain=0.65, pan=-0.35, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(pluck_wall),
          effects=(Distortion(drive=3.0, mix=0.4), echo, pump())),
    Track(name="Clack notes block", instrument="hoover", gain=0.45, pan=0.35, tone=Tone(brightness=0.6, cutoff_hz=4000, detune_cents=12), notes=tuple(pluck_block),
          effects=(Filter(mode="highpass", cutoff_hz=250), echo, pump())),
    Track(name="Squeeze roll wall", instrument="sync_lead", gain=0.7, pan=-0.5, tone=Tone(brightness=0.65, cutoff_hz=5000), notes=tuple(roll_wall),
          effects=(Filter(mode="highpass", cutoff_hz=200), short)),
    Track(name="Squeeze roll block", instrument="sync_lead", gain=0.7, pan=0.5, tone=Tone(brightness=0.7, cutoff_hz=5000), notes=tuple(roll_block),
          effects=(Filter(mode="highpass", cutoff_hz=200), short)),
    Track(name="Pi melody", instrument="sync_lead", gain=0.75, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(pi_mel),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, pump())),
    Track(name="Riff (filtered)", instrument="sync_lead", gain=0.5, tone=Tone(brightness=0.4, cutoff_hz=1400), notes=tuple(riff_dark), effects=(echo, space)),
]
tracks = groove + physics

song = Song(title="Count the Clacks", bpm=float(BPM), beats=float(BEATS), seed=314, master_gain=0.8, tracks=tuple(tracks))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    song.save(OUT / "score.json")
    wav = PUBLIC / "track.wav"
    report = render(song, wav, target_lufs=-14.0, peak_ceiling_dbfs=-1.0)
    loop = finish_loop(wav, BEATS * SPB)
    try:
        midi = export_midi(song, OUT / "song.mid")
    except ValueError as err:  # two tracks share a drum voice
        midi = {"skipped": str(err)}
    (OUT / "report.json").write_text(json.dumps({"render": report, "loop": loop, "midi": midi}, indent=2, default=str) + "\n")
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks), "level3_hits": len(l3_slots)}, indent=2))


if __name__ == "__main__":
    main()
