import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { BASS, BASS_TOP, buildScene, fretU, GHOSTS, GTR, GTR_TOP, GuitarScene, Inst, MAX_FINGERS, NP, RINGS, SOUNDHOLE, SOUNDHOLE_R, StringViz, stringPoint } from "./scene";
import timeline from "../../../public/guitar-string/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type NoteE = { beat: number; len: number; pitch: number; vel: number; frame: number; string: number; fret: number; harm?: number };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; kicks: { frame: number; hold: number }[]; lead: NoteE[]; bass: NoteE[]; mids: NoteE[]; stabs: NoteE[][]; gtrOpen: number[]; bassOpen: number[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const hz = (p: number) => 440 * Math.pow(2, (p - 69) / 12);

// ---------------------------------------------------------------- what each string is doing
type Part = "kick" | "bass" | "mids" | "lead" | "stab";
type Ev = { f0: number; f1: number; fret: number; harm: number; vel: number; part: Part; pitch: number; string: number };
const PART_COL: Record<Part, string> = { kick: C["ffffff"], bass: C["0099db"], mids: C["f77622"], lead: C["fee761"], stab: C["ffffff"] };
/** How long each part's string keeps ringing (s): the kick is held flat to the next hit, so its string barely fades. */
const TAU: Record<Part, number> = { kick: 3, bass: 0.9, mids: 0.6, lead: 0.7, stab: 0.5 };
const gtrEv: Ev[][] = [[], [], [], [], [], []], bassEv: Ev[][] = [[], [], [], []];
const ev = (n: NoteE, part: Part): Ev => ({ f0: n.frame, f1: n.frame + n.len * FPB, fret: n.fret, harm: n.harm ?? 1, vel: n.vel, part, pitch: n.pitch, string: n.string });
T.kicks.forEach((k) => gtrEv[5].push({ f0: k.frame, f1: k.frame + k.hold * FPB, fret: 0, harm: 1, vel: 1, part: "kick", pitch: 40, string: 6 }));
T.lead.forEach((n) => gtrEv[n.string - 1].push(ev(n, "lead")));
T.mids.forEach((n) => gtrEv[n.string - 1].push(ev(n, "mids")));
T.stabs.forEach((v) => v.forEach((n) => gtrEv[n.string - 1].push(ev(n, "stab"))));
T.bass.forEach((n) => bassEv[n.string - 1].push(ev(n, "bass")));
for (const l of [...gtrEv, ...bassEv]) l.sort((a, b) => a.f0 - b.f0);

/** The latest note on a string at frame f (across the loop seam), its age and its loudness now. */
function current(list: Ev[], f: number) {
  let best: { e: Ev; age: number } | null = null;
  for (const e of list) for (const g of [e.f0, e.f0 - DURATION]) {
    const age = f - g;
    if (age >= 0 && (!best || age < best.age)) best = { e, age };
  }
  if (!best) return null;
  const { e, age } = best;
  const held = e.f1 - e.f0;
  let a = e.vel * Math.exp(-age / FPS / TAU[e.part]);
  if (age >= held) a = e.vel * Math.exp(-held / FPS / TAU[e.part]) * Math.exp(-(age - held) / 1.5);
  return { e, age, a };
}
const since = (frames: number[], f: number) => { let b = Infinity; for (const e of frames) for (const g of [e, e - DURATION]) if (g <= f && f - g < b) b = f - g; return b; };
const kickOn = T.kicks.map((k) => k.frame);

