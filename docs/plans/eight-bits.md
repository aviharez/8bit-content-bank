# Plan: 8 bits count to 255 (idea #20)

Slug `eight-bits`, composition `EightBits`, series How Computers Work. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks.

## The idea in one line

Eight lights count from 0 to 255 in binary, and the lights are the drum machine: the light that flips every beat
is the kick, each light that switches on plays its note, and the song's sections are the moments a bigger light
switches on for the first time.

**Hook (first 2 s):** "HOW DO COMPUTERS COUNT WITH JUST 0 AND 1?"

## Clock

- 150 BPM, 30 fps: 12 frames per beat, 3 frames per 16th
- 22 bars = 88 beats = 1056 frames = 35.2 s
- **The counting speeds up in three steps, so a stranger can follow it slowly first:**

  | Bars | Counts | Speed |
  |---|---|---|
  | 0-3 | 0-15 | one count per beat (2.5 counts a second) |
  | 4-9 | 16-63 | one count per 8th (5 a second) |
  | 10-21 | 64-255 | one count per 16th (10 a second) |

- **The loop is the overflow:** 255 + 1 needs a ninth light, all eight lights go off, and the count is back at 0
  on frame 0.
- The arithmetic is exact. Nothing is warped: the counting speed is chosen so every count lands on the grid.

## The scene

A dark room, filled by a wall-sized retro front panel with eight big glass lamps in a row. Each lamp has its value
printed under it: 128 64 32 16 8 4 2 1. Each lit lamp throws its own coloured light into the room, so the room's
colour is the number. The camera slowly orbits on a rotation whose period is the video length, which closes the
loop. A small amber "beat" ring sits around the lamp that is currently the kick.

HUD (two readouts):
- NUMBER: the decimal value
- SPEED: counts per second

House style: a caption box and a code card at the end.

## What is on screen is the music (each visible event is a sound)

Every count does exactly two things you can see: **one lamp switches on** (the lowest one that was off), and **every
lamp to its right switches off** (the carry).

| Visible | Sound (approved instruments, unchanged) |
|---|---|
| A lamp switches on | Its note. Lamp k plays the k-th tone of the current chord, stacked upwards from the root (lamp 1 = root, lamp 2 = third, lamp 4 = fifth, lamp 8 = root an octave up, ...). Lamps 1-8 use the **lead** patch, lamps 16-128 the **stab** patch. In counting order this is the ruler sequence (R 3 R 5 R 3 R 8 R 3 R 5 R 3 R hi ...), a classic arpeggio hook whose top note changes every time. |
| The lamp that flips every beat | **Kick** (swoop). This is lamp 1 while counting per beat, lamp 2 per 8th, lamp 4 per 16th. The beat ring moves to it, so the viewer sees the kick move left as the counting speeds up. Always four on the floor. |
| Every count (the number changes) | **Bass**: the chord root, an octave higher while lamp 2 is lit. That gives a rolling line with octave jumps: quarters, then 8ths, then 16ths. |
| Lamp 2 switches on | **Mid saws pulse**: an octave dyad of the root. Per 16th this lands on every offbeat 8th. |
| Three or more lamps go off at once (a big carry, every 8th count) | **Chord stab**: the current triad, one bus per voice. |
| Lamps 16 and 32 (and 64) | **Choose the chord**, so the harmony is read from the big lamps (table below). |
| Lamp 64 lit (bars 10-13, 18-21) | A held **mid saws** chord, for as long as it glows. |
| Lamp 128 lit (bars 14-21) | A held **stab** whine on the high root, for as long as it glows. Its red light fills the room. |
| The overflow (all eight go off, frame 0) | The biggest carry: kick, chord stab and the reset. |

Chord = the value of lamps 16, 32 and 64 read as a 3-bit number (0-7), in E Phrygian:

| Value | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Chord | Em | F | C | Dm | Am | C | Dm | F |

## Section plan (bars, counts, chords, what enters)

| Bars | Section | Counts | Chords | Parts | Big visible event |
|---|---|---|---|---|---|
| 0-3 | Intro: the question | 0-15, per beat | Em | kick, bass, lead hook slow; chord stab at 8 | lamps 1-8 count slowly |
| 4-9 | The rule | 16-63, per 8th | F F C C Dm Dm | + mid pulse, stabs every bar, hook at 8ths | lamp 16 on (bar 4), lamp 32 (bar 6) |
| 10-13 | Build | 64-127, per 16th | Am C Dm F | + held mid chord (lamp 64), hook at 16ths | lamp 64 on: 6 lamps carry at once |
| 14-17 | Drop | 128-191 | Em F C Dm | + held stab whine (lamp 128), mid chord stops | lamp 128 on: 7 lamps carry, the room turns red |
| 18-21 | Drop 2 | 192-255 | Am C Dm F | both held layers, everything on | lamp 64 joins; at 255 all eight lamps are lit |
| loop | Overflow | 255 -> 0 | F -> Em | all eight lamps off | back to bar 0 |

Checks against the rules:
- **Variation.** The hook's top note changes every phrase (ruler sequence), and the chord changes every 1-2 bars.
- **Neighbouring blocks.** Bars 10-13, 14-17 and 18-21 differ in chords or held layers.
- **Something new at least every 8 bars:** bar 4, 6, 10, 14 and 18.
- **Three parts at once from bar 0:** kick, bass and lead.
- **Cadences.** Bar 13 F -> bar 14 Em is a Phrygian cadence into the drop; bar 21 F -> bar 0 Em closes the loop the
  same way.

## Captions (one idea each, at least 2 bars)

| Bars | Caption |
|---|---|
| 0-1 | HOW DO COMPUTERS COUNT WITH JUST 0 AND 1? |
| 2-3 | Each light is ON (1) or OFF (0). |
| 4-5 | Each light is worth double the one on its right. |
| 6-7 | Add the lights that are on: that is the number. |
| 8-9 | Add 1: the smallest light flips. When it turns off, it carries 1 to the left. |
| 10-11 | Faster: 10 counts a second. |
| 12-13 | Each light flips half as often as the one on its right: that is the beat. |
| 14-15 | 128: the biggest light. |
| 16-17 | 8 lights make 256 numbers: 0 to 255. |
| 18-19 | Every sound you hear is a light switching. |
| 20-21 | 255 + 1 needs a 9th light. All off: back to 0. |

The plain-word captions come first; the code card at the end shows `n = n + 1` and `bin(173) = 10101101`.
