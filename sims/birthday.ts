// How many people till two share a birthday? Guests walk into a party one by one; each lights their birthday on a
// 365-day calendar wall. Plan: docs/plans/birthday.md.
//
// Clock: 163.64 BPM, 30 fps = 11 frames per beat (a 16th is 2.75 frames: the picture rounds, the audio is exact).
// 24 bars = 96 beats = 1056 frames = 35.2 s.
//
// Maths (exact): chance that n guests all have different birthdays = 365/365 * 364/365 * ... * (366-n)/365; a match is
// 1 minus that (23 guests: 50.7%). 365 equally likely days, no 29 February. Pairs = n(n-1)/2 (23 guests: 253).
// The party is one real random draw (mulberry32, seeded). The seed is the first one whose first match comes at guest
// 23, the median (P(match by 22) = 47.6% < 50% <= P(match by 23) = 50.7%). Every later match is what that draw gives.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
const FPB = 11;
export const BPM = (60 * FPS) / FPB; // 163.64
export const BARS = 24;
const BEATS = BARS * 4; // 96
export const TOTAL_FRAMES = BEATS * FPB; // 1056
const GUESTS = 70;
const FIRST_MATCH = 23;

// ---------------------------------------------------------------- the draw
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draw(seed: number) {
  const r = mulberry32(seed);
  return Array.from({ length: GUESTS }, () => Math.floor(r() * 365));
}
const firstMatch = (days: number[]) => days.findIndex((d, i) => days.indexOf(d) < i) + 1; // 1-based guest, 0 = none
let seed = 1;
// also ask for a second match inside the first drop (guests 24-38), so the drop keeps finding them
for (; ; seed++) {
  const d = draw(seed);
  if (firstMatch(d) !== FIRST_MATCH) continue;
  const later = d.slice(23, 38).some((x, i) => d.slice(0, 23 + i).includes(x));
  if (later) break;
}
const days = draw(seed);

// day of year -> month and day of month (365-day year)
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function md(day: number) { let m = 0; while (day >= MONTH_LEN[m]) { day -= MONTH_LEN[m]; m++; } return { month: m, dom: day }; }

// ---------------------------------------------------------------- chance and pairs
const chance = [0]; // chance[n] = P(at least one match among n guests)
{ let p = 1; for (let n = 1; n <= GUESTS; n++) { p *= (366 - n) / 365; chance.push(1 - p); } }
if (Math.abs(chance[23] - 0.507) > 0.001) throw new Error("chance(23)");

// ---------------------------------------------------------------- when each guest comes in (beats)
// bars 0-11: guest n opens the door on beat 2n+1, their tile lands on beat 2n+2 (guest 1: 3/4 ... guest 23: 47/48)
// bars 12-15: one a beat (tile on the beat, door the 8th before): guests 24-38 on beats 49-63
// bars 16-19: two a beat, on the 8ths: guests 39-70 on beats 64, 64.5, ... 79.5
const tileBeat = (n: number) => (n <= 23 ? 2 * n + 2 : n <= 38 ? n + 25 : 64 + (n - 39) / 2);
const doorBeat = (n: number) => (n <= 23 ? 2 * n + 1 : tileBeat(n) - 0.5);
if (tileBeat(23) !== 48 || tileBeat(38) !== 63 || tileBeat(70) !== 79.5) throw new Error("schedule");

type Guest = { n: number; day: number; month: number; dom: number; door: number; tile: number; leave: number; match: number | null };
const guests: Guest[] = days.map((day, i) => {
  const n = i + 1;
  const prev = days.slice(0, i).indexOf(day);
  return { n, day, ...md(day), door: doorBeat(n), tile: tileBeat(n), leave: 0, match: prev >= 0 ? prev + 1 : null };
});
// the turn: everyone leaves through the door, latest first, on 16ths from beat 81 to 92.75 (48 slots for 70 guests)
{
  const order = [...guests].reverse();
  order.forEach((g, k) => { g.leave = 81 + Math.floor((k * 48) / GUESTS) / 4; });
}

// ---------------------------------------------------------------- pair lines (the hook): the new tile checked against the lit ones
// after each tile, lines flash from it to every lit tile, spread over the 16ths before the next tile, in this order
// of slots (so a few lines fall on the 8ths first and the rhythm fills in as the room fills)
type Line = { beat: number; guest: number; slot: number; to: number[] };
const lines: Line[] = [];
for (const g of guests) {
  const earlier = guests.filter((h) => h.n < g.n).map((h) => h.n);
  if (!earlier.length) continue;
  const slots = g.n <= 23 ? [2, 4, 6, 3, 7, 1, 5] : g.n <= 38 ? [2, 1, 3] : [1];
  const used = slots.slice(0, Math.min(slots.length, earlier.length)).sort((a, b) => a - b);
  used.forEach((s, k) => {
    const to = earlier.filter((_, j) => j % used.length === k);
    lines.push({ beat: g.tile + s / 4, guest: g.n, slot: s, to });
  });
}

