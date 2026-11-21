import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";

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

export const MAX_RINGS = 24;
export const MAX_TOWERS = 40;
export const GROUND_TILE = 8; // world units per ground texture repeat (adjusted to the loop in the video)

export type MachScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  jet: THREE.Group;
  burner: THREE.Mesh;
  burnerMat: THREE.MeshBasicMaterial;
  vapor: THREE.Mesh;
  vaporMat: THREE.MeshBasicMaterial;
  ground: THREE.Mesh;
  clouds: THREE.Group;
  rings: THREE.LineLoop[];
  ringMats: THREE.LineBasicMaterial[];
  cone: THREE.Mesh;
  coneMat: THREE.MeshBasicMaterial;
  coneLines: THREE.LineSegments;
  towers: { group: THREE.Group; beacon: THREE.Mesh; beaconMat: THREE.MeshBasicMaterial; wave: THREE.Mesh; waveMat: THREE.MeshBasicMaterial }[];
  burnerLight: THREE.PointLight;
  person: THREE.Group;
};

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, flatShading: true }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A small voxel jet, nose towards -z, 1 unit long (100 m would be far too big; it is drawn 25x its size for legibility). */
function buildJet() {
  const g = new THREE.Group();
  const body = C["c0cbdc"], dark = C["5a6988"], trim = C["e43b44"];
  g.add(box(0.12, 0.11, 0.9, body, 0, 0, 0));
  g.add(box(0.08, 0.08, 0.16, body, 0, -0.01, -0.52));
  g.add(box(0.04, 0.04, 0.08, dark, 0, -0.01, -0.63));
  g.add(box(0.08, 0.06, 0.2, C["2ce8f5"], 0, 0.07, -0.25)); // canopy
  g.add(box(0.9, 0.025, 0.28, body, 0, -0.01, 0.08)); // wings
  g.add(box(0.5, 0.02, 0.12, dark, 0, -0.01, 0.24));
  g.add(box(0.025, 0.22, 0.18, body, 0, 0.13, 0.36)); // fin
  g.add(box(0.36, 0.02, 0.12, body, 0, 0.0, 0.4)); // tailplane
  g.add(box(0.9, 0.03, 0.04, trim, 0, 0.0, -0.04));
  g.add(box(0.1, 0.09, 0.08, C["262b44"], 0, 0, 0.47)); // nozzle
  return g;
}

