/**
 * YOLKSTER CREATOR — the "design": everything the user has chosen.
 *
 * One plain object holds the lot (who, pose, clothes, shot), which makes it
 * trivial to autosave, undo, and squeeze into a share link.
 */

import {
  ASPECTS,
  CHARACTERS,
  EXPRESSIONS,
  POSES,
  SHOTS,
  SLOTS,
  WARDROBE,
  faceOf,
  findItem,
  newPick,
  type AspectId,
  type CharacterId,
  type OutfitSlots,
  type ShotId,
  type SlotId,
  type SlotPick,
} from "@/config/creator";
import {
  BEAK_KINDS,
  BROW_KINDS,
  EYE_KINDS,
  FACE_EXTRAS,
  FEATHER,
  GAZE_KINDS,
  type DollLook,
  type Expression,
  type Face,
} from "./look";
import {
  DIM,
  PET_SPOTS,
  boundsOf,
  clamp,
  defaultItemOffset,
  frameFor,
  itemOffset,
  itemSpot,
  mirrorPose,
  petAt,
  repairPose,
  solve,
  type Bounds,
  type Frame,
  type ItemPlace,
  type PetAnchor,
  type PetPlace,
  type PetSpot,
  type Pose,
} from "./rig";

export type RefKey = "casual" | "action";
export type Target = "gemini" | "chatgpt" | "other";

export interface Shot {
  id: ShotId;
  aspect: AspectId;
  background: "white" | "key" | "scene";
  framing: "full" | "posed" | "bust";
  /** flat backdrop colour for cutouts: white suits most art, green suits white outfits */
  keyColor: "white" | "green";
  /** background description for scene shots */
  scene: string;
  /** leave room for a title */
  textSpace: "none" | "left" | "right";
  notes: string;
}

export interface Design {
  v: 1;
  who: CharacterId;
  /** which reference pictures go to the AI — the first one is the main one */
  refs: RefKey[];
  /** only for an uploaded character */
  customName: string;
  customAbout: string;
  pose: Pose;
  /** the preset this pose came from, until it is edited */
  poseId: string | null;
  poseNotes: string;
  /** the face, piece by piece (a preset is just a ready-made set of pieces) */
  face: Face;
  slots: OutfitSlots;
  /** what is being held ("" = nothing), where it is held and where exactly the placeholder sits */
  item: HeldItem;
  pet: Companion;
  /** anything else about the look */
  extra: string;
  shot: Shot;
  guide: { style: "mannequin" | "dressed"; tint: boolean };
  target: Target;
  /** quote the character's exact colour codes in the prompt (stops the yellow drifting) */
  colors: boolean;
}

export interface HeldItem extends ItemPlace {
  text: string;
}

/** the companion: whether there is one, and where it is (see PetPlace) */
export interface Companion extends PetPlace {
  mode: "keep" | "none" | "custom";
  /** a described companion, when it isn't the character's own */
  text: string;
  /** drawn behind the character instead of in front */
  behind: boolean;
}

/** the companion put squarely in one of the named places (a pet on the ground sits behind the feet) */
export const petAtSpot = <T extends PetPlace>(pet: T, spot: PetSpot): T & { behind: boolean } => ({
  ...pet,
  spot,
  dx: 0,
  dy: 0,
  behind: spot === "ground",
});

export const ITEM_SIZES = { min: 0.5, max: 2.5 } as const;

/** a fresh item placeholder for this hand, sitting in its default spot */
export const itemIn = (text: string, hand: ItemPlace["hand"], prev?: HeldItem): HeldItem => ({
  text,
  hand,
  ...defaultItemOffset(hand),
  rot: 0,
  size: prev?.size ?? 1,
});

/**
 * Change where the item is held. Moving it to a hand snaps it into that
 * hand; letting go ("free") leaves it exactly where it is on the stage.
 */
export function moveItem(d: Design, hand: ItemPlace["hand"]): HeldItem {
  if (hand === d.item.hand) return d.item;
  if (hand !== "free") return itemIn(d.item.text, hand, d.item);
  const sk = solve(d.pose, frameOf(d));
  const spot = itemSpot(sk, d.item);
  return { ...d.item, hand, ...itemOffset(sk, "free", spot.at), rot: Math.round(spot.rot - sk.rBody) };
}

function keepAll(): OutfitSlots {
  const out = {} as OutfitSlots;
  for (const s of SLOTS) out[s.id] = { ...newPick(s.id, WARDROBE[s.id][0].id), keep: true };
  return out;
}

export function shotFor(id: ShotId, prev?: Shot): Shot {
  const p = SHOTS.find((s) => s.id === id) ?? SHOTS[0];
  return {
    id: p.id,
    aspect: p.aspect,
    background: p.background,
    framing: p.framing,
    keyColor: prev?.keyColor ?? "white",
    scene: prev?.scene ?? "",
    textSpace: p.id === "scene" ? (prev?.textSpace ?? "none") : "none",
    notes: prev?.notes ?? "",
  };
}

