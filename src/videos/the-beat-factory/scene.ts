import * as THREE from "three";
import { C } from "../../lib/palette";

// World units are metres. One production lane runs along z, from the camera (+z, crates come in) to the reactor
// (-z). The line is an indexing conveyor: crates sit on slots SLOT apart and advance one slot a beat. Stations sit on
// slots: press 2, arms 4, cutter 6, sorter 8; after the sorter a crate rides a chute into one of the reactor's two
// intakes (or, in the cooldown, off the side of the hall).
export const SLOT = 1.6;
export const slotZ = (s: number) => 7.2 - s * SLOT;
export const ST = { press: 2, arms: 4, cutter: 6, sorter: 8 };
export const BELT_TOP = 0.5;
export const CRATE = { w: 1.0, h: 0.8, d: 1.0 };
export const CRATE_TOP = BELT_TOP + CRATE.h;
export const RAM_UP = 1.1; // how far the ram lifts above the crate top
export const LAMP_Y = (k: number) => 0.85 + k * 0.52; // the 5 lamps of an arm's column, low to high
export const ARM_X = 2.35, COLUMN_X = 3.35;
export const ARM_Z = slotZ(4.6); // the arms stand a little up the line from the press, clear of it
export const REACTOR = new THREE.Vector3(0, 0, -10.2);
export const INTAKE_X = 1.25, INTAKE_Z = -8.3;
export const N_CRATES = 13;
export const RING = 24;

export type Crate = { root: THREE.Group; body: THREE.Group; stamp: THREE.Mesh; core: THREE.MeshBasicMaterial; coreMesh: THREE.Mesh; seal: THREE.Mesh };
export type Arm = {
  group: THREE.Group; carriage: THREE.Group; piston: THREE.Mesh; claw: THREE.Group; led: THREE.MeshBasicMaterial;
  lamps: THREE.MeshBasicMaterial[]; on: string; off: string;
};
export type FactoryScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; reactorLight: THREE.PointLight;
  ram: THREE.Group; pressLamp: THREE.MeshBasicMaterial; rollers: THREE.Mesh[]; rollerMat: THREE.MeshStandardMaterial; rail: THREE.MeshBasicMaterial[];
  crates: Crate[]; arms: { L: Arm; R: Arm };
  laser: THREE.Mesh; laserHead: THREE.MeshBasicMaterial;
  gate: THREE.Group; gateLamps: { L: THREE.MeshBasicMaterial; R: THREE.MeshBasicMaterial };
  core: THREE.Mesh; coreMat: THREE.MeshBasicMaterial; coreRim: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial[];
  intakeLamps: THREE.MeshBasicMaterial[]; ceiling: THREE.MeshBasicMaterial[]; beams: THREE.Mesh[]; status: THREE.MeshBasicMaterial[];
};

const std = (c: string, rough = 0.8, metal = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c });
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}
function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 12) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  c.position.set(x, y, z);
  return c;
}

function buildCrate(): Crate {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const wood = std(C["b86f50"], 0.9);
  body.add(box(CRATE.w, CRATE.h, CRATE.d, wood, 0, CRATE.h / 2, 0));
  // dark slats so the crate reads as a crate at 360 px
  const slat = std(C["733e39"], 0.9);
  for (const y of [0.18, 0.62]) body.add(box(CRATE.w + 0.02, 0.08, CRATE.d + 0.02, slat, 0, y, 0));
  // a window in the front: the charged cell glows through it
  body.add(box(0.5, 0.34, 0.02, basic(C["181425"]), 0, 0.4, CRATE.d / 2 + 0.01));
  const core = basic(C["3a4466"]);
  const coreMesh = box(0.42, 0.26, 0.02, core, 0, 0.4, CRATE.d / 2 + 0.02);
  body.add(coreMesh);
  const stamp = box(0.6, 0.05, 0.6, std(C["feae34"], 0.5), 0, CRATE.h + 0.025, 0);
  const seal = box(CRATE.w + 0.04, 0.05, 0.12, basic(C["e43b44"]), 0, CRATE.h + 0.03, 0);
  body.add(stamp, seal);
  root.add(body);
  return { root, body, stamp, core, coreMesh, seal };
}

