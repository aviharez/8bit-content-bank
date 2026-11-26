import * as THREE from "three";
import { C } from "../../lib/palette";

// World units are metres. The race board is a tall vertical panel in the plane z = 0 inside an arcade cabinet. Two
// lanes run down it side by side: Red on the left, Blue on the right, exact mirror images (x -> -x), so the track is
// fair by construction. Each lane is a stack of zigzag ramps; a marble rolls down a ramp, touches the pins on it and
// the bumper at its low end, and drops onto the next ramp. Obstacles, the same in both lanes: gates at the low end of
// some ramps (the marble waits until they swing open), peg fields in place of two ramps (the marble bounces peg to
// peg), and bounce pads on the high end of the checkpoint levels. A spine between the lanes carries the pacer hammer down with
// the race. Under the last ramp (the final straight) hang the finish banner and each marble's bucket, which rides a
// lift in front of the track back to the top.
export const LANE_X = 1.65; // lane centre, |x|
export const RAMP_LEN = 2.0;
export const RAMP_DROP = 0.32; // height lost along one ramp
export const LEVEL_H = 1.35; // vertical distance between ramps
export const MARBLE_R = 0.34;
export const RAMP_T = 0.12; // ramp thickness
export const LEVELS = 16; // ramps 0-15; 15 is the final straight
export const RIDE = MARBLE_R + RAMP_T / 2; // marble centre above the ramp's centre line
export const FALL = LEVEL_H - RAMP_DROP; // from one ramp's low end onto the next one's high end
export const BUMP = 0.5; // bumper centre past the low end
export const BUCKET_Z = 1.0; // the lift runs in front of the track
export const BUCKET_DROP = 1.6; // from the final straight's low end down into the bucket
export const TOP_REST = RIDE + 1.0; // marble height in the bucket at the top, its floor just above the waiting marble
export const BOTTOM_REST = -(LEVELS - 1) * LEVEL_H - RAMP_DROP + RIDE - BUCKET_DROP;
export const BOARD_TOP = 6, BOARD_BOTTOM = -25, FLOOR_Y = BOTTOM_REST - MARBLE_R - 0.75;
export const N_BANNER = 24, N_CONFETTI = 56;

/** Ramp k of a lane (side -1 = Red, +1 = Blue): its high end and low end, on the ramp's centre line. */
export function ramp(k: number, side: -1 | 1) {
  const cx = side * LANE_X;
  const dir = (k % 2 === 0 ? -1 : 1) * side; // even ramps run toward the spine, odd ones away from it
  const y0 = -k * LEVEL_H;
  return {
    hi: new THREE.Vector3(cx - (dir * RAMP_LEN) / 2, y0, 0),
    lo: new THREE.Vector3(cx + (dir * RAMP_LEN) / 2, y0 - RAMP_DROP, 0),
    dir,
  };
}
export const bumperPos = (k: number, side: -1 | 1) => {
  const r = ramp(k, side);
  return new THREE.Vector3(r.lo.x + r.dir * BUMP, r.lo.y + RIDE, 0);
};
/** The marble's centre on ramp k at u in [0, 1] (0 = high end). */
export const onRamp = (k: number, side: -1 | 1, u: number) => {
  const r = ramp(k, side);
  return r.hi.clone().lerp(r.lo, u).add(new THREE.Vector3(0, RIDE, 0));
};
/** Height of the checkpoint on level k: the bounce pad on the ramp's high end, where a falling marble lands. */
export const checkpointY = (k: number) => ramp(k, 1).hi.y + RIDE;
export const GATE_GAP = MARBLE_R + 0.07; // gate flap past the ramp's low end, touching a marble waiting there
export const bucketX = (side: -1 | 1) => ramp(LEVELS - 1, side).lo.x; // under the final straight's low end
export const BANNER_Y = ramp(LEVELS - 1, 1).lo.y - 0.75;

