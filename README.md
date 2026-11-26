# 8-bit content bank: Square Wave Lab

The content bank for **Square Wave Lab** (`@squarewavelab` on Instagram, TikTok and YouTube), *Where Everything Becomes Music*.

Square Wave Lab creates original music-led audiovisual entertainment in 3D pixel art, entirely with code. Tiny worlds act like playable instruments: every meaningful musical event has a visible cause. The channel also archives its original science explainers.

**Formula:** a playable world + a musical rule + an unexpected payoff.

Start with [START-HERE.md](START-HERE.md), then [creative direction](docs/creative-direction.md), [content pillars](docs/content-pillars.md), [production workflow](docs/production-workflow.md), [quality gates](docs/quality-gates.md), the [entertainment idea bank](docs/entertainment-ideas.md) and the [pilot briefs](docs/plans/entertainment-pilots.md). The [migration guide](docs/pivot-migration.md) records how the pivot was applied.

## Entertainment videos

| # | Video | Series | Length | Status | Render |
|---|---|---|---|---|---|
| E2 | Red vs Blue: Beat Race (two marbles race down mirrored arcade lanes, every pin and peg they hit a note of their melody, past gates, peg fields and bounce pads; the leader calls, the other answers; Blue wins on the drop) | Beat Wars | 44.8 s, 9:16 | Approved | [prod-ready/beat-race/](prod-ready/beat-race/) |
| E1 | The Beat Factory (a night-shift factory plays hard techno: the press is the kick, the belt the bass, two robot arms the hook; 60 crates fill the reactor and it ignites on the drop) | Beat Factory | 38.4 s, 9:16 | Approved | [prod-ready/the-beat-factory/](prod-ready/the-beat-factory/) |

## Legacy science explainers

Short science explainers in pixel art with 8-bit music. Each video takes a real object or phenomenon, runs the actual equation behind it, and turns the simulation's events into the soundtrack.

**Legacy formula:** a real thing + one equation + a sound computed from that equation.

