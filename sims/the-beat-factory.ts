// The Beat Factory (entertainment pilot 001). A night-shift factory plays hard techno: an indexing production line
// on the 16th grid feeds crates into a reactor; at 100 % the reactor ignites on the drop. Plan:
// docs/plans/the-beat-factory.md. The mechanics are authored, not physics: every contact comes from this scheduler.
//
// Clock: 150 BPM at 30 fps = 12 frames a beat, a 16th is exactly 3 frames. 24 bars = 96 beats = 1152 frames = 38.4 s.
// The beat is the time authority; every frame is derived (frame = beat * 12) and is a whole number.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
const FPB = 12;
export const BPM = (60 * FPS) / FPB; // 150
export const BARS = 24;
const BEATS = BARS * 4; // 96
export const TOTAL_FRAMES = BEATS * FPB; // 1152
const SEED = 1; // nothing is random; kept for the common timeline shape
const HOLD_BAR = 15; // 0-based: bar 16, the held breath before the drop
const IGNITION_BAR = 16; // bar 17
const FEEDS = 60; // crates the reactor needs: bars 1-15, one a beat

// ---------------------------------------------------------------- harmony (F Aeolian: F G Ab Bb C Db Eb)
const CHORDS: Record<string, number[]> = {
  Fm: [5, 8, 0], Db: [1, 5, 8], Eb: [3, 7, 10], Cm: [0, 3, 7], Ab: [8, 0, 3], Bbm: [10, 1, 5],
};
const ROOT: Record<string, number> = { Fm: 5, Db: 1, Eb: 3, Cm: 0, Ab: 8, Bbm: 10 };
const CHORD_OF_BAR = [
  "Fm", "Db", "Eb", "Cm", // start
  "Fm", "Db", "Ab", "Eb", // sorter
  "Bbm", "Db", "Eb", "Cm", // cutter
  "Db", "Bbm", "Cm", "Eb", // build (bar 16 the hold)
  "Fm", "Db", "Eb", "Cm", // drop
  "Db", "Ab", "Eb", "Cm", // cooldown, into bar 1
];
if (CHORD_OF_BAR.length !== BARS) throw new Error("chords");
const sections = [
  { id: "start", fromBar: 0, toBar: 4, what: "factory online: press, belt, left arm (hook A); the reactor starts filling" },
  { id: "sorter", fromBar: 4, toBar: 8, what: "the sorter opens the second intake (stab + clap on 2 and 4); the right arm answers (B)" },
  { id: "cutter", fromBar: 8, toBar: 12, what: "the laser cutter switches on (hats); arms call and answer inside each bar, a lamp higher" },
  { id: "build", fromBar: 12, toBar: 16, what: "the reactor fills to 100 %; charge ring (snare roll); bar 16 every machine holds" },
  { id: "drop", fromBar: 16, toBar: 20, what: "IGNITION: lights on, MAX POWER, both arms on alternate 16ths, cutter every 16th" },
  { id: "cooldown", fromBar: 20, toBar: 24, what: "the reactor cools 75/50/25/0 %, crates dispatched off the side, back to the opening texture" },
];
const sectionOf = (bar: number) => sections.find((s) => s.fromBar <= bar && bar < s.toBar)!.id;
const place = (pc: number, floor: number) => floor + ((((pc - floor) % 12) + 12) % 12);
/** Chord tones from C4 up: lamp k of the left arm is ladder[k], of the right arm ladder[k + 2]. */
const ladder = (chord: string) => {
  const out: number[] = [];
  for (let p = 60; out.length < 7; p++) if (CHORDS[chord].includes(p % 12)) out.push(p);
  return out;
};

