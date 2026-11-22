import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, coneY, DOTS, EAR_W, EARDRUM_Z, LISTENER_X, PHONE_W, RINGS, SpeakerScene, TWEETER_W, WOOFER_W, WZ } from "./scene";
import timeline from "../../../public/speaker/timeline.json";
import coneData from "../../../public/speaker/cone.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type NoteE = { beat: number; len: number; pitch: number; vel: number; frame: number };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; kicks: { frame: number }[]; lead: NoteE[]; bass: NoteE[]; mids: NoteE[]; stabs: NoteE[][] };
type ConeF = { w: [number, number]; t: [number, number]; wHz: number; tHz: number; ws: string; ts: string };
const T = timeline as unknown as TL;
const CD = coneData as unknown as { frames: ConeF[]; scopePoints: number; scopeLevels: number };
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const HAS_TRACK = true;
/** The cone's swing is a few mm: drawn 5x so it shows (said on screen). */
const SWING_X = 5;
/** Sound crosses the 3 m room in one beat on screen (0.4 s); really it takes 1/115 s. 343 / 7.5 = 46x slower. */
const C_V = LISTENER_X / FPB; // cm per frame
const hz = (p: number) => 440 * Math.pow(2, (p - 69) / 12);
/** Wavelengths drawn in proportion to the real ones (lambda = c / f), at one shared scale. */
const lam = (f: number) => 3000 / f;

/** Frames since the latest event at or before f, across the loop seam. */
const since = (frames: number[], f: number) => { let best = Infinity; for (const e of frames) for (const g of [e, e - DURATION]) if (g <= f && f - g < best) best = f - g; return best; };
const leadOn = T.lead.map((n) => n.frame), bassOn = T.bass.map((n) => n.frame), stabOn = T.stabs[0].map((n) => n.frame), kickOn = T.kicks.map((k) => k.frame);
const playing = (notes: NoteE[], f: number) => notes.some((n) => f >= n.frame && f < n.frame + n.len * FPB);
/** The speaker part in world coordinates (the speaker is built lying down, then stood up: world = (ly, 16 - lz, lx)). */
const L2W = (lx: number, ly: number, lz: number) => new THREE.Vector3(ly, 16 - lz, lx);

// ---------------------------------------------------------------- the waves: every sound is a push that leaves the speaker
type Packet = { f0: number; lam: number; amp: number; len: number; kind: 0 | 1 | 2 };
const LOW: Packet[] = [
  ...T.kicks.map((k) => ({ f0: k.frame, lam: lam(82.4), amp: 3.0, len: 2.2, kind: 0 as const })),
  ...T.bass.map((n) => ({ f0: n.frame, lam: lam(hz(n.pitch)), amp: 1.4, len: 1.2, kind: 1 as const })),
  ...T.mids.filter((_, i) => i % 2 === 0).map((n) => ({ f0: n.frame, lam: lam(hz(n.pitch)), amp: 1.2 * n.vel, len: 3, kind: 2 as const })),
];
type Ring = { f0: number; lam: number; white: boolean };
const HIGH: Ring[] = [
  ...T.lead.map((n) => ({ f0: n.frame, lam: Math.max(3.2, lam(hz(n.pitch))), white: false })),
  ...T.stabs[0].map((n) => ({ f0: n.frame, lam: 4.5, white: true })),
];
const MAX_AGE = Math.ceil((LISTENER_X + 120) / C_V);
function active<P extends { f0: number }>(list: P[], f: number) {
  const out: { p: P; age: number }[] = [];
  for (const p of list) for (const g of [p.f0, p.f0 - DURATION, p.f0 + DURATION]) { const age = f - g; if (age >= 0 && age < MAX_AGE) out.push({ p, age }); }
  return out;
}
const KIND_COL = [new THREE.Color(C["ffffff"]), new THREE.Color(C["0099db"]), new THREE.Color(C["f77622"])];
const BASE_COL = new THREE.Color(C["262b44"]);

