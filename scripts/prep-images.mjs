/**
 * One-shot asset prep: run `node scripts/prep-images.mjs` after changing
 * anything in Images/. Produces:
 *   src/assets/  hero, team, banner, about-banner, logo, wordmark
 *                + member avatars (face crops) and full-body member art
 *   public/      favicon.png, apple-touch-icon.png, og.png
 *
 * Crop boxes are fractions of source width/height, so the script keeps
 * working if the art is re-exported at a different resolution.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "Images/TheYolksters";
const CLEAN = "Images"; // "-clean" character art + wordmark live at Images/ root
const ASSETS = "src/assets";
const PUBLIC = "public";

await mkdir(ASSETS, { recursive: true });
await mkdir(PUBLIC, { recursive: true });

// straight copies (Astro optimizes these at build time)
const copies = [
  ["TheYolksters_Space.png", "hero.png"],
  ["TheYolksters_IndivChickens_WingsHighReso.png", "team.png"],
  ["TheYolksters_Banner.png", "banner.png"],
  ["TheYolksters_RectBanner_AboutUs.png", "about-banner.png"],
];
for (const [from, to] of copies) {
  await copyFile(path.join(SRC, from), path.join(ASSETS, to));
  console.log(`copied  ${to}`);
}

/** crop a square (fractional center + side relative to height) and resize.
 *  `paletted` quantizes the PNG — use for public/ icons that ship as-is
 *  (src/assets/ files get re-encoded by astro:assets, so they skip it). */
async function cropSquare(srcPath, outFile, { cx, cy, side }, size, paletted = false) {
  const img = sharp(srcPath);
  const { width, height } = await img.metadata();
  const s = Math.round(side * height);
  const left = Math.max(0, Math.min(width - s, Math.round(cx * width - s / 2)));
  const top = Math.max(0, Math.min(height - s, Math.round(cy * height - s / 2)));
  await img
    .extract({ left, top, width: s, height: s })
    .resize(size, size, { withoutEnlargement: true })
    .png(paletted ? { palette: true, compressionLevel: 9 } : {})
    .toFile(outFile);
  console.log(`cropped ${outFile} (${s}px @ ${left},${top})`);
}

/**
 * Full-body "clean" character art ships on a sterile white backdrop. The site
 * is deep navy, so we re-stage each character on a nebula-matched glow:
 * flood-fill the white (and the light-gray ground shadow, which would read as
 * fog on navy) from the borders, paint a soft dark ground shadow instead, and
 * composite over a radial navy gradient whose rim EXACTLY matches the card
 * color (--brand-nebula #161c3d) so roster cards and avatar circles blend in.
 * Character interiors (white shoes, light sweaters) are safe: the flood can't
 * cross the art's dark silhouette outlines.
 */
const GLOW_INNER = "#273065"; // nova-tinted navy behind the character
const GLOW_OUTER = "#161c3d"; // == --brand-nebula, the card background

