// Pendulum wave: 15 pendulums whose lengths are chosen so pendulum k makes N_k = 16 + k swings in exactly
// CYCLE seconds. They start in line, drift into a travelling "snake", split into rows at simple fractions of
// the cycle (1/4, 1/3, 1/2, ...), look random, and are all back in line at t = CYCLE: the loop is the physics.
//
// Real time, no warp: CYCLE = 32 s = the whole video (16 bars at 120 BPM).
// Motion: the small-angle pendulum equation theta'' = -(g/L) theta, solved exactly: theta = (SWING / L) cos(2 pi N t / CYCLE),
// with L = g (CYCLE / (2 pi N))^2. (Real pendulum-wave rigs are tuned the same way, for small swings.)
// Sound: each time a bob passes the centre moving right, it plays a note. Those moments are snapped to the nearest
// 16th note (at most 62.5 ms) so every note lands on the grid; positions on screen stay exact.
// Output: public/pendulum-wave/timeline.json
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
const FPB = (60 / BPM) * FPS; // 15 frames per beat
export const BARS = 16;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 960
export const CYCLE = TOTAL_FRAMES / FPS; // 32 s
const G = 9.81;
export const COUNT = 15;
export const N0 = 16; // the longest pendulum swings 16 times per cycle, the shortest 30
export const SWING = 0.08; // every bob is pulled 8 cm to the side and let go, like a real rig's release board

const pend = Array.from({ length: COUNT }, (_, k) => {
  const n = N0 + k;
  const length = G * (CYCLE / (2 * Math.PI * n)) ** 2;
  return { k, n, length: Math.round(length * 10000) / 10000, period: CYCLE / n };
});

// small-angle amplitude: theta0 = SWING / L (8 cm on 28-99 cm strings is 5-16 degrees)
const theta = (k: number, t: number) => (SWING / pend[k].length) * Math.cos((2 * Math.PI * pend[k].n * t) / CYCLE);

const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => ({
  theta: pend.map((p) => Math.round(theta(p.k, f / FPS) * 1e5) / 1e5),
}));

// centre crossings moving right: phase 3pi/2 + 2pi m  ->  t = CYCLE (m + 3/4) / N
const SIXTEENTH = 60 / BPM / 4;
const events: { k: number; n: number; swing: number; rawSec: number; sec: number; beat: number }[] = [];
for (const p of pend) {
  for (let m = 0; m < p.n; m++) {
    const raw = (CYCLE * (m + 0.75)) / p.n;
    const snapped = (Math.round(raw / SIXTEENTH) * SIXTEENTH) % CYCLE;
    events.push({ k: p.k, n: p.n, swing: m, rawSec: Math.round(raw * 1e4) / 1e4, sec: snapped, beat: snapped / (60 / BPM) });
  }
}
events.sort((a, b) => a.sec - b.sec || a.k - b.k);
const maxSnap = Math.max(...events.map((e) => Math.abs(((e.sec - e.rawSec + CYCLE / 2) % CYCLE) - CYCLE / 2)));

// moments where the row splits into groups: t = CYCLE * a / b
const moments = [[1, 4], [1, 3], [1, 2], [2, 3], [3, 4]].map(([a, b]) => ({ a, b, sec: (CYCLE * a) / b, frame: Math.round((CYCLE * a * FPS) / b) }));

mkdirSync("public/pendulum-wave", { recursive: true });
writeFileSync(
  "public/pendulum-wave/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, cycle: CYCLE, swing: SWING, pendulums: pend, frames, events, moments }),
);
console.log(`${COUNT} pendulums, ${pend[0].length.toFixed(3)} m to ${pend[COUNT - 1].length.toFixed(3)} m; ${events.length} notes; max snap ${(maxSnap * 1000).toFixed(1)} ms`);
const perSlot = new Map<number, number>();
for (const e of events) perSlot.set(e.sec, (perSlot.get(e.sec) ?? 0) + 1);
console.log(`16th slots used ${perSlot.size}/256, busiest slot ${Math.max(...perSlot.values())} notes`);