export function newDesign(who: CharacterId = "dia"): Design {
  const ch = CHARACTERS[who];
  const wave = POSES.find((p) => p.id === "wave") ?? POSES[0];
  return {
    v: 1,
    who,
    refs: ["casual"],
    customName: "",
    customAbout: "",
    pose: wave.pose,
    poseId: wave.id,
    poseNotes: "",
    face: faceOf(wave.expression ?? ch.expression),
    slots: keepAll(),
    item: itemIn("", "R"),
    pet: petAtSpot({ mode: ch.pet ? "keep" : "none", text: "", spot: "shoulderL", dx: 0, dy: 0 }, ch.pet?.spot ?? "shoulderL"),
    extra: "",
    shot: shotFor("roster"),
    guide: { style: "mannequin", tint: true },
    target: "gemini",
    colors: true,
  };
}

/** switch character but keep the pose, outfit choices and shot */
export function withCharacter(d: Design, who: CharacterId): Design {
  const ch = CHARACTERS[who];
  return {
    ...d,
    who,
    refs: ["casual"],
    // a described companion stays as it is; otherwise the new character's own pet starts in its own place
    pet:
      d.pet.mode === "custom"
        ? d.pet
        : ch.pet
          ? petAtSpot({ ...d.pet, mode: "keep", text: "" }, ch.pet.spot)
          : { ...d.pet, mode: "none", text: "" },
  };
}

export const aspectRatio = (id: AspectId) => ASPECTS.find((a) => a.id === id)?.ratio ?? 1;

/**
 * The stage the doll stands on. It takes the picture's shape only when the
 * shot is composed by hand ("as placed on the stage"). For centred and
 * close-up shots the placement doesn't matter, so the stage stays a roomy
 * square and the shape only shows as the dashed "what the AI sees" box.
 */
export const frameOf = (d: Design): Frame =>
  frameFor(d.shot.framing === "posed" ? aspectRatio(d.shot.aspect) : 1);

/** the art whose outfit shows on the doll while a slot is left "as in the art" */
export function mainArt(d: Design) {
  const ch = CHARACTERS[d.who];
  return ch.art.find((a) => a.key === d.refs[0]) ?? ch.art[0];
}

/** what a slot effectively is: the pick, or the art's own item when kept */
export function effectiveSlot(d: Design, slot: SlotId): SlotPick {
  const p = d.slots[slot];
  return p.keep ? mainArt(d).wears[slot] : p;
}

export const outfitChanged = (d: Design) => SLOTS.some((s) => !d.slots[s.id].keep);

/** turn the design into what the doll should draw */
export function resolveLook(d: Design): DollLook {
  const ch = CHARACTERS[d.who];
  const eff = <K extends SlotId>(slot: K) => {
    const p = effectiveSlot(d, slot);
    const item = findItem(slot, p.id);
    return item.look ? { ...item.look, color: p.color, accent: p.accent } : null;
  };
  const top = eff("top");
  let pet: DollLook["pet"] = null;
  const where: PetPlace = { spot: d.pet.spot, dx: d.pet.dx, dy: d.pet.dy };
  if (d.pet.mode === "keep" && ch.pet) pet = { kind: ch.pet.kind, fur: ch.pet.fur, place: where, behind: d.pet.behind };
  else if (d.pet.mode === "custom" && d.pet.text.trim()) pet = { kind: "generic", fur: "#9aa1ad", place: where, behind: d.pet.behind };
  const { text, ...place } = d.item;
  return {
    feather: ch.palette.find((c) => c.part === "Feathers")?.hex.toLowerCase() ?? FEATHER,
    eye: ch.eye,
    lashes: ch.lashes,
    blush: ch.blush,
    face: d.face,
    top,
    bottom: eff("bottom"),
    shoes: eff("shoes"),
    headwear: eff("head"),
    eyewear: eff("eyes"),
    neck: eff("neck"),
    back: eff("back"),
    pet,
    item: text.trim() ? place : null,
  };
}

/**
 * The whole design flipped left to right: the pose, and with it everything
 * that has a side. An item moves to the other hand, a companion to the other
 * shoulder, a wink to the other eye.
 */
