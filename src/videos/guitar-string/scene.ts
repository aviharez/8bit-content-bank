import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";

// World units: 1 = 1 cm. A guitar and a bass lie face up on a wooden table (y = 0), side by side, necks pointing
// away from the camera (-z). The guitar's bridge saddle sits at z = 0, its nut at z = -64.8 (a 64.8 cm scale); the
// bass's bridge at z = 8, its nut at z = -78.4 (86.4 cm). The strings swing sideways (along x), as a plucked string
// mostly does.

export type Inst = {
  L: number; bridgeZ: number; xb: number[]; xn: number[]; yb: number; yn: number; beta: number;
};
const spread = (cx: number, n: number, gap: number) => Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap);
// guitar strings 1 (high E) .. 6 (low E); the low side faces the bass (+x)
export const GTR: Inst = { L: 64.8, bridgeZ: 0, xb: spread(0, 6, 1.08), xn: spread(0, 6, 0.72), yb: 11.4, yn: 11.05, beta: 0.154 };
export const BASS_X = 36;
// bass strings 1 (G) .. 4 (low E)
export const BASS: Inst = { L: 86.4, bridgeZ: 8, xb: spread(BASS_X, 4, 1.9), xn: spread(BASS_X, 4, 1.0), yb: 6.5, yn: 6.1, beta: 0.18 };
export const GTR_TOP = 10, BASS_TOP = 4.5;
export const SOUNDHOLE = new THREE.Vector3(0, GTR_TOP, -12);
export const SOUNDHOLE_R = 5;

/** A point on string i (1-based) at u = 0 (bridge) .. 1 (nut), pushed sideways by dx. */
export function stringPoint(inst: Inst, i: number, u: number, dx = 0, out = new THREE.Vector3()) {
  return out.set(inst.xb[i - 1] + (inst.xn[i - 1] - inst.xb[i - 1]) * u + dx, inst.yb + (inst.yn - inst.yb) * u, inst.bridgeZ - inst.L * u);
}
/** u of fret n, measured from the bridge: the free part of the string is L 2^(-n/12). */
export const fretU = (n: number) => Math.pow(2, -n / 12);
export const NP = 129; // points per string

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
const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...o });
function box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = b.receiveShadow = true;
  return b;
}

/** A figure-8 body outline: two bouts joined by a waist. z runs from zTail (near the camera) to zTop. */
function bodyShape(cx: number, lower: { z: number; r: number }, upper: { z: number; r: number }, waist: number, hole?: { z: number; r: number }) {
  const zTail = lower.z + lower.r, zTop = upper.z - upper.r;
  const N = 48;
  const hw = (z: number) => {
    const a = Math.abs(z - lower.z) < lower.r ? Math.sqrt(lower.r ** 2 - (z - lower.z) ** 2) : 0;
    const b = Math.abs(z - upper.z) < upper.r ? Math.sqrt(upper.r ** 2 - (z - upper.z) ** 2) : 0;
    const w = z < lower.z && z > upper.z ? waist : 0;
    return Math.max(a, b, w);
  };
  const right: THREE.Vector2[] = [], left: THREE.Vector2[] = [];
  for (let k = 0; k <= N; k++) {
    // cosine spacing so the round ends keep their shape
    const t = (1 - Math.cos((Math.PI * k) / N)) / 2;
    const z = zTail + (zTop - zTail) * t;
    const w = hw(z);
    right.push(new THREE.Vector2(cx + w, -z));
    left.push(new THREE.Vector2(cx - w, -z));
  }
  const s = new THREE.Shape([...right, ...left.reverse()]);
  if (hole) {
    const p = new THREE.Path();
    p.absarc(cx, -hole.z, hole.r, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return s;
}
function extrude(shape: THREE.Shape, depth: number, top: THREE.Material, side: THREE.Material, y0: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const m = new THREE.Mesh(g, [top, side]);
  m.rotation.x = -Math.PI / 2; // shape (x, y) -> world (x, 0, -y); the extrusion goes up (+y)
  m.position.y = y0;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export type StringViz = {
  line: THREE.Line; lineMat: THREE.LineBasicMaterial; pos: Float32Array;
  ribbon: THREE.Mesh; ribbonMat: THREE.MeshBasicMaterial; rpos: Float32Array;
  spark: THREE.Mesh; sparkMat: THREE.MeshBasicMaterial;
};
export type GuitarScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  gtr: StringViz[]; bass: StringViz[]; ghosts: { line: THREE.Mesh; pos: Float32Array; mat: THREE.MeshBasicMaterial }[];
  fingers: THREE.InstancedMesh; touch: THREE.Mesh[]; topMat: THREE.MeshStandardMaterial;
  rings: { line: THREE.LineLoop; mat: THREE.LineBasicMaterial }[]; fretMats: THREE.MeshStandardMaterial[];
};
export const MAX_FINGERS = 16, RINGS = 8, GHOSTS = [1, 2, 4];

function stringViz(scene: THREE.Scene, color: string) {
  const pos = new Float32Array(NP * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(g, lineMat);
  line.frustumCulled = false;
  scene.add(line);
  const rpos = new Float32Array(NP * 2 * 3);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
  const idx: number[] = [];
  for (let k = 0; k < NP - 1; k++) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
  rg.setIndex(idx);
  const ribbonMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const ribbon = new THREE.Mesh(rg, ribbonMat);
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  const sparkMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 1, depthWrite: false });
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), sparkMat);
  spark.visible = false;
  scene.add(spark);
  return { line, lineMat, pos, ribbon, ribbonMat, rpos, spark, sparkMat };
}

