/**
 * YOLKSTER CREATOR — the doll's skeleton.
 *
 * Pure math, no React: pose data, forward kinematics (pose → joint
 * positions), inverse kinematics (drag a hand → arm angles), mirroring and a
 * plain-English description of the pose for the AI prompt.
 *
 * Conventions (worth reading once before touching the numbers):
 * - Stage units. The frame is always 1000 tall; its width follows the
 *   chosen aspect ratio. `pose.x / pose.y` are fractions of the frame so a
 *   pose keeps its placement when the aspect ratio changes.
 * - Rotations are degrees, clockwise-positive on screen (same as SVG).
 * - Limb angles are mirror-symmetric: for BOTH arms `shoulder: 90` means
 *   "straight out to that arm's own side" and `180` means "straight up".
 *   That makes mirroring a pose a plain left/right swap.
 * - "L" / "R" are the CHARACTER's left and right. Facing the viewer, the
 *   character's left arm is on the right of the screen.
 */

export type Side = "L" | "R";
export type ArmLayer = "back" | "mid" | "front";
export type LegLayer = "back" | "front";
export const HAND_SHAPES = [
  "relaxed",
  "flat",
  "open",
  "fist",
  "point",
  "thumb",
  "thumbDown",
  "peace",
  "rock",
  "grip",
  "palmUp",
] as const;
export type HandShape = (typeof HAND_SHAPES)[number];
/** which side of the hand faces the viewer ("auto" = whatever looks natural) */
export type PalmSide = "auto" | "front" | "back";

export interface ArmPose {
  /** 0 hangs down, 90 straight out to the side, 180 straight up; negative reaches across the body */
  shoulder: number;
  /** bend relative to the upper arm, same turning direction as `shoulder` */
  elbow: number;
  /** bend of the hand relative to the forearm, same turning direction again */
  wrist: number;
  /** back = behind the body · mid = over the body, behind the head · front = over everything */
  layer: ArmLayer;
  hand: HandShape;
  palm: PalmSide;
}

export interface LegPose {
  /** 0 straight down, positive swings out to that leg's own side */
  hip: number;
  /** bend relative to the thigh, same turning direction as `hip` */
  knee: number;
  /** 0 flat, positive toes up, negative toes pointed down */
  foot: number;
  /** back = behind the body (normal) · front = over the body (high kick, sitting) */
  layer: LegLayer;
  /**
   * The foot turned to face the other way. Left alone, toes point outward
   * when the doll faces you and forward once it is turned side-on; flipped,
   * they point inward or backward instead.
   */
  flip: boolean;
}

export interface Pose {
  /** pelvis position as a fraction of the frame (0–1) */
  x: number;
  y: number;
  /** 1 = default size (roughly 70% of the frame height) */
  scale: number;
  /** whole-body tilt */
  rot: number;
  /** body turn: 0 faces the viewer, positive turns toward screen-right, ±80 is a side view */
  yaw: number;
  /** how far the feet are off the ground (0 = standing) */
  lift: number;
  /** waist bend, relative to `rot` */
  torso: number;
  /** head tilt, relative to the torso */
  head: number;
  /** where the face points inside the head, −1…1 each way */
  lookX: number;
  lookY: number;
  armL: ArmPose;
  armR: ArmPose;
  legL: LegPose;
  legR: LegPose;
}

export interface Frame {
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Doll proportions in stage units at scale 1 — chibi: big head, small body. */
export const DIM = {
  HEAD_RX: 176,
  HEAD_RY: 158,
  /** head centre above the neck */
  HEAD_UP: 124,
  /** pelvis → neck */
  TORSO: 192,
  SHOULDER_W: 94,
  SHOULDER_DROP: 46,
  UPPER_ARM: 76,
  /** elbow → centre of the hand */
  FORE_ARM: 80,
  ARM_W: 58,
  HAND_R: 30,
  HIP_W: 54,
  THIGH: 56,
  SHIN: 58,
  LEG_W: 68,
  FOOT_L: 96,
  FOOT_H: 54,
  PELVIS_RX: 104,
  PELVIS_RY: 60,
} as const;

/** how far a wrist can bend either way, in degrees */
export const WRIST_MAX = 110;

/** frame height in stage units; width = FRAME_H × aspect */
export const FRAME_H = 1000;

export const frameFor = (aspect: number): Frame => ({
  w: Math.round(FRAME_H * aspect),
  h: FRAME_H,
});

// ---------------------------------------------------------------- math --

const RAD = Math.PI / 180;
export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
/** wrap to (−180, 180] */
export const norm = (deg: number) => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};
const round1 = (v: number) => Math.round(v * 10) / 10;

/** unit vector of a limb that hangs DOWN at rotation 0 */
const down = (r: number): Pt => ({ x: -Math.sin(r * RAD), y: Math.cos(r * RAD) });
/** unit vector of a part that points UP at rotation 0 */
const up = (r: number): Pt => ({ x: Math.sin(r * RAD), y: -Math.cos(r * RAD) });
/** unit vector pointing to screen-right at rotation 0 */
const right = (r: number): Pt => ({ x: Math.cos(r * RAD), y: Math.sin(r * RAD) });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** rotation whose `down()` vector points along v */
const rotOfDown = (v: Pt) => Math.atan2(-v.x, v.y) / RAD;
/** rotation whose `up()` vector points along v */
const rotOfUp = (v: Pt) => Math.atan2(v.x, -v.y) / RAD;
/** rotate a vector by r degrees (clockwise on screen) */
export const spin = (v: Pt, r: number): Pt => {
  const c = Math.cos(r * RAD);
  const s = Math.sin(r * RAD);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};

const sideSign = (side: Side): 1 | -1 => (side === "L" ? 1 : -1);

// ------------------------------------------------------------ skeleton --

export interface ArmSk {
  s: 1 | -1;
  shoulder: Pt;
  elbow: Pt;
  /** where the sleeve ends */
  wrist: Pt;
  /** centre of the hand */
  hand: Pt;
  rUpper: number;
  rFore: number;
  /** which way the fingers point (the forearm's direction plus the wrist bend) */
  rHand: number;
}

export interface LegSk {
  s: 1 | -1;
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  /** centre of the shoe */
  foot: Pt;
  /** tip of the shoe (the rotate handle sits here) */
  toe: Pt;
  rThigh: number;
  rShin: number;
  rFoot: number;
  /** +1 when the toes point to screen-right */
  toeSign: 1 | -1;
}

