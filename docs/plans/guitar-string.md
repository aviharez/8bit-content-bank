# Plan: why does a guitar string sing? (idea #7)

Slug `guitar-string`, composition `GuitarString`, series Every Wave. Written before any code (CLAUDE.md, "Sync,
picture and arrangement"). The owner's brief for this one: the picture must really explain the content, and every
visual must be in sync with the audio.

## The idea in one line

A guitar and a bass lie on a table and play this track. Every sound is one string you can see, at that string's
real pitch: the kick is the low E string (82.4 Hz, the swoop's E2), the hook is the high strings under a fret, the
bass line is the bass guitar. Watching them shows the three rules of a string: it swings, a shorter string swings
faster, and it swings in whole loops.

**Hook (first 2 s):** "WHY DOES A GUITAR STRING SING?", with the low string flashing on the first kick.

## The physics (real)

- A plucked string, fixed at both ends, swings back and forth. Its rate is f = n v / (2L), with v = sqrt(T / mu):
  n loops, length L, tension T, mass per length mu.
- **The pluck (d'Alembert).** Pulled aside at one point and let go, the bend splits in two kinks that run to the
  ends, flip and come back. The shape repeats every 2L / v = 1 / f. Computed as the sum of 40 modes,
  b_n = 2h sin(n pi beta) / (n^2 pi^2 beta (1 - beta)), with the pluck at beta = 0.154 (over the sound hole).
- **Slowed 33x so a round trip is one beat.** The low E swings 82.4 times a second, and one beat is 0.4 s, so
  82.4 x 0.4 = 33 swings a beat. Shown 33x slower, the string does exactly one swing per beat, so its motion is on the
  grid and every kick restarts it.
- **Frets.** Fret n sits at L (1 - 2^(-n/12)) from the nut, so the free part is L 2^(-n/12) and the note is n
  semitones up. Real positions, 64.8 cm scale (guitar) and 86.4 cm (bass).
- **Harmonics.** Touch the string lightly at L/n and only the shapes with n loops survive: n x 82.4 Hz for the low
  string, n x 329.6 Hz for the high E. Touch points at the 12th fret (n = 2), 7th (3) and 5th (4).
- **Thicker and longer: lower.** The bass's E string is 86.4 cm long and much heavier, so it plays E1, 41.2 Hz, one
  octave under the guitar's low E.
- **The body.** A string alone barely moves air. The bridge rocks the wooden top, and the top and the sound hole
  push the air: the rings from the sound hole on each kick.

## Clock

150 BPM, 30 fps: 12 frames per beat, 3 per 16th. 24 bars = 96 beats = 1152 frames = 38.4 s. The low string's
slow-motion swing is 33x slower (said on screen); everything else is real time, and the strings' swing is drawn 5x
wider than real (said on screen).

## What is on screen is the music

| Visible | Sound (approved instruments, unchanged) |
|---|---|
| The low E string (guitar string 6) plucked over the sound hole: a flash at the pluck point, the string swings | **Kick** (swoop onto E2 = the open low E, 82.4 Hz) |
| A bass string plucked, a fingertip on its fret, the string's blur | **Bass** rolling line, each note on the bass string and fret that makes that pitch |
| Strings 5 and 4 together, fretted an octave apart, on the 8ths | **Mid saws** octave dyad |
| A high string (1-3) under a fingertip at its fret, its free part blurs | **Lead** hook, each note at its real fret |
| Build: string 1 touched at 1/2, 1/3, 1/4: it swings in 2, 3, 4 loops | **Lead**: the harmonics, n x 329.6 Hz |
| Drop: strings 1-3 strummed together in the hook's gaps, white flash | **Stab** chord hits, one bus per voice (one per string) |

Every note is placed on a string and fret that really make its pitch (`sims/guitar-string.ts` checks it; a string
never plays two notes at once).

## Visible events, 16 bars (16th grid; K = kick pluck on the low string, L = lead note)

| Bars | Every beat | Hook rhythm | What changes |
|---|---|---|---|
| 0-3 | K: low string flashes and swings | L at the frets on strings 1-3; bass notes on the bass | Wide on both instruments, then the low string in slow motion |
| 4-7 | K, 3+3+2: the kinks run to both ends | L call/answer; fret close-up | Bridge and nut labelled; the fingertips and frets |
| 8-11 | K four on the floor, then 8ths, then 16ths | L = harmonics: 2, 3, 4 loops on string 1, then a 16th climb | The whole string 1; LOOPS readout |
| 12-15 | K four on the floor | L hook C with gaps; stabs strum strings 1-3 in the gaps | Drop: the low string with its loops 1, 2, 4 drawn above it |

## Section plan

| Bars | Section | Chords (E Phrygian) | Hook | Big visible event |
|---|---|---|---|---|
| 0-3 | Intro | Em Em F Em | A, A' | The low string plucked on every kick |
| 4-7 | The rule | C C Dm Dm | B, B' | Kinks bounce between the ends; frets |
| 8-11 | Build | Em (an E pedal: every harmonic of the E string is a chord tone) | 2 loops, 2', 3 loops, 4 loops + climb | String 1 in 2, 3, 4 loops |
| 12-15 | Drop | Em F C Dm | C with stab answers | Loops 1, 2, 4 above the low string, strums |
| 16-19 | Drop 2 | Am C Dm F | C' | The bass string vs the low string; code card |
| 20-23 | Turn | Em F Em F | B, A | Rings of air from the sound hole; back to the start |

## Captions (one idea each, 2 bars)

| Bars | Caption |
|---|---|
| 0-1 | EVERY KICK IS THIS / STRING BEING PLUCKED |
| 2-3 | IT SWINGS 82 TIMES / EVERY SECOND |
| 4-5 | THE BEND RUNS TO BOTH / ENDS AND BOUNCES BACK |
| 6-7 | PRESS A FRET: SHORTER / STRING, HIGHER NOTE |
| 8-9 | TOUCH IT AT THE MIDDLE: / 2 LOOPS, 1 OCTAVE UP |
| 10-11 | A THIRD: 3 LOOPS / A QUARTER: 4 LOOPS |
| 12-13 | ONE PLUCK SWINGS IN / MANY LOOPS AT ONCE |
| 14-15 | THAT MIX IS WHY A GUITAR / SOUNDS LIKE A GUITAR |
| 16-17 | LONGER, THICKER STRING: / ONE OCTAVE LOWER |
| 18-19 | Code card: `f = n * v / (2 * L)`, `v = sqrt(T / mu)` |
| 20-21 | THE WOOD AND THE HOLE / PUSH THE AIR |
| 22-23 | SWING, LENGTH, LOOPS: / THAT IS A NOTE |
