# Production workflow

## Pipeline (preserve existing entry points)

```text
Creative brief + arrangement/event sheet
  -> sims/<slug>.ts
  -> public/<slug>/timeline.json
     -> music/<slug>/compose.py -> public/<slug>/track.wav
     -> src/videos/<slug>/ (Remotion / Three.js)
  -> scripts/build.sh <slug> <CompositionId>
  -> renders/<slug>.mp4
  -> prod-ready/<slug>/ after QA
```

The current implementation already has per-video TypeScript simulations and Python composers; timeline formats vary. Do not migrate all legacy videos. First implement a small typed helper local to the pilot or new entertainment namespace if it reduces duplication. Extract further after three pilots. Read README.md, CLAUDE.md, docs/music-reference.md and the installed Audio as Code/Remotion skills. Preserve pinned dependencies and mastering; don't install new engines for the pilot.

## 1. Greenlight a brief
State hook, viewer question, payoff, setting, visible entities, instruments, progression, loop/reset, title, runtime, and asset requirements. Reject ideas with no distinguishable rhythmic actions or no visible stakes. Check the previous three songs (tempo, key, kick, lead, groove) and specify at least three meaningful differences from each. Plan no narration or educational overlays by default.

## 2. Design music and action together
Choose BPM, fps, meter, subdivisions, chord sequence, A/B hook, rhythm and section boundaries. Write at least a detailed 16-bar event sheet as required by the existing repo and cover the full runtime. A pilot's broad bar ranges are not a substitute for this sheet. Every audible instrument needs a visible action/state. The kick must be obvious even in a dense scene; a melodic line must be distinguishable. Schedule major scene changes on section boundaries. Use seeded randomness for variety within authored constraints. If a random collision is quantized, schedule both visual contact and note together; never just snap audio after rendering. Prefer authored deterministic paths when physical collision timing would fight the beat. Group simultaneous minor contacts intentionally to avoid audio clipping/overcrowding; show groups as one musically meaningful action.

## 3. Clock and timeline contract (proposed, new episodes only)
At 150 BPM and 30 fps, one beat is exactly 12 frames and a sixteenth is 3 frames. A 24-bar 4/4 episode is 96 beats, 1152 frames, 38.4 seconds. For other tempos check beat and subdivision alignment; integer frames per beat does not automatically mean integer frames per sixteenth. Use exact musical timing for synthesis and closest visual frame with <=1-frame discrepancy, or choose a compatible grid. Use absolute beat positions, not accumulated rounded seconds. At 30 fps one frame is ~33 ms.

A possible common schema (adapt to existing code rather than force a migration):

```ts
type MusicEvent = {
  id: string; // unique within episode
  beat: number; // absolute beats, canonical event time
  frame: number; // derived Math.round(beat * 60 / bpm * fps)
  entityId: string;
  action: string;
  instrument: string;
  pitch?: number; // MIDI for pitched events; optional for percussion
  velocity: number; // 0..1
  durationBeats: number;
};
type Timeline = {
  version: 1;
  fps: number;
  bpm: number;
  beatsPerBar: 4;
  totalFrames: number;
  seed: number;
  events: MusicEvent[];
  // topic-specific scene state, paths, entities and section metadata
};
```

Use `beat` as time authority; derive frame/seconds rather than independently authoring all three. Python uses beats for Audio as Code note timing and seconds for any sample-level placement; renderer uses frames or interpolated beat state. An optional shared validator checks event uniqueness, sorted timestamps, bounds, duration, velocity, entity existence and expected audio/visual mappings. Model sustained actions as intervals. Group same-time contacts only when the visual and auditory meaning remains intelligible. Allow documented loop-tail handling rather than invalid end events; never schedule a new note exactly at the excluded endpoint. Export an event-to-note/visual mapping manifest if useful for QA; derive it from actual schedules, not claimed counts.

## 4. Implement and render
TypeScript emits deterministic state/events; no wall-clock or cross-frame state in Remotion. Python composer reads the same timeline for kicks, leads, percussion, bass and scene transitions (a layer may derive from a documented sustained state). Keep existing `music/_shared/` helpers, bus rendering/gain staging and `finish_loop`. Retain offscreen Three.js quantization, HUD safe area and render configuration. Register a new composition and cover in `src/Root.tsx` under an entertainment series; leave old registrations untouched.

Existing commands (from repo root; install dependencies per README):

```bash
npm install
uv sync
scripts/build.sh <slug> <CompositionId>
uv run --locked python scripts/check_loop.py <slug>
uv run --locked python scripts/analyze_audio.py public/<slug>/track.wav
# Where appropriate, run existing stem, bass and kick analysis using actual arguments.
```

Run type/lint checks supported by the current project. Inspect tool sources before adding QA checks or guessing flags. If a check is unavailable or fails, report it; do not claim success. Rebuild simulation, music and render together on event changes.

## 5. Package and review
Follow `quality-gates.md`. Keep composer, timeline, WAV, music report and render. Assemble `prod-ready/<slug>/` with video, cover-9x16.png, cover-grid-3x4.png and post.md. Use English platform-specific hooks and descriptions, no false promises, answer-reveal only where relevant. For entertainment Shorts use YouTube categoryId 24 if the current publishing integration accepts it; confirm category and audience classification before posting. Do not modify older videos' category or audience settings. Preserve existing Buffer scheduling workflow for approved releases; pilot delivery itself is local review only. Never bypass owner authorization to publish.
