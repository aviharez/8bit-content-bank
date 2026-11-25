import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, DOOR, HOST_SPOT, MARK, ShowScene, stageOrigin } from "./scene";
import timeline from "../../../public/monty-hall/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type Game = { n: number; stage: number; stay: boolean; car: number; pick: number; open: number; final: number; win: boolean; steps: number[] };
type TL = {
  fps: number; framesPerBeat: number; totalFrames: number; cols: number; rows: number; main: number;
  appear: number[]; vanish: (number | null)[]; games: Game[]; lights: number[]; hook: { beat: number; deg: number }[];
  flashes: { beat: number; stay: boolean; stages: number[] }[]; closes: number[];
  frames: { games: number; stay: number | null; switch: number | null }[];
};
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames;
const STAGES = T.cols * T.rows;
const ease = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const fr = (beat: number) => Math.round(beat * FPB);
const VANISH = T.vanish.map((v) => (v === null ? Infinity : v)); // JSON writes Infinity as null
const BLUE = C["0099db"], ORANGE = C["f77622"], GOLD = C["fee761"], DIM = C["3a4466"];

// every stage's games in order
const BY_STAGE: Game[][] = Array.from({ length: STAGES }, () => []);
for (const g of T.games) BY_STAGE[g.stage].push(g);

// ---------------------------------------------------------------- camera: close on the middle stage; pulled back to the wall for the drops
const NEAR = { pos: new THREE.Vector3(0, 5.0, 9.4), look: new THREE.Vector3(0, 1.25, 0) };
const FAR = { pos: new THREE.Vector3(0, 4.1, 43.9), look: new THREE.Vector3(0, 4.1, 0) };
function camAt(f: number) {
  const k = interpolate(f, [0, 10 * BAR, 12 * BAR, 20 * BAR, 21 * BAR, DURATION], [0, 0, 1, 1, 0, 0], { ...clamp, easing: ease });
  return { pos: NEAR.pos.clone().lerp(FAR.pos, k), look: NEAR.look.clone().lerp(FAR.look, k) };
}

let S: ShowScene | null = null;
const proj = new THREE.Vector3();
const toScreen = (p: THREE.Vector3) => {
  proj.copy(p).project(S!.camera);
  return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H };
};

/** 0 closed .. 1 open, swinging in a 16th from `from`, shutting in a 16th from `to`. */
function swing(b: number, from: number, to: number) {
  if (b < from || b >= to + 0.12) return 0;
  const o = Math.min(1, (b - from) / 0.12);
  return b >= to ? o * (1 - (b - to) / 0.12) : o;
}
const doorFront = (d: number) => new THREE.Vector3(DOOR.xs[d], 0, 1.7);

/** What a stage shows at beat b. */
function stageState(s: number, b: number) {
  const list = BY_STAGE[s];
  let i = -1;
  for (let k = 0; k < list.length; k++) if (list[k].steps[0] <= b) i = k;
  const g = i >= 0 ? list[i] : null;
  const next = list[i + 1];
  const end = next ? next.steps[0] : s === T.main ? Infinity : VANISH[s];
  return { g, prev: i > 0 ? list[i - 1] : null, end };
}

