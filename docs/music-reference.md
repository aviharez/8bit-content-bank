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
| **Kick ("the swoop")** | the part the owner likes most. A pitched, hard-clipped sine: ~250 Hz falling to E2 (82 Hz, the root) with a ~35 ms time constant (150/109/93/87/83/83 Hz at 30/60/100/150/250/350 ms), then **held at full level until the next hit** (within ~2 dB across a beat). It is the track's low-mid tone, not a short punch. Harmonics h2-h6 -10, -9, -9, -12, -14 dB (asymmetric clip). Measured on the full mix: the Demucs drum stem had lost the tail to the bass stem, which first read as "gone after ~90 ms" |
| Kick pattern | changes by section: syncopated 8th runs in the intro (`x.x.....x.x.x.x.`), four on the floor in the main part, 3+3+2 (`X..X..X.X.x.x...`) and near-empty bars in the breakdowns |
| Bass | its own line under the kick, not the kick's root: a sine plus a filtered saw an octave up, rolling around E1 with chromatic 16th pickups (`D#1 E1 F1 F#1` into a held `E1`), and octave jumps to E2/F2. E Phrygian: the E-F half step is the colour |
| Snare / hats | busy 8th snares in the intro, then 2 and 4; hats on the offbeat 8ths; almost nothing above 5 kHz |
| Mid / lead | octave dyads on the 8ths (E2/E3, B2/B3, C3/C4, D3 ...) carry the 150 Hz-1 kHz band. The lead is not FM: its stem fits 3 detuned saws low-passed at ~6x the note, a 12 ms attack and a pluck decay (harmonics 0, -8, -6, -17, -14 dB), playing octave-doubled stabs on 3+3+2 (steps 0, 3, 6 of each half bar), held 2-3 sixteenths, stepping down through the chord. The FM ostinato guessed from the first analysis sounded bad to the owner; don't use it |
| Balance | the drums, bass and other stems measure -23.6, -21.9 and -22.1 dB RMS: three equal parts. Main section energy: 36-42% below 150 Hz, 40-48% at 150 Hz-1 kHz, 15-20% at 1-5 kHz |

How this differs from the house sound in CLAUDE.md: the kick is pitched at 82 Hz (E2) and held to the next hit instead of a
46 Hz, 300 ms "dem" with a top layer; the bass is a separate rolling line instead of following the kick; there is
no reese wall; the drum pattern changes by section instead of staying four on the floor.

Built from the library's instruments: `music/_shared/swoop.py` (sub_bass, E2, +19 semitone glide over 0.035 s, drive 20,
each note held to the next hit, at most two beats). The owner chose it in an A/B on 2026-11-22 over a deep variant that
falls to E1 like Gemini's reconstruction. Measured alone: 152/113/91/84/82/82 Hz at 30/60/100/150/250/350 ms, level flat
within 1 dB; the gap left is the even harmonics (h2/h4 near -35 dB: the library's distortion is symmetric). The drive sits
after the gain, so the gain still sets its level: in the sound check `music/_demo/target-v2/compose.py` (16 bars, 150 BPM)
gain 0.027 gives main-section energy 40% / 45% / 15% below 150 Hz / 150 Hz-1 kHz / 1-5 kHz (sample 39 / 42 / 19).
`scripts/analyze_swoop.py` measures a kick the same way. Still to re-check on the full mix: the bass (its "saw an octave up"
may be the kick's held E2 that leaked into the bass stem), the lead and the stabs.

## Target sound v3: every instrument, measured on the full mix (Nov 2026)

The stems turned out to mislead (Demucs moved the kick's held tail into the bass stem, and its "drums" stem held the
stabs' attacks), so v3 measures each instrument on the full mix, where it is most exposed, and fits library patches by
rendering candidates and measuring them the same way. The patches are in `music/_shared/target_sound.py`; the kick is
`music/_shared/swoop.py`.

| Instrument | Where measured | What it is | Patch (mean error per harmonic, h1-h12) |
|---|---|---|---|
| Kick | bars 4-11, 32 hits | sine swooping ~250 Hz -> E2, hard-clipped, held to the next hit | swoop.py (owner picked it in an A/B) |
| High stabs, held whine | bars 0, 1, 24, 26 (E5) | clean odd harmonics: h3 -5, h5 -20, h7 -21 dB, 2% energy between harmonics | clipped sine, HP 700 Hz, LP 2 kHz (2.4 dB) |
| Lead | bars 16-17 (E4, G4), 16th notes | odd-dominant, h3 as loud as h1 (the band 0.7-2 kHz is lifted) | same patch, clipped less (5.7 dB) |
| Mid riff, E3 stabs | bars 4-11 (D3), 20-21 (E3) | all harmonics, much energy between them: detuned saws in octaves | supersaw in octaves, drive 4, LP 2 kHz (2.9 dB) |
| Bass | bar 28 (no kick) | E1, held flat; h3 -12, h5 -9 | clipped sine, drive 10, LP 300 Hz; misses the even harmonics |
| Snare / hats | onsets folded on the grid | none: the hits in 1-8 kHz add most energy at 0.5-2 kHz, i.e. stab attacks, not noise | none |

So the sample is close to one synth: a clipped sine filtered into 0.7-2 kHz, played as kick, lead and stabs, over
detuned saws in the mids. **Gain staging matters:** the library's Distortion is tanh(drive * x) after the track gain, so
turning a clipped sound down with its track gain un-clips it (the v2 sound check's kick at gain 0.027 is a clean sine,
not the kick the owner picked). Render each clipped instrument as its own bus and set its level after the distortion
(`target_sound.render_buses`, one Song per bus, level by master_gain or after rendering).

`music/_demo/sample-replica/compose.py` re-plays all 40 bars from the transcription with these patches, fits the bus
levels per 4-bar block to the sample (the transcription has no dynamics) and writes `out/sample-replica-AB.wav`
(sample, then replica, per section, level-matched on a phone). Band balance per section after the fit, sample vs
replica: intro 29/42/23/6 vs 30/39/26/5, main 3/29/48/21 vs 2/31/48/20, lead 10/38/36/17 vs 12/29/43/16,
breakdown 20/13/52/15 vs 22/13/51/15, bass section 43/24/27/6 vs 50/27/20/4 (% in 20-60 / 60-150 / 150-1k / 1-5k Hz).
The notes come from an automatic transcription and are only as right as it is.

**More parts, same instruments (2026-11-22).** The owner heard about two parts at a time in the replica where the
sample has more; new timbres, width and percussion layers were tried and rejected (the instruments stay as they are).
The replica now adds three parts played by the approved patches: a harmony a diatonic third under the lead (lead
patch), triad stabs of the bass note's chord on the 3+3+2 accents (stab patch, one bus per voice so the clipping does
not intermodulate), and an offbeat octave pulse on the bass root (mid saws patch). Each sits a fixed distance in
phone-band RMS under the loudest core part of its 4-bar block (harmony -6, chords -6, pulse -9 dB). Parts audible at
once (within 15 dB of the loudest, 150 Hz-5 kHz), mean per 16th: intro 1.9 -> 3.2, main 1.8 -> 3.7, lead
2.1 -> 3.9, breakdown 1.5 -> 3.0, drop 2.0 -> 3.4, outro 2.7 -> 4.8. Cost: the mix leans more to 150 Hz-1 kHz
(main 58% vs the sample's 48%).
The owner then asked for a little more kick and bass: both get +3 dB on top of the fit (`BOOST_DB`), which brings the
low end back near the sample in the intro and main part (main 2/24/55/18 vs 3/29/48/21) and a little over it in the
lead, breakdown and drop sections.
