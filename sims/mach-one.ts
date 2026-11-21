// What does Mach 1 sound like? A jet's engine sound spreads at c = 343 m/s while the jet flies at speed v = M c.
// Ahead of the jet the wavefronts pile up: a listener straight ahead hears the engine Doppler-shifted by
//   k = 1 / (1 - M)
// At M = 1/2 that is 2x (an octave), M = 2/3 -> 3x, M = 3/4 -> 4x ... the harmonic series, up to infinity at M = 1:
// every front arrives at once, the sonic boom. Past Mach 1 the fronts trail in a cone of half-angle asin(1/M); nothing
// is heard ahead, and each place hears one boom when the cone sweeps over it.
//
// Clock: hard techno at 150 BPM, 30 fps = 12 frames per beat. 24 bars = 38.4 s. Real time, no warp.
// The pilot throttles up in steps (a quarter-beat ramp each) so that the pitch heard ahead sits on a harmonic
// (2x, 3x, 4x, 6x, 8x ... D and A only, the notes of a D power chord) and each new harmonic starts on the grid.
// Engine tone: D1 (36.7 Hz); 2x = D2, 3x = A2, 4x = D3 ...
// Drop (bar 12): Mach 1, the jet breaks through its own piled-up fronts. Bars 12-19: Mach 1 -> 2. Towers stand beside
// the path, placed so the boom reaches each one
// exactly on a kick. Outro: back down through Mach 1 to Mach 0.5, so the loop starts where it ends.
// One ring per 8th note is drawn (the fronts are continuous; the rings sample them). 1 scene unit = 100 m.
import { mkdirSync, writeFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 150;
const SPB = 60 / BPM;
const FPB = SPB * FPS; // 12
export const BARS = 24;
const BEATS = BARS * 4;
export const TOTAL_FRAMES = BEATS * FPB; // 1152
export const DROP_BAR = 12, OUTRO_BAR = 20;
const C = 3.43; // units / s (343 m/s)
const ALT = 1.0; // flight altitude, units (100 m)

// ---------------------------------------------------------------- speed profile (Mach number by beat)
const kM = (k: number) => 1 - 1 / k;
// [beat the new harmonic starts, k]; the ramp to it takes the quarter beat before
const UP: [number, number][] = [[16, 3], [24, 4], [30, 6], [35, 8], [38, 12], [41, 16], [43, 24], [44.5, 32], [45.5, 48], [46.25, 64], [46.75, 96], [47.25, 128]];
const DOWN: [number, number][] = [[84.5, 64], [85, 32], [85.75, 16], [86.5, 8], [87.5, 6], [88.5, 4], [90, 3], [92, 2]];
const RAMP = 0.25;
const smooth = (u: number) => u * u * (3 - 2 * u);
function machAt(b: number): number {
  if (b < 16 - RAMP) return 0.5;
  if (b < 48) {
    if (b >= 47.25) return kM(128) + (1 - kM(128)) * ((b - 47.25) / 0.75) ** 2; // the last stretch to Mach 1
    let m = 0.5;
    for (const [at, k] of UP) {
      if (b >= at) m = kM(k);
      else if (b >= at - RAMP) m = m + (kM(k) - m) * smooth((b - (at - RAMP)) / RAMP);
    }
    return m;
  }
  if (b < 80) return 1 + (b - 48) / 32; // supersonic: Mach 1 -> 2
  if (b < 84) return 2 - smooth((b - 80) / 4); // back to Mach 1
  if (b < 84.5 - RAMP) return 1 - 1e-4 - (b - 84) * 0.01;
  let m = kM(1e4);
  for (const [at, k] of DOWN) {
    if (b >= at) m = kM(k);
    else if (b >= at - RAMP) m = m + (kM(k) - m) * smooth((b - (at - RAMP)) / RAMP);
  }
  return Math.min(m, 0.9999);
}

// ---------------------------------------------------------------- integrate the path
const DT = 0.002;
const N = Math.ceil((BEATS * SPB) / DT) + 1;
const S = new Float64Array(N); // distance flown (units) at t = i * DT
for (let i = 1; i < N; i++) S[i] = S[i - 1] + machAt(((i - 0.5) * DT) / SPB) * C * DT;
const sAt = (t: number) => { const x = t / DT, i = Math.min(N - 2, Math.floor(x)); return S[i] + (S[i + 1] - S[i]) * (x - i); };
export const LOOP_DIST = sAt(BEATS * SPB);

const frames = Array.from({ length: TOTAL_FRAMES }, (_, f) => {
  const t = f / FPS, m = machAt(t / SPB);
  return { s: sAt(t), mach: m };
});

// rings: one per 8th note, centred where the jet was when it emitted them
const RING_LIFE = 3.4; // s
const rings = Array.from({ length: BEATS * 2 }, (_, i) => ({ t: i * SPB * 0.5, s: sAt(i * SPB * 0.5) }));

// heard straight ahead: the harmonic, from the start of each step (subsonic only)
const heard: { beat: number; k: number; midi: number }[] = [{ beat: 0, k: 2, midi: 38 }];
for (const [at, k] of UP) heard.push({ beat: at, k, midi: 26 + Math.round(12 * Math.log2(k)) });
for (const [at, k] of DOWN) heard.push({ beat: at, k, midi: 26 + Math.round(12 * Math.log2(k)) });

// ---------------------------------------------------------------- the towers: one boom per kick in the drop
// four on the floor (one beat of air before Mach 1), clap on 2 and 4
const kicks: number[] = [], snares: number[] = [];
for (let b = 0; b < BARS; b++) {
  const t = b * 4;
  for (let q = 0; q < 4; q++) if (!(b === DROP_BAR - 1 && q === 3)) kicks.push(t + q);
  snares.push(t + 1, t + 3);
}
/** When the boom reaches the point (s, y): the earliest arrival of any front emitted since Mach 1 (the cone). Sound from
 * the subsonic part of the flight may have reached it earlier (quietly); the boom is this one. */
const T_M1 = DROP_BAR * 4 * SPB;
function firstArrival(so: number, y: number, tMax: number) {
  let best = Infinity;
  for (let i = Math.floor(T_M1 / DT); i < N && i * DT < tMax + 1; i++) {
    const d = Math.hypot(so - S[i], y);
    const ta = i * DT + d / C;
    if (ta < best) best = ta;
  }
  return best;
}
const LATERAL = [0.6, -1.4, 2.2, -0.9, 1.7, -2.4, 1.1, -1.9];
const towers: { beat: number; s: number; y: number; arrival: number }[] = [];
kicks.filter((k) => k > DROP_BAR * 4 && k < OUTRO_BAR * 4).forEach((kb, i) => {
  const tb = kb * SPB, y = LATERAL[i % LATERAL.length];
  let lo = sAt(T_M1) + 0.01, hi = sAt(tb) + 5;
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (firstArrival(mid, y, tb) < tb) lo = mid; else hi = mid; }
  const s = (lo + hi) / 2;
  towers.push({ beat: kb, s, y, arrival: firstArrival(s, y, tb) / SPB });
});

