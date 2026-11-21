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

export const GLASS_X = 0.4, GLASS_Z = 0.8; // the glass stands here on the bench; the speaker faces it from behind
export const SPEAKER_Z = -3.2;
export const RINGS = 9;

export type GlassScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  glass: THREE.Mesh;
  glassBase: Float32Array; // undeformed vertex positions
  glassMat: THREE.MeshStandardMaterial;
  rim: THREE.Mesh;
  glassLight: THREE.PointLight;
  flashLight: THREE.PointLight;
  cone: THREE.Group;
  halo: THREE.Mesh;
  rings: THREE.Mesh[];
  ringMat: THREE.MeshBasicMaterial;
  shards: THREE.InstancedMesh;
};

/** Wine-glass profile (radius, height) in scene units (10 cm), from the foot to the rim. */
export function glassProfile(stemH: number, bowlH: number, bowlR: number, footR: number): THREE.Vector2[] {
  const p: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(footR, 0.0), new THREE.Vector2(footR * 0.9, 0.05), new THREE.Vector2(0.06, 0.12),
    new THREE.Vector2(0.05, stemH * 0.6), new THREE.Vector2(0.07, stemH - 0.05)];
  for (let k = 0; k <= 10; k++) {
    const u = k / 10, y = stemH + u * bowlH;
    p.push(new THREE.Vector2(bowlR * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62 + 0.25), y));
  }
  return p;
}

