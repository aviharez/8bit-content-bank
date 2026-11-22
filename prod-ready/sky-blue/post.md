# Why Is the Sky Blue: ready to post

Series: Light · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a person standing on green hills under a blue sky, the question "Why is the sky blue?", and coloured squares of sunlight flying from the sun towards her: some reach her, some bounce off into the sky.
- **By the end:** sunlight is every colour mixed, and air bounces blue around about 4 times more than red, so bounced blue fills the sky; at sunset the light crosses up to 38 times more air, all the blue is bounced away on the way, and only red reaches her.

## Files

| File | Use | Spec |
|---|---|---|
| `sky-blue.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s, H.264 + AAC, ~-9 LUFS (mastered to phone-speaker loudness, -15.5 LUFS above 200 Hz), loops (check_loop PASS) |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY) and `ig-human` (PASS). None gives the answer to the ask (up to 38 times more air: the video shows it at the sunset).

**What's true in this video:** Rayleigh scattering, the share of light the air bounces grows as 1/wavelength^4. Optical depth of the whole atmosphere straight up: τ = 0.0088 × λ^-4 (λ in µm), so red 650 nm 0.049, green 550 nm 0.096, blue 450 nm 0.215: blue bounces 4.35 times more than red. The air a sunbeam crosses is the Kasten-Young airmass (1 straight up, 37.9 at the horizon), shown as km of sea-level air (8.4 km × airmass). "Blue through" is e^(-τ × airmass) for blue: 67% at the day sun (32° up), 0% at sunset, where red still gets 15% through. The sky colour on screen is the scattered light, τ × e^(-τ × airmass) per colour, so it turns from blue to orange-red by itself. Each square of light leaves the sun every 8th note; where it bounces is drawn from the same exponential law. Time is warped (a whole day in 38 s), positions and colours are exact.

**Picture (3D, every effect shows the physics):** voxel hills, trees and a person, the camera behind her looking up at the sun. The sky dome is coloured by the computed scattered light. Squares of red, green and blue light fly from the sun to her; the ones the air bounces fly off sideways, and at sunset only red squares arrive. Title switches to "Why is the sky red now?" at the drop. HUD: air crossed (km), blue light that gets through (%).

**Every thing on screen is an instrument (the reference's rule):** the sunlight that reaches her is the hook, a rhythmic 16th-note FM riff (accents 3+3+2) whose loudness is the share of sunlight that gets through the air. As the sun sets the bright riff fades and the same riff passes to a dark red lead, which carries the drop with an octave below on the accents; next morning it passes back. The squares the air bounces away are high glockenspiel pings, so a blue sky sparkles and a sunset goes quiet up top. The sun going down is the riser. **Groove:** hard techno, the tuned "dem" four on the floor with rumble, clap on 2 and 4, 16th hats, offbeat open hat, distorted reese in rolling 16ths under the riff, sky pad, snare roll and one beat of air into the drop.

**Music:** hard techno, 150 BPM, F# minor (F#m, D, Bm, C#), the house sound of `docs/music-reference.md`. Dense and level: loudness per 4 s within 0.5 dB end to end. Phone balance (200 Hz-5 kHz, `scripts/analyze_stems.py`): the riff, the kick top and the reese within 2 dB of each other. Kick body measured on the chord root (46 Hz = F#1 in bar 1). Loop check: PASS. Mix and loudness measured, not yet listened to by the channel owner.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Why Is the Sky Blue - Square Wave Lab`.

**Caption** (480 characters):

```
Comment your guess: how much more air does sunlight cross at sunset than at noon? Why is the sky blue, and sunsets red?

Each square is a bit of sunlight. Blue bounces off air about 4x more than red, so it's thrown everywhere and you see a blue sky. At sunset the light's road through the air gets long. The blue's bounced away before it reaches her, so only red makes it. I gave every square its own note.

Source: Lord Rayleigh, Phil. Mag. 41:447 (1871).

#physics #sky #science
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Why Is the Sky Blue - Square Wave Lab`.

**Caption** (427 characters):

```
Comment your guess: how much more air does sunset light cross than noon light? Why is the sky blue, and sunsets red?

Each square is sunlight. Blue bounces off air 4x more than red (Lord Rayleigh worked that out in 1871), so at noon it's all over your sky. At 6 pm its road through the air gets far longer. The blue's bounced away and only red reaches her. I gave every square a note. Wait for the drop.

#physics #sky #science
```

---

## YouTube Shorts

**Title** (19 characters):

```
Why Is the Sky Blue
```

**Description** (472 characters):

```
Comment your guess: how much more air does sunlight cross at sunset than at noon? Why is the sky blue, and sunsets red?

Each square is a bit of sunlight, and I gave each one its own note. Blue bounces off air about 4x more than red, so the blue you see overhead is bounced light. At sunset the light's road through the air gets far longer, the blue's bounced away, and only red gets through to her. Same sky, longer road.

Source: Lord Rayleigh, Phil. Mag. 41:447 (1871).
```

**Thumbnail:** pick the frame at 0:21 (sunset, red sky, only red squares arriving).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker at ~40% volume (not done yet)
- [ ] Same day on all three
- [ ] Pin your own first comment on each: `Answer: up to 38 times more. Straight up, sunlight crosses about 8 km worth of air. From the horizon, about 320 km. Blue doesn't survive the trip.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