// ---------------------------------------------------------------- the physics of a plucked string
const MODES = 40;
/** The plucked shape at time tau (in swings: 1 = one full swing), as the sum of its modes; peak height 1 at t = 0. */
function plucked(beta: number, s: number, tau: number) {
  let y = 0;
  for (let n = 1; n <= MODES; n++) y += (Math.sin(n * Math.PI * beta) / (n * n)) * Math.sin(n * Math.PI * s) * Math.cos(2 * Math.PI * n * tau);
  return y / plucked0(beta);
}
const p0Cache = new Map<number, number>();
function plucked0(beta: number) {
  if (!p0Cache.has(beta)) { let y = 0; for (let n = 1; n <= MODES; n++) y += (Math.sin(n * Math.PI * beta) ** 2) / (n * n); p0Cache.set(beta, y); }
  return p0Cache.get(beta)!;
}
/** How far each point of a plucked string swings at most (the blur a camera sees), for a pluck at beta. */
const envCache = new Map<number, Float32Array>();
function envelope(beta: number) {
  const key = Math.round(beta * 1000);
  if (envCache.has(key)) return envCache.get(key)!;
  const out = new Float32Array(NP);
  for (let k = 0; k < NP; k++) {
    const s = k / (NP - 1);
    let m = 0;
    for (let j = 0; j < 48; j++) m = Math.max(m, Math.abs(plucked(beta, s, j / 48)));
    out[k] = m;
  }
  envCache.set(key, out);
  return out;
}
const lerpTab = (tab: Float32Array, s: number) => { const x = s * (NP - 1), i = Math.min(NP - 2, Math.floor(x)); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };

/** Swing drawn wider than real (said on screen): a real swing is 1-3 mm. */
const SWING = { low: 2.6, gtr: 0.55, mid: 0.5, bass: 1.1, harm: 3.2 };
/** The low string in slow motion: 33x slower, so one swing is one beat. */
const slowMo = (f: number) => { const b = Math.floor(f / BAR); return (b >= 2 && b < 6) || (b >= 12 && b < 16); };
const ghostsOn = (f: number) => { const b = Math.floor(f / BAR); return b >= 12 && b < 16; };

/** The low string's loops, drawn as copies of it floating beside it, between the guitar and the bass. */
const ghostPoint = (k: number, u: number, dx: number, out: THREE.Vector3) => stringPoint(GTR, 6, u, dx, out).add(new THREE.Vector3(6 + 6 * k, 6, 0));

// ---------------------------------------------------------------- camera
type Key = { f: number; t: [number, number, number]; az: number; el: number; d: number };
const START: Key = { f: 0, t: [18, 6, -24], az: 0.0, el: 1.0, d: 175 };
const KEYS: Key[] = [
  START,
  { f: 2 * BAR - 6, t: [16, 6, -24], az: 0.05, el: 0.98, d: 165 },
  // the low string in slow motion, seen from above along its whole length (the bass stays in the frame)
  { f: 2 * BAR + 12, t: [12, 11, -32], az: 0.1, el: 1.32, d: 150 },
  { f: 4 * BAR - 6, t: [12, 11, -32], az: 0.16, el: 1.3, d: 142 },
  { f: 4 * BAR + 12, t: [12, 11, -32], az: -0.1, el: 1.28, d: 150 },
  { f: 6 * BAR - 6, t: [12, 11, -32], az: -0.16, el: 1.26, d: 144 },
  // the frets
  { f: 6 * BAR + 12, t: [6, 11, -36], az: 0.3, el: 1.1, d: 96 },
  { f: 8 * BAR - 6, t: [6, 11, -38], az: 0.36, el: 1.1, d: 92 },
  // harmonics on string 1, from above
  { f: 8 * BAR + 12, t: [6, 11, -40], az: 0.04, el: 1.4, d: 172 },
  { f: 12 * BAR - 6, t: [6, 11, -40], az: -0.04, el: 1.4, d: 166 },
  // the loops beside the low string
  { f: 12 * BAR + 12, t: [14, 14, -32], az: 0.22, el: 1.24, d: 150 },
  { f: 16 * BAR - 6, t: [14, 14, -32], az: 0.1, el: 1.26, d: 142 },
  // the bass string vs the low string
  { f: 16 * BAR + 12, t: [24, 6, -30], az: -0.35, el: 0.65, d: 140 },
  { f: 18 * BAR, t: [22, 6, -28], az: -0.2, el: 0.75, d: 150 },
  { f: 20 * BAR - 6, t: [20, 6, -26], az: 0.0, el: 0.8, d: 150 },
  // the sound hole
  { f: 20 * BAR + 12, t: [6, 11, -10], az: 0.22, el: 0.95, d: 92 },
  { f: 22 * BAR + 12, t: [8, 10, -12], az: 0.1, el: 0.98, d: 100 },
  { ...START, f: DURATION },
];
function camAt(f: number) {
  const fs = KEYS.map((k) => k.f);
  const v = (g: (k: Key) => number) => interpolate(f, fs, KEYS.map(g), { ...clamp, easing: ease });
  const sway = 0;
  const az = v((k) => k.az) + sway, el = v((k) => k.el), d = Math.exp(v((k) => Math.log(k.d)));
  const look = new THREE.Vector3(v((k) => k.t[0]), v((k) => k.t[1]), v((k) => k.t[2]));
  const pos = look.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
  return { pos, look };
}

