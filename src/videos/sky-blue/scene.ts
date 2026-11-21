import * as THREE from "three";
import { C } from "../../lib/palette";

export const SKY_R = 90;
export const SUN_DIST = 80;
export const SUN_AZ = 0.35; // radians to the right of straight ahead (-z)
export const PERSON = new THREE.Vector3(0, 3.2, 0);
export const MAX_PHOTONS = 160;
export const MOLECULES = 260;

export type SkyScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dome: THREE.Mesh;
  domeColors: THREE.BufferAttribute;
  sun: THREE.Mesh;
  sunMat: THREE.MeshBasicMaterial;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  sunLight: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  photons: THREE.InstancedMesh;
  molecules: THREE.InstancedMesh;
  person: THREE.Group;
};

function hash(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export function buildScene(width: number, height: number): SkyScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 400);

  // sky dome: vertex colours set every frame from the computed sky and horizon colours
  const domeGeo = new THREE.SphereGeometry(SKY_R, 32, 24);
  const domeColors = new THREE.BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3);
  domeGeo.setAttribute("color", domeColors);
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(dome);

  // the sun and its glow
  const sunMat = new THREE.MeshBasicMaterial({ color: C["ffffff"], fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), sunMat);
  scene.add(sun);
  const glowMat = new THREE.MeshBasicMaterial({ color: C["fee761"], transparent: true, opacity: 0.25, fog: false, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(9, 24), glowMat);
  scene.add(glow);

  const hemi = new THREE.HemisphereLight(C["8b9bb4"], C["265c42"], 1.0);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(C["ffffff"], 1.6);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunLight.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 200 });
  scene.add(sunLight);
  scene.add(sunLight.target);

  // the land: voxel hills, the listener's hill in the middle
  const land = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 70 * 50);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  let i = 0;
  for (let gx = -35; gx < 35; gx++) for (let gz = -40; gz < 10; gz++) {
    const d = Math.hypot(gx, gz);
    const h = Math.max(0.5, 3 * Math.exp(-(d * d) / 40) + 1.2 * Math.sin(gx * 0.35) * Math.cos(gz * 0.28) + 1.2 + (gz < -25 ? (gz + 25) * -0.25 : 0));
    const hh = Math.round(h);
    m.compose(new THREE.Vector3(gx, hh / 2 - 0.5, gz), new THREE.Quaternion(), new THREE.Vector3(1, hh, 1));
    land.setMatrixAt(i, m);
    land.setColorAt(i, col.set(hh >= 4 ? C["63c74d"] : hh >= 2 ? C["3e8948"] : C["265c42"]));
    i++;
  }
  land.castShadow = land.receiveShadow = true;
  scene.add(land);
  // trees for scale
  const trunk = new THREE.MeshStandardMaterial({ color: C["733e39"] }), leaf = new THREE.MeshStandardMaterial({ color: C["265c42"], flatShading: true });
  for (let k = 0; k < 26; k++) {
    const x = (hash(k) - 0.5) * 50, z = -5 - hash(k + 50) * 30;
    if (Math.hypot(x, z) < 6) continue;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), trunk); t.position.set(x, 2.4, z); t.castShadow = true; scene.add(t);
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), leaf); l.position.set(x, 3.6, z); l.castShadow = true; scene.add(l);
  }

  // the listener (not to scale), facing the sun
  const person = new THREE.Group();
  const pm = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
  const part = (w: number, h: number, d: number, c: string, x: number, y: number) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pm(c)); p.position.set(x, y, 0); p.castShadow = true; person.add(p); };
  part(0.22, 0.6, 0.26, C["262b44"], -0.15, 0.3); part(0.22, 0.6, 0.26, C["262b44"], 0.15, 0.3);
  part(0.6, 0.62, 0.36, C["b55088"], 0, 0.9);
  part(0.16, 0.5, 0.2, C["b55088"], -0.38, 0.92); part(0.16, 0.5, 0.2, C["b55088"], 0.38, 0.92);
  part(0.42, 0.42, 0.42, C["e8b796"], 0, 1.43);
  part(0.46, 0.14, 0.46, C["3e2731"], 0, 1.68);
  person.position.copy(PERSON);
  scene.add(person);

  // air molecules: faint specks across the sky (what the light bounces off)
  const molecules = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: C["c0cbdc"], transparent: true, opacity: 0.6, fog: false }), MOLECULES);
  for (let k = 0; k < MOLECULES; k++) {
    m.makeTranslation((hash(k * 3) - 0.5) * 60, 6 + hash(k * 3 + 1) * 34, -6 - hash(k * 3 + 2) * 50);
    molecules.setMatrixAt(k, m);
  }
  scene.add(molecules);

  const photons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshBasicMaterial({ color: C["ffffff"], fog: false }), MAX_PHOTONS);
  photons.count = 0;
  scene.add(photons);

  scene.fog = new THREE.Fog(C["8b9bb4"], 45, 120);
  return { renderer, scene, camera, dome, domeColors, sun, sunMat, glow, glowMat, sunLight, hemi, photons, molecules, person };
}
