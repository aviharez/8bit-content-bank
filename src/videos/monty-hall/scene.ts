import * as THREE from "three";
import { C } from "../../lib/palette";

// World units are metres. Each stage is a little game-show set facing +z: a back wall with 3 doors in it (x = -1.2, 0,
// 1.2), a marquee of 9 bulbs arching over them, the host on the left and the contestant on a mark in front. The
// stages stack into a wall of COLS x ROWS like TV screens; the middle one (row 3, col 2) sits at the origin.
export const CELL = { w: 4.4, h: 3.6 };
export const DOOR = { w: 0.9, h: 1.9, xs: [-1.2, 0, 1.2] };
export const MARK = new THREE.Vector3(0, 0, 2.3); // the contestant's mark between games
export const HOST_SPOT = new THREE.Vector3(-1.8, 0, 1.5);

export function stageOrigin(s: number, cols: number) {
  const row = Math.floor(s / cols), col = s % cols;
  return new THREE.Vector3((col - (cols - 1) / 2) * CELL.w, (3 - row) * CELL.h, 0);
}

export type DoorParts = {
  pivot: THREE.Group; frame: THREE.MeshBasicMaterial; car: THREE.Group; goat: THREE.Group;
};
export type Stage = {
  root: THREE.Group; doors: DoorParts[]; panel: THREE.MeshStandardMaterial; strip: THREE.MeshBasicMaterial;
  contestant: THREE.Group; host: THREE.Group; hostArm: THREE.Group;
};
export type ShowScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  stages: Stage[]; bulbs: THREE.MeshBasicMaterial[]; hemi: THREE.HemisphereLight;
};

const std = (c: string, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}

function car() {
  const g = new THREE.Group();
  g.add(box(0.78, 0.26, 0.5, std(C["e43b44"], 0.4), 0, 0.25, 0));
  g.add(box(0.44, 0.2, 0.44, std(C["ff0044"], 0.4), -0.04, 0.48, 0));
  g.add(box(0.36, 0.14, 0.46, new THREE.MeshBasicMaterial({ color: C["2ce8f5"] }), -0.04, 0.5, 0.01)); // windows
  for (const x of [-0.24, 0.24]) g.add(box(0.16, 0.16, 0.54, std(C["181425"]), x, 0.1, 0));
  g.add(box(0.06, 0.06, 0.06, new THREE.MeshBasicMaterial({ color: C["fee761"] }), 0.4, 0.28, 0.2)); // headlight
  return g;
}
function goat() {
  const g = new THREE.Group();
  const white = std(C["ead4aa"]);
  g.add(box(0.5, 0.26, 0.26, white, 0, 0.42, 0)); // body
  g.add(box(0.2, 0.2, 0.18, white, 0.3, 0.62, 0)); // head
  g.add(box(0.05, 0.12, 0.05, std(C["8b9bb4"]), 0.27, 0.78, 0.05)); // horns
  g.add(box(0.05, 0.12, 0.05, std(C["8b9bb4"]), 0.27, 0.78, -0.05));
  g.add(box(0.06, 0.1, 0.04, std(C["c28569"]), 0.4, 0.55, 0)); // beard
  for (const x of [-0.17, 0.17]) for (const z of [-0.08, 0.08]) g.add(box(0.06, 0.3, 0.06, white, x, 0.15, z));
  return g;
}
function person(shirt: string, legs: string, suit = false) {
  const g = new THREE.Group();
  g.add(box(0.36, 0.62, 0.24, std(legs), 0, 0.31, 0));
  g.add(box(0.5, 0.6, 0.3, std(shirt), 0, 0.92, 0));
  if (suit) g.add(box(0.08, 0.4, 0.02, new THREE.MeshBasicMaterial({ color: C["e43b44"] }), 0, 0.98, 0.16)); // tie
  g.add(box(0.34, 0.34, 0.32, std(C["e8b796"]), 0, 1.42, 0));
  g.add(box(0.36, 0.1, 0.34, std(suit ? C["8b9bb4"] : C["3e2731"]), 0, 1.62, 0));
  return g;
}

