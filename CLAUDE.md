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

**Target sound: the channel owner's sample** (a 67 s hard-techno track; the WAV and its transcription are the owner's, kept locally in the git-ignored `audio-analytic-AI/`). Measured in `docs/music-reference.md` ("Target sound v3"); the reference implementation is `music/_demo/sample-replica/compose.py`, which re-plays the whole sample with our instruments and that the owner approved. This is the house sound for every new video: hard techno around 143-150 BPM, a dark key (E Phrygian in the sample: the half step above the root is the colour), dense and level from the first frame. It replaces the earlier "dem" kick and reese wall sound (thel.ab67 reference), which is no longer used for new videos.

**The instruments are fixed.** Use only these patches, unchanged: the swoop kick (`music/_shared/swoop.py`) and the bass, mid saws, lead and stab in `music/_shared/target_sound.py`. The owner approved their sound; do not change the timbres, add width/reverb/brightness layers, or bring in other instruments to make a track bigger (tried and rejected). To make a track thicker or more complex, add parts played by these instruments: a harmony under the lead, chord stabs, a pulse, counter-lines.
- **Kick ("the swoop").** A sine swooping from ~250 Hz down to the key's root (E2 in E), hard-clipped, each hit held until the next one. It is the low-mid tone of the track and plays on a phone as it is (no top layer). Its pattern changes by section: syncopated 8th runs, four on the floor, 3+3+2, near-empty bars in a break. Set `pitch` to the key's root if the key is not E.
- **Bass.** Its own rolling line under the kick, not the kick's root on the kick's rhythm: 16th pickups crawling chromatically into a held root, octave jumps, the chord roots on the strong beats.
- **Mid saws.** Detuned saws in octave dyads, the 150 Hz-1 kHz body of the track.
- **Lead and stab.** One hard-clipped sine filtered into 0.7-2 kHz, played as the hook (lead) and as high stabs and chord hits (stab, clipped harder). There is no snare and there are no hats in this sound: the rhythmic hits are the stabs' attacks.
- **Gain staging.** The library's distortion sits after the track gain, so turning a clipped instrument down with its gain un-clips it into a clean sine. Render each clipped instrument as its own bus with `target_sound.render_buses` (one Song per bus) and set its level after rendering; give each voice of a chord its own bus so the clipping does not intermodulate.

What every track shares besides the instruments:
- **Each thing on screen is an instrument.** Every visible element gets its own part, so the viewer can point at what they hear and the music and the content are the same thing (see "Sync, picture and arrangement").
- **Everything is selaras (in agreement).** One key, one chord progression that the bass, mids, leads and physics notes all follow; physics notes are tones of the current chord. One grid: every layer, physics included, lands on the same 8th/16th grid, and there is never a second, competing pattern. Choose the simulation's time scale so its events fall on the grid.
- **There is always a melody you can hum.** A hook on the lead from the first bar to the last, built from the chord tones, with the call-and-answer and variation rules below; the physics changes its notes, register or loudness, never deletes it.
- **Mix for a phone at low volume.** Most people hear these on a phone speaker. Aim for the sample's main-section balance, about 3 / 29 / 48 / 21 % of the energy in 20-60 / 60-150 / 150 Hz-1 kHz / 1-5 kHz, with the hook always audible over the mids. Measure per layer with `uv run --locked python scripts/analyze_stems.py <slug> <bar> <bar> ...`.
- **Kick and bass sit forward.** The owner likes them a little louder than a flat fit: on the replica they asked for +3 dB on both over the fitted levels (`BOOST_DB` in `music/_demo/sample-replica/compose.py`). Set every new track's kick and bass about that much above where the band balance alone would put them, and keep the hook audible over them. If the 60-150 Hz share runs well over the target because of it (eight-bits: 46-48 %), report it, so the owner can judge by ear rather than having it silently pulled back.
- Check every new track: `uv run --locked python scripts/analyze_audio.py public/<slug>/track.wav` (all bands report the same tempo), `python3 scripts/analyze_swoop.py public/<slug>/track.wav <bpm> <offset_s> '[kick steps]'` (the kick swoops onto the root and holds), and `python3 scripts/analyze_bass.py` (bass notes on the chord roots where the chords change).

## Sync, picture and arrangement (always, no exceptions)

The channel owner's rules: the music is ALWAYS in sync with the video, the picture is ALWAYS something that can be synced, and the music is never one phrase on repeat.

