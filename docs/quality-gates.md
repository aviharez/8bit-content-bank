# Quality gates

A video is ready only after the required gates pass and subjective quality is reviewed. Record PASS / FAIL / NOT VERIFIED (with evidence) in `post.md` or linked QA report. Owner approval remains required; do not mark a track listened to if only analyzed numerically.

| Gate | Acceptance | Evidence |
|---|---|---|
| Concept | Viewer understands scene and stake in first 2 seconds; actual payoff | Opening/ending frames + human watch |
| Event design | Full section plan and visible event map; no unrelated sound | Event sheet + mappings |
| Clock | Every salient transient lands within ±1 visual frame of its sound; sustained sounds match state | Timeline validation, spot checks, final MP4 |
| Determinism | Same seed/config produces same logical events; Remotion frame pure | Regenerate and compare timeline; inspect code |
| Arrangement | Hook A/B and variation at least every 4 bars; musical change at least every 8 bars; 3+ audible parts in main sections | Actual composer plan + listening |
| Harmony | Chord-aware pitches; no unintended competing patterns | Notes/events + listening |
| Mix | Existing phone-speaker target and mastering; no unintended clipping; hook audible | Existing audio/stem checks + owner listening |
| Visual | Pixel palette, correct scale, readable safe HUD, clear causality, no excessive flash/shake | Frames + full playback |
| Progression | At least two meaningful visual changes and a resolved payoff | Section plan + playback |
| Loop | Last-to-first continuity, not necessarily identical adjacent frames; music transition clean | Existing check_loop.py PASS and repeated playback |
| Build | Fresh sim -> music -> render, no stale track | Build log, output timestamps/hash |
| Packaging | MP4, two cover crops, post.md, composer, timeline, WAV and report | File list |
| Originality | Original composition and substantive scene/mechanic changes between episodes; rights confirmed for external assets | Source provenance and license notes |
| Release | Owner review and approval; platform metadata checked | Explicit approval; no auto-publish during pilot |

## Sync validation detail
Compare scheduled note start against the action's contact/activation frame, not merely the shared BPM. For all events, validate the numeric mapping. Inspect the final encoded video at representative beats across each section (existing rule: four bars per section where available); check actual audible/visible timing, including onset/envelope and encoding delay. A shared timeline alone is not proof of perceived sync. Record max measured frame difference if the method supports it; if final-media measurement was not done, mark it not verified. Minor incidental movement need not sound, but a prominent rhythmic action must have a cause or documented grouping.

## Reviewer questions
- What is happening after three seconds?
- Why would you stay until the end?
- What exactly happens at the payoff?
- Can you identify the kick, bass, melody and percussion on screen?
- Would you replay it because the music and animation work together?

A failed or unverified material gate blocks release until fixed or explicitly reviewed and accepted by the owner. Do not use purely numerical analysis as a substitute for actual listening and watching.