function buildStage(bulbs: THREE.MeshBasicMaterial[]): Stage {
  const root = new THREE.Group();
  const panel = std(C["68386c"], 0.9);
  // the back wall, made of strips around the 3 door holes
  const wallH = 3.2, top = wallH - DOOR.h;
  root.add(box(CELL.w - 0.3, top, 0.2, panel, 0, DOOR.h + top / 2, 0));
  const edges = [-2.05, ...DOOR.xs.flatMap((x) => [x - DOOR.w / 2, x + DOOR.w / 2]), 2.05];
  for (let k = 0; k < edges.length; k += 2) {
    const w = edges[k + 1] - edges[k];
    root.add(box(w, DOOR.h, 0.2, panel, (edges[k] + edges[k + 1]) / 2, DOOR.h / 2, 0));
  }
  // the floor, glossy, and a lit strip along the top edge (the stage lights)
  root.add(box(CELL.w - 0.3, 0.12, 3.0, std(C["262b44"], 0.3), 0, -0.06, 1.4));
  const strip = new THREE.MeshBasicMaterial({ color: C["3a4466"] });
  root.add(box(CELL.w - 0.3, 0.1, 0.1, strip, 0, wallH + 0.05, 0.12));
  // the marquee: 9 bulbs in an arch over the doors, shared materials so every stage chases the same bulb
  for (let k = 0; k < 9; k++) {
    const u = k / 8;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), bulbs[k]);
    b.position.set(-1.7 + u * 3.4, DOOR.h + 0.38 + Math.sin(u * Math.PI) * 0.5, 0.14);
    root.add(b);
  }
  // doors
  const doors: DoorParts[] = DOOR.xs.map((x, i) => {
    const frame = new THREE.MeshBasicMaterial({ color: C["3a4466"] });
    // the glowing frame: two posts and a lintel round the hole
    for (const sx of [-1, 1]) root.add(box(0.1, DOOR.h + 0.1, 0.06, frame, x + sx * (DOOR.w / 2 + 0.05), (DOOR.h + 0.1) / 2, 0.11));
    root.add(box(DOOR.w + 0.2, 0.1, 0.06, frame, x, DOOR.h + 0.05, 0.11));
    root.add(box(DOOR.w, DOOR.h, 0.02, new THREE.MeshBasicMaterial({ color: C["181425"] }), x, DOOR.h / 2, -0.9)); // inside
    for (const sx of [-1, 1]) root.add(box(0.04, DOOR.h, 0.9, panel, x + sx * DOOR.w / 2, DOOR.h / 2, -0.45));
    const pivot = new THREE.Group();
    pivot.position.set(x - DOOR.w / 2, 0, 0.13);
    const leafCol = [C["0099db"], C["feae34"], C["63c74d"]][i];
    pivot.add(box(DOOR.w, DOOR.h, 0.06, std(leafCol, 0.6), DOOR.w / 2, DOOR.h / 2, 0));
    // the number on the door: a bright plate
    pivot.add(box(0.3, 0.3, 0.02, new THREE.MeshBasicMaterial({ color: C["ffffff"] }), DOOR.w / 2, DOOR.h * 0.66, 0.04));
    const dots = i + 1;
    for (let d = 0; d < dots; d++) pivot.add(box(0.06, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: C["181425"] }),
      DOOR.w / 2 + (d - (dots - 1) / 2) * 0.09, DOOR.h * 0.66, 0.055));
    root.add(pivot);
    const c = car(), gt = goat();
    // a lit riser behind each door, so the prize shows over the contestant's head
    root.add(box(DOOR.w - 0.1, 0.4, 0.7, std(C["8b9bb4"], 0.5), x, 0.2, -0.5));
    c.position.set(x, 0.4, -0.45); gt.position.set(x - 0.05, 0.4, -0.45);
    c.rotation.y = gt.rotation.y = -0.5;
    root.add(c, gt);
    return { pivot, frame, car: c, goat: gt };
  });
  const contestant = person(C["fee761"], C["124e89"]);
  const host = person(C["262b44"], C["262b44"], true);
  const hostArm = new THREE.Group();
  hostArm.position.set(0.3, 1.18, 0);
  hostArm.add(box(0.12, 0.5, 0.12, std(C["262b44"]), 0, -0.22, 0));
  host.add(hostArm);
  contestant.scale.setScalar(0.8);
  host.scale.setScalar(0.85);
  host.position.copy(HOST_SPOT);
  host.rotation.y = 0.5;
  root.add(contestant, host);
  return { root, doors, panel, strip, contestant, host, hostArm };
}

export function buildScene(width: number, height: number, cols: number, rows: number): ShowScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
  const hemi = new THREE.HemisphereLight(C["c0cbdc"], C["3a4466"], 1.4);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(C["ffffff"], 1.3);
  key.position.set(4, 10, 12);
  scene.add(key);
  const bulbs = Array.from({ length: 9 }, () => new THREE.MeshBasicMaterial({ color: C["733e39"] }));
  const stages: Stage[] = [];
  for (let s = 0; s < cols * rows; s++) {
    const st = buildStage(bulbs);
    st.root.position.copy(stageOrigin(s, cols));
    scene.add(st.root);
    stages.push(st);
  }
  // the studio behind the wall: a dark backdrop with trusses
  const back = box(cols * CELL.w + 30, rows * CELL.h + 30, 0.2, std(C["262b44"], 1), 0, 0, -1.4);
  scene.add(back);
  for (let k = -3; k <= 3; k++) scene.add(box(0.2, rows * CELL.h + 30, 0.2, std(C["3a4466"]), k * CELL.w * 1.6, 0, -1.2));
  return { renderer, scene, camera, stages, bulbs, hemi };
}
