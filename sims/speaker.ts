// How a speaker makes sound: a 2-way speaker lying on its back plays this video's own soundtrack.
// Plan: docs/plans/speaker.md.
//
// Clock: 150 BPM, 30 fps = 12 frames per beat, 6 per 8th, 3 per 16th. 24 bars = 96 beats = 1152 frames = 38.4 s.
// Real time throughout.
//
// This file writes the score the speaker plays (kick, bass, hook, stabs, chords, sections) and the one thing on
// screen that is simulated on its own: the sand on the big cone. The cones' motion is not simulated here: it is
// computed from the rendered track (music/speaker/compose.py writes public/speaker/cone.json), because a cone
// follows the signal it is fed.
//
// Sand: while the kick rings, the big cone shakes at E2 (82.4 Hz) with a peak speed of about 1 m/s (a 1.9 mm swing).
// A grain thrown up at v leaves for 2v/g; at v = g * T / 2 with T = one 8th (0.2 s) that is v = 0.98 m/s, so every
// grain lands on the next 8th and is thrown again while the cone still rings. Real ballistics, no time warp.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12
export const BARS = 24;
const BEATS = BARS * 4;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 1152
const SPB = 60 / BPM;

// ---------------------------------------------------------------- harmony (E Phrygian)
const CHORD_NAMES = ["Em", "Em", "F", "Em", "C", "C", "Dm", "Dm", "Am", "C", "Dm", "F", "Em", "F", "C", "Dm", "Am", "C", "Dm", "F", "Em", "F", "Em", "F"];
const CHORDS: Record<string, { root: number; tones: number[] }> = {
  Em: { root: 4, tones: [4, 7, 11] }, F: { root: 5, tones: [5, 9, 0] }, C: { root: 0, tones: [0, 4, 7] },
  Dm: { root: 2, tones: [2, 5, 9] }, Am: { root: 9, tones: [9, 0, 4] },
};
const chordOf = (bar: number) => CHORDS[CHORD_NAMES[((bar % BARS) + BARS) % BARS]];
const place = (pc: number, low: number) => low + (((pc - low) % 12) + 12) % 12;
/** k-th chord tone stacked up from the root (root at or above `low`); k may be negative. */
function stacked(ch: { root: number; tones: number[] }, low: number, k: number) {
  const r = place(ch.root, low);
  const tones = ch.tones.map((t) => place(t, r)).sort((a, b) => a - b);
  return tones[((k % 3) + 3) % 3] + 12 * Math.floor(k / 3);
}

const sections = [
  { id: "intro", fromBar: 0, toBar: 4, what: "the question: sand hops on the big cone" },
  { id: "rule", fromBar: 4, toBar: 8, what: "cutaway: coil and magnet, the coil glows with the current" },
  { id: "build", fromBar: 8, toBar: 12, what: "low vs high: both cones, the hook climbs" },
  { id: "drop", fromBar: 12, toBar: 16, what: "full mix, stabs on the small cone" },
  { id: "drop2", fromBar: 16, toBar: 20, what: "camera on the other side, new chords, code card" },
  { id: "turn", fromBar: 20, toBar: 24, what: "the kick stops, the sand settles, back to the start" },
];

// ---------------------------------------------------------------- the kick (16th steps in a bar), by section
function kickSteps(bar: number): number[] {
  const four = [0, 4, 8, 12];
  if (bar < 4) return bar === 3 ? [0, 4, 8, 10, 12, 14] : four;
  if (bar < 8) return bar === 7 ? [0, 6, 12, 14] : [0, 6, 12]; // 3+3+2 in 8ths
  if (bar < 12) return bar === 10 ? [0, 2, 4, 6, 8, 10, 12, 14] : bar === 11 ? Array.from({ length: 16 }, (_, i) => i) : four;
  if (bar < 20) return bar === 15 || bar === 19 ? [0, 4, 8, 12, 14] : four;
  if (bar === 20) return [0, 6, 12];
  if (bar === 21) return []; // the break: the cone stops, the sand settles
  return four;
}
const kicks: number[] = []; // 16th steps over the song
for (let bar = 0; bar < BARS; bar++) for (const s of kickSteps(bar)) kicks.push(bar * 16 + s);
const MAX_HOLD = 8; // swoop.py: each hit rings until the next, at most two beats
const ringing = (step: number) => { // is the kick ringing at this 16th step (strictly after its start)?
  for (let i = kicks.length - 1; i >= 0; i--) {
    if (kicks[i] > step) continue;
    const nxt = i + 1 < kicks.length ? kicks[i + 1] : kicks[0] + BEATS * 4;
    const end = kicks[i] + Math.min(nxt - kicks[i], MAX_HOLD) * 0.98;
    return step < end;
  }
  // before the first hit: the last hit of the loop rings over the seam
  const last = kicks[kicks.length - 1] - BEATS * 4;
  return step < last + Math.min(kicks[0] + BEATS * 4 - kicks[kicks.length - 1], MAX_HOLD) * 0.98;
};