function render3D(f: number) {
  S ??= buildScene(W, H, T.cols, T.rows);
  const b = f / FPB;
  const lit = T.lights.some((x) => b >= x && b < x + 0.3);
  S.hemi.intensity = lit ? 1.75 : 1.4;
  // the marquee: the bulb of the latest hook note, for a 16th
  const h = [...T.hook].reverse().find((x) => x.beat <= b + 1e-6);
  const bulbOn = h && b - h.beat < 0.25 ? h.deg : -1;
  S.bulbs.forEach((m, k) => m.color.set(k === bulbOn ? GOLD : C["733e39"]));
  const explain = b >= 16 && b < 40; // bars 4-9: your door blue (1 in 3), the other two orange (2 in 3)

  for (let s = 0; s < STAGES; s++) {
    const st = S.stages[s];
    // appear (bars 10-11) and fold away (bar 20)
    let scale = 1;
    if (s !== T.main) {
      const a = T.appear[s], v = VANISH[s];
      scale = b < a ? 0 : b < a + 0.25 ? (b - a) / 0.25 : b < v ? 1 : b < v + 0.25 ? 1 - (b - v) / 0.25 : 0;
    }
    st.root.visible = scale > 0;
    if (!st.root.visible) continue;
    st.root.scale.setScalar(Math.max(0.01, scale));
    st.root.position.copy(stageOrigin(s, T.cols));
    st.strip.color.set(lit ? GOLD : DIM);

    const { g, prev, end } = stageState(s, b);
    let pos = MARK.clone(), hop = 0, slump = 1;
    const frames = [DIM, DIM, DIM];
    const open = [0, 0, 0];
    if (g) {
      const [s0, s1, s2, s3] = g.steps;
      // the turn: the middle stage's doors close one a beat (84, 85, 86)
      const shut = (d: number) => (s === T.main && end === Infinity ? T.closes[d] : end);
      open[g.open] = swing(b, s1, shut(g.open));
      open[g.final] = Math.max(open[g.final], swing(b, s3, shut(g.final)));
      // the prizes behind the doors
      st.doors.forEach((d, k) => { d.car.visible = k === g.car; d.goat.visible = k !== g.car; });
      // the contestant walks to the pick, hops to the other door on a switch
      const from = prev && prev.steps[3] < s0 ? doorFront(prev.final) : MARK;
      const at = doorFront(g.pick), to = doorFront(g.final);
      if (b < s0 + 0.2) pos = from.clone().lerp(at, (b - s0) / 0.2);
      else if (b < s2) pos = at;
      else if (b < s2 + 0.2) { const u = (b - s2) / 0.2; pos = at.clone().lerp(to, u); hop = g.stay ? 0 : Math.sin(Math.PI * u) * 0.35; }
      else pos = to;
      if (s === T.main && b >= 87) pos = to.clone().lerp(MARK, Math.min(1, (b - 87) / 0.75));
      if (b >= s3 && b < end) {
        if (g.win) hop = Math.max(hop, Math.abs(Math.sin(Math.PI * Math.min(1, (b - s3) / 0.5))) * 0.4);
        else slump = 0.85;
      }
      // the door frames
      const chosen = b < s2 ? g.pick : g.final;
      frames[chosen] = b < s2 ? BLUE : g.stay ? BLUE : ORANGE;
      if (explain && s === T.main && b < s2) {
        for (let d = 0; d < 3; d++) if (d !== g.pick && !(b >= s1 && d === g.open)) frames[d] = ORANGE;
      }
      if (b >= s3 && b < end) frames[g.final] = g.win ? (Math.floor((b - s3) * 8) % 2 ? GOLD : C["ffffff"]) : C["5a6988"];
      // host raises an arm as he opens his door
      st.hostArm.rotation.z = b >= s1 && b < s1 + 0.6 ? 2.3 : 0;
    } else {
      st.doors.forEach((d, k) => { d.car.visible = k === 1; d.goat.visible = k !== 1; });
      st.hostArm.rotation.z = 0;
    }
    if (s === T.main && b >= 84) for (let d = 0; d < 3; d++) if (b >= T.closes[d]) frames[d] = DIM;
    st.doors.forEach((d, k) => { d.pivot.rotation.y = -1.9 * open[k]; d.frame.color.set(frames[k]); });
    st.contestant.position.set(pos.x, hop, pos.z);
    st.contestant.scale.set(0.8, 0.8 * slump, 0.8);
    st.contestant.rotation.y = 0;
    st.host.position.copy(HOST_SPOT);
    // bar 19: the last round's winners of one side light up, stay then switch
    let panel = C["68386c"];
    for (const fl of T.flashes) if (b >= fl.beat && b < fl.beat + 0.75 && fl.stages.includes(s)) panel = fl.stay ? C["124e89"] : C["be4a2f"];
    st.panel.color.set(panel);
  }
  const { pos, look } = camAt(f);
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  S.camera.updateMatrixWorld();
  S.renderer.render(S.scene, S.camera);
}