export function buildScene(width: number, height: number): GuitarScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1500);

  scene.add(new THREE.HemisphereLight(C["8b9bb4"], C["3e2731"], 0.55));
  const lamp = new THREE.SpotLight(C["ead4aa"], 15000, 500, 0.8, 0.55, 1.5);
  lamp.position.set(-45, 150, 30);
  lamp.target.position.set(20, 0, -30);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.camera.near = 40; lamp.shadow.camera.far = 400;
  scene.add(lamp, lamp.target);
  const rim = new THREE.DirectionalLight(C["0099db"], 0.7);
  rim.position.set(120, 60, -120);
  scene.add(rim);

  // ---------------------------------------------------------------- the room: a wooden table, a rug-dark floor, a wall
  const wood = tex(32, (g) => {
    g.fillStyle = hex(4); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(5); for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    g.fillStyle = hex(31); for (let x = 3; x < 32; x += 8) g.fillRect(x, (x * 5) % 24, 1, 9);
  }, 8, 8);
  const table = box(260, 4, 240, [mat(C["733e39"]), mat(C["733e39"]), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.9 }), mat(C["733e39"]), mat(C["733e39"]), mat(C["733e39"])], 20, -2, -40);
  scene.add(table);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat(C["262b44"], { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(20, -76, -40);
  floor.receiveShadow = true;
  scene.add(floor);
  const wallTex = tex(16, (g) => { g.fillStyle = hex(24); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(23); g.fillRect(0, 0, 1, 16); }, 60, 16);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  wall.position.set(20, 150, -200);
  scene.add(wall);
  // props on the table: a mug, a notebook, a tin of picks
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.0, 9.5, 16), mat(C["124e89"], { roughness: 0.5 }));
  mug.position.set(-34, 4.75, -96);
  mug.castShadow = true;
  scene.add(mug);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(3.8, 16), mat(C["3e2731"], { roughness: 0.3 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.set(-34, 9, -96);
  scene.add(coffee);
  const book = box(21, 1.6, 29, mat(C["3e8948"]), -40, 0.8, 14);
  book.rotation.y = 0.25;
  scene.add(book);
  scene.add(box(19.5, 1.7, 27.5, mat(C["ead4aa"]), -39.4, 0.8, 14.2));
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1.4, 20), mat(C["c0cbdc"], { metalness: 0.5, roughness: 0.4 }));
  tin.position.set(64, 0.7, -16);
  scene.add(tin);
  for (const [x, z, c] of [[66, 6, "fee761"], [61, 10, "e43b44"]] as const) {
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.15, 3), mat(C[c]));
    pick.position.set(x, 0.1, z);
    scene.add(pick);
  }

  // ---------------------------------------------------------------- the guitar (acoustic)
  const spruce = tex(16, (g) => {
    g.fillStyle = hex(3); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(2); for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  }, 1, 1);
  spruce.repeat.set(0.25, 0.25);
  const topMat = new THREE.MeshStandardMaterial({ map: spruce, roughness: 0.75, emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0 });
  const gBody = bodyShape(0, { z: 8, r: 19 }, { z: -19, r: 13.5 }, 11.5, { z: SOUNDHOLE.z, r: SOUNDHOLE_R });
  scene.add(extrude(gBody, GTR_TOP, topMat, mat(C["b86f50"]), 0));
  // inside the sound hole: the dark of the box
  const inside = new THREE.Mesh(new THREE.CircleGeometry(SOUNDHOLE_R, 24), mat(C["181425"], { roughness: 1 }));
  inside.rotation.x = -Math.PI / 2; inside.position.set(0, 1.5, SOUNDHOLE.z);
  scene.add(inside);
  const rosette = new THREE.Mesh(new THREE.RingGeometry(SOUNDHOLE_R + 0.3, SOUNDHOLE_R + 1.1, 32), mat(C["3e2731"]));
  rosette.rotation.x = -Math.PI / 2; rosette.position.set(0, GTR_TOP + 0.02, SOUNDHOLE.z);
  scene.add(rosette);
  // bridge and saddle
  scene.add(box(15, 0.8, 3.2, mat(C["3e2731"], { roughness: 0.5 }), 0, GTR_TOP + 0.4, 1.0));
  scene.add(box(7.4, 0.9, 0.3, mat(C["ead4aa"]), 0, GTR_TOP + 0.9, 0));
  for (const x of GTR.xb) scene.add(box(0.45, 0.4, 0.45, mat(C["ffffff"]), x, GTR_TOP + 0.95, 1.6));
  // neck, fretboard, frets, inlays, nut, headstock
  scene.add(box(4.8, 2.6, 38, mat(C["733e39"]), 0, GTR_TOP - 1.0, -64.8 + 19));
  scene.add(box(5.4, 0.45, 48.2, mat(C["3e2731"], { roughness: 0.6 }), 0, GTR_TOP + 0.4, -64.8 + 24.1));
  const fretMats: THREE.MeshStandardMaterial[] = [];
  for (let n = 1; n <= 20; n++) {
    const fm = mat(C["c0cbdc"], { metalness: 0.6, roughness: 0.35, emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0 });
    fretMats.push(fm);
    scene.add(box(5.4, 0.22, 0.18, fm, 0, GTR_TOP + 0.7, GTR.bridgeZ - GTR.L * fretU(n)));
  }
  for (const n of [3, 5, 7, 9, 12, 15, 17]) {
    const z = GTR.bridgeZ - GTR.L * (fretU(n) + fretU(n - 1)) / 2;
    for (const x of n === 12 ? [-1.2, 1.2] : [0]) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.32, 8), mat(C["ead4aa"]));
      dot.rotation.x = -Math.PI / 2; dot.position.set(x, GTR_TOP + 0.64, z);
      scene.add(dot);
    }
  }
  scene.add(box(5.0, 0.7, 0.5, mat(C["ead4aa"]), 0, GTR_TOP + 0.75, -GTR.L - 0.2));
  const head = box(8, 1.5, 18, mat(C["3e2731"], { roughness: 0.5 }), 0, GTR_TOP - 0.4, -GTR.L - 9.6);
  scene.add(head);
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.2, 8), mat(C["c0cbdc"], { metalness: 0.6 }));
    peg.rotation.z = Math.PI / 2;
    peg.position.set(s * 5.4, GTR_TOP - 0.2, -GTR.L - 4 - k * 4.4);
    scene.add(peg);
    scene.add(box(1.6, 0.7, 2.2, mat(C["ead4aa"]), s * 7.6, GTR_TOP - 0.2, -GTR.L - 4 - k * 4.4));
  }

  // ---------------------------------------------------------------- the bass (solid body)
  const bBody = bodyShape(BASS_X, { z: 12, r: 16.5 }, { z: -9, r: 12.5 }, 11);
  scene.add(extrude(bBody, BASS_TOP, mat(C["a22633"], { roughness: 0.45 }), mat(C["733e39"]), 0));
  const guard = new THREE.Mesh(new THREE.ShapeGeometry(bodyShape(BASS_X - 4, { z: 10, r: 10 }, { z: -5, r: 8 }, 7)), mat(C["ffffff"], { roughness: 0.5 }));
  guard.rotation.x = -Math.PI / 2; guard.position.y = BASS_TOP + 0.03;
  scene.add(guard);
  scene.add(box(9.5, 0.9, 2.2, mat(C["181425"], { roughness: 0.4 }), BASS_X, BASS_TOP + 0.45, -8)); // the pickup
  scene.add(box(9, 0.8, 4, mat(C["c0cbdc"], { metalness: 0.7, roughness: 0.3 }), BASS_X, BASS_TOP + 0.4, BASS.bridgeZ + 1.2));
  const bNeckLen = BASS.L - (BASS.bridgeZ + 21);
  scene.add(box(5.2, 1.6, BASS.L - 30, mat(C["e4a672"]), BASS_X, BASS_TOP + 0.3, BASS.bridgeZ - BASS.L + (BASS.L - 30) / 2));
  scene.add(box(5.8, 0.4, bNeckLen + 2, mat(C["3e2731"], { roughness: 0.6 }), BASS_X, BASS_TOP + 1.25, BASS.bridgeZ - BASS.L + bNeckLen / 2 + 1));
  for (let n = 1; n <= 20; n++) scene.add(box(5.8, 0.2, 0.2, mat(C["c0cbdc"], { metalness: 0.6, roughness: 0.35 }), BASS_X, BASS_TOP + 1.5, BASS.bridgeZ - BASS.L * fretU(n)));
  for (const n of [3, 5, 7, 9, 12, 15, 17]) {
    const z = BASS.bridgeZ - BASS.L * (fretU(n) + fretU(n - 1)) / 2;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), mat(C["ffffff"]));
    dot.rotation.x = -Math.PI / 2; dot.position.set(BASS_X, BASS_TOP + 1.46, z);
    scene.add(dot);
  }
  scene.add(box(5.8, 0.6, 0.5, mat(C["ead4aa"]), BASS_X, BASS_TOP + 1.6, BASS.bridgeZ - BASS.L - 0.2));
  scene.add(box(8, 1.4, 19, mat(C["e4a672"]), BASS_X + 1, BASS_TOP + 0.2, BASS.bridgeZ - BASS.L - 10));
  for (let k = 0; k < 4; k++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), mat(C["c0cbdc"], { metalness: 0.6 }));
    peg.position.set(BASS_X + 3.2, BASS_TOP + 1.4, BASS.bridgeZ - BASS.L - 4 - k * 4.2);
    scene.add(peg);
  }

  // ---------------------------------------------------------------- strings (moving lines + their swing blur)
  const gtr = [1, 2, 3, 4, 5, 6].map((i) => stringViz(scene, i <= 3 ? C["c0cbdc"] : C["feae34"]));
  const bass = [1, 2, 3, 4].map(() => stringViz(scene, C["c0cbdc"]));
  // the low string's loops, drawn above it in the drop
  const ghostCol = [C["2ce8f5"], C["f77622"], C["b55088"]];
  const ghosts = GHOSTS.map((_, k) => {
    const pos = new Float32Array(NP * 2 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const idx: number[] = [];
    for (let j = 0; j < NP - 1; j++) idx.push(2 * j, 2 * j + 1, 2 * j + 2, 2 * j + 1, 2 * j + 3, 2 * j + 2);
    g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: ghostCol[k], side: THREE.DoubleSide });
    const line = new THREE.Mesh(g, m);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    return { line, pos, mat: m };
  });
  // fingertips pressing the frets, and the light touch of a harmonic
  const fingers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 6), mat(C["e8b796"], { roughness: 0.7 }), MAX_FINGERS);
  fingers.count = 0;
  fingers.castShadow = true;
  scene.add(fingers);
  const touch = [0, 1].map(() => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: C["ffffff"] }));
    t.rotation.x = -Math.PI / 2;
    t.visible = false;
    scene.add(t);
    return t;
  });
  // rings of air leaving the sound hole
  const rings = Array.from({ length: RINGS }, () => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 40; k++) pts.push(new THREE.Vector3(Math.cos((2 * Math.PI * k) / 40), 0, Math.sin((2 * Math.PI * k) / 40)));
    const m = new THREE.LineBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 1 });
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
    line.visible = false;
    scene.add(line);
    return { line, mat: m };
  });

  return { renderer, scene, camera, gtr, bass, ghosts, fingers, touch, topMat, rings, fretMats };
}
