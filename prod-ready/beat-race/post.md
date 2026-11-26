# Red vs Blue: Beat Race (pilot E2, approved 2026-11-27)

Series: Beat Wars · Channel: Square Wave Lab (`@squarewavelab`) · Pilot 002 of the entertainment pivot

## As a stranger sees it (reviewer questions)

- **What is happening after 3 seconds?** An arcade race cabinet, "RED vs BLUE / PICK A SIDE" on top. On frame 0 the start gate lifts, both marbles roll out, a yellow hammer slams on the kick and the red marble lights up on its first note. The LEAD bar already leans red.
- **Why stay?** It's a race with a readable lead and obstacles you can see: the LEAD tug-of-war bar and CHECKPOINT n/5 (five green bounce pads per lane). In bar 6 Red reaches a closed amber gate first and has to wait; both gates snap open together and Blue pulls away, taking over the melody. In bars 11-12 the ramps give way to a peg field: Blue sits on a peg while Red bounces peg to peg in fast 16th runs for the comeback. A second gate in bar 13 catches Red again and Blue retakes the lead, neck and neck to the end. In bar 16 everything holds: no kick, no bass, each marble holds one long note while the finish banner's lamps fill on a snare roll.
- **What happens at the payoff?** At 0:29.9 (bar 17) Blue touches the finish post on the drop: BLUE WINS!, its half of the board lights up full, confetti bursts from the post, the finish banner turns blue. Red arrives two beats later. Blue keeps calling the hook while it bounces in its bucket, then the lift carries both marbles back up and tips them onto the start gate for the loop.
- **Which machine is which part?** Kick = the yellow pacer hammer on the spine: a small wind-up, a 2-frame strike, and it lands on its strike plate (plate flashes) exactly on the kick, then springs up and waits. Bass = the arrows on the ramps' lips, marching one step per note. Melody = the two marbles: every pin and bumper they touch is a note (taller pin = higher note), Red is the low clipped-sine lead and Blue the same synth an octave up; the leader calls, the other answers. Chords = the two halves of the board pulsing. Hats = the chaser bulbs on the walls, stepping on the off-beat. Clap + chord stab = a marble landing on a bounce pad (the checkpoints: the spring squashes, the marble hops). Snare hit = the gates snapping open (the start gate and the two race gates). Pegs in the peg field are notes like the pins. Snare roll = the finish banner's lamps.
- **Would you replay it?** NOT VERIFIED: that is your call after watching with sound. It loops seamlessly, so a replay starts straight back into the gate drop.

## Files

