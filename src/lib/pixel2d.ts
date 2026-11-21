import { C } from "./palette";
import { PIXEL_FONT, SMALL_FONT } from "./fonts";

export type Font = "s16" | "p8" | "p16" | "p24" | "p32";

/** Small immediate-mode drawing kit for the low-res overlay canvas. */
export function pixelKit(ov: CanvasRenderingContext2D) {
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ov.fillStyle = c;
    ov.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const setFont = (font: Font) => {
    ov.font = font === "s16" ? `16px "${SMALL_FONT}"` : `${font.slice(1)}px "${PIXEL_FONT}"`;
  };
  const measure = (str: string, font: Font) => { setFont(font); return ov.measureText(str).width; };
  const text = (str: string, x: number, y: number, font: Font, c: string, align: "l" | "c" | "r" = "l", shadow?: string) => {
    setFont(font);
    ov.textBaseline = "top";
    const w = ov.measureText(str).width;
    const xx = Math.round(align === "c" ? x - w / 2 : align === "r" ? x - w : x);
    if (shadow) { ov.fillStyle = shadow; ov.fillText(str, xx + 1, Math.round(y) + 1); }
    ov.fillStyle = c;
    ov.fillText(str, xx, Math.round(y));
  };
  /** Thin-bordered panel, the house style for every HUD element. */
  const panel = (x: number, y: number, w: number, h: number, border: string = C["8b9bb4"], fill: string = C["181425"]) => {
    rect(x, y, w, h, fill);
    rect(x, y, w, 1, border); rect(x, y + h - 1, w, 1, border);
    rect(x, y, 1, h, border); rect(x + w - 1, y, 1, h, border);
  };
  return { rect, text, measure, panel };
}

const PI_SPRITE = ["11111111", "11111111", "01100110", "01100110", "01100110", "01100110", "11000110", "11000011"];
/** The pi glyph as a sprite (the pixel fonts have no Greek). */
export function drawPi(ov: CanvasRenderingContext2D, x: number, y: number, px: number, color: string) {
  ov.fillStyle = color;
  PI_SPRITE.forEach((row, j) => row.split("").forEach((b, i) => {
    if (b === "1") ov.fillRect(Math.round(x + i * px), Math.round(y + j * px), px, px);
  }));
}