// ---------------------------------------------------------------- per frame
let S: GuitarScene | null = null;
const v3 = new THREE.Vector3(), proj = new THREE.Vector3();
const dummy = new THREE.Object3D();
const col = new THREE.Color();

type Now = { low: ReturnType<typeof current>; lead: ReturnType<typeof current>; bass: ReturnType<typeof current> };

function drawString(viz: StringViz, inst: Inst, i: number, list: Ev[], f: number, swing: number, base: string, fingers: THREE.Vector3[]) {
  const cur = current(list, f);
  const a = cur ? cur.a : 0;
  const e = cur?.e;
  const slow = inst === GTR && i === 6 && slowMo(f) && cur && cur.e.part === "kick";
  // the shape: a fretted string swings only between the fret and the bridge
  const uf = e && e.harm === 1 ? fretU(e.fret) : 1;
  const beta = Math.min(0.45, inst.beta / uf);
  const env = envelope(beta);
  const amp = a * (e && e.harm > 1 ? SWING.harm : swing);
  for (let k = 0; k < NP; k++) {
    const u = k / (NP - 1);
    let dx = 0, w = 0;
    if (e && amp > 0.01) {
      if (e.harm > 1) w = Math.abs(Math.sin(e.harm * Math.PI * u));
      else if (u <= uf) {
        const s = u / uf;
        if (slow) dx = amp * plucked(beta, s, cur!.age / FPB);
        else w = lerpTab(env, s);
      }
    }
    stringPoint(inst, i, u, dx, v3);
    viz.pos[3 * k] = v3.x; viz.pos[3 * k + 1] = v3.y; viz.pos[3 * k + 2] = v3.z;
    const r = slow ? 0.16 : w * amp;
    viz.rpos[6 * k] = v3.x - r; viz.rpos[6 * k + 1] = v3.y - 0.02; viz.rpos[6 * k + 2] = v3.z;
    viz.rpos[6 * k + 3] = v3.x + r; viz.rpos[6 * k + 4] = v3.y - 0.02; viz.rpos[6 * k + 5] = v3.z;
  }
  viz.line.geometry.attributes.position.needsUpdate = true;
  viz.ribbon.geometry.attributes.position.needsUpdate = true;
  viz.ribbon.visible = slow || amp > 0.03;
  const pc = e ? PART_COL[e.part] : base;
  viz.ribbonMat.color.set(pc);
  viz.ribbonMat.opacity = slow || (e && e.harm > 1) ? 0.95 : Math.min(0.6, 0.2 + a * 0.45);
  col.set(base).lerp(new THREE.Color(pc), Math.min(1, a * 1.3));
  viz.lineMat.color.copy(col);
  // the pluck: a flash where the string is picked
  if (cur && cur.age < 4) {
    viz.spark.visible = true;
    stringPoint(inst, i, inst.beta, 0, v3);
    viz.spark.position.copy(v3).add(new THREE.Vector3(0, 0.6, 0));
    viz.spark.scale.setScalar((inst === GTR && i === 6 ? 1.6 : 1.0) * (1 - cur.age / 4));
    viz.sparkMat.color.set(pc);
  } else viz.spark.visible = false;
  // a fingertip on the fret while the note sounds
  if (cur && e && cur.age < e.f1 - e.f0) {
    if (e.harm > 1) fingers.push(stringPoint(inst, i, 1 - 1 / e.harm, 0, new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)));
    else if (e.fret > 0) fingers.push(stringPoint(inst, i, Math.min(1, fretU(e.fret) + 0.012), 0, new THREE.Vector3()).add(new THREE.Vector3(0, 0.45, 0)));
  }
  return cur;
}

