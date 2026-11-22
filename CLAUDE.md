# Working in the 8-bit content bank

This repo makes pixel-art science explainers with 8-bit music, entirely in code, for the channel **Square Wave Lab** (handle `@squarewavelab`; put it as the small watermark near the bottom of every video). Read README.md first.

## First rule: a stranger must get it

The channel owner's standard, above every other rule here. A viewer who knows no physics, scrolling with the sound on, must:
1. **Know what the video is about within 2 seconds.** The hook is a question people already wonder about, in everyday words ("Why do jets go BOOM?", not "What does Mach 1 sound like?"). It must make them curious enough to stay.
2. **Follow every step.** One idea per caption, in plain words, each held at least 2 bars. No jargon, symbols or raw factors (x128, Q, asin) before the code card at the end. Build the explanation in order: what we are looking at, the rule, what changes, the payoff.
3. **See who or what it happens to.** Abstract pictures (rings, curves) are anchored to something familiar: a listener standing there, a glass on a table, a heart. Use an everyday comparison where one exists (an ambulance siren for Doppler).
4. **Read the HUD at a glance.** At most two live readouts, in plain units, each labelled in plain words.
5. **The picture moves on the beat.** Pick topics whose physics is a series of events you can see happen: hits, swings, clacks, beats, bounces, pulses, collisions, breaks. Each event lands on the grid and is a sound, so the viewer sees every kick, note or riff happen on screen. A topic whose physics is a slow, continuous change (a colour shifting, a quantity drifting) has nothing to put on the beat; drop it, however good the question is (that is why "Why is the sky blue?" was dropped).
6. **See the content in the picture and hear it in the music.** 3D scenes that fill the frame (a place, light, a moving camera), like videos 1 and 2; flat 2D on an empty background reads as dull. Every effect shows the physics; nothing is decoration (no shake on every kick). The music is techno, drum and bass or EDM, always with the kick, synced to the picture, dense from the first frame (no empty intro), with a hook melody, and its build-up and drop land on the physics climax.

Before shipping, watch the render as that stranger and write two sentences in `post.md`: what the video is about after 3 seconds, and what you learned by the end. If either is hard to write, fix the video, not the sentence.

## Tools to use

- **Remotion**: follow the Remotion skills in `.agents/skills/` (start at `remotion-best-practices`). Register each video as its own `<Composition>` inside a series `<Folder>` in `src/Root.tsx`. Audio goes through `<Audio>` from `@remotion/media`; fonts through `@remotion/fonts`.
- **Music**: compose with Audio as Code (`audio-as-code==0.5.0`, run with `uv run --locked`). Keep the Python composer as the source of truth, use only the library's own synthesised instruments, keep seeds and track names stable, and write the WAV to `public/<slug>/track.wav`. Shared mastering lives in `music/_shared/mastering.py` (`finish_loop` for the loop fold and the master: it sets the loudness a phone speaker plays, -15.5 LUFS measured above 200 Hz, with a soft clip and limiter, which lands around -10 LUFS like the rest of the Reels/TikTok feed; -14 LUFS sounded quiet next to other videos; `to_scientific_pitch` when a video's frequencies are powers of two, so every C is exactly 2^n Hz). Measurements in the render report are not a judgement of musical quality; say whether the audio was actually listened to.

## Music direction

**Target sound: the channel owner's reference**, thel.ab67 "How a zombie outbreak starts" (music by LABORATOR), measured in `docs/music-reference.md`. This is the house sound for every new video: hard techno around 145-150 BPM, a dark minor key, four-on-the-floor "dem" kick, a distorted reese wall in the low end under a hook melody you can hum, clap on 2 and 4, 16th hats, offbeat open hat, dense and level from the first frame. Drum and bass or EDM only when the content clearly asks for it, and then just as dark and dense.
What makes the reference work, and what every video copies: **each thing on screen is an instrument.** In the reference the ECG is the kick, the heart monitor is the melody, the oxygen reading is the bass, the fever curve is the riser. So every visible element gets its own sound, the viewer can point at what they hear, and the music and the content are the same thing.
What every track shares is the foundation, and the rule that everything agrees:
- **The kick is the "dem".** A deep, long, distorted kick (kick_909, decay 2.0, heavy distortion, long notes so it rings ~300 ms), built with `music/_shared/dem.py`. Each hit is tuned to the root of the chord it sits under (`dem_tracks`), so the kick is the bass note and never fights the harmony. It comes with a "top" layer (same hits, bright, driven, highpassed at 150 Hz) because phone speakers cannot play the 43-65 Hz body; without it the kick vanishes on a phone. Keep the dem's drive low (4): its distortion sits after the gain, so a hard-driven dem stays loud whatever the gain and buries the melody.
- **The bass locks to the kick.** The bass line plays the same roots an octave above the kick, on the kick's rhythm. No separate sub under it.
- **Everything is selaras (in agreement).** One key, one chord progression that the bass, pads, leads and physics notes all follow; physics notes are tones of the current chord. One grid: every layer, physics included, lands on the same 8th/16th grid, and there is never a second, competing drum pattern. Choose the simulation's time scale so its events fall on the grid.
- **Mix for a phone at low volume.** Most people hear these on a phone speaker, which plays almost nothing below ~200 Hz. In the 200 Hz-5 kHz band, the lead melody, the kick's top, the bass and the physics sounds should sit within a few dB of each other; no single layer (e.g. the clacks) should stand alone on top.
- **There is always a melody you can hum.** A hook of 2-4 bars on a lead, from the first bar to the last, built from the chord tones; the physics changes its colour, loudness or register, never deletes it (e.g. the light that reaches a listener plays the hook, and it changes colour as the light changes). The reese wall is texture under the hook, not on top of it: keep it at drive ~4, gain ~0.35, and the hook within 3 dB of the kick top and the reese in the 200 Hz-5 kHz band. Measure with `uv run --locked python scripts/analyze_stems.py <slug> <bar> <bar> ...` (per-layer level from the stems, per section). A drive-10 reese at gain 0.85 sat 20 dB over the melody, and nobody could hear the notes.
- Check every new track: `uv run --locked python scripts/analyze_audio.py public/<slug>/track.wav` (all bands report the same tempo), `python3 scripts/analyze_kick.py public/<slug>/track.wav <bpm> <start> <end> 0` per bar (kick body on the chord root, ringing ~300 ms), and `python3 scripts/analyze_bass.py` (bass notes = the chord roots).

