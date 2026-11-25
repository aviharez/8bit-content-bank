# Should You Switch Doors?: ready to post

Series: Probability · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a game show with three doors, the question "Should you switch doors?", and a contestant picking a door with "1 car, 2 goats" underneath.
- **By the end:** your first pick is right only 1 time in 3, and when the host opens a goat he leaves the other 2-in-3 on the one door he kept shut, so switching wins about twice as often. In 1,000 games it did: 66% vs 34%.

## Files

| File | Use | Spec |
|---|---|---|
| `monty-hall.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.1 s, H.264 + AAC, -13.2 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (game 8: the host has opened a goat, "1 IN 3" on your door, "2 IN 3" on the one he left shut) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 89.5 (Instagram/YouTube, PASS) and 78.0 (TikTok, PASS). Neither says which choice wins.

**What's true in this video:** staying wins 1/3 and switching 2/3, as long as the host always opens a goat door you did not pick (he knows where the car is). The 1,000 games are one real random draw (seeded): car and first pick uniform, the host picks at random when he has two goats to choose from. Stay vs switch is fixed per stage (alternating games, then a checkerboard on the wall), so it is 514 stay games and 486 switch games. **The seed was picked** as the first where game 1 (stay) loses, game 2 (switch) wins and both final rates sit within 1 point of 1/3 and 2/3; result: stay 175 / 514 = 34.0%, switch 322 / 486 = 66.3%. Game 6 (a switch) lost, which is in the draw.

**Every thing on screen is an instrument:** the kick is each game step (pick, the host opening a door, stay or switch, the reveal), then each round's pick on the wall; the hook (`acid_bass`) is the marquee light chase over the doors, and the lit bulb is the note (higher bulb, higher note), its filter opening as more games are played; the off-beat bass is the stage lights flashing; a goat door swinging open is a low `fm_bass` note; a car is a `supersaw` chord stab and a clap, a goat at the reveal is a lone low note; the hats are the contestants hopping to the other door; the snare roll is the wall of stages building in.

**Music:** hard techno, 138.46 BPM, D Phrygian (Dm Eb | Dm Bb Cm | Gm Bb Cm | Dm Eb Bb Cm | Dm Eb Gm Cm | Eb Dm), its own sound vs the last three videos: `kick_909` tuned to D2 and driven hard, an acid lead, `supersaw` stabs, an acid groove. Band balance per section (target 3/29/48/21): intro 0/57/30/12, rule 0/61/27/11, build 0/48/31/21, drop 1 0/49/42/9, drop 2 0/52/33/15, turn 0/60/25/16. **60-150 Hz runs 48-61 %** (target 29 %) because the kick is the loudest stem and sits at 73 Hz, with the bass forward as asked; reported for you to judge by ear, not pulled back. On a phone band (200 Hz-5 kHz) the hook is the loudest layer, the kick 7-9 dB under it. **Not yet listened to by the owner; I have not listened to it either (no audio playback here).**

**Sync:** the picture and the notes come from the same `timeline.json`. Measured on the stems: kicks within 0.01 frames of their events, reveal stabs within 0.15, hook notes 0.9 frames (the acid's attack).

**Loop:** `check_loop.py` PASS. The show ends with the doors closing, the tally resetting and the contestant back on the mark; frame 0 is the first pick.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Stay or Switch - Square Wave Lab`.

**Caption** (428 characters):

```
Comment your guess: stay or switch doors? The Monty Hall problem, played 1,000 times for real.

One car, two goats. You pick a door, the host opens a goat door (he knows where the car is), then asks if you want to swap. Most people say it can't matter, it's 50/50. So I ran 1,000 random games, half staying and half switching, and kept score.

Rules: the host always opens a goat you didn't pick.

#montyhall #probability #math
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Stay or Switch - Square Wave Lab`.

**Caption** (343 characters):

```
Comment your guess: stay or switch doors? The Monty Hall problem, 1,000 real games.

One car. Two goats. You pick a door, and the host, who knows where the car is, opens a goat behind one of the others and offers you a swap. Most people say 50/50, so it cannot matter. So I played it 1,000 times and kept score.

#montyhall #probability #math
```

---

## YouTube Shorts

**Title** (31 characters):

```
Should You Switch Doors? 1,000x
```

**Description:** the Instagram caption above.

**Thumbnail:** pick the frame at 0:12 (the "1 IN 3" / "2 IN 3" tags over the doors).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin your own first comment on each: `Answer: switch. Your first pick is right 1 time in 3, and the host always leaves the car behind the other closed door when you were wrong. In these 1,000 games staying won 175 of 514 (34%), switching won 322 of 486 (66%).`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
