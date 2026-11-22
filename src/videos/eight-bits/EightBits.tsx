import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { BitsScene, buildScene, LAMP_Z, LAMPS, lampY, TOWER_TOP } from "./scene";
import timeline from "../../../public/eight-bits/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Count = { n: number; beat: number; frame: number; step: number; on: number | null; off: number[]; chord: number; kickLight: number };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; buildBar: number; dropBar: number; drop2Bar: number; counts: Count[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const DROP_F = T.dropBar * BAR;
const ease = Easing.inOut(Easing.cubic);

/** The count showing at frame f (counts are in frame order; count 0 sits on frame 0, the overflow). */
function countAt(f: number): Count {
  let lo = 0, hi = T.counts.length - 1, i = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (T.counts[m].frame <= f) { i = m; lo = m + 1; } else hi = m - 1; }
  return T.counts[i];
}
const speedAt = (c: Count) => 1 / (c.step * 60 / 150); // counts a second

// ---------------------------------------------------------------- camera: one slow swing per loop, in on the drop
function camAt(f: number) {
  const orbit = 0.34 * Math.sin((2 * Math.PI * f) / DURATION) + 0.12;
  const push = interpolate(f, [0, T.buildBar * BAR, DROP_F - 1, DROP_F + 6, DURATION - 3 * BAR, DURATION], [1, 1, 0.99, 0.95, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const d = 29 * push;
  const lookY = lampY(3.5) - 0.9; // the lamps sit between the readouts and the caption box
  return { pos: new THREE.Vector3(Math.sin(orbit) * d, lookY + 2.2, Math.cos(orbit) * d), look: new THREE.Vector3(0, lookY, 0) };
}

let S: BitsScene | null = null;
const proj = new THREE.Vector3();

function render3D(f: number) {
  S ??= buildScene(W, H);
  const { renderer, scene, camera, lampMats, lampLights, switches, ring, ringMat, carry, carryMat } = S;
  const c = countAt(f);
  const age = f - c.frame; // frames since this count
  const n = c.n;

  for (let k = 0; k < LAMPS; k++) {
    const lit = (n >> k) & 1;
    const fresh = c.on === k ? Math.exp(-age / 3) : 0; // a lamp that just came on flashes
    const after = !lit && c.off.includes(k) ? Math.exp(-(age + 0.5) / 1.5) : 0; // one that just went off fades like a filament: it drops on the frame it switches, dark in ~4 frames
    lampMats[k].emissiveIntensity = lit ? 1.1 + 1.6 * fresh : 1.1 * after;
    const big = k === 7 ? 2.2 : k === 6 ? 1.5 : 1; // the big lamps light the room harder
    lampLights[k].intensity = (lit ? 7 + 10 * fresh : 7 * after) * big;
    lampLights[k].distance = 12 + 6 * big;
    switches[k].rotation.x = lit ? -0.55 : 0.55;
  }

  // the beat ring sits on the lamp that flips once per beat; it slides up when the counting speeds up
  const prevKick = countAt(Math.max(0, c.frame - 1)).kickLight;
  const slide = c.kickLight !== prevKick ? 0 : 1;
  const moveF = f - T.counts.find((x) => x.kickLight === c.kickLight)!.frame;
  const yTo = lampY(c.kickLight), yFrom = lampY(Math.max(0, c.kickLight - 1));
  let ry = c.kickLight === 0 || slide === 1 && moveF > 8 ? yTo : yFrom + (yTo - yFrom) * ease(Math.min(1, moveF / 8));
  // at the loop the counting drops back to one a beat: the ring slides down from lamp 4 to lamp 1, like every speed change
  if (f < 8) ry = lampY(2) + (lampY(0) - lampY(2)) * ease(f / 8);
  const beatAge = f % FPB;
  ring.position.set(0, ry, LAMP_Z + 0.05);
  ring.scale.setScalar(1 + 0.28 * Math.exp(-beatAge / 2.5));
  ringMat.emissiveIntensity = 0.5 + 2 * Math.exp(-beatAge / 2.5);

  // the carry: a spark runs up the rail from the lowest lamp that went off to the one that came on
  const span = Math.max(3, c.step * FPB);
  if (c.off.length && age < span) {
    const top = c.on === null ? TOWER_TOP + 0.6 : lampY(c.on); // the overflow carries off the top: there is no 9th lamp
    const bot = lampY(0);
    const reach = Math.min(1, (age + 1) / Math.min(span, 4));
    const yTop = bot + (top - bot) * reach;
    carry.visible = true;
    carry.scale.set(1, Math.max(0.05, yTop - bot), 1);
    carry.position.y = (bot + yTop) / 2;
    carryMat.emissiveIntensity = 2.5 * (1 - age / span);
  } else carry.visible = false;

  const { pos, look } = camAt(f);
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return c;
}

/** Screen position (low-res px) of a point in the scene. */
function toScreen(x: number, y: number, z: number) {
  proj.set(x, y, z).project(S!.camera);
  return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H };
}

// ---------------------------------------------------------------- captions: one idea each, 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["8 LIGHTS", "EACH ONE IS ON OR OFF"];
  if (bar < 4) return ["ON = 1, OFF = 0", "THAT IS ALL A COMPUTER HAS"];
  if (bar < 6) return ["EACH LIGHT IS", "WORTH DOUBLE THE ONE BELOW"];
  if (bar < 8) return ["ADD THE LIT ONES", "THAT IS THE NUMBER"];
  if (bar < 10) return ["ADD 1", "FULL LIGHTS GO OFF, CARRY UP"];
  if (bar < 12) return ["FASTER", "10 COUNTS EVERY SECOND"];
  if (bar < 14) return ["THE RING IS THE KICK", "EACH LIGHT UP FLIPS HALF AS OFTEN"];
  if (bar < 16) return ["128", "THE BIGGEST LIGHT"];
  if (bar < 18) return "code";
  if (bar < 20) return ["EVERY SOUND", "IS A LIGHT SWITCHING"];
  return ["255 + 1 = ?", "NO 9TH LIGHT: ALL OFF, BACK TO 0"];
}

