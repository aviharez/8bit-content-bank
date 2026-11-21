import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, GLASS_X, GLASS_Z, glassProfile, GlassScene, SPEAKER_Z } from "./scene";
import timeline from "../../../public/glass-resonance/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type V3 = [number, number, number];
type Shard = { p0: V3; v0: V3; w: V3; size: number; t1: number; t2: number; v1: V3; rest: V3 };
type Probe = { beat: number; midi: number; dur: number; drive: number };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; holdBar: number; dropBar: number; rewindBar: number; f0: number; q: number; slow: number; g: number;
  glass: { stemH: number; bowlH: number; bowlR: number; footR: number }; breakAmp: number; probe: Probe[]; frames: { amp: number; midi: number | null; drive: number }[];
  shards: Shard[]; settleSimSec: number };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const HOLD_F = T.holdBar * BAR, DROP_F = T.dropBar * BAR, REWIND_F = T.rewindBar * BAR;
const ease = Easing.inOut(Easing.cubic);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const PROFILE = glassProfile(T.glass.stemH, T.glass.bowlH, T.glass.bowlR, T.glass.footR);

/** Simulation time of the shards: real time / 8 after the break, then the rewind runs it back to 0. */
function shardTime(f: number) {
  if (f < DROP_F) return -1;
  if (f < REWIND_F) return Math.min(T.settleSimSec, (f - DROP_F) / FPS / T.slow);
  const u = ease(Math.min(1, (f - REWIND_F) / (DURATION - REWIND_F - 6)));
  return T.settleSimSec * (1 - u);
}
function shardAt(s: Shard, ts: number): { p: THREE.Vector3; spin: number } {
  if (ts < s.t1) return { p: new THREE.Vector3(s.p0[0] + s.v0[0] * ts, s.p0[1] + s.v0[1] * ts - 0.5 * T.g * ts * ts, s.p0[2] + s.v0[2] * ts), spin: ts };
  const land: V3 = [s.p0[0] + s.v0[0] * s.t1, 0, s.p0[2] + s.v0[2] * s.t1];
  if (ts < s.t1 + s.t2) {
    const u = ts - s.t1;
    return { p: new THREE.Vector3(land[0] + s.v1[0] * u, Math.max(0, s.v1[1] * u - 0.5 * T.g * u * u), land[2] + s.v1[2] * u), spin: s.t1 + u * 0.5 };
  }
  return { p: new THREE.Vector3(s.rest[0], 0, s.rest[2]), spin: s.t1 + s.t2 * 0.5 };
}

