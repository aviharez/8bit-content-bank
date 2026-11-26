// Red vs Blue: Beat Race (entertainment pilot 002). Two marbles race down mirrored zigzag lanes in an arcade cabinet;
// every contact a marble makes is a note of its melody. Plan: docs/plans/beat-race.md. The race is scripted, not
// simulated: who leads, the comeback and the finish (Blue by two beats) are authored here and fixed before the audio.
//
// Clock: 128.57 BPM at 30 fps = 14 frames a beat, an 8th is 7 frames. A 16th is 3.5 frames: the audio sits on the
// exact, even 16th grid and the picture draws each event on the frame at or just before it (frame = floor(beat * 14)).
// 24 bars = 96 beats = 1344 frames = 44.8 s.
//
// How a marble moves (the scene draws exactly this):
// - roll k [t0, t1]: along ramp k from its high end (u = 0) to its low end (u = 1), constant speed. Every note in
//   between is a pin on the ramp at the marble's u; the last note (t1) is the bumper at the low end.
// - fall k [t1, t1 + 1 beat]: straight down onto the high end of ramp k + 1 (k = 15: into the marble's bucket).
//   Landings sit on 8ths, where the kick (beats) or the bass (off-beats) already sounds.
// - obstacles (the same in both lanes, so the race stays fair; they are what changes the lead):
//   - gates at the low end of ramps 5 and 12: a marble that reaches a closed gate bumps it (its last note) and waits;
//     both gates swing open together on a beat (a snare), so the early marble loses its lead. The start gate too.
//   - peg fields on levels 10 and 11 (Red's comeback): no ramp, a staircase of pegs; the marble bounces peg to peg,
//     every peg a note, so its 16th runs are bounces you can count.
//   - bounce pads (the 5 checkpoints) on the high end of levels 2, 4, 7, 9 and 12: a marble falling onto one lands on
//     the pad (a chord stab and a clap), hops for half a beat and rolls on. The pad lights in that team's colour.
// - finish: the bumper of ramp 15 is the finish post. Then the marbles bounce in their buckets (every landing a note),
//   the buckets ride the lift back up (bars 21-23) and tip the marbles onto the start gate for the loop.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
const FPB = 14;
export const BPM = (60 * FPS) / FPB; // 128.571...
export const BARS = 24;
const BEATS = BARS * 4; // 96
export const TOTAL_FRAMES = BEATS * FPB; // 1344
const SEED = 2; // nothing random in the race; the confetti pattern in the scene uses it
const LAST_RAMP = 15; // ramps 0-15; 15 is the final straight
const PAD_RAMPS = [2, 4, 7, 9, 12]; // the checkpoints: a bounce pad on the high end of these levels
const PAD_HOP = 0.5; // beats in the air after a pad
const GATES: Record<number, number> = { 5: 23, 12: 51 }; // ramp -> the beat both gates on its low end swing open
const PEG_RAMPS = [10, 11];
const HOLD_BAR = 15; // bar 16: no kick, no bass; both marbles hold a note on the final straight
const FINISH_BAR = 16; // bar 17: the drop
const LIFT = { up0: 80, up1: 91 }; // buckets ride up (bars 21-23)
// a 16th is 3.5 frames: its frame rounds DOWN, so the picture shows a hit at most half a frame before its sound (on the
// exact, even beat grid), never after it
const frameOf = (beat: number) => Math.floor(beat * FPB + 1e-6);

