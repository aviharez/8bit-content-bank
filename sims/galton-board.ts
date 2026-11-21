// Galton board: 1,000 balls fall through 12 rows of pegs into 13 bins. At every peg a ball goes left or right,
// 50/50 (a seeded coin, so every render is identical). The count in bin k follows the binomial distribution
// C(12, k) / 2^12, which is already close to the bell curve.
//
// Clock: 150 BPM at 30 fps = 12 frames per beat, 3 frames per 16th. 22 bars (35.2 s).
// Balls are released on the 16th grid, and every hop between peg rows takes exactly one 16th, so every ball
// enters its bin exactly 13 sixteenths after release: on the grid, without warping anything.
// Hops are gravity parabolas (the ball bounces up off the peg and falls to the next row) in screen units.
// Releases speed up: 1 per beat -> 1 per 8th -> 1, 2, 3, 5 per 16th -> about 6.5 per 16th in the drop.
// Bars 18-20 show the result; in bar 21 the bins open and drain, so the last frame is the empty first frame.
// Output: public/galton-board/timeline.json (per ball: release, path, bin, slot in the stack; per bin entry events).
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12
const S16 = FPB / 4; // 3 frames per 16th
export const BARS = 22;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 1056
export const ROWS = 12;
export const BINS = ROWS + 1;
export const BALLS = 1000;
export const DRAIN_BAR = 21;

// mulberry32: a tiny seeded PRNG, so the "random" board is the same on every render
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const coin = rng(1000);

// balls per 16th, by bar (bars 18-21 release nothing)
const perSixteenth = (bar: number) =>
  bar < 2 ? 0.25 : bar < 4 ? 0.5 : bar < 6 ? 1 : bar < 8 ? 2 : bar < 10 ? 3 : bar < 12 ? 5 : bar < 18 ? 6 : 0;
const releases: number[] = []; // release slot (in 16ths), one entry per ball
let acc = 0;
for (let slot = 0; slot < BARS * 16; slot++) {
  const bar = Math.floor(slot / 16);
  acc += perSixteenth(bar);
  while (acc >= 1 - 1e-9) { releases.push(slot); acc -= 1; }
}
// top up to exactly 1,000 in the drop (bars 12-17), spread evenly
const dropSlots = Array.from({ length: 6 * 16 }, (_, i) => 12 * 16 + i);
let extra = BALLS - releases.length;
for (let i = 0; extra > 0; i = (i + 7) % dropSlots.length, extra--) releases.push(dropSlots[i]);
releases.sort((a, b) => a - b);
if (releases.length !== BALLS) throw new Error(`scheduled ${releases.length} balls`);

const counts = new Array(BINS).fill(0);
const balls = releases.map((slot, id) => {
  let path = 0, bin = 0;
  for (let r = 0; r < ROWS; r++) {
    const right = coin() < 0.5 ? 1 : 0;
    path |= right << r;
    bin += right;
  }
  const stackSlot = counts[bin]++;
  const enterSlot = slot + ROWS + 1; // funnel drop + 12 hops, one 16th each
  return { id, releaseFrame: slot * S16, path, bin, stackSlot, enterFrame: enterSlot * S16, enterSlot };
});

const lastEnter = Math.max(...balls.map((b) => b.enterFrame));
const drainFrame = DRAIN_BAR * 4 * FPB;
if (lastEnter >= 18.9 * 4 * FPB) throw new Error("last ball lands too late");

// audio: one event per (16th slot, bin): several balls entering the same bin together are one note
const events = new Map<string, { sec: number; beat: number; bin: number; balls: number }>();
for (const b of balls) {
  const key = `${b.enterSlot}:${b.bin}`;
  const e = events.get(key) ?? { sec: (b.enterSlot * S16) / FPS, beat: b.enterSlot / 4, bin: b.bin, balls: 0 };
  e.balls++;
  events.set(key, e);
}
const ev = [...events.values()].sort((a, b) => a.sec - b.sec || a.bin - b.bin);

const expected = Array.from({ length: BINS }, (_, k) => {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (ROWS - i)) / (i + 1);
  return (BALLS * c) / 2 ** ROWS;
});

mkdirSync("public/galton-board", { recursive: true });
writeFileSync(
  "public/galton-board/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, rows: ROWS, bins: BINS, framesPerHop: S16, drainFrame, lastEnterFrame: lastEnter, counts, expected, balls, events: ev }),
);
console.log(`balls ${balls.length}, last enters frame ${lastEnter} (bar ${(lastEnter / (4 * FPB)).toFixed(2)}), drain at ${drainFrame}`);
console.log("counts  ", counts.join(" "));
console.log("expected", expected.map((x) => x.toFixed(0)).join(" "));
console.log(`audio events ${ev.length}, busiest 16th: ${Math.max(...[...new Set(ev.map((e) => e.sec))].map((s) => ev.filter((e) => e.sec === s).length))} notes`);
