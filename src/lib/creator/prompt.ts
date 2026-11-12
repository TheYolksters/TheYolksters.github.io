/**
 * YOLKSTER CREATOR — writes the prompt that goes to the image AI.
 *
 * The recipe is "this character, that pose": the real character art carries
 * identity and style, the mannequin picture carries the pose, and this text
 * ties the two together and adds everything a picture can't say — the
 * outfit, the expression, the background.
 *
 * It is written for the current multi-image editing models (Gemini's Nano
 * Banana family, GPT Image). They follow plain labelled sections well and
 * need to be told explicitly what NOT to copy from the pose guide.
 */

import {
  ASPECTS,
  BEAKS,
  BLUSHES,
  BROWS,
  CHARACTERS,
  EXPRESSIONS,
  EXTRAS,
  EYES,
  GAZES,
  POSES,
  SLOTS,
  findItem,
  type PaletteEntry,
  type SlotId,
} from "@/config/creator";
import { colorName, sameFace, type EyeKind, type Face, type FaceExtra } from "./look";
import { DIM, describePose, holdingPose, petAt, samePose, solve, type Pose } from "./rig";
import { effectiveSlot, frameOf, mainArt, type Design } from "./design";

export interface PromptContext {
  /** display name: "DarlingDia" */
  name: string;
  /** how many character reference pictures are attached (1 or 2) */
  refCount: number;
  /** true when everything is combined into one labelled sheet image */
  sheet: boolean;
  /** an uploaded character's main colours, measured from the picture (hex codes, most common first) */
  palette?: string[];
}

const SLOT_WORDS: Record<SlotId, string> = {
  top: "Top",
  bottom: "Bottoms",
  shoes: "Shoes",
  head: "Headwear",
  eyes: "Eyewear",
  neck: "Neck",
  back: "Back",
};

const SPOT_WORDS = {
  shoulderL: "perched on the left shoulder (viewer's right), beside the head",
  shoulderR: "perched on the right shoulder (viewer's left), beside the head",
  head: "sitting on top of the head",
  ground: "on the ground beside the feet",
  arms: "held in the arms",
} as const;

/**
 * Where the companion is, in words. In one of its named places that is the
 * place's own phrase. Put anywhere else, it is described by where it sits
 * around the character: on the ground or how high up, on which side, or in
 * front of (or peeking out from behind) which part. The pose guide carries
 * the exact spot; these words stop the AI putting it back on the shoulder.
 */
export function petWhere(d: Design): string {
  const sk = solve(d.pose, frameOf(d));
  const k = sk.k;
  const at = petAt(sk, d.pet, d.pose.yaw).at;
  const relX = (at.x - sk.pelvis.x) / k;
  const side = relX >= 0 ? "viewer's right" : "viewer's left";
  // Is it over the character (as seen by the viewer) or clear of it? "Over" means its middle is
  // within the silhouette, give or take a little: the body is wider at the chest than at the legs.
  const overHead = Math.abs(at.x - sk.headC.x) < (DIM.HEAD_RX + 10) * k && Math.abs(at.y - sk.headC.y) < (DIM.HEAD_RY + 10) * k;
  const halfWidth = at.y < sk.pelvis.y + 70 * k ? 125 : 92;
  const overBody = Math.abs(relX) < halfWidth + 25 && at.y > sk.neck.y - 20 * k && at.y < sk.ground.y;
  const over = overHead || overBody;

  const named = d.pet.spot !== "free" && (d.pet.spot !== "ground" || Math.hypot(d.pet.dx, d.pet.dy) <= 60);
  if (named && d.pet.spot !== "free") {
    return `${SPOT_WORDS[d.pet.spot]}${d.pet.behind && over ? ", partly hidden behind the character and peeking out" : ""}`;
  }

  const onGround = d.pet.spot === "ground" || at.y + 72 * k >= sk.ground.y - 28 * k;
  if (onGround) {
    if (!over) return `on the ground beside the character, on the ${side}`;
    return d.pet.behind ? "on the ground behind the character's legs, peeking out" : "on the ground in front of the character's feet";
  }
  const part = overHead ? "head" : at.y < sk.pelvis.y - 40 * k ? "chest" : at.y < sk.pelvis.y + 70 * k ? "hips" : "legs";
  if (over) return d.pet.behind ? `behind the character's ${part}, peeking out` : `in front of the character's ${part}`;
  const top = sk.headC.y - DIM.HEAD_RY * k;
  if (at.y < top - 30 * k) {
    return Math.abs(at.x - sk.headC.x) < DIM.HEAD_RX * k ? "up in the air above the character's head" : `up in the air above head height, on the ${side}`;
  }
  const level = at.y < sk.neck.y ? "at head height" : at.y < sk.pelvis.y - 40 * k ? "at chest height" : at.y < sk.pelvis.y + 70 * k ? "at hip height" : "low down, at leg height";
  return `${level}, beside the character on the ${side}`;
}

