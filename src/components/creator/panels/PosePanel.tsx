import { useMemo } from "react";

import { POSES, faceOf, type PosePreset } from "@/config/creator";
import { DollThumb } from "@/components/creator/Doll";
import { ExpressionPicker, FaceTuner, HandPicker, PalmPicker } from "@/components/creator/pickers";
import { Chip, Field, Range, Section, inputClass } from "@/components/creator/ui";
import { Button } from "@/components/ui/button";
import type { Design } from "@/lib/creator/design";
import type { DollLook, Face } from "@/lib/creator/look";
import { faceLabel } from "@/lib/creator/prompt";
import { WRIST_MAX, flipBend, flipFoot, samePose, type ArmLayer, type Frame, type LegLayer, type Pose } from "@/lib/creator/rig";
import { cn } from "@/lib/utils";

interface Props {
  design: Design;
  look: DollLook;
  /** the stage the doll stands on (flipping a knee needs to know where the foot is) */
  frame: Frame;
  /** which shot framing is active: placement sliders only matter for "posed" */
  placed: boolean;
  onPreset: (p: PosePreset) => void;
  onFace: (face: Face) => void;
  /** live change while a slider moves */
  onPose: (p: Pose) => void;
  /** one-shot change (a select, a button) that should be undoable */
  onPoseCommit: (p: Pose) => void;
  onSliderStart: () => void;
  onSliderEnd: () => void;
  onNotes: (text: string) => void;
}

const ARM_LAYERS: { value: ArmLayer; label: string }[] = [
  { value: "back", label: "Behind the body" },
  { value: "mid", label: "In front of the body" },
  { value: "front", label: "In front of the head" },
];
const LEG_LAYERS: { value: LegLayer; label: string }[] = [
  { value: "back", label: "Behind the body" },
  { value: "front", label: "In front of the body" },
];

/** this tab is long: these jump straight to each part of it */
const JUMPS = [
  { id: "pose-presets", label: "Poses" },
  { id: "pose-face", label: "Face" },
  { id: "pose-hands", label: "Hands" },
  { id: "pose-legs", label: "Legs" },
  { id: "pose-body", label: "Whole body" },
  { id: "pose-notes", label: "Notes" },
];

const selectClass = cn(inputClass, "h-9 py-1 pr-8");

