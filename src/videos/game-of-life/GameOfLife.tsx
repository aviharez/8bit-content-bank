import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import timeline from "../../../public/game-of-life/timeline.json";

// A flat pixel-art board, drawn straight at 360x640 and shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, BEAT = 15, BAR = 60, DURATION = 16 * BAR; // 64 generations, one per beat, at 120 BPM
const S16 = BEAT / 4; // 3.75 frames per 16th: the playhead moves one column per 16th

type TL = { size: number; gens: string[] };
const T = timeline as unknown as TL;
const N = T.size;
const CELL = 17, GX = (W - N * CELL) / 2, GY = 168;
const alive = (gen: number, x: number, y: number) => T.gens[((gen % 64) + 64) % 64][(((y % N) + N) % N) * N + (((x % N) + N) % N)] === "1";
/** The glider keeps to the diagonals x - y = -2..1 (mod 16); the oscillators sit 7 diagonals away. */
const isGlider = (x: number, y: number) => [14, 15, 0, 1, 2].includes((((x - y) % N) + N) % N);

function captionAt(bar: number): [string, string] | "code" {
  if (bar < 2) return ["GAME OF LIFE", "AS A SEQUENCER"];
  if (bar < 4) return ["3 NEIGHBOURS", "A CELL IS BORN"];
  if (bar < 6) return ["2 OR 3 NEIGHBOURS", "IT SURVIVES"];
  if (bar < 8) return ["ANY OTHER NUMBER", "IT DIES"];
  if (bar < 10) return ["THE GLIDER", "SINGS THE MELODY"];
  if (bar < 12) return ["THE BLINKERS", "PLAY THE RIFF"];
  if (bar < 14) return "code";
  return ["GEN 64 = GEN 0", "IT LOOPS FOREVER"];
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const M = 28;
  rect(0, 0, W, H, C["181425"]);
  const gen = Math.floor(f / BEAT);
  const col = Math.floor(f / S16) % N;
  const sinceCol = f - Math.floor(f / S16) * S16; // frames since the playhead reached this column

  // ---------- board ----------
  panel(GX - 6, GY - 6, N * CELL + 12, N * CELL + 12, C["3a4466"], C["262b44"]);
  if (!cover) rect(GX + col * CELL, GY - 2, CELL, N * CELL + 4, C["3a4466"]); // playhead column
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = GX + x * CELL, py = GY + y * CELL;
    if (!alive(gen, x, y)) {
      rect(px + 7, py + 7, 2, 2, C["3a4466"]);
      continue;
    }
    const born = !alive(gen - 1, x, y) && f % BEAT < 4 && gen > 0;
    const playing = !cover && x === col && sinceCol < 3;
    const base = isGlider(x, y) ? C["fee761"] : C["2ce8f5"];
    const shade = isGlider(x, y) ? C["feae34"] : C["0099db"];
    rect(px + 1, py + 1, CELL - 2, CELL - 2, playing ? C["ffffff"] : born ? C["ead4aa"] : base);
    rect(px + 1, py + CELL - 4, CELL - 2, 3, playing ? C["c0cbdc"] : shade);
    rect(px + 2, py + 2, 4, 2, C["ffffff"]);
  }
  if (!cover) {
    // playhead marker above the board
    const mx = GX + col * CELL + CELL / 2;
    rect(mx - 3, GY - 14, 7, 2, C["ff0044"]);
    rect(mx - 2, GY - 12, 5, 2, C["ff0044"]);
    rect(mx - 1, GY - 10, 3, 2, C["ff0044"]);
  }

  // ---------- HUD ----------
  if (cover) {
    panel(M, 34, W - 2 * M, 112, C["c0cbdc"]);
    text("GAME OF LIFE", W / 2, 46, "p16", C["c0cbdc"], "c");
    text("WHEN DOES", W / 2, 72, "p24", C["fee761"], "c", C["be4a2f"]);
    text("IT REPEAT?", W / 2, 104, "p24", C["fee761"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 470, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("GAME OF LIFE", W / 2, 44, "p16", C["c0cbdc"], "c");
    const g = `GEN ${gen}`;
    text(g, W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);
    const pop = T.gens[gen].split("").filter((c) => c === "1").length;
    text(`${pop} ALIVE`, W - M - 10, 112, "s16", C["8b9bb4"], "r");

    // label the glider while the caption is about it
    const bar = Math.floor(f / BAR);
    if (bar >= 8 && bar < 10) {
      let minY = 99, sumX = 0, k = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (alive(gen, x, y) && isGlider(x, y)) { minY = Math.min(minY, y); sumX += x; k++; }
      if (k && minY > 0) text("GLIDER", GX + (sumX / k) * CELL + CELL / 2, GY + minY * CELL - 18, "s16", C["fee761"], "c", C["181425"]);
    }

    const cap = captionAt(bar);
    if (cap === "code") {
      panel(M, 450, W - 2 * M, 52, C["5a6988"]);
      rect(M, 450, 3, 52, C["63c74d"]);
      text("RULE B3/S23", M + 12, 458, "p16", C["ffffff"]);
      text("16x16 BOARD, EDGES WRAP", M + 12, 480, "s16", C["63c74d"]);
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

export const GameOfLifeVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("game-of-life/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const GameOfLife = () => (
  <Composition id="GameOfLife" component={GameOfLifeVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16). The profile grid shows its centre 3:4 crop. */
export const GameOfLifeCover = () => (
  <Still id="GameOfLifeCover" component={GameOfLifeVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 20 * BEAT }} />
);
