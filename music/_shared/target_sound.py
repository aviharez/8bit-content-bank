"""The owner's target sound (Nov 2026): every instrument of the reference sample, as library patches.

Measured on the full mix of the owner's 67 s sample (harmonic levels of each instrument averaged where it is most
exposed; docs/music-reference.md, "Target sound v3") and fitted by rendering candidate patches and measuring them the
same way. Mean error per harmonic (h1-h12) in brackets.

The sample is close to one synth: a sine, clipped hard into an odd-harmonic, square-like tone, then filtered into the
0.7-2 kHz band. It plays the kick (with a pitch swoop, swoop.py), the lead and the high stabs. The bass is the same
sine, clipped less and low-passed. Only the mid riff is a different sound: detuned saws in octaves.

- STAB: high stabs and the held "whine" (E5 and up). Sine, drive 20 at full input, HP 700 Hz, LP 2 kHz [2.4 dB]
- LEAD: the 16th-note lead (C4-B4). Same patch at lower input, so it clips less [5.7 dB]
- MID: the octave dyads on the 8ths and the E3 stabs (A2-B3). Supersaw, played in octaves, drive 4, LP 2 kHz [2.9 dB]
- BASS: the rolling E1 line. Sine, drive 10 at full input, LP 300 Hz. Matches the odd harmonics; the reference also
  has even ones (h2 -16, h4 -11 dB) that this patch does not make
- There are no real snare or hats: the "hits" in the 1-8 kHz band add most energy at 0.5-2 kHz, i.e. they are the
  stabs' attacks, not noise

Gain staging: the library's Distortion is tanh(drive * x) after the track gain, so the track gain sets how hard a
sound clips, not how loud it is. Each instrument is therefore rendered as its own bus (one Song) and its level is set
after the distortion by that Song's master_gain (`render_buses`).
"""

from __future__ import annotations

import numpy as np

from audio_as_code import Distortion, Filter, Note, Song, Tone, Track
from audio_as_code.render import render_audio


def _band(hp: float, lp: float) -> tuple:
    return (Filter(mode="highpass", cutoff_hz=hp, resonance=0.1), Filter(mode="lowpass", cutoff_hz=lp, resonance=0.2))


def stab_track(notes, name: str = "Stab") -> Track:
    return Track(name=name, instrument="sub_bass", gain=1.0, tone=Tone(brightness=0.3), notes=tuple(notes),
                 release_seconds=0.03, effects=(Distortion(drive=20, mix=1.0), *_band(700, 2000)))


def lead_track(notes, name: str = "Lead") -> Track:
    return Track(name=name, instrument="sub_bass", gain=0.3, tone=Tone(brightness=0.3), notes=tuple(notes),
                 release_seconds=0.03, effects=(Distortion(drive=20, mix=1.0), *_band(700, 2000)))


def mid_track(notes, name: str = "Mid saws") -> Track:
    """Pass both notes of each octave dyad."""
    return Track(name=name, instrument="supersaw", gain=0.6, tone=Tone(brightness=0.8, cutoff_hz=2000, detune_cents=10),
                 notes=tuple(notes), release_seconds=0.08,
                 effects=(Distortion(drive=4, mix=1.0), Filter(mode="lowpass", cutoff_hz=2000, resonance=0.2)))


def bass_track(notes, name: str = "Bass") -> Track:
    return Track(name=name, instrument="sub_bass", gain=1.0, tone=Tone(brightness=1.0), notes=tuple(notes),
                 release_seconds=0.03,
                 effects=(Distortion(drive=10, mix=1.0), Filter(mode="lowpass", cutoff_hz=300, resonance=0.2)))


def render_buses(buses: dict[str, Track], bpm: float, beats: float, faders_db: dict[str, float] | None = None,
                 seed: int = 1, sample_rate: int = 48000):
    """Render each track as its own Song (a bus), scale it after its effects; return (mix, {name: bus}).

    No normalisation per bus, so a fader of 0 dB means the bus as the library renders it."""
    faders_db = faders_db or {}
    out = {}
    for name, track in buses.items():
        song = Song(title=name, bpm=float(bpm), beats=float(beats), seed=seed, master_gain=1.0,
                    sample_rate=sample_rate, tracks=(track,))
        x = np.asarray(render_audio(song, normalize=False).audio, dtype=np.float64)
        out[name] = x * 10 ** (faders_db.get(name, 0.0) / 20)
    n = max(len(v) for v in out.values())
    mix = np.zeros((n, 2))
    for v in out.values():
        mix[: len(v)] += v
    return mix, out


def notes_of(events, vel_scale: float = 1.0):
    """(beat, length_beats, pitch, velocity) -> Notes."""
    return [Note(pitch=int(p), start=round(float(b), 6), duration=round(float(max(0.05, ln)), 6),
                 velocity=float(min(1.0, max(0.05, v * vel_scale)))) for b, ln, p, v in events]
