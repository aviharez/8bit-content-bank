# Why Do Jets Go Boom: ready to post

Series: Every Wave · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a jet flying over fields with rings spreading from it, under the question "Why do jets go BOOM?"; the rings are its sound.
- **By the end:** sound has a fixed speed (1,235 km/h); as the jet catches up with its own sound the rings squeeze in front (so the engine sounds higher ahead, like an ambulance), at the speed of sound they stack into one wall, and that wall is the boom, which trails the jet and hits each place on the ground once.

## Files

| File | Use | Spec |
|---|---|---|
| `mach-one.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, ~-8.5 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), loops (check_loop PASS) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY) and `ig-human` (PASS). None states the answer (the rings stack into one wall, the shock wave: the video shows it at 0:19).

**What's true in this video:** real time, no warp. Sound spreads at 343 m/s (1,235 km/h); one ring is drawn per 8th note (the fronts are continuous; the rings sample them). A listener far ahead hears the engine shifted by 1 / (1 - M). The speed is chosen so that factor lands on harmonics (2x at Mach 0.5, 3x, 4x at 0.75, 6x, 8x ... 128x), each new step starting on the grid after a quarter-beat throttle ramp; it goes to infinity at the speed of sound (19.2 s, the drop). Faster than sound (Mach 1 to 2): nothing is heard ahead, the fronts trail in a cone of half-angle asin(1/M). The towers stand beside the path, placed (solved numerically) so the boom, the first arrival of any front made since Mach 1, reaches each one exactly on a kick; the listener stands on the tower hit on beat 66 (26.4 s). Outro: back down below the speed of sound to the opening state. The jet and the listener are drawn far larger than to scale (said on screen); 1 scene unit = 100 m.

**Picture (3D, every effect shows the physics):** a chase camera over fields. HUD: the jet's speed in km/h against a red "SOUND" mark, and what she hears ahead as words and a wave that squeezes as the note climbs ("a low hum" -> "a scream" -> "nothing" -> "BOOM!"). The rings pile up ahead; a vapour collar forms around the speed of sound; the frame whites out once with the only camera hit; then a translucent cone and its edge lines trail the jet, and each tower's beacon flashes with a shock ring when the cone sweeps over it. Around her boom the camera flies to her platform and looks back up the path: the jet passes in silence, then the wall hits and she jumps.

**Every thing on screen is an instrument (the reference's rule):** the rings are the hats (one per ring, the offbeat ones open); the engine as she hears it is the lead, stepping up the harmonics 2x, 3x, 4x, 6x, 8x ... (D and A only), faster and faster: that climb is the riser, and it is silent once the jet is faster than sound; every kick in the drop is a tower's boom (with a boom layer), and her tower gets an impact and a crash; the jet's speed drives the reese wall. **Groove:** hard techno, the tuned "dem" four on the floor with rumble, clap on 2 and 4, distorted reese wall in legato 16ths, pad, a dark riff in the drop, snare roll into the speed of sound.

**Music:** hard techno, 150 BPM, D minor (Dm, Bb, Gm, A; bars 8-11 hold Dm under the climb), the house sound of `docs/music-reference.md`. Dense and level: loudness per 4 s within 0.8 dB end to end. All bands measure the same tempo (75 = half of 150). Low end across a beat never drops below 0.86 of its peak (reference: 0.68-0.77). Loop check: PASS. Mix and loudness measured, not yet listened to by the channel owner.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Why Do Jets Go Boom? - Square Wave Lab`.

**Caption** (461 characters):

```
Comment your guess: why does a jet go BOOM when it passes the speed of sound? Watch the rings, in real time.

Each ring is the jet's sound, moving at 1,235 km/h. As the jet speeds up, it chases its own sound, and the rings get squeezed in front. That's why she hears the engine climb higher, like a siren. Then it catches up. Every beat of this track is one of those rings or one tower getting hit.

Source: NASA Glenn, Mach Angle.

#physics #sonicboom #science
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Why Do Jets Go Boom? - Square Wave Lab`.

**Caption** (325 characters):

```
Comment your guess: why does a jet go BOOM at the speed of sound? Watch the rings, in real time.

Each ring's the jet's sound at 1,235 km/h. Speed up and the jet chases it, so the rings squeeze in front and the engine climbs higher, like a siren. Then it catches up. Listen to her tower at 0:26.

#physics #sonicboom #science
```

---

## YouTube Shorts

**Title** (20 characters):

```
Why Do Jets Go Boom?
```

**Description** (461 characters):

```
Comment your guess: why does a jet go BOOM when it passes the speed of sound? Watch the rings, in real time.

Each ring is the jet's sound, moving at 1,235 km/h. The jet speeds up and chases its own sound, so the rings squeeze in front and she hears the engine climb, like an ambulance coming at you. Then the jet catches up. I made every hat in the track a ring and every kick a tower getting hit.

Source: NASA Glenn, Mach Angle.

#physics #sonicboom #science
```

**Thumbnail:** pick the frame at 0:18 (the rings piled up at the nose just before the speed of sound).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker at ~40% volume (not done yet)
- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: the jet catches up with its own sound. All the sound waves it made pile up into one wall, and that wall hitting you is the boom. It follows the jet the whole time it's faster than sound, so everyone underneath hears their own boom.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