function setScene(f: number): Now {
  S ??= buildScene(W, H);
  const fingers: THREE.Vector3[] = [];
  let low: Now["low"] = null, lead: Now["lead"] = null, bassNow: Now["bass"] = null;
  for (let i = 1; i <= 6; i++) {
    const sw = i === 6 ? SWING.low : i >= 4 ? SWING.mid : SWING.gtr;
    const c = drawString(S.gtr[i - 1], GTR, i, gtrEv[i - 1], f, sw, i <= 3 ? C["c0cbdc"] : C["feae34"], fingers);
    if (i === 6) low = c;
  }
  for (let i = 1; i <= 4; i++) {
    const c = drawString(S.bass[i - 1], BASS, i, bassEv[i - 1], f, SWING.bass, C["c0cbdc"], fingers);
    if (c && (!bassNow || c.age < bassNow.age)) bassNow = c;
  }
  // the hook's string: the most recent lead note
  for (let i = 1; i <= 3; i++) {
    const c = current(gtrEv[i - 1].filter((e) => e.part === "lead"), f);
    if (c && (!lead || c.age < lead.age)) lead = c;
  }
  S.fingers.count = Math.min(MAX_FINGERS, fingers.length);
  fingers.slice(0, MAX_FINGERS).forEach((p, k) => { dummy.position.copy(p); dummy.scale.setScalar(1); dummy.updateMatrix(); S!.fingers.setMatrixAt(k, dummy.matrix); });
  S.fingers.instanceMatrix.needsUpdate = true;
  // the fret under the hook's finger lights up
  S.fretMats.forEach((m) => (m.emissiveIntensity = 0));
  if (lead && lead.e.harm === 1 && lead.e.fret > 0 && lead.age < lead.e.f1 - lead.e.f0) S.fretMats[lead.e.fret - 1].emissiveIntensity = 1.2 * Math.min(1, lead.a + 0.3);
  // the light touch of a harmonic, at L/n from the nut
  const harmOn = lead && lead.e.harm > 1 && lead.age < lead.e.f1 - lead.e.f0;
  S.touch[0].visible = !!harmOn;
  if (harmOn) { stringPoint(GTR, 1, 1 - 1 / lead!.e.harm, 0, v3); S.touch[0].position.set(v3.x, v3.y + 0.1, v3.z); }
  // the drop: the low string's loops 1, 2, 4, each swinging n times a beat (slowed 33x), drawn above it
  const showG = ghostsOn(f) && low && low.e.part === "kick";
  S.ghosts.forEach((g, k) => {
    g.line.visible = !!showG;
    if (!showG) return;
    const n = GHOSTS[k];
    const amp = 2.4 * low!.a * [1, 0.8, 0.65][k];
    for (let j = 0; j < NP; j++) {
      const u = j / (NP - 1);
      const dx = amp * Math.sin(n * Math.PI * u) * Math.cos(2 * Math.PI * n * (low!.age / FPB));
      ghostPoint(k, u, dx, v3);
      g.pos[6 * j] = v3.x - 0.22; g.pos[6 * j + 1] = v3.y; g.pos[6 * j + 2] = v3.z;
      g.pos[6 * j + 3] = v3.x + 0.22; g.pos[6 * j + 4] = v3.y; g.pos[6 * j + 5] = v3.z;
    }
    g.line.geometry.attributes.position.needsUpdate = true;
  });
  // the turn: the wood and the hole push the air on every kick
  const bar = Math.floor(f / BAR);
  const kick = Math.exp(-since(kickOn, f) / 2.5);
  S.topMat.emissiveIntensity = bar >= 20 ? 0.35 * kick : 0;
  let r = 0;
  for (const k of T.kicks) {
    if (k.frame < 20 * BAR) continue;
    for (const g of [k.frame, k.frame - DURATION]) {
      const age = f - g;
      if (age < 0 || age >= 30 || r >= RINGS) continue;
      const ring = S.rings[r++];
      ring.line.visible = true;
      ring.line.position.set(SOUNDHOLE.x, GTR_TOP + 0.5 + 0.45 * age, SOUNDHOLE.z);
      ring.line.scale.setScalar(SOUNDHOLE_R + 0.9 * age);
      ring.mat.opacity = 1 - age / 30;
    }
  }
  for (; r < RINGS; r++) S.rings[r].line.visible = false;

  const { pos, look } = camAt(f);
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.setViewOffset(W, H, 0, 22, W, H);
  S.camera.updateMatrixWorld();
  return { low, lead, bass: bassNow };
}