export type Pin = { ramp: number; u: number; step: number };
export type Peg = { ramp: number; u: number };
export type Obstacles = { pads: number[]; gates: number[]; pegs: number[] };
export type Lane = {
  bumpers: THREE.MeshBasicMaterial[]; pins: THREE.MeshBasicMaterial[];
  marble: THREE.Group; marbleMat: THREE.MeshStandardMaterial; half: THREE.MeshBasicMaterial;
  straight: THREE.MeshStandardMaterial; bucket: THREE.Group; bucketLamps: THREE.MeshBasicMaterial[]; gate: THREE.Mesh;
  chevrons: THREE.MeshBasicMaterial[]; bulbs: THREE.MeshBasicMaterial[];
  pegs: THREE.MeshBasicMaterial[]; pads: { spring: THREE.Group; lamp: THREE.MeshBasicMaterial }[];
  gates: { flap: THREE.Mesh; mat: THREE.MeshStandardMaterial; light: THREE.MeshBasicMaterial }[]; // per race gate, ramp order
};
export type RaceScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  lanes: { R: Lane; B: Lane };
  plate: THREE.Group; plateLamp: THREE.MeshBasicMaterial; hammer: THREE.Group; hammerLamp: THREE.MeshBasicMaterial; shock: THREE.Mesh; shockMat: THREE.MeshBasicMaterial;
  checkpoints: { lampR: THREE.MeshBasicMaterial; lampB: THREE.MeshBasicMaterial }[];
  banner: THREE.MeshBasicMaterial[]; confetti: THREE.Mesh[];
};

export const COL = {
  R: { main: C["e43b44"], dark: C["a22633"], deep: C["3e2731"], half: C["3e2731"], halfLit: C["733e39"], halfMax: C["a22633"], lit: C["f6757a"], dim: C["68386c"], played: C["b55088"] },
  B: { main: C["0099db"], dark: C["124e89"], deep: C["262b44"], half: C["193c3e"], halfLit: C["124e89"], halfMax: C["0099db"], lit: C["2ce8f5"], dim: C["3a4466"], played: C["0099db"] },
};
export const CONFETTI_COLS = [C["2ce8f5"], C["0099db"], C["fee761"], C["ffffff"], C["63c74d"], C["feae34"]];

const std = (c: string, rough = 0.7, metal = 0.15) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c });
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}
function disc(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  c.rotation.x = Math.PI / 2; // face the camera
  c.position.set(x, y, z);
  return c;
}

function buildMarble(side: -1 | 1) {
  const g = new THREE.Group();
  const marbleMat = new THREE.MeshStandardMaterial({ color: side < 0 ? C["e43b44"] : C["0099db"], roughness: 0.25, metalness: 0.3 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(MARBLE_R, 20, 14), marbleMat));
  // a shape you can tell apart without colour: Red wears one ring, Blue a cross of two bands
  const band = basic(C["ffffff"]);
  const ring = () => new THREE.Mesh(new THREE.TorusGeometry(MARBLE_R, 0.045, 6, 20), band);
  if (side < 0) g.add(ring());
  else {
    const a = ring(); a.rotation.y = Math.PI / 2;
    const b = ring(); b.rotation.x = Math.PI / 2;
    g.add(a, b);
  }
  return { marble: g, marbleMat };
}

