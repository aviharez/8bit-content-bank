# Migration guide — existing repository

Basis: README.md, CLAUDE.md, sims/jupiter-moons.ts, sims/galton-board.ts, music/jupiter-moons/compose.py, scripts/build.sh and src/Root.tsx on main as inspected in the previous review. Re-read them before changing anything; current branch may have moved. These are edit instructions, not a patch already applied.

## Preserve legacy content
Keep all existing video sources, generated assets, approved renders, post packages, idea bank and README video rows. Keep docs/music-reference.md, pinned Audio as Code skill, analysis scripts, shared mastering and pixel pipeline. Do not reset git history or migrate old timelines. Work on a separate branch, e.g. feat/entertainment-pivot.

## README.md — targeted changes
- Replace the opening science-only description with: “Square Wave Lab creates original music-led audiovisual entertainment in 3D pixel art, entirely with code. Tiny worlds act like playable instruments: every meaningful musical event has a visible cause. The channel also archives its original science explainers.”
- Replace the primary formula with “A playable world + a musical rule + an unexpected payoff.” Preserve the former formula under a Legacy Science Explainers heading.
- Add links to START-HERE.md, creative-direction, content-pillars, production-workflow, quality-gates and entertainment-ideas docs, and the pilot brief.
- Preserve the existing Videos table as legacy catalog; append a separate Entertainment Videos table only as videos are built, with honest status. Update pipeline text from exact physics to deterministic simulation / musical event scheduling, keeping exact physics for legacy content.
- Preserve build commands, file paths, licensing notes and existing output contracts.

## CLAUDE.md — targeted changes
- Change opening scope to entertainment-first; explicitly retain legacy science rules when editing/producing science content. Read START-HERE.md and linked docs before new entertainment production.
- Replace “First rule: a stranger must get it” science-only questions, explanation steps and learned-at-end check with the audience contract and reviewer questions in the new docs. Keep the first-two-second hook, recognizable objects, at most two simple HUD readouts, beat-visible action, filled 3D scenes and musical climax.
- In “Rules every video follows”, replace mandatory real physics with deterministic, musically constrained mechanics for entertainment; keep accurate physics and time-warp disclosure for science content. Keep frame-pure rendering, quantization, fonts, safe area and HUD constraints. Make code card and science captions legacy-only.
- In “Sync, picture and arrangement”, preserve the ±1-frame gate, playable-picture event list, musical variation, chord agreement, sustained-state mapping, rebuild requirements and subjective review. Clarify that incidental motion need not have a separate sound; all salient rhythmic actions do. Adopt common event scheduling for new episodes as practical, rather than rewriting legacy code. Do not reduce strict sync to matching BPM.
- In “Music direction” and “Tools to use”, preserve the approved hard-techno reference, existing genre constraints, contrast with the last three tracks, phone mix and +3 dB kick/bass preference, Audio as Code 0.5.0, skill source location, target_sound.render_buses, finish_loop, analysis scripts and truthful listening reports. If experimenting with DnB/EDM, require owner review; don't silently replace the signature. Replace physics-only terms with mechanics where appropriate without deleting the musical checks.
- In “Adding a video”, use docs/entertainment-ideas.md for new entertainment episodes; require brief, full event sheet and new quality gates. Keep existing paths, composition registration, build and README status updates.
- In “Captions”, retain applicable lints, safe length/hashtags and English metadata. Source lines only when needed; no invented scientific sources or forced educational answer. Ask for a prediction only when the content actually resolves it; avoid spoiling the result.
- In “Shipping”, retain prod-ready outputs, cover crops, caption files and pre-post checklist. During pilot development require owner review and explicit publishing approval; rendering or agreeing to the pivot is not posting authorization. Preserve Buffer's account split, queue constraints, and cross-platform ordering. Set entertainment-specific category to 24 where supported, check current integration and made-for-kids classification; don't change the legacy category or assume all content classifications are identical.

## Implementation scope
1. Apply docs and verify git diff is limited to intended docs.
2. Implement only Pilot 001 in new paths (`sims/the-beat-factory.ts`, `music/the-beat-factory/compose.py`, `src/videos/the-beat-factory/`, etc.). Add only necessary registration and minimal shared utilities if justified.
3. Run actual checks and produce local review package. No publish, push, release or broad engine redesign. Report remaining uncertainties and failed/unverified checks.
