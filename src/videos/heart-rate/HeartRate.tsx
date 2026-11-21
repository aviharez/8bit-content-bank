import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { BOLUS_PARTS, buildScene, HEART_Y, HeartScene, MAX_BOLUS, VESSEL } from "./scene";
import timeline from "../../../public/heart-rate/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Animal = { id: string; name: string; mass: string; kg: number; fromBar: number; toBar: number; bpm: number; hz: number };
type HB = { animal: string; sec: number; snappedBeat: number; frame: number };
type TL = { fps: number; framesPerBeat: number; totalFrames: number; dropBar: number; outroBar: number; maxSnapMs: number; animals: Animal[]; beats: HB[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames, LOOP_S = DURATION / FPS;
const DROP_F = T.dropBar * BAR, OUTRO_F = T.outroBar * BAR;

// What you see is what you hear: each beat lands when its sound does (the 16th-snapped time); the shrew's are not snapped.
const BEAT_S = T.beats.map((b) => (b.animal === "shrew" ? b.sec : b.frame / FPS));
const PERIOD: Record<string, number> = Object.fromEntries(T.animals.map((a) => [a.id, 60 / a.bpm]));
/** Index of the last beat at or before time t (s), or -1. */
function lastBeat(t: number) {
  let lo = 0, hi = BEAT_S.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (BEAT_S[m] <= t + 1e-9) { i = m; lo = m + 1; } else hi = m - 1; }
  return i;
}
const animalAt = (f: number) => {
  const bar = Math.floor(f / BAR);
  return T.animals.find((a) => bar >= a.fromBar && bar < a.toBar) ?? T.animals[T.animals.length - 1];
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const ease = Easing.inOut(Easing.cubic);

// ---------------------------------------------------------------- scale: the rig shrinks with the animal, the room does not
// Rig scale per animal (log-spaced between whale and shrew); the camera keeps the rig the same size on screen, so the
// room grows around it: smaller body, bigger room.
const RIG: Record<string, number> = { whale: 1, elephant: 0.62, human: 0.4, cat: 0.26, rabbit: 0.18, mouse: 0.11, shrew: 0.07 };
function rigScale(f: number) {
  if (f >= OUTRO_F) { // pull back out to the whale, so the last frame is the first
    const t = ease(Math.min(1, (f - OUTRO_F) / (DURATION - OUTRO_F - 1)));
    return Math.exp(Math.log(RIG.shrew) + (Math.log(RIG.whale) - Math.log(RIG.shrew)) * t);
  }
  const a = animalAt(f), i = T.animals.indexOf(a);
  if (i === 0) return RIG.whale;
  const prev = T.animals[i - 1];
  const t = ease(Math.min(1, (f - a.fromBar * BAR) / 12));
  return Math.exp(Math.log(RIG[prev.id]) + (Math.log(RIG[a.id]) - Math.log(RIG[prev.id])) * t);
}

// ---------------------------------------------------------------- camera
function camAt(f: number, s: number) {
  const orbit = 0.42 * Math.sin((2 * Math.PI * f) / DURATION) + 0.18; // one slow swing per loop
  // build: push in; drop: in close on the heart; outro: back to the opening shot
  const push = interpolate(f, [0, 8 * BAR, DROP_F - 2, DROP_F, OUTRO_F - 20, OUTRO_F + 60, DURATION], [1, 1, 0.92, 0.84, 0.84, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const lookY = interpolate(push, [0.84, 1], [HEART_Y - 1.4, 3.0]);
  const d = 21 * push;
  const pos = new THREE.Vector3(Math.sin(orbit) * d, 4.2 + 3.2 * push, Math.cos(orbit) * d).multiplyScalar(s);
  const look = new THREE.Vector3(0, lookY * s, 0);
  return { pos, look };
}

let S: HeartScene | null = null;
const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();

function render3D(f: number) {
  S ??= buildScene(W, H);
  const { renderer, scene, camera, rig, heart, heartMat, heartLight, roomLight, turntable, animals, bolus } = S;
  const t = f / FPS;
  const s = rigScale(f);
  rig.scale.setScalar(s);
  const a = animalAt(f);

  // the animal: only the current one; it drops onto the turntable when it arrives
  for (const [id, g] of Object.entries(animals)) g.visible = id === a.id;
  const since = f - a.fromBar * BAR;
  animals[a.id].position.y = f < OUTRO_F && since < 8 ? Math.max(0, 3 * (1 - since / 6)) - (since >= 6 ? 0.15 * Math.sin(((since - 6) / 2) * Math.PI) : 0) : 0;
  // the turntable keeps the animal side-on to the camera, with a gentle swing
  turntable.rotation.y = 0.42 * Math.sin((2 * Math.PI * f) / DURATION) + 0.18 + 0.3 * Math.sin((4 * Math.PI * f) / DURATION);

  // the heart: contracts on every beat (systole squeezed into the beat interval), lights itself and the room
  const i = lastBeat(t), j = i >= 0 ? i : BEAT_S.length - 1;
  const bt = i >= 0 ? BEAT_S[i] : BEAT_S[j] - LOOP_S;
  const who = T.beats[j].animal, period = PERIOD[who];
  const age = t - bt;
  const sys = Math.min(0.32, 0.6 * period);
  const squeeze = age < sys ? Math.sin((Math.PI * age) / sys) : 0;
  const glow = Math.exp(-age / Math.min(0.35, 0.5 * period));
  const shrew = who === "shrew" && f < OUTRO_F + 30;
  heart.scale.setScalar(shrew ? (f % 2 === 0 ? 0.9 : 0.97) : 1 - 0.17 * squeeze);
  heart.rotation.y = 0.3 * Math.sin((2 * Math.PI * f) / DURATION);
  heartMat.emissiveIntensity = shrew ? 0.9 + (f % 2) * 0.3 : 0.12 + 1.3 * glow;
  // lights are not scaled with the rig, so scale their reach and strength with it (inverse-square-ish falloff, decay 1.4)
  heartLight.distance = 14 * s;
  heartLight.intensity = (shrew ? 10 + (f % 2) * 5 : 16 * glow) * s ** 1.4;
  // the room only lights up when the heart beats; a heavier heart lights it harder
  const weight = who === "whale" ? 1 : who === "elephant" ? 0.75 : 0.45;
  rig.localToWorld(tmpV.set(0, HEART_Y, 2.5));
  roomLight.position.copy(tmpV);
  roomLight.distance = 60 * s;
  roomLight.intensity = (shrew ? 14 + (f % 2) * 6 : 40 * weight * glow) * s ** 1.2;

  // blood: every beat pushes one pulse round the vessel loop in 2 s, so the gap between pulses is the gap between beats
  const TRAVEL = 2.0;
  let n = 0;
  const pushPulse = (u: number) => {
    for (let p = 0; p < BOLUS_PARTS && n < MAX_BOLUS * BOLUS_PARTS; p++) {
      const uu = u - p * 0.01;
      if (uu < 0) continue;
      VESSEL.getPointAt(Math.min(1, uu), tmpV);
      const sc = (1 - p * 0.18) * (u < 0.05 ? u / 0.05 : 1);
      tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(sc));
      bolus.setMatrixAt(n, tmpM);
      bolus.setColorAt(n, tmpC.set(p === 0 ? C["ffffff"] : p < 3 ? C["ff0044"] : C["e43b44"]));
      n++;
    }
  };
  for (let k = lastBeat(t); k >= 0; k--) { const u = (t - BEAT_S[k]) / TRAVEL; if (u > 1) break; pushPulse(u); }
  for (let k = BEAT_S.length - 1; k >= 0; k--) { const u = (t + LOOP_S - BEAT_S[k]) / TRAVEL; if (u > 1) break; pushPulse(u); } // wrap
  bolus.count = n;
  bolus.instanceMatrix.needsUpdate = true;
  if (bolus.instanceColor) bolus.instanceColor.needsUpdate = true;

  // camera; the only shake is the whale's and the elephant's heartbeat: the heaviest hearts in the video
  const { pos, look } = camAt(f, s);
  let shake = 0;
  if ((who === "whale" || who === "elephant") && age < 0.4) shake = (who === "whale" ? 0.22 : 0.12) * Math.exp(-age / 0.12);
  camera.position.set(pos.x + Math.sin(f * 12.9) * shake * s, pos.y + Math.cos(f * 7.3) * shake * s, pos.z);
  camera.near = 0.02 * s;
  camera.updateProjectionMatrix();
  camera.lookAt(look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return { a };
}

// ---------------------------------------------------------------- captions (bottom box, house style)
function captionAt(f: number): [string, string] | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["HOW FAST CAN", "A HEART BEAT?"];
  if (bar < 4) return ["BIGGER BODY", "SLOWER HEART"];
  if (bar < 6) return ["EACH RED PULSE", "IS ONE HEARTBEAT"];
  if (bar < 8) return ["CAT: 170 A MINUTE", "THIS SONG: 180"];
  if (bar < 10) return ["SMALLER BODY", "FASTER HEART"];
  if (bar < 12) return ["THE PULSES", "ALMOST TOUCH"];
  if (bar < 16) return ["19.5 BEATS A SECOND", "NO GAPS LEFT"];
  if (bar < 20) return ["SO IT'S A NOTE", "x16 = 312 Hz = D#"];
  return null;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const { a } = render3D(f);
  const outro = f >= OUTRO_F;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  if (outro && !cover) { // dim the scene under the plot
    const k = interpolate(f, [OUTRO_F, OUTRO_F + 10, DURATION - 24, DURATION - 4], [0, 0.72, 0.72, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    ctx.fillStyle = `rgba(24,20,37,${k})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);

  if (cover) { // key text inside the centre 3:4 crop (y 80-560)
    panel(M, 86, W - 2 * M, 66, C["c0cbdc"]);
    text("HOW FAST CAN A", W / 2, 96, "p16", C["c0cbdc"], "c");
    text("HEART BEAT?", W / 2, 120, "p24", C["fee761"], "c", C["be4a2f"]);
    panel(M + 20, 470, W - 2 * M - 40, 52, C["c0cbdc"]);
    text("SHREW, 1.8 g", W / 2, 480, "p16", C["ffffff"], "c");
    text("BEATS A MINUTE = ?", W / 2, 500, "s16", C["fee761"], "c");
    text("@squarewavelab", W / 2, 586, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    // title + number
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("HEART RATE", W / 2, 44, "p16", C["c0cbdc"], "c");
    let num: string, unit: string;
    if (outro) { num = "241"; unit = " x M^-1/4"; }
    else {
      const i = T.animals.indexOf(a), prev = T.animals[Math.max(0, i - 1)];
      const k = i === 0 ? 1 : Math.min(1, (f - a.fromBar * BAR) / 6); // the counter rolls to the new value
      num = fmt(prev.bpm + (a.bpm - prev.bpm) * k); unit = " /min";
    }
    const wNum = measure(num, "p32"), wU = measure(unit, "p16");
    text(num, W / 2 - (wNum + wU) / 2, 66, "p32", C["fee761"], "l", C["be4a2f"]);
    text(unit, W / 2 - (wNum + wU) / 2 + wNum, 80, "p16", C["8b9bb4"]);

    if (!outro) {
      // animal + mass
      panel(M, 110, W - 2 * M, 52);
      text("ANIMAL", M + 10, 116, "s16", C["8b9bb4"]);
      text(a.name, M + 10, 136, "s16", C["ffffff"]);
      text("MASS", W - M - 10, 116, "s16", C["8b9bb4"], "r");
      text(a.mass, W - M - 10, 136, "p16", C["fee761"], "r");
      if (f < DROP_F) text(`BEATS SNAPPED TO 16THS (<${Math.ceil(T.maxSnapMs)} MS)`, W / 2, 168, "s16", C["8b9bb4"], "c", C["181425"]);
      const cap = captionAt(f);
      if (cap) {
        const l2 = cap[1].includes("Hz") ? "p16" : "s16";
        const w = Math.max(measure(cap[0], "p16"), measure(cap[1], l2)) + 28;
        panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
        text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
        text(cap[1], W / 2, 480, l2, C["fee761"], "c");
      }
    } else {
      // the payoff: all seven hearts on one straight line (log-log), one dot per beat
      const PX = { x0: M + 14, x1: W - M - 14, y0: 400, y1: 140 };
      const lx = (kg: number) => PX.x0 + ((Math.log10(kg) + 3) / 8.2) * (PX.x1 - PX.x0);
      const ly = (bpm: number) => PX.y0 + ((Math.log10(bpm) - 0.8) / 2.4) * (PX.y1 - PX.y0);
      rect(PX.x0, PX.y1, 1, PX.y0 - PX.y1, C["8b9bb4"]);
      rect(PX.x0, PX.y0, PX.x1 - PX.x0, 1, C["8b9bb4"]);
      text("BEATS/MIN", PX.x1, PX.y1 - 4, "s16", C["c0cbdc"], "r");
      text("MASS", PX.x1, PX.y0 + 3, "s16", C["c0cbdc"], "r");
      for (let x = PX.x0; x <= PX.x1; x += 2) {
        const kg = 10 ** (((x - PX.x0) / (PX.x1 - PX.x0)) * 8.2 - 3);
        rect(x, ly(241 * kg ** -0.25), 1, 1, C["ff0044"]);
      }
      const shown = Math.floor((f - OUTRO_F) / FPB) + 1;
      T.animals.slice(0, shown).forEach((an, i) => {
        const x = lx(an.kg), y = ly(an.bpm), fresh = f - OUTRO_F - i * FPB < 3;
        rect(x - 3, y - 3, 7, 7, fresh ? C["ffffff"] : C["fee761"]);
        rect(x - 2, y - 2, 5, 5, fresh ? C["fee761"] : C["e43b44"]);
        if (an.id === "shrew" || an.id === "human") text(an.id === "human" ? "YOU" : "SHREW", x + 8, y - 20, "s16", C["ffffff"]);
        if (an.id === "whale") text("WHALE", x - 8, y + 4, "s16", C["ffffff"], "r");
      });
      panel(M, 450, W - 2 * M, 52, C["5a6988"]);
      rect(M, 450, 3, 52, C["63c74d"]);
      text("bpm = 241*M^-0.25", M + 12, 458, "p16", C["ffffff"]);
      text("M IN KG. STAHL, 1967", M + 12, 480, "s16", C["63c74d"]);
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");

    // the drop: the frame whites out for a moment as the beats merge into one note
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

export const HeartRateVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    else drawLooped(ctx, ov, f, DURATION, 10, (c, o, ff) => drawFrame(c, o, ff));
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("heart-rate/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const HeartRate = () => (
  <Composition id="HeartRate" component={HeartRateVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the shrew's heart mid-drop, the blood loop solid red. The profile grid shows its centre 3:4 crop. */
export const HeartRateCover = () => (
  <Still id="HeartRateCover" component={HeartRateVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: DROP_F + 2 * BAR + 3 }} />
);