// ---------------------------------------------------------------- camera: phone -> cable -> into the magnet -> out the front -> across the room -> into the ear -> back
type Key = { f: number; t: [number, number, number]; az: number; el: number; d: number };
const KEYS: Key[] = [
  { f: 0, t: [-28, 14, 0], az: 0.55, el: 0.3, d: 190 },
  { f: 3 * BAR, t: [-12, 16, 0], az: 0.75, el: 0.25, d: 140 },
  // the cut face (the plane z = 0, below the woofer's centre) seen side-on: the cone, coil and magnet in profile
  { f: 4 * BAR + 6, t: [-7, 7, 0], az: 0.12, el: 0.02, d: 36 },
  { f: 8 * BAR - 12, t: [-6, 7, 0], az: -0.12, el: 0.04, d: 30 },
  { f: 8 * BAR + 18, t: [30, 30, 0], az: 0.8, el: 0.12, d: 190 },
  { f: 12 * BAR - 6, t: [40, 32, 0], az: 0.65, el: 0.12, d: 200 },
  { f: 12 * BAR + 18, t: [100, 38, 0], az: 0.25, el: 0.12, d: 190 },
  { f: 16 * BAR, t: [215, 38, 0], az: -0.2, el: 0.12, d: 190 },
  { f: 18 * BAR, t: [EAR_W.x - 4, EAR_W.y, 6], az: -0.55, el: 0.12, d: 90 },
  { f: 19 * BAR + 18, t: [EAR_W.x - 2, EAR_W.y, EAR_W.z], az: -0.45, el: 0.15, d: 45 },
  { f: 20 * BAR - 6, t: [EAR_W.x, EAR_W.y, EAR_W.z], az: -0.2, el: 0.2, d: 14 },
  { f: 20 * BAR + 18, t: [EAR_W.x, EAR_W.y + 0.2, EARDRUM_Z + 0.9], az: 0.95, el: 0.55, d: 7 },
  { f: 23 * BAR - 6, t: [EAR_W.x, EAR_W.y + 0.2, EARDRUM_Z + 0.9], az: 1.25, el: 0.45, d: 6.5 },
  { f: 23 * BAR + 12, t: [EAR_W.x, EAR_W.y, EAR_W.z], az: -0.3, el: 0.2, d: 60 },
  { f: DURATION, t: [-28, 14, 0], az: 0.55, el: 0.3, d: 190 },
];
function camAt(f: number) {
  const fs = KEYS.map((k) => k.f);
  const v = (g: (k: Key) => number) => interpolate(f, fs, KEYS.map(g), { ...clamp, easing: ease });
  const sway = f >= 12 * BAR && f < 16 * BAR ? 0.1 * Math.sin((2 * Math.PI * (f - 12 * BAR)) / (4 * BAR)) : 0;
  const az = v((k) => k.az) + sway, el = v((k) => k.el), d = Math.exp(v((k) => Math.log(k.d)));
  const look = new THREE.Vector3(v((k) => k.t[0]), v((k) => k.t[1]), v((k) => k.t[2]));
  const pos = look.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
  return { pos, look, d };
}
/** Inside the ear: the head turns see-through (the camera has gone in through the ear canal). */
const inEar = (f: number) => f >= 20 * BAR - 2 && f < 23 * BAR + 4;

let S: SpeakerScene | null = null;
const proj = new THREE.Vector3();
const dummy = new THREE.Object3D();
const col = new THREE.Color();

function setAir(f: number) {
  const low = active(LOW, f);
  const n = DOTS.length / 3;
  for (let i = 0; i < n; i++) {
    const x = DOTS[3 * i], y = DOTS[3 * i + 1], z = DOTS[3 * i + 2];
    const dx = x - WOOFER_W.x, dy = y - WOOFER_W.y, dz = z - WOOFER_W.z;
    const r = Math.hypot(dx, dy, dz);
    const g = 1 / (1 + r / 260);
    let disp = 0;
    col.copy(BASE_COL);
    let dark = 0, squeeze = 0;
    for (const { p, age } of low) {
      const s = r - C_V * age;
      const L = p.len * p.lam;
      if (s > 0 || s < -L) continue;
      const env = Math.pow(Math.sin((Math.PI * -s) / L), 2) * g;
      const ph = (2 * Math.PI * s) / p.lam;
      disp += p.amp * env * Math.sin(ph);
      const c = -Math.cos(ph) * env; // > 0 where the air is squeezed
      if (c > 0) { col.lerp(KIND_COL[p.kind], Math.min(1, c * 2)); squeeze = Math.max(squeeze, c); }
      else dark = Math.max(dark, -c);
    }
    if (dark > 0) col.multiplyScalar(1 - 0.75 * dark);
    dummy.position.set(x + (disp * dx) / r, y + (disp * dy) / r, z + (disp * dz) / r);
    dummy.scale.setScalar(0.8 + 1.4 * squeeze);
    dummy.updateMatrix();
    S!.dots.setMatrixAt(i, dummy.matrix);
    S!.dots.setColorAt(i, col);
  }
  S!.dots.instanceMatrix.needsUpdate = true;
  S!.dots.instanceColor!.needsUpdate = true;
  // the small cone's waves: three thin rings per note
  let k = 0;
  for (const { p, age } of active(HIGH, f)) {
    for (let j = 0; j < 3 && k < RINGS; j++) {
      const r = C_V * age - j * p.lam;
      if (r <= 0.5 || r > LISTENER_X - 6) continue;
      const ring = S!.rings[k++];
      ring.visible = true;
      ring.scale.setScalar(r);
      S!.ringMats[k - 1].color.set(p.white ? C["ffffff"] : C["fee761"]);
      S!.ringMats[k - 1].opacity = Math.max(0.25, 1 - r / (LISTENER_X + 40)) * (j === 0 ? 1 : 0.7);
    }
  }
  for (; k < RINGS; k++) S!.rings[k].visible = false;
}

