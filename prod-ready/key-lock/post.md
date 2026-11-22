# How Does a Key Open a Lock: ready to post

Series: How Things Work · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a cutaway lock on a wooden door, the question "How does a key open a lock?", and a key sliding in while five pins bounce up and down over its bumps, each bounce on the beat.
- **By the end:** every pin is cut in two, and the lock only turns when all five cuts sit on one line; a single pin off the line keeps it locked, a pick can set them one at a time, and the right key's bumps lift all five onto the line at once.

## Files

| File | Use | Spec |
|---|---|---|
| `key-lock.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, -13.4 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (the right key in, all 5 pins green on the line) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 57.8 (Instagram/YouTube, REVIEW, weakest: voice) and 73.0 (TikTok, PASS). None gives the answer to the ask (one pin: bars 6-7 show it).

**What's true in this video:** pin heights are computed from the key's profile under each pin (`h = key(x - pin)`), with Kwikset-style proportions: 5 pins 0.150 in apart, cuts in 0.023 in steps ([LockWiki, Kwikset](https://lockwiki.com/index.php/Kwikset_Classic)). The turn is allowed only when every split sits on the shear line, and the sim asserts it. **Time is slowed** (a real key goes in in about a third of a second): one pin spacing per 8th, then per 16th in the drop. The screen says "SLOWED DOWN" and so does the caption. Positions are exact. The picking is simplified: each pin sets on its push, in a fixed order.

**Every thing on screen is an instrument:** every time the pins land on a new step, you hear the kick. The front pin's height plays the hook, so the key's shape is the melody. The springs squashing play the mid-saw dyad. A pin reaching the line (it glows green) plays its stab note, and the glowing line plays the held mid chord. The key itself plays the bass, an octave up while it is pulled out. A blocked turn is the short CLUNK (root and octave, choked). A turn that works is the full chord stab.

**Music:** hard techno, 150 BPM, E Phrygian (Em Em F Em | C C Dm Dm | Am C Dm F | Em F C Dm | Am C Dm F | Em F Em F), the house sound (swoop kick and the approved patches, unchanged; kick and bass +3 dB). Kick and bass were raised after the owner said they were hard to hear: the springs, pins and lead were pulled down (kick is now the loudest stem, about 4 dB over the lead, as in eight-bits), and the bass went back up an octave on C and D (it had dropped to 32-37 Hz, below what a phone plays). Band balance per section (target 3/29/48/21): intro 6/40/34/20, rule 0/55/26/18, build 8/43/31/18, drop 5/43/35/17, drop 2 4/46/34/16, turn 6/45/33/16. 60-150 Hz now runs well over target (40-55 %, like eight-bits at 46-48 %), left in on purpose for the owner to judge by ear. The owner listened after this fix and approved it.

**Sync (measured, not yet watched with sound):** all 129 kick onsets land within 1 frame of their event. On the lead stem, 140 of 162 onsets are within 1 frame; 22 measure 1.0-1.5 frames early, all on big downward jumps of the front pin (the detector catches the attack before the note settles). Worth a frame-by-frame look.

**Loop:** `check_loop.py` PASS (audio seam 0.0, video seam ratio 2.54). Key A arrives at the keyhole in the last bar, as in the first frame.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Five Pins - Square Wave Lab`.

**Caption** (531 characters):

```
Comment your guess: how many wrong pins does it take to keep a door locked? This is how a key opens a pin tumbler lock.

Inside a Kwikset-style lock sit 5 pins, 0.15 inch apart, each cut in two and pushed down by a spring. Every bump on the key lifts one, and the cuts on a key differ by just 0.023 inch. The plug only turns when all 5 cuts sit on one line. I made the track from the lock itself: each note is a pin moving. Slowed down; positions exact.

Source: Kwikset KW1 key specs (LockWiki).

#lockpicking #howitworks #physics
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Five Pins - Square Wave Lab`.

**Caption** (371 characters):

```
Comment your guess: how many wrong pins does it take to keep a door locked? How a key opens a lock, slowed way down.

5 pins, 0.15 inch apart, each cut in two with a spring on top. The key's bumps lift them, and it only turns when all 5 cuts line up. I scored it from the lock: every note's a pin moving, so the key's shape is the tune.

#lockpicking #howitworks #physics
```

---

## YouTube Shorts

**Title** (26 characters):

```
How Does a Key Open a Lock?
```

**Description** (531 characters):

```
Comment your guess: how many wrong pins does it take to keep a door locked? This is how a key opens a pin tumbler lock.

Inside a Kwikset-style lock sit 5 pins, 0.15 inch apart, each cut in two and pushed down by a spring. Every bump on the key lifts one, and the cuts on a key differ by just 0.023 inch. The plug only turns when all 5 cuts sit on one line. I made the track from the lock itself: each note is a pin moving. Slowed down; positions exact.

Source: Kwikset KW1 key specs (LockWiki).

#lockpicking #howitworks #physics
```

**Thumbnail:** pick the frame at 0:21 (all 5 pins green on the line, the right key in).

---

## Before you post

- [x] Listen to the whole track on a phone speaker (owner approved the kick/bass fix)
- [ ] Step through 4 bars of each section frame by frame with sound on (sync check, not done by ear yet; look closest at the front pin's big drops)
- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: just one. If a single pin's cut is off the line, the plug can't turn. A pick sets them one at a time; the right key lifts all 5 onto the line at once.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
