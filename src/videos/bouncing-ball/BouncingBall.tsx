import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import { Audio } from "@remotion/media";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import timeline from "../../../public/bouncing-ball/timeline.json";

// A flat pixel-art side view, drawn straight at 360x640 and shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, BAR = 60, DURATION = 12 * BAR; // 12 bars at 120 BPM

type TL = {
  h0: number; release: number; firstImpact: number; end: number;
  impacts: { k: number; sec: number }[];
  frames: { h: number; claw: number; closed: boolean; bounces: number }[];
};
const T = timeline as unknown as TL;
const FLOOR = 430, TOP = 170; // the view: floor line and the highest point drawn
const BALL_R = 0.11; // metres (drawn at least 7 px)

/** How many metres the view shows above the floor: zooms in as the bounces shrink, out again for the claw. */
function viewMetres(t: number): number {
  const keys: [number, number][] = [[0, 23], [6, 23], [7, 6.5], [8.5, 1.9], [9.4, 1.5], [18, 1.5], [19.4, 23], [24, 23]];
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
  const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
  const a = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const s = a * a * (3 - 2 * a);
  return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * s); // smooth in log space
}

const INF = ["0110001100", "1001010010", "1000100010", "1001010010", "0110001100"];

function captionAt(bar: number): [string, string] | "code" {
  if (bar < 2 || bar >= 10) return ["DROP A BALL", "HOW MANY BOUNCES?"];
  if (bar < 3) return ["20 METRES UP", "LET GO"];
  if (bar < 5) return ["EACH BOUNCE TAKES", "HALF THE TIME"];
  if (bar < 7) return ["INFINITE BOUNCES", "ALL IN 4 SECONDS"];
  if (bar < 9) return "code";
  return ["A REAL BALL STOPS", "THIS ONE IS IDEAL"];
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const M = 28;
  const t = f / FPS;
  const st = T.frames[f];
  const view = viewMetres(t);
  const ppm = (FLOOR - TOP) / view; // pixels per metre
  const yOf = (m: number) => FLOOR - m * ppm;
  rect(0, 0, W, H, C["181425"]);

  // ---------- scene ----------
  // ruler: ticks at a step that suits the zoom
  const step = [0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => s * ppm >= 26) ?? 10;
  for (let m = 0; m <= view + 1e-9; m += step) {
    const y = Math.round(yOf(m));
    if (y < TOP - 4) break;
    const label = step < 1 ? `${m.toFixed(1)} M` : `${Math.round(m)} M`;
    if (m > 0) text(label, M + 42, y - 7, "s16", C["5a6988"], "r");
    rect(M + 46, y, 6, 1, C["5a6988"]);
  }
  // floor
  rect(0, FLOOR, W, H - FLOOR, C["262b44"]);
  for (let x = 0; x < W; x += 16) rect(x, FLOOR, 8, 2, C["3a4466"]);
  rect(0, FLOOR, W, 1, C["8b9bb4"]);

  // impact flash and dust
  let since = 99;
  for (const i of T.impacts) if (i.sec * FPS <= f + 1e-6) since = Math.min(since, f - i.sec * FPS);
  const cx = 262;
  const r = Math.max(7, BALL_R * ppm);
  if (since < 5 && t < T.end + 0.2) {
    const spread = 6 + since * 5;
    for (let k = 0; k < 6; k++) {
      rect(cx - r - spread + k * 2, FLOOR - 2 - (k % 3), 2, 2, C["c0cbdc"]);
      rect(cx + r + spread - k * 2, FLOOR - 2 - (k % 3), 2, 2, C["c0cbdc"]);
    }
    rect(cx - r - 4, FLOOR, 2 * r + 8, 2, C["fee761"]);
  }

  // trail: the ball's height over the last few seconds, streaming left, so the halving arcs show as a graph
  for (let back = 1; back < 150; back++) {
    const fp = f - back;
    if (fp < 0) break;
    const hp = T.frames[fp].h;
    const x = cx - back * 1.6, y = yOf(hp) - r;
    if (x < M + 50 || y < TOP - 6) continue;
    rect(x, y, 2, 2, back < 50 ? C["fee761"] : back < 100 ? C["feae34"] : C["be4a2f"]);
  }

  // shadow
  const shadowW = Math.max(4, 2 * r * (1 - Math.min(0.8, (st.h * ppm) / 300)));
  rect(cx - shadowW / 2, FLOOR + 3, shadowW, 3, C["181425"]);

  // ball (a little squash on impact)
  const squash = since < 2 && t < T.end ? 0.75 : 1;
  const by = yOf(st.h) - r * squash;
  const ry = r * squash, rx = r * (2 - squash);
  for (let yy = -ry; yy <= ry; yy++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2));
    const shade = yy < -ry * 0.3 ? C["f77622"] : yy > ry * 0.45 ? C["be4a2f"] : C["e43b44"];
    rect(cx - half, by + yy, 2 * half, 1, shade);
  }
  rect(cx - rx * 0.45, by - ry * 0.55, Math.max(2, rx * 0.35), Math.max(2, ry * 0.25), C["ffffff"]);

  // claw: a cable from the top of the view and two prongs
  const clawY = yOf(st.claw) - 2 * r - 6;
  if (clawY > TOP - 30) {
    rect(cx - 1, 0, 3, Math.max(0, clawY), C["8b9bb4"]);
    rect(cx - 10, clawY, 21, 5, C["c0cbdc"]);
    const open = st.closed ? 0 : 6;
    rect(cx - 10 - open, clawY + 5, 3, r + 8, C["c0cbdc"]);
    rect(cx + 8 + open, clawY + 5, 3, r + 8, C["c0cbdc"]);
  }

  // ---------- HUD ----------
  if (cover) {
    panel(M, 96, W - 2 * M, 78, C["c0cbdc"]);
    text("DROP A BALL", W / 2, 108, "p16", C["c0cbdc"], "c");
    text("HOW MANY", W / 2, 132, "p24", C["fee761"], "c", C["be4a2f"]);
    panel(M + 16, 450, W - 2 * M - 32, 56, C["c0cbdc"]);
    text("BOUNCES?", W / 2, 466, "p24", C["ffffff"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 524, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("HOW MANY", W / 2, 44, "p16", C["c0cbdc"], "c");
    text("BOUNCES?", W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);

    panel(M, 110, W - 2 * M, 44);
    text("BOUNCES", M + 10, 124, "s16", C["8b9bb4"]);
    if (st.bounces < 0) {
      INF.forEach((row, j) => row.split("").forEach((b, i) => { if (b === "1") rect(M + 96 + i * 4, 121 + j * 4, 4, 4, C["fee761"]); }));
    } else {
      text(String(st.bounces), M + 96, 120, "p24", C["fee761"], "l", C["be4a2f"]);
    }
    text("HEIGHT", W - M - 10, 114, "s16", C["8b9bb4"], "r");
    text(`${st.h.toFixed(2)} M`, W - M - 10, 132, "s16", C["c0cbdc"], "r");

    const cap = captionAt(Math.floor(f / BAR));
    if (cap === "code") {
      panel(M, 450, W - 2 * M, 52, C["5a6988"]);
      rect(M, 450, 3, 52, C["63c74d"]);
      text("2+1+1/2+1/4+...=4s", M + 12, 458, "p16", C["ffffff"]);
      text("EACH BOUNCE: HALF THE SPEED", M + 12, 480, "s16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  }

  ctx.clearRect(0, 0, W, H);
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const BouncingBallVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
    else drawLooped(ctx, ov, f, DURATION, 6, (c, o, ff) => drawFrame(c, o, ff));
  }, [f, ready, coverFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: C["181425"] }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: W * SCALE, height: H * SCALE, imageRendering: "pixelated" }} />
      {coverFrame === undefined ? <Audio src={staticFile("bouncing-ball/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const BouncingBall = () => (
  <Composition id="BouncingBall" component={BouncingBallVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): mid-bounce, before the answer. The profile grid shows its centre 3:4 crop. */
export const BouncingBallCover = () => (
  <Still id="BouncingBallCover" component={BouncingBallVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 3 * BAR + 30 }} />
);
