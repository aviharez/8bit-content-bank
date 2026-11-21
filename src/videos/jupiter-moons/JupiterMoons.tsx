import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { pixelKit } from "../../lib/pixel2d";
import { buildJupiterScene, JupiterScene, Moon, MOONS, ORBIT } from "./scene";
import timeline from "../../../public/jupiter-moons/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3;
const FPS = 30, DURATION = 960; // 24 bars at 180 BPM
const BAR = 40; // frames per bar

type Pair = "IE" | "EG" | "IG";
type TL = {
  daysPerBar: number;
  frames: { days: number; lon: Record<Moon, number> }[];
  events: { sec: number; pair: Pair; beat: number; lon: number }[];
};
const T = timeline as unknown as TL;
const EV = T.events.map((e) => ({ ...e, frame: e.sec * FPS }));
/** Frames since the last conjunction of this pair (large if none yet). */
const sinceLast = (pair: Pair, f: number) => {
  let best = 1e9, lon = 0;
  for (const e of EV) if (e.pair === pair && e.frame <= f + 1e-6 && f - e.frame < best) { best = f - e.frame; lon = e.lon; }
  return { since: best, lon };
};
const PAIR_INFO: Record<Pair, { label: string; drum: string; color: string }> = {
  EG: { label: "EU+GA", drum: "KICK", color: C["e43b44"] },
  IE: { label: "IO+EU", drum: "SNARE", color: C["fee761"] },
  IG: { label: "IO+GA", drum: "PERC", color: C["2ce8f5"] },
};

