// 8 bits count to 255: an 8-bit binary counter, n -> n + 1, from 0 to 255 and over the top back to 0.
// Plan: docs/plans/eight-bits.md.
//
// Clock: 150 BPM, 30 fps = 12 frames per beat, 3 frames per 16th. 22 bars = 88 beats = 1056 frames = 35.2 s.
// The counting speeds up in three steps so a stranger can follow it slowly first:
//   counts 0-15 one per beat (bars 0-3), 16-63 one per 8th (bars 4-9), 64-255 one per 16th (bars 10-21).
// 255 + 1 overflows on beat 88 = frame 0 of the loop. The arithmetic is exact; nothing is warped.
//
// Each count does two things you can see: the lowest light that was off switches on, and every light below it
// switches off (the carry). Those events are the score (music/eight-bits/compose.py reads them).
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12
export const BARS = 22;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 1056

/** Beat at which the counter shows n (n = 0..255); 256 = the overflow at the loop point. */
export function beatOf(n: number): number {
  if (n < 16) return n;
  if (n < 64) return 16 + (n - 16) / 2;
  return 40 + (n - 64) / 4;
}
/** Beats between counts while showing n. */
const stepOf = (n: number) => (n < 16 ? 1 : n < 64 ? 0.5 : 0.25);

// E Phrygian. The chord is the value of lights 16, 32 and 64 read as a 3-bit number.
const CHORDS = [
  { name: "Em", root: 4, tones: [4, 7, 11] },
  { name: "F", root: 5, tones: [5, 9, 0] },
  { name: "C", root: 0, tones: [0, 4, 7] },
  { name: "Dm", root: 2, tones: [2, 5, 9] },
  { name: "Am", root: 9, tones: [9, 0, 4] },
  { name: "C", root: 0, tones: [0, 4, 7] },
  { name: "Dm", root: 2, tones: [2, 5, 9] },
  { name: "F", root: 5, tones: [5, 9, 0] },
];
const chordIndex = (n: number) => (n >> 4) & 7;

type Count = {
  n: number; beat: number; frame: number; step: number;
  on: number | null; // index of the light that switches on (0 = the "1" light), null at the overflow
  off: number[]; // lights that switch off
  chord: number;
  kickLight: number; // the light that flips once per beat at this counting speed
};
const counts: Count[] = [];
for (let n = 0; n <= 256; n++) {
  const prev = (n + 255) & 255; // the value before (255 before 0, i.e. the overflow lands on n = 0 / 256)
  const cur = n & 255;
  const on: number[] = [], off: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (prev >> k) & 1, b = (cur >> k) & 1;
    if (!a && b) on.push(k);
    if (a && !b) off.push(k);
  }
  if (n === 256) continue; // same event as n = 0 (the loop)
  const beat = beatOf(n);
  counts.push({
    n, beat, frame: Math.round(beat * FPB), step: stepOf(n),
    on: on.length ? on[0] : null, off, chord: chordIndex(n),
    kickLight: n < 16 ? 0 : n < 64 ? 1 : 2,
  });
}

// kicks: every beat is a flip of the light that flips once per beat (light 1, then 2, then 4)
const kicks = Array.from({ length: BARS * 4 }, (_, b) => b);
for (const b of kicks) {
  const c = counts.find((x) => Math.abs(x.beat - b) < 1e-9)!;
  const k = c.kickLight;
  if (!(c.on === k || c.off.includes(k))) throw new Error(`kick at beat ${b} has no flip of light ${k}`);
}

const sections = [
  { id: "intro", fromBar: 0, toBar: 4, speed: "per beat" },
  { id: "rule", fromBar: 4, toBar: 10, speed: "per 8th" },
  { id: "build", fromBar: 10, toBar: 14, speed: "per 16th" },
  { id: "drop", fromBar: 14, toBar: 18, speed: "per 16th" },
  { id: "drop2", fromBar: 18, toBar: 22, speed: "per 16th" },
];

mkdirSync("public/eight-bits", { recursive: true });
writeFileSync(
  "public/eight-bits/timeline.json",
  JSON.stringify({
    fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES,
    buildBar: 10, dropBar: 14, drop2Bar: 18, chords: CHORDS, sections, counts, kicks,
  }),
);

for (const s of sections) {
  const cs = counts.filter((c) => c.beat >= s.fromBar * 4 && c.beat < s.toBar * 4);
  const chords = [...new Set(cs.map((c) => CHORDS[c.chord].name + "@" + Math.floor(c.beat / 4)))];
  console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: n ${cs[0].n}-${cs[cs.length - 1].n} (${s.speed}), chords ${chords.join(" ")}`);
}
console.log(`counts ${counts.length}, kicks ${kicks.length}, drop n=128 at frame ${counts[128].frame} (bar ${counts[128].beat / 4}), frames ${TOTAL_FRAMES}`);
