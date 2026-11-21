"""What does Mach 1 sound like? Soundtrack, composed with Audio as Code.

Drum and bass, 180 BPM, D minor (Dm, Bb, F, C; bars 8-11 hold Dm under the climb), 24 bars (32 s). One groove, one grid.

Physics:
- The engine as heard straight ahead of the jet (timeline.json "heard"): the engine tone D1 times the Doppler factor
  1 / (1 - M). The pilot throttles up so it steps through the harmonics 2x, 3x, 4x, 6x, 8x ... (D and A only), each
  step on the grid, faster and faster: that climb IS the riser. At Mach 1 it goes to infinity: the drop.
- Supersonic (bars 12-19): nothing is heard ahead, so the engine voice is silent. Every kick is the boom reaching one
  tower (the towers are placed so it does), with an extra boom layer on each.
- Outro: back below Mach 1, the engine voice comes back from the top and steps down the harmonics to 2x, the opening note.
Groove (not physics): the tuned "dem" kick in a two-step, snare on 2 and 4, ghosts, 16th hats, rolling reese on the chord
roots, pad, 16th arp, lead hook in the drop, snare roll into the drop, impact and crash on Mach 1.

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
DROP, OUTRO = tl["dropBar"], tl["outroBar"]
INTRO, GROOVE, BUILD, DROPS, OUTROS = range(0, 4), range(4, 8), range(8, DROP), range(DROP, OUTRO), range(OUTRO, BARS)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


CHORDS = {"Dm": [2, 5, 9], "Bb": [10, 2, 5], "F": [5, 9, 0], "C": [0, 4, 7]}
ROOT_PC = {"Dm": 2, "Bb": 10, "F": 5, "C": 0}
CYCLE = ["Dm", "Bb", "F", "C"]
chord_name = lambda b: "Dm" if b in BUILD else CYCLE[b % 4]  # noqa: E731
bar_of = lambda beat: int(beat // 4)  # noqa: E731
KICK_ROOT = {"Dm": 38, "Bb": 34, "F": 29, "C": 36}  # D2, Bb1, F1, C2: dem body 44-73 Hz


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


# ---------------------------------------------------------------- drums (kicks from the timeline: in the drop they are the booms)
kicks = sorted(tl["kicks"])
kick_notes = []
for i, k in enumerate(kicks):
    nxt = kicks[i + 1] if i + 1 < len(kicks) else BEATS
    kick_notes.append((k, KICK_ROOT[chord_name(bar_of(k))], min(0.95, nxt - k), 1.0))
tower_beats = [tw["beat"] for tw in tl["towers"]]

snare, clap, hats, hat_open, ghost, roll, crash, impact, boom = [], [], [], [], [], [], [], [], []
for s in tl["snares"]:
    snare.append(n(38, s, 0.3, 0.95))
    if bar_of(s) in DROPS:
        clap.append(n(39, s, 0.25, 0.7))
for b in range(BARS):
    t = b * 4
    if b == DROP - 1:
        continue
    hats += [n(42, t + s / 4, 0.06, (0.32, 0.5, 0.38, 0.58)[s % 4]) for s in range(16)]
    hat_open += [n(46, t + 1.5, 0.3, 0.42), n(46, t + 3.5, 0.3, 0.42)]
    ghost += [n(38, t + 1.75, 0.1, 0.3), n(38, t + 2.75, 0.1, 0.22), n(38, t + 3.25, 0.1, 0.26)]
    if b % 4 == 3:
        ghost += [n(38, t + 3.5, 0.08, 0.5), n(38, t + 3.75, 0.08, 0.65)]
rb = (DROP - 1) * 4
roll += [n(38, rb + e / 2, 0.1, 0.3 + 0.05 * e) for e in range(4)]
roll += [n(38, rb + 2 + s / 4, 0.08, 0.5 + 0.5 * (s / 7)) for s in range(8)]
crash += [n(51, 0, 4, 0.7), n(51, 16, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, (DROP + 4) * 4, 3, 0.6), n(51, OUTRO * 4, 3, 0.5)]
impact += [n(33, DROP * 4, 2.5, 1.0)]  # Mach 1
boom += [n(33, b, 0.6, 0.75) for b in tower_beats]  # each tower's boom, on its kick

# ---------------------------------------------------------------- bass, pad, arp, hook
bass = []
for k, root, dur, _ in kick_notes:
    bass.append(n(root + 12, k, max(0.4, min(dur, 1.4) - 0.05), 1.0))
for b in range(BARS):
    if b == DROP - 1:
        continue
    root = KICK_ROOT[chord_name(b)] + 12
    bass += [n(root + 12, b * 4 + 1.5, 0.4, 0.7), n(root, b * 4 + 2.0, 0.4, 0.6), n(root + 12, b * 4 + 3.5, 0.4, 0.75)]
PAD = {"Dm": [50, 53, 57, 62], "Bb": [50, 53, 58, 62], "F": [48, 53, 57, 60], "C": [48, 52, 55, 60]}
pad = [n(p, b * 4, 3.95, 0.5) for b in range(BARS) for p in PAD[chord_name(b)]]
arp = []
for b in list(INTRO) + list(GROOVE) + list(OUTROS):
    ts = tones_from(62, CHORDS[chord_name(b)], 4)
    order = [0, 1, 2, 3, 2, 1, 2, 3]
    arp += [n(ts[order[s % 8]], b * 4 + s / 4, 0.22, 0.55 if s % 4 == 0 else 0.4) for s in range(16)]
HOOK = {
    "Dm": [(0, 74, 0.5), (0.5, 77, 0.5), (1, 81, 0.75), (2, 79, 0.5), (2.5, 77, 0.5), (3, 74, 0.5), (3.5, 77, 0.5)],
    "Bb": [(0, 74, 0.5), (0.5, 77, 0.5), (1, 82, 0.75), (2, 81, 0.5), (2.5, 77, 0.5), (3, 74, 1)],
    "F": [(0, 72, 0.5), (0.5, 77, 0.5), (1, 81, 0.75), (2, 79, 0.5), (2.5, 77, 0.5), (3, 72, 0.5), (3.5, 77, 0.5)],
    "C": [(0, 72, 0.5), (0.5, 76, 0.5), (1, 79, 0.75), (2, 81, 0.5), (2.5, 79, 0.5), (3, 76, 0.5), (3.5, 74, 0.5)],
}
hook, hook_hi = [], []
for b in DROPS:
    for off, p, d in HOOK[chord_name(b)]:
        hook.append(n(p, b * 4 + off, d, 0.9 if off == 0 else 0.75))
        hook_hi.append(n(p + 12, b * 4 + off, d, 0.55))

# ---------------------------------------------------------------- the engine, heard straight ahead
heard = tl["heard"]
engine, engine_top = [], []
for i, h in enumerate(heard):
    start = h["beat"]
    end = heard[i + 1]["beat"] if i + 1 < len(heard) and heard[i + 1]["beat"] > start else None
    if end is None or (start < DROP * 4 <= end):
        end = DROP * 4 if start < DROP * 4 else BEATS
    if start < DROP * 4 and end > DROP * 4:
        end = DROP * 4
    m = h["midi"]
    # long notes are re-struck every bar so the voice stays present
    t = start
    while t < end - 1e-6:
        seg = min(end, (int(t // 4) + 1) * 4) - t
        engine.append(n(m, t, seg, 0.9))
        top = m + 24 if m < 50 else m + 12 if m < 62 else m
        engine_top.append(n(top, t, seg, 0.75))
        t += seg

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.4, attack_seconds=0.002, release_seconds=0.14)
bass_duck = Ducker(trigger_beats=side.trigger_beats, depth=0.6, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.6, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Impact", instrument="kick_808", gain=0.6, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Boom", instrument="kick_808", gain=0.35, tone=Tone(decay_seconds=0.9, tuning_semitones=-3, brightness=0.7), notes=tuple(boom),
          effects=(Distortion(drive=4.0, mix=0.6), Reverb(decay_seconds=1.5, mix=0.3))),
    Track(name="Snare", instrument="electronic_snare", gain=0.66, tone=Tone(brightness=0.8), notes=tuple(snare), effects=(Reverb(decay_seconds=0.9, mix=0.18),)),
    Track(name="Clap", instrument="clap", gain=0.4, notes=tuple(clap), effects=(Reverb(decay_seconds=1.0, mix=0.25),)),
    Track(name="Ghost snare", instrument="electronic_snare", gain=0.38, tone=Tone(brightness=0.65), notes=tuple(ghost)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.8, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.22, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.55, tone=Tone(brightness=0.7), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.26, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Reese", instrument="reese_bass", gain=0.55, tone=Tone(brightness=0.75, cutoff_hz=1900, resonance=0.4, detune_cents=22),
          notes=tuple(bass), effects=(Distortion(drive=9.0, mix=0.75), Filter(mode="highpass", cutoff_hz=90), bass_duck)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.2, tone=Tone(brightness=0.45, cutoff_hz=2400, detune_cents=14), notes=tuple(pad), release_seconds=0.5, effects=(space, side)),
    Track(name="Arp", instrument="trance_pluck", gain=0.32, pan=-0.1, tone=Tone(brightness=0.6, cutoff_hz=1600, resonance=0.35, decay_seconds=0.4), notes=tuple(arp), effects=(echo, side)),
    Track(name="Hook", instrument="sync_lead", gain=0.5, tone=Tone(brightness=0.65, cutoff_hz=4200), notes=tuple(hook),
          effects=(Distortion(drive=2.5, mix=0.35), echo, space, Ducker(trigger_beats=side.trigger_beats, depth=0.3, release_seconds=0.12))),
    Track(name="Hook octave", instrument="supersaw", gain=0.3, pan=0.1, tone=Tone(brightness=0.6, cutoff_hz=5000, detune_cents=20), notes=tuple(hook_hi), effects=(echo, space)),
    # the engine as heard ahead of the jet
    Track(name="Engine (heard ahead)", instrument="hoover", gain=0.45, tone=Tone(brightness=0.6, cutoff_hz=3500, detune_cents=18), notes=tuple(engine),
          effects=(Distortion(drive=3.0, mix=0.4), side)),
    Track(name="Engine top", instrument="supersaw", gain=0.3, tone=Tone(brightness=0.65, cutoff_hz=5000, detune_cents=22), notes=tuple(engine_top), effects=(space, side)),
]

song = Song(title="What Does Mach 1 Sound Like", bpm=float(BPM), beats=float(BEATS), seed=343, master_gain=0.8, tracks=tuple(tracks))


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