/** "lilac (#B79AD8) chunky knit turtleneck sweater, cable-knit" */
export function slotWords(d: Design, slot: SlotId): string {
  const p = effectiveSlot(d, slot);
  const item = findItem(slot, p.id);
  const detail = p.detail.trim();
  // image models follow a colour NAME best; the code beside it pins the exact shade
  const col = (hex: string) => (d.colors ? `${colorName(hex)} (${hex.toUpperCase()})` : colorName(hex));
  // "Something else…" items are described entirely by the user's own words
  if (p.id === "other" && detail) return `${col(p.color)} ${detail}`;
  const base = item.words.replace("{c}", col(p.color)).replace("{a}", col(p.accent));
  return detail ? `${base}, ${detail}` : base;
}

// ---------------------------------------------------------------- face --

/** the face in words: a preset's own description while it is untouched, otherwise piece by piece */
export function faceWords(face: Face): string {
  const preset = EXPRESSIONS.find((e) => sameFace(e.face, face));
  if (preset) return preset.words;
  const eye = (k: EyeKind) => EYES.find((e) => e.id === k)?.words ?? "open";
  const bits: string[] = [];
  if (face.eyeR === face.eyeL) bits.push(`both eyes ${eye(face.eyeR)}`);
  else {
    bits.push(
      `the right eye (on the viewer's left) ${eye(face.eyeR)} and the left eye (on the viewer's right) ${eye(face.eyeL)}`,
    );
  }
  const say = (list: { id: string; words: string }[], id: string) => {
    const w = list.find((x) => x.id === id)?.words;
    if (w) bits.push(w);
  };
  say(BROWS, face.brows);
  say(BEAKS, face.beak);
  say(BLUSHES, face.blush);
  say(GAZES, face.gaze);
  for (const x of EXTRAS) if (face.extras.includes(x.id)) bits.push(x.words);
  return bits.join("; ");
}

/** what to call the current face in the interface */
export const faceLabel = (face: Face): string => EXPRESSIONS.find((e) => sameFace(e.face, face))?.label ?? "Custom face";

/** marks that are letters or symbols, which the "no text" rule would otherwise forbid */
const SYMBOL_MARKS: FaceExtra[] = ["zzz", "question", "exclaim", "music"];

// ------------------------------------------------------------- colours --

/**
 * The exact colours the picture must keep, one per line. Image models drift
 * a little brighter and more saturated every time they redraw something, so
 * the prompt pins the values that were measured from the real art.
 */
export function colourLines(d: Design, ctx: Pick<PromptContext, "palette">): string[] {
  if (d.who === "custom") {
    const list = (ctx.palette ?? []).slice(0, 6);
    return list.length ? [`Main colours of the reference, most common first: ${list.map((c) => c.toUpperCase()).join(", ")}`] : [];
  }
  return measuredColours(d).map((c) => `${c.part}: ${c.hex.toUpperCase()}${c.note ? ` (${c.note})` : ""}`);
}

/** a built-in character's measured colours that apply to this design: body, kept companion, kept clothes */
export function measuredColours(d: Design): PaletteEntry[] {
  const ch = CHARACTERS[d.who];
  const list: PaletteEntry[] = [...ch.palette];
  if (d.pet.mode === "keep" && ch.pet) {
    const noun = ch.pet.words.split(" ").pop() ?? "pet";
    list.push({ part: `${noun[0].toUpperCase()}${noun.slice(1)} fur`, hex: ch.pet.fur });
  }
  // clothes that stay as they are in the reference keep their measured colours too
  for (const c of mainArt(d).colors) if (d.slots[c.slot].keep) list.push(c);
  return list;
}

const NO_DRIFT = "Do not brighten, deepen, warm up or add saturation to any of them.";

