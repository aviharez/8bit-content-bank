# How Does a Speaker Make Sound: ready to post

Series: Every Wave · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a phone plugged into a speaker on a desk, the question "How does a speaker make sound?", and the cable flashing with every kick of the song you hear.
- **By the end:** the song travels as electricity into a coil sitting in a magnet, which pushes the cone out and back; each push squeezes the air into a wave (wide for low notes, tight for high ones) that crosses the room and moves your eardrum just like the cone.

## Files

| File | Use | Spec |
|---|---|---|
| `speaker.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, -12.7 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), 47 MB |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (the drop, the waves crossing the room) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 50.5 (Instagram/YouTube, REVIEW) and 68.3 (TikTok, REVIEW). None gives the answer to the ask (the SMALL CONE readout shows it from bar 10).

**What's true in this video:** the cones move with the finished track itself: the master is split by a 700 Hz Linkwitz-Riley crossover; the low part drives the big cone (scaled so the kick swings it about 1.9 mm, drawn 5x, said on screen) and the high part the small one. The scope draws each cone's real path over each 1/30 s, and "pushes a second" is the strongest frequency in that cone's signal. The eardrum moves with the same signal (drawn huge, said on screen). **Sound's travel is slowed 46x** (3 m in one beat, 0.4 s, instead of 1/115 s), said on screen and in the caption. Each sound leaves as a wave packet; wavelengths are drawn in proportion to the real ones (lambda = c / f) at one shared scale. The cable lights all at once on a kick (current flows in the whole wire at once). Motor rule: F = B·I·L.

**Every thing on screen is an instrument:** the kick is the cable's surge, the coil's jump and a wide white wave; the bass is the coil's glow and a blue wave; the mid dyad (every 8th) is an orange wave; the hook is the small cone's glow and its tight yellow rings (and the cochlea's glow in the ear); the drop's stabs are white flashes and white rings. Picture rebuilt after the owner found the first cut (speaker + sand) dull; the music is unchanged.

**Music:** hard techno, 150 BPM, E Phrygian (Em Em F Em | C C Dm Dm | Am C Dm F | Em F C Dm | Am C Dm F | Em F Em F), the house sound (swoop kick and the approved patches, unchanged; kick and bass +3 dB). Band balance per section (target 3/29/48/21): intro 13/48/32/7, rule 2/64/29/5, build 6/49/27/19, drop 6/46/39/10, drop 2 5/51/35/9, turn 14/43/31/11. 60-150 Hz runs well over the target and 1-5 kHz under it, left in on purpose for the owner to judge by ear. **Not yet listened to by the owner.**

**Sync (measured, not yet watched with sound):** kick 98 of 108 onsets within 1 frame of their event (the rest are in the 16th runs, where the held kick blurs the onset; max 1.7 frames). Lead 195 of 197, bass 188 of 217 (max 1.2 frames).

**Loop:** `check_loop.py` PASS. The last bar flies from the ear back to the first shot of the phone and speaker.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Push The Air - Square Wave Lab`.

**Caption** (557 characters):

```
Comment your guess: how many times a second does the small cone push on high notes? How a speaker works and makes sound.

A coil of wire sits in a magnet's gap, glued to a paper cone. Current through the coil pushes it out and pulls it back, following the song. The cone squeezes the air, and each squeeze races 3 m across the room to your eardrum, which moves just like the cone. On the kick, the big cone pushes 82 times a second. I slowed the waves 46x so you can see them.

Source: the motor force F = BIL (HyperPhysics).

#speaker #howitworks #physics
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Push The Air - Square Wave Lab`.

**Caption** (418 characters):

```
Comment your guess: how many times a second does the small cone push on high notes? How a speaker works and makes sound.

It's a coil sitting in a magnet, glued to a cone. Current shoves it out, then yanks it back, 82 times a second on the kick. Each push squeezes the air. That squeeze crosses a 3 m room in 1/115 of a second and hits your eardrum. I slowed it 46x so you can watch it.

#speaker #howitworks #physics
```

---

## YouTube Shorts

**Title** (30 characters):

```
How Does a Speaker Make Sound?
```

**Description:** the Instagram caption above.

**Thumbnail:** pick the frame at 0:21 (the drop, the waves crossing the room).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin your own first comment on each: `Answer: about 700 to 2,000 times a second on the hook (watch SMALL CONE). The big cone does about 82 on the kick. That's why high notes look like tight rings and low notes like wide waves.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
