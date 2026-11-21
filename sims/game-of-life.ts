// Conway's Game of Life as a step sequencer.
// Board: a 16 x 16 torus (the edges wrap). Rules B3/S23: a dead cell with exactly 3 live neighbours is born;
// a live cell with 2 or 3 live neighbours survives; every other cell is dead next generation.
//
// The pattern: one glider (it moves one cell diagonally every 4 generations, so on a 16 x 16 torus it is back
// where it started after 64 generations) plus period-2 oscillators (blinkers and beacons) placed on diagonals
// the glider never touches. So the whole board repeats after exactly 64 generations: the loop is the rule itself.
// The placement is found by search and checked by running the rules, not assumed.
//
// Clock: 120 BPM, 30 fps (15 frames per beat). One generation per beat; 64 generations = 16 bars = 32 s.
// The playhead sweeps the 16 columns once per bar, one column per 16th; every live cell under it plays a note
// (row = pitch). Output: public/game-of-life/timeline.json
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
const FPB = (60 / BPM) * FPS; // 15
export const N = 16;
export const GENS = 64;
export const TOTAL_FRAMES = GENS * FPB; // 960

type Board = Uint8Array;
const idx = (x: number, y: number) => (((y % N) + N) % N) * N + (((x % N) + N) % N);

function step(b: Board): Board {
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c += b[idx(x + dx, y + dy)];
    const alive = b[idx(x, y)];
    out[idx(x, y)] = (alive && (c === 2 || c === 3)) || (!alive && c === 3) ? 1 : 0;
  }
  return out;
}

const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]; // heads down-right
const BLINKER = [[0, 0], [1, 0], [2, 0]];
const BEACON = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 2], [2, 3], [3, 3]];

function place(b: Board, shape: number[][], x: number, y: number) {
  for (const [dx, dy] of shape) b[idx(x + dx, y + dy)] = 1;
}

function run(b0: Board) {
  const gens: Board[] = [b0];
  for (let g = 1; g <= GENS; g++) gens.push(step(gens[g - 1]));
  return gens;
}
const same = (a: Board, b: Board) => a.every((v, i) => v === b[i]);
const firstRepeat = (gens: Board[]) => gens.findIndex((g, i) => i > 0 && same(g, gens[0]));

// Greedy search: add oscillators one by one on the diagonal band 7 cells off the glider's (checked safe:
// blinkers are safe 5-8 off, beacons 6-9 off), at the first spot along the band where the whole board still
// repeats after exactly 64 generations and keeps its live-cell count (nothing collides, nothing dies).
const OFF = 7;
const board = new Uint8Array(N * N);
place(board, GLIDER, 0, 0);
const oscillators: string[] = [];
const want: [string, number[][]][] = [["beacon", BEACON], ["blinker", BLINKER], ["beacon", BEACON], ["blinker", BLINKER], ["blinker", BLINKER]];
for (const [name, shape] of want) {
  for (let t = 0; t < N; t++) {
    const trial = board.slice();
    let clash = false;
    for (const [dx, dy] of shape) if (trial[idx(t + OFF + dx, t + dy)]) clash = true;
    if (clash) continue;
    place(trial, shape, t + OFF, t);
    const pop0 = trial.reduce((s, v) => s + v, 0);
    const gens = run(trial);
    const pops = gens.map((g) => g.reduce((s, v) => s + v, 0));
    const beacons = oscillators.filter((o) => o.startsWith("beacon")).length + (name === "beacon" ? 1 : 0);
    if (firstRepeat(gens) !== GENS || Math.min(...pops) < pop0 - 2 * beacons) continue;
    board.set(trial);
    oscillators.push(`${name}@${(t + OFF) % N},${t}`);
    break;
  }
}
const best = { gens: run(board), oscillators };
if (firstRepeat(best.gens) !== GENS) throw new Error("layout does not repeat at 64");

// audio: per 16th, the playhead column; one note per live cell (row 0 = top = highest)
const events: { sec: number; beat: number; gen: number; col: number; row: number }[] = [];
for (let s16 = 0; s16 < GENS * 4; s16++) {
  const gen = Math.floor(s16 / 4);
  const col = s16 % N;
  for (let row = 0; row < N; row++) if (best.gens[gen][idx(col, row)]) events.push({ sec: (s16 * FPB) / 4 / FPS, beat: s16 / 4, gen, col, row });
}

mkdirSync("public/game-of-life", { recursive: true });
writeFileSync(
  "public/game-of-life/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, size: N, gens: best.gens.slice(0, GENS).map((g) => Array.from(g).join("")), oscillators: best.oscillators, events }),
);
const pops = best.gens.map((g) => g.reduce((s, v) => s + v, 0));
console.log(`layout: glider@0,0 + ${best.oscillators.join(" ")}`);
console.log(`period 64 checked; population ${Math.min(...pops)}-${Math.max(...pops)}; notes ${events.length} (${(events.length / (GENS * 4)).toFixed(2)} per 16th)`);
