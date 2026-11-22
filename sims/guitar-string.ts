// Why does a guitar string sing? A guitar and a bass lie on a table and play this track: every sound is one string
// you can see, at that string's real pitch. Plan: docs/plans/guitar-string.md.
//
// Clock: 150 BPM, 30 fps = 12 frames per beat, 3 per 16th. 24 bars = 96 beats = 1152 frames = 38.4 s.
//
// This file writes the score (kick, bass, hook, mids, stabs, chords, sections) and puts every note on the string and
// fret that really makes its pitch: fret n raises an open string by n semitones (equal temperament, fret n at
// L (1 - 2^(-n/12)) from the nut), and a natural harmonic touched at L/n plays n times the open string. A string
// never plays two notes at once; the checks below throw if a note has no string that can play it.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12
export const BARS = 24;
const BEATS = BARS * 4;
const STEPS = BEATS * 4;
export const TOTAL_FRAMES = BARS * 4 * FPB; // 1152
const SPB = 60 / BPM;

// ---------------------------------------------------------------- the instruments (MIDI pitch of each open string)
// guitar: string 1 (high E) .. string 6 (low E); bass: string 1 (G) .. string 4 (low E)
const GTR_OPEN = [64, 59, 55, 50, 45, 40];
const BASS_OPEN = [43, 38, 33, 28];
const MAX_FRET = 20;
const LOW_E_HZ = 440 * Math.pow(2, (40 - 69) / 12); // 82.41
/** The low string's motion is shown slowed so that one swing is one beat: 82.41 swings x 0.4 s = 33.0x. */
const SLOW = LOW_E_HZ * SPB;

// ---------------------------------------------------------------- harmony (E Phrygian)
const CHORD_NAMES = ["Em", "Em", "F", "Em", "C", "C", "Dm", "Dm", "Em", "Em", "Em", "Em", "Em", "F", "C", "Dm", "Am", "C", "Dm", "F", "Em", "F", "Em", "F"];
const CHORDS: Record<string, { root: number; tones: number[] }> = {
  Em: { root: 4, tones: [4, 7, 11] }, F: { root: 5, tones: [5, 9, 0] }, C: { root: 0, tones: [0, 4, 7] },
  Dm: { root: 2, tones: [2, 5, 9] }, Am: { root: 9, tones: [9, 0, 4] },
};
const chordOf = (bar: number) => CHORDS[CHORD_NAMES[((bar % BARS) + BARS) % BARS]];
const place = (pc: number, low: number) => low + (((pc - low) % 12) + 12) % 12;
function stacked(ch: { root: number; tones: number[] }, low: number, k: number) {
  const r = place(ch.root, low);
  const tones = ch.tones.map((t) => place(t, r)).sort((a, b) => a - b);
  return tones[((k % 3) + 3) % 3] + 12 * Math.floor(k / 3);
}
const isChordTone = (p: number, bar: number) => chordOf(bar).tones.includes(((p % 12) + 12) % 12);

const sections = [
  { id: "intro", fromBar: 0, toBar: 4, what: "the question: the low string plucked on every kick" },
  { id: "rule", fromBar: 4, toBar: 8, what: "the bend bounces between the ends; frets make it shorter" },
  { id: "build", fromBar: 8, toBar: 12, what: "harmonics: string 1 in 2, 3, 4 loops" },
  { id: "drop", fromBar: 12, toBar: 16, what: "full mix: loops 1, 2, 4 above the low string, strums in the gaps" },
  { id: "drop2", fromBar: 16, toBar: 20, what: "the bass string, one octave under the low string; code card" },
  { id: "turn", fromBar: 20, toBar: 24, what: "rings of air from the sound hole; back to the start" },
];