// ---------------------------------------------------------------- harmony (A Phrygian: A Bb C D E F G), 2 bars a chord
const CHORDS: Record<string, number[]> = { Am: [9, 0, 4], Bb: [10, 2, 5], Gm: [7, 10, 2], Dm: [2, 5, 9] };
const CHORD_OF_BAR = [
  "Am", "Am", "Bb", "Bb", // start
  "Am", "Am", "Gm", "Gm", // checkpoints, Blue takes the lead
  "Dm", "Dm", "Bb", "Bb", // Blue ahead, Red comes back
  "Gm", "Gm", "Bb", "Bb", // neck and neck, bar 16 the hold
  "Am", "Am", "Bb", "Bb", // finish: Blue wins
  "Dm", "Dm", "Bb", "Bb", // the lift, back to the start gate (Bb -> Am across the loop)
];
if (CHORD_OF_BAR.length !== BARS) throw new Error("chords");
const sections = [
  { id: "start", fromBar: 0, toBar: 4, what: "the gate drops; Red calls, Blue answers; Red rolls out ahead" },
  { id: "checkpoints", fromBar: 4, toBar: 8, what: "checkpoints 1-2 (stab + clap); Blue overtakes in bar 7 and starts calling" },
  { id: "swap", fromBar: 8, toBar: 12, what: "Blue ahead (CP3); Red's comeback in bar 11, 16th runs, Red first at CP4" },
  { id: "neck", fromBar: 12, toBar: 16, what: "rolling bass; Blue first at CP5; neck and neck, snare roll fills the finish banner; bar 16 holds" },
  { id: "finish", fromBar: 16, toBar: 20, what: "BLUE WINS on the drop: confetti, Blue's hook bouncing in its bucket, Red answers on beat 3" },
  { id: "lift", fromBar: 20, toBar: 24, what: "the buckets ride the lift up, call and answer as at the start, both tipped onto the start gate" },
];
const sectionOf = (bar: number) => sections.find((s) => s.fromBar <= bar && bar < s.toBar)!.id;
const place = (pc: number, floor: number) => floor + ((((pc - floor) % 12) + 12) % 12);
const ladder = (chord: string, lo: number, hi: number) => {
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) if (CHORDS[chord].includes(p % 12)) out.push(p);
  return out;
};
const LADDER: Record<"R" | "B", [number, number]> = { R: [57, 76], B: [69, 88] }; // Red: clipped-sine lead A3-E5; Blue: an octave up, A4-E6

// ---------------------------------------------------------------- the hook: per bar, each marble's notes (beat in bar : step)
type Side = "R" | "B";
const P = (s: string) => (s.trim() ? s.trim().split(/\s+/).map((x) => x.split(":").map(Number) as [number, number]) : []);
// leader calls in beats 0-1.5, the other answers in 2-3.5. Leader: R bars 1-6, B 7-10, R 11-13, B 14.
const HOOK: { R: string; B: string; name: string }[] = [
  { R: "0:0 .5:1 1:2 1.5:1", B: "2:2 2.5:1 3:0 3.5:1", name: "A" },
  { R: "0:0 .5:1 1:2 1.5:3", B: "2:3 2.5:2 3:1 3.5:0", name: "A'" },
  { R: "0:3 .5:2 1:1 1.5:2", B: "2:1 2.5:2 3:3 3.5:2", name: "B" },
  { R: "0:0 .5:1 1:2 1.5:4", B: "2:3 2.5:2 3:0", name: "A''" },
  { R: "0:0 .5:1 .75:2 1:1 1.5:3", B: "2:3 2.5:2 3:1 3.25:2 3.5:0", name: "C" },
  { R: "0:1 .5:2 .75:3 1:2 1.5:4", B: "2:4 2.5:3 3:2", name: "C'" },
  { B: "0:2 .5:3 .75:4 1:3 1.5:2", R: "2:2 2.5:1 3:0 3.5:1", name: "D (Blue calls)" },
  { B: "0:4 .5:3 .75:2 1:1 1.5:0", R: "2:1 2.5:2 3:0", name: "D'" },
  { B: "0:0 .5:2 1:1 1.5:3", R: "2:2 2.5:3 3:1 3.5:2", name: "E" },
  { B: "0:3 .5:2 .75:3 1:4 1.5:3", R: "2:1 2.5:2 3:3", name: "E'" },
  { R: "0:0 .25:1 .5:2 .75:3 1:4 1.5:3", B: "2:2 2.5:1 3:2 3.5:0", name: "F (Red's run)" },
  { R: "0:4 .25:3 .5:2 .75:1 1:2 1.5:0", B: "2:1 2.5:2 3:3 3.5:4", name: "F'" },
  { R: "0:0 .5:1 1:2 1.5:3", B: "2:2 2.5:3 3:4", name: "G" },
  { B: "0:4 .5:3 .75:4 1:3 1.5:2", R: "2:1 2.5:2 3:3 3.5:4", name: "G'" },
  { B: "0:0 1:1 2:2 3:3", R: ".5:0 1.5:1 2.5:2", name: "ping-pong" },
  { R: "", B: "", name: "hold" }, // bar 16: the holds are written below (they start on each marble's landing)
  { B: "0:3 1:2 1.5:3 2.5:4", R: "2:0 3:1 3.5:0", name: "W (Blue wins)" },
  { B: "0:3 .5:4 .75:3 1:2 1.5:3 2:4 2.5:5", R: "3:0 3.5:1", name: "W'" },
  { B: "0:2 .5:3 .75:4 1:3 1.5:2 2:3 2.5:4", R: "3:1 3.5:0", name: "W''" },
  { B: "0:4 .5:3 .75:2 1:1 1.5:2 2:1 2.5:0", R: "3:0 3.5:2", name: "W'''" },
  { R: "0:0 .5:1 1:2 1.5:1", B: "2:2 2.5:1 3:0 3.5:1", name: "A" },
  { R: "0:0 .5:1 1:2 1.5:3", B: "2:3 2.5:2 3:1 3.5:0", name: "A'" },
  { R: "0:3 .5:2 1:1 1.5:2", B: "2:1 2.5:2 3:3 3.5:2", name: "B" },
  { R: "0:0 .5:1 1:2 1.5:1", B: "2:2 2.5:1 3:0 3.5:1", name: "A" },
];
if (HOOK.length !== BARS) throw new Error("hook");
const HOLD_STEP = { R: 4, B: 3 }; // top of each marble's Bb ladder: D5 and Bb5

