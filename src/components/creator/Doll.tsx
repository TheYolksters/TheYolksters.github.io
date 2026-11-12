import { useId, type ReactNode } from "react";

import {
  DIM,
  STAND,
  boundsOf,
  heldShape,
  itemSpot,
  petAt,
  solve,
  spin,
  type ArmPose,
  type ArmSk,
  type Frame,
  type HandShape,
  type LegPose,
  type LegSk,
  type PalmSide,
  type Pose,
  type Pt,
  type Skeleton,
} from "@/lib/creator/rig";
import {
  FEATHER,
  luma,
  shade,
  type BeakKind,
  type BrowKind,
  type DollLook,
  type EyeKind,
  type Face,
  type FaceExtra,
  type GazeKind,
  type TopLook,
} from "@/lib/creator/look";

/**
 * The posable chick doll, drawn as plain SVG.
 *
 * Two looks from one skeleton:
 *  - "dressed"   the friendly on-screen doll wearing the chosen colours
 *  - "mannequin" a neutral grey figure — this is what gets sent to the AI
 *                as the pose guide, so it carries pose and nothing else
 *
 * Everything uses SVG presentation attributes (no CSS classes) on purpose:
 * the same markup is serialised to a PNG for export, where page CSS
 * wouldn't apply.
 */

export type DollMode = "dressed" | "mannequin";

interface DollProps {
  pose: Pose;
  sk: Skeleton;
  look: DollLook;
  mode?: DollMode;
  /** mannequin only: tint the character's right limbs blue and left limbs orange */
  tint?: boolean;
  shadow?: boolean;
}

const OUT = 6; // outline width in doll units
// line, beak and blush colours are the ones measured from the character art
const INK = "#532113";
const BEAK = "#f9a034";
const BLUSH = "#fe9574";
const MOUTH = "#b93a1e";
const M_INK = "#27304f";
const M_BODY = "#e3e7f0";
const M_RIGHT = "#a9ccf8";
const M_LEFT = "#f8c592";

const r1 = (n: number) => Math.round(n * 10) / 10;
/** scale factors need finer rounding than positions do */
const sc = (n: number) => Math.round(n * 1000) / 1000;
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const unit = (v: Pt): Pt => {
  const d = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / d, y: v.y / d };
};
const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");

interface Palette {
  ink: string;
  body: string;
  mannequin: boolean;
}

