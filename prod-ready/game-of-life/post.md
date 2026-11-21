# Game of Life Sequencer: ready to post

Series: Chaos · Channel: Square Wave Lab (`@squarewavelab`)

## Files

| File | Use | Spec |
|---|---|---|
| `game-of-life.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 32 s, H.264 + AAC, ~-10 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), loops exactly (generation 64 is generation 0) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY) and `ig-human` (PASS). None gives the answer to the ask (64 generations, on screen at 0:28).

**What's true in this video:** Conway's rules (B3/S23) run exactly on a 16 × 16 board whose edges wrap. One glider (it moves one cell diagonally every 4 generations, so it laps the board in 64) plus two beacons and two blinkers (period 2), placed by a search that ran the rules and kept only a layout that first repeats at generation 64 with nothing colliding. One generation per beat; 64 generations = 32 s.

**Physics:** the board is the step sequencer. A playhead reads one column per 16th, and every live cell under it plays a note: row = pitch, each row a tone of the current 7th chord (432 notes). The glider's cells play the lead (the melody travels with it); the blinkers' and beacons' cells pluck the riff. **Groove, not physics:** the "dem" kick tuned to each chord (C, Ab, Eb, Bb), the bass on the same roots, snare, clap, hats, pad, riser.

**Music:** synth-pop, 120 BPM, C minor (Cm7, Abmaj7, Ebmaj7, Bb7). Kick and full mix measure 120 BPM; the hat band reads 80 BPM because the oscillators' cells sit 3 columns apart (a 3-sixteenth syncopation on the same grid), with 120 next. Kick body measured on each chord root (65, 51, 38, 59 Hz). Lead, riff, kick and bass within ~1 dB of each other in the phone band. Loop check: PASS. Mix and loudness measured, not yet listened to by the channel owner.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Game of Life Sequencer - Square Wave Lab`.

**Caption** (499 characters):

```
Comment your guess: how many generations until this Game of Life board repeats? Conway's Game of Life as a sequencer.

I put one glider, two blinkers and two beacons on a 16x16 board whose edges wrap. Three rules, nothing else. A line sweeps the board, and every live cell it touches plays a note. The glider's the melody. The blinkers and beacons are the riff. And at one exact generation, the whole board's back to frame one.

Source: Gardner, Scientific American (1970).

#math #gameoflife #synth
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Game of Life Sequencer - Square Wave Lab`.

**Caption** (378 characters):

```
Comment your guess: how many generations until this Game of Life board repeats? Conway's Game of Life as a sequencer.

I let every live cell under the line play a note. The glider? Melody. One glider, two blinkers and two beacons on a 16x16 board that wraps around, three rules from 1970, and I'll show you the exact moment the whole thing starts over.

#math #gameoflife #synth
```

---

## YouTube Shorts

**Title** (31 characters):

```
Game of Life Plays a Synth Loop
```

**Description** (483 characters):

```
Comment your guess: how many generations until this Game of Life board repeats? Conway's Game of Life as a sequencer.

I gave a 16x16 wraparound board one glider, two blinkers and two beacons. Born with 3 neighbours, survive with 2 or 3, die otherwise. A playhead sweeps the columns and every live cell it hits plays a note, so the glider sings and the rest loops. Watch the counter: it's a perfect loop.

Source: Martin Gardner, Scientific American (1970).

#math #gameoflife #synth
```

**Thumbnail:** pick the frame at 0:17 (the glider labelled mid-board).

---

## Before you post

- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: 64. The glider needs 4 generations per step and 16 steps to lap the board.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