/** the pose words: the preset's name while untouched, otherwise nothing */
function poseHeadline(d: Design): string {
  const preset = d.poseId ? POSES.find((p) => p.id === d.poseId) : undefined;
  if (preset && samePose(preset.pose, d.pose)) return preset.words;
  return "";
}

/** the pose as the picture should show it: a hand that holds something is closed around it */
const shownPose = (d: Design): Pose => holdingPose(d.pose, d.item.text.trim() ? d.item.hand : null);

const article = (s: string) => (/^(a|an|the|no|nothing|small|round|gold)\b/i.test(s) ? s : `a ${s}`);

export function buildPrompt(d: Design, ctx: PromptContext): string {
  const ch = CHARACTERS[d.who];
  const custom = d.who === "custom";
  const name = ctx.name || "the character";
  const refs = Math.max(1, ctx.refCount);

  // how the prompt refers to each picture
  const CHAR = ctx.sheet
    ? refs > 1
      ? "the CHARACTER panels"
      : "the CHARACTER panel"
    : refs > 1
      ? "IMAGES 1 and 2"
      : "IMAGE 1";
  const MAIN = ctx.sheet ? "the first CHARACTER panel" : "IMAGE 1";
  const POSE = ctx.sheet ? "the POSE GUIDE panel" : `IMAGE ${refs + 1}`;
  const out: string[] = [];

  // ---- task ----------------------------------------------------------
  if (ctx.sheet) {
    out.push(
      `The attached picture is a reference sheet with labelled panels. Draw ONE new illustration of the character from ${CHAR}, in the pose shown in ${POSE}.`,
    );
  } else {
    out.push(`Draw a new illustration of the character from ${CHAR}, in the pose shown in ${POSE}.`);
  }

  // ---- character -----------------------------------------------------
  const identity = custom
    ? d.customAbout.trim()
      ? `${name}: ${d.customAbout.trim()}`
      : `${name}, exactly as drawn`
    : `${name}: ${ch.identity}`;
  const keep = custom
    ? "Keep the face, colours, proportions and the exact art style of the reference."
    : `Keep ${ch.possessive} face, eye colour, feather colour, head tuft, proportions and the exact art style of the reference: thick dark-brown outlines, flat colours with soft cel shading, a cute sticker-like mascot look.`;
  out.push(
    `${ctx.sheet ? CHAR[0].toUpperCase() + CHAR.slice(1) : CHAR} ${refs > 1 ? "are character references (the same character in two outfits)" : "is the character reference"}. This is ${identity}. ${keep}`,
  );

  // ---- pose guide ----------------------------------------------------
  const guideLooks =
    d.guide.style === "mannequin"
      ? "a plain grey mannequin with the same body proportions"
      : "a simple flat doll version of the character";
  const dontCopy =
    d.guide.style === "mannequin"
      ? "Copy nothing else from it: no grey body, no joint dots, no dashed lines, no flat style."
      : "Copy nothing else from it: its flat simplified drawing style must not appear, and its clothes are only a rough colour sketch.";
  const sides =
    d.guide.style === "mannequin" && d.guide.tint
      ? " Its blue limbs are the character's RIGHT arm and leg (on the viewer's left); its orange limbs are the LEFT."
      : "";
  const placement =
    d.shot.framing === "posed"
      ? "Match its pose, limb positions, head tilt, the direction it faces, and its size and position in the frame."
      : "Match its pose, limb positions, head tilt and the direction it faces.";
  out.push(
    `${ctx.sheet ? POSE[0].toUpperCase() + POSE.slice(1) : POSE} is a pose guide only: ${guideLooks}. ${placement} ${dontCopy}${sides}`,
  );

  // ---- pose in words -------------------------------------------------
  const headline = poseHeadline(d);
  const lines = describePose(shownPose(d), frameOf(d));
  const poseBlock = [`POSE${headline ? `: ${headline}.` : ":"}`, ...lines.map((l) => `- ${l}`)];
  if (d.poseNotes.trim()) poseBlock.push(`- ${d.poseNotes.trim()}`);
  out.push(poseBlock.join("\n"));

  out.push(`EXPRESSION: ${faceWords(d.face)}.`);

  // ---- outfit --------------------------------------------------------
  // "nothing here" is only worth saying when the art HAS something there to take off
  const art = mainArt(d);
  const changed = SLOTS.filter(
    (s) => !d.slots[s.id].keep && !(d.slots[s.id].id === "none" && art.wears[s.id].id === "none"),
  );
  if (changed.length === 0) {
    out.push(`OUTFIT: exactly the same clothes as in ${MAIN}.`);
  } else {
    const core: SlotId[] = ["top", "bottom", "shoes"];
    const fullSwap = core.every((s) => !d.slots[s].keep);
    const rows = changed.map((s) => `- ${SLOT_WORDS[s.id]}: ${slotWords(d, s.id)}.`);
    out.push(
      [
        fullSwap
          ? `OUTFIT: replace the clothes from ${MAIN} with this new outfit:`
          : `OUTFIT: keep the clothes from ${MAIN}, with these changes:`,
        ...rows,
      ].join("\n"),
    );
  }
  if (d.extra.trim()) out.push(`EXTRA DETAILS: ${d.extra.trim()}`);

  // ---- colours -------------------------------------------------------
  if (d.colors) {
    const colours = colourLines(d, ctx);
    if (custom && colours.length) {
      out.push(`COLOURS: keep the reference's own colours exactly. ${colours[0]}. ${NO_DRIFT}`);
    } else if (colours.length) {
      out.push(
        [
          `COLOURS: these are the exact colour values of ${MAIN}. Match them as flat fills with the same soft shading. ${NO_DRIFT}`,
          ...colours.map((c) => `- ${c}`),
        ].join("\n"),
      );
    }
  }

  // ---- companion -----------------------------------------------------
  let companion = "";
  if (d.pet.mode === "keep" && ch.pet) {
    companion = `${ch.possessive} ${ch.pet.words}`;
    out.push(`COMPANION: keep ${companion} from ${MAIN}, ${petWhere(d)}. The small animal shape in the pose guide marks the spot.`);
  } else if (d.pet.mode === "custom" && d.pet.text.trim()) {
    companion = d.pet.text.trim();
    out.push(`COMPANION: add ${article(companion)}, ${petWhere(d)}, drawn in the same style. The small animal shape in the pose guide marks the spot.`);
  } else if (ch.pet) {
    out.push(`COMPANION: none. Leave out the ${ch.pet.words} that appears in the character reference.`);
  } else if (custom) {
    out.push("COMPANION: none. Do not draw any pet or second character, even if one appears in the reference.");
  }

  // ---- held item -----------------------------------------------------
  if (d.item.text.trim()) {
    const thing = article(d.item.text.trim());
    if (d.item.hand === "free") {
      out.push(`PROP: ${thing}, not held. It sits where the box in the pose guide is.`);
    } else {
      const where =
        d.item.hand === "both"
          ? "in both hands"
          : d.item.hand === "L"
            ? "in the left hand (viewer's right)"
            : "in the right hand (viewer's left)";
      out.push(`HOLDING: ${thing}, ${where}. The box in the pose guide marks where it goes.`);
    }
  }

  // ---- shot ----------------------------------------------------------
  const aspect = ASPECTS.find((a) => a.id === d.shot.aspect) ?? ASPECTS[0];
  const shape = `${aspect.label} image (${aspect.id}).`;
  if (d.shot.framing === "bust") {
    out.push(
      `SHOT: emote-style close-up of the head and shoulders filling the frame. Make the expression big and instantly readable, with bold simple shapes that stay clear when shrunk to 28 pixels. ${shape}`,
    );
  } else if (d.shot.framing === "posed") {
    const room =
      d.shot.textSpace === "none"
        ? ""
        : ` Keep the ${d.shot.textSpace} third of the image calm and uncluttered so a title can be added there later.`;
    out.push(
      `SHOT: ${shape} Place the character where the figure stands in the pose guide, at the same size relative to the frame.${room}`,
    );
  } else {
    out.push(
      `SHOT: full body, centred, the whole character visible from the tip of the head tuft to the shoes with a small margin all round. ${shape}`,
    );
  }

  const airborne = d.pose.lift > 30;
  if (d.shot.background === "scene") {
    const scene = d.shot.scene.trim() || "a simple setting that suits the pose";
    out.push(
      `BACKGROUND: ${scene}. Draw it in the same cartoon style as the character, a little softer and simpler so the character stands out.`,
    );
  } else if (d.shot.background === "key") {
    if (d.target === "chatgpt") {
      out.push("BACKGROUND: fully transparent (PNG with an alpha channel). No ground shadow, no floor.");
    } else if (d.shot.keyColor === "green") {
      out.push(
        "BACKGROUND: one perfectly flat, uniform pure green (#00FF00) filling the whole image. No shadow, no gradient, no floor line, and no green anywhere on the character. Keep every part of the character clear of the image edges.",
      );
    } else {
      out.push(
        "BACKGROUND: one perfectly flat, uniform pure white (#FFFFFF) filling the whole image. No shadow, no gradient, no floor line. Keep every part of the character clear of the image edges.",
      );
    }
  } else {
    out.push(
      `BACKGROUND: plain pure white (#FFFFFF) and nothing else, with a small soft shadow on the ground ${airborne ? "below the character, who is in the air" : "under the feet"}.`,
    );
  }
  if (d.shot.notes.trim()) out.push(`ALSO: ${d.shot.notes.trim()}`);

  // ---- rules ---------------------------------------------------------
  const cast = companion ? "Exactly one character plus the companion." : "Exactly one character.";
  const sheetRule = ctx.sheet ? " Output a single finished illustration, not a sheet: no panels, no labels." : "";
  const symbols = d.face.extras.some((e) => SYMBOL_MARKS.includes(e)) ? " (apart from the cartoon symbol named under EXPRESSION)" : "";
  out.push(`RULES: ${cast} No text${symbols}, logos, watermarks, borders or extra limbs. Family-friendly.${sheetRule}`);

  return out.join("\n\n");
}

