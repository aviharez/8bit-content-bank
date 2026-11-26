import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import {
  ARM_X, ARM_Z, buildScene, COLUMN_X, CRATE_TOP, FactoryScene, INTAKE_X, INTAKE_Z, LAMP_Y, RAM_UP, RING, slotZ, ST,
} from "./scene";
import timeline from "../../../public/the-beat-factory/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920. Everything below is a pure function of the frame.
const W = 360, H = 640, SCALE = 3, M = 28;
type Ev = { id: string; beat: number; frame: number; entityId: string; action: string; instrument: string; pitch?: number;
  velocity: number; durationBeats: number; lamp?: number; side?: "L" | "R" };
type TL = { fps: number; framesPerBeat: number; bars: number; totalFrames: number; holdBar: number; ignitionBar: number;
  feedsNeeded: number; feeds: number[]; power: number[]; events: Ev[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, DURATION = T.totalFrames;
const BEATS = T.bars * 4;
const HOLD0 = T.holdBar * 4, IGN = T.ignitionBar * 4, COOL = 80;
const byEntity = (id: string) => T.events.filter((e) => e.entityId === id).sort((a, b) => a.beat - b.beat);
const KICKS = byEntity("press"), JERKS = byEntity("belt").map((e) => e.beat), LEFT = byEntity("armL"), RIGHT = byEntity("armR");
const CUTS = byEntity("cutter"), SNAPS = byEntity("sorter"), RINGS = byEntity("ring"), GLOWS = byEntity("reactor");
const CUT_BEATS = new Set(CUTS.map((e) => Math.floor(e.beat)));
const JERK = 2 / FPB; // a belt jerk takes 2 frames
const SLOTS_PER_LOOP = JERKS.length / 3;
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const wrap = (b: number) => ((b % BEATS) + BEATS) % BEATS;

/** The last event at or before beat b, looking back across the loop seam; `age` is how long ago it was. */
function last<E extends { beat: number }>(list: E[], b: number): { e: E; age: number } | null {
  if (!list.length) return null;
  for (let k = list.length - 1; k >= 0; k--) if (list[k].beat <= b + 1e-9) return { e: list[k], age: b - list[k].beat };
  const e = list[list.length - 1];
  return { e, age: b + BEATS - e.beat };
}
function next<E extends { beat: number }>(list: E[], b: number): { e: E; wait: number } | null {
  if (!list.length) return null;
  for (const e of list) if (e.beat > b + 1e-9) return { e, wait: e.beat - b };
  return { e: list[0], wait: list[0].beat + BEATS - b };
}

// ---------------------------------------------------------------- the belt: slots advanced, as a function of the beat
function beltU(b: number) {
  const loops = Math.floor(b / BEATS), x = b - loops * BEATS;
  let k = 0;
  while (k < JERKS.length && JERKS[k] <= x + 1e-9) k++;
  const partial = k > 0 && x - JERKS[k - 1] < JERK ? easeOut((x - JERKS[k - 1]) / JERK) : 1;
  const count = k > 0 ? k - 1 + partial : 0;
  return loops * SLOTS_PER_LOOP + count / 3;
}
/** The beat at which the belt reached slot count u (end of the jerk that completed it). */
function beatAtU(u: number) {
  const j = Math.round(u * 3) - 1;
  const n = JERKS.length;
  const loops = Math.floor(j / n), r = j - loops * n;
  return JERKS[r] + loops * BEATS + JERK;
}
const sideAt = (b: number) => last(SNAPS, wrap(b))!.e.side!;

/** Reactor power 0..1 at beat b (authored progress: +1/60 per crate fed in bars 1-15, max in the drop, cooling after). */
function powerAt(b: number) {
  if (b < HOLD0) return T.feeds.filter((f) => f + 0.25 <= b).length / T.feedsNeeded;
  if (b < COOL) return 1;
  const bar = Math.floor(b / 4);
  const from = T.power[bar - 1] ?? 1, to = T.power[bar];
  return from + (to - from) * easeOut(clamp01((b - bar * 4) / 0.5));
}
const glowAt = (b: number) => (last(GLOWS, b)!.e.lamp ?? 20) / 100;

// ---------------------------------------------------------------- camera: a slow periodic drift, a little closer in the drop
function camera(f: number, S: FactoryScene) {
  const u = (2 * Math.PI * f) / DURATION;
  const b = f / FPB;
  const push = b < IGN - 2 ? 0 : b < IGN ? easeOut((b - IGN + 2) / 2) : b < COOL ? 1 : b < COOL + 8 ? 1 - easeOut((b - COOL) / 8) : 0;
  const d = 1 - 0.06 * push;
  S.camera.position.set(0.7 * Math.sin(u), 0.6 + 15.4 * d, -1.0 + 15.0 * d);
  S.camera.lookAt(0.2 * Math.sin(u), 1.0, -4.6);
  S.camera.updateMatrixWorld();
}

let S: FactoryScene | null = null;
const proj = new THREE.Vector3();
const toScreen = (x: number, y: number, z: number) => {
  proj.set(x, y, z).project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H };
};
type Spark = { x: number; y: number; age: number; color: string; n: number; spread: number; seed: number };

function render3D(f: number, sparks: Spark[]) {
  S ??= buildScene(W, H);
  const b = f / FPB;
  const power = powerAt(b), glow = glowAt(b);
  const drop = b >= IGN && b < COOL;
  const lit = drop ? 1 : b >= COOL ? power : 0; // the hall lights: off until ignition, cooling with the reactor

  // ---- press (kick): slams on the event frame, recoils, winds back up; held up through bar 16
  const lk = last(KICKS, b)!, nk = next(KICKS, b)!;
  const up = nk.wait < 0.15 ? (nk.wait / 0.15) ** 2 : Math.min(1, easeOut(lk.age / 0.4));
  S.ram.position.y = CRATE_TOP + RAM_UP * up;
  S.pressLamp.color.set(lk.age < 0.2 ? C["fee761"] : C["733e39"]);
  if (lk.age < 0.3) {
    const p = toScreen(0, CRATE_TOP, slotZ(ST.press) + 0.5);
    sparks.push({ ...p, age: lk.age / 0.3, color: C["feae34"], n: lk.e.action === "ignite-slam" ? 22 : 12, spread: 40, seed: lk.e.beat });
  }

  // ---- belt (bass): rollers turn and the rail strips flash on every jerk
  const U = beltU(b);
  S.rollers.forEach((r) => { r.rotation.x = -U * 6; });
  const lj = last(JERKS.map((beat) => ({ beat })), b)!;
  const railOn = lj.age < 0.12 && b >= 0;
  S.rail.forEach((m) => m.color.set(drop ? C["0099db"] : C["3a4466"]));
  S.rollerMat.color.set(railOn ? (drop ? C["2ce8f5"] : C["feae34"]) : C["5a6988"]);

  // ---- crates: periodic along the line; their look is their history (stamped, charged, sealed), routed by the sorter
  const n0 = Math.floor(U) + 2;
  S.crates.forEach((c, i) => {
    const n = n0 - i;
    const p = U - n;
    c.root.visible = p >= -1.6;
    if (!c.root.visible) return;
    c.body.scale.set(1, 1, 1);
    c.root.scale.setScalar(1);
    let x = 0, z = slotZ(Math.min(p, ST.sorter)), y = 0.5;
    if (p > ST.sorter) {
      const q = p - ST.sorter;
      const t8 = beatAtU(n + ST.sorter);
      const sgn = sideAt(t8) === "L" ? -1 : 1;
      const dispatch = wrap(t8) >= COOL - 0.5;
      if (dispatch) { // the cooldown: crates leave off the side of the hall
        x = sgn * 3.4 * easeOut(clamp01(q / 0.8));
        z = slotZ(ST.sorter) - 0.6;
        if (q > 0.8) { y = 0.5 - (q - 0.8) * 4; c.root.scale.setScalar(Math.max(0.01, 1 - (q - 0.8) * 3)); }
        c.root.visible = q < 1.1;
      } else { // into an intake: along the chute, then down into the reactor
        const u = clamp01(q);
        x = sgn * INTAKE_X * u;
        z = slotZ(ST.sorter) + (INTAKE_Z - slotZ(ST.sorter)) * u;
        if (q > 1) { y = 0.5 - (q - 1) * 3; c.root.scale.setScalar(Math.max(0.01, 1 - (q - 1) * 3)); }
        c.root.visible = q < 1.3;
      }
    }
    c.root.position.set(x, y, z);
    // squash under the press on contact
    if (Math.abs(p - ST.press) < 0.02 && lk.age < 0.12) c.body.scale.set(1.06, 0.86, 1.06);
    // stamped once the press has hit it: a crate waiting under the held press (bar 16) is still blank
    const underPress = Math.abs(p - ST.press) < 0.02;
    c.stamp.visible = p >= ST.press - 0.01 && (!underPress || b - beatAtU(n + ST.press) > lk.age);
    const charged = p >= ST.arms - 0.01;
    c.core.color.set(charged ? (drop ? C["ffffff"] : C["2ce8f5"]) : C["3a4466"]);
    const t6 = beatAtU(n + ST.cutter);
    c.seal.visible = p >= ST.cutter - 0.01 && CUT_BEATS.has(Math.floor(wrap(t6) + 1e-6));
  });

  // ---- robot arms (hook): the carriage slides to the next lamp, the piston jabs it on the note's frame
  for (const [side, list, sgn] of [["L", LEFT, -1], ["R", RIGHT, 1]] as const) {
    const arm = S.arms[side];
    const l = last(list, b)!, nx = next(list, b)!;
    const from = LAMP_Y(l.e.lamp!), to = LAMP_Y(nx.e.lamp!);
    const move = clamp01((0.2 - nx.wait) / 0.16); // moves in the 2 frames before the next jab
    const held = l.e.action === "hold" && l.age < l.e.durationBeats - 0.2;
    const y = held ? from : from + (to - from) * easeOut(move);
    const ext = held ? 1 : l.age < 0.12 ? 1 : clamp01(1 - (l.age - 0.12) / 0.15);
    const reach = 0.28 + (COLUMN_X - ARM_X - 0.64) * ext; // fully out, the claw presses the lamp's inner face
    arm.carriage.position.y = y;
    arm.piston.scale.x = reach;
    arm.piston.position.x = (sgn * reach) / 2;
    arm.claw.position.x = sgn * reach;
    arm.led.color.set(ext > 0.5 ? arm.on : C["181425"]);
    arm.lamps.forEach((m, k) => {
      const on = list.some((e) => e.lamp === k && wrap(b - e.beat) < (e.action === "hold" ? e.durationBeats : 0.22));
      m.color.set(on ? arm.on : arm.off);
    });
    if (ext === 1 && l.age < 0.1) {
      const p = toScreen(sgn * (COLUMN_X - 0.1), LAMP_Y(l.e.lamp!), ARM_Z + 0.3);
      sparks.push({ ...p, age: l.age / 0.1, color: arm.on, n: 5, spread: 12, seed: l.e.beat * 7 + sgn });
    }
  }

  // ---- laser cutter (hats)
  const lc = last(CUTS, b);
  const firing = !!lc && lc.age < 0.13;
  S.laser.visible = firing;
  S.laserHead.color.set(firing ? C["ff0044"] : C["733e39"]);
  if (firing) {
    const p = toScreen(0, CRATE_TOP, slotZ(ST.cutter) + 0.3);
    sparks.push({ ...p, age: lc!.age / 0.13, color: C["fee761"], n: 6, spread: 16, seed: lc!.e.beat * 13 });
  }

  // ---- sorter (stab + clap): the gate snaps to the other intake
  const ls = last(SNAPS, b)!;
  const side = ls.e.side!;
  const prevSide = side === "L" ? "R" : "L";
  const ang = (s: string) => (s === "L" ? 0.42 : -0.42);
  const inSnapZone = b >= 16 && b < 88;
  const k = inSnapZone ? easeOut(clamp01(ls.age / (2 / FPB))) : 1;
  S.gate.rotation.y = ang(prevSide) + (ang(side) - ang(prevSide)) * k;
  const flash = inSnapZone && ls.age < 0.18;
  S.gateLamps.L.color.set(side === "L" ? (flash ? C["ffffff"] : C["63c74d"]) : C["265c42"]);
  S.gateLamps.R.color.set(side === "R" ? (flash ? C["ffffff"] : C["63c74d"]) : C["265c42"]);
  S.intakeLamps.forEach((m) => m.color.set(b >= COOL ? C["e43b44"] : drop ? C["2ce8f5"] : C["63c74d"]));

  // ---- reactor (whine = glow; roll = charge ring): the core's height is the power
  S.core.scale.y = 0.3 + 4.3 * power;
  S.core.position.y = 0.9 + (0.3 + 4.3 * power) / 2;
  const ignite = b >= IGN && b < IGN + 0.5;
  S.coreMat.color.set(ignite ? C["ffffff"] : glow >= 0.99 ? (drop ? C["2ce8f5"] : C["0099db"]) : glow > 0.6 ? C["0099db"] : glow > 0.35 ? C["124e89"] : C["193c3e"]);
  S.coreRim.color.set(drop ? C["ffffff"] : C["0099db"]);
  S.reactorLight.intensity = 3 + 9 * glow;
  const ringLit = b >= IGN && b < COOL ? RING : b >= COOL ? Math.round(power * RING) : RINGS.filter((e) => e.beat <= b && b >= 56).length;
  const lr = last(RINGS, b)!;
  S.ring.forEach((m, i) => m.color.set(i < ringLit ? (b < IGN && i === lr.e.lamp && lr.age < 0.2 ? C["ffffff"] : C["2ce8f5"]) : C["262b44"]));
  S.beams.forEach((m) => { m.visible = drop; });

  // ---- the hall: lights on at ignition, status lamps green when the line locks together
  S.ceiling.forEach((m, i) => m.color.set(i < Math.round(lit * S!.ceiling.length) ? C["fee761"] : C["3a4466"]));
  S.hemi.intensity = 0.9 + 0.2 * lit;
  S.key.intensity = 0.9 + 0.25 * lit;
  S.status.forEach((m) => m.color.set(drop ? C["63c74d"] : b >= HOLD0 && b < IGN ? C["feae34"] : C["be4a2f"]));

  camera(f, S);
  S.renderer.render(S.scene, S.camera);
}

// ---------------------------------------------------------------- 2D effects on the 3D layer (quantised with it)
const hash = (x: number) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
function drawSparks(g: CanvasRenderingContext2D, sparks: Spark[]) {
  for (const s of sparks) {
    for (let k = 0; k < s.n; k++) {
      const a = Math.PI * (1.05 + 0.9 * hash(k + s.seed * 3.1));
      const r = s.spread * (0.3 + 0.7 * hash(k * 1.7 + s.seed)) * easeOut(s.age);
      const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * 0.6 + 10 * s.age * s.age;
      g.fillStyle = k % 3 ? s.color : C["ffffff"];
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
}

function drawHud(ov: CanvasRenderingContext2D, f: number, cover: boolean) {
  const { rect, text, panel } = pixelKit(ov);
  const b = f / FPB;
  const top = cover ? 86 : 26;
  panel(M, top, W - 2 * M, 54, C["c0cbdc"]);
  text("THIS FACTORY", W / 2, top + 8, "p16", C["c0cbdc"], "c");
  text("RUNS ON TECHNO", W / 2, top + 30, "p16", C["fee761"], "c", C["a22633"]);
  // the one readout: reactor power
  const y = top + 60;
  const power = powerAt(b);
  const drop = b >= IGN && b < COOL;
  panel(M, y, W - 2 * M, 44, drop ? C["2ce8f5"] : C["5a6988"]);
  const label = drop ? "MAX POWER" : b >= COOL ? "COOLING DOWN" : b >= HOLD0 ? "CHARGING..." : "REACTOR POWER";
  text(label, M + 10, y + 6, "s16", drop ? C["fee761"] : C["c0cbdc"]);
  text(`${Math.round(power * 100)}%`, W - M - 10, y + 6, "p16", C["ffffff"], "r", C["181425"]);
  const segs = 20, sw = (W - 2 * M - 20) / segs;
  for (let k = 0; k < segs; k++) {
    const on = k < Math.round(power * segs);
    rect(M + 10 + k * sw, y + 28, sw - 2, 8, on ? (drop ? C["fee761"] : k < 14 ? C["2ce8f5"] : C["63c74d"]) : C["262b44"]);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const sparks: Spark[] = [];
  render3D(f, sparks);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  drawSparks(ctx, sparks);
  // ignition: one white flash fading over 6 frames (one flash only, no strobing)
  const b = f / FPB;
  if (b >= IGN && b < IGN + 0.5) {
    ctx.globalAlpha = 0.7 * (1 - (b - IGN) / 0.5);
    ctx.fillStyle = C["ffffff"];
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  drawHud(ov, f, cover);
  pixelKit(ov).text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const TheBeatFactoryVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true })!;
    const ov = overlayRef.current.getContext("2d", { willReadFrequently: true })!;
    drawFrame(ctx, ov, f, coverFrame !== undefined);
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("the-beat-factory/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const TheBeatFactory = () => (
  <Composition id="TheBeatFactory" component={TheBeatFactoryVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the drop, reactor at MAX POWER, hall lit, both arms mid-jab. */
export const TheBeatFactoryCover = () => (
  <Still id="TheBeatFactoryCover" component={TheBeatFactoryVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: (IGN + 5) * FPB + 3 }} />
);
