import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, MAX_PHOTONS, PERSON, SkyScene, SUN_AZ, SUN_DIST } from "./scene";
import timeline from "../../../public/sky-blue/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type RGB = { red: number; green: number; blue: number };
type Photon = { beat: number; col: keyof RGB; scatterAt: number | null; dir: [number, number, number] };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; setBar: number; dropBar: number; riseBar: number;
  frames: { sun: number; X: number; pathKm: number; T: RGB; sky: RGB }[]; photons: Photon[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const SET_F = T.setBar * BAR, DROP_F = T.dropBar * BAR, RISE_F = T.riseBar * BAR;
const ease = Easing.inOut(Easing.cubic);
const PHOTON_COL: Record<keyof RGB, string> = { red: C["e43b44"], green: C["63c74d"], blue: C["2ce8f5"] };

/** Display colour from per-colour amounts: normalised to the brightest channel, then dimmed by overall light (log). */
function display(rgb: RGB, ref: number, floor = 0.18, gamma = 1) {
  const mx = Math.max(rgb.red, rgb.green, rgb.blue, 1e-9);
  const k = Math.max(floor, Math.min(1, 1 + Math.log10(mx / ref) * 0.35));
  const g = (v: number) => (v / mx) ** gamma * k; // gamma > 1: the screen's contrast curve, so the sky reads as blue, not grey
  return new THREE.Color().setRGB(g(rgb.red), g(rgb.green), g(rgb.blue), THREE.SRGBColorSpace); // these are screen colours
}
const NOON_SKY = T.frames[0].sky.blue;

function sunDir(e: number) {
  const el = (e * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(el), Math.sin(el), -Math.cos(SUN_AZ) * Math.cos(el)).normalize();
}

let S: SkyScene | null = null;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();

function render3D(f: number) {
  S ??= buildScene(W, H);
  const { renderer, scene, camera, dome, domeColors, sun, sunMat, glow, glowMat, sunLight, hemi, photons } = S;
  const fr = T.frames[f];
  const dir = sunDir(fr.sun);

  // colours: the sky (light scattered near her) and the sun (light that got through), both computed
  const sky = display(fr.sky, NOON_SKY, 0.6, 1.0);
  // the palette is light on saturated blues: keep the computed hue, push saturation, so the sky reads as blue, not grey
  const hsl = { h: 0, s: 0, l: 0 };
  sky.getHSL(hsl, THREE.SRGBColorSpace);
  sky.setHSL(hsl.h, Math.min(1, hsl.s * 1.4), Math.min(0.52, hsl.l), THREE.SRGBColorSpace);
  const sunC = display(fr.T, 1, 0.5);
  const horizon = sky.clone().lerp(sunC, 0.2).lerp(new THREE.Color(1, 1, 1), 0.06); // a little paler near the horizon, as in a real sky
  const pos = dome.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const up = Math.max(0, v.y);
    tmpC.copy(horizon).lerp(sky, Math.min(1, up * 9));
    domeColors.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
  }
  domeColors.needsUpdate = true;
  (scene.fog as THREE.Fog).color.copy(horizon);

  const camPos = new THREE.Vector3(-2.2 + 1.2 * Math.sin((2 * Math.PI * f) / DURATION), PERSON.y + 2.6, 6.5);
  // the sun's elevation is measured from her eye level, so at 0 degrees it sits on her horizon
  const eye = new THREE.Vector3(0, camPos.y, 0);
  sun.position.copy(dir).multiplyScalar(SUN_DIST).add(eye);
  sun.lookAt(eye);
  glow.position.copy(dir).multiplyScalar(SUN_DIST + 1).add(eye);
  glow.lookAt(eye);
  sunMat.color.copy(sunC);
  glowMat.color.copy(sunC);
  sunLight.position.copy(dir).multiplyScalar(60);
  sunLight.color.copy(sunC);
  sunLight.intensity = fr.sun > 0 ? 1.8 * Math.min(1, fr.T.red * 2) : 0.4;
  hemi.color.copy(sky);
  hemi.intensity = 0.9 + 0.5 * Math.min(1, fr.sky.blue / NOON_SKY + fr.sky.red * 20);

  // photons: from the sun towards her; each beat they cross the whole path; scattered ones fly off into the sky
  const t = f / FPB; // beats
  const start = dir.clone().multiplyScalar(SUN_DIST * 0.55).add(eye), end = PERSON.clone().add(new THREE.Vector3(0, 1.4, 0));
  let n = 0;
  for (const ph of T.photons) {
    const age = t - ph.beat;
    if (age < 0 || age > 2.2 || n >= MAX_PHOTONS) continue;
    let p: THREE.Vector3, sc = 1;
    const sA = ph.scatterAt;
    if (sA === null || age < sA) {
      if (age > 1) continue; // arrived
      p = start.clone().lerp(end, age);
    } else {
      const since = age - sA;
      if (since > 1.2) continue;
      p = start.clone().lerp(end, sA).add(new THREE.Vector3(...ph.dir).multiplyScalar(since * 22));
      sc = since < 0.15 ? 1.8 : 1; // the bounce flashes
    }
    // keep every square about the same size on screen, so one passing the camera never covers her
    const near = Math.min(1, Math.max(0.12, p.distanceTo(camPos) / 40));
    tmpM.compose(p, tmpQ.identity(), tmpS.setScalar(sc * near));
    photons.setMatrixAt(n, tmpM);
    photons.setColorAt(n, tmpC.set(sc > 1 ? C["ffffff"] : PHOTON_COL[ph.col]));
    n++;
  }
  photons.count = n;
  photons.instanceMatrix.needsUpdate = true;
  if (photons.instanceColor) photons.instanceColor.needsUpdate = true;

  // camera: behind her shoulder looking at the sky and the sun; it tilts down with the sun, back up in the morning
  const look = interpolate(f, [0, SET_F, DROP_F, RISE_F, DURATION - 1], [18.8, 18.8, 8.6, 8.6, 18.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  camera.position.copy(camPos);
  camera.lookAt(Math.sin(SUN_AZ) * 20 * 0.6, look, -40);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
}

function captionAt(f: number): [string, string] | "code" {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["SUNLIGHT IS EVERY", "COLOUR MIXED TOGETHER"];
  if (bar < 4) return ["THE AIR BOUNCES", "SOME OF IT AROUND"];
  if (bar < 6) return ["BLUE BOUNCES", "4x MORE THAN RED"];
  if (bar < 8) return ["BOUNCED BLUE", "FILLS THE WHOLE SKY"];
  if (bar < 10) return ["NOW THE SUN SETS", "ITS LIGHT CROSSES MORE AIR"];
  if (bar < 12) return ["UP TO 38x MORE AIR", "THE BLUE IS BOUNCED AWAY"];
  if (bar < 16) return ["ONLY RED", "MAKES IT THROUGH"];
  if (bar < 20) return ["THAT'S A SUNSET", "SAME SKY, LONGER ROAD"];
  if (bar < 22) return "code";
  return ["NEXT MORNING", "BLUE AGAIN"];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const fr = T.frames[f];
  const red = f >= DROP_F && f < RISE_F;
  const ty = cover ? 86 : 34;
  panel(M, ty, W - 2 * M, 70, C["c0cbdc"]);
  text("WHY IS THE SKY", W / 2, ty + 10, "p16", C["c0cbdc"], "c");
  text(red ? "RED NOW?" : "BLUE?", W / 2, ty + 32, "p32", red ? C["e43b44"] : C["2ce8f5"], "c", C["181425"]);

  if (cover) {
    panel(M + 20, 452, W - 2 * M - 40, 52, C["c0cbdc"]);
    text("AND WHY ARE", W / 2, 462, "p16", C["ffffff"], "c");
    text("SUNSETS RED?", W / 2, 482, "p16", C["fee761"], "c");
    text("@squarewavelab", W / 2, 586, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    // two readouts in plain words: how much air the sunlight crosses, how much blue gets through
    panel(M, 110, W - 2 * M, 62);
    text("AIR CROSSED", M + 10, 116, "s16", C["8b9bb4"]);
    text(`${Math.round(fr.pathKm)} km`, M + 10, 140, "p24", C["ffffff"]);
    text("BLUE THROUGH", W - M - 10, 116, "s16", C["8b9bb4"], "r");
    const pct = Math.round(fr.T.blue * 100);
    text(`${pct}%`, W - M - 10, 140, "p24", pct > 50 ? C["2ce8f5"] : pct > 5 ? C["fee761"] : C["e43b44"], "r");

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 444, W - 2 * M, 58, C["5a6988"]);
      rect(M, 444, 3, 58, C["63c74d"]);
      text("bounce ~ 1/L^4", M + 12, 452, "p16", C["ffffff"]);
      text("L = WAVELENGTH. RAYLEIGH", M + 12, 478, "s16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    if (f < DROP_F) {
      // a key for the dots
      const ky = 178;
      [["e43b44", "RED"], ["63c74d", "GREEN"], ["2ce8f5", "BLUE"]].forEach(([c, label], i) => {
        const x = M + i * 92;
        rect(x, ky + 4, 8, 8, C[c as keyof typeof C]);
        text(label, x + 12, ky, "s16", C["c0cbdc"], "l", C["181425"]);
      });
      text("LIGHT", W - M, ky, "s16", C["c0cbdc"], "r", C["181425"]);
    }
    text("@squarewavelab", W / 2, 586, "s16", C["c0cbdc"], "c", C["181425"]);

    // the sun touches the horizon: a flash as the sky turns
    const sd = f - DROP_F;
    if (sd >= 0 && sd < 5) {
      const th = 0.7 * (1 - sd / 5);
      ov.fillStyle = C["feae34"];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < th) ov.fillRect(x, y, 1, 1);
    }
  }
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const SkyBlueVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("sky-blue/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const SkyBlue = () => (
  <Composition id="SkyBlue" component={SkyBlueVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the sun on the horizon, the sky red. The profile grid shows its centre 3:4 crop. */
export const SkyBlueCover = () => (
  <Still id="SkyBlueCover" component={SkyBlueVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: DROP_F + 2 * BAR }} />
);
