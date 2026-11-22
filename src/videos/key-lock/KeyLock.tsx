import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, LOCK, LockScene, PLUG_AXIS, pinWX, SPRING_COILS, wx, wy } from "./scene";
import timeline from "../../../public/key-lock/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Frame = { key: string | null; D: number | null; plug: number; kp: number[]; dr: number[]; lined: boolean[]; set: boolean[]; pick: { x: number; y: number } | null; wrench: boolean };
type Landing = { frame: number; pins: { i: number; lined: boolean }[]; kind: string };
type Turn = { frame: number; ok: boolean; key: string };
type TL = {
  fps: number; framesPerBeat: number; totalFrames: number; frames: Frame[]; landings: Landing[]; turns: Turn[];
  sets: { frame: number; pin: number; count: number }[]; pushes: { frame: number; pin: number }[];
  keys: Record<string, { cuts: number[]; tag: string; right: boolean }>;
};
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const HAS_TRACK = true;

/** Frames since the latest event at or before f (Infinity if none). */
const since = (frames: number[], f: number) => { let best = Infinity; for (const e of frames) if (e <= f && f - e < best) best = f - e; return best; };
const landFrames = T.landings.map((l) => l.frame);
const turnBlocked = T.turns.filter((t) => !t.ok);

// ---------------------------------------------------------------- camera: on the cut face, sways at most 20 degrees; pulls back in the drop
function camAt(f: number) {
  const sway = 0.24 * Math.sin((2 * Math.PI * f) / DURATION); // radians, about 14 degrees
  const keys = [0, 4 * BAR, 6 * BAR, 8 * BAR - 6, 12 * BAR, 12 * BAR + 8, 20 * BAR, 21 * BAR, DURATION];
  // in bars 6-7 the camera pushes in on the red pin (pin 2); in the drop it pulls back a little
  const dist = interpolate(f, keys, [52, 52, 52, 40, 40, 60, 60, 52, 52], { ...clamp, easing: ease });
  const tx = interpolate(f, keys, [0.6, 0.6, 0.6, pinWX(1), pinWX(1), 0.3, 0.3, 0.6, 0.6], { ...clamp, easing: ease });
  const ty = interpolate(f, keys, [4.6, 4.6, 4.6, 5.0, 5.0, 4.0, 4.0, 4.6, 4.6], { ...clamp, easing: ease });
  const tilt = 0.33; // looking down about 19 degrees
  const pos = new THREE.Vector3(tx + Math.sin(sway) * dist * Math.cos(tilt), ty + Math.sin(tilt) * dist, Math.cos(sway) * dist * Math.cos(tilt));
  return { pos, look: new THREE.Vector3(tx, ty, 0) };
}

let S: LockScene | null = null;
const proj = new THREE.Vector3();