export function buildScene(width: number, height: number, profile: THREE.Vector2[]): GlassScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  scene.fog = new THREE.Fog(C["181425"], 14, 34);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);

  scene.add(new THREE.HemisphereLight(C["5a6988"], C["181425"], 1.1));
  const key = new THREE.DirectionalLight(C["ead4aa"], 1.8);
  key.position.set(3, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(C["2ce8f5"], 1.0);
  rimLight.position.set(-5, 3, -6);
  scene.add(rimLight);
  const glassLight = new THREE.PointLight(C["2ce8f5"], 0, 6, 1.5);
  glassLight.position.set(GLASS_X, 1.6, GLASS_Z + 0.8);
  scene.add(glassLight);
  const flashLight = new THREE.PointLight(C["ffffff"], 0, 12, 1.2);
  flashLight.position.set(GLASS_X, 1.6, GLASS_Z + 1.2);
  scene.add(flashLight);

  // ---------------------------------------------------------------- the room: an acoustic lab
  const foam = tex(16, (g) => {
    g.fillStyle = hex(24); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(23); g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
    g.fillStyle = hex(25); g.fillRect(7, 0, 1, 16); g.fillRect(0, 7, 16, 1); g.fillRect(15, 0, 1, 16); g.fillRect(0, 15, 16, 1);
  }, 20, 8);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ map: foam, roughness: 1 }));
  back.position.set(0, 2, -8); back.receiveShadow = true; scene.add(back);
  const floorTex = tex(16, (g) => { g.fillStyle = hex(25); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(24); g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }, 20, 20);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -7.5; scene.add(floor);
  // the bench (75 cm high), top at y = 0, with a grid mat on it
  const mat = tex(16, (g) => {
    g.fillStyle = hex(15); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(14); g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
  }, 14, 6);
  const top = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 10), [
    new THREE.MeshStandardMaterial({ color: C["3a4466"] }), new THREE.MeshStandardMaterial({ color: C["3a4466"] }),
    new THREE.MeshStandardMaterial({ map: mat, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: C["262b44"] }),
    new THREE.MeshStandardMaterial({ color: C["5a6988"] }), new THREE.MeshStandardMaterial({ color: C["3a4466"] }),
  ]);
  top.position.set(0, -0.2, -1.5); top.receiveShadow = true; scene.add(top);
  for (const [x, z] of [[-6.5, -6.1], [6.5, -6.1], [-6.5, 3.1], [6.5, 3.1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.1, 0.3), new THREE.MeshStandardMaterial({ color: C["262b44"] }));
    leg.position.set(x, -3.95, z); scene.add(leg);
  }
  // hazard strip on the bench edge
  const hazard = tex(16, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(10);
    for (let i = -16; i < 32; i += 8) { g.beginPath(); g.moveTo(i, 16); g.lineTo(i + 4, 16); g.lineTo(i + 20, 0); g.lineTo(i + 16, 0); g.fill(); }
  }, 14, 1);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.02), new THREE.MeshStandardMaterial({ map: hazard }));
  strip.position.set(0, -0.12, 3.51); scene.add(strip);
  // lamps on the back wall
  for (const x of [-6, 0, 6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: C["fee761"] }));
    l.position.set(x, 6.5, -7.9); scene.add(l);
  }

  // ---------------------------------------------------------------- the speaker
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 1.3), new THREE.MeshStandardMaterial({ color: C["3a4466"], roughness: 0.6 }));
  cab.position.set(0, 1.3, SPEAKER_Z - 0.65); cab.castShadow = cab.receiveShadow = true; scene.add(cab);
  const trim = new THREE.LineSegments(new THREE.EdgesGeometry(cab.geometry), new THREE.LineBasicMaterial({ color: C["8b9bb4"] }));
  trim.position.copy(cab.position); scene.add(trim);
  const cone = new THREE.Group();
  const surround = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16), new THREE.MeshStandardMaterial({ color: C["181425"] }));
  surround.rotation.x = Math.PI / 2; cone.add(surround);
  const dia = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.35, 16, 1, true), new THREE.MeshStandardMaterial({ color: C["8b9bb4"], side: THREE.DoubleSide, roughness: 0.8 }));
  dia.rotation.x = Math.PI / 2; dia.position.z = 0.05; cone.add(dia);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.5 }));
  cap.position.z = 0.12; cone.add(cap);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 4, 24), new THREE.MeshBasicMaterial({ color: C["2ce8f5"] }));
  cone.add(halo);
  cone.position.set(0, 1.5, SPEAKER_Z + 0.02);
  scene.add(cone);
  const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), new THREE.MeshStandardMaterial({ color: C["3a4466"] }));
  tweeter.rotation.x = Math.PI / 2; tweeter.position.set(0, 2.4, SPEAKER_Z + 0.02); scene.add(tweeter);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: C["63c74d"] }));
  led.position.set(0.7, 0.35, SPEAKER_Z + 0.02); scene.add(led);

  // sound waves on the bench: one ring per wavelength, centred on the speaker
  const ringMat = new THREE.MeshBasicMaterial({ color: C["2ce8f5"], side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < RINGS; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 72, 1, -Math.PI / 2 - Math.PI / 2.2, Math.PI / 1.1), ringMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, SPEAKER_Z + 0.1); scene.add(r); rings.push(r);
  }

  // ---------------------------------------------------------------- the glass
  const geo = new THREE.LatheGeometry(profile, 48);
  const glassMat = new THREE.MeshStandardMaterial({ color: C["c0cbdc"], roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55,
    emissive: new THREE.Color(C["2ce8f5"]), emissiveIntensity: 0, side: THREE.DoubleSide, flatShading: true });
  const glass = new THREE.Mesh(geo, glassMat);
  glass.position.set(GLASS_X, 0, GLASS_Z);
  glass.castShadow = true;
  scene.add(glass);
  const glassBase = new Float32Array(geo.attributes.position.array as Float32Array);
  const top2 = profile[profile.length - 1];
  const rim = new THREE.Mesh(new THREE.TorusGeometry(top2.x, 0.025, 4, 48), new THREE.MeshBasicMaterial({ color: C["ffffff"] }));
  rim.rotation.x = Math.PI / 2; rim.position.set(GLASS_X, top2.y, GLASS_Z); scene.add(rim);

  const shards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.18), new THREE.MeshStandardMaterial({ color: C["ffffff"], roughness: 0.2, metalness: 0.3,
    emissive: new THREE.Color(C["2ce8f5"]), emissiveIntensity: 0.25 }), 128);
  shards.castShadow = true;
  shards.count = 0;
  scene.add(shards);

  return { renderer, scene, camera, glass, glassBase, glassMat, rim, glassLight, flashLight, cone, halo, rings, ringMat, shards };
}
