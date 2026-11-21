"""32,768 -> 1 TICK: soundtrack for the quartz-watch video, composed with Audio as Code.

The whole track is tuned to scientific pitch (C4 = 256 Hz), so every C you hear is an exact
power of two in hertz, the same numbers as the divider stages on screen:
  stage k runs at 32768 / 2^k Hz = scientific C(11 - k).
Stages 2-10 are heard as tones (C9 = 8192 Hz down to C1 = 32 Hz). Stages 11-15 (16, 8, 4, 2, 1 Hz)
are below hearing, so they are heard as rhythm: every rising edge is a drum hit, at its real rate.

Run from the repo root:  uv run --locked python music/quartz-watch/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Chorus, Delay, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from mastering import finish_loop, render_bpm_for_scientific_pitch, to_scientific_pitch  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "quartz-watch"

BPM = 120  # the tempo of the finished track (after the scientific-pitch retune)
BARS = 18
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
FPS = tl["fps"]
slots = {s["k"]: s for s in tl["slots"]}
edges = tl["edges"]


def beat_of_frame(f: float) -> float:
    return f / FPS / SPB


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


def stage_midi(k: int) -> int:
    """Stage k = scientific C(11-k); in MIDI numbering C(n) = 12 * (n + 1)."""
    return 12 * (12 - k)


# ---------------------------------------------------------------- harmony (C minor, C in every chord)
# Cm, Ab, Fm, Gsus4 as intervals from C
CHORDS = [(0, 3, 7), (0, 3, 8), (0, 5, 8), (0, 2, 7)]
ROOTS = [48, 44, 41, 43]  # C3, Ab2, F2, G2
chord = lambda b: CHORDS[b % 4]  # noqa: E731
DROP = range(13, 17)

pad, drone, arp = [], [], []
for b in range(BARS):
    iv = chord(b)
    pad += [n(60 + i, b * 4, 3.9, 0.42 if b in DROP else 0.34) for i in iv]

# pitched stages: a pure sine at the stage frequency + a pulse arpeggio around it
for k in range(2, 11):
    s = slots[k]
    b0, b1 = beat_of_frame(s["start"]), beat_of_frame(s["end"])
    c = stage_midi(k)
    loud = {120: 0.25, 108: 0.35, 96: 0.5, 84: 0.6, 72: 0.65, 60: 0.7, 48: 0.8, 36: 0.9, 24: 1.0}[c]
    drone.append(n(c, b0, b1 - b0, loud))
    if k <= 9:
        iv = chord(int(b0 // 4))
        offs = [0, iv[2] - 12, iv[1] - 12, -12, iv[1] - 12, iv[2] - 12, 0, iv[2] - 12]
        steps = int(round((b1 - b0) * 4))
        arp += [n(c + offs[i % 8], b0 + i / 4, 0.2, loud * (1.0 if i % 4 == 0 else 0.75)) for i in range(steps)]

# stage 10 (32 Hz) and 11 (16 Hz): sub-bass you feel more than hear
sub = [n(24, beat_of_frame(slots[10]["start"]), 4, 0.9)]
drone.append(n(12, beat_of_frame(slots[11]["start"]), 4, 0.6))

# ---------------------------------------------------------------- rhythm: the slow stages, at their real rates
enter = {k: beat_of_frame(slots[k]["start"]) for k in range(11, 16)}
enter[15] = 0.0  # the 1 Hz tick is the watch itself: it runs from the first frame
end_beat = 17 * 4  # rhythm stops for the outro bar except the tick
roll16, hat8, hat4, kick2, tick1 = [], [], [], [], []
for e in edges:
    beat = e["sec"] / SPB
    k = e["k"]
    if beat < enter[k] or (k != 15 and beat >= end_beat):
        continue
    if k == 11:
        roll16.append(n(42, beat, 0.05, 0.22 + 0.18 * (round(beat * 8) % 2 == 0)))
    elif k == 12:
        hat8.append(n(42, beat, 0.08, 0.45 if round(beat * 4) % 2 == 0 else 0.3))
    elif k == 13:
        hat4.append(n(46, beat, 0.25, 0.4 if round(beat * 2) % 2 else 0.25))
    elif k == 14:
        kick2.append(n(36, beat, 0.5, 0.95))
    else:
        tick1.append(n(84, beat, 0.2, 1.0 if beat >= 13 * 4 else 0.75))

duck = Ducker(trigger_beats=tuple(x.start for x in kick2), depth=0.55, attack_seconds=0.004, release_seconds=0.16)

# backbeat and fills (groove, not a divider stage)
snare, clap, crash = [], [], []
for b in DROP:
    snare += [n(38, b * 4 + 1, 0.25, 0.8), n(38, b * 4 + 3, 0.25, 0.85)]
    clap += [n(39, b * 4 + 1, 0.25, 0.65), n(39, b * 4 + 3, 0.25, 0.65)]
snare += [n(38, 12 * 4 + 3 + s / 4, 0.12, 0.5 + 0.12 * s) for s in range(4)]
crash += [n(51, 13 * 4, 3.5, 0.8), n(51, 17 * 4, 3.5, 0.5)]
riser = [n(p, 12 * 4, 3.95, 0.7) for p in (48, 55, 60)]

# ---------------------------------------------------------------- bass + lead in the drop
bass, sub_drop = [], []
for b in range(9, 17):
    r = ROOTS[b % 4]
    if b < 13:
        bass += [n(r, b * 4 + q, 0.9, 0.55) for q in range(4)]
    else:
        bass += [n(r + (12 if e in (1, 3, 6) else 0), b * 4 + e / 2, 0.42, 0.8) for e in range(8)]
        sub_drop += [n(r - 12, b * 4 + q, 0.95, 0.75) for q in range(4)]

HOOK = [
    [(0, 72, 4), (4, 75, 2), (6, 79, 4), (10, 77, 2), (12, 75, 2), (14, 74, 2)],
    [(0, 72, 4), (4, 75, 2), (6, 80, 4), (10, 79, 2), (12, 77, 2), (14, 75, 2)],
    [(0, 77, 4), (4, 75, 2), (6, 72, 4), (10, 68, 2), (12, 72, 2), (14, 75, 2)],
    [(0, 74, 3), (3, 72, 3), (6, 67, 4), (10, 74, 2), (12, 79, 2), (14, 84, 2)],
]
lead, lead_low = [], []
for b in DROP:
    for p, pitch, ln in HOOK[b % 4]:
        lead.append(n(pitch, b * 4 + p / 4, ln / 4 * 0.92, 0.85 if p in (0, 6) else 0.72))
        lead_low.append(n(pitch - 12, b * 4 + p / 4, ln / 4 * 0.92, 0.55))
lead.append(n(72, 17 * 4, 3.5, 0.7))  # outro: land on C5 = 512 Hz

# ---------------------------------------------------------------- song
rev_short, rev_long = Reverb(decay_seconds=1.2, mix=0.18), Reverb(decay_seconds=2.8, mix=0.34)
dotted8 = Delay(time_seconds=0.75 * SPB * (BPM / render_bpm_for_scientific_pitch(BPM)), feedback=0.35, repeats=5, mix=0.22)
gain_in = lambda start_bar: (Automation(parameter="gain", points=(AutomationPoint(beat=0.0, value=0.0), AutomationPoint(beat=start_bar * 4 - 0.01, value=0.0), AutomationPoint(beat=start_bar * 4, value=1.0))),)  # noqa: E731

tracks = [
    Track(name="Pad", instrument="wavetable_pad", gain=0.3, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=12), notes=tuple(pad), release_seconds=0.6,
          effects=(Filter(mode="lowpass", cutoff_hz=400, end_cutoff_hz=9000, sweep_seconds=4.0), Chorus(), rev_long, duck)),
    Track(name="Stage tone (sine)", instrument="sine", gain=0.32, notes=tuple(drone), release_seconds=0.05, effects=(rev_short,)),
    Track(name="Stage arp (pulse)", instrument="hoover", gain=0.3, tone=Tone(brightness=0.55, cutoff_hz=6000, detune_cents=4), notes=tuple(arp), effects=(dotted8, rev_short)),
    Track(name="Stage 10 sub", instrument="sub_bass", gain=0.5, tone=Tone(brightness=0.3), notes=tuple(sub)),
    Track(name="Stage 11: 16 Hz", instrument="metal_hat", gain=0.22, pan=0.3, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(roll16)),
    Track(name="Stage 12: 8 Hz", instrument="metal_hat", gain=0.3, pan=-0.25, tone=Tone(brightness=0.6, decay_seconds=0.15), notes=tuple(hat8)),
    Track(name="Stage 13: 4 Hz", instrument="open_hat", gain=0.24, pan=0.15, notes=tuple(hat4)),
    Track(name="Stage 14: 2 Hz", instrument="kick_909", gain=0.85, tone=Tone(decay_seconds=0.45, tuning_semitones=-2, brightness=0.5), notes=tuple(kick2)),
    Track(name="Stage 15: 1 Hz tick", instrument="fm_percussion", gain=0.75, tone=Tone(brightness=0.7), notes=tuple(tick1), effects=(rev_short,)),
    Track(name="Snare", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.55), notes=tuple(snare), effects=(rev_short,)),
    Track(name="Clap", instrument="clap", gain=0.38, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Crash", instrument="electronic_ride", gain=0.28, tone=Tone(brightness=0.8, decay_seconds=2.5), notes=tuple(crash), effects=(rev_long,)),
    Track(name="Riser", instrument="supersaw", gain=0.24, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=1.2, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=350), rev_long),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=48.0, value=0.0), AutomationPoint(beat=51.95, value=1.0), AutomationPoint(beat=52.0, value=0.0))),)),
    Track(name="Bass (triangle)", instrument="triangle", gain=0.5, notes=tuple(bass), effects=(duck,)),
    Track(name="Sub", instrument="sub_bass", gain=0.42, tone=Tone(brightness=0.2), notes=tuple(sub_drop), effects=(duck,)),
    Track(name="Lead (pulse)", instrument="hoover", gain=0.4, tone=Tone(brightness=0.62, cutoff_hz=5200, detune_cents=7), notes=tuple(lead),
          effects=(Chorus(mix=0.3), dotted8, rev_short, Ducker(trigger_beats=duck.trigger_beats, depth=0.25, release_seconds=0.12))),
    Track(name="Lead low", instrument="synthesizer", gain=0.16, tone=Tone(brightness=0.4), notes=tuple(lead_low), effects=(duck,)),
]

song = Song(title="32,768 to 1 Tick", bpm=round(render_bpm_for_scientific_pitch(BPM), 4), beats=float(BEATS), seed=32768, master_gain=0.8, tracks=tuple(tracks))


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
    print(json.dumps({"loop": loop, "notes": sum(len(t.notes) for t in tracks), "tracks": len(tracks)}, indent=2))


if __name__ == "__main__":
    main()
