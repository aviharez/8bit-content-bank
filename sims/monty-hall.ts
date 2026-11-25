// Should you switch doors? The Monty Hall problem: a car behind 1 of 3 doors, goats behind the others. You pick, the
// host (who knows) opens a goat door you did not pick, you stay or switch. Plan: docs/plans/monty-hall.md.
//
// Clock: 138.46 BPM, 30 fps = 13 frames per beat (a 16th is 3.25 frames: the picture rounds, the audio is exact).
// 22 bars = 88 beats = 1144 frames = 38.1 s.
//
// Maths (exact): the first pick is the car 1 time in 3, so staying wins 1/3 and switching wins 2/3. The 1,000 games
// are one real random draw (mulberry32, seeded): car door and first pick uniform, the host picks at random when both
// other doors hide goats. The seed is the first one where game 1 (stay) loses, game 2 (switch) wins, and the final
// win rates sit within 1 point of 33.3% / 66.7%. Nothing else is fitted.
//
// Schedule. Each game has 4 steps (pick, host opens a goat door, stay or switch, reveal):
//   games 1-8     bars 0-7    one game a bar, steps on the beats
//   games 9-12    bars 8-9    one game every 2 beats, steps on 8ths
//   games 13-20   bars 10-11  one game a beat, steps on 16ths; meanwhile the wall of 35 stages builds (one a 16th)
//   games 21-1000 bars 12-18  rounds: all 35 stages play one game a beat (28 rounds, steps on 16ths)
//   bar 19                    the result: each beat the winners of one side flash (stay, switch, stay, switch)
//   bars 20-21                turn: the wall folds away row by row, then the 3 doors close and the contestant steps
//                             back on the mark for bar 0
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
const FPB = 13;
export const BPM = (60 * FPS) / FPB; // 138.46
export const BARS = 22;
const BEATS = BARS * 4; // 88
export const TOTAL_FRAMES = BEATS * FPB; // 1144
const COLS = 5, ROWS = 7, STAGES = COLS * ROWS; // 35
const MAIN = 3 * COLS + 2; // the stage in the middle of the wall is the one from the intro
const ROUNDS = 28;
const SINGLES = 20;
if (SINGLES + STAGES * ROUNDS !== 1000) throw new Error("1,000 games");

// ---------------------------------------------------------------- the draw
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Game = {
  n: number; stage: number; stay: boolean; car: number; pick: number; open: number; final: number; win: boolean;
  steps: [number, number, number, number]; // beats: pick, host opens, stay/switch, reveal
};
// strategy: the single games alternate (game 1 stays); on the wall, a checkerboard of stages (the middle one switches)
const stageStays = (s: number) => (Math.floor(s / COLS) + (s % COLS)) % 2 === 0;
function play(seed: number): Game[] {
  const r = mulberry32(seed);
  const games: Game[] = [];
  const one = (n: number, stage: number, stay: boolean, t0: number, dt: number) => {
    const car = Math.floor(r() * 3), pick = Math.floor(r() * 3);
    const goats = [0, 1, 2].filter((d) => d !== pick && d !== car);
    const open = goats[goats.length === 2 ? Math.floor(r() * 2) : 0];
    const final = stay ? pick : 3 - pick - open;
    games.push({ n, stage, stay, car, pick, open, final, win: final === car, steps: [t0, t0 + dt, t0 + 2 * dt, t0 + 3 * dt] });
  };
  let n = 1;
  for (let g = 0; g < 8; g++, n++) one(n, MAIN, n % 2 === 1, 4 * g, 1);
  for (let g = 0; g < 4; g++, n++) one(n, MAIN, n % 2 === 1, 32 + 2 * g, 0.5);
  for (let g = 0; g < 8; g++, n++) one(n, MAIN, n % 2 === 1, 40 + g, 0.25);
  for (let k = 0; k < ROUNDS; k++) for (let s = 0; s < STAGES; s++, n++) one(n, s, stageStays(s), 48 + k, 0.25);
  return games;
}
const rate = (gs: Game[], stay: boolean) => { const x = gs.filter((g) => g.stay === stay); return x.filter((g) => g.win).length / x.length; };
let seed = 1;
for (; ; seed++) {
  const g = play(seed);
  if (g[0].win || !g[1].win) continue;
  if (Math.abs(rate(g, true) - 1 / 3) < 0.01 && Math.abs(rate(g, false) - 2 / 3) < 0.01) break;
}
const games = play(seed);
if (games.length !== 1000) throw new Error("count");