function setScene(f: number) {
  S ??= buildScene(W, H);
  const cf = CD.frames[f];
  const swing = cf.w[1] - cf.w[0];
  const kick = Math.exp(-since(kickOn, f) / 2);
  // the current: lights the cable and the coil; each kick is a surge
  S.cableMat.emissiveIntensity = 0.1 + 0.7 * Math.min(1, swing / 4) + 1.6 * kick;
  S.coilMat.emissiveIntensity = 0.15 + 0.9 * Math.min(1, swing / 4) + 1.2 * Math.exp(-since(bassOn, f) / 1.5) + 0.8 * kick;
  S.phoneScreen.emissiveIntensity = 0.5 + 0.8 * kick;
  const sl = since(leadOn, f), ss = since(stabOn, f);
  const stab = Math.exp(-ss / 2.5);
  S.tweeterMat.emissive.set(stab > 0.3 ? C["ffffff"] : C["fee761"]);
  S.tweeterMat.emissiveIntensity = (playing(T.lead, f) ? 0.35 : 0) + 1.1 * Math.exp(-sl / 2) + 1.6 * stab;
  S.tweeterRing.emissiveIntensity = 0.5 * stab;
  S.cochleaMat.emissiveIntensity = 1.2 * Math.exp(-sl / 2) + 0.6 * kick + 1.2 * stab;
  setAir(f);
  const { pos, look, d } = camAt(f);
  const inside = inEar(f);
  S.headShell.visible = !inside;
  S.earSet.visible = inside || d < 20;
  S.camera.near = Math.min(2, Math.max(0.08, d / 40));
  S.camera.updateProjectionMatrix();
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.setViewOffset(W, H, 0, 22, W, H);
  S.camera.updateMatrixWorld();
  return { cf, inside };
}

/** Screen position (low-res px) of a world point. */
function toScreen(p: THREE.Vector3) {
  proj.copy(p).project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H, front: proj.z < 1 };
}

// ---------------------------------------------------------------- captions: one idea each, 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["THE SONG LEAVES THE PHONE", "AS ELECTRICITY"];
  if (bar < 4) return ["EVERY KICK IS A SURGE", "DOWN THE CABLE"];
  if (bar < 6) return ["INSIDE: A COIL", "SITTING IN A MAGNET"];
  if (bar < 8) return ["THE CURRENT PUSHES IT OUT", "AND PULLS IT BACK IN"];
  if (bar < 10) return ["THE CONE SQUEEZES THE AIR", "LOW NOTES: WIDE WAVES"];
  if (bar < 12) return ["SMALL CONE, HIGH NOTES:", "TIGHT, FAST WAVES"];
  if (bar < 14) return ["EVERY PUSH IS A WAVE", "RACING ACROSS THE ROOM"];
  if (bar < 16) return ["SLOWED 46X: FOR REAL IT", "TAKES 1/100 OF A SECOND"];
  if (bar < 18) return ["THE WAVES", "REACH YOUR EAR"];
  if (bar < 20) return "code";
  if (bar < 22) return ["YOUR EARDRUM MOVES", "JUST LIKE THE CONE"];
  return ["EVERY SOUND YOU HEAR", "IS AIR BEING PUSHED"];
}

function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 444, W - 2 * M, 62, C["5a6988"]);
    rect(M, 444, 3, 62, C["fee761"]);
    text("F = B * I * L", M + 12, 452, "p8", C["ffffff"]);
    text("air(r, t) = cone(t - r / c)", M + 12, 468, "p8", C["fee761"]);
    text("FORCE MOVES CONE MOVES AIR", M + 12, 486, "s16", C["c0cbdc"]);
  } else if (cap) {
    const l1 = measure(cap[0], "p16") <= W - 2 * M - 20 ? "p16" : "s16";
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], l1), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, l1, C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
  }
}

/** A readout, steadied over 7 frames (the true peak flickers between the kick and the bass from frame to frame). */
function steadyHz(f: number, key: "wHz" | "tHz") {
  const v: number[] = [];
  for (let d = -3; d <= 3; d++) v.push(CD.frames[(f + d + DURATION) % DURATION][key]);
  v.sort((a, b) => a - b);
  const m = v[3];
  return key === "tHz" ? Math.round(m / 10) * 10 : m;
}

