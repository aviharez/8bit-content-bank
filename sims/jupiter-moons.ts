// Io, Europa and Ganymede in the Laplace resonance.
// Mean motions from the IMCCE periods (1.769138, 3.551181, 7.154553 days) satisfy
//   n_Io - 3 n_Europa + 2 n_Ganymede = 0,
// so the three conjunction rates (Io-Europa, Europa-Ganymede, Io-Ganymede) are exactly 2 : 1 : 3.
// The Laplace angle  lambda_Io - 3 lambda_Europa + 2 lambda_Ganymede = 180 deg  means the three never line up at once.
//
// Clock: one Europa-Ganymede synodic period (~7.05 days) = 6 beats at 150 BPM (2.4 s). A uniform speed-up, not a warp.
// With 6 beats per cycle the three conjunction rates (1, 2 and 3 per cycle) all land on the 8th-note grid:
//   Europa-Ganymede on beat 0, Io-Ganymede on beats 1, 3, 5, Io-Europa on beats 1.5 and 4.5.
// The 6-beat cycle runs against 4-beat bars (a techno polymeter); 96 beats = 24 bars = 16 cycles, so it loops.
// The view rotates slowly with the system (-0.74 deg/day) so the configuration repeats every cycle exactly.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const FPB = (60 / BPM) * FPS; // 12 frames per beat
const BAR = FPB * 4; // 48
const CYCLE = FPB * 6; // 72 frames = one Europa-Ganymede cycle
export const BARS = 24;
export const TOTAL_FRAMES = BARS * BAR; // 1152 = 38.4 s = 16 cycles

// Use the Laplace-consistent mean motions (deg/day). Ganymede and Europa from IMCCE periods;
// Io then follows from n_Io = 3 n_E - 2 n_G (differs from 360/1.769138 by under 0.001 deg/day).
const nE = 360 / 3.551181;
const nG = 360 / 7.154553;
const nI = 3 * nE - 2 * nG;
export const MOTION = { io: nI, europa: nE, ganymede: nG };

const SYN_EG = 360 / (nE - nG); // days per cycle
const DAYS_PER_SEC = SYN_EG / (CYCLE / FPS);
const OMEGA_VIEW = nG - 360 / SYN_EG; // view rotation (deg/day) that makes each cycle repeat exactly

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
  JSON.stringify({ fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, cycleFrames: CYCLE, daysPerCycle: SYN_EG, daysPerSec: DAYS_PER_SEC, radius: RADIUS, motion: MOTION, omegaView: OMEGA_VIEW, frames, events }),
);
const laplace = (lonAt(0).io - 3 * lonAt(0).europa + 2 * lonAt(0).ganymede + 3600) % 360;
console.log(`n: Io ${nI.toFixed(4)}, Europa ${nE.toFixed(4)}, Ganymede ${nG.toFixed(4)} deg/day; Io period ${(360 / nI).toFixed(6)} d (IMCCE 1.769138)`);
console.log(`1 cycle (6 beats) = ${SYN_EG.toFixed(4)} days; view rotation ${OMEGA_VIEW.toFixed(4)} deg/day; Laplace angle ${laplace} deg`);
const perCycle = (p: Pair) => events.filter((e) => e.pair === p).length / (TOTAL_FRAMES / CYCLE);
console.log(`conjunctions per cycle: IE ${perCycle("IE")}, EG ${perCycle("EG")}, IG ${perCycle("IG")}`);
console.log("first cycle beats:", events.filter((e) => e.beat < 6).map((e) => `${e.pair}@${e.beat.toFixed(3)}`).join(" "));
const end = lonAt(DUR_DAYS), start = lonAt(0);
console.log("loop check (start vs end longitudes):", start, end);

const offGrid = events.filter((e) => Math.abs(e.beat * 2 - Math.round(e.beat * 2)) > 1e-6).length;
console.log(`events off the 8th-note grid: ${offGrid} of ${events.length}`);
