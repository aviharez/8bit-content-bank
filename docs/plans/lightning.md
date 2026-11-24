# Plan: how far away is the lightning? (idea #32)

Slug `lightning`, composition `Lightning`, series How Nature Works. Written before any code, as CLAUDE.md
("Sync, picture and arrangement") asks. Status: approved by the owner (Nov 2026): series How Nature Works, 20 bars, no "beat" wording anywhere.

## The idea in one line

A night storm seen from a ridge: every strike flashes at once, its thunder walks to the listener one power-line tower per
second, and **the number of seconds between them is the distance**. The storm comes closer (the gap shrinks to
zero on the drop, the strike right above the house) and then moves away again for the loop.

**Hook (first 2 s):** "HOW FAR AWAY IS THE LIGHTNING?"

## The physics (real, exact distances)

- Light covers a few km in about 10 µs: the flash is seen at once.
- Sound moves at 343 m/s (air at 20 °C): the thunder arrives `t = d / 343` seconds later.
  So `d = 343 · t`, about 1 km per 3 seconds (2.9 s exactly). Check against a source before the caption.
- Thunder rolls because the bolt is a few km tall: the sound from its bottom arrives first, from higher parts
  later. Each strike's thunder is drawn as several sound fronts, one per part of the bolt, at their real delays.
- The bolt grows down from the cloud in steps (the stepped leader), then the return stroke flashes up it, often
  3-4 times (the flicker you see in real lightning). The bolt's shape is a seeded random walk, so it is
  computed, never hand-drawn, and the same every render.