const bits = (n: number) => n.toString(2).padStart(8, "0");

const CAP_FADE = 6;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const layers: CanvasRenderingContext2D[] = [];
function layer(i: number) {
  if (!layers[i]) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; layers[i] = cv.getContext("2d", { willReadFrequently: true })!; }
  layers[i].clearRect(0, 0, W, H);
  return layers[i];
}

function drawCaption(g: CanvasRenderingContext2D, f: number, n: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 444, W - 2 * M, 62, C["5a6988"]);
    rect(M, 444, 3, 62, C["63c74d"]);
    text("n = n + 1", M + 12, 452, "p16", C["ffffff"]);
    text(`bin(${n}) = ${bits(n)}`, M + 12, 474, "p8", C["63c74d"]);
    text("8 LIGHTS: 256 NUMBERS", M + 12, 488, "s16", C["c0cbdc"]);
  } else if (cap) {
    const l1 = measure(cap[0], "p16") <= W - 2 * M - 20 ? "p16" : "s16";
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], l1), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, l1, C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const c = render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { text, panel } = pixelKit(ov);

  // lamp labels, crisp, next to each lamp: its value on the left, its bit (1 or 0) on the right
  for (let k = 0; k < LAMPS; k++) {
    const lit = (c.n >> k) & 1;
    const L = toScreen(-1.45, lampY(k), LAMP_Z), R = toScreen(1.45, lampY(k), LAMP_Z);
    text(String(1 << k), L.x, L.y - 4, "p8", lit ? C["fee761"] : C["5a6988"], "r", C["181425"]);
    text(lit ? "1" : "0", R.x, R.y - 4, "p8", lit ? C["ffffff"] : C["5a6988"], "l", C["181425"]);
  }

  if (cover) { // key text inside the centre 3:4 crop (y 80-560)
    panel(M, 86, W - 2 * M, 60, C["c0cbdc"]);
    text("HOW DO COMPUTERS", W / 2, 96, "p16", C["c0cbdc"], "c");
    text("COUNT WITH 0 & 1?", W / 2, 120, "p16", C["fee761"], "c", C["be4a2f"]);
    panel(M + 40, 486, W - 2 * M - 80, 52, C["c0cbdc"]);
    text(bits(c.n), W / 2, 496, "p16", C["ffffff"], "c");
    text("= ?", W / 2, 516, "p16", C["fee761"], "c");
  } else {
    // the question stays on screen
    panel(M, 30, W - 2 * M, 56, C["c0cbdc"]);
    text("HOW DO COMPUTERS", W / 2, 38, "p16", C["c0cbdc"], "c");
    text("COUNT WITH 0 & 1?", W / 2, 60, "p16", C["fee761"], "c", C["be4a2f"]);
    // two readouts: the number, the speed
    panel(M, 92, W - 2 * M, 50);
    text("NUMBER", M + 10, 98, "s16", C["8b9bb4"]);
    text(String(c.n), M + 10, 116, "p16", C["fee761"], "l", C["be4a2f"]);
    text("COUNTS A SECOND", W - M - 10, 98, "s16", C["8b9bb4"], "r");
    text(String(speedAt(c)), W - M - 10, 116, "p16", C["ffffff"], "r");
    // while the counting is slow enough to read, the sum of the lit lamps
    if (c.step >= 0.5 && c.n > 0) {
      const parts = Array.from({ length: LAMPS }, (_, k) => 7 - k).filter((k) => (c.n >> k) & 1).map((k) => String(1 << k));
      text(`${parts.join("+")}`, W / 2, 148, "p8", C["c0cbdc"], "c", C["181425"]);
    }

    // the caption box: in the last frames it dithers into the hook caption, so the words loop without a cut
    // (only the words: the lamps, the number and the bit labels switch on the beat, with the sound)
    const capA = layer(0), capB = layer(1);
    drawCaption(capA, f, c.n);
    const t = (f - (DURATION - CAP_FADE) + 1) / CAP_FADE;
    if (t > 0) {
      drawCaption(capB, 0, 0);
      const a = capA.getImageData(0, 0, W, H), b = capB.getImageData(0, 0, W, H);
      for (let y = 430; y < 520; y++) for (let x = 0; x < W; x++)
        if (BAYER4[(y & 3) * 4 + (x & 3)] / 16 < t) { const i = (y * W + x) * 4; for (let j = 0; j < 4; j++) a.data[i + j] = b.data[i + j]; }
      capA.putImageData(a, 0, 0);
    }
    ov.drawImage(capA.canvas, 0, 0);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const EightBitsVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    // the overflow (all eight lamps off on frame 0) is an event on the beat, so the picture is not dissolved at the seam;
    // the lamps fade like bulbs (a few frames) and only the caption words dither into the hook (drawFrame)
    drawFrame(ctx, ov, f, coverFrame !== undefined);
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("eight-bits/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const EightBits = () => (
  <Composition id="EightBits" component={EightBitsVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): mid-drop, 173 = 10101101, the room lit by the big lamps. The profile grid shows its centre 3:4 crop. */
export const EightBitsCover = () => (
  <Still id="EightBitsCover" component={EightBitsVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: T.counts[173].frame }} />
);
