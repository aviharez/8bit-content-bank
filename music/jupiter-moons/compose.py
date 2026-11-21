"""Jupiter's moons, 1:2:4: soundtrack, composed with Audio as Code.

Drum & bass x techno at 180 BPM, F minor, 24 bars (32 s).
The physics plays the core kit. In the Laplace resonance the three conjunction rates are exactly 2 : 1 : 3:
  Europa-Ganymede (1 per bar)  -> kick on beat 1
  Io-Europa       (2 per bar)  -> snare on beats 2 and 4 (the DnB backbeat, straight from orbital mechanics)
  Io-Ganymede     (3 per bar)  -> metallic triplet percussion (3 against 2)
Everything else (two-step kick, hats, ride, reese, acid, stabs, lead) is groove, named as such.
The last 4 bars return to the intro texture, so the loop runs on.

Run from the repo root:  uv run --locked python music/jupiter-moons/compose.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "music" / "_shared"))

from audio_as_code import (  # noqa: E402
    Automation, AutomationPoint, Chorus, Delay, Distortion, Ducker, Filter, Note, Reverb, Song, Tone, Track, export_midi, render,
)
from mastering import finish_loop  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
PUBLIC = ROOT / "public" / "jupiter-moons"

BPM = 180
BARS = 24
BEATS = BARS * 4
SPB = 60 / BPM

tl = json.loads((PUBLIC / "timeline.json").read_text())
events = tl["events"]


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


# sections (bar indices)
INTRO, BACKBEAT, POLY, BUILD, DROP, OUTRO = range(0, 4), range(4, 8), range(8, 12), range(12, 16), range(16, 20), range(20, 24)
GROOVE = set(POLY) | set(DROP)

# ---------------------------------------------------------------- harmony: Fm, Db, Ab, Eb, two bars each (8-bar cycle)
PADS = [[53, 56, 60, 65], [49, 53, 56, 61], [56, 60, 63, 68], [51, 55, 58, 63]]
ROOTS = [41, 37, 44, 39]  # F2, Db2, Ab2, Eb2
chord_i = lambda b: (b // 2) % 4  # noqa: E731

# ---------------------------------------------------------------- the physics kit
kick_eg, snare_ie, clap_ie, perc_ig = [], [], [], []
for e in events:
    b = int(e["beat"] // 4)
    beat = e["beat"]
    if e["pair"] == "EG":
        kick_eg.append(n(36, beat, 0.5, 0.85 if b in INTRO or b in OUTRO else 1.0))
    elif e["pair"] == "IE":
        if b in INTRO or b in OUTRO:
            continue  # the backbeat arrives with its caption in bar 4, and leaves before the loop
        snare_ie.append(n(38, beat, 0.25, 0.7 if b in BUILD else 0.92))
        if b in DROP or b in POLY:
            clap_ie.append(n(39, beat, 0.25, 0.7))
    else:
        perc_ig.append(n(76, beat, 0.2, 0.9 if b in POLY or b in DROP else 0.5))

# ---------------------------------------------------------------- groove (not physics)
kick_step, hat_off, hat16, ride, snare_roll = [], [], [], [], []
for b in range(BARS):
    t = b * 4
    if b in GROOVE:
        kick_step.append(n(36, t + 2.5, 0.4, 0.9))  # the DnB two-step kick on the "and" of 3
    if b in BACKBEAT or b in GROOVE or b in OUTRO or b in INTRO[2:]:
        hat_off += [n(46, t + q + 0.5, 0.2, 0.5 if b in GROOVE else 0.35) for q in range(4)]  # techno offbeat hat
    if b in DROP:
        hat16 += [n(42, t + s / 4, 0.06, 0.5 if s % 2 == 0 else 0.3) for s in range(16)]
        ride += [n(51, t + e / 2, 0.4, 0.35) for e in range(8)]
snare_roll += [n(38, 15 * 4 + s / 4, 0.1, 0.35 + 0.6 * (s / 15) ** 2) for s in range(16)]
crash = [n(51, 16 * 4, 4, 0.8)]
riser = [n(p, 15 * 4, 3.95, 0.7) for p in (53, 60, 65)]

# ---------------------------------------------------------------- bass
REESE_RHYTHM = [(0, 1.5), (1.75, 0.75), (2.5, 0.5), (3, 1)]
reese, sub = [], []
for b in range(BARS):
    if b in INTRO or b in OUTRO or b in BUILD[2:]:
        continue
    r = ROOTS[chord_i(b)]
    for i, (s, d) in enumerate(REESE_RHYTHM):
        reese.append(n(r + (12 if (b in DROP and i == 2) else 0), b * 4 + s, d, 0.85))
    sub += [n(r - 12, b * 4, 2.4, 0.8), n(r - 12, b * 4 + 2.5, 1.4, 0.75)]
# intro/outro: a long sub swell so the loop seam has bass under it
for b in [0, 2, 20, 22]:
    sub.append(n(ROOTS[chord_i(b)] - 12, b * 4, 7.8, 0.5))

# acid line (techno): 16ths, F minor, accents on the offbeats
ACID = [41, 41, 53, 41, 44, 41, 48, 41, 41, 53, 41, 51, 41, 44, 46, 41]
acid = []
for b in range(BARS):
    if b in BACKBEAT or b in BUILD[:2]:
        continue
    shift = ROOTS[chord_i(b)] - 41
    vel_base = 0.35 if (b in INTRO or b in OUTRO) else 0.7
    acid += [n(p + shift, b * 4 + s / 4, 0.22, vel_base * (1.25 if s % 4 == 2 else 1.0)) for s, p in enumerate(ACID)]

# pad + offbeat stabs
pad = [n(p, b * 4, 7.9, 0.4) for b in range(0, BARS, 2) for p in PADS[chord_i(b)]]
stabs = []
for b in range(BARS):
    if b in POLY or b in DROP:
        for q in (0.5, 1.75, 3.5):
            stabs += [n(p + 12, b * 4 + q, 0.2, 0.55) for p in PADS[chord_i(b)][:3]]

# chiptune lead hook in the drop (F minor), plus a pulse arp in the poly section
HOOK = [
    [(0, 77, 3), (3, 75, 1), (4, 72, 2), (6, 75, 2), (8, 77, 4), (12, 80, 2), (14, 79, 2)],
    [(0, 77, 3), (3, 75, 1), (4, 73, 2), (6, 72, 2), (8, 68, 4), (12, 70, 2), (14, 72, 2)],
    [(0, 75, 3), (3, 77, 1), (4, 79, 2), (6, 80, 2), (8, 84, 4), (12, 82, 2), (14, 80, 2)],
    [(0, 79, 3), (3, 77, 1), (4, 75, 2), (6, 74, 2), (8, 75, 6), (14, 72, 2)],
]
lead = []
for i, b in enumerate(DROP):
    for p, pitch, ln in HOOK[i]:
        lead.append(n(pitch, b * 4 + p / 4, ln / 4 * 0.9, 0.85))
arp = []
for b in POLY:
    tones = PADS[chord_i(b)]
    arp += [n(tones[s % 4] + 24, b * 4 + s / 4, 0.12, 0.45) for s in range(16)]

# ---------------------------------------------------------------- song
side = Ducker(trigger_beats=tuple(sorted({x.start for x in kick_eg + kick_step})), depth=0.6, attack_seconds=0.003, release_seconds=0.14)
rev_s, rev_l = Reverb(decay_seconds=1.0, mix=0.16), Reverb(decay_seconds=2.6, mix=0.32)
d_dot = Delay(time_seconds=0.75 * SPB, feedback=0.35, repeats=5, mix=0.22)

tracks = [
    # physics
    Track(name="Kick: Europa-Ganymede", instrument="kick_909", gain=0.9, tone=Tone(decay_seconds=0.5, tuning_semitones=-3, brightness=0.55), notes=tuple(kick_eg)),
    Track(name="Snare: Io-Europa", instrument="electronic_snare", gain=0.62, tone=Tone(brightness=0.7, decay_seconds=0.3), notes=tuple(snare_ie), effects=(rev_s,)),
    Track(name="Clap: Io-Europa", instrument="clap", gain=0.38, notes=tuple(clap_ie), effects=(Reverb(decay_seconds=0.9, mix=0.25),)),
    Track(name="Perc: Io-Ganymede", instrument="fm_percussion", gain=0.5, pan=0.2, tone=Tone(brightness=0.8), notes=tuple(perc_ig), effects=(Delay(time_seconds=SPB / 3, feedback=0.25, repeats=2, mix=0.18), rev_s)),
    # groove
    Track(name="Kick two-step", instrument="kick_909", gain=0.75, tone=Tone(decay_seconds=0.35, tuning_semitones=-3, brightness=0.55), notes=tuple(kick_step)),
    Track(name="Hat offbeat", instrument="open_hat", gain=0.22, pan=-0.2, notes=tuple(hat_off)),
    Track(name="Hat 16ths", instrument="metal_hat", gain=0.2, pan=0.25, tone=Tone(brightness=0.7, decay_seconds=0.1), notes=tuple(hat16)),
    Track(name="Ride", instrument="electronic_ride", gain=0.14, pan=0.3, tone=Tone(brightness=0.6, decay_seconds=0.8), notes=tuple(ride)),
    Track(name="Snare roll", instrument="electronic_snare", gain=0.45, tone=Tone(brightness=0.6), notes=tuple(snare_roll), effects=(rev_s,)),
    Track(name="Crash", instrument="electronic_ride", gain=0.28, tone=Tone(brightness=0.85, decay_seconds=2.8), notes=tuple(crash), effects=(rev_l,)),
    Track(name="Riser", instrument="supersaw", gain=0.22, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=1.0, detune_cents=25), notes=tuple(riser),
          effects=(Filter(mode="highpass", cutoff_hz=400), rev_l),
          automation=(Automation(parameter="gain", points=(AutomationPoint(beat=60.0, value=0.0), AutomationPoint(beat=63.95, value=1.0), AutomationPoint(beat=64.0, value=0.0))),)),
    Track(name="Reese", instrument="reese_bass", gain=0.4, tone=Tone(brightness=0.5, cutoff_hz=900, resonance=0.3, detune_cents=22), notes=tuple(reese),
          effects=(Distortion(drive=2.0, mix=0.25), side)),
    Track(name="Sub", instrument="sub_bass", gain=0.48, tone=Tone(brightness=0.15), notes=tuple(sub), effects=(side,)),
    Track(name="Acid", instrument="acid_bass", gain=0.26, pan=-0.1, tone=Tone(cutoff_hz=650, resonance=0.72, filter_env_octaves=3, filter_decay_seconds=0.14),
          notes=tuple(acid), effects=(Distortion(drive=2.5, mix=0.3), d_dot, side)),
    Track(name="Pad", instrument="wavetable_pad", gain=0.26, tone=Tone(brightness=0.4, cutoff_hz=2200, detune_cents=14), notes=tuple(pad), release_seconds=0.8,
          effects=(Chorus(), rev_l, side)),
    Track(name="Stabs", instrument="string_machine", gain=0.22, tone=Tone(brightness=0.6, cutoff_hz=3500, detune_cents=8), notes=tuple(stabs), effects=(d_dot, rev_s, side)),
    Track(name="Arp (pulse)", instrument="hoover", gain=0.2, pan=0.3, tone=Tone(brightness=0.55, cutoff_hz=5000, detune_cents=4), notes=tuple(arp), effects=(d_dot, rev_s)),
    Track(name="Lead (sync)", instrument="sync_lead", gain=0.3, tone=Tone(brightness=0.6, cutoff_hz=5500), notes=tuple(lead),
          effects=(Chorus(mix=0.25), d_dot, rev_s, Ducker(trigger_beats=side.trigger_beats, depth=0.25, release_seconds=0.1))),
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