## Loops

Every video must loop cleanly, picture and sound:
- Picture: the last frame continues into the first (same camera, same state; use a rotating frame or period-aligned time scale so the simulation itself repeats).
- Music: arrange the last bars to lead into the first (end on the texture the intro starts with), fold the tail onto the start (`finish_loop`).
- Run `uv run --locked python scripts/check_loop.py <slug>` after the build; it must print PASS.

## Rules every video follows

1. **One clock.** Choose BPM and fps first so frames per beat is a whole number (120 BPM at 30 fps = 15). Everything reads `public/<slug>/timeline.json`.
2. **Real physics.** Simulations compute the real equations. Prefer a uniform time scale chosen so events land on the beat grid. Time may be warped to land events on the beat, but positions stay exact, and the video says so on screen and in the caption.
3. **Frame-pure rendering.** Everything drawn is a pure function of `useCurrentFrame()`. No clocks, no randomness, no state carried between frames.
4. **3D exception, on purpose.** Remotion's 3D rule is `<ThreeCanvas>` + React Three Fiber. We render three.js imperatively to an offscreen 360×640 canvas instead, because every frame must be palette-quantised and dithered after the 3D render. The rule's intent still holds: the scene is set from the frame number only, and there is no `useFrame`.
5. **Pixel pipeline.** 3D layer: `quantize(img, 34, false)` (Endesga 32 + Bayer dither). UI layer: `quantize(img, 0, true)` (crisp, alpha-thresholded). Integer scale only (3×).
6. **Type sizes at 360 px base (×3 on output).** Headline 32 px Press Start 2P, supporting text 16 px, labels 16 px Silkscreen. Silkscreen is caps-only, so use Press Start 2P for anything case-sensitive (code, units like m/M).
7. **Safe area.** Keep text 28 px from the sides; captions above y = 500 (Reels/TikTok UI covers the bottom).
8. **House style.** Thin-bordered panels, one big number, a two-line caption box, a code card at the end, a seamless loop (last frame returns to the first shot; the music tail is folded back onto the start).

## Adding a video

1. Pick an idea from `docs/ideas.md`; note its sound mapping.
2. `sims/<slug>.ts` writes `public/<slug>/timeline.json` (per-frame state + audio events in seconds).
3. `music/<slug>/compose.py` reads the events and writes `public/<slug>/track.wav`.
4. `src/videos/<slug>/` holds the scene and the composition; register it in `src/Root.tsx`.
5. `scripts/build.sh <slug> <CompositionId>`, then add a row to the README table.

## Captions

Lint every caption with the Instagram skills from `Jakeschincariol/instagram-agent-skill` (`ig-caption/caption.py` and `ig-human/detect.py`) before it ships. House rules: the reel carries the hook, so line 1 is the one ask (comment a guess) plus the topic in searchable words; 300-500 characters; at most 3 hashtags at the bottom; sources in one line. Never put the answer the ask invites people to guess in the caption.

## Shipping

Each finished video gets `prod-ready/<slug>/`: the MP4, `cover-9x16.png` (the composition's `<Still>`, key text inside the centre 3:4 crop, y 80-560 at base size), `cover-grid-3x4.png` (that crop), and `post.md` with the Instagram caption, TikTok caption, YouTube Shorts title (under 40 characters) and description, sound name, and a pre-post checklist.
