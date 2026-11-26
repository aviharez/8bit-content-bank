# Entertainment pilots — production briefs

These are starting specifications, not final compositions or renders. Create a full event sheet and compare the latest three tracks before coding each episode. Use the existing visual/audio pipeline, no paid APIs. Pilot order is intentional: first satisfaction, then competition, then progression. At baseline 150 BPM, 30 fps, 4/4, 24 bars = 1152 frames = 38.4 s, 1 beat = 12 frames, 1 sixteenth = 3 frames. The grid is a proposal; if another tempo improves the track, recalculate all timings and preserve sync. Vary at least three musical traits relative to recent releases, not just pitch/tempo. All hooks below are English and can be adjusted for readability.

## Pilot 001 — The Beat Factory

**Slug:** `the-beat-factory` · **Composition:** `TheBeatFactory` · **Pillar:** Beat Factory

**Hook:** This factory runs on techno. **Viewer promise:** watch a factory synchronize and finally power its main reactor. **Payoff:** reactor reaches max power, the entire production line locks together on the drop. The opening should already sound full, not wait for instruments to appear. No narration.

### Scene
Vertical isometric factory, one central production lane with clearly distinct silhouettes: hydraulic press at center, conveyor and crates at bottom, two robotic arms at sides, cutter near top, sorter and reactor at top. Industrial dark navy, steel, amber and cyan within existing palette. Keep all causal actions readable in a single framing; gentle camera move only if necessary. HUD: `FACTORY ONLINE` / capacity meter (0–100%); the meter reflects authored progress and doesn't pretend to be measured physics. Avoid UI panels that consume the scene.

| Entity | Action and audio role |
|---|---|
| Hydraulic press | Visible metal contact at kick onset, mechanical recoil after |
| Conveyor | Crate moving through successive rollers; bass note changes at marked gates or sustained belt-state transitions |
| Robot arms | Alternating placement contacts play A/B lead motif, pitch encoded by destination |
| Cutter | Visible spark/cut onset on hi-hat subdivisions, group very fast cuts |
| Sorter | Gate snap or crate lock plays chord stabs/claps |
| Reactor | Sustained glow/charge represents rumble or riser, activation drives drop |

### Arrangement proposal
Hard/industrial techno, 150 BPM baseline; choose key and chord progression after reviewing recent tracks. Try driven 909 kick, acid bass and short FM/sync lead, alternating A/B phrases, machine timbres made through existing synth library. These are proposed, not a claim of installed instrument availability beyond repo guidance. Kick and bass forward; melody must stay audible. Maintain initial hook throughout, vary register/rhythm and harmony. Map every part, including fill/riser/counter-line.

| Bars (1-based) | Time (s) | Visual/music progression |
|---|---:|---|
| 1–4 | 0–6.4 | Press, conveyor and arm play immediately; capacity begins rising; motif A |
| 5–8 | 6.4–12.8 | Sorter opens alternate lane, arm answers with B, add stabs |
| 9–12 | 12.8–19.2 | Cutter activates, routes become denser, bass/hook variation |
| 13–16 | 19.2–25.6 | Crates fill reactor, coordinated build, one readable pre-drop hold |
| 17–20 | 25.6–32.0 | Reactor lights, full arrangement, synchronized machine sequence; visible max power |
| 21–24 | 32.0–38.4 | Dispatch completed crates, reset lane and reactor to opening state, motif leads into bar 1 |

### Implementation and checks
- Authored cycle/trajectory system rather than uncontrolled rigid-body physics. Every contact comes from the scheduler. Each machine has wind-up, exact contact frame, and release. Use fixed deterministic entity IDs and explicit state transitions.
- Establish beat schedule before building geometry. Produce event sheet covering all 24 bars, including all main note onsets; do not copy a legacy track wholesale.
- Loop reset must match first frame's world state, including camera/phase/visible objects at the conceptual next frame. Ensure final payload clears rather than visibly teleporting or losing the payoff.
- Validate against quality gates; especially visual readability of six instruments, no silent hero impacts, bass sustain mapping and final encoded sync. Return a rendered MP4 and sources for owner listening. No posting.

