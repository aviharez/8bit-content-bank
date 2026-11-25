import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, setRing, StormScene, WORLD } from "./scene";
import timeline from "../../../public/lightning/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Pt = [number, number, number];
type Strike = {
  i: number; beat: number; gap: number; km: number; target: { kind: string; x: number; y: number; z: number; base: number };
  bolt: Pt[]; branches: { from: number; pts: Pt[] }[]; leader: { beat: number; k: number; side: number }[]; strokes: { beat: number; n: number }[];
};
type TL = {
  fps: number; framesPerBeat: number; totalFrames: number; openLeadFrames: number; strikes: Strike[];
  passes: { beat: number; strike: number; tower: number }[]; booms: { beat: number; strike: number; gap: number; km: number }[];
  drips: number[]; frames: { front: { strike: number; r: number } | null; seconds: number | null }[];
};
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const HAS_TRACK = true;

const fr = (beat: number) => Math.round(beat * FPB);
/** Frames from event frame e to f, wrapped into [-DURATION/2, DURATION/2). */
const rel = (f: number, e: number) => ((((f - e) % DURATION) + DURATION + DURATION / 2) % DURATION) - DURATION / 2;

// ---------------------------------------------------------------- camera: over the listener's shoulder; tilts up for the drop
// the drop: a few steps back on the deck, looking a little up, so the tree, the pole, the bolt and the listener all fit
const DROP_CAM = { back: -10, up: 9, pitch: 8 };
function camAt(f: number) {
  // on the deck, looking down the valley; for the drop it pulls back along the ridge and looks up at the tree and pole
  const keys = [0, 11 * BAR, 12 * BAR, 16 * BAR, 17 * BAR, DURATION];
  const o = { ...clamp, easing: ease };
  const pitch = interpolate(f, keys, [-12, -12, DROP_CAM.pitch, DROP_CAM.pitch, -12, -12], o) * (Math.PI / 180);
  const back = interpolate(f, keys, [-2, -2, DROP_CAM.back, DROP_CAM.back, -2, -2], o);
  const up = interpolate(f, keys, [7.5, 7.5, DROP_CAM.up, DROP_CAM.up, 7.5, 7.5], o);
  const drift = Math.sin((2 * Math.PI * f) / DURATION); // a slow sway, back where it started at the loop
  const pos = new THREE.Vector3(drift * 0.3, WORLD.hill + up, back);
  const yaw = (-2 + drift * 1.2) * (Math.PI / 180);
  const look = new THREE.Vector3(pos.x + Math.sin(yaw) * Math.cos(pitch), pos.y + Math.sin(pitch), pos.z + Math.cos(yaw) * Math.cos(pitch));
  return { pos, look };
}

/** How bright a strike's channel is at frame f (0..1.4), and how much of the leader has grown (steps shown). */
function strikeState(s: Strike, f: number) {
  const sf = fr(s.beat);
  const r = rel(f, sf);
  const first = rel(fr(s.leader[0].beat), sf); // negative: the leader starts before the flash
  const last = rel(fr(s.strokes[s.strokes.length - 1].beat), sf);
  if (r < first || r > last + 10) return null;
  const steps = r < 0 ? s.leader.filter((l) => rel(fr(l.beat), sf) <= r).length : s.leader.length;
  let glow = 0;
  if (r >= 0) {
    for (const k of s.strokes) { const d = r - rel(fr(k.beat), sf); if (d >= 0) glow = Math.max(glow, (k.n === 0 ? 1.4 : 1.0) * Math.exp(-d / 1.6)); }
    glow = Math.max(glow, r <= last + 10 ? 0.25 * (1 - (r - last) / 10) * (r > last ? 1 : 1) : 0);
  }
  return { steps, glow, leading: r < 0 };
}

let S: StormScene | null = null;
const proj = new THREE.Vector3();
const toScreen = (p: Pt | THREE.Vector3) => {
  if (Array.isArray(p)) proj.set(p[0], p[1], p[2]); else proj.copy(p);
  proj.project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H, behind: proj.z > 1 };
};