/** ready-made replies for when the first result isn't right */
export function followUps(d: Design, ctx: PromptContext): { id: string; label: string; text: string }[] {
  const ch = CHARACTERS[d.who];
  const lines = describePose(shownPose(d), frameOf(d));
  const bg =
    d.shot.background === "scene"
      ? "Keep the background as it is."
      : d.shot.background === "key" && d.shot.keyColor === "green" && d.target !== "chatgpt"
        ? "Keep the background flat pure green."
        : "Keep the background plain white.";
  const feature = d.who === "custom" ? "face, colours and proportions" : `face, ${ch.lashes ? "eyelashes, blush, " : ""}eye colour, head tuft and proportions`;
  const colours = colourLines(d, ctx);
  const values = colours.length ? `\n${colours.map((c) => `- ${c}`).join("\n")}\n` : " ";
  return [
    {
      id: "pose",
      label: "The pose is off",
      text: `The pose doesn't match the pose guide yet. Redraw it with the limbs exactly as the guide shows:\n${lines.map((l) => `- ${l}`).join("\n")}\nChange nothing else: same character, same outfit, same style. ${bg}`,
    },
    {
      id: "face",
      label: "It doesn't look like them",
      text: `The character has drifted from the character reference. Redraw with exactly the same ${feature} as the reference, in the same line and shading style. Keep the pose and outfit from your last image. ${bg}`,
    },
    {
      id: "colour",
      label: "The colours drifted",
      text: `The colours have drifted from the character reference. Recolour your last image so they match the reference exactly${colours.length ? ", using these values:" : "."}${values}${NO_DRIFT} Change nothing else: same pose, same outfit, same line work. ${bg}`,
    },
    {
      id: "style",
      label: "The style changed",
      text: "The art style has changed. Match the character reference exactly: thick dark-brown outlines, flat colours with soft cel shading, no realistic textures, no 3D rendering. Keep the pose and outfit.",
    },
    {
      id: "bg",
      label: "The background isn't clean",
      text:
        d.shot.background === "scene"
          ? "Simplify the background so the character stands out clearly, and remove anything overlapping the character. Change nothing about the character."
          : "Make the background one perfectly flat colour with nothing else in it: no objects, no gradient, no floor line. Change nothing about the character.",
    },
    {
      id: "extras",
      label: "There's stray stuff",
      text: `Remove any text, logos, watermarks, extra characters and stray objects.${ctx.sheet ? " Output one single illustration, not a sheet." : ""} Change nothing else.`,
    },
    {
      id: "again",
      label: "Same look, new pose",
      text: `Great. Keep this exact character, outfit and style. I'm attaching a new pose guide: redraw the character in that pose, copying only the pose from the guide. Take every colour from the original character reference, not from your last image${colours.length ? `:${values}` : ". "}${NO_DRIFT}`,
    },
  ];
}

/** a short tag for file names: "Wave", "TeamJersey" … */
export function fileTag(d: Design): string {
  const preset = d.poseId ? POSES.find((p) => p.id === d.poseId) : undefined;
  const base = preset ? preset.label : "Pose";
  return base.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Pose";
}
