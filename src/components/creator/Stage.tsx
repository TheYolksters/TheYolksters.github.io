import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Doll, type DollMode } from "@/components/creator/Doll";
import { CARD_OF, NODES, type NodeId } from "@/components/creator/nodes";
import type { Box } from "@/lib/creator/design";
import type { DollLook } from "@/lib/creator/look";
import {
  DIM,
  PET_REACH,
  boundsOf,
  canTurn,
  clamp,
  dragHandle,
  handlePoint,
  itemOffset,
  itemSpot,
  layersForYaw,
  norm,
  petAt,
  petDrop,
  petSpotPoint,
  solve,
  turnAngle,
  turnNode,
  turnPivot,
  type Frame,
  type ItemPlace,
  type PetPlace,
  type Pose,
  type Pt,
} from "@/lib/creator/rig";
import { cn } from "@/lib/utils";

/**
 * The stage: the doll, the dots you drag to pose it, and the tools that
 * appear on whichever dot is selected.
 *
 *  - Drag a dot to move it. Mouse, touch and pen all go through pointer
 *    events, and every dot is a keyboard control too (Tab to it, arrow keys
 *    nudge it, Enter opens its options).
 *  - The selected dot grows a "gizmo" like the one in 3D programs: a red
 *    arrow that slides it left / right only, a green arrow for up / down
 *    only, and a blue ring that turns it.
 *  - Rest the pointer on a dot (or click it) for its quick options;
 *    right-click it (or press and hold on a touch screen) for all of them.
 */

/** drawn back-to-front, so the hands and feet end up on top and win clicks */
const ORDER: NodeId[] = [
  "body",
  "look",
  "chest",
  "head",
  "kneeR",
  "kneeL",
  "elbowR",
  "elbowL",
  "toeR",
  "toeL",
  "footR",
  "footL",
  "handR",
  "handL",
  "pet",
  "item",
];

/** which gizmo parts each dot gets */
const GIZMO: Partial<Record<NodeId, { move?: true; turn?: true; yaw?: true; size?: true }>> = {
  handL: { move: true, turn: true },
  handR: { move: true, turn: true },
  footL: { move: true, turn: true },
  footR: { move: true, turn: true },
  elbowL: { move: true },
  elbowR: { move: true },
  kneeL: { move: true },
  kneeR: { move: true },
  look: { move: true },
  body: { move: true, turn: true, yaw: true, size: true },
  item: { move: true, turn: true, size: true },
  pet: { move: true },
};

const TURN_LABEL: Partial<Record<NodeId, string>> = {
  handL: "Bend the left wrist",
  handR: "Bend the right wrist",
  footL: "Tip the left foot",
  footR: "Tip the right foot",
  body: "Tilt the whole body",
  item: "Turn the item",
};

const NAVY = "#1c2340";
// the usual 3D-program colours: X red, Y green, Z (turning in the picture plane) blue
const AXIS_X = "#e5484d";
const AXIS_Y = "#2f9e44";
const AXIS_Z = "#3e63dd";

/** gizmo sizes, in CSS pixels */
const RING = 36;
const ARROW_FROM = 20;
const ARROW_TO = 56;
const SIZE_AT = 64;

type DragMode = "free" | "x" | "y" | "turn" | "yaw" | "size";

interface DragState {
  id: NodeId;
  mode: DragMode;
  startPose: Pose;
  startItem: ItemPlace | null;
  /** pointer → dot offset when the drag began */
  dx: number;
  dy: number;
  /** where the dot was when the drag began */
  origin: Pt;
  /** what a turn or a resize happens around */
  pivot: Pt;
  /** the pointer's starting angle and distance from the pivot, and its starting x */
  a0: number;
  d0: number;
  x0: number;
  moved: boolean;
  /** screen position at the start, to tell a press from a drag */
  cx: number;
  cy: number;
  touch: boolean;
}