function toScreen(p: THREE.Vector3) {
  proj.copy(p).project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H, front: proj.z < 1 };
}

// ---------------------------------------------------------------- captions: one idea each, 2 bars
function captionAt(f: number): [string, string] | "code" {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["EVERY KICK IS THIS", "STRING BEING PLUCKED"];
  if (bar < 4) return ["IT SWINGS 82 TIMES", "EVERY SECOND"];
  if (bar < 6) return ["THE BEND RUNS TO BOTH", "ENDS AND BOUNCES BACK"];
  if (bar < 8) return ["PRESS A FRET: SHORTER", "STRING, HIGHER NOTE"];
  if (bar < 10) return ["TOUCH IT AT THE MIDDLE:", "2 LOOPS, 1 OCTAVE UP"];
  if (bar < 12) return ["A THIRD: 3 LOOPS", "A QUARTER: 4 LOOPS"];
  if (bar < 14) return ["ONE PLUCK SWINGS IN", "MANY LOOPS AT ONCE"];
  if (bar < 16) return ["THAT MIX IS WHY A GUITAR", "SOUNDS LIKE A GUITAR"];
  if (bar < 18) return ["LONGER, THICKER STRING:", "ONE OCTAVE LOWER"];
  if (bar < 20) return "code";
  if (bar < 22) return ["THE WOOD AND THE HOLE", "PUSH THE AIR"];
  return ["SWING, LENGTH, LOOPS:", "THAT IS A NOTE"];
}