type Note = { beat: number; step: number; pitch: number };
const notes: Record<Side, Note[]> = { R: [], B: [] };
for (let bar = 0; bar < BARS; bar++) {
  for (const side of ["R", "B"] as const) {
    const lad = ladder(CHORD_OF_BAR[bar], ...LADDER[side]);
    for (const [b, step] of P(HOOK[bar][side])) {
      if (step >= lad.length) throw new Error(`step ${step} bar ${bar + 1} ${side}`);
      notes[side].push({ beat: bar * 4 + b, step, pitch: lad[step] });
    }
  }
}

// ---------------------------------------------------------------- the race: ramps 0-14 = bars 1-15, ramp 15 = bar 16
type Seg =
  | { kind: "roll"; k: number; t0: number; t1: number }
  | { kind: "fall"; k: number; t0: number; t1: number }
  | { kind: "held"; k: number; t0: number; t1: number }
  | { kind: "bucket"; t0: number; t1: number; landings: number[] }
  | { kind: "tip"; t0: number; t1: number }
  | { kind: "wait"; t0: number; t1: number };
const segs: Record<Side, Seg[]> = { R: [], B: [] };
type Hit = { beat: number; side: Side; action: string; step: number; pitch: number; ramp?: number; u?: number; dur: number };
const hits: Hit[] = [];
const holdStart: Record<Side, number> = { R: 0, B: 0 };
const finishAt: Record<Side, number> = { R: 0, B: 0 };
const cpCross: { ramp: number; side: Side; beat: number }[] = []; // a marble landing on a pad

