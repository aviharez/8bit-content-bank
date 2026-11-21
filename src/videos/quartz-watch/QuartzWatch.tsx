import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildQuartzScene, QuartzScene, stageX, WATCH } from "./scene";
import timeline from "../../../public/quartz-watch/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, DURATION = 1080; // 18 bars at 120 BPM

type Slot = { k: number; start: number; end: number };
const TL = timeline as { slots: Slot[]; frames: { stage: number; seconds: number }[]; crystalHz: number };
const XTAL = TL.crystalHz;
const freq = (k: number) => XTAL / 2 ** k;
const fmt = (hz: number) => hz.toLocaleString("en-US");

/** Output of stage k at time t: a square wave of freq(k), high for the first half of each period. */
const isHigh = (k: number, t: number) => ((t * freq(k)) % 1) < 0.5;
/** Faster than the frame rate can show: drawn as a flicker, not as real on/off. */
const tooFast = (k: number) => freq(k) > 8;

// ---- camera: a keyframe path built from the stage schedule ----
type V3 = [number, number, number];
type Key = [number, V3, V3];
const stageCam = (k: number, drift = 0): [V3, V3] =>
  k === 0 ? [[2.0 - drift * 0.3, 1.9, 4.6 - drift], [-0.1, 1.0, 0]] : [[stageX(k) + 2.5 - drift * 0.3, 2.0, 5.2 - drift * 0.6], [stageX(k) - 0.2, 0.7, 0]];
const WATCH_A: [V3, V3] = [[WATCH.x + 2.2, WATCH.y + 0.4, 14.5], [WATCH.x, WATCH.y - 0.2, 0]];
const WATCH_B: [V3, V3] = [[WATCH.x + 1.4, WATCH.y + 0.2, 12.6], [WATCH.x, WATCH.y - 0.2, 0]];
const DROP_A: [V3, V3] = [[WATCH.x - 5.5, WATCH.y + 0.6, 12.5], [WATCH.x - 1.0, WATCH.y - 0.6, 0]];
const DROP_B: [V3, V3] = [[WATCH.x + 4.0, WATCH.y - 0.2, 12.0], [WATCH.x - 0.4, WATCH.y - 0.4, 0]];
const WIDE: [V3, V3] = [[WATCH.x * 0.75, 6.5, 19], [WATCH.x * 0.55, 1.2, 0]];

