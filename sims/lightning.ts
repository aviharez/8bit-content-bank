// How far away is the lightning? A night storm seen from a porch on a hill. Plan: docs/plans/lightning.md.
//
// Clock: 128.57 BPM, 30 fps = 14 frames per beat, 7 per 8th (a 16th is 3.5 frames: the picture rounds, the audio
// stays exact). 20 bars = 80 beats = 1120 frames = 37.3 s.
//
// Physics: the flash arrives at once (light: about 10 us for 3 km), the thunder at 343 m/s, so d = 343 * t.
// Time squeezed (stated on screen): one beat of the music = one second of the storm, so the thunder plays about
// 2.1x fast. A power line runs from the hill out across the plain with a tower every 343 m, so a sound front
// passes exactly one tower per second. Every strike hits a tower g towers out (g = the gap in seconds); its thunder
// reaches the porch g seconds later, on the very beat of the next strike, so a front is always on its way and
// passes a tower (or the porch) on every beat: that is the kick. Distances are exact; only the storm's approach is
// squeezed (a real storm takes minutes to come 3 km), and the bolt's growth is slowed (a real leader takes ~30 ms).
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 1800 / 14; // 128.571...
const FPB = 14;
export const BARS = 20;
const BEATS = BARS * 4; // 80
export const TOTAL_FRAMES = BEATS * FPB; // 1120
export const SOUND = 343; // m/s, air at 20 C
export const TOWER_GAP = SOUND; // m: one tower per second of sound
export const TOWERS = 8;
export const HILL = 160; // m: the cabin sits on a ridge this high above the plain
export const TOWER_H = 42; // m
export const LINE_X = -15; // m: the power line runs this far right of the deck (+x is to the viewer's left)
export const CLOUD_BASE = 700; // m: a low storm cloud
export const POLE0_X = -4, POLE0_Z = 16, POLE0_H = 12; // the first pole, a short one on the ridge in front of the deck, right
export const DECK = 4; // m: the listener stands on a deck this high above the hilltop

// ---------------------------------------------------------------- seeded random (one stream per strike)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- the storm's path: one strike per gap
// target: "tower" g = tower number (1..8, on the plain); in the drop the strike is overhead: the old tree on the
// left of the deck, or the first pole (tower 0) on the right.
type Target = { kind: "tower" | "tree"; tower?: number; x: number; y: number; z: number; base: number };
const towerPos = (k: number) => ({ x: k === 0 ? POLE0_X : LINE_X, z: k === 0 ? POLE0_Z : k * TOWER_GAP, base: k === 0 ? HILL : 0, h: k === 0 ? POLE0_H : TOWER_H });
const TREE = { x: 4, z: 16, base: HILL, top: HILL + 14 }; // the old tree on the ridge in front of the deck, left

type Plan = { beat: number; gap: number; target?: "tree" | "tower0"; leader: number; leaderStep: number; strokes: number; strokeStep: number };
const plan: Plan[] = [];
const add = (beat: number, gap: number, leader: number, leaderStep: number, strokes: number, strokeStep: number, target?: Plan["target"]) =>
  plan.push({ beat, gap, leader, leaderStep, strokes, strokeStep, target });
// bars 0-3, intro: far, 8 s (2.7 km). Leader on 8ths over beats 4-7, four flickers on 8ths after the flash.
add(0, 8, 8, 0.5, 4, 0.5); add(8, 8, 8, 0.5, 4, 0.5);
// bars 4-7, the rule: 4 s (1.4 km), one strike a bar. Leader on 16ths over beats 2-3.
for (let b = 16; b < 32; b += 4) add(b, 4, 8, 0.25, 4, 0.25);
// bars 8-9: 2 s (690 m)
for (let b = 32; b < 40; b += 2) add(b, 2, 4, 0.25, 3, 0.25);
// bars 10-11: 1 s (343 m), a strike every second
for (let b = 40; b < 48; b++) add(b, 1, 2, 0.25, 2, 0.25);
// bars 12-15, the drop: overhead, flash and thunder together. targets: the tree (left) or the first pole (right)
const DROP: Plan["target"][] = ["tree", "tower0", "tree", "tower0", "tree", "tree", "tower0", "tree", "tower0", "tree", "tower0", "tower0", "tree", "tower0", "tree", "tree"];
for (let b = 48; b < 64; b++) add(b, 0, 2, 0.25, 2, 0.25, DROP[b - 48]);
// bars 16-19, leaving: 2 s, 4 s, then 8 s; the last strike's thunder lands on beat 80 = beat 0 (the loop)
add(64, 2, 2, 0.25, 3, 0.25); add(66, 2, 4, 0.25, 3, 0.25); add(68, 4, 4, 0.25, 4, 0.25); add(72, 8, 8, 0.25, 4, 0.5);

for (let i = 0; i < plan.length; i++) {
  const p = plan[i], n = plan[(i + 1) % plan.length];
  const next = n.beat + (i === plan.length - 1 ? BEATS : 0);
  if (p.beat + p.gap !== next && p.gap > 0) throw new Error(`strike at ${p.beat}: thunder lands at ${p.beat + p.gap}, next strike at ${next}`);
  if (p.gap === 0 && next !== p.beat + 1) throw new Error(`drop strike at ${p.beat} must be followed one beat later`);
}