// ---------------------------------------------------------------- the sand: one hop = one 8th
const G = 9.81;
const T_HOP = SPB / 2; // 0.2 s
const V0 = (G * T_HOP) / 2; // 0.981 m/s
const H_MAX = (V0 * V0) / (2 * G); // 0.049 m
type Hop = { launch: number; land: number }; // 16th steps
const hops: Hop[] = [];
{
  // the loop: start from the state at the seam (the cone rings over it, so the sand is mid-hop or launching)
  let airborneUntil = -1;
  for (let step = 0; step < BEATS * 4; step++) {
    if (step < airborneUntil) continue;
    const kickNow = kicks.includes(step);
    if (step === airborneUntil) { // a landing: thrown again if the cone still rings
      if (kickNow || ringing(step)) { hops.push({ launch: step, land: step + 2 }); airborneUntil = step + 2; }
      else airborneUntil = -1;
      continue;
    }
    if (kickNow) { hops.push({ launch: step, land: step + 2 }); airborneUntil = step + 2; } // a punch from rest
  }
}
// every landing is on an 8th (the hops never start between them)
for (const h of hops) if (h.launch % 2 !== 0) throw new Error(`hop off the 8th grid at step ${h.launch}`);
const landings = hops.map((h) => h.land).filter((s) => s < BEATS * 4 + 1);
// the seam: the loop must hop across it the same way it starts
if (!hops.some((h) => h.launch === 0)) throw new Error("the sand must be thrown at frame 0");

// ---------------------------------------------------------------- the hook (lead), phrases of (16th step, length, chord-tone k)
type Ph = [number, number, number][];
const A1: Ph = [[0, 2, 2], [2, 1, 1], [3, 2, 0], [6, 2, 1], [8, 3, 2], [11, 1, 3], [12, 2, 2], [14, 2, 1]];
const A2: Ph = [[0, 2, 0], [3, 1, 1], [4, 2, 2], [6, 2, 4], [8, 4, 3], [14, 2, 2]];
const A2b: Ph = [[0, 2, 0], [3, 1, 1], [4, 2, 2], [6, 2, 1], [8, 4, 0], [12, 2, 1], [14, 2, 0]];
const B1: Ph = [[0, 3, 4], [3, 1, 3], [4, 2, 2], [6, 2, 3], [8, 2, 2], [10, 2, 1], [12, 4, 0]];
const B2: Ph = [[0, 2, 1], [2, 2, 2], [4, 4, 1], [10, 2, 0], [12, 4, -1]];
const B2b: Ph = [[0, 2, 1], [2, 2, 2], [4, 2, 3], [6, 2, 4], [8, 4, 5], [12, 4, 4]];
const C1: Ph = [[0, 1, 3], [1, 1, 2], [2, 2, 3], [4, 1, 4], [5, 1, 3], [6, 2, 2], [8, 1, 3], [9, 1, 2], [10, 2, 1], [12, 2, 2], [14, 2, 3]];
const C2: Ph = [[0, 2, 4], [2, 1, 3], [3, 1, 2], [4, 2, 3], [6, 2, 5], [8, 4, 4], [12, 2, 3], [14, 2, 2]];
const C2b: Ph = [[0, 2, 4], [2, 1, 5], [3, 1, 4], [4, 2, 3], [6, 2, 2], [8, 4, 0], [12, 2, 1], [14, 2, 2]];
const ladder = (off: number, sixteenths = false): Ph => sixteenths
  ? Array.from({ length: 16 }, (_, i) => [i, 1, Math.min(7, off + (i >> 1))] as [number, number, number])
  : [0, 1, 2, 1, 0, 1, 2, 3].map((k, i) => [i * 2, 2, k + off] as [number, number, number]);
const HOOK: { phrase: Ph; name: string }[] = [
  { phrase: A1, name: "A" }, { phrase: A2, name: "A" }, { phrase: A1, name: "A'" }, { phrase: A2b, name: "A'" },
  { phrase: B1, name: "B" }, { phrase: B2, name: "B" }, { phrase: B1, name: "B'" }, { phrase: B2b, name: "B'" },
  { phrase: ladder(0), name: "A'' rise" }, { phrase: ladder(1), name: "A'' rise" }, { phrase: ladder(2), name: "A'' rise" }, { phrase: ladder(3, true), name: "A'' rise" },
  { phrase: C1, name: "C" }, { phrase: C2, name: "C" }, { phrase: C1, name: "C'" }, { phrase: C2b, name: "C'" },
  { phrase: C1, name: "C (new chords)" }, { phrase: C2, name: "C (new chords)" }, { phrase: C1, name: "C'" }, { phrase: C2b, name: "C'" },
  { phrase: B1, name: "answer" }, { phrase: B2, name: "answer" }, { phrase: A1, name: "A" }, { phrase: A2b, name: "A" },
];
type Note = { step: number; len: number; pitch: number; vel: number };
const lead: Note[] = [];
HOOK.forEach(({ phrase }, bar) => {
  const ch = chordOf(bar);
  for (const [s, len, k] of phrase) lead.push({ step: bar * 16 + s, len, pitch: stacked(ch, 57, k), vel: s % 4 === 0 ? 0.95 : 0.8 });
});

