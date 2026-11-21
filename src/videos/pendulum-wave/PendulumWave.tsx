import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { BOB_COLORS, BOB_R, buildPendulumScene, PendulumScene, pivot } from "./scene";
import timeline from "../../../public/pendulum-wave/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, BAR = 60, DURATION = 16 * BAR; // 16 bars at 120 BPM = 32 s = one full cycle

type TL = {
  cycle: number;
  pendulums: { k: number; n: number; length: number }[];
  frames: { theta: number[] }[];
  events: { k: number; sec: number }[];
};
const T = timeline as unknown as TL;
const EV_FRAMES: number[][] = T.pendulums.map((p) => T.events.filter((e) => e.k === p.k).map((e) => e.sec * FPS));
/** Frames since pendulum k last played its note (large if none yet). */
const sinceNote = (k: number, f: number) => {
  let best = 1e9;
  for (const ef of EV_FRAMES[k]) if (ef <= f + 1e-6 && f - ef < best) best = f - ef;
  // wrap: notes near the end of the loop count for the first frames
  if (best > 1e8) for (const ef of EV_FRAMES[k]) best = Math.min(best, f + DURATION - ef);
  return best;
};

function captionAt(f: number): [string, string] | "code" {
  const s = f / FPS;
  if (s < 4) return ["SAME START", "ALL 15 IN LINE"];
  if (s < 7.5) return ["EACH ONE SWINGS", "A LITTLE FASTER"];
  if (s < 10) return ["1/4 OF THE WAY", "4 ROWS"];
  if (s < 12.5) return ["1/3 OF THE WAY", "3 ROWS"];
  if (s < 15.5) return ["LOOKS RANDOM?", "IT ISN'T"];
  if (s < 20) return ["HALFWAY", "2 ROWS"];
  if (s < 23) return ["2/3 OF THE WAY", "3 ROWS AGAIN"];
  if (s < 26) return ["EVERY NOTE = A BOB", "PASSING THE MIDDLE"];
  if (s < 30.4) return "code";
  return ["32 SECONDS", "ALL 15 BACK IN LINE"];
}

// camera: one slow sway that returns to the opening shot at the end of the cycle
function camAt(f: number) {
  const a = (f / DURATION) * Math.PI * 2;
  return { pos: [0.05 * Math.sin(a), 3.0 - 0.05 * (1 - Math.cos(a)), 1.45] as const, look: [0, 0.32, -0.5] as const };
}

let S: PendulumScene | null = null;

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  S ??= buildPendulumScene(W, H);
  const { renderer, scene, camera, bobs, bobMats, strings } = S;
  const st = T.frames[f];

  // ---------- 3D ----------
  T.pendulums.forEach((p, k) => {
    const [px, py, pz] = pivot(k);
    const th = st.theta[k];
    const L = p.length;
    const bx = px + L * Math.sin(th), by = py - L * Math.cos(th);
    bobs[k].position.set(bx, by, pz);
    const pos = strings[k].geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, px, py, pz);
    pos.setXYZ(1, bx, by + BOB_R * 0.8, pz);
    pos.needsUpdate = true;
    const since = sinceNote(k, f);
    bobMats[k].emissiveIntensity = since < 6 ? 0.45 * (1 - since / 6) : 0;
  });
  const { pos, look } = camAt(f);
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  // ---------- 2D overlay ----------
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const M = 28;

  if (cover) {
    panel(M, 96, W - 2 * M, 78, C["c0cbdc"]);
    text("15 PENDULUMS", W / 2, 108, "p16", C["c0cbdc"], "c");
    text("IN LINE?", W / 2, 132, "p32", C["fee761"], "c", C["be4a2f"]);
    panel(M + 16, 432, W - 2 * M - 32, 74, C["c0cbdc"]);
    text("SAME START. WHEN DO", W / 2, 444, "s16", C["8b9bb4"], "c");
    text("THEY MEET AGAIN?", W / 2, 466, "p16", C["ffffff"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 528, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("15 PENDULUMS", W / 2, 44, "p16", C["c0cbdc"], "c");
    text("IN LINE?", W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);

    // data panel (slim, so the row has room): elapsed time, the one big number, and swings so far
    panel(M, 110, W - 2 * M, 44);
    const t = f / FPS;
    text("TIME", M + 10, 124, "s16", C["8b9bb4"]);
    text(`${t.toFixed(1)}s`, M + 56, 120, "p24", C["fee761"], "l", C["be4a2f"]);
    const sw = (k: number) => Math.floor((T.pendulums[k].n * t) / T.cycle);
    rect(W - M - 112, 118, 8, 8, BOB_COLORS[0]);
    text(`LONG ${String(sw(0)).padStart(2, " ")}`, W - M - 10, 114, "s16", C["c0cbdc"], "r");
    rect(W - M - 112, 136, 8, 8, BOB_COLORS[14]);
    text(`SHORT ${String(sw(14)).padStart(2, " ")}`, W - M - 10, 132, "s16", C["c0cbdc"], "r");

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 436, W - 2 * M, 64, C["5a6988"]);
      rect(M, 436, 3, 64, C["63c74d"]);
      text("L=g(T/(2*PI*N))^2", M + 12, 446, "p16", C["ffffff"]);
      text("N = 16..30 SWINGS IN 32 S", M + 12, 472, "s16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  }

  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const PendulumWaveVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    else drawLooped(ctx, ov, f, DURATION, 12, (c, o, ff) => drawFrame(c, o, ff));
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("pendulum-wave/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const PendulumWave = () => (
  <Composition id="PendulumWave" component={PendulumWaveVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16). The profile grid shows its centre 3:4 crop. */
export const PendulumWaveCover = () => (
  <Still id="PendulumWaveCover" component={PendulumWaveVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 3 * BAR }} />
);


