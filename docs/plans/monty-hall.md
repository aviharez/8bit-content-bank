# Plan: should you switch doors? (idea #27, the Monty Hall problem)

Slug `monty-hall`, composition `MontyHall`, series Probability. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks. Status: approved by the owner (Nov 2026), built; see "As built" at the end.

## The idea in one line

A game show: 3 doors, a car behind one, goats behind the other two. You pick a door, the host (who knows where the
car is) opens one of the other two on a goat, and asks: stay or switch? Most people say it does not matter, 50/50.
**Switching wins 2 times in 3**, because your first pick is right only 1 time in 3, and whenever it was wrong the
host has to leave the car behind the other closed door. Then the show plays 1,000 games, and the scoreboard proves it.

**Hook (first 2 s):** "SHOULD YOU / SWITCH DOORS?" over a lit game-show stage, the 3 doors already pulsing, the
contestant pointing at door 1.

## The maths (real, exact)

- P(first pick is the car) = 1/3. The host always opens a goat door you did not pick. So staying wins 1/3, and
  switching wins every time staying loses: 2/3.
- **The 1,000 games are one real random draw** (seeded, so every render is the same): the car's door and the
  contestant's pick are uniform random each game; when the host has two goat doors to choose from he picks one at
  random. Half the games stay, half switch (alternating), so both columns get 500 games. The seed is picked so the
  final tally sits close to the expected 333 / 667, and the post says the draw is one real run, not a fit.
- On screen the explanation step uses colour, not fractions first: your door is 1 of 3 (blue); the other two
  together are 2 of 3 (orange). The host opens a goat inside the orange pair, and the whole orange 2-in-3 is left on
  the one door he did not open.

## Clock

- **138.46 BPM**, 30 fps: 13 frames per beat. A 16th is 3.25 frames (the picture rounds, the audio is exact).
- 22 bars = 88 beats = 1144 frames = 38.1 s.

## The scene (3D, fills the frame)

A game-show stage seen from the audience, slightly above, with stage lights on trusses, a glossy floor that
reflects the doors, and a big scoreboard hanging above the doors. 3 tall doors with numbers 1, 2, 3; the host
(blocky figure in a suit) on the left, the contestant (blocky figure, bright colour) on a mark in front. Behind each
door: a pixel car on a turntable or a goat. In the build the camera pulls back and the stage repeats as a wall of
small stages (10 × 10, like TV screens in a studio) so many games play at once; for the drop the scoreboard fills the
top third of the frame.

| Part | Look |
|---|---|
| Doors | Tall, numbered, a light frame that glows when picked (blue) or when part of the other pair (orange) |
| Host | Suit, gestures at the door he opens |
| Contestant | Points at the pick, hops to the other door on a switch |
| Car / goat | Pixel car (shiny, confetti when won), pixel goat |
| Scoreboard | Two columns of bulbs, STAY and SWITCH, a bulb per win; the % under each in plain numbers |

## Visible events, 16th grid (what the music follows)

| Visible | Sound | Grid |
|---|---|---|
| A door step: pick (beat 1), host opens a goat door (beat 2), switch hop or stay (beat 3), reveal (beat 4) | **Kick**: `kick_909` driven hard | Every beat |
| The stage lights flash on the off-beat (chasing light over the doors) | **Bass**: `fm_bass` stab on the chord root, off-beat 8ths | Off-beat 8ths |
| The picked door's frame glows, the light chases along the frame | **Hook** (`acid_bass` as a lead, 16ths); the filter opens as the SWITCH column grows | 16ths, A call on the stay games, B answer on the switch games |
| The goat door swings open (the goat bounces once) | **Goat note**: low `fm_bass` stab, the chord's 5th | On beat 2 of a game |
| The reveal: car wins (confetti) | **Stab**: `supersaw` chord, one bus per voice + `clap` | On the reveal |
| The reveal: goat (contestant slumps) | A short low root on the stab bus, no clap | On the reveal |
| A scoreboard bulb lights | **Hats** (`metal_hat`); in the drop many bulbs per beat, so the hats run 16ths | Each bulb on the 16th grid |
| The wall of stages fills in the build (one more row each 8th) | **Snare roll** (`electronic_snare`) | 8ths then 16ths, bars 11-12 |

