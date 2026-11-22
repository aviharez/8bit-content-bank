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

## Second reference: the owner's rhythmic sample (Nov 2026)

A 67 s sample the owner shared to show what "rhythmic" means (the WAV is theirs and is not kept in the repo; measured with `/tmp`-style onset folding, numbers below).

| Measure | Sample |
|---|---|
| Tempo | 143.3 BPM, steady through every section |
| Bass | rolling: an onset on nearly every 16th below 150 Hz, root E1 with a half step (F) above it (E Phrygian, dark) |
| Lead | a 16th-note FM ostinato: every 16th is a note, e.g. `B5 C6 B5 G4 C6 F5 A5 B5`, repeating each half bar. A small range around one high note, its half-step neighbour, and a leap down to a low note; the leaps make the rhythm |
| Accents (1-5 kHz, folded on the bar) | syncopated: 3+3+2 / 3+3+4 groupings (steps 0, 3, 6, 8, 10/11, 14), not straight 8ths |
| Highs | almost nothing above 5 kHz (~1% of the energy): no hat sizzle; the rhythm comes from the bass and the lead |
| Energy | 40-70% below 150 Hz, 25-50% at 150 Hz-1 kHz |
| Sections | contrast: bursts, a dense ostinato, a sparse breakdown of stabs, isolated sub hits with gaps, a gated finale (4 s loudness swings of up to 8 dB) |
| Sound | FM leads with non-integer ratios (~1.41, 1.73), bandpassed ~380-3600 Hz, crushed; clipped sine subs with a fast pitch drop |

What we copy: **the melody is rhythmic.** The hook is a 16th-note ostinato on `fm_bell` (`fm_ratio` 1.414, `fm_index` ~5.5, decay ~0.16 s, highpass 380 Hz, lowpass 3.6 kHz), accents on 3+3+2, a high root, its step above in key (a half step where the key gives one) and a leap to the low root. The rolling 16th reese stays under it. Tried on a sky-colour video that was later dropped.

## Target sound v2: the owner's sample, decomposed (Nov 2026)

The owner had the same 67 s sample separated into stems (Demucs) and transcribed in another session (score.json:
drum hits per 16th, bass notes, other notes; calibration.json: per-stem spectrum, level and width). Those files are
the owner's and are not kept here. What they say, checked against the WAV:

| Part | What it is |
|---|---|
| Tempo / grid | 143.28 BPM, 40 bars on a strict 16th grid |
| **Kick ("the swoop")** | the part the owner likes most. A pitched, driven sine: ~275 Hz falling to ~87 Hz (F2) with a 28 ms time constant, full level for ~90 ms, then gone in ~35 ms. Odd harmonics from the drive (h3 about -7 dB). Not a long sub boom: a short, round punch that sits above the bass and plays on a phone as it is. In 8th-note runs each hit rings on to the next |
| Kick pattern | changes by section: syncopated 8th runs in the intro (`x.x.....x.x.x.x.`), four on the floor in the main part, 3+3+2 (`X..X..X.X.x.x...`) and near-empty bars in the breakdowns |
| Bass | its own line under the kick, not the kick's root: a sine plus a filtered saw an octave up, rolling around E1 with chromatic 16th pickups (`D#1 E1 F1 F#1` into a held `E1`), and octave jumps to E2/F2. E Phrygian: the E-F half step is the colour |
| Snare / hats | busy 8th snares in the intro, then 2 and 4; hats on the offbeat 8ths; almost nothing above 5 kHz |
| Mid / lead | octave dyads on the 8ths (E2/E3, B2/B3, C3/C4, D3 ...) carry the 150 Hz-1 kHz band; the 16th FM ostinato (above) sits on top |
| Balance | the drums, bass and other stems measure -23.6, -21.9 and -22.1 dB RMS: three equal parts. Main section energy: 36-42% below 150 Hz, 40-48% at 150 Hz-1 kHz, 15-20% at 1-5 kHz |

How this differs from the house sound in CLAUDE.md: the kick is short and pitched at ~87 Hz instead of a 46 Hz,
300 ms "dem" tuned to the chord root; the bass is a separate rolling line instead of following the kick; there is
no reese wall; the drum pattern changes by section instead of staying four on the floor.

Built from the library's instruments: `music/_shared/swoop.py` (sub_bass with a +20 semitone, 0.03 s glide and drive
14; note the drive sits after the gain, so the gain still sets its level: ~0.09 keeps it level with the bass) and the
sound check `music/_demo/target-v2/compose.py` (16 bars at our 150 BPM clock). Measured against the sample:
kick f0 234/188/142/115/99 Hz at 5/20/40/60/90 ms (sample's fitted kick 216/178/131/108/93); main-section energy
41-46% / 36-41% / 16-20% (sample 36-42% / 40-48% / 15-20%). `scripts/analyze_swoop.py` measures a kick the same way.
