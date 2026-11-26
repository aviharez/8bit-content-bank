# The Beat Factory: ready for review (pilot E1, not approved, do not post)

Series: Machines that play · Channel: Square Wave Lab (`@squarewavelab`) · Pilot 001 of the entertainment pivot

## As a stranger sees it (reviewer questions)

- **What is happening after 3 seconds?** A pixel factory line, "THIS FACTORY RUNS ON TECHNO" on top and REACTOR POWER at 0 %. The press slams a crate on every kick, the belt jerks forward on the bass, and a robot arm taps lamps in time with the melody. The meter has already started to tick up.
- **Why stay?** The meter is a visible goal: every crate that reaches the reactor adds to it (60 needed). New machines keep switching on: the sorting gate in bar 5, the laser cutter in bar 9, the charge ring in bar 15. In bar 16 every machine stops and holds, and the meter reads 100 %.
- **What happens at the payoff?** At 0:25.6 (bar 17), the ignition: one white flash, the hall lights come on, the reactor core goes full height in white/cyan with beams, the status lamps turn green, the HUD says MAX POWER, and both arms play together on alternating 16ths. That is the drop of the track. Then the cooldown dims the hall bar by bar and sends crates off through floor hatches back to the opening state.
- **Which machine is which part?** Kick = the press (it swoops onto each chord root). Bass = the belt (an acid line on the three 16ths after each kick; its filter opens section by section). Melody = the two robot arms (left lamp column and right lamp column, higher lamp = higher note). Percussion = laser cutter (hats), sorting gate (clap + supersaw chord stab on 2 and 4), charge ring (snare roll). The reactor's held whine follows its glow.
- **Would you replay it?** NOT VERIFIED: that is your call after watching with sound. It loops seamlessly, so a replay starts straight back into bar 1.

## Files

| File | Use | Spec |
|---|---|---|
| `the-beat-factory.mp4` | The video, same file on every platform | 1080 × 1920, 30 fps, 38.4 s (24 bars at 150 BPM), H.264 + AAC, -13.3 LUFS (phone loudness -15.5 LUFS above 200 Hz), peak -3.3 dBFS |
| `cover-9x16.png` | Reel / TikTok cover | 1080 × 1920, the drop: MAX POWER 100 %, reactor lit, laser firing, both arms out |
| `cover-grid-3x4.png` | Instagram profile grid (centre 3:4 crop) | 1080 × 1440, title panel and meter inside |

Source: `sims/the-beat-factory.ts` → `public/the-beat-factory/timeline.json` (820 events) → `music/the-beat-factory/compose.py` → `public/the-beat-factory/track.wav` + `music/the-beat-factory/output/report.json` → `src/videos/the-beat-factory/`. Plan and full 24-bar event sheet: `docs/plans/the-beat-factory.md`.

**What's staged:** the mechanics are authored, not a simulation: crate routing, the 60-crate meter and the ignition are scheduled to the score. The captions say so.

## Music

Hard techno, 150 BPM (12 frames per beat), F Aeolian. Sections: start Fm Db Eb Cm (hook A A' A A''), sorter Fm Db Ab Eb (A B A' B'), cutter Bbm Db Eb Cm (X X' X X'), build Db Bbm Cm Eb (rise, rise', ping-pong, hold), drop Fm Db Eb Cm (C C C' C''), cooldown Db Ab Eb Cm (A B A' A''). Every written pitch is a chord tone of its bar; no two neighbouring 4-bar blocks of hook and bass are identical.

**Contrast with the last three:** Lightning 128.57 BPM C# Phrygian dominant, rumble kick, sync lead + hoover; Birthday 163.64 BPM G Aeolian, punchy 909 + sub, trance pluck; Monty Hall 138.46 BPM D Phrygian, hard 909, acid lead + supersaw. This one differs from each on tempo, kick (swoop) and lead (clipped sine on two arms). Note: Guitar String (four videos back) also used 150 BPM, the swoop and the clipped sine.

**Mix (measured, not listened to):** stem levels vs the kick: bass -2, lead -3.5, stab -6, clap -3.5, hats -5, roll -4.5, whine -8 dB. I raised the hats, clap and roll ~6 dB after a phone-band check showed them 13-19 dB under the lead. Band balance per section (target 3/29/48/21 in 20-60/60-150/150-1k/1-5k Hz): start 7/67/22/3, sorter 8/51/32/9, cutter 3/56/33/9, build 1/32/33/33, drop 2/43/42/13, cooldown 6/63/25/5. **60-150 Hz runs high in the start and cooldown (63-67 %)** with the kick and bass forward as you prefer (approved tracks ran 48-61 %): reported for you to judge by ear, not pulled back. **Nobody has listened to this track yet; I cannot play audio here.**

## Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Concept | NOT VERIFIED | Frame 0 shows the factory, title and 0 % meter with press, belt and arm acting in the first bar; needs your watch |
| Event design | PASS | 24-bar event sheet in the plan; every sound has an entity (table above); sim validates chord tones, bounds, no bass on a kick, frame = beat × 12 |
| Clock | PASS | `check_sync.py`: MP4 audio vs track.wav 0 ms; attack vs event frame per stem, worst p95 22 ms, worst max 1.08 frames (stab), kick 0.27, hats 0.06. Stepped the final MP4 frame by frame around a kick (f48), arm jab (f66), gate snap (f252), laser pulse (f438): each lights/contacts on its event frame. Full 4-bar stepping of every section not done |
| Determinism | PASS | Re-ran the sim: `timeline.json` byte-identical (sha256); scene is a pure function of the frame |
| Arrangement | PASS (numbers) / NOT VERIFIED (listening) | Composer plan above; something enters or changes every 4 bars; 4+ parts in every main section |
| Harmony | PASS (numbers) / NOT VERIFIED (listening) | All 820 pitched events are chord tones of their bar; notes clipped at chord changes |
| Mix | PASS (numbers) / NOT VERIFIED (listening) | finish_loop master, peak -3.3 dBFS, limiter max 3.5 dB; low-mid excess reported above |
| Visual | PASS (frames) | Endesga 32 + dither 3D, crisp UI, 3× scale, text 28 px from the sides, watermark y 586; one white flash at ignition (fades over 6 frames), no shake |
| Progression | PASS | sorter (bar 5), cutter (bar 9), charge ring + hold (bars 15-16), ignition (bar 17), cooldown (bars 21-24) |
| Loop | PASS | `check_loop.py` PASS (audio seam 0.01 of p99 step; video seam ratio 1.52); tail folded 0.233 s |
| Build | PASS | Fresh `scripts/build.sh the-beat-factory TheBeatFactory` (sim → music → render), exit 0, MP4 newer than track and timeline |
| Packaging | PASS | MP4, both covers, this file; composer, timeline, WAV and report in the repo |
| Originality | PASS | Original composition with the library's own synthesised instruments; scene built in code; no external assets |
| Release | NOT VERIFIED | Waiting for your review. Pilot rule: no posting without your explicit go-ahead |

---

## Instagram Reels

**Cover:** `cover-9x16.png`. **Audio name:** `The Beat Factory - Square Wave Lab`.

**Caption** (434 characters; `ig-caption` READY, `ig-human` 76.9 PASS):

```
Comment the machine you'd turn up: I built a pixel art factory where 6 machines play one hard techno track.

The press slams the kick, the belt jerks on the bass, two robot arms tap lamps for the melody (higher lamp, higher note), the laser ticks the hats and the gate snaps on the claps. The reactor needs 60 crates to ignite. 150 BPM, F minor.

It's staged: animated to the music, not a real factory.

#techno #pixelart #hardtechno
```

---

## TikTok

**Cover:** `cover-9x16.png`. **Sound name:** `The Beat Factory - Square Wave Lab`.

**Caption** (374 characters; `ig-caption` READY, `ig-human` 86.0 PASS):

```
Comment the machine you'd turn up: I built a pixel art factory where 6 machines play one hard techno track.

Press = kick. Belt = bass. Two robot arms tapping lamps = the melody, higher lamp, higher note. Laser = hats. Gate = claps. 60 crates fill the reactor, then it ignites. 150 BPM, F minor.

It's staged, animated to the music. Sound on.

#techno #pixelart #hardtechno
```

---

## YouTube Shorts

**Title** (32 characters):

```
This Factory Runs on Hard Techno
```

**Description:** the Instagram caption above. **Category:** Entertainment (`categoryId` "24") if the integration accepts it; `madeForKids: false`. Confirm both before posting.

**Thumbnail:** the frame at 0:26 (ignition, MAX POWER).

---

## Before you post

- [ ] Your review and explicit go-ahead (pilot rule)
- [ ] Listen to the whole track on a phone speaker; judge the low end in the start and cooldown
- [ ] Step through 4 bars of each section frame by frame with sound on
- [ ] Same day on all platforms
- [ ] Pin a first comment: `Kick = press, bass = belt, melody = the two robot arms (higher lamp, higher note), hats = laser, claps = sorting gate. 60 crates to ignite the reactor.`
- [ ] Turn on auto-captions where offered
- [ ] After 48 hours, note saves, shares and replays in the README row
