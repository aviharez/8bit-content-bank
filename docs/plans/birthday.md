# Plan: how many people till two share a birthday? (idea #26, the birthday paradox)

Slug `birthday`, composition `Birthday`, series Probability. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks. Status: approved by the owner (Nov 2026), built; see "As built" at the end.

## The idea in one line

Guests walk into a party one by one, and each one's birthday lights up on a giant 365-day calendar on the wall. Most
people guess you need about 180 guests before two share a birthday. **It takes 23 for a 50% chance, because what
grows is the number of pairs, not the guests:** every new guest is checked against everyone already there, so 23
guests make 253 pairs. The first match lands on the drop.

**Hook (first 2 s):** "HOW MANY PEOPLE / TILL 2 SHARE A BIRTHDAY?" over a party room, the calendar wall already
flashing and the door opening for the first guest.

## The maths (real, exact)

- Chance that n guests all have different birthdays: 365/365 · 364/365 · … · (366-n)/365. Chance of a match is 1 minus
  that: 10 guests 11.7%, 20 guests 41.1%, **23 guests 50.7%**, 30 guests 70.6%, 40 guests 89.1%, 57 guests 99.0%.
- Pairs: n(n-1)/2. 10 guests 45, 23 guests 253, 40 guests 780.
- 365 days, every day equally likely, no 29 February (the usual textbook version; the caption says so).
- **The party is one real random draw** (seeded, so every render is the same). The seed is picked so that the first
  match comes at guest 23, which is the median: in half of all parties the first match comes at 23 or sooner. The
  post says so. Every later match in the drop is whatever that same draw gives.

## Clock

- **163.64 BPM**, 30 fps: 11 frames per beat. A 16th is 2.75 frames (the picture rounds, the audio is exact).
- 24 bars = 96 beats = 1056 frames = 35.2 s.

## The scene (3D, fills the frame)

A party room at night, seen from a corner a little above head height. The back wall is the calendar: 12 month
panels side by side, each a grid of day tiles (365 tiles). Party lights and a table of cake, a door on the left
where guests come in. Guests are small blocky people in different colours; each one keeps a thin glowing string to
their day tile on the wall, so you can see who lit which day.

| Part | Look |
|---|---|
| Calendar wall | 12 dark panels, month names in Silkscreen, 365 tiles; a tile lights in the guest's colour |
| Guest | Blocky figure, own colour, walks in from the door, stops in the crowd |
| Pair lines | When a new tile lights, thin lines flash from it to every lit tile (the pairs being checked) |
| Match | Two tiles on the same day flash white then red, both guests jump, a red line joins them |
| Chance meter | A bar on the side wall filling up, the % in plain numbers |

## Visible events, 16th grid (what the music follows)

| Visible | Sound | Grid |
|---|---|---|
| A guest's day tile lights on the wall | **Kick** (short punchy `kick_909`, separate sub) + a bass note | Every beat a tile lands (in the intro and rule the door opening fills the other beat) |
| The door opens, a guest steps in | **Kick** | The beats between tiles (bars 0-11) |
| Pair lines flash from the new tile to the old ones | **Hook**: a `trance_pluck` line, one note per line, on 16ths | After each tile; more lines as the room fills, so the hook gets fuller |
| Guests' footsteps as they walk to the crowd | **Hats** (`metal_hat`), off-beat | 8ths |
| The chance meter ticks up | **Snare roll** (`electronic_snare`) in the build, faster as it nears 50% | 16ths, bars 10-11 |
| A match: two tiles on one day | **Stab** (`sync_lead` chord, one bus per voice) + `clap` | On the tile's beat |
| Guests leave in the turn, tiles go dark | Hats and a falling pluck line | 16ths, bars 20-23 |

## 16-bar event list (bars 1-16; then the second drop and the turn)

| Bars | Guests | What happens per bar |
|---|---|---|
| 1 | Room empty | The 12 month panels flash on one per 16th (beats 1-3: "365 days"), beat 4 the door opens for guest 1 |
| 2-4 | 1-6 | Every 2 beats: door + guest (beat 1), their tile lights (beat 2), 0-5 pair lines flash after it |
| 5-8 | 7-14 | Same, with 6-13 lines per tile now: the hook plays its full call (A) then answer (B) |
| 9-12 | 15-22 | The lines fill every 16th between tiles; the chance meter climbs 25% → 47%, snare roll in bars 11-12 |
| 13 | **23** | **Beat 1: guest 23's tile lands on a day already lit. MATCH.** The drop: stab, clap, flash, both guests jump |
| 13-16 | 24-39 | One guest per beat now (door on the off-beat 8th, tile on the beat), more matches whenever the draw gives one |
| 17-20 | 40-71 | Two guests per beat; matches pile up; the meter passes 99% |
| 21-24 | Everyone leaves | Turn: bar 21 near-empty, guests walk out on 16ths, their tiles go dark; the room is empty again for the loop |

