// Which note breaks this glass? A wine glass is a driven, damped oscillator: its rim has a natural frequency f0, and a
// tone at frequency f makes it move with steady-state amplitude (relative to the same push held still)
//   A(f) = 1 / | 1 - r^2 + i r / Q |,   r = f / f0
// so at its own note (r = 1) it moves Q times more; one semitone off (r = 2^(-1/12)) only ~9 times more.
// The amplitude follows the drive with the envelope time constant tau = 2Q / (2 pi f0) (slowly varying envelope).
//
// This glass: f0 = 880 Hz (A5), Q = 1,000 (an assumed value for a good crystal glass; said in the caption).
// Clock: 150 BPM, 30 fps = 12 frames per beat, 48 per bar. 24 bars = 38.4 s.
//   bars 0-11  the speaker plays the hook (A minor: Am, F, C, G). Every time the melody lands on A5 the rim swings up.
//   bars 12-15 the speaker holds A5 and gets louder (drive x1 -> x4); the rim amplitude climbs.
//   bar 16     the rim passes its breaking point exactly on the downbeat (we choose that point): the drop.
//   bars 16-21 the shards fly, in slow motion x8 (said on screen); every landing is a note (snapped to the nearest 16th).
//   bars 22-23 rewind: the shards fly back together, so the last frame is the first.
// Units in the scene: 1 unit = 10 cm.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const SPB = 60 / BPM;
const FPB = SPB * FPS; // 12
const BAR = 4 * FPB; // 48
export const BARS = 24;
const BEATS = BARS * 4;
export const TOTAL_FRAMES = BEATS * FPB; // 1152
export const HOLD_BAR = 12, DROP_BAR = 16, REWIND_BAR = 22;
const F0 = 880, Q = 1000;
const TAU = (2 * Q) / (2 * Math.PI * F0); // 0.362 s
const SLOW = 8;

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const response = (hz: number) => { const r = hz / F0; return 1 / Math.hypot(1 - r * r, r / Q); };

// ---------------------------------------------------------------- the hook (the speaker's notes), one bar per chord
const CHORDS = [
  { name: "Am", root: 9, tones: [9, 0, 4] },
  { name: "F", root: 5, tones: [5, 9, 0] },
  { name: "C", root: 0, tones: [0, 4, 7] },
  { name: "G", root: 7, tones: [7, 11, 2] },
];
// [beat in bar, MIDI, length in beats]; A5 = 81 is the glass's own note
const HOOK: Record<string, [number, number, number][]> = {
  Am: [[0, 81, 1], [1, 76, 0.5], [1.5, 81, 0.5], [2, 84, 1], [3, 83, 0.5], [3.5, 81, 0.5]],
  F: [[0, 81, 1], [1, 77, 0.5], [1.5, 81, 0.5], [2, 84, 1], [3, 81, 1]],
  C: [[0, 79, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 84, 1], [3, 88, 0.5], [3.5, 86, 0.5]],
  G: [[0, 79, 1], [1, 74, 0.5], [1.5, 79, 0.5], [2, 83, 1], [3, 86, 0.5], [3.5, 83, 0.5]],
};
type ProbeNote = { beat: number; midi: number; dur: number; drive: number };
const probe: ProbeNote[] = [];
for (let b = 0; b < HOLD_BAR; b++) for (const [o, m, d] of HOOK[CHORDS[b % 4].name]) probe.push({ beat: b * 4 + o, midi: m, dur: d, drive: 1 });
// bars 12-15: hold A5, one note per beat (re-struck, so the speaker keeps pushing), drive rising x1 -> x4
const HOLD_BEATS = (DROP_BAR - HOLD_BAR) * 4;
for (let k = 0; k < HOLD_BEATS; k++) probe.push({ beat: HOLD_BAR * 4 + k, midi: 81, dur: 1, drive: 4 ** (k / (HOLD_BEATS - 1)) });

// ---------------------------------------------------------------- rim amplitude, integrated finely
const dt = 0.0005;
const driveAt = (sec: number) => {
  const beat = sec / SPB;
  for (const p of probe) if (beat >= p.beat && beat < p.beat + p.dur) return { hz: midiHz(p.midi), drive: p.drive, midi: p.midi };
  return null;
};
const tDrop = DROP_BAR * 4 * SPB;
const amp: number[] = [];
let A = 0;
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t1 = (f + 1) / FPS;
  amp.push(A);
  for (let t = f / FPS; t < t1 - 1e-9; t += dt) {
    if (t >= tDrop) { A = 0; continue; }
    const d = driveAt(t);
    const target = d ? d.drive * response(d.hz) : 0;
    A += ((target - A) * dt) / TAU;
  }
}
const breakAmp = amp[DROP_BAR * BAR - 1]; // where it gives way: the last frame before the downbeat
const peakMelody = Math.max(...amp.slice(0, HOLD_BAR * BAR));

