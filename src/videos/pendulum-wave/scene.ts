import * as THREE from "three";
import { C } from "../../lib/palette";

// World units are metres. The row runs along -z (k = 0, the longest, nearest the camera); bobs swing along x.
export const SPACING = 0.075;
export const PIVOT_Y = 1.15;
export const BOB_R = 0.028;
const ROW_LEN = SPACING * 14;

// one colour per pendulum, warm (long, low notes) to cool (short, high notes)
export const BOB_COLORS = [
  "ff0044", "e43b44", "d77643", "f77622", "feae34", "fee761", "ead4aa", "63c74d",
  "2ce8f5", "0099db", "b55088", "f6757a", "e8b796", "c0cbdc", "ffffff",
].map((h) => C[h as keyof typeof C]);

export type PendulumScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bobs: THREE.Mesh[];
  bobMats: THREE.MeshStandardMaterial[];
  strings: THREE.Line[];
  centreLine: THREE.Mesh;
};

export function buildPendulumScene(width: number, height: number): PendulumScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 50);

  scene.add(new THREE.AmbientLight(C["3a4466"], 1.6));
  const key = new THREE.DirectionalLight(C["ead4aa"], 2.6);
  key.position.set(1.5, 3, 2);
  scene.add(key);

  // floor: a dark grid
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1);
  scene.add(floor);
  const grid = new THREE.GridHelper(6, 30, C["3a4466"], C["3a4466"]);
  grid.position.set(0, 0.001, -1);
  scene.add(grid);

  // the centre line on the floor: where each bob plays its note
  const centreLine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, ROW_LEN + 0.3), new THREE.MeshBasicMaterial({ color: C["5a6988"] }));
  centreLine.position.set(0, 0.003, -ROW_LEN / 2);
  scene.add(centreLine);

  // frame: two posts and a top beam
  const metal = new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.5, roughness: 0.45 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, ROW_LEN + 0.3), metal);
  beam.position.set(0, PIVOT_Y + 0.015, -ROW_LEN / 2);
  scene.add(beam);
  // an arch (two posts and a crossbar) at the far end only, so nothing stands between the camera and the row
  for (const z of [-ROW_LEN - 0.15]) {
    for (const x of [-0.32, 0.32]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, PIVOT_Y + 0.05, 0.035), metal);
      post.position.set(x, (PIVOT_Y + 0.05) / 2, z);
      scene.add(post);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.03), metal);
    cross.position.set(0, PIVOT_Y + 0.035, z);
    scene.add(cross);
  }

  const bobs: THREE.Mesh[] = [], bobMats: THREE.MeshStandardMaterial[] = [], strings: THREE.Line[] = [];
  for (let k = 0; k < 15; k++) {
    const mat = new THREE.MeshStandardMaterial({ color: BOB_COLORS[k], roughness: 0.5, emissive: new THREE.Color(C["ffffff"]), emissiveIntensity: 0 });
    const bob = new THREE.Mesh(new THREE.SphereGeometry(BOB_R, 12, 8), mat);
    scene.add(bob);
    bobs.push(bob);
    bobMats.push(mat);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C["c0cbdc"] }));
    scene.add(line);
    strings.push(line);
  }
  return { renderer, scene, camera, bobs, bobMats, strings, centreLine };
}

/** Pivot of pendulum k. */
export const pivot = (k: number): [number, number, number] => [0, PIVOT_Y, -k * SPACING];