// the listener: she stands on one of the lookout towers; she hears the squeezed engine note while the jet is far away and
// slower than sound, nothing once it is faster, and then her boom, on the kick of beat 66 (bar 16, beat 3)
const LISTENER_BEAT = 66;
const listener = towers.findIndex((tw) => Math.abs(tw.beat - LISTENER_BEAT) < 1e-6);

mkdirSync("public/mach-one", { recursive: true });
writeFileSync("public/mach-one/timeline.json", JSON.stringify({
  fps: FPS, bpm: BPM, framesPerBeat: FPB, bars: BARS, totalFrames: TOTAL_FRAMES, dropBar: DROP_BAR, outroBar: OUTRO_BAR,
  c: C, alt: ALT, ringLife: RING_LIFE, loopDist: LOOP_DIST, frames, rings, heard, kicks, snares, towers, listener,
}));

console.log(`distance flown in the loop: ${(LOOP_DIST * 0.1).toFixed(1)} km; Mach at beats 0/16/30/40/47.9/48/64/80/88/96:`,
  [0, 16, 30, 40, 47.9, 48, 64, 80, 88, 95.9].map((b) => machAt(b).toFixed(3)).join(" "));
console.log("heard ahead:", heard.map((h) => `${h.beat}:${h.k}x`).join(" "));
console.log("towers (beat, s ahead of the jet at the kick, lateral, solved arrival beat):");
for (const tw of towers) console.log(`  ${tw.beat.toFixed(2)}  ${(tw.s - sAt(tw.beat * SPB)).toFixed(2)}  ${tw.y}  ${tw.arrival.toFixed(3)}`);
