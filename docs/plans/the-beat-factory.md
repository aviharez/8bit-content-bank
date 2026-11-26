# Plan: The Beat Factory (Pilot 001, Beat Factory pillar)

Slug `the-beat-factory`, composition `TheBeatFactory` (cover `TheBeatFactoryCover`), Remotion folder
`beat-factory`. Brief: `docs/plans/entertainment-pilots.md`. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") and `docs/production-workflow.md` ask. Status: built, waiting for the owner.

## Brief

- **Hook (first 2 s):** "THIS FACTORY / RUNS ON TECHNO" over a dark night-shift factory that is already working:
  the press slams on frame 0, the belt jerks forward, the left robot arm hits its first lamp.
- **Viewer question:** will this machine reach full power?
- **Stakes:** the REACTOR POWER meter, 0 to 100 %. Every crate the line finishes is fed into the reactor (+1/60).
- **Payoff (bar 17, 25.6 s):** the meter hits 100 % at the end of bar 15, bar 16 is a held breath (every machine
  stops, only the reactor's charge ring ticks), and on bar 17 beat 1 the reactor ignites: the dark factory lights
  up, MAX POWER, and every machine plays in lock-step (the drop). Then the reactor cools down and the factory
  returns to its opening state for the loop.
- **Setting:** one factory hall seen from the front and above (fixed camera, slow drift), a single production lane
  running from the bottom of the frame (crates come in) to the top (the reactor).
- **Mechanics are authored, not physics:** an indexing transfer line on the 16th grid. Nothing claims to be
  measured; the meter is authored progress. No narration, no lesson, no code card.
- **Runtime:** 24 bars, 38.4 s. Assets: none (all geometry, sound and type made in code; fonts OFL).

## Clock

150 BPM at 30 fps: 12 frames a beat, a 16th is exactly 3 frames, so every event sits on a whole frame.
24 bars = 96 beats = 1152 frames = 38.4 s. The beat is the time authority; frames are derived (`frame = beat * 12`).

## Entities, actions, sounds (every audible part has a visible cause)

| Entity (screen position) | Visible action (contact frame) | Sound | Grid |
|---|---|---|---|
| Hydraulic press (centre, amber) | ram slams onto the crate under it, recoils, winds back up | **Kick**: the swoop (`sub_bass` glide + drive), tuned to the bar's chord root | Every beat; none in bar 16 (ram held up) |
| Conveyor belt (centre lane) | the indexing belt jerks the whole line forward a third of a slot; rollers flash | **Bass**: `acid_bass`, chord root (+ octave/5th in later sections); filter opens as the reactor fills | The three 16ths after each kick; none in bar 16 (belt stopped) |
| Left robot arm + lamp column (left of lane, cyan) | the arm's head slides to a lamp and jabs it; the lamp lights | **Hook call**: clipped-sine lead (`target_sound.lead_track`); lamp height = pitch (5 chord tones, low at the bottom) | 8ths/16ths |
| Right robot arm + lamp column (right, magenta) | same, the answer | **Hook answer**: clipped-sine lead, its own bus, 2 chord tones higher | 8ths/16ths |
| Laser cutter on a gantry (upper lane, red) | a laser pulse seals the crate, sparks | **Hats**: `metal_hat` | off-beat 8ths, then 16ths |
| Sorter gate (top of the lane, green) | the diverter snaps left/right, routing crates to the reactor's two intakes | **Stab + clap**: Fm-scale triad on `supersaw` (target-sound mid patch, one bus per voice) + `clap` | Beats 2 and 4 |
| Reactor (top, cyan core) | core glow level (steps at each chord change, brighter as it fills) | **Whine**: held high clipped sine (`target_sound.stab_track`), a chord tone; louder bus per section | Held, re-struck at each bar line |
| Reactor charge ring (24 lamps round the reactor) | one lamp lights per hit | **Snare roll**: `electronic_snare`, rising | Bar 15 8ths, bar 16 16ths |

Grouping: on the beat the press slam and a crate entering the reactor coincide; the crate entering has no sound of
its own (it is the same instant as the kick; the meter ticks with it). The camera drift and the crates settling
are incidental motion.

## Section plan (music)

F Aeolian (F G Ab Bb C Db Eb). Chords: Fm, Db, Eb, Cm, Ab, Bbm; every pitched note is a tone of its bar's chord.

| Bars | Section | Chords | Hook (L = left arm call, R = right arm answer) | Bass (16ths 2-4 of each beat) | Enters / leaves |
|---|---|---|---|---|---|
| 1-4 | Start: factory online | Fm Db Eb Cm | A, A', A, A'' (L only) | root, root, root; filter 520 Hz | Kick, bass, hook, whine from frame 0 |
| 5-8 | Sorter: second lane | Fm Db Ab Eb | A (L), B (R), A' (L), B' (R): call and answer | root, octave, root; 700 Hz | Sorter snaps: stab + clap on 2 and 4 |
| 9-12 | Cutter: denser routes | Bbm Db Eb Cm | X, X', X, X': L calls steps 0-7, R answers 8-15, a lamp higher | root, octave, root; last beat root, 5th, octave; 950 Hz | Cutter: hats on off-beat 8ths (9-10), 16ths (11-12) |
| 13-16 | Build: filling the reactor | Db Bbm Cm Eb | rising ladders (13, 14), 8ths L/R ping-pong (15); bar 16 both arms hold their top lamp | octave, root, 5th; 1300 Hz | Hats 16ths (13-15); snare roll 8ths (15), 16ths (16); bar 16 = hold: no kick, bass, hats, stabs |
| 17-20 | Drop: MAX POWER | Fm Db Eb Cm | C, C, C', C'': both arms on alternate 16ths (L even, R odd) | octave, root, octave; 2400 Hz | Everything; hats every 16th; whine at full |
| 21-24 | Cooldown and reset | Db Ab Eb Cm | A (L), B (R), A' (L), A'' (L) into bar 1 | root, root, root; 620 Hz | Bars 21-22 stabs + off-beat hats; bars 23-24 only kick, bass, hook, whine (the intro texture) |

Kick and the 16ths never compete: kick on the beat, bass on the other three 16ths, hats on 16ths, hook on 8ths
and 16ths, stabs on beats 2 and 4. One grid. Something enters or leaves at every section line (4 bars), the hook
changes every bar or two, at least three parts play at all times (kick, bass, hook from frame 0).

## Bar-by-bar event sheet (all 24 bars; steps are 16ths 0-15 inside the bar)

| Bar | Chord | Press (kick) | Belt (bass) | Left arm lamps (step:lamp) | Right arm lamps (step:lamp) | Cutter (hats) | Sorter (stab+clap) | Reactor |
|---|---|---|---|---|---|---|---|---|
| 1 | Fm | 0 4 8 12 | 1 2 3 5 6 7 9 10 11 13 14 15 | A: 0:2 2:1 3:2 6:4 8:3 10:2 11:1 14:0 | - | - | - (gate set left) | glow 1, crates 1-4 fed |
| 2 | Db | same | same | A': 0:2 2:1 3:2 6:4 8:4 10:3 12:2 14:3 | - | - | - | crates 5-8 |
| 3 | Eb | same | same | A | - | - | - | 9-12 |
| 4 | Cm | same | same | A'': 0:4 2:3 3:4 6:2 8:3 10:1 11:2 14:0 | - | - | - | 13-16 |
| 5 | Fm | same | same | A | - | - | 4, 12 | 17-20 |
| 6 | Db | same | same | - | B: 0:2 3:3 4:2 6:4 8:3 10:2 12:1 14:0 | - | 4, 12 | 21-24 |
| 7 | Ab | same | same | A' | - | - | 4, 12 | 25-28 |
| 8 | Eb | same | same | - | B': 0:4 2:3 3:4 6:2 8:3 11:2 12:1 14:2 | - | 4, 12 | 29-32 |
| 9 | Bbm | same | same | X: 0:3 2:2 3:3 6:4 | X: 8:3 10:4 11:3 14:2 | 2 6 10 14 | 4, 12 | 33-36 |
| 10 | Db | same | same | X': 0:4 2:3 3:4 6:2 | X': 8:2 10:3 11:4 14:3 | 2 6 10 14 | 4, 12 | 37-40 |
| 11 | Eb | same | same | X | X | non-kick 16ths | 4, 12 | 41-44 |
| 12 | Cm | same | same | X' | X' | non-kick 16ths | 4, 12 | 45-48 |
| 13 | Db | same | same | 0:1 2:2 4:3 6:4 | 8:1 10:2 12:3 14:4 | all 16ths | 4, 12 | 49-52 |
| 14 | Bbm | same | same | 0:2 2:3 4:4 6:3 | 8:2 10:3 12:4 14:3 | all 16ths | 4, 12 | 53-56 |
| 15 | Cm | same | same | 0:2 4:3 8:4 12:4 | 2:2 6:3 10:4 14:4 | all 16ths | 4, 12 | 57-60: 100 %; ring lamps 1-8 on 8ths (roll) |
| 16 | Eb | **held up** | **stopped** | lamp 4 held all bar | lamp 4 held all bar | - | - | ring lamps 9-24 on 16ths (roll), core brightening |
| 17 | Fm | 0 4 8 12 (ignition on 0) | as bar 1 | C: 0:0 2:2 4:1 6:3 8:2 10:4 12:3 14:2 | C: 1:2 3:3 5:2 7:4 9:3 11:2 13:4 15:3 | all 16ths | 4, 12 | IGNITION, MAX POWER, factory lights on |
| 18 | Db | same | same | C | C | all 16ths | 4, 12 | max |
| 19 | Eb | same | same | C': 0:1 2:3 4:2 6:4 8:3 10:2 12:1 14:0 | C': 1:3 3:4 5:3 7:2 9:1 11:2 13:3 15:4 | all 16ths | 4, 12 | max |
| 20 | Cm | same | same | C'': 0:4 2:3 4:4 6:2 8:3 10:1 12:2 14:0 | C'': 1:4 3:2 5:3 7:4 9:2 11:3 13:1 15:0 | all 16ths | 4, 12 | max |
| 21 | Db | same | same | A | - | 2 6 10 14 | 4, 12 (crates now dispatched off the side) | cooldown 75 % |
| 22 | Ab | same | same | - | B | 2 6 10 14 | 4, 12 | 50 % |
| 23 | Eb | same | same | A' | - | - | - | 25 % |
| 24 | Cm | same | same | A'' | - | - | - | 0 %, gate back on the left, = frame 0 |

Lamp k of an arm is the k-th tone of the bar's chord ladder (chord tones from C4 up; the right arm's column starts
two tones higher), so the composer and the picture read the same number. The sorter snaps 34 times (bars 5-15 and
17-22), an even count, so it ends where it started.