// ---------------------------------------------------------------- camera
type Shot = [number, V3, V3]; // frame, position, look-at
const OPEN: [V3, V3] = [[3.2, 3.0, 9.5], [0.1, 1.2, -1.0]];
const SHOTS: Shot[] = [
  [0, ...OPEN],
  [HOLD_F - 1, [-2.2, 2.8, 9.2], [0.1, 1.2, -1.0]],
  [HOLD_F, [2.4, 2.5, 7.4], [0.3, 1.2, -0.2]],
  [DROP_F - 1, [GLASS_X + 1.1, 2.0, GLASS_Z + 4.8], [GLASS_X, 1.2, GLASS_Z]],
  [DROP_F, [GLASS_X + 1.1, 2.0, GLASS_Z + 4.8], [GLASS_X, 1.2, GLASS_Z]],
  [DROP_F + 3 * BAR, [GLASS_X + 4.5, 3.4, GLASS_Z + 6.0], [GLASS_X, 0.3, GLASS_Z]],
  [REWIND_F, [GLASS_X - 3.5, 4.2, GLASS_Z + 6.2], [GLASS_X, 0.5, GLASS_Z]],
  [DURATION - 1, ...OPEN],
];
function camAt(f: number) {
  let k = 0;
  while (k < SHOTS.length - 2 && SHOTS[k + 1][0] <= f) k++;
  const [f0, p0, l0] = SHOTS[k], [f1, p1, l1] = SHOTS[k + 1];
  const t = interpolate(f, [f0, f1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const mix = (a: V3, b: V3) => new THREE.Vector3(...a.map((v, i) => v + (b[i] - v) * t));
  return { pos: mix(p0, p1), look: mix(l0, l1) };
}

let S: GlassScene | null = null;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3();

function render3D(f: number) {
  S ??= buildScene(W, H, PROFILE);
  const { renderer, scene, camera, glass, glassBase, glassMat, rim, glassLight, flashLight, cone, halo, rings, ringMat, shards } = S;
  const fr = T.frames[f];
  const level = Math.min(1, fr.amp / T.breakAmp); // 1 = breaking point
  const broken = f >= DROP_F && f < DURATION - 6 && shardTime(f) > 0;

  // the glass: its rim bends into an oval (the n = 2 mode) and back, 880 times a second. 30 fps cannot show that, so we
  // show its two extremes on alternate frames, with the size exaggerated (said on screen)
  glass.visible = rim.visible = !broken;
  if (!broken) {
    const pos = glass.geometry.attributes.position as THREE.BufferAttribute;
    const a = 0.3 * level ** 0.8 * (f % 2 === 0 ? 1 : -1);
    for (let i = 0; i < pos.count; i++) {
      const x = glassBase[i * 3], y = glassBase[i * 3 + 1], z = glassBase[i * 3 + 2];
      const u = Math.max(0, (y - T.glass.stemH) / T.glass.bowlH);
      const th = Math.atan2(z, x);
      const k = 1 + a * u * u * Math.cos(2 * th);
      pos.setXYZ(i, x * k, y, z * (2 - k));
    }
    pos.needsUpdate = true;
    glass.geometry.computeVertexNormals();
    rim.scale.set(1 + a, 1 - a, 1);
    glassMat.emissiveIntensity = 0.05 + 0.7 * level;
    glassLight.intensity = 12 * level;
  } else glassLight.intensity = 0;
  flashLight.intensity = f >= DROP_F && f < DROP_F + 8 ? 40 * (1 - (f - DROP_F) / 8) : 0;

  // the speaker cone: pushes on every note, vibrates while it sounds, harder when louder
  const sounding = fr.midi !== null;
  const onset = T.probe.find((p) => f >= p.beat * FPB && f < p.beat * FPB + 3 && f < DROP_F);
  cone.position.z = SPEAKER_Z + 0.02 + (sounding ? 0.035 * fr.drive * (f % 2 === 0 ? 1 : -1) : 0) + (onset ? 0.08 * fr.drive * (1 - (f - onset.beat * FPB) / 3) : 0);

  halo.visible = sounding;
  // sound waves: rings one wavelength apart (343 m/s / f, 10 units per metre), drifting outward (slowed down)
  ringMat.opacity = sounding ? Math.min(1, 0.6 + 0.15 * fr.drive) : 0;
  const lam = sounding ? 3430 / hz(fr.midi!) : 4;
  const phase = ((f / FPS) * 2.2) % lam;
  rings.forEach((r, i) => {
    const rad = 0.9 + i * lam + phase;
    r.visible = sounding && rad < 9.5;
    r.scale.set(rad, rad, 1);
  });

  // shards: real ballistics in slow motion x8, then rewound
  if (broken) {
    const ts = shardTime(f);
    T.shards.forEach((s, i) => {
      const { p, spin } = shardAt(s, ts);
      tmpE.set(s.w[0] * spin, s.w[1] * spin, s.w[2] * spin);
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(p.add(new THREE.Vector3(GLASS_X, 0.04, GLASS_Z)), tmpQ, tmpS.set(s.size * 2.2, s.size * 1.6, 0.3));
      shards.setMatrixAt(i, tmpM);
    });
    shards.count = T.shards.length;
    shards.instanceMatrix.needsUpdate = true;
  } else shards.count = 0;

  const { pos, look } = camAt(f);
  // the break is the one hit that moves the camera
  const kick = f >= DROP_F && f < DROP_F + 8 ? 0.12 * Math.exp(-(f - DROP_F) / 2) : 0;
  camera.position.set(pos.x + Math.sin(f * 12.9) * kick, pos.y + Math.cos(f * 7.3) * kick, pos.z);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return { level, broken };
}

function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["EVERY GLASS HAS", "A NOTE OF ITS OWN"];
  if (bar < 4) return ["TAP IT AND", "YOU HEAR THAT NOTE"];
  if (bar < 6) return ["THE SPEAKER PLAYS", "A TUNE AT THE GLASS"];
  if (bar < 8) return ["WRONG NOTE:", "THE GLASS BARELY MOVES"];
  if (bar < 10) return ["RIGHT NOTE:", "IT SHAKES 100x MORE"];
  if (bar < 12) return ["LIKE A SWING", "PUSHED AT THE RIGHT TIME"];
  if (bar < 14) return ["HOLD THAT NOTE", "AND TURN IT UP"];
  if (bar < 16) return ["4x LOUDER", "THE GLASS CAN'T TAKE IT"];
  if (bar < 20) return ["THE NOTE: A", "880 SHAKES A SECOND"];
  if (bar < 22) return "code";
  return ["REWIND", "PLAY IT AGAIN?"];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const { level } = render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const fr = T.frames[f];
  const blink = (p: number) => Math.floor(f / p) % 2 === 0;

  // title
  const ty = cover ? 86 : 34; // the cover keeps its title inside the centre 3:4 crop (y 80-560)
  panel(M, ty, W - 2 * M, 70, C["c0cbdc"]);
  text("CAN A SINGLE NOTE", W / 2, ty + 10, "p16", C["c0cbdc"], "c");
  text("BREAK GLASS?", W / 2, ty + 32, "p24", C["fee761"], "c", C["be4a2f"]);

  if (cover) {
    panel(M + 20, 452, W - 2 * M - 40, 52, C["c0cbdc"]);
    text("SPEAKER vs GLASS", W / 2, 462, "p16", C["ffffff"], "c");
    text("GUESS THE NOTE", W / 2, 482, "s16", C["fee761"], "c");
    text("@squarewavelab", W / 2, 586, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    // data: what the speaker plays, how far the rim moves
    panel(M, 110, W - 2 * M, 62);
    text("SPEAKER", M + 10, 116, "s16", C["8b9bb4"]);
    if (fr.midi !== null) {
      text(noteName(fr.midi), M + 10, 140, "p24", fr.midi === 81 ? C["ffffff"] : C["2ce8f5"]);
    } else text("--", M + 10, 136, "p24", C["5a6988"]);
    text("GLASS SHAKES", W - M - 10, 116, "s16", C["8b9bb4"], "r");
    const broken = f >= DROP_F;
    const word = broken ? (f < REWIND_F ? "BROKEN" : "--") : level > 0.6 ? "HARD!" : level > 0.15 ? "A LOT" : level > 0.02 ? "A LITTLE" : "BARELY";
    text(word, W - M - 10, 142, "p16", broken ? C["ff0044"] : level > 0.6 && blink(2) ? C["ffffff"] : C["fee761"], "r", C["be4a2f"]);
    // meter: rim motion on a log scale, with the breaking point marked
    const mx = M, mw = W - 2 * M, my = 178;
    rect(mx, my, mw, 8, C["262b44"]);
    if (!broken) {
      const p = Math.max(0, Math.log10(Math.max(1, fr.amp)) / Math.log10(T.breakAmp));
      const cells = Math.floor((p * mw) / 6);
      for (let c = 0; c < cells; c++) rect(mx + c * 6 + 1, my + 1, 5, 6, c * 6 > mw * 0.85 ? C["ff0044"] : c * 6 > mw * 0.6 ? C["feae34"] : C["63c74d"]);
    }
    rect(mx + mw - 2, my - 3, 2, 14, C["ff0044"]);
    if (f < DROP_F) text("SHAKING SHOWN MUCH BIGGER", mx, my + 12, "s16", C["5a6988"]);
    else if (f < REWIND_F) text("SLOW MOTION x8", mx, my + 12, "s16", C["5a6988"]);
    else if (blink(6)) text("<< REWIND", mx, my + 12, "s16", C["fee761"]);

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 444, W - 2 * M, 58, C["5a6988"]);
      rect(M, 444, 3, 58, C["63c74d"]);
      text("A = 1/|1-r^2+ir/Q|", M + 12, 452, "p16", C["ffffff"]);
      text("r=f/f0  Q=1000", M + 12, 476, "p16", C["63c74d"]);
    } else if (cap) {
      const l1 = cap[0].includes("Hz") ? "p16" : "p16";
      const w = Math.max(measure(cap[0], l1), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, l1, C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");

    // the break: a white flash, dithered so it stays in the palette
    const sd = f - DROP_F;
    if (sd >= 0 && sd < 5) {
      const th = 0.85 * (1 - sd / 5);
      ov.fillStyle = C["ffffff"];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < th) ov.fillRect(x, y, 1, 1);
    }
  }
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const GlassResonanceVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    if (coverFrame !== undefined) drawFrame(ctx, ov, f, true);
    else drawLooped(ctx, ov, f, DURATION, 8, (c, o, ff) => drawFrame(c, o, ff));
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("glass-resonance/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const GlassResonance = () => (
  <Composition id="GlassResonance" component={GlassResonanceVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the rim at full swing just before the break. The profile grid shows its centre 3:4 crop. */
export const GlassResonanceCover = () => (
  <Still id="GlassResonanceCover" component={GlassResonanceVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: DROP_F - 6 }} />
);