export interface Skeleton {
  /** uniform scale (pose.scale) */
  k: number;
  pelvis: Pt;
  neck: Pt;
  /** the waist-bend handle */
  chest: Pt;
  headC: Pt;
  headTop: Pt;
  rBody: number;
  rTorso: number;
  rHead: number;
  cosYaw: number;
  sinYaw: number;
  /** body yaw + head look, degrees */
  headYaw: number;
  /** face-feature centre, relative to the head centre, in head-local units */
  faceLocal: Pt;
  /** the same point in stage coordinates (the "look" handle) */
  face: Pt;
  /** which screen side the tail tuft peeks out on */
  tailSide: 1 | -1;
  armL: ArmSk;
  armR: ArmSk;
  legL: LegSk;
  legR: LegSk;
  /** centre of the ground shadow */
  ground: Pt;
  groundRx: number;
}

/** how far the shoe sticks out past the ankle: a little facing us, a lot in profile */
const footReach = (sinYaw: number) => 0.14 + 0.2 * Math.abs(sinYaw);

/** how far the face can slide inside the head, as a fraction of the head radius */
const FACE_SLIDE = 0.6;
const FACE_Y0 = 16;
const LOOK_YAW = 50;
const LOOK_PITCH = 0.3;

export function solve(pose: Pose, frame: Frame): Skeleton {
  const k = pose.scale;
  const pelvis = { x: pose.x * frame.w, y: pose.y * frame.h };
  const rBody = pose.rot;
  const rTorso = rBody + pose.torso;
  const rHead = rTorso + pose.head;
  const cosYaw = Math.cos(pose.yaw * RAD);
  const sinYaw = Math.sin(pose.yaw * RAD);

  const neck = add(pelvis, up(rTorso), DIM.TORSO * k);
  const chest = add(pelvis, up(rTorso), DIM.TORSO * 0.72 * k);
  const headC = add(neck, up(rHead), DIM.HEAD_UP * k);
  const headTop = add(headC, up(rHead), (DIM.HEAD_RY + 44) * k);

  const headYaw = clamp(pose.yaw + pose.lookX * LOOK_YAW, -85, 85);
  const faceLocal = {
    x: Math.sin(headYaw * RAD) * DIM.HEAD_RX * FACE_SLIDE,
    y: FACE_Y0 + pose.lookY * DIM.HEAD_RY * LOOK_PITCH,
  };
  const face = add(headC, spin(faceLocal, rHead), k);

  const arm = (side: Side): ArmSk => {
    const s = sideSign(side);
    const a = side === "L" ? pose.armL : pose.armR;
    const shoulder = add(
      add(pelvis, up(rTorso), (DIM.TORSO - DIM.SHOULDER_DROP) * k),
      right(rTorso),
      s * DIM.SHOULDER_W * cosYaw * k,
    );
    const rUpper = rTorso - s * a.shoulder;
    const rFore = rUpper - s * a.elbow;
    const elbow = add(shoulder, down(rUpper), DIM.UPPER_ARM * k);
    const wrist = add(elbow, down(rFore), (DIM.FORE_ARM - 24) * k);
    const hand = add(elbow, down(rFore), DIM.FORE_ARM * k);
    return { s, shoulder, elbow, wrist, hand, rUpper, rFore, rHand: rFore - s * a.wrist };
  };

  const leg = (side: Side): LegSk => {
    const s = sideSign(side);
    const l = side === "L" ? pose.legL : pose.legR;
    const hip = add(
      add(pelvis, down(rBody), 14 * k),
      right(rBody),
      s * DIM.HIP_W * cosYaw * k,
    );
    const rThigh = rBody - s * l.hip;
    const rShin = rThigh - s * l.knee;
    const knee = add(hip, down(rThigh), DIM.THIGH * k);
    const ankle = add(knee, down(rShin), DIM.SHIN * k);
    // toes point outward when facing the viewer, forward once turned… unless this foot is flipped
    const natural: 1 | -1 = Math.abs(pose.yaw) > 20 ? (pose.yaw > 0 ? 1 : -1) : s;
    const toeSign: 1 | -1 = l.flip ? (natural === 1 ? -1 : 1) : natural;
    const rFoot = rBody - toeSign * l.foot;
    const reach = footReach(sinYaw);
    const foot = add(
      add(ankle, right(rFoot), toeSign * DIM.FOOT_L * reach * k),
      down(rFoot),
      DIM.FOOT_H * 0.28 * k,
    );
    const toe = add(foot, right(rFoot), toeSign * DIM.FOOT_L * 0.56 * k);
    return { s, hip, knee, ankle, foot, toe, rThigh, rShin, rFoot, toeSign };
  };

  const armL = arm("L");
  const armR = arm("R");
  const legL = leg("L");
  const legR = leg("R");

  // The shadow sits under whatever is lowest. Upright that is the feet; once
  // the body is tipped over (lying down, a cartwheel) it may be the head.
  const tipped = Math.abs(norm(rBody)) > 45;
  const lowest = Math.max(
    legL.foot.y + DIM.FOOT_H * 0.5 * k,
    legR.foot.y + DIM.FOOT_H * 0.5 * k,
    pelvis.y + DIM.PELVIS_RY * 0.85 * k,
    tipped ? headC.y + DIM.HEAD_RY * 0.95 * k : -Infinity,
  );
  const lift = Math.max(0, pose.lift);
  const ground = {
    x: tipped ? (pelvis.x + headC.x) / 2 : (legL.foot.x + legR.foot.x + 2 * pelvis.x) / 4,
    y: lowest + lift * k - 6 * k,
  };
  const spread = tipped ? Math.abs(headC.x - pelvis.x) / 2 + 60 * k : Math.abs(legL.foot.x - legR.foot.x) / 2;
  const groundRx = Math.max(60 * k, (spread + 92 * k) * (1 - Math.min(0.45, lift / 600)));

  return {
    k,
    pelvis,
    neck,
    chest,
    headC,
    headTop,
    rBody,
    rTorso,
    rHead,
    cosYaw,
    sinYaw,
    headYaw,
    faceLocal,
    face,
    tailSide: pose.yaw > 5 ? -1 : 1,
    armL,
    armR,
    legL,
    legR,
    ground,
    groundRx,
  };
}

// ------------------------------------------------------------------ IK --

/**
 * Two-bone IK. Returns the rotation of each bone so the chain starting at
 * `from` ends as close to `to` as its length allows. There are always two
 * mirror-image answers; `prefer` picks between them.
 */
function twoBone(
  from: Pt,
  to: Pt,
  l1: number,
  l2: number,
): [{ r1: number; r2: number; mid: Pt }, { r1: number; r2: number; mid: Pt }] {
  let v = sub(to, from);
  let d = Math.hypot(v.x, v.y);
  if (d < 1e-6) {
    v = { x: 0, y: 1 };
    d = 1;
  }
  const reach = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(v.y, v.x);
  const inner = Math.acos(clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1));
  const end = { x: from.x + (v.x / d) * reach, y: from.y + (v.y / d) * reach };
  const answer = (sign: 1 | -1) => {
    const th = base + sign * inner;
    const mid = { x: from.x + l1 * Math.cos(th), y: from.y + l1 * Math.sin(th) };
    return {
      r1: rotOfDown({ x: Math.cos(th), y: Math.sin(th) }),
      r2: rotOfDown(sub(end, mid)),
      mid,
    };
  };
  return [answer(1), answer(-1)];
}

