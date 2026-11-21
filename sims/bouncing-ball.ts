// The ball that drum-rolls: drop a ball from 19.6 m onto a hard floor. Its bounciness (coefficient of
// restitution) is e = 1/2: every bounce leaves the floor at half the speed it hit it, so every flight takes
// half as long as the one before (flight time = 2v/g). Flights: 2 s, 1 s, 1/2 s, 1/4 s, ... and
// 2 + 1 + 1/2 + ... = 4 s. Infinitely many bounces, all over in 4 seconds (Zeno's paradox, for real).
//
// Clock: 120 BPM, 30 fps, one bar = 2 s = 60 frames. Real time, no warp: the fall takes exactly one bar, the
// first flight one bar, then half a bar, a quarter... so every bounce lands on the beat grid (bar, half, quarter,
// 8th, 16th, 32nd...) and the bounces end exactly on the downbeat of bar 6, where the music drops.
// Ideal ball: no air drag, e exactly 1/2 at every speed (a real ball stops after a few dozen bounces).
// A claw (a prop, not physics) picks the ball back up so the video loops.
// Output: public/bouncing-ball/timeline.json
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
const BAR_S = (60 / BPM) * 4; // 2 s
const BAR_F = BAR_S * FPS; // 60 frames
export const BARS = 12;
export const TOTAL_FRAMES = BARS * BAR_F; // 720
const G = 9.80665;
export const E = 0.5;
const RELEASE = 2 * BAR_S; // 4 s
const H0 = 0.5 * G * BAR_S ** 2; // 19.61 m: the fall takes exactly one bar
const T0 = RELEASE + BAR_S; // first impact: 6 s, bar 4 (index 3)
const V0 = G * BAR_S; // impact speed 19.6 m/s
const T_END = T0 + (2 * E * V0) / G / (1 - E); // 10 s: when the bounces run out (bar index 5)

// impact k: time and speed
const impacts: { k: number; sec: number; beat: number; speed: number }[] = [];
for (let k = 0, t = T0, v = V0; k <= 12; k++) {
  impacts.push({ k, sec: t, beat: t / (60 / BPM), speed: v });
  const vOut = E * v;
  t += (2 * vOut) / G;
  v = vOut;
}

function heightAt(t: number): number {
  if (t < RELEASE) return H0;
  if (t < T0) return H0 - 0.5 * G * (t - RELEASE) ** 2;
  if (t >= T_END) return 0;
  // find the flight we are in: after impact k the ball leaves at E * v_k
  for (let k = 0, tk = T0, v = V0; k < 200; k++) {
    const vOut = E * v, dur = (2 * vOut) / G;
    if (t < tk + dur) return vOut * (t - tk) - 0.5 * G * (t - tk) ** 2;
    tk += dur; v = vOut;
  }
  return 0;
}
const bouncesBy = (t: number) => (t >= T_END ? Infinity : impacts.filter((i) => i.sec <= t + 1e-9).length);

// claw: holds the ball at the top through bar 2, opens at the release, comes back down in bar 10, lifts in bar 11
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function clawAt(t: number): { y: number; closed: boolean } {
  const bar = t / BAR_S;
  if (bar < 2) return { y: H0, closed: true };
  if (bar < 3) return { y: H0 + 2 * ease(bar - 2), closed: false }; // backs off after letting go
  if (bar < 9) return { y: H0 + 2, closed: false };
  if (bar < 10) return { y: H0 + 2 - (H0 + 2) * ease(bar - 9), closed: bar > 9.85 };
  return { y: H0 * ease(bar - 10), closed: true };
}

const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const t = f / FPS;
  const claw = clawAt(t);
  const bar = t / BAR_S;
  const h = bar >= 9.85 ? claw.y : heightAt(t); // once the claw has it, the ball goes where the claw goes
  const n = bouncesBy(t);
  return { h: Math.round(h * 1e4) / 1e4, claw: Math.round(claw.y * 1e4) / 1e4, closed: claw.closed, bounces: Number.isFinite(n) ? n : -1 };
});

mkdirSync("public/bouncing-ball", { recursive: true });
writeFileSync(
  "public/bouncing-ball/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, h0: H0, e: E, release: RELEASE, firstImpact: T0, end: T_END, impacts, frames }),
);
console.log(`drop ${H0.toFixed(2)} m, first impact ${T0} s (beat ${T0 * 2}), bounces end at ${T_END} s (beat ${T_END * 2})`);
console.log(impacts.slice(0, 9).map((i) => `#${i.k} beat ${i.beat.toFixed(4)} ${i.speed.toFixed(2)} m/s`).join("\n"));
