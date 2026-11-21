// Io, Europa and Ganymede in the Laplace resonance.
// Mean motions from the IMCCE periods (1.769138, 3.551181, 7.154553 days) satisfy
//   n_Io - 3 n_Europa + 2 n_Ganymede = 0,
// so the three conjunction rates (Io-Europa, Europa-Ganymede, Io-Ganymede) are exactly 2 : 1 : 3.
// The Laplace angle  lambda_Io - 3 lambda_Europa + 2 lambda_Ganymede = 180 deg  means the three never line up at once.
//
// Clock: 1 bar (4 beats at 180 BPM = 4/3 s) = one Europa-Ganymede synodic period (~7.05 days).
// That is a uniform speed-up, not a warp. The view rotates slowly with the system (-0.74 deg/day) so the
// whole configuration repeats every bar and the video loops exactly.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 180;
const FPB = (60 / BPM) * FPS; // 10 frames per beat
const BAR = FPB * 4; // 40
export const BARS = 24;
export const TOTAL_FRAMES = BARS * BAR; // 960 = 32 s

// Use the Laplace-consistent mean motions (deg/day). Ganymede and Europa from IMCCE periods;
// Io then follows from n_Io = 3 n_E - 2 n_G (differs from 360/1.769138 by under 0.001 deg/day).
const nE = 360 / 3.551181;
const nG = 360 / 7.154553;
const nI = 3 * nE - 2 * nG;
export const MOTION = { io: nI, europa: nE, ganymede: nG };

const SYN_EG = 360 / (nE - nG); // days per bar
const DAYS_PER_SEC = SYN_EG / (BAR / FPS);
const OMEGA_VIEW = nG - 360 / SYN_EG; // view rotation (deg/day) that makes each bar repeat exactly

// Orbit radii in Jupiter radii (421,700 / 671,034 / 1,070,412 km over 71,492 km)
export const RADIUS = { io: 5.90, europa: 9.39, ganymede: 14.97 };

// t = 0: Europa and Ganymede in conjunction at longitude 0, Io opposite them (Laplace angle 180 deg)
const lon0 = { io: 180, europa: 0, ganymede: 0 };
const lonAt = (days: number) => ({
  io: (lon0.io + (nI - OMEGA_VIEW) * days) % 360,
  europa: (lon0.europa + (nE - OMEGA_VIEW) * days) % 360,
  ganymede: (lon0.ganymede + (nG - OMEGA_VIEW) * days) % 360,
});

const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const days = (f / FPS) * DAYS_PER_SEC;
  return { days, lon: lonAt(days) };
});

// Conjunctions: when two moons share a longitude. Rates in conjunctions per day.
type Pair = "IE" | "EG" | "IG";
const rate: Record<Pair, number> = { IE: (nI - nE) / 360, EG: (nE - nG) / 360, IG: (nI - nG) / 360 };
// phase: first conjunction after t = 0 (EG at t = 0; IE and IG half a synodic period later, since Io starts opposite)
const first: Record<Pair, number> = { EG: 0, IE: 0.5 / rate.IE, IG: 0.5 / rate.IG };
const DUR_DAYS = (TOTAL_FRAMES / FPS) * DAYS_PER_SEC;
const events: { sec: number; pair: Pair; beat: number; lon: number }[] = [];
for (const pair of ["EG", "IE", "IG"] as Pair[]) {
  for (let d = first[pair]; d < DUR_DAYS - 1e-9; d += 1 / rate[pair]) {
    const sec = d / DAYS_PER_SEC;
    const l = lonAt(d);
    events.push({ sec, pair, beat: sec / (60 / BPM), lon: pair === "IG" ? l.io : l.europa });
  }
}
events.sort((a, b) => a.sec - b.sec);

mkdirSync("public/jupiter-moons", { recursive: true });
writeFileSync(
  "public/jupiter-moons/timeline.json",
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, daysPerBar: SYN_EG, daysPerSec: DAYS_PER_SEC, radius: RADIUS, motion: MOTION, omegaView: OMEGA_VIEW, frames, events }),
);
const laplace = (lonAt(0).io - 3 * lonAt(0).europa + 2 * lonAt(0).ganymede + 3600) % 360;
console.log(`n: Io ${nI.toFixed(4)}, Europa ${nE.toFixed(4)}, Ganymede ${nG.toFixed(4)} deg/day; Io period ${(360 / nI).toFixed(6)} d (IMCCE 1.769138)`);
console.log(`1 bar = ${SYN_EG.toFixed(4)} days; view rotation ${OMEGA_VIEW.toFixed(4)} deg/day; Laplace angle ${laplace} deg`);
const perBar = (p: Pair) => events.filter((e) => e.pair === p).length / BARS;
console.log(`conjunctions per bar: IE ${perBar("IE")}, EG ${perBar("EG")}, IG ${perBar("IG")}`);
console.log("first bar beats:", events.filter((e) => e.beat < 4).map((e) => `${e.pair}@${e.beat.toFixed(3)}`).join(" "));
const end = lonAt(DUR_DAYS), start = lonAt(0);
console.log("loop check (start vs end longitudes):", start, end);