// ---------------------------------------------------------------- the kick = the low E string plucked (16th steps in a bar)
function kickSteps(bar: number): number[] {
  const four = [0, 4, 8, 12];
  if (bar < 4) return bar === 3 ? [0, 4, 8, 10, 12, 14] : four;
  if (bar < 8) return bar === 7 ? [0, 6, 12, 14] : [0, 6, 12]; // 3+3+2 in 8ths
  if (bar < 12) return bar === 10 ? [0, 2, 4, 6, 8, 10, 12, 14] : bar === 11 ? Array.from({ length: 16 }, (_, i) => i) : four;
  if (bar < 20) return bar === 15 || bar === 19 ? [0, 4, 8, 12, 14] : four;
  if (bar === 20) return [0, 6, 12];
  if (bar === 21) return []; // the break: the low string is left to ring out
  return four;
}
const kicks: number[] = [];
for (let bar = 0; bar < BARS; bar++) for (const s of kickSteps(bar)) kicks.push(bar * 16 + s);
const MAX_HOLD = 8; // swoop.py: each hit rings until the next, at most two beats
const kickHold = kicks.map((k, i) => Math.min((i + 1 < kicks.length ? kicks[i + 1] : kicks[0] + STEPS) - k, MAX_HOLD));

// ---------------------------------------------------------------- the hook, phrases of (16th step, length, chord-tone k)
type Ph = [number, number, number][];
const A1: Ph = [[0, 2, 2], [2, 1, 1], [3, 2, 0], [6, 2, 1], [8, 3, 2], [11, 1, 3], [12, 2, 2], [14, 2, 1]];
const A2: Ph = [[0, 2, 0], [3, 1, 1], [4, 2, 2], [6, 2, 4], [8, 4, 3], [14, 2, 2]];
const A2b: Ph = [[0, 2, 0], [3, 1, 1], [4, 2, 2], [6, 2, 1], [8, 4, 0], [12, 2, 1], [14, 2, 0]];
const B1: Ph = [[0, 3, 4], [3, 1, 3], [4, 2, 2], [6, 2, 3], [8, 2, 2], [10, 2, 1], [12, 4, 0]];
const B2: Ph = [[0, 2, 1], [2, 2, 2], [4, 4, 1], [10, 2, 0], [12, 4, -1]];
const B2b: Ph = [[0, 2, 1], [2, 2, 2], [4, 2, 3], [6, 2, 4], [8, 4, 5], [12, 4, 4]];
// the drop: the hook leaves steps 6-7 and 14-15 free, and the strummed stabs answer there
const C1: Ph = [[0, 1, 3], [1, 1, 2], [2, 2, 3], [4, 2, 4], [8, 1, 3], [9, 1, 2], [10, 2, 1], [12, 2, 2]];
const C2: Ph = [[0, 2, 4], [2, 1, 3], [3, 1, 2], [4, 2, 3], [8, 2, 5], [10, 2, 4], [12, 2, 3]];
const C2b: Ph = [[0, 2, 4], [2, 1, 5], [3, 1, 4], [4, 2, 3], [8, 2, 2], [10, 2, 0], [12, 2, 1]];
// the build: natural harmonics of string 1 (open E4). n loops = n x 329.6 Hz; (16th step, length, n)
const HARM_SEMI: Record<number, number> = { 1: 0, 2: 12, 3: 19, 4: 24 };
// bars 8-9: touched at the middle (2 loops) against the open string (1); bar 10: a third (3); bar 11: a quarter (4),
// then the climb 1-2-3-4 in 16ths
const H8: Ph = [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, [2, 1, 2, 1, 2, 1, 2, 2][i]]);
const H9: Ph = [[0, 2, 2], [2, 1, 2], [3, 3, 1], [6, 2, 2], [8, 2, 2], [10, 1, 2], [11, 3, 1], [14, 2, 2]];
const H10: Ph = [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, [3, 3, 1, 3, 3, 3, 1, 3][i]]);
const H11: Ph = [[0, 2, 4], [2, 2, 4], [4, 2, 1], [6, 2, 4], ...Array.from({ length: 8 }, (_, i) => [8 + i, 1, [1, 2, 3, 4][i % 4]] as [number, number, number])];
type Hook = { phrase: Ph; name: string; harm?: boolean };
const HOOK: Hook[] = [
  { phrase: A1, name: "A" }, { phrase: A2, name: "A" }, { phrase: A1, name: "A'" }, { phrase: A2b, name: "A'" },
  { phrase: B1, name: "B" }, { phrase: B2, name: "B" }, { phrase: B1, name: "B'" }, { phrase: B2b, name: "B'" },
  { phrase: H8, name: "harmonics 2", harm: true }, { phrase: H9, name: "harmonics 2'", harm: true },
  { phrase: H10, name: "harmonics 3", harm: true }, { phrase: H11, name: "harmonics 4, climb", harm: true },
  { phrase: C1, name: "C" }, { phrase: C2, name: "C" }, { phrase: C1, name: "C'" }, { phrase: C2b, name: "C'" },
  { phrase: C1, name: "C (new chords)" }, { phrase: C2, name: "C (new chords)" }, { phrase: C1, name: "C'" }, { phrase: C2b, name: "C'" },
  { phrase: B1, name: "answer" }, { phrase: B2, name: "answer" }, { phrase: A1, name: "A" }, { phrase: A2b, name: "A" },
];