/** point an arm's hand at `target` (stage coordinates) */
export function reachArm(pose: Pose, frame: Frame, side: Side, target: Pt, flip = false): Pose {
  const sk = solve(pose, frame);
  const a = side === "L" ? sk.armL : sk.armR;
  const cur = side === "L" ? pose.armL : pose.armR;
  const k = sk.k;
  const [p, q] = twoBone(a.shoulder, target, DIM.UPPER_ARM * k, DIM.FORE_ARM * k);
  const toAngles = (ans: { r1: number; r2: number }) => ({
    shoulder: norm(a.s * (sk.rTorso - ans.r1)),
    elbow: norm(a.s * (ans.r1 - ans.r2)),
  });
  const A = toAngles(p);
  const B = toAngles(q);
  let pick: typeof A;
  if (Math.abs(cur.elbow) < 4) {
    // straight arm: prefer the answer whose elbow sits further out from the body
    const out = (m: Pt) => a.s * dot(sub(m, a.shoulder), right(sk.rTorso));
    pick = out(p.mid) >= out(q.mid) ? A : B;
  } else {
    pick = Math.sign(A.elbow) === Math.sign(cur.elbow) ? A : B;
  }
  if (flip) pick = pick === A ? B : A;
  const next: ArmPose = { ...cur, shoulder: round1(pick.shoulder), elbow: round1(pick.elbow) };
  return side === "L" ? { ...pose, armL: next } : { ...pose, armR: next };
}

/** put a leg's ankle at `target` (stage coordinates) */
export function reachLeg(pose: Pose, frame: Frame, side: Side, target: Pt, flip = false): Pose {
  const sk = solve(pose, frame);
  const l = side === "L" ? sk.legL : sk.legR;
  const cur = side === "L" ? pose.legL : pose.legR;
  const k = sk.k;
  const [p, q] = twoBone(l.hip, target, DIM.THIGH * k, DIM.SHIN * k);
  const toAngles = (ans: { r1: number; r2: number }) => ({
    hip: norm(l.s * (sk.rBody - ans.r1)),
    knee: norm(l.s * (ans.r1 - ans.r2)),
  });
  const A = toAngles(p);
  const B = toAngles(q);
  let pick: typeof A;
  if (Math.abs(cur.knee) < 4) {
    // straight leg: knees bow outward facing us, forward when turned
    const dir = Math.abs(pose.yaw) > 20 ? Math.sign(pose.yaw) : l.s;
    const fwd = (m: Pt) => dir * dot(sub(m, l.hip), right(sk.rBody));
    pick = fwd(p.mid) >= fwd(q.mid) ? A : B;
  } else {
    pick = Math.sign(A.knee) === Math.sign(cur.knee) ? A : B;
  }
  if (flip) pick = pick === A ? B : A;
  const next: LegPose = { ...cur, hip: round1(pick.hip), knee: round1(pick.knee) };
  return side === "L" ? { ...pose, legL: next } : { ...pose, legR: next };
}

/** turn a foot to face the other way (the leg stays exactly as it is) */
export function flipFoot(pose: Pose, limb: "legL" | "legR"): Pose {
  return { ...pose, [limb]: { ...pose[limb], flip: !pose[limb].flip } };
}

/** flip an elbow / knee to its mirror-image bend, keeping the hand / foot where it is */
export function flipBend(pose: Pose, frame: Frame, limb: "armL" | "armR" | "legL" | "legR"): Pose {
  const sk = solve(pose, frame);
  if (limb === "armL" || limb === "armR") {
    const side: Side = limb === "armL" ? "L" : "R";
    const cur = pose[limb];
    if (Math.abs(cur.elbow) < 4) return pose;
    return reachArm(pose, frame, side, sk[limb].hand, true);
  }
  const side: Side = limb === "legL" ? "L" : "R";
  const cur = pose[limb];
  if (Math.abs(cur.knee) < 4) return pose;
  return reachLeg(pose, frame, side, sk[limb].ankle, true);
}

// --------------------------------------------------------------- drags --

export type HandleId =
  | "handL"
  | "handR"
  | "elbowL"
  | "elbowR"
  | "footL"
  | "footR"
  | "kneeL"
  | "kneeR"
  | "toeL"
  | "toeR"
  | "head"
  | "look"
  | "chest"
  | "body";

export interface DragOptions {
  /** keep the feet where they were when the body is dragged (crouch / lean) */
  plantFeet?: boolean;
}

/** where a handle currently sits, in stage coordinates */
export function handlePoint(sk: Skeleton, id: HandleId): Pt {
  switch (id) {
    case "handL":
      return sk.armL.hand;
    case "handR":
      return sk.armR.hand;
    case "elbowL":
      return sk.armL.elbow;
    case "elbowR":
      return sk.armR.elbow;
    case "footL":
      return sk.legL.ankle;
    case "footR":
      return sk.legR.ankle;
    case "kneeL":
      return sk.legL.knee;
    case "kneeR":
      return sk.legR.knee;
    case "toeL":
      return sk.legL.toe;
    case "toeR":
      return sk.legR.toe;
    case "head":
      return sk.headTop;
    case "look":
      return sk.face;
    case "chest":
      return sk.chest;
    case "body":
      return sk.pelvis;
  }
}

/**
 * Move one handle to `point`. `start` is the pose when the drag began — the
 * elbow, knee and body drags aim at where things WERE, so a long drag never
 * drifts.
 */
