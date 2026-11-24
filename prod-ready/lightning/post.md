# How Far Away Is the Lightning: ready to post

Series: How Nature Works · Channel: Square Wave Lab (`@squarewavelab`)

## As a stranger sees it

- **After 3 seconds:** a person standing on a deck on a hill in a storm, the question "How far away is the lightning?", and a bolt hitting the valley while a white ring of thunder starts rolling toward them.
- **By the end:** you see a flash at once but hear its thunder later, because the sound walks to you at 343 m a second; count the seconds and every 3 of them is 1 km; when the flash and the bang come together, the lightning is right above you.

## Files

| File | Use | Spec |
|---|---|---|
| `lightning.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 37.3 s, H.264 + AAC, -13.1 LUFS (mastered to phone-speaker loudness, -15.6 LUFS above 200 Hz), 48 MB |
| `cover-9x16.png` | Instagram Reel cover, TikTok cover | 1080 × 1920 (the drop: a bolt hitting the tree in front of the deck) |
| `cover-grid-3x4.png` | What the Instagram profile grid shows (centre 3:4 crop) | 1080 × 1440 |

All captions passed `ig-caption` (READY). `ig-human` scored 67.3 (Instagram/YouTube, REVIEW) and 57.5 (TikTok, REVIEW). Neither gives the answer to the ask (about 2 km).

**What's true in this video:** sound travels at 343 m/s (air at 20 °C), and the thunder ring grows at exactly that speed. Power line towers stand 343 m apart, so the ring passes one tower per second. **Time is squeezed about 2.1x** (one second of the storm takes 0.47 s of video), said on screen as TIME SQUEEZED. Distances are exact: a strike 8 seconds away hits a tower 2.7 km out, 4 s is 1.4 km, 2 s is 0.7 km, 1 s is 0.3 km. In the drop the strikes hit the tree and the pole 16 m in front of the deck (0 seconds). Light's travel time (under 10 microseconds over these distances) is treated as zero. Rule: km = seconds / 3 (343 m/s ≈ 1 km per 3 s).

**Every thing on screen is an instrument:** the kick is the thunder ring passing a tower (its red lamp flashes white), reaching the deck, or a bolt hitting; the off-beat bass is the rumble clearing the tower; the BOOM (a driven clap and a short FM stab) is the thunder reaching the listener; the hook is the lightning's leader stepping down from the cloud (falling notes) and its return strokes flickering up the bolt (rising notes); the harmony is the side branches; the chord stab is the land lit white by each flash; the growl is the thunder ring on its way, louder each second; the hats are drips landing in the puddle on the deck; the snare roll is strikes one second apart.

**Music:** hard techno, 128.57 BPM, C# Phrygian dominant (C# D C# D | F#m D Bm C# | F#m D Bm C# | C# D Bm C# | D C# D C#), its own sound: a `kick_909` driven hard and tuned to C#, an off-beat sub bass, a `sync_lead` hook, `hoover` chord stabs with no detune, `metal_hat`, an `electronic_snare` roll. Kick the loudest stem; bass 3 dB under it, the hook 4 dB under. Band balance per section (target 3/29/48/21): intro 0/69/24/7, rule 6/54/31/10, build 5/50/30/15, drop 1/53/27/19, turn 0/66/24/10. 60-150 Hz runs well over the target because the kick sits forward on C# (69 Hz); left in on purpose for the owner to judge by ear. **Not yet listened to by the owner.**

**Sync:** the picture and the notes come from the same `timeline.json`. Measured on the final MP4: each of the 16 strikes in the drop flashes and sounds on its own event frame (0 frames off).

**Loop:** `check_loop.py` PASS. The video opens 4 frames before the first strike, so the loop point falls while the first leader is growing.

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Thunder Walks - Square Wave Lab`.

**Caption** (486 characters):

```
Comment your guess: you see the flash, then the thunder comes 6 seconds later. How far away is the lightning storm?

Light from the bolt reaches you almost at once. The thunder crawls behind it at 343 metres every second, so here it passes one power line tower each second on its way to you. Count the seconds and you know the distance. Time is squeezed about 2x so the storm fits in the video.

Source: speed of sound in air at 20 °C (HyperPhysics).

#lightning #thunderstorm #physics
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Thunder Walks - Square Wave Lab`.

**Caption** (312 characters):

```
Comment your guess: flash, then thunder 6 seconds later. How far away is the lightning storm?

Light gets to you almost at once. Thunder walks at 343 metres a second, one power line tower per second here. Count the seconds, get the distance. Time squeezed about 2x so it fits.

#lightning #thunderstorm #physics
```

---

## YouTube Shorts

**Title** (30 characters):

```
How Far Away Is the Lightning?
```

**Description:** the Instagram caption above.

**Thumbnail:** pick the frame at 0:19 (the drop, a bolt hitting the tree).

---

## Before you post

- [ ] Listen to the whole track on a phone speaker
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin your own first comment on each: `Answer: about 2 km. Sound walks about 1 km every 3 seconds, so 6 seconds means 2 km. If the flash and the bang come together, it's right on top of you, get inside.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
