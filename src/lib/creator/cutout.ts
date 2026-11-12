/**
 * YOLKSTER CREATOR — turn a flat backdrop transparent.
 *
 * The same idea as the roster art prep in scripts/prep-images.mjs, running
 * in the browser: flood-fill the backdrop inwards from the image border.
 * The fill cannot leak into the character because the art style wraps
 * everything in a dark outline, which is also why a white sneaker or a white
 * sweater survives a white backdrop.
 *
 * Works on plain pixel arrays (no DOM), so it can be tested outside a browser.
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CutoutOptions {
  /** 0–100. Higher removes more (paler shadows, off-white backdrops). 50 suits clean AI output. */
  tolerance: number;
  /** also remove the soft ground shadow under the feet */
  dropShadow: boolean;
  /**
   * Also clear backdrop-coloured gaps fully enclosed by the character (the
   * loop of a tail, the space between an arm and the body). A guess: a gap
   * and a flat white part of the outfit can look identical, which is what
   * `keep` and `remove` are for.
   */
  pockets: boolean;
  /** pixel indexes (y × width + x) the user clicked to say "this is NOT backdrop, put it back" */
  keep?: number[];
  /** pixel indexes the user clicked to say "this IS leftover backdrop, remove it" */
  remove?: number[];
}

export interface CutoutResult {
  pixels: Pixels;
  /** tight box around what is left, or null if nothing is */
  bounds: { x: number; y: number; w: number; h: number } | null;
  backdrop: [number, number, number];
  /** share of the image that became transparent, 0–1 */
  removed: number;
}

export const DEFAULT_CUTOUT: CutoutOptions = { tolerance: 50, dropShadow: true, pockets: true };

const median = (values: number[]) => {
  values.sort((a, b) => a - b);
  return values[values.length >> 1] ?? 255;
};

/** the backdrop colour: the median of the outermost pixels */
export function sampleBackdrop({ data, width: w, height: h }: Pixels): [number, number, number] {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  };
  const stepX = Math.max(1, Math.floor(w / 400));
  const stepY = Math.max(1, Math.floor(h / 400));
  for (let x = 0; x < w; x += stepX) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y += stepY) {
    take(0, y);
    take(w - 1, y);
  }
  return [median(r), median(g), median(b)];
}