| File | Use | Spec |
|---|---|---|
| `beat-race.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 44.8 s (24 bars at 128.57 BPM), H.264 + AAC, -13.5 LUFS (phone loudness -15.5 LUFS above 200 Hz), peak -3.2 dBFS |
| `cover-9x16.png` | Reel / TikTok cover | 1080 × 1920, bar 12 in the peg field, neck and neck, "RED vs BLUE / WHO WINS?", no result shown |
| `cover-grid-3x4.png` | Instagram profile grid (centre 3:4 crop) | 1080 × 1440, title and LEAD panel inside |

Source: `sims/beat-race.ts` → `public/beat-race/timeline.json` (828 events) → `music/beat-race/compose.py` → `public/beat-race/track.wav` + `music/beat-race/output/report.json` → `src/videos/beat-race/`. Plan and full 24-bar event sheet: `docs/plans/beat-race.md`.

**What's staged:** the race is authored, not simulated: who leads, the lead changes, the comeback and Blue's win are written into the score before any audio. The captions say so.

## Music

Hard techno, 128.57 BPM (14 frames per beat), A Phrygian, chords two bars each. Sections: start Am Bb (hook A A' B A'', Red calls), checkpoints Am Gm (C C', then D D' with Blue calling), swap Dm Bb (E E', F F': Red's 16th runs), neck Gm Bb (G G', ping-pong, hold), finish Am Bb (W W' W'' W''', Blue calls), lift Dm Bb (A A' B A, Bb → Am across the loop). Every pitched note is a chord tone, clipped at the chord change; Red and Blue never sound on the same 16th; no two neighbouring 4-bar blocks of hook and bass are identical.

**The sound you picked:** sketch v2 variant B, the clipped-sine target sound (lead, an octave-up answer, clipped sub bass, octave saw chords) with a hard `kick_909`, now tuned to D2 (a tone of every chord; the sketch's C#2 was out of key).

**Contrast with the last three:** The Beat Factory 150 BPM F Aeolian, swoop, clipped sine on two arms; Monty Hall 138.46 D Phrygian, hard 909, acid lead + supersaw, off-beat fm_bass; Birthday 163.64 G Aeolian, punchy 909 + sub, trance pluck. This one differs from each on tempo, key and groove (a galloping bass on the second half of each beat, the hook handed over with the race lead). It shares the hard 909 with Monty Hall, your pick in the A/B.

**Fixed after your first review:** the hammer read as off the beat: it landed on the kick but then crept upward for the whole beat and snapped back down with no visible swing, so the eye followed the slow rise. It now winds up, strikes in 2 frames, lands on a strike plate on the kick frame, springs back in 4 frames and holds still.

**Fixed after your second review (the kick sounded off beat and off tempo):** the kick itself was on time (0 ms on every beat), but the parts around it pulled the groove off. (1) At 128.57 BPM a 16th is 3.5 frames, and every sound was snapped to a whole frame, so every second 16th sounded 17 ms late: a lopsided, dragging swing on the hats, bass and melody. Sounds now sit on the exact, even beat grid; the picture draws each hit on the frame at or just before it (at most half a frame early, never late). (2) The brightest tick in every beat was a hat on the 16th right after the kick, which on a phone speaker reads as the beat itself, so the pulse felt shifted. The main hat now sits on the off-beat 8th between kicks (the "boom-tss" of techno), with quieter 16ths only in the busy sections. Bass and hats are 2 dB lower so the kick leads.

**Changed after your third review (obstacles):** the marbles now meet three kinds of obstacle, the same in both lanes. **Gates** (bars 6 and 13): the leader bumps a closed amber gate (its note), waits, and both gates swing up together on a snare hit, light turning green; this is what causes the lead changes. **Peg field** (bars 11-12): two levels have no ramp, just a board of pegs; the marble rests on each peg and hops to the next, each peg a note. **Bounce pads** replace the checkpoint bars: a green spring at the high end of levels 2, 4, 7, 9 and 12; the landing plays the stab and clap and the marble hops half a beat. The race script, timing and music outside these moments are unchanged. The gate snare is tuned to the chord under it (E on Am, G on Gm), measured on the stem.

**Fixed before review:** the metal hats rang on C# (clashing with C in the key) and the snare roll on E (a tritone against the Bb under it); both are retuned, to A and F, and the stems were re-measured.

**Mix (measured, not listened to):** stem levels vs the kick: bass -4, Red -3.5, Blue -5, mids -7, stab -6, clap -5, gate snare -4, hats -10, roll -6, glow -9 dB. Band balance per section (target 3/29/48/21 in 20-60/60-150/150-1k/1-5k Hz): start 11/42/37/9, checkpoints 7/45/37/11, swap 6/44/37/13, neck 2/30/57/10, finish 10/38/36/16, lift 7/51/33/10. **The low end runs heavy**: 60-150 Hz at 30-51 % with the kick and bass forward as you prefer, and 20-60 Hz at 2-12 % (the 909's body); the 1-5 kHz band sits under target (9-16 %). Reported for you to judge by ear, not pulled back. Bass checked note by note: 194 of 196 notes measure on their written pitch (the other 2 are D3 pickups above the detector's range). **Nobody has listened to this track yet; I cannot play audio here.**

## Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Concept | NOT VERIFIED | Frame 0: title, gate lifting, kick, Red's first note; the LEAD bar moves in bar 1. Needs your watch |
| Event design | PASS | 24-bar event sheet in the plan, generated from the timeline; every sound has an entity (table above); sim validates chord tones, nothing ringing into the next chord, 16th grid, no Red/Blue clash, landings on 8ths, a continuous path for each marble |
| Clock | PASS | Sounds on the exact beat grid; picture frames round down (a 16th is 3.5 frames), so a hit is drawn at most half a frame before its sound. `check_sync.py`: MP4 audio vs track.wav 0 ms; kick 2 ms; gate snare 2 ms; every stem's p95 within 21 ms except the clap's 30 ms attack shape; hats measured directly start within 0.5 ms of the grid. Hammer strike frames stepped at frames 9-18 and the drop (891-897); obstacles stepped in the MP4 at a pad landing (89-95), gate 1 opening (318-324), the peg field (600-612), gate 2 (714-716), the drop (896) and the seam (1343 → 0) |
| Determinism | PASS | Sim run twice: `timeline.json` byte-identical (sha256); the scene is a pure function of the frame |
| Arrangement | PASS (numbers) / NOT VERIFIED (listening) | Section plan above; the hook changes every bar and the leader changes 4 times; 5+ parts in every main section |
| Harmony | PASS (numbers) / NOT VERIFIED (listening) | All pitched events are chord tones; hats and roll retuned into the key; kick on D2 |
| Mix | PASS (numbers) / NOT VERIFIED (listening) | finish_loop master, peak -3.2 dBFS, limiter max 3.6 dB; heavy low end reported above |
| Visual | PASS (frames) | Endesga 32 + dither 3D, crisp UI, 3× scale, text 28 px from the sides, watermark y 586, at most two readouts; no shake or white flash |
| Progression | PASS | pads (bar 2 on), gate 1 (bar 6), lead swap (bar 7), peg field (bars 11-12), comeback (bar 11), rolling bass (bar 13), hold (bar 16), finish (bar 17), lift (bar 21) |
| Loop | PASS | `check_loop.py` PASS (audio seam 0.0 of p99 step; video seam ratio 1.27); tail folded 0.038 s; the lift resets every lamp before the seam |
| Build | PASS | Fresh `scripts/build.sh beat-race BeatRace` (sim → music → render) with the obstacles, exit 0; covers re-rendered from the same code |
| Packaging | PASS | MP4, both covers, this file; composer, timeline, WAV and report in the repo; README row E2 |
| Originality | PASS | Original composition with the library's own synthesised instruments; scene built in code; no external assets |
| Release | PASS | Approved by the owner on 2026-11-27 ("approve") after the v4 obstacle render |

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `Beat Race - Square Wave Lab`.

**Caption** (478 characters; `ig-caption` READY, `ig-human` 74.6 PASS):

```
Comment red or blue before the finish: a 45 second pixel art marble race where 2 marbles play one hard techno song.

