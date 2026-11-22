// How a key opens a lock: a 5-pin tumbler lock in a cutaway. Plan: docs/plans/key-lock.md.
//
// Clock: 150 BPM, 30 fps = 12 frames per beat, 6 per 8th, 3 per 16th. 24 bars = 96 beats = 1152 frames = 38.4 s.
// Slowed down: a key moves one pin spacing (0.150 in) per 8th note (per 16th in the drop). Because the cuts sit at
// the pin spacing, all five pins drop into a cut on the same frame on every step: that shared clack is the kick.
//
// Kinematics are exact: a pin's bottom = the key's profile under it, h_i = profile(p_i + D), D = how far the key's
// shoulder is from the lock face. The lock turns only when every pin's split sits on the shear line.
// Lengths are in inches (Kwikset-like: 5 pins, 0.150 in apart, first cut 0.247 in from the shoulder,
// depths 1-7 in 0.023 in steps; check against a source before a caption uses them).
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12
export const BARS = 24;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 1152

// ---------------------------------------------------------------- the lock
export const PINS = 5;
export const SPACING = 0.15;
export const FIRST = 0.247;
export const pinX = (i: number) => FIRST + i * SPACING; // distance of pin i behind the lock face
export const BLADE = 0.335; // key blade height
const cutHeight = (d: number) => 0.329 - (d - 1) * 0.023; // depth 1 (shallow) .. 7 (deep)
const FLAT = 0.03; // flat bottom of each cut
const TIP0 = 1.02, TIP1 = 1.17, TIP_H = 0.12; // the tip ramp, from blade height down to TIP_H
export const SHEAR = 0.5; // the shear line (top of the plug), above the key's bottom edge
export const REST = 0.1; // with nothing under it, a key pin's bottom rests here
export const DRIVER = 0.16;
export const CHAMBER_TOP = 1.0;
const TOL = 0.004;

/** The right key. The key pins are cut so that this key puts every split on the shear line. */
const RIGHT = [3, 5, 2, 6, 4];
export const KEY_PIN = RIGHT.map((d) => SHEAR - cutHeight(d));
const KEYS: Record<string, { depths: number[]; right: boolean; tag: string }> = {
  A: { depths: [5, 2, 6, 3, 1], right: false, tag: "f77622" },
  B: { depths: [1, 4, 4, 7, 2], right: false, tag: "0099db" },
  C: { depths: [3, 5, 2, 6, 7], right: false, tag: "b55088" }, // 4 of 5: pin 5 is off
  C2: { depths: [3, 1, 2, 6, 4], right: false, tag: "b55088" }, // 4 of 5: pin 2 is off
  D: { depths: RIGHT, right: true, tag: "fee761" },
  E: { depths: [6, 3, 5, 2, 6], right: false, tag: "63c74d" },
};

/** The key's top edge at u inches from its shoulder: V cuts with flat bottoms and 45 degree flanks. */
function profile(depths: number[], u: number): number | null {
  if (u < 0 || u > TIP1) return null;
  let h = BLADE;
  depths.forEach((d, i) => { h = Math.min(h, cutHeight(d) + Math.max(0, Math.abs(u - pinX(i)) - FLAT / 2)); });
  if (u > TIP0) h = Math.min(h, BLADE - (BLADE - TIP_H) * (u - TIP0) / (TIP1 - TIP0));
  return h;
}
/** Depth level 1..7 as heard: 7 = highest pin (shallowest cut), 8 = on the blade's top. */
const levelOf = (bottom: number) => Math.max(0, Math.min(8, Math.round((bottom - cutHeight(7)) / 0.023) + 1));

// ---------------------------------------------------------------- the score of the picture: what happens when
type Seg = { b0: number; b1: number; v0: number; v1: number };
const lerpSeg = (segs: Seg[], b: number, dflt: number) => {
  for (const s of segs) if (b >= s.b0 && b <= s.b1) return s.v0 + (s.v1 - s.v0) * (s.b1 === s.b0 ? 1 : (b - s.b0) / (s.b1 - s.b0));
  // hold the last value reached before b
  let v = dflt, best = -Infinity;
  for (const s of segs) if (s.b1 <= b && s.b1 > best) { best = s.b1; v = s.v1; }
  return v;
};

const keySegs: Seg[] = []; // D(beat)
const keyAt: { b0: number; b1: number; key: string }[] = []; // which key is in hand
const plugSegs: Seg[] = []; // plug angle in degrees
const OUT = 1.3; // shoulder this far out = the tip is clear of the lock
const ENTER = 0.75; // pin 1 sits on the blade's top
const LEAVE = TIP1 - pinX(0); // the tip passes pin 1, every pin back at rest

