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

// ---------------------------------------------------------------- the counter: a tower of 8 lamps, 1 at the bottom, 128 at the top
export const LAMPS = 8;
export const LAMP_Y0 = 1.3; // centre of the "1" lamp
export const LAMP_DY = 1.15; // spacing
export const LAMP_R = 0.42;
export const LAMP_Z = 0.62; // front face of the tower
export const lampY = (k: number) => LAMP_Y0 + k * LAMP_DY;
export const TOWER_TOP = lampY(LAMPS - 1) + 0.9;
/** Each lamp's colour: cool at the bottom, red at the top (128 turns the room red). */
export const LAMP_COLOR = ["2ce8f5", "0099db", "63c74d", "fee761", "feae34", "f77622", "b55088", "ff0044"] as const;

export type BitsScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lampMats: THREE.MeshStandardMaterial[];
  lampLights: THREE.PointLight[];
  switches: THREE.Group[];
  ring: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  carry: THREE.Mesh;
  carryMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
};

export function buildScene(width: number, height: number): BitsScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  scene.fog = new THREE.Fog(C["181425"], 22, 70);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

  scene.add(new THREE.HemisphereLight(C["5a6988"], C["181425"], 1.3));
  const key = new THREE.DirectionalLight(C["c0cbdc"], 0.7);
  key.position.set(5, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 14, bottom: -2, near: 0.5, far: 50 });
  scene.add(key);

  // ---------------------------------------------------------------- the room: a dark machine room
  const floorTex = tex(32, (g) => {
    g.fillStyle = hex(24); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(23); g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
    g.fillStyle = hex(25); g.fillRect(16, 0, 1, 32); g.fillRect(0, 16, 32, 1);
  }, 50, 50);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // back wall of machine cabinets, with small idle status lights
  const wallTex = tex(32, (g) => {
    g.fillStyle = hex(24); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(23); g.fillRect(1, 1, 14, 30); g.fillRect(17, 1, 14, 30);
    g.fillStyle = hex(25); g.fillRect(3, 4, 10, 1); g.fillRect(3, 8, 10, 1); g.fillRect(19, 4, 10, 1); g.fillRect(19, 8, 10, 1);
    g.fillStyle = hex(22); for (let y = 14; y < 30; y += 3) { g.fillRect(3, y, 10, 1); g.fillRect(19, y, 10, 1); }
    g.fillStyle = hex(13); g.fillRect(12, 4, 1, 1); g.fillStyle = hex(16); g.fillRect(28, 8, 1, 1);
  }, 14, 3);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(64, 14), wallMat);
  wall.position.set(0, 7, -9);
  wall.receiveShadow = true;
  scene.add(wall);
  for (const s of [-1, 1]) { // side rows of cabinets, angled in
    const side = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallMat);
    side.position.set(s * 14, 7, 6);
    side.rotation.y = -s * Math.PI / 2;
    scene.add(side);
  }

  // ---------------------------------------------------------------- the tower
  const metal = new THREE.MeshStandardMaterial({ color: C["3a4466"], roughness: 0.55, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 0.7, metalness: 0.3 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, TOWER_TOP, 1.2), metal);
  tower.position.set(0, TOWER_TOP / 2, 0);
  tower.castShadow = tower.receiveShadow = true;
  scene.add(tower);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.0), dark);
  plinth.position.set(0, 0.15, 0);
  scene.add(plinth);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.25, 1.5), dark);
  cap.position.set(0, TOWER_TOP + 0.12, 0);
  scene.add(cap);
  // the carry rail up the left edge
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, lampY(7) - lampY(0) + 0.6, 0.16), dark);
  rail.position.set(-1.05, (lampY(0) + lampY(7)) / 2, LAMP_Z);
  scene.add(rail);
  const carryMat = new THREE.MeshStandardMaterial({ color: C["ffffff"], emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 2, roughness: 0.4 });
  const carry = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), carryMat);
  carry.position.set(-1.05, 0, LAMP_Z + 0.02);
  carry.visible = false;
  scene.add(carry);

  const lampMats: THREE.MeshStandardMaterial[] = [];
  const lampLights: THREE.PointLight[] = [];
  const switches: THREE.Group[] = [];
  const bezelGeo = new THREE.TorusGeometry(LAMP_R + 0.06, 0.08, 6, 16);
  const domeGeo = new THREE.SphereGeometry(LAMP_R, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let k = 0; k < LAMPS; k++) {
    const y = lampY(k);
    const col = C[LAMP_COLOR[k]];
    const bezel = new THREE.Mesh(bezelGeo, dark);
    bezel.position.set(0, y, LAMP_Z);
    scene.add(bezel);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.14), emissive: new THREE.Color(col), emissiveIntensity: 0, roughness: 0.25, metalness: 0 });
    const dome = new THREE.Mesh(domeGeo, mat);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(0, y, LAMP_Z);
    scene.add(dome);
    lampMats.push(mat);
    const light = new THREE.PointLight(col, 0, 16, 1.4);
    light.position.set(0, y, LAMP_Z + 1.2);
    scene.add(light);
    lampLights.push(light);
    // a toggle switch beside each lamp, flipped up when the lamp is on
    const sw = new THREE.Group();
    sw.position.set(0.95, y, LAMP_Z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.08), dark);
    sw.add(base);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1), new THREE.MeshStandardMaterial({ color: C["c0cbdc"], roughness: 0.3, metalness: 0.6 }));
    lever.position.set(0, 0.16, 0.06);
    const pivot = new THREE.Group();
    pivot.add(lever);
    sw.add(pivot);
    scene.add(sw);
    switches.push(pivot);
  }
  // the beat ring: around the lamp that flips once per beat (the kick)
  const ringMat = new THREE.MeshStandardMaterial({ color: C["feae34"], emissive: new THREE.Color(C["feae34"]), emissiveIntensity: 0.6, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(LAMP_R + 0.26, 0.05, 6, 24), ringMat);
  ring.position.set(0, lampY(0), LAMP_Z + 0.05);
  scene.add(ring);

  return { renderer, scene, camera, lampMats, lampLights, switches, ring, ringMat, carry, carryMat, wallMat };
}