Every pin a marble hits plays a note, so whoever leads plays the tune and the other one answers. 2 gates snap open on a snare, 5 bounce pads clap, and 2 rows of pegs turn into a 16th note drum roll. The yellow hammer in the middle is the kick. 128 BPM, A minor.

It's staged: I animated the race to the music, it's not a real run.

#techno #pixelart #marblerace
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `Beat Race - Square Wave Lab`.

**Caption** (394 characters; `ig-caption` READY, `ig-human` 79.7 PASS):

```
Comment red or blue before the finish: a 45 second pixel art marble race where 2 marbles play one hard techno song.

Every pin a marble hits is a note, so whoever's ahead plays the tune and the other answers. Gates = snare. Bounce pads = claps. Yellow hammer = kick. Watch the peg field. 128 BPM, A minor.

It's staged, I animated the race to the music. Sound on.

#techno #pixelart #marblerace
```

---

## YouTube Shorts

**Title** (33 characters):

```
Red vs Blue: A Techno Marble Race
```

**Description:** the Instagram caption above. **Category:** Entertainment (`categoryId` "24") if the integration accepts it; `madeForKids: false`. Confirm both before posting.

**Thumbnail:** the frame at 0:21 (bar 12, neck and neck), or the cover.

---

## Before you post

- [x] Your review and explicit go-ahead (pilot rule): approved 2026-11-27
- [ ] Listen to the whole track on a phone speaker; judge the low end (909 body, 60-150 Hz)
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin a first comment: `Kick = the yellow hammer, bass = the ramp arrows, melody = the marbles (every pin is a note, taller pin = higher note; the leader plays the tune), claps = the bounce pads, snare = the gates opening. Blue won by 2 beats.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
