"""The "swoop" kick: the owner's target kick (Nov 2026), measured on the reference mix itself.

Measured on the full mix of the owner's sample (32 four-on-the-floor hits, bars 4-11, averaged), not on a Demucs drum
stem: the stem had cut the kick's long tail off into the bass stem, and an earlier fit read that as "full level for
~90 ms, then gone". What the mix shows:
- a pitched, hard-clipped sine: it starts near 250 Hz and falls to E2 (82 Hz, the key's root) with a ~35 ms time
  constant: 150/109/93/87/83/83 Hz at 30/60/100/150/250/350 ms
- it does not decay: the level stays within ~2 dB until the next hit, so each kick holds a whole beat (or until the
  next hit in faster runs). The kick is the low-mid tone of the track, not a short punch
- harmonics at 150 ms: h2 -10, h3 -9, h4 -9, h5 -12, h6 -14 dB (the clip is asymmetric, so even harmonics too)

Built here from the library's own `sub_bass` (a sine with an exponential glide inside each note) and a Distortion:
glide +19 semitones over 0.035 s, drive 20, each note held to the next hit (at most two beats), a 0.02 s release.
Measured the same way: 152/113/91/84/82/82 Hz, level flat within 1 dB. Gap left: the library's distortion is
symmetric, so h2/h4 sit near -35 dB instead of -10. The owner picked this version (A, E2) over a deep E1 variant
in an A/B on 2026-11-22.

Unlike the "dem" (dem.py), this kick carries no sub: at 82 Hz with strong harmonics a phone speaker plays it as it
is, so there is no separate top layer. The drive sits after the gain, so `gain` still sets its level.
"""

from audio_as_code import Distortion, Filter, Note, Tone, Track

SWOOP_PITCH = 40  # E2, 82.4 Hz: where the reference's kick settles
# A lone hit in the reference's 3+3+2 bars (bar 16, step 8) rings the full two beats to the next one. Longer gaps
# cannot be read reliably (the bass and the mid riff share the 70-100 Hz band), so the hold is capped at two beats.
MAX_HOLD_STEPS = 8


def swoop_track(hits, name: str = "Kick (swoop)", gain: float = 0.5, pitch: int = SWOOP_PITCH, drive: float = 20.0) -> Track:
    """hits: (beat, velocity, length_beats), as made by swoop_hits."""
    notes = tuple(Note(pitch=pitch, start=round(float(b), 6), duration=round(float(max(0.1, ln)), 6), velocity=float(v))
                  for b, v, ln in sorted(hits))
    return Track(name=name, instrument="sub_bass", gain=gain,
                 tone=Tone(glide_semitones=19.0, glide_seconds=0.035, brightness=0.7),
                 notes=notes, release_seconds=0.02,
                 effects=(Distortion(drive=drive, mix=1.0), Filter(mode="highpass", cutoff_hz=35)))


def swoop_hits(steps, velocities=None, end_step=None):
    """16th-step positions -> hits. Each hit holds until the next one (98% of the gap), at most MAX_HOLD_STEPS;
    the last hit holds until end_step if given (e.g. the loop length, so it rings into the first bar)."""
    steps = sorted(steps)
    vel = velocities or {}
    out = []
    for i, s in enumerate(steps):
        nxt = steps[i + 1] if i + 1 < len(steps) else end_step
        gap = min(nxt - s, MAX_HOLD_STEPS) if nxt is not None else 4
        out.append((s / 4, vel.get(s, 1.0), gap / 4 * 0.98))
    return out
