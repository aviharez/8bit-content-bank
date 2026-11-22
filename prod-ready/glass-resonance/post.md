# Can a Single Note Break Glass: ready to post

Series: Every Wave · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a speaker aimed at a wine glass on a lab bench, under the question "Can a single note break glass?"; the speaker is playing a tune at it.
- **By the end:** every glass has a note of its own; other notes barely move it, but its own note makes it shake 100 times more, like a swing pushed at the right moment, and held loud enough that note shatters it.

## Files

| File | Use | Spec |
|---|---|---|
| `glass-resonance.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, ~-8.7 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), loops (check_loop PASS) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY) and `ig-human` (PASS). None gives the answer to the ask (the note: the HUD shows it, and the caption box names it after the break).

**What's true in this video:** the rim is a driven, damped oscillator. Its steady-state motion, relative to the same push held still, is A = 1 / |1 - r^2 + i r / Q| with r = f / f0, and it follows the drive with the envelope time constant 2Q / (2 pi f0) = 0.36 s. This glass is given f0 = 880 Hz (A5) and Q = 1,000 (an assumed value, said in the YouTube description; real crystal glasses are in that range but each one differs). At its own note the rim moves 1,000x, one semitone away 9x: 109x less. The breaking point is set where the rim is on the downbeat of the drop (we chose it; the video does not claim a real breaking strain). Rim motion is exaggerated on screen, and the rim's two extreme shapes (the n = 2 oval mode) alternate every frame because 880 Hz is far faster than 30 fps. The bench rings are one wavelength apart (343 m/s / f). The shards fly with real ballistics (gravity, one bounce, restitution 0.3) at 1/8 speed, then rewind for the loop.

**Picture (3D, every effect shows the physics):** a speaker and a wine glass on a lab bench, under the question that stays on screen. The speaker cone pushes on every note and its halo lights while it plays; the rings on the bench are one wavelength apart for each note; the glass glows and its rim swings as it shakes harder. HUD in plain words: the note the speaker plays, and how hard the glass shakes ("barely", "a little", "a lot", "hard!") with a meter up to the breaking point. The break is the one moment with a white flash and a camera hit. The shards fall in slow motion, the camera circles them, then everything rewinds into the first frame.

**Every thing on screen is an instrument (the reference's rule):** the speaker is the lead (the exact notes that drive the simulated glass; it gets 4x louder while it holds A5); the glass's own voice is a held A5 whose volume follows the simulated shaking and stops dead on the drop; every shard landing is a high chord tone (glockenspiel), snapped to the nearest 16th. **Groove:** hard techno, the tuned "dem" four on the floor with rumble, clap on 2 and 4, 16th hats, offbeat open hat, distorted reese wall in legato 16ths, pad, riser, snare roll, impact, the hook again as a distorted lead in the drop, a rewind sweep back into the loop.

**Music:** hard techno, 150 BPM, A minor (Am, F, C, G), the house sound of `docs/music-reference.md`. Dense and level. Phone balance (200 Hz-5 kHz, `scripts/analyze_stems.py`): the speaker's tune sits within 2 dB of the kick top and the reese, and rises 12 dB above them as it holds A5 at 4x. All bands measure the same tempo (75 = half of 150). Key estimate: A minor. The drop (the break) lands at 25.6 s. Loop check: PASS. Mix and loudness measured, not yet listened to by the channel owner.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Can a Single Note Break Glass? - Square Wave Lab`.

**Caption** (461 characters):

```
Comment your guess: which note breaks this glass? A 20 cm wine glass vs one speaker, real resonance.

Every glass has a note it can't resist. Wrong note? The rim barely twitches. Hit its note and it swings 109 times further, since we gave this one a Q of 1,000. So I held it and turned it up 4x. It didn't last. You'll see the shards fall at 1/8 speed, and each landing's a note.

Source: A. P. French, Vibrations and Waves (1971).

#physics #resonance #science
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Can a Single Note Break Glass? - Square Wave Lab`.

**Caption** (347 characters):

```
Comment your guess: which note breaks this glass? A 20 cm wine glass vs one speaker, real resonance.

Wrong note, the rim barely twitches. Its own note? It's 109x further. I held it 6 seconds and turned it up 4x. It didn't make it. All 96 shards land on the beat at 1/8 speed, then it rewinds so you'll hear it again.

#physics #resonance #science
```

---

## YouTube Shorts

**Title** (30 characters):

```
Can a Single Note Break Glass?
```

**Description** (482 characters):

```
Comment your guess: which note breaks this glass? A 20 cm wine glass vs one speaker, real resonance.

The rim is a driven oscillator. Off its note, it barely moves. On it, it moves Q times further, and I gave this glass Q = 1,000: that's 109x more than a semitone away. I held the note for 6 seconds at 4x the volume. It shattered right on the drop. 96 shards, 1/8 speed, and every landing is a note.

Source: A. P. French, Vibrations and Waves (1971).

#physics #resonance #science
```

**Thumbnail:** pick the frame at 0:25 (the rim at full swing, just before the break).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker at ~40% volume (not done yet)
- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: A5, 880 Hz. That's the note this glass rings at, so that's the only note that can break it.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
