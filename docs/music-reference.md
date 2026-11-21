# Music reference

The target sound, from the reference the channel owner picked (thel.ab67, "How a zombie outbreak starts", hard techno). Measured with `scripts/analyze_audio.py`; the file itself is not kept in the repo.

| Measure | Reference | Jupiter's Moons v2 |
|---|---|---|
| Tempo (onset autocorrelation, all bands agree) | 143.6 BPM (71.8 half) | 150 BPM (75 half) |
| Key estimate | A minor | C major (relative of A minor, same notes; written in A minor) |
| Loudness range | 2.0 LU | 2.7 LU |
| Integrated loudness | -14.1 LUFS | -14.0 LUFS |
| Energy: sub / bass / mid / presence / air | 6 / 18 / 45 / 19 / 11 % | 17 / 33 / 24 / 10 / 15 % |

What makes it work, and what we copy:
- **One groove, one grid.** Kick, hats and bass all report the same tempo. Every layer, including the physics, has to land on the same 8th or 16th grid. (Jupiter v1 failed this: a physics kick, a two-step kick and triplet percussion fought each other, and its kick periodicity measured 120 BPM in a 180 BPM song.)
- **Four-on-the-floor, distorted, with rumble.** Rolling offbeat bass ducked under the kick, clap on 2 and 4, 16th hats, offbeat open hat.
- **Dense and level.** Loudness range around 2-3 LU: no long sparse intros; the intro is the groove, filtered.
- **Mid-heavy.** Distorted riffs and leads carry the track; keep sub and bass from dominating (still our gap).
- **Physics plays the riff, not a second drum kit.** Map events to notes of one chord, quantised to the grid by choosing the time scale (e.g. one Europa-Ganymede cycle = 6 beats).
