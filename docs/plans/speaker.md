# Plan: how a speaker makes sound (idea #14)

Slug `speaker`, composition `Speaker`, series Every Wave. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks. Status: first cut (speaker on a workbench with sand) rejected by the owner as dull ("just looking at a speaker"); rebuilt as the journey below, which the owner chose.

## The idea in one line

A real speaker is playing this video's own soundtrack, so everything you hear is something you can watch it do:
the big cone punches on every kick and the sand on it hops, the small cone buzzes the melody, and a cutaway shows
the magnet and coil that do the pushing.

**Hook (first 2 s):** "HOW DOES A SPEAKER MAKE SOUND?"

## The physics (real)

- A speaker is a **coil of wire on a cone, sitting in a magnet's gap**. Current through the coil makes a force,
  F = B·I·L. The current follows the music's wave, so the coil and cone push out and pull in, following the wave's shape.
  The cone pushes the air, and the air carries the pushes to your ear.
- **Low notes = big, slow pushes; high notes = small, fast ones.** A heavy cone cannot shake fast enough for high
  notes, and a small one cannot move enough air for low notes, so a speaker splits the song with a crossover filter:
  the low part goes to the big cone (woofer) and the high part to the small one (tweeter).
- **The cone's motion is computed from the real track.** After the music is rendered, a script splits the master
  through the crossover (low-pass and high-pass at the same cutoff) and works out each cone's position per audio
  sample. The cone shakes 82 to 2,000 times a second, faster than the 30 frames, so each frame draws the cone's
  swing (a blur from its furthest-in to its furthest-out position in that frame). The HUD scope draws its actual path
  over that 1/30 s.
- **Sand on the woofer hops in real time.** At E2 (82 Hz), with a swing of about 2 mm, the cone moves at about
  1 m/s. A grain thrown up at 1 m/s is in the air for 2v/g = 0.2 s, and at 150 BPM that is exactly one 8th. So the sand lands
  on every 8th while the kick rings, with no time warp. Each grain is real ballistics (g = 9.81 m/s²), and its
  launch speed is set by the cone's swing at that moment. The kick is held until the next hit, so the cone keeps
  ringing and the sand keeps hopping. When the kick stops, the sand settles.
  (Check the numbers against a source before any of them goes into a caption.)

## Clock

150 BPM, 30 fps: 12 frames per beat, 6 per 8th, 3 per 16th. 24 bars = 96 beats = 1152 frames = 38.4 s. Real time
throughout; nothing is slowed.

## The scene

A workbench under a desk lamp, at night. A 2-way speaker box lies on its back, so both drivers face up at the
camera: the big cone (woofer) below, the small dome (tweeter) above, and a pinch of sand on the woofer. The box's
front corner is cut away, so the magnet and coil behind the woofer show (labelled in the rule section). Behind it:
a shelf, a phone plugged into the speaker by a cable (the music comes from here), and warm lamp light with a cool rim
light.

Camera: starts close on the woofer and the sand, pulls back to show both drivers in the build, swings ±20° in the
drops, and returns to the first framing for the loop.

Parts that must be told apart at a glance:

| Part | Look |
|---|---|
| Big cone (woofer) | Dark grey paper cone, light rubber edge; its swing blur shows how far it moves |
| Small cone (tweeter) | Small silver dome; glows faintly with each note it plays |
| Sand | About 40 bright sand-coloured grains, 2 px, with a shadow, so the hops read |
| Coil | Copper ring that glows with the current through it (brighter = more current) |
| Magnet | A dark steel ring with a red/blue N-S band, labelled "MAGNET" |
| Scope (HUD) | A thin panel trace: the cone's real path in the last 1/30 s, wide waves for the big cone, tight squiggles for the small one |

