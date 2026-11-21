# 1,000 Balls, One Bell Curve: ready to post

Series: Probability · Channel: Square Wave Lab (`@squarewavelab`)

## Files

| File | Use | Spec |
|---|---|---|
| `galton-board.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 35.2 s, H.264 + AAC, ~-9 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), seamless loop (the bins drain in the last bar) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY) and `ig-human` (PASS). None gives the answer to the ask (218 balls in the middle bin, on screen at 0:29; theory says 226).

**What's true in this video:** an idealised Galton board. 1,000 balls, 12 rows of pegs, 13 bins; at every peg a ball goes left or right with probability 1/2 (a seeded coin, so every render is identical). Bin counts: 0 2 18 49 127 198 218 192 137 39 19 1 0 (theory, 1000 x C(12,k)/2^12: 0 3 16 54 121 193 226 193 121 54 16 3 0). Ball hops are gravity arcs in screen units, one 16th note each. Nothing is time-warped: balls are released on the 16th grid and every ball reaches its bin exactly 13 sixteenths later.

**Physics:** a ball entering bin k plays the k-th tone of the current chord (bin 0 lowest, bin 12 highest); balls entering the same bin on the same 16th are one note. Releases speed up through the track (1 a beat to about 6 per 16th), so the physics is the build. At 0:29 the finished curve plays back as one sweep, each note as loud as its bin is full. **Groove, not physics:** the "dem" kick tuned to each chord (E, C, G, D), the bass on the same roots, snare, clap, hats, pad, riser.

**Music:** chiptune dance, 150 BPM, E minor (Em, C, G, D). Every band measures the same tempo; kick body measured on each chord root (40, 65, 48, 35 Hz); balls, kick and bass within ~2 dB of each other in the phone band. Loop check: PASS. Mix and loudness measured, not yet listened to by the channel owner.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `1,000 Balls, One Bell Curve - Square Wave Lab`.

**Caption** (497 characters):

```
Comment your guess: of 1,000 balls, how many land in the middle bin? A Galton board, ball by ball.

I dropped every ball through 12 rows of pegs. Each peg's a coin flip: left or right, 50/50. Nothing steers them, yet they pile into a bell curve, because there are far more paths to the middle than to the edges.

Every bin plays its own note, so you can hear the curve. The middle sings most. The edges barely make a sound.

Source: Galton, Natural Inheritance (1889).

#math #probability #science
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `1,000 Balls, One Bell Curve - Square Wave Lab`.

**Caption** (301 characters):

```
Comment your guess: of 1,000 balls, how many land in the middle bin? Galton board, ball by ball.

Every peg's a coin flip. Left or right, 50/50. Nothing steers them, and they still build a bell curve. Each bin plays its own note, so you'll hear exactly which ones fill up.

#math #probability #science
```

---

## YouTube Shorts

**Title** (29 characters):

```
1,000 Balls Make a Bell Curve
```

**Description** (443 characters):

```
Comment your guess: of 1,000 balls, how many land in the middle bin? A Galton board, ball by ball.

I sent 1,000 balls through 12 rows of pegs. Each peg's a fair coin: left or right. Nobody aims them, yet you'll watch a bell curve build itself, because so many more paths lead to the middle. Every bin plays its own note, so the curve is something you can hear.

Source: Francis Galton, Natural Inheritance (1889).

#math #probability #science
```

**Thumbnail:** pick the frame at 0:21 (the curve half built).

---

## Before you post

- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: 218. Theory says 226 (924 of 4,096 paths lead to the middle).`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