export function dragHandle(
  start: Pose,
  frame: Frame,
  id: HandleId,
  point: Pt,
  opts: DragOptions = {},
): Pose {
  const sk = solve(start, frame);
  const k = sk.k;
  switch (id) {
    case "handL":
      return reachArm(start, frame, "L", point);
    case "handR":
      return reachArm(start, frame, "R", point);
    case "footL":
      return reachLeg(start, frame, "L", point);
    case "footR":
      return reachLeg(start, frame, "R", point);

    case "elbowL":
    case "elbowR": {
      const key = id === "elbowL" ? "armL" : "armR";
      const a = sk[key];
      const r1 = rotOfDown(sub(point, a.shoulder));
      const elbow = add(a.shoulder, down(r1), DIM.UPPER_ARM * k);
      const r2 = rotOfDown(sub(a.hand, elbow));
      return {
        ...start,
        [key]: {
          ...start[key],
          shoulder: round1(norm(a.s * (sk.rTorso - r1))),
          elbow: round1(norm(a.s * (r1 - r2))),
        },
      };
    }

    case "kneeL":
    case "kneeR": {
      const key = id === "kneeL" ? "legL" : "legR";
      const l = sk[key];
      const r1 = rotOfDown(sub(point, l.hip));
      const knee = add(l.hip, down(r1), DIM.THIGH * k);
      const r2 = rotOfDown(sub(l.ankle, knee));
      return {
        ...start,
        [key]: {
          ...start[key],
          hip: round1(norm(l.s * (sk.rBody - r1))),
          knee: round1(norm(l.s * (r1 - r2))),
        },
      };
    }

    case "toeL":
    case "toeR": {
      const key = id === "toeL" ? "legL" : "legR";
      const l = sk[key];
      // work in a frame where the toes point along +x, then compare the
      // dragged direction with where the toe tip rests when the foot is flat
      const v = spin(sub(point, l.ankle), -sk.rBody);
      if (l.toeSign < 0) v.x = -v.x;
      const rest = Math.atan2(DIM.FOOT_H * 0.28, DIM.FOOT_L * (footReach(sk.sinYaw) + 0.56));
      const foot = clamp((rest - Math.atan2(v.y, v.x)) / RAD, -80, 80);
      return { ...start, [key]: { ...start[key], foot: Math.round(foot) } };
    }

    case "head": {
      const r = rotOfUp(sub(point, sk.neck));
      return { ...start, head: Math.round(clamp(norm(r - sk.rTorso), -50, 50)) };
    }

    case "look": {
      const local = spin(sub(point, sk.headC), -sk.rHead);
      const sx = clamp(local.x / k / (DIM.HEAD_RX * FACE_SLIDE), -0.996, 0.996);
      const headYaw = Math.asin(sx) / RAD;
      const lookX = clamp((headYaw - start.yaw) / LOOK_YAW, -1, 1);
      const lookY = clamp((local.y / k - FACE_Y0) / (DIM.HEAD_RY * LOOK_PITCH), -1, 1);
      return { ...start, lookX: Math.round(lookX * 100) / 100, lookY: Math.round(lookY * 100) / 100 };
    }

    case "chest": {
      const r = rotOfUp(sub(point, sk.pelvis));
      return { ...start, torso: Math.round(clamp(norm(r - sk.rBody), -70, 70)) };
    }

    case "body": {
      let next: Pose = {
        ...start,
        x: clamp(point.x / frame.w, -0.25, 1.25),
        y: clamp(point.y / frame.h, -0.25, 1.25),
      };
      if (opts.plantFeet) {
        next = reachLeg(next, frame, "L", sk.legL.ankle);
        next = reachLeg(next, frame, "R", sk.legR.ankle);
      }
      return next;
    }
  }
}

// --------------------------------------------------------------- turns --

/** the things a rotate ring can turn */
export type TurnId = "handL" | "handR" | "footL" | "footR" | "body";

export const canTurn = (id: string): id is TurnId =>
  id === "handL" || id === "handR" || id === "footL" || id === "footR" || id === "body";

/** the point a rotate ring is centred on */
export function turnPivot(sk: Skeleton, id: TurnId): Pt {
  switch (id) {
    case "handL":
      return sk.armL.hand;
    case "handR":
      return sk.armR.hand;
    case "footL":
      return sk.legL.ankle;
    case "footR":
      return sk.legR.ankle;
    case "body":
      return sk.pelvis;
  }
}

/** the on-screen rotation of the part a ring turns (where its pointer should sit) */
export function turnAngle(sk: Skeleton, id: TurnId): number {
  switch (id) {
    case "handL":
      return sk.armL.rHand;
    case "handR":
      return sk.armR.rHand;
    case "footL":
      return sk.legL.rFoot;
    case "footR":
      return sk.legR.rFoot;
    case "body":
      return sk.rBody;
  }
}

/**
 * Turn a part by `delta` degrees clockwise on screen, starting from the pose
 * `start`: a wrist, a foot, or the whole body.
 */
export function turnNode(start: Pose, frame: Frame, id: TurnId, delta: number): Pose {
  if (id === "body") return { ...start, rot: Math.round(norm(start.rot + delta)) };
  if (id === "handL" || id === "handR") {
    const key = id === "handL" ? "armL" : "armR";
    const s = id === "handL" ? 1 : -1;
    const wrist = clamp(norm(start[key].wrist - s * delta), -WRIST_MAX, WRIST_MAX);
    return { ...start, [key]: { ...start[key], wrist: Math.round(wrist) } };
  }
  const key = id === "footL" ? "legL" : "legR";
  const toeSign = solve(start, frame)[key].toeSign;
  const foot = clamp(start[key].foot - toeSign * delta, -80, 80);
  return { ...start, [key]: { ...start[key], foot: Math.round(foot) } };
}

// ----------------------------------------------------- props and pets --

/** where the held item sits. "free" = not in a hand at all, placed relative to the body */
export interface ItemPlace {
  hand: "L" | "R" | "both" | "free";
  /** offset from its anchor in doll units, in the anchor's own frame */
  dx: number;
  dy: number;
  /** extra rotation on top of the anchor's */
  rot: number;
  /** 1 = default size */
  size: number;
}

export const ITEM_SIZE = 80;

/** an open, empty-looking hand closes around whatever it is given to hold */
export const heldShape = (shape: HandShape): HandShape => (shape === "relaxed" || shape === "open" ? "grip" : shape);

/** the pose with the holding hand(s) closed around the item: what the doll shows and the prompt describes */
export function holdingPose(pose: Pose, hand: ItemPlace["hand"] | null): Pose {
  if (!hand || hand === "free") return pose;
  const grip = (a: ArmPose): ArmPose => (heldShape(a.hand) === a.hand ? a : { ...a, hand: heldShape(a.hand) });
  return {
    ...pose,
    armL: hand === "L" || hand === "both" ? grip(pose.armL) : pose.armL,
    armR: hand === "R" || hand === "both" ? grip(pose.armR) : pose.armR,
  };
}

/** the anchor an item hangs off: a hand, the point between both hands, or the hips */
function itemAnchor(sk: Skeleton, hand: ItemPlace["hand"]): { base: Pt; rot: number } {
  if (hand === "L") return { base: sk.armL.hand, rot: sk.armL.rHand + 90 };
  if (hand === "R") return { base: sk.armR.hand, rot: sk.armR.rHand + 90 };
  if (hand === "both") {
    return { base: { x: (sk.armL.hand.x + sk.armR.hand.x) / 2, y: (sk.armL.hand.y + sk.armR.hand.y) / 2 }, rot: sk.rTorso };
  }
  return { base: sk.pelvis, rot: sk.rBody };
}

