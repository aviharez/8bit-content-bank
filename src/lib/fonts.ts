import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Pixel fonts, served from public/fonts (OFL licensed, from Fontsource).
export const PIXEL_FONT = "Press Start 2P"; // headlines, numbers (crisp at multiples of 8 px)
export const SMALL_FONT = "Silkscreen"; // labels, captions

export const fontsReady = Promise.all([
  loadFont({ family: PIXEL_FONT, url: staticFile("fonts/PressStart2P.woff2") }),
  loadFont({ family: SMALL_FONT, url: staticFile("fonts/Silkscreen.woff2") }),
]);
