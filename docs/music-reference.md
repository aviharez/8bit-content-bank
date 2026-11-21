# Music reference

This is the reference for the hard-techno style (Jupiter's Moons). It is one style, not the house style: what every video shares is the tuned "dem" kick, a bass locked to it, and all parts in one key and grid (see CLAUDE.md, Music direction).

The target sound, from the reference the channel owner picked (thel.ab67, "How a zombie outbreak starts", hard techno). Measured with `scripts/analyze_audio.py`; the file itself is not kept in the repo.

| Measure | Reference | Jupiter's Moons v2.1 |
|---|---|---|
| Tempo (onset autocorrelation, all bands agree) | 143.6 BPM (71.8 half) | 150 BPM (75 half) |
| Key estimate | A minor | C major (relative of A minor, same notes; written in A minor) |
| Loudness range | 2.0 LU | 3.3 LU |
| Integrated loudness | -14.1 LUFS | -14.0 LUFS |
| Energy: sub / bass / mid / presence / air | 6 / 18 / 45 / 19 / 11 % | 4 / 34 / 41 / 13 / 6 % |
| Low end across a beat, lowest / highest (30-150 Hz) | 0.68-0.77 (never drops) | 0.69-0.73 (was 0.17: kick then a hole) |
| Bass grit: energy 150-600 Hz / 30-150 Hz | 1.27-1.58 | 0.99-1.08 (was 0.43: clean sub) |
| Bass notes (pitch track) | F1 41%, D1, F2, F#2, E2 | F1 77%, D1, F#2 |
| Kick ("dem") body pitch / sweep | 43 Hz, from ~59 Hz | 43 Hz (kick_909, tuning -3.5) |
| Kick tail, -20 dB point | ~320 ms+ (rings most of the beat) | ~320 ms (decay 2.0 s, distortion, 0.9-beat note) |

What makes it work, and what we copy:
- **One groove, one grid.** Kick, hats and bass all report the same tempo. Every layer, including the physics, has to land on the same 8th or 16th grid. (Jupiter v1 failed this: a physics kick, a two-step kick and triplet percussion fought each other, and its kick periodicity measured 120 BPM in a 180 BPM song.)
- **The "dem" is the bass drum.** The reference's kick is tuned to about F1 (43 Hz), sweeps down from ~59 Hz and rings for most of the beat. It is the low end; a separate sub only muddies it. Check with `python3 scripts/analyze_kick.py`.
- **The low end is a wall, not a pulse.** The low end never drops below ~70% across a beat: legato 16ths, loudest on the offbeat, a clean sub under a heavily distorted reese, light sidechain (depth ~0.25). A short, punchy kick sits on top; it does not carry the low end.
- **Dark half-step bass line.** F, E, D under an A minor riff (Fmaj7 / Em / Dm), like the reference's F-E movement.
- **Four-on-the-floor kick with a little rumble,** clap on 2 and 4, 16th hats, offbeat open hat.
- Measure the bass with the low-end and grit rows above (`scripts/analyze_bass.py <wav> <bpm> <start> <end>`; `scripts/analyze_audio.py` covers tempo, balance and key).
- **Dense and level.** Loudness range around 2-3 LU: no long sparse intros; the intro is the groove, filtered.
- **Mid-heavy.** Distorted riffs and leads carry the track; keep sub and bass from dominating (still our gap).
- **Physics plays the riff, not a second drum kit.** Map events to notes of one chord, quantised to the grid by choosing the time scale (e.g. one Europa-Ganymede cycle = 6 beats).