function render3D(f: number) {
  S ??= buildScene(W, H);
  const b = f / FPB;
  // the flash: the brightest channel on screen lights the land and the cloud
  let flash = 0, flashAt: Pt | null = null;
  for (const s of T.strikes) {
    const st = strikeState(s, f);
    if (st && st.glow > flash) { flash = st.glow; flashAt = s.bolt[Math.floor(s.bolt.length / 2)]; }
  }
  S.hemi.intensity = 2.4 + 2.0 * flash;
  S.flash.intensity = 2.5 * flash;
  if (flashAt) {
    S.flash.position.set(flashAt[0], flashAt[1], flashAt[2]);
    S.flash.target.position.set(0, WORLD.hill, 0);
    S.cloudGlow.position.set(flashAt[0], WORLD.cloudBase - 60, flashAt[2]);
  }
  S.cloudGlow.intensity = 6 * flash;
  // the thunder on its way: a bright edge and the rumble half a second behind it
  const fd = T.frames[f].front;
  S.front.visible = S.tail.visible = !!fd;
  if (fd) {
    const t = T.strikes[fd.strike].target;
    const w = 14 + fd.r * 0.012;
    setRing(S.front, t.x, t.z, fd.r - w, fd.r);
    setRing(S.tail, t.x, t.z, fd.r - WORLD.sound / 2, fd.r - w);
  }
  // the listener flinches when the thunder reaches the porch
  const boomAge = Math.min(...T.booms.map((x) => { const d = rel(f, fr(x.beat)); return d >= 0 ? d : Infinity; }));
  const flinch = boomAge < 6 ? Math.exp(-boomAge / 2) : 0;
  S.person.scale.set(1 + 0.04 * flinch, 1 - 0.07 * flinch, 1);
  void b;

  const { pos, look } = camAt(f);
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.updateMatrixWorld();
  S.renderer.render(S.scene, S.camera);
  return { flash };
}

// ---------------------------------------------------------------- drawn on the 3D layer before the palette snap
function line(g: CanvasRenderingContext2D, a: { x: number; y: number }, c: { x: number; y: number }, w: number, col: string) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "square";
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
}
function drawBolts(g: CanvasRenderingContext2D, f: number) {
  for (const s of T.strikes) {
    const st = strikeState(s, f);
    if (!st) continue;
    const pts = s.bolt.map(toScreen);
    const n = st.leading ? st.steps : s.bolt.length - 1;
    const core = st.leading ? C["b55088"] : st.glow > 0.6 ? C["ffffff"] : C["c0cbdc"];
    // a strike right here (0 seconds away) is drawn wide: it is 16 m from the camera, the others a kilometre or more
    const near = s.gap === 0 ? 2 : 1;
    const width = (st.leading ? 1 : 1 + Math.round(2 * Math.min(1, st.glow))) * near;
    if (!st.leading && st.glow > 0.3) for (let k = 0; k < n; k++) line(g, pts[k], pts[k + 1], width + 4 * near, C["68386c"]);
    for (const br of s.branches) {
      if (br.from >= n) continue;
      const bp = br.pts.map(toScreen);
      for (let k = 0; k < bp.length - 1; k++) line(g, bp[k], bp[k + 1], 1, st.leading ? C["68386c"] : C["b55088"]);
    }
    for (let k = 0; k < n; k++) line(g, pts[k], pts[k + 1], width, core);
    if (st.leading && n > 0) { const tip = pts[n]; g.fillStyle = C["ffffff"]; g.fillRect(Math.round(tip.x) - 1, Math.round(tip.y) - 1, 3, 3); }
  }
}
function drawLamps(g: CanvasRenderingContext2D, f: number) {
  // a red warning lamp on top of every tower; it flashes white while the thunder sweeps over it (half a second)
  S!.towerTops.forEach((p, k) => {
    const s = toScreen(p);
    if (s.behind) return;
    const hit = T.passes.find((x) => x.tower === k && rel(f, fr(x.beat)) >= 0 && rel(f, fr(x.beat)) < FPB / 2);
    const big = k <= 1 ? 3 : 2;
    g.fillStyle = hit ? C["ffffff"] : C["ff0044"];
    const sz = hit ? big + 2 : big;
    g.fillRect(Math.round(s.x - sz / 2), Math.round(s.y - sz / 2), sz, sz);
  });
}
function hash(n: number) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
function drawRain(g: CanvasRenderingContext2D, f: number, flash: number) {
  // rain streaks, a pure function of the frame (each drop falls on a fixed loop that divides the video)
  g.fillStyle = flash > 0.5 ? C["c0cbdc"] : C["5a6988"];
  for (let k = 0; k < 140; k++) {
    const x = Math.floor(hash(k) * W), period = 16 + Math.floor(hash(k + 500) * 3) * 4; // 16, 20 or 24 frames
    const y = ((hash(k + 900) * H + ((f % period) / period) * H) % H);
    g.fillRect(x, Math.round(y), 1, 5);
  }
}
function drawDrips(g: CanvasRenderingContext2D, f: number) {
  // the porch roof drips into a puddle on the boards, bottom right
  const cx = 300, cy = 600;
  for (const d of T.drips) {
    const a = rel(f, fr(d));
    if (a < -6 || a > 9) continue;
    if (a < 0) { g.fillStyle = C["8b9bb4"]; g.fillRect(cx, cy - 6 + a * 7, 1, 3); continue; }
    const r = 2 + a * 1.6;
    g.strokeStyle = a < 4 ? C["c0cbdc"] : C["5a6988"]; g.lineWidth = 1;
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2); g.stroke();
  }
}

