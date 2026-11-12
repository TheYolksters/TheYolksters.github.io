/**
 * YOLKSTER CREATOR — what the doll can wear, as far as DRAWING goes.
 *
 * These are the handful of simple shapes the on-screen doll knows how to
 * draw. The wardrobe in src/config/creator.ts maps every clothing item to
 * one of them (plus the words the AI prompt uses). The doll is only a
 * sketch: the AI does the real drawing from the prompt text.
 */

import type { ItemPlace, PetPlace } from "./rig";

export type Sleeves = "long" | "short" | "none";

export interface TopLook {
  color: string;
  /** second colour: inner shirt, trim, vest sleeves */
  accent: string;
  sleeves: Sleeves;
  /** sleeves take the accent colour (a vest over a shirt) */
  accentSleeves?: boolean;
  /** hood resting on the shoulders */
  hood?: boolean;
  /** front pouch pocket + drawstrings */
  pocket?: boolean;
  /** worn open over an inner shirt in the accent colour */
  open?: boolean;
  collar?: "turtle" | "ring" | "vneck";
  /** chest pockets */
  pockets?: boolean;
  /** chest control panel */
  panel?: boolean;
  tie?: boolean;
  /** flares out over the hips */
  skirt?: boolean;
  /** covers the legs too (spacesuit, onesie) */
  onePiece?: boolean;
  /** ribbed band at the hem and cuffs */
  ribbed?: boolean;
}

export interface BottomLook {
  color: string;
  length: "long" | "short" | "skirt";
  cargo?: boolean;
}

export interface ShoeLook {
  color: string;
  kind: "sneaker" | "hightop" | "boot" | "sandal" | "slipper";
}

export type HeadwearKind =
  | "cap"
  | "beanie"
  | "headset"
  | "crown"
  | "helmet"
  | "partyhat"
  | "bow"
  | "tophat"
  | "hood"
  | "generic";
export type EyewearKind = "glasses" | "sunglasses" | "goggles";
export type NeckKind = "scarf" | "bandana" | "bowtie" | "medal";
export type BackKind = "cape" | "backpack" | "wings";
export type PetKind = "cat" | "koala" | "generic";
export type { PetSpot } from "./rig";

// ---------------------------------------------------------------- face --

/** how one eye is drawn */
export type EyeKind =
  | "open"
  | "wide"
  | "narrow"
  | "half"
  | "sleepy"
  | "happy" // squeezed shut in a smiling arc
  | "closed" // gently shut
  | "sparkle"
  | "heart";
export type BrowKind = "soft" | "raised" | "stern" | "worried" | "skeptical" | "none";
export type BeakKind = "smile" | "open" | "wide" | "o" | "frown" | "smirk" | "tongue";
/** "auto" = whatever the character normally has */
export type BlushKind = "auto" | "none" | "extra";
export type GazeKind = "ahead" | "up" | "down" | "left" | "right";
export type FaceExtra = "sweat" | "sparkles" | "anger" | "tear" | "hearts" | "zzz" | "question" | "exclaim" | "music";

export const EYE_KINDS: EyeKind[] = ["open", "wide", "narrow", "half", "sleepy", "happy", "closed", "sparkle", "heart"];
export const BROW_KINDS: BrowKind[] = ["soft", "raised", "stern", "worried", "skeptical", "none"];
export const BEAK_KINDS: BeakKind[] = ["smile", "open", "wide", "o", "frown", "smirk", "tongue"];
export const GAZE_KINDS: GazeKind[] = ["ahead", "up", "down", "left", "right"];
export const FACE_EXTRAS: FaceExtra[] = ["sweat", "sparkles", "anger", "tear", "hearts", "zzz", "question", "exclaim", "music"];

/**
 * A face, piece by piece. "R" and "L" are the character's own right and
 * left, so eyeR is the one on the LEFT of the screen when the doll faces you.
 */
export interface Face {
  eyeR: EyeKind;
  eyeL: EyeKind;
  brows: BrowKind;
  beak: BeakKind;
  blush: BlushKind;
  /** where the eyes look, on top of where the head points */
  gaze: GazeKind;
  extras: FaceExtra[];
}

export const PLAIN_FACE: Face = {
  eyeR: "open",
  eyeL: "open",
  brows: "soft",
  beak: "smile",
  blush: "auto",
  gaze: "ahead",
  extras: [],
};

export const sameFace = (a: Face, b: Face) =>
  a.eyeR === b.eyeR &&
  a.eyeL === b.eyeL &&
  a.brows === b.brows &&
  a.beak === b.beak &&
  a.blush === b.blush &&
  a.gaze === b.gaze &&
  a.extras.length === b.extras.length &&
  a.extras.every((e) => b.extras.includes(e));

