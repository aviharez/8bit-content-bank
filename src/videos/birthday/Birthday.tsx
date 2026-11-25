import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, DOOR_SPOT, guestColour, paintCalendar, PartyScene, spot, tileWorld } from "./scene";
import timeline from "../../../public/birthday/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Guest = { n: number; day: number; month: number; dom: number; door: number; tile: number; leave: number; match: number | null };
type TL = {
  fps: number; framesPerBeat: number; totalFrames: number; months: string[]; monthLen: number[];
  guests: Guest[]; lines: { beat: number; guest: number; slot: number; to: number[] }[];
  matches: { beat: number; guest: number; with: number; day: number }[];
  panelsOn: number[]; panelsOff: number[]; kicks: { beat: number; kind: string }[]; blinks: number[];
  frames: { guests: number; chance: number }[];
};
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const G = new Map(T.guests.map((g) => [g.n, g]));
const FIRST = T.matches[0];

const fr = (beat: number) => Math.round(beat * FPB);

// ---------------------------------------------------------------- camera: the far end of the room; a little closer for the drops
function camAt(f: number) {
  const keys = [0, 11.5 * BAR, 12 * BAR, 20 * BAR, 21 * BAR, DURATION];
  const o = { ...clamp, easing: ease };
  const k = interpolate(f, keys, [0, 0, 1, 1, 0, 0], o);
  const drift = Math.sin((2 * Math.PI * f) / DURATION);
  const pos = new THREE.Vector3(0.3 + drift * 0.2, 3.4, 11.2 - 0.7 * k);
  const look = new THREE.Vector3(0.6 + drift * 0.08, 3.85 + 0.05 * k, 0);
  return { pos, look };
}

let S: PartyScene | null = null;
const proj = new THREE.Vector3();
const toScreen = (p: THREE.Vector3) => {
  proj.copy(p).project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H };
};

/** Where a guest is and how they move at beat b: hidden, walking in, standing, walking out. */
function guestAt(g: Guest, b: number) {
  const home = spot(g.n);
  const walk = g.tile - g.door; // they reach their place as their tile lands
  if (b < g.door || (b >= 80 && b >= g.leave)) return null;
  let p: THREE.Vector3, moving = false, face = 0;
  if (b < g.tile) { const u = (b - g.door) / walk; p = DOOR_SPOT.clone().lerp(home, u); moving = true; face = Math.atan2(home.x - DOOR_SPOT.x, home.z - DOOR_SPOT.z); }
  else if (b >= 80 && b > g.leave - 0.75) { const u = (b - (g.leave - 0.75)) / 0.75; p = home.clone().lerp(DOOR_SPOT, u); moving = true; face = Math.atan2(DOOR_SPOT.x - home.x, DOOR_SPOT.z - home.z); }
  else p = home.clone();
  // a match: both guests jump (the one who just came and the one already there)
  let jump = 0;
  for (const m of T.matches) {
    if (m.guest !== g.n && m.with !== g.n) continue;
    const d = b - m.beat;
    if (d >= 0 && d < 1) jump = Math.max(jump, Math.sin(Math.PI * Math.min(1, d * 2)) * 0.5);
  }
  if (moving) p.y += Math.abs(Math.sin(b * Math.PI * 4)) * 0.08; // a step every 16th
  p.y += jump;
  return { p, face };
}

function render3D(f: number) {
  S ??= buildScene(W, H, T.guests.length);
  const b = f / FPB;
  // the calendar
  const panelOn = T.months.map((_, m) => {
    const on = b >= T.panelsOn[m] && b < T.panelsOff[m];
    if (!on) return 0;
    const age = b - T.panelsOn[m];
    return age < 0.25 ? 2 : 1;
  });
  const byDay = new Map<number, Guest[]>();
  for (const g of T.guests) if (g.tile <= b && !(b >= 80 && b >= g.leave)) byDay.set(g.day, [...(byDay.get(g.day) ?? []), g]);
  paintCalendar(S.calCanvas.getContext("2d")!, T.months, T.monthLen, panelOn, (day) => {
    const gs = byDay.get(day);
    if (!gs) return { colour: null, flash: 0, matched: false };
    const latest = gs[gs.length - 1];
    const age = b - latest.tile;
    return { colour: guestColour(gs[0].n), flash: age < 0.25 ? 1 : 0, matched: gs.length > 1 && age >= 0.25 };
  });
  S.calTex.needsUpdate = true;
  // the door: swings open on each door beat (in and out), shut again after a beat
  let open = 0;
  for (const g of T.guests) {
    for (const d of [g.door, g.leave]) {
      const a = b - d;
      if (a >= -0.05 && a < 0.75) open = Math.max(open, a < 0.1 ? Math.min(1, (a + 0.05) / 0.15) : 1 - (a - 0.1) / 0.65);
    }
  }
  S.door.rotation.y = -1.3 * open;
  S.doorLight.intensity = 3 * open;
  // party lights: on for an 8th from each off-beat blink
  const lit = T.blinks.some((x) => b >= x && b < x + 0.4);
  S.bulbs.forEach((u, k) => u.mat.color.set(lit === (k % 2 === 0) ? u.on : u.off));
  // guests
  T.guests.forEach((g, i) => {
    const s = guestAt(g, b);
    const m = S!.guests[i];
    m.visible = !!s;
    if (s) { m.position.copy(s.p); m.rotation.y = s.face; }
  });
  const { pos, look } = camAt(f);
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.updateMatrixWorld();
  S.renderer.render(S.scene, S.camera);
}