// ---------------------------------------------------------------- captions: one idea each, at least 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["YOU SEE IT", "AT ONCE"];
  if (bar < 4) return ["YOU HEAR IT", "LATER"];
  if (bar < 6) return ["COUNT", "THE SECONDS"];
  if (bar < 8) return ["3 SECONDS", "= 1 KM"];
  if (bar >= 12 && bar < 14) return ["0 SECONDS", "IT'S RIGHT ABOVE YOU"];
  if (bar >= 16 && bar < 18) return "code";
  return null;
}
function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    // house type size: 16 px (CLAUDE.md rule 6)
    panel(M, 432, W - 2 * M, 66, C["5a6988"]);
    rect(M, 432, 3, 66, C["fee761"]);
    text("km = seconds / 3", M + 14, 444, "p16", C["ffffff"]);
    text("sound: 343 m/s", M + 14, 470, "p16", C["fee761"]);
  } else if (cap) {
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const { flash } = render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  drawRain(ctx, f, flash);
  drawBolts(ctx, f);
  drawLamps(ctx, f);
  drawDrips(ctx, f);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { text, panel } = pixelKit(ov);
  const bar = Math.floor(f / BAR);
  const top = cover ? 86 : 30;
  panel(M, top, W - 2 * M, 56, C["c0cbdc"]);
  text("HOW FAR AWAY IS", W / 2, top + 8, "p16", C["c0cbdc"], "c");
  text("THE LIGHTNING?", W / 2, top + 30, "p16", C["fee761"], "c", C["68386c"]);
  if (!cover) {
    // two readouts: the seconds counted since the flash, and the distance once the thunder arrives
    const drop = bar >= 12 && bar < 16;
    const fd = T.frames[f].front;
    let secs: string, secCol = C["ffffff"], km = "?";
    const lastBoom = [...T.booms].map((x) => ({ ...x, d: rel(f, fr(x.beat)) })).filter((x) => x.d >= 0).sort((a, c) => a.d - c.d)[0];
    if (drop) { secs = "0"; km = "0"; secCol = C["fee761"]; }
    else if (fd && fd.r < WORLD.sound - 1e-6 && lastBoom && lastBoom.d < FPB) { secs = String(lastBoom.gap); km = lastBoom.km.toFixed(1); secCol = C["fee761"]; }
    else secs = String(T.frames[f].seconds ?? 0);
    panel(M, 92, W - 2 * M, 50);
    text("SECONDS", M + 10, 98, "s16", C["8b9bb4"]);
    text(secs, M + 10, 116, "p16", secCol, "l", C["181425"]);
    text("KM AWAY", W - M - 10, 98, "s16", C["8b9bb4"], "r");
    text(km, W - M - 10, 116, "p16", km === "?" ? C["5a6988"] : C["fee761"], "r");
    text("TIME SQUEEZED", W - M, 148, "s16", C["8b9bb4"], "r", C["181425"]);
    drawCaption(ov, f);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const LightningVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
  const current = useCurrentFrame();
  // the video starts T.openLeadFrames before beat 0 (the track is rotated the same amount in compose.py)
  const f = coverFrame ?? (current + DURATION - T.openLeadFrames) % DURATION;
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
      {coverFrame === undefined && HAS_TRACK ? <Audio src={staticFile("lightning/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const Lightning = () => (
  <Composition id="Lightning" component={LightningVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the drop, a bolt on the tree right beside the listener. */
export const LightningCover = () => (
  <Still id="LightningCover" component={LightningVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 12 * BAR }} />
);
