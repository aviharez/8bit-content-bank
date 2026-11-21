import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";
import { ANIMAL_SPRITES, Sprite } from "./sprites";

const hex = (i: number) => `#${PALETTE[i]}`;

function tex(size: number, paint: (g: CanvasRenderingContext2D) => void, rx = 1, ry = rx) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- rig geometry (rig units; the rig is scaled per animal)
export const HEART_Y = 5.2; // centre of the heart
export const HEART_R = 1.15; // half-size of the voxel heart
/** The vessel loop: out of the top of the heart, round the animal on its pedestal, back into the heart. */
export const VESSEL = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.25, HEART_Y + 1.0, 0),
  new THREE.Vector3(1.4, HEART_Y + 2.3, 0.3),
  new THREE.Vector3(3.0, HEART_Y + 1.4, 0.8),
  new THREE.Vector3(3.4, HEART_Y - 1.6, 1.2),
  new THREE.Vector3(2.9, 1.2, 1.9),
  new THREE.Vector3(1.2, 0.75, 2.9),
  new THREE.Vector3(-1.2, 0.75, 2.9),
  new THREE.Vector3(-2.9, 1.2, 1.9),
  new THREE.Vector3(-3.4, HEART_Y - 1.6, 1.2),
  new THREE.Vector3(-3.0, HEART_Y + 1.4, 0.8),
  new THREE.Vector3(-1.4, HEART_Y + 2.3, 0.3),
  new THREE.Vector3(-0.25, HEART_Y + 1.0, 0),
], false, "catmullrom", 0.4);
export const MAX_BOLUS = 64;
export const BOLUS_PARTS = 4;

export type HeartScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: THREE.Group;
  heart: THREE.Group;
  heartMat: THREE.MeshStandardMaterial;
  heartLight: THREE.PointLight;
  roomLight: THREE.PointLight;
  turntable: THREE.Group;
  animals: Record<string, THREE.Group>;
  bolus: THREE.InstancedMesh;
  vesselMat: THREE.MeshStandardMaterial;
};

/** Voxel model extruded from a pixel sprite: body pixels full depth, shade pixels narrower, eyes on both faces. */
function voxelAnimal(s: Sprite, maxW: number, maxH: number): THREE.Group {
  const rows = s.rows, cols = rows[0].length;
  const v = Math.min(maxW / cols, maxH / rows.length);
  const depth = Math.max(3, Math.round(cols / 5));
  const geo = new THREE.BoxGeometry(v, v, v);
  const cells: { x: number; y: number; z: number; c: string }[] = [];
  rows.forEach((row, j) => {
    for (let i = 0; i < cols; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      const d = ch === "-" ? Math.max(1, depth - 2) : depth;
      for (let k = 0; k < d; k++) {
        const face = k === 0 || k === d - 1;
        cells.push({ x: i, y: rows.length - 1 - j, z: k - (d - 1) / 2, c: ch === "o" ? (face ? s.eye : s.body) : ch === "-" ? s.shade : s.body });
      }
    }
  });
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 }), cells.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach((c, i) => {
    m.makeTranslation((c.x - (cols - 1) / 2) * v, c.y * v + v / 2, c.z * v);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.set(c.c));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** Voxel heart from the classic implicit heart surface, highlight on the upper left. */
function voxelHeart(): { group: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const N = 16, v = (2 * HEART_R) / N;
  const geo = new THREE.BoxGeometry(v, v, v);
  const pts: { p: THREE.Vector3; c: string }[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const x = ((i + 0.5) / N) * 2.6 - 1.3, y = ((j + 0.5) / N) * 2.6 - 1.45, z = ((k + 0.5) / N) * 2.6 - 1.3;
    // (x^2 + 9/4 z^2 + y^2 - 1)^3 - x^2 y^3 - 9/80 z^2 y^3 <= 0, y up
    const a = x * x + 2.25 * z * z * 1.6 + y * y - 1;
    if (a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y > 0) continue;
    const hi = x < -0.35 && y > 0.45 && z > 0.1;
    const low = y < -0.45;
    pts.push({ p: new THREE.Vector3((i - N / 2 + 0.5) * v, (j - N / 2 + 0.5) * v, (k - N / 2 + 0.5) * v), c: hi ? hex(29) : low ? hex(7) : hex(8) });
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1, emissive: new THREE.Color(C["e43b44"]), emissiveIntensity: 0.15 });
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  pts.forEach((q, i) => { m.makeTranslation(q.p.x, q.p.y, q.p.z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.set(q.c)); });
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // the great vessels on top
  const vmat = new THREE.MeshStandardMaterial({ color: C["be4a2f"], roughness: 0.6 });
  for (const [x, h] of [[0.25, 0.7], [-0.3, 0.55]] as const) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.32), vmat);
    tube.position.set(x, HEART_R * 0.75 + h / 2, -0.1);
    group.add(tube);
  }
  return { group, mat };
}