// ---------------------------------------------------------------- the wall: 34 more stages appear around the middle one, one a 16th (bars 10-11)
// order: nearest the middle first, so the wall grows outward; 34 stages on 32 16ths (two pairs share a 16th)
const others = Array.from({ length: STAGES }, (_, s) => s).filter((s) => s !== MAIN)
  .sort((a, b) => Math.hypot(a % COLS - 2, Math.floor(a / COLS) - 3) - Math.hypot(b % COLS - 2, Math.floor(b / COLS) - 3) || a - b);
const appear: number[] = Array(STAGES).fill(0);
appear[MAIN] = -1; // always there
others.forEach((s, k) => { appear[s] = 40 + Math.floor((k * 32) / others.length) / 4; });
const roll = [...new Set(others.map((s) => appear[s]))].sort((a, b) => a - b);
// the turn: rows fold away on the beats of bar 20 (outer rows first), the middle row's sides on beat 83
const vanish: number[] = Array(STAGES).fill(Infinity);
for (let s = 0; s < STAGES; s++) {
  if (s === MAIN) continue;
  const row = Math.floor(s / COLS);
  vanish[s] = 80 + Math.min(3, 3 - Math.abs(row - 3) + (row === 3 ? 0 : 0));
}
// result bar (19): beats 76-79 flash the last round's winners: stay, switch, stay, switch
const lastRound = games.filter((g) => g.steps[0] === 48 + ROUNDS - 1);
const flashes = [76, 77, 78, 79].map((beat, k) => {
  const stay = k % 2 === 0;
  return { beat, stay, stages: lastRound.filter((g) => g.stay === stay && g.win).map((g) => g.stage) };
});
// turn bar 21: the main stage's doors close one a beat (84, 85, 86), the contestant steps on the mark on 87
const closes = [84, 85, 86];

// ---------------------------------------------------------------- events on the grid
// every beat something visible happens: a game step on the beat, a round's pick, a result flash, a row folding away,
// a door closing. That step is the kick.
const kicks: { beat: number; kind: string }[] = [];
for (let b = 0; b < BEATS; b++) {
  const kind = b < 48 ? "step" : b < 76 ? "round" : b < 80 ? "flash" : b < 84 ? "fold" : b < 87 ? "close" : "mark";
  kicks.push({ beat: b, kind });
}
// stage lights flash on the off-beat 8ths (the off-beat bass); dark in the near-empty bar 20
const lights: number[] = [];
for (let b = 0; b < BEATS; b++) if (Math.floor(b / 4) !== 20) lights.push(b + 0.5);
// host opens a goat door (goat note), switchers hop (hats), reveals (stab): one per beat on the wall
const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
const opens = uniq(games.map((g) => g.steps[1]));
const hops = uniq(games.filter((g) => !g.stay).map((g) => g.steps[2]));
const reveals = uniq(games.map((g) => g.steps[3])).map((beat) => {
  const gs = games.filter((g) => g.steps[3] === beat);
  return { beat, games: gs.length, wins: gs.filter((g) => g.win).length, single: gs.length === 1, win: gs.length === 1 ? gs[0].win : null };
});

// ---------------------------------------------------------------- the hook: the marquee light chase over the doors
// A row of 9 bulbs arches over every stage's doors; each hook note lights one bulb, and the bulb is the note's step
// on the chord-tone ladder (bulb 0 = lowest), so you see the melody climb and fall. The composer turns a step into a
// pitch of the bar's chord. The reveal's note is the game's result: a win lands high, a loss low; on the wall the
// number of winners in the round sets it.
const hook: { beat: number; deg: number }[] = [];
const put = (t0: number, slots: Record<number, number>, slot = 0.25) => {
  for (const [s, d] of Object.entries(slots)) hook.push({ beat: t0 + Number(s) * slot, deg: Math.max(0, Math.min(8, d)) });
};
for (const g of games.slice(0, SINGLES)) {
  const t0 = g.steps[0];
  if (g.n <= 8) {
    const r = g.win ? 6 : 1;
    const late = g.n >= 5; // the rule section: A' and B'
    const A = { 0: 0, 2: 2, 3: 1, 6: late ? 4 : 3, 8: 2, 10: late ? 5 : 4, 11: 3, 12: r, 14: Math.max(0, r - 1) };
    const B = { 0: 2, 2: 4, 3: 3, 6: 5, 8: 4, 10: late ? 5 : 3, 11: late ? 6 : 2, 12: r, 14: r + 1 };
    put(t0, g.stay ? A : B);
  } else if (g.n <= 12) {
    const r = g.win ? 7 : 3;
    put(t0, g.stay ? { 0: 3, 1: 4, 2: 5, 3: 4, 4: 3, 6: r, 7: r - 1 } : { 0: 5, 1: 6, 2: 5, 3: 4, 4: 6, 6: r, 7: r + 1 });
  } else {
    const r = g.win ? 8 : 4;
    const P = [[4, 6, 5], [5, 7, 6], [4, 6, 5], [6, 8, 7]][(g.n - 13) % 4];
    put(t0, { 0: P[0], 1: P[1], 2: P[2], 3: r });
  }
}
for (let k = 0; k < ROUNDS; k++) {
  const t0 = 48 + k;
  const wins = games.filter((g) => g.steps[0] === t0 && g.win).length;
  const up = k >= 16 ? 3 : 0; // drop 2: an octave up (3 chord tones)
  const C = [[0, 2, 1], [0, 2, 4], [1, 3, 2], [4, 3, 2]][k % 4];
  const r = Math.round((wins / STAGES) * 8);
  put(t0, { 0: C[0] + up, 1: C[1] + up, 2: C[2] + up, 3: r + up });
}
for (const fl of flashes) put(fl.beat, fl.stay ? { 0: 3, 1: 4, 2: 3, 3: 2 } : { 0: 6, 1: 7, 2: 8, 3: 7 });
put(80, { 0: 8, 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1 }, 0.5); // turn: the chase runs back down as the rows fold
put(84, { 0: 4, 3: 3, 4: 3, 7: 2, 8: 2, 11: 1, 12: 0, 14: 1 }); // the doors close
hook.sort((a, b) => a.beat - b.beat);