**Time.** Two honest warps, both stated on screen (one small tag, "TIME SQUEEZED") and in the caption. The
words "beat" or "BPM" never appear on screen or in the captions (owner's rule); this plan uses them only for the
build.
- The sound clock: one beat of the music is one second of the storm. At 128.57 BPM a beat is 0.467 s, so the thunder plays about 2.1x fast.
  The power-line towers stand every 343 m, so the front passes exactly one tower per beat. Distances stay exact.
- The bolt itself is slowed: a real leader takes about 30 ms, here it takes a few 16ths.
- The storm's approach is squeezed (a real storm takes minutes to come 3 km). Each strike's delay is exact for
  where it hits.

## Clock

- 128.57 BPM, 30 fps: 14 frames per beat, 7 per 8th. A 16th is 3.5 frames, so picture events on 16ths round to
  the nearest frame (within the ±1 frame rule); the audio stays exact.
- 20 bars = 80 beats = 1120 frames = 37.3 s.

**The beat is the counting.** Every strike's gap equals the time to the next strike, so in every section a sound
front is always on its way and passes a tower on every beat. That pass is the kick. You count the kicks, you count
the seconds.

## The scene

3D, filling the frame (as built after the storyboard): the listener stands on a small deck at the edge of a 160 m
ridge at night, rain falling, looking down a valley. A power line runs from a short pole on the ridge (right) down
and out across the plain, a tower every 343 m with a red lamp on top; from this height the 8 towers spread down the
frame instead of stacking. An old tree stands on the ridge edge (left). Every flash lights the land; the thunder is
a bright ring with a dimmer rumble band behind it, draped over the ground, sweeping toward the ridge. For the drop
the camera pulls back along the ridge and tilts up, so the deck, the listener, the tree and the pole are all in
frame, and the strikes alternate between the tree and the pole. (A first set with a house and a porch on a low hill
was dropped: the hill hid the plain, and the line ran straight away from the eye, so the towers could not be
counted.)

**Parts that must read at a glance (phone size):**

| Part | Look |
|---|---|
| Bolt | White core with a purple glow while it flickers; the leader grows down in purple steps with a bright tip |
| Thunder | A white ring on the ground with a grey rumble band behind it |
| Tower | Dark steel with a red lamp on top that flashes white while the thunder sweeps over it |
| Listener | Hooded figure on the deck, seen from behind, flinches when the thunder arrives |
| Tree / pole | The two drop targets, either side of the deck |

## Visible events, 16th grid (what the music follows)

| Visible | Sound | Grid |
|---|---|---|
| The thunder ring passes a tower (its lamp flashes white) | **Kick**: rumble kick, `kick_909` driven hard | Every beat |
| The rumble band clears the tower (its lamp goes back to red) | **Bass**: the off-beat rumble on the chord root | Off-beat 8ths after each kick |
| The ring reaches the ridge: the listener flinches | **BOOM**: industrial noise hit + a short `fm_bass` stab on the root, kick accent | On the beat the count ends |
| The leader steps down from the cloud | **Hook call** (`sync_lead`): each step a chord tone, falling | 8ths in the intro, 16ths later |
| The return stroke flickers up the bolt (3-4 flashes) | **Hook answer**: the same lead, rising | 16ths right after the strike |
| The whole scene flashes white | **Stab** (`hoover`): the current chord, one bus per voice | On the strike beat |
| The thunder ring on its way (louder as it comes closer) | **Ring** (`fm_bass`, root + fifth, low FM index): struck each second, louder each second | Every beat while a ring travels |
| A drip lands in a puddle on the deck (ripple, bottom right) | **Hats** (`metal_hat`) | Off-beat 16ths |
| Two strikes land close together in the build | **Snare roll** (`electronic_snare`) | 16ths, bars 11-12 |

The bolt's number of leader steps and flickers changes from strike to strike, so each strike is a new phrase:
the hook varies because the lightning does.

## 16-bar event list (bars 1-16; the turn mirrors the build)

| Bars | Storm | Gap | Strikes | Per bar |
|---|---|---|---|---|
| 1-4 | Far, over the hills, 2.7 km | 8 s | Bars 1, 3 (beat 1) | Bar 1: leader falls on 8ths, strike, front passes posts 1-4. Bar 2: posts 5-8, BOOM on bar 3 beat 1 = next strike |
| 5-8 | Coming, 1.4 km | 4 s | Every bar, beat 1 | Leader on 16ths in the last beat before, strike, 4 posts, BOOM = next strike |
| 9-10 | Close, 690 m | 2 s | Beats 1 and 3 | Strike, 2 posts, BOOM |
| 11-12 | Very close, 340 m | 1 s | Every beat | Strike, 1 post, BOOM; leader and flicker squeezed into each beat; snare roll |
| 13-16 | Overhead: the drop | 0 s | Every beat | Flash and BOOM on the same frame; strikes hit the tree and the pole beside the deck |
| 17-20 | Leaving (turn) | 2 s, 4 s, 8 s | Bar 17 beats 1, 3; bar 18; bar 19 | Mirror of the build. Bar 19's strike arrives on bar 1 beat 1: the loop |

## Section plan (music)

| Bars | Section | Chords (C# Phrygian dominant) | Hook | Kick / groove | What enters or leaves |
|---|---|---|---|---|---|
| 1-4 | Intro: the question | C# D C# D | A: slow falling leader, rising flicker | Four on the floor, rolling off-beat rumble | Kick, bass, lead, hats, stab on each flash: dense from frame 1 |
| 5-8 | The rule | F#m D Bm C# | A': same shape, twice as fast | Same | BOOM now every bar; harmony line under the lead |
| 9-12 | Build | F#m D Bm C# | B: squeezed, climbing register | 3+3+2 in bar 11, snare roll in bars 11-12 | Roll and rising flash rate |
| 13-16 | Drop: overhead | C# D Bm C# | C: the hook on 16ths, each strike's flicker a 4-note cell | Kick + BOOM on every beat, rumble bass full | Hoover chord on every beat, camera tilts up |
| 17-20 | Turn: leaving | D C# D C# | A'' backwards (rising leader, falling flicker), slowing to A | Near-empty bar 17 (kick, rumble only), then four on the floor | Roll and harmony leave; ends on the intro texture |

Neighbouring 4-bar blocks differ in chords, hook speed or kick pattern. Cadences: C# -> F#m into the rule, C#
lands the drop on bar 13, C# -> C# closes the loop.

## Sound vs the last 3 videos

| Video | Tempo | Key | Kick | Lead | Groove |
|---|---|---|---|---|---|
| Key lock | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| Speaker | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| Guitar string | 150 | E Phrygian | Swoop | Clipped sine | Straight 16ths |
| **Lightning** | **128.57** | **C# Phrygian dominant** | **Rumble (`kick_909` + off-beat tail)** | **`sync_lead` + `hoover` stabs** | **Rolling, heavy** |

Different on all five.

## On-screen text (all of it)

Only what a stranger needs to follow the physics. No labels about the music ("every tower is a kick", "every
strike is a note"): the sync is felt, not explained. Those notes live in `post.md`.

| Bars | Text |
|---|---|
| 1-20 | Top panel: HOW FAR AWAY IS THE LIGHTNING? |
| 1-2 | You see it at once |
| 3-4 | You hear it later |
| 5-6 | Count the seconds |
| 7-8 | 3 seconds = 1 km |
| 9-12 | (no caption: the HUD does the talking as the gap shrinks) |
| 13-14 | 0 seconds / It's right above you |
| 15-16 | (no caption) |
| 17-18 | Code card: `km = seconds / 3` |
| 19-20 | (no caption) |

HUD, two readouts: **SECONDS** (counts up from the flash, freezes at the BOOM) and **KM AWAY** (shown at the
BOOM). One small corner tag for the time warp: "TIME SQUEEZED". Watermark `@squarewavelab`.

## Decisions

1. **Time tag:** "TIME SQUEEZED", one small tag for the whole video. No "beat" wording on screen or in captions
   (owner); the caption says the thunder is sped up and the bolt slowed, in plain words.
2. **Series:** How Nature Works (owner liked it).
3. **Length:** 20 bars, 37.3 s (Claude's call, owner delegated): the story is intro, rule, build, drop, leaving,
   and a second drop would repeat the overhead strike with nothing new to show.

## Music as built (Nov 2026)

- Kick: `kick_909` tuned +4.6 semitones so its body sits on C#2 (69 Hz), the key's root; driven (drive 9), short.
- Bass: `sub_bass` on the chord root (floor E1), off-beats, low-passed at 420 Hz so its distortion's flat 7th
  overtone is cut.
- Levels by stem RMS against the kick: bass -3, lead -4, flash -5, ring -6, harmony and BOOM stab -7, BOOM -8,
  roll -12, hats -15 dB.
- Measured: 60-150 Hz runs 50-69 % of the energy (target 29 %; eight-bits was 46-48 %), because the kick is the
  loudest stem and sits at 69 Hz. Reported for the owner to judge by ear, not pulled back.
- Out-of-chord energy per pitched stem (rendered audio, 40 Hz-4 kHz, per bar): lead 10 %, flash 12 %, harmony 13 %,
  ring 10 %, BOOM stab 13 %; the bass reads 24 % only from the smear of short low notes (peaks are on the roots).

## Picture as built (Nov 2026)

- The ridge top is flat for 22 m in front of the deck. The tree (14 m) and the first pole (12 m) stand on it 16 m
  out, 4 m either side, so the drop's strikes land inside the deck view.
- Drop camera: 10 m back along the deck, 9 m up, tilted 8 degrees up, so the bolt, the tree, the pole and the
  listener are all in frame. A strike 0 seconds away is drawn twice as wide as a far one.
- The video opens 4 frames (one 16th) before the first strike (`openLeadFrames` in the timeline; the track is
  rotated by the same amount), so the loop point falls between two frames of the leader growing, not on a flash.