// ---------------------------------------------------------------- strikes: target, bolt, leader steps, flickers
type Pt = [number, number, number];
type Strike = {
  i: number; beat: number; gap: number; km: number; target: Target;
  bolt: Pt[]; // main channel, cloud to target, one point per leader step
  branches: { from: number; pts: Pt[] }[];
  leader: { beat: number; k: number; side: number }[]; // side: -1/+1 = the jag at this step went left/right
  strokes: { beat: number; n: number }[];
  cloud: Pt; // where the bolt leaves the cloud
};
const strikes: Strike[] = plan.map((p, i) => {
  let t: Target;
  if (p.gap > 0) {
    const tp = towerPos(p.gap);
    t = { kind: "tower", tower: p.gap, x: tp.x, y: tp.base + tp.h, z: tp.z, base: tp.base };
  } else if (p.target === "tree") t = { kind: "tree", x: TREE.x, y: TREE.top, z: TREE.z, base: TREE.base };
  else { const tp = towerPos(0); t = { kind: "tower", tower: 0, x: tp.x, y: tp.base + tp.h, z: tp.z, base: tp.base }; }
  const r = rng(1000 + i * 7919);
  const n = p.leader; // the channel has one segment per leader step
  const cloudH = CLOUD_BASE;
  const spread = p.gap === 0 ? 60 : 160 + p.gap * 40;
  const cloud: Pt = [t.x + (r() - 0.5) * spread, cloudH, t.z + (r() - 0.5) * spread * 0.5];
  const bolt: Pt[] = [cloud];
  const leader: Strike["leader"] = [];
  for (let k = 1; k <= n; k++) {
    const a = k / n;
    const jag = (r() - 0.5) * spread * 0.5 * (1 - a * a);
    const side = jag >= 0 ? 1 : -1;
    bolt.push(k === n ? [t.x, t.y, t.z] : [cloud[0] + (t.x - cloud[0]) * a + jag, cloud[1] + (t.y - cloud[1]) * a, cloud[2] + (t.z - cloud[2]) * a + jag * 0.3]);
    leader.push({ beat: (p.beat - (n - k + 1) * p.leaderStep + BEATS) % BEATS, k: k - 1, side });
  }
  // a few dead-end branches (the leader's side forks), from the upper half of the channel
  const branches: Strike["branches"] = [];
  const nb = 1 + Math.floor(r() * 3);
  for (let b = 0; b < nb; b++) {
    const from = Math.min(n - 1, Math.floor(r() * n * 0.6));
    const o = bolt[from], pts: Pt[] = [o];
    const dir = r() < 0.5 ? -1 : 1, len = (cloudH - t.y) * (0.25 + 0.3 * r());
    for (let s = 1; s <= 3; s++) { const q = pts[s - 1]; pts.push([q[0] + dir * len * 0.25 * (0.6 + r()), q[1] - len / 3, q[2] + (r() - 0.5) * len * 0.2]); }
    branches.push({ from, pts });
  }
  const strokes = Array.from({ length: p.strokes }, (_, k) => ({ beat: p.beat + k * p.strokeStep, n: k }));
  const dist = p.gap > 0 ? p.gap * SOUND : Math.hypot(t.x, t.z + 20);
  return { i, beat: p.beat, gap: p.gap, km: Math.round(dist / 100) / 10, target: t, bolt, branches, leader, strokes, cloud };
});

// ---------------------------------------------------------------- what the music hears, every one with a picture
// passes: the front from strike s passes tower (gap - j) j seconds after it; at j = gap it reaches the porch (BOOM)
const passes: { beat: number; strike: number; tower: number }[] = [];
const booms: { beat: number; strike: number; gap: number; km: number }[] = [];
for (const s of strikes) {
  if (s.gap === 0) { booms.push({ beat: s.beat, strike: s.i, gap: 0, km: s.km }); continue; }
  for (let j = 1; j < s.gap; j++) passes.push({ beat: s.beat + j, strike: s.i, tower: s.gap - j });
  booms.push({ beat: (s.beat + s.gap) % BEATS, strike: s.i, gap: s.gap, km: s.km });
}
// the kick: every beat, a tower passed or the thunder reaching the porch
// (bar 16, beat 64: the first strike after the drop lands on a beat with no thunder arriving; the strike itself,
// a bolt hitting tower 2 in full view, is the cause)
const kicks: { beat: number; kind: "pass" | "boom" | "strike" }[] = [];
for (let b = 0; b < BEATS; b++) {
  const boom = booms.some((x) => x.beat === b), pass = passes.some((x) => x.beat === b), hit = strikes.some((x) => x.beat === b);
  if (!boom && !pass && !hit) throw new Error(`beat ${b} has no visible cause for the kick`);
  kicks.push({ beat: b, kind: boom ? "boom" : pass ? "pass" : "strike" });
}
// the lamp on a tower swings out when the front hits it and back through the middle half a second later: the
// off-beat rumble (the bass). 
const swings = kicks.map((k) => ({ beat: k.beat + 0.5, of: k.kind }));
// rain dripping off the porch roof into the puddle: the hats, on the off-beat 16ths
const drips: number[] = [];
for (let b = 0; b < BEATS; b++) { const bar = Math.floor(b / 4); if (bar === 16 && b % 4 < 2) continue; drips.push(b + 0.25, b + 0.75); }
// two strikes a beat apart or closer (bars 10-11): the snare roll
const roll = Array.from({ length: 32 }, (_, k) => 40 + k * 0.25);