**1. The music is always in sync with the picture.**
- The timeline is the score. `sims/<slug>.ts` writes every event into `timeline.json`; `music/<slug>/compose.py` builds its notes from those events and the scene draws them from the same file. Never type a note time by hand that a sim event could give, and never draw a hit that has no event.
- Every sound has a picture and every visible event has a sound, on the same frame (±1 frame). Kick, bass, hook notes, stabs and every added part are each tied to something you can point at on screen. Held sounds (a held stab or whine, a held bass note) follow a visible state (a glow, a level, a colour) and change when it changes.
- When the sim changes, re-run the sim, the composer and the render together; a track left over from an older timeline is out of sync by definition.
- Check before shipping: step through the render frame by frame over 4 bars of every section with the sound on. A sound with no visible cause, or a visible hit with no sound, gets fixed (given a cause, a sound, or cut), never left in.

**2. The picture must be playable.** Before any code, write the topic's visible events for 16 bars on the 16th grid: what happens on every beat (the kick), what happens on the hook's rhythm (8ths/16ths), and what changes between sections (so the music has something to follow when it changes). Each event is a distinct thing you can see: a hit, a swing, a clack, a pulse, a flash, a collision. If the list cannot be written, or it repeats one event for the whole video, drop the topic, however good the question is (see First rule, point 5).

**3. The music is a song, not a loop of one phrase.**
- Sections follow the story: the question (intro), the rule (build), the payoff (drop, on the physics climax), and a turn that leads back into the first bar for the loop. Each section changes at least one of: the chord progression, the bass line, the hook.
- The hook has at least two phrases, a call and an answer (A and B), and varies every 4 bars at most (e.g. A A' B A''): new notes, a new rhythm or a new register, driven by the physics where possible (the event changes, so the melody changes). The same 1-2 bar phrase never runs for the whole video.
- Something enters, leaves or changes at least every 8 bars, and at least three parts are audible at once in the main sections (the owner hears two parts as thin).
- Check: no two neighbouring 4-bar blocks of the hook and bass have identical notes unless the repeat is on purpose, and the composer prints its section plan (bars, chords, which hook phrase) so it can be read against the picture's event list.

The whole song loops (see Loops); one bar or one phrase looping is not a loop, it is a repeat.

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

1. Pick an idea from `docs/ideas.md`; note its sound mapping, and write its 16-bar visible event list and section plan (see "Sync, picture and arrangement"). No event list, no video.
2. `sims/<slug>.ts` writes `public/<slug>/timeline.json` (per-frame state + audio events in seconds).
3. `music/<slug>/compose.py` reads the events and writes `public/<slug>/track.wav`.
4. `src/videos/<slug>/` holds the scene and the composition; register it in `src/Root.tsx`.
5. `scripts/build.sh <slug> <CompositionId>`, then add a row to the README table.

## Captions

Lint every caption with the Instagram skills from `Jakeschincariol/instagram-agent-skill` (`ig-caption/caption.py` and `ig-human/detect.py`) before it ships. House rules: the reel carries the hook, so line 1 is the one ask (comment a guess) plus the topic in searchable words; 300-500 characters; at most 3 hashtags at the bottom; sources in one line. Never put the answer the ask invites people to guess in the caption.

## Shipping

Each finished video gets `prod-ready/<slug>/`: the MP4, `cover-9x16.png` (the composition's `<Still>`, key text inside the centre 3:4 crop, y 80-560 at base size), `cover-grid-3x4.png` (that crop), and `post.md` with the Instagram caption, TikTok caption, YouTube Shorts title (under 40 characters) and description, sound name, and a pre-post checklist.

## Posting (Buffer)

The owner produces videos daily. When the owner approves a finished video, post it to Buffer straight away; the approval is the go-ahead, so do not ask again.
1. Commit and push `prod-ready/<slug>/` to `main` first. Buffer fetches the video from `https://raw.githubusercontent.com/aviharez/8bit-content-bank/main/prod-ready/<slug>/<slug>.mp4`, so the file must be on GitHub before the post is created.
2. Check which Buffer account the MCP is connected to (`get_account`, then `list_channels`). The owner is on free plans, so the channels are split across two accounts: one holds Instagram, TikTok and the Facebook Page, and the other holds YouTube. Post only to the channels the connected account has.
   - **Instagram / TikTok / Facebook**: one post per channel. Use that platform's caption from `post.md`; Facebook uses the Instagram caption.
   - **YouTube**: a Short with the `post.md` title (under 40 characters) and description, `categoryId` "28" (Science & Technology), `madeForKids: false`.
3. Add each post to the channel's queue, but never for a slot earlier than tomorrow. If the next queue slot is today, set `customScheduled` on the same slot time tomorrow or later. Keep one video per day per channel, in the order the videos were approved, and the same day on every platform where possible. If the free plan's 10 scheduled posts are full, save the post as a draft and say so.
4. Report the scheduled times. Then ask the owner to switch accounts with `/mcp` so the other platforms get posted too. When they say they switched, post to those channels the same way.
5. Free Buffer has no first comment. Remind the owner to post and pin the answer comment from `post.md` after each video goes live.