## 16-bar event list (bars 1-16; then the second drop and the turn)

| Bars | Games | What happens per bar |
|---|---|---|
| 1-2 | Game 1 (stay): car behind door 3 | Bar 1: pick door 1 (beat 1), host opens door 2 goat (beat 2), contestant stays (beat 3), door 1 opens: goat (beat 4). Bar 2: same doors, the explanation colour: door 1 blue (1 of 3), doors 2+3 orange (2 of 3), one colour change per beat |
| 3-4 | Game 2 (switch) | Pick, host opens a goat in the orange pair, the orange glow slides onto the closed door, switch hop, reveal: car |
| 5-8 | Games 3-6 | One game per bar, alternating stay / switch; the scoreboard starts lighting bulbs |
| 9-10 | Games 7-14 | Two games per bar (2 beats a game, steps on 8ths); camera starts pulling back |
| 11-12 | Games 15-100 | The wall of 100 stages fills row by row (snare roll); every stage plays its own game; the scoreboard at 30 / 70 |
| 13-16 | Games 101-500: drop 1 | All 100 stages reveal on each beat; the bulbs pour in on 16ths; SWITCH pulls away to about 2 in 3 |
| 17-20 | Games 501-1,000: drop 2 | Same, twice as dense; the % settles at 33 / 67 |
| 21-22 | Turn | The wall shrinks back to one stage, its doors close one per beat; bar 22 beat 4 the contestant steps onto the mark for bar 1 |

## Section plan (music)

D Phrygian (D Eb F G A Bb C: dark, tense, a game-show standoff); every chord is built from the scale, so the flat 2nd (Eb) is the colour:

| Bars | Section | Chords | Hook | Kick / groove | What enters or leaves |
|---|---|---|---|---|---|
| 1-4 | Intro: the question | Dm Eb Dm Eb | A (stay game) then B (switch game), filter half-open | Four on the floor, off-beat `fm_bass` | Kick, bass, acid hook, goat note, stab: dense from frame 1 |
| 5-8 | The rule: 1 in 3 vs 2 in 3 | Dm Bb Cm Dm | A' / B' alternating per game | Same | Hats start with the scoreboard |
| 9-12 | Build: 1,000 games | Gm Gm Bb Cm | B'' a register up, steps on 8ths then 16ths | 3+3+2 kick in bar 12 | Snare roll, the wall of stages |
| 13-16 | Drop 1: the tally | Dm Eb Bb Cm | C: the hook on 16ths, filter wide open | Four on the floor, kick + stab on every reveal | Supersaw chord on every beat, clap |
| 17-20 | Drop 2: 2 in 3 | Dm Eb Gm Cm | C' an octave up | Driving 16th acid bass under | Everything in |
| 21-22 | Turn | Eb Dm | A'' falling, leads into bar 1 | Bar 21 near-empty (kick and bass), bar 22 four on the floor | Stab, roll, hats leave; ends on the intro texture |

The physics changes the notes: a stay game plays the call (A), a switch game the answer (B); a win lands on the
chord's top note, a loss on its root. The filter on the acid hook tracks the SWITCH column's lead.

## Sound vs the last 3 videos

| Video | Tempo | Key | Kick | Lead | Groove |
|---|---|---|---|---|---|
| Guitar string | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| Lightning | 128.57 | C# Phrygian dominant | Rumble (`kick_909` + off-beat tail) | `sync_lead` + `hoover` stabs | Rolling, heavy |
| Birthday | 163.64 | G Aeolian | Short punchy `kick_909` + separate sub | `trance_pluck` + `sync_lead` stabs | Bouncy off-beat |
| **Monty Hall** | **138.46** | **D Phrygian** | **`kick_909` driven hard, 3+3+2 in the build** | **`acid_bass` lead + `supersaw` stabs** | **Acid** |

