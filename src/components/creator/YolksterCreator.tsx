import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CHARACTERS,
  POSES,
  faceOf,
  type CharacterId,
  type OutfitPreset,
  type PosePreset,
  type ShotId,
  type SlotId,
  type SlotPick,
} from "@/config/creator";
import { Doll, type DollMode } from "@/components/creator/Doll";
import { NodeCard, type CardApi } from "@/components/creator/NodeCard";
import { NODES, type NodeId } from "@/components/creator/nodes";
import { Stage } from "@/components/creator/Stage";
import { FinishPanel } from "@/components/creator/panels/FinishPanel";
import { OutfitPanel } from "@/components/creator/panels/OutfitPanel";
import { PosePanel } from "@/components/creator/panels/PosePanel";
import { SendPanel, type SendRef } from "@/components/creator/panels/SendPanel";
import { ShotPanel } from "@/components/creator/panels/ShotPanel";
import { WhoPanel, type CustomArt, type PersonArt } from "@/components/creator/panels/WhoPanel";
import { Segmented, Toggle, useMedia } from "@/components/creator/ui";
import { Button } from "@/components/ui/button";
import {
  frameOf,
  itemIn,
  mirrorDesign,
  newDesign,
  resolveLook,
  shotBox,
  shotFor,
  withCharacter,
  zoomBox,
  type Box,
  type Design,
  type RefKey,
  type Shot,
} from "@/lib/creator/design";
import { paletteFromImage } from "@/lib/creator/palette";
import { fileTag } from "@/lib/creator/prompt";
import { STAND, fitPose, layersForYaw, mixPose, samePose, solve, type Pose } from "@/lib/creator/rig";
import { designFromHash, loadDesign, saveDesign } from "@/lib/creator/storage";
import { cn } from "@/lib/utils";

/**
 * YOLKSTER CREATOR — pose it, dress it, send it to AI.
 *
 * Left: the stage with the posable doll. Right: six steps.
 * The design is one object (see lib/creator/design.ts); this component owns
 * it, keeps an undo history, and autosaves it to the browser.
 */

type TabId = "who" | "pose" | "outfit" | "shot" | "send" | "finish";

const TABS: { id: TabId; label: string }[] = [
  { id: "who", label: "Who" },
  { id: "pose", label: "Pose" },
  { id: "outfit", label: "Outfit" },
  { id: "shot", label: "Shot" },
  { id: "send", label: "Send" },
  { id: "finish", label: "Finish" },
];

/** options cards float beside the dots when there is a mouse and room for them */
const FLOATING = "(hover: hover) and (pointer: fine) and (min-width: 640px)";

function firstDesign(): { design: Design; shared: boolean } {
  const shared = designFromHash(window.location.hash);
  if (shared) return { design: shared, shared: true };
  return { design: loadDesign() ?? newDesign("dia"), shared: false };
}