type Turn = { beat: number; ok: boolean; key: string };
const turns: Turn[] = [];
const sections: { id: string; fromBar: number; toBar: number; what: string }[] = [];

/** A key try over two bars, one step per 8th: in, turn on beat 4, out. */
function tryKey(bar: number, key: string, next: string | null) {
  const b = bar * 4;
  keySegs.push({ b0: b, b1: b + 2.5, v0: ENTER, v1: 0 });
  const ok = KEYS[key].right;
  if (ok) {
    plugSegs.push({ b0: b + 3, b1: b + 3.25, v0: 0, v1: 90 }, { b0: b + 4, b1: b + 4.25, v0: 90, v1: 0 });
  } else {
    plugSegs.push({ b0: b + 3, b1: b + 3 + 1 / 12, v0: 0, v1: 5 }, { b0: b + 3 + 2 / 12, b1: b + 3.25, v0: 5, v1: 0 });
  }
  turns.push({ beat: b + 3, ok, key });
  keySegs.push({ b0: b + 4, b1: b + 6.5, v0: 0, v1: ENTER }, { b0: b + 6.5, b1: b + 7, v0: ENTER, v1: LEAVE }, { b0: b + 7, b1: b + 7.5, v0: LEAVE, v1: OUT });
  keyAt.push({ b0: b - 0.5, b1: b + 7.5, key });
  if (next) { keySegs.push({ b0: b + 7.5, b1: b + 8, v0: OUT, v1: ENTER }); }
}
/** One bar of the right key at double speed (the drop): in on 16ths, turn and open, out on 16ths. */
function quickKey(bar: number) {
  const b = bar * 4, s = 0.25;
  keySegs.push({ b0: b, b1: b + 5 * s, v0: ENTER, v1: 0 });
  plugSegs.push({ b0: b + 6 * s, b1: b + 8 * s, v0: 0, v1: 90 }, { b0: b + 9 * s, b1: b + 11 * s, v0: 90, v1: 0 });
  turns.push({ beat: b + 8 * s, ok: true, key: "D" });
  keySegs.push({ b0: b + 11 * s, b1: b + 4, v0: 0, v1: ENTER });
  keyAt.push({ b0: b, b1: b + 4, key: "D" });
}

// bars 0-7: wrong keys
tryKey(0, "A", "B");
tryKey(2, "B", "C");
sections.push({ id: "intro", fromBar: 0, toBar: 4, what: "key A, key B: wrong, CLUNK" });
tryKey(4, "C", "C2");
tryKey(6, "C2", null);
sections.push({ id: "rule", fromBar: 4, toBar: 8, what: "key C, key C2: 4 of 5, one red pin blocks" });

// bars 8-11: picking. Binding order and the beats each pin is pushed up (the last push sets it).
const ORDER = [2, 0, 4, 1, 3];
const PUSHES = [[32, 33, 34, 35], [36, 37, 38, 39], [40, 41, 42, 43], [44, 44.5, 45], [45.5, 46, 46.5, 47]];
const MOVES = [31.5, 35.5, 39.5, 43.5, 45.25]; // the pick slides under the next pin (one 8th before its first push; 16th for the last)
sections.push({ id: "build", fromBar: 8, toBar: 12, what: "no key: a pick sets the pins one at a time" });

// bar 12: the picked lock turns (the drop), the plug returns, the tools come out, the right key arrives
plugSegs.push({ b0: 48, b1: 48 + 2 / 12, v0: 0, v1: 90 }, { b0: 49, b1: 49 + 2 / 12, v0: 90, v1: 0 });
turns.push({ beat: 48, ok: true, key: "pick" });
keySegs.push({ b0: 50.5, b1: 51, v0: OUT, v1: ENTER });
keyAt.push({ b0: 50.5, b1: 52, key: "D" });
// bars 13-19: the right key at double speed, turning every bar
for (let bar = 13; bar < 20; bar++) quickKey(bar);
sections.push({ id: "drop", fromBar: 12, toBar: 16, what: "picked open; then the right key at 16ths" });
sections.push({ id: "drop2", fromBar: 16, toBar: 20, what: "right key at 16ths, far side, new chords" });
// bars 20-23: the right key slowly once more, then a wrong key: locked again, into the loop
tryKey(20, "D", "E");
tryKey(22, "E", "A");
sections.push({ id: "turn", fromBar: 20, toBar: 24, what: "right key slow, out; key E: locked again" });
// the loop: key A arrives during the last half beat (bar 23) and is at ENTER on frame 0, as tryKey(0) expects
keyAt.push({ b0: 95.5, b1: 96, key: "A" });

