import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";
import { PIXEL_FONT } from "../../lib/fonts";

// World units are metres. The back wall is z = 0 (facing +z), the floor y = 0, x to the right. The calendar hangs on
// the back wall right of the door; the camera stands at the far end of the room, looking at it over the crowd.
export const CAL = { x0: -1.0, x1: 2.6, y0: 1.7, y1: 6.5 }; // the calendar's corners on the wall (3:4, like its texture)
export const DOOR = { x0: -2.9, x1: -1.8, h: 2.3 }; // a door in the back wall, left of the calendar
export const TEX = { w: 192, h: 256, panel: 64, cell: 8 }; // calendar texture: 3 x 4 month panels of 64 px

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

/** A day tile's place in the calendar texture (pixels, its centre) and on the wall (metres). */
export function tilePx(month: number, dom: number) {
  const col = month % 3, row = Math.floor(month / 3);
  const x = col * TEX.panel + 4 + (dom % 7) * TEX.cell + TEX.cell / 2;
  const y = row * TEX.panel + 15 + Math.floor(dom / 7) * TEX.cell + TEX.cell / 2;
  return { x, y };
}
export function tileWorld(month: number, dom: number) {
  const p = tilePx(month, dom);
  return new THREE.Vector3(CAL.x0 + (p.x / TEX.w) * (CAL.x1 - CAL.x0), CAL.y1 - (p.y / TEX.h) * (CAL.y1 - CAL.y0), 0.03);
}

export type TileState = { colour: string | null; flash: number; matched: boolean };
/** Paint the calendar: 12 month panels (lit or dark), 365 day tiles. */
export function paintCalendar(g: CanvasRenderingContext2D, months: string[], monthLen: number[], panelOn: number[],
  tile: (day: number) => TileState) {
  g.fillStyle = C["181425"];
  g.fillRect(0, 0, TEX.w, TEX.h);
  let day = 0;
  for (let m = 0; m < 12; m++) {
    const col = m % 3, row = Math.floor(m / 3);
    const px = col * TEX.panel, py = row * TEX.panel;
    const on = panelOn[m];
    g.fillStyle = on > 0.5 ? C["262b44"] : C["181425"];
    g.fillRect(px + 2, py + 2, TEX.panel - 4, TEX.panel - 4);
    g.fillStyle = on > 1 ? C["ffffff"] : on > 0.5 ? C["5a6988"] : C["262b44"];
    g.fillRect(px + 2, py + 2, TEX.panel - 4, 1);
    g.font = `8px "${PIXEL_FONT}"`;
    g.textBaseline = "top";
    g.fillStyle = on > 1 ? C["ffffff"] : on > 0.5 ? C["c0cbdc"] : C["3a4466"];
    g.fillText(months[m], px + 20, py + 5);
    for (let d = 0; d < monthLen[m]; d++, day++) {
      const t = tilePx(m, d);
      const s = tile(day);
      let c = on > 0.5 ? C["3a4466"] : C["262b44"];
      if (s.colour) c = s.colour;
      if (s.matched) c = C["ff0044"];
      if (s.flash > 0) c = C["ffffff"];
      g.fillStyle = c;
      g.fillRect(t.x - 3, t.y - 3, 7, 7);
    }
  }
}

export type PartyScene = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  calCanvas: HTMLCanvasElement; calTex: THREE.CanvasTexture;
  door: THREE.Group; doorLight: THREE.PointLight;
  bulbs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; on: string; off: string }[];
  guests: THREE.Group[];
};

const GUEST_COLOURS = ["e43b44", "feae34", "63c74d", "0099db", "b55088", "f77622", "2ce8f5", "fee761", "f6757a", "124e89"] as const;
export const guestColour = (n: number) => C[GUEST_COLOURS[(n * 7) % GUEST_COLOURS.length]];

function person(colour: string) {
  const g = new THREE.Group();
  const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.24), mat(C["3a4466"]));
  legs.position.y = 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.3), mat(colour));
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), mat(C["e8b796"]));
  head.position.y = 1.25;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), mat(C["3e2731"]));
  hair.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), mat(colour)); // a party hat
  hat.position.y = 1.64;
  g.add(legs, body, head, hair, hat);
  return g;
}

