import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";
import timeline from "../../../public/lightning/timeline.json";

// World units are metres. The porch is at the origin on a hill HILL m above the plain; +z runs out toward the
// storm, x to the right, y up. The power line runs along x = lineX with a tower every 343 m.
export type World = {
  sound: number; towerGap: number; towers: number; hill: number; towerH: number; lineX: number; cloudBase: number;
  pole0X: number; pole0Z: number; pole0H: number; deck: number; tree: { x: number; z: number; base: number; top: number };
};
export const WORLD = (timeline as unknown as { world: World }).world;
const Wd = WORLD;

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

/** Ground height at (x, z): the ridge is flat up to its edge at z = 3, then falls away (steep first, then easing
 * out) to the plain by z = 300, so from the deck you look down onto the plain and the power line. */
const EDGE = 22; // the flat top of the ridge runs this far in front of the deck, then the hillside falls to the valley
export function groundY(z: number) {
  if (z < EDGE) return Wd.hill;
  if (z > 300) return 0;
  return Wd.hill * (1 - (z - EDGE) / (300 - EDGE)) ** 2;
}

const RING_N = 240;
function ringGeo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((RING_N + 1) * 2 * 3), 3));
  const idx: number[] = [];
  for (let k = 0; k < RING_N; k++) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  return g;
}
/** A band on the ground between radii r0 and r1 round (cx, cz), draped over the hill. */
export function setRing(m: THREE.Mesh, cx: number, cz: number, r0: number, r1: number) {
  const pos = m.geometry.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k <= RING_N; k++) {
    const a = (k / RING_N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    [r0, r1].forEach((r, j) => {
      const x = cx + c * Math.max(0, r), z = cz + s * Math.max(0, r);
      pos.setXYZ(2 * k + j, x, groundY(z) + 1.5, z);
    });
  }
  pos.needsUpdate = true;
  m.geometry.computeBoundingSphere();
}

export type StormScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight; flash: THREE.DirectionalLight; cloudGlow: THREE.PointLight;
  front: THREE.Mesh; frontMat: THREE.MeshBasicMaterial; tail: THREE.Mesh; tailMat: THREE.MeshBasicMaterial;
  person: THREE.Group;
  towerTops: THREE.Vector3[]; // lamp positions, tower 0 (the pole on the hill) .. 8
};