// ---- camera: a slow figure that starts and ends on the same shot ----
type V3 = [number, number, number];
const CAM: [number, V3, V3][] = [
  [0, [0, 28, 21], [0, -0.6, 0]],
  [160, [3.5, 27, 20], [0, -0.6, 0]],
  [320, [-3, 26, 21.5], [0, -0.6, 0]],
  [480, [0, 27.5, 22], [0, -0.6, 0]],
  [640, [2.5, 24, 19], [0, -0.4, 0]],
  [800, [-2, 26, 20.5], [0, -0.6, 0]],
  [959, [0, 28, 21], [0, -0.6, 0]],
];
function camAt(f: number): { pos: V3; look: V3 } {
  let i = 0;
  while (i < CAM.length - 2 && CAM[i + 1][0] <= f) i++;
  const [f0, p0, l0] = CAM[i], [f1, p1, l1] = CAM[i + 1];
  const t = interpolate(f, [f0, f1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const mix = (a: V3, b: V3) => a.map((v, j) => v + (b[j] - v) * t) as V3;
  return { pos: mix(p0, p1), look: mix(l0, l1) };
}

function captionAt(bar: number): [string, string] | "code" {
  if (bar < 2 || bar >= 22) return ["3 MOONS, 1:2:4", "WATCH THEM MEET"];
  if (bar < 4) return ["EUROPA + GANYMEDE", "MEET ONCE A CYCLE = KICK"];
  if (bar < 8) return ["IO + EUROPA", "MEET TWICE = SNARE ON 2 AND 4"];
  if (bar < 12) return ["IO + GANYMEDE", "MEET 3 TIMES = 3 AGAINST 2"];
  if (bar < 16) return ["ALL THREE", "NEVER LINE UP AT ONCE"];
  if (bar < 20) return ["REAL ORBITS", "1 BAR = 7.05 DAYS"];
  return "code";
}

let S: JupiterScene | null = null;
const toXZ = (lonDeg: number, r: number): [number, number] => {
  const a = (lonDeg * Math.PI) / 180;
  return [Math.cos(a) * r, -Math.sin(a) * r];
};

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  S ??= buildJupiterScene(W, H);
  const { renderer, scene, camera, jupiter, moons, moonMats, beams } = S;
  const st = T.frames[f];
  const bar = Math.floor(f / BAR);

  // ---------- 3D ----------
  for (const m of MOONS) {
    const [x, z] = toXZ(st.lon[m], ORBIT[m]);
    moons[m].position.set(x, 0, z);
    moonMats[m].emissiveIntensity = 0;
  }
  jupiter.rotation.y = (f / DURATION) * Math.PI * 2; // banded, so any spin rate looks the same; one turn keeps the loop exact
  let kickShake = 0;
  for (const pair of ["EG", "IE", "IG"] as Pair[]) {
    const { since, lon } = sinceLast(pair, f);
    const glow = since < 9 ? 1 - since / 9 : 0;
    const b = beams[pair];
    b.rotation.y = (lon * Math.PI) / 180;
    (b.material as THREE.MeshBasicMaterial).opacity = glow;
    b.visible = glow > 0;
    if (glow > 0) {
      const who: Moon[] = pair === "IE" ? ["io", "europa"] : pair === "EG" ? ["europa", "ganymede"] : ["io", "ganymede"];
      for (const m of who) moonMats[m].emissiveIntensity = Math.max(moonMats[m].emissiveIntensity, glow * 0.7);
    }
    if (pair === "EG" && since < 4) kickShake = (bar >= 16 && bar < 20 ? 0.12 : 0.05) * (1 - since / 4);
  }
  const { pos, look } = camAt(f);
  camera.position.set(pos[0], pos[1] - kickShake, pos[2]);
  camera.lookAt(...look);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  // ---------- 2D overlay ----------
  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const M = 28;
  const project = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  };

  if (cover) {
    panel(M, 96, W - 2 * M, 78, C["c0cbdc"]);
    text("JUPITER'S MOONS", W / 2, 108, "p16", C["c0cbdc"], "c");
    text("1 : 2 : 4", W / 2, 132, "p32", C["fee761"], "c", C["be4a2f"]);
    panel(M + 16, 432, W - 2 * M - 32, 74, C["c0cbdc"]);
    text("THEIR ORBITS ARE A", W / 2, 444, "s16", C["8b9bb4"], "c");
    text("DRUM BEAT", W / 2, 466, "p24", C["ffffff"], "c", C["be4a2f"]);
    text("@squarewavelab", W / 2, 528, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    panel(M, 34, W - 2 * M, 70, C["c0cbdc"]);
    text("JUPITER'S MOONS", W / 2, 44, "p16", C["c0cbdc"], "c");
    text("1 : 2 : 4", W / 2, 66, "p32", C["fee761"], "c", C["be4a2f"]);

    // data panel: day within the 7.05-day cycle (it repeats every bar, so the loop is exact), and the three meetings
    panel(M, 110, W - 2 * M, 84);
    const day = st.days % T.daysPerBar;
    text("DAY", M + 10, 116, "s16", C["8b9bb4"]);
    text(day.toFixed(1), M + 10, 136, "p32", C["fee761"], "l", C["be4a2f"]);
    text("OF 7.05", M + 10, 172, "s16", C["8b9bb4"]);
    (["EG", "IE", "IG"] as Pair[]).forEach((pair, i) => {
      const y = 118 + i * 24, x = M + 128;
      const hot = sinceLast(pair, f).since < 5;
      rect(x, y + 2, 12, 12, hot ? PAIR_INFO[pair].color : C["3e2731"]);
      rect(x, y + 2, 12, 1, PAIR_INFO[pair].color);
      text(PAIR_INFO[pair].label, x + 20, y, "s16", hot ? C["ffffff"] : C["8b9bb4"]);
      text(PAIR_INFO[pair].drum, W - M - 10, y, "s16", hot ? PAIR_INFO[pair].color : C["5a6988"], "r");
    });

    // motion trails: where each moon was during the last frame (Io covers ~36 degrees per frame)
    const trailColor: Record<Moon, string> = { io: C["feae34"], europa: C["ead4aa"], ganymede: C["8b9bb4"] };
    if (f > 0) {
      const prev = T.frames[f - 1];
      for (const m of MOONS) {
        let d = st.lon[m] - prev.lon[m];
        if (d < 0) d += 360;
        for (let i = 2; i <= 18; i++) {
          const [x, z] = toXZ(st.lon[m] - (d * i) / 18, ORBIT[m]);
          const [px, py] = project(x, 0, z);
          const sz = i < 8 ? 4 : i < 13 ? 3 : 2;
          if (py > 214 && py < 446) rect(px - sz / 2, py - sz / 2, sz, sz, i > 12 && i % 2 ? C["5a6988"] : trailColor[m]);
        }
      }
    }

    // moon labels
    const names: Record<Moon, string> = { io: "IO", europa: "EUROPA", ganymede: "GANYMEDE" };
    for (const m of MOONS) {
      const [x, z] = toXZ(st.lon[m], ORBIT[m]);
      const [px, py] = project(x, 0.9, z);
      if (py > 230 && py < 446 && px > M + 30 && px < W - M - 30) text(names[m], px, py - 14, "s16", C["c0cbdc"], "c", C["181425"]);
    }

    const cap = captionAt(bar);
    if (cap === "code") {
      panel(M, 436, W - 2 * M, 64, C["5a6988"]);
      rect(M, 436, 3, 64, C["63c74d"]);
      text("nI - 3nE + 2nG = 0", M + 12, 446, "p16", C["ffffff"]);
      text("-> MEETINGS 2 : 1 : 3", M + 12, 472, "s16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");
  }

  ov.putImageData(quantize(ov.getImageData(0, 0, W, H), 0, true), 0, 0);
  ctx.drawImage(ov.canvas, 0, 0);
}

export const JupiterMoonsVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("jupiter-moons/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const JupiterMoons = () => (
  <Composition id="JupiterMoons" component={JupiterMoonsVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16). The profile grid shows its centre 3:4 crop. */
export const JupiterMoonsCover = () => (
  <Still id="JupiterMoonsCover" component={JupiterMoonsVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: 681 }} />
);