// ---------------------------------------------------------------- the rest of the grid
// month panels: light one per 16th at the start (beats 0-2.75), go dark one per 16th at the end (beats 93-95.75)
const panelsOn = MONTH.map((_, m) => m / 4);
const panelsOff = MONTH.map((_, m) => 93 + (11 - m) / 4);
// kick: every beat something lands: a panel group (0-2), the door (odd beats to 47), a tile (to 79), the door as
// guests leave (81-92), a panel group going dark (93-95). Beat 80 is the break: everyone's in, nothing moves.
const kicks: { beat: number; kind: string }[] = [];
for (let b = 0; b < BEATS; b++) {
  if (b === 80) continue;
  const kind = b < 3 ? "panels" : b < 48 ? (b % 2 ? "door" : "tile") : b < 80 ? "tile" : b < 93 ? "leave" : "panels";
  kicks.push({ beat: b, kind });
}
// party lights over the wall blink on the off-beat 8ths (the off-beat bass), dark in the break bar 20
const blinks: number[] = [];
for (let b = 0; b < BEATS; b++) if (Math.floor(b / 4) !== 20) blinks.push(b + 0.5);
// footsteps: a guest walks from the door to their place in 4 16ths after the door opens (hats on those 16ths)
const steps = new Set<number>();
for (const g of guests) for (let k = 1; k <= 3; k++) steps.add(g.door + k / 4);
for (const g of guests) steps.add(g.leave);
const footsteps = [...steps].filter((b) => b < BEATS).sort((a, c) => a - c);
// the chance meter fills in 16th steps in the build (bars 10-11): the snare roll
const roll: number[] = [];
for (let s = 40 * 4; s < 48 * 4; s++) roll.push(s / 4);
const matches = guests.filter((g) => g.match !== null).map((g) => ({ beat: g.tile, guest: g.n, with: g.match!, day: g.day }));
if (matches[0].beat !== 48) throw new Error("first match");

// ---------------------------------------------------------------- chords (G Aeolian)
const CHORDS: Record<string, number[]> = { Gm: [7, 10, 2], Eb: [3, 7, 10], Bb: [10, 2, 5], F: [5, 9, 0], Cm: [0, 3, 7], D: [2, 6, 9] };
const CHORD_OF_BAR = [
  "Gm", "Gm", "Eb", "Eb", // intro
  "Gm", "Gm", "Bb", "F", // rule
  "Cm", "Cm", "D", "D", // build
  "Gm", "Eb", "Bb", "F", // drop 1
  "Gm", "Eb", "Cm", "D", // drop 2
  "Eb", "Eb", "Gm", "Gm", // turn
];
const sections = [
  { id: "intro", fromBar: 0, toBar: 4, what: "the calendar lights up, guests 1-6 come in; few pairs, hook A sparse" },
  { id: "rule", fromBar: 4, toBar: 8, what: "guests 7-14, every new guest checked against everyone: hook A (call) and B (answer) in full" },
  { id: "build", fromBar: 8, toBar: 12, what: "guests 15-22, chance 25% -> 48%; hook B' up a register; the meter's snare roll in bars 10-11" },
  { id: "drop1", fromBar: 12, toBar: 16, what: "guest 23 lands on a lit day: MATCH; one guest a beat (24-38); hook C" },
  { id: "drop2", fromBar: 16, toBar: 20, what: "two guests a beat (39-70), the matches pile up, chance past 99%; hook C' up an octave" },
  { id: "turn", fromBar: 20, toBar: 24, what: "bar 20 the break; everyone leaves, tiles go dark (hook A'' falling); the panels go dark into bar 0" },
];

// ---------------------------------------------------------------- per frame: the HUD
const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const b = f / FPB;
  const inRoom = guests.filter((g) => g.tile <= b + 1e-9 && (b < 80 || g.leave > b)).length;
  // the count shown is the guests whose tile has landed (ever, until they leave)
  const counted = b < 80 ? guests.filter((g) => g.tile <= b + 1e-9).length : inRoom;
  // the meter: in the build it fills toward the next guest's value in 16th steps (the roll); otherwise it jumps with each tile
  let p = chance[counted];
  if (b >= 40 && b < 48) {
    const next = guests.find((g) => g.tile > b)!;
    const last = next.tile - 2;
    const sixteenths = Math.floor((b - last) * 4);
    p = chance[next.n - 1] + ((chance[next.n] - chance[next.n - 1]) * Math.max(0, sixteenths - 3)) / 5;
  }
  return { guests: counted, chance: Math.round(p * 1000) / 10 };
});

mkdirSync("public/birthday", { recursive: true });
writeFileSync("public/birthday/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, seed,
  months: MONTH, monthLen: MONTH_LEN, chance: chance.map((x) => Math.round(x * 10000) / 10000),
  guests, lines, matches, panelsOn, panelsOff, kicks, blinks, footsteps, roll,
  chords: CHORDS, chordOfBar: CHORD_OF_BAR, sections, frames,
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_OF_BAR.slice(s.fromBar, s.toBar).join(" ")} | ${s.what}`);
console.log(`seed ${seed}; matches at guests ${matches.map((m) => `${m.guest} (with ${m.with}, ${MONTH[md(m.day).month]} ${md(m.day).dom + 1}, beat ${m.beat})`).join(", ")}`);
console.log(`chance: 10 ${(chance[10] * 100).toFixed(1)}%, 23 ${(chance[23] * 100).toFixed(1)}%, 38 ${(chance[38] * 100).toFixed(1)}%, 70 ${(chance[70] * 100).toFixed(1)}%; lines ${lines.length}`);