// ---------------------------------------------------------------- events (common shape of docs/production-workflow.md)
type MusicEvent = {
  id: string; beat: number; frame: number; entityId: string; action: string; instrument: string;
  pitch?: number; velocity: number; durationBeats: number; lamp?: number; side?: "L" | "R"; section: string;
};
const events: MusicEvent[] = [];
const counters: Record<string, number> = {};
function ev(beat: number, entityId: string, action: string, instrument: string, durationBeats: number, velocity: number,
  extra: Partial<MusicEvent> = {}) {
  const n = (counters[entityId] = (counters[entityId] ?? 0) + 1);
  const frame = beat * FPB;
  if (!Number.isInteger(Math.round(frame * 1e6) / 1e6)) throw new Error(`off-grid ${entityId} ${beat}`);
  events.push({ id: `${entityId}-${n}`, beat, frame: Math.round(frame), entityId, action, instrument, velocity, durationBeats,
    section: sectionOf(Math.floor(beat / 4)), ...extra });
}

// press (kick) and belt (bass): every beat but the hold bar
const BASS: Record<string, number[][]> = { // per section: offsets of the three 16ths after the kick (0 root, 12 octave, 7 fifth)
  start: [[0, 0, 0]], sorter: [[0, 12, 0]], cutter: [[0, 12, 0], [0, 12, 0], [0, 12, 0], [0, 7, 12]],
  build: [[12, 0, 7]], drop: [[12, 0, 12]], cooldown: [[0, 0, 0]],
};
for (let b = 0; b < BEATS; b++) {
  const bar = Math.floor(b / 4);
  if (bar === HOLD_BAR) continue;
  const chord = CHORD_OF_BAR[bar];
  ev(b, "press", bar === IGNITION_BAR && b % 4 === 0 ? "ignite-slam" : "slam", "kick", 1, b % 4 === 0 ? 1.0 : 0.95,
    { pitch: place(ROOT[chord], 36) });
  const pat = BASS[sectionOf(bar)];
  const offs = pat[(b % 4) % pat.length];
  offs.forEach((o, k) => ev(b + (k + 1) / 4, "belt", "index", "bass", 0.22, k === 0 ? 0.95 : 0.85,
    { pitch: place(ROOT[chord], 28) + o }));
}

// robot arms (hook): step:lamp lists per bar, L = call, R = answer
type Phrase = [number, number][];
const P = (s: string): Phrase => s.trim().split(/\s+/).map((x) => x.split(":").map(Number) as [number, number]);
const A = P("0:2 2:1 3:2 6:4 8:3 10:2 11:1 14:0");
const A1 = P("0:2 2:1 3:2 6:4 8:4 10:3 12:2 14:3");
const A2 = P("0:4 2:3 3:4 6:2 8:3 10:1 11:2 14:0");
const B = P("0:2 3:3 4:2 6:4 8:3 10:2 12:1 14:0");
const B1 = P("0:4 2:3 3:4 6:2 8:3 11:2 12:1 14:2");
const XL = P("0:3 2:2 3:3 6:4"), XR = P("8:3 10:4 11:3 14:2");
const XL1 = P("0:4 2:3 3:4 6:2"), XR1 = P("8:2 10:3 11:4 14:3");
const CL = P("0:0 2:2 4:1 6:3 8:2 10:4 12:3 14:2"), CR = P("1:2 3:3 5:2 7:4 9:3 11:2 13:4 15:3");
const CL1 = P("0:1 2:3 4:2 6:4 8:3 10:2 12:1 14:0"), CR1 = P("1:3 3:4 5:3 7:2 9:1 11:2 13:3 15:4");
const CL2 = P("0:4 2:3 4:4 6:2 8:3 10:1 12:2 14:0"), CR2 = P("1:4 3:2 5:3 7:4 9:2 11:3 13:1 15:0");
const HOOK: { L: Phrase; R: Phrase; name: string }[] = [
  { L: A, R: [], name: "A" }, { L: A1, R: [], name: "A'" }, { L: A, R: [], name: "A" }, { L: A2, R: [], name: "A''" },
  { L: A, R: [], name: "A" }, { L: [], R: B, name: "B" }, { L: A1, R: [], name: "A'" }, { L: [], R: B1, name: "B'" },
  { L: XL, R: XR, name: "X" }, { L: XL1, R: XR1, name: "X'" }, { L: XL, R: XR, name: "X" }, { L: XL1, R: XR1, name: "X'" },
  { L: P("0:1 2:2 4:3 6:4"), R: P("8:1 10:2 12:3 14:4"), name: "rise" },
  { L: P("0:2 2:3 4:4 6:3"), R: P("8:2 10:3 12:4 14:3"), name: "rise'" },
  { L: P("0:2 4:3 8:4 12:4"), R: P("2:2 6:3 10:4 14:4"), name: "ping-pong" },
  { L: P("0:4"), R: P("0:4"), name: "hold" },
  { L: CL, R: CR, name: "C" }, { L: CL, R: CR, name: "C" }, { L: CL1, R: CR1, name: "C'" }, { L: CL2, R: CR2, name: "C''" },
  { L: A, R: [], name: "A" }, { L: [], R: B, name: "B" }, { L: A1, R: [], name: "A'" }, { L: A2, R: [], name: "A''" },
];
if (HOOK.length !== BARS) throw new Error("hook");
for (let bar = 0; bar < BARS; bar++) {
  const lad = ladder(CHORD_OF_BAR[bar]);
  for (const side of ["L", "R"] as const) {
    const ph = HOOK[bar][side];
    ph.forEach(([step, lamp], k) => {
      const next = k + 1 < ph.length ? ph[k + 1][0] : 16;
      const hold = bar === HOLD_BAR;
      const dur = hold ? 4 : Math.min(0.5, Math.max(0.2, ((next - step) / 4) * 0.9));
      ev(bar * 4 + step / 4, side === "L" ? "armL" : "armR", hold ? "hold" : "jab", "lead", dur, step % 4 === 0 ? 0.95 : 0.85,
        { lamp, pitch: lad[lamp + (side === "R" ? 2 : 0)], side });
    });
  }
}