## Section plan (music)

G Aeolian (a bouncy, brighter flavour for a party, still hard techno), chords from the scale:

| Bars | Section | Chords | Hook | Kick / groove | What enters or leaves |
|---|---|---|---|---|---|
| 1-4 | Intro: the question | Gm Gm Eb Eb | A, sparse (few pairs yet) | Four on the floor, off-beat `fm_bass` stabs (bouncy) | Kick, sub, bass, pluck, hats: dense from frame 1 |
| 5-8 | The rule: every pair | Gm Gm Bb F | A then B (call and answer) | Same | Pair lines fill out the hook |
| 9-12 | Build: 50% coming | Cm Cm D D | B' a register up, every 16th | 3+3+2 kick in bar 12 | Snare roll, the meter |
| 13-16 | Drop 1: the match | Gm Eb Bb F | C: hook doubled by the stab on matches | Four on the floor, one tile a beat | Stab, clap |
| 17-20 | Drop 2: 99% | Gm Eb Cm D | C' up an octave, 8th tiles | Driving 16ths bass | Everything in |
| 21-24 | Turn: everyone leaves | Eb Eb Gm Gm | A'' falling, leads into bar 1 | Bar 21 near-empty, then four on the floor | Stab, roll leave; ends on the intro texture |

The birthday's note: each tile's bass note is a tone of the current chord picked by the month (so the draw changes
the notes, never the key).

## Sound vs the last 3 videos

| Video | Tempo | Key | Kick | Lead | Groove |
|---|---|---|---|---|---|
| Speaker | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| Guitar string | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| Lightning | 128.57 | C# Phrygian dominant | Rumble (`kick_909` + off-beat tail) | `sync_lead` + `hoover` | Rolling, heavy |
| **Birthday** | **163.64** | **G Aeolian** | **Short punchy `kick_909` + separate sub** | **`trance_pluck` + `sync_lead` stabs** | **Bouncy off-beat** |

Different on at least four of five against each.

## On-screen text (all of it)

| Bars | Text |
|---|---|
| 1-24 | Top panel: HOW MANY PEOPLE / TILL 2 SHARE A BIRTHDAY? |
| 3-4 | EACH GUEST LIGHTS / THEIR BIRTHDAY |
| 5-6 | NEW GUEST: CHECK / EVERYONE ALREADY HERE |
| 7-8 | PAIRS PILE UP FAST |
| 11-12 | 23 GUESTS = 253 PAIRS |
| 13 | MATCH! (on the two tiles) |
| 21-22 | Code card: `P(match) = 1 - 365!/((365-n)! 365^n)`, `n = 23: 50.7%` (16 px) |

HUD, two readouts: **GUESTS** (count) and **CHANCE OF A MATCH** (%). Watermark `@squarewavelab`.

## Loop

The room starts and ends empty with every tile dark; frame 0 is the month panels starting to flash. The camera ends
where it starts.

## As built

- Kick every beat except beat 80 (the break at bar 20); no 3+3+2 kick in bar 12, the snare roll carries the build.
- A tile lands with the kick and the sub; there is no separate per-tile bass note. The off-beat `fm_bass` follows the party lights blinking over the calendar instead (dark in bar 20).
- Hats are the guests' footsteps (3 16ths after the door, and each guest leaving).
- The chance meter sits in the HUD (GUESTS, CHANCE OF A MATCH) rather than on the side wall.
- Code card: `pairs = n(n-1)/2` / `23 -> 253 -> 50.7%`. Title: HOW MANY PEOPLE / TILL TWO SHARE / A BIRTHDAY?
- Extra caption in bars 13-14: GUEST 23 SHARES / A BIRTHDAY.
- Seed 22: first match guest 23 with guest 20 on 31 August; later matches at guests 35, 36 (a triple on 18 April), 41, 45, 55, 64, 67.