function buildArm(sgn: number, on: string): Arm {
  const g = new THREE.Group();
  const z = ARM_Z;
  const steel = std(C["8b9bb4"], 0.5, 0.4);
  const dark = std(C["3a4466"], 0.7);
  // the rail post and its foot
  g.add(box(0.7, 0.3, 0.9, dark, sgn * ARM_X, 0.15, z));
  g.add(box(0.3, 3.3, 0.3, steel, sgn * ARM_X, 1.8, z - 0.2));
  // the lamp column behind a dark panel
  g.add(box(0.8, 3.0, 0.5, std(C["262b44"], 0.9), sgn * COLUMN_X, 1.85, z - 0.1));
  const lamps = [0, 1, 2, 3, 4].map((k) => {
    const m = basic(C["3a4466"]);
    g.add(box(0.62, 0.4, 0.5, m, sgn * COLUMN_X, LAMP_Y(k), z + 0.2));
    return m;
  });
  // the carriage slides up and down the rail; the piston jabs out to the lamp
  const carriage = new THREE.Group();
  carriage.position.set(sgn * ARM_X, LAMP_Y(0), z);
  carriage.add(box(0.62, 0.5, 0.62, std(on === C["2ce8f5"] ? C["0099db"] : C["b55088"], 0.5, 0.3), 0, 0, 0));
  const led = basic(C["181425"]);
  carriage.add(box(0.36, 0.12, 0.02, led, 0, 0.08, 0.32));
  const piston = box(1, 0.18, 0.18, steel, 0, 0, 0);
  carriage.add(piston);
  const claw = new THREE.Group();
  claw.add(box(0.16, 0.46, 0.46, std(C["c0cbdc"], 0.4, 0.5)));
  carriage.add(claw);
  g.add(carriage);
  return { group: g, carriage, piston, claw, led, lamps, on, off: C["3a4466"] };
}

