import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";

// World units: 1 = 1 cm. A 2-way speaker box lies on its back on a workbench, the baffle (front panel) facing up at
// y = 0. The big cone (woofer) is centred at (0, 0, WZ), the small one (tweeter) at (0, 0, TZ).
// The box's front-right corner (x > 0, z > WZ) is cut away, and so is the same quarter of the woofer, so the cone,
// coil and magnet show in cross-section.
export const WZ = 3, TZ = -17;
export const BOX = { x0: -16, x1: 16, z0: -26, z1: 16, y0: -27, wall: 1.8 };
export const CONE = { r0: 3.0, y0: -6.0, r1: 10.2, y1: -0.6 }; // the cone runs from the coil (r0, y0) to the surround (r1, y1)
export const SURROUND_R = 11.0;
export const coneY = (r: number) => CONE.y0 + ((r - CONE.r0) / (CONE.r1 - CONE.r0)) * (CONE.y1 - CONE.y0);
// the cut-away quarter: phi in (0, pi/2) of three.js's lathe (x = r sin phi, z = r cos phi)
const PHI0 = Math.PI / 2, PHI_LEN = (3 * Math.PI) / 2;

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
const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide, ...o });

/** A solid of revolution with the cut-away quarter removed, and its two cut faces filled in. profile: closed (r, y). */
function cutSolid(profile: [number, number][], m: THREE.Material, capMat: THREE.Material = m, segments = 40) {
  const g = new THREE.Group();
  const pts = [...profile, profile[0]].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(pts, segments, PHI0, PHI_LEN), m);
  lathe.castShadow = lathe.receiveShadow = true;
  g.add(lathe);
  const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  // phi = pi/2: the face in the plane z = 0, on the +x side
  const a = new THREE.Mesh(new THREE.ShapeGeometry(shape), capMat);
  g.add(a);
  // phi = 0 (= 2 pi): the face in the plane x = 0, on the +z side
  const b = new THREE.Mesh(new THREE.ShapeGeometry(shape), capMat);
  b.rotation.y = -Math.PI / 2;
  g.add(b);
  return g;
}
/** A thin band along a polyline profile (r, y), `t` thick, as a cut solid. */
function band(line: [number, number][], t: number, m: THREE.Material, capMat?: THREE.Material) {
  const up = line.map(([r, y]) => [r, y + t / 2] as [number, number]);
  const dn = [...line].reverse().map(([r, y]) => [r, y - t / 2] as [number, number]);
  return cutSolid([...up, ...dn], m, capMat);
}

// Where things are in the world (cm). The speaker stands on a desk facing +x; sound crosses the room to a listener.
export const WOOFER_W = new THREE.Vector3(1, 13, 0), TWEETER_W = new THREE.Vector3(1.5, 33, 0);
export const LISTENER_X = 300;
export const HEAD_W = new THREE.Vector3(LISTENER_X + 4, 26, 0);
export const EAR_W = new THREE.Vector3(LISTENER_X + 4, 25, 10.6); // the ear opening, on the side that faces the camera
export const EARDRUM_Z = 8.2; // the canal runs 2.4 cm into the head to the eardrum
export const PHONE_W = new THREE.Vector3(-62, 0.6, 16);
// the air: a slab of dots between the speaker and the listener
export const DOT_STEP = 3;
export const DOTS = (() => {
  const p: number[] = [];
  for (let x = 12; x <= LISTENER_X - 8; x += DOT_STEP)
    for (let y = 2; y <= 95; y += DOT_STEP) p.push(x, y, 0);
  return new Float32Array(p);
})();
export const RINGS = 72;

export type SpeakerScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  moving: THREE.Group; // the woofer's moving parts: cone, dust cap, coil, spider's inner edge
  tweeterDome: THREE.Mesh; tweeterMat: THREE.MeshStandardMaterial; tweeterRing: THREE.MeshStandardMaterial;
  coilMat: THREE.MeshStandardMaterial; phoneScreen: THREE.MeshStandardMaterial; cableMat: THREE.MeshStandardMaterial;
  dots: THREE.InstancedMesh; rings: THREE.Line[]; ringMats: THREE.LineBasicMaterial[];
  headShell: THREE.Group; eardrum: THREE.Group; cochleaMat: THREE.MeshStandardMaterial; earSet: THREE.Group;
};

