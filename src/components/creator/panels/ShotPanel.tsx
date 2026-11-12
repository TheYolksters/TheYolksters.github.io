import { ASPECTS, SCENES, SHOTS, type AspectId, type ShotId } from "@/config/creator";
import { Chip, Field, Section, Segmented, inputClass } from "@/components/creator/ui";
import type { Design, Shot } from "@/lib/creator/design";
import { cn } from "@/lib/utils";

interface Props {
  design: Design;
  onPreset: (id: ShotId) => void;
  /** discrete choices: undoable */
  onShot: (patch: Partial<Shot>) => void;
  /** typing: live */
  onShotText: (patch: Partial<Shot>) => void;
}

/** a tiny picture of the frame shape */
function ShapeIcon({ ratio }: { ratio: number }) {
  const w = ratio >= 1 ? 22 : 22 * ratio;
  const h = ratio >= 1 ? 22 / ratio : 22;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect x={12 - w / 2} y={12 - h / 2} width={w} height={h} rx={2.5} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

export function ShotPanel({ design, onPreset, onShot, onShotText }: Props) {
  const shot = design.shot;
  return (
    <div className="space-y-8">
      <Section title="What is it for?">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SHOTS.map((s) => {
            const on = shot.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => onPreset(s.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-yolk bg-yolk/10" : "border-nebula-edge bg-cosmos/40 hover:border-glow/60",
                )}
              >
                <span className={cn("block font-display text-base font-bold", on && "text-yolk")}>{s.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-dust">{s.blurb}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Shape">
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <Chip key={a.id} active={shot.aspect === a.id} onClick={() => onShot({ aspect: a.id as AspectId })} title={a.use}>
              <ShapeIcon ratio={a.ratio} />
              {a.label} <span className="font-normal opacity-70">{a.id}</span>
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Framing">
        <Segmented
          label="Framing"
          value={shot.framing}
          onChange={(framing) => onShot({ framing })}
          options={[
            { value: "full", label: "Whole body, centred" },
            { value: "posed", label: "As placed on the stage" },
            { value: "bust", label: "Close-up" },
          ]}
        />
        <p className="text-xs leading-relaxed text-dust">
          {shot.framing === "full" && "The AI gets the doll neatly centred, wherever it sits on your stage."}
          {shot.framing === "posed" && "The AI gets the stage exactly as you see it. Drag the body and use Size in frame (under Pose) to compose the picture."}
          {shot.framing === "bust" && "The AI gets the head and shoulders only. The dashed box on the stage shows the crop."}
        </p>
      </Section>

      <Section title="Background">
        <Segmented
          label="Background"
          value={shot.background}
          onChange={(background) => onShot({ background })}
          options={[
            { value: "white", label: "White with a shadow" },
            { value: "key", label: "Flat, for cutting out" },
            { value: "scene", label: "A scene" },
          ]}
        />
        {shot.background === "key" && (
          <div className="space-y-2">
            <Segmented
              label="Backdrop colour"
              value={shot.keyColor}
              onChange={(keyColor) => onShot({ keyColor })}
              options={[
                { value: "white", label: "White backdrop" },
                { value: "green", label: "Green backdrop" },
              ]}
            />
            <p className="text-xs leading-relaxed text-dust">
              Bring the result back to <strong className="text-star">Finish</strong> to make the backdrop transparent. White suits most
              outfits. Pick green when the outfit itself is mostly white, like the spacesuit. ChatGPT can draw a transparent background
              directly, so its prompt asks for that instead.
            </p>
          </div>
        )}
        {shot.background === "scene" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SCENES.map((s) => (
                <Chip key={s.id} active={shot.scene === s.words} onClick={() => onShot({ scene: s.words })}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <textarea
              className={cn(inputClass, "min-h-20")}
              value={shot.scene}
              maxLength={400}
              aria-label="Describe the scene"
              placeholder="Describe the place: e.g. a neon arcade at night"
              onChange={(e) => onShotText({ scene: e.target.value })}
            />
            <Field label="Leave room for a title?" group>
              <Segmented
                label="Room for a title"
                value={shot.textSpace}
                onChange={(textSpace) => onShot({ textSpace })}
                options={[
                  { value: "none", label: "No" },
                  { value: "left", label: "On the left" },
                  { value: "right", label: "On the right" },
                ]}
              />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Anything else about the picture?">
        <textarea
          className={cn(inputClass, "min-h-16")}
          value={shot.notes}
          maxLength={400}
          aria-label="Extra notes about the picture"
          placeholder="e.g. dramatic low camera angle, golden-hour lighting"
          onChange={(e) => onShotText({ notes: e.target.value })}
        />
      </Section>
    </div>
  );
}