export function PosePanel({
  design,
  look,
  frame,
  placed,
  onPreset,
  onFace,
  onPose,
  onPoseCommit,
  onSliderStart,
  onSliderEnd,
  onNotes,
}: Props) {
  const pose = design.pose;
  // The 18 little dolls are the costly part of this panel, and this panel
  // re-renders on every frame of a drag. They only depend on what the doll
  // is wearing, so they are drawn once per outfit and reused. (The held
  // item is left out: it moves with every drag and adds nothing at this size.)
  const thumbLook: DollLook = { ...look, item: null };
  const lookKey = JSON.stringify(thumbLook);
  const thumbs = useMemo(
    () =>
      POSES.map((p) => (
        <DollThumb
          key={p.id}
          pose={p.pose}
          look={{ ...thumbLook, face: p.expression ? faceOf(p.expression) : thumbLook.face }}
          className="aspect-square w-full"
        />
      )),
    [lookKey], // lookKey stands in for `thumbLook`, which is a fresh object every render
  );
  const slide = (next: Pose) => {
    onSliderStart();
    onPose(next);
  };
  const jump = (id: string) => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  };

  const hand = (key: "armR" | "armL", title: string) => {
    const arm = pose[key];
    return (
      <div className="space-y-3 rounded-xl border border-nebula-edge bg-cosmos/40 p-3">
        <p className="font-display text-sm font-bold">{title}</p>
        <HandPicker
          name={`${title} shape`}
          value={arm.hand}
          palm={arm.palm}
          color={look.feather}
          labels
          onChange={(shape) => onPoseCommit({ ...pose, [key]: { ...arm, hand: shape } })}
        />
        <Field label="Showing" group>
          <PalmPicker name={`${title}: which side shows`} value={arm.palm} onChange={(palm) => onPoseCommit({ ...pose, [key]: { ...arm, palm } })} />
        </Field>
        <Range
          label="Wrist bend"
          value={arm.wrist}
          min={-WRIST_MAX}
          max={WRIST_MAX}
          step={5}
          onChange={(v) => slide({ ...pose, [key]: { ...arm, wrist: v } })}
          onCommit={onSliderEnd}
          format={(v) => (v === 0 ? "straight" : `${v > 0 ? "+" : ""}${v}°`)}
        />
        <Field label="Arm layer">
          <select
            className={selectClass}
            value={arm.layer}
            onChange={(e) => onPoseCommit({ ...pose, [key]: { ...arm, layer: e.target.value as ArmLayer } })}
          >
            {ARM_LAYERS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  };

  const leg = (key: "legR" | "legL", title: string) => {
    const l = pose[key];
    const straight = Math.abs(l.knee) < 4;
    return (
      <div role="group" aria-label={title} className="space-y-3 rounded-xl border border-nebula-edge bg-cosmos/40 p-3">
        <p className="font-display text-sm font-bold">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={straight}
            title={straight ? "The leg is straight: bend the knee first" : "Bend the knee the other way; the foot stays where it is"}
            onClick={() => onPoseCommit(flipBend(pose, frame, key))}
          >
            Flip the knee
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={l.flip}
            title="Turn the foot to point the other way"
            className={l.flip ? "border-yolk text-yolk" : undefined}
            onClick={() => onPoseCommit(flipFoot(pose, key))}
          >
            Flip the foot
          </Button>
        </div>
        <Range
          label="Foot tilt"
          value={l.foot}
          min={-80}
          max={80}
          step={5}
          onChange={(v) => slide({ ...pose, [key]: { ...l, foot: v } })}
          onCommit={onSliderEnd}
          format={(v) => (v === 0 ? "flat" : v > 0 ? `toes up ${v}°` : `toes down ${-v}°`)}
        />
        <Field label="Leg layer">
          <select
            className={selectClass}
            value={l.layer}
            onChange={(e) => onPoseCommit({ ...pose, [key]: { ...l, layer: e.target.value as LegLayer } })}
          >
            {LEG_LAYERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <nav aria-label="Jump to a part of this step" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-dust">Jump to</span>
        {JUMPS.map((j) => (
          <Chip key={j.id} onClick={() => jump(j.id)}>
            {j.label}
          </Chip>
        ))}
      </nav>

      <Section id="pose-presets" title="Start from a pose" hint="Pick one, then drag the dots on the doll to make it yours.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {POSES.map((p, i) => {
            const on = samePose(p.pose, pose);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => onPreset(p)}
                className={cn(
                  "flex flex-col items-center rounded-xl border bg-[#f8f5ee] p-1 pb-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-yolk ring-2 ring-yolk/60" : "border-nebula-edge hover:-translate-y-0.5 hover:border-glow",
                )}
              >
                {thumbs[i]}
                <span className="-mx-1 mt-1 block w-[calc(100%+0.5rem)] truncate rounded-b-[0.65rem] bg-nebula px-1 py-1 text-center text-[11px] font-semibold text-star">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        id="pose-face"
        title={`Face · ${faceLabel(design.face)}`}
        hint="Pick a face, then change any piece of it. Right-clicking the face on the doll opens the same choices."
      >
        <ExpressionPicker face={design.face} look={look} labels onPick={onFace} />
        <details className="group rounded-xl border border-nebula-edge bg-cosmos/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="font-display text-sm font-bold">Change one piece at a time</span>
            <span className="text-xs text-dust">
              eyes, eyebrows, beak, blush, marks{" "}
              <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
                ›
              </span>
            </span>
          </summary>
          <div className="border-t border-nebula-edge p-3">
            <FaceTuner face={design.face} onChange={onFace} />
          </div>
        </details>
      </Section>

      <Section
        id="pose-hands"
        title="Hands"
        hint="Right and left are the character's own: facing you, its right hand is on the left of the screen. The blue ring on a selected hand bends the wrist."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {hand("armR", "Right hand")}
          {hand("armL", "Left hand")}
        </div>
      </Section>

      <Section
        id="pose-legs"
        title="Legs"
        hint="Flip a knee or a foot when it points the wrong way. The blue ring on a selected foot tips it."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {leg("legR", "Right leg")}
          {leg("legL", "Left leg")}
        </div>
      </Section>

      <Section id="pose-body" title="Whole body">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Range
            label="Turn"
            value={pose.yaw}
            min={-80}
            max={80}
            step={5}
            onChange={(v) => slide({ ...pose, yaw: v })}
            onCommit={onSliderEnd}
            format={(v) => (Math.abs(v) < 3 ? "facing you" : `${Math.abs(v)}° to the ${v > 0 ? "right" : "left"}`)}
          />
          <Range
            label="Tilt"
            value={pose.rot}
            min={-180}
            max={180}
            step={5}
            onChange={(v) => slide({ ...pose, rot: v })}
            onCommit={onSliderEnd}
            format={(v) => (v === 0 ? "upright" : `${v > 0 ? "+" : ""}${v}°`)}
          />
          <Range
            label="Off the ground"
            value={pose.lift}
            min={0}
            max={300}
            step={10}
            onChange={(v) => slide({ ...pose, lift: v })}
            onCommit={onSliderEnd}
            format={(v) => (v === 0 ? "standing" : `${v}`)}
          />
          <Range
            label="Size in frame"
            value={pose.scale}
            min={0.4}
            max={1.6}
            step={0.05}
            onChange={(v) => slide({ ...pose, scale: v })}
            onCommit={onSliderEnd}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
        {!placed && (
          <p className="text-xs leading-relaxed text-dust">
            This shot centres the character for you, so size and position on the stage don't change the result. Pick{" "}
            <strong className="text-star">As placed on the stage</strong> under Shot to control them.
          </p>
        )}
      </Section>

      <Section id="pose-notes" title="Anything the doll can't show?">
        <textarea
          className={cn(inputClass, "min-h-20")}
          value={design.poseNotes}
          maxLength={400}
          placeholder="e.g. mid-leap with the scarf trailing behind, hoodie strings flying"
          onChange={(e) => onNotes(e.target.value)}
          aria-label="Extra pose notes for the AI"
        />
      </Section>
    </div>
  );
}
