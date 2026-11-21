"""The "dem": a deep, long, distorted kick tuned to the bass note under it.

The kick carries the low end, so it has to agree with the harmony: each hit is tuned to the root of the chord
it sits under (one kick_909 track per root, because tuning is a per-track tone setting). With the kick on the
root, the bass line plays the same note an octave up and there is no separate sub to muddy it.

Level: the distortion sits after the track gain, so at high drive the gain barely changes the level (drive 12: gain 0.8 -> 0.3
is only -2 dB) and the kick buries the melody. Drive 4 at gain 0.3 is ~9 dB lower and still rings ~440 ms.

Measured body pitch of kick_909: tuning -3.5 -> 43.1 Hz, so tuning 0 is about 52.7 Hz (scripts/analyze_kick.py).
"""

import math
from collections import defaultdict

from audio_as_code import Distortion, Filter, Note, Tone, Track

KICK_BODY_HZ = 52.7


def midi_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def tuning_for(midi: int) -> float:
    """Semitones of kick_909 tuning that put its body on this MIDI note."""
    return round(12 * math.log2(midi_hz(midi) / KICK_BODY_HZ), 2)


def dem_tracks(hits, gain: float = 0.3, drive: float = 4.0, name: str = "Kick (dem)") -> list[Track]:
    """hits: (beat, root_midi, duration_beats, velocity). Returns one track per root, named "<name> <note>"."""
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    by_root = defaultdict(list)
    for beat, root, dur, vel in hits:
        by_root[root].append(Note(pitch=33, start=round(beat, 6), duration=round(dur, 6), velocity=vel))
    return [
        Track(name=f"{name} {names[r % 12]}{r // 12 - 1}", instrument="kick_909", gain=gain,
              tone=Tone(decay_seconds=2.0, tuning_semitones=tuning_for(r), brightness=0.75),
              notes=tuple(sorted(notes, key=lambda x: x.start)),
              effects=(Distortion(drive=drive, mix=0.9), Filter(mode="highpass", cutoff_hz=30)))
        for r, notes in sorted(by_root.items())
    ]
