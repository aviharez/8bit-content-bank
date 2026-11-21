import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawPi, pixelKit } from "../../lib/pixel2d";
import { buildScene, ClackScene } from "./scene";
import timeline from "../../../public/count-the-clacks/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, DURATION = 960; // 16 bars at 120 BPM

type FS = { level: number; x1: number; x2: number; v1: number; v2: number; bigW: number; count: number; sinceHit: number; lastType: string };
const frames = (timeline as { frames: (FS | null)[] }).frames;
const REST: FS = { level: 0, x1: 3, x2: 7, v1: 0, v2: 0, bigW: 1, count: 0, sinceHit: 999, lastType: "" };

const LEVELS = [
  { id: 1, ratio: "1 : 1", label: "1 KG", n: 3, done: 211, cap: ["LEVEL 1", "SAME MASS"] },
  { id: 2, ratio: "1 : 100", label: "100 KG", n: 31, done: 421, cap: ["LEVEL 2", "100x HEAVIER"] },
  { id: 3, ratio: "1:10,000", label: "10 TONNES", n: 314, done: 781, cap: ["LEVEL 3", "10,000x HEAVIER"] },
];

// ---- camera: diagonal shots so the track recedes into the tall frame ----
type V3 = [number, number, number];
const CAM: [number, V3, V3][] = [
  [0, [12, 4.8, 10.5], [4.2, 1.0, 0]], [118, [10, 3.4, 8.2], [3.9, 0.9, 0]],
  [120, [9.6, 3.0, 7.6], [3.7, 0.8, 0]], [236, [9.0, 2.8, 7.0], [3.5, 0.8, 0]],
  [240, [11.2, 3.8, 9.0], [4.2, 1.0, 0]], [476, [10, 3.3, 7.8], [3.8, 0.9, 0]],
  [480, [16, 6.4, 13.5], [5.2, 1.6, 0]], [536, [13.5, 5.2, 11.2], [4.8, 1.4, 0]],
  [546, [3.0, 2.0, 8.5], [1.4, 0.8, 0]], [776, [2.4, 1.5, 6.2], [1.1, 0.6, 0]],
  [790, [12.5, 5, 11], [6, 1.5, 0]], [839, [18, 6.8, 14.5], [10, 1.5, 0]],
  [840, [6, 11, 9], [3, 0, -1]], [959, [12, 4.8, 10.5], [4.2, 1.0, 0]],
];
function camAt(f: number): { pos: V3; look: V3 } {
  let k = 0;
  while (k < CAM.length - 2 && CAM[k + 1][0] <= f) k++;
  const [f0, p0, l0] = CAM[k], [f1, p1, l1] = CAM[k + 1];
  const t = interpolate(f, [f0, f1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const mix = (a: V3, b: V3) => a.map((v, i) => v + (b[i] - v) * t) as V3;
  return { pos: mix(p0, p1), look: mix(l0, l1) };
}

let S: ClackScene | null = null;

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number) {
  S ??= buildScene(W, H);
  const { renderer, scene, camera, small, big, hitLight, smallMat } = S;
  const s = frames[f] ?? REST;
  const outro = f >= 840;
  const lvl = frames[f] ? LEVELS[s.level - 1] : outro ? LEVELS[2] : null;

  // ---------- 3D (pure function of the frame) ----------
  small.position.set(s.x1 + 0.5, 0.5, 0);
  big.scale.setScalar(s.bigW);
  big.position.set(s.x2 + s.bigW / 2, s.bigW / 2, 0);
  const flash = s.sinceHit < 6 ? Math.exp(-s.sinceHit / 1.5) : 0;
  smallMat.emissive.set(C["fee761"]);
  smallMat.emissiveIntensity = flash * (s.level === 3 ? 0.35 : 0.8);
  const contactX = s.lastType === "wall" ? 0 : s.x1 + 1;
  hitLight.position.set(contactX + 0.2, 0.8, 1.2);
  hitLight.intensity = flash * 14;

  const { pos, look } = camAt(f);
  let shake = 0;
  if (s.level === 3 && f >= 540 && f < 790) shake = 0.01 + 0.03 * flash;
  else if (flash > 0) shake = (s.level === 1 ? 0.05 : 0.025) * flash;
  camera.position.set(pos[0] + Math.sin(f * 12.9) * shake, pos[1] + Math.cos(f * 7.3) * shake, pos[2]);
  camera.lookAt(...look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(renderer.domElement, 0, 0);
  if (outro) {
    const a = interpolate(f, [840, 852, 940, 959], [0, 0.75, 0.75, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    ctx.fillStyle = `rgba(24,20,37,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  // ---------- 2D overlay (crisp: alpha-thresholded, no dither) ----------
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const project = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  };
  const blink = (p: number) => Math.floor(f / p) % 2 === 0;
  const M = 28; // side margin (~84 px at 3x)

  // title
  panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
  text("HOW MANY", W / 2, 44, "p16", C["c0cbdc"], "c");
  text("CLACKS?", W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);

  if (!outro) {
    // data panel: ratio + counter
    panel(M, 110, W - 2 * M, 62);
    text("MASS RATIO", M + 10, 116, "s16", C["8b9bb4"]);
    text(lvl ? lvl.ratio : "1 : 1", M + 10, 142, "p16", C["ffffff"]);
    text("CLACKS", W - M - 10, 116, "s16", C["8b9bb4"], "r");
    text(String(s.count), W - M - 10, 134, "p32", s.sinceHit < 2 ? C["ffffff"] : C["fee761"], "r", C["be4a2f"]);

    // digits of pi so far
    const done = LEVELS.filter((L) => f >= L.done).length;
    if (done) {
      const digits = ["3", "3.1", "3.14"][done - 1];
      const w = 56 + measure(digits, "p16");
      panel(W / 2 - w / 2, 178, w, 30, C["5a6988"]);
      drawPi(ov, W / 2 - w / 2 + 10, 185, 2, C["f77622"]);
      text("=", W / 2 - w / 2 + 30, 188, "p8", C["ffffff"]);
      text(digits, W / 2 - w / 2 + 44, 185, "p16", C["fee761"]);
    }

    // labels over the blocks
    const [sx, sy] = project(s.x1 + 0.5, 1.2, 0);
    if (sx > M && sx < W - M && sy > 215) text("1 KG", sx, sy - 18, "s16", C["2ce8f5"], "c", C["181425"]);
    const [bx, by] = project(s.x2 + s.bigW / 2, s.bigW + 0.2, 0);
    if (lvl && bx > M + 20 && bx < W - M - 20 && by > 215) text(lvl.label, bx, by - 18, "s16", C["f6757a"], "c", C["181425"]);

    // spark burst where the clack happens
    if (s.sinceHit < 5) {
      const [cx, cy] = project(contactX, 0.55, 0.5);
      const r = 5 + s.sinceHit * 5;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 + f * 0.7;
        for (let j = 0; j < 2 + (k % 2) * 2; j++) rect(cx + Math.cos(ang) * (r + j), cy + Math.sin(ang) * (r + j), 1, 1, j < 1 ? C["ffffff"] : C["fee761"]);
      }
      if (s.sinceHit < 1.5) rect(cx - 2, cy - 2, 5, 5, C["ffffff"]);
    }

    // caption: two lines, bottom of the safe area
    let cap: string[] = [];
    if (f < 120) cap = ["COUNT EVERY CLACK", ""];
    else if (lvl?.id === 3 && f >= 780) cap = ["314 CLACKS", "THAT'S PI"];
    else if (lvl?.id === 3 && f >= 545) cap = ["TIME WARPED", "TO THE BEAT"];
    else if (lvl?.id === 3 && f >= 500) cap = ["LEVEL 3", blink(8) ? "GUESS THE COUNT" : ""];
    else if (lvl) cap = lvl.cap;
    if (cap.length) {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      if (cap[1]) {
        panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
        text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
        text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
      } else {
        panel(W / 2 - w / 2, 462, w, 34, C["c0cbdc"]);
        text(cap[0], W / 2, 471, "p16", C["ffffff"], "c");
      }
    }
  } else {
    // outro: pi lands one digit per 8th note, in sync with the melody
    const PI_D = "3.141592653589793";
    const k = Math.min(16, Math.floor((f - 840) / 7.5) + 1);
    const shown = PI_D.slice(0, k <= 1 ? 1 : k + 1);
    drawPi(ov, W / 2 - 76, 126, 8, C["f77622"]);
    text("=", W / 2 + 12, 146, "p32", C["ffffff"]);
    text(shown.slice(0, 9), M + 8, 214, "p32", C["fee761"], "l", C["be4a2f"]);
    if (shown.length > 9) text(shown.slice(9), M + 8, 254, "p32", C["fee761"], "l", C["be4a2f"]);
    text("1 : 1  =  3", W / 2, 306, "s16", C["c0cbdc"], "c");
    text("1 : 100  =  31", W / 2, 326, "s16", C["c0cbdc"], "c");
    text("1 : 10,000  =  314", W / 2, 346, "s16", C["c0cbdc"], "c");
    panel(M, 380, W - 2 * M, 74, C["5a6988"]);
    rect(M, 380, 3, 74, C["63c74d"]);
    text("THE PHYSICS THAT MADE THIS", M + 12, 388, "s16", C["8b9bb4"]);
    text("t=atan(sqrt(m/M))", M + 12, 410, "p16", C["ffffff"]);
    text("N=ceil(PI/t)-1", M + 12, 432, "p16", C["63c74d"]);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");

  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const CountTheClacksVideo: React.FC = () => {
  const f = useCurrentFrame();
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
    drawFrame(ctx, ov, f);
  }, [f, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      <Audio src={staticFile("count-the-clacks/track.wav")} />
    </AbsoluteFill>
  );
};

export const CountTheClacks = () => (
  <Composition
    id="CountTheClacks"
    component={CountTheClacksVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={W * SCALE}
    height={H * SCALE}
  />
);