for (const side of ["R", "B"] as const) {
  let land = 0; // both start on the gate at the high end of ramp 0
  for (let k = 0; k <= LAST_RAMP; k++) {
    let onRamp: Note[];
    if (k < LAST_RAMP) {
      onRamp = notes[side].filter((n) => Math.floor(n.beat / 4) === k);
      if (!onRamp.length) throw new Error(`no notes on ramp ${k} ${side}`);
    } else {
      // the final straight: the hold starts on landing; the finish post is the first note of the finish bar
      const lad = ladder(CHORD_OF_BAR[HOLD_BAR], ...LADDER[side]);
      holdStart[side] = land;
      const fin = notes[side].find((n) => n.beat >= FINISH_BAR * 4)!;
      onRamp = [{ beat: land, step: HOLD_STEP[side], pitch: lad[HOLD_STEP[side]] }, fin];
    }
    if (onRamp[0].beat < land - 1e-9) throw new Error(`${side} ramp ${k}: note at ${onRamp[0].beat} before landing at ${land}`);
    if (PAD_RAMPS.includes(k)) {
      if (onRamp[0].beat < land + PAD_HOP - 1e-9) throw new Error(`${side} pad ${k}: a note at ${onRamp[0].beat} while hopping from ${land}`);
      cpCross.push({ ramp: k, side, beat: land });
    }
    const t1 = onRamp[onRamp.length - 1].beat;
    segs[side].push({ kind: "roll", k, t0: land, t1 });
    onRamp.forEach((n, j) => {
      const last = j === onRamp.length - 1;
      const action = k === LAST_RAMP ? (last ? "finish" : "hold") : last ? (GATES[k] !== undefined ? "gate-bump" : "bumper")
        : PEG_RAMPS.includes(k) ? "peg" : "pin";
      hits.push({ beat: n.beat, side, action, step: n.step, pitch: n.pitch, ramp: k, u: (n.beat - land) / (t1 - land), dur: 0 });
    });
    let go = t1;
    if (GATES[k] !== undefined) {
      go = GATES[k];
      if (go < t1) throw new Error(`${side} reaches gate ${k} at ${t1}, after it opened at ${go}`);
      if (go > t1) segs[side].push({ kind: "held", k, t0: t1, t1: go });
    }
    segs[side].push({ kind: "fall", k, t0: go, t1: go + 1 });
    if (k === LAST_RAMP) finishAt[side] = t1;
    land = go + 1;
  }
  // in the bucket: every landing is a note, from the fall's landing to the last bounce before the tip
  const after = notes[side].filter((n) => n.beat > finishAt[side]);
  const gateNote = after[after.length - 1]; // the last note of the loop is the marble landing back on the start gate
  const inBucket = after.slice(0, -1);
  if (inBucket[0].beat !== land) throw new Error(`${side}: first bucket note must be the landing at ${land}`);
  const tip0 = inBucket[inBucket.length - 1].beat;
  const tip1 = gateNote.beat;
  segs[side].push({ kind: "bucket", t0: land, t1: tip0, landings: inBucket.map((n) => n.beat) });
  segs[side].push({ kind: "tip", t0: tip0, t1: tip1 });
  segs[side].push({ kind: "wait", t0: tip1, t1: BEATS });
  inBucket.forEach((n) => hits.push({ beat: n.beat, side, action: "bounce", step: n.step, pitch: n.pitch, dur: 0 }));
  hits.push({ beat: gateNote.beat, side, action: "gate", step: gateNote.step, pitch: gateNote.pitch, dur: 0 });
  if (tip0 < LIFT.up1) throw new Error(`${side} tipped before the bucket reached the top`);
}
if (!(finishAt.B < finishAt.R)) throw new Error("the script says Blue wins");
if (finishAt.B !== FINISH_BAR * 4) throw new Error("Blue must cross on the drop");
// every pitched note was placed exactly once
for (const side of ["R", "B"] as const) {
  const placed = hits.filter((h) => h.side === side && h.action !== "hold").length;
  if (placed !== notes[side].length) throw new Error(`${side}: ${placed} hits for ${notes[side].length} notes`);
}

// note lengths: to the marble's next note (at most an 8th and a bit), the holds to the end of their chord
hits.sort((a, b) => a.beat - b.beat);
for (const side of ["R", "B"] as const) {
  const mine = hits.filter((h) => h.side === side);
  mine.forEach((h, j) => {
    const nxt = j + 1 < mine.length ? mine[j + 1].beat : BEATS;
    h.dur = h.action === "hold" ? 63.9 - h.beat : Math.max(0.15, Math.min(0.45, (nxt - h.beat) * 0.85));
  });
}

// ---------------------------------------------------------------- events (common shape of docs/production-workflow.md)
type MusicEvent = {
  id: string; beat: number; frame: number; entityId: string; action: string; instrument: string; pitch?: number;
  velocity: number; durationBeats: number; section: string; step?: number; ramp?: number; u?: number; side?: Side; lamp?: number;
};
const events: MusicEvent[] = [];
const counters: Record<string, number> = {};
function ev(beat: number, entityId: string, action: string, instrument: string, durationBeats: number, velocity: number,
  extra: Partial<MusicEvent> = {}) {
  const n = (counters[entityId + instrument] = (counters[entityId + instrument] ?? 0) + 1);
  if (Math.abs(beat * 4 - Math.round(beat * 4)) > 1e-9) throw new Error(`off the 16th grid ${entityId} ${beat}`);
  events.push({ id: `${entityId}-${instrument}-${n}`, beat, frame: frameOf(beat), entityId, action, instrument, velocity,
    durationBeats, section: sectionOf(Math.floor(beat / 4)), ...extra });
}