/** where an item is on the stage, and how it is turned */
export function itemSpot(sk: Skeleton, item: ItemPlace): { at: Pt; rot: number; size: number } {
  const { base, rot } = itemAnchor(sk, item.hand);
  return {
    at: add(base, spin({ x: item.dx, y: item.dy }, rot), sk.k),
    rot: rot + item.rot - (item.hand === "L" || item.hand === "R" ? 90 : 0),
    size: ITEM_SIZE * item.size * (item.hand === "both" ? 1.5 : 1) * sk.k,
  };
}

/** the offset that puts an item at a stage point (the reverse of itemSpot) */
export function itemOffset(sk: Skeleton, hand: ItemPlace["hand"], point: Pt): { dx: number; dy: number } {
  const { base, rot } = itemAnchor(sk, hand);
  const local = spin(sub(point, base), -rot);
  return { dx: Math.round(local.x / sk.k), dy: Math.round(local.y / sk.k) };
}

/**
 * A sensible starting offset. In one hand the box sits just beyond the palm,
 * so the fingers close over its near edge and most of it stays in view;
 * between two hands it sits dead centre; on its own it starts beside the hip.
 */
export const defaultItemOffset = (hand: ItemPlace["hand"]): { dx: number; dy: number } =>
  hand === "L" || hand === "R" ? { dx: 44, dy: 0 } : hand === "free" ? { dx: 200, dy: 60 } : { dx: 0, dy: 0 };

/** the named places a companion can sit */
export const PET_SPOTS = ["shoulderL", "shoulderR", "head", "arms", "ground"] as const;
export type PetSpot = (typeof PET_SPOTS)[number];
/** what a companion is attached to: one of the named places, or "free" (anywhere, kept relative to the body) */
export type PetAnchor = PetSpot | "free";

/**
 * Where the companion is: what it is attached to, plus how far it sits from
 * that thing's usual spot (in doll units, in the thing's own frame, so the
 * offset turns with a tilted head or a leaning body).
 */
export interface PetPlace {
  spot: PetAnchor;
  dx: number;
  dy: number;
}

/**
 * How near a shoulder or the top of the head a dropped companion must land to
 * stay attached there: about two-thirds of its own width, so it only counts
 * when it really is at the shoulder.
 */
export const PET_REACH = 60;
/** how near the ground line it must land to count as standing on the ground */
export const PET_GROUND_REACH = 42;
/** a companion sitting on the ground has its middle this far above the ground line */
const PET_SIT = 52;

/** the usual spot for each named place, and which way the companion faces there */
export function petSpotPoint(sk: Skeleton, spot: PetSpot, yaw: number): { at: Pt; flip: 1 | -1 } {
  const farIsL = yaw > 0;
  const k = sk.k;
  if (spot === "shoulderL" || spot === "shoulderR") {
    const a = spot === "shoulderL" ? sk.armL : sk.armR;
    return {
      at: add(add(a.shoulder, up(sk.rTorso), 46 * k), right(sk.rTorso), a.s * (62 + 26 * (1 - sk.cosYaw)) * k),
      flip: a.s,
    };
  }
  if (spot === "head") return { at: add(sk.headC, up(sk.rHead), (DIM.HEAD_RY + 40) * k), flip: 1 };
  if (spot === "arms") return { at: { x: (sk.armL.hand.x + sk.armR.hand.x) / 2, y: (sk.armL.hand.y + sk.armR.hand.y) / 2 }, flip: 1 };
  return {
    at: { x: sk.ground.x + (sk.groundRx + 70 * k) * (farIsL ? -1 : 1), y: sk.ground.y - PET_SIT * k },
    flip: farIsL ? -1 : 1,
  };
}

/** what an offset is measured from, and the frame it is measured in */
function petFrame(sk: Skeleton, spot: PetAnchor, yaw: number): { base: Pt; rot: number; flip: 1 | -1 } {
  if (spot === "free") return { base: sk.pelvis, rot: sk.rBody, flip: 1 };
  const usual = petSpotPoint(sk, spot, yaw);
  // on the head it turns with the head, on the ground it stays level, elsewhere it leans with the body
  return { base: usual.at, rot: spot === "head" ? sk.rHead : spot === "ground" ? 0 : sk.rTorso, flip: usual.flip };
}

/** where the companion is on the stage, and which way it faces */
export function petAt(sk: Skeleton, place: PetPlace, yaw: number): { at: Pt; flip: 1 | -1 } {
  const f = petFrame(sk, place.spot, yaw);
  const at = add(f.base, spin({ x: place.dx, y: place.dy }, f.rot), sk.k);
  // loose or on the ground, its tail goes on the side away from the character
  const flip = place.spot === "free" || place.spot === "ground" ? (at.x >= sk.pelvis.x ? 1 : -1) : f.flip;
  return { at, flip };
}

/** the offset that puts a companion attached to `spot` at a stage point (the reverse of petAt) */
export function petOffset(sk: Skeleton, spot: PetAnchor, point: Pt, yaw: number): { dx: number; dy: number } {
  const f = petFrame(sk, spot, yaw);
  const local = spin(sub(point, f.base), -f.rot);
  return { dx: Math.round(local.x / sk.k), dy: Math.round(local.y / sk.k) };
}

/**
 * Where a companion dropped at `point` belongs. It can go anywhere, and stays
 * exactly where it is dropped. Dropped by a shoulder, on top of the head or
 * on the ground it also becomes attached there, so it follows when the pose
 * changes; anywhere else it is free and moves only with the whole body.
 * (Being carried "in the arms" is chosen by name: hands are too often simply
 * hanging by the hips for that to be guessed.)
 */
export function petDrop(sk: Skeleton, point: Pt, yaw: number): PetPlace {
  const k = sk.k;
  let spot: PetAnchor = "free";
  let nearest = PET_REACH * k;
  for (const s of ["shoulderL", "shoulderR", "head"] as const) {
    const d = dist(petSpotPoint(sk, s, yaw).at, point);
    if (d < nearest) {
      nearest = d;
      spot = s;
    }
  }
  if (spot === "free" && Math.abs(point.y - (sk.ground.y - PET_SIT * k)) < PET_GROUND_REACH * k) spot = "ground";
  return { spot, ...petOffset(sk, spot, point, yaw) };
}

// -------------------------------------------------------------- poses --

export const STAND: Pose = {
  x: 0.5,
  y: 0.715,
  scale: 1,
  rot: 0,
  yaw: 0,
  lift: 0,
  torso: 0,
  head: 0,
  lookX: 0,
  lookY: 0,
  armL: { shoulder: 16, elbow: -14, wrist: 0, layer: "mid", hand: "relaxed", palm: "auto" },
  armR: { shoulder: 16, elbow: -14, wrist: 0, layer: "mid", hand: "relaxed", palm: "auto" },
  legL: { hip: 4, knee: 0, foot: 0, layer: "back", flip: false },
  legR: { hip: 4, knee: 0, foot: 0, layer: "back", flip: false },
};

