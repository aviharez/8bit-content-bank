import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { ANIMAL_SPRITES, drawSprite, HEART } from "./sprites";
import timeline from "../../../public/heart-rate/timeline.json";

// Flat pixel art drawn at 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Animal = { id: string; name: string; mass: string; kg: number; fromBar: number; toBar: number; bpm: number; hz: number };
type HB = { animal: string; sec: number; snappedBeat: number; frame: number; pitch: number | null };
type TL = { fps: number; framesPerBeat: number; bars: number; totalFrames: number; dropBar: number; outroBar: number; maxSnapMs: number;
  animals: Animal[]; beats: HB[]; kicks: number[]; snares: number[] };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const DROP_F = T.dropBar * BAR, OUTRO_F = T.outroBar * BAR;

// ---------------------------------------------------------------- timing helpers (all pure functions of the frame)
const BEAT_FRAMES = T.beats.map((b) => b.frame); // sorted
const KICK_FRAMES = T.kicks.map((k) => k * FPB).sort((a, b) => a - b);
/** Frames since the most recent event at or before f (wrapping around the loop), and its index. */
function since(list: number[], f: number): { age: number; i: number } {
  let lo = 0, hi = list.length - 1, i = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid] <= f + 1e-6) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  if (i < 0) return { age: f + DURATION - list[list.length - 1], i: list.length - 1 };
  return { age: f - list[i], i };
}
const animalAt = (f: number) => {
  const bar = Math.floor(f / BAR);
  return T.animals.find((a) => bar >= a.fromBar && bar < a.toBar) ?? null;
};
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// ---------------------------------------------------------------- effects
/** Screen shake: every kick (and the whale's and elephant's heartbeats) knocks the frame, decaying over a few frames. */
function shake(f: number): [number, number] {
  let dx = 0, dy = 0;
  const k = since(KICK_FRAMES, f);
  const bar = Math.floor(f / BAR);
  const drop = f >= DROP_F && f < OUTRO_F;
  let amp = drop ? 4 : bar < 4 || bar >= T.outroBar ? 2 : 2.5;
  if (Math.abs(KICK_FRAMES[k.i] - DROP_F) < 0.5) amp = 9; // the drop
  const decay = Math.exp(-k.age / 2.2);
  if (k.age < 8) {
    const a = hash(k.i) * Math.PI * 2;
    dx += Math.cos(a) * amp * decay; dy += Math.sin(a) * amp * decay;
  }
  // the big hearts hit as hard as the drop
  const h = since(BEAT_FRAMES, f), hb = T.beats[h.i];
  if ((hb.animal === "whale" || hb.animal === "elephant") && h.age < 10) {
    const big = hb.animal === "whale" ? 8 : 5;
    dy += big * Math.exp(-h.age / 2.5) * (h.age % 2 === 0 ? 1 : -1);
  }
  // the shrew's heart buzzes at 19.5 Hz: faster than 30 fps can show, so the frame trembles one pixel every frame
  if (drop) { dx += f % 2 === 0 ? 1 : -1; dy += hash(f) > 0.5 ? 1 : 0; }
  return [Math.round(dx), Math.round(dy)];
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither fill: covers `t` (0..1) of the area, so fades stay inside the palette. */
function ditherFill(ov: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, t: number) {
  if (t <= 0) return;
  ov.fillStyle = c;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (BAYER[(yy & 3) * 4 + (xx & 3)] / 16 < t) ov.fillRect(xx, yy, 1, 1);
}

// ---------------------------------------------------------------- captions
function captionAt(f: number): [string, string] | "code" {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["HOW FAST CAN", "A HEART BEAT?"];
  if (bar < 4) return ["BIGGER BODY", "SLOWER HEART"];
  if (bar < 6) return ["EVERY BEEP IS", "ONE HEARTBEAT"];
  if (bar < 8) return ["CAT: 170 A MINUTE", "THIS SONG: 180"];
  if (bar < 10) return ["SMALLER BODY", "FASTER HEART"];
  if (bar < 12) return ["ALMOST", "EVERY 16TH NOTE"];
  if (bar < 16) return ["19.5 BEATS A SECOND", "TOO FAST TO COUNT"];
  if (bar < 20) return ["SO IT'S A NOTE", "x16 = 312 Hz = D#"];
  return "code";
}

// ---------------------------------------------------------------- ECG
const ECG = { x: M, y: 398, w: W - 2 * M, h: 68, seconds: 4 };
/** One heartbeat's trace (P, QRS, T) at time dt after the beat, scaled to fit the beat interval. */
function pqrst(dt: number, period: number): number {
  const s = Math.min(1, (period * 0.85) / 0.45); // the complex takes 0.45 s, squeezed when the heart is faster
  const u = dt / s;
  const g = (c: number, w: number, a: number) => a * Math.exp(-(((u - c) / w) ** 2));
  return g(0.02, 0.025, 0.12) + g(0.1, 0.008, -0.15) + g(0.12, 0.01, 1.0) + g(0.14, 0.01, -0.3) + g(0.32, 0.045, 0.25);
}
const BEAT_SEC = T.beats.map((b) => (b.animal === "shrew" ? b.sec : b.frame / FPS)); // what you hear is what you see
const PERIOD: Record<string, number> = Object.fromEntries(T.animals.map((a) => [a.id, 60 / a.bpm]));
function ecgValue(t: number): number {
  const LOOP = DURATION / FPS;
  let v = 0;
  for (const tt of [t, t + LOOP]) {
    // heartbeats in the 0.6 s before tt
    let lo = 0, hi = BEAT_SEC.length - 1, i = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (BEAT_SEC[mid] <= tt) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    for (let j = i; j >= 0 && tt - BEAT_SEC[j] < 0.6; j--) v += pqrst(tt - BEAT_SEC[j], PERIOD[T.beats[j].animal]);
  }
  return v;
}

// ---------------------------------------------------------------- the frame
function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const bar = Math.floor(f / BAR);
  const drop = f >= DROP_F && f < OUTRO_F, outro = f >= OUTRO_F;
  const a = animalAt(f);
  const kick = since(KICK_FRAMES, f);
  const hb = since(BEAT_FRAMES, f);
  const beatAnimal = T.beats[hb.i].animal;

  // background: flashes a shade lighter on every kick in the drop
  rect(0, 0, W, H, drop && kick.age < 2 ? C["262b44"] : C["181425"]);
  // drop: speed streaks rushing past, one set per 16th
  if (drop || bar >= 10) {
    const n = drop ? 26 : 10;
    for (let i = 0; i < n; i++) {
      const y = 166 + Math.floor(hash(i * 7.3) * 230);
      const speed = 6 + hash(i) * 10;
      const x = ((hash(i * 3.1) * W + f * speed) % (W + 60)) - 30;
      rect(x, y, 12 + hash(i * 1.7) * 30, 1, drop ? C["3a4466"] : C["262b44"]);
    }
  }

  // ---------- stage: the animal and its heart (or the plot, in the outro)
  panel(M - 10, 166, W - 2 * M + 20, 230, outro ? C["5a6988"] : C["3a4466"], "rgba(0,0,0,0)");
  if (!outro && a) {
    const sprite = ANIMAL_SPRITES[a.id];
    const sinceSwap = f - a.fromBar * BAR;
    const drop0 = sinceSwap < 3 ? (3 - sinceSwap) * 6 : 0; // the new animal drops in
    drawSprite(ov, sprite, W / 2, 268 - drop0);
    // a dark plate under the labels, so the streaks pass behind them
    const lw = Math.max(measure(a.name, "s16"), measure(a.mass, "p16")) + 8;
    rect(W / 2 - lw / 2, 272, lw, 38, C["181425"]);
    text(a.name, W / 2, 274, "s16", C["c0cbdc"], "c");
    text(a.mass, W / 2, 292, "p16", C["8b9bb4"], "c");

    // the heart: grows on every beat (integer pixel size), a ring flies out, glitches on drop kicks
    const age = hb.age;
    const isBeat = beatAnimal === a.id && age < 6;
    const px = beatAnimal === "shrew" ? (f % 2 === 0 ? 6 : 7) : isBeat && age < 3 ? 7 : 6;
    const hy = 386;
    if (drop && kick.age < 3) {
      drawSprite(ov, HEART, W / 2 - 3, hy, px, C["2ce8f5"]);
      drawSprite(ov, HEART, W / 2 + 3, hy, px, C["ff0044"]);
    }
    if (isBeat && beatAnimal !== "shrew") {
      const r = 6 + age * 2; // ring: the heart outline, one size bigger every frame
      const ring = drawSprite(ov, HEART, W / 2, hy + r, px + Math.floor(age / 2) + 1, C["e43b44"]);
      ditherFill(ov, ring.x0, ring.y0, ring.w, ring.h, C["181425"], 1 - 0.5 * (age / 6));
    }
    drawSprite(ov, HEART, W / 2, hy, px);
    if (drop) { // sparks fly off the heart, one burst per 16th
      const s16 = Math.floor(f / (FPB / 4));
      for (let i = 0; i < 10; i++) {
        const ang = hash(s16 * 13 + i) * Math.PI * 2, t = (f - s16 * (FPB / 4)) + 2;
        const d = 34 + t * (6 + hash(i + s16) * 6);
        rect(W / 2 + Math.cos(ang) * d, hy - 30 + Math.sin(ang) * d * 0.8, 2, 2, i % 2 ? C["fee761"] : C["ff0044"]);
      }
    }
  } else if (outro) {
    // the payoff: all seven on one straight line, log-log. One dot per beat.
    const PX = { x0: M + 14, x1: W - M - 14, y0: 366, y1: 190 };
    const lx = (kg: number) => PX.x0 + ((Math.log10(kg) + 3) / 8.2) * (PX.x1 - PX.x0); // 1 g .. ~160 t
    const ly = (bpm: number) => PX.y0 + ((Math.log10(bpm) - 0.8) / 2.4) * (PX.y1 - PX.y0); // 6.3 .. 1,585 per minute
    rect(PX.x0, PX.y1, 1, PX.y0 - PX.y1, C["5a6988"]);
    rect(PX.x0, PX.y0, PX.x1 - PX.x0, 1, C["5a6988"]);
    text("BEATS/MIN", PX.x1, PX.y1 - 4, "s16", C["8b9bb4"], "r");
    text("MASS", PX.x1, PX.y0 + 3, "s16", C["8b9bb4"], "r");
    for (let x = PX.x0; x <= PX.x1; x += 2) {
      const kg = 10 ** (((x - PX.x0) / (PX.x1 - PX.x0)) * 8.2 - 3);
      rect(x, ly(241 * kg ** -0.25), 1, 1, C["ff0044"]);
    }
    const shown = Math.floor((f - OUTRO_F) / FPB) + 1;
    T.animals.slice(0, shown).forEach((an, i) => {
      const x = lx(an.kg), y = ly(an.bpm), fresh = f - OUTRO_F - i * FPB < 3;
      rect(x - 3, y - 3, 7, 7, fresh ? C["ffffff"] : C["fee761"]);
      rect(x - 2, y - 2, 5, 5, fresh ? C["fee761"] : C["e43b44"]);
      // labels sit where the line is not: above-right (it falls to the right), below-left for the whale
      if (an.id === "shrew" || an.id === "human") text(an.id === "human" ? "YOU" : "SHREW", x + 8, y - 20, "s16", C["c0cbdc"]);
      if (an.id === "whale") text("WHALE", x - 8, y + 4, "s16", C["c0cbdc"], "r");
    });
  }

  // ---------- ECG monitor
  panel(ECG.x, ECG.y, ECG.w, ECG.h, C["3e8948"], C["181425"]);
  for (let gx = ECG.x + 15; gx < ECG.x + ECG.w; gx += 15) for (let gy = ECG.y + 4; gy < ECG.y + ECG.h - 2; gy += 4) rect(gx, gy, 1, 1, C["265c42"]);
  const now = f / FPS, base = ECG.y + ECG.h - 18, amp = 42;
  let prev = 0;
  for (let x = 0; x < ECG.w - 2; x++) {
    const t = now - ((ECG.w - 3 - x) / (ECG.w - 3)) * ECG.seconds;
    const y = Math.round(base - Math.max(-0.4, Math.min(1.2, ecgValue(t))) * amp);
    const y0 = x === 0 ? y : prev;
    const top = Math.min(y, y0), hgt = Math.abs(y - y0) + 1;
    const head = x > ECG.w - 12;
    rect(ECG.x + 1 + x, top, 1, hgt, head ? C["ffffff"] : C["63c74d"]);
    prev = y;
  }
  if (!cover) text(drop ? "19.5 Hz" : `SNAPPED TO 16THS, <${Math.ceil(T.maxSnapMs)}MS`, ECG.x + 6, ECG.y + 4, drop ? "p16" : "s16", C["3e8948"]);

  // ---------- mass scale: 1 g .. 100 t, log
  const sy = 474;
  rect(M, sy, W - 2 * M, 1, C["3a4466"]);
  for (let d = 0; d <= 8; d++) rect(M + (d / 8) * (W - 2 * M), sy - 2, 1, 5, C["3a4466"]);
  text("1 g", M, sy + 5, "p16", C["5a6988"]);
  text("100 t", W - M, sy + 5, "p16", C["5a6988"], "r");
  if (a && !outro) {
    const prevA = T.animals[Math.max(0, T.animals.indexOf(a) - 1)];
    const s = Math.min(1, (f - a.fromBar * BAR) / 8);
    const lg = (kg: number) => (Math.log10(kg) + 3) / 8;
    const p = a.id === "whale" ? lg(a.kg) : lg(prevA.kg) + (lg(a.kg) - lg(prevA.kg)) * (1 - (1 - s) ** 3);
    const mx = M + p * (W - 2 * M);
    rect(mx - 2, sy - 6, 5, 4, C["fee761"]);
    rect(mx - 1, sy - 2, 3, 2, C["fee761"]);
  }

  // ---------- HUD
  if (cover) {
    // key text inside the centre 3:4 crop (y 80-560)
    panel(M, 82, W - 2 * M, 66, C["c0cbdc"]);
    text("HOW FAST CAN A", W / 2, 92, "p16", C["c0cbdc"], "c");
    text("HEART BEAT?", W / 2, 116, "p24", C["fee761"], "c", C["be4a2f"]);
  } else {
    panel(M, 34, W - 2 * M, 70, drop && kick.age < 2 ? C["ff0044"] : C["c0cbdc"]);
    text("HEART RATE", W / 2, 44, "p16", C["c0cbdc"], "c");
    let num = "?";
    if (a && !outro) {
      const s = Math.min(1, (f - a.fromBar * BAR) / 6);
      const prevA = T.animals[Math.max(0, T.animals.indexOf(a) - 1)];
      const v = a.id === "whale" ? a.bpm : prevA.bpm + (a.bpm - prevA.bpm) * s; // the counter rolls to the new value
      num = fmt(v);
    } else if (outro) num = "241";
    const wNum = measure(num, "p32"), unit = outro ? " x M^-1/4" : " /min", wU = measure(unit, "p16");
    const numColor = drop && kick.age < 2 ? C["ffffff"] : C["fee761"];
    text(num, W / 2 - (wNum + wU) / 2, 66, "p32", numColor, "l", C["be4a2f"]);
    text(unit, W / 2 - (wNum + wU) / 2 + wNum, 80, "p16", C["8b9bb4"]);

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 110, W - 2 * M, 50, C["5a6988"]);
      rect(M, 110, 3, 50, C["63c74d"]);
      text("bpm = 241*M^-0.25", M + 12, 118, "p16", C["ffffff"]);
      text("M IN KG. STAHL, 1967", M + 12, 138, "s16", C["63c74d"]);
    } else {
      const l2font = cap[1].includes("Hz") ? "p16" : "s16";
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], l2font)) + 28;
      panel(W / 2 - w / 2, 110, w, 50, C["c0cbdc"]);
      text(cap[0], W / 2, 118, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, l2font === "p16" ? 138 : 138, l2font, C["fee761"], "c");
    }
  }
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");

  // ---------- flashes
  if (!cover) {
    const sinceDrop = f - DROP_F;
    if (sinceDrop >= 0 && sinceDrop < 6) ditherFill(ov, 0, 0, W, H, C["ffffff"], 0.9 * (1 - sinceDrop / 6));
    if (a && f - a.fromBar * BAR < 3 && a.id !== "shrew") { // a red border flashes as each new animal arrives
      const t = 1 - (f - a.fromBar * BAR) / 3;
      ditherFill(ov, 0, 0, W, 4, C["ff0044"], t); ditherFill(ov, 0, H - 4, W, 4, C["ff0044"], t);
      ditherFill(ov, 0, 0, 4, H, C["ff0044"], t); ditherFill(ov, W - 4, 0, 4, H, C["ff0044"], t);
    }
  }

  // quantise the overlay to the palette, then shake the whole frame by whole pixels
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  const [dx, dy] = cover ? [0, 0] : shake(f);
  ctx.fillStyle = C["181425"];
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ov.canvas, dx, dy);
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
    else drawLooped(ctx, ov, f, DURATION, 8, (c, o, ff) => drawFrame(c, o, ff));
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

/** Reel cover (9:16): the shrew's heart mid-drop under the question. The profile grid shows its centre 3:4 crop. */
export const HeartRateCover = () => (
  <Still id="HeartRateCover" component={HeartRateVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: DROP_F + 2 * BAR + 3 }} />
);
