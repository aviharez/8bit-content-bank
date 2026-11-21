// Loop seam: over the last `window` frames, dissolve into frame 0 with the same Bayer pattern
// the pixel pipeline uses, so the last frame is the first frame and the loop has no cut.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export type LayerDraw = (ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number) => void;

let scratch: { ctx: CanvasRenderingContext2D; ov: CanvasRenderingContext2D } | null = null;

export function drawLooped(ctx: CanvasRenderingContext2D, ov: CanvasRenderingContext2D, f: number, total: number, window: number, draw: LayerDraw) {
  draw(ctx, ov, f);
  const start = total - window;
  if (f < start) return;
  const { width: w, height: h } = ctx.canvas;
  if (!scratch) {
    const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c.getContext("2d", { willReadFrequently: true })!; };
    scratch = { ctx: mk(), ov: mk() };
  }
  draw(scratch.ctx, scratch.ov, 0);
  const t = (f - start + 1) / window; // reaches 1 on the last frame
  const a = ctx.getImageData(0, 0, w, h), b = scratch.ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < t) {
      const i = (y * w + x) * 4;
      a.data[i] = b.data[i]; a.data[i + 1] = b.data[i + 1]; a.data[i + 2] = b.data[i + 2];
    }
  }
  ctx.putImageData(a, 0, 0);
}