export function buildScene(width: number, height: number): HeartScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  scene.fog = new THREE.Fog(C["181425"], 18, 60);
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.02, 200);

  scene.add(new THREE.HemisphereLight(C["5a6988"], C["181425"], 1.2));
  const key = new THREE.DirectionalLight(C["ead4aa"], 1.6);
  key.position.set(6, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 14, bottom: -4, near: 0.5, far: 50 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(C["2ce8f5"], 0.9);
  rim.position.set(-6, 4, -10);
  scene.add(rim);
  // the room's red light: it only comes on when the heart beats
  const roomLight = new THREE.PointLight(C["ff0044"], 0, 80, 1.2);
  scene.add(roomLight);

  // ---------------------------------------------------------------- the room (fixed size: it is the scale reference)
  const floorTex = tex(32, (g) => {
    g.fillStyle = hex(24); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(23); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
    g.fillStyle = hex(25); g.fillRect(16, 0, 1, 32); g.fillRect(0, 16, 32, 1);
    g.fillStyle = hex(22); g.fillRect(2, 2, 2, 2); g.fillRect(28, 28, 2, 2);
  }, 60, 60);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallTex = tex(32, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 32, 32); g.fillStyle = hex(24); g.fillRect(1, 1, 30, 30);
    g.fillStyle = hex(16); g.fillRect(5, 6, 8, 3); g.fillRect(19, 20, 8, 3);
    g.fillStyle = hex(23); g.fillRect(1, 15, 30, 1);
  }, 30, 8);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(240, 64), new THREE.MeshStandardMaterial({ map: wallTex, emissiveMap: wallTex, emissive: new THREE.Color(C["124e89"]), emissiveIntensity: 0.5, roughness: 1 }));
  wall.position.set(0, 32, -22);
  scene.add(wall);
  // pillars with lamps: a fixed yardstick as the camera shrinks
  const pillarMat = new THREE.MeshStandardMaterial({ color: C["3a4466"], roughness: 0.7, metalness: 0.3 });
  const lampMat = new THREE.MeshBasicMaterial({ color: C["fee761"] });
  for (const x of [-16, -8, 8, 16]) for (const z of [-10, -18]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 1), pillarMat);
    p.position.set(x, 15, z); p.castShadow = p.receiveShadow = true; scene.add(p);
    for (let y = 2; y < 30; y += 6) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.25, 1.05), lampMat); l.position.set(x, y, z); scene.add(l); }
  }
  // hazard stripe ring on the floor around the stage
  const hazard = tex(16, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(10);
    for (let i = -16; i < 32; i += 8) { g.beginPath(); g.moveTo(i, 16); g.lineTo(i + 4, 16); g.lineTo(i + 20, 0); g.lineTo(i + 16, 0); g.fill(); }
  }, 24, 1);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.5, 48), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);

  // ---------------------------------------------------------------- the rig: pedestal, animal, heart, vessel loop
  const rig = new THREE.Group();
  scene.add(rig);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 16), new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 0.6, metalness: 0.4 }));
  pedestal.position.y = 0.25; pedestal.castShadow = pedestal.receiveShadow = true; rig.add(pedestal);
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.06, 4, 32), new THREE.MeshBasicMaterial({ color: C["2ce8f5"] }));
  pedRing.rotation.x = Math.PI / 2; pedRing.position.y = 0.5; rig.add(pedRing);

  const turntable = new THREE.Group();
  turntable.position.y = 0.5;
  rig.add(turntable);
  const animals: Record<string, THREE.Group> = {};
  for (const [id, s] of Object.entries(ANIMAL_SPRITES)) {
    const g = voxelAnimal(s, 4.2, 3.0);
    g.visible = false;
    turntable.add(g);
    animals[id] = g;
  }

  const { group: heart, mat: heartMat } = voxelHeart();
  heart.position.y = HEART_Y;
  rig.add(heart);
  const heartLight = new THREE.PointLight(C["ff0044"], 0, 14, 1.4);
  heartLight.position.set(0, HEART_Y, 1.6);
  rig.add(heartLight);

  const vesselMat = new THREE.MeshStandardMaterial({ color: C["3a4466"], roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(C["733e39"]), emissiveIntensity: 0.2 });
  const vessel = new THREE.Mesh(new THREE.TubeGeometry(VESSEL, 160, 0.2, 6, false), vesselMat);
  vessel.castShadow = true;
  rig.add(vessel);
  const bolus = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), new THREE.MeshBasicMaterial({ color: C["ffffff"] }), MAX_BOLUS * BOLUS_PARTS);
  bolus.count = 0;
  rig.add(bolus);

  return { renderer, scene, camera, rig, heart, heartMat, heartLight, roomLight, turntable, animals, bolus, vesselMat };
}
