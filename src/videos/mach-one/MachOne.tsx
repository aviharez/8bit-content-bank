import React, { useLayoutEffect, useRef, useState } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, interpolate, staticFile, Still, useCurrentFrame, useDelayRender } from "remotion";
import * as THREE from "three";
import { C, quantize } from "../../lib/palette";
import { fontsReady } from "../../lib/fonts";
import { drawLooped } from "../../lib/loop";
import { pixelKit } from "../../lib/pixel2d";
import { buildScene, GROUND_TILE, MachScene, MAX_RINGS } from "./scene";
import timeline from "../../../public/mach-one/timeline.json";

// Low-res frame 360x640, shown at exactly 3x -> 1080x1920.
const W = 360, H = 640, SCALE = 3, M = 28;
type TL = { fps: number; framesPerBeat: number; totalFrames: number; dropBar: number; outroBar: number; c: number; alt: number; ringLife: number; loopDist: number;
  frames: { s: number; mach: number }[]; rings: { t: number; s: number }[]; heard: { beat: number; k: number; midi: number }[];
  towers: { beat: number; s: number; y: number }[]; listener: number };
const T = timeline as unknown as TL;
const FPS = T.fps, FPB = T.framesPerBeat, BAR = 4 * FPB, DURATION = T.totalFrames, LOOP_S = DURATION / FPS;
const DROP_F = T.dropBar * BAR, OUTRO_F = T.outroBar * BAR;
const ease = Easing.inOut(Easing.cubic);
// ground and clouds repeat a whole number of times over the loop, so the last frame matches the first
const TILE = T.loopDist / Math.round(T.loopDist / GROUND_TILE);
const CLOUD_SPAN = TILE * 6;
const HER = T.towers[T.listener];
const HER_F = HER.beat * FPB;
// the camera visits her: it leaves the jet a bar before her boom and comes back a bar and a half after
const VISIT = [HER_F - 50, HER_F - 26, HER_F + 34, HER_F + 60];

let S: MachScene | null = null;

/** What a listener straight ahead hears, or null when the jet is supersonic (nothing reaches them). */
function heardAt(f: number) {
  const b = f / FPB, mach = T.frames[f].mach;
  if (mach >= 1 || (b >= T.dropBar * 4 && b < T.heard.find((h) => h.beat > T.dropBar * 4)!.beat)) return null; // supersonic, or still above the top harmonic
  let h = T.heard[0];
  for (const x of T.heard) if (x.beat <= b + 1e-6) h = x;
  return h;
}