// ---------------------------------------------------------------- per-frame state
const CHORD_NAMES = ["Em", "Em", "F", "Em", "C", "C", "Dm", "Dm", "Am", "C", "Dm", "F", "Em", "F", "C", "Dm", "Am", "C", "Dm", "F", "Em", "F", "Em", "F"];
const CHORDS: Record<string, { root: number; tones: number[] }> = {
  Em: { root: 4, tones: [4, 7, 11] }, F: { root: 5, tones: [5, 9, 0] }, C: { root: 0, tones: [0, 4, 7] },
  Dm: { root: 2, tones: [2, 5, 9] }, Am: { root: 9, tones: [9, 0, 4] },
};

type Frame = {
  key: string | null; D: number | null; plug: number;
  kp: number[]; // key pin bottoms (in plug coordinates, before the plug turns)
  dr: number[]; // driver pin bottoms
  lined: boolean[]; set: boolean[];
  pick: { x: number; y: number } | null; wrench: boolean;
};

const keyFor = (b: number) => {
  let k: string | null = null;
  for (const s of keyAt) if (b >= s.b0 && b < s.b1) k = s.key;
  if (b >= 95.5 || b < 0) k = "A";
  return k;
};
const pickActive = (b: number) => b >= 31.5 && b < 50;

function pickState(b: number) {
  // which pin is being worked, its key pin bottom, and the set pins
  const set = [false, false, false, false, false];
  const kp = Array(PINS).fill(REST);
  let x = pinX(ORDER[0]), y = REST;
  for (let n = 0; n < ORDER.length; n++) {
    const pin = ORDER[n];
    const pushes = PUSHES[n];
    const setBeat = pushes[pushes.length - 1];
    const target = SHEAR - KEY_PIN[pin];
    if (b >= setBeat + 1 / 12) { set[pin] = true; continue; } // set: the key pin has dropped back
    if (b < MOVES[n]) break;
    // slide from the previous pin to this one over the move, at the previous pin's rest height
    const moveEnd = n === ORDER.length - 1 ? MOVES[n] + 0.25 : MOVES[n] + 0.5;
    const from = n ? pinX(ORDER[n - 1]) : pinX(ORDER[0]) - 0.3;
    if (b < moveEnd) { const t = (b - MOVES[n]) / (moveEnd - MOVES[n]); x = from + (pinX(pin) - from) * t; y = REST; break; }
    x = pinX(pin);
    // each push lifts the pin one equal step in 2 frames; it holds there until the next push
    let steps = 0;
    for (const p of pushes) if (b >= p) steps += Math.min(1, (b - p) * 6); // 2 frames = 1/6 beat
    const h = REST + (target - REST) * steps / pushes.length;
    kp[pin] = h; y = h;
    // the push that sets it: the key pin falls back over 1 frame
    break;
  }
  return { set, kp, x, y };
}

const frames: Frame[] = [];
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const b = f / FPB;
  const plug = lerpSeg(plugSegs, b, 0);
  const picking = pickActive(b);
  const key = picking ? null : keyFor(b);
  const D = key ? lerpSeg(keySegs, b, OUT) : null;
  const kp: number[] = [], dr: number[] = [], lined: boolean[] = [];
  let set = [false, false, false, false, false];
  let pick: Frame["pick"] = null;
  if (picking) {
    const ps = pickState(b);
    set = ps.set;
    pick = { x: ps.x, y: ps.y };
    for (let i = 0; i < PINS; i++) {
      kp.push(ps.kp[i]);
      // a set driver pin is caught above the line; after the picked turn the plug returns and they fall back
      const back = b >= 49 + 2 / 12;
      dr.push(set[i] && !back ? SHEAR : ps.kp[i] + KEY_PIN[i]);
      lined.push(set[i] && !back);
    }
    if (b >= 49 + 2 / 12) { set = set.map(() => false); for (let i = 0; i < PINS; i++) { kp[i] = REST; dr[i] = REST + KEY_PIN[i]; } }
  } else {
    for (let i = 0; i < PINS; i++) {
      const h = D === null ? null : profile(KEYS[key!].depths, pinX(i) + D);
      const bottom = Math.max(REST, h ?? REST);
      kp.push(bottom);
      dr.push(bottom + KEY_PIN[i]);
      lined.push(Math.abs(bottom + KEY_PIN[i] - SHEAR) < TOL);
    }
  }
  frames.push({ key, D, plug, kp, dr, lined, set, pick, wrench: picking });
}

