import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import timeline from "../../../public/galton-board/timeline.json";

// A flat pixel-art board, drawn straight at 360x640 and shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, BAR = 48, DURATION = 22 * BAR; // 22 bars at 150 BPM

type Ball = { id: number; releaseFrame: number; path: number; bin: number; stackSlot: number; enterFrame: number };
type TL = { rows: number; bins: number; framesPerHop: number; drainFrame: number; counts: number[]; expected: number[]; balls: Ball[] };
const T = timeline as unknown as TL;

// ---- board geometry (base pixels) ----
const CX = 180, D = 22; // peg spacing
const FUNNEL_Y = 168, Y0 = 194, ROW_H = 14; // peg rows at Y0 + r * ROW_H
const MOUTH_Y = Y0 + T.rows * ROW_H; // 362: top of the bins
const FLOOR_Y = 524; // bottom of the bins
const PER_ROW = 7; // balls per row in a bin stack (3 px each)
const G = 0.55; // gravity inside the bins and when they drain, px / frame^2
const binX = (k: number) => CX + (k - T.bins / 2 + 0.5) * D; // centre of bin k
const pegX = (r: number, j: number) => CX + (j - r / 2) * D;

// bin colours: cool at the edges, hot in the middle
const BIN_COLORS = ["124e89", "0099db", "2ce8f5", "63c74d", "fee761", "feae34", "f77622", "feae34", "fee761", "63c74d", "2ce8f5", "0099db", "124e89"]
  .map((h) => C[h as keyof typeof C]);

/** Where a ball is at frame f, or null if not on screen. Hops are gravity parabolas, one 16th each. */
function ballAt(b: Ball, f: number): { x: number; y: number; landed: boolean } | null {
  const hop = T.framesPerHop;
  const t = f - b.releaseFrame;
  if (t < 0) return null;
  const stackY = FLOOR_Y - 2 - 3 * (Math.floor(b.stackSlot / PER_ROW) + 1);
  const stackX = binX(b.bin) - 10 + 3 * (b.stackSlot % PER_ROW);
  if (f >= T.drainFrame) {
    const y = stackY + 0.5 * G * (f - T.drainFrame) ** 2;
    return y < H + 4 ? { x: stackX, y, landed: true } : null;
  }
  if (t < hop) return { x: CX - 1, y: FUNNEL_Y + ((Y0 - 4 - FUNNEL_Y) * t) / hop, landed: false }; // through the funnel
  const k = Math.floor((t - hop) / hop); // hops completed
  if (k < T.rows) {
    let pos = 0;
    for (let r = 0; r < k; r++) pos += (b.path >> r) & 1;
    const right = (b.path >> k) & 1;
    const x0 = pegX(k, pos), x1 = k + 1 < T.rows ? pegX(k + 1, pos + right) : binX(pos + right);
    const y0 = Y0 + k * ROW_H - 4, y1 = Y0 + (k + 1) * ROW_H - 4;
    const s = (t - hop - k * hop) / hop; // 0..1 through this hop
    const g = 2.2; // px / frame^2 for the hop arc: the ball bounces up off the peg, then falls
    const tt = s * hop, v0 = (y1 - y0 - 0.5 * g * hop * hop) / hop;
    return { x: x0 + (x1 - x0) * s - 1, y: y0 + v0 * tt + 0.5 * g * tt * tt, landed: false };
  }
  // inside the bin: fall from the mouth onto the stack
  const tb = f - b.enterFrame;
  const y = MOUTH_Y - 4 + 2 * tb + 0.5 * G * tb * tb;
  if (y >= stackY) return { x: stackX, y: stackY, landed: true };
  return { x: binX(b.bin) - 1, y, landed: false };
}