export function mirrorDesign(d: Design): Design {
  const item = d.item;
  const inHand = item.hand === "L" || item.hand === "R";
  const spot: PetAnchor = d.pet.spot === "shoulderL" ? "shoulderR" : d.pet.spot === "shoulderR" ? "shoulderL" : d.pet.spot;
  const gaze = d.face.gaze === "left" ? "right" : d.face.gaze === "right" ? "left" : d.face.gaze;
  return {
    ...d,
    pose: mirrorPose(d.pose),
    poseId: null,
    face: { ...d.face, eyeR: d.face.eyeL, eyeL: d.face.eyeR, gaze },
    item: {
      ...item,
      hand: item.hand === "L" ? "R" : item.hand === "R" ? "L" : item.hand,
      // a hand's own frame flips across the fingers; the body's flips across its centre line
      dx: inHand ? item.dx : -item.dx,
      dy: inHand ? -item.dy : item.dy,
      rot: -item.rot,
    },
    // every pet frame is the body's (or the ground's), so its sideways offset simply changes sign
    pet: { ...d.pet, spot, dx: -d.pet.dx },
  };
}

/** is there a companion on the stage right now? */
export const hasPet = (d: Design) =>
  (d.pet.mode === "keep" && !!CHARACTERS[d.who].pet) || (d.pet.mode === "custom" && !!d.pet.text.trim());

// ------------------------------------------------------------- repair --

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  list.includes(v as T) ? (v as T) : d;
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const numIn = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;

/**
 * A face from saved data. Designs saved before faces came apart into pieces
 * only have an `expression` name: those get that preset's face.
 */
function repairFace(raw: unknown, legacy: unknown, fallback: Expression): Face {
  const base = faceOf(oneOf(legacy, EXPRESSIONS.map((e) => e.id), fallback));
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const extras = Array.isArray(o.extras) ? FACE_EXTRAS.filter((e) => (o.extras as unknown[]).includes(e)) : base.extras;
  return {
    eyeR: oneOf(o.eyeR, EYE_KINDS, base.eyeR),
    eyeL: oneOf(o.eyeL, EYE_KINDS, base.eyeL),
    brows: oneOf(o.brows, BROW_KINDS, base.brows),
    beak: oneOf(o.beak, BEAK_KINDS, base.beak),
    blush: oneOf(o.blush, ["auto", "none", "extra"] as const, base.blush),
    gaze: oneOf(o.gaze, GAZE_KINDS, base.gaze),
    extras,
  };
}

/**
 * Rebuild a trustworthy design from anything: a saved session, a share link
 * someone edited by hand, or a link from an older version of the tool.
 * Unknown values fall back to defaults rather than breaking the page.
 */
export function repairDesign(raw: unknown): Design {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const who = oneOf(src.who, Object.keys(CHARACTERS) as CharacterId[], "dia");
  const base = newDesign(who);
  const ch = CHARACTERS[who];

  const refsRaw = Array.isArray(src.refs) ? src.refs : [];
  const refs = refsRaw.filter((r): r is RefKey => ch.art.some((a) => a.key === r));
  const slotsRaw = (src.slots && typeof src.slots === "object" ? src.slots : {}) as Record<string, unknown>;
  const slots = {} as OutfitSlots;
  for (const s of SLOTS) {
    const o = (slotsRaw[s.id] && typeof slotsRaw[s.id] === "object" ? slotsRaw[s.id] : {}) as Record<string, unknown>;
    const id = oneOf(o.id, WARDROBE[s.id].map((i) => i.id), base.slots[s.id].id);
    const item = findItem(s.id, id);
    slots[s.id] = {
      keep: o.keep !== false,
      id,
      color: hex(o.color, item.color),
      accent: hex(o.accent, item.accent ?? "#ffffff"),
      detail: str(o.detail, 200),
    };
  }
  const itemRaw = (src.item && typeof src.item === "object" ? src.item : {}) as Record<string, unknown>;
  const petRaw = (src.pet && typeof src.pet === "object" ? src.pet : {}) as Record<string, unknown>;
  const shotRaw = (src.shot && typeof src.shot === "object" ? src.shot : {}) as Record<string, unknown>;
  const guideRaw = (src.guide && typeof src.guide === "object" ? src.guide : {}) as Record<string, unknown>;
  const shotId = oneOf(shotRaw.id, SHOTS.map((s) => s.id), "roster");
  const shotBase = shotFor(shotId);
  const poseId = typeof src.poseId === "string" && POSES.some((p) => p.id === src.poseId) ? src.poseId : null;
  const itemHand = oneOf(itemRaw.hand, ["L", "R", "both", "free"] as const, "R");
  const petSpot: PetAnchor = oneOf(petRaw.spot, [...PET_SPOTS, "free"] as const, base.pet.spot);
  const itemAt = defaultItemOffset(itemHand); // designs saved before the placeholder could be moved

  return {
    v: 1,
    who,
    refs: refs.length ? [...new Set(refs)] : ["casual"],
    customName: str(src.customName, 60),
    customAbout: str(src.customAbout, 400),
    pose: repairPose(src.pose),
    poseId,
    poseNotes: str(src.poseNotes),
    face: repairFace(src.face, src.expression, ch.expression),
    slots,
    item: {
      text: str(itemRaw.text, 160),
      hand: itemHand,
      dx: numIn(itemRaw.dx, itemAt.dx, -900, 900),
      dy: numIn(itemRaw.dy, itemAt.dy, -900, 900),
      rot: numIn(itemRaw.rot, 0, -180, 180),
      size: numIn(itemRaw.size, 1, ITEM_SIZES.min, ITEM_SIZES.max),
    },
    pet: {
      mode: oneOf(petRaw.mode, ["keep", "none", "custom"] as const, base.pet.mode),
      spot: petSpot,
      // designs saved before the companion could go anywhere have it squarely in its named place
      dx: numIn(petRaw.dx, 0, -3000, 3000),
      dy: numIn(petRaw.dy, 0, -3000, 3000),
      behind: typeof petRaw.behind === "boolean" ? petRaw.behind : petSpot === "ground",
      text: str(petRaw.text, 160),
    },
    extra: str(src.extra),
    shot: {
      id: shotId,
      aspect: oneOf(shotRaw.aspect, ASPECTS.map((a) => a.id), shotBase.aspect),
      background: oneOf(shotRaw.background, ["white", "key", "scene"] as const, shotBase.background),
      framing: oneOf(shotRaw.framing, ["full", "posed", "bust"] as const, shotBase.framing),
      keyColor: oneOf(shotRaw.keyColor, ["white", "green"] as const, "white"),
      scene: str(shotRaw.scene),
      textSpace: oneOf(shotRaw.textSpace, ["none", "left", "right"] as const, "none"),
      notes: str(shotRaw.notes),
    },
    guide: {
      style: oneOf(guideRaw.style, ["mannequin", "dressed"] as const, "mannequin"),
      tint: guideRaw.tint !== false,
    },
    target: oneOf(src.target, ["gemini", "chatgpt", "other"] as const, "gemini"),
    colors: src.colors !== false,
  };
}

