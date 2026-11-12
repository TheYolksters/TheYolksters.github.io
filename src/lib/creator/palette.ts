/**
 * YOLKSTER CREATOR — reads the main colours out of a picture.
 *
 * The built-in characters have their colours written down in
 * src/config/creator.ts (measured once from the art). An uploaded character
 * has no such list, so this measures one in the browser: the handful of
 * flat colours that cover most of the picture, background left out. The
 * prompt quotes them so the AI keeps the colours it was given.
 */

import { imageToCanvas } from "./export";

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** the main colours of some pixels, most common first */
export function mainColours(data: Uint8ClampedArray, width: number, height: number, max = 6): string[] {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const key = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);

  // the backdrop is whatever colour most of the border is
  const border = new Map<number, number>();
  let borderPx = 0;
  const seeBorder = (x: number, y: number) => {
    const i = at(x, y);
    if (data[i + 3] < 128) return;
    border.set(key(i), (border.get(key(i)) ?? 0) + 1);
    borderPx++;
  };
  for (let x = 0; x < width; x++) {
    seeBorder(x, 0);
    seeBorder(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    seeBorder(0, y);
    seeBorder(width - 1, y);
  }
  let backdrop: [number, number, number] | null = null;
  let top = 0;
  for (const [k, n] of border) {
    if (n > top) {
      top = n;
      backdrop = [((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17];
    }
  }
  if (borderPx === 0 || top < borderPx * 0.5) backdrop = null; // a busy border means there is no flat backdrop

  // pool every other pixel into coarse colour bins, remembering each bin's true average
  const bins = new Map<number, [n: number, r: number, g: number, b: number]>();
  let counted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    if (backdrop && Math.abs(data[i] - backdrop[0]) + Math.abs(data[i + 1] - backdrop[1]) + Math.abs(data[i + 2] - backdrop[2]) < 60) {
      continue;
    }
    const k = key(i);
    const bin = bins.get(k);
    if (bin) {
      bin[0]++;
      bin[1] += data[i];
      bin[2] += data[i + 1];
      bin[3] += data[i + 2];
    } else bins.set(k, [1, data[i], data[i + 1], data[i + 2]]);
    counted++;
  }
  if (!counted) return [];

  const ranked = [...bins.values()].sort((a, b) => b[0] - a[0]);
  const picked: [number, number, number][] = [];
  for (const [n, r, g, b] of ranked) {
    if (picked.length >= max || n < counted * 0.012) break;
    const c: [number, number, number] = [r / n, g / n, b / n];
    // neighbouring bins of one flat colour (and its shading) count once
    if (picked.some((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) < 70)) continue;
    picked.push(c);
  }
  return picked.map((c) => hex(c[0], c[1], c[2]));
}

/** the main colours of a picture (a URL or an object URL) */
export async function paletteFromImage(src: string): Promise<string[]> {
  const canvas = await imageToCanvas(src, 200, null);
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return mainColours(data, width, height);
}