export function buildScene(width: number, height: number): FactoryScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);
  const hemi = new THREE.HemisphereLight(C["c0cbdc"], C["262b44"], 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(C["ffffff"], 0.9);
  key.position.set(5, 12, 9);
  scene.add(key);
  const reactorLight = new THREE.PointLight(C["2ce8f5"], 6, 14, 1.4);
  reactorLight.position.set(0, 2.5, -8.5);
  scene.add(reactorLight);

  // ---- the hall: floor, walls, pipes, ceiling lamps
  scene.add(box(14, 0.2, 30, std(C["262b44"], 0.95), 0, -0.1, -2));
  const line = std(C["3a4466"], 0.9);
  for (let z = -14; z <= 10; z += 2) scene.add(box(14, 0.02, 0.06, line, 0, 0.01, z));
  for (const x of [-4.5, 4.5]) scene.add(box(0.12, 0.03, 30, std(C["feae34"], 0.8), x, 0.02, -2)); // safety lines
  scene.add(box(14, 9, 0.3, std(C["193c3e"], 1), 0, 4.5, -14));
  for (const x of [-6.5, 6.5]) scene.add(box(0.3, 9, 30, std(C["193c3e"], 1), x, 4.5, -2));
  for (const y of [5.6, 6.2]) for (const x of [-6.2, 6.2]) scene.add(cyl(0.16, 30, std(C["5a6988"], 0.5, 0.4), x, y, -2).rotateX(Math.PI / 2));
  const ceiling: THREE.MeshBasicMaterial[] = [];
  for (let z = -12; z <= 8; z += 4) for (const x of [-4, 4]) {
    const m = basic(C["3a4466"]);
    ceiling.push(m);
    scene.add(box(1.4, 0.12, 0.5, m, x, 7.2, z));
  }

  // ---- the belt: a bed, rollers every third of a slot, side rails with light strips
  const bedZ0 = 10, bedZ1 = slotZ(ST.sorter) - 0.6;
  scene.add(box(1.5, BELT_TOP - 0.1, bedZ0 - bedZ1, std(C["3a4466"], 0.8), 0, (BELT_TOP - 0.1) / 2, (bedZ0 + bedZ1) / 2));
  const rollers: THREE.Mesh[] = [];
  const rollerMat = std(C["8b9bb4"], 0.4, 0.6);
  for (let z = bedZ1 + 0.2; z < bedZ0; z += SLOT / 3) {
    const r = cyl(0.09, 1.4, rollerMat, 0, BELT_TOP - 0.06, z, 6);
    r.rotation.z = Math.PI / 2;
    rollers.push(r);
    scene.add(r);
  }
  const rail: THREE.MeshBasicMaterial[] = [];
  for (const x of [-0.82, 0.82]) {
    scene.add(box(0.12, 0.3, bedZ0 - bedZ1, std(C["5a6988"], 0.6, 0.3), x, BELT_TOP + 0.02, (bedZ0 + bedZ1) / 2));
    const m = basic(C["262b44"]);
    rail.push(m);
    scene.add(box(0.13, 0.06, bedZ0 - bedZ1, m, x, BELT_TOP + 0.18, (bedZ0 + bedZ1) / 2));
  }

  // ---- storage along the walls: shelving with stacked crates and barrels (static set dressing)
  const shelf = std(C["5a6988"], 0.6, 0.4), wood = std(C["733e39"], 0.9), barrel = std(C["124e89"], 0.6, 0.3);
  for (const sgn of [-1, 1]) {
    for (let z = -12; z <= 8; z += 3.2) {
      if (z > -9 && z < -6) continue; // keep the hatches clear
      for (const y of [0.05, 1.45, 2.85]) scene.add(box(1.1, 0.1, 2.8, shelf, sgn * 5.4, y, z));
      for (const dz of [-1.35, 1.35]) scene.add(box(0.1, 3.0, 0.1, shelf, sgn * 4.9, 1.5, z + dz));
      for (const [y, dz] of [[0.1, -0.6], [0.1, 0.6], [1.5, 0], [2.9, -0.6]]) scene.add(box(0.9, 0.75, 0.9, wood, sgn * 5.4, y + 0.38, z + dz));
    }
    for (const z of [1.2, -3.6]) for (const dz of [0, 0.75]) scene.add(cyl(0.32, 0.9, barrel, sgn * 4.3, 0.45, z + dz, 10));
  }

  // ---- dispatch hatches (the cooldown sends crates down through the floor at the sides)
  for (const sgn of [-1, 1]) {
    scene.add(box(1.3, 0.03, 1.3, basic(C["181425"]), sgn * 3.4, 0.02, slotZ(ST.sorter) - 0.6));
    scene.add(box(1.5, 0.04, 0.12, std(C["feae34"], 0.8), sgn * 3.4, 0.03, slotZ(ST.sorter) + 0.1));
  }

  // ---- crates
  const crates = Array.from({ length: N_CRATES }, () => {
    const c = buildCrate();
    scene.add(c.root);
    return c;
  });

  // ---- the hydraulic press (amber, hazard stripes)
  const zp = slotZ(ST.press);
  const amber = std(C["f77622"], 0.6, 0.2);
  const steel = std(C["5a6988"], 0.5, 0.5);
  for (const x of [-1.25, 1.25]) {
    scene.add(box(0.4, 3.3, 0.6, amber, x, 1.65, zp - 0.55));
    for (let k = 0; k < 4; k++) scene.add(box(0.42, 0.16, 0.62, std(C["181425"]), x, 0.45 + k * 0.8, zp - 0.55));
  }
  // the crossbeam sits behind the ram, so the camera sees the ram fall onto the crate
  scene.add(box(3.0, 0.6, 0.5, amber, 0, 3.4, zp - 0.75));
  scene.add(box(0.7, 1.5, 0.7, amber, 0, 3.55, zp - 0.2)); // the cylinder housing
  const pressLamp = basic(C["733e39"]);
  scene.add(box(0.5, 0.3, 0.05, pressLamp, 0, 3.9, zp + 0.16));
  const ram = new THREE.Group();
  ram.add(box(1.3, 0.34, 1.2, std(C["8b9bb4"], 0.4, 0.6), 0, 0.17, 0)); // the die
  ram.add(box(1.0, 0.16, 0.9, std(C["feae34"], 0.5), 0, 0.42, 0));
  ram.add(cyl(0.18, 2.0, steel, 0, 1.4, 0, 8)); // the rod, reaching into the housing
  ram.position.set(0, CRATE_TOP + RAM_UP, zp);
  scene.add(ram);

  // ---- the robot arms and their lamp columns
  const armL = buildArm(-1, C["2ce8f5"]);
  const armR = buildArm(1, C["f6757a"]);
  scene.add(armL.group, armR.group);

  // ---- the laser cutter on a gantry
  const zc = slotZ(ST.cutter);
  const red = std(C["a22633"], 0.6, 0.2);
  for (const x of [-1.4, 1.4]) scene.add(box(0.25, 3.4, 0.3, red, x, 1.7, zc));
  scene.add(box(3.05, 0.3, 0.4, red, 0, 3.4, zc));
  scene.add(box(0.5, 0.5, 0.5, std(C["3a4466"], 0.6, 0.3), 0, 3.0, zc));
  const laserHead = basic(C["733e39"]);
  scene.add(box(0.22, 0.12, 0.22, laserHead, 0, 2.72, zc));
  const laser = box(0.07, 2.72 - CRATE_TOP, 0.07, basic(C["ff0044"]), 0, (2.72 + CRATE_TOP) / 2, zc);
  scene.add(laser);

  // ---- the sorter gate and the chutes to the reactor's intakes
  const zs = slotZ(ST.sorter);
  const green = std(C["3e8948"], 0.6, 0.2);
  scene.add(box(0.3, 1.6, 0.3, green, 0, 0.8, zs - 0.6));
  const gate = new THREE.Group();
  gate.position.set(0, BELT_TOP + 0.4, zs - 0.6);
  gate.add(box(0.12, 0.7, 1.5, std(C["63c74d"], 0.5, 0.2), 0, 0, 0.75));
  scene.add(gate);
  const gateLamps = { L: basic(C["265c42"]), R: basic(C["265c42"]) };
  scene.add(box(0.3, 0.3, 0.1, gateLamps.L, -0.4, 1.75, zs - 0.6), box(0.3, 0.3, 0.1, gateLamps.R, 0.4, 1.75, zs - 0.6));
  for (const sgn of [-1, 1]) {
    const dz = zs - 0.6 - INTAKE_Z, dx = INTAKE_X;
    const len = Math.hypot(dz, dx);
    const ch = box(1.2, 0.12, len + 0.6, std(C["5a6988"], 0.6, 0.3), sgn * dx / 2, BELT_TOP - 0.02, (zs - 0.6 + INTAKE_Z) / 2);
    ch.rotation.y = sgn * Math.atan2(dx, dz);
    scene.add(ch);
  }

  // ---- the reactor: base, a cage of bars, a core whose height is the power, a ring of 24 charge lamps, intakes
  const base = std(C["3a4466"], 0.6, 0.4);
  scene.add(cyl(2.5, 0.9, base, REACTOR.x, 0.45, REACTOR.z, 16));
  scene.add(cyl(2.0, 0.3, std(C["5a6988"], 0.5, 0.5), REACTOR.x, 5.6, REACTOR.z, 16));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    scene.add(box(0.14, 4.7, 0.14, std(C["8b9bb4"], 0.4, 0.6), REACTOR.x + Math.cos(a) * 1.9, 3.2, REACTOR.z + Math.sin(a) * 1.9));
  }
  const coreMat = basic(C["124e89"]);
  const core = cyl(1.25, 1, coreMat, REACTOR.x, 0.9, REACTOR.z, 14);
  scene.add(core);
  const coreRim = basic(C["0099db"]);
  scene.add(cyl(1.32, 0.12, coreRim, REACTOR.x, 0.96, REACTOR.z, 14));
  const ring = Array.from({ length: RING }, (_, k) => {
    const m = basic(C["262b44"]);
    const a = Math.PI + (k / RING) * Math.PI * 2; // lamp 0 at the front-left, going round
    scene.add(box(0.26, 0.2, 0.26, m, REACTOR.x + Math.sin(a) * 2.55, 0.95, REACTOR.z - Math.cos(a) * 2.55));
    return m;
  });
  const intakeLamps = [-1, 1].map((sgn) => {
    scene.add(box(1.3, 1.0, 0.9, std(C["5a6988"], 0.6, 0.3), sgn * INTAKE_X, 0.5, INTAKE_Z - 0.3));
    const m = basic(C["265c42"]);
    scene.add(box(0.9, 0.12, 0.05, m, sgn * INTAKE_X, 0.85, INTAKE_Z + 0.16));
    return m;
  });
  // the power beams from the reactor's top to the ceiling (only lit at max power)
  const beams = [-1.2, 0, 1.2].map((x) => {
    const b = box(0.18, 2.2, 0.18, basic(C["2ce8f5"]), REACTOR.x + x, 6.9, REACTOR.z);
    b.visible = false;
    scene.add(b);
    return b;
  });
  // machine status lamps (red until the drop, green when the line locks together)
  const status = [
    [-1.25, 3.4, zp - 0.45], [1.25, 3.4, zp - 0.45], [-ARM_X, 3.55, ARM_Z - 0.2], [ARM_X, 3.55, ARM_Z - 0.2],
    [-1.4, 3.6, zc + 0.2], [1.4, 3.6, zc + 0.2],
  ].map(([x, y, z]) => {
    const m = basic(C["733e39"]);
    scene.add(box(0.2, 0.16, 0.2, m, x, y, z));
    return m;
  });
  return {
    renderer, scene, camera, hemi, key, reactorLight, ram, pressLamp, rollers, rollerMat, rail, crates, arms: { L: armL, R: armR },
    laser, laserHead, gate, gateLamps, core, coreMat, coreRim, ring, intakeLamps, ceiling, beams, status,
  };
}