// marbles (hook): Red = lead, Blue = stab patch
for (const h of hits) {
  ev(h.beat, h.side === "R" ? "red" : "blue", h.action, h.side === "R" ? "red" : "blue", h.dur,
    h.beat % 1 === 0 ? 0.95 : 0.85, { pitch: h.pitch, step: h.step, ramp: h.ramp, u: h.u, side: h.side });
}
// pacer hammer (kick): every beat but the hold bar
for (let b = 0; b < BEATS; b++) {
  if (Math.floor(b / 4) === HOLD_BAR) continue;
  ev(b, "hammer", b === FINISH_BAR * 4 ? "finish-slam" : "slam", "kick", 0.5, b % 4 === 0 ? 1.0 : 0.95);
}
// track drive chevrons (bass): a gallop on the "and" and the 16th after it; 16th rolls in the neck-and-neck bars
for (let bar = 0; bar < BARS; bar++) {
  if (bar === HOLD_BAR) continue;
  const root = place(CHORDS[CHORD_OF_BAR[bar]][0], 33);
  const offs = bar >= 12 && bar < 15 ? [0.25, 0.5, 0.75] : [0.5, 0.75];
  for (let beat = 0; beat < 4; beat++) {
    offs.forEach((o, j) => {
      const up = bar % 2 === 1 && beat === 3 && o === 0.75 ? 12 : 0; // an octave pickup into every chord change
      ev(bar * 4 + beat + o, "chevrons", "step", "bass", 0.2, o === 0.5 ? 0.95 : 0.8, { pitch: root + up, lamp: j });
    });
  }
}
// lane lights (mid saws in octaves): the board halves pulse on every off-beat 8th; 3rd and 5th alternate
for (let bar = 0; bar < BARS; bar++) {
  if (bar === HOLD_BAR) continue;
  const ch = CHORDS[CHORD_OF_BAR[bar]];
  for (let beat = 0; beat < 4; beat++) {
    ev(bar * 4 + beat + 0.5, "board", "pulse", "mid", 0.22, 0.85, { pitch: place(beat % 2 === 0 ? ch[1] : ch[2], 48) });
  }
}
// the winner's half glows full through the finish section (held saw chord root, re-struck each bar)
for (let bar = FINISH_BAR; bar < FINISH_BAR + 4; bar++) {
  ev(bar * 4, "board", "glow", "glow", 3.9, 0.9, { pitch: place(CHORDS[CHORD_OF_BAR[bar]][0], 57) });
}
// side chaser bulbs (hats): the off-beat 8th between kicks (techno's "boom-tss", the pulse a phone speaker carries),
// with quieter 16ths filled in as the race gets busier
for (let bar = 0; bar < BARS; bar++) {
  const s = sectionOf(bar);
  const offs = bar === HOLD_BAR ? [] : s === "start" || bar >= 22 ? [0.5] : s === "checkpoints" || bar >= 20 ? [0.5, 0.75]
    : [0.25, 0.5, 0.75];
  for (let beat = 0; beat < 4; beat++) for (const o of offs) ev(bar * 4 + beat + o, "chaser", "step", "hats", 0.08, o === 0.5 ? 0.9 : 0.5);
}
// checkpoints: a marble landing on a bounce pad (stab: the chord root in octaves, and a clap)
cpCross.sort((a, b) => a.beat - b.beat);
cpCross.forEach((c) => {
  const extra = { side: c.side, ramp: c.ramp, lamp: PAD_RAMPS.indexOf(c.ramp), pitch: place(CHORDS[CHORD_OF_BAR[Math.floor(c.beat / 4)]][0], 57) };
  ev(c.beat, "pad", "bounce", "stab", 0.4, 0.95, extra);
  ev(c.beat, "pad", "bounce", "clap", 0.3, 0.95, extra);
});
// gates swinging open (a snare): the start gate on the downbeat, then the two race gates
const GATE_OPEN = [0, ...Object.values(GATES)];
GATE_OPEN.forEach((b, j) => ev(b, "gate", "open", "gate", 0.25, 0.95, { lamp: j }));
// finish banner lamps (snare roll): bar 15 on 8ths, bar 16 on 16ths, 24 lamps
const roll = [...Array(8).keys()].map((k) => 56 + k / 2).concat([...Array(16).keys()].map((k) => 60 + k / 4));
roll.forEach((b, k) => ev(b, "banner", "light", "roll", 0.15, 0.35 + (0.6 * k) / (roll.length - 1), { lamp: k }));