/** swap left and right */
export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    x: 1 - p.x,
    rot: -p.rot,
    yaw: -p.yaw,
    torso: -p.torso,
    head: -p.head,
    lookX: -p.lookX,
    armL: { ...p.armR },
    armR: { ...p.armL },
    legL: { ...p.legR },
    legR: { ...p.legL },
  };
}

/** blend two poses (used to ease between presets) */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const m = (x: number, y: number) => x + (y - x) * t;
  const ang = (x: number, y: number) => x + norm(y - x) * t;
  const arm = (x: ArmPose, y: ArmPose): ArmPose => ({
    shoulder: ang(x.shoulder, y.shoulder),
    elbow: ang(x.elbow, y.elbow),
    wrist: m(x.wrist, y.wrist),
    layer: t < 0.5 ? x.layer : y.layer,
    hand: t < 0.5 ? x.hand : y.hand,
    palm: t < 0.5 ? x.palm : y.palm,
  });
  const leg = (x: LegPose, y: LegPose): LegPose => ({
    hip: ang(x.hip, y.hip),
    knee: ang(x.knee, y.knee),
    foot: m(x.foot, y.foot),
    layer: t < 0.5 ? x.layer : y.layer,
    flip: t < 0.5 ? x.flip : y.flip,
  });
  return {
    x: m(a.x, b.x),
    y: m(a.y, b.y),
    scale: m(a.scale, b.scale),
    rot: ang(a.rot, b.rot),
    yaw: m(a.yaw, b.yaw),
    lift: m(a.lift, b.lift),
    torso: ang(a.torso, b.torso),
    head: ang(a.head, b.head),
    lookX: m(a.lookX, b.lookX),
    lookY: m(a.lookY, b.lookY),
    armL: arm(a.armL, b.armL),
    armR: arm(a.armR, b.armR),
    legL: leg(a.legL, b.legL),
    legR: leg(a.legR, b.legR),
  };
}

/**
 * Sensible layering after the body turns: once the doll is clearly turned,
 * the far arm goes behind the body and the near arm comes in front.
 */
export function layersForYaw(p: Pose): Pose {
  if (Math.abs(p.yaw) < 25) {
    const fix = (a: ArmPose): ArmPose => (a.layer === "back" ? { ...a, layer: "mid" } : a);
    return { ...p, armL: fix(p.armL), armR: fix(p.armR) };
  }
  const farIsL = p.yaw > 0;
  return {
    ...p,
    armL: { ...p.armL, layer: farIsL ? "back" : "front" },
    armR: { ...p.armR, layer: farIsL ? "front" : "back" },
  };
}

/** is this pose (apart from placement and size) the same as that one? */
export function samePose(a: Pose, b: Pose): boolean {
  const strip = (p: Pose) => JSON.stringify({ ...p, x: 0, y: 0, scale: 1 });
  return strip(a) === strip(b);
}

/** fill in anything missing from a saved / shared pose so old links keep working */
export function repairPose(raw: unknown): Pose {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;
  const arm = (v: unknown, d: ArmPose): ArmPose => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      shoulder: num(o.shoulder, d.shoulder, -360, 360),
      elbow: num(o.elbow, d.elbow, -360, 360),
      // poses saved before hands had a wrist simply have none
      wrist: num(o.wrist, 0, -WRIST_MAX, WRIST_MAX),
      layer: o.layer === "back" || o.layer === "mid" || o.layer === "front" ? o.layer : d.layer,
      hand: HAND_SHAPES.includes(o.hand as HandShape) ? (o.hand as HandShape) : d.hand,
      palm: o.palm === "front" || o.palm === "back" ? o.palm : "auto",
    };
  };
  const leg = (v: unknown, d: LegPose): LegPose => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      hip: num(o.hip, d.hip, -360, 360),
      knee: num(o.knee, d.knee, -360, 360),
      foot: num(o.foot, d.foot, -80, 80),
      layer: o.layer === "front" || o.layer === "back" ? o.layer : d.layer,
      // poses saved before feet could be flipped simply are not
      flip: o.flip === true,
    };
  };
  return {
    x: num(src.x, STAND.x, -0.25, 1.25),
    y: num(src.y, STAND.y, -0.25, 1.25),
    scale: num(src.scale, 1, 0.3, 1.8),
    rot: num(src.rot, 0, -180, 180),
    yaw: num(src.yaw, 0, -80, 80),
    lift: num(src.lift, 0, 0, 400),
    torso: num(src.torso, 0, -70, 70),
    head: num(src.head, 0, -50, 50),
    lookX: num(src.lookX, 0, -1, 1),
    lookY: num(src.lookY, 0, -1, 1),
    armL: arm(src.armL, STAND.armL),
    armR: arm(src.armR, STAND.armR),
    legL: leg(src.legL, STAND.legL),
    legR: leg(src.legR, STAND.legR),
  };
}

