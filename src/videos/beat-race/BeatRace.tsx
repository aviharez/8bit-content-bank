import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import {
  BOTTOM_REST, BUCKET_Z, FLOOR_Y, bucketX, buildScene, bumperPos, checkpointY, COL, FALL, GATE_GAP, LEVELS, MARBLE_R,
  onRamp, Peg, Pin, RaceScene, ramp, RAMP_LEN, RIDE, TOP_REST,
} from "./scene";
import timeline from "../../../public/beat-race/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920. Everything below is a pure function of the frame, drawn
// from public/beat-race/timeline.json (the same file the music is composed from).
const W = 360, H = 640, SCALE = 3, M = 28;
type Side = "R" | "B";
type Ev = { id: string; beat: number; frame: number; entityId: string; action: string; instrument: string; pitch?: number;
  velocity: number; durationBeats: number; step?: number; ramp?: number; u?: number; side?: Side; lamp?: number };
type Seg = { kind: "roll" | "fall" | "held" | "bucket" | "tip" | "wait"; k?: number; t0: number; t1: number; landings?: number[] };
type TL = { fps: number; framesPerBeat: number; bars: number; totalFrames: number; seed: number; finishAt: Record<Side, number>;
  holdStart: Record<Side, number>; finishBar: number; lift: { up0: number; up1: number }; checkpointRamps: number[];
  padHop: number; gates: Record<string, number>; pegRamps: number[];
  segments: Record<Side, Seg[]>; events: Ev[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, DURATION = T.totalFrames, BEATS = T.bars * 4;
const FIN = T.finishBar * 4, HOLD0 = FIN - 4, UP0 = T.lift.up0, UP1 = T.lift.up1;
const snap = (b: number) => Math.floor(b * FPB + 1e-6) / FPB; // a beat on the frame grid, rounded down as the events are
const sgn = (s: Side) => (s === "R" ? -1 : 1) as -1 | 1;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const wrap = (b: number) => ((b % BEATS) + BEATS) % BEATS;
const SEGS = {
  R: T.segments.R.map((s) => ({ ...s, s0: snap(s.t0), s1: snap(s.t1) })),
  B: T.segments.B.map((s) => ({ ...s, s0: snap(s.t0), s1: snap(s.t1) })),
};
const of = (inst: string) => T.events.filter((e) => e.instrument === inst).sort((a, b) => a.frame - b.frame);
const NOTES = { R: of("red"), B: of("blue") };
const GATE_OPENS = of("gate"); // 0 = the start gate, then the race gates in ramp order
const GATE_RAMPS = Object.keys(T.gates).map(Number).sort((a, b) => a - b);
const PADS = T.checkpointRamps, PEGS_AT = T.pegRamps;
const KICKS = of("kick"), BASS = of("bass"), MIDS = of("mid"), GLOWS = of("glow"), HATS = of("hats"), STABS = of("stab"), ROLL = of("roll");

/** The last event at or before frame f (looking back across the loop seam), how many frames ago, and its index. */
function last(list: Ev[], f: number): { e: Ev; age: number; n: number } | null {
  if (!list.length) return null;
  for (let k = list.length - 1; k >= 0; k--) if (list[k].frame <= f) return { e: list[k], age: f - list[k].frame, n: k };
  return { e: list[list.length - 1], age: f + DURATION - list[list.length - 1].frame, n: list.length - 1 };
}
/** Frames until the next event of the list after frame f (wraps across the loop seam). */
function untilNext(list: Ev[], f: number): number {
  for (const e of list) if (e.frame > f) return e.frame - f;
  return list[0].frame + DURATION - f;
}

// ---------------------------------------------------------------- where everything is, as a function of the beat
/** The marble's height in its bucket: at the top when the loop starts (it has just tipped the marble onto the gate),
 *  down to the cabinet floor in bars 1-2, up again on the lift in bars 21-23. */
function bucketY(b: number) {
  if (b < 1) return TOP_REST;
  if (b < 6) return TOP_REST + (BOTTOM_REST - TOP_REST) * easeInOut((b - 1) / 5);
  if (b < UP0) return BOTTOM_REST;
  if (b < UP1) return BOTTOM_REST + (TOP_REST - BOTTOM_REST) * easeInOut((b - UP0) / (UP1 - UP0));
  return TOP_REST;
}
/** Things the marbles light stay lit until the rising buckets pass them on the lift (so the loop starts dark). */
const liftReset = (y: number, b: number) => b >= UP0 && bucketY(b) > y - 0.2;
const rollAngle = (side: Side, k: number, p: number) => {
  let a = 0;
  for (let j = 0; j < k; j++) a -= (ramp(j, sgn(side)).dir * RAMP_LEN) / MARBLE_R;
  return a - (ramp(k, sgn(side)).dir * p * RAMP_LEN) / MARBLE_R;
};
const END_ANGLE = { R: rollAngle("R", LEVELS - 1, 1), B: rollAngle("B", LEVELS - 1, 1) };

/** A peg field: the marble's contacts (its landing, every peg it plays, the bumper at the end), evenly spaced along
 *  the level. It rests on a peg and hops to the next one in the last half beat (or less) before that contact. */
type Contact = { t: number; u: number; frame?: number };
const PEG_PATH: Record<Side, Record<number, Contact[]>> = { R: {}, B: {} };
for (const side of ["R", "B"] as const) {
  for (const k of PEGS_AT) {
    const seg = SEGS[side].find((x) => x.kind === "roll" && x.k === k)!;
    const hits = NOTES[side].filter((e) => e.ramp === k).map((e) => ({ t: e.frame / FPB, frame: e.frame }));
    const c: { t: number; frame?: number }[] = hits[0].t > seg.s0 + 1e-6 ? [{ t: seg.s0 }, ...hits] : hits;
    PEG_PATH[side][k] = c.map((x, j) => ({ ...x, u: j / (c.length - 1) }));
  }
}
function pegMotion(side: Side, k: number, b: number) {
  const c = PEG_PATH[side][k];
  let i = 0;
  while (i + 1 < c.length && c[i + 1].t <= b) i++;
  if (i + 1 >= c.length) return { pos: onRamp(k, sgn(side), 1), u: 1 };
  const hop = Math.min(0.5, c[i + 1].t - c[i].t);
  const q = clamp01((b - (c[i + 1].t - hop)) / hop);
  const u = c[i].u + (c[i + 1].u - c[i].u) * q;
  const pos = onRamp(k, sgn(side), u);
  pos.y += (0.3 + 0.6 * hop) * 4 * q * (1 - q);
  return { pos, u };
}

function marble(side: Side, b: number): { pos: THREE.Vector3; angle: number; progress: number } {
  const s = sgn(side);
  const segs = SEGS[side];
  const seg = segs.find((x) => b >= x.s0 && b < x.s1) ?? segs[segs.length - 1];
  const p = clamp01((b - seg.s0) / (seg.s1 - seg.s0));
  const k = seg.k ?? 0;
  const parked = END_ANGLE[side] * (1 - clamp01((b - UP0) / (UP1 - UP0)));
  switch (seg.kind) {
    case "roll": {
      if (PEGS_AT.includes(k)) {
        const m = pegMotion(side, k, b);
        return { pos: m.pos, angle: rollAngle(side, k, m.u), progress: k + 0.8 * m.u };
      }
      const pos = onRamp(k, s, p);
      if (PADS.includes(k) && b - seg.s0 < T.padHop) { // off a bounce pad: half a beat in the air
        const q = (b - seg.s0) / T.padHop;
        pos.y += 0.9 * 4 * q * (1 - q);
      }
      return { pos, angle: rollAngle(side, k, p), progress: k + 0.8 * p };
    }
    case "held": // waiting at a closed gate, against the flap
      return { pos: onRamp(k, s, 1), angle: rollAngle(side, k, 1), progress: k + 0.8 };
    case "fall": {
      const a = onRamp(k, s, 1);
      const progress = k + 0.8 + 0.2 * p;
      if (k < LEVELS - 1) return { pos: a.setY(a.y - FALL * p * p), angle: rollAngle(side, k, 1), progress };
      const y = bucketY(seg.s1);
      return { pos: new THREE.Vector3(a.x, a.y + (y - a.y) * p * p, a.z + BUCKET_Z * p), angle: END_ANGLE[side], progress };
    }
    case "bucket": {
      // a bounce between landings (every landing is a note), height by the time to the next one
      const L = seg.landings!.map(snap);
      let i = 0;
      while (i + 1 < L.length && L[i + 1] <= b) i++;
      const gap = (i + 1 < L.length ? L[i + 1] : seg.s1) - L[i];
      const q = gap > 0 ? clamp01((b - L[i]) / gap) : 0;
      const h = Math.min(1.1, 0.3 * gap) * 4 * q * (1 - q);
      return { pos: new THREE.Vector3(bucketX(s), bucketY(b) + h, BUCKET_Z), angle: parked, progress: LEVELS };
    }
    case "tip": {
      const v = new THREE.Vector3(bucketX(s), bucketY(b), BUCKET_Z).lerp(onRamp(0, s, 0), p);
      v.y += 0.5 * 4 * p * (1 - p);
      return { pos: v, angle: 0, progress: LEVELS };
    }
    default:
      return { pos: onRamp(0, s, 0), angle: 0, progress: LEVELS };
  }
}
const midY = (b: number) => (marble("R", wrap(b)).pos.y + marble("B", wrap(b)).pos.y) / 2;
/** The camera (and the pacer hammer) follow the race, smoothed over +-1.5 beats so a fall is not a jump cut. */
function raceY(b: number) {
  let s = 0;
  for (let j = -6; j <= 6; j++) s += midY(b + j * 0.25);
  return s / 13;
}

// pins (one per note a marble plays on a ramp), bumpers, checkpoint crossings: built once from the events
const PINS: Record<Side, { pin: Pin; frame: number; y: number }[]> = { R: [], B: [] };
const BUMPER_FRAME: Record<Side, number[]> = { R: [], B: [] };
for (const side of ["R", "B"] as const) {
  for (const e of NOTES[side]) {
    if (e.action === "pin") {
      const s = SEGS[side].find((x) => x.kind === "roll" && x.k === e.ramp)!;
      const u = (e.frame / FPB - s.s0) / (s.s1 - s.s0);
      PINS[side].push({ pin: { ramp: e.ramp!, u, step: e.step! }, frame: e.frame, y: onRamp(e.ramp!, sgn(side), u).y });
    }
    if (e.action === "bumper" || e.action === "finish" || e.action === "gate-bump") BUMPER_FRAME[side][e.ramp!] = e.frame;
  }
}
const CROSS = T.checkpointRamps.map((_, j) => STABS.filter((e) => e.lamp === j));
/** Has this team crossed checkpoint j by frame f (and the lift not yet passed it)? */
const crossedBy = (j: number, side: Side, f: number) =>
  !liftReset(checkpointY(T.checkpointRamps[j]), f / FPB) && CROSS[j].some((e) => e.side === side && e.frame <= f);
const litCheckpoints = (side: Side, f: number) => CROSS.filter((_, j) => crossedBy(j, side, f)).length;

let S: RaceScene | null = null;
// the pegs each marble plays (every contact but the bumper at the end), with the frame it plays them on
const PEGS: Record<Side, { peg: Peg; frame?: number; y: number }[]> = { R: [], B: [] };
for (const side of ["R", "B"] as const) {
  for (const k of PEGS_AT) {
    for (const c of PEG_PATH[side][k].slice(0, -1)) PEGS[side].push({ peg: { ramp: k, u: c.u }, frame: c.frame, y: onRamp(k, sgn(side), c.u).y });
  }
}
const getScene = () => (S ??= buildScene(W, H, { R: PINS.R.map((p) => p.pin), B: PINS.B.map((p) => p.pin) },
  { R: PEGS.R.map((p) => p.peg), B: PEGS.B.map((p) => p.peg) }, { pads: PADS, gates: GATE_RAMPS, pegs: PEGS_AT }));
const rnd = (j: number, k: number) => {
  const x = Math.sin(j * 127.1 + k * 311.7 + T.seed * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

function render3D(f: number, cover = false) {
  const sc = getScene();
  const b = f / FPB;
  const lit = (age: number, frames: number) => age >= 0 && age < frames;
  const M2 = { R: marble("R", b), B: marble("B", b) };
  for (const side of ["R", "B"] as const) {
    const lane = sc.lanes[side], col = COL[side], s = sgn(side);
    const m = M2[side];
    lane.marble.position.copy(m.pos);
    lane.marble.rotation.set(0.5, 0.4, m.angle, "ZXY");
    // every note the marble plays flashes it; on the final straight it glows for the held note
    const note = last(NOTES[side], f)!;
    const holding = b >= snap(T.holdStart[side]) && b < FIN;
    lane.marbleMat.emissive.set(col.lit);
    lane.marbleMat.emissiveIntensity = Math.max(lit(note.age, 4) ? 0.8 * (1 - note.age / 4) : 0, holding ? 0.35 : 0);
    lane.straight.emissive.set(col.lit);
    lane.straight.emissiveIntensity = holding ? 0.45 : 0;
    // pins and bumpers: dark until hit, white on the hit, then the team colour until the lift passes them
    PINS[side].forEach((p, j) => {
      const age = f - p.frame;
      lane.pins[j].color.set(age < 0 || liftReset(p.y, b) ? col.dim : age < 3 ? C["ffffff"] : col.played);
    });
    PEGS[side].forEach((p, j) => {
      const age = p.frame === undefined ? -1 : f - p.frame;
      lane.pegs[j].color.set(age < 0 || liftReset(p.y, b) ? col.dim : age < 3 ? C["ffffff"] : col.played);
    });
    // bounce pads: the spring squashes on the landing (stab + clap), its lamp keeps the team colour
    PADS.forEach((k, j) => {
      const e = CROSS[j].find((x) => x.side === side)!;
      const age = f - e.frame;
      const pad = lane.pads[j];
      pad.spring.scale.y = age >= 0 && age < 3 ? 0.35 : age >= 3 && age < 6 ? 1.5 : 1;
      pad.lamp.color.set(!crossedBy(j, side, f) ? C["193c3e"] : age < 3 ? C["ffffff"] : col.main);
    });
    // race gates: shut until their beat, then the flap snaps up (the snare) and drops again a beat and a half later
    GATE_RAMPS.forEach((k, j) => {
      const age = f - GATE_OPENS[j + 1].frame;
      const lift = age < 0 ? 0 : age < 2 ? age / 2 : age < 21 ? 1 : age < 27 ? 1 - (age - 21) / 6 : 0;
      const r = ramp(k, s);
      lane.gates[j].flap.position.set(r.lo.x + r.dir * GATE_GAP, r.lo.y + RIDE + 0.8 * lift, 0);
      lane.gates[j].mat.color.set(age >= 0 && age < 3 ? C["ffffff"] : C["feae34"]);
      lane.gates[j].light.color.set(lift > 0 ? (age < 3 ? C["ffffff"] : C["63c74d"]) : C["feae34"]);
    });
    lane.bumpers.forEach((mat, k) => {
      const age = f - BUMPER_FRAME[side][k];
      const y = bumperPos(k, s).y;
      mat.color.set(age < 0 || liftReset(y, b) ? col.dim : age < 3 ? C["ffffff"] : k === LEVELS - 1 ? C["fee761"] : col.played);
    });
    // track drive: the chevrons march one step on every bass note
    const bass = last(BASS, f)!;
    lane.chevrons.forEach((mat, j) => mat.color.set(lit(bass.age, 3) && bass.n % 4 === j ? col.lit : col.deep));
    // the board halves pulse on the off-beat chord; the winner's half stays lit through the finish
    const mid = last(MIDS, f)!;
    const glow = b >= FIN && b < UP0 && side === "B";
    const glowHit = last(GLOWS, f)!;
    lane.half.color.set(glow ? (lit(glowHit.age, 3) ? col.lit : col.halfMax) : lit(mid.age, 4) ? col.halfLit : col.half);
    // chaser bulbs step on the hats
    const hat = last(HATS, f)!;
    lane.bulbs.forEach((mat, j) => mat.color.set(lit(hat.age, 3) && j % 4 === hat.n % 4 ? col.lit : col.deep));
    // the bucket: on the floor, up the lift, a level meter of the note each bounce plays
    lane.bucket.position.set(bucketX(s), bucketY(b), BUCKET_Z);
    const tip = SEGS[side].find((x) => x.kind === "tip")!;
    lane.bucket.rotation.x = b >= tip.s0 && b < tip.s1 ? -0.6 * Math.sin((Math.PI * (b - tip.s0)) / (tip.s1 - tip.s0)) : 0;
    const bounce = note.e.action === "bounce" || note.e.action === "gate" ? note : null;
    lane.bucketLamps.forEach((mat, j) => mat.color.set(bounce && lit(bounce.age, 5) && j <= (bounce.e.step ?? 0) ? col.lit : col.deep));
    // start gate: lifts on the downbeat of bar 1, closes once the marbles are away
    const open = b < 0.25 ? b / 0.25 : b < 4 ? 1 : b < 5 ? 1 - (b - 4) : 0;
    lane.gate.position.y = RIDE + 0.75 * open;
  }
  // checkpoint lamps on the walls: lit for a team once its marble has landed on that pad
  sc.checkpoints.forEach((cp, j) => {
    cp.lampR.color.set(crossedBy(j, "R", f) ? COL.R.main : COL.R.deep);
    cp.lampB.color.set(crossedBy(j, "B", f) ? COL.B.main : COL.B.deep);
  });
  // finish banner: its lamps fill on the snare roll, all Blue once Blue crosses, dark again when the lift starts
  sc.banner.forEach((mat, k) => {
    const e = ROLL[k];
    mat.color.set(b >= FIN && b < UP0 ? COL.B.lit : f >= e.frame && b < FIN ? C["fee761"] : C["262b44"]);
  });
  // pacer hammer: rides the spine at the race's height. On the kick frame it lands on the strike plate (the plate
  // flashes), springs back up over 4 frames and hovers still until the next kick, so the only fast motion is the hit.
  // In bar 16 (no kick) it is held up high.
  const y = raceY(b);
  const kick = last(KICKS, f)!;
  const held = b >= HOLD0 && b < FIN;
  const rebound = clamp01((kick.age - 1) / 4); // frames 0-1 on the plate, up by frame 5
  const toNext = untilNext(KICKS, f);
  // the strike: from the hover it lifts a touch 3 frames before the kick (wind-up), then drops in 2 frames
  const strike = toNext === 3 ? 1.12 : toNext === 2 ? 0.75 : toNext === 1 ? 0.3 : 1;
  const hover = held ? 0.45 + 0.35 * easeInOut(clamp01((b - HOLD0) / 0.5)) : 0.45 * (1 - (1 - rebound) ** 3);
  const off = !held && kick.age <= 1 ? 0 : hover * (toNext <= 3 ? strike : 1); // the drop's hit swings from the hold too
  const PLATE = y - 0.05; // plate top; the hammer's foot (0.37 under its centre) rests on it at off = 0
  sc.plate.position.set(0, PLATE - 0.08, 0);
  sc.hammer.position.set(0, PLATE + 0.37 + off, 0);
  sc.plateLamp.color.set(!held && lit(kick.age, 3) ? C["fee761"] : C["3a4466"]);
  sc.hammerLamp.color.set(held ? C["733e39"] : lit(kick.age, 3) ? C["fee761"] : C["f77622"]);
  const big = kick.e.action === "finish-slam" ? 1.8 : 1;
  sc.shock.position.set(0, PLATE, -0.45);
  sc.shock.scale.setScalar((1 + kick.age * 0.45) * big);
  sc.shockMat.opacity = lit(kick.age, 7) && !held ? 0.55 * (1 - kick.age / 7) : 0;
  // confetti from Blue's finish post, launched on the drop
  const post = bumperPos(LEVELS - 1, 1);
  sc.confetti.forEach((c, j) => {
    const t = (f - FIN * FPB) / FPS - rnd(j, 0) * 0.35;
    c.visible = t >= 0 && t < 3.2 && b < UP0;
    if (!c.visible) return;
    const vx = -(0.6 + rnd(j, 1) * 4.2), vy = 3.5 + rnd(j, 2) * 4, vz = 0.6 + rnd(j, 3) * 2.2;
    c.position.set(post.x + vx * t, post.y + vy * t - 3.2 * t * t, post.z + vz * t);
    c.rotation.set(t * (3 + rnd(j, 4) * 5), t * 4, t * (2 + rnd(j, 5) * 6));
  });
  // camera: the whole board width, centred a little below the race so the track ahead is in view
  // never below the cabinet floor; the cover's bigger title panel sits lower, so its camera looks higher
  const cy = Math.max(y - 1.4, FLOOR_Y + 4.6) + (cover ? 2.8 : 0);
  sc.camera.position.set(0.2, cy + 0.9, 15.4);
  sc.camera.lookAt(0, cy, 0);
  sc.renderer.render(sc.scene, sc.camera);
  return M2;
}

function toScreen(v: THREE.Vector3) {
  const p = v.clone().project(getScene().camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
}

function drawHud(ov: CanvasRenderingContext2D, f: number, M2: ReturnType<typeof render3D>, cover: boolean) {
  const { rect, text, measure, panel } = pixelKit(ov);
  const b = f / FPB;
  const top = cover ? 110 : 26;
  // title: RED vs BLUE / PICK A SIDE (cover: WHO WINS?)
  panel(M, top, W - 2 * M, cover ? 70 : 54, C["c0cbdc"]);
  const font = cover ? "p24" : "p16";
  const wr = measure("RED", font), wv = measure(" vs ", font), wb = measure("BLUE", font);
  let x = W / 2 - (wr + wv + wb) / 2;
  text("RED", x, top + 8, font, C["e43b44"], "l", C["181425"]); x += wr;
  text(" vs ", x, top + 8, font, C["c0cbdc"]); x += wv;
  text("BLUE", x, top + 8, font, C["0099db"], "l", C["181425"]);
  text(cover ? "WHO WINS?" : "PICK A SIDE", W / 2, top + (cover ? 44 : 32), "s16", C["fee761"], "c");
  // the readout: who leads (a tug of war from the middle) and how many checkpoints are lit; BLUE WINS on the drop
  const y = top + (cover ? 80 : 60);
  if (b >= FIN && b < UP0 && !cover) {
    panel(M, y, W - 2 * M, 44, C["0099db"]);
    text("BLUE WINS!", W / 2, y + 10, "p24", C["2ce8f5"], "c", C["181425"]);
  } else {
    panel(M, y, W - 2 * M, 44, C["5a6988"]);
    text("LEAD", M + 10, y + 6, "s16", C["c0cbdc"]);
    const lit = Math.max(...(["R", "B"] as const).map((s) => litCheckpoints(s, f)));
    text(`CHECKPOINT ${lit}/${CROSS.length}`, W - M - 10, y + 6, "s16", C["c0cbdc"], "r");
    const bx = M + 10, bw = W - 2 * M - 20, mid = bx + bw / 2;
    rect(bx, y + 28, bw, 8, C["262b44"]);
    const lead = Math.max(-1, Math.min(1, M2.B.progress - M2.R.progress)); // + = Blue ahead (1 = a whole ramp)
    if (lead > 0) rect(mid, y + 28, (bw / 2) * lead, 8, C["0099db"]);
    if (lead < 0) rect(mid + (bw / 2) * lead, y + 28, (bw / 2) * -lead, 8, C["e43b44"]);
    rect(mid - 1, y + 26, 2, 12, C["ffffff"]);
  }
  // R / B tags over the marbles, so the two read apart without colour
  for (const side of ["R", "B"] as const) {
    const p = toScreen(M2[side].pos.clone().add(new THREE.Vector3(0, 0.75, 0)));
    if (p.y < y + 52 || p.y > 560) continue; // never over the HUD or under the Reels UI
    panel(p.x - 9, p.y - 10, 18, 16, COL[side].main);
    text(side, p.x, p.y - 6, "p8", C["ffffff"], "c");
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover: boolean) {
  const M2 = render3D(f, cover);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(getScene().renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);
  ov.clearRect(0, 0, W, H);
  drawHud(ov, f, M2, cover);
  pixelKit(ov).text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const BeatRaceVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
  const current = useCurrentFrame();
  const f = coverFrame ?? current;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading pixel fonts"));
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    fontsReady.then(() => { setReady(true); continueRender(handle); }).catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);
  useLayoutEffect(() => {
    if (!ready || !canvasRef.current) return;
    if (!overlayRef.current) {
      overlayRef.current = document.createElement("canvas");
      overlayRef.current.width = W;
      overlayRef.current.height = H;
    }
    drawFrame(canvasRef.current.getContext("2d", { willReadFrequently: true })!,
      overlayRef.current.getContext("2d", { willReadFrequently: true })!, f, coverFrame !== undefined);
  }, [f, ready, coverFrame]);
  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("beat-race/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const BeatRace = () => (
  <Composition id="BeatRace" component={BeatRaceVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): neck and neck in bar 12, no result shown. */
export const BeatRaceCover = () => (
  <Still id="BeatRaceCover" component={BeatRaceVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: Math.round(46.5 * FPB) }} />
);