/** preset ids (the list itself, with labels and prompt words, lives in src/config/creator.ts) */
export type Expression =
  | "smile"
  | "happy"
  | "laugh"
  | "wink"
  | "cheeky"
  | "excited"
  | "love"
  | "determined"
  | "surprised"
  | "worried"
  | "smug"
  | "shy"
  | "sleepy"
  | "sad"
  | "grumpy"
  | "angry";

/** everything the doll renderer needs to know about appearance */
export interface DollLook {
  feather: string;
  eye: string;
  lashes: boolean;
  blush: boolean;
  face: Face;
  top: TopLook | null;
  bottom: BottomLook | null;
  shoes: ShoeLook | null;
  headwear: { kind: HeadwearKind; color: string } | null;
  eyewear: { kind: EyewearKind; color: string } | null;
  neck: { kind: NeckKind; color: string } | null;
  back: { kind: BackKind; color: string } | null;
  /** the companion: what it is, where it is, and whether it is drawn behind the character */
  pet: { kind: PetKind; fur: string; place: PetPlace; behind: boolean } | null;
  /** the placeholder for whatever is being held, if anything */
  item: ItemPlace | null;
}

/** measured from the team's art: the flat feather yellow shared by all three */
export const FEATHER = "#fed55a";

export const PLAIN_LOOK: DollLook = {
  feather: FEATHER,
  eye: "#6b4a2b",
  lashes: false,
  blush: false,
  face: PLAIN_FACE,
  top: null,
  bottom: null,
  shoes: null,
  headwear: null,
  eyewear: null,
  neck: null,
  back: null,
  pet: null,
  item: null,
};

// ------------------------------------------------------------- colours --

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** amt > 0 lightens toward white, amt < 0 darkens toward black (−1…1) */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/** perceived lightness 0–1 */
export function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Named colours for the prompt: image models follow "lilac" far better
 * than "#b79ad8", so the wardrobe's colour pickers are translated to the
 * nearest plain-English name.
 */
const NAMED: [string, string][] = [
  ["white", "#ffffff"],
  ["off-white", "#f3efe6"],
  ["light grey", "#c9ccd3"],
  ["grey", "#8e9199"],
  ["charcoal", "#3a3d45"],
  ["black", "#141416"],
  ["cream", "#f6e7c1"],
  ["beige", "#d9c3a0"],
  ["khaki", "#c2a878"],
  ["tan", "#b98a5a"],
  ["brown", "#7a4b2e"],
  ["dark brown", "#4a2c1a"],
  ["red", "#d92b2b"],
  ["dark red", "#8f1d22"],
  ["coral", "#ff6f61"],
  ["pink", "#ff8fb1"],
  ["hot pink", "#ff3d94"],
  ["pastel pink", "#ffc7d9"],
  ["orange", "#f08a2c"],
  ["burnt orange", "#c9601c"],
  ["peach", "#ffbf91"],
  ["yellow", "#ffe14d"],
  ["golden yellow", "#ffc53d"],
  ["gold", "#e0a91f"],
  ["mustard", "#c99a1d"],
  ["lime green", "#a4d83a"],
  ["green", "#3fa24a"],
  ["olive green", "#6f7f4a"],
  ["forest green", "#235c37"],
  ["mint green", "#9be3c0"],
  ["teal", "#178f8f"],
  ["turquoise", "#35cfc9"],
  ["sky blue", "#7cc4f5"],
  ["cyan", "#4cc9f0"],
  ["blue", "#2f6fd6"],
  ["denim blue", "#4f6fa8"],
  ["navy blue", "#161c3d"],
  ["indigo", "#3f3d9e"],
  ["purple", "#7b3ff2"],
  ["violet", "#8b5cf6"],
  ["lilac", "#b79ad8"],
  ["lavender", "#cdb9f2"],
  ["plum", "#6e2f6b"],
  ["magenta", "#d1309f"],
  ["maroon", "#6b1f2e"],
  ["silver", "#bfc5cf"],
];

const toLab = (hex: string): [number, number, number] => {
  const [r8, g8, b8] = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(r8);
  const g = lin(g8);
  const b = lin(b8);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

const NAMED_LAB = NAMED.map(([name, hex]) => [name, toLab(hex)] as const);

/** nearest plain-English colour name */
export function colorName(hex: string): string {
  const [l, a, b] = toLab(hex);
  let best = "grey";
  let bestD = Infinity;
  for (const [name, lab] of NAMED_LAB) {
    const d = (l - lab[0]) ** 2 + (a - lab[1]) ** 2 + (b - lab[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
