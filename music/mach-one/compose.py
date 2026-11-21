"""Why do jets go BOOM? Soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, D minor (Dm, Bb, Gm, A; bars 8-11 hold Dm under the climb), 24 bars (38.4 s). One groove, one grid.
The house sound (docs/music-reference.md): four-on-the-floor dem, distorted reese wall, clap on 2 and 4, 16th hats,
offbeat open hat, dense from the first frame. Every thing on screen is an instrument:
- the rings (the jet's sound, one every 8th note) are the hats: a hat on every ring, an open hat on the offbeat ones;
- the engine as heard ahead of the jet (timeline.json "heard") is the lead: D1 times the Doppler factor 1 / (1 - M),
  stepping up the harmonics 2x, 3x, 4x, 6x, 8x ... (D and A only), faster and faster: the climb is the riser. At Mach 1
  it goes to infinity: the drop. Silent while supersonic (nothing is heard ahead). In the outro it steps back down.
- the towers are the kicks of the drop: each kick is the boom reaching one tower (they are placed so it does), with a
  boom layer on top; the listener's tower (beat 66) gets an impact and a crash.
- the jet's speed is the reese wall: it gets louder as the jet speeds up.

Run from the repo root:  uv run --locked python music/mach-one/compose.py
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
PUBLIC = ROOT / "public" / "mach-one"

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM = tl["bpm"]
BARS = tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
FPB = tl["framesPerBeat"]
DROP, OUTRO = tl["dropBar"], tl["outroBar"]
INTRO, GROOVE, BUILD, DROPS, OUTROS = range(0, 4), range(4, 8), range(8, DROP), range(DROP, OUTRO), range(OUTRO, BARS)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


CHORDS = {"Dm": [2, 5, 9], "Bb": [10, 2, 5], "Gm": [7, 10, 2], "A": [9, 1, 4]}
CYCLE = ["Dm", "Bb", "Gm", "A"]
chord_name = lambda b: "Dm" if b in BUILD else CYCLE[b % 4]  # noqa: E731
bar_of = lambda beat: int(beat // 4)  # noqa: E731
KICK_ROOT = {"Dm": 38, "Bb": 34, "Gm": 31, "A": 33}  # D2, Bb1, G1, A1: dem body 49-73 Hz


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


# ---------------------------------------------------------------- drums
kicks = sorted(tl["kicks"])
kick_notes = [(k, KICK_ROOT[chord_name(bar_of(k))], 0.9, 1.0) for k in kicks]
tower_beats = [tw["beat"] for tw in tl["towers"]]
her = tl["towers"][tl["listener"]]["beat"]

clap, hats, hat_open, rumble, roll, crash, impact, boom = [], [], [], [], [], [], [], []
for s in tl["snares"]:
    if bar_of(s) != DROP - 1 or s < (DROP - 1) * 4 + 2:
        clap.append(n(39, s, 0.25, 0.9))
for k in kicks:
    rumble.append(n(33, k, 0.9, 0.85))
# the rings are the hats: one hat per ring (every 8th note), the offbeat ones open
for i, r in enumerate(tl["rings"]):
    beat = r["t"] / SPB
    if bar_of(beat) == DROP - 1 and beat % 4 >= 3:
        continue
    if i % 2:
        hat_open.append(n(46, beat, 0.22, 0.55 if bar_of(beat) in DROPS else 0.45))
    else:
        hats.append(n(42, beat, 0.06, 0.5))
for b in range(BARS):  # 16th ticks between the rings, quieter
    if b == DROP - 1:
        continue
    hats += [n(42, b * 4 + s / 4, 0.05, 0.28) for s in range(16) if s % 2]
hats.sort(key=lambda x: x.start)
rb = (DROP - 1) * 4
roll += [n(38, rb + s / 4, 0.08, 0.3 + 0.65 * (s / 11) ** 2) for s in range(12)]
crash += [n(51, 0, 3, 0.7), n(51, 16, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, her, 3, 0.8), n(51, OUTRO * 4, 3, 0.5)]
impact += [n(33, DROP * 4, 2.5, 1.0), n(33, her, 2.0, 0.9)]
boom += [n(33, b, 0.5, 0.7) for b in tower_beats]

# ---------------------------------------------------------------- the low end: a reese wall on the roots, legato 16ths
grit = []
for b in range(BARS):
    root = KICK_ROOT[chord_name(b)]
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue
        for s16 in range(4):
            grit.append(n(root + 12, b * 4 + q + s16 / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s16]))
# the jet's speed drives the wall: quieter at Mach 0.5, full at Mach 1 and above
speed_pts = []
for f in range(0, len(tl["frames"]), FPB):
    m = tl["frames"][f]["mach"]
    speed_pts.append(AutomationPoint(beat=round(f / FPB, 4), value=round(min(1.0, 0.55 + 0.45 * min(1.0, m)), 4)))

PAD = {"Dm": [50, 53, 57, 62], "Bb": [50, 53, 58, 62], "Gm": [50, 55, 58, 62], "A": [49, 52, 57, 61]}
pad = [n(p, b * 4, 3.95, 0.45) for b in range(BARS) for p in PAD[chord_name(b)]]

# drop riff: a dark 8th/16th riff on the chord tones (the cone's lead)
RIFF = [(0, 0, 0.5), (0.75, 2, 0.25), (1, 1, 0.5), (1.5, 0, 0.5), (2.25, 2, 0.25), (2.5, 1, 0.5), (3, 2, 0.5), (3.5, 1, 0.5)]
riff, riff_hi = [], []
for b in DROPS:
    ts = tones_from(62, CHORDS[chord_name(b)], 3)
    for off, i, d in RIFF:
        riff.append(n(ts[i], b * 4 + off, d, 0.9 if off == 0 else 0.75))
        riff_hi.append(n(ts[i] + 12, b * 4 + off, d, 0.5))

# ---------------------------------------------------------------- the engine, heard straight ahead (the lead before Mach 1)
heard = tl["heard"]
engine, engine_top = [], []
for i, h in enumerate(heard):
    start = h["beat"]
    nxt = heard[i + 1]["beat"] if i + 1 < len(heard) else BEATS
    end = min(nxt, DROP * 4) if start < DROP * 4 else nxt
    t = start
    while t < end - 1e-6:
        seg = min(end, (int(t // 4) + 1) * 4) - t
        engine.append(n(h["midi"], t, seg, 0.9))
        top = h["midi"] + 24 if h["midi"] < 50 else h["midi"] + 12 if h["midi"] < 62 else h["midi"]
        engine_top.append(n(top, t, seg, 0.75))
        t += seg

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.3, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.8, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Rumble", instrument="kick_909", gain=0.15, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Impact", instrument="kick_808", gain=0.6, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Boom", instrument="kick_808", gain=0.3, tone=Tone(decay_seconds=0.7, tuning_semitones=-3, brightness=0.7), notes=tuple(boom),
          effects=(Distortion(drive=4.0, mix=0.6), Reverb(decay_seconds=1.2, mix=0.3))),
    Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
    Track(name="Hats (rings)", instrument="metal_hat", gain=0.28, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Open hat (rings)", instrument="open_hat", gain=0.3, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.6), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.85, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=10.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side),
          automation=(Automation(parameter="gain", points=tuple(speed_pts)),)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.22, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pad), release_seconds=0.6, effects=(space, side)),
    Track(name="Cone riff", instrument="sync_lead", gain=0.7, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(riff),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12))),
    Track(name="Cone riff body", instrument="hoover", gain=0.3, pan=-0.1, tone=Tone(brightness=0.6, cutoff_hz=4000, detune_cents=12), notes=tuple(riff_hi),
          effects=(Filter(mode="highpass", cutoff_hz=250), echo)),
    Track(name="Engine (heard ahead)", instrument="hoover", gain=0.5, tone=Tone(brightness=0.6, cutoff_hz=3500, detune_cents=18), notes=tuple(engine),
          effects=(Distortion(drive=3.0, mix=0.4), side)),
    Track(name="Engine top", instrument="sync_lead", gain=0.38, tone=Tone(brightness=0.65, cutoff_hz=5000), notes=tuple(engine_top), effects=(space, side)),
]

song = Song(title="Why Do Jets Go Boom", bpm=float(BPM), beats=float(BEATS), seed=343, master_gain=0.8, tracks=tuple(tracks))


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
