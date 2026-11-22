# Why Does a Guitar String Sing: ready to post

Series: Every Wave · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a guitar and a bass lying on a table, the question "Why does a guitar string sing?", and the thick low string flashing and swinging on every kick of the song you hear.
- **By the end:** a plucked string swings between its two ends; pressing a fret makes the swinging part shorter, so the note goes up; touching it lightly at a half, a third or a quarter splits it into 2, 3 or 4 loops; one pluck swings in all those loops at once, which is the guitar's sound; and a longer, heavier bass string sounds an octave lower.

## Files

| File | Use | Spec |
|---|---|---|
| `guitar-string.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, -12.4 LUFS (mastered to phone-speaker loudness, -15.6 LUFS above 200 Hz), 40 MB |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (the drop: the low string with its 1, 2 and 4 loops beside it) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 50.5 (Instagram/YouTube, REVIEW) and 54.6 (TikTok, REVIEW). Neither gives the answer to the ask (the LOW STRING readout shows it from the first frame, so the video answers it, not the caption).

**What's true in this video:** every sound is one string you can see, at that string's real pitch, on the string and fret that make it (checked in `sims/guitar-string.ts`). The kick is the open low E (82.4 Hz). In bars 2-5 and 12-15 that string is drawn with its real plucked shape (d'Alembert, 40 modes, plucked over the sound hole), **slowed 33x** so one swing is one beat (said on screen). Other strings show the blur a camera would see, **drawn wider than the real 1-3 mm** (said on screen). Frets sit at their real places (L·2^(-n/12), 64.8 cm guitar, 86.4 cm bass). Harmonics are touched at L/n and swing in n loops at n × 329.6 Hz. Formula: f = n·v/(2L), v = sqrt(T/mu).

**Every thing on screen is an instrument:** the kick is the low E string (white flash, slow-motion swing); the bass line is the bass guitar, a fingertip on each fret (blue); the mid saws are strings 5 and 4 an octave apart (orange); the hook is strings 1-3 under a fingertip with the fret lighting up, and in the build string 1 touched lightly into 2, 3 and 4 loops (yellow); the drop's stabs are strings 1-3 strummed together in the hook's gaps (white); in the turn, the top and the sound hole send a ring of air on every kick.

**Music:** hard techno, 150 BPM, E Phrygian (Em Em F Em | C C Dm Dm | Em Em Em Em | Em F C Dm | Am C Dm F | Em F Em F), the house sound (swoop kick and the approved patches, unchanged; kick and bass +3 dB). Band balance per section (target 3/29/48/21): intro 11/54/29/6, rule 1/66/29/4, build 7/40/41/12, drop 6/50/36/9, drop 2 5/56/31/8, turn 13/55/26/6. 60-150 Hz runs well over the target and 1-5 kHz under it, like the speaker video, left in on purpose for the owner to judge by ear. **Not yet listened to by the owner.**

**Sync:** the picture and the notes come from the same `timeline.json`. Checked frame by frame on the render around a drop bar: the strum, the kick and each hook note appear on their own frame, and the HIGH STRING readout changes on the note.

**Loop:** `check_loop.py` PASS. The last bars pull back to the first wide shot of both instruments.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Many Loops - Square Wave Lab`.

**Caption** (481 characters):

```
Comment your guess: how many times a second does the thickest guitar string swing? Why a guitar string makes sound.

The low E is 65 cm of steel between nut and bridge. Press the 12th fret and half of it swings: one octave up. Tap it lightly right there instead and it splits into 2 loops. A bass string is 86 cm and heavier, so it sits an octave under. I slowed the low string 33x so you can watch it.

Source: string modes f = nv/2L (HyperPhysics).

#guitar #physics #howitworks
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Many Loops - Square Wave Lab`.

**Caption** (371 characters):

```
Comment your guess: how many times a second does the thickest guitar string swing? Why a guitar string makes sound.

65 cm of steel, pinned at both ends. Press the 12th fret, half of it swings, one octave up. Tap it there lightly and it splits into 2 loops. The bass string is 86 cm and heavier, an octave under. Low string slowed 33x here.

#guitar #physics #howitworks
```

---

## YouTube Shorts

**Title** (30 characters):

```
Why Does a Guitar String Sing?
```

**Description:** the Instagram caption above.

**Thumbnail:** pick the frame at 0:20 (the drop, the low string with its loops).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin your own first comment on each: `Answer: about 82 times a second (watch LOW STRING). That's the note E2. Press the 12th fret and it doubles to about 165. The thinnest string does about 330 open.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
