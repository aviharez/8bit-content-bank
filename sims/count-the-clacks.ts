// Event-driven elastic collision sim: small block (m) between a wall and a big block (M).
// The number of collisions spells the digits of pi when M/m = 100^(d-1).
// Output: timeline.json with per-frame state + audio events, all on one musical clock.
import { writeFileSync, mkdirSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
export const FRAMES_PER_BEAT = (60 / BPM) * FPS; // 15
export const FRAMES_PER_BAR = FRAMES_PER_BEAT * 4; // 60
export const TOTAL_BARS = 16;
export const TOTAL_FRAMES = TOTAL_BARS * FRAMES_PER_BAR; // 960

const SMALL_W = 1; // world units (metres)

type Ev = { t: number; type: "wall" | "block"; x1: number; v1: number; x2: number; v2: number };

function simulate(ratio: number, x1: number, x2: number, vBig: number) {
  const m = 1, M = ratio;
  let v1 = 0, v2 = -vBig, t = 0;
  const events: Ev[] = [];
  const start = { t: 0, x1, v1, x2, v2 };
  for (let guard = 0; guard < 100000; guard++) {
    // time to block-block contact (gap closes)
    const gap = x2 - x1 - SMALL_W;
    const rel = v1 - v2; // closing speed
    const tBlock = rel > 1e-15 ? gap / rel : Infinity;
    const tWall = v1 < -1e-15 ? -x1 / v1 : Infinity;
    const dt = Math.min(tBlock, tWall);
    if (!isFinite(dt)) break;
    t += dt; x1 += v1 * dt; x2 += v2 * dt;
    let type: "wall" | "block";
    if (tBlock <= tWall) {
      const n1 = ((m - M) * v1 + 2 * M * v2) / (m + M);
      const n2 = ((M - m) * v2 + 2 * m * v1) / (m + M);
      v1 = n1; v2 = n2; type = "block";
      x1 = x2 - SMALL_W; // snap to contact
    } else {
      v1 = -v1; type = "wall"; x1 = 0;
    }
    events.push({ t, type, x1, v1, x2, v2 });
    // done when nothing can collide again
    if (v1 >= 0 && v2 >= 0 && v2 >= v1) break;
  }
  return { start, events };
}

type Level = {
  id: number; ratio: number; bigW: number;
  startFrame: number; firstHitFrame: number; lastHitFrame: number; endFrame: number;
};

// bars are 0-indexed here: frame = bar * 60
const B = (bar: number) => bar * FRAMES_PER_BAR;
const levels: Level[] = [
  // 1:1 -> 3 clacks on beats 1,2,3 of bar 4
  { id: 1, ratio: 1, bigW: 1, startFrame: B(2), firstHitFrame: B(3), lastHitFrame: B(3) + 2 * FRAMES_PER_BEAT, endFrame: B(4) },
  // 100:1 -> 31 clacks on 16th notes starting bar 6
  { id: 2, ratio: 100, bigW: 2, startFrame: B(4), firstHitFrame: B(5), lastHitFrame: B(7), endFrame: B(8) },
  // 10000:1 -> 314 clacks spread evenly over 4 bars (a rising roll)
  { id: 3, ratio: 10000, bigW: 3.4, startFrame: B(8), firstHitFrame: B(9), lastHitFrame: B(13), endFrame: B(14) },
];

type FrameState = { level: number; x1: number; x2: number; v1: number; v2: number; bigW: number; count: number; sinceHit: number; lastType: string; ratio: number };
const frames: (FrameState | null)[] = new Array(TOTAL_FRAMES).fill(null);
const audioEvents: { sec: number; level: number; index: number; type: string; total: number }[] = [];

for (const L of levels) {
  const { start, events } = simulate(L.ratio, 3, 7, 1);
  const n = events.length;
  // video time of each event: a smooth time-warp. Each sim gap gets video time ∝ gap^ALPHA,
  // so long gaps stay long-ish and the dense squeeze becomes an accelerating roll.
  const ALPHA = L.id === 1 ? 0 : 0.45;
  const gaps = events.slice(1).map((e, i) => Math.pow(e.t - events[i].t, ALPHA));
  const sumG = gaps.reduce((a, b) => a + b, 0) || 1;
  const vt: number[] = [L.firstHitFrame];
  for (const g of gaps) vt.push(vt[vt.length - 1] + (g / sumG) * (L.lastHitFrame - L.firstHitFrame));
  if (L.id === 2) {
    // snap level 2 onto a 1/32-note grid so every clack is on the beat grid
    const step = FRAMES_PER_BEAT / 8;
    for (let i = 0; i < vt.length; i++) {
      let q = L.firstHitFrame + Math.round((vt[i] - L.firstHitFrame) / step) * step;
      if (i > 0 && q <= vt[i - 1]) q = vt[i - 1] + step;
      vt[i] = q;
    }
  }
  // approach: same sim speed as linear map of [startFrame, firstHit] -> [0, t1]
  const simPerFrameApproach = events[0].t / (L.firstHitFrame - L.startFrame);
  for (let f = L.startFrame; f < L.endFrame; f++) {
    let st: { t: number; x1: number; v1: number; x2: number; v2: number };
    let simT: number;
    let k = -1; // index of last event at or before f
    for (let i = 0; i < n; i++) if (vt[i] <= f + 1e-9) k = i;
    if (k === -1) {
      st = start; simT = (f - L.startFrame) * simPerFrameApproach;
    } else if (k === n - 1) {
      st = events[k]; simT = events[k].t + (f - vt[k]) * simPerFrameApproach * 1.5;
    } else {
      st = events[k];
      const a = (f - vt[k]) / (vt[k + 1] - vt[k]);
      simT = events[k].t + a * (events[k + 1].t - events[k].t);
    }
    const dt = simT - st.t;
    frames[f] = {
      level: L.id, ratio: L.ratio, bigW: L.bigW,
      x1: st.x1 + st.v1 * dt, x2: st.x2 + st.v2 * dt, v1: st.v1, v2: st.v2,
      count: k + 1, sinceHit: k === -1 ? 999 : f - vt[k], lastType: k === -1 ? "" : events[k].type,
    };
  }
  events.forEach((e, i) => audioEvents.push({ sec: vt[i] / FPS, level: L.id, index: i, type: e.type, total: n }));
  console.log(`ratio ${L.ratio}: ${n} collisions`);
}

mkdirSync("public/count-the-clacks", { recursive: true });
writeFileSync("public/count-the-clacks/timeline.json", JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, frames, audioEvents }));
console.log("frames", TOTAL_FRAMES, "audio events", audioEvents.length);
