"""The channel's hard-techno groove, shared by every soundtrack (first built for Jupiter's Moons).

Recipe (see docs/music-reference.md):
- the "dem": kick_909 tuned -3.5 (~43 Hz), decay 2.0, heavy distortion, 0.9-beat notes so it rings ~300 ms;
  a reverb-washed rumble under it; no separate sub
- a distorted reese wall in legato 16ths (loudest on the offbeat), on a dark half-step line
- clap on 2 and 4, 16th hats, offbeat open hat, a dark pad that follows the bass, roll + riser into the drop

Composers build the note lists with the helpers here (so the physics can own any of them, e.g. the quartz
stages play the kick and hats) and pass them to groove_tracks. Track names and gains match Jupiter's Moons.
"""

from audio_as_code import Automation, AutomationPoint, Distortion, Ducker, Filter, Note, Reverb, Tone, Track


def n(pitch, start, dur, vel=0.8):
    return Note(pitch=int(pitch), start=round(float(start), 6), duration=round(float(dur), 6), velocity=float(min(1.0, max(0.01, vel))))


def kick(beat: float, vel: float = 1.0) -> Note:
    """One "dem": a long note so the tuned tail rings for most of the beat."""
    return n(33, beat, 0.9, vel)


def hats16(bar: int, vel: float = 1.0) -> list[Note]:
    return [n(42, bar * 4 + s / 4, 0.06, (0.55 if s % 4 == 2 else 0.32) * vel) for s in range(16)]


def open_hats(bar: int, vel: float = 0.55) -> list[Note]:
    return [n(46, bar * 4 + q + 0.5, 0.22, vel) for q in range(4)]


def claps(bar: int) -> list[Note]:
    return [n(39, bar * 4 + 1, 0.25, 0.85), n(39, bar * 4 + 3, 0.25, 0.9)]


def roll(bar: int) -> list[Note]:
    """A one-bar snare roll, 16ths, swelling into the next downbeat."""
    return [n(38, bar * 4 + s / 4, 0.1, 0.3 + 0.65 * (s / 15) ** 2) for s in range(16)]


def bass_wall(root_of_bar, bars, soft_bars=(), quiet_bars=(), octave: int = 12) -> list[Note]:
    """Legato 16ths, loudest on the offbeat: the low end never drops (reference: >= ~70% across a beat)."""
    out = []
    for b in bars:
        scale = 0.8 if b in soft_bars else 0.7 if b in quiet_bars else 1.0
        for q in range(4):
            for s16 in range(4):
                out.append(n(root_of_bar(b) + octave, b * 4 + q + s16 / 4, 0.24, (0.62, 0.8, 1.0, 0.82)[s16] * scale))
    return out


def pad(root_of_bar, chords: dict, bars, vel: float = 0.45) -> list[Note]:
    return [n(p, b * 4, 3.95, vel) for b in bars for p in chords[root_of_bar(b)]]


def groove_tracks(*, kicks, clap, hat16, hat_open, grit, pads, rolls=(), crashes=(), riser=(), riser_span=None,
                  kick_gain=0.85, grit_gain=0.85, hat_gain=0.26):
    """Return (tracks, side) where side is the kick-keyed Ducker for anything else that should pump."""
    side = Ducker(trigger_beats=tuple(x.start for x in kicks), depth=0.45, attack_seconds=0.002, release_seconds=0.18)
    space = Reverb(decay_seconds=1.8, mix=0.22)
    rumble = [n(x.pitch, x.start, x.duration, x.velocity * 0.9) for x in kicks]
    tracks = [
        Track(name="Kick (dem)", instrument="kick_909", gain=kick_gain, tone=Tone(decay_seconds=2.0, tuning_semitones=-3.5, brightness=0.75),
              notes=tuple(kicks), effects=(Distortion(drive=12.0, mix=0.9), Filter(mode="highpass", cutoff_hz=36))),
        Track(name="Rumble", instrument="kick_909", gain=0.28, tone=Tone(decay_seconds=0.6, tuning_semitones=-2, brightness=0.4), notes=tuple(rumble),
              effects=(Reverb(decay_seconds=1.4, mix=1.0), Distortion(drive=6.0, mix=0.8), Filter(mode="lowpass", cutoff_hz=170), side)),
        Track(name="Clap", instrument="clap", gain=0.62, notes=tuple(clap), effects=(Reverb(decay_seconds=1.1, mix=0.3),)),
        Track(name="Hat 16ths", instrument="metal_hat", gain=hat_gain, pan=0.2, tone=Tone(brightness=0.75, decay_seconds=0.1), notes=tuple(hat16)),
        Track(name="Hat open", instrument="open_hat", gain=0.3, pan=-0.15, tone=Tone(brightness=0.7), notes=tuple(hat_open)),
        Track(name="Grit bass", instrument="reese_bass", gain=grit_gain, tone=Tone(brightness=0.7, cutoff_hz=1800, resonance=0.4, detune_cents=22),
              notes=tuple(grit), effects=(Distortion(drive=10.0, mix=0.85), Filter(mode="highpass", cutoff_hz=110), side)),
        Track(name="Pad", instrument="wavetable_pad", gain=0.26, tone=Tone(brightness=0.5, cutoff_hz=2600, detune_cents=14), notes=tuple(pads),
              release_seconds=0.6, effects=(space, side)),
    ]
    if rolls:
        tracks.append(Track(name="Snare roll", instrument="electronic_snare", gain=0.45, tone=Tone(brightness=0.6), notes=tuple(rolls), effects=(space,)))
    if crashes:
        tracks.append(Track(name="Crash", instrument="electronic_ride", gain=0.25, tone=Tone(brightness=0.85, decay_seconds=2.5), notes=tuple(crashes), effects=(space,)))
    if riser:
        a, b = riser_span
        tracks.append(Track(name="Riser", instrument="supersaw", gain=0.2, tone=Tone(brightness=0.6, glide_semitones=-12, glide_seconds=2.0, detune_cents=25),
                            notes=tuple(riser), effects=(Filter(mode="highpass", cutoff_hz=500), space),
                            automation=(Automation(parameter="gain", points=(AutomationPoint(beat=a, value=0.0), AutomationPoint(beat=b - 0.1, value=1.0), AutomationPoint(beat=b, value=0.0))),)))
    return tracks, side
