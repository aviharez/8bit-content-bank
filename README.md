# 8-bit content bank

Short science explainers in pixel art with 8-bit music, made entirely with code.
Each video takes a real object or phenomenon, runs the actual equation behind it, and turns the simulation's events into the soundtrack.

**Formula:** a real thing + one equation + a sound computed from that equation.

## Videos

| # | Video | Series | Length | Status | Render |
|---|---|---|---|---|---|
| 1 | Count the Clacks (colliding blocks count the digits of pi) | The Sound of Pi | 32 s, 9:16 | Prototype v2 | [renders/count-the-clacks.mp4](renders/count-the-clacks.mp4) |

The full bank of 30 ideas is in [docs/ideas.md](docs/ideas.md).

## Pipeline

```
sims/<slug>.ts ──► public/<slug>/timeline.json ──┬──► music/<slug>/compose.py ──► public/<slug>/track.wav
   (exact physics, fixed clock)                  │        (Audio as Code)
                                                 └──► src/videos/<slug>/ (Remotion) ──► renders/<slug>.mp4
```

- **One clock.** Every video picks a BPM and fps first (120 BPM / 30 fps = 15 frames per beat). The simulation, the music, and the picture all read the same `timeline.json`, so sound and image cannot drift.
- **Simulation** (`sims/`): TypeScript, event-driven or fixed-timestep, written to JSON per frame. Remotion renders frames in parallel and out of order, so no state lives between frames.
- **Music** (`music/`): composed in Python with [Audio as Code](https://audioascode.com) (instruments synthesised from code, no samples). Sonification tracks are generated from the simulation events.
- **Picture** (`src/`): Remotion. 3D scenes are drawn with three.js at low resolution (360×640), snapped to a 32-colour palette with ordered dithering, then shown at exactly 3×. The HUD is drawn crisp on top.

## Build

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/), ffmpeg, Chrome.

```bash
npm install
uv sync
scripts/build.sh count-the-clacks CountTheClacks      # sim -> music -> render
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
| `docs/` | Ideas bank, style guide |
| `.agents/skills/` | Remotion agent skills (`npx skills add remotion-dev/skills`) |

## Licences

Remotion is free for individuals and companies of up to 3 people; see the [Remotion licence](https://www.remotion.dev/docs/license/pricing). Audio as Code is MIT. Fonts are OFL.
