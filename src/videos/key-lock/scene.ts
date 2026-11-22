import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";
import timeline from "../../../public/key-lock/timeline.json";

const L = (timeline as unknown as { lock: Lock }).lock;
type Lock = { pins: number; spacing: number; first: number; blade: number; shear: number; rest: number; driver: number; chamberTop: number; keyPin: number[]; tip0: number; tip1: number; tipH: number; flat: number };

// World units: 1 = 0.1 inch. x runs from the lock face into the lock, y up from the key's bottom edge, z toward the camera.
// The front half of the lock (z > 0) is cut away.
export const U = 10;
export const X0 = 0.55; // the middle of the pin row sits at world x = 0
export const wx = (xIn: number) => (xIn - X0) * U;
export const wy = (yIn: number) => yIn * U;
export const pinWX = (i: number) => wx(L.first + i * L.spacing);
export const PLUG_AXIS = 0.22, PLUG_R = 0.28, FACE = 0, BACK = 1.15;
const PIN_R = 0.0575;
export const SPRING_COILS = 7;

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

export type LockScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  plug: THREE.Group; // turns about the plug axis; holds the plug, key pins, key, pick and wrench
  keyPins: THREE.Mesh[]; drivers: THREE.Mesh[]; springs: THREE.Group[];
  keyPinMats: THREE.MeshStandardMaterial[]; driverMats: THREE.MeshStandardMaterial[];
  keys: Record<string, THREE.Group>; pick: THREE.Group; pickTip: THREE.Mesh; wrench: THREE.Group;
  lamp: THREE.PointLight;
};

/** A key's flat outline in inches: u from the shoulder (u = 0) to the tip, the bow outside (u < 0). */
function keyShape(cuts: number[]) {
  const s = new THREE.Shape();
  const prof = (u: number) => {
    let h = L.blade;
    cuts.forEach((c, i) => { h = Math.min(h, c + Math.max(0, Math.abs(u - (L.first + i * L.spacing)) - L.flat / 2)); });
    if (u > L.tip0) h = Math.min(h, L.blade - (L.blade - L.tipH) * (u - L.tip0) / (L.tip1 - L.tip0));
    return h;
  };
  // bow: a rounded head left of the shoulder
  s.moveTo(0, 0.04);
  s.lineTo(-0.08, -0.1);
  s.lineTo(-0.6, -0.2);
  s.quadraticCurveTo(-0.78, 0.2, -0.6, 0.6);
  s.lineTo(-0.08, 0.52);
  s.lineTo(0, 0.42);
  // top edge along the cuts, fine steps so the V cuts are exact
  for (let u = 0; u <= L.tip1 + 1e-9; u += 0.005) s.lineTo(u, prof(u));
  s.lineTo(L.tip1, 0.08);
  s.lineTo(L.tip1 - 0.06, 0.04);
  s.lineTo(0, 0.04);
  const hole = new THREE.Path();
  hole.absarc(-0.52, 0.2, 0.08, 0, Math.PI * 2, false);
  s.holes.push(hole);
  return s;
}