export function buildScene(width: number, height: number): StormScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["262b44"]); // the far horizon under the cloud
  scene.fog = new THREE.Fog(C["262b44"], 1500, 9000);
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.3, 9000);

  const hemi = new THREE.HemisphereLight(C["c0cbdc"], C["3a4466"], 2.4);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(C["8b9bb4"], 0.35); // what little light gets through the storm
  moon.position.set(-300, 600, -200);
  scene.add(moon);
  const flash = new THREE.DirectionalLight(C["ffffff"], 0); // the bolt lighting the whole land
  scene.add(flash, flash.target);
  const cloudGlow = new THREE.PointLight(C["c0cbdc"], 0, 0, 0); // the bolt lighting the cloud from below
  scene.add(cloudGlow);

  // ---------------------------------------------------------------- land: the hill, its slope, the plain
  const grass = tex(32, (g) => {
    g.fillStyle = hex(14); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(15); for (let y = 0; y < 32; y += 4) for (let x = (y * 3) % 7; x < 32; x += 7) g.fillRect(x, y, 2, 1);
  }, 1, 1);
  const landGeo = new THREE.PlaneGeometry(9000, 9000, 1, 160);
  landGeo.rotateX(-Math.PI / 2);
  // move rows of vertices so the plane follows the hill profile in z (z runs -4500..4500)
  const pos = landGeo.attributes.position as THREE.BufferAttribute;
  const zs = new Set<number>();
  for (let i = 0; i < pos.count; i++) zs.add(pos.getZ(i));
  // a denser profile near the hill: rebuild z rows non-uniformly
  const rows = [...zs].sort((a, b) => a - b);
  const remap = (k: number) => {
    const u = k / (rows.length - 1); // 0..1
    if (u < 0.1) return -4500 + (u / 0.1) * 4440; // behind the deck
    if (u < 0.6) return -60 + ((u - 0.1) / 0.5) * 400; // the ridge and its slope, fine steps
    return 340 + ((u - 0.6) / 0.4) * 8000;
  };
  for (let i = 0; i < pos.count; i++) {
    const k = rows.indexOf(pos.getZ(i));
    const z = remap(k);
    pos.setZ(i, z);
    pos.setY(i, groundY(z));
  }
  landGeo.computeVertexNormals();
  const uv = landGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 12, pos.getZ(i) / 12);
  const land = new THREE.Mesh(landGeo, new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  scene.add(land);

  // ---------------------------------------------------------------- the storm cloud: a low, lumpy ceiling
  const cloudTex = tex(64, (g) => {
    g.fillStyle = hex(23); g.fillRect(0, 0, 64, 64);
    g.fillStyle = hex(22);
    for (let k = 0; k < 40; k++) { const x = (k * 37) % 64, y = (k * 23) % 64, r = 4 + (k % 5) * 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = hex(24);
    for (let k = 0; k < 30; k++) { const x = (k * 53 + 11) % 64, y = (k * 29 + 7) % 64, r = 3 + (k % 4) * 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  }, 1, 1);
  const cloudGeo = new THREE.PlaneGeometry(12000, 12000);
  cloudGeo.rotateX(Math.PI / 2);
  const cuv = cloudGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 14, cuv.getY(i) * 14);
  const cloud = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({ map: cloudTex, roughness: 1, side: THREE.DoubleSide }));
  cloud.position.y = Wd.cloudBase;
  scene.add(cloud);

  // ---------------------------------------------------------------- the power line: a short pole on the crest, then 8 towers
  // light steel, so a tower kilometres away still reads as a tower against the dark valley, not only its lamp
  const steel = new THREE.MeshStandardMaterial({ color: C["8b9bb4"], roughness: 0.7 });
  const towerTops: THREE.Vector3[] = [];
  for (let k = 0; k <= Wd.towers; k++) {
    const z = k === 0 ? Wd.pole0Z : k * Wd.towerGap, base = groundY(z), h = k === 0 ? Wd.pole0H : Wd.towerH, x = k === 0 ? Wd.pole0X : Wd.lineX;
    const g = new THREE.Group();
    if (k === 0) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h, 6), new THREE.MeshStandardMaterial({ color: C["5a6988"], roughness: 0.9 }));
      pole.position.y = h / 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.3), pole.material);
      arm.position.y = h - 1.5;
      g.add(pole, arm);
    } else {
      // a lattice tower, read as a tapered body with two cross arms
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 4.5, h, 4), steel);
      body.position.y = h / 2;
      body.rotation.y = Math.PI / 4;
      const arm1 = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 1.2), steel);
      arm1.position.y = h * 0.78;
      const arm2 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 1.2), steel);
      arm2.position.y = h * 0.6;
      g.add(body, arm1, arm2);
    }
    g.position.set(x, base, z);
    scene.add(g);
    towerTops.push(new THREE.Vector3(x, base + h + 0.6, z));
  }

  // ---------------------------------------------------------------- the old tree on the cliff edge, left of the deck
  const bark = new THREE.MeshStandardMaterial({ color: C["3e2731"], roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: C["193c3e"], roughness: 1 });
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 8, 5), bark);
  trunk.position.y = 4;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 0), leaf);
  crown.position.y = 10; crown.scale.set(1, 1.1, 1);
  tree.add(trunk, crown);
  tree.position.set(Wd.tree.x, Wd.hill, Wd.tree.z);
  tree.scale.setScalar((Wd.tree.top - Wd.hill) / 14);
  scene.add(tree);

  // ---------------------------------------------------------------- the deck and the listener (from behind)
  const plank = tex(16, (g) => { g.fillStyle = hex(5); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(6); g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); }, 3, 3);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 5), new THREE.MeshStandardMaterial({ map: plank, roughness: 0.9 }));
  deck.position.set(0, Wd.hill + Wd.deck - 0.15, 0.5);
  scene.add(deck);
  const dark = new THREE.MeshStandardMaterial({ color: C["181425"], roughness: 1 });
  const coat = new THREE.MeshStandardMaterial({ color: C["124e89"], roughness: 1 });
  // a person in a rain coat, from behind: two legs, a coat with shoulders and arms, a hooded head
  const person = new THREE.Group();
  for (const sx of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.62, 3, 8), dark);
    leg.position.set(sx, 0.42, 0);
    person.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 4, 10), coat);
  torso.position.y = 1.12; torso.scale.set(1.05, 1, 0.7);
  person.add(torso);
  for (const sx of [-0.27, 0.27]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 3, 8), coat);
    arm.position.set(sx, 1.1, 0); arm.rotation.z = sx > 0 ? 0.12 : -0.12;
    person.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), dark);
  head.position.y = 1.62;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), coat);
  hood.position.y = 1.64;
  person.add(head, hood);
  person.position.set(0.9, Wd.hill + Wd.deck, 2.5);
  scene.add(person);

  // ---------------------------------------------------------------- the thunder: a bright edge and its rumble behind it
  const frontMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const front = new THREE.Mesh(ringGeo(), frontMat);
  scene.add(front);
  const tailMat = new THREE.MeshBasicMaterial({ color: C["8b9bb4"], transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const tail = new THREE.Mesh(ringGeo(), tailMat);
  scene.add(tail);

  return { renderer, scene, camera, hemi, flash, cloudGlow, front, frontMat, tail, tailMat, person, towerTops };
}