// ---------------------------------------------------------------- chords (C# Phrygian dominant) and sections
const CHORDS: Record<string, number[]> = { "C#": [1, 5, 8], D: [2, 6, 9], "F#m": [6, 9, 1], Bm: [11, 2, 6] }; // pitch classes
const CHORD_OF_BAR = ["C#", "D", "C#", "D", "F#m", "D", "Bm", "C#", "F#m", "D", "Bm", "C#", "C#", "D", "Bm", "C#", "D", "C#", "D", "C#"];
const sections = [
  { id: "intro", fromBar: 0, toBar: 4, what: "far: 8 s, 2.7 km; hook A (leader on 8ths)" },
  { id: "rule", fromBar: 4, toBar: 8, what: "4 s, 1.4 km, a strike a bar; hook A' (leader on 16ths)" },
  { id: "build", fromBar: 8, toBar: 12, what: "2 s then 1 s; hook B squeezed; snare roll bars 10-11" },
  { id: "drop", fromBar: 12, toBar: 16, what: "overhead: flash and thunder together; hook C (targets)" },
  { id: "turn", fromBar: 16, toBar: 20, what: "leaving: 2 s, 4 s, 8 s; hook A'' back to A" },
];

// ---------------------------------------------------------------- per frame: the storm's centre and the HUD
// HUD: SECONDS counts up from the latest flash whose thunder has not arrived yet; KM AWAY appears on the BOOM.
const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const b = f / FPB;
  // the front on its way (at most one at a time; at a boom the next one starts)
  let front: { strike: number; r: number } | null = null;
  for (const s of strikes) {
    if (s.gap === 0) continue;
    const end = s.beat + s.gap;
    const t = b >= s.beat ? b - s.beat : b + BEATS - s.beat; // wraps for the last strike
    if (t >= 0 && t < s.gap && (s.beat <= b || end > BEATS)) front = { strike: s.i, r: t * SOUND };
  }
  // the counting: seconds since the flash of the front on its way
  const counting = front ? Math.floor(front.r / SOUND + 1e-9) : null;
  const lastBoom = [...booms].map((x) => ({ ...x, d: (b - x.beat + BEATS) % BEATS })).sort((a, c) => a.d - c.d)[0];
  return { front, seconds: counting, boom: lastBoom.d < 2 ? { strike: lastBoom.strike, gap: lastBoom.gap, km: lastBoom.km, age: lastBoom.d } : null };
});

mkdirSync("public/lightning", { recursive: true });
writeFileSync("public/lightning/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES,
  // The video opens this many frames before beat 0, so the loop point falls between two frames of the first
  // leader growing, not on the strike's flash. Picture and track are both rotated by it (scene + compose.py).
  openLeadFrames: 4,
  world: { sound: SOUND, towerGap: TOWER_GAP, towers: TOWERS, hill: HILL, towerH: TOWER_H, lineX: LINE_X, cloudBase: CLOUD_BASE, pole0X: POLE0_X, pole0Z: POLE0_Z, pole0H: POLE0_H, deck: DECK, tree: TREE },
  chords: CHORDS, chordOfBar: CHORD_OF_BAR, sections,
  strikes, passes, booms, kicks, swings, drips, roll, frames,
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_OF_BAR.slice(s.fromBar, s.toBar).join(" ")} | ${s.what}`);
console.log(`strikes ${strikes.length}: ${strikes.map((s) => `${s.beat}${s.gap ? `/${s.gap}s` : `@${s.target.kind}`}`).join(" ")}`);
console.log(`kicks ${kicks.length} (booms ${kicks.filter((k) => k.kind === "boom").length}), passes ${passes.length}, leader steps ${strikes.reduce((a, s) => a + s.leader.length, 0)}, flickers ${strikes.reduce((a, s) => a + s.strokes.length, 0)}`);

// no two hook notes on the same 16th: a leader never starts while the previous strike still flickers
const hook = strikes.flatMap((s) => [...s.leader.map((l) => l.beat), ...s.strokes.map((k) => k.beat)]).map((b) => Math.round(((b % BEATS) + BEATS) % BEATS * 4));
const dup = hook.filter((x, i) => hook.indexOf(x) !== i);
if (dup.length) throw new Error(`hook notes collide at 16ths ${dup.join(", ")}`);
console.log(`hook notes ${hook.length} on ${new Set(hook).size} distinct 16ths`);