const CAM: Key[] = (() => {
  const keys: Key[] = [[0, ...WATCH_A], [118, ...WATCH_B]];
  let prev = WATCH_B;
  for (const s of TL.slots) {
    if (s.k === 15) {
      keys.push([s.start, ...prev], [s.start + 16, ...DROP_A], [s.end - 1, ...DROP_B]);
      prev = DROP_B;
      continue;
    }
    const ease = s.k === 0 ? 24 : Math.min(10, Math.floor((s.end - s.start) / 3));
    keys.push([s.start, ...prev], [s.start + ease, ...stageCam(s.k)], [s.end - 1, ...stageCam(s.k, 1)]);
    prev = stageCam(s.k, 1);
  }
  keys.push([1020, ...prev], [1046, ...WIDE], [1079, ...WATCH_A]);
  return keys;
})();
function camAt(f: number): { pos: V3; look: V3 } {
  let i = 0;
  while (i < CAM.length - 2 && CAM[i + 1][0] <= f) i++;
  const [f0, p0, l0] = CAM[i], [f1, p1, l1] = CAM[i + 1];
  const t = interpolate(f, [f0, f1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const mix = (a: V3, b: V3) => a.map((v, j) => v + (b[j] - v) * t) as V3;
  return { pos: mix(p0, p1), look: mix(l0, l1) };
}

// ---- words ----
const noteOf = (k: number) => (k <= 11 ? `NOTE C${11 - k}` : `RHYTHM 1/${[32, 16, 8, 4, 2][k - 11]}`);
function captionAt(f: number, k: number): [string, string] | null {
  if (f < 120) return ["HOW DOES A WATCH", "KNOW WHAT A SECOND IS?"];
  if (k === 0) return ["QUARTZ CRYSTAL", "TOO HIGH TO HEAR"];
  if (k === 1) return ["DIVIDE BY 2", "THE EDGE OF HEARING"];
  if (k >= 2 && k <= 9) return ["HALF THE FREQUENCY", "= ONE OCTAVE DOWN"];
  if (k === 10) return ["32 HZ", "FEEL IT MORE THAN HEAR IT"];
  if (k === 11) return ["BELOW 20 HZ", "THE NOTE BECOMES A RHYTHM"];
  if (k >= 12 && k <= 14) return ["DIVIDE BY 2", "HALF AS FAST"];
  if (k === 15) return f < 900 ? ["15 HALVINGS", "ONE TICK PER SECOND"] : ["EVERY C YOU HEARD", "WAS A POWER OF 2 HZ"];
  return null;
}

let S: QuartzScene | null = null;

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  S ??= buildQuartzScene(W, H);
  const { renderer, scene, camera, prongs, leds, secondHand, focusLight } = S;
  const t = f / FPS;
  const k = TL.frames[f].stage; // -1 = watch (intro / outro)

  // ---------- 3D ----------
  // the crystal vibrates 32,768 times a second: at 30 fps that can only be a blur
  const jitter = f % 2 === 0 ? 0.05 : -0.05;
  prongs[0].position.x = -0.24 - jitter;
  prongs[1].position.x = 0.24 + jitter;
  for (let s = 1; s <= 15; s++) {
    const m = leds[s];
    if (tooFast(s)) {
      const on = (f + s) % 2 === 0;
      m.color.set(on ? C["f77622"] : C["733e39"]);
      m.emissive.set(C["f77622"]);
      m.emissiveIntensity = on ? 0.9 : 0.35;
    } else {
      const on = isHigh(s, t);
      m.color.set(on ? C["fee761"] : C["3e2731"]);
      m.emissive.set(C["fee761"]);
      m.emissiveIntensity = on ? 1.2 : 0;
    }
  }
  secondHand.rotation.z = -((TL.frames[f].seconds % 60) / 60) * Math.PI * 2;
  if (k >= 1 && k <= 15) {
    focusLight.position.set(stageX(k), 1.6, 0.9);
    focusLight.intensity = tooFast(k) ? 6 : isHigh(k, t) ? 10 : 2;
  } else if (k === 0) {
    focusLight.position.set(0, 1.8, 1.0);
    focusLight.intensity = 6;
  } else focusLight.intensity = 0;

  const { pos, look } = camAt(f);
  // the tick nudges the camera once a second
  const sinceTick = (t % 1) * FPS;
  const shake = sinceTick < 3 ? (k === 15 ? 0.05 : 0.015) * (1 - sinceTick / 3) : 0;
  camera.position.set(pos[0] + shake, pos[1] - shake, pos[2]);
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
  const project = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H, v.z];
  };

  if (cover) {
    panel(M, 96, W - 2 * M, 78, C["c0cbdc"]);
    text("YOUR WATCH SINGS", W / 2, 108, "p16", C["c0cbdc"], "c");
    text("32,768 HZ", W / 2, 132, "p32", C["fee761"], "c", C["be4a2f"]);
    panel(M + 16, 432, W - 2 * M - 32, 74, C["c0cbdc"]);
    text("HALVE IT 15 TIMES", W / 2, 444, "s16", C["8b9bb4"], "c");
    text("= ?", W / 2, 466, "p24", C["ffffff"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 528, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    // title
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("FROM 32,768 HZ", W / 2, 44, "p16", C["c0cbdc"], "c");
    text("TO 1 TICK", W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);

    if (f < 1020) {
      // data panel: stage, frequency, note
      const kk = k < 0 ? 15 : k;
      panel(M, 110, W - 2 * M, 70);
      text("STAGE", M + 10, 116, "s16", C["8b9bb4"]);
      text(k < 0 ? "WATCH" : k === 0 ? "XTAL" : `${String(k).padStart(2, "0")}/15`, M + 10, 136, "p16", C["ffffff"]);
      text(noteOf(kk), M + 10, 158, "s16", C["63c74d"]);
      text("FREQUENCY HZ", W - M - 10, 116, "s16", C["8b9bb4"], "r");
      text(fmt(freq(kk)), W - M - 10, 136, "p32", C["fee761"], "r", C["be4a2f"]);

      // the whole divider chain as a row of 16 lights: crystal + 15 stages
      const cell = 15, gap = 4, x0 = W / 2 - (16 * (cell + gap) - gap) / 2;
      panel(x0 - 6, 186, 16 * (cell + gap) - gap + 12, 27, C["5a6988"]);
      for (let s = 0; s <= 15; s++) {
        const x = x0 + s * (cell + gap), y = 192;
        if (s === 0 || tooFast(s)) {
          for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++)
            rect(x + xx, y + yy, 1, 1, ((xx + yy + f + s) % 2 === 0) ? C["f77622"] : C["3e2731"]);
        } else rect(x, y, cell, cell, isHigh(s, t) ? C["fee761"] : C["3e2731"]);
        if (s === k) { rect(x - 2, y - 2, cell + 4, 1, C["ffffff"]); rect(x - 2, y + cell + 1, cell + 4, 1, C["ffffff"]); }
      }

      // frequency labels over the chips near the camera
      if (k >= 0 && k <= 15) {
        for (let s = Math.max(1, k - 1); s <= Math.min(15, k + 2); s++) {
          const [lx, ly, lz] = project(stageX(s), 1.35, 0);
          if (lz < 1 && lx > M + 20 && lx < W - M - 20 && ly > 230 && ly < 430)
            text(`${fmt(freq(s))} HZ`, lx, ly - 16, "s16", s === k ? C["fee761"] : C["8b9bb4"], "c", C["181425"]);
        }
        if (k === 0) {
          const [lx, ly] = project(0, 2.1, 0);
          if (ly > 230) text("QUARTZ", lx, ly - 16, "s16", C["2ce8f5"], "c", C["181425"]);
        }
      }

      const cap = captionAt(f, k);
      if (cap) {
        const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
        panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
        text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
        text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
      }
    } else {
      // outro: the one line of maths
      panel(M, 380, W - 2 * M, 84, C["5a6988"]);
      rect(M, 380, 3, 84, C["63c74d"]);
      text("THE MATH", M + 12, 388, "s16", C["8b9bb4"]);
      text("f = 32768 / 2^n", M + 12, 412, "p16", C["ffffff"]);
      text("n = 15  ->  f = 1", M + 12, 436, "p16", C["63c74d"]);
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  }

  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const QuartzWatchVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("quartz-watch/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const QuartzWatch = () => (
  <Composition id="QuartzWatch" component={QuartzWatchVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16). The profile grid shows its centre 3:4 crop. */
export const QuartzWatchCover = () => (
  <Still id="QuartzWatchCover" component={QuartzWatchVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 150 }} />
);