function buildLane(scene: THREE.Scene, side: -1 | 1, pins: Pin[], pegs: Peg[], ob: Obstacles): Lane {
  const c = side < 0 ? COL.R : COL.B;
  const rampMat = std(c.main, 0.55, 0.1);
  const straight = std(c.main, 0.55, 0.1);
  const edgeMat = std(c.dark, 0.6, 0.2);
  const chevrons = [0, 1, 2, 3].map(() => basic(c.deep));
  const bumpers: THREE.MeshBasicMaterial[] = [];
  const gates: Lane["gates"] = [];
  const pegFrame = std(C["262b44"], 0.8, 0.1);
  for (let k = 0; k < LEVELS; k++) {
    const r = ramp(k, side);
    const len = r.hi.distanceTo(r.lo);
    if (ob.pegs.includes(k)) {
      // a peg board: a dark panel along the level; the pegs this marble plays are added below (lit when hit)
      const panel = box(len + 0.4, 1.7, 0.1, pegFrame);
      panel.position.copy(r.hi.clone().lerp(r.lo, 0.5)).add(new THREE.Vector3(0, 0.45, -0.5));
      panel.rotation.z = Math.atan2(r.lo.y - r.hi.y, r.lo.x - r.hi.x);
      scene.add(panel);
    } else {
      const g = new THREE.Group();
      g.position.copy(r.hi.clone().lerp(r.lo, 0.5));
      g.rotation.z = Math.atan2(r.lo.y - r.hi.y, r.lo.x - r.hi.x);
      g.add(box(len, RAMP_T, 0.9, k === LEVELS - 1 ? straight : rampMat));
      g.add(box(len, 0.2, 0.06, edgeMat, 0, 0.08, 0.45)); // front lip so the ramp reads as a channel
      for (let j = 0; j < 4; j++) g.add(box(0.22, 0.08, 0.02, chevrons[j], -len / 2 + (j + 0.5) * (len / 4), 0.08, 0.49));
      scene.add(g);
    }
    const bp = bumperPos(k, side);
    if (ob.gates.includes(k)) {
      // a gate on the ramp's low end: a tall hazard-striped flap on a post with a signal light (amber shut, green open);
      // the lamp on the flap flashes when the marble bumps it
      const gx = r.lo.x + r.dir * GATE_GAP;
      const dark = std(C["181425"], 0.6, 0.2);
      // a gate by the spine keeps its post and light over the ramp's end, clear of the pacer hammer
      const lx = Math.abs(gx) < Math.abs(r.lo.x) ? r.lo.x - r.dir * 0.15 : gx;
      scene.add(box(0.16, 2.0, 0.16, std(C["3a4466"], 0.5, 0.4), lx, r.lo.y + 0.8, -0.45));
      const mat = std(C["feae34"], 0.45, 0.3);
      const flap = box(0.12, 0.95, 0.85, mat, gx, r.lo.y + RIDE, 0);
      for (const dy of [0.3, 0, -0.3]) flap.add(box(0.13, 0.11, 0.86, dark, 0, dy, 0));
      const bm = basic(c.dim);
      flap.add(box(0.14, 0.16, 0.05, bm, 0, 0.15, 0.44));
      scene.add(flap);
      const light = basic(C["feae34"]);
      scene.add(disc(0.24, 0.12, dark, lx, r.lo.y + 1.95, -0.15), disc(0.18, 0.1, light, lx, r.lo.y + 1.95, -0.06));
      gates.push({ flap, mat, light });
      bumpers.push(bm);
    } else if (k < LEVELS - 1) {
      scene.add(disc(0.2, 0.3, std(C["262b44"], 0.5, 0.4), bp.x, bp.y, -0.05));
      const bm = basic(c.dim);
      scene.add(disc(0.14, 0.12, bm, bp.x, bp.y, 0.13));
      bumpers.push(bm);
    } else {
      // the finish post: a chequered column at the final straight's low end, a lamp on top
      const black = std(C["181425"], 0.6, 0.2), white = std(C["ffffff"], 0.6, 0.2);
      for (let j = 0; j < 5; j++) scene.add(box(0.22, 0.22, 0.3, j % 2 ? black : white, bp.x, r.lo.y - 0.1 + j * 0.22, 0));
      const fm = basic(c.dim);
      scene.add(box(0.34, 0.14, 0.34, fm, bp.x, r.lo.y - 0.1 + 5 * 0.22, 0));
      bumpers.push(fm);
    }
  }
  // the notes: a pin at the back of the ramp wherever this marble touches one; taller = higher note
  const pinMats = pins.map((p) => {
    const r = ramp(p.ramp, side);
    const at = r.hi.clone().lerp(r.lo, p.u);
    const h = 0.18 + 0.1 * p.step;
    const mat = basic(c.dim);
    scene.add(box(0.09, h, 0.09, mat, at.x, at.y + RAMP_T / 2 + h / 2, -0.36));
    return mat;
  });
  // the pegs this marble bounces on in a peg field, one per contact
  const pegMats = pegs.map((p) => {
    const r = ramp(p.ramp, side);
    const at = r.hi.clone().lerp(r.lo, p.u);
    const mat = basic(c.dim);
    scene.add(disc(0.14, 0.6, std(C["c0cbdc"], 0.35, 0.6), at.x, at.y + RIDE - MARBLE_R - 0.14, -0.05, 12));
    scene.add(disc(0.1, 0.1, mat, at.x, at.y + RIDE - MARBLE_R - 0.14, 0.27, 12));
    return mat;
  });
  // bounce pads on the checkpoint levels: a spring block on the ramp's high end; its lamp takes the team colour
  const pads = ob.pads.map((k) => {
    const r = ramp(k, side);
    const spring = new THREE.Group();
    spring.position.set(r.hi.x, r.hi.y + RAMP_T / 2, 0);
    spring.add(box(0.7, 0.1, 0.8, std(C["63c74d"], 0.45, 0.3), 0, 0.05, 0));
    const lamp = basic(C["193c3e"]);
    spring.add(box(0.5, 0.05, 0.02, lamp, 0, 0.05, 0.41));
    scene.add(spring);
    return { spring, lamp };
  });
  // start gate: a flap on the downhill side of ramp 0's high end
  const r0 = ramp(0, side);
  const gate = box(0.08, 0.62, 0.85, std(C["c0cbdc"], 0.4, 0.5), r0.hi.x + r0.dir * (MARBLE_R + 0.07), r0.hi.y + RIDE, 0);
  scene.add(gate);
  // the lift: a rail on the outside of the bucket, from the cabinet floor to above the start gate
  const bx = bucketX(side);
  scene.add(box(0.1, BOARD_TOP - FLOOR_Y, 0.1, std(C["8b9bb4"], 0.4, 0.6), bx + side * 0.62, (BOARD_TOP + FLOOR_Y) / 2, BUCKET_Z));
  const bucket = new THREE.Group();
  const bmat = std(c.dark, 0.5, 0.3);
  bucket.add(box(1.0, 0.1, 0.8, bmat, 0, -MARBLE_R - 0.05, 0));
  for (const s of [-1, 1]) bucket.add(box(0.1, 0.62, 0.8, bmat, s * 0.5, -MARBLE_R + 0.21, 0));
  bucket.add(box(1.0, 0.62, 0.08, bmat, 0, -MARBLE_R + 0.21, -0.4));
  bucket.add(box(1.0, 0.2, 0.06, std(c.main, 0.5, 0.2), 0, -MARBLE_R, 0.42)); // low front lip: the marble shows
  bucket.add(box(0.14, 0.1, 0.1, bmat, side * 0.57, 0, 0)); // arm to the rail
  const bucketLamps = [0, 1, 2, 3, 4, 5].map(() => basic(c.deep));
  bucketLamps.forEach((m, j) => bucket.add(box(0.12, 0.08, 0.02, m, -0.375 + j * 0.15, -MARBLE_R, 0.46)));
  scene.add(bucket);
  // the back board half for this team
  const half = basic(c.half);
  scene.add(box(3.6, BOARD_TOP - FLOOR_Y, 0.2, half, side * 1.8, (BOARD_TOP + FLOOR_Y) / 2, -0.6));
  // side chaser bulbs (the hats): a column down this side's wall
  scene.add(box(0.06, BOARD_TOP - FLOOR_Y, 0.06, basic(c.dark), side * 3.33, (BOARD_TOP + FLOOR_Y) / 2, 2.4));
  const bulbs: THREE.MeshBasicMaterial[] = [];
  for (let y = BOARD_TOP; y > FLOOR_Y; y -= 0.45) {
    const m = basic(c.deep);
    scene.add(box(0.13, 0.13, 0.13, m, side * 3.28, y, 2.5));
    bulbs.push(m);
  }
  const { marble, marbleMat } = buildMarble(side);
  scene.add(marble);
  return { bumpers, pins: pinMats, marble, marbleMat, half, straight, bucket, bucketLamps, gate, chevrons, bulbs, pegs: pegMats, pads, gates };
}