// ---------------------------------------------------------------- lines drawn on the 3D layer
function line(g: CanvasRenderingContext2D, a: { x: number; y: number }, c: { x: number; y: number }, w: number, col: string) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "square";
  g.beginPath(); g.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); g.lineTo(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5); g.stroke();
}
const tileScreen = (n: number) => { const g = G.get(n)!; return toScreen(tileWorld(g.month, g.dom)); };
function drawLines(g: CanvasRenderingContext2D, f: number) {
  // pair lines: from the new guest's tile to the lit tiles it is checked against, bright for 3 frames
  for (const ln of T.lines) {
    const a = f - fr(ln.beat);
    if (a < 0 || a > 3) continue;
    const from = tileScreen(ln.guest);
    for (const to of ln.to) line(g, from, tileScreen(to), 1, a < 2 ? C["fee761"] : C["feae34"]);
  }
  // a string from the guest to their tile while it lands
  const b = f / FPB;
  for (const gu of T.guests) {
    const a = b - gu.tile;
    if (a < -0.1 || a > 0.6) continue;
    const s = guestAt(gu, b);
    if (!s) continue;
    line(g, toScreen(s.p.clone().add(new THREE.Vector3(0, 1.9, 0))), tileScreen(gu.n), 1, guestColour(gu.n));
  }
  // matches: a red line joining the two tiles, thick while fresh
  for (const m of T.matches) {
    const a = b - m.beat;
    if (a < 0 || (b >= 80 && Math.min(G.get(m.guest)!.leave, G.get(m.with)!.leave) <= b)) continue;
    const s1 = tileScreen(m.guest), s2 = tileScreen(m.with);
    if (a < 1) {
      g.strokeStyle = C["ffffff"]; g.lineWidth = 1;
      const r = 4 + a * 10;
      g.beginPath(); g.arc(Math.round(s1.x), Math.round(s1.y), r, 0, Math.PI * 2); g.stroke();
    }
    line(g, s1, s2, 1, C["ff0044"]);
  }
}

// ---------------------------------------------------------------- captions: one idea each, at least 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar >= 2 && bar < 4) return ["EACH GUEST LIGHTS", "THEIR BIRTHDAY"];
  if (bar >= 4 && bar < 6) return ["NEW GUEST: CHECK", "EVERYONE ALREADY HERE"];
  if (bar >= 6 && bar < 8) return ["PAIRS PILE UP", "FAST"];
  if (bar >= 10 && bar < 12) return ["23 GUESTS", "= 253 PAIRS"];
  if (bar >= 12 && bar < 14) return ["GUEST 23 SHARES", "A BIRTHDAY"];
  if (bar >= 20 && bar < 22) return "code";
  return null;
}
function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 432, W - 2 * M, 66, C["5a6988"]);
    rect(M, 432, 3, 66, C["fee761"]);
    text("pairs = n(n-1)/2", M + 14, 444, "p16", C["ffffff"]);
    text("23 -> 253 -> 50.7%", M + 14, 470, "p16", C["fee761"]);
  } else if (cap) {
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  drawLines(ctx, f);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { text, panel } = pixelKit(ov);
  const top = cover ? 86 : 30;
  panel(M, top, W - 2 * M, 76, C["c0cbdc"]);
  text("HOW MANY PEOPLE", W / 2, top + 8, "p16", C["c0cbdc"], "c");
  text("TILL TWO SHARE", W / 2, top + 30, "p16", C["fee761"], "c", C["68386c"]);
  text("A BIRTHDAY?", W / 2, top + 52, "p16", C["fee761"], "c", C["68386c"]);
  if (!cover) {
    const fd = T.frames[f];
    const b = f / FPB;
    const hot = b >= FIRST.beat && b < 80;
    panel(M, 112, W - 2 * M, 50);
    text("GUESTS", M + 10, 118, "s16", C["8b9bb4"]);
    text(String(fd.guests), M + 10, 136, "p16", C["ffffff"], "l", C["181425"]);
    text("CHANCE OF A MATCH", W - M - 10, 118, "s16", C["8b9bb4"], "r");
    text(`${fd.chance.toFixed(1)}%`, W - M - 10, 136, "p16", hot ? C["ff0044"] : C["fee761"], "r");
    // MATCH! over the first match's tiles for a bar
    const a = b - FIRST.beat;
    if (a >= 0 && a < 4) {
      const s = tileScreen(FIRST.guest);
      const x = Math.max(M + 50, Math.min(W - M - 50, s.x));
      panel(x - 44, s.y - 34, 88, 22, C["ff0044"]);
      text("MATCH!", x, s.y - 30, "p16", C["ff0044"], "c");
    }
    drawCaption(ov, f);
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const BirthdayVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("birthday/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const Birthday = () => (
  <Composition id="Birthday" component={BirthdayVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): just after the first match, the two tiles joined in red. */
export const BirthdayCover = () => (
  <Still id="BirthdayCover" component={BirthdayVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: fr(FIRST.beat) + 4 }} />
);