function render3D(f: number) {
  S ??= buildScene(W, H, T.keys);
  const fr = T.frames[f];
  const { plug, keyPins, drivers, springs, keyPinMats, driverMats, keys, pick, pickTip, wrench } = S;
  plug.rotation.x = (fr.plug * Math.PI) / 180;

  // green while a pin's split is on the line; a red flash on a pin that blocks a turn
  const blocked = turnBlocked.find((t) => f >= t.frame && f - t.frame < 9);
  const sinceLand = since(landFrames, f);
  for (let i = 0; i < LOCK.pins; i++) {
    keyPins[i].position.set(pinWX(i), wy(fr.kp[i] - PLUG_AXIS), 0);
    keyPins[i].scale.y = wy(LOCK.keyPin[i]);
    drivers[i].position.set(pinWX(i), wy(fr.dr[i]), 0);
    drivers[i].scale.y = wy(LOCK.driver);
    const top = fr.dr[i] + LOCK.driver;
    springs[i].position.set(pinWX(i), wy(top), 0);
    springs[i].children.forEach((c, k) => c.position.set(0, wy(LOCK.chamberTop - top) * (k + 0.5) / SPRING_COILS, 0));
    const red = blocked && !T.frames[blocked.frame].lined[i];
    // a soft glow, so the gold bottom pin and the white top pin stay told apart; when picked, only the caught top pin glows
    const g = fr.lined[i] ? 0.35 + 0.9 * Math.exp(-sinceLand / 2.5) : 0;
    const mats = fr.set[i] ? [driverMats[i]] : [keyPinMats[i], driverMats[i]];
    for (const m of [keyPinMats[i], driverMats[i]]) { m.emissive.set(red ? C["ff0044"] : C["63c74d"]); m.emissiveIntensity = 0; }
    for (const m of mats) m.emissiveIntensity = red ? 1.4 * Math.exp(-(f - blocked!.frame) / 4) + 0.4 : g;
  }
  for (const [id, g] of Object.entries(keys)) {
    g.visible = fr.key === id && fr.D !== null;
    if (g.visible) g.position.set(wx(-fr.D!), wy(-PLUG_AXIS), 0);
  }
  pick.visible = fr.pick !== null;
  if (fr.pick) {
    const tipX = wx(fr.pick.x), base = wy(0.06 - PLUG_AXIS);
    const shaft = pick.getObjectByName("shaft")!, handle = pick.getObjectByName("handle")!;
    shaft.position.set(tipX, base, 0.7);
    shaft.scale.x = tipX - wx(-0.9);
    handle.position.set(wx(-0.9) - 7, base - 0.6, 0.7);
    pickTip.position.set(tipX, base, 0.7);
    pickTip.scale.y = Math.max(0.2, wy(fr.pick.y - 0.06));
  }
  wrench.visible = fr.wrench;

  const { pos, look } = camAt(f);
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.updateMatrixWorld();
  S.renderer.render(S.scene, S.camera);
  return fr;
}

/** Screen position (low-res px) of a world point. */
function toScreen(x: number, y: number, z: number) {
  proj.set(x, y, z).project(S!.camera);
  return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H };
}

// ---------------------------------------------------------------- captions: one idea each, 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["A KEY GOES IN", "5 PINS RIDE ITS BUMPS"];
  if (bar < 4) return ["WRONG KEY", "IT WON'T TURN"];
  if (bar < 6) return ["EACH PIN IS CUT IN TWO", "A SPRING PUSHES IT DOWN"];
  if (bar < 8) return ["ONE PIN OFF THE LINE", "AND IT STAYS LOCKED"];
  if (bar < 10) return ["NO KEY?", "A PICK LIFTS ONE AT A TIME"];
  if (bar < 12) return ["EACH ONE CATCHES", "ON THE LINE"];
  if (bar < 14) return ["ALL 5 ON THE LINE", "IT TURNS"];
  if (bar < 16) return ["THE RIGHT KEY", "LIFTS ALL 5 AT ONCE"];
  if (bar < 18) return ["THE KEY'S SHAPE", "IS ITS SONG"];
  if (bar < 20) return "code";
  if (bar < 21) return ["ONCE MORE, SLOWLY", "IN, TURN..."];
  if (bar < 22) return ["...AND OUT", "SPRINGS PUSH THE PINS BACK"];
  return ["WRONG KEY", "LOCKED AGAIN"];
}