export function buildScene(width: number, height: number): SpeakerScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1500);

  scene.add(new THREE.HemisphereLight(C["8b9bb4"], C["3e2731"], 1.0));
  const lamp = new THREE.SpotLight(C["ead4aa"], 30000, 420, 0.75, 0.5, 1.5);
  lamp.position.set(-30, 110, 70);
  lamp.target.position.set(60, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.camera.near = 30; lamp.shadow.camera.far = 400;
  scene.add(lamp, lamp.target);
  const lamp2 = new THREE.SpotLight(C["f6757a"], 16000, 300, 0.6, 0.6, 1.5); // the listener's corner, warm pink
  lamp2.position.set(LISTENER_X - 40, 120, 80);
  lamp2.target.position.set(LISTENER_X, 20, 0);
  scene.add(lamp2, lamp2.target);
  const rim = new THREE.DirectionalLight(C["0099db"], 0.9);
  rim.position.set(80, 40, -100);
  scene.add(rim);

  // ---------------------------------------------------------------- the room: a long desk, a wall, the phone and its cable
  const wood = tex(32, (g) => {
    g.fillStyle = hex(5); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(4); for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 1);
    g.fillStyle = hex(6); for (let y = 4; y < 32; y += 8) g.fillRect((y * 7) % 20, y, 9, 1);
  }, 12, 4);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(400, 4, 90), [mat(C["733e39"]), mat(C["733e39"]), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.9 }), mat(C["733e39"]), mat(C["733e39"]), mat(C["733e39"])]);
  desk.position.set(80, -2, 0);
  desk.receiveShadow = true;
  scene.add(desk);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 600), mat(C["3e2731"], { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(150, -75, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  const wallTex = tex(16, (g) => {
    g.fillStyle = hex(24); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(23); g.fillRect(0, 0, 1, 16);
  }, 60, 16);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  wall.position.set(150, 100, -90);
  wall.receiveShadow = true;
  scene.add(wall);
  // posters on the wall, so the room reads as a room
  for (const [x, y, w, h, c] of [[-40, 80, 40, 56, "b55088"], [90, 90, 30, 40, "0099db"], [200, 76, 52, 36, "feae34"], [380, 96, 34, 48, "3e8948"]] as const) {
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(C[c], { roughness: 1 }));
    pst.position.set(x, y, -89.5);
    scene.add(pst);
  }
  // the phone playing the song
  const phone = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 16), mat(C["262b44"], { roughness: 0.4 }));
  phone.position.copy(PHONE_W);
  phone.rotation.y = 0.3;
  phone.castShadow = true;
  scene.add(phone);
  const phoneScreen = new THREE.MeshStandardMaterial({ color: C["124e89"], emissive: new THREE.Color(C["0099db"]), emissiveIntensity: 0.8 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 13.6), phoneScreen);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.52, 0);
  phone.add(screen);
  // the cable: lights up with the current running through it
  const cablePts = [new THREE.Vector3(-58, 0.7, 7), new THREE.Vector3(-50, 0.7, -2), new THREE.Vector3(-38, 0.7, -4), new THREE.Vector3(-30, 3, -2), new THREE.Vector3(-27.5, 6, 0)];
  const cableMat = new THREE.MeshStandardMaterial({ color: C["262b44"], emissive: new THREE.Color(C["2ce8f5"]), emissiveIntensity: 0, roughness: 0.6 });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 40, 0.55, 6), cableMat);
  cable.castShadow = true;
  scene.add(cable);

  // ---------------------------------------------------------------- the air between the speaker and the listener
  const nDots = DOTS.length / 3;
  const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), nDots);
  dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nDots * 3), 3);
  scene.add(dots);
  // the small cone's waves: thin half rings, drawn as lines
  const rings: THREE.Line[] = [], ringMats: THREE.LineBasicMaterial[] = [];
  const arc: THREE.Vector3[] = [];
  for (let k = 0; k <= 40; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 40; arc.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arc);
  for (let i = 0; i < RINGS; i++) {
    const m = new THREE.LineBasicMaterial({ color: C["fee761"], transparent: true });
    const l = new THREE.Line(arcGeo, m);
    l.position.copy(TWEETER_W);
    l.visible = false;
    rings.push(l); ringMats.push(m);
    scene.add(l);
  }

  // ---------------------------------------------------------------- the listener: a blocky person at the far end, facing the speaker
  const skin = mat(C["e4a672"], { roughness: 0.9 }), hair = mat(C["3e2731"], { roughness: 1 }), shirt = mat(C["68386c"], { roughness: 1 });
  const headShell = new THREE.Group();
  scene.add(headShell);
  const box = (g: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    return b;
  };
  const H = HEAD_W;
  box(headShell, 20, 24, 20, H.x, H.y, 0, skin);
  box(headShell, 22, 7, 22, H.x + 1, H.y + 12, 0, hair);
  box(headShell, 6, 16, 22, H.x + 9, H.y + 3, 0, hair);
  box(headShell, 1, 3, 3, H.x - 10.2, H.y + 3, -4.5, mat(C["181425"])); // eyes, on the face (-x)
  box(headShell, 1, 3, 3, H.x - 10.2, H.y + 3, 4.5, mat(C["181425"]));
  box(headShell, 3, 5, 3, H.x - 11.5, H.y - 1, 0, skin); // nose
  box(headShell, 1, 1.5, 7, H.x - 10.2, H.y - 7, 0, mat(C["be4a2f"])); // mouth
  // the outer ear, with the canal's opening
  box(headShell, 5, 8, 1.4, EAR_W.x + 0.5, EAR_W.y, 10.6, mat(C["d77643"], { roughness: 0.9 }));
  const body = new THREE.Group();
  scene.add(body);
  box(body, 8, 8, 8, H.x, H.y - 16, 0, skin); // neck
  box(body, 24, 60, 40, H.x + 2, H.y - 50, 0, shirt);

  // the middle ear, inside the head (shown when the camera goes in): canal, eardrum, the three tiny bones, the snail-shaped cochlea
  const earSet = new THREE.Group();
  scene.add(earSet);
  const canalLen = EAR_W.z - EARDRUM_Z;
  const canal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, canalLen + 0.6, 20, 1, true, -Math.PI / 2, Math.PI), mat(C["e4a672"], { roughness: 0.8 }));
  canal.rotation.x = Math.PI / 2;
  canal.position.set(EAR_W.x, EAR_W.y, EARDRUM_Z + canalLen / 2 + 0.3);
  earSet.add(canal);
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 6), mat(C["733e39"], { side: THREE.BackSide, roughness: 1 }));
  cavity.position.set(EAR_W.x, EAR_W.y + 1.2, EARDRUM_Z - 1.2);
  earSet.add(cavity);
  const eardrum = new THREE.Group();
  eardrum.position.set(EAR_W.x, EAR_W.y, EARDRUM_Z);
  earSet.add(eardrum);
  const drum = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.18, 20, 1, true), mat(C["f6757a"], { roughness: 0.6 }));
  drum.rotation.x = Math.PI / 2;
  eardrum.add(drum);
  const bone = mat(C["ead4aa"], { roughness: 0.7 });
  box(eardrum, 0.16, 0.6, 0.16, 0, 0.12, -0.15, bone); // hammer
  box(eardrum, 0.2, 0.2, 0.5, 0, 0.45, -0.4, bone); // anvil
  box(eardrum, 0.14, 0.14, 0.5, 0, 0.45, -0.85, bone); // stirrup
  const cochleaMat = new THREE.MeshStandardMaterial({ color: C["f6757a"], emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0, roughness: 0.6 });
  const spiral: THREE.Vector3[] = [];
  for (let k = 0; k <= 60; k++) { const a = (k / 60) * 5 * Math.PI, r = 0.9 * (1 - k / 75); spiral.push(new THREE.Vector3(Math.cos(a) * r, 0.45 + Math.sin(a) * r, -1.6 - k * 0.012)); }
  const cochlea = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 120, 0.18, 6), cochleaMat);
  cochlea.position.set(0, 0, 0);
  earSet.add(cochlea);
  cochlea.position.set(EAR_W.x + 0.6, EAR_W.y, 0);
  cochlea.position.z = EARDRUM_Z;
  earSet.visible = false;

  // ---------------------------------------------------------------- the speaker: built lying on its back (baffle at y = 0), then stood up to face +x
  const spk = new THREE.Group();
  spk.matrixAutoUpdate = false;
  // world = (local y, 16 - local z, local x): the baffle faces +x, the tweeter sits above the woofer, the cut corner faces the camera
  spk.matrix.set(0, 1, 0, 0, 0, 0, -1, 16, 1, 0, 0, 0, 0, 0, 0, 1);
  scene.add(spk);

  // ---------------------------------------------------------------- the box: walls with the front-right corner cut away
  const veneer = mat(C["262b44"], { roughness: 0.6 }); // a black speaker box
  const mdf = mat(C["c28569"], { roughness: 1 }); // the cut edges of the panels
  const { x0, x1, z0, z1, y0, wall: t } = BOX;
  const slab = (xa: number, xb: number, ya: number, yb: number, za: number, zb: number, m: THREE.Material = veneer) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, yb - ya, zb - za), m);
    b.position.set((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2);
    b.castShadow = b.receiveShadow = true;
    spk.add(b);
    return b;
  };
  slab(x0, x1, y0, y0 + t, z0, z1); // bottom (on the bench)
  slab(x0, x0 + t, y0, -t, z0, z1); // left wall
  slab(x0, x1, y0, -t, z0, z0 + t); // back wall
  slab(x0, 0, y0, -t, z1 - t, z1); // front wall, left half only
  slab(x1 - t, x1, y0, -t, z0, WZ); // right wall, back part only
  // the lining inside, dark, so the cut shows a hollow box
  const lining = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 2 * t - 0.2, -y0 - 2 * t - 0.2, z1 - z0 - 2 * t - 0.2), mat(C["262b44"], { side: THREE.BackSide, roughness: 1 }));
  lining.position.set(0, (y0 - t) / 2 + 0.0, (z0 + z1) / 2);
  lining.receiveShadow = true;
  spk.add(lining);
  // the baffle: a slab with the woofer and tweeter holes, the cut quarter removed
  const baffle = new THREE.Shape();
  const Rh = SURROUND_R + 0.6;
  // shape coordinates (x, -z): the shape is made in XY and turned to lie flat (y up), so shape y = -z
  baffle.moveTo(x0, -z0);
  baffle.lineTo(x0, -z1);
  baffle.lineTo(0, -z1);
  baffle.lineTo(0, -(WZ + Rh));
  // round the woofer hole the long way: from the front (+z), through -x and the back, to +x
  baffle.absarc(0, -WZ, Rh, -Math.PI / 2, 0, true);
  baffle.lineTo(x1, -WZ);
  baffle.lineTo(x1, -z0);
  baffle.lineTo(x0, -z0);
  const th = new THREE.Path();
  th.absarc(0, -TZ, 3.8, 0, Math.PI * 2, true);
  baffle.holes.push(th);
  const baffleGeo = new THREE.ExtrudeGeometry(baffle, { depth: t, bevelEnabled: false, curveSegments: 48 });
  baffleGeo.rotateX(-Math.PI / 2); // shape XY -> XZ (y -> -z), extruded upwards
  baffleGeo.translate(0, -t, 0);
  const baffleMesh = new THREE.Mesh(baffleGeo, [mat(C["3a4466"], { roughness: 0.6 }), mdf]);
  baffleMesh.castShadow = baffleMesh.receiveShadow = true;
  spk.add(baffleMesh);

  // ---------------------------------------------------------------- the woofer
  const woofer = new THREE.Group();
  woofer.position.set(0, 0, WZ);
  spk.add(woofer);
  const steel = mat(C["8b9bb4"], { metalness: 0.4, roughness: 0.45 });
  const steelCut = mat(C["8b9bb4"], { metalness: 0.2, roughness: 0.5 });
  const magnetMat = mat(C["a22633"], { roughness: 0.7 });
  const magnetCut = mat(C["e43b44"], { roughness: 0.7 });
  // magnet assembly (fixed): top plate, ring magnet, back plate with the pole piece
  woofer.add(cutSolid([[3.0, -9.0], [8.0, -9.0], [8.0, -10.0], [3.0, -10.0]], steel, steelCut)); // top plate
  woofer.add(cutSolid([[3.6, -10.0], [8.2, -10.0], [8.2, -13.4], [3.6, -13.4]], magnetMat, magnetCut)); // ring magnet
  woofer.add(cutSolid([[0.001, -13.4], [8.2, -13.4], [8.2, -14.4], [0.001, -14.4]], steel, steelCut)); // back plate
  woofer.add(cutSolid([[0.001, -8.4], [2.5, -8.4], [2.5, -13.4], [0.001, -13.4]], steel, steelCut)); // pole piece
  // the basket: a cast frame from the magnet to the rim, and the rim ring on the baffle
  const basket = mat(C["5a6988"], { metalness: 0.3, roughness: 0.5 });
  woofer.add(band([[7.0, -9.0], [10.0, -6.5], [12.0, -1.2], [12.6, -0.6]], 0.5, basket));
  woofer.add(cutSolid([[11.0, -0.9], [12.6, -0.9], [12.6, -0.2], [11.0, -0.2]], basket));
  // the moving parts
  const moving = new THREE.Group();
  woofer.add(moving);
  const paper = mat(C["8b9bb4"], { roughness: 0.95 });
  const paperCut = mat(C["8b9bb4"], { roughness: 1 });
  const coneLine: [number, number][] = [];
  for (let k = 0; k <= 8; k++) { const r = CONE.r0 + ((CONE.r1 - CONE.r0) * k) / 8; coneLine.push([r, coneY(r)]); }
  moving.add(band(coneLine, 0.3, paper, paperCut));
  // the surround: a half roll of rubber from the cone's edge to the rim
  const roll: [number, number][] = [];
  for (let k = 0; k <= 8; k++) { const a = Math.PI - (Math.PI * k) / 8; roll.push([(CONE.r1 + SURROUND_R) / 2 + Math.cos(a) * 0.45, CONE.y1 + Math.sin(a) * 0.5]); }
  moving.add(band(roll, 0.22, mat(C["262b44"], { roughness: 0.6 }), paperCut));
  // dust cap
  const cap: [number, number][] = [];
  for (let k = 0; k <= 8; k++) { const a = (Math.PI / 2) * (k / 8); cap.push([0.001 + Math.sin(a) * CONE.r0, CONE.y0 + Math.cos(a) * 1.4]); }
  moving.add(band(cap.reverse(), 0.25, mat(C["181425"], { roughness: 0.5 }), paperCut));
  // the coil former and the coil (copper, glows with the current)
  moving.add(band([[2.75, CONE.y0], [2.75, -10.4]], 0.12, mat(C["ead4aa"], { roughness: 0.8 })));
  const coilMat = new THREE.MeshStandardMaterial({ color: C["d77643"], emissive: new THREE.Color(C["feae34"]), emissiveIntensity: 0, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  moving.add(cutSolid([[2.62, -8.6], [2.92, -8.6], [2.92, -10.3], [2.62, -10.3]], coilMat));
  // the spider: a corrugated ring that keeps the coil centred
  const spider: [number, number][] = [];
  for (let k = 0; k <= 12; k++) { const r = 2.85 + (4.6 * k) / 12; spider.push([r, -7.3 + 0.25 * Math.sin(k * Math.PI)]); }
  moving.add(band(spider, 0.15, mat(C["feae34"], { roughness: 1 })));

  // ---------------------------------------------------------------- the tweeter: a small dome in a faceplate
  const tw = new THREE.Group();
  tw.position.set(0, 0, TZ);
  spk.add(tw);
  const tweeterRing = new THREE.MeshStandardMaterial({ color: C["3a4466"], emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0, roughness: 0.5, metalness: 0.3 });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.8, 32), tweeterRing);
  face.position.y = 0.4;
  face.castShadow = face.receiveShadow = true;
  tw.add(face);
  const tweeterMat = new THREE.MeshStandardMaterial({ color: C["c0cbdc"], emissive: new THREE.Color(C["fee761"]), emissiveIntensity: 0, roughness: 0.25, metalness: 0.6 });
  const tweeterDome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), tweeterMat);
  tweeterDome.scale.y = 0.6;
  tweeterDome.position.y = 0.8;
  tw.add(tweeterDome);

  return { renderer, scene, camera, moving, tweeterDome, tweeterMat, tweeterRing, coilMat, phoneScreen, cableMat, dots, rings, ringMats, headShell, eardrum, cochleaMat, earSet };
}