// ---------------------------------------------------------------- chords (D Phrygian: D Eb F G A Bb C)
const CHORDS: Record<string, number[]> = { Dm: [2, 5, 9], Eb: [3, 7, 10], Bb: [10, 2, 5], Cm: [0, 3, 7], Gm: [7, 10, 2] };
const CHORD_OF_BAR = [
  "Dm", "Eb", "Dm", "Eb", // intro
  "Dm", "Bb", "Cm", "Dm", // rule
  "Gm", "Gm", "Bb", "Cm", // build
  "Dm", "Eb", "Bb", "Cm", // drop 1
  "Dm", "Eb", "Gm", "Cm", // drop 2 (bar 19 the result)
  "Eb", "Dm", // turn
];
if (CHORD_OF_BAR.length !== BARS) throw new Error("chords");
const sections = [
  { id: "intro", fromBar: 0, toBar: 4, what: "games 1-4, one a bar: pick, goat, stay/switch, reveal on the beats; hook A (stay) / B (switch)" },
  { id: "rule", fromBar: 4, toBar: 8, what: "games 5-8: your door 1 in 3 (blue), the other two 2 in 3 (orange); hook A' / B'" },
  { id: "build", fromBar: 8, toBar: 12, what: "games 9-20, faster (8ths, then 16ths); the wall of 35 stages builds on 16ths (snare roll); hook B''" },
  { id: "drop1", fromBar: 12, toBar: 16, what: "rounds 1-16: all 35 stages play a game a beat, the tally pours in; hook C" },
  { id: "drop2", fromBar: 16, toBar: 20, what: "rounds 17-28 to game 1,000, then bar 19 the winners flash side by side; hook C' up an octave" },
  { id: "turn", fromBar: 20, toBar: 22, what: "bar 20 near-empty: the wall folds away row by row; bar 21 the doors close; hook A'' falling" },
];

// ---------------------------------------------------------------- per frame: the tally (counted at each reveal)
const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const b = f / FPB + 1e-9;
  const done = games.filter((g) => g.steps[3] <= b);
  const s = done.filter((g) => g.stay), w = done.filter((g) => !g.stay);
  const pct = (x: Game[]) => (x.length ? Math.round((1000 * x.filter((g) => g.win).length) / x.length) / 10 : null);
  return { games: done.length, stay: pct(s), switch: pct(w), stayGames: s.length, switchGames: w.length };
});

mkdirSync("public/monty-hall", { recursive: true });
writeFileSync("public/monty-hall/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, seed,
  cols: COLS, rows: ROWS, main: MAIN, appear, vanish, games, kicks, lights, opens, hops, reveals, roll, hook, flashes, closes,
  chords: CHORDS, chordOfBar: CHORD_OF_BAR, sections, frames,
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_OF_BAR.slice(s.fromBar, s.toBar).join(" ")} | ${s.what}`);
const fin = frames[TOTAL_FRAMES - 1];
console.log(`seed ${seed}; final: stay ${fin.stay}% of ${fin.stayGames}, switch ${fin.switch}% of ${fin.switchGames}; games ${fin.games}`);
console.log(`singles: ${games.slice(0, SINGLES).map((g) => `${g.n}${g.stay ? "S" : "W"}${g.win ? "+" : "-"}`).join(" ")}`);
