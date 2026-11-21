# Working in the 8-bit content bank

This repo makes pixel-art science explainers with 8-bit music, entirely in code, for the channel **Square Wave Lab** (handle `@squarewavelab`; put it as the small watermark near the bottom of every video). Read README.md first.

## Tools to use

- **Remotion**: follow the Remotion skills in `.agents/skills/` (start at `remotion-best-practices`). Register each video as its own `<Composition>` inside a series `<Folder>` in `src/Root.tsx`. Audio goes through `<Audio>` from `@remotion/media`; fonts through `@remotion/fonts`.
- **Music**: compose with Audio as Code (`audio-as-code==0.5.0`, run with `uv run --locked`). Keep the Python composer as the source of truth, use only the library's own synthesised instruments, keep seeds and track names stable, and write the WAV to `public/<slug>/track.wav`. Measurements in the render report are not a judgement of musical quality; say whether the audio was actually listened to.

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
