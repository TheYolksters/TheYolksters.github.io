import { useMemo, useState } from "react";

import { BEAKS, BLUSHES, BROWS, EXPRESSIONS, EXTRAS, EYES, GAZES, HANDS } from "@/config/creator";
import { FaceIcon, HandIcon } from "@/components/creator/Doll";
import { Chip, Segmented } from "@/components/creator/ui";
import { sameFace, type DollLook, type EyeKind, type Face, type FaceExtra } from "@/lib/creator/look";
import type { HandShape, PalmSide } from "@/lib/creator/rig";
import { cn } from "@/lib/utils";

/**
 * Pickers shared by the Pose tab and the options cards on the stage, so a
 * hand or a face is chosen the same way wherever you are.
 */

const tile = (on: boolean) =>
  cn(
    "rounded-lg border bg-[#f8f5ee] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    on ? "border-yolk ring-2 ring-yolk/70" : "border-nebula-edge hover:border-glow",
  );

const caption = "block truncate rounded-b-[0.4rem] bg-nebula px-0.5 py-0.5 text-center text-[10px] font-semibold leading-tight tracking-tight text-star";

/** every hand shape as a little picture */
export function HandPicker({
  value,
  palm,
  color,
  onChange,
  name,
  labels = false,
}: {
  value: HandShape;
  palm: PalmSide;
  /** feather colour, so the pictures match the doll */
  color: string;
  onChange: (shape: HandShape) => void;
  /** what the group is called for screen readers: "Right hand shape" */
  name: string;
  /** show each shape's name under its picture (roomier layouts) */
  labels?: boolean;
}) {
  // with names shown, the number of columns follows the room available (a card, half a panel, a whole panel)
  return (
    <div className="@container">
      <div role="group" aria-label={name} className={cn("grid gap-1", labels ? "grid-cols-3 @[16rem]:grid-cols-4 @[26rem]:grid-cols-6" : "grid-cols-6")}>
        {HANDS.map((h) => {
        const on = h.id === value;
        return (
          <button
            key={h.id}
            type="button"
            aria-pressed={on}
            aria-label={h.label}
            title={h.label}
            onClick={() => onChange(h.id)}
            className={cn(tile(on), "overflow-hidden")}
          >
            <HandIcon shape={h.id} palm={palm} color={color} className={cn("mx-auto block", labels ? "size-11" : "size-8")} />
            {labels && <span className={caption}>{h.label}</span>}
          </button>
        );
        })}
      </div>
    </div>
  );
}

export function PalmPicker({ value, onChange, name }: { value: PalmSide; onChange: (v: PalmSide) => void; name: string }) {
  return (
    <Segmented
      label={name}
      value={value}
      onChange={onChange}
      options={[
        { value: "auto", label: "Natural", title: "Whichever side would naturally show" },
        { value: "front", label: "Palm", title: "The palm faces the viewer" },
        { value: "back", label: "Back", title: "The back of the hand faces the viewer" },
      ]}
    />
  );
}

/** the ready-made faces as little heads */
export function ExpressionPicker({
  face,
  look,
  onPick,
  labels = false,
}: {
  face: Face;
  look: DollLook;
  onPick: (face: Face) => void;
  labels?: boolean;
}) {
  // sixteen small heads: drawn once per character rather than on every drag frame
  const key = `${look.feather}|${look.eye}|${look.lashes}|${look.blush}`;
  const icons = useMemo(
    () => EXPRESSIONS.map((e) => <FaceIcon key={e.id} face={e.face} look={look} className="block h-auto w-full" />),
    [key], // key stands in for `look`, which is a fresh object every render
  );
  return (
    <div className="@container">
      <div role="group" aria-label="Expression" className={cn("grid gap-1", labels ? "grid-cols-4 @[26rem]:grid-cols-6" : "grid-cols-8")}>
        {EXPRESSIONS.map((e, i) => {
        const on = sameFace(e.face, face);
        return (
          <button
            key={e.id}
            type="button"
            aria-pressed={on}
            aria-label={e.label}
            title={e.label}
            onClick={() => onPick(e.face)}
            className={cn(tile(on), "overflow-hidden")}
          >
            {icons[i]}
            {labels && <span className={caption}>{e.label}</span>}
          </button>
        );
        })}
      </div>
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-dust">{title}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

const small = "min-h-7 px-2.5";

/** the face, one piece at a time */
export function FaceTuner({ face, onChange }: { face: Face; onChange: (face: Face) => void }) {
  const [each, setEach] = useState(face.eyeR !== face.eyeL);
  const split = each || face.eyeR !== face.eyeL;
  const eyes = (title: string, value: EyeKind | null, set: (k: EyeKind) => void) => (
    <Row title={title}>
      {EYES.map((e) => (
        <Chip key={e.id} className={small} active={value === e.id} onClick={() => set(e.id)}>
          {e.label}
        </Chip>
      ))}
    </Row>
  );
  const toggle = (x: FaceExtra) =>
    onChange({ ...face, extras: face.extras.includes(x) ? face.extras.filter((e) => e !== x) : [...face.extras, x] });
  return (
    <div className="space-y-3">
      {split ? (
        <>
          {eyes("Right eye (left of the screen)", face.eyeR, (k) => onChange({ ...face, eyeR: k }))}
          {eyes("Left eye (right of the screen)", face.eyeL, (k) => onChange({ ...face, eyeL: k }))}
        </>
      ) : (
        eyes("Eyes", face.eyeR, (k) => onChange({ ...face, eyeR: k, eyeL: k }))
      )}
      <button
        type="button"
        className="text-xs font-semibold text-glow underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          if (split) onChange({ ...face, eyeL: face.eyeR });
          setEach(!split);
        }}
      >
        {split ? "Make both eyes the same" : "Set each eye on its own (for winks)"}
      </button>
      <Row title="Eyebrows">
        {BROWS.map((b) => (
          <Chip key={b.id} className={small} active={face.brows === b.id} onClick={() => onChange({ ...face, brows: b.id })}>
            {b.label}
          </Chip>
        ))}
      </Row>
      <Row title="Beak">
        {BEAKS.map((b) => (
          <Chip key={b.id} className={small} active={face.beak === b.id} onClick={() => onChange({ ...face, beak: b.id })}>
            {b.label}
          </Chip>
        ))}
      </Row>
      <Row title="Looking">
        {GAZES.map((g) => (
          <Chip key={g.id} className={small} active={face.gaze === g.id} onClick={() => onChange({ ...face, gaze: g.id })}>
            {g.label}
          </Chip>
        ))}
      </Row>
      <Row title="Blush">
        {BLUSHES.map((b) => (
          <Chip key={b.id} className={small} active={face.blush === b.id} onClick={() => onChange({ ...face, blush: b.id })}>
            {b.label}
          </Chip>
        ))}
      </Row>
      <Row title="Cartoon marks (any number)">
        {EXTRAS.map((x) => (
          <Chip key={x.id} className={small} active={face.extras.includes(x.id)} onClick={() => toggle(x.id)}>
            {x.label}
          </Chip>
        ))}
      </Row>
    </div>
  );
}