HUD (two readouts at most):
- PUSHES A SECOND: the note frequency of the driver being shown (82 for the woofer's E2, up to ~1,500 for the lead)
- The scope, labelled "BIG CONE'S PATH" or "SMALL CONE'S PATH"

## What is on screen is the music (each visible event is a sound)

| Visible | Sound (approved instruments, unchanged) |
|---|---|
| The big cone punches out and the sand is thrown up | **Kick** (swoop), the pattern changes by section |
| The sand lands (every 8th while the kick rings) | **Mid saws** octave dyad on that 8th (the classic off-beat riff on the "and", doubled by the kick on the beat) |
| The big cone's rolling swing between kicks, and the coil glowing | **Bass** rolling line (16th pickups, octave jumps, chord roots) |
| The small cone's glow and buzz, its squiggle on the scope | **Lead** hook: each glow is a note |
| Both cones and the whole box jolting together in the drop | **Stab** chord hits, one bus per voice |
| The scope trace | The track itself, so it is never silent when the trace moves |

Every cone movement is computed from the track, so a cone cannot move without a sound or sound without a cone
movement. The sand is the one part simulated on its own: it follows the kick and lands on the 8th grid.

## Visible events, 16 bars (16th grid; K = kick, s = sand lands, L = lead note on the small cone)

| Bars | Every beat | Hook rhythm | What changes |
|---|---|---|---|
| 0-3 | K: cone punch, sand up | s on every 8th; L on the hook's 16ths | Close on the sand |
| 4-7 | K, 3+3+2 pattern; sand hops on the hits | L call/answer | Cutaway: coil and magnet labelled; the coil glows with the bass |
| 8-11 | K four on the floor, then 8ths, then 16ths in bar 11 (the riser) | L climbs an octave per bar; PUSHES A SECOND climbs with it | Camera pulls back to both cones; the scope switches to the small cone |
| 12-15 | K four on the floor, stabs on the "and"s | s every 8th, sand flies highest; L hook C | Drop: the box jolts on each stab, both cones swing hard |

## Section plan

| Bars | Section | Chords (E Phrygian) | Hook | Big visible event |
|---|---|---|---|---|
| 0-3 | Intro: the question | Em Em F Em | A, A' | Sand hops on the woofer |
| 4-7 | The rule: coil + magnet | C C Dm Dm | B, B' | Cutaway, the coil glowing with the current |
| 8-11 | Build: low vs high | Am C Dm F | A'' rising octave by octave | Both cones; PUSHES A SECOND climbs |
| 12-15 | Drop | Em F C Dm | C (drop hook) | Full mix, sand flies, box jolts on the stabs |
| 16-19 | Drop 2 | Am C Dm F | C' | Camera on the other side, code card |
| 20-23 | Turn back | Em F Em F | A answer | Kick thins out, sand settles, camera back to the start |

Something new at least every 8 bars: 4 (cutaway), 8 (both cones, scope), 12 (drop), 16 (camera, chords), 20 (thin
out). Three parts from bar 0: kick, bass, lead (plus the sand's mid dyads).

## Captions (one idea each, at least 2 bars)

| Bars | Caption |
|---|---|
| 0-1 | This speaker is playing / this song |
| 2-3 | Every kick / throws the sand up |
| 4-5 | Inside: a coil / next to a magnet |
| 6-7 | Electricity pushes it out / and pulls it back in |
| 8-9 | Low notes: / big, slow pushes |
| 10-11 | High notes: / tiny, fast ones |
| 12-13 | So the big cone plays the low part / the small one the high part |
| 14-15 | The pushes hit the air / and the air hits your ear |
| 16-17 | Your eardrum moves / just like this cone |
| 18-19 | Code card |
| 20-23 | Every sound you hear / is something pushing air |

Code card: `F = B * I * L` and `cone = crossover(song)`.

## Open questions for the owner

1. The scene: a speaker box lying on its back on a workbench, with sand on the woofer (recommended: the sand makes
   every kick visible), or a speaker standing in a club with a crowd?
2. The scope (the cone's real path, drawn as a wave in the HUD): keep it (recommended, it is what shows "low = big
   slow, high = small fast"), or show only the cones?

## Rebuild: the journey of a sound (owner's choice after the first cut)

The music and timeline are unchanged; the picture now follows the sound from the phone to the ear, one place per
section, and the sand is gone.

| Bars | Place | Visible events (each a sound) |
|---|---|---|
| 0-3 | Phone, cable, speaker on a desk | The cable flashes on every kick (the current surge; current is everywhere in the wire at once, so the whole cable lights) |
| 4-7 | Macro of the cut face: cone, coil, magnet in profile | The coil and cone jump with the real signal (shown 5x); the coil glows with each bass note and kick |
| 8-11 | Front of the speaker, the air | Every sound leaves as a wave in a field of air dots: kick = wide white band, bass = blue, mid dyad = orange, lead = thin yellow rings from the small cone |
| 12-19 | Flying across the room to a listener | The same waves crossing the room; stabs = white rings |
| 20-23 | Inside the ear: canal, eardrum, the three tiny bones, cochlea | The eardrum moves with the same signal as the cone (shown huge); the cochlea glows with lead notes and kicks; last bar flies back to the phone |

Sound's travel is slowed 46x (3 m in one beat instead of 1/115 s), said on screen. Wavelengths are drawn in proportion
to the real ones (lambda = c / f) at one shared scale, so low notes are wide waves and high notes tight ones.