interface StageProps {
  pose: Pose;
  frame: Frame;
  look: DollLook;
  view: DollMode;
  tint: boolean;
  showHandles: boolean;
  /** show the arrows and rings on the selected dot */
  gizmo: boolean;
  plantFeet: boolean;
  selected: NodeId | null;
  onSelect: (id: NodeId | null) => void;
  /** the dot whose complete options are open (right-click), if any */
  menu: NodeId | null;
  onMenu: (id: NodeId | null) => void;
  /**
   * Options cards float beside the dot. True with a mouse on a roomy screen;
   * on a phone they would cover the doll, so the page shows them underneath
   * the stage instead and this is false.
   */
  floating: boolean;
  /** the options card for a dot: `full` is the right-click version */
  card: (id: NodeId, full: boolean, close: () => void) => ReactNode;
  /** the held item's name, shown as a label on its placeholder box */
  itemLabel: string;
  /** a drag (or key nudge) is starting: remember the state for undo */
  onBegin: () => void;
  /** live pose while dragging */
  onPose: (p: Pose) => void;
  /** live change to the item placeholder while dragging it */
  onItem: (place: Partial<ItemPlace>) => void;
  /** live change to where the companion is while dragging it */
  onPet: (place: PetPlace) => void;
  /** the drag ended */
  onCommit: () => void;
  /** the part of the stage the AI will be shown, when that isn't all of it */
  crop: Box | null;
  /** zoomed-in view of the stage (defaults to the whole frame) */
  viewBox?: Box | null;
  /** a short caption in the corner of the stage */
  note?: string;
  textSpace: "none" | "left" | "right";
  label: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * A card pinned next to a point on the stage. It is tried on the side away
 * from the doll, above, below and on the near side (the big right-click card
 * may also sit just outside the stage), and the spot that hides least of the
 * doll wins. It is always kept inside the window.
 */
function FloatingCard({
  anchor,
  away,
  gap,
  avoid,
  full,
  label,
  innerRef,
  onEnter,
  onLeave,
  onEscape,
  children,
}: {
  /** the point it belongs to, in CSS pixels inside the stage */
  anchor: Pt;
  /** +1 to prefer the right-hand side of the point, −1 the left */
  away: 1 | -1;
  /** clearance around the point (the gizmo lives there) */
  gap: number;
  /** the doll's box, in CSS pixels inside the stage: the card tries not to sit on it */
  avoid: Rect;
  full: boolean;
  label: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onEscape: () => void;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const inside = useRef(false);
  // no dependency list on purpose: the card's own size changes with its contents
  useLayoutEffect(() => {
    const el = innerRef.current;
    const host = el?.offsetParent as HTMLElement | null;
    if (!el || !host) return;
    // while the pointer is on the card it stays put, even if a choice just moved its dot away
    if (inside.current && pos) return;
    const hr = host.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 8;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const ax = hr.left + anchor.x;
    const ay = hr.top + anchor.y;
    const side = (dir: number) => ({ left: dir > 0 ? ax + gap : ax - gap - w, top: ay - h / 2 });
    const above = { left: ax - w / 2, top: ay - gap - h };
    const below = { left: ax - w / 2, top: ay + gap };
    // the tall right-click card may also stand just outside the stage, clear of the doll altogether
    const outside = full
      ? [
          { left: hr.right + 12, top: ay - h / 2 },
          { left: hr.left - 12 - w, top: ay - h / 2 },
        ]
      : [];
    const options = [side(away), above, below, ...outside, side(-away)];
    const maxTop = Math.max(pad, vh - pad - h);
    const doll = { left: hr.left + avoid.left, top: hr.top + avoid.top, right: hr.left + avoid.right, bottom: hr.top + avoid.bottom };
    let best: { left: number; top: number } | null = null;
    let bestScore = Infinity;
    for (const o of options) {
      const fitsX = o.left >= pad && o.left + w <= vw - pad;
      const fitsY = o.top >= pad && o.top <= maxTop;
      // a quick card has to sit right by its dot; the tall card may slide up or down to fit
      if (!fitsX || (!full && !fitsY)) continue;
      const top = clamp(o.top, pad, maxTop);
      const overlapX = Math.max(0, Math.min(o.left + w, doll.right) - Math.max(o.left, doll.left));
      const overlapY = Math.max(0, Math.min(top + h, doll.bottom) - Math.max(top, doll.top));
      const onDot = ax > o.left && ax < o.left + w && ay > top && ay < top + h;
      // a quick card keeps off the buttons around the stage too: Undo and friends above it most of all
      const offStage = full ? 0 : Math.max(0, hr.top - top) * 300 + Math.max(0, top + h - hr.bottom) * 60;
      const score = overlapX * overlapY + offStage + (onDot ? 1e7 : 0);
      if (score < bestScore - 400) {
        best = { left: o.left, top };
        bestScore = score;
      }
    }
    const pick = best ?? { left: clamp(options[0].left, pad, Math.max(pad, vw - pad - w)), top: clamp(options[0].top, pad, maxTop) };
    const left = Math.round(pick.left - hr.left);
    const top = Math.round(pick.top - hr.top);
    setPos((cur) => (cur && cur.left === left && cur.top === top ? cur : { left, top }));
  });
  return (
    <div
      ref={innerRef}
      role={full ? "dialog" : "group"}
      aria-label={label}
      data-creator-card={full ? "full" : "quick"}
      onPointerEnter={() => {
        inside.current = true;
        onEnter();
      }}
      onPointerLeave={() => {
        inside.current = false;
        onLeave();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onEscape();
        }
      }}
      className={cn(
        "absolute z-30 rounded-xl border border-nebula-edge bg-card/95 p-3 text-left shadow-[0_14px_44px_-12px_rgb(0_0_0/0.85)] backdrop-blur",
        full ? "max-h-[min(36rem,78vh)] w-[22rem] overflow-y-auto" : "w-64",
      )}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
    </div>
  );
}

export function Stage({
  pose,
  frame,
  look,
  view,
  tint,
  showHandles,
  gizmo,
  plantFeet,
  selected,
  onSelect,
  menu,
  onMenu,
  floating,
  card,
  itemLabel,
  onBegin,
  onPose,
  onItem,
  onPet,
  onCommit,
  crop,
  viewBox,
  note,
  textSpace,
  label,
}: StageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nodeEls = useRef<Partial<Record<NodeId, SVGGElement | null>>>({});
  const dotsId = `yd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vb = viewBox ?? { x: 0, y: 0, w: frame.w, h: frame.h };
  const [cssWidth, setCssWidth] = useState(560);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragMode | null>(null);
  const raf = useRef(0);
  const pending = useRef<Pt | null>(null);
  const hold = useRef(0);
  const [hover, setHover] = useState<NodeId | null>(null);
  const hoverIn = useRef(0);
  const hoverOut = useRef(0);
  const byKeyboard = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setCssWidth(entry.contentRect.width || 560));
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(hold.current);
      window.clearTimeout(hoverIn.current);
      window.clearTimeout(hoverOut.current);
    },
    [],
  );
  // the complete card closes on a click anywhere else, or Escape
  useEffect(() => {
    if (!menu || !floating) return;
    const onDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onMenu(null);
      nodeEls.current[menu]?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, floating, onMenu]);

  // opened from the keyboard: put the focus inside the card
  useEffect(() => {
    if (!menu || !floating || !byKeyboard.current) return;
    byKeyboard.current = false;
    const t = window.setTimeout(() => cardRef.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [menu, floating]);

  const sk = solve(pose, frame);
  // stage units per CSS pixel: keeps handles finger-sized however small the stage is drawn
  const u = vb.w / Math.max(120, cssWidth);
  const k = sk.k;
  const item = look.item ? itemSpot(sk, look.item) : null;
  const pet = look.pet ? petAt(sk, look.pet.place, pose.yaw) : null;

  const nodePoint = (id: NodeId): Pt | null => {
    if (id === "item") return item ? item.at : null;
    if (id === "pet") return pet ? pet.at : null;
    return handlePoint(sk, id);
  };

  const toStage = (clientX: number, clientY: number): Pt => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  // ---- dragging ------------------------------------------------------

  /** a body resized about its own feet, so it grows up from the ground instead of sinking into it */
  const resized = (start: Pose, scale: number): Pose => {
    const next = { ...start, scale };
    const g0 = solve(start, frame).ground.y;
    const g1 = solve(next, frame).ground.y;
    return { ...next, y: next.y + (g0 - g1) / frame.h };
  };

  const apply = (d: DragState, pt: Pt) => {
    if (d.mode === "free" || d.mode === "x" || d.mode === "y") {
      const target = { x: d.mode === "y" ? d.origin.x : pt.x + d.dx, y: d.mode === "x" ? d.origin.y : pt.y + d.dy };
      if (d.id === "item") {
        if (d.startItem) onItem(itemOffset(solve(d.startPose, frame), d.startItem.hand, target));
      } else if (d.id === "pet") {
        // anywhere at all; by a shoulder, on the head or on the ground it also becomes attached there
        onPet(petDrop(solve(d.startPose, frame), target, d.startPose.yaw));
      } else {
        onPose(dragHandle(d.startPose, frame, d.id, target, { plantFeet }));
      }
      return;
    }
    if (d.mode === "turn") {
      const delta = norm(((Math.atan2(pt.y - d.pivot.y, pt.x - d.pivot.x) - d.a0) * 180) / Math.PI);
      if (d.id === "item") {
        if (d.startItem) onItem({ rot: Math.round(norm(d.startItem.rot + delta)) });
      } else if (canTurn(d.id)) {
        onPose(turnNode(d.startPose, frame, d.id, delta));
      }
      return;
    }
    if (d.mode === "yaw") {
      const yaw = clamp(Math.round(d.startPose.yaw + ((pt.x - d.x0) / u) * 0.6), -80, 80);
      onPose(layersForYaw({ ...d.startPose, yaw }));
      return;
    }
    const ratio = Math.hypot(pt.x - d.pivot.x, pt.y - d.pivot.y) / d.d0;
    if (d.id === "item") {
      if (d.startItem) onItem({ size: clamp(Math.round(d.startItem.size * ratio * 20) / 20, 0.5, 2.5) });
    } else {
      onPose(resized(d.startPose, clamp(Math.round(d.startPose.scale * ratio * 100) / 100, 0.4, 1.6)));
    }
  };

  const stop = (pointerId?: number) => {
    window.clearTimeout(hold.current);
    drag.current = null;
    pending.current = null;
    if (pointerId !== undefined && svgRef.current?.hasPointerCapture(pointerId)) svgRef.current.releasePointerCapture(pointerId);
    setDragging(null);
    onCommit();
  };

  const begin =
    (id: NodeId, mode: DragMode = "free") =>
    (e: React.PointerEvent) => {
      // a right-click belongs to the context menu
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const at = nodePoint(id);
      if (!at) return;
      e.preventDefault();
      e.stopPropagation();
      const pt = toStage(e.clientX, e.clientY);
      const pivot = mode === "free" || mode === "x" || mode === "y" ? at : id === "item" ? at : canTurn(id) ? turnPivot(sk, id) : at;
      drag.current = {
        id,
        mode,
        startPose: pose,
        startItem: look.item,
        dx: at.x - pt.x,
        dy: at.y - pt.y,
        origin: at,
        pivot,
        a0: Math.atan2(pt.y - pivot.y, pt.x - pivot.x),
        d0: Math.max(1, Math.hypot(pt.x - pivot.x, pt.y - pivot.y)),
        x0: pt.x,
        moved: false,
        cx: e.clientX,
        cy: e.clientY,
        touch: e.pointerType !== "mouse",
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      window.clearTimeout(hoverIn.current);
      setHover(null);
      if (menu) onMenu(null);
      onSelect(id);
      setDragging(mode);
      onBegin();
      // press and hold on a touch screen: the same as a right-click
      window.clearTimeout(hold.current);
      if (mode === "free" && e.pointerType !== "mouse") {
        const pointerId = e.pointerId;
        hold.current = window.setTimeout(() => {
          const d = drag.current;
          if (!d || d.moved) return;
          stop(pointerId);
          onMenu(id);
        }, 550);
      }
    };

  const flush = () => {
    raf.current = 0;
    const d = drag.current;
    const pt = pending.current;
    if (!d || !pt) return;
    apply(d, pt);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      // a little slack, so a click or a press-and-hold never nudges the pose
      if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < (d.touch ? 8 : 3)) return;
      d.moved = true;
      window.clearTimeout(hold.current);
    }
    pending.current = toStage(e.clientX, e.clientY);
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };

  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      flush();
    }
    stop(e.pointerId);
    // a plain click (no drag) on a dot brings up its quick options straight away
    if (!d.moved && !d.touch && d.mode === "free" && floating && CARD_OF[d.id] !== "body") {
      window.clearTimeout(hoverOut.current);
      setHover(d.id);
    }
  };

  // ---- menus and hovering -------------------------------------------

  const openMenu = (id: NodeId) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.clearTimeout(hold.current);
    if (drag.current) stop();
    setHover(null);
    onSelect(id);
    onMenu(id);
  };

  const hoverOn = (id: NodeId) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !floating || drag.current) return;
    window.clearTimeout(hoverOut.current);
    window.clearTimeout(hoverIn.current);
    hoverIn.current = window.setTimeout(() => setHover(id), 320);
  };
  const hoverOff = () => {
    window.clearTimeout(hoverIn.current);
    window.clearTimeout(hoverOut.current);
    // long enough to travel from the dot to its card without the card vanishing on the way
    hoverOut.current = window.setTimeout(() => setHover(null), 450);
  };

  // ---- keyboard ------------------------------------------------------

  const onKey = (id: NodeId) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      byKeyboard.current = true;
      onSelect(id);
      onMenu(id);
      return;
    }
    if (e.key === "Escape") {
      setHover(null);
      return;
    }
    const step = (e.shiftKey ? 40 : 10) * Math.max(0.6, k);
    const delta: Record<string, Pt> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const dlt = delta[e.key];
    const at = nodePoint(id);
    if (!dlt || !at) return;
    e.preventDefault();
    onBegin();
    if (id === "item") {
      if (look.item) onItem(itemOffset(sk, look.item.hand, { x: at.x + dlt.x, y: at.y + dlt.y }));
    } else if (id === "pet") {
      onPet(petDrop(sk, { x: at.x + dlt.x, y: at.y + dlt.y }, pose.yaw));
    } else {
      onPose(dragHandle(pose, frame, id, { x: at.x + dlt.x, y: at.y + dlt.y }, { plantFeet }));
    }
    onCommit();
  };

  /** arrow keys on a ring or a size handle */
  const gizmoKey = (id: NodeId, part: "turn" | "yaw" | "size") => (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const big = e.shiftKey ? 3 : 1;
    onBegin();
    if (part === "turn") {
      if (id === "item") {
        if (look.item) onItem({ rot: Math.round(norm(look.item.rot + dir * 5 * big)) });
      } else if (canTurn(id)) onPose(turnNode(pose, frame, id, dir * 5 * big));
    } else if (part === "yaw") {
      onPose(layersForYaw({ ...pose, yaw: clamp(pose.yaw + dir * 5 * big, -80, 80) }));
    } else if (id === "item") {
      if (look.item) onItem({ size: clamp(Math.round((look.item.size + dir * 0.05 * big) * 20) / 20, 0.5, 2.5) });
    } else {
      onPose(resized(pose, clamp(Math.round((pose.scale + dir * 0.05 * big) * 100) / 100, 0.4, 1.6)));
    }
    onCommit();
  };

  // ---- drawing: dots -------------------------------------------------

  const dot = (id: NodeId) => {
    const at = nodePoint(id);
    if (!at) return null;
    const info = NODES[id];
    const on = selected === id;
    const r = (info.kind === "end" ? 10 : info.kind === "joint" ? 6.5 : 8.5) * u;
    const fill = info.kind === "end" ? "#ffc53d" : info.kind === "joint" ? "#ffffff" : "#4cc9f0";
    const sw = 2.4 * u;
    let shape: ReactNode;
    if (info.kind === "turn") {
      // a diamond: "this one rotates"
      shape = <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.3} transform="rotate(45)" fill={fill} stroke={NAVY} strokeWidth={sw} />;
    } else if (info.kind === "move") {
      // a square with a cross: "this one moves everything"
      shape = (
        <>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.45} fill={fill} stroke={NAVY} strokeWidth={sw} />
          <path d={`M${-r * 0.55} 0H${r * 0.55}M0 ${-r * 0.55}V${r * 0.55}`} stroke={NAVY} strokeWidth={sw * 0.8} strokeLinecap="round" />
        </>
      );
    } else if (info.kind === "look") {
      // a ring, so the beak stays visible through it
      shape = <circle r={r} fill="#ffffff" fillOpacity={0.35} stroke="#0e7490" strokeWidth={sw} />;
    } else if (info.kind === "prop") {
      shape = <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.5} fill="#ffffff" fillOpacity={0.45} stroke="#6d28d9" strokeWidth={sw} />;
    } else if (info.kind === "pet") {
      shape = <circle r={r} fill="#ffffff" fillOpacity={0.45} stroke="#be185d" strokeWidth={sw} />;
    } else {
      shape = <circle r={r} fill={fill} stroke={NAVY} strokeWidth={sw} />;
    }
    const name = id === "item" && itemLabel ? `Held item: ${itemLabel}` : info.label;
    return (
      <g
        key={id}
        ref={(el) => {
          nodeEls.current[id] = el;
        }}
        data-node={id}
        transform={`translate(${at.x} ${at.y})`}
        role="button"
        tabIndex={0}
        aria-label={`${name}. ${info.hint} Arrow keys nudge it, Enter opens its options.`}
        aria-pressed={on}
        aria-haspopup="dialog"
        onPointerDown={begin(id)}
        onContextMenu={openMenu(id)}
        onPointerEnter={hoverOn(id)}
        onPointerLeave={hoverOff}
        onKeyDown={onKey(id)}
        onFocus={() => onSelect(id)}
        style={{ cursor: "grab", outline: "none", touchAction: "none" }}
      >
        {/* generous invisible hit area */}
        <circle r={Math.max(r, 19 * u)} fill="#000000" fillOpacity={0} />
        {on && <circle r={r + 5.5 * u} fill="none" stroke={NAVY} strokeWidth={sw} strokeDasharray={`${4 * u} ${3 * u}`} />}
        {shape}
      </g>
    );
  };

  // ---- drawing: the gizmo -------------------------------------------

  /** the joint a dot hangs off: its arrows point away from it, clear of the limb */
  const parentOf = (id: NodeId): Pt | null => {
    switch (id) {
      case "handL":
        return sk.armL.elbow;
      case "handR":
        return sk.armR.elbow;
      case "elbowL":
        return sk.armL.shoulder;
      case "elbowR":
        return sk.armR.shoulder;
      case "footL":
        return sk.legL.knee;
      case "footR":
        return sk.legR.knee;
      case "kneeL":
        return sk.legL.hip;
      case "kneeR":
        return sk.legR.hip;
      default:
        return null;
    }
  };

  /** the direction a ring's knob sits in: where the part currently points */
  const knobDir = (id: NodeId): Pt => {
    const rad = Math.PI / 180;
    if (id === "item") {
      const r = (item?.rot ?? 0) * rad;
      return { x: Math.sin(r), y: -Math.cos(r) };
    }
    if (!canTurn(id)) return { x: 0, y: -1 };
    const r = turnAngle(sk, id) * rad;
    if (id === "handL" || id === "handR") return { x: -Math.sin(r), y: Math.cos(r) }; // along the fingers
    if (id === "footL" || id === "footR") {
      const s = (id === "footL" ? sk.legL : sk.legR).toeSign;
      return { x: Math.cos(r) * s, y: Math.sin(r) * s }; // along the toes
    }
    return { x: Math.sin(r), y: -Math.cos(r) }; // up the spine
  };

  const halo = (d: string, color: string, w: number) => (
    <>
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={(w + 2.6) * u} strokeLinecap="round" opacity={0.9} />
      <path d={d} fill="none" stroke={color} strokeWidth={w * u} strokeLinecap="round" />
    </>
  );

  const arrow = (id: NodeId, axis: "x" | "y", sign: 1 | -1) => {
    const a0 = ARROW_FROM * u;
    const a1 = (ARROW_TO - 10) * u;
    const tip = ARROW_TO * u;
    const color = axis === "x" ? AXIS_X : AXIS_Y;
    // drawn pointing along +x, then turned to face the right way
    const rot = axis === "x" ? (sign > 0 ? 0 : 180) : sign > 0 ? 90 : -90;
    return (
      <g
        key={axis}
        data-gizmo={axis}
        transform={`rotate(${rot})`}
        onPointerDown={begin(id, axis)}
        onContextMenu={openMenu(id)}
        style={{ cursor: axis === "x" ? "ew-resize" : "ns-resize", touchAction: "none" }}
        aria-hidden="true"
      >
        <title>{axis === "x" ? "Slide left or right only" : "Slide up or down only"}</title>
        <rect x={a0} y={-10 * u} width={tip - a0 + 5 * u} height={20 * u} fill="#000000" fillOpacity={0} />
        {halo(`M${a0} 0H${a1}`, color, 3.2)}
        <path
          d={`M${tip + 1 * u} 0L${a1 - 1 * u} ${-6.5 * u}L${a1 - 1 * u} ${6.5 * u}Z`}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.3 * u}
          strokeLinejoin="round"
        />
      </g>
    );
  };

  const gizmoParts = (id: NodeId): ReactNode => {
    const parts = GIZMO[id];
    const at = nodePoint(id);
    if (!parts || !at) return null;
    // while something is being dragged, only the tool in use stays up
    const show = (part: DragMode) => dragging === null || dragging === part;
    const parent = parentOf(id);
    const sx: 1 | -1 = parent && Math.abs(at.x - parent.x) > 10 * k ? (at.x > parent.x ? 1 : -1) : at.x >= sk.pelvis.x ? 1 : -1;
    const sy: 1 | -1 = parent && Math.abs(at.y - parent.y) > 10 * k ? (at.y > parent.y ? 1 : -1) : -1;
    const knob = knobDir(id);
    const yawRad = (pose.yaw * Math.PI) / 180;
    // the turntable sits on the ground under the feet, clear of the rings around the hips
    const tableRx = Math.max(sk.groundRx + 16 * u, 58 * u);
    const table = { x: sk.ground.x, y: sk.ground.y + 5 * u, rx: tableRx, ry: Math.min(tableRx * 0.26, 24 * u) };
    const tableArc = `M${-table.rx} 0A${table.rx} ${table.ry} 0 0 0 ${table.rx} 0`;
    const sizeAt = { x: SIZE_AT * u * 0.7071 * (id === "body" ? 1 : sx), y: -SIZE_AT * u * 0.7071 };
    const turnValue = id === "item" ? (look.item?.rot ?? 0) : canTurn(id) ? Math.round(turnAngle(sk, id)) : 0;
    return (
      <g key="gizmo" data-gizmo-for={id} transform={`translate(${at.x} ${at.y})`}>
        {/* a guide line while sliding along one axis */}
        {(dragging === "x" || dragging === "y") && drag.current && (
          <path
            d={
              dragging === "x"
                ? `M${vb.x - at.x} ${drag.current.origin.y - at.y}H${vb.x + vb.w - at.x}`
                : `M${drag.current.origin.x - at.x} ${vb.y - at.y}V${vb.y + vb.h - at.y}`
            }
            stroke={dragging === "x" ? AXIS_X : AXIS_Y}
            strokeWidth={1.4 * u}
            strokeDasharray={`${6 * u} ${5 * u}`}
            opacity={0.8}
            pointerEvents="none"
          />
        )}
        {parts.yaw && show("yaw") && (
          // a turntable under the feet: drag it sideways to turn the body
          <g data-gizmo="yaw" transform={`translate(${table.x - at.x} ${table.y - at.y})`}>
            <path
              d={tableArc}
              fill="none"
              stroke={AXIS_Y}
              strokeOpacity={0}
              strokeWidth={17 * u}
              strokeLinecap="round"
              className="focus-visible:[stroke-opacity:0.3]"
              role="slider"
              tabIndex={0}
              aria-label="Turn the body left or right"
              aria-valuemin={-80}
              aria-valuemax={80}
              aria-valuenow={Math.round(pose.yaw)}
              onPointerDown={begin(id, "yaw")}
              onContextMenu={openMenu(id)}
              onKeyDown={gizmoKey(id, "yaw")}
              style={{ cursor: "ew-resize", outline: "none", touchAction: "none" }}
            >
              <title>Turn the body: drag left or right</title>
            </path>
            <g pointerEvents="none">
              {halo(tableArc, AXIS_Y, 2.8)}
              {[-1, 1].map((side) => (
                <path
                  key={side}
                  d={`M${side * table.rx} ${-8 * u}L${side * table.rx - 5.5 * u} ${1.5 * u}L${side * table.rx + 5.5 * u} ${1.5 * u}Z`}
                  fill={AXIS_Y}
                  stroke="#ffffff"
                  strokeWidth={1.3 * u}
                  strokeLinejoin="round"
                />
              ))}
              <circle cx={Math.sin(yawRad) * table.rx} cy={Math.cos(yawRad) * table.ry} r={5.5 * u} fill={AXIS_Y} stroke="#ffffff" strokeWidth={1.6 * u} />
            </g>
          </g>
        )}
        {parts.turn && show("turn") && (
          <g data-gizmo="turn">
            <circle
              r={RING * u}
              fill="none"
              stroke={AXIS_Z}
              strokeOpacity={0}
              strokeWidth={15 * u}
              className="focus-visible:[stroke-opacity:0.3]"
              role="slider"
              tabIndex={0}
              aria-label={TURN_LABEL[id] ?? "Turn"}
              aria-valuemin={-180}
              aria-valuemax={180}
              aria-valuenow={turnValue}
              onPointerDown={begin(id, "turn")}
              onContextMenu={openMenu(id)}
              onKeyDown={gizmoKey(id, "turn")}
              style={{ cursor: "grab", outline: "none", touchAction: "none" }}
            >
              <title>{TURN_LABEL[id] ?? "Turn"}: drag around the ring</title>
            </circle>
            <circle r={RING * u} fill="none" stroke="#ffffff" strokeWidth={5 * u} opacity={0.9} pointerEvents="none" />
            <circle r={RING * u} fill="none" stroke={AXIS_Z} strokeWidth={2.6 * u} pointerEvents="none" />
            <circle cx={knob.x * RING * u} cy={knob.y * RING * u} r={5.5 * u} fill={AXIS_Z} stroke="#ffffff" strokeWidth={1.6 * u} pointerEvents="none" />
          </g>
        )}
        {parts.size && show("size") && (
          <g data-gizmo="size">
            <path
              d={`M${sizeAt.x * 0.66} ${sizeAt.y * 0.66}L${sizeAt.x} ${sizeAt.y}`}
              stroke={NAVY}
              strokeWidth={1.6 * u}
              strokeDasharray={`${3 * u} ${3 * u}`}
              opacity={0.7}
              pointerEvents="none"
            />
            <g
              transform={`translate(${sizeAt.x} ${sizeAt.y})`}
              role="slider"
              tabIndex={0}
              aria-label={id === "item" ? "Item size" : "Size in the frame"}
              aria-valuemin={id === "item" ? 50 : 40}
              aria-valuemax={id === "item" ? 250 : 160}
              aria-valuenow={Math.round((id === "item" ? (look.item?.size ?? 1) : pose.scale) * 100)}
              onPointerDown={begin(id, "size")}
              onContextMenu={openMenu(id)}
              onKeyDown={gizmoKey(id, "size")}
              className="group"
              style={{ cursor: "nesw-resize", outline: "none", touchAction: "none" }}
            >
              <title>{id === "item" ? "Make the item bigger or smaller" : "Make the character bigger or smaller"}</title>
              <circle r={13 * u} fill="#000000" fillOpacity={0} />
              <rect
                x={-6 * u}
                y={-6 * u}
                width={12 * u}
                height={12 * u}
                rx={2.5 * u}
                fill="#ffffff"
                stroke={NAVY}
                strokeWidth={2.2 * u}
                className="group-focus-visible:fill-[#ffe9a8]"
              />
            </g>
          </g>
        )}
        {parts.move && show("x") && arrow(id, "x", sx)}
        {parts.move && show("y") && arrow(id, "y", sy)}
      </g>
    );
  };

  // ---- which card to show -------------------------------------------

  // The quick card belongs to the dot under the pointer (or just clicked) and leaves with the
  // pointer: nothing pops up after a drag to sit on top of Undo.
  const showing: { id: NodeId; full: boolean } | null =
    !floating || dragging !== null ? null : menu ? { id: menu, full: true } : hover ? { id: hover, full: false } : null;
  const cardAt = showing ? nodePoint(showing.id) : null;
  const cardGap = (id: NodeId) => {
    if (!gizmo || selected !== id) return 24;
    return GIZMO[id] ? ARROW_TO + 14 : 24;
  };
  const bounds = boundsOf(sk);
  const dollBox: Rect = {
    left: (bounds.minX - vb.x) / u,
    top: (bounds.minY - vb.y) / u,
    right: (bounds.maxX - vb.x) / u,
    bottom: (bounds.maxY - vb.y) / u,
  };
  const closeCard = () => {
    if (!showing) return;
    if (showing.full) onMenu(null);
    window.clearTimeout(hoverIn.current);
    setHover(null);
    // hand the keyboard focus back to the dot (only when that doesn't change the selection)
    if (selected === showing.id) nodeEls.current[showing.id]?.focus({ preventScroll: true });
  };

  // Draw the "what the AI sees" box when it is a real crop of the stage. If
  // it is the whole stage there is nothing to show, and if it spills well
  // past the stage (a wide picture around a centred doll) it can't be drawn.
  const slack = frame.h * 0.03;
  const isWhole = !!crop && crop.x <= 1 && crop.y <= 1 && crop.w >= frame.w - 1 && crop.h >= frame.h - 1;
  const fits =
    !!crop && crop.x >= -slack && crop.y >= -slack && crop.x + crop.w <= frame.w + slack && crop.y + crop.h <= frame.h + slack;
  const shown = crop && !isWhole && (fits || !!viewBox) ? crop : null;
  const third = frame.w / 3;
  const fontPx = 13 * u;
  const labelAbove = item ? item.at.y - item.size * 0.62 - 6 * u > vb.y + 14 * u : true;
  const dots = ORDER.filter((id) => !(gizmo && (id === "toeL" || id === "toeR")));

  return (
    <div className="relative mx-auto" style={{ width: `min(100%, ${(72 * vb.w) / vb.h}vh)` }}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="group"
        aria-label={label}
        className="block h-auto w-full scroll-mt-20 select-none rounded-xl"
        style={{ touchAction: "none", aspectRatio: `${vb.w} / ${vb.h}` }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          setHover(null);
          onSelect(null);
          if (menu) onMenu(null);
        }}
      >
        <defs>
          <pattern id={dotsId} width={50} height={50} patternUnits="userSpaceOnUse">
            <circle cx={25} cy={25} r={2.2} fill="#d8d2c2" />
          </pattern>
        </defs>
        {/* zoomed in, the view can reach past the frame: that part is drawn darker */}
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#e4e0d6" />
        <rect width={frame.w} height={frame.h} fill="#f8f5ee" />
        <rect width={frame.w} height={frame.h} fill={`url(#${dotsId})`} />

        {textSpace !== "none" && !shown && (
          <g pointerEvents="none">
            <rect x={textSpace === "left" ? 0 : third * 2} y={0} width={third} height={frame.h} fill="#4cc9f0" fillOpacity={0.16} />
            <text
              x={textSpace === "left" ? third / 2 : third * 2.5}
              y={frame.h * 0.5}
              textAnchor="middle"
              fontSize={fontPx}
              fontFamily="system-ui, sans-serif"
              fontWeight={700}
              fill="#12617a"
            >
              room for a title
            </text>
          </g>
        )}

        <Doll pose={pose} sk={sk} look={look} mode={view} tint={tint} />

        {shown && (
          <g pointerEvents="none">
            <path
              d={`M0 0H${frame.w}V${frame.h}H0ZM${shown.x} ${shown.y}V${shown.y + shown.h}H${shown.x + shown.w}V${shown.y}Z`}
              fill={NAVY}
              fillOpacity={0.1}
              fillRule="evenodd"
            />
            <rect
              x={shown.x}
              y={shown.y}
              width={shown.w}
              height={shown.h}
              fill="none"
              stroke={NAVY}
              strokeWidth={2 * u}
              strokeDasharray={`${9 * u} ${6 * u}`}
              rx={6 * u}
            />
            <text
              x={shown.x + 8 * u}
              y={shown.y + shown.h - 8 * u}
              fontSize={fontPx}
              fontFamily="system-ui, sans-serif"
              fontWeight={700}
              fill={NAVY}
              fillOpacity={0.75}
            >
              what the AI sees
            </text>
          </g>
        )}

        {note && !shown && (
          <text
            x={vb.x + 10 * u}
            y={vb.y + vb.h - 10 * u}
            fontSize={fontPx}
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
            fill={NAVY}
            fillOpacity={0.7}
            pointerEvents="none"
          >
            {note}
          </text>
        )}

        {/* the held item is only a stand-in box, so it says what it stands for */}
        {item && itemLabel && selected !== "item" && (
          <text
            data-item-label=""
            x={item.at.x}
            y={labelAbove ? item.at.y - item.size * 0.62 - 6 * u : item.at.y + item.size * 0.62 + 15 * u}
            textAnchor="middle"
            fontSize={11.5 * u}
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
            fill={NAVY}
            stroke="#ffffff"
            strokeWidth={3.4 * u}
            strokeLinejoin="round"
            paintOrder="stroke"
            pointerEvents="none"
          >
            {clip(itemLabel, 26)}
          </text>
        )}

        {showHandles && (
          <g>
            {/* grab the body to move, grab the face to look around */}
            <ellipse
              cx={(sk.pelvis.x + sk.neck.x) / 2}
              cy={(sk.pelvis.y + sk.neck.y) / 2}
              rx={112 * k}
              ry={128 * k}
              fill="#000000"
              fillOpacity={0}
              onPointerDown={begin("body")}
              onContextMenu={openMenu("body")}
              style={{ cursor: "move", touchAction: "none" }}
            >
              <title>Drag the body to move the character. Right-click for options.</title>
            </ellipse>
            <ellipse
              cx={sk.headC.x}
              cy={sk.headC.y}
              rx={DIM.HEAD_RX * k}
              ry={DIM.HEAD_RY * k}
              transform={`rotate(${sk.rHead} ${sk.headC.x} ${sk.headC.y})`}
              fill="#000000"
              fillOpacity={0}
              onPointerDown={begin("look")}
              onContextMenu={openMenu("look")}
              style={{ cursor: "grab", touchAction: "none" }}
            >
              <title>Drag the face to turn the head. Right-click for expressions.</title>
            </ellipse>
            {/* a tether shows what the tilt handles pivot around */}
            <path
              d={`M${sk.headC.x} ${sk.headC.y - 0}L${sk.headTop.x} ${sk.headTop.y}`}
              stroke={NAVY}
              strokeWidth={1.6 * u}
              strokeDasharray={`${4 * u} ${4 * u}`}
              opacity={0.45}
              pointerEvents="none"
            />
            {/*
              While the companion is being dragged: it can go anywhere, and inside a circle
              (a shoulder, the top of the head) or along the ground line it becomes attached there.
            */}
            {dragging !== null && drag.current?.id === "pet" && (
              <g pointerEvents="none" data-pet-zones={look.pet?.place.spot ?? ""}>
                {(["shoulderL", "shoulderR", "head"] as const).map((spot) => {
                  const p = petSpotPoint(sk, spot, pose.yaw).at;
                  const here = look.pet?.place.spot === spot;
                  return (
                    <circle
                      key={spot}
                      cx={p.x}
                      cy={p.y}
                      r={PET_REACH * k}
                      fill="#be185d"
                      fillOpacity={here ? 0.16 : 0.04}
                      stroke="#be185d"
                      strokeWidth={(here ? 2.4 : 1.3) * u}
                      strokeDasharray={`${5 * u} ${4 * u}`}
                    />
                  );
                })}
                <path
                  d={`M${vb.x} ${sk.ground.y}H${vb.x + vb.w}`}
                  stroke="#be185d"
                  strokeWidth={(look.pet?.place.spot === "ground" ? 2.6 : 1.3) * u}
                  strokeDasharray={`${7 * u} ${5 * u}`}
                  opacity={look.pet?.place.spot === "ground" ? 0.9 : 0.5}
                />
              </g>
            )}
            {/*
              The dots keep a fixed order in the page: re-ordering them to lift the selected one
              would take the keyboard focus away from it. The gizmo is drawn over them instead,
              and it leaves a hole in the middle, so the selected dot underneath stays grabbable.
            */}
            {dots.map(dot)}
            {gizmo && selected && gizmoParts(selected)}
          </g>
        )}
      </svg>

      {showing && cardAt && (
        <FloatingCard
          key={`${showing.id}-${showing.full ? "full" : "quick"}`}
          anchor={{ x: (cardAt.x - vb.x) / u, y: (cardAt.y - vb.y) / u }}
          away={cardAt.x >= sk.pelvis.x ? 1 : -1}
          gap={cardGap(showing.id)}
          avoid={dollBox}
          full={showing.full}
          label={`${NODES[showing.id].label} options`}
          innerRef={cardRef}
          onEnter={() => window.clearTimeout(hoverOut.current)}
          onLeave={hoverOff}
          onEscape={closeCard}
        >
          {card(showing.id, showing.full, closeCard)}
        </FloatingCard>
      )}
    </div>
  );
}