export function buildScene(width: number, height: number, guestCount: number): PartyScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);

  scene.add(new THREE.HemisphereLight(C["c0cbdc"], C["3a4466"], 1.6));
  const key = new THREE.DirectionalLight(C["ffffff"], 1.2);
  key.position.set(3, 8, 10);
  scene.add(key);

  // ---------------------------------------------------------------- the room
  const floorTex = tex(16, (g) => {
    g.fillStyle = hex(4); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(5); g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(5, 0, 1, 8); g.fillRect(12, 8, 1, 8);
  }, 8, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 6);
  scene.add(floor);
  const wallTex = tex(16, (g) => {
    g.fillStyle = hex(27); g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(6); g.fillRect(0, 0, 2, 16); g.fillRect(8, 0, 1, 16);
  }, 12, 6);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  back.position.set(0, 4.5, 0);
  scene.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
    side.rotation.y = -sx * Math.PI / 2;
    side.position.set(sx * 4.2, 4.5, 6);
    scene.add(side);
  }
  // skirting board
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: C["3e2731"] }));
  skirt.position.set(0, 0.09, 0.03);
  scene.add(skirt);

  // ---------------------------------------------------------------- the calendar
  const calCanvas = document.createElement("canvas");
  calCanvas.width = TEX.w; calCanvas.height = TEX.h;
  const calTex = new THREE.CanvasTexture(calCanvas);
  calTex.magFilter = calTex.minFilter = THREE.NearestFilter;
  calTex.generateMipmaps = false;
  calTex.colorSpace = THREE.SRGBColorSpace;
  const cw = CAL.x1 - CAL.x0, ch = CAL.y1 - CAL.y0;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.2, ch + 0.2, 0.05), new THREE.MeshStandardMaterial({ color: C["733e39"] }));
  frame.position.set((CAL.x0 + CAL.x1) / 2, (CAL.y0 + CAL.y1) / 2, 0.01);
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: calTex }));
  cal.position.set((CAL.x0 + CAL.x1) / 2, (CAL.y0 + CAL.y1) / 2, 0.04);
  scene.add(frame, cal);

  // ---------------------------------------------------------------- the door (swings open toward the room)
  const doorW = DOOR.x1 - DOOR.x0;
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(doorW, DOOR.h), new THREE.MeshBasicMaterial({ color: C["fee761"] }));
  gap.position.set((DOOR.x0 + DOOR.x1) / 2, DOOR.h / 2, 0.005); // the lit hallway behind it
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, DOOR.h + 0.1, 0.04), new THREE.MeshStandardMaterial({ color: C["3e2731"] }));
  jamb.position.set((DOOR.x0 + DOOR.x1) / 2, (DOOR.h + 0.1) / 2, 0.0);
  const door = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW, DOOR.h, 0.06), new THREE.MeshStandardMaterial({ color: C["b86f50"], roughness: 0.8 }));
  leaf.position.set(doorW / 2, DOOR.h / 2, 0);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: C["feae34"] }));
  knob.position.set(doorW - 0.15, 1.05, 0.06);
  door.add(leaf, knob);
  door.position.set(DOOR.x0, 0, 0.05);
  scene.add(jamb, gap, door);
  const doorLight = new THREE.PointLight(C["fee761"], 0, 6, 1.5);
  doorLight.position.set((DOOR.x0 + DOOR.x1) / 2, 1.6, 0.6);
  scene.add(doorLight);

  // ---------------------------------------------------------------- party lights: a string of bulbs over the calendar and down its side
  const bulbs: PartyScene["bulbs"] = [];
  const bulbCols = [["e43b44", "733e39"], ["feae34", "733e39"], ["63c74d", "265c42"], ["0099db", "124e89"]] as const;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push(new THREE.Vector3(CAL.x0 - 0.9 + u * (cw + 1.8), CAL.y1 + 0.45 - Math.sin(u * Math.PI) * 0.3, 0.15)); }
  for (let k = 1; k <= 5; k++) pts.push(new THREE.Vector3(CAL.x1 + 0.6, CAL.y1 + 0.3 - k * 0.9, 0.15));
  pts.forEach((p, k) => {
    const [on, off] = bulbCols[k % 4];
    const mat = new THREE.MeshBasicMaterial({ color: C[off] });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat);
    mesh.position.copy(p);
    scene.add(mesh);
    bulbs.push({ mesh, mat, on: C[on], off: C[off] });
  });
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C["262b44"] }));
  scene.add(wire);

  // ---------------------------------------------------------------- a cake table at the right, for the party
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: C["ead4aa"] }));
  table.position.set(3.2, 0.4, 1.0);
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), new THREE.MeshStandardMaterial({ color: C["f6757a"] }));
  cake.position.set(3.2, 0.95, 1.0);
  scene.add(table, cake);

  // ---------------------------------------------------------------- the guests
  const guests: THREE.Group[] = [];
  for (let n = 1; n <= guestCount; n++) {
    const p = person(guestColour(n));
    p.visible = false;
    scene.add(p);
    guests.push(p);
  }
  return { renderer, scene, camera, calCanvas, calTex, door, doorLight, bulbs, guests };
}

/** Where guest n stands: rows filling from the wall toward the camera, jittered so it reads as a crowd. */
export function spot(n: number) {
  const k = n - 1;
  const perRow = 12;
  const row = Math.floor(k / perRow), col = k % perRow;
  const h = (x: number) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
  const x = -3.4 + (col + (row % 2) * 0.5) * 0.6 + (h(n) - 0.5) * 0.2;
  const z = 1.0 + row * 0.7 + (h(n + 99) - 0.5) * 0.2;
  return new THREE.Vector3(x, 0, z);
}
export const DOOR_SPOT = new THREE.Vector3((DOOR.x0 + DOOR.x1) / 2, 0, 0.35);