## Pilot 002 — Red vs Blue: Beat Race

**Slug:** `beat-race` · **Composition:** `BeatRace` · **Pillar:** Beat Wars

**Hook:** Pick your side. **Promise:** two colored marbles race through a musical obstacle track. **Payoff:** a readable finish, winner gets a motif resolution. Use symmetrical lanes and shared obstacles; deterministic authored race or seeded game, not a claim of random real gameplay. Build only after Pilot 001 review.

Scene: side-by-side vertical lanes within a 3D arcade cabinet, red and cyan-blue marbles, distinct shapes/labels for accessibility, gates and checkpoints; two progress readouts or one lead meter. Motion must remain trackable; use a continuous visible track or connected camera following both sides. Kick = common floor piston; bass = shared track-drive state; red and blue lead = gate contacts in complementary registers, same chord; hats = peg contacts; stabs = checkpoints; finish gate = final musical accent. Choose distinctly different track/key/groove/lead from Factory and recent releases. Avoid simultaneous competing team melodies that obscure the beat.

| Bars | Progression |
|---|---|
| 1–4 | Start gate opens immediately; introduce both motifs and the race goal |
| 5–8 | Alternating checkpoint hits; first lead change |
| 9–12 | Split gates, obstacle patterns and a visible comeback |
| 13–16 | Neck-and-neck build, final gate approaches |
| 17–20 | Final sprint, decisive finish and clear winner celebration (allow time to read) |
| 21–24 | Visible return chute or arcade restart, shared motifs resolve into first beat |

Implement a seeded or explicitly scripted race that reaches a plausible result; record winner and seed, avoid changing it after generating audio. Do not fake an outcome from allegedly real user play. Validate lane symmetry, no hidden teleport, winner readability, distinct motifs, beat mapping and seamless reset. If reset weakens the ending, prioritize payoff and document an owner-approved non-seamless exception.

## Pilot 003 — 1000 Bricks, 1 Ball

**Slug:** `thousand-bricks` · **Composition:** `ThousandBricks` · **Pillar:** Beat Arcade

**Hook:** Every hit makes a beat. **Promise:** one starting ball breaks 1,000 visible/countable bricks; upgrades accelerate destruction. **Payoff:** remaining count reaches zero on the drop or its final accent. Do not claim 1,000 unless the timeline verifies exactly 1,000 initial breakable brick IDs. One initial ball is allowed to split if explicitly shown as an upgrade, and title/metadata must not imply a single ball throughout. Alternative hook/title: “One Ball Starts a Brick Storm.”

Scene: pixelated 3D breakout arena, stacked brick field with visible remaining counter, paddles/launch rail, distinct colors by instrument. Use seeded/authored paths with musically timed contacts; each brick removes only once. Kick = paddle/launch plate hit; bass = charged travel state; lead = selected colored block hits; hats = grouped small fragments; stabs = power-up gates. Multiple same-step breaks may share a chord/impact, but show the whole cluster as a meaningful burst. Bound polyphony and particles. Choose separate hard-techno flavor and hook; avoid copying Factory or Race.

| Bars | Progression |
|---|---|
| 1–4 | Immediate first hit, count starts at 1,000; readable A hook |
| 5–8 | First target cluster falls, reveal wider lane, motif B |
| 9–12 | Earn and visibly activate split/multiplier, more synchronized hits |
| 13–16 | Dense but readable waves, build to final wall |
| 17–20 | Clear remaining bricks with final chord/impact; hold zero count |
| 21–24 | Rebuild bricks via visible reset mechanism, return to initial launch |

Validate unique destruction IDs, counter consistency, final zero, no duplicated note floods, visual grouping of hits, and a convincing reset. Treat title count as a hard content claim. If 1,000 makes the screen unreadable, change the count and title together rather than faking the counter.

## Review deliverables per pilot
Brief + event sheet + arrangement contrast notes; TypeScript sim; JSON timeline; Python composer; WAV and report; Remotion composition and covers; MP4; platform copy and QA report. Owner approval is separate from build completion. Do not publish or implement the next pilot automatically.