function render3D(f: number) {
  S ??= buildScene(W, H, T.alt);
  const { renderer, scene, camera, jet, burner, burnerMat, burnerLight, vaporMat, ground, clouds, rings, ringMats, cone, coneMat, coneLines, towers, person } = S;
  const t = f / FPS, { s, mach } = T.frames[f];

  // the world moves past the jet (the jet stays at the origin, heading -z)
  ground.scale.setScalar(TILE / GROUND_TILE);
  ground.position.z = -(s % TILE) * -1 - TILE * 2;
  for (const c of clouds.children) {
    const z = ((((c.userData.z0 as number) + s) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN;
    c.position.z = z - CLOUD_SPAN * 0.6;
  }

  // the jet: banks a little, its afterburner grows with speed
  jet.rotation.z = 0.08 * Math.sin((2 * Math.PI * f) / DURATION * 2);
  burner.scale.set(1, 0.4 + 1.4 * Math.min(2, mach) / 2, 1);
  burnerMat.color.set(mach > 1 ? C["fee761"] : C["f77622"]);
  burnerLight.intensity = 1 + 3 * mach;
  // the vapour cone at the edge of Mach 1 (transonic: Mach 0.95 to 1.1)
  vaporMat.opacity = mach > 0.95 && mach < 1.12 ? 0.55 * Math.sin(Math.PI * (mach - 0.95) / 0.17) : 0;

  // wavefronts: one circle per 8th note, centred where the jet was when it made it, growing at 343 m/s
  let n = 0;
  const all = T.rings.map((r) => ({ ...r })).concat(T.rings.map((r) => ({ t: r.t - LOOP_S, s: r.s - T.loopDist })));
  for (const r of all) {
    const age = t - r.t;
    if (age < 0 || age > T.ringLife || n >= MAX_RINGS) continue;
    const ring = rings[n], R = T.c * age;
    ring.visible = true;
    ring.position.set(0, T.alt, -(r.s - s));
    ring.scale.set(R, 1, R);
    const k = age / T.ringLife;
    ringMats[n].color.set(k < 0.25 ? C["ffffff"] : k < 0.5 ? C["2ce8f5"] : k < 0.75 ? C["0099db"] : C["124e89"]);
    n++;
  }
  for (let i = n; i < MAX_RINGS; i++) rings[i].visible = false;

  // the Mach cone: half-angle asin(1/M), apex at the jet, opening behind it
  const superS = mach >= 1;
  cone.visible = coneLines.visible = superS;
  if (superS) {
    const th = Math.asin(1 / mach), L = 14;
    cone.scale.set(L * Math.tan(th), L, L * Math.tan(th));
    cone.rotation.set(-Math.PI / 2, 0, 0); // tip towards -z (the jet), opening towards +z
    cone.position.set(0, T.alt, L / 2);
    coneMat.opacity = 0.14 + 0.06 * Math.sin(f * 0.9);
    const pos = coneLines.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, 0, T.alt, 0); pos.setXYZ(1, L * Math.sin(th), T.alt, L * Math.cos(th));
    pos.setXYZ(2, 0, T.alt, 0); pos.setXYZ(3, -L * Math.sin(th), T.alt, L * Math.cos(th));
    pos.needsUpdate = true;
  }

  // towers: each lights up when its boom arrives (exactly on a kick), with a shock ring on the ground
  T.towers.forEach((tw, i) => {
    const o = towers[i];
    const z = -(tw.s - s);
    o.group.visible = f >= DROP_F - BAR && f < OUTRO_F + 2 * BAR && z > -30 && z < 16;
    o.group.position.set(tw.y, 0, z);
    const since = f - tw.beat * FPB;
    if (since >= 0) {
      o.beaconMat.color.set(since < 3 ? C["ffffff"] : since < 8 ? C["fee761"] : C["e43b44"]);
      o.beacon.scale.setScalar(since < 4 ? 2.2 - since * 0.3 : 1);
      o.wave.scale.setScalar(0.2 + since * 0.18);
      o.waveMat.opacity = since < 10 ? 0.9 * (1 - since / 10) : 0;
    } else { o.beaconMat.color.set(C["3a4466"]); o.beacon.scale.setScalar(1); o.waveMat.opacity = 0; }
  });
  for (let i = T.towers.length; i < towers.length; i++) towers[i].group.visible = false;
  // she stands on her tower; the boom makes her jump
  const herZ = -(HER.s - s);
  person.visible = towers[T.listener].group.visible;
  const sinceHer = f - HER_F;
  person.position.set(HER.y, T.alt + 0.1 + (sinceHer >= 0 && sinceHer < 6 ? 0.12 * Math.sin((Math.PI * sinceHer) / 6) : 0), herZ);
  person.rotation.y = Math.PI * 0.15 * Math.sign(HER.y);

  // camera: above and behind; it climbs and pulls back as the cone opens behind the jet, and returns for the loop
  const pull = interpolate(f, [0, DROP_F - 2 * BAR, DROP_F, OUTRO_F, DURATION - 1], [0, 0.15, 0.55, 0.55, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const orbit = 0.22 * Math.sin((2 * Math.PI * f) / DURATION);
  const d = 5.2 + 4 * pull;
  camera.position.set(Math.sin(orbit) * d * 0.6, T.alt + 6.8 + 3.5 * pull, Math.cos(orbit) * d);
  const hit = f >= DROP_F && f < DROP_F + 8 ? 0.15 * Math.exp(-(f - DROP_F) / 2) : 0; // Mach 1: the one camera hit
  camera.position.x += Math.sin(f * 12.9) * hit; camera.position.y += Math.cos(f * 7.3) * hit;
  const chaseLook = new THREE.Vector3(0, T.alt, -0.7 + 3.6 * pull); // ahead of the jet while subsonic (the pile-up), behind it in the drop (the cone)
  // her camera: beside her, a little ahead, looking back up the path at the jet coming
  const w = interpolate(f, VISIT, [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  if (w > 0) {
    const side = Math.sign(HER.y);
    const herPos = new THREE.Vector3(HER.y + side * 1.4, T.alt + 0.7, herZ - 2.1);
    const herLook = new THREE.Vector3(HER.y * 0.5, T.alt + 0.1, herZ + 2.6);
    camera.position.lerp(herPos, w);
    chaseLook.lerp(herLook, w);
  }
  camera.lookAt(chaseLook);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return { mach };
}

function captionAt(f: number): [string, string] | "code" {
  const bar = Math.floor(f / BAR);
  if (bar < 2) return ["EACH RING IS", "THE JET'S SOUND"];
  if (bar < 4) return ["SOUND TRAVELS AT", "1,235 KM/H. ALWAYS."];
  if (bar < 6) return ["THE JET SPEEDS UP", "AND CHASES ITS SOUND"];
  if (bar < 8) return ["RINGS SQUEEZE", "IN FRONT OF THE JET"];
  if (bar < 10) return ["HIGHER NOTE AHEAD", "LIKE AN AMBULANCE SIREN"];
  if (bar < 12) return ["SPEED OF SOUND:", "THE RINGS STACK UP"];
  if (bar < 14) return ["ONE BIG WALL", "THAT'S THE BOOM"];
  if (bar < 16) return ["FASTER THAN SOUND", "THE WALL TRAILS BEHIND"];
  if (bar < 18) return ["SHE HEARS NOTHING", "UNTIL THE WALL HITS"];
  if (bar < 20) return ["EVERY TOWER", "GETS ITS OWN BOOM"];
  if (bar < 22) return "code";
  return ["SLOWER THAN SOUND", "THE NOTE IS BACK"];
}

/** What the listener ahead hears, in plain words, and how squeezed the wave is (wave period in pixels; 0 = silence). */
function hearsAt(f: number): { who: string; what: string; period: number; boom: boolean } {
  const who = f < HER_F + 3 * FPB ? "SHE HEARS" : "NEXT TOWER HEARS";
  if (f >= HER_F && f < HER_F + 3 * FPB) return { who, what: "BOOM!", period: 0, boom: true };
  const h = heardAt(f);
  if (!h) return { who, what: "NOTHING", period: 0, boom: false };
  const what = h.k <= 2 ? "A LOW HUM" : h.k <= 4 ? "HIGHER" : h.k <= 12 ? "HIGHER STILL" : "A SCREAM";
  return { who, what, period: Math.max(2, 36 / h.k), boom: false };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const kmh = (mach: number) => Math.round((mach * 343 * 3.6) / 5) * 5;

function drawFrame(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, cover = false) {
  const { mach } = render3D(f);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S!.renderer.domElement, 0, 0);
  ctx.putImageData(quantize(ctx.getImageData(0, 0, W, H), 34, false), 0, 0);

  ov.clearRect(0, 0, W, H);
  const { rect, text, measure, panel } = pixelKit(ov);
  const ty = cover ? 86 : 34;
  panel(M, ty, W - 2 * M, 70, C["c0cbdc"]);
  text("WHY DO JETS", W / 2, ty + 10, "p16", C["c0cbdc"], "c");
  text("GO BOOM?", W / 2, ty + 32, "p32", C["fee761"], "c", C["be4a2f"]);

  if (cover) {
    panel(M + 20, 452, W - 2 * M - 40, 52, C["c0cbdc"]);
    text("FASTER THAN SOUND", W / 2, 462, "p16", C["ffffff"], "c");
    text("WATCH THE RINGS", W / 2, 482, "s16", C["fee761"], "c");
    text("@squarewavelab", W / 2, 586, "s16", C["c0cbdc"], "c", C["181425"]);
  } else {
    // speedometer: the jet's speed against the speed of sound
    panel(M, 110, W - 2 * M, 44);
    text("JET SPEED", M + 10, 116, "s16", C["8b9bb4"]);
    text(`${kmh(mach).toLocaleString("en-US")} km/h`, W - M - 10, 114, "p16", mach >= 1 ? C["fee761"] : C["ffffff"], "r");
    const bx = M + 10, bw = W - 2 * M - 20, by = 136, sx = bx + bw / 2; // the bar runs to twice the speed of sound
    rect(bx, by, bw, 8, C["262b44"]);
    rect(bx, by, Math.min(bw, (bw * mach) / 2), 8, mach >= 1 ? C["fee761"] : C["2ce8f5"]);
    rect(sx - 1, by - 4, 2, 16, C["ff0044"]);
    text("SOUND", sx + 4, by - 6, "s16", C["ff0044"]);

    // what the listener ahead hears: a wave that squeezes as the note climbs
    const h = hearsAt(f);
    panel(M, 160, W - 2 * M, 44, h.boom ? C["ffffff"] : C["5a6988"]);
    text(h.who, M + 10, 166, "s16", C["8b9bb4"]);
    text(h.what, W - M - 10, 166, "s16", h.boom ? C["ffffff"] : h.period ? C["2ce8f5"] : C["ff0044"], "r");
    const wx = M + 10, ww = W - 2 * M - 20, wy = 192;
    for (let x = 0; x < ww; x++) {
      let y = 0;
      if (h.boom) y = Math.abs(x - ww / 2) < 6 ? -9 * (1 - Math.abs(x - ww / 2) / 6) * (f % 2 ? 1 : -1) : 0;
      else if (h.period) y = 6 * Math.sin(((x + f * 3) / h.period) * Math.PI * 2);
      rect(wx + x, wy + Math.round(y), 1, 1, h.boom ? C["ffffff"] : C["2ce8f5"]);
    }

    // point her out while she is on screen
    const herV = new THREE.Vector3(HER.y, T.alt + 0.55, -(HER.s - T.frames[f].s)).project(S!.camera);
    const hx = ((herV.x + 1) / 2) * W, hy = ((1 - herV.y) / 2) * H;
    if (herV.z < 1 && hx > M && hx < W - M && hy > 214 && hy < 440 && f > DROP_F) {
      text("HER", hx, hy - 20, "s16", C["ffffff"], "c", C["181425"]);
      rect(hx - 1, hy - 4, 3, 3, C["ffffff"]);
    }

    const note = f < DROP_F ? "REAL TIME. JET NOT TO SCALE" : f < OUTRO_F ? "EACH TOWER'S BOOM IS A KICK" : "";
    if (note) text(note, W / 2, 210, "s16", C["8b9bb4"], "c", C["181425"]);

    const cap = captionAt(f);
    if (cap === "code") {
      panel(M, 444, W - 2 * M, 58, C["5a6988"]);
      rect(M, 444, 3, 58, C["63c74d"]);
      text("ahead f'=f/(1-M)", M + 12, 452, "p16", C["ffffff"]);
      text("cone sin(a)=1/M", M + 12, 476, "p16", C["63c74d"]);
    } else {
      const w = Math.max(measure(cap[0], "p16"), measure(cap[1], "s16")) + 28;
      panel(W / 2 - w / 2, 450, w, 52, C["c0cbdc"]);
      text(cap[0], W / 2, 460, "p16", C["ffffff"], "c");
      text(cap[1], W / 2, 480, "s16", C["fee761"], "c");
    }
    text("@squarewavelab", W / 2, 586, "s16", C["5a6988"], "c");

    // Mach 1: every front arrives at once, the frame whites out for a moment
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

export const MachOneVideo: React.FC<{ coverFrame?: number }> = ({ coverFrame }) => {
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
      {coverFrame === undefined ? <Audio src={staticFile("mach-one/track.wav")} /> : null}
    </AbsoluteFill>
  );
};

export const MachOne = () => (
  <Composition id="MachOne" component={MachOneVideo} durationInFrames={DURATION} fps={FPS} width={W * SCALE} height={H * SCALE} />
);

/** Reel cover (9:16): the fronts piled up at the nose just before the speed of sound. The profile grid shows its centre 3:4 crop. */
export const MachOneCover = () => (
  <Still id="MachOneCover" component={MachOneVideo} width={W * SCALE} height={H * SCALE} defaultProps={{ coverFrame: DROP_F - 8 }} />
);
