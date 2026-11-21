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
const panelTex = (base: string, edge: string, rivet: string) => tex(32, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  g.fillStyle = edge; g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2); g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32);
  g.fillStyle = rivet; [[4, 4], [26, 4], [4, 26], [26, 26]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
  g.fillStyle = edge; g.fillRect(8, 15, 16, 2);
});

export type ClackScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  small: THREE.Group;
  big: THREE.Group;
  smallMat: THREE.MeshStandardMaterial;
  hitLight: THREE.PointLight;
};

/** The lab: a hazard-striped wall, a rail track, two riveted blocks. Built once per page. */
export function buildScene(width: number, height: number): ClackScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  scene.fog = new THREE.Fog(C["181425"], 12, 30);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

  scene.add(new THREE.HemisphereLight(C["3a4466"], C["181425"], 1.3));
  const key = new THREE.DirectionalLight(C["ead4aa"], 2.3);
  key.position.set(4, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -8, right: 24, top: 12, bottom: -8, near: 0.5, far: 40 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(C["2ce8f5"], 1.3);
  rim.position.set(-4, 3, -8);
  scene.add(rim);
  const wallLamp = new THREE.PointLight(C["feae34"], 7, 6, 1.5);
  wallLamp.position.set(0.7, 4.0, 1.2);
  scene.add(wallLamp);
  const hitLight = new THREE.PointLight(C["fee761"], 0, 5, 1.5);
  scene.add(hitLight);

  // floor tiles
  const floorTex = tex(16, (g) => { g.fillStyle = hex(24); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(23); g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }, 80, 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(30, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  for (const z of [-0.65, 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(60, 0.05, 0.07), new THREE.MeshStandardMaterial({ color: C["8b9bb4"], metalness: 0.6, roughness: 0.4 }));
    rail.position.set(30, 0.025, z);
    scene.add(rail);
  }
  // distance marks along the track, every metre
  for (let x = 1; x < 30; x++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, x % 5 === 0 ? 0.5 : 0.25), new THREE.MeshBasicMaterial({ color: x % 5 === 0 ? C["c0cbdc"] : C["5a6988"] }));
    mark.position.set(x, 0.01, 1.05);
    scene.add(mark);
  }

  // the wall
  const wallMat = new THREE.MeshStandardMaterial({ map: panelTex(hex(22), hex(23), hex(21)), roughness: 0.7, metalness: 0.3 });
  wallMat.map!.repeat.set(3, 6);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 6), wallMat);
  wall.position.set(-0.4, 3, 0);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);
  const hazard = tex(16, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 16, 16); g.fillStyle = hex(10);
    for (let i = -16; i < 32; i += 8) { g.beginPath(); g.moveTo(i, 16); g.lineTo(i + 4, 16); g.lineTo(i + 20, 0); g.lineTo(i + 16, 0); g.fill(); }
  }, 6, 1);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.5, 6), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6 }));
  strip.position.set(-0.4, 0.25, 0);
  scene.add(strip);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 2), new THREE.MeshBasicMaterial({ color: C["fee761"] }));
  lamp.position.set(0.1, 4.4, 0);
  scene.add(lamp);

  // background: lab panels with lit windows
  const bg = tex(32, (g) => {
    g.fillStyle = hex(25); g.fillRect(0, 0, 32, 32); g.fillStyle = hex(24); g.fillRect(1, 1, 30, 30);
    g.fillStyle = hex(16); g.fillRect(6, 8, 6, 3); g.fillRect(20, 20, 6, 3);
  }, 16, 5);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), new THREE.MeshStandardMaterial({ map: bg, emissiveMap: bg, emissive: new THREE.Color(C["124e89"]), emissiveIntensity: 0.6, roughness: 1 }));
  back.position.set(30, 13, -8);
  scene.add(back);

  // blocks
  const block = (base: string, edge: string, rivet: string, outline: string) => {
    const mat = new THREE.MeshStandardMaterial({ map: panelTex(base, edge, rivet), roughness: 0.55, metalness: 0.2 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: outline }));
    const grp = new THREE.Group();
    grp.add(mesh, lines);
    scene.add(grp);
    return { grp, mat };
  };
  const small = block(hex(17), hex(16), hex(18), C["2ce8f5"]);
  const big = block(hex(8), hex(7), hex(29), C["f6757a"]);

  return { renderer, scene, camera, small: small.grp, big: big.grp, smallMat: small.mat, hitLight };
}
