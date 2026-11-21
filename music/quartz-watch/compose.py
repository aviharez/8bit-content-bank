"""32,768 -> 1 TICK: soundtrack for the quartz-watch video, composed with Audio as Code.

Hard techno in C minor, 120 BPM, 18 bars (36 s). The tempo is set by the physics, not by taste: the video
runs in real time, and the slow divider stages are 16, 8, 4, 2 and 1 Hz, so a 2 Hz beat (120 BPM) is the
only tempo at which every stage lands on the grid. (The house tempo of 150 BPM would put 2 Hz off the beat.)

The whole track is tuned to scientific pitch (C4 = 256 Hz), so every C you hear is an exact power of two
in hertz, the same numbers as the divider stages on screen: stage k runs at 32768 / 2^k Hz = scientific C(11 - k).

Physics:
  stages 2-10 (8192 Hz down to 32 Hz) -> heard as tones: a sine at the stage's own C, with a C minor chord riff around it
  stage 11 (16 Hz) -> 32nd-note hats     stage 12 (8 Hz) -> the 16th hats
  stage 13 (4 Hz)  -> the offbeat open hat (its offbeat edges)
  stage 14 (2 Hz)  -> the kick: the deep tuned "dem" of the channel's groove
  stage 15 (1 Hz)  -> the tick
  Every one of those is a rising edge of the real stage output, at its real rate. In bars 10-13 the camera
  walks down stages 11-14 and the kit is stripped and rebuilt one stage at a time; the kick returns with stage 14.
Groove (not a divider stage): the reese bass wall (Ab-G-F), clap on 2 and 4, pad, roll and riser, the drop riff.
The last bar is the intro texture (filtered groove + filtered riff), so the loop runs on.

Run from the repo root:  uv run --locked python music/quartz-watch/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import Delay, Distortion, Ducker, Filter, Reverb, Song, Tone, Track, export_midi, render  # noqa: E402
from hard_techno import bass_wall, claps, groove_tracks, kick, n, pad, roll  # noqa: E402
from mastering import finish_loop, render_bpm_for_scientific_pitch, to_scientific_pitch  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "quartz-watch"

BPM = 120  # the tempo of the finished track (after the scientific-pitch retune): 2 Hz = one beat
BARS = 18
BEATS = BARS * 4
SPB = 60 / BPM
RENDER_BPM = render_bpm_for_scientific_pitch(BPM)
RENDER_SPB = 60 / RENDER_BPM  # seconds per beat while rendering (effect times are in render seconds)

tl = json.loads((PUBLIC / "timeline.json").read_text())
FPS = tl["fps"]
slots = {s["k"]: s for s in tl["slots"]}
edges = tl["edges"]


def beat_of_frame(f: float) -> float:
    return f / FPS / SPB


def stage_midi(k: int) -> int:
    """Stage k = scientific C(11-k); in MIDI numbering C(n) = 12 * (n + 1)."""
    return 12 * (12 - k)


INTRO, HIGH, REBUILD, DROP, OUTRO = range(0, 2), range(2, 9), range(9, 13), range(13, 17), range(17, 18)
SOFT = set(INTRO) | set(OUTRO)
enter = {k: int(beat_of_frame(slots[k]["start"]) // 4) for k in range(11, 15)}  # bar where the camera reaches stage k
STRIP = range(9, enter[14])  # bars without a kick, until stage 14 brings it back
FULL = set(range(4, 9)) | set(DROP)
bar_of = lambda beat: int(beat // 4)  # noqa: E731

# ---------------------------------------------------------------- the slow stages play the kit
kicks, hat32, hat16, hat_open, tick = [], [], [], [], []
for e in edges:
    beat = round(e["sec"] / SPB, 6)
    b, k = bar_of(beat), e["k"]
    if k == 14 and b not in STRIP:
        kicks.append(kick(beat))
    elif k == 12 and (b in FULL or enter[12] <= b < 13):
        hat16.append(n(42, beat, 0.06, (0.55 if round(beat * 4) % 4 == 2 else 0.32) * (0.8 if b in REBUILD else 1.0)))
    elif k == 13 and round(beat * 2) % 2 == 1 and (b not in REBUILD or b >= enter[13]):
        hat_open.append(n(46, beat, 0.22, 0.55 if b in FULL else 0.4))
    elif k == 11 and enter[11] <= b < 17:
        hat32.append(n(42, beat, 0.04, (0.3 if round(beat * 8) % 2 == 0 else 0.18) * (1.0 if b in REBUILD else 0.6)))
    elif k == 15:
        tick.append(n(84, beat, 0.2, 1.0 if b in DROP else 0.75))

# ---------------------------------------------------------------- groove (not a stage)
BASS_LINE = [32, 32, 31, 31, 32, 32, 29, 31]  # Ab, Ab, G, G, Ab, Ab, F, G: the reference's dark half-steps, in C minor
root = lambda b: BASS_LINE[b % 8]  # noqa: E731
PADS = {32: [56, 60, 63, 67], 31: [55, 60, 63, 67], 29: [53, 56, 60, 65]}  # Abmaj7, Cm/G, Fm: C in every chord
clap = [x for b in range(BARS) if b in FULL or b == 12 for x in claps(b)]
grit = bass_wall(root, range(BARS), soft_bars=SOFT)  # full through the strip: the low end never drops
pads = pad(root, PADS, range(BARS))
riser = [n(p, 12 * 4, 3.9, 0.7) for p in (48, 55, 60)]
groove, side = groove_tracks(kicks=kicks, clap=clap, hat16=hat16, hat_open=hat_open, grit=grit, pads=pads,
                             rolls=roll(12), crashes=[n(51, 4 * 4, 3, 0.6), n(51, 13 * 4, 4, 0.85)],
                             riser=riser, riser_span=(48.0, 52.0))

# ---------------------------------------------------------------- the pitched stages: a riff on C minor around each stage's C
CM = (0, 3, 7)
drone, arp = [], []
LOUD = {120: 0.25, 108: 0.35, 96: 0.5, 84: 0.6, 72: 0.65, 60: 0.7, 48: 0.8, 36: 0.9, 24: 1.0}
for k in range(2, 11):
    s = slots[k]
    b0, b1 = beat_of_frame(s["start"]), beat_of_frame(s["end"])
    c = stage_midi(k)
    drone.append(n(c, b0, b1 - b0, LOUD[c]))
    if k <= 9:
        offs = [0, CM[2] - 12, CM[1] - 12, -12, 12 - 12, CM[2] - 12, 0, CM[1] - 12]
        for i in range(int(round((b1 - b0) * 4))):
            arp.append(n(c + offs[i % 8], b0 + i / 4, 0.2, LOUD[c] * (1.0 if i % 4 == 0 else 0.75)))
sub10 = [n(24, beat_of_frame(slots[10]["start"]), 4, 0.9)]  # stage 10: C1 = 32 Hz, felt more than heard

# the drop: a hypnotic riff on the stages' own Cs (C3, C4, C5 = stages 8, 7, 6) with the chord's Eb and G
RIFF = [60, 72, 60, 67, 60, 75, 60, 72]
riff_main = [n(p, b * 4 + i / 2, 0.3 if i % 2 else 0.45, 1.0 if i % 4 == 0 else 0.85) for b in DROP for i, p in enumerate(RIFF)]
riff_main += [n(p + 12, b * 4 + i / 2, 0.3, 0.6) for b in (15, 16) for i, p in enumerate(RIFF)]
riff_dark = [n(p, b * 4 + i / 2, 0.4, 0.6) for b in (*INTRO, *OUTRO) for i, p in enumerate(RIFF)]

# ---------------------------------------------------------------- song
space = Reverb(decay_seconds=1.8, mix=0.22)
short = Reverb(decay_seconds=1.0, mix=0.16)
echo = Delay(time_seconds=0.75 * RENDER_SPB, feedback=0.4, repeats=5, mix=0.25)
pump = lambda: Ducker(trigger_beats=side.trigger_beats, depth=0.35, release_seconds=0.12)  # noqa: E731

physics = [
    Track(name="Stage tone (sine)", instrument="sine", gain=0.32, notes=tuple(drone), release_seconds=0.05, effects=(short,)),
    Track(name="Stage riff", instrument="sync_lead", gain=0.55, tone=Tone(brightness=0.6, cutoff_hz=6000), notes=tuple(arp),
          effects=(Distortion(drive=3.0, mix=0.4), echo, short, pump())),
    Track(name="Stage 10 sub", instrument="sub_bass", gain=0.4, tone=Tone(brightness=0.3), notes=tuple(sub10)),
    Track(name="Stage 11: 16 Hz", instrument="metal_hat", gain=0.22, pan=-0.3, tone=Tone(brightness=0.8, decay_seconds=0.1), notes=tuple(hat32)),
    Track(name="Stage 15: 1 Hz tick", instrument="fm_percussion", gain=0.8, tone=Tone(brightness=0.75), notes=tuple(tick),
          effects=(Distortion(drive=3.0, mix=0.4), short)),
    Track(name="Drop riff", instrument="sync_lead", gain=0.7, tone=Tone(brightness=0.6, cutoff_hz=4500), notes=tuple(riff_main),
          effects=(Distortion(drive=3.0, mix=0.4), echo, space, pump())),
    Track(name="Drop riff body", instrument="hoover", gain=0.3, pan=-0.1, tone=Tone(brightness=0.6, cutoff_hz=4000, detune_cents=12), notes=tuple(riff_main),
          effects=(Filter(mode="highpass", cutoff_hz=250), echo, pump())),
    Track(name="Riff (filtered)", instrument="sync_lead", gain=0.5, tone=Tone(brightness=0.4, cutoff_hz=1400), notes=tuple(riff_dark), effects=(echo, space)),
]
tracks = groove + physics

song = Song(title="32,768 to 1 Tick", bpm=round(RENDER_BPM, 4), beats=float(BEATS), seed=32768, master_gain=0.8, tracks=tuple(tracks))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    song.save(OUT / "score.json")
    wav = PUBLIC / "track.wav"
    report = render(song, wav, target_lufs=-14.0, peak_ceiling_dbfs=-1.0)
    to_scientific_pitch(wav)  # now exactly 120 BPM and C4 = 256 Hz
    loop = finish_loop(wav, BEATS * SPB)
    try:
        midi = export_midi(song, OUT / "song.mid")
    except ValueError as err:
        midi = {"skipped": str(err)}
    (OUT / "report.json").write_text(json.dumps({"render": report, "loop": loop, "midi": midi, "tuning": "scientific pitch, C4 = 256 Hz"}, indent=2, default=str) + "\n")
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks), "enter": enter}, indent=2))


if __name__ == "__main__":
    main()
