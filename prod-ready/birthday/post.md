# How Many People Till Two Share a Birthday: ready to post

Series: Probability · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a party room with a giant calendar of every day of the year on the wall, the question "How many people till two share a birthday?", and the first guest walking in to light their birthday.
- **By the end:** every new guest has to be checked against everyone already in the room, so the pairs pile up much faster than the guests; at just 23 people there are 253 pairs and the chance of a shared birthday passes 50%, and by 70 it is nearly certain.

## Files

| File | Use | Spec |
|---|---|---|
| `birthday.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 35.2 s, H.264 + AAC, -13.8 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (the first match: guest 23's tile joined in red to guest 20's) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 74.0 (Instagram/YouTube, PASS) and 74.4 (TikTok, PASS). Neither gives the answer to the ask (57 people for 99%).

**What's true in this video:** the chance meter is exact: 1 - (365/365 · 364/365 · … · (366-n)/365), with 365 equally likely days and no 29 February. 23 guests: 50.7%, 70 guests: 99.9%. Pairs = n(n-1)/2. The party is one real random draw (seeded). **The seed was picked so the first match comes at guest 23**, the median (in half of all parties it comes at 23 or sooner); every later match (guests 35, 36, 41, 45, 55, 64, 67) is what that same draw gave. The pair lines show every new guest being checked against every lit day.

**Every thing on screen is an instrument:** the kick is a tile landing on the calendar (and the door opening between tiles); the hook (`trance_pluck`) is the pair lines flashing from the new tile to the old ones, so it fills out as the room fills; the off-beat bass is the party lights blinking; the hats are footsteps; the snare roll is the chance meter ticking up in the build; a match is the chord stab (`sync_lead`) and a clap.

**Music:** hard techno, 163.64 BPM, G minor (Gm Eb | Gm Bb F | Cm D | Gm Eb Bb F | Gm Eb Cm D | Eb Gm), its own sound vs the last three videos: a short punchy `kick_909` tuned to G with a separate sub, an off-beat `fm_bass`, a `trance_pluck` hook, `sync_lead` chord stabs. Band balance per section (target 3/29/48/21): intro 0/34/59/7, rule 0/37/55/8, build 0/31/44/25, drop 1 0/29/55/16, drop 2 0/30/47/23, turn 0/33/56/11. 1-5 kHz is short in the intro and rule (the hook is sparse while few guests are in). **Not yet listened to by the owner.**

**Sync:** the picture and the notes come from the same `timeline.json`. Measured on the stems: kicks within 0.3 frames of their events, pair-line notes median 0.2 frames.

**Loop:** `check_loop.py` PASS. The room ends empty with the month panels going dark; frame 0 lights them again.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Pairs Pile Up - Square Wave Lab`.

**Caption** (444 characters):

```
Comment your guess: how many people for a 99% chance two share a birthday? Birthday paradox, one real random party.

Most people guess around 180 for the even bet. It's 23. I let 70 guests walk in, and each new one gets checked against everyone already there, so 23 guests make 253 pairs. In this party guest 23 matched guest 20 on August 31, then the matches kept coming.

Maths: 365 equal days, no Feb 29.

#birthdayparadox #probability #math
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Pairs Pile Up - Square Wave Lab`.

**Caption** (333 characters):

```
Comment your guess: how many people for a 99% chance that two share a birthday? Birthday paradox, one random party.

Most people guess 180 for even odds. It's 23. Every new guest gets checked against everyone already here, so 23 people make 253 pairs. Here guest 23 matched guest 20 on August 31.

#birthdayparadox #probability #math
```

---

## YouTube Shorts

**Title** (36 characters):

```
When Do Two People Share a Birthday?
```

**Description:** the Instagram caption above.

**Thumbnail:** pick the frame at 0:18 (the first MATCH).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin your own first comment on each: `Answer: 57 people for a 99% chance. With 57 people there are 1,596 pairs, and each pair is another shot at a match.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