async function makeMemberScene(srcPath, outFile) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // "backdrop-ish": light and unsaturated — white bg + soft gray ground shadow
  const isBg = (p) => {
    const i = p * 4;
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    return mn > 150 && mx - mn < 48;
  };
  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    const p = y * w + x;
    if (!bg[p] && isBg(p)) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  // The art's anti-aliased rim is 2-3px wide, so feather TWO rings around the
  // removed backdrop (full strength, then half) — one ring leaves a pale
  // stipple of light second-ring pixels against the navy.
  const ring1 = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (bg[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (
      (x > 0 && bg[p - 1]) ||
      (x < w - 1 && bg[p + 1]) ||
      (y > 0 && bg[p - w]) ||
      (y < h - 1 && bg[p + w])
    )
      ring1[p] = 1;
  }
  const cut = Buffer.alloc(w * h * 4);
  let maxY = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    cut[i] = data[i];
    cut[i + 1] = data[i + 1];
    cut[i + 2] = data[i + 2];
    if (bg[p]) continue; // alpha stays 0
    const x = p % w;
    const y = (p - x) / w;
    let a = data[i + 3];
    const ring = ring1[p]
      ? 1
      : (x > 0 && ring1[p - 1]) ||
          (x < w - 1 && ring1[p + 1]) ||
          (y > 0 && ring1[p - w]) ||
          (y < h - 1 && ring1[p + w])
        ? 0.5
        : 0;
    if (ring > 0) {
      const mn = Math.min(data[i], data[i + 1], data[i + 2]);
      const whiteness = Math.min(1, Math.max(0, (mn - 150) / 105));
      a = Math.round(a * (1 - whiteness * ring));
    }
    cut[i + 3] = a;
    if (a > 200 && y > maxY) maxY = y;
  }
  // Feet-only bounding band for the shadow — a raised hand or wide sleeve
  // must not drag the shadow off the shoes.
  const feetBand = Math.round(0.08 * h);
  let fMinX = w, fMaxX = 0;
  for (let y = Math.max(0, maxY - feetBand); y <= maxY; y++) {
    for (let x = 0; x < w; x++) {
      if (cut[(y * w + x) * 4 + 3] > 200) {
        if (x < fMinX) fMinX = x;
        if (x > fMaxX) fMaxX = x;
      }
    }
  }
  // Radial glow. r completes BEFORE the nearest canvas edge (top: 0.4*h from
  // center, so r <= 0.39) — a wider radius leaves a faint clipped arc on the
  // border and breaks the exact card-color rim the roster seam relies on.
  const { data: glowRaw, info: glowInfo } = await sharp(
    Buffer.from(
      `<svg width="${w}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="40%" r="39%"><stop offset="0%" stop-color="${GLOW_INNER}"/><stop offset="100%" stop-color="${GLOW_OUTER}"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
    ),
  )
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gch = glowInfo.channels; // SVG rasterizes as RGBA — never assume 3
  // ±1-level ordered dither hides the 8-bit banding rings of the gradient
  // (kept OFF the outermost 2px so the rim stays exactly GLOW_OUTER)
  for (let p = 0; p < w * h; p++) {
    const x = p % w;
    const y = (p - x) / w;
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
    const n = Math.round(((x * 7 + y * 13) % 9) / 4 - 1); // deterministic -1..1
    for (let c = 0; c < 3; c++) {
      const v = glowRaw[p * gch + c] + n;
      glowRaw[p * gch + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  const glow = { input: glowRaw, raw: { width: w, height: h, channels: gch } };
  // Soft dark ground shadow centered on the FEET, peeking below the shoes,
  // then faded out before the canvas bottom so the blurred ellipse can't
  // spill a dark smudge across the border rim.
  const sx = Math.round((fMinX + fMaxX) / 2);
  const rx = Math.round(((fMaxX - fMinX) / 2) * 1.2);
  const ry = Math.max(24, Math.round(rx * 0.22));
  const sy = maxY - Math.round(ry * 0.1);
  const fadeFrom = ((h - 36) / h).toFixed(4);
  const shadow = await sharp(
    Buffer.from(
      `<svg width="${w}" height="${h}"><ellipse cx="${sx}" cy="${sy}" rx="${rx}" ry="${ry}" fill="black" fill-opacity="0.45"/></svg>`,
    ),
  )
    .blur(12)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${w}" height="${h}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="${fadeFrom}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#f)"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  await sharp(glow.input, { raw: glow.raw })
    .composite([
      { input: shadow },
      { input: cut, raw: { width: w, height: h, channels: 4 } },
    ])
    .png()
    .toFile(outFile);
  console.log(
    `staged  ${outFile} (feet ${fMinX}-${fMaxX}, shadow @${sx},${sy} rx${rx})`,
  );
}

const MEMBERS = [
  // Dia's crop sits right of center so her waving hand stays out of the circle
  ["dia", "Dia-Whitebox-Slim-Braid-clean.png", { cx: 0.515, cy: 0.19, side: 0.38 }],
  ["grai", "Grai_TS_GreenOutfit_Texture-clean.png", { cx: 0.5, cy: 0.2, side: 0.4 }],
  ["kyle", "Koala_WB_Orange-clean.png", { cx: 0.5, cy: 0.2, side: 0.4 }],
];
for (const [id, file, faceBox] of MEMBERS) {
  const memberOut = `${ASSETS}/member-${id}.png`;
  await makeMemberScene(path.join(CLEAN, file), memberOut);
  // face crop for the small circular avatars — cut from the STAGED art so
  // the home-page circles carry the same navy backdrop as the roster cards
  await cropSquare(memberOut, `${ASSETS}/avatar-${id}.png`, faceBox, 640);
}

// square crest for header logo + favicons
const CREST = "TheYolksters.png";
const crestBox = { cx: 0.511, cy: 0.5, side: 0.84 };
await cropSquare(path.join(SRC, CREST), `${ASSETS}/logo.png`, crestBox, 512);
await cropSquare(path.join(SRC, CREST), `${PUBLIC}/favicon.png`, crestBox, 64, true);
await cropSquare(path.join(SRC, CREST), `${PUBLIC}/apple-touch-icon.png`, crestBox, 180, true);

/**
 * Text wordmark ships on a solid near-black backdrop; the site sits on deep
 * navy, so the black box would show. Flood-fill from the borders knocks out
 * every near-black pixel CONNECTED to the edge, then trim tightens the
 * transparent margins. The warm dark-brown shadow plate hugging the letters
 * is above THRESH by design and survives — it reads as the mark's drop
 * shadow on the site's dark background. Edges are hard-cut (no graded
 * alpha), fine on dark surfaces; re-export the art before using this mark
 * on a light background.
 */
async function makeWordmark(srcPath, outFile) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha() // guarantees 4 channels even if the art is re-exported as grayscale
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const THRESH = 18; // background is 0–7 per channel; letter outlines are far above
  const isBg = (p) => {
    const i = p * ch;
    return data[i] < THRESH && data[i + 1] < THRESH && data[i + 2] < THRESH;
  };
  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    const p = y * w + x;
    if (!bg[p] && isBg(p)) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * ch;
    const o = p * 4;
    out[o] = data[i];
    out[o + 1] = data[i + 1];
    out[o + 2] = data[i + 2];
    out[o + 3] = bg[p] ? 0 : ch === 4 ? data[i + 3] : 255;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .png()
    .toFile(outFile);
  console.log(`built   ${outFile} (background knocked out)`);
}
await makeWordmark(
  path.join(CLEAN, "TheYolksters_Logo_TextOnly_SunnySideUp_LargerEgg-clean.png"),
  `${ASSETS}/wordmark.png`,
);

// social share image (1200x630 ≈ what Open Graph wants); JPEG keeps it
// ~100-200KB — some platforms (e.g. WhatsApp) drop previews over ~600KB
await sharp(path.join(SRC, "TheYolksters_Space.png"))
  .resize(1200, 630, { fit: "cover" })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(`${PUBLIC}/og.jpg`);
console.log("built   public/og.jpg");

console.log("done.");