function captionAt(f: number): [string, string] | "code" {
  const bar = Math.floor(f / BAR);
  if (bar < 2 || bar >= 21) return ["1,000 BALLS", "LEFT OR RIGHT, 50/50"];
  if (bar < 6) return ["EVERY PEG", "IS A COIN FLIP"];
  if (bar < 10) return ["EVERY BIN", "PLAYS ITS OWN NOTE"];
  if (bar < 12) return ["MORE BALLS", "FASTER"];
  if (bar < 15) return ["PURE CHANCE", "OR IS IT?"];
  if (bar < 18) return ["THE MIDDLE FILLS UP", "THE EDGES STAY EMPTY"];
  if (bar < 20) return [`MIDDLE BIN: ${T.counts[6]}`, `THEORY SAYS ${Math.round(T.expected[6])}`];
  return "code";
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const M = 28;
  rect(0, 0, W, H, C["181425"]);

  // ---------- board ----------
  // backplate: the house thin-bordered panel
  panel(18, FUNNEL_Y - 20, W - 36, FLOOR_Y - FUNNEL_Y + 30, C["3a4466"], C["262b44"]);
  // funnel
  for (let i = 0; i < 14; i++) {
    rect(CX - 26 + i * 1.5, FUNNEL_Y - 14 + i, 2, 1, C["5a6988"]);
    rect(CX + 24 - i * 1.5, FUNNEL_Y - 14 + i, 2, 1, C["5a6988"]);
  }
  // pegs
  for (let r = 0; r < T.rows; r++) for (let j = 0; j <= r; j++) {
    rect(pegX(r, j) - 1, Y0 + r * ROW_H - 1, 3, 3, C["c0cbdc"]);
    rect(pegX(r, j) - 1, Y0 + r * ROW_H + 1, 3, 1, C["5a6988"]);
  }
  // bins: walls, floor (opens when it drains), mouth flash when a ball enters
  const draining = f >= T.drainFrame;
  for (let k = 0; k <= T.bins; k++) rect(binX(k) - D / 2 - 1, MOUTH_Y, 2, FLOOR_Y - MOUTH_Y, C["5a6988"]);
  if (!draining) rect(binX(0) - D / 2 - 1, FLOOR_Y, D * T.bins + 2, 2, C["8b9bb4"]);
  const enteredRecently = new Array(T.bins).fill(99);
  for (const b of T.balls) if (b.enterFrame <= f && f - b.enterFrame < enteredRecently[b.bin]) enteredRecently[b.bin] = f - b.enterFrame;
  for (let k = 0; k < T.bins; k++) {
    const s = enteredRecently[k];
    if (s < 4 && !draining) rect(binX(k) - D / 2 + 1, MOUTH_Y - 2, D - 2, 2, s < 2 ? C["ffffff"] : BIN_COLORS[k]);
  }

  // balls
  for (const b of T.balls) {
    const p = ballAt(b, f);
    if (!p) continue;
    if (p.landed) {
      rect(p.x, p.y, 3, 3, BIN_COLORS[b.bin]);
      rect(p.x, p.y, 1, 1, C["ffffff"]);
    } else {
      rect(p.x - 0.5, p.y - 0.5, 4, 4, C["fee761"]);
      rect(p.x - 0.5, p.y - 0.5, 2, 2, C["ffffff"]);
    }
  }

  // the reveal: theory curve (C(12,k) / 2^12 of 1,000) as dots over the stacks, and the middle bin's count
  const bar = Math.floor(f / BAR);
  if (!cover && bar >= 18 && bar < 21) {
    for (let k = 0; k < T.bins; k++) {
      const h = 3 * Math.ceil(T.expected[k] / PER_ROW);
      for (let x = -9; x <= 9; x += 3) rect(binX(k) + x, FLOOR_Y - 2 - h - 2, 2, 1, C["ff0044"]);
    }
    const top = FLOOR_Y - 2 - 3 * Math.ceil(T.counts[6] / PER_ROW);
    text(String(T.counts[6]), binX(6), top - 34, "p16", C["ffffff"], "c", C["181425"]);
    text("THEORY", W - M, MOUTH_Y + 8, "s16", C["ff0044"], "r");
  }

  // ---------- HUD ----------
  if (cover) {
    panel(M, 96, W - 2 * M, 78, C["c0cbdc"]);
    text("1,000 BALLS", W / 2, 108, "p16", C["c0cbdc"], "c");
    text("MIDDLE BIN?", W / 2, 132, "p24", C["fee761"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 540, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("GALTON BOARD", W / 2, 44, "p16", C["c0cbdc"], "c");
    const dropped = T.balls.filter((b) => b.releaseFrame <= f).length;
    const num = String(dropped);
    const wNum = measure(num, "p32"), wOf = measure(" /1000", "s16");
    text(num, W / 2 - (wNum + wOf) / 2, 66, "p32", C["fee761"], "l", C["be4a2f"]);
    text(" /1000", W / 2 - (wNum + wOf) / 2 + wNum, 80, "s16", C["8b9bb4"]);

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 110, W - 2 * M, 50, C["5a6988"]);
      rect(M, 110, 3, 50, C["63c74d"]);
      text("P(k)=C(12,k)/2^12", M + 12, 118, "p16", C["ffffff"]);
      text("MIDDLE: 924/4096 = 22.6%", M + 12, 138, "s16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 110, w, 50, C["c0cbdc"]);
      text(cap[0], W / 2, 118, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 138, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  }

  ctx.clearRect(0, 0, W, H);
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const GaltonBoardVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("galton-board/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const GaltonBoard = () => (
  <Composition id="GaltonBoard" component={GaltonBoardVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the board mid-fill, before the answer. The profile grid shows its centre 3:4 crop. */
export const GaltonBoardCover = () => (
  <Still id="GaltonBoardCover" component={GaltonBoardVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 16 * BAR }} />
);