// ---------------------------------------------------------------- validate
events.sort((a, b) => a.beat - b.beat || a.entityId.localeCompare(b.entityId));
const ids = new Set<string>();
for (const e of events) {
  if (ids.has(e.id)) throw new Error(`duplicate ${e.id}`);
  ids.add(e.id);
  if (e.beat < 0 || e.beat >= BEATS || e.frame !== frameOf(e.beat)) throw new Error(`bounds ${e.id}`);
  if (e.velocity <= 0 || e.velocity > 1 || e.durationBeats <= 0) throw new Error(`velocity/duration ${e.id}`);
  const chord = CHORD_OF_BAR[Math.floor(e.beat / 4)];
  if (e.pitch !== undefined && !CHORDS[chord].includes(e.pitch % 12)) throw new Error(`${e.id} pitch ${e.pitch} not in ${chord}`);
  const chordEnd = (Math.floor(e.beat / 8) + 1) * 8; // chords last 2 bars
  if (e.pitch !== undefined && e.beat + e.durationBeats > chordEnd + 1e-9) throw new Error(`${e.id} rings into the next chord`);
}
// Red and Blue never sound on the same 16th (the holds aside, which start on different 8ths anyway)
const redAt = new Set(events.filter((e) => e.instrument === "red").map((e) => e.frame));
const clash = events.filter((e) => e.instrument === "blue" && redAt.has(e.frame));
if (clash.length) throw new Error(`red and blue together at ${clash.map((e) => e.beat)}`);
// landings fall on an 8th (kick or bass already sounds there)
for (const side of ["R", "B"] as const) {
  for (const s of segs[side]) if (s.kind === "fall" && Math.abs(s.t1 * 2 - Math.round(s.t1 * 2)) > 1e-9) throw new Error(`landing off the 8ths ${side} ${s.t1}`);
  // segments are contiguous and cover the loop
  let t = 0;
  for (const s of segs[side]) { if (Math.abs(s.t0 - t) > 1e-9) throw new Error(`gap in ${side} at ${t}`); t = s.t1; }
  if (t !== BEATS) throw new Error(`${side} path ends at ${t}`);
}
if (cpCross.length !== 10) throw new Error("checkpoints");

mkdirSync("public/beat-race", { recursive: true });
writeFileSync("public/beat-race/timeline.json", JSON.stringify({
  version: 1, fps: FPS, bpm: BPM, framesPerBeat: FPB, beatsPerBar: 4, bars: BARS, totalFrames: TOTAL_FRAMES, seed: SEED,
  winner: "B", finishAt, holdStart, holdBar: HOLD_BAR, finishBar: FINISH_BAR, lift: LIFT, lastRamp: LAST_RAMP,
  checkpointRamps: PAD_RAMPS, padHop: PAD_HOP, gates: GATES, gateOpen: GATE_OPEN, pegRamps: PEG_RAMPS, segments: segs,
  chords: CHORDS, chordOfBar: CHORD_OF_BAR, hookOfBar: HOOK.map((h) => h.name), sections, events,
}, null, 0));

const count = (inst: string) => events.filter((e) => e.instrument === inst).length;
for (const s of sections) {
  console.log(`${s.id.padEnd(11)} bars ${s.fromBar + 1}-${s.toBar}: ${CHORD_OF_BAR.slice(s.fromBar, s.toBar).join(" ").padEnd(12)} hook ${HOOK.slice(s.fromBar, s.toBar).map((h) => h.name).join(" | ")}`);
}
console.log("pad landings:", cpCross.map((c) => `${c.side}@${c.beat}`).join(" "));
console.log(`finish: Blue ${finishAt.B} (bar ${finishAt.B / 4 + 1}), Red ${finishAt.R}; holds start R ${holdStart.R} B ${holdStart.B}`);
console.log(`events ${events.length}: ` + ["kick", "bass", "red", "blue", "mid", "glow", "hats", "stab", "clap", "roll", "gate"].map((i) => `${i} ${count(i)}`).join(", "));