## Sound vs the last 3 videos

| Video | Tempo | Key | Kick | Lead | Groove |
|---|---|---|---|---|---|
| Lightning | 128.57 | C# Phrygian dominant | Rumble (`kick_909` + off-beat tail) | `sync_lead` + `hoover` stabs | Rolling, heavy |
| Birthday | 163.64 | G Aeolian | Short punchy `kick_909` + separate sub | `trance_pluck` + `sync_lead` stabs | Bouncy off-beat |
| Monty Hall | 138.46 | D Phrygian | `kick_909` driven hard | `acid_bass` lead + `supersaw` stabs | Acid |
| **The Beat Factory** | **150** | **F Aeolian** | **Swoop, re-tuned to each chord root** | **Clipped-sine lead, call (L) and answer (R) on two buses** | **Industrial: rolling 16th acid bass under the kick, metal hats, clap on 2 and 4** |

Different from each of the three on tempo, kick and lead at least (vs Birthday the mode is shared, the root is not).
Guitar String (four videos back) also used 150 BPM, the swoop and the clipped sine; this track differs from it in
key (F Aeolian vs E Phrygian), bass (acid roller, filter opening with the reactor) and groove (sorter clap/stabs,
cutter hats, a held-breath break).

## On-screen text (all of it)

- Top panel, whole video: THIS FACTORY / RUNS ON TECHNO.
- One readout: REACTOR POWER with a segmented meter and the % (MAX POWER in bars 17-20, COOLING in 21-24).
- Watermark `@squarewavelab`. No captions: the machines are the explanation.

## Loop

Frame 1151 flows into frame 0: same camera, the belt and crates are periodic per beat, meter 0 %, reactor dim,
gate on the left, arms on their rest lamps. The music's last bar (bar 24, kick + bass + hook + whine, Cm) leads into
bar 1 (Fm); the tail is folded onto the start (`finish_loop`).
