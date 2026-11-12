import { useEffect, useRef, useState, type ReactNode } from "react";

import { CHARACTERS } from "@/config/creator";
import { CARD_OF, LIMB_OF, NODES, type NodeId } from "@/components/creator/nodes";
import { ExpressionPicker, FaceTuner, HandPicker, PalmPicker } from "@/components/creator/pickers";
import { Chip, Range, Segmented, inputClass } from "@/components/creator/ui";
import { Button } from "@/components/ui/button";
import { ITEM_SIZES, hasPet, itemIn, mirrorDesign, moveItem, petAtSpot, type Design } from "@/lib/creator/design";
import type { DollLook, PetSpot } from "@/lib/creator/look";
import { faceLabel } from "@/lib/creator/prompt";
import {
  PET_SPOTS,
  WRIST_MAX,
  defaultItemOffset,
  flipBend,
  flipFoot,
  layersForYaw,
  type ArmLayer,
  type Frame,
  type ItemPlace,
  type LegLayer,
  type Pose,
} from "@/lib/creator/rig";
import { cn } from "@/lib/utils";

/**
 * The options for one thing on the stage: a hand, the face, the held item…
 *
 * Shown small beside a dot when you hover or select it, and in full when you
 * right-click it (or press and hold on a touch screen). Everything here can
 * also be reached from the tabs; this just saves the trip.
 */

export interface CardApi {
  design: Design;
  look: DollLook;
  frame: Frame;
  /** a one-shot change: one undo step */
  commit: (next: Design) => void;
  /** typing: applied at once, no undo step per key */
  tweak: (change: (d: Design) => Design) => void;
  /** a slider is being dragged: begin, many live changes, end */
  begin: () => void;
  live: (change: (d: Design) => Design) => void;
  end: () => void;
}

interface Props {
  id: NodeId;
  /** the complete card (right-click) rather than the quick one (hover) */
  full: boolean;
  api: CardApi;
  /** open the complete card */
  onMore?: () => void;
  onClose?: () => void;
}

const ARM_LAYERS: { value: ArmLayer; label: string }[] = [
  { value: "back", label: "Behind body" },
  { value: "mid", label: "In front" },
  { value: "front", label: "Over the head" },
];
const LEG_LAYERS: { value: LegLayer; label: string }[] = [
  { value: "back", label: "Behind body" },
  { value: "front", label: "In front" },
];
const HELD_IN: { value: ItemPlace["hand"]; label: string }[] = [
  { value: "R", label: "Right hand" },
  { value: "L", label: "Left hand" },
  { value: "both", label: "Both" },
  { value: "free", label: "Not held" },
];
export const SPOT_LABEL: Record<PetSpot, string> = {
  shoulderL: "Left shoulder",
  shoulderR: "Right shoulder",
  head: "On the head",
  arms: "In the arms",
  ground: "On the ground",
};

const cap = "block text-[11px] font-semibold uppercase tracking-wider text-dust";
/** a toggle button that is currently on (a flipped foot) */
const flipped = "border-yolk text-yolk";
const field = cn(inputClass, "h-8 py-1");
const iconButton =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-base leading-none text-dust transition-colors hover:bg-nebula-edge/60 hover:text-star focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Labelled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className={cap}>{title}</span>
      {children}
    </div>
  );
}

/**
 * A text box for something that disappears from the stage when its name is
 * empty (the held item, a described companion). Emptying the box must not
 * make the thing vanish mid-edit, so an empty box simply isn't applied.
 */
function NameBox({
  value,
  onText,
  label,
  placeholder,
}: {
  value: string;
  onText: (text: string) => void;
  label: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const emptied = editing.current && draft.trim() === "";
  // follow outside changes (undo, the Outfit tab), except while this box sits empty mid-edit
  useEffect(() => {
    if (!emptied) setDraft(value);
  }, [value]); // `emptied` is read as it was when the value changed, on purpose
  return (
    <input
      className={field}
      value={draft}
      maxLength={160}
      aria-label={label}
      placeholder={placeholder}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onText(e.target.value);
      }}
      onBlur={() => {
        editing.current = false;
        setDraft(value);
      }}
    />
  );
}

