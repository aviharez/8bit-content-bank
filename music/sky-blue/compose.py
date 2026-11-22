"""Why is the sky blue? Soundtrack, composed with Audio as Code.

Hard techno, 150 BPM, F# minor (F#m, D, Bm, C#; one chord per bar), 24 bars (38.4 s). One groove, one grid.
The house sound (docs/music-reference.md): four-on-the-floor dem with rumble, distorted reese wall in legato 16ths,
clap on 2 and 4, 16th hats, offbeat open hat, dense from the first frame. Every thing on screen is an instrument:
- the sunlight that reaches her is the hook: a 16th-note FM ostinato (register leaps, accents 3+3+2) on a bright lead, as loud as the share of sunlight that gets
  through the air (the mean of red, green and blue transmission, timeline.json frames.T, 1 at noon). As the sun sets
  the bright lead fades and the same hook passes to a dark, distorted red lead (red is what still gets through), which
  carries the drop with an octave below; next morning it passes back. The hook never stops, only its colour changes.
- the photons the air scatters (timeline.json photons) are high bells on chord tones, at the moment they scatter,
  snapped to the nearest 16th: at noon the blue ones ring all over the sky.
- the sun going down is the riser (bars 8-11); the drop lands as it touches the horizon.
- the sky's colour is the pad.
Mix for a phone: the reese wall is kept below the hook (scripts/analyze_stems.py).

Run from the repo root:  uv run --locked python music/sky-blue/compose.py
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
PUBLIC = ROOT / "public" / "sky-blue"

tl = json.loads((PUBLIC / "timeline.json").read_text())
BPM = tl["bpm"]
BARS = tl["bars"]
BEATS = BARS * 4
SPB = 60 / BPM
SET, DROP, RISE = tl["setBar"], tl["dropBar"], tl["riseBar"]
DROPS = range(DROP, RISE)


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


CHORDS = [("F#m", 6, [6, 9, 1]), ("D", 2, [2, 6, 9]), ("Bm", 11, [11, 2, 6]), ("C#", 1, [1, 5, 8])]
chord = lambda beat: CHORDS[int(beat // 4) % 4]  # noqa: E731
KICK_ROOT = {6: 30, 2: 38, 11: 35, 1: 37}  # F#1, D2, B1, C#2: dem body 46-73 Hz
COLOUR_INDEX = {"red": 0, "green": 1, "blue": 2}


def tones_from(register, pcs, count=3):
    out, m = [], register
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


def chord_tone(beat, register, colour):
    _, root, pcs = chord(beat)
    order = [pcs[0], pcs[1], pcs[2]]  # root, third, fifth
    m = register
    while m % 12 != order[COLOUR_INDEX[colour]]:
        m += 1
    return m


# ---------------------------------------------------------------- drums
kicks = sorted(tl["kicks"])
kick_notes = [(k, KICK_ROOT[chord(k)[1]], 0.9, 1.0) for k in kicks]
clap = [n(39, c, 0.25, 0.9) for c in tl["claps"] if not (int(c // 4) == DROP - 1 and c % 4 >= 2)]
rumble = [n(33, k, 0.9, 0.85) for k in kicks]
hats, hat_open = [], []
for b in range(BARS):
    if b == DROP - 1:
        hats += [n(42, b * 4 + s / 4, 0.05, 0.3) for s in range(8)]
        continue
    hats += [n(42, b * 4 + s / 4, 0.05, (0.3, 0.45, 0.35, 0.5)[s % 4]) for s in range(16)]
    hat_open += [n(46, b * 4 + q + 0.5, 0.22, 0.5) for q in range(4)]
rb = (DROP - 1) * 4
roll = [n(38, rb + 2 + s / 4, 0.08, 0.4 + 0.55 * (s / 7) ** 2) for s in range(8)]
crash = [n(51, 0, 3, 0.7), n(51, 16, 3, 0.5), n(51, DROP * 4, 4, 1.0), n(51, (DROP + 4) * 4, 3, 0.6), n(51, RISE * 4, 3, 0.6)]
impact = [n(33, DROP * 4, 2.5, 1.0)]
riser = [n(p, SET * 4, (DROP - SET) * 4 - 0.1, 0.7) for p in (54, 61, 66)]

# ---------------------------------------------------------------- low end and pad
grit = []
for b in range(BARS):
    root = KICK_ROOT[CHORDS[b % 4][1]] + 12
    for q in range(4):
        if b == DROP - 1 and q == 3:
            continue
        grit += [n(root, b * 4 + q + s / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s]) for s in range(4)]
PAD = {"F#m": [54, 57, 61, 66], "D": [54, 57, 62, 66], "Bm": [54, 59, 62, 66], "C#": [53, 56, 61, 65]}
pad = [n(p, b * 4, 3.95, 0.45) for b in range(BARS) for p in PAD[CHORDS[b % 4][0]]]

# ---------------------------------------------------------------- the hook: the sunlight that reaches her
FPB = tl["fps"] * 60 / BPM
NOON_T = sum(tl["frames"][0]["T"].values()) / 3


def daylight(beat):
    """Share of sunlight that reaches her at this beat, 1 at noon."""
    fr = tl["frames"][min(len(tl["frames"]) - 1, int(round(beat * FPB)))]
    return min(1.0, sum(fr["T"].values()) / 3 / NOON_T)


# the hook is a 16th-note ostinato (the owner's rhythmic reference, docs/music-reference.md): every 16th is a note,
# the register leaps (high root, its upper neighbour, a low root) make the rhythm, and accents fall 3+3+2.
SCALE = [6, 8, 9, 11, 1, 2, 4]  # F# natural minor


def nearest(pc, lo, hi):
    return next(m for m in range(lo, hi + 1) if m % 12 == pc)


def ostinato(chord_name):
    _, root, pcs = next(c for c in CHORDS if c[0] == chord_name)
    hi = nearest(root, 73, 84)
    up = next(m for m in range(hi + 1, hi + 4) if m % 12 in SCALE)  # the step above the root, in key
    lo = hi - 12
    third = max(m for m in range(hi - 12, hi) if m % 12 == pcs[1])
    fifth = max(m for m in range(hi - 12, hi) if m % 12 == pcs[2])
    H, N, L, T, F = hi, up, lo, third, fifth
    return [H, N, H, L, N, F, T, H, H, N, H, L, N, H, T, F]


ACCENT = {0, 3, 6, 8, 11, 14}  # 3+3+2, twice
day_lead, red_lead, red_low = [], [], []
for b in range(BARS):
    for st, p in enumerate(ostinato(CHORDS[b % 4][0])):
        beat = b * 4 + st / 4
        if b == DROP - 1 and st >= 12:
            continue  # the beat of air before the drop
        day = daylight(beat)
        acc = 1.0 if st in ACCENT else 0.62
        if day > 0.06:
            day_lead.append(n(p, beat, 0.2, acc * day))
        if day < 0.94:
            red_lead.append(n(p, beat, 0.2, acc * (1 - day)))
            if b in DROPS and st in ACCENT:
                red_low.append(n(p - 12, beat, 0.45, 1.0))

# ---------------------------------------------------------------- the photons the air scatters
bell = {}
for ph in tl["photons"]:
    beat = ph["noteBeat"]
    if beat >= BEATS or ph["scatterAt"] is None:
        continue
    key = (beat, chord_tone(beat, 86, ph["col"]))
    bell[key] = min(1.0, bell.get(key, 0) + 0.45)
bell_notes = [n(p, b, 0.35, v) for (b, p), v in sorted(bell.items())]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(k for k, *_ in kick_notes), depth=0.3, attack_seconds=0.002, release_seconds=0.15)
space = Reverb(decay_seconds=1.8, mix=0.22)
big_space = Reverb(decay_seconds=3.5, mix=0.35)
echo = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=4, mix=0.22)

tracks = [
    *dem_tracks(kick_notes),
    Track(name="Rumble", instrument="kick_909", gain=0.15, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
          effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
    Track(name="Impact", instrument="kick_808", gain=0.55, tone=Tone(decay_seconds=2.0, tuning_semitones=-5, brightness=0.6), notes=tuple(impact),
          effects=(Distortion(drive=3.0, mix=0.5), big_space)),
    Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
    Track(name="Hats", instrument="metal_hat", gain=0.24, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hats)),
    Track(name="Hat open", instrument="open_hat", gain=0.26, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.5, tone=Tone(brightness=0.6), notes=tuple(roll), effects=(space,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crash), effects=(space,)),
    Track(name="Sunset riser", instrument="supersaw", gain=0.12, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), space),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=SET * 4.0, value=0.0), AutomationPoint(beat=DROP * 4 - 0.1, value=1.0), AutomationPoint(beat=DROP * 4.0, value=0.0))),)),
    Track(name="Grit bass", instrument="reese_bass", gain=0.35, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
          notes=tuple(grit), effects=(Distortion(drive=4.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
    Track(name="Sky pad", instrument="wavetable_pad", gain=0.22, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pad), release_seconds=0.6, effects=(space, side)),
    # the sunlight that reaches her: the hook
    Track(name="Hook (daylight)", instrument="fm_bell", gain=0.75, tone=Tone(brightness=0.8, decay_seconds=0.16, fm_index=5.5, fm_ratio=1.414),
          notes=tuple(day_lead), effects=(Filter(mode="highpass", cutoff_hz=380), Filter(mode="lowpass", cutoff_hz=3600), Distortion(drive=2.5, mix=0.35),
                                          Delay(time_seconds=0.75 * SPB, feedback=0.25, repeats=2, mix=0.12))),
    Track(name="Hook (red light)", instrument="fm_bell", gain=0.75, tone=Tone(brightness=0.6, decay_seconds=0.18, fm_index=7.0, fm_ratio=1.73),
          notes=tuple(red_lead), effects=(Filter(mode="highpass", cutoff_hz=300), Filter(mode="lowpass", cutoff_hz=2800), Distortion(drive=4.0, mix=0.55),
                                          Delay(time_seconds=0.75 * SPB, feedback=0.25, repeats=2, mix=0.12))),
    Track(name="Hook (red, octave down)", instrument="sync_lead", gain=0.4, tone=Tone(brightness=0.5, cutoff_hz=2400), notes=tuple(red_low),
          effects=(Distortion(drive=3.0, mix=0.4), side)),
    # the photons the air scatters
    Track(name="Photons scattered", instrument="glockenspiel", gain=0.26, pan=0.15, tone=Tone(brightness=0.8, decay_seconds=0.9), notes=tuple(bell_notes), effects=(echo, big_space)),
]

song = Song(title="Why Is the Sky Blue", bpm=float(BPM), beats=float(BEATS), seed=450, master_gain=0.8, tracks=tuple(tracks))


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