function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 444, W - 2 * M, 62, C["5a6988"]);
    rect(M, 444, 3, 62, C["fee761"]);
    text("f = n * v / (2 * L)", M + 12, 452, "p8", C["ffffff"]);
    text("v = sqrt(T / mu)", M + 12, 468, "p8", C["fee761"]);
    text("MORE LOOPS, SHORTER: HIGHER", M + 12, 486, "s16", C["c0cbdc"]);
    return;
  }
  const l1 = measure(cap[0], "p16") <= W - 2 * M - 20 ? "p16" : "s16";
  const w = Math.min(W - 2 * M, Math.max(measure(cap[0], l1), measure(cap[1], "s16")) + 28);
  panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
  text(cap[0], W / 2, 460, l1, C["ffffff"], "c");
  text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const now = setScene(f);
  ctx.clearRect(0, 0, W, H);
  S!.renderer.render(S!.scene, S!.camera);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { text, rect, panel } = pixelKit(ov);
  const bar = Math.floor(f / BAR);
  const label = (s: string, at: THREE.Vector3, tx: number, ty: number, c: string = C["ffffff"]) => {
    const p = toScreen(at);
    if (!p.front || p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    rect(Math.min(p.x, tx), ty + 4, Math.abs(tx - p.x), 1, C["c0cbdc"]);
    rect(p.x, Math.min(p.y, ty + 4), 1, Math.abs(ty + 4 - p.y), C["c0cbdc"]);
    rect(p.x - 1, p.y - 1, 3, 3, c);
    text(s, tx, ty - 4, "s16", c, tx < W / 2 ? "r" : "l", C["181425"]);
  };
  const sp = (inst: Inst, i: number, u: number) => stringPoint(inst, i, u, 0, new THREE.Vector3());
  if (!cover) {
    if (bar < 4) label("LOW STRING", sp(GTR, 6, 0.45), W - M - 96, 214);
    if (bar < 2) label("BASS", new THREE.Vector3(BASS.xb[2], BASS_TOP, 14), W - M - 50, 400, C["0099db"]);
    if (bar >= 4 && bar < 6) {
      label("BRIDGE", sp(GTR, 6, 0), M + 70, 400);
      label("NUT", sp(GTR, 6, 1), W - M - 40, 214);
    }
    if (bar >= 6 && bar < 8 && now.lead && now.lead.e.fret > 0) label("FRET", sp(GTR, now.lead.e.string, fretU(now.lead.e.fret)), M + 60, 230, C["fee761"]);
    if (bar >= 8 && bar < 12 && now.lead && now.lead.e.harm > 1) label("LIGHT TOUCH", sp(GTR, 1, 1 - 1 / now.lead.e.harm), M + 100, 230);
    if (ghostsOn(f) && S!.ghosts[0].line.visible) {
      ["1 LOOP", "2 LOOPS", "4 LOOPS"].forEach((s, k) => {
        const p = ghostPoint(k, 0.62, 0, new THREE.Vector3());
        label(s, p, W - M - 70, 232 + 28 * k, [C["2ce8f5"], C["f77622"], C["b55088"]][k]);
      });
    }
    if (bar >= 16 && bar < 20) {
      label("86 CM", sp(BASS, 4, 0.55), W - M - 50, 236, C["0099db"]);
      label("65 CM", sp(GTR, 6, 0.55), M + 56, 236);
    }
    if (bar >= 20 && bar < 22) label("SOUND HOLE", new THREE.Vector3(SOUNDHOLE.x - SOUNDHOLE_R, GTR_TOP, SOUNDHOLE.z), M + 100, 400);
  }

  if (cover) {
    panel(M, 86, W - 2 * M, 60, C["c0cbdc"]);
    text("WHY DOES A GUITAR", W / 2, 96, "p16", C["c0cbdc"], "c");
    text("STRING SING?", W / 2, 120, "p16", C["fee761"], "c", C["be4a2f"]);
  } else {
    panel(M, 30, W - 2 * M, 56, C["c0cbdc"]);
    text("WHY DOES A GUITAR", W / 2, 38, "p16", C["c0cbdc"], "c");
    text("STRING SING?", W / 2, 60, "p16", C["fee761"], "c", C["be4a2f"]);
    // the readouts: how many times a second the string in the story swings (at most two)
    const rows: [string, string, string][] = [];
    const leadHz = now.lead ? `${Math.round(hz(now.lead.e.pitch))}` : "0";
    if (bar < 6 || bar >= 20) rows.push(["LOW STRING", "82", C["ffffff"]]);
    if ((bar >= 6 && bar < 8) || bar >= 12 && bar < 16) rows.push(["HIGH STRING", leadHz, C["fee761"]]);
    if (bar >= 8 && bar < 12) rows.push(["HIGH STRING", leadHz, C["fee761"]], ["LOOPS", `${now.lead?.e.harm ?? 1}`, C["ffffff"]]);
    if (bar >= 12 && bar < 16) rows.unshift(["LOW STRING", "82", C["ffffff"]]);
    if (bar >= 16 && bar < 20) rows.push(["LOW STRING", "82", C["ffffff"]], ["BASS STRING", now.bass ? `${Math.round(hz(now.bass.e.pitch))}` : "0", C["0099db"]]);
    if (bar >= 6 && bar < 8) rows.unshift(["LOW STRING", "82", C["ffffff"]]);
    const shown = rows.slice(0, 2);
    const ph = 24 + 22 * shown.length;
    panel(M, 92, W - 2 * M, ph);
    text(bar >= 8 && bar < 12 ? "SWINGS A SECOND, LOOPS" : "SWINGS A SECOND", M + 8, 97, "s16", C["8b9bb4"]);
    shown.forEach(([name, val, c], k) => {
      text(name, M + 8, 118 + 22 * k, "s16", c);
      text(val, W - M - 8, 119 + 22 * k, "p16", C["ffffff"], "r");
    });
    const tag = slowMo(f) ? "LOW STRING SLOWED 33X" : "SWING DRAWN WIDER";
    text(tag, W - M, 92 + ph + 4, "s16", C["8b9bb4"], "r", C["181425"]);
    drawCaption(ov, f);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const GuitarStringVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("guitar-string/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const GuitarString = () => (
  <Composition id="GuitarString" component={GuitarStringVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the drop, the low string with its loops. */
export const GuitarStringCover = () => (
  <Still id="GuitarStringCover" component={GuitarStringVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 12 * BAR + 30 }} />
);
