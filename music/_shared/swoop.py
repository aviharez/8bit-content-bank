"""The "swoop" kick: the owner's target kick (Nov 2026), fitted on the reference's drum stem.

Measured on the reference (another session's Demucs drum stem, averaged hits, reconstruct_v2 / fit_swoop):
- a pitched, driven sine: it starts near 275 Hz and falls to about 87 Hz (F2) with a 28 ms time constant
- it holds full level for ~90 ms, then dies fast (~35 ms): a short, round punch, not a long boom
- odd harmonics from hard drive: h3 about -7 to -13 dB, h5 about -15 to -23 dB, even harmonics weaker
- in runs of 8th notes each hit rings on until the next one

Built here from the library's own `sub_bass` (a sine with an exponential glide inside each note) and a Distortion:
glide +20 semitones over 0.03 s (275 -> 87 Hz), drive 14, a 0.15-beat note and a 0.12 s release at 143-150 BPM.
Measured with /tmp-style averaging (scripts/analyze_swoop.py): f0 218/185/137/113/96/91 Hz at 5/20/40/60/90/120 ms
(target 216/178/131/108/93/87), h3 -12 dB and h5 -22 dB at 40 ms (target -13, -23), level -1/-15 dB at 120/160 ms
(target -7/-18).

Unlike the "dem" (dem.py), this kick is not tuned to the chord root and carries no sub: at 87 Hz with strong odd
harmonics, a phone speaker plays it as it is, so there is no separate top layer. The bass rolls underneath it.
"""

from audio_as_code import Distortion, Filter, Note, Tone, Track

SWOOP_PITCH = 41  # F2, 87.3 Hz: where the reference's kick settles


def swoop_track(hits, name: str = "Kick (swoop)", gain: float = 0.55, pitch: int = SWOOP_PITCH, drive: float = 14.0) -> Track:
    """hits: (beat, velocity, length_beats). length 0.15 for a lone hit; up to the next hit for 8th-note runs."""
    notes = tuple(Note(pitch=pitch, start=round(float(b), 6), duration=round(float(max(0.1, ln)), 6), velocity=float(v))
                  for b, v, ln in sorted(hits))
    return Track(name=name, instrument="sub_bass", gain=gain,
                 tone=Tone(glide_semitones=20.0, glide_seconds=0.03, brightness=0.7),
                 notes=notes, release_seconds=0.12,
                 effects=(Distortion(drive=drive, mix=1.0), Filter(mode="highpass", cutoff_hz=35)))


def swoop_hits(steps, velocities=None, length: float = 0.15):
    """16th-step positions -> hits; a hit followed by another within two 16ths rings on until it."""
    steps = sorted(steps)
    vel = velocities or {}
    out = []
    for i, s in enumerate(steps):
        nxt = steps[i + 1] if i + 1 < len(steps) else None
        ln = (nxt - s) / 4 if nxt is not None and nxt - s <= 2 else length
        out.append((s / 4, vel.get(s, 1.0), ln))
    return out