| # | Video | Series | Length | Status | Render |
|---|---|---|---|---|---|
| 1 | Count the Clacks (colliding blocks count the digits of pi) | The Sound of Pi | 32 s, 9:16 | Ready to post | [prod-ready/count-the-clacks/](prod-ready/count-the-clacks/) |
| 2 | 32,768 to 1 Tick (how a quartz watch counts a second) | How Time Works | 36 s, 9:16 | Ready to post | [prod-ready/quartz-watch/](prod-ready/quartz-watch/) |
| 3 | Jupiter's Moons 1:2:4 (the Laplace resonance writes a hard-techno riff) | Orbits | 38 s, 9:16 | Ready to post | [prod-ready/jupiter-moons/](prod-ready/jupiter-moons/) |
| 4 | 15 Pendulums, 1 Cycle (a pendulum wave lines up again after exactly 32 s, real time) | Every Wave | 32 s, 9:16 | Ready to post | [prod-ready/pendulum-wave/](prod-ready/pendulum-wave/) |
| 5 | 1,000 Balls, One Bell Curve (a Galton board builds the binomial curve, and every bin plays a note) | Probability | 35.2 s, 9:16 | Ready to post | [prod-ready/galton-board/](prod-ready/galton-board/) |
| 6 | How Fast Can a Heart Beat (whale to shrew: smaller body, faster heart; the shrew's 19.5 beats a second become the drop note) | How Life Works | 38.4 s, 9:16 | Ready to post | [prod-ready/heart-rate/](prod-ready/heart-rate/) |
| 7 | Can a Single Note Break Glass? (a speaker finds the glass's own note, like pushing a swing in time; the glass shatters on the drop) | Every Wave | 38.4 s, 9:16 | Ready to post | [prod-ready/glass-resonance/](prod-ready/glass-resonance/) |
| 8 | Why Do Jets Go Boom? (a jet chases its own sound: the note ahead climbs, the rings stack into the boom, every kick in the drop hits a tower) | Every Wave | 38.4 s, 9:16 | Ready to post | [prod-ready/mach-one/](prod-ready/mach-one/) |
| 9 | How Do Computers Count With 0 & 1? (8 lights count 0 to 255 in binary; every light switching is a sound, the light that flips each beat is the kick) | How Computers Work | 35.2 s, 9:16 | Rendered, not yet listened to | [prod-ready/eight-bits/](prod-ready/eight-bits/) |
| 10 | How Does a Key Open a Lock? (a cutaway pin tumbler: wrong keys leave a pin off the line, a pick sets them one by one, the right key lifts all 5 at once; every pin moving is a note) | How Things Work | 38.4 s, 9:16 | Ready to post (owner listened) | [prod-ready/key-lock/](prod-ready/key-lock/) |
| 11 | How Does a Speaker Make Sound? (the song travels from a phone down the cable, into a coil in a magnet, out of the cone as waves in the air (slowed 46x) and into a listener's eardrum; every sound is a wave you can see) | Every Wave | 38.4 s, 9:16 | Rendered, waiting for the owner | [prod-ready/speaker/](prod-ready/speaker/) |
| 12 | Why Does a Guitar String Sing? (a guitar and a bass play the track; every sound is one string at its real pitch: the low string swings in slow motion (33x), frets make it shorter, light touches split it into 2, 3, 4 loops, the bass string sits an octave under) | Every Wave | 38.4 s, 9:16 | Approved, queued on Buffer | [prod-ready/guitar-string/](prod-ready/guitar-string/) |
| 13 | How Far Away Is the Lightning? (a storm seen from a ridge: the flash arrives at once, the thunder walks to you one power-line tower per second; count the seconds, 3 seconds = 1 km; the storm comes overhead on the drop and leaves for the loop) | How Nature Works | 37.3 s, 9:16 | Approved | [prod-ready/lightning/](prod-ready/lightning/) |
| 14 | How Many People Till Two Share a Birthday? (guests walk into a party one by one and light their birthday on a 365-day calendar wall; each new guest is checked against everyone already there, so the pairs pile up: guest 23 makes the first match at 50.7%, and by 70 guests the chance is 99.9%) | Probability | 35.2 s, 9:16 | Approved | [prod-ready/birthday/](prod-ready/birthday/) |
| 15 | Should You Switch Doors? (the Monty Hall game show: your door is 1 in 3, the other two 2 in 3, and the host's goat leaves that 2 in 3 on the door he kept shut; then a wall of 35 stages plays 1,000 real games and switching wins 66% to 34%; every door step is a kick, the marquee chase is the acid hook) | Probability | 38.1 s, 9:16 | Approved | [prod-ready/monty-hall/](prod-ready/monty-hall/) |

The full bank of ideas is in [docs/ideas.md](docs/ideas.md).

## Pipeline

```
sims/<slug>.ts ──► public/<slug>/timeline.json ──┬──► music/<slug>/compose.py ──► public/<slug>/track.wav
   (deterministic sim, fixed clock)              │        (Audio as Code)
                                                 └──► src/videos/<slug>/ (Remotion) ──► renders/<slug>.mp4
```

- **One clock.** Every video picks a BPM and fps first (120 BPM / 30 fps = 15 frames per beat). The simulation, the music, and the picture all read the same `timeline.json`, so sound and image cannot drift.
- **Simulation** (`sims/`): TypeScript, event-driven or fixed-timestep, written to JSON per frame. Entertainment episodes schedule authored, deterministic mechanics on the musical grid (every contact comes from the scheduler); legacy science videos run the exact physics. Remotion renders frames in parallel and out of order, so no state lives between frames.
- **Music** (`music/`): composed in Python with [Audio as Code](https://audioascode.com) (instruments synthesised from code, no samples). Sonification tracks are generated from the simulation events.
- **Picture** (`src/`): Remotion. 3D scenes are drawn with three.js at low resolution (360×640), snapped to a 32-colour palette with ordered dithering, then shown at exactly 3×. The HUD is drawn crisp on top.

## Build

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/), ffmpeg, Chrome.

```bash
npm install
uv sync
scripts/build.sh count-the-clacks CountTheClacks      # sim -> music -> render
uv run --locked python scripts/check_loop.py count-the-clacks   # must print PASS
# or step by step
npm run sim:count-the-clacks
npm run music:count-the-clacks
npx remotion studio                                   # preview
```

Set `CHROME=/path/to/chrome` if Remotion cannot find a browser. Rendering uses `--gl=swangle` so WebGL works on machines without a GPU.

## Repository layout

| Path | What lives there |
|---|---|
| `sims/` | One simulation per video |
| `music/<slug>/compose.py` | The composer (source of truth for the soundtrack); `output/` holds the score JSON and render report |
| `src/lib/` | Shared pixel pipeline: palette + dithering, fonts, HUD drawing kit |
| `src/videos/<slug>/` | The video: scene, camera, HUD, composition registration |
| `public/<slug>/` | Generated timeline and track |
| `public/fonts/` | Press Start 2P and Silkscreen (OFL) |
| `renders/` | Finished MP4s, compressed for git |
| `prod-ready/<slug>/` | Everything to post: video, covers, `post.md` with captions and titles per platform |
| `brand/` | Profile photos |
| `docs/` | Ideas bank, style guide |
| `.agents/skills/` | Remotion agent skills (`npx skills add remotion-dev/skills`) |

## Licences

Remotion is free for individuals and companies of up to 3 people; see the [Remotion licence](https://www.remotion.dev/docs/license/pricing). Audio as Code is MIT. Fonts are OFL.
