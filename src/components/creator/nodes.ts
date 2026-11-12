import type { HandleId } from "@/lib/creator/rig";

/**
 * Everything on the stage that can be clicked, dragged and right-clicked:
 * the doll's own dots, plus the held item and the companion.
 */
export type NodeId = HandleId | "item" | "pet";

export type NodeKind = "end" | "joint" | "turn" | "move" | "look" | "prop" | "pet";

export const NODES: Record<NodeId, { label: string; hint: string; kind: NodeKind }> = {
  handR: { label: "Right hand", hint: "The character's right, on the left of the screen. Drag to move the whole arm.", kind: "end" },
  handL: { label: "Left hand", hint: "The character's left, on the right of the screen. Drag to move the whole arm.", kind: "end" },
  elbowR: { label: "Right elbow", hint: "Drag to swing the elbow; the hand stays aimed where it was.", kind: "joint" },
  elbowL: { label: "Left elbow", hint: "Drag to swing the elbow; the hand stays aimed where it was.", kind: "joint" },
  footR: { label: "Right foot", hint: "The character's right, on the left of the screen. Drag to move the whole leg.", kind: "end" },
  footL: { label: "Left foot", hint: "The character's left, on the right of the screen. Drag to move the whole leg.", kind: "end" },
  kneeR: { label: "Right knee", hint: "Drag to swing the knee; the foot stays aimed where it was.", kind: "joint" },
  kneeL: { label: "Left knee", hint: "Drag to swing the knee; the foot stays aimed where it was.", kind: "joint" },
  toeR: { label: "Right toes", hint: "Drag up or down to tip the foot.", kind: "joint" },
  toeL: { label: "Left toes", hint: "Drag up or down to tip the foot.", kind: "joint" },
  head: { label: "Head tilt", hint: "Drag sideways to tilt the head.", kind: "turn" },
  look: { label: "Face", hint: "Drag the face around the head to turn and nod it.", kind: "look" },
  chest: { label: "Waist bend", hint: "Drag sideways to lean the upper body.", kind: "turn" },
  body: { label: "Body", hint: "Drag to move the whole character around the frame.", kind: "move" },
  item: {
    label: "Held item",
    hint: "A stand-in box: the AI draws the real thing there. Drag it to where it should go.",
    kind: "prop",
  },
  pet: {
    label: "Companion",
    hint: "Drag it anywhere. Dropped by a shoulder, on the head or on the ground, it stays attached there.",
    kind: "pet",
  },
};

/** which limb a dot belongs to */
export const LIMB_OF: Partial<Record<NodeId, "armL" | "armR" | "legL" | "legR">> = {
  handL: "armL",
  elbowL: "armL",
  handR: "armR",
  elbowR: "armR",
  footL: "legL",
  kneeL: "legL",
  toeL: "legL",
  footR: "legR",
  kneeR: "legR",
  toeR: "legR",
};

/** which card of options a node opens */
export type CardKind = "hand" | "elbow" | "foot" | "knee" | "face" | "body" | "item" | "pet";

export const CARD_OF: Record<NodeId, CardKind> = {
  handL: "hand",
  handR: "hand",
  elbowL: "elbow",
  elbowR: "elbow",
  footL: "foot",
  footR: "foot",
  toeL: "foot",
  toeR: "foot",
  kneeL: "knee",
  kneeR: "knee",
  look: "face",
  head: "face",
  body: "body",
  chest: "body",
  item: "item",
  pet: "pet",
};