export function buildScene(width: number, height: number, pins: { R: Pin[]; B: Pin[] }, pegs: { R: Peg[]; B: Peg[] },
  ob: Obstacles): RaceScene {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);
  const hemi = new THREE.HemisphereLight(C["ffffff"], C["3a4466"], 1.6);
  const key = new THREE.DirectionalLight(C["ffffff"], 1.6);
  key.position.set(1.5, 3, 9);
  scene.add(hemi, key);

  const lanes = { R: buildLane(scene, -1, pins.R, pegs.R, ob), B: buildLane(scene, 1, pins.B, pegs.B, ob) };
  const h = BOARD_TOP - FLOOR_Y, cy = (BOARD_TOP + FLOOR_Y) / 2;
  const wall = std(C["3a4466"], 0.8, 0.1);
  for (const s of [-1, 1]) scene.add(box(0.3, h, 3.2, wall, s * 3.5, cy, 0.9));
  scene.add(box(7.2, 0.4, 3.2, wall, 0, FLOOR_Y - 0.2, 0.9)); // cabinet floor under the buckets
  const gridMat = basic(C["262b44"]);
  for (let y = BOARD_TOP - 0.7; y > FLOOR_Y; y -= LEVEL_H) scene.add(box(7.0, 0.02, 0.02, gridMat, 0, y, -0.48));

  // the spine between the lanes and the pacer hammer riding on it
  scene.add(box(0.24, h, 0.7, std(C["5a6988"], 0.5, 0.5), 0, cy, -0.1));
  const hammer = new THREE.Group();
  hammer.add(box(0.46, 0.5, 0.8, std(C["feae34"], 0.45, 0.4), 0, 0, 0.35));
  hammer.add(box(0.6, 0.14, 0.82, std(C["262b44"], 0.5, 0.4), 0, -0.3, 0.35));
  const hammerLamp = basic(C["f77622"]);
  hammer.add(box(0.3, 0.12, 0.02, hammerLamp, 0, 0.05, 0.77));
  scene.add(hammer);
  // the strike plate the hammer lands on: clamped to the spine, it rides down with the hammer
  const plate = new THREE.Group();
  plate.add(box(0.7, 0.16, 0.86, std(C["5a6988"], 0.4, 0.6), 0, 0, 0.35));
  const plateLamp = basic(C["3a4466"]);
  plate.add(box(0.5, 0.06, 0.02, plateLamp, 0, 0, 0.79));
  scene.add(plate);
  const shockMat = new THREE.MeshBasicMaterial({ color: C["fee761"], transparent: true, opacity: 0 });
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.6, 32), shockMat);
  shock.position.z = -0.45;
  scene.add(shock);

  // checkpoint lamps on the walls, level with each pad, one per team
  const checkpoints = ob.pads.map((k) => {
    const y = checkpointY(k);
    const lampR = basic(C["3e2731"]), lampB = basic(C["262b44"]);
    scene.add(box(0.3, 0.3, 0.08, lampR, -3.2, y, 0.55), box(0.3, 0.3, 0.08, lampB, 3.2, y, 0.55));
    return { lampR, lampB };
  });
  // the finish banner under the final straight: a chequered strip with 24 lamps (the snare roll)
  const chk = [std(C["ffffff"], 0.6, 0.1), std(C["181425"], 0.6, 0.1)];
  for (let j = 0; j < N_BANNER; j++) scene.add(box(0.275, 0.16, 0.08, chk[j % 2], -3.3 + 0.275 * (j + 0.5), BANNER_Y, 0.45));
  const banner = [...Array(N_BANNER).keys()].map((j) => {
    const m = basic(C["262b44"]);
    scene.add(box(0.2, 0.1, 0.04, m, -3.3 + 0.275 * (j + 0.5), BANNER_Y - 0.16, 0.5));
    return m;
  });
  const confetti = [...Array(N_CONFETTI).keys()].map((j) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.02), basic(CONFETTI_COLS[j % CONFETTI_COLS.length]));
    m.visible = false;
    scene.add(m);
    return m;
  });
  return { renderer, scene, camera, lanes, plate, plateLamp, hammer, hammerLamp, shock, shockMat, checkpoints, banner, confetti };
}
