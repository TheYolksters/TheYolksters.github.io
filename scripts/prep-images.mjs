/**
 * One-shot asset prep: run `node scripts/prep-images.mjs` after changing
 * anything in Images/TheYolksters/. Produces:
 *   src/assets/  hero, team, banner, about-banner, logo + member avatars
 *   public/      favicon.png, apple-touch-icon.png, og.png
 *
 * Crop boxes are fractions of source width/height, so the script keeps
 * working if the art is re-exported at a different resolution.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "Images/TheYolksters";
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
async function cropSquare(srcFile, outFile, { cx, cy, side }, size, paletted = false) {
  const img = sharp(path.join(SRC, srcFile));
  const { width, height } = await img.metadata();
  const s = Math.round(side * height);
  const left = Math.max(0, Math.min(width - s, Math.round(cx * width - s / 2)));
  const top = Math.max(0, Math.min(height - s, Math.round(cy * height - s / 2)));
  await img
    .extract({ left, top, width: s, height: s })
    .resize(size, size)
    .png(paletted ? { palette: true, compressionLevel: 9 } : {})
    .toFile(outFile);
  console.log(`cropped ${outFile} (${s}px @ ${left},${top})`);
}

// member avatars out of the group crest art
const TEAM = "TheYolksters_IndivChickens_WingsHighReso.png";
await cropSquare(TEAM, `${ASSETS}/avatar-dia.png`, { cx: 0.388, cy: 0.525, side: 0.33 }, 640);
await cropSquare(TEAM, `${ASSETS}/avatar-grai.png`, { cx: 0.504, cy: 0.52, side: 0.31 }, 640);
await cropSquare(TEAM, `${ASSETS}/avatar-kyle.png`, { cx: 0.638, cy: 0.545, side: 0.36 }, 640);

// square crest for header logo + favicons
const CREST = "TheYolksters.png";
const crestBox = { cx: 0.511, cy: 0.5, side: 0.84 };
await cropSquare(CREST, `${ASSETS}/logo.png`, crestBox, 512);
await cropSquare(CREST, `${PUBLIC}/favicon.png`, crestBox, 64, true);
await cropSquare(CREST, `${PUBLIC}/apple-touch-icon.png`, crestBox, 180, true);

// social share image (1200x630 ≈ what Open Graph wants); JPEG keeps it
// ~100-200KB — some platforms (e.g. WhatsApp) drop previews over ~600KB
await sharp(path.join(SRC, "TheYolksters_Space.png"))
  .resize(1200, 630, { fit: "cover" })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(`${PUBLIC}/og.jpg`);
console.log("built   public/og.jpg");

console.log("done.");
