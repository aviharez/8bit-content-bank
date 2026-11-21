// Shared pixel pipeline: Endesga 32 palette, 15-bit lookup table, ordered (Bayer 4x4) dithering.
export const PALETTE = [
  "be4a2f", "d77643", "ead4aa", "e4a672", "b86f50", "733e39", "3e2731", "a22633",
  "e43b44", "f77622", "feae34", "fee761", "63c74d", "3e8948", "265c42", "193c3e",
  "124e89", "0099db", "2ce8f5", "ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466",
  "262b44", "181425", "ff0044", "68386c", "b55088", "f6757a", "e8b796", "c28569",
] as const;

/** `C["fee761"]` -> "#fee761": only palette colours can be named. */
export const C = Object.fromEntries(PALETTE.map((h) => [h, `#${h}`])) as Record<(typeof PALETTE)[number], string>;

const RGB = PALETTE.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const LUT = new Uint8Array(32768);
for (let k = 0; k < 32768; k++) {
  const r = ((k >> 10) & 31) * 8.226, g = ((k >> 5) & 31) * 8.226, b = (k & 31) * 8.226;
  let best = Infinity, bi = 0;
  RGB.forEach((c, j) => {
    const e = 0.3 * (c[0] - r) ** 2 + 0.59 * (c[1] - g) ** 2 + 0.11 * (c[2] - b) ** 2;
    if (e < best) { best = e; bi = j; }
  });
  LUT[k] = bi;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Snap every pixel to the palette.
 * dither > 0 adds ordered dithering (for 3D shading); alphaMode thresholds alpha (for crisp text/UI).
 */
export function quantize(img: ImageData, dither: number, alphaMode: boolean): ImageData {
  const { data: d, width: w, height: h } = img;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (alphaMode) { if (d[i + 3] < 128) { d[i + 3] = 0; continue; } d[i + 3] = 255; }
    const o = dither ? (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * dither : 0;
    const r = Math.max(0, Math.min(255, d[i] + o)) >> 3;
    const g = Math.max(0, Math.min(255, d[i + 1] + o)) >> 3;
    const b = Math.max(0, Math.min(255, d[i + 2] + o)) >> 3;
    const c = RGB[LUT[(r << 10) | (g << 5) | b]];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  return img;
}