// ---------------------------------------------------------------- confetti over a won door (single games only)
const hash = (x: number) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
const CONFETTI = [C["fee761"], C["e43b44"], C["2ce8f5"], C["63c74d"], C["f6757a"], C["ffffff"]];
function drawConfetti(g: CanvasRenderingContext2D, b: number) {
  for (const gm of BY_STAGE[T.main]) {
    if (!gm.win || gm.n > 20) continue;
    const a = b - gm.steps[3];
    const life = gm.n <= 8 ? 1 : gm.n <= 12 ? 0.5 : 0.25;
    if (a < 0 || a > life) continue;
    const top = toScreen(new THREE.Vector3(DOOR.xs[gm.final], DOOR.h, 0.3));
    for (let k = 0; k < 28; k++) {
      const u = a / life;
      const x = top.x + (hash(k + gm.n * 31) - 0.5) * 110 * u;
      const y = top.y - 30 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * hash(k * 7.3 + gm.n) + 60 * u * u;
      g.fillStyle = CONFETTI[k % CONFETTI.length];
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
}

// ---------------------------------------------------------------- captions: one idea each, at least 2 bars
function captionAt(f: number): [string, string] | "code" | null {
  const bar = Math.floor(f / BAR);
  if (bar < 2 || bar >= 21) return ["1 CAR, 2 GOATS", "PICK A DOOR"]; // bar 21 leads into bar 0
  if (bar < 4) return ["THE HOST KNOWS", "AND OPENS A GOAT"];
  if (bar < 6) return ["YOUR DOOR", "WINS 1 IN 3"];
  if (bar < 8) return ["THE OTHER TWO", "WIN 2 IN 3"];
  if (bar < 10) return ["SWITCH AND YOU", "GET BOTH OF THEM"];
  if (bar < 12) return ["LET'S PLAY", "1,000 TIMES"];
  if (bar >= 17 && bar < 19) return ["THE SCORE:", "SWITCHING WINS 2 IN 3"];
  if (bar >= 19 && bar < 21) return "code";
  return null;
}
function drawCaption(g: CanvasRenderingContext2D, f: number) {
  const { rect, text, measure, panel } = pixelKit(g);
  const cap = captionAt(f);
  if (cap === "code") {
    panel(M, 432, W - 2 * M, 66, C["5a6988"]);
    rect(M, 432, 3, 66, GOLD);
    text("P(stay)   = 1/3", M + 14, 444, "p16", C["ffffff"]);
    text("P(switch) = 2/3", M + 14, 470, "p16", GOLD);
  } else if (cap) {
    const w = Math.min(W - 2 * M, Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28);
    panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
    text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
    text(cap[1], W / 2, 480, "s16", GOLD, "c");
  }
}

/** Bars 4-9: "1 IN 3" over your door, "2 IN 3" over the other two, then over the one the host left shut. */
function drawOdds(g: CanvasRenderingContext2D, f: number) {
  const b = f / FPB;
  if (b < 16 || b >= 40) return;
  const { g: gm } = stageState(T.main, b);
  if (!gm || b >= gm.steps[2]) return;
  const { text, measure, rect } = pixelKit(g);
  const over = (d: number) => toScreen(new THREE.Vector3(DOOR.xs[d], DOOR.h + 0.42, 0.2));
  const tag = (s: string, x: number, y: number, col: string) => {
    const w = measure(s, "s16") + 8;
    rect(Math.round(x - w / 2), Math.round(y) - 2, w, 18, C["181425"]);
    rect(Math.round(x - w / 2), Math.round(y) + 15, w, 1, col);
    text(s, x, y, "s16", col, "c");
  };
  const p = over(gm.pick);
  tag("1 IN 3", p.x, p.y - 8, BLUE);
  const rest = [0, 1, 2].filter((d) => d !== gm.pick && !(b >= gm.steps[1] && d === gm.open));
  if (rest.length === 2) {
    const a = over(rest[0]), c = over(rest[1]);
    tag("2 IN 3", (a.x + c.x) / 2, a.y - 8, ORANGE);
  } else {
    const a = over(rest[0]);
    tag("2 IN 3", a.x, a.y - 8, ORANGE);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  drawConfetti(ctx, f / FPB);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { text, panel } = pixelKit(ov);
  const top = cover ? 86 : 30;
  panel(M, top, W - 2 * M, 54, C["c0cbdc"]);
  text("SHOULD YOU", W / 2, top + 8, "p16", C["c0cbdc"], "c");
  text("SWITCH DOORS?", W / 2, top + 30, "p16", GOLD, "c", C["68386c"]);
  if (!cover) {
    // the doors close for the next show (beat 84): the tally starts again, as at frame 0
    const fd = f / FPB >= T.closes[0] ? T.frames[0] : T.frames[f];
    panel(M, 90, W - 2 * M, 50);
    text("STAY WINS", M + 10, 96, "s16", BLUE);
    text(fd.stay === null ? "--" : `${fd.stay.toFixed(1)}%`, M + 10, 114, "p16", C["ffffff"], "l", C["181425"]);
    text("SWITCH WINS", W - M - 10, 96, "s16", ORANGE, "r");
    text(fd.switch === null ? "--" : `${fd.switch.toFixed(1)}%`, W - M - 10, 114, "p16", C["ffffff"], "r", C["181425"]);
    drawCaption(ov, f);
  }
  drawOdds(ov, f);
  text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const MontyHallVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("monty-hall/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const MontyHall = () => (
  <Composition id="MontyHall" component={MontyHallVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): game 8, the host has opened his goat door and "2 IN 3" sits on the door he left shut. */
export const MontyHallCover = () => (
  <Still id="MontyHallCover" component={MontyHallVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: fr(29.5) }} />
);