// ---------------------------------------------------------------- crop --

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Everything that has to stay in the picture: the doll, plus the companion
 * and the item placeholder when there are any (either can sit well away
 * from the body).
 */
export function designBounds(d: Design, frame: Frame = frameOf(d)): Bounds {
  const sk = solve(d.pose, frame);
  const b = { ...boundsOf(sk) };
  const k = sk.k;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    b.minX = Math.min(b.minX, x0);
    b.minY = Math.min(b.minY, y0);
    b.maxX = Math.max(b.maxX, x1);
    b.maxY = Math.max(b.maxY, y1);
  };
  if (hasPet(d)) {
    const at = petAt(sk, d.pet, d.pose.yaw).at;
    grow(at.x - 92 * k, at.y - 82 * k, at.x + 92 * k, at.y + 76 * k);
  }
  if (d.item.text.trim()) {
    const spot = itemSpot(sk, d.item);
    const r = spot.size * 0.76;
    grow(spot.at.x - r, spot.at.y - r, spot.at.x + r, spot.at.y + r);
  }
  return b;
}

/**
 * The part of the stage that is sent to the AI as the pose guide.
 *  - "posed": the whole frame, so placement and size carry over
 *  - "full":  a box fitted around the doll, so it arrives centred
 *  - "bust":  head and shoulders, for emotes
 * The box always has the picture's aspect ratio.
 */
export function shotBox(d: Design, frame: Frame = frameOf(d)): Box {
  if (d.shot.framing === "posed") return { x: 0, y: 0, w: frame.w, h: frame.h };
  const sk = solve(d.pose, frame);
  const aspect = aspectRatio(d.shot.aspect);
  const k = sk.k;
  if (d.shot.framing === "bust") {
    const top = sk.headC.y - (DIM.HEAD_RY + 96) * k;
    const bottom = sk.headC.y + (DIM.HEAD_RY + 118) * k;
    let h = bottom - top;
    let w = h * aspect;
    const minW = (DIM.HEAD_RX * 2 + 170) * k;
    if (w < minW) {
      w = minW;
      h = w / aspect;
    }
    return { x: sk.headC.x - w / 2, y: (top + bottom) / 2 - h / 2, w, h };
  }
  const b = designBounds(d, frame);
  const margin = 1.12;
  const h = Math.max((b.maxY - b.minY) * margin, ((b.maxX - b.minX) * margin) / aspect);
  const w = h * aspect;
  return { x: (b.minX + b.maxX) / 2 - w / 2, y: (b.minY + b.maxY) / 2 - h / 2, w, h };
}

/** a square view centred on the doll, for zooming in to pose inside a wide or tall frame */
export function zoomBox(d: Design, frame: Frame = frameOf(d)): Box {
  const b = designBounds(d, frame);
  const side = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 1.22;
  return { x: (b.minX + b.maxX) / 2 - side / 2, y: (b.minY + b.maxY) / 2 - side / 2, w: side, h: side };
}