// ---------------------------------------------------------------- bass: a rolling line under the kick
const bass: Note[] = [];
for (let bar = 0; bar < BARS; bar++) {
  const r = place(chordOf(bar).root, 28), next = place(chordOf(bar + 1).root, 28);
  const steps: [number, number, number][] = bar === 21
    ? [[0, 8, r], [8, 4, r + 12], [12, 2, next - 2], [14, 2, next - 1]] // the break: held root, crawl into bar 22
    : [[2, 1, r], [3, 1, r + 12], [6, 1, r], [7, 1, r + 12], [10, 1, r], [11, 1, r + 12], [13, 1, r], [14, 1, next - 2], [15, 1, next - 1]];
  // on the chord change the first note lands on the downbeat with the root
  if (bar % 4 === 0 && bar !== 21) steps.unshift([0, 2, r]);
  for (const [s, len, p] of steps) bass.push({ step: bar * 16 + s, len, pitch: p, vel: s % 4 === 2 ? 1.0 : 0.85 });
}

// ---------------------------------------------------------------- mid saws: one octave dyad per sand landing
const mids: Note[] = [];
for (const s of landings) {
  const step = s % (BEATS * 4);
  const bar = Math.floor(step / 16);
  const r = place(chordOf(bar).root, 45);
  const off = step % 4 === 2; // the "and": the off-beat riff, louder
  mids.push({ step, len: 1.8, pitch: r, vel: off ? 0.95 : 0.7 }, { step, len: 1.8, pitch: r + 12, vel: off ? 0.9 : 0.65 });
}

// ---------------------------------------------------------------- stabs: chord hits in the drops, and the held chord in the break
const stabs: Note[][] = [[], [], []];
for (let bar = 12; bar < 20; bar++) {
  const ch = chordOf(bar);
  const voices = ch.tones.map((t) => place(t, 74)).sort((a, b) => a - b);
  for (const s of [6, 14]) voices.forEach((p, v) => stabs[v].push({ step: bar * 16 + s, len: 1.5, pitch: p, vel: 1.0 }));
}
{
  const ch = chordOf(21);
  ch.tones.map((t) => place(t, 74)).sort((a, b) => a - b).forEach((p, v) => stabs[v].push({ step: 21 * 16, len: 15, pitch: p, vel: 0.8 }));
}

// ---------------------------------------------------------------- write
const toFrame = (step: number) => step * 3;
const noteOut = (n: Note) => ({ beat: n.step / 4, len: n.len / 4, pitch: n.pitch, vel: n.vel, frame: toFrame(n.step) });
mkdirSync("public/speaker", { recursive: true });
writeFileSync("public/speaker/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES,
  chords: CHORDS, chordOfBar: CHORD_NAMES, sections, hook: HOOK.map((h) => h.name),
  sand: { g: G, v0: V0, hMax: H_MAX, tHop: T_HOP, hops: hops.map((h) => ({ launch: toFrame(h.launch), land: toFrame(h.land) })) },
  kicks: kicks.map((s) => ({ beat: s / 4, frame: toFrame(s) })),
  landings: landings.map((s) => ({ beat: (s % (BEATS * 4)) / 4, frame: toFrame(s % (BEATS * 4)) })),
  lead: lead.map(noteOut), bass: bass.map(noteOut), mids: mids.map(noteOut), stabs: stabs.map((v) => v.map(noteOut)),
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_NAMES.slice(s.fromBar, s.toBar).join(" ")} | hook ${[...new Set(HOOK.slice(s.fromBar, s.toBar).map((h) => h.name))].join(", ")} | ${s.what}`);
console.log(`sand: v0 ${V0.toFixed(3)} m/s, hop ${T_HOP} s, height ${(H_MAX * 100).toFixed(1)} cm; ${hops.length} hops, ${landings.length} landings`);
console.log(`kicks ${kicks.length}; per bar ${Array.from({ length: BARS }, (_, b) => kicks.filter((k) => Math.floor(k / 16) === b).length).join(" ")}`);
console.log(`landings per bar ${Array.from({ length: BARS }, (_, b) => landings.filter((k) => Math.floor((k % (BEATS * 4)) / 16) === b).length).join(" ")}`);
console.log(`notes: lead ${lead.length}, bass ${bass.length}, mids ${mids.length}, stabs ${stabs.reduce((a, v) => a + v.length, 0)}`);