export function buildScene(width: number, height: number, alt: number): MachScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["262b44"]);
  scene.fog = new THREE.Fog(C["262b44"], 14, 38);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 120);

  scene.add(new THREE.HemisphereLight(C["8b9bb4"], C["265c42"], 1.2));
  const sun = new THREE.DirectionalLight(C["ead4aa"], 1.8);
  sun.position.set(4, 10, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
  scene.add(sun);

  // ground: fields and roads, scrolling under the jet
  const groundTex = tex(64, (g) => {
    const fields = [hex(14), hex(15), hex(14), hex(5), hex(15), hex(13)]; // muted fields: the rings have to read on top
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = fields[(i * 3 + j * 5) % fields.length]; g.fillRect(i * 16, j * 16, 16, 16); }
    g.fillStyle = hex(15); for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
    g.fillStyle = hex(21); g.fillRect(30, 0, 4, 64); // the road under the flight path
    g.fillStyle = hex(11); for (let j = 0; j < 64; j += 8) g.fillRect(31, j, 2, 4);
  }, 10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10 * GROUND_TILE, 10 * GROUND_TILE), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // clouds below and beside the flight level: speed reference
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: C["c0cbdc"], roughness: 1, flatShading: true, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 3);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6 + (k % 2) * 0.4, 0.25, 0.5), cloudMat);
      b.position.set(k * 0.35 - n * 0.17, (k % 2) * 0.12, ((k * 7) % 3) * 0.15);
      c.add(b);
    }
    const side = i % 2 === 0 ? -1 : 1;
    c.position.set(side * (2.5 + ((i * 1.7) % 4)), alt * 0.45 + ((i * 0.37) % 0.4), -i * (GROUND_TILE / 18) * 10 / 10);
    c.userData.z0 = c.position.z;
    clouds.add(c);
  }
  scene.add(clouds);

  // wavefronts: circles in the flight plane, one per 8th note
  const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), 0, Math.sin((i / 96) * Math.PI * 2))));
  const rings: THREE.LineLoop[] = [], ringMats: THREE.LineBasicMaterial[] = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.LineBasicMaterial({ color: C["2ce8f5"] });
    const r = new THREE.LineLoop(circle, mat);
    r.visible = false;
    scene.add(r); rings.push(r); ringMats.push(mat);
  }

  // the Mach cone (shown when supersonic): a translucent cone behind the jet and its two edge lines in the flight plane
  const coneMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), coneMat);
  cone.visible = false;
  scene.add(cone);
  const coneLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: C["fee761"] }));
  coneLines.visible = false;
  scene.add(coneLines);

  // the jet, its afterburner and the vapour cone at Mach 1
  const jet = buildJet();
  jet.position.y = alt;
  scene.add(jet);
  const burnerMat = new THREE.MeshBasicMaterial({ color: C["f77622"] });
  const burner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 8), burnerMat);
  burner.rotation.x = -Math.PI / 2;
  burner.position.set(0, alt, 0.68);
  scene.add(burner);
  const burnerLight = new THREE.PointLight(C["feae34"], 0, 3, 1.5);
  burnerLight.position.set(0, alt, 0.8);
  scene.add(burnerLight);
  const vaporMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const vapor = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 20, 1, true), vaporMat);
  vapor.rotation.x = -Math.PI / 2;
  vapor.position.set(0, alt, 0.05);
  scene.add(vapor);

  // towers: a mast up to flight level with a beacon (lights when its boom arrives) and a ground shock ring
  const towers: MachScene["towers"] = [];
  const mastMat = new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.5, roughness: 0.4 });
  for (let i = 0; i < MAX_TOWERS; i++) {
    const group = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.06, alt, 0.06), mastMat);
    mast.position.y = alt / 2; mast.castShadow = true; group.add(mast);
    for (let k = 1; k < 4; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), mastMat); rung.position.y = (alt * k) / 4; group.add(rung); }
    const beaconMat = new THREE.MeshBasicMaterial({ color: C["3a4466"] });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), beaconMat);
    beacon.position.y = alt; group.add(beacon);
    const waveMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), waveMat);
    wave.rotation.x = -Math.PI / 2; wave.position.y = 0.02; group.add(wave);
    group.visible = false;
    scene.add(group);
    towers.push({ group, beacon, beaconMat, wave, waveMat });
  }

  // the listener: a person on a lookout platform (placed on her tower in the video); not to scale, like the jet
  const person = new THREE.Group();
  const pm = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
  const part = (w: number, h: number, d: number, c: string, x: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pm(c)); m.position.set(x, y, 0); m.castShadow = true; person.add(m); };
  part(0.5, 0.04, 0.5, C["5a6988"], 0, 0.02); // platform
  part(0.05, 0.12, 0.06, C["262b44"], -0.035, 0.1); part(0.05, 0.12, 0.06, C["262b44"], 0.035, 0.1); // legs
  part(0.13, 0.13, 0.08, C["b55088"], 0, 0.22); // jacket
  part(0.035, 0.11, 0.05, C["b55088"], -0.085, 0.22); part(0.035, 0.11, 0.05, C["b55088"], 0.085, 0.22);
  part(0.09, 0.09, 0.09, C["e8b796"], 0, 0.33); // head
  part(0.1, 0.035, 0.1, C["3e2731"], 0, 0.385); // hair
  person.visible = false;
  scene.add(person);

  return { renderer, scene, camera, jet, burner, burnerMat, vapor, vaporMat, ground, clouds, rings, ringMats, cone, coneMat, coneLines, towers, burnerLight, person };
}