function drawLane(ov: CanvasRenderingContext2D, y: number, name: string, hz: number, data: string, gain: number, col: string) {
  const { rect, text } = pixelKit(ov);
  text(name, M + 8, y, "s16", col);
  text(hz > 0 ? `${hz}` : "0", W - M - 8, y + 2, "p16", C["ffffff"], "r");
  const x0 = M + 8, w = W - 2 * M - 16, mid = y + 30, amp = 11;
  rect(x0, mid, w, 1, C["3a4466"]);
  const N = data.length, L = CD.scopeLevels - 1;
  let py = mid;
  for (let k = 0; k < N; k++) {
    const v = ((data.charCodeAt(k) - 35) / L) * 2 - 1;
    const yy = Math.round(mid - v * amp * gain);
    const x = x0 + (k * w) / N;
    if (k) rect(x, Math.min(py, yy), Math.max(1, w / N), Math.abs(yy - py) + 1, col);
    py = yy;
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const { cf, inside } = setScene(f);
  // the cone (and the eardrum) swing faster than the frames: draw both ends of this frame's swing, blended
  const pose = (w: number) => {
    S!.moving.position.y = (w / 10) * SWING_X;
    S!.eardrum.position.z = EARDRUM_Z + (w / 2.5) * 0.12;
  };
  ctx.clearRect(0, 0, W, H);
  pose(cf.w[0]);
  S!.renderer.render(S!.scene, S!.camera);
  ctx.globalAlpha = 1;
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  pose(cf.w[1]);
  S!.renderer.render(S!.scene, S!.camera);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.globalAlpha = 1;
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
  if (!cover) {
    if (bar < 2) {
      label("PHONE", PHONE_W, M + 60, 400);
      label("SPEAKER", new THREE.Vector3(-13, 30, 14), W - M - 76, 236);
    }
    if (bar >= 4 && bar < 8 && f >= 4 * BAR + 6) {
      label("CONE", L2W(6.5 * Math.sin(0.02), coneY(6.5), WZ + 6.5), W - M - 70, 250);
      label("COIL", L2W(2.77, -9.4, WZ), W - M - 70, 300, C["feae34"]);
      label("MAGNET", L2W(6.5, -11.7, WZ), M + 76, 380);
    }
    if (bar >= 8 && bar < 12 && f >= 8 * BAR + 18) {
      label("BIG CONE", WOOFER_W, M + 96, 410);
      label("SMALL CONE", TWEETER_W, M + 110, 236, C["fee761"]);
    }
    if (bar >= 16 && bar < 18) label("YOUR EAR", EAR_W, W - M - 80, 236);
    if (inside && bar >= 20) label("EAR CANAL", new THREE.Vector3(EAR_W.x, EAR_W.y - 0.3, EAR_W.z - 0.8), M + 100, 430);
    if (inside && bar >= 20 && bar < 22) label("EARDRUM", new THREE.Vector3(EAR_W.x, EAR_W.y, EARDRUM_Z), W - M - 76, 236, C["f6757a"]);
  }

  if (cover) {
    panel(M, 86, W - 2 * M, 60, C["c0cbdc"]);
    text("HOW DOES A SPEAKER", W / 2, 96, "p16", C["c0cbdc"], "c");
    text("MAKE SOUND?", W / 2, 120, "p16", C["fee761"], "c", C["be4a2f"]);
  } else {
    panel(M, 30, W - 2 * M, 56, C["c0cbdc"]);
    text("HOW DOES A SPEAKER", W / 2, 38, "p16", C["c0cbdc"], "c");
    text("MAKE SOUND?", W / 2, 60, "p16", C["fee761"], "c", C["be4a2f"]);
    const big = bar < 10 || bar >= 12, small = bar >= 10;
    const lanes = (big ? 1 : 0) + (small ? 1 : 0);
    const ph = 22 + 44 * lanes;
    panel(M, 92, W - 2 * M, ph);
    text("PUSHES A SECOND", M + 8, 97, "s16", C["8b9bb4"]);
    let y = 116;
    if (big) { drawLane(ov, y, "BIG CONE", steadyHz(f, "wHz"), cf.ws, 1, C["2ce8f5"]); y += 44; }
    if (small) drawLane(ov, y, "SMALL CONE", steadyHz(f, "tHz"), cf.ts, 0.4, C["fee761"]);
    const tag = bar >= 4 && bar < 8 ? "CONE SWING SHOWN 5X" : bar >= 8 && bar < 20 ? "SOUND SLOWED 46X" : inside ? "EARDRUM SWING SHOWN HUGE" : "REAL TIME";
    text(tag, W - M, 92 + ph + 4, "s16", C["8b9bb4"], "r", C["181425"]);
    drawCaption(ov, f);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const SpeakerVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined && HAS_TRACK ? <Audio src={staticFile("speaker/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const Speaker = () => (
  <Composition id="Speaker" component={SpeakerVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the drop, the waves crossing the room. */
export const SpeakerCover = () => (
  <Still id="SpeakerCover" component={SpeakerVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 13 * BAR + 4 }} />
);