Different on at least four of five against each.

## On-screen text (all of it)

| Bars | Text |
|---|---|
| 1-22 | Top panel: SHOULD YOU / SWITCH DOORS? |
| 1-2 | 1 CAR, 2 GOATS |
| 3-4 | THE HOST OPENS A GOAT |
| 5-6 | YOUR DOOR: 1 IN 3 |
| 7-8 | THE OTHER TWO: 2 IN 3 |
| 9-10 | SWITCH = TAKE BOTH |
| 11-12 | LET'S PLAY 1,000 TIMES |
| 13-20 | (no caption: the scoreboard does the talking) |
| 21-22 | Code card: `P(stay) = 1/3`, `P(switch) = 2/3` (16 px) |

HUD, two readouts on the scoreboard: **STAY WINS** and **SWITCH WINS** (%). Watermark `@squarewavelab`.

## Loop

One stage, doors closed, contestant on the mark at frame 0 and at the last frame; the camera ends where it starts.

## Decisions for the owner

1. **Topic:** Monty Hall, back to back with another Probability video (birthday). The other strong candidates were
   Buffon's needle (drop needles, find pi) and Collatz 27.
2. **Length:** 22 bars, 38.1 s.

## As built (Nov 2026)

- Schedule: games 1-8 one a bar, 9-12 one every 2 beats, 13-20 one a beat (16ths), then 28 rounds of 35 stages
  (5 x 7 wall) on beats 48-75 = 1,000 games. Bar 19 is the result: the last round's stay winners and switch winners
  flash in turn. Bar 20 the wall folds away row by row, bar 21 the 3 doors close and the contestant walks to the mark.
- Seed 3: game 1 (stay) loses, game 2 (switch) wins; final stay 175 / 514 = 34.0%, switch 322 / 486 = 66.3%.
  Strategy on the wall is a checkerboard (stay stages blue, switch stages orange), so the counts are not 500/500.
- The scoreboard is the HUD (STAY WINS / SWITCH WINS %), not bulbs on a board. Hats are the switchers hopping to the
  other door (not scoreboard bulbs); the snare roll is the wall's stages appearing on 16ths in bars 10-11.
- Hook (`acid_bass`): the marquee chase; its 9 bulbs are steps on the chord ladder (D4 up), written by the sim
  (`hook` in the timeline), so the lit bulb is the note. One bus per section, cutoff 700 -> 2600 Hz across the
  build and drops, 800 Hz in the turn.
- No 3+3+2 kick in the build: every beat is a visible game step, so the kick stays four on the floor; the snare roll
  carries the build. No 16th acid bass under drop 2; the drop 2 change is its chords and the hook an octave up.
- Captions: 1 CAR, 2 GOATS / PICK A DOOR; THE HOST KNOWS / AND OPENS A GOAT; YOUR DOOR / WINS 1 IN 3; THE OTHER TWO
  / WIN 2 IN 3; SWITCH AND YOU / GET BOTH OF THEM; LET'S PLAY / 1,000 TIMES; bars 17-18 THE SCORE: / SWITCHING WINS
  2 IN 3; code card bars 19-20; bar 21 repeats 1 CAR, 2 GOATS into the loop, and the tally resets to -- as the doors
  close (beat 84), so the last frame matches frame 0. "1 IN 3" and "2 IN 3" tags float over the doors in bars 4-9 and move onto the door the host left shut.
- Mix: kick_909 tuned +5.7 st (body 73.2 Hz, D2), drive 8. Bass `fm_bass` low-passed at 300 Hz (its 5th harmonic
  is a major 3rd and clashed with the minor chords). Hats untuned already ring on D. Levels vs kick: bass -2, hook -4,
  stab -5, goat -6, clap -8, hats -10, roll -11 dB.
