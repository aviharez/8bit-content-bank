# Square Wave Lab — Entertainment Pivot

Implementation handoff for Claude Code / Codex. Proposed direction, not a completed code migration.

## Objective
Turn the existing code-generated science explainer channel into original, music-led audiovisual entertainment, preserving the brand, hard-techno identity, 3D pixel-art look and synchronized production pipeline. Existing science videos remain archived and buildable.

## Read order
1. `docs/creative-direction.md` — creative contract.
2. `docs/content-pillars.md` — series and experiments.
3. `docs/production-workflow.md` — production and proposed event contract.
4. `docs/quality-gates.md` — acceptance and release checks.
5. `docs/entertainment-ideas.md` — 100 ideas with event maps and payoffs.
6. `docs/plans/entertainment-pilots.md` — three implementation briefs.
7. `docs/pivot-migration.md` — exact scope of updates to existing files.

## Agent kickoff prompt (copy into Claude Code / Codex)

> Read START-HERE.md and all linked documents. Inspect the current README.md, CLAUDE.md, docs/music-reference.md, existing audio skill, relevant source files and build scripts. Work in a dedicated branch. Apply the documentation changes in docs/pivot-migration.md without deleting existing science content or weakening the audio, rendering, sync, mastering, rights, and shipping rules. Resolve conflicting instructions explicitly. Then implement ONLY Pilot 001: The Beat Factory, following its brief. Reuse the current TypeScript simulation, Python Audio as Code, Remotion/Three.js, palette, mastering and build pipeline. Do not redesign the engine or implement the other pilots yet. Before coding, write a complete bar-by-bar visual/musical event sheet and arrangement plan, compare the last three tracks, and identify each audible part's visible cause. Render and validate the result, provide paths to the MP4, timeline, composer, report, cover(s) and post.md. Report measured checks separately from subjective listening/viewing checks and flag anything unverified. Stop at owner review; do not push, post, schedule, or overwrite approved videos without explicit approval for the relevant action.

## What this package does not do
It adds new documentation only. It does not modify GitHub, replace existing source files, render videos, run tests, or post anything. The migration guide specifies targeted edits rather than replacing the repository's detailed legacy instructions blindly. Pilot timings and musical choices are starting proposals; validate actual output and recent track contrast before committing.