// ---------------------------------------------------------------- shards (seeded)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const G = 98.1; // units/s^2 (9.81 m/s^2 at 10 units per metre)
export const GLASS = { stemH: 1.0, bowlH: 1.1, bowlR: 0.42, footR: 0.38 };
/** bowl radius at height y above the bench (y from stemH to stemH + bowlH) */
const bowlR = (y: number) => { const u = (y - GLASS.stemH) / GLASS.bowlH; return GLASS.bowlR * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62 + 0.25); };
type Shard = { p0: [number, number, number]; v0: [number, number, number]; w: [number, number, number]; size: number; t1: number; t2: number; v1: [number, number, number]; rest: [number, number, number] };
const shards: Shard[] = [];
const N = 96;
for (let i = 0; i < N; i++) {
  const stem = i >= N - 6;
  const th = rnd() * Math.PI * 2;
  const y = stem ? 0.2 + rnd() * 0.8 : GLASS.stemH + 0.1 + rnd() * (GLASS.bowlH - 0.1);
  const r = stem ? 0.05 : bowlR(y);
  const p0: [number, number, number] = [Math.cos(th) * r, y, Math.sin(th) * r];
  const out = stem ? 1 + rnd() * 2 : 6 + rnd() * 10; // units/s, outward (0.6-1.6 m/s for the bowl)
  const v0: [number, number, number] = [Math.cos(th) * out, (stem ? 0 : 2 + rnd() * 8), Math.sin(th) * out];
  // first landing: y + vy t - G t^2 / 2 = 0
  const t1 = (v0[1] + Math.sqrt(v0[1] ** 2 + 2 * G * y)) / G;
  const vyLand = v0[1] - G * t1;
  const v1: [number, number, number] = [v0[0] * 0.35, -vyLand * 0.3, v0[2] * 0.35]; // bounce: restitution 0.3, friction
  const t2 = (2 * v1[1]) / G;
  const land1: [number, number, number] = [p0[0] + v0[0] * t1, 0, p0[2] + v0[2] * t1];
  const rest: [number, number, number] = [land1[0] + v1[0] * t2, 0, land1[2] + v1[2] * t2];
  shards.push({ p0, v0, w: [rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10], size: stem ? 0.12 : 0.05 + rnd() * 0.09, t1, t2, v1, rest });
}
// landings as notes: real time = drop + slow-motion time; snapped to the nearest 16th; chord tones up high (glass rain)
const landings: { shard: number; sec: number; beat: number; snappedBeat: number; pitch: number; second: boolean }[] = [];
shards.forEach((s, i) => {
  for (const [ts, second] of [[s.t1, false], [s.t1 + s.t2, true]] as const) {
    const sec = tDrop + ts * SLOW;
    const beat = sec / SPB;
    if (beat >= REWIND_BAR * 4) continue;
    const snapped = Math.round(beat * 4) / 4;
    const ch = CHORDS[Math.floor(snapped / 4) % 4];
    const pcs = ch.tones;
    const pitch = 84 + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((x) => pcs.includes(x))[i % 3] + (i % 2) * 12;
    landings.push({ shard: i, sec, beat, snappedBeat: snapped, pitch, second });
  }
});
landings.sort((a, b) => a.sec - b.sec);
const settle = Math.max(...shards.map((s) => s.t1 + s.t2));

const frames = amp.map((a, f) => {
  const d = driveAt(f / FPS + 1e-6);
  return { amp: a, midi: d && f < DROP_BAR * BAR ? d.midi : null, drive: d ? d.drive : 0 };
});

mkdirSync("public/glass-resonance", { recursive: true });
writeFileSync("public/glass-resonance/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, holdBar: HOLD_BAR, dropBar: DROP_BAR, rewindBar: REWIND_BAR,
  f0: F0, q: Q, tau: TAU, slow: SLOW, g: G, glass: GLASS, breakAmp, chords: CHORDS, probe, frames, shards, landings, settleSimSec: settle,
}));

const semitone = response(F0 * 2 ** (-1 / 12));
console.log(`tau ${TAU.toFixed(3)} s; A at f0 = ${response(F0).toFixed(0)}, one semitone below = ${semitone.toFixed(1)} (ratio ${(response(F0) / semitone).toFixed(0)}x)`);
console.log(`peak rim amplitude in the melody ${peakMelody.toFixed(0)}; at the drop ${breakAmp.toFixed(0)}`);
console.log(`shards ${N}; landings ${landings.length}; all settled after ${settle.toFixed(2)} s sim = ${(settle * SLOW).toFixed(1)} s on screen (${((settle * SLOW) / SPB / 4).toFixed(1)} bars)`);
const maxSnap = Math.max(...landings.map((l) => Math.abs(l.snappedBeat - l.beat) * SPB * 1000));
console.log(`largest landing snap ${maxSnap.toFixed(0)} ms`);