type Note = { step: number; len: number; pitch: number; vel: number; string?: number; fret?: number; harm?: number };
const lead: Note[] = [];
HOOK.forEach(({ phrase, harm }, bar) => {
  const ch = chordOf(bar);
  for (const [s, len, k] of phrase) {
    if (harm) lead.push({ step: bar * 16 + s, len, pitch: GTR_OPEN[0] + HARM_SEMI[k], vel: s % 4 === 0 ? 0.95 : 0.8, string: 1, fret: 0, harm: k });
    else lead.push({ step: bar * 16 + s, len, pitch: stacked(ch, 57, k), vel: s % 4 === 0 ? 0.95 : 0.8 });
  }
});

// ---------------------------------------------------------------- bass: a rolling line under the kick, on the bass guitar
const bass: Note[] = [];
for (let bar = 0; bar < BARS; bar++) {
  const r = place(chordOf(bar).root, 28), next = place(chordOf(bar + 1).root, 28);
  const steps: [number, number, number][] = bar === 21
    ? [[0, 8, r], [8, 4, r + 12], [12, 2, next - 2], [14, 2, next - 1]]
    : [[2, 1, r], [3, 1, r + 12], [6, 1, r], [7, 1, r + 12], [10, 1, r], [11, 1, r + 12], [13, 1, r], [14, 1, next - 2], [15, 1, next - 1]];
  if (bar % 4 === 0 && bar !== 21) steps.unshift([0, 2, r]);
  // the bass's lowest note is its open E (E1): a pickup below it is played an octave up
  for (const [s, len, p] of steps) bass.push({ step: bar * 16 + s, len, pitch: p < 28 ? p + 12 : p, vel: s % 4 === 2 ? 1.0 : 0.85 });
}

// ---------------------------------------------------------------- mid saws: an octave dyad on strings 5 and 4
const mids: Note[] = [];
for (let bar = 0; bar < BARS; bar++) {
  const r = place(chordOf(bar).root, 45);
  const sec = sections.find((s) => bar >= s.fromBar && bar < s.toBar)!.id;
  const all = sec === "build" || sec === "drop" || sec === "drop2";
  for (let s = 0; s < 16; s += 2) {
    const off = s % 4 === 2;
    if (!off && !all) continue;
    const v = off ? 0.95 : 0.7;
    mids.push({ step: bar * 16 + s, len: 1.8, pitch: r, vel: v }, { step: bar * 16 + s, len: 1.8, pitch: r + 12, vel: v * 0.95 });
  }
}

// ---------------------------------------------------------------- stabs: a strum of strings 1-3 in the hook's gaps (drops)
const stabs: Note[][] = [[], [], []];
for (let bar = 12; bar < 20; bar++) {
  const voices = chordOf(bar).tones.map((t) => place(t, 67)).sort((a, b) => a - b);
  for (const s of [6, 14]) voices.forEach((p, v) => stabs[v].push({ step: bar * 16 + s, len: 1.5, pitch: p, vel: 1.0 }));
}