// cutter (hats)
for (let bar = 0; bar < BARS; bar++) {
  const steps = bar >= 8 && bar < 10 ? [2, 6, 10, 14]
    : bar >= 10 && bar < 12 ? [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]
      : (bar >= 12 && bar < 15) || (bar >= 16 && bar < 20) ? [...Array(16).keys()]
        : bar >= 20 && bar < 22 ? [2, 6, 10, 14] : [];
  for (const s of steps) ev(bar * 4 + s / 4, "cutter", "pulse", "hats", 0.08, s % 4 === 2 ? 0.85 : 0.65);
}

// sorter (stab + clap): beats 2 and 4, bars 5-15 and 17-22. The gate flips each snap; it starts on the left.
let side: "L" | "R" = "L";
for (let bar = 4; bar < 22; bar++) {
  if (bar === HOLD_BAR) continue;
  for (const beat of [1, 3]) {
    side = side === "L" ? "R" : "L";
    ev(bar * 4 + beat, "sorter", "snap", "stab", 0.3, 0.95, { side });
  }
}
if (side !== "L") throw new Error("the gate must end on the left (loop)");

// reactor charge ring (snare roll): 24 lamps, bar 15 on 8ths, bar 16 on 16ths
const ringBeats = [...Array(8).keys()].map((k) => 56 + k / 2).concat([...Array(16).keys()].map((k) => 60 + k / 4));
ringBeats.forEach((b, k) => ev(b, "ring", "light", "roll", 0.15, 0.35 + (0.6 * k) / (ringBeats.length - 1), { lamp: k }));

// reactor feeds (silent: grouped with the kick on the same beat) and power per bar
const feeds = [...Array(FEEDS).keys()]; // beats 0..59: the crate at the intake drops in, the meter ticks a 16th later
// glow level per bar (the whine follows it): filling, then max, then cooling 75/50/25/0 %
const powerAtBarStart = (bar: number) => bar < IGNITION_BAR ? Math.min(1, (bar * 4) / FEEDS) : bar < 20 ? 1 : [0.75, 0.5, 0.25, 0][bar - 20];
let prevWhine = 0;
for (let bar = 0; bar < BARS; bar++) {
  const chord = CHORD_OF_BAR[bar];
  const tones = [];
  for (let p = 74; p <= 88; p++) if (CHORDS[chord].includes(p % 12)) tones.push(p);
  // the riser: bars 13-16 climb (each at least a step above the last); elsewhere the tone nearest A-flat 5
  const pitch = bar >= 12 && bar < 16 && prevWhine ? tones.find((p) => p > prevWhine) ?? tones[tones.length - 1]
    : tones.reduce((a, p) => (Math.abs(p - 80) < Math.abs(a - 80) ? p : a));
  prevWhine = pitch;
  const glow = bar === HOLD_BAR ? 1 : bar < IGNITION_BAR ? 0.2 + 0.8 * powerAtBarStart(bar) : bar < 20 ? 1 : 0.2 + 0.8 * powerAtBarStart(bar);
  ev(bar * 4, "reactor", "glow", "whine", 4, 0.9, { pitch, lamp: Math.round(glow * 100) });
}