export function buildScene(width: number, height: number, keyDefs: Record<string, { cuts: number[]; tag: string }>): LockScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["3e2731"]);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 400);

  scene.add(new THREE.HemisphereLight(C["c0cbdc"], C["262b44"], 1.0));
  const key = new THREE.DirectionalLight(C["ead4aa"], 1.5);
  key.position.set(-10, 30, 40);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  scene.add(key);
  const lamp = new THREE.PointLight(C["ead4aa"], 30, 60, 1.5); // the work lamp, warm, above and in front
  lamp.position.set(-4, 18, 16);
  scene.add(lamp);

  // ---------------------------------------------------------------- the door behind: wood planks, the edge and the frame to the right
  const wood = tex(32, (g) => {
    g.fillStyle = hex(4); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(5); for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    g.fillStyle = hex(31); for (let y = 3; y < 32; y += 7) g.fillRect((y * 5) % 8, y, 4, 1);
  }, 6, 6);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }));
  door.position.set(wx(BACK) + 4 - 30, 2, -4.2);
  door.receiveShadow = true;
  scene.add(door);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(14, 70, 3), new THREE.MeshStandardMaterial({ color: C["733e39"], roughness: 0.8 }));
  frame.position.set(wx(BACK) + 4 + 7.4, 2, -4);
  frame.receiveShadow = true;
  scene.add(frame);

  // ---------------------------------------------------------------- the housing (dark steel), back half only
  const steel = new THREE.MeshStandardMaterial({ color: C["3a4466"], roughness: 0.6, metalness: 0.2 });
  const len = (BACK - FACE) * U, cx = wx((BACK + FACE) / 2);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(wy(PLUG_R + 0.1), wy(PLUG_R + 0.1), len, 32, 1, false, Math.PI / 2, Math.PI), steel);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(cx, wy(PLUG_AXIS), 0);
  shell.castShadow = shell.receiveShadow = true;
  scene.add(shell);
  // the bible: the block above the plug that holds the driver pins and springs
  const bibleH = L.chamberTop + 0.08 - (PLUG_AXIS + 0.1);
  const bible = new THREE.Mesh(new THREE.BoxGeometry(len, wy(bibleH), 3.4), steel);
  bible.position.set(cx, wy(PLUG_AXIS + 0.1 + bibleH / 2), -1.7);
  bible.castShadow = bible.receiveShadow = true;
  scene.add(bible);
  // the cut faces (z = 0): the bible's face with its five chambers, and the ring of housing round the plug
  const faceTex = (() => {
    const c = document.createElement("canvas"); c.width = 230; c.height = 200;
    const g = c.getContext("2d")!;
    g.fillStyle = hex(22); g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = hex(23); for (let y = 0; y < c.height; y += 6) g.fillRect(0, y, c.width, 1);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bibleFace = new THREE.Mesh(new THREE.PlaneGeometry(len, wy(L.chamberTop + 0.08 - L.shear)), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7, metalness: 0.2 }));
  bibleFace.position.set(cx, wy((L.chamberTop + 0.08 + L.shear) / 2), 0.001);
  bibleFace.receiveShadow = true;
  scene.add(bibleFace);
  const chamberMat = new THREE.MeshStandardMaterial({ color: C["181425"], roughness: 1 });
  for (let i = 0; i < L.pins; i++) {
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(wy(PIN_R * 2 + 0.02), wy(L.chamberTop - L.shear)), chamberMat);
    ch.position.set(pinWX(i), wy((L.chamberTop + L.shear) / 2), 0.004);
    scene.add(ch);
  }

  // ---------------------------------------------------------------- the plug (lighter brass), turns about its axis
  const plug = new THREE.Group();
  plug.position.set(0, wy(PLUG_AXIS), 0);
  scene.add(plug);
  const brass = new THREE.MeshStandardMaterial({ color: C["e4a672"], roughness: 0.8, metalness: 0.1 });
  const brassCut = new THREE.MeshStandardMaterial({ color: C["fee761"], roughness: 0.55, metalness: 0.25 });
  const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(wy(PLUG_R), wy(PLUG_R), len + 0.4, 32, 1, false, Math.PI / 2, Math.PI), brass);
  plugBody.rotation.z = Math.PI / 2;
  plugBody.position.set(cx, 0, 0);
  plugBody.castShadow = plugBody.receiveShadow = true;
  plug.add(plugBody);
  const plugFace = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.4, wy(PLUG_R * 2)), brassCut);
  plugFace.position.set(cx, 0, 0.002);
  plug.add(plugFace);
  // the keyway (a dark slot through the plug) and the pin holes from the keyway up to the line
  const keyway = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.4, wy(0.4)), new THREE.MeshStandardMaterial({ color: C["262b44"], roughness: 1 }));
  keyway.position.set(cx, wy(0.2 - PLUG_AXIS + 0.0), 0.004);
  plug.add(keyway);
  for (let i = 0; i < L.pins; i++) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(wy(PIN_R * 2 + 0.02), wy(L.shear - 0.4)), chamberMat);
    h.position.set(pinWX(i), wy((L.shear + 0.4) / 2 - PLUG_AXIS), 0.004);
    plug.add(h);
  }
  // the cam at the back of the plug: turns with it
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.6, 1.2), steel);
  cam.position.set(wx(BACK) + 0.3, -1.2, -1);
  plug.add(cam);

  // ---------------------------------------------------------------- pins and springs
  const cyl = new THREE.CylinderGeometry(wy(PIN_R), wy(PIN_R), 1, 12);
  cyl.translate(0, 0.5, 0); // origin at the bottom
  const keyPinGeo = new THREE.CylinderGeometry(wy(PIN_R), wy(PIN_R), 1, 12);
  keyPinGeo.translate(0, 0.5, 0);
  const keyPins: THREE.Mesh[] = [], drivers: THREE.Mesh[] = [], springs: THREE.Group[] = [];
  const keyPinMats: THREE.MeshStandardMaterial[] = [], driverMats: THREE.MeshStandardMaterial[] = [];
  // a spring is a stack of thin coils, spaced per frame (so the wire keeps its thickness as it squashes)
  const coilGeo = new THREE.TorusGeometry(wy(PIN_R * 0.85), 0.16, 4, 12);
  coilGeo.rotateX(Math.PI / 2);
  const copper = new THREE.MeshStandardMaterial({ color: C["d77643"], roughness: 0.4, metalness: 0.2 });
  for (let i = 0; i < L.pins; i++) {
    const km = new THREE.MeshStandardMaterial({ color: C["feae34"], emissive: new THREE.Color(C["63c74d"]), emissiveIntensity: 0, roughness: 0.35, metalness: 0.2 });
    const kp = new THREE.Mesh(keyPinGeo, km);
    kp.castShadow = true;
    plug.add(kp); // key pins ride in the plug
    keyPins.push(kp); keyPinMats.push(km);
    const dm = new THREE.MeshStandardMaterial({ color: C["ffffff"], emissive: new THREE.Color(C["63c74d"]), emissiveIntensity: 0, roughness: 0.35, metalness: 0.1 });
    const dp = new THREE.Mesh(cyl, dm);
    dp.castShadow = true;
    scene.add(dp);
    drivers.push(dp); driverMats.push(dm);
    const sp = new THREE.Group();
    for (let k = 0; k < SPRING_COILS; k++) { const c = new THREE.Mesh(coilGeo, copper); c.rotation.z = (k % 2 ? 1 : -1) * 0.18; sp.add(c); }
    scene.add(sp);
    springs.push(sp);
  }

  // ---------------------------------------------------------------- the keys: silver blade, coloured tag on the bow
  const keys: Record<string, THREE.Group> = {};
  const silver = new THREE.MeshStandardMaterial({ color: C["ffffff"], emissive: new THREE.Color(C["8b9bb4"]), emissiveIntensity: 0.45, roughness: 0.5, metalness: 0.1 });
  for (const [id, k] of Object.entries(keyDefs)) {
    const g = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(keyShape(k.cuts), { depth: 0.08, bevelEnabled: false, curveSegments: 6 });
    geo.translate(0, 0, -0.04);
    geo.scale(U, U, U);
    const m = new THREE.Mesh(geo, silver);
    m.castShadow = true;
    g.add(m);
    // a coloured band on the bow, so each key can be told apart
    const tag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 1.0), new THREE.MeshStandardMaterial({ color: C[k.tag as keyof typeof C], roughness: 0.6 }));
    tag.position.set(-2.6, 2.0, 0);
    g.add(tag);
    g.visible = false;
    plug.add(g);
    keys[id] = g;
  }

  // ---------------------------------------------------------------- the pick (a thin hook) and the tension wrench
  const tool = new THREE.MeshStandardMaterial({ color: C["2ce8f5"], roughness: 0.4, metalness: 0.1 });
  const pick = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), tool);
  shaft.geometry.translate(-0.5, 0, 0); // shaft runs left from its tip end
  shaft.name = "shaft";
  pick.add(shaft);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 0.8), new THREE.MeshStandardMaterial({ color: C["e43b44"], roughness: 0.6 }));
  handle.name = "handle";
  pick.add(handle);
  const pickTip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), tool);
  pickTip.geometry.translate(0, 0.5, 0);
  pick.add(pickTip);
  pick.visible = false;
  plug.add(pick);
  const wrench = new THREE.Group();
  const wIn = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.5), tool);
  wIn.position.set(wx(0) + 1.0, wy(0.03 - PLUG_AXIS), 0.9);
  wrench.add(wIn);
  const wOut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), tool);
  wOut.position.set(wx(0) - 0.25, wy(0.03 - PLUG_AXIS) - 1.5, 0.9);
  wrench.add(wOut);
  wrench.visible = false;
  plug.add(wrench);

  return { renderer, scene, camera, plug, keyPins, drivers, springs, keyPinMats, driverMats, keys, pick, pickTip, wrench, lamp };
}

export { L as LOCK };
