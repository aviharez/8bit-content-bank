import * as THREE from "three";
import { C, PALETTE } from "../../lib/palette";

const hex = (i: number) => `#${PALETTE[i]}`;

// Display radii. Real orbits are 5.9 : 9.4 : 15.0 Jupiter radii; drawn closer so all three fit a phone screen.
// Angles and timing are exact; sizes and distances are not to scale.
export const ORBIT = { io: 4.2, europa: 6.2, ganymede: 8.6 };
export const MOON_R = { io: 0.42, europa: 0.38, ganymede: 0.58 };
export type Moon = keyof typeof ORBIT;
export const MOONS: Moon[] = ["io", "europa", "ganymede"];

function tex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type JupiterScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  jupiter: THREE.Mesh;
  moons: Record<Moon, THREE.Mesh>;
  moonMats: Record<Moon, THREE.MeshStandardMaterial>;
  beams: Record<"IE" | "EG" | "IG", THREE.Mesh>;
};

/** Jupiter, three moons on their rings, and a beam for each kind of conjunction. */
export function buildJupiterScene(width: number, height: number): JupiterScene {
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C["181425"]);
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);

  scene.add(new THREE.AmbientLight(C["3a4466"], 1.2));
  const sun = new THREE.DirectionalLight(C["ead4aa"], 3.0);
  sun.position.set(-20, 6, 8);
  scene.add(sun);

  // stars: a fixed, seeded field (identical every frame)
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pts: number[] = [];
  for (let i = 0; i < 700; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), r = 80;
    pts.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: C["c0cbdc"], size: 1, sizeAttenuation: false })));

  // Jupiter: banded, so its 10-hour spin needs no animation to stay truthful
  const bands = tex(8, 32, (g) => {
    const rows = [30, 3, 30, 4, 2, 3, 31, 2, 3, 4, 30, 3, 31, 30];
    rows.forEach((ci, i) => { g.fillStyle = hex(ci); g.fillRect(0, Math.floor((i * 32) / rows.length), 8, Math.ceil(32 / rows.length) + 1); });
  });
  const jupiter = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), new THREE.MeshStandardMaterial({ map: bands, roughness: 0.9 }));
  scene.add(jupiter);

  // orbit rings
  const ringColor: Record<Moon, string> = { io: C["f77622"], europa: C["c0cbdc"], ganymede: C["8b9bb4"] };
  for (const m of MOONS) {
    const pts2: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts2.push(new THREE.Vector3(Math.cos(a) * ORBIT[m], 0, -Math.sin(a) * ORBIT[m])); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), new THREE.LineBasicMaterial({ color: ringColor[m], transparent: true, opacity: 0.45 })));
  }

  const moonColor: Record<Moon, string> = { io: C["feae34"], europa: C["ead4aa"], ganymede: C["8b9bb4"] };
  const moonMats = {} as Record<Moon, THREE.MeshStandardMaterial>;
  const moons = {} as Record<Moon, THREE.Mesh>;
  for (const m of MOONS) {
    moonMats[m] = new THREE.MeshStandardMaterial({ color: moonColor[m], roughness: 0.8, emissive: new THREE.Color(C["ffffff"]), emissiveIntensity: 0 });
    moons[m] = new THREE.Mesh(new THREE.SphereGeometry(MOON_R[m], 14, 10), moonMats[m]);
    scene.add(moons[m]);
  }

  // beams: thin boxes from Jupiter's surface out to the outer moon of the pair
  const beam = (color: string, len: number) => {
    const g = new THREE.BoxGeometry(len, 0.12, 0.12);
    g.translate(len / 2 + 1.7, 0, 0);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
    scene.add(mesh);
    return mesh;
  };
  const beams = {
    IE: beam(C["fee761"], ORBIT.europa - 1.7),
    EG: beam(C["e43b44"], ORBIT.ganymede - 1.7),
    IG: beam(C["2ce8f5"], ORBIT.ganymede - 1.7),
  };

  return { renderer, scene, camera, jupiter, moons, moonMats, beams };
}