export function NodeCard({ id, full, api, onMore, onClose }: Props) {
  const d = api.design;
  const pose = d.pose;
  const ch = CHARACTERS[d.who];
  const kind = CARD_OF[id];
  const limb = LIMB_OF[id];
  const petNoun = ch.pet?.words.split(" ").pop() ?? "pet";

  const setPose = (next: Pose) => api.commit({ ...d, pose: next });
  /** a slider moved: the first move opens the undo step, letting go closes it */
  const slide = (change: (cur: Design) => Design) => {
    api.begin();
    api.live(change);
  };
  const slidePose = (next: Pose) => slide((cur) => ({ ...cur, pose: next }));

  let title = NODES[id].label;
  let body: ReactNode = null;
  /** does the complete card hold more than the quick one? */
  let more = true;

  if (kind === "hand" && (limb === "armL" || limb === "armR")) {
    const arm = pose[limb];
    const side = limb === "armL" ? "L" : "R";
    const name = side === "L" ? "Left hand" : "Right hand";
    const mine = d.item.text.trim() !== "" && (d.item.hand === side || d.item.hand === "both");
    body = (
      <>
        <HandPicker
          name={`${name} shape`}
          value={arm.hand}
          palm={arm.palm}
          color={api.look.feather}
          labels={full}
          onChange={(hand) => setPose({ ...pose, [limb]: { ...arm, hand } })}
        />
        {!full && mine && (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-dust">
              Holding <strong className="text-star">{d.item.text.trim()}</strong>
            </p>
            <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, item: { ...d.item, text: "" } })}>
              Remove
            </Button>
          </div>
        )}
        {full && (
          <>
            <Labelled title="Showing">
              <PalmPicker name={`${name}: which side shows`} value={arm.palm} onChange={(palm) => setPose({ ...pose, [limb]: { ...arm, palm } })} />
            </Labelled>
            <Range
              label="Wrist bend"
              value={arm.wrist}
              min={-WRIST_MAX}
              max={WRIST_MAX}
              step={5}
              onChange={(v) => slidePose({ ...pose, [limb]: { ...arm, wrist: v } })}
              onCommit={api.end}
              format={(v) => (v === 0 ? "straight" : `${v > 0 ? "+" : ""}${v}°`)}
            />
            <Labelled title="Arm layer">
              <Segmented
                label={`${name}: arm layer`}
                value={arm.layer}
                options={ARM_LAYERS}
                onChange={(layer) => setPose({ ...pose, [limb]: { ...arm, layer } })}
              />
            </Labelled>
            <Labelled title="Holding">
              <div className="flex gap-1.5">
                <input
                  className={field}
                  value={mine ? d.item.text : ""}
                  maxLength={160}
                  aria-label={`${name} is holding`}
                  placeholder="nothing (type to add something)"
                  onChange={(e) =>
                    api.tweak((cur) => ({
                      ...cur,
                      item: mine ? { ...cur.item, text: e.target.value } : itemIn(e.target.value, side, cur.item),
                    }))
                  }
                />
                {mine && (
                  <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, item: { ...d.item, text: "" } })}>
                    Remove
                  </Button>
                )}
              </div>
            </Labelled>
            <Button
              size="sm"
              variant="outline"
              disabled={Math.abs(arm.elbow) < 4}
              title={Math.abs(arm.elbow) < 4 ? "The arm is straight: bend the elbow first" : "Bend the elbow the other way; the hand stays where it is"}
              onClick={() => setPose(flipBend(pose, api.frame, limb))}
            >
              Flip the elbow
            </Button>
          </>
        )}
      </>
    );
  } else if (kind === "elbow" && (limb === "armL" || limb === "armR")) {
    const arm = pose[limb];
    more = true;
    body = (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={Math.abs(arm.elbow) < 4}
          title={Math.abs(arm.elbow) < 4 ? "The arm is straight: bend the elbow first" : "Bend the elbow the other way; the hand stays where it is"}
          onClick={() => setPose(flipBend(pose, api.frame, limb))}
        >
          Flip the elbow
        </Button>
        {full && (
          <Labelled title="Arm layer">
            <Segmented
              label={`${title}: arm layer`}
              value={arm.layer}
              options={ARM_LAYERS}
              onChange={(layer) => setPose({ ...pose, [limb]: { ...arm, layer } })}
            />
          </Labelled>
        )}
      </>
    );
  } else if ((kind === "foot" || kind === "knee") && (limb === "legL" || limb === "legR")) {
    const leg = pose[limb];
    more = kind === "foot";
    body = (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={Math.abs(leg.knee) < 4}
            title={Math.abs(leg.knee) < 4 ? "The leg is straight: bend the knee first" : "Bend the knee the other way; the foot stays where it is"}
            onClick={() => setPose(flipBend(pose, api.frame, limb))}
          >
            Flip the knee
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={leg.flip}
            title="Turn the foot to point the other way"
            className={leg.flip ? flipped : undefined}
            onClick={() => setPose(flipFoot(pose, limb))}
          >
            Flip the foot
          </Button>
        </div>
        <Labelled title="Leg layer">
          <Segmented
            label={`${title}: leg layer`}
            value={leg.layer}
            options={LEG_LAYERS}
            onChange={(layer) => setPose({ ...pose, [limb]: { ...leg, layer } })}
          />
        </Labelled>
        {full && kind === "foot" && (
          <Range
            label="Foot tilt"
            value={leg.foot}
            min={-80}
            max={80}
            step={5}
            onChange={(v) => slidePose({ ...pose, [limb]: { ...leg, foot: v } })}
            onCommit={api.end}
            format={(v) => (v === 0 ? "flat" : v > 0 ? `toes up ${v}°` : `toes down ${-v}°`)}
          />
        )}
      </>
    );
  } else if (kind === "face") {
    title = `Face · ${faceLabel(d.face)}`;
    body = (
      <>
        <ExpressionPicker face={d.face} look={api.look} labels={full} onPick={(face) => api.commit({ ...d, face })} />
        {full && (
          <>
            <FaceTuner face={d.face} onChange={(face) => api.commit({ ...d, face })} />
            <Range
              label="Head tilt"
              value={pose.head}
              min={-50}
              max={50}
              step={1}
              onChange={(v) => slidePose({ ...pose, head: v })}
              onCommit={api.end}
              format={(v) => (v === 0 ? "level" : `${v > 0 ? "+" : ""}${v}°`)}
            />
          </>
        )}
      </>
    );
  } else if (kind === "body") {
    title = "Whole body";
    body = (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => api.commit(mirrorDesign(d))}>
            Mirror
          </Button>
          <Button size="sm" variant="outline" disabled={pose.rot === 0 && pose.torso === 0} onClick={() => setPose({ ...pose, rot: 0, torso: 0 })}>
            Stand upright
          </Button>
        </div>
        {full && (
          <>
            <Range
              label="Turn"
              value={pose.yaw}
              min={-80}
              max={80}
              step={5}
              onChange={(v) => slidePose(layersForYaw({ ...pose, yaw: v }))}
              onCommit={api.end}
              format={(v) => (Math.abs(v) < 3 ? "facing you" : `${Math.abs(v)}° to the ${v > 0 ? "right" : "left"}`)}
            />
            <Range
              label="Tilt"
              value={pose.rot}
              min={-180}
              max={180}
              step={5}
              onChange={(v) => slidePose({ ...pose, rot: v })}
              onCommit={api.end}
              format={(v) => (v === 0 ? "upright" : `${v > 0 ? "+" : ""}${v}°`)}
            />
            <Range
              label="Lean at the waist"
              value={pose.torso}
              min={-70}
              max={70}
              step={1}
              onChange={(v) => slidePose({ ...pose, torso: v })}
              onCommit={api.end}
              format={(v) => (v === 0 ? "straight" : `${v > 0 ? "+" : ""}${v}°`)}
            />
            <Range
              label="Size in frame"
              value={pose.scale}
              min={0.4}
              max={1.6}
              step={0.05}
              onChange={(v) => slidePose({ ...pose, scale: v })}
              onCommit={api.end}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Range
              label="Off the ground"
              value={pose.lift}
              min={0}
              max={300}
              step={10}
              onChange={(v) => slidePose({ ...pose, lift: v })}
              onCommit={api.end}
              format={(v) => (v === 0 ? "standing" : `${v}`)}
            />
            <Labelled title="Companion">
              {hasPet(d) ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-dust">{d.pet.mode === "keep" ? ch.pet?.words : d.pet.text.trim()}</p>
                  <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, pet: { ...d.pet, mode: "none" } })}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ch.pet && (
                    <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, pet: { ...d.pet, mode: "keep" } })}>
                      Bring back the {petNoun}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => api.commit({ ...d, pet: { ...d.pet, mode: "custom", text: d.pet.text.trim() || "a small animal friend" } })}
                  >
                    Add {ch.pet ? "a different one" : "one"}
                  </Button>
                </div>
              )}
            </Labelled>
            <Labelled title="Holding">
              <input
                className={field}
                value={d.item.text}
                maxLength={160}
                aria-label="What they are holding"
                placeholder="nothing (type to add something)"
                onChange={(e) =>
                  api.tweak((cur) => ({
                    ...cur,
                    item: cur.item.text.trim() ? { ...cur.item, text: e.target.value } : itemIn(e.target.value, "R", cur.item),
                  }))
                }
              />
            </Labelled>
          </>
        )}
      </>
    );
  } else if (kind === "item") {
    const name = d.item.text.trim();
    title = !name ? "Held item" : d.item.hand === "free" ? `Prop: ${name}` : `Holding: ${name}`;
    body = (
      <>
        <div className="flex gap-1.5">
          <NameBox
            label="What is being held"
            placeholder="e.g. a game controller"
            value={d.item.text}
            onText={(text) => api.tweak((cur) => ({ ...cur, item: { ...cur.item, text } }))}
          />
          <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, item: { ...d.item, text: "" } })}>
            Remove
          </Button>
        </div>
        <Labelled title="Held in">
          <Segmented label="Where the item is held" value={d.item.hand} options={HELD_IN} onChange={(hand) => api.commit({ ...d, item: moveItem(d, hand) })} />
        </Labelled>
        {full && (
          <>
            <Range
              label="Size"
              value={d.item.size}
              min={ITEM_SIZES.min}
              max={ITEM_SIZES.max}
              step={0.05}
              onChange={(v) => slide((cur) => ({ ...cur, item: { ...cur.item, size: v } }))}
              onCommit={api.end}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Range
              label="Turn"
              value={d.item.rot}
              min={-180}
              max={180}
              step={5}
              onChange={(v) => slide((cur) => ({ ...cur, item: { ...cur.item, rot: v } }))}
              onCommit={api.end}
              format={(v) => (v === 0 ? "straight" : `${v > 0 ? "+" : ""}${v}°`)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => api.commit({ ...d, item: { ...d.item, ...defaultItemOffset(d.item.hand), rot: 0 } })}
            >
              Back to its usual spot
            </Button>
            <p className="text-xs leading-relaxed text-dust">
              The box is only a stand-in. It tells the AI where the {name || "item"} goes and how big it is; the AI draws the real thing.
            </p>
          </>
        )}
      </>
    );
  } else if (kind === "pet") {
    const custom = d.pet.mode === "custom";
    title = custom ? "Companion" : `The ${petNoun}`;
    more = !!ch.pet || custom;
    const free = d.pet.spot === "free";
    const nudged = !free && (d.pet.dx !== 0 || d.pet.dy !== 0);
    body = (
      <>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Where the companion sits">
          {PET_SPOTS.map((s) => (
            <Chip
              key={s}
              className="min-h-7 px-2.5"
              active={d.pet.spot === s}
              title={d.pet.spot === s && nudged ? "Put it back squarely in this spot" : undefined}
              onClick={() => api.commit({ ...d, pet: petAtSpot(d.pet, s) })}
            >
              {SPOT_LABEL[s]}
            </Chip>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-dust" data-pet-where={d.pet.spot}>
          {free
            ? "Placed freely: it stays where you drop it and moves with the whole body. Pick a place above to snap it there."
            : nudged
              ? "Nudged from its usual spot, and still attached there. Pick the place again to snap it back."
              : "Drag it anywhere on the stage, or pick a place."}
        </p>
        <Labelled title="Drawn">
          <Segmented
            label="Companion in front of or behind the character"
            value={d.pet.behind ? "behind" : "front"}
            options={[
              { value: "front", label: "In front of them" },
              { value: "behind", label: "Behind them" },
            ]}
            onChange={(v) => api.commit({ ...d, pet: { ...d.pet, behind: v === "behind" } })}
          />
        </Labelled>
        <Button size="sm" variant="outline" onClick={() => api.commit({ ...d, pet: { ...d.pet, mode: "none" } })}>
          Remove the {custom ? "companion" : petNoun}
        </Button>
        {full && ch.pet && (
          <Labelled title="Which companion">
            <Segmented
              label="Which companion"
              value={custom ? "custom" : "keep"}
              options={[
                { value: "keep", label: `Their ${petNoun}` },
                { value: "custom", label: "A different one" },
              ]}
              onChange={(mode) =>
                api.commit({ ...d, pet: { ...d.pet, mode, text: mode === "custom" ? d.pet.text.trim() || "a small animal friend" : d.pet.text } })
              }
            />
          </Labelled>
        )}
        {full && custom && (
          <Labelled title="Describe it">
            <NameBox
              label="Describe the companion"
              placeholder="e.g. a tiny orange fox with a bandana"
              value={d.pet.text}
              onText={(text) => api.tweak((cur) => ({ ...cur, pet: { ...cur.pet, text } }))}
            />
          </Labelled>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-display text-sm font-bold text-star">{title}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          {!full && more && onMore && (
            <button type="button" className={iconButton} onClick={onMore} aria-label={`More options for ${NODES[id].label.toLowerCase()}`} title="More options (or right-click the dot)">
              <span aria-hidden="true">⋯</span>
            </button>
          )}
          {onClose && (
            <button type="button" className={iconButton} onClick={onClose} aria-label="Close options" title="Close">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>
      {full && <p className="text-xs leading-relaxed text-dust">{NODES[id].hint}</p>}
      {body}
    </div>
  );
}
