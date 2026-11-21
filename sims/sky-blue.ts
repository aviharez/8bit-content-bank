// Why is the sky blue? (And why are sunsets red?) Rayleigh scattering by air molecules.
// The air's optical depth for scattering, straight up, is about tau(lambda) = 0.0088 * lambda^-4 (lambda in micrometres):
// 0.215 at 450 nm (blue), 0.096 at 550 nm (green), 0.049 at 650 nm (red), so blue scatters (650/450)^4 = 4.35x more than red.
// Sunlight crossing the atmosphere at sun elevation e goes through X(e) air masses (Kasten & Young 1989):
//   X = 1 / (sin e + 0.50572 (e + 6.07995 deg)^-1.6364),  1 overhead, about 38 at the horizon.
// What gets through (the sun's colour):          T(lambda) = exp(-tau X)
// What lights the sky near you (single scattering of that light): S(lambda) ~ tau * exp(-tau X)
// Overhead sun: S is mostly blue. Sun on the horizon: the blue is gone before it reaches you; S and T are red.
//
// Photons (drawn): every 8th note the sun sends one red, one green and one blue photon towards the listener on the hill.
// Each one either crosses the whole path or is scattered on the way: it scatters with probability 1 - exp(-tau X), at a
// point drawn from the same exponential law (seeded). Scattered photons fly off into the sky: their scatter is a bell
// note; photons that reach her are lead notes. Both snapped to the nearest 16th.
// Clock: 150 BPM, 30 fps, 12 frames per beat, 24 bars = 38.4 s. Sun: 32 deg up (bars 0-7), setting (8-11), on the horizon
// at the drop (bar 12), sinking into it (12-19), then a time-lapse back up to the morning sky (20-23) for the loop.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30, BPM = 150;
const SPB = 60 / BPM, FPB = SPB * FPS; // 12
export const BARS = 24;
const BEATS = BARS * 4;
export const TOTAL_FRAMES = BEATS * FPB;
export const SET_BAR = 8, DROP_BAR = 12, RISE_BAR = 20;

const LAMBDA = { red: 0.65, green: 0.55, blue: 0.45 } as const;
type Col = keyof typeof LAMBDA;
const COLS: Col[] = ["red", "green", "blue"];
const tau = (um: number) => 0.0088 * um ** -4;
const airmass = (eDeg: number) => {
  const e = Math.max(0, eDeg); // half the sun below the horizon: use the horizon value
  return 1 / (Math.sin((e * Math.PI) / 180) + 0.50572 * (e + 6.07995) ** -1.6364);
};
const smooth = (u: number) => u * u * (3 - 2 * u);
/** sun elevation (degrees) by beat */
function sunAt(b: number) {
  if (b < SET_BAR * 4) return 32;
  if (b < DROP_BAR * 4) return 32 - 32 * smooth((b - SET_BAR * 4) / ((DROP_BAR - SET_BAR) * 4)); // setting: 32 -> 0 at the drop
  if (b < RISE_BAR * 4) return -0.25 * smooth((b - DROP_BAR * 4) / ((RISE_BAR - DROP_BAR) * 4)); // sinking into the horizon (disk radius 0.27 deg)
  return -0.25 + 32.25 * smooth((b - RISE_BAR * 4) / ((BARS - RISE_BAR) * 4)); // the next morning (time-lapse)
}

// per frame: sun, air masses, colours of the sun and the sky (relative, per colour), and how much blue gets through
const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const b = f / FPB, e = sunAt(b), X = airmass(e);
  const T: Record<Col, number> = { red: 0, green: 0, blue: 0 }, Sk: Record<Col, number> = { red: 0, green: 0, blue: 0 };
  for (const c of COLS) { const t = tau(LAMBDA[c]); T[c] = Math.exp(-t * X); Sk[c] = t * Math.exp(-t * X); }
  return { sun: e, X, pathKm: X * 8.4, T, sky: Sk };
});

// photons: one of each colour per 8th note, flying from the sun to her in 1 beat (drawn), scattered or not
let seed = 450;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
type Photon = { beat: number; col: Col; scatterAt: number | null; dir: [number, number, number]; noteBeat: number };
const photons: Photon[] = [];
for (let k = 0; k < BEATS * 2; k++) {
  const beat = k / 2;
  const X = airmass(sunAt(beat));
  for (const col of COLS) {
    const t = tau(LAMBDA[col]) * X;
    const r = rnd();
    const depth = -Math.log(1 - r); // optical depth at which it scatters
    const scatterAt = depth < t ? depth / t : null; // fraction of the path
    const th = rnd() * Math.PI * 2, ph = rnd() * Math.PI * 0.8 + 0.1;
    const dir: [number, number, number] = [Math.cos(th) * Math.sin(ph), Math.cos(ph) * 0.6 + 0.2, Math.sin(th) * Math.sin(ph)];
    const noteBeat = Math.round((beat + (scatterAt ?? 1)) * 4) / 4;
    photons.push({ beat, col, scatterAt, dir, noteBeat });
  }
}

const kicks: number[] = [], claps: number[] = [];
for (let b = 0; b < BARS; b++) {
  for (let q = 0; q < 4; q++) if (!(b === DROP_BAR - 1 && q === 3)) kicks.push(b * 4 + q);
  claps.push(b * 4 + 1, b * 4 + 3);
}

mkdirSync("public/sky-blue", { recursive: true });
writeFileSync("public/sky-blue/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, setBar: SET_BAR, dropBar: DROP_BAR, riseBar: RISE_BAR,
  tau: Object.fromEntries(COLS.map((c) => [c, tau(LAMBDA[c])])), frames, photons, kicks, claps,
}));

const share = (from: number, to: number, col: Col) => {
  const ps = photons.filter((p) => p.beat >= from && p.beat < to && p.col === col);
  return `${col} through ${(100 * ps.filter((p) => p.scatterAt === null).length / ps.length).toFixed(0)}%`;
};
console.log(`tau red/green/blue: ${COLS.map((c) => tau(LAMBDA[c]).toFixed(3)).join(" ")}; blue/red = ${(tau(0.45) / tau(0.65)).toFixed(2)}`);
console.log(`air masses: day ${airmass(32).toFixed(2)}, 20 deg ${airmass(20).toFixed(2)}, 5 deg ${airmass(5).toFixed(1)}, horizon ${airmass(0).toFixed(1)}`);
console.log("photons, day:", COLS.map((c) => share(0, 32, c)).join(", "));
console.log("photons, sunset:", COLS.map((c) => share(48, 80, c)).join(", "));
const f0 = frames[0], fs = frames[DROP_BAR * 4 * FPB];
console.log("sky noon (r,g,b):", COLS.map((c) => f0.sky[c].toFixed(4)).join(" "), " sky at the drop:", COLS.map((c) => fs.sky[c].toExponential(2)).join(" "));
console.log("sun colour at the drop (T):", COLS.map((c) => fs.T[c].toExponential(2)).join(" "));