export default function YolksterCreator({ people }: { people: PersonArt[] }) {
  const boot = useMemo(firstDesign, []);
  const [design, setDesign] = useState<Design>(boot.design);
  const [hist, setHist] = useState<{ past: Design[]; future: Design[] }>({ past: [], future: [] });
  const [tab, setTab] = useState<TabId>(boot.shared ? "pose" : "who");
  const [selected, setSelected] = useState<NodeId | null>(null);
  /** the dot whose complete options are open (right-click, or press and hold) */
  const [menu, setMenu] = useState<NodeId | null>(null);
  const floating = useMedia(FLOATING);
  const [view, setView] = useState<DollMode>("dressed");
  const [showHandles, setShowHandles] = useState(true);
  const [gizmo, setGizmo] = useState(true);
  const [plantFeet, setPlantFeet] = useState(false);
  const [custom, setCustom] = useState<CustomArt | null>(null);
  const [incoming, setIncoming] = useState<{ blob: Blob; name: string } | null>(null);
  const [sharedNote, setSharedNote] = useState(boot.shared);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSeen, setStageSeen] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [zoomView, setZoomView] = useState<Box | null>(null);
  const [dragging, setDragging] = useState(false);
  const before = useRef<Design | null>(null); // the design when a drag / slider began
  const dirty = useRef(false); // did that drag / slider actually change anything?
  const anim = useRef(0);
  const gliding = useRef<Pose | null>(null); // where a running pose animation will end
  const tabsRef = useRef<HTMLDivElement>(null);

  // a share link is consumed once: drop it from the address so a reload doesn't undo later changes
  useEffect(() => {
    if (boot.shared) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [boot.shared]);

  // autosave
  useEffect(() => {
    const t = window.setTimeout(() => saveDesign(design), 400);
    return () => window.clearTimeout(t);
  }, [design]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // on a phone the steps sit below the stage; once it scrolls away a small
  // floating copy keeps the doll in sight
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setStageSeen(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // an uploaded picture's address is released when it is replaced (not when its colours finish being measured)
  const customUrl = custom?.url;
  useEffect(
    () => () => {
      if (customUrl) URL.revokeObjectURL(customUrl);
    },
    [customUrl],
  );

  // ---- history -------------------------------------------------------
  /** stop a pose animation in its tracks */
  const halt = () => {
    cancelAnimationFrame(anim.current);
    gliding.current = null;
  };
  /**
   * The design as it will be once any pose animation finishes. History only
   * ever stores these settled designs, never a half-way frame.
   */
  const settled = (): Design => (gliding.current ? { ...design, pose: gliding.current } : design);

  /** a one-shot change: one undo step */
  const commit = (next: Design) => {
    const prev = settled();
    halt();
    before.current = null;
    setHist((h) => ({ past: [...h.past, prev].slice(-80), future: [] }));
    setDesign(next);
  };
  const undo = () => {
    const prev = hist.past[hist.past.length - 1];
    if (!prev) return;
    const now = settled();
    halt();
    before.current = null;
    setHist({ past: hist.past.slice(0, -1), future: [now, ...hist.future].slice(0, 80) });
    setDesign(prev);
  };
  const redo = () => {
    const next = hist.future[0];
    if (!next) return;
    const now = settled();
    halt();
    before.current = null;
    setHist({ past: [...hist.past, now].slice(-80), future: hist.future.slice(1) });
    setDesign(next);
  };
  /**
   * Continuous edits (dragging a dot, moving a slider) update the design many
   * times a second. They are bracketed so the whole gesture is ONE undo step:
   * beginLive remembers where it started, live() applies each change, endLive
   * files the starting point in the history.
   */
  const beginLive = () => {
    halt();
    if (!before.current) {
      before.current = design;
      dirty.current = false;
      setDragging(true);
    }
  };
  const live = (change: (d: Design) => Design) => {
    dirty.current = true;
    setDesign(change);
  };
  const endLive = () => {
    const start = before.current;
    before.current = null;
    if (start && dirty.current) setHist((h) => ({ past: [...h.past, start].slice(-80), future: [] }));
    dirty.current = false;
    setDragging(false);
  };
  /** typing and colour picking: applied straight away, no undo step per keystroke */
  const tweak = (change: (d: Design) => Design) => setDesign(change);

  const frame = frameOf(design);
  // The zoomed view follows the doll, but only BETWEEN drags. If it moved
  // while a dot was being dragged, the ground would slide under the pointer.
  useEffect(() => {
    if (!zoom) setZoomView(null);
    else if (!dragging) setZoomView(zoomBox(design, frameOf(design)));
  }, [zoom, dragging, design]);
  const look = useMemo(() => resolveLook(design), [design]);
  const crop = useMemo(() => shotBox(design, frame), [design, frame]);

  // the held item and the companion are dots too, but only while they exist
  const hasItem = !!look.item;
  const hasPetNode = !!look.pet;
  const exists = (id: NodeId | null): id is NodeId => id !== null && (id !== "item" || hasItem) && (id !== "pet" || hasPetNode);
  useEffect(() => {
    const gone = (id: NodeId | null) => (id === "item" && !hasItem) || (id === "pet" && !hasPetNode);
    setSelected((cur) => (gone(cur) ? null : cur));
    setMenu((cur) => (gone(cur) ? null : cur));
  }, [hasItem, hasPetNode]);
  // ---- the pop-up sheet of options (phones) ---------------------------
  const sheetRef = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);
  useEffect(() => {
    const down = () => {
      pointerDown.current = true;
    };
    const up = () => {
      pointerDown.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);
  const sheetOpen = !!menu && !floating;
  useEffect(() => {
    if (!sheetOpen) return;
    // keep the doll in view above the sheet, so changes show as they are made
    stageRef.current?.querySelector('svg[role="group"]')?.scrollIntoView({ block: "start" });
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    // The sheet slides up under a finger that is still pressing the dot. When
    // that finger lifts, the browser "clicks" whatever now lies beneath it,
    // which would press a random button. That one click is thrown away.
    let timer = 0;
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const lifted = () => {
      timer = window.setTimeout(() => window.removeEventListener("click", swallow, true), 350);
    };
    if (pointerDown.current) {
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.addEventListener("pointerup", lifted, { capture: true, once: true });
      window.addEventListener("pointercancel", lifted, { capture: true, once: true });
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("click", swallow, true);
      window.removeEventListener("pointerup", lifted, true);
      window.removeEventListener("pointercancel", lifted, true);
      window.clearTimeout(timer);
    };
  }, [sheetOpen]);
  const openMenu = useCallback((id: NodeId | null) => setMenu(id), []);
  const person = people.find((p) => p.id === design.who);
  const name = design.who === "custom" ? design.customName.trim() || "the character" : (person?.name ?? "the character");
  const ch = CHARACTERS[design.who];
  const activePose = POSES.find((p) => samePose(p.pose, design.pose));

  /** after the shot changes the stage's shape, keep the doll inside the new frame */
  const reframed = (next: Design): Design => {
    const f = frameOf(next);
    return f.w === frame.w && f.h === frame.h ? next : { ...next, pose: fitPose(next.pose, f) };
  };

  // ---- pose ----------------------------------------------------------
  const setPoseLive = (pose: Pose) => live((d) => ({ ...d, pose }));

  /** ease the doll into a new pose, keeping it standing on the same spot */
  const glideTo = (target: Pose, patch: Partial<Design> = {}) => {
    const from = design.pose; // wherever the doll is right now, even mid-animation
    const placed = { ...target, x: from.x, scale: from.scale };
    const g0 = solve(from, frame).ground.y;
    const g1 = solve(placed, frame).ground.y;
    const to = { ...placed, y: placed.y + (g0 - g1) / frame.h };
    commit({ ...design, ...patch, pose: from });
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setDesign((d) => ({ ...d, pose: to }));
      return;
    }
    gliding.current = to;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 240);
      const eased = 1 - (1 - t) ** 3;
      setDesign((d) => ({ ...d, pose: t >= 1 ? to : mixPose(from, to, eased) }));
      if (t < 1) anim.current = requestAnimationFrame(tick);
      else gliding.current = null;
    };
    anim.current = requestAnimationFrame(tick);
  };

  const applyPreset = (p: PosePreset) => glideTo(p.pose, { poseId: p.id, face: p.expression ? faceOf(p.expression) : design.face });

  /** what the options cards on the stage are allowed to do */
  const cardApi: CardApi = { design, look, frame, commit, tweak, begin: beginLive, live, end: endLive };

  // ---- reference pictures -------------------------------------------
  const refs: SendRef[] = useMemo(() => {
    if (design.who === "custom") return custom ? [{ key: "custom", label: "reference", thumb: custom.url, full: custom.url }] : [];
    if (!person) return [];
    return design.refs
      .map((k) => person.art.find((a) => a.key === k))
      .filter((a): a is PersonArt["art"][number] => !!a);
  }, [design.who, design.refs, person, custom]);

  const goTab = (id: TabId) => {
    setTab(id);
    // on a phone the panel sits under the stage: bring the new step into view
    requestAnimationFrame(() => {
      const el = tabsRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
    });
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let j = i;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[j].id);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#creator-tab-${TABS[j].id}`)?.focus();
  };

  const startOver = () => {
    commit(newDesign(design.who));
    setSelected(null);
    setMenu(null);
  };

  const nextTab = TABS[TABS.findIndex((t) => t.id === tab) + 1];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ------------------------------------------------------ stage -- */}
      {/* z-20: the options cards that float off the stage must pass over the steps column, not under it */}
      <div className="relative z-20 space-y-3 lg:sticky lg:top-20">
        <div ref={stageRef} className="scroll-mt-20 rounded-2xl border border-nebula-edge bg-card p-3 shadow-[0_8px_40px_-16px_rgb(0_0_0/0.6)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 truncate font-display text-base font-bold">
              {name === "the character" ? "Someone new" : name}
              <span className="font-sans text-sm font-normal text-dust"> · {activePose ? activePose.label : "Custom pose"}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={undo} disabled={!hist.past.length}>
                Undo
              </Button>
              <Button size="sm" variant="outline" onClick={redo} disabled={!hist.future.length}>
                Redo
              </Button>
              <Button size="sm" variant="outline" onClick={() => commit(mirrorDesign(design))}>
                Mirror
              </Button>
              <Button size="sm" variant="outline" onClick={() => glideTo(STAND, { poseId: "stand" })}>
                Reset
              </Button>
            </div>
          </div>

          <Stage
            pose={design.pose}
            frame={frame}
            look={look}
            view={view}
            tint={design.guide.tint}
            showHandles={showHandles}
            gizmo={gizmo}
            plantFeet={plantFeet}
            selected={selected}
            onSelect={setSelected}
            menu={menu}
            onMenu={openMenu}
            floating={floating}
            card={(id, full, close) => <NodeCard id={id} full={full} api={cardApi} onMore={() => setMenu(id)} onClose={close} />}
            itemLabel={design.item.text.trim()}
            onBegin={beginLive}
            onPose={setPoseLive}
            onItem={(place) => live((d) => ({ ...d, item: { ...d.item, ...place } }))}
            onPet={(place) => {
              const now = design.pet;
              if (place.spot !== now.spot || place.dx !== now.dx || place.dy !== now.dy) live((d) => ({ ...d, pet: { ...d.pet, ...place } }));
            }}
            onCommit={endLive}
            crop={crop}
            note={design.shot.framing === "full" && design.shot.aspect !== "1:1" ? `The AI gets this centred in a ${design.shot.aspect} picture` : ""}
            viewBox={zoom ? zoomView : null}
            textSpace={design.shot.framing === "posed" && design.shot.background === "scene" ? design.shot.textSpace : "none"}
            label={`Pose stage for ${name}. Drag the dots, or focus one and use the arrow keys. Enter opens a dot's options.`}
          />

          {exists(selected) && !floating && (
            // no room for floating cards on a phone: the selected dot's quick options sit right under the doll
            <div className="mt-3 rounded-xl border border-nebula-edge bg-cosmos/50 p-3" data-creator-card="docked">
              <NodeCard id={selected} full={false} api={cardApi} onMore={() => setMenu(selected)} onClose={() => setSelected(null)} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Segmented
              label="Doll view"
              value={view}
              onChange={setView}
              options={[
                { value: "dressed", label: "Dressed" },
                { value: "mannequin", label: "Pose guide" },
              ]}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Toggle checked={showHandles} onChange={setShowHandles} label="Dots" />
              <Toggle checked={gizmo} onChange={setGizmo} label="Arrows and rings" />
              <Toggle checked={plantFeet} onChange={setPlantFeet} label="Plant feet" />
              <Toggle checked={zoom} onChange={setZoom} label="Zoom in" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-nebula-edge bg-card/60 px-4 py-3 text-sm" aria-live="polite">
          {exists(selected) ? (
            <p className="text-dust">
              <strong className="text-star">{selected === "item" ? `Held item: ${design.item.text.trim()}` : NODES[selected].label}.</strong>{" "}
              {NODES[selected].hint} <strong className="text-star">{floating ? "Right-click it" : "Press and hold it"}</strong> for all its options.
            </p>
          ) : (
            <p className="text-dust">
              <strong className="text-star">Drag the dots</strong> to pose.{" "}
              {floating ? "Hover a dot for its quick options and right-click it" : "Tap a dot for its quick options and press and hold it"} for everything:
              hands, faces, layers. On a selected dot the arrows slide it one way only and the blue ring turns it.
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ steps -- */}
      <div ref={tabsRef} className="min-w-0 scroll-mt-20 rounded-2xl border border-nebula-edge bg-card shadow-[0_8px_40px_-16px_rgb(0_0_0/0.6)]">
        <div
          role="tablist"
          aria-label="Creator steps"
          onKeyDown={onTabKey}
          className="flex gap-1 overflow-x-auto border-b border-nebula-edge p-2"
        >
          {TABS.map((t, i) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                id={`creator-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="creator-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => goTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 font-display text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-yolk text-primary-foreground" : "text-dust hover:bg-nebula-edge/50 hover:text-star",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px]",
                    on ? "bg-primary-foreground/15" : "bg-nebula-edge/70",
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div id="creator-panel" role="tabpanel" aria-labelledby={`creator-tab-${tab}`} className="p-4 sm:p-6">
          {sharedNote && (
            <p className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-glow/40 bg-glow/10 px-3 py-2 text-sm text-star">
              Opened a shared design. Your own last design was replaced.
              <button type="button" className="font-semibold text-glow underline underline-offset-2" onClick={() => setSharedNote(false)}>
                Got it
              </button>
            </p>
          )}

          {tab === "who" && (
            <WhoPanel
              design={design}
              people={people}
              custom={custom}
              onWho={(who: CharacterId) => commit(withCharacter(design, who))}
              onRefs={(r: RefKey[]) => commit({ ...design, refs: r })}
              onCustomFile={(file) => {
                const url = URL.createObjectURL(file);
                setCustom({ url, fileName: file.name, palette: [] });
                // measure the picture's own colours, so the prompt can pin them
                paletteFromImage(url)
                  .then((palette) => setCustom((cur) => (cur && cur.url === url ? { ...cur, palette } : cur)))
                  .catch(() => {});
              }}
              onText={(patch) => tweak((d) => ({ ...d, ...patch }))}
            />
          )}

          {tab === "pose" && (
            <PosePanel
              design={design}
              look={look}
              frame={frame}
              placed={design.shot.framing === "posed"}
              onPreset={applyPreset}
              onFace={(face) => commit({ ...design, face })}
              onPose={(pose) => live((d) => ({ ...d, pose: pose.yaw !== d.pose.yaw ? layersForYaw(pose) : pose }))}
              onPoseCommit={(pose) => commit({ ...design, pose })}
              onSliderStart={beginLive}
              onSliderEnd={endLive}
              onNotes={(poseNotes) => tweak((d) => ({ ...d, poseNotes }))}
            />
          )}

          {tab === "outfit" && (
            <OutfitPanel
              design={design}
              petWords={ch.pet?.words ?? null}
              onSlotPick={(slot: SlotId, p: SlotPick) => commit({ ...design, slots: { ...design.slots, [slot]: p } })}
              onSlotTweak={(slot: SlotId, p: SlotPick) => tweak((d) => ({ ...d, slots: { ...d.slots, [slot]: p } }))}
              onOutfit={(o: OutfitPreset | null) => {
                if (!o) {
                  const slots = { ...design.slots };
                  for (const k of Object.keys(slots) as SlotId[]) slots[k] = { ...slots[k], keep: true };
                  commit({ ...design, slots });
                } else {
                  commit({
                    ...design,
                    slots: { ...design.slots, ...o.slots },
                    item: o.item ? itemIn(o.item, "both", design.item) : design.item,
                  });
                }
              }}
              onItem={(item, undoable) => (undoable ? commit({ ...design, item }) : tweak((d) => ({ ...d, item })))}
              onPet={(pet, undoable) => (undoable ? commit({ ...design, pet }) : tweak((d) => ({ ...d, pet })))}
              onExtra={(extra) => tweak((d) => ({ ...d, extra }))}
            />
          )}

          {tab === "shot" && (
            <ShotPanel
              design={design}
              onPreset={(id: ShotId) => commit(reframed({ ...design, shot: shotFor(id, design.shot) }))}
              onShot={(patch: Partial<Shot>) => commit(reframed({ ...design, shot: { ...design.shot, ...patch } }))}
              onShotText={(patch: Partial<Shot>) => tweak((d) => ({ ...d, shot: { ...d.shot, ...patch } }))}
            />
          )}

          {tab === "send" && (
            <SendPanel
              design={design}
              look={look}
              frame={frame}
              crop={crop}
              name={name}
              prefix={ch.filePrefix}
              refs={refs}
              palette={design.who === "custom" ? (custom?.palette ?? []) : undefined}
              onTarget={(target) => tweak((d) => ({ ...d, target }))}
              onGuide={(guide) => tweak((d) => ({ ...d, guide }))}
              onColors={(colors) => tweak((d) => ({ ...d, colors }))}
              onResult={(blob, fileName) => {
                setIncoming({ blob, name: fileName });
                goTab("finish");
              }}
              onNeedPicture={() => goTab("who")}
            />
          )}

          {tab === "finish" && (
            <FinishPanel
              prefix={design.who === "custom" ? design.customName.trim() || ch.filePrefix : ch.filePrefix}
              tag={fileTag(design)}
              preferRoster={design.shot.background === "white"}
              incoming={incoming}
              onIncomingUsed={() => setIncoming(null)}
            />
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-nebula-edge pt-4 max-lg:pr-24">
            <Button size="sm" variant="ghost" onClick={startOver}>
              Start over
            </Button>
            {nextTab && (
              <Button onClick={() => goTab(nextTab.id)}>
                Next: {nextTab.label} <span aria-hidden="true">→</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* phones: the complete options for a dot slide up from the bottom */}
      {exists(menu) && !floating && (
        <>
          <button
            type="button"
            aria-label="Close options"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            onClick={() => setMenu(null)}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${NODES[menu].label} options`}
            data-creator-card="sheet"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[46vh] overflow-y-auto rounded-t-2xl border-t border-nebula-edge bg-card p-4 pb-8 shadow-[0_-14px_44px_-12px_rgb(0_0_0/0.85)] focus:outline-none"
          >
            <NodeCard id={menu} full api={cardApi} onClose={() => setMenu(null)} />
          </div>
        </>
      )}

      {!stageSeen && tab !== "finish" && !menu && (
        <button
          type="button"
          onClick={() => stageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })}
          className="fixed bottom-4 right-4 z-40 overflow-hidden rounded-2xl border-2 border-yolk bg-[#f8f5ee] shadow-[0_10px_30px_-8px_rgb(0_0_0/0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label="Back to the doll"
        >
          <svg viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} className="block h-24 w-auto max-w-36" aria-hidden="true">
            <Doll pose={design.pose} sk={solve(design.pose, frame)} look={look} mode={view} tint={design.guide.tint} />
          </svg>
        </button>
      )}
    </div>
  );
}