// ---------------------------------------------------------------- put every note on a string
const busy: { string: number; inst: string; a: number; b: number }[] = [];
function free(inst: string, string: number, a: number, b: number) {
  return !busy.some((u) => u.inst === inst && u.string === string && a < u.b && u.a < b);
}
function assign(n: Note, inst: "gtr" | "bass", strings: number[]) {
  const open = inst === "gtr" ? GTR_OPEN : BASS_OPEN;
  for (const s of strings) {
    const fret = n.pitch - open[s - 1];
    if (fret < 0 || fret > MAX_FRET || !free(inst, s, n.step, n.step + n.len)) continue;
    n.string = s; n.fret = fret;
    busy.push({ string: s, inst, a: n.step, b: n.step + n.len });
    return;
  }
  throw new Error(`no ${inst} string for pitch ${n.pitch} at step ${n.step}`);
}
// the low E string is the kick's, for as long as each hit rings
kicks.forEach((k, i) => busy.push({ string: 6, inst: "gtr", a: k, b: k + kickHold[i] }));
for (const n of lead) if (n.harm) busy.push({ string: 1, inst: "gtr", a: n.step, b: n.step + n.len });
for (const n of lead) if (!n.harm) assign(n, "gtr", n.pitch >= 64 ? [1, 2, 3] : n.pitch >= 59 ? [2, 3] : [3]);
stabs.forEach((v, i) => v.forEach((n) => assign(n, "gtr", [[3], [2], [1]][i])));
for (let i = 0; i < mids.length; i += 2) { assign(mids[i], "gtr", [5]); assign(mids[i + 1], "gtr", [4]); }
for (const n of bass) assign(n, "bass", [4, 3, 2, 1].filter((s) => n.pitch - BASS_OPEN[s - 1] <= 12));

// ---------------------------------------------------------------- checks
for (const n of lead) {
  const bar = Math.floor(n.step / 16);
  if (!isChordTone(n.pitch, bar)) throw new Error(`hook note ${n.pitch} at bar ${bar} is not a tone of ${CHORD_NAMES[bar]}`);
}
for (const v of stabs) for (const n of v) if (!isChordTone(n.pitch, Math.floor(n.step / 16))) throw new Error(`stab off chord at ${n.step}`);
for (const n of lead) for (const v of stabs) for (const m of v) if (n.step < m.step + m.len && m.step < n.step + n.len) throw new Error(`hook and stab overlap at ${n.step}`);

// ---------------------------------------------------------------- write
const toFrame = (step: number) => step * 3;
const out = (n: Note) => ({ beat: n.step / 4, len: n.len / 4, pitch: n.pitch, vel: n.vel, frame: toFrame(n.step), string: n.string!, fret: n.fret!, ...(n.harm ? { harm: n.harm } : {}) });
mkdirSync("public/guitar-string", { recursive: true });
writeFileSync("public/guitar-string/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, slow: SLOW, lowEHz: LOW_E_HZ,
  gtrOpen: GTR_OPEN, bassOpen: BASS_OPEN,
  chords: CHORDS, chordOfBar: CHORD_NAMES, sections, hook: HOOK.map((h) => h.name),
  kicks: kicks.map((s, i) => ({ beat: s / 4, frame: toFrame(s), hold: kickHold[i] / 4 })),
  lead: lead.map(out), bass: bass.map(out), mids: mids.map(out), stabs: stabs.map((v) => v.map(out)),
}));

for (const s of sections) console.log(`${s.id.padEnd(6)} bars ${s.fromBar}-${s.toBar - 1}: ${CHORD_NAMES.slice(s.fromBar, s.toBar).join(" ")} | hook ${[...new Set(HOOK.slice(s.fromBar, s.toBar).map((h) => h.name))].join(", ")} | ${s.what}`);
console.log(`low E ${LOW_E_HZ.toFixed(2)} Hz, shown slowed ${SLOW.toFixed(2)}x (one swing a beat)`);
console.log(`kicks ${kicks.length}; per bar ${Array.from({ length: BARS }, (_, b) => kicks.filter((k) => Math.floor(k / 16) === b).length).join(" ")}`);
console.log(`notes: lead ${lead.length} (harmonics ${lead.filter((n) => n.harm).length}), bass ${bass.length}, mids ${mids.length}, stabs ${stabs.reduce((a, v) => a + v.length, 0)}`);
const frets = (ns: Note[]) => `${Math.min(...ns.map((n) => n.fret!))}-${Math.max(...ns.map((n) => n.fret!))}`;
console.log(`frets: lead ${frets(lead.filter((n) => !n.harm))}, stabs ${stabs.map(frets).join("/")}, mids ${frets(mids)}, bass ${frets(bass)}`);
