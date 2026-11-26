# Plan: Red vs Blue: Beat Race (Pilot 002, Beat Wars pillar)

Slug `beat-race`, composition `BeatRace` (cover `BeatRaceCover`), Remotion folder `beat-race`.
Brief: `docs/plans/entertainment-pilots.md`. Status: **full build** (2026-11-26; obstacles added 2026-11-27 at the owner's request). Look test approved; sketch v1 sound rejected ("feels bad"); sketch v2 in the
target-sound family approved with the hard 909 kick (variant B). This plan is updated to what was built.

## Brief

- **Hook (first 2 s):** "RED vs BLUE / PICK A SIDE" over an arcade race cabinet. Frame 0: the start gate drops,
  both marbles fall into their lanes, the floor piston thumps (kick), each marble hits its first bumper (a note).
- **Viewer question:** which marble wins?
- **Stakes:** one readout, the LEAD bar (a tug-of-war bar: red fills from the left, blue from the right, the
  leader's colour past the middle), and the checkpoint counter `CHECKPOINT 3/5`.
- **Payoff (bar 17, 0:29.9):** both marbles roll the final straight neck and neck in bar 16 (held breath: no kick,
  no bass, each marble holds one long note, the banner's lamps fill on a snare roll), and on bar 17 beat 1 **Blue**
  touches the finish post on the drop: confetti, Blue's half of the board lights up full, `BLUE WINS!`. Red reaches
  the post two beats later. Blue calls the hook for the whole finish section, bouncing in its bucket.
- **Setting:** inside a tall arcade cabinet. Two side-by-side lanes descend in zigzag ramps (left lane red,
  right lane blue), with the same obstacles in both lanes: two gates, two peg fields and five bounce pads (the checkpoints). The camera follows both marbles down
  (they are never more than a screen apart) and rides the lift back up in the turn.
- **Mechanics are scripted, not a simulation:** the race is authored so that it is readable (lead changes in bars
  7, 11 and 14, each caused by an obstacle you can see: a gate catches the leader, a peg field gives Red its
  comeback; Blue by two beats). The script is fixed before the audio is rendered and never changed after.
  The post says it is staged. Seed for the small things (peg order, confetti): `seed = 2`.
- **Runtime:** 24 bars at 128.57 BPM = 44.8 s. No external assets.

## Clock

128.57 BPM at 30 fps: 14 frames a beat, an 8th is 7 frames. A 16th is 3.5 frames: the audio sits on the exact,
even 16th grid and the picture draws each event on the frame at or just before it (`frame = floor(beat * 14)`, at
most half a frame = 17 ms early, never late). Snapping the audio to frames instead made every second 16th 17 ms late,
which the owner heard as an off-tempo kick (fixed 2026-11-27).
24 bars = 96 beats = 1344 frames = 44.8 s. The beat is the time authority.


## Entities, actions, sounds (as built)

| Entity | Visible action | Sound (bus) | Rhythm |
|---|---|---|---|
| Pacer hammer (on the spine, at the race's height) | small wind-up, 2-frame strike onto its plate on the kick (plate flashes, shock ring), springs up and waits | **Kick** `kick_909`, drive 9, tuned to D2 (a tone of every chord) | every beat; none in bar 16 (held up) |
| Track-drive chevrons (4 on every ramp's lip) | march one step per note | **Bass** `bass_track` (target clipped sub), chord root A1-G2 | gallop on the "and" + the 16th after; 16th runs in bars 13-15; octave pickup into each chord change |
| Red marble: pins, pegs, bumpers, gate flaps, finish post, bucket, start gate | each contact flashes the marble and the pin/bumper; pin height = note | **Red** `lead_track` (clipped sine), A3-E5 | 8ths/16ths; calls in bars 1-6 and 11-13 |
| Blue marble: same | same | **Blue** `stab_track` (same synth, an octave up), A4-E6 | answers; calls in bars 7-10 and 14-20 |
| Board halves (red side, blue side) | pulse on the off-beat 8ths | **Mid** octave saw dyads (3rd / 5th), one bus per voice | off-beat 8ths |
| Winner's half | lit full, re-struck each bar | **Glow** held saw root, octaves | bars 17-20 |
| Side chaser bulbs | step | **Hats** `metal_hat`, tuned onto A | the off-beat 8th; quieter 16ths added in the busy sections |
| Bounce pads = checkpoints (high end of levels 2, 4, 7, 9, 12) | the spring squashes, the marble hops half a beat; the pad and a wall lamp take the team colour | **Stab** saw root in octaves + **clap** | each marble landing (10) |
| Gates (start gate; low end of ramps 5 and 12, both lanes) | an amber gate holds a marble that reaches it early; the flap snaps up and the light turns green, both lanes at once | **Gate** `electronic_snare`, tuned to the chord (E on Am, G on Gm) | beats 0, 23, 51 |
| Peg fields (levels 10, 11, bars 11-12) | no ramp: the marble rests on a peg and hops peg to peg, each peg lights | (the marbles' notes: Red's 16th runs) | Red's comeback |
| Finish banner (24 lamps) | lamps fill | **Roll** `electronic_snare` | 8ths in bar 15, 16ths in bar 16 |
| Lift / buckets | carry the marbles up, tip them onto the start gate; reset the lamps they pass | (the marbles' bounce and gate notes) | bars 21-24 |

Every note is a chord tone, clipped at the 2-bar chord change; Red and Blue never sound on the same 16th (sim check).

## Section plan (music; printed by the sim and the composer)

| Bars | Section | Chords | Hook | What happens |
|---|---|---|---|---|
| 1-4 | start | Am Bb | A A' B A'' (Red calls, Blue answers) | gate drops, Red rolls out ahead |
| 5-8 | checkpoints | Am Gm | C C' (16th pickups), D D' (Blue calls) | pad 2; Red waits at gate 1, both released on beat 4 of bar 6, Blue pulls away in bar 7; pad 3 |
| 9-12 | swap | Dm Bb | E E', F F' (Red's 16th runs) | Blue first at pad 4; peg fields: Blue sits on a peg while Red bounces through, Red's comeback |
| 13-16 | neck | Gm Bb | G G', ping-pong, hold | pad 5; Red waits at gate 2, both released on beat 4 of bar 13, Blue retakes the lead; neck and neck; bar 16 held breath + snare roll |
| 17-20 | finish | Am Bb | W W' W'' W''' (Blue calls) | BLUE WINS on the drop, glow, confetti |
| 21-24 | lift | Dm Bb | A A' B A | buckets ride up, marbles tipped onto the gate; Bb → Am across the loop |

## Sound vs the last three videos

| Video | BPM | Key | Kick | Lead | Groove / bass |
|---|---|---|---|---|---|
| The Beat Factory | 150 | F Aeolian | swoop | clipped sine ×2 (two arms) | driving; acid bass on the 16ths after each kick |
| Monty Hall | 138.46 | D Phrygian | hard kick_909 | acid_bass lead + supersaw | off-beat fm_bass |
| Birthday | 163.64 | G Aeolian | punchy 909 + its own sub | trance_pluck hook + sync_lead stabs | bouncy off-beat fm_bass |
| **Beat Race** | **128.57** | **A Phrygian** | **hard kick_909, tuned D2** | **clipped sine call (Red) / answer an octave up (Blue), handed over with the lead** | **slower and heavier; galloping clipped-sine bass on the second half of each beat** |

It shares the hard 909 with Monty Hall (the owner's pick in the sketch A/B) and the clipped-sine family with the
Factory (the owner's rule: stay in the target sound); it differs from each on tempo, key and groove, and from Monty
Hall also on lead and bass.

## On-screen text

Top panel: `RED vs BLUE` / `PICK A SIDE`. One readout panel: the LEAD tug-of-war bar + `CHECKPOINT n/5` (n = lamps
lit, back to 0 as the lift passes them); `BLUE WINS!` in bars 17-20. R / B tags over the marbles. Watermark only.

## Loop

The lift brings both marbles back to the start gate in bars 21-24 and resets every lamp it passes; the camera rides
back up with them, so the last frame is the closed start gate at the top, which lifts on frame 0. Music: bars 23-24
are on Bb, resolving to Am on bar 1 (Phrygian cadence); tail folded with `finish_loop`.

## Event sheet (generated from `public/beat-race/timeline.json`; beats in the bar, 0-based)

| Bar | Chord | Hook | Kick | Bass (16ths) | Red contacts | Blue contacts | Also |
|---|---|---|---|---|---|---|---|
| 1 | Am | A | every beat | gallop | 0 0.5 1 1.5(bumper) | 2 2.5 3 3.5(bumper) | gate open @0 (snare) |
| 2 | Am | A' | every beat | gallop | 0 0.5 1 1.5(bumper) | 2 2.5 3 3.5(bumper) | Red pad 1 @2.5 (stab+clap) |
| 3 | Bb | B | every beat | gallop | 0 0.5 1 1.5(bumper) | 2 2.5 3 3.5(bumper) | Blue pad 1 @0.5 (stab+clap) |
| 4 | Bb | A'' | every beat | gallop | 0 0.5 1 1.5(bumper) | 2 2.5 3(bumper) | Red pad 2 @2.5 (stab+clap) |
| 5 | Am | C | every beat | gallop | 0 0.5 0.75 1 1.5(bumper) | 2 2.5 3 3.25 3.5(bumper) | Blue pad 2 @0 (stab+clap) |
| 6 | Am | C' | every beat | gallop | 0 0.5 0.75 1 1.5(gate-bump) | 2 2.5 3(gate-bump) | gates open @3 (snare); Red waits at the gate 1.5-3 |
| 7 | Gm | D (Blue calls) | every beat | gallop | 2 2.5 3 3.5(bumper) | 0 0.5 0.75 1 1.5(bumper) | Blue pad 3 @2.5 (stab+clap) |
| 8 | Gm | D' | every beat | gallop | 2 2.5 3(bumper) | 0 0.5 0.75 1 1.5(bumper) | Red pad 3 @0.5 (stab+clap) |
| 9 | Dm | E | every beat | gallop | 2 2.5 3 3.5(bumper) | 0 0.5 1 1.5(bumper) | Blue pad 4 @2.5 (stab+clap) |
| 10 | Dm | E' | every beat | gallop | 2 2.5 3(bumper) | 0 0.5 0.75 1 1.5(bumper) | Red pad 4 @0.5 (stab+clap) |
| 11 | Bb | F (Red's run) | every beat | gallop | 0(peg) 0.25(peg) 0.5(peg) 0.75(peg) 1(peg) 1.5(bumper) | 2(peg) 2.5(peg) 3(peg) 3.5(bumper) | peg field |
| 12 | Bb | F' | every beat | gallop | 0(peg) 0.25(peg) 0.5(peg) 0.75(peg) 1(peg) 1.5(bumper) | 2(peg) 2.5(peg) 3(peg) 3.5(bumper) | Red pad 5 @2.5 (stab+clap); peg field |
| 13 | Gm | G | every beat | 16th runs | 0 0.5 1 1.5(gate-bump) | 2 2.5 3(gate-bump) | Blue pad 5 @0.5 (stab+clap); gates open @3 (snare); Red waits at the gate 1.5-3 |
| 14 | Gm | G' | every beat | 16th runs | 2 2.5 3 3.5(bumper) | 0 0.5 0.75 1 1.5(bumper) | - |
| 15 | Bb | ping-pong | every beat | 16th runs | 0.5 1.5 2.5(bumper) 3.5(hold) | 0 1 2 3(bumper) | banner roll (8 lamps) |
| 16 | Bb | hold | none | none (hold) | - | 0(hold) | banner roll (16 lamps) |
| 17 | Am | W (Blue wins) | every beat | gallop | 2(finish) 3(bounce) 3.5(bounce) | 0(finish) 1(bounce) 1.5(bounce) 2.5(bounce) | - |
| 18 | Am | W' | every beat | gallop | 3(bounce) 3.5(bounce) | 0(bounce) 0.5(bounce) 0.75(bounce) 1(bounce) 1.5(bounce) 2(bounce) 2.5(bounce) | - |
| 19 | Bb | W'' | every beat | gallop | 3(bounce) 3.5(bounce) | 0(bounce) 0.5(bounce) 0.75(bounce) 1(bounce) 1.5(bounce) 2(bounce) 2.5(bounce) | - |
| 20 | Bb | W''' | every beat | gallop | 3(bounce) 3.5(bounce) | 0(bounce) 0.5(bounce) 0.75(bounce) 1(bounce) 1.5(bounce) 2(bounce) 2.5(bounce) | - |
| 21 | Dm | A | every beat | gallop | 0(bounce) 0.5(bounce) 1(bounce) 1.5(bounce) | 2(bounce) 2.5(bounce) 3(bounce) 3.5(bounce) | - |
| 22 | Dm | A' | every beat | gallop | 0(bounce) 0.5(bounce) 1(bounce) 1.5(bounce) | 2(bounce) 2.5(bounce) 3(bounce) 3.5(bounce) | - |
| 23 | Bb | B | every beat | gallop | 0(bounce) 0.5(bounce) 1(bounce) 1.5(bounce) | 2(bounce) 2.5(bounce) 3(bounce) 3.5(bounce) | - |
| 24 | Bb | A | every beat | gallop | 0(bounce) 0.5(bounce) 1(bounce) 1.5(gate) | 2(bounce) 2.5(bounce) 3(bounce) 3.5(gate) | - |

Every bar also has off-beat board pulses (mid, except bar 16) and chaser-bulb hats (the off-beat 8th, quieter 16ths in the busy sections). A contact with no label is a pin (or a peg in a peg field).