// ---------------------------------------------------------------- validate (docs/production-workflow.md, section 3)
events.sort((a, b) => a.beat - b.beat || a.entityId.localeCompare(b.entityId));
const ids = new Set<string>();
const ENTITIES = new Set(["press", "belt", "armL", "armR", "cutter", "sorter", "ring", "reactor"]);
for (const e of events) {
  if (ids.has(e.id)) throw new Error(`duplicate ${e.id}`);
  ids.add(e.id);
  if (!ENTITIES.has(e.entityId)) throw new Error(`entity ${e.entityId}`);
  if (e.beat < 0 || e.beat >= BEATS || e.frame !== e.beat * FPB) throw new Error(`bounds ${e.id}`);
  if (e.velocity <= 0 || e.velocity > 1 || e.durationBeats <= 0) throw new Error(`velocity/duration ${e.id}`);
  if (e.pitch !== undefined && e.instrument !== "kick" && !CHORDS[CHORD_OF_BAR[Math.floor(e.beat / 4)]].includes(e.pitch % 12)) {
    throw new Error(`${e.id} pitch ${e.pitch} not in ${CHORD_OF_BAR[Math.floor(e.beat / 4)]}`);
  }
  if (e.durationBeats > 0 && e.instrument !== "kick" && e.beat + e.durationBeats > (Math.floor(e.beat / 4) + 1) * 4 + 1e-9) {
    throw new Error(`${e.id} rings past its bar`);
  }
}
// one grid: kick only on beats, bass never on a kick
const kickBeats = new Set(events.filter((e) => e.instrument === "kick").map((e) => e.beat));
for (const e of events) if (e.instrument === "bass" && kickBeats.has(e.beat)) throw new Error("bass on a kick");
const firstBeat = events.filter((e) => e.beat === 0).map((e) => e.entityId).sort();
if (!["armL", "press", "reactor"].every((x) => firstBeat.includes(x))) throw new Error("frame 0 must be busy: press, arm and reactor");

mkdirSync("public/the-beat-factory", { recursive: true });
writeFileSync("public/the-beat-factory/timeline.json", JSON.stringify({
  version: 1, fps: FPS, bpm: BPM, framesPerBeat: FPB, beatsPerBar: 4, bars: BARS, totalFrames: TOTAL_FRAMES, seed: SEED,
  holdBar: HOLD_BAR, ignitionBar: IGNITION_BAR, feedsNeeded: FEEDS, feeds,
  power: [...Array(BARS).keys()].map(powerAtBarStart),
  chords: CHORDS, chordOfBar: CHORD_OF_BAR, hookOfBar: HOOK.map((h) => h.name), sections, events,
}, null, 0));

const count = (inst: string) => events.filter((e) => e.instrument === inst).length;
for (const s of sections) {
  console.log(`${s.id.padEnd(8)} bars ${s.fromBar + 1}-${s.toBar}: ${CHORD_OF_BAR.slice(s.fromBar, s.toBar).join(" ").padEnd(16)} hook ${HOOK.slice(s.fromBar, s.toBar).map((h) => h.name).join(" ")}`);
}
console.log(`events ${events.length}: kick ${count("kick")} bass ${count("bass")} lead ${count("lead")} hats ${count("hats")} stab ${count("stab")} roll ${count("roll")} whine ${count("whine")}`);
