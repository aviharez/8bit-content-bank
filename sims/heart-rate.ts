// How fast can a heart beat? Kleiber-style scaling of resting heart rate in mammals:
//   heart rate (beats per minute) = 241 * M^(-1/4),  M = body mass in kg   (Stahl, J. Appl. Physiol. 1967)
// Seven mammals from the blue whale (100 t) down to the Etruscan shrew (1.8 g), the smallest mammal by mass.
//
// Clock: hard techno at 150 BPM, 30 fps = 12 frames per beat, 48 frames per bar. 24 bars = 38.4 s.
// Each animal's heart is played in real time (no warp): every predicted heartbeat is one monitor beep,
// snapped to the nearest 16th note (at most 50 ms early or late; said on screen). The hamster (7 a second) is the
// fastest heart that still fits the 16th grid (10 per second at 150 BPM).
// The shrew's heart (1,170 per minute = 19.5 beats a second) is faster than the 16th grid,
// so it is not played as beeps: it is a held note whose volume pulses at exactly 19.5 Hz (a tremolo),
// pitched 4 octaves up (x16 = 312 Hz, D#4). That is the drop.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const SPB = 60 / BPM; // seconds per beat
const FPB = SPB * FPS; // 12 frames per beat
export const BARS = 24;
const BEATS = BARS * 4;
export const TOTAL_FRAMES = BEATS * FPB; // 1152 = 38.4 s

const rate = (kg: number) => 241 * Math.pow(kg, -0.25);

type Animal = { id: string; name: string; mass: string; kg: number; fromBar: number; toBar: number; register: number };
// register: lowest MIDI note the beeps may use (smaller animal -> higher beep)
const ANIMALS: Animal[] = [
  { id: "whale", name: "BLUE WHALE", mass: "100 t", kg: 100_000, fromBar: 0, toBar: 2, register: 51 },
  { id: "elephant", name: "ELEPHANT", mass: "5 t", kg: 5_000, fromBar: 2, toBar: 4, register: 54 },
  { id: "human", name: "HUMAN", mass: "70 kg", kg: 70, fromBar: 4, toBar: 6, register: 58 },
  { id: "cat", name: "CAT", mass: "4 kg", kg: 4, fromBar: 6, toBar: 8, register: 62 },
  { id: "rabbit", name: "RABBIT", mass: "2 kg", kg: 2, fromBar: 8, toBar: 10, register: 66 },
  { id: "hamster", name: "HAMSTER", mass: "100 g", kg: 0.1, fromBar: 10, toBar: 12, register: 70 },
  { id: "shrew", name: "ETRUSCAN SHREW", mass: "1.8 g", kg: 0.0018, fromBar: 12, toBar: 20, register: 63 },
];
export const DROP_BAR = 12;
export const OUTRO_BAR = 20;

// D# minor, one chord per bar: D#m, B, G#m, A# (i - VI - iv - V, dark)
const CHORDS = [
  { name: "D#m", root: 3, tones: [3, 6, 10] },
  { name: "B", root: 11, tones: [11, 3, 6] },
  { name: "G#m", root: 8, tones: [8, 11, 3] },
  { name: "A#", root: 10, tones: [10, 2, 5] },
];
const chordAt = (beat: number) => CHORDS[Math.floor(beat / 4) % 4];
/** The k-th note of the current chord's arpeggio, starting at or above `register`. */
function arpNote(beat: number, register: number, k: number) {
  const tones = chordAt(beat).tones;
  const up: number[] = [];
  for (let m = register; up.length < 3; m++) if (tones.includes(m % 12)) up.push(m);
  return up[k % 3];
}

const animals = ANIMALS.map((a) => ({ ...a, bpm: rate(a.kg), hz: rate(a.kg) / 60 }));

// ---------------------------------------------------------------- heartbeats
type Beat = { animal: string; sec: number; beat: number; snappedBeat: number; frame: number; pitch: number | null };
const beats: Beat[] = [];
let maxSnapMs = 0;
for (const a of animals) {
  const t0 = a.fromBar * 4 * SPB, t1 = a.toBar * 4 * SPB;
  const interval = 60 / a.bpm;
  let k = 0;
  for (let t = t0; t < t1 - 1e-9; t += interval, k++) {
    const beat = t / SPB;
    const snapped = a.id === "shrew" ? beat : Math.round(beat * 4) / 4;
    if (a.id !== "shrew") maxSnapMs = Math.max(maxSnapMs, Math.abs(snapped - beat) * SPB * 1000);
    beats.push({
      animal: a.id, sec: t, beat, snappedBeat: snapped, frame: snapped * FPB,
      pitch: a.id === "shrew" ? null : arpNote(snapped, a.register, k),
    });
  }
}

// ---------------------------------------------------------------- groove: four on the floor, clap on 2 and 4
// (one beat of air before the drop)
const kicks: number[] = [], snares: number[] = [];
for (let b = 0; b < BARS; b++) {
  const t = b * 4;
  for (let q = 0; q < 4; q++) if (!(b === DROP_BAR - 1 && q === 3)) kicks.push(t + q);
  snares.push(t + 1, t + 3);
}

const sections = [
  { id: "intro", fromBar: 0, toBar: 4 },
  { id: "groove", fromBar: 4, toBar: 8 },
  { id: "build", fromBar: 8, toBar: DROP_BAR },
  { id: "drop", fromBar: DROP_BAR, toBar: OUTRO_BAR },
  { id: "outro", fromBar: OUTRO_BAR, toBar: BARS },
];

mkdirSync("public/heart-rate", { recursive: true });
writeFileSync(
  "public/heart-rate/timeline.json",
  JSON.stringify({
    fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, dropBar: DROP_BAR, outroBar: OUTRO_BAR,
    chords: CHORDS, sections, animals, beats, kicks, snares, maxSnapMs,
  }),
);

for (const a of animals) {
  const n = beats.filter((b) => b.animal === a.id).length;
  console.log(`${a.name.padEnd(15)} ${a.mass.padStart(6)}  ${a.bpm.toFixed(1).padStart(7)} /min  ${a.hz.toFixed(2).padStart(6)} Hz  ${n} beats in bars ${a.fromBar}-${a.toBar - 1}`);
}
const shrew = animals.find((a) => a.id === "shrew")!;
const x16 = shrew.hz * 16;
const midi = 69 + 12 * Math.log2(x16 / 440);
console.log(`shrew x16 = ${x16.toFixed(1)} Hz = MIDI ${midi.toFixed(2)} (D#4 = 63), tremolo period ${(SPB * shrew.hz) ** -1} beats`);
console.log(`largest snap to the 16th grid: ${maxSnapMs.toFixed(1)} ms; kicks ${kicks.length}, snares ${snares.length}`);
