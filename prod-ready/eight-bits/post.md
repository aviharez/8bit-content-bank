# How Do Computers Count With 0 & 1: ready to post

Series: How Computers Work · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a tower of 8 coloured lights in a dark machine room, the question "How do computers count with 0 & 1?", and the number on screen going up by one each time a light flips on the beat.
- **By the end:** each light is worth double the one below it, the number is just the lit values added up, and adding 1 flips the bottom light and carries up; 8 lights reach 255, and one more turns them all off and back to 0.

## Files

| File | Use | Spec |
|---|---|---|
| `eight-bits.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 35.2 s, H.264 + AAC, -12.7 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (173 = 10101101 lit, "= ?") |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY); `ig-human` scored 65 (Instagram/YouTube) and 72 (TikTok), REVIEW, no FAIL. None gives the answer to the ask (255: the HUD shows it in the last bar).

**What's true in this video:** an exact 8-bit binary counter, n -> n + 1 from 0 to 255, and 255 + 1 overflows to 0 (there is no 9th light). Nothing is warped: the counting speed steps up (2.5, 5, then 10 counts a second) so every count lands on the beat grid.

**Every thing on screen is an instrument:** a light switching on plays its note (the chord tone stacked by its position: lights 1-8 on the lead, 16-128 on the stab), so counting order is the arpeggio hook. The light that flips once a beat is the kick (the amber ring sits on it and slides up when the counting speeds up). Every count is a bass note. Light 2 switching on is the mid-saw pulse. A big carry (3+ lights off at once) is a chord stab. Lights 16/32/64 choose the chord; light 64 lit holds a mid chord, light 128 lit holds the high whine. The drop is 128 (7 lights carry, the room turns red).

**Music:** hard techno, 150 BPM, E Phrygian (Em F C Dm Am C Dm F, read from the big lights), the house sound (swoop kick and the approved patches, unchanged). Not yet listened to: mix and loudness are measured only.

**Loop:** audio PASS. Video: `check_loop.py` prints FAIL (seam ratio 6.9 against a limit of 3): the seam is the overflow, all 8 lights going off on the beat, which is the same size of change as the drop (127 -> 128 measures 5.2 at the same metric; the seam 5.9). The camera, room and caption flow straight through.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `8 Lights Count to 255 - Square Wave Lab`.

**Caption** (431 characters):

```
Comment your guess: how high can 8 lights count before they run out? It's binary, how a computer counts with 0 and 1.

Each light is worth double the one below it. Add 1. The lowest light flips, and any light that switches off carries 1 up to the next. I built the whole track from the lights: every sound is one switching, and the ring is the kick.

Source: binary place value (8 bits = 1 byte).

#binary #computerscience #coding
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `8 Lights Count to 255 - Square Wave Lab`.

**Caption** (335 characters):

```
Comment your guess: how high can 8 lights count? It's binary counting with just 0 and 1.

Each light's worth double the one below it. Add 1 and the lowest light flips; a light that switches off carries 1 up. I made every sound here from a light switching. The ring's the kick. Wait for the top light.

#binary #computerscience #coding
```

---

## YouTube Shorts

**Title** (33 characters):

```
How Do Computers Count With 0 & 1
```

**Description** (431 characters):

```
Comment your guess: how high can 8 lights count before they run out? It's binary, how a computer counts with 0 and 1.

Each light is worth double the one below it. Add 1. The lowest light flips, and any light that switches off carries 1 up to the next. I built the whole track from the lights: every sound is one switching, and the ring is the kick.

Source: binary place value (8 bits = 1 byte).

#binary #computerscience #coding
```

**Thumbnail:** pick the frame at 0:23 (128 just lit, the room red).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker at ~40% volume (not done yet)
- [ ] Step through 4 bars of each section frame by frame with sound on (sync check, not done by ear yet)
- [ ] Decide on the loop check (FAIL by its threshold, see above)
- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: 255. 128+64+32+16+8+4+2+1 = 255, so 8 lights make 256 numbers counting 0. One more and they all switch off: that's an overflow.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