/** a thick rounded line with an outline: the building block for limbs and fingers */
function Tube({ pts, w, color, ink, ow }: { pts: Pt[]; w: number; color: string; ink: string; ow: number }) {
  const d = pathOf(pts);
  return (
    <>
      <path d={d} fill="none" stroke={ink} strokeWidth={r1(w + ow * 2)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={r1(w)} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Joint({ p, k, ink }: { p: Pt; k: number; ink: string }) {
  return <circle cx={r1(p.x)} cy={r1(p.y)} r={r1(9 * k)} fill="#ffffff" stroke={ink} strokeWidth={r1(3.5 * k)} />;
}

// ---------------------------------------------------------------- hands --

/** hands are drawn a touch oversized, the way the character art draws them */
const HAND_SCALE = 1.18;

/** one finger: from (x0, y0) to (x1, y1), w wide */
type Seg = [x0: number, y0: number, x1: number, y1: number, w: number];

interface HandDraw {
  /** fingers, thumb side first. Drawn under the palm, so their roots are hidden */
  fingers: Seg[];
  /** the thumb when it sticks out at the side (under the palm) */
  thumb?: Seg;
  /** the thumb when it folds across the curled fingers (over the palm) */
  thumbOver?: Seg;
  /** palm size */
  rx: number;
  ry: number;
  /** creases between curled fingers: x positions */
  knuckles?: number[];
  /** an open hand, which shows a palm pad when the palm faces the viewer */
  open?: boolean;
}

/**
 * Every hand shape, in the hand's own space: the middle of the palm is
 * (0, 0), the fingers point along +y and the thumb sits on the −x side.
 * Three fingers and a thumb, like the chicks' wing-hands in the art.
 */
const F = 15;
const HAND_DRAW: Record<HandShape, HandDraw> = {
  relaxed: {
    open: true,
    rx: 27,
    ry: 25,
    fingers: [
      [-16, 8, -19, 37, F],
      [0, 10, 0, 42, F],
      [16, 8, 18, 35, F],
    ],
    thumb: [-18, -2, -35, 13, 14],
  },
  flat: {
    open: true,
    rx: 27,
    ry: 25,
    fingers: [
      [-16, 8, -16, 44, F],
      [0, 10, 0, 48, F],
      [16, 8, 16, 42, F],
    ],
    thumb: [-20, -2, -30, 17, 14],
  },
  open: {
    open: true,
    rx: 27,
    ry: 25,
    fingers: [
      [-14, 8, -31, 36, F],
      [0, 10, 0, 47, F],
      [14, 8, 31, 36, F],
    ],
    thumb: [-18, -4, -44, 1, 14],
  },
  palmUp: {
    open: true,
    rx: 27,
    ry: 25,
    fingers: [
      [-16, 8, -17, 43, F],
      [0, 10, 0, 47, F],
      [16, 8, 17, 41, F],
    ],
    thumb: [-18, -3, -41, 8, 14],
  },
  grip: {
    rx: 28,
    ry: 26,
    fingers: [
      [-16, 8, -15, 26, F],
      [0, 10, 0, 28, F],
      [16, 8, 15, 25, F],
    ],
    thumb: [-19, -1, -34, 14, 14],
  },
  fist: { rx: 29, ry: 28, fingers: [], thumbOver: [-23, 3, -8, 19, 14], knuckles: [4, 17] },
  point: { rx: 29, ry: 28, fingers: [[-14, 8, -15, 54, F]], thumb: [-19, 2, -29, 11, 14], knuckles: [3, 16] },
  thumb: { rx: 29, ry: 28, fingers: [], thumb: [-14, 0, -52, -3, 17], knuckles: [-9, 4, 17] },
  thumbDown: { rx: 29, ry: 28, fingers: [], thumb: [-14, 0, -52, -3, 17], knuckles: [-9, 4, 17] },
  peace: {
    rx: 29,
    ry: 28,
    fingers: [
      [-13, 8, -25, 51, 14],
      [3, 9, 14, 53, 14],
    ],
    thumbOver: [-22, 6, -5, 21, 13],
    knuckles: [18],
  },
  rock: {
    rx: 29,
    ry: 28,
    fingers: [
      [-15, 8, -20, 49, 14],
      [16, 8, 21, 45, 14],
    ],
    thumbOver: [-21, 7, -1, 20, 13],
    knuckles: [1],
  },
};

/**
 * Which side the thumb is on: +1 when it is a quarter-turn clockwise from the
 * fingers, −1 when anticlockwise. Left to itself the thumb goes toward the
 * body (or up, when the arm is level), which is where a real thumb ends up.
 * Asking for the palm or the back of the hand fixes the side instead.
 */
function thumbSide(rot: number, s: 1 | -1, shape: HandShape, palm: PalmSide): 1 | -1 {
  if (palm === "front") return s === 1 ? -1 : 1;
  if (palm === "back") return s;
  const dir = spin({ x: 0, y: 1 }, rot);
  const t = spin(dir, 90);
  // a thumbs-up should simply point up the screen, a thumbs-down down it
  if ((shape === "thumb" || shape === "thumbDown") && Math.abs(t.y) > 0.05) return t.y < 0 === (shape === "thumb") ? 1 : -1;
  return t.x * -s + t.y * -0.6 >= 0 ? 1 : -1;
}

function Hand({
  c,
  rot,
  s,
  k,
  shape,
  palm,
  color,
  ink,
}: {
  /** the middle of the palm */
  c: Pt;
  /** which way the fingers point (a limb rotation: 0 = straight down) */
  rot: number;
  s: 1 | -1;
  k: number;
  shape: HandShape;
  palm: PalmSide;
  color: string;
  ink: string;
}) {
  const hd = HAND_DRAW[shape];
  const side = thumbSide(rot, s, shape, palm);
  // on a left hand the thumb is anticlockwise of the fingers when you look at the palm
  const palmShows = side !== s;
  const ow = OUT / HAND_SCALE;
  const seg = ([x0, y0, x1, y1, w]: Seg, key: string) => (
    <g key={key}>
      <path d={`M${x0} ${y0}L${x1} ${y1}`} fill="none" stroke={ink} strokeWidth={r1(w + ow * 2)} strokeLinecap="round" />
      <path d={`M${x0} ${y0}L${x1} ${y1}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
  return (
    <g transform={`translate(${r1(c.x)} ${r1(c.y)}) rotate(${r1(rot)}) scale(${sc(k * HAND_SCALE * side)} ${sc(k * HAND_SCALE)})`}>
      {hd.thumb && seg(hd.thumb, "t")}
      {hd.fingers.map((f, i) => seg(f, `f${i}`))}
      <ellipse cx={0} cy={hd.open ? 1 : 2} rx={hd.rx} ry={hd.ry} fill={color} stroke={ink} strokeWidth={r1(ow)} />
      {hd.open && palmShows && <ellipse cx={1} cy={2} rx={13} ry={11} fill={shade(color, -0.11)} />}
      {hd.knuckles?.map((x) => (
        <path key={x} d={`M${x} 12L${x} 26`} stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      ))}
      {hd.thumbOver && seg(hd.thumbOver, "o")}
    </g>
  );
}

/** placeholder for "the thing being held" — the prompt says what it really is */
function ItemToken({ c, rot, size, pal }: { c: Pt; rot: number; size: number; pal: Palette }) {
  const h = size / 2;
  return (
    <g transform={`translate(${r1(c.x)} ${r1(c.y)}) rotate(${r1(rot)})`}>
      <rect
        x={r1(-h)}
        y={r1(-h)}
        width={r1(size)}
        height={r1(size)}
        rx={r1(size * 0.2)}
        fill={pal.mannequin ? "#ffffff" : "#fff6d6"}
        stroke={pal.ink}
        strokeWidth={r1(size * 0.085)}
        strokeDasharray={pal.mannequin ? undefined : `${r1(size * 0.16)} ${r1(size * 0.13)}`}
        strokeLinecap="round"
      />
      {pal.mannequin ? (
        <path
          d={`M${r1(-h * 0.55)} ${r1(-h * 0.55)}L${r1(h * 0.55)} ${r1(h * 0.55)}M${r1(h * 0.55)} ${r1(-h * 0.55)}L${r1(-h * 0.55)} ${r1(h * 0.55)}`}
          stroke={pal.ink}
          strokeWidth={r1(size * 0.07)}
          strokeLinecap="round"
        />
      ) : (
        // a little parcel: "something goes here"
        <g stroke={pal.ink} strokeWidth={r1(size * 0.055)} strokeLinejoin="round" strokeLinecap="round">
          <path
            d={`M0 ${r1(-h * 0.6)}L${r1(h * 0.52)} ${r1(-h * 0.3)}L${r1(h * 0.52)} ${r1(h * 0.3)}L0 ${r1(h * 0.6)}L${r1(-h * 0.52)} ${r1(h * 0.3)}L${r1(-h * 0.52)} ${r1(-h * 0.3)}Z`}
            fill="#f6b948"
          />
          <path d={`M${r1(-h * 0.52)} ${r1(-h * 0.3)}L0 0L${r1(h * 0.52)} ${r1(-h * 0.3)}M0 0L0 ${r1(h * 0.6)}`} fill="none" />
        </g>
      )}
    </g>
  );
}

// ----------------------------------------------------------------- arms --

function Arm({
  a,
  ap,
  k,
  top,
  pal,
  tintColor,
  grips,
  item,
}: {
  a: ArmSk;
  ap: ArmPose;
  k: number;
  top: TopLook | null;
  pal: Palette;
  tintColor: string;
  /** this hand is holding the item: an open hand closes around it */
  grips: boolean;
  /** the item placeholder, when it belongs to this hand (drawn behind the fingers) */
  item: ReactNode;
}) {
  const ow = OUT * k;
  const w = DIM.ARM_W * k;
  const dir = unit(sub(a.hand, a.elbow));
  const sleeves = pal.mannequin ? "none" : (top?.sleeves ?? "none");
  const sleeveColor = top ? (top.accentSleeves ? top.accent : top.color) : pal.body;
  const bare = pal.mannequin ? tintColor : pal.body;
  const handColor = pal.mannequin ? tintColor : pal.body;
  const cuffAt = add(a.wrist, dir, -13 * k);
  const perp = spin(dir, 90);
  return (
    <g>
      {item}
      <Hand
        c={a.hand}
        rot={a.rHand}
        s={a.s}
        k={k}
        shape={grips ? heldShape(ap.hand) : ap.hand}
        palm={ap.palm}
        color={handColor}
        ink={pal.ink}
      />
      {sleeves === "long" ? (
        <>
          <Tube pts={[a.shoulder, a.elbow, a.wrist]} w={w} color={sleeveColor} ink={pal.ink} ow={ow} />
          {top?.ribbed && (
            <path
              d={pathOf([add(cuffAt, perp, w * 0.5), add(cuffAt, perp, -w * 0.5)])}
              stroke={pal.ink}
              strokeWidth={r1(3.2 * k)}
              opacity={0.6}
            />
          )}
        </>
      ) : (
        <>
          <Tube pts={[a.shoulder, a.elbow, a.wrist]} w={w * (pal.mannequin ? 1 : 0.86)} color={bare} ink={pal.ink} ow={ow} />
          {sleeves === "short" && (
            <Tube pts={[a.shoulder, mix(a.shoulder, a.elbow, 0.62)]} w={w} color={sleeveColor} ink={pal.ink} ow={ow} />
          )}
        </>
      )}
      {pal.mannequin && (
        <>
          <Joint p={a.shoulder} k={k} ink={pal.ink} />
          <Joint p={a.elbow} k={k} ink={pal.ink} />
          <Joint p={a.wrist} k={k} ink={pal.ink} />
        </>
      )}
    </g>
  );
}

// ----------------------------------------------------------------- legs --

function Shoe({ l, k, look, pal, tintColor }: { l: LegSk; k: number; look: DollLook; pal: Palette; tintColor: string }) {
  const L = DIM.FOOT_L;
  const H = DIM.FOOT_H;
  const upper = `M${-L * 0.46} ${H * 0.5}C${-L * 0.57} ${H * 0.1} ${-L * 0.44} ${-H * 0.5} ${-L * 0.08} ${-H * 0.5}C${L * 0.3} ${-H * 0.5} ${L * 0.52} ${-H * 0.14} ${L * 0.52} ${H * 0.24}Q${L * 0.52} ${H * 0.5} ${L * 0.36} ${H * 0.5}Z`;
  const tf = `translate(${r1(l.foot.x)} ${r1(l.foot.y)}) rotate(${r1(l.rFoot)}) scale(${sc(k * l.toeSign)} ${sc(k)})`;
  if (pal.mannequin) {
    return (
      <g transform={tf}>
        <path d={upper} fill={tintColor} stroke={pal.ink} strokeWidth={OUT} strokeLinejoin="round" />
      </g>
    );
  }
  const shoe = look.shoes;
  if (!shoe) {
    // bare chick foot: three orange toes
    const toe = (x: number, y: number, key: string) => (
      <ellipse key={key} cx={x} cy={y} rx={L * 0.2} ry={H * 0.27} fill={BEAK} stroke={pal.ink} strokeWidth={OUT} />
    );
    return <g transform={tf}>{[toe(-L * 0.22, H * 0.2, "a"), toe(L * 0.3, H * 0.2, "c"), toe(L * 0.04, H * 0.26, "b")]}</g>;
  }
  const soleColor = shoe.kind === "boot" ? shade(shoe.color, -0.45) : shoe.kind === "sandal" ? shoe.color : "#ffffff";
  const upperColor = shoe.kind === "sandal" ? pal.body : shoe.color;
  return (
    <g transform={tf}>
      <path d={upper} fill={upperColor} stroke={pal.ink} strokeWidth={OUT} strokeLinejoin="round" />
      {shoe.kind === "sandal" && (
        <path d={`M${-L * 0.2} ${-H * 0.46}Q${L * 0.08} ${-H * 0.05} ${L * 0.3} ${H * 0.2}`} stroke={shoe.color} strokeWidth={11} strokeLinecap="round" fill="none" />
      )}
      {(shoe.kind === "sneaker" || shoe.kind === "hightop") && (
        <path
          d={`M${-L * 0.02} ${-H * 0.3}L${L * 0.2} ${-H * 0.36}M${L * 0.1} ${-H * 0.1}L${L * 0.3} ${-H * 0.18}`}
          stroke={luma(shoe.color) > 0.6 ? shade(shoe.color, -0.35) : "#ffffff"}
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
      {shoe.kind !== "slipper" && (
        <rect
          x={-L * 0.5}
          y={H * 0.22}
          width={L * 1.03}
          height={H * 0.32}
          rx={H * 0.16}
          fill={soleColor}
          stroke={pal.ink}
          strokeWidth={OUT * 0.85}
        />
      )}
    </g>
  );
}

function Leg({ l, k, look, pal, tintColor }: { l: LegSk; k: number; look: DollLook; pal: Palette; tintColor: string }) {
  const ow = OUT * k;
  const w = DIM.LEG_W * k;
  const top = look.top;
  const bottom = look.bottom;
  let color = pal.body;
  let short = false;
  if (pal.mannequin) color = tintColor;
  else if (top?.onePiece) color = top.color;
  else if (bottom?.length === "long") color = bottom.color;
  else if (bottom?.length === "short") short = true;
  const shin = unit(sub(l.ankle, l.knee));
  const cuffed = !pal.mannequin && look.shoes && (look.shoes.kind === "boot" || look.shoes.kind === "hightop");
  return (
    <g>
      <Tube pts={[l.hip, l.knee, l.ankle]} w={short ? w * 0.82 : w} color={color} ink={pal.ink} ow={ow} />
      {short && bottom && <Tube pts={[l.hip, mix(l.hip, l.knee, 0.7)]} w={w} color={bottom.color} ink={pal.ink} ow={ow} />}
      {!pal.mannequin && bottom?.cargo && (
        <rect
          transform={`translate(${r1(l.knee.x)} ${r1(l.knee.y)}) rotate(${r1(l.rThigh)}) scale(${sc(k)})`}
          x={l.s * 8 - 15}
          y={-34}
          width={30}
          height={30}
          rx={5}
          fill={shade(bottom.color, -0.1)}
          stroke={pal.ink}
          strokeWidth={3.5}
        />
      )}
      {cuffed && look.shoes && (
        <Tube pts={[add(l.ankle, shin, -20 * k), add(l.ankle, shin, 2 * k)]} w={w * 0.96} color={look.shoes.color} ink={pal.ink} ow={ow} />
      )}
      <Shoe l={l} k={k} look={look} pal={pal} tintColor={tintColor} />
      {pal.mannequin && (
        <>
          <Joint p={l.hip} k={k} ink={pal.ink} />
          <Joint p={l.knee} k={k} ink={pal.ink} />
          <Joint p={l.ankle} k={k} ink={pal.ink} />
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- torso --

const T = DIM.TORSO;

function torsoPath(wf: number) {
  const W = 114 * wf;
  return `M${r1(-W * 0.95)} 10C${r1(-W * 1.13)} ${r1(-T * 0.42)} ${r1(-W * 0.99)} ${r1(-T * 0.86)} ${r1(-W * 0.5)} ${r1(-T * 0.98)}L${r1(W * 0.5)} ${r1(-T * 0.98)}C${r1(W * 0.99)} ${r1(-T * 0.86)} ${r1(W * 1.13)} ${r1(-T * 0.42)} ${r1(W * 0.95)} 10Q0 32 ${r1(-W * 0.95)} 10Z`;
}

function skirtPath(wf: number) {
  const W = 114 * wf;
  return `M${r1(-W * 0.92)} -16L${r1(W * 0.92)} -16Q${r1(W * 1.3)} 30 ${r1(W * 1.34)} 74Q0 104 ${r1(-W * 1.34)} 74Q${r1(-W * 1.3)} 30 ${r1(-W * 0.92)} -16Z`;
}

function Torso({ sk, look, pal, clipId }: { sk: Skeleton; look: DollLook; pal: Palette; clipId: string }) {
  const wf = 0.9 + 0.1 * sk.cosYaw;
  const W = 114 * wf;
  const top = pal.mannequin ? null : look.top;
  const fill = pal.mannequin ? M_BODY : (top?.color ?? pal.body);
  const d = torsoPath(wf);
  // details slide sideways a little when the body turns, to sell the turn
  const cx = sk.sinYaw * W * 0.42;
  const tf = `translate(${r1(sk.pelvis.x)} ${r1(sk.pelvis.y)}) rotate(${r1(sk.rTorso)}) scale(${sc(sk.k)})`;
  return (
    <g transform={tf}>
      <path d={d} fill={fill} stroke={pal.ink} strokeWidth={OUT} strokeLinejoin="round" />
      {pal.mannequin && (
        // centre line: shows which way the chest faces
        <path
          d={`M${r1(cx * 0.7)} ${r1(-T * 0.96)}Q${r1(cx * 1.5)} ${r1(-T * 0.45)} ${r1(cx * 0.8)} 16`}
          fill="none"
          stroke={pal.ink}
          strokeWidth={3.2}
          strokeDasharray="10 9"
          opacity={0.55}
        />
      )}
      {top && (
        <g clipPath={`url(#${clipId})`}>
          {top.open && (
            <>
              <path
                d={`M${r1(cx - 34)} ${-T}L${r1(cx + 34)} ${-T}L${r1(cx + 28)} 40L${r1(cx - 28)} 40Z`}
                fill={top.accent}
                stroke={pal.ink}
                strokeWidth={4.5}
                strokeLinejoin="round"
              />
              {top.tie && (
                <path
                  d={`M${r1(cx - 9)} ${r1(-T * 0.74)}L${r1(cx + 9)} ${r1(-T * 0.74)}L${r1(cx + 13)} ${r1(-T * 0.3)}L${r1(cx)} ${r1(-T * 0.2)}L${r1(cx - 13)} ${r1(-T * 0.3)}Z`}
                  fill="#c62828"
                  stroke={pal.ink}
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                />
              )}
            </>
          )}
          {top.collar === "vneck" && (
            <path
              d={`M${r1(cx - 46)} ${-T}L${r1(cx)} ${r1(-T * 0.6)}L${r1(cx + 46)} ${-T}Z`}
              fill={top.accent}
              stroke={pal.ink}
              strokeWidth={4.5}
              strokeLinejoin="round"
            />
          )}
          {top.ribbed && (
            <path d={`M${-W * 1.3} -6Q0 16 ${W * 1.3} -6`} fill="none" stroke={pal.ink} strokeWidth={3.4} opacity={0.6} />
          )}
          {top.pocket && (
            <path
              d={`M${r1(cx - 54)} -12Q${r1(cx - 60)} -70 ${r1(cx - 30)} -76L${r1(cx + 30)} -76Q${r1(cx + 60)} -70 ${r1(cx + 54)} -12Z`}
              fill={shade(top.color, -0.07)}
              stroke={pal.ink}
              strokeWidth={4.5}
              strokeLinejoin="round"
            />
          )}
          {top.pocket && (
            <path
              d={`M${r1(cx - 15)} ${r1(-T * 0.96)}L${r1(cx - 17)} ${r1(-T * 0.6)}M${r1(cx + 15)} ${r1(-T * 0.96)}L${r1(cx + 17)} ${r1(-T * 0.6)}`}
              stroke="#fff8ea"
              strokeWidth={6}
              strokeLinecap="round"
            />
          )}
          {top.pockets && (
            <>
              <rect x={r1(cx - 62)} y={r1(-T * 0.62)} width={42} height={38} rx={6} fill={shade(top.color, -0.12)} stroke={pal.ink} strokeWidth={4} />
              <rect x={r1(cx + 20)} y={r1(-T * 0.62)} width={42} height={38} rx={6} fill={shade(top.color, -0.12)} stroke={pal.ink} strokeWidth={4} />
              <path d={`M${r1(cx)} ${-T}L${r1(cx)} 30`} stroke={pal.ink} strokeWidth={3.4} opacity={0.6} />
            </>
          )}
          {top.panel && (
            <>
              <rect x={r1(cx - 36)} y={r1(-T * 0.66)} width={72} height={46} rx={9} fill={top.accent} stroke={pal.ink} strokeWidth={4} />
              <circle cx={r1(cx - 18)} cy={r1(-T * 0.66 + 23)} r={6.5} fill="#4cc9f0" />
              <circle cx={r1(cx)} cy={r1(-T * 0.66 + 23)} r={6.5} fill="#ffc53d" />
              <circle cx={r1(cx + 18)} cy={r1(-T * 0.66 + 23)} r={6.5} fill="#ef5350" />
            </>
          )}
        </g>
      )}
      {/* redraw the outline so clipped details never nibble into it */}
      {top && <path d={d} fill="none" stroke={pal.ink} strokeWidth={OUT} strokeLinejoin="round" />}
    </g>
  );
}

// ----------------------------------------------------------------- face --

interface EyeDraw {
  /** how far the upper lid comes down: 0 = wide open … 1 = shut */
  lid: number;
  /** how far the lower lid comes up (a squint) */
  lower: number;
  /** iris size: small reads as startled, large as starry-eyed */
  iris: number;
  /** drawn as a single curved line instead of an eyeball */
  arc?: "happy" | "closed";
  sparkle?: boolean;
  heart?: boolean;
}

const EYE_DRAW: Record<EyeKind, EyeDraw> = {
  open: { lid: 0, lower: 0, iris: 1 },
  wide: { lid: 0, lower: 0, iris: 0.76 },
  narrow: { lid: 0.27, lower: 0.13, iris: 1 },
  half: { lid: 0.42, lower: 0, iris: 1 },
  sleepy: { lid: 0.6, lower: 0, iris: 1 },
  happy: { lid: 0, lower: 0, iris: 1, arc: "happy" },
  closed: { lid: 0, lower: 0, iris: 1, arc: "closed" },
  sparkle: { lid: 0, lower: 0, iris: 1.07, sparkle: true },
  heart: { lid: 0, lower: 0, iris: 1, heart: true },
};

/**
 * [tilt, lift] for the character's right brow, then the left. Tilt: positive
 * drops the inner end (stern), negative lifts it (worried).
 */
const BROW_DRAW: Record<BrowKind, { r: [number, number]; l: [number, number] } | null> = {
  soft: { r: [-3, 0], l: [-3, 0] },
  raised: { r: [-8, 13], l: [-8, 13] },
  stern: { r: [22, -10], l: [22, -10] },
  worried: { r: [-19, 5], l: [-19, 5] },
  skeptical: { r: [-6, 15], l: [13, -7] },
  none: null,
};

const GAZE_OFF: Record<GazeKind, Pt> = {
  ahead: { x: 0, y: 0 },
  up: { x: 0, y: -8 },
  down: { x: 0, y: 7 },
  left: { x: -9, y: 0 },
  right: { x: 9, y: 0 },
};

const heartPath = (hx: number, hy: number) =>
  `M0 ${r1(0.84 * hy)}C${r1(-1.3 * hx)} ${r1(0.05 * hy)} ${r1(-0.86 * hx)} ${r1(-1.02 * hy)} 0 ${r1(-0.38 * hy)}C${r1(0.86 * hx)} ${r1(-1.02 * hy)} ${r1(1.3 * hx)} ${r1(0.05 * hy)} 0 ${r1(0.84 * hy)}Z`;

/** a four-point twinkle */
const starPath = (cx: number, cy: number, s: number) => {
  const q = s * 0.2;
  return `M${r1(cx)} ${r1(cy - s)}Q${r1(cx + q)} ${r1(cy - q)} ${r1(cx + s)} ${r1(cy)}Q${r1(cx + q)} ${r1(cy + q)} ${r1(cx)} ${r1(cy + s)}Q${r1(cx - q)} ${r1(cy + q)} ${r1(cx - s)} ${r1(cy)}Q${r1(cx - q)} ${r1(cy - q)} ${r1(cx)} ${r1(cy - s)}Z`;
};

const dropPath = "M0 -22C13 -5 16 5 0 16C-16 5 -13 -5 0 -22Z";

function Beak({ kind, flip }: { kind: BeakKind; flip: number }) {
  const upper = (
    <path d="M-28 0Q0 -24 28 0Q0 12 -28 0Z" fill={BEAK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
  );
  const closed = "M-27 0Q0 -24 27 0Q14 22 0 24Q-14 22 -27 0Z";
  switch (kind) {
    case "open":
      return (
        <>
          <path d="M-22 3Q0 46 22 3Z" fill={MOUTH} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M-9 22Q0 34 9 22Q0 16 -9 22Z" fill="#ff8a80" />
          {upper}
        </>
      );
    case "wide":
      return (
        <>
          <path d="M-25 3Q0 62 25 3Z" fill={MOUTH} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M-11 30Q0 46 11 30Q0 22 -11 30Z" fill="#ff8a80" />
          {upper}
        </>
      );
    case "tongue":
      return (
        <>
          <path d="M-22 3Q0 42 22 3Z" fill={MOUTH} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M-10 18Q-13 46 0 48Q13 46 10 18Z" fill="#ff8a80" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M0 27L0 39" stroke={INK} strokeWidth={2.6} strokeLinecap="round" opacity={0.45} />
          {upper}
        </>
      );
    case "o":
      return (
        <>
          <ellipse cx={0} cy={18} rx={11} ry={13} fill={MOUTH} stroke={INK} strokeWidth={5} />
          <path d="M-22 2Q0 -20 22 2Q0 10 -22 2Z" fill={BEAK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </>
      );
    case "frown":
      return (
        <>
          <path d={closed} fill={BEAK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M-15 12Q0 3 15 12" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    case "smirk":
      return (
        <>
          <path d={closed} fill={BEAK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d={`M${-12 * flip} 7Q${4 * flip} 15 ${18 * flip} 3`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <path d={closed} fill={BEAK} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M-16 5Q0 16 16 5" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      );
  }
}

/** one eye, drawn around (0, 0) */
function Eye({
  sx,
  kind,
  look,
  gaze,
  clipId,
  outer,
}: {
  /** horizontal squash for the far eye when the head turns */
  sx: number;
  kind: EyeKind;
  look: DollLook;
  gaze: Pt;
  clipId: string;
  /** +1 if this eye's outer corner is toward screen-right */
  outer: 1 | -1;
}) {
  const spec = EYE_DRAW[kind];
  const rx = 37 * sx;
  const ry = 44;
  const lashes = look.lashes && (
    <path
      d={`M${r1(outer * rx * 0.66)} ${-ry * 0.74}l${outer * 13} -12M${r1(outer * rx * 0.92)} ${-ry * 0.42}l${outer * 17} -7M${r1(outer * rx * 1.0)} ${-ry * 0.06}l${outer * 16} 0`}
      stroke={INK}
      strokeWidth={5}
      strokeLinecap="round"
      fill="none"
    />
  );
  if (spec.arc === "happy") {
    return (
      <>
        <path d={`M${r1(-rx * 0.92)} 10Q0 ${-ry * 0.82} ${r1(rx * 0.92)} 10`} fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        {lashes}
      </>
    );
  }
  if (spec.arc === "closed") {
    return (
      <>
        <path d={`M${r1(-rx * 0.9)} -3Q0 ${r1(ry * 0.56)} ${r1(rx * 0.9)} -3`} fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        {look.lashes && (
          <path
            d={`M${r1(outer * rx * 0.56)} ${r1(ry * 0.22)}l${outer * 11} 12M${r1(outer * rx * 0.88)} ${r1(ry * 0.04)}l${outer * 16} 7`}
            stroke={INK}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </>
    );
  }
  if (spec.heart) {
    return (
      <g transform="translate(0 3)">
        <path d={heartPath(rx * 0.98, ry * 0.86)} fill="#ff4d6d" stroke={INK} strokeWidth={5.5} strokeLinejoin="round" />
        <ellipse cx={r1(-rx * 0.42)} cy={-ry * 0.34} rx={r1(7 * sx)} ry={9} fill="#ffffff" opacity={0.85} transform={`rotate(-24 ${r1(-rx * 0.42)} ${-ry * 0.34})`} />
      </g>
    );
  }
  const iris = spec.iris;
  const lidY = -ry + spec.lid * 2 * ry;
  const lowY = ry - spec.lower * 2 * ry;
  const gx = gaze.x * sx;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r1(rx)} ry={ry} fill="#ffffff" stroke={INK} strokeWidth={5.5} />
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx={r1(gx)} cy={3 + gaze.y} rx={r1(28 * sx * iris)} ry={35 * iris} fill={look.eye} />
        <ellipse cx={r1(gx)} cy={5 + gaze.y} rx={r1(16 * sx * iris)} ry={21.5 * iris} fill="#2a1508" />
        {spec.sparkle ? (
          <>
            <path d={starPath(gx - 9 * sx, -12 + gaze.y, 14)} fill="#ffffff" />
            <circle cx={r1(gx + 10 * sx)} cy={15 + gaze.y} r={r1(7 * Math.max(0.6, sx))} fill="#ffffff" />
            <circle cx={r1(gx + 13 * sx)} cy={-10 + gaze.y} r={r1(3.4 * Math.max(0.6, sx))} fill="#ffffff" />
          </>
        ) : (
          <>
            <circle cx={r1(gx - 9 * sx)} cy={-13 + gaze.y} r={r1(9.5 * Math.max(0.6, sx))} fill="#ffffff" />
            <circle cx={r1(gx + 9 * sx)} cy={15 + gaze.y} r={r1(4.5 * Math.max(0.6, sx))} fill="#ffffff" opacity={0.9} />
          </>
        )}
        {spec.lid > 0 && (
          <>
            <rect x={r1(-rx - 6)} y={-ry - 6} width={r1(rx * 2 + 12)} height={r1(lidY + ry + 6)} fill={look.feather} />
            <path d={`M${r1(-rx - 6)} ${r1(lidY)}L${r1(rx + 6)} ${r1(lidY)}`} stroke={INK} strokeWidth={6} />
          </>
        )}
        {spec.lower > 0 && (
          <>
            <rect x={r1(-rx - 6)} y={r1(lowY)} width={r1(rx * 2 + 12)} height={r1(ry - lowY + 6)} fill={look.feather} />
            <path d={`M${r1(-rx - 6)} ${r1(lowY)}L${r1(rx + 6)} ${r1(lowY)}`} stroke={INK} strokeWidth={4.5} />
          </>
        )}
      </g>
      <ellipse cx={0} cy={0} rx={r1(rx)} ry={ry} fill="none" stroke={INK} strokeWidth={5.5} />
      {lashes}
    </>
  );
}

/**
 * The cartoon marks around a face: sweat drop, sparkles, anger mark and so
 * on. All drawn as shapes (no fonts), so they survive being exported.
 */
function FaceMarks({ extras, tearAt }: { extras: FaceExtra[]; tearAt: Pt }) {
  const RX = DIM.HEAD_RX;
  const RY = DIM.HEAD_RY;
  const has = (e: FaceExtra) => extras.includes(e);
  const BLUE = "#4a5fd0";
  const RED = "#e5484d";
  /** a stroked symbol with a pale halo so it shows on any colour */
  const symbol = (d: string, color: string, w: number, key: string) => (
    <g key={key} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#ffffff" strokeWidth={w + 7} />
      <path d={d} stroke={color} strokeWidth={w} />
    </g>
  );
  const z = (x: number, y: number, a: number) => `M${r1(x - a)} ${r1(y - a)}L${r1(x + a)} ${r1(y - a)}L${r1(x - a)} ${r1(y + a)}L${r1(x + a)} ${r1(y + a)}`;
  const note = (x: number, y: number, s: number, key: string) => (
    <g key={key} transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
      <path d="M3 13L3 -24Q19 -20 18 -5" fill="none" stroke={BLUE} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={-6} cy={14} rx={10.5} ry={8} fill={BLUE} transform="rotate(-22 -6 14)" />
    </g>
  );
  return (
    <g>
      {has("sweat") && (
        <g transform={`translate(${r1(RX * 0.74)} ${r1(-RY * 0.5)}) rotate(-14)`}>
          <path d={dropPath} fill="#8fd3ff" stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-5 0Q-6 7 -1 10" fill="none" stroke="#ffffff" strokeWidth={3.2} strokeLinecap="round" />
        </g>
      )}
      {has("tear") && (
        <g transform={`translate(${r1(tearAt.x)} ${r1(tearAt.y)}) scale(0.82)`}>
          <path d={dropPath} fill="#8fd3ff" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
      )}
      {has("anger") && (
        <g transform={`translate(${r1(-RX * 0.6)} ${r1(-RY * 0.7)})`}>
          {symbol("M-6 -21Q-6 -6 -21 -6M6 -21Q6 -6 21 -6M-6 21Q-6 6 -21 6M6 21Q6 6 21 6", RED, 7, "a")}
        </g>
      )}
      {has("sparkles") && (
        <g fill="#ffd94a" stroke={INK} strokeWidth={3.6} strokeLinejoin="round">
          <path d={starPath(-RX * 1.02, -RY * 0.74, 27)} />
          <path d={starPath(RX * 0.98, -RY * 0.9, 33)} />
          <path d={starPath(RX * 1.16, -RY * 0.3, 20)} />
        </g>
      )}
      {has("hearts") && (
        <g fill="#ff5c7a" stroke={INK} strokeWidth={3.8} strokeLinejoin="round">
          <path d={heartPath(21, 24)} transform={`translate(${r1(RX * 0.96)} ${r1(-RY * 1.02)}) rotate(14)`} />
          <path d={heartPath(14, 16)} transform={`translate(${r1(RX * 1.2)} ${r1(-RY * 0.62)}) rotate(-12)`} />
        </g>
      )}
      {has("zzz") && symbol(`${z(RX * 0.62, -RY * 1.14, 11)}${z(RX * 0.86, -RY * 1.36, 15)}${z(RX * 1.16, -RY * 1.62, 20)}`, BLUE, 7, "z")}
      {has("question") && (
        <g transform={`translate(${r1(-RX * 0.98)} ${r1(-RY * 1.12)})`}>
          {symbol("M-13 -18Q-13 -35 2 -35Q18 -35 18 -21Q18 -11 7 -5Q2 -2 2 7M2 23L2 23.5", BLUE, 9, "q")}
        </g>
      )}
      {has("exclaim") && (
        <g transform={`translate(${r1(-RX * 0.7)} ${r1(-RY * 1.16)})`}>{symbol("M0 -35L0 5M0 23L0 23.5", RED, 10, "e")}</g>
      )}
      {has("music") && [note(RX * 1.14, -RY * 0.16, 1, "n1"), note(RX * 1.34, -RY * 0.56, 0.72, "n2")]}
    </g>
  );
}

// ------------------------------------------------------------- headwear --

function Headwear({ look, fx, topColor }: { look: DollLook; fx: number; topColor: string | null }) {
  const hw = look.headwear;
  if (!hw) return null;
  const RX = DIM.HEAD_RX;
  const RY = DIM.HEAD_RY;
  const c = hw.color;
  const dark = shade(c, -0.18);
  const sw = OUT;
  switch (hw.kind) {
    case "cap": {
      const dir = fx >= 0 ? 1 : -1;
      return (
        <g>
          <path
            d={`M${-RX * 0.93} ${-RY * 0.4}Q${-RX * 0.98} ${-RY * 1.1} 0 ${-RY * 1.13}Q${RX * 0.98} ${-RY * 1.1} ${RX * 0.93} ${-RY * 0.4}Q0 ${-RY * 0.66} ${-RX * 0.93} ${-RY * 0.4}Z`}
            fill={c}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <path
            d={`M${r1(fx * 0.6 - RX * 0.72)} ${-RY * 0.46}Q${r1(fx * 0.9 + dir * 30)} ${-RY * 0.2} ${r1(fx * 0.6 + RX * 0.72)} ${-RY * 0.46}Q${r1(fx * 0.9)} ${-RY * 0.72} ${r1(fx * 0.6 - RX * 0.72)} ${-RY * 0.46}Z`}
            fill={dark}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <circle cx={0} cy={-RY * 1.12} r={10} fill={dark} stroke={INK} strokeWidth={4} />
        </g>
      );
    }
    case "beanie":
    case "generic":
      return (
        <g>
          <path
            d={`M${-RX * 0.95} ${-RY * 0.36}Q${-RX * 1.0} ${-RY * 1.2} 0 ${-RY * 1.22}Q${RX * 1.0} ${-RY * 1.2} ${RX * 0.95} ${-RY * 0.36}Z`}
            fill={c}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <path
            d={`M${-RX * 0.99} ${-RY * 0.3}Q0 ${-RY * 0.6} ${RX * 0.99} ${-RY * 0.3}L${RX * 0.97} ${-RY * 0.58}Q0 ${-RY * 0.9} ${-RX * 0.97} ${-RY * 0.58}Z`}
            fill={dark}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {hw.kind === "beanie" && <circle cx={0} cy={-RY * 1.26} r={24} fill={shade(c, 0.25)} stroke={INK} strokeWidth={sw} />}
        </g>
      );
    case "headset":
      return (
        <g>
          <path
            d={`M${-RX * 0.98} ${-RY * 0.1}Q${-RX * 1.02} ${-RY * 1.14} 0 ${-RY * 1.14}Q${RX * 1.02} ${-RY * 1.14} ${RX * 0.98} ${-RY * 0.1}`}
            fill="none"
            stroke={INK}
            strokeWidth={26}
            strokeLinecap="round"
          />
          <path
            d={`M${-RX * 0.98} ${-RY * 0.1}Q${-RX * 1.02} ${-RY * 1.14} 0 ${-RY * 1.14}Q${RX * 1.02} ${-RY * 1.14} ${RX * 0.98} ${-RY * 0.1}`}
            fill="none"
            stroke={c}
            strokeWidth={14}
            strokeLinecap="round"
          />
          <rect x={-RX - 24} y={-RY * 0.36} width={46} height={92} rx={20} fill={dark} stroke={INK} strokeWidth={sw} />
          <rect x={RX - 22} y={-RY * 0.36} width={46} height={92} rx={20} fill={dark} stroke={INK} strokeWidth={sw} />
          <path d={`M${-RX - 2} ${RY * 0.2}Q${-RX * 0.9} ${RY * 0.62} ${r1(fx - 62)} ${RY * 0.56}`} fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <circle cx={r1(fx - 58)} cy={RY * 0.56} r={13} fill={dark} stroke={INK} strokeWidth={4.5} />
        </g>
      );
    case "crown":
      return (
        <path
          d={`M${-RX * 0.5} ${-RY * 0.86}L${-RX * 0.56} ${-RY * 1.34}L${-RX * 0.26} ${-RY * 1.1}L0 ${-RY * 1.44}L${RX * 0.26} ${-RY * 1.1}L${RX * 0.56} ${-RY * 1.34}L${RX * 0.5} ${-RY * 0.86}Q0 ${-RY * 1.02} ${-RX * 0.5} ${-RY * 0.86}Z`}
          fill={c}
          stroke={INK}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
    case "helmet":
      return (
        <g>
          <circle cx={0} cy={-6} r={RX + 34} fill="#bfe6ff" fillOpacity={0.22} stroke={INK} strokeWidth={sw} />
          <path d={`M${-RX * 0.86} ${-RY * 0.7}Q${-RX * 0.5} ${-RY * 1.16} ${-RX * 0.1} ${-RY * 1.2}`} fill="none" stroke="#ffffff" strokeWidth={10} strokeLinecap="round" opacity={0.85} />
          <ellipse cx={0} cy={RY + 6} rx={RX * 0.78} ry={26} fill={c} stroke={INK} strokeWidth={sw} />
        </g>
      );
    case "partyhat":
      return (
        <g>
          <path d={`M${-RX * 0.36} ${-RY * 0.84}L${RX * 0.08} ${-RY * 1.62}L${RX * 0.42} ${-RY * 0.8}Q0 ${-RY * 0.98} ${-RX * 0.36} ${-RY * 0.84}Z`} fill={c} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <path d={`M${-RX * 0.2} ${-RY * 1.12}L${RX * 0.26} ${-RY * 1.18}M${-RX * 0.04} ${-RY * 1.4}L${RX * 0.16} ${-RY * 1.43}`} stroke="#ffffff" strokeWidth={9} strokeLinecap="round" />
          <circle cx={RX * 0.08} cy={-RY * 1.64} r={17} fill="#ffffff" stroke={INK} strokeWidth={sw * 0.8} />
        </g>
      );
    case "bow":
      return (
        <g transform={`translate(${RX * 0.52} ${-RY * 0.86}) rotate(24)`}>
          <path d="M0 0L-62 -36Q-74 0 -62 36Z" fill={c} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M0 0L62 -36Q74 0 62 36Z" fill={c} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx={0} cy={0} r={17} fill={dark} stroke={INK} strokeWidth={sw} />
        </g>
      );
    case "tophat":
      return (
        <g>
          <rect x={-RX * 0.44} y={-RY * 1.72} width={RX * 0.88} height={RY * 0.84} rx={10} fill={c} stroke={INK} strokeWidth={sw} />
          <rect x={-RX * 0.44} y={-RY * 1.1} width={RX * 0.88} height={RY * 0.14} fill="#c62828" />
          <ellipse cx={0} cy={-RY * 0.9} rx={RX * 0.78} ry={24} fill={c} stroke={INK} strokeWidth={sw} />
        </g>
      );
    case "hood": {
      const hc = topColor ?? c;
      // even-odd ring: the hood wraps the head and leaves the face showing
      const ox = RX + 20;
      const oy = RY + 18;
      const ix = RX * 0.8;
      const iy = RY * 0.74;
      const icx = fx * 0.45;
      const icy = 14;
      const ring =
        `M${-ox} 0A${ox} ${oy} 0 1 0 ${ox} 0A${ox} ${oy} 0 1 0 ${-ox} 0Z` +
        `M${r1(icx - ix)} ${icy}A${r1(ix)} ${r1(iy)} 0 1 1 ${r1(icx + ix)} ${icy}A${r1(ix)} ${r1(iy)} 0 1 1 ${r1(icx - ix)} ${icy}Z`;
      return <path d={ring} fill={hc} fillRule="evenodd" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />;
    }
  }
}

/** hats that sit over the crown hide the feather tuft */
const HIDES_TUFT = new Set(["cap", "beanie", "generic", "hood", "tophat"]);

function Eyewear({ look, e, sxR, sxL }: { look: DollLook; e: number; sxR: number; sxL: number }) {
  const ew = look.eyewear;
  if (!ew) return null;
  const c = ew.color;
  if (ew.kind === "goggles") {
    return (
      <g>
        <path d={`M${-DIM.HEAD_RX * 2} -4L${DIM.HEAD_RX * 2} -4`} stroke={shade(c, -0.25)} strokeWidth={18} />
        <rect x={r1(-e - 50 * sxR)} y={-53} width={r1(2 * e + 50 * sxR + 50 * sxL)} height={106} rx={44} fill="#7fdcff" fillOpacity={0.5} stroke={c} strokeWidth={13} />
        <rect x={r1(-e - 50 * sxR)} y={-53} width={r1(2 * e + 50 * sxR + 50 * sxL)} height={106} rx={44} fill="none" stroke={INK} strokeWidth={3.5} />
      </g>
    );
  }
  const lens = ew.kind === "sunglasses" ? { fill: "#1b1b22", op: 0.92 } : { fill: "#d6f1ff", op: 0.25 };
  return (
    <g>
      <path d={`M${r1(-e + 40 * sxR)} -4L${r1(e - 40 * sxL)} -4`} stroke={c} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={-e} cy={0} rx={r1(50 * sxR)} ry={53} fill={lens.fill} fillOpacity={lens.op} stroke={c} strokeWidth={10} />
      <ellipse cx={e} cy={0} rx={r1(50 * sxL)} ry={53} fill={lens.fill} fillOpacity={lens.op} stroke={c} strokeWidth={10} />
    </g>
  );
}

// ----------------------------------------------------------------- head --

function Head({
  sk,
  pose,
  look,
  pal,
  uid,
}: {
  sk: Skeleton;
  pose: Pose;
  look: DollLook;
  pal: Palette;
  /** makes this head's clip-path ids unique on the page */
  uid: string;
}) {
  const ids = { head: `yh${uid}`, eyeR: `yr${uid}`, eyeL: `yl${uid}` };
  const RX = DIM.HEAD_RX;
  const RY = DIM.HEAD_RY;
  const hy = (sk.headYaw * Math.PI) / 180;
  const cosH = Math.cos(hy);
  const sinH = Math.sin(hy);
  const fx = sk.faceLocal.x;
  const fy = sk.faceLocal.y;
  const e = 84 * Math.max(0.16, cosH);
  // the far eye squashes as the head turns away
  const far = Math.max(0.42, cosH ** 0.8);
  const near = 0.8 + 0.2 * cosH;
  const sxR = sinH > 0 ? near : far; // character's right eye sits on screen-left
  const sxL = sinH > 0 ? far : near;
  const face = look.face;
  const off = GAZE_OFF[face.gaze];
  const gaze = { x: pose.lookX * 5 + off.x, y: pose.lookY * 4 + off.y };
  const beakX = fx + sinH * 22;
  const beakSx = 1 + 0.3 * Math.abs(sinH);
  const tuftX = -16 - fx * 0.16;
  const showTuft = pal.mannequin || !look.headwear || !HIDES_TUFT.has(look.headwear.kind);
  const fill = pal.mannequin ? M_BODY : pal.body;
  const tf = `translate(${r1(sk.headC.x)} ${r1(sk.headC.y)}) rotate(${r1(sk.rHead)}) scale(${sc(sk.k)})`;
  const brows = BROW_DRAW[face.brows];
  const blushy = face.blush === "extra";
  const blush = blushy || (face.blush === "auto" && look.blush);

  const brow = (cx: number, inner: 1 | -1, sx: number, [tilt, lift]: [number, number]) => {
    // inner = which screen direction is toward the beak
    const half = 17 * sx;
    const dy = Math.sin((tilt * Math.PI) / 180) * half;
    const y = -64 - lift;
    return (
      <path
        d={`M${r1(cx - inner * half)} ${r1(y - dy)}Q${r1(cx)} ${r1(y - 4)} ${r1(cx + inner * half)} ${r1(y + dy)}`}
        fill="none"
        stroke={INK}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
    );
  };

  return (
    <g transform={tf}>
      <defs>
        <clipPath id={ids.head}>
          <ellipse cx={0} cy={0} rx={RX - 2} ry={RY - 2} />
        </clipPath>
        <clipPath id={ids.eyeR}>
          <ellipse cx={0} cy={0} rx={r1(37 * sxR)} ry={44} />
        </clipPath>
        <clipPath id={ids.eyeL}>
          <ellipse cx={0} cy={0} rx={r1(37 * sxL)} ry={44} />
        </clipPath>
      </defs>
      {showTuft && (
        <path
          transform={`translate(${r1(tuftX)} ${-RY + 10})`}
          d="M-36 6C-56 -30 -32 -64 -8 -40C-2 -74 36 -76 30 -38C54 -54 74 -22 46 4Z"
          fill={fill}
          stroke={pal.ink}
          strokeWidth={OUT}
          strokeLinejoin="round"
        />
      )}
      <ellipse cx={0} cy={0} rx={RX} ry={RY} fill={fill} stroke={pal.ink} strokeWidth={OUT} />
      {pal.mannequin ? (
        <g clipPath={`url(#${ids.head})`}>
          {/* construction lines: where the face points */}
          <path d={`M${r1(fx * 0.3)} ${-RY}Q${r1(fx * 2.1)} 0 ${r1(fx * 0.3)} ${RY}`} fill="none" stroke={pal.ink} strokeWidth={3.2} strokeDasharray="10 9" opacity={0.5} />
          <path d={`M${-RX} ${r1(fy * 0.3)}Q0 ${r1(fy * 2.1)} ${RX} ${r1(fy * 0.3)}`} fill="none" stroke={pal.ink} strokeWidth={3.2} strokeDasharray="10 9" opacity={0.5} />
          <g transform={`translate(${r1(fx)} ${r1(fy)})`}>
            <ellipse cx={-e} cy={0} rx={r1(15 * sxR)} ry={21} fill={pal.ink} />
            <ellipse cx={e} cy={0} rx={r1(15 * sxL)} ry={21} fill={pal.ink} />
          </g>
        </g>
      ) : (
        <g clipPath={`url(#${ids.head})`}>
          <g transform={`translate(${r1(fx)} ${r1(fy)})`}>
            {blush && (
              <>
                <ellipse cx={r1(-e - 40 * sxR)} cy={48} rx={r1((blushy ? 32 : 26) * sxR)} ry={blushy ? 19 : 15} fill={BLUSH} opacity={blushy ? 0.85 : 0.62} />
                <ellipse cx={r1(e + 40 * sxL)} cy={48} rx={r1((blushy ? 32 : 26) * sxL)} ry={blushy ? 19 : 15} fill={BLUSH} opacity={blushy ? 0.85 : 0.62} />
              </>
            )}
            <g transform={`translate(${r1(-e)} 0)`}>
              <Eye sx={sxR} kind={face.eyeR} look={look} gaze={gaze} clipId={ids.eyeR} outer={-1} />
            </g>
            <g transform={`translate(${r1(e)} 0)`}>
              <Eye sx={sxL} kind={face.eyeL} look={look} gaze={gaze} clipId={ids.eyeL} outer={1} />
            </g>
            {brows && brow(-e, 1, sxR, brows.r)}
            {brows && brow(e, -1, sxL, brows.l)}
            <Eyewear look={look} e={e} sxR={sxR} sxL={sxL} />
          </g>
        </g>
      )}
      {/* the beak is NOT clipped, so it pokes past the head in profile */}
      <g transform={`translate(${r1(beakX)} ${r1(fy + 46)}) scale(${sc(beakSx)} 1)`}>
        {pal.mannequin ? (
          <path d="M-27 0Q0 -24 27 0Q14 22 0 24Q-14 22 -27 0Z" fill={BEAK} stroke={pal.ink} strokeWidth={5} strokeLinejoin="round" />
        ) : (
          <Beak kind={face.beak} flip={sinH >= 0 ? 1 : -1} />
        )}
      </g>
      {!pal.mannequin && <Headwear look={look} fx={fx} topColor={look.top?.color ?? null} />}
      {!pal.mannequin && face.extras.length > 0 && (
        <FaceMarks extras={face.extras} tearAt={{ x: fx - e - 10 * sxR, y: fy + 62 }} />
      )}
    </g>
  );
}

// ---------------------------------------------------------- accessories --

function Pet({
  at,
  k,
  kind,
  flip,
  fur,
  pal,
}: {
  at: Pt;
  k: number;
  kind: "cat" | "koala" | "generic";
  flip: 1 | -1;
  /** coat colour */
  fur: string;
  pal: Palette;
}) {
  const coat = pal.mannequin ? "#cfd5e2" : fur;
  const light = pal.mannequin ? "#eef1f7" : shade(fur, 0.76);
  const ink = pal.ink;
  return (
    <g transform={`translate(${r1(at.x)} ${r1(at.y)}) scale(${sc(k * flip)} ${sc(k)})`}>
      {kind === "cat" && !pal.mannequin && (
        <path d="M34 34Q78 40 70 -4" fill="none" stroke={ink} strokeWidth={20} strokeLinecap="round" />
      )}
      {kind === "cat" && !pal.mannequin && (
        <path d="M34 34Q78 40 70 -4" fill="none" stroke={coat} strokeWidth={10} strokeLinecap="round" />
      )}
      <ellipse cx={4} cy={30} rx={40} ry={34} fill={coat} stroke={ink} strokeWidth={OUT * 0.9} />
      {kind === "koala" && (
        <>
          <circle cx={-34} cy={-40} r={21} fill={coat} stroke={ink} strokeWidth={OUT * 0.9} />
          <circle cx={36} cy={-40} r={21} fill={coat} stroke={ink} strokeWidth={OUT * 0.9} />
          <circle cx={-34} cy={-40} r={10} fill={light} />
          <circle cx={36} cy={-40} r={10} fill={light} />
        </>
      )}
      {kind === "cat" && (
        <>
          <path d="M-34 -30L-30 -66L-6 -44Z" fill={coat} stroke={ink} strokeWidth={OUT * 0.9} strokeLinejoin="round" />
          <path d="M36 -30L32 -66L8 -44Z" fill={coat} stroke={ink} strokeWidth={OUT * 0.9} strokeLinejoin="round" />
        </>
      )}
      <circle cx={1} cy={-18} r={35} fill={coat} stroke={ink} strokeWidth={OUT * 0.9} />
      {!pal.mannequin && <ellipse cx={1} cy={-6} rx={17} ry={12} fill={light} />}
      <circle cx={-13} cy={-22} r={5.5} fill={ink} />
      <circle cx={15} cy={-22} r={5.5} fill={ink} />
      {kind === "koala" ? (
        <ellipse cx={1} cy={-10} rx={8} ry={11} fill={ink} />
      ) : (
        <path d="M-5 -11L7 -11L1 -4Z" fill={pal.mannequin ? ink : "#f48fb1"} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      )}
    </g>
  );
}

// ----------------------------------------------------------------- doll --

export function Doll({ pose, sk, look, mode = "dressed", tint = true, shadow = true }: DollProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const torsoClip = `yt${uid}`;
  const mannequin = mode === "mannequin";
  const pal: Palette = { ink: mannequin ? M_INK : INK, body: look.feather, mannequin };
  const k = sk.k;
  const tintR = mannequin ? (tint ? M_RIGHT : M_BODY) : look.feather;
  const tintL = mannequin ? (tint ? M_LEFT : M_BODY) : look.feather;
  const top = mannequin ? null : look.top;
  const bottom = mannequin ? null : look.bottom;
  const wf = 0.9 + 0.1 * sk.cosYaw;

  // far-side limbs first so the near side overlaps them
  const farIsL = pose.yaw > 0;
  const armOf = { key: "L" as const, a: sk.armL, ap: pose.armL, tintColor: tintL };
  const armOr = { key: "R" as const, a: sk.armR, ap: pose.armR, tintColor: tintR };
  const arms = farIsL ? [armOf, armOr] : [armOr, armOf];
  const legOf = { key: "L" as const, l: sk.legL, lp: pose.legL, tintColor: tintL };
  const legOr = { key: "R" as const, l: sk.legR, lp: pose.legR, tintColor: tintR };
  const legs = farIsL ? [legOf, legOr] : [legOr, legOf];

  // the placeholder for whatever is being held: it belongs to one hand, or floats on its own
  const held = look.item;
  const spot = held ? itemSpot(sk, held) : null;
  const token = spot && <ItemToken c={spot.at} rot={spot.rot} size={spot.size} pal={pal} />;
  const armLayer = (layer: ArmPose["layer"]) =>
    arms
      .filter((p) => p.ap.layer === layer)
      .map((p) => (
        <Arm
          key={p.key}
          a={p.a}
          ap={p.ap}
          k={k}
          top={top}
          pal={pal}
          tintColor={p.tintColor}
          grips={!!held && (held.hand === p.key || held.hand === "both")}
          item={held?.hand === p.key ? token : null}
        />
      ));
  const legLayer = (layer: LegPose["layer"]) =>
    legs
      .filter((p) => p.lp.layer === layer)
      .map((p) => <Leg key={p.key} l={p.l} k={k} look={look} pal={pal} tintColor={p.tintColor} />);

  const pelvisTf = `translate(${r1(sk.pelvis.x)} ${r1(sk.pelvis.y)}) rotate(${r1(sk.rBody)}) scale(${sc(k)})`;
  const torsoTf = `translate(${r1(sk.pelvis.x)} ${r1(sk.pelvis.y)}) rotate(${r1(sk.rTorso)}) scale(${sc(k)})`;
  const pelvisFill = mannequin
    ? M_BODY
    : top?.onePiece
      ? top.color
      : bottom
        ? bottom.color
        : pal.body;
  const skirt = !mannequin && (top?.skirt ? top.color : bottom?.length === "skirt" ? bottom.color : null);

  // where the pet sits
  let pet: ReactNode = null;
  if (look.pet) {
    const at = petAt(sk, look.pet.place, pose.yaw);
    pet = <Pet at={at.at} k={k * 1.12} kind={look.pet.kind} flip={at.flip} fur={look.pet.fur} pal={pal} />;
  }
  // behind the character (drawn first, under everything) or in front of it
  const petBehind = !!look.pet?.behind;

  const back = !mannequin && look.back;
  const neck = !mannequin && look.neck;

  return (
    <g>
      <defs>
        <clipPath id={torsoClip}>
          <path d={torsoPath(wf)} />
        </clipPath>
      </defs>

      {shadow && (
        <ellipse
          cx={r1(sk.ground.x)}
          cy={r1(sk.ground.y)}
          rx={r1(sk.groundRx)}
          ry={r1(Math.max(10 * k, sk.groundRx * 0.15))}
          fill={mannequin ? "#1c2340" : "#3b2a5c"}
          opacity={mannequin ? 0.13 : 0.2}
        />
      )}
      {petBehind && pet}

      {/* behind the body */}
      {back && back.kind === "cape" && (
        <path
          transform={torsoTf}
          d={`M${-84 * wf} ${-T * 0.92}L${84 * wf} ${-T * 0.92}Q${160 * wf} ${-T * 0.2} ${166 * wf} 96Q0 134 ${-166 * wf} 96Q${-160 * wf} ${-T * 0.2} ${-84 * wf} ${-T * 0.92}Z`}
          fill={back.color}
          stroke={INK}
          strokeWidth={OUT}
          strokeLinejoin="round"
        />
      )}
      {back && back.kind === "wings" && (
        <g transform={torsoTf}>
          <path d={`M${-70 * wf} ${-T * 0.7}Q-210 ${-T * 1.1} -220 ${-T * 0.36}Q-176 ${-T * 0.4} -150 ${-T * 0.16}Q-112 ${-T * 0.3} ${-70 * wf} ${-T * 0.34}Z`} fill={back.color} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
          <path d={`M${70 * wf} ${-T * 0.7}Q210 ${-T * 1.1} 220 ${-T * 0.36}Q176 ${-T * 0.4} 150 ${-T * 0.16}Q112 ${-T * 0.3} ${70 * wf} ${-T * 0.34}Z`} fill={back.color} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
        </g>
      )}
      {back && back.kind === "backpack" && (
        <rect transform={torsoTf} x={-128 * wf + sk.sinYaw * -40} y={-T * 0.9} width={256 * wf} height={T * 0.86} rx={38} fill={back.color} stroke={INK} strokeWidth={OUT} />
      )}
      {/* tail tuft */}
      <path
        transform={`${pelvisTf} translate(${r1(sk.tailSide * DIM.PELVIS_RX * (0.8 + 0.22 * Math.abs(sk.sinYaw)))} -16) scale(${sk.tailSide} 1)`}
        d="M-12 22C10 30 46 20 50 -2C36 2 34 -4 40 -22C22 -16 16 -22 14 -36C0 -24 -14 -8 -12 22Z"
        fill={mannequin ? M_BODY : pal.body}
        stroke={pal.ink}
        strokeWidth={OUT}
        strokeLinejoin="round"
      />
      {armLayer("back")}
      {legLayer("back")}

      {/* hips */}
      <ellipse
        transform={pelvisTf}
        cx={0}
        cy={6}
        rx={r1(DIM.PELVIS_RX * wf)}
        ry={DIM.PELVIS_RY}
        fill={pelvisFill}
        stroke={pal.ink}
        strokeWidth={OUT}
      />
      {skirt && <path transform={pelvisTf} d={skirtPath(wf)} fill={skirt} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />}
      {top?.hood && (
        <ellipse transform={torsoTf} cx={0} cy={-T * 0.93} rx={126 * wf} ry={50} fill={shade(top.color, -0.06)} stroke={INK} strokeWidth={OUT} />
      )}

      <Torso sk={sk} look={look} pal={pal} clipId={torsoClip} />
      {back && back.kind === "backpack" && (
        <path
          transform={torsoTf}
          d={`M${-66 * wf} ${-T * 0.94}Q${-86 * wf} ${-T * 0.5} ${-70 * wf} ${-T * 0.14}M${66 * wf} ${-T * 0.94}Q${86 * wf} ${-T * 0.5} ${70 * wf} ${-T * 0.14}`}
          fill="none"
          stroke={INK}
          strokeWidth={20}
          strokeLinecap="round"
        />
      )}
      {back && back.kind === "backpack" && (
        <path
          transform={torsoTf}
          d={`M${-66 * wf} ${-T * 0.94}Q${-86 * wf} ${-T * 0.5} ${-70 * wf} ${-T * 0.14}M${66 * wf} ${-T * 0.94}Q${86 * wf} ${-T * 0.5} ${70 * wf} ${-T * 0.14}`}
          fill="none"
          stroke={shade(back.color, -0.15)}
          strokeWidth={10}
          strokeLinecap="round"
        />
      )}
      {neck && neck.kind === "medal" && (
        <g transform={torsoTf}>
          <path d={`M-44 ${-T * 0.98}L0 ${-T * 0.5}L44 ${-T * 0.98}`} fill="none" stroke={neck.color} strokeWidth={13} strokeLinejoin="round" />
          <circle cx={0} cy={-T * 0.44} r={25} fill="#ffc53d" stroke={INK} strokeWidth={OUT * 0.9} />
          <circle cx={0} cy={-T * 0.44} r={11} fill="none" stroke="#c8860d" strokeWidth={4} />
        </g>
      )}
      {legLayer("front")}
      {armLayer("mid")}

      <Head sk={sk} pose={pose} look={look} pal={pal} uid={uid} />

      {/* neckwear wraps around the chin, over the head's lower edge */}
      {!mannequin && top?.collar === "turtle" && (
        <ellipse transform={torsoTf} cx={0} cy={-T * 0.95} rx={84 * wf} ry={22} fill={shade(top.color, -0.07)} stroke={INK} strokeWidth={OUT} />
      )}
      {!mannequin && top?.collar === "ring" && (
        <ellipse transform={torsoTf} cx={0} cy={-T * 0.94} rx={86 * wf} ry={19} fill={top.accent} stroke={INK} strokeWidth={OUT} />
      )}
      {neck && neck.kind === "scarf" && (
        <g transform={torsoTf}>
          <rect x={30} y={-T * 0.98} width={44} height={104} rx={14} fill={shade(neck.color, -0.1)} stroke={INK} strokeWidth={OUT} />
          <ellipse cx={0} cy={-T * 0.98} rx={100 * wf} ry={31} fill={neck.color} stroke={INK} strokeWidth={OUT} />
        </g>
      )}
      {neck && neck.kind === "bandana" && (
        <path
          transform={torsoTf}
          d={`M${-92 * wf} ${-T * 1.02}Q0 ${-T * 0.88} ${92 * wf} ${-T * 1.02}L0 ${-T * 0.52}Z`}
          fill={neck.color}
          stroke={INK}
          strokeWidth={OUT}
          strokeLinejoin="round"
        />
      )}
      {neck && neck.kind === "bowtie" && (
        <g transform={`${torsoTf} translate(0 ${-T * 0.84})`}>
          <path d="M0 0L-44 -24Q-52 0 -44 24Z" fill={neck.color} stroke={INK} strokeWidth={OUT * 0.9} strokeLinejoin="round" />
          <path d="M0 0L44 -24Q52 0 44 24Z" fill={neck.color} stroke={INK} strokeWidth={OUT * 0.9} strokeLinejoin="round" />
          <circle cx={0} cy={0} r={12} fill={shade(neck.color, -0.2)} stroke={INK} strokeWidth={OUT * 0.8} />
        </g>
      )}
      {!petBehind && pet}
      {held && (held.hand === "both" || held.hand === "free") && token}
      {armLayer("front")}
    </g>
  );
}

// ------------------------------------------------------------- wrappers --

/** a small self-contained picture of a pose — used for the preset buttons */
export function DollThumb({
  pose,
  look,
  mode = "dressed",
  className,
}: {
  pose: Pose;
  look: DollLook;
  mode?: DollMode;
  className?: string;
}) {
  const frame: Frame = { w: 1000, h: 1000 };
  const centred = { ...pose, x: 0.5, y: 0.7, scale: 1 };
  const sk = solve(centred, frame);
  const b = boundsOf(sk);
  const side = Math.max(b.maxX - b.minX, b.maxY - b.minY) + 30;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return (
    <svg
      viewBox={`${r1(cx - side / 2)} ${r1(cy - side / 2)} ${r1(side)} ${r1(side)}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <Doll pose={centred} sk={sk} look={look} mode={mode} />
    </svg>
  );
}

const ICON_FRAME: Frame = { w: 1000, h: 1000 };
const ICON_SK = solve(STAND, ICON_FRAME);

/** one hand shape on a stub of arm — the buttons of the hand picker */
export function HandIcon({
  shape,
  palm = "auto",
  color = FEATHER,
  className,
}: {
  shape: HandShape;
  palm?: PalmSide;
  color?: string;
  className?: string;
}) {
  // fingers up, except the thumb signs, which read best from the side
  const sideways = shape === "thumb" || shape === "thumbDown";
  let rot = sideways ? 90 : 180;
  if (sideways) {
    // with the palm or the back forced, the arm has to come in from the other side for the thumb to point the right way
    const t = spin(spin({ x: 0, y: 1 }, rot), 90 * thumbSide(rot, -1, shape, palm));
    if (t.y < 0 !== (shape === "thumb")) rot = -90;
  }
  const from = rot === 90 ? 1 : -1; // which side the arm comes in from
  const c: Pt = sideways ? { x: 8 * from, y: shape === "thumbDown" ? -14 : 10 } : { x: 0, y: 14 };
  const stub: Pt[] = sideways
    ? [
        { x: 64 * from, y: c.y },
        { x: 40 * from, y: c.y },
      ]
    : [
        { x: 0, y: 68 },
        { x: 0, y: 44 },
      ];
  return (
    <svg viewBox="-66 -72 132 132" className={className} aria-hidden="true" focusable="false">
      <Tube pts={stub} w={42} color={color} ink={INK} ow={OUT} />
      <Hand c={c} rot={rot} s={-1} k={1} shape={shape} palm={palm} color={color} ink={INK} />
    </svg>
  );
}

/** just the head, wearing one face — the buttons of the expression picker */
export function FaceIcon({ face, look, className }: { face: Face; look: DollLook; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pal: Palette = { ink: INK, body: look.feather, mannequin: false };
  const c = ICON_SK.headC;
  return (
    <svg viewBox={`${r1(c.x - 236)} ${r1(c.y - 262)} 472 442`} className={className} aria-hidden="true" focusable="false">
      <Head sk={ICON_SK} pose={STAND} look={{ ...look, face, headwear: null, eyewear: null }} pal={pal} uid={uid} />
    </svg>
  );
}