function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 444, W - 2 * M, 62, C["5a6988"]);
    rect(M, 444, 3, 62, C["63c74d"]);
    text("h = key(x - pin)", M + 12, 452, "p8", C["ffffff"]);
    text("open = all(on_line)", M + 12, 468, "p8", C["63c74d"]);
    text("EVERY NOTE IS A PIN", M + 12, 486, "s16", C["c0cbdc"]);
  } else if (cap) {
    const l1 = measure(cap[0], "p16") <= W - 2 * M - 20 ? "p16" : "s16";
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], l1), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, l1, C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const fr = render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { rect, text, panel } = pixelKit(ov);
  const bar = Math.floor(f / BAR);

  // the shear line: dashed, across the whole lock, green under every pin that is on it
  const a = toScreen(wx(-0.02), wy(LOCK.shear), 0.6), b = toScreen(wx(1.17), wy(LOCK.shear), 0.6);
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
  const allOn = fr.lined.every(Boolean);
  for (let k = 0; k < n; k++) {
    if ((k >> 1) % 2) continue;
    const t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    const xin = -0.02 + 1.19 * t;
    const near = LOCK.keyPin.findIndex((_, i) => Math.abs(xin - (0.247 + 0.15 * i)) < 0.07);
    const col = allOn || (near >= 0 && fr.lined[near]) ? C["63c74d"] : C["fee761"];
    rect(x, y + 1, 3, 1, C["181425"]);
    rect(x, y - 1, 3, 2, col);
  }
  // labels while the rule is explained (bars 4-7)
  if (bar >= 4 && bar < 8) {
    const lab = (s: string, x: number, y: number, tx: number, ty: number) => {
      const p = toScreen(x, y, 0.6);
      rect(Math.min(p.x, tx), ty + 4, Math.abs(tx - p.x), 1, C["c0cbdc"]);
      rect(p.x, Math.min(p.y, ty + 4), 1, Math.abs(ty + 4 - p.y), C["c0cbdc"]);
      text(s, tx, ty - 4, "s16", C["ffffff"], tx < W / 2 ? "r" : "l", C["181425"]);
    };
    const i = 4;
    if (bar < 6) {
      lab("SPRING", pinWX(i), wy(LOCK.chamberTop - 0.12), W - M - 60, 176);
      lab("TOP PIN", pinWX(i), wy(fr.dr[i] + 0.08), W - M - 60, 214);
      lab("BOTTOM PIN", pinWX(0), wy(fr.kp[0] + 0.05), M + 80, 404);
    }
    const l = toScreen(wx(-0.02), wy(LOCK.shear), 0.6);
    text("THE LINE", Math.max(M, l.x - 4), l.y - 18, "s16", C["fee761"], "l", C["181425"]);
  }

  if (cover) {
    panel(M, 86, W - 2 * M, 60, C["c0cbdc"]);
    text("HOW DOES A KEY", W / 2, 96, "p16", C["c0cbdc"], "c");
    text("OPEN A LOCK?", W / 2, 120, "p16", C["fee761"], "c", C["be4a2f"]);
  } else {
    panel(M, 30, W - 2 * M, 56, C["c0cbdc"]);
    text("HOW DOES A KEY", W / 2, 38, "p16", C["c0cbdc"], "c");
    text("OPEN A LOCK?", W / 2, 60, "p16", C["fee761"], "c", C["be4a2f"]);
    // two readouts: pins on the line, and the key
    panel(M, 92, W - 2 * M, 50);
    text("PINS LINED UP", M + 10, 98, "s16", C["8b9bb4"]);
    const on = fr.lined.filter(Boolean).length;
    text(`${on}/5`, M + 10, 116, "p16", on === 5 ? C["63c74d"] : C["fee761"], "l", C["181425"]);
    text("KEY", W - M - 10, 98, "s16", C["8b9bb4"], "r");
    const lastTurn = [...T.turns].reverse().find((t) => t.frame <= f && f - t.frame < 2 * BAR);
    const keyTxt = fr.pick || fr.wrench ? "PICK" : !fr.key ? "-" : lastTurn && lastTurn.key === fr.key ? (lastTurn.ok ? "RIGHT" : "WRONG") : "?";
    text(keyTxt, W - M - 10, 116, "p16", keyTxt === "RIGHT" ? C["63c74d"] : keyTxt === "WRONG" ? C["ff0044"] : C["ffffff"], "r");
    text(bar >= 13 && bar < 20 ? "SLOWED DOWN, 2X SPEED" : "SLOWED DOWN", W - M, 148, "s16", C["8b9bb4"], "r", C["181425"]);
    drawCaption(ov, f);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const KeyLockVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined && HAS_TRACK ? <Audio src={staticFile("key-lock/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const KeyLock = () => (
  <Composition id="KeyLock" component={KeyLockVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the drop, all five pins green on the line. */
export const KeyLockCover = () => (
  <Still id="KeyLockCover" component={KeyLockVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 13 * BAR + 15 }} />
);
