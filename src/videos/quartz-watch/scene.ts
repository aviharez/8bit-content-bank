import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";

const hex = (i: number) => `#${PALETTE[i]}`;
export const STAGE_SPACING = 2.4;
export const stageX = (k: number) => k * STAGE_SPACING; // k = 0 is the crystal
export const WATCH = { x: 15 * STAGE_SPACING + 4.2, y: 4.3, r: 2.4 };

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

export type QuartzScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  prongs: THREE.Mesh[];
  leds: THREE.MeshStandardMaterial[]; // index k = 1..15 (0 unused)
  secondHand: THREE.Group;
  focusLight: THREE.PointLight;
};

/** The inside of a quartz watch, laid out in a line: crystal, 15 divider chips, the watch face. */
export function buildQuartzScene(width: number, height: number): QuartzScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  scene.fog = new THREE.Fog(C["181425"], 11, 30);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 120);

  scene.add(new THREE.HemisphereLight(C["3a4466"], C["181425"], 1.3));
  const key = new THREE.DirectionalLight(C["ead4aa"], 2.2);
  key.position.set(18, 12, 10);
  key.target.position.set(20, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -26, right: 30, top: 14, bottom: -10, near: 0.5, far: 50 });
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(C["2ce8f5"], 1.1);
  rim.position.set(-6, 4, -8);
  scene.add(rim);
  const focusLight = new THREE.PointLight(C["fee761"], 0, 4.5, 1.5);
  scene.add(focusLight);

  // circuit board floor
  const pcb = tex(16, (g) => {
    g.fillStyle = hex(15); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(14); g.fillRect(0, 7, 16, 2); g.fillRect(11, 0, 1, 16);
    g.fillStyle = hex(13); g.fillRect(3, 3, 2, 2);
  }, 60, 20);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshStandardMaterial({ map: pcb, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(20, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  // copper trace running through the whole chain
  for (const z of [-0.25, 0.25]) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(WATCH.x + 1, 0.03, 0.1), new THREE.MeshStandardMaterial({ color: C["c28569"], metalness: 0.7, roughness: 0.35 }));
    trace.position.set(WATCH.x / 2, 0.015, z);
    trace.receiveShadow = true;
    scene.add(trace);
  }

  // background: dark board with blue traces
  const bg = tex(32, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(16); g.fillRect(0, 10, 20, 1); g.fillRect(20, 10, 1, 14); g.fillRect(20, 24, 12, 1); g.fillRect(6, 0, 1, 10);
    g.fillStyle = hex(17); g.fillRect(5, 9, 3, 3); g.fillRect(19, 23, 3, 3);
  }, 20, 6);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), new THREE.MeshStandardMaterial({ map: bg, emissiveMap: bg, emissive: new THREE.Color(C["124e89"]), emissiveIntensity: 0.55, roughness: 1 }));
  back.position.set(20, 12, -9);
  scene.add(back);

  // the quartz crystal: a tiny tuning fork on a base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.9), new THREE.MeshStandardMaterial({ color: C["5a6988"], metalness: 0.6, roughness: 0.35 }));
  base.position.set(0, 0.175, 0);
  base.castShadow = true;
  scene.add(base);
  const quartz = new THREE.MeshStandardMaterial({ color: C["c0cbdc"], roughness: 0.2, emissive: new THREE.Color(C["2ce8f5"]), emissiveIntensity: 0.18 });
  const prongs = [-0.24, 0.24].map((dx) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.32), quartz);
    p.position.set(dx, 1.1, 0);
    p.castShadow = true;
    scene.add(p);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry), new THREE.LineBasicMaterial({ color: C["ffffff"] }));
    p.add(e);
    return p;
  });

  // 15 divider stages: a chip with legs and an LED on top
  const chipMat = new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 0.6 });
  const legMat = new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.8, roughness: 0.3 });
  const leds: THREE.MeshStandardMaterial[] = [new THREE.MeshStandardMaterial()];
  for (let k = 1; k <= 15; k++) {
    const x = stageX(k);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), chipMat);
    chip.position.set(x, 0.35, 0);
    chip.castShadow = chip.receiveShadow = true;
    scene.add(chip);
    chip.add(new THREE.LineSegments(new THREE.EdgesGeometry(chip.geometry), new THREE.LineBasicMaterial({ color: C["5a6988"] })));
    for (let i = 0; i < 4; i++) for (const z of [-0.62, 0.62]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.14), legMat);
      leg.position.set(x - 0.39 + i * 0.26, 0.12, z);
      scene.add(leg);
    }
    const ledMat = new THREE.MeshStandardMaterial({ color: C["3e2731"], roughness: 0.3, emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), ledMat);
    led.position.set(x, 0.85, 0);
    scene.add(led);
    leds.push(ledMat);
  }

  // the watch face, standing up at the end of the chain
  const watch = new THREE.Group();
  watch.position.set(WATCH.x, WATCH.y, 0);
  scene.add(watch);
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(WATCH.r + 0.3, WATCH.r + 0.3, 0.5, 32), new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.8, roughness: 0.3 }));
  caseMesh.rotation.x = Math.PI / 2;
  caseMesh.castShadow = true;
  watch.add(caseMesh);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(WATCH.r, WATCH.r, 0.52, 32), new THREE.MeshStandardMaterial({ color: C["ead4aa"], roughness: 0.8 }));
  face.rotation.x = Math.PI / 2;
  watch.add(face);
  const ink = new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 0.7 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(i % 3 === 0 ? 0.16 : 0.1, i % 3 === 0 ? 0.42 : 0.26, 0.05), ink);
    mark.position.set(Math.sin(a) * (WATCH.r - 0.35), Math.cos(a) * (WATCH.r - 0.35), 0.28);
    mark.rotation.z = -a;
    watch.add(mark);
  }
  const hand = (len: number, w: number, angle: number, mat: THREE.Material, z: number) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.05), mat);
    m.position.y = len / 2 - 0.15;
    g.add(m);
    g.position.z = z;
    g.rotation.z = -angle;
    watch.add(g);
    return g;
  };
  hand(1.3, 0.16, (10 / 12) * Math.PI * 2 + (10 / 60) * (Math.PI / 6), ink, 0.3); // hour hand at 10:10
  hand(1.9, 0.11, (10 / 60) * Math.PI * 2, ink, 0.32); // minute hand
  const secondHand = hand(2.1, 0.05, 0, new THREE.MeshStandardMaterial({ color: C["e43b44"], emissive: new THREE.Color(C["e43b44"]), emissiveIntensity: 0.3 }), 0.34);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), new THREE.MeshStandardMaterial({ color: C["e43b44"] }));
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.36;
  watch.add(cap);
  for (const sy of [1, -1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.35), new THREE.MeshStandardMaterial({ color: C["3e2731"], roughness: 0.9 }));
    strap.position.set(0, sy * (WATCH.r + 0.9), -0.05);
    strap.castShadow = true;
    watch.add(strap);
  }

  return { renderer, scene, camera, prongs, leds, secondHand, focusLight };
}