// -------------------------------------------------------------- bounds --

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** rough bounding box of the whole doll, shadow included */
export function boundsOf(sk: Skeleton): Bounds {
  const k = sk.k;
  const pts: Pt[] = [sk.armL.elbow, sk.armR.elbow, sk.legL.foot, sk.legR.foot, sk.legL.knee, sk.legR.knee, sk.pelvis];
  // outstretched fingers reach further from the middle of the palm than a limb is thick
  const hands: Pt[] = [sk.armL.hand, sk.armR.hand];
  // the head, tilted: take the extremes of its top, bottom and sides
  const upH = up(sk.rHead);
  const rightH = right(sk.rHead);
  const headPts = [
    add(sk.headC, upH, (DIM.HEAD_RY + 62) * k),
    add(sk.headC, upH, -DIM.HEAD_RY * k),
    add(sk.headC, rightH, (DIM.HEAD_RX + 24) * k),
    add(sk.headC, rightH, -(DIM.HEAD_RX + 24) * k),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of headPts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  // the head is round, so its box is at least a radius each way from the centre
  minX = Math.min(minX, sk.headC.x - DIM.HEAD_RY * k);
  maxX = Math.max(maxX, sk.headC.x + DIM.HEAD_RY * k);
  minY = Math.min(minY, sk.headC.y - DIM.HEAD_RY * k);
  maxY = Math.max(maxY, sk.headC.y + DIM.HEAD_RY * k);
  const around = (p: Pt, r: number) => {
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minY = Math.min(minY, p.y - r);
    maxY = Math.max(maxY, p.y + r);
  };
  for (const p of pts) around(p, 64 * k);
  for (const p of hands) around(p, 78 * k);
  maxY = Math.max(maxY, sk.ground.y + 24 * k);
  return { minX, minY, maxX, maxY };
}

/**
 * Make sure the doll sits inside a frame: shrink it if it is too big for the
 * frame, then nudge it back in if it hangs over an edge. Used when the frame
 * changes shape (square → tall), so the doll is never stranded off-stage.
 */
export function fitPose(pose: Pose, frame: Frame): Pose {
  let next = pose;
  let b = boundsOf(solve(next, frame));
  const shrink = Math.min(1, (frame.w * 0.9) / (b.maxX - b.minX), (frame.h * 0.94) / (b.maxY - b.minY));
  if (shrink < 0.999) {
    next = { ...next, scale: Math.max(0.3, Math.round(next.scale * shrink * 100) / 100) };
    b = boundsOf(solve(next, frame));
  }
  const pad = frame.h * 0.02;
  let dx = 0;
  let dy = 0;
  if (b.minX < pad) dx = pad - b.minX;
  else if (b.maxX > frame.w - pad) dx = frame.w - pad - b.maxX;
  if (b.minY < pad) dy = pad - b.minY;
  else if (b.maxY > frame.h - pad) dy = frame.h - pad - b.maxY;
  if (dx || dy) next = { ...next, x: next.x + dx / frame.w, y: next.y + dy / frame.h };
  return next;
}

// --------------------------------------------------------- description --

export const HAND_WORDS: Record<HandShape, string> = {
  relaxed: "",
  flat: "open flat hand with the fingers together",
  open: "open hand with the fingers spread wide",
  fist: "closed fist",
  point: "pointing with one finger",
  thumb: "giving a thumbs-up",
  thumbDown: "giving a thumbs-down",
  peace: "making a peace sign",
  rock: "making a rock-on sign (index and little finger up)",
  grip: "gripping",
  palmUp: "hand held out flat with the palm up",
};

const PALM_WORDS: Record<PalmSide, string> = {
  auto: "",
  front: "palm facing the viewer",
  back: "back of the hand facing the viewer",
};

/**
 * The pose in plain English, for the prompt. The picture of the doll does
 * the heavy lifting; this is the belt to its braces, and it is what keeps
 * left and right straight. Sides are always the CHARACTER's, with the
 * viewer's side in brackets, because image models mix the two up. Once the
 * body is turned side-on, "viewer's left/right" stops making sense for
 * limbs, so the words switch to near/far and forward/back.
 */
export function describePose(pose: Pose, frame: Frame = frameFor(1)): string[] {
  const sk = solve(pose, frame);
  const k = sk.k;
  const lines: string[] = [];
  const DEG = 180 / Math.PI;
  const turned = Math.abs(pose.yaw) >= 35;
  /** +1 when the character faces screen-right */
  const facing = pose.yaw >= 0 ? 1 : -1;
  const facingWord = facing > 0 ? "viewer's right" : "viewer's left";
  const sideWord = (s: 1 | -1) => (s === 1 ? "viewer's right" : "viewer's left");
  /** how a limb is labelled: by screen side when facing us, by near/far when side-on */
  const tag = (s: 1 | -1) => {
    if (!turned) return sideWord(s);
    // facing screen-right shows the character's right flank: the right limbs are the near ones
    const near = facing > 0 ? s === -1 : s === 1;
    return near ? "the near one, closest to the viewer" : "the far one, partly behind the body";
  };
  const upT = up(sk.rTorso);
  const rightT = right(sk.rTorso);
  const upB = up(sk.rBody);
  const rightB = right(sk.rBody);

  // ---- facing --------------------------------------------------------
  const ay = Math.abs(pose.yaw);
  if (ay < 12) lines.push("Body faces the viewer straight on.");
  else if (ay < 35) lines.push(`Body turned slightly toward the ${facingWord}, still mostly facing the viewer.`);
  else if (ay < 62) lines.push(`Body turned three-quarters toward the ${facingWord}.`);
  else lines.push(`Side view: body in profile, facing the ${facingWord}.`);

  // ---- whole body ----------------------------------------------------
  if (Math.abs(pose.rot) > 150) lines.push("The whole body is upside down.");
  else if (Math.abs(pose.rot) > 60)
    lines.push(`The whole body is tipped right over, head toward the ${pose.rot > 0 ? "viewer's right" : "viewer's left"} (lying down or tumbling).`);
  else if (Math.abs(pose.rot) > 8)
    lines.push(`The whole body tilts toward the ${pose.rot > 0 ? "viewer's right" : "viewer's left"}.`);
  if (Math.abs(pose.torso) > 8) {
    if (turned) lines.push(pose.torso * facing > 0 ? "Upper body leaning forward." : "Upper body leaning back.");
    else lines.push(`Upper body leaning toward the ${pose.torso > 0 ? "viewer's right" : "viewer's left"}.`);
  }

  // ---- head ----------------------------------------------------------
  const headBits: string[] = [];
  if (Math.abs(pose.head) > 7) headBits.push(`tilted toward the ${pose.head > 0 ? "viewer's right" : "viewer's left"}`);
  const hy = sk.headYaw;
  if (Math.abs(hy) > 55) headBits.push(`in profile, facing the ${hy > 0 ? "viewer's right" : "viewer's left"}`);
  else if (Math.abs(hy) > 14) headBits.push(`turned toward the ${hy > 0 ? "viewer's right" : "viewer's left"}`);
  else headBits.push(turned ? "turned to look at the viewer" : "facing the viewer");
  if (pose.lookY < -0.35) headBits.push("looking up");
  else if (pose.lookY > 0.35) headBits.push("looking down");
  lines.push(`Head ${headBits.join(", ")}.`);

  // ---- arms ----------------------------------------------------------
  const chin = add(sk.headC, up(sk.rHead), -DIM.HEAD_RY * k);
  const armLine = (side: Side) => {
    const a = side === "L" ? sk.armL : sk.armR;
    const ap = side === "L" ? pose.armL : pose.armR;
    const hand = sub(a.hand, a.shoulder);
    const elbow = sub(a.elbow, a.shoulder);
    const hUp = dot(hand, upT) / k;
    const eUp = dot(elbow, upT) / k;
    const bend = Math.abs(norm(ap.elbow));
    const bent = bend > 58;
    const atChin = ap.layer === "front" && dist(a.hand, chin) / k < 62;
    const atFace = ap.layer === "front" && dist(a.hand, sk.face) / k < 96;
    let where: string;

    if (!turned) {
      const hOut = (a.s * dot(hand, rightT)) / k;
      const eOut = (a.s * dot(elbow, rightT)) / k;
      const ang = Math.atan2(hUp, hOut) * DEG; // 0 straight out · 90 straight up · −90 straight down
      if (atChin) where = "bent up with the hand under the chin";
      else if (atFace) where = "bent up with the hand at the face";
      else if (bent && eOut > 24 && hUp < -60 && hOut < eOut && hOut > -62) where = "bent with the hand on the hip, elbow pointing out";
      else if (hOut < -44) where = bent ? "folded across the front of the body" : "reaching across the front of the body";
      else if (bent && hUp > 40) where = "raised with the elbow bent, hand up beside the head";
      else if (bent && hUp > eUp + 18) where = "bent at the elbow with the forearm raised, hand at shoulder height";
      else if (ang > 62) where = "raised straight up";
      else if (ang > 26) where = "raised up and out to the side";
      else if (ang > -26) where = "stretched straight out to the side";
      else if (ang > -60) where = "held away from the body, angled down";
      else where = "relaxed down at the side";
      // only worth saying when the hand really disappears behind the torso
      if (ap.layer === "back" && Math.abs(hOut) < 62 && hUp < -20) where += ", hand hidden behind the back";
    } else {
      const hFwd = (facing * dot(hand, rightT)) / k;
      const eFwd = (facing * dot(elbow, rightT)) / k;
      const ang = Math.atan2(hUp, hFwd) * DEG; // 0 straight ahead · 90 up · ±180 straight back
      if (atChin) where = "bent up with the hand under the chin";
      else if (atFace) where = "bent up with the hand at the face";
      else if (bent && eFwd < -24) where = "swung back with the elbow bent";
      else if (bent && hUp > 30) where = "raised in front with the elbow bent, hand at head height";
      else if (bent && hFwd > 40) where = "held out in front with the elbow bent, hand at chest height";
      else if (bent) where = "bent with the hand close to the body";
      else if (ang > 62 && ang < 118) where = "raised straight up";
      else if (ang >= 0 && ang <= 62) where = hUp > 40 ? "raised up and forward" : "reaching straight forward";
      else if (ang < 0 && ang > -55) where = "held forward and down";
      else if (ang <= -55 && ang >= -125) where = "hanging down at the side";
      else where = hUp > 0 ? "raised up and back" : "swung back";
    }
    // the whole hand is always described, so the model draws a hand and not a stub
    let fingers = "";
    if (Math.abs(ap.wrist) >= 25) {
      const f = down(a.rHand);
      const vert = f.y < 0 ? "up" : "down";
      const horiz = `toward the ${f.x < 0 ? "viewer's left" : "viewer's right"}`;
      const way = Math.abs(f.y) > 2 * Math.abs(f.x) ? vert : Math.abs(f.x) > 2 * Math.abs(f.y) ? horiz : `${vert} and ${horiz}`;
      fingers = `wrist bent so the fingers point ${way}`;
    }
    const handWords = [HAND_WORDS[ap.hand] || "hand relaxed and open, all fingers showing", PALM_WORDS[ap.palm], fingers]
      .filter(Boolean)
      .join(", ");
    return `${side === "L" ? "Left" : "Right"} arm (${tag(a.s)}): ${where}; ${handWords}.`;
  };
  // right arm first: facing us it is on the viewer's left, so the text reads left to right
  lines.push(armLine("R"), armLine("L"));

  // ---- legs ----------------------------------------------------------
  const legInfo = (side: Side) => {
    const l = side === "L" ? sk.legL : sk.legR;
    const lp = side === "L" ? pose.legL : pose.legR;
    const foot = sub(l.ankle, l.hip);
    return {
      side,
      s: l.s,
      name: side === "L" ? "left" : "right",
      /** how far below the hip the ankle is: about 114 when standing straight */
      drop: -dot(foot, upB) / k,
      out: (l.s * dot(foot, rightB)) / k,
      fwd: (facing * dot(foot, rightB)) / k,
      bend: Math.abs(norm(lp.knee)),
      x: l.ankle.x,
    };
  };
  const R = legInfo("R");
  const L = legInfo("L");
  const kneeBend = (R.bend + L.bend) / 2;
  const pelvisDrop = (sk.ground.y - pose.lift * k - sk.pelvis.y) / k; // about 160 standing, 80 sitting

  if (Math.abs(pose.rot) > 60) {
    lines.push("Legs follow the tipped-over body, as the pose guide shows.");
  } else if (pose.lift > 30 && !turned) {
    lines.push(`Jumping in mid-air with both feet off the ground, ${kneeBend > 40 ? "knees tucked up" : "legs loose"}.`);
  } else if (!turned && pelvisDrop < 100 && R.drop < 75 && L.drop < 75) {
    lines.push("Sitting on the ground with both legs stuck out in front, soles toward the viewer.");
  } else if (!turned && pelvisDrop < 132 && kneeBend > 50) {
    lines.push("Crouching low with both knees bent.");
  } else if (!turned) {
    const gap = Math.abs(R.drop - L.drop);
    const stance = Math.abs(R.x - L.x) / k;
    if (gap > 30) {
      const up1 = R.drop < L.drop ? R : L;
      const down1 = up1 === R ? L : R;
      const how =
        up1.bend > 45
          ? `the ${up1.name} knee lifted`
          : up1.drop < 40
            ? `the ${up1.name} leg kicked up high`
            : `the ${up1.name} leg lifted out to the side`;
      lines.push(`Standing on the ${down1.name} leg (${tag(down1.s)}) with ${how}.`);
    } else if (stance > 190) lines.push("Standing with the feet planted wide apart.");
    else if (kneeBend > 40) lines.push("Standing with the knees slightly bent.");
    else lines.push("Standing upright on both feet.");
  } else {
    const one = (g: typeof R) => {
      const lifted = g.drop < 88;
      if (lifted && g.fwd < -40) return `${g.name} leg kicked up behind`;
      if (lifted && g.bend > 45 && g.fwd > 12) return `${g.name} knee lifted in front`;
      if (lifted && g.fwd > 40) return `${g.name} leg kicked forward`;
      if (g.fwd > 25) return `${g.name} leg stepping forward`;
      if (g.fwd < -25) return `${g.name} leg stretched back`;
      return `${g.name} leg straight under the body`;
    };
    const near = facing > 0 ? R : L;
    const far = near === R ? L : R;
    const air = pose.lift > 30 ? " Both feet are off the ground." : "";
    lines.push(`Legs seen from the side: ${one(near)} (near leg), ${one(far)} (far leg).${air}`);
  }

  // ---- feet ----------------------------------------------------------
  // only worth a line when a foot has been turned away from where it would naturally point
  for (const side of ["R", "L"] as const) {
    const l = side === "L" ? sk.legL : sk.legR;
    if (!(side === "L" ? pose.legL : pose.legR).flip) continue;
    const sense = ay > 20 ? "backward" : "inward";
    lines.push(
      `${side === "L" ? "Left" : "Right"} foot (${tag(l.s)}): turned the other way, toes pointing ${sense}, toward the ${l.toeSign > 0 ? "viewer's right" : "viewer's left"}.`,
    );
  }

  return lines;
}