export function cutout(src: Pixels, options: Partial<CutoutOptions> = {}): CutoutResult {
  const opts = { ...DEFAULT_CUTOUT, ...options };
  const { width: w, height: h } = src;
  const n = w * h;
  const data = new Uint8ClampedArray(src.data); // work on a copy
  const [br, bg, bb] = sampleBackdrop(src);
  const bSum = br + bg + bb || 1;
  const lightNeutral = Math.min(br, bg, bb) >= 200 && Math.max(br, bg, bb) - Math.min(br, bg, bb) <= 30;

  const tol = Math.max(0, Math.min(100, opts.tolerance));
  const strictT = 10 + tol * 0.5; // 35 at the default
  const floor = 255 - (55 + tol); // 150 at the default — same as prep-images.mjs
  const spreadT = 24 + tol * 0.8; // 64 at the default — ditto
  const chromaT = 0.05 + tol * 0.0012;

  /** how far a pixel is from the backdrop colour (largest channel difference) */
  const far = (i: number) =>
    Math.max(Math.abs(data[i] - br), Math.abs(data[i + 1] - bg), Math.abs(data[i + 2] - bb));

  /** plainly the backdrop colour */
  const strict = (p: number) => {
    const i = p * 4;
    return data[i + 3] < 8 || far(i) <= strictT;
  };

  /** backdrop OR its soft shadow */
  const soft = (p: number) => {
    const i = p * 4;
    if (data[i + 3] < 8) return true;
    if (far(i) <= strictT) return true;
    if (!opts.dropShadow) return false;
    const R = data[i];
    const G = data[i + 1];
    const B = data[i + 2];
    if (lightNeutral) {
      // light and near-neutral: the white plus the grey-to-taupe ground shadow
      const mn = Math.min(R, G, B);
      const mx = Math.max(R, G, B);
      return mn > floor && mx - mn < spreadT;
    }
    // coloured backdrop: a shadow is the same hue, only darker
    const sum = R + G + B;
    if (sum < bSum * 0.45 || sum > bSum * 1.12) return false;
    const d = Math.abs(R / sum - br / bSum) + Math.abs(G / sum - bg / bSum) + Math.abs(B / sum - bb / bSum);
    return d < chromaT;
  };

  // 1) flood the backdrop in from every border pixel
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const seed = (p: number) => {
    if (!isBg[p] && soft(p)) {
      isBg[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }

  // 2) backdrop pockets sealed inside the character never meet the border
  //    flood. Reclaim one only if it is big and almost EXACTLY the backdrop
  //    colour. Measured on the team's art: a real gap (the loop of Grai's
  //    backpack cable) is 88% dead-on backdrop with a spread of 2, while the
  //    kitten's white bib is 16% and 3.7 — hence the tight numbers below.
  const keepMark = new Uint8Array(n);
  for (const p of opts.keep ?? []) if (p >= 0 && p < n) keepMark[p] = 1;
  if (opts.pockets) {
    const seen = new Uint8Array(n);
    const queue = stack; // reuse the buffer; the flood is finished
    const minPocket = Math.max(60, 0.0015 * n);
    for (let p0 = 0; p0 < n; p0++) {
      if (isBg[p0] || seen[p0] || !strict(p0)) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = p0;
      seen[p0] = 1;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sq = 0;
      let exact = 0;
      let kept = false;
      while (head < tail) {
        const p = queue[head++];
        const i = p * 4;
        if (keepMark[p]) kept = true;
        if (far(i) <= 3) exact++;
        sr += data[i];
        sg += data[i + 1];
        sb += data[i + 2];
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sq += lum * lum;
        const x = p % w;
        if (x > 0 && !isBg[p - 1] && !seen[p - 1] && strict(p - 1)) {
          seen[p - 1] = 1;
          queue[tail++] = p - 1;
        }
        if (x < w - 1 && !isBg[p + 1] && !seen[p + 1] && strict(p + 1)) {
          seen[p + 1] = 1;
          queue[tail++] = p + 1;
        }
        if (p >= w && !isBg[p - w] && !seen[p - w] && strict(p - w)) {
          seen[p - w] = 1;
          queue[tail++] = p - w;
        }
        if (p < n - w && !isBg[p + w] && !seen[p + w] && strict(p + w)) {
          seen[p + w] = 1;
          queue[tail++] = p + w;
        }
      }
      const count = tail;
      const mean = (sr + sg + sb) / (3 * count);
      const std = Math.sqrt(Math.max(0, sq / count - mean * mean));
      if (
        !kept &&
        count >= minPocket &&
        std <= 3 &&
        exact / count >= 0.85 &&
        Math.abs(sr / count - br) <= 2 &&
        Math.abs(sg / count - bg) <= 2 &&
        Math.abs(sb / count - bb) <= 2
      ) {
        for (let k = 0; k < count; k++) isBg[queue[k]] = 1;
      }
    }
  }

  // 2b) patches the user pointed at: remove everything joined to the click
  //     that is a similar colour to the clicked pixel
  const similarT = 14 + tol * 0.28;
  for (const p0 of opts.remove ?? []) {
    if (p0 < 0 || p0 >= n || isBg[p0]) continue;
    const i0 = p0 * 4;
    const r0 = data[i0];
    const g0 = data[i0 + 1];
    const b0 = data[i0 + 2];
    const alike = (p: number) => {
      const i = p * 4;
      return Math.max(Math.abs(data[i] - r0), Math.abs(data[i + 1] - g0), Math.abs(data[i + 2] - b0)) <= similarT;
    };
    let head = 0;
    let tail = 0;
    stack[tail++] = p0;
    isBg[p0] = 1;
    while (head < tail) {
      const p = stack[head++];
      const x = p % w;
      if (x > 0 && !isBg[p - 1] && alike(p - 1)) {
        isBg[p - 1] = 1;
        stack[tail++] = p - 1;
      }
      if (x < w - 1 && !isBg[p + 1] && alike(p + 1)) {
        isBg[p + 1] = 1;
        stack[tail++] = p + 1;
      }
      if (p >= w && !isBg[p - w] && alike(p - w)) {
        isBg[p - w] = 1;
        stack[tail++] = p - w;
      }
      if (p < n - w && !isBg[p + w] && alike(p + w)) {
        isBg[p + w] = 1;
        stack[tail++] = p + w;
      }
    }
  }

  // 3) soften the edge. The art's anti-aliased rim is 2–3px wide, so two
  //    rings of pixels next to the removed backdrop are faded by how much
  //    backdrop colour they contain, then that colour is subtracted back out
  //    so no pale halo is left on dark backgrounds.
  const ring = new Uint8Array(n); // 1 = touches the backdrop, 2 = touches ring 1
  for (let p = 0; p < n; p++) {
    if (isBg[p]) continue;
    const x = p % w;
    if ((x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (p >= w && isBg[p - w]) || (p < n - w && isBg[p + w])) {
      ring[p] = 1;
    }
  }
  for (let p = 0; p < n; p++) {
    if (isBg[p] || ring[p]) continue;
    const x = p % w;
    if (
      (x > 0 && ring[p - 1] === 1) ||
      (x < w - 1 && ring[p + 1] === 1) ||
      (p >= w && ring[p - w] === 1) ||
      (p < n - w && ring[p + w] === 1)
    ) {
      ring[p] = 2;
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let gone = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (isBg[p]) {
      data[i + 3] = 0;
      gone++;
      continue;
    }
    if (ring[p]) {
      const closeness = Math.min(1, Math.max(0, 1 - far(i) / 105));
      const keep = 1 - closeness * (ring[p] === 1 ? 1 : 0.5);
      if (keep < 0.999) {
        const a = Math.max(0, keep);
        if (a > 0.04) {
          data[i] = (data[i] - (1 - a) * br) / a;
          data[i + 1] = (data[i + 1] - (1 - a) * bg) / a;
          data[i + 2] = (data[i + 2] - (1 - a) * bb) / a;
        }
        data[i + 3] = Math.round(data[i + 3] * a);
      }
    }
    if (data[i + 3] > 10) {
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    pixels: { data, width: w, height: h },
    bounds: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    backdrop: [br, bg, bb],
    removed: gone / n,
  };
}
