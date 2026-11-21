# Working in the 8-bit content bank

This repo makes pixel-art science explainers with 8-bit music, entirely in code, for the channel **Square Wave Lab** (handle `@squarewavelab`; put it as the small watermark near the bottom of every video). Read README.md first.

## Tools to use

- **Remotion**: follow the Remotion skills in `.agents/skills/` (start at `remotion-best-practices`). Register each video as its own `<Composition>` inside a series `<Folder>` in `src/Root.tsx`. Audio goes through `<Audio>` from `@remotion/media`; fonts through `@remotion/fonts`.
- **Music**: compose with Audio as Code (`audio-as-code==0.5.0`, run with `uv run --locked`). Keep the Python composer as the source of truth, use only the library's own synthesised instruments, keep seeds and track names stable, and write the WAV to `public/<slug>/track.wav`. Shared mastering lives in `music/_shared/mastering.py` (`finish_loop` for the loop fold, loudness and limiter; `to_scientific_pitch` when a video's frequencies are powers of two, so every C is exactly 2^n Hz). Measurements in the render report are not a judgement of musical quality; say whether the audio was actually listened to.

## Music direction

From video 3 on, the sound is **drum & bass crossed with techno**: DnB tempo and backbeat (kick on 1, snare on 2 and 4, two-step kicks), reese and sub bass, with techno textures (acid 16ths, offbeat hats, hypnotic stabs, rumble). Keep chiptune colour in leads and arps. At 30 fps use 180 BPM (10 frames per beat) or 150 BPM (12). Physics still drives the drums wherever it can; anything added for groove is named as such in `post.md`.

## Loops

Every video must loop cleanly, picture and sound:
- Picture: the last frame continues into the first (same camera, same state; use a rotating frame or period-aligned time scale so the simulation itself repeats).
- Music: arrange the last bars to lead into the first (end on the texture the intro starts with), fold the tail onto the start (`finish_loop`).
- Run `uv run --locked python scripts/check_loop.py <slug>` after the build; it must print PASS.

## Rules every video follows

1. **One clock.** Choose BPM and fps first so frames per beat is a whole number (120 BPM at 30 fps = 15). Everything reads `public/<slug>/timeline.json`.
2. **Real physics.** Simulations compute the real equations. Time may be warped to land events on the beat, but positions stay exact, and the video says so on screen and in the caption.
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
