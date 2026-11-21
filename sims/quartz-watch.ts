// A quartz watch's divider chain: a 32,768 Hz crystal and 15 divide-by-2 stages down to 1 Hz.
// Stage k outputs a square wave of 32768 / 2^k Hz. Nothing here is time-warped: the video runs
// in real time, so every rhythm you hear in the second half is a real stage output.
// Output: public/quartz-watch/timeline.json (per-frame schedule + audio events in seconds).
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
const FPB = (60 / BPM) * FPS; // 15 frames per beat
const BAR = FPB * 4; // 60
export const BARS = 18;
export const TOTAL_FRAMES = BARS * BAR; // 1080 = 36 s
const XTAL = 32768;

export const freq = (k: number) => XTAL / 2 ** k;

// Which stage the camera is looking at, frame ranges [start, end)
type Slot = { k: number; start: number; end: number };
const slots: Slot[] = [];
slots.push({ k: 0, start: 2 * BAR, end: 3 * BAR }); // the crystal
slots.push({ k: 1, start: 3 * BAR, end: 4 * BAR });
for (let k = 2; k <= 9; k++) slots.push({ k, start: 4 * BAR + (k - 2) * 2 * FPB, end: 4 * BAR + (k - 1) * 2 * FPB }); // half a bar each
slots.push({ k: 10, start: 8 * BAR, end: 9 * BAR });
for (let k = 11; k <= 14; k++) slots.push({ k, start: (k - 2) * BAR, end: (k - 1) * BAR }); // bars 9-12
slots.push({ k: 15, start: 13 * BAR, end: 17 * BAR }); // the tick: bars 13-16

const stageAt = (f: number) => slots.find((s) => f >= s.start && f < s.end)?.k ?? -1; // -1 = watch (intro/outro)

// The second hand starts at 24 s so that after 36 s it is back at 12 o'clock: a seamless loop.
const SECOND_OFFSET = 24;

const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => ({
  stage: stageAt(f),
  seconds: SECOND_OFFSET + Math.floor(f / FPS), // the watch's displayed second
}));

// Rising edges of the slow stages (k = 11..15): these become the drums, at their real rates.
const DUR = TOTAL_FRAMES / FPS;
const edges: { sec: number; k: number; hz: number }[] = [];
for (let k = 11; k <= 15; k++) {
  const hz = freq(k);
  for (let m = 0; m * (1 / hz) < DUR - 1e-9; m++) edges.push({ sec: m / hz, k, hz });
}
edges.sort((a, b) => a.sec - b.sec || a.k - b.k);

mkdirSync("public/quartz-watch", { recursive: true });
writeFileSync(
  "public/quartz-watch/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, crystalHz: XTAL, secondOffset: SECOND_OFFSET, slots, frames, edges }),
);
console.log(`slots ${slots.length}, edges ${edges.length}, ${DUR} s`);
for (const s of slots) console.log(`stage ${String(s.k).padStart(2)}  ${String(freq(s.k)).padStart(6)} Hz  frames ${s.start}-${s.end}`);