// ---------------------------------------------------------------- events (the music reads these)
type PinEvt = { i: number; level: number; lined: boolean };
type Landing = { frame: number; beat: number; key: string; pins: PinEvt[]; pin1: number; kind: "land" | "rest" };
const landings: Landing[] = [];
// a landing: the key is on a step (D a multiple of the spacing, or the tip just passed pin 1)
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const fr = frames[f];
  if (fr.D === null || !fr.key) continue;
  const onStep = Math.abs(fr.D / SPACING - Math.round(fr.D / SPACING)) < 1e-6 && fr.D <= ENTER + 1e-9;
  const atRest = Math.abs(fr.D - LEAVE) < 1e-6;
  if (!onStep && !atRest) continue;
  // only count it when the key is moving into or out of this step (not while it holds still for the turn)
  const prev = frames[(f + TOTAL_FRAMES - 1) % TOTAL_FRAMES], next = frames[(f + 1) % TOTAL_FRAMES];
  const moving = (prev.D !== null && Math.abs(prev.D - fr.D) > 1e-9) || (next.D !== null && Math.abs(next.D - fr.D) > 1e-9 && fr.D !== 0);
  if (!moving) continue;
  if (landings.length && landings[landings.length - 1].frame === f) continue;
  const pins = fr.kp.map((k, i) => ({ i, level: levelOf(k), lined: fr.lined[i] }));
  landings.push({ frame: f, beat: f / FPB, key: fr.key, pins, pin1: pins[0].level, kind: atRest ? "rest" : "land" });
}
// a landing at D = 0 while the key comes to a stop counts once (the arrival), not again when it leaves
const pushes: { frame: number; beat: number; pin: number; level: number }[] = [];
const sets: { frame: number; beat: number; pin: number; count: number }[] = [];
ORDER.forEach((pin, n) => PUSHES[n].forEach((p, j) => {
  const f = Math.round(p * FPB);
  pushes.push({ frame: f, beat: p, pin, level: levelOf(frames[f + 2].kp[pin]) });
  if (j === PUSHES[n].length - 1) sets.push({ frame: f, beat: p, pin, count: n + 1 });
}));
const turnEvts = turns.map((t) => ({ ...t, frame: Math.round(t.beat * FPB) }));
// bar 12: the picked plug returns (the top pins fall back), then the pick and wrench come out
const extra = [
  { frame: 49 * FPB, beat: 49, kind: "plug-back" },
  { frame: 50 * FPB, beat: 50, kind: "tools-out" },
];

// ---------------------------------------------------------------- kicks: every beat has a visible cause
const kickBeats: number[] = [];
const evtBeats = new Set<number>([...landings.map((l) => l.beat), ...turnEvts.map((t) => t.beat), ...pushes.map((p) => p.beat), ...extra.map((e) => e.beat)]);
for (let bar = 0; bar < BARS; bar++) {
  const steps = bar >= 13 && bar < 20 ? [0, 1, 2, 3] : bar >= 8 && bar < 13 ? (bar === 11 ? [0, 0.5, 1, 1.5, 2, 2.5, 3] : [0, 1, 2, 3]) : [0, 0.5, 1, 1.5, 2, 2.5, 3];
  for (const s of steps) { const b = bar * 4 + s; if (evtBeats.has(b)) kickBeats.push(b); }
}

mkdirSync("public/key-lock", { recursive: true });
writeFileSync("public/key-lock/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES,
  lock: { pins: PINS, spacing: SPACING, first: FIRST, blade: BLADE, shear: SHEAR, rest: REST, driver: DRIVER, chamberTop: CHAMBER_TOP, keyPin: KEY_PIN, tip0: TIP0, tip1: TIP1, tipH: TIP_H, flat: FLAT },
  keys: Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, { ...v, cuts: v.depths.map(cutHeight) }])),
  chords: CHORDS, chordOfBar: CHORD_NAMES, sections,
  frames, landings, pushes, sets, turns: turnEvts, extra, kicks: kickBeats,
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_NAMES.slice(s.fromBar, s.toBar).join(" ")} | ${s.what}`);
console.log(`landings ${landings.length}, pushes ${pushes.length}, sets ${sets.map((s) => `pin${s.pin + 1}@${s.beat}`).join(" ")}, turns ${turnEvts.map((t) => `${t.key}${t.ok ? "+" : "x"}@${t.beat}`).join(" ")}`);
console.log(`kicks ${kickBeats.length}; per bar: ${Array.from({ length: BARS }, (_, bar) => kickBeats.filter((b) => Math.floor(b / 4) === bar).length).join(" ")}`);
for (const t of turnEvts) {
  const fr = frames[t.frame];
  console.log(`  turn ${t.key.padEnd(4)} bar ${Math.floor(t.beat / 4)}: lined ${fr.lined.map((x) => (x ? "o" : "x")).join("")} -> ${t.ok ? "OPENS" : "blocked"}`);
  if (t.key !== "pick" && fr.lined.every(Boolean) !== t.ok) throw new Error(`turn at beat ${t.beat}: pins disagree with the outcome`);
}
