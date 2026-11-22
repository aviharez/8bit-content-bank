# Plan: how a key opens a lock (idea #29)

Slug `key-lock`, composition `KeyLock`, series How Things Work. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks. Status: approved by the owner (build = picking; the CLUNK is Claude's call, see below).

## The idea in one line

A pin tumbler lock seen in a cutaway: as a key slides in, its cuts push five pins up and down, and **the key's
shape is the melody**. Wrong keys leave the pins off the line and the lock stays shut; the right key lines all five
up and the lock turns on the drop.

**Hook (first 2 s):** "HOW DOES A KEY OPEN A LOCK?"

## The physics (real, exact positions)

- A lock has 5 pin stacks. Each stack is a **key pin** (bottom, different lengths) and a **driver pin** (top),
  pushed down by a spring.
- The key's cuts lift each key pin. Pin height at any moment = the key's profile under that pin:
  `h_i(t) = profile(x(t) - p_i)`, where `x(t)` is how far the key is in and `p_i` the pin's position. Pure
  kinematics, computed, never hand-animated.
- The plug turns only when the gap between every key pin and its driver pin sits exactly on the **shear line**
  (the edge of the plug). One pin off the line blocks it.
- Real cuts come in fixed depth steps (Kwikset: 5 pins, 0.150 in apart, depths 1-7 in 0.023 in steps; check
  against a source before any number goes into a caption).
- **Time is slowed** (a real key goes in in about a third of a second). The key moves at a constant speed chosen
  so it advances one pin spacing per 8th note, so every cut arrives under the pins on the grid. The video says
  "SLOWED DOWN" on screen and in the caption. Positions stay exact.

Because the cuts sit at the same spacing as the pins, all five pins drop into a cut at the same moment on every
step, and ride over a ridge between steps. That shared clack is the kick.

## Clock

- 150 BPM, 30 fps: 12 frames per beat, 3 frames per 16th
- 24 bars = 96 beats = 1152 frames = 38.4 s
- One key try = 2 bars: **in** (6 steps on 8ths, then the turn on beat 4), **out** (6 steps back, then the next
  key arrives). Going in, pin 1 reads the cuts tip to bow; coming out, bow to tip. So the hook's call and answer
  come from the key itself: **in = the call, out = the same notes backwards = the answer.**

## The scene

A 3D cutaway lock cylinder filling the frame, brass and steel under a warm work lamp, the front half cut away so
the pins, springs and shear line show, against a wooden door.

## Visual spec: every idea must be seen, not told

The mechanism is small and sits inside a cylinder, so the picture has to be designed to read. Sizes are at the
360 x 640 base.

**Framing.** The camera stays on the cut face. It sways at most ±20° around the key axis and tilts 15-25° down,
enough for real 3D depth, but it never goes behind the cylinder, where the cut would be hidden. The pin row fills
the width: 5 pins about 36 px apart, the whole cylinder about 260 px wide, centred around y = 250 (above the
captions).

**Real scale, readable.** At 36 px per 0.150 in pin spacing, one depth step (0.023 in) is about 5.5 px and the full
depth range (1-7) about 33 px. The key's cuts and the pin movement are big enough at real proportions, so nothing
gets exaggerated.

**Parts that must be told apart at a glance:**

| Part | Look |
|---|---|
| Key pin (bottom, different lengths) | Gold brass |
| Driver pin (top) | Light steel, almost white |
| The gap between the two | A dark 2 px gap, always visible |
| Spring | Copper coil that visibly squashes and stretches |
| Shear line | A bright dashed line across the whole row, labelled "THE LINE" in bars 4-7 |
| Plug (the part that turns) vs. housing | Plug lighter brass, housing dark steel, a clear edge between them |
| Pin 1 (the hook) | A thin bright outline, so the viewer links the melody to it |
| Key | Silver with a dark edge, so its cut outline reads against the brass |

**States that must show:**

| State | How it shows |
|---|---|
| A pin's gap is on the line | The pin flashes green, then glows green while it stays there |
| A pin is off the line at a turn | It flashes red and the plug catches on it; the red pin is the visible reason the lock does not turn |
| Turn attempt, blocked | The key's bow (outside the lock, in full view) jerks about 5° and springs back, and the plug shows the same small turn |
| Turn succeeds | The bow turns 90° (edge-on), the plug rotates and the bottom pins swing out toward the camera, the top pins stay above the line. (A bolt was tried and cut: framing the bolt made the pins too small.) |
| Speed | "SLOWED DOWN" tag in the corner, which changes to "SLOWED DOWN, 2X SPEED" in the drop |

**Storyboard first.** Before any music, render six stills from the real scene code, one per section (a wrong key
blocked, the labelled rule at 4/5, the build at 3/5, the turn at the drop, drop 2, locked again). Look at each one
at phone size as the stranger from CLAUDE.md: can you see the two pin halves, the line, which pin is red, and
whether it turned? Fix the picture until every still reads without its caption.

HUD (two readouts):
- PINS LINED UP: 0/5 to 5/5
- KEY: WRONG / RIGHT (shown after the turn attempt)

## What is on screen is the music (each visible event is a sound)

| Visible | Sound (approved instruments, unchanged) |
|---|---|
| All five pins drop into the cuts together (each key step) | **Kick** (swoop). In tries it runs as 6 eighths + an accent (the turn); in the drop, four on the floor (landings and the turn). |
| Pin 1 (front pin, nearest the camera) rises or falls to a new height | **Lead hook**: its height picks a tone of the current chord, stacked upwards (depth 1 = root, 2 = third, 3 = fifth, 4 = root up, ...). This reads the key's shape as a melody. |
| A pin's gap reaches the shear line (it flashes green) | **Stab** note, that pin's chord tone, one bus per pin. |
| The key itself, step by step | **Bass**: a note per step on the chord root, an octave up while the key's ridge is under pin 1; 16th chromatic pickups as the key starts moving in or out. |
| The shear line glow (brighter with more pins lined up) | Held **mid saws** dyad, louder with each pin on the line, cut when the line goes dark. |
| Turn attempt, blocked (plug jerks and stops) | **Stab CLUNK**: root + octave of the current chord, clipped hard and choked after one 16th, with a kick accent. It stays in the chord (selaras); what makes it sound blocked is that it is cut short, against the held triad of a successful turn. |
| Turn succeeds (plug and bow rotate a quarter turn) | **Chord stab**, full triad, one bus per voice. |

## Section plan

| Bars | Section | Keys / action | Chords | Hook | Big visible event |
|---|---|---|---|---|---|
| 0-3 | Intro: the question | Key A (wrong), key B (wrong) | Em Em F Em | A (key A in/out), A' (key B) | Two blocked turns: CLUNK |
| 4-7 | The rule | Cutaway labels show split pins + shear line; key C (wrong, 4 of 5 lined up), key C again slower, the camera pushing in on the red pin | C C Dm Dm | B (key C), B' | 4/5 green, one red pin blocks the turn |
| 8-11 | Build | Picking: a tension tool turns the plug a hair, a pick taps the pins on 16ths and they set one at a time (bars 8, 9, 10, 11 b1, 11 b3). | Am C Dm F | A'' rising: each set pin adds a held stab note, a chord growing 1-5 notes | 5/5 on the last beat of bar 11 |
| 12-15 | Drop | Plug turns on bar 12 b1, camera pulls back a little. Then the right key D in/out every bar at double speed (16ths), turning every time | Em F C Dm | C: key D's shape at 16ths (the drop hook) | A quarter turn on every bar |
| 16-19 | Drop 2 | Same key, camera swings to the other side of the cut face (same ±20° limit), lamp turns green; the new chords map the same cuts to new notes | Am C Dm F | C' (same depths, new chord tones) | Every pin green on every turn |
| 20-23 | Turn back | Key D withdraws slowly, pins drop back, plug returns, lock shut; key A arrives at the keyhole | Em F Em F | A answer (backwards), ending on the intro texture | Back to the first frame |

Checks against the rules:
- **Variation.** Each key is a different shape, so each try is a different phrase; neighbouring 4-bar blocks
  differ in keys, chords or speed.
- **Something new at least every 8 bars:** bar 4 (labels, key C), 8 (the pick), 12 (turn, drop),
  16 (camera, chords), 20 (withdraw).
- **Three parts from bar 0:** kick, bass, lead.
- **Cadences.** Bar 11 F -> bar 12 Em into the drop; bar 23 F -> bar 0 Em closes the loop.
- **Loop.** The last frame is the lock shut with key A at the keyhole and the camera back at its start angle.

## Captions (one idea each, at least 2 bars)

As shipped (the question stays in the top panel the whole video):

| Bars | Caption |
|---|---|
| 0-1 | A key goes in / 5 pins ride its bumps |
| 2-3 | Wrong key / it won't turn |
| 4-5 | Each pin is cut in two / a spring pushes it down (labels: spring, top pin, bottom pin, the line) |
| 6-7 | One pin off the line / and it stays locked |
| 8-9 | No key? / A pick lifts one at a time |
| 10-11 | Each one catches / on the line |
| 12-13 | All 5 on the line / it turns |
| 14-15 | The right key / lifts all 5 at once |
| 16-17 | The key's shape / is its song |
| 18-19 | Code card + "every note is a pin" |
| 20 | Once more, slowly / in, turn... |
| 21 | ...and out / springs push the pins back |
| 22-23 | Wrong key / locked again |

The 16,807-keys line was dropped: the count depends on MACS and the depth set (6 standard depths on KW1), so it is not a clean fact for a caption.

Code card at the end: `h = profile(x - pin)` and `open = all(gap == shear_line)`.

## Decisions

1. Build = picking, the owner's choice.
2. CLUNK = root + octave, short and choked (Claude's call, owner delegated): physics notes stay chord tones, and
   short vs. held is the contrast a stranger hears between "blocked" and "open".
