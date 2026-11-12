import {
  OUTFITS,
  SLOTS,
  SWATCHES,
  WARDROBE,
  findItem,
  newPick,
  type OutfitPreset,
  type SlotId,
  type SlotPick,
} from "@/config/creator";
import { Chip, ColorField, Field, Section, Segmented, inputClass } from "@/components/creator/ui";
import { effectiveSlot, itemIn, moveItem, outfitChanged, petAtSpot, type Design } from "@/lib/creator/design";
import { colorName, type PetSpot } from "@/lib/creator/look";
import { cn } from "@/lib/utils";

interface Props {
  design: Design;
  /** the character's own pet, if the art has one: "small grey koala" */
  petWords: string | null;
  /** choosing a different item: undoable */
  onSlotPick: (slot: SlotId, pick: SlotPick) => void;
  /** colour and text tweaks: live, no undo step each */
  onSlotTweak: (slot: SlotId, pick: SlotPick) => void;
  onOutfit: (preset: OutfitPreset | null) => void;
  /** typing is live; picking a hand or an idea is one undo step */
  onItem: (item: Design["item"], undoable: boolean) => void;
  onPet: (pet: Design["pet"], undoable: boolean) => void;
  onExtra: (text: string) => void;
}

const KEEP = "__keep";
const ITEM_IDEAS = ["a game controller", "a microphone", "a golden trophy", "a phone", "a team flag", "a slice of pizza", "a mug of hot chocolate"];
const SPOTS: { value: PetSpot; label: string }[] = [
  { value: "shoulderL", label: "On the left shoulder" },
  { value: "shoulderR", label: "On the right shoulder" },
  { value: "head", label: "On top of the head" },
  { value: "arms", label: "Held in the arms" },
  { value: "ground", label: "On the ground beside them" },
];

const selectClass = cn(inputClass, "h-9 py-1 pr-8");

export function OutfitPanel({ design, petWords, onSlotPick, onSlotTweak, onOutfit, onItem, onPet, onExtra }: Props) {
  const changed = outfitChanged(design);
  /** is the design currently wearing exactly this preset? */
  const wearing = (o: OutfitPreset) =>
    (Object.keys(o.slots) as SlotId[]).every((k) => {
      const want = o.slots[k];
      const have = design.slots[k];
      return !!want && !have.keep && have.id === want.id && have.color === want.color && have.accent === want.accent && have.detail === want.detail;
    });

  const slotRow = (slot: SlotId, label: string, hint: string) => {
    const pick = design.slots[slot];
    const shown = effectiveSlot(design, slot);
    const item = findItem(slot, shown.id);
    const hasColour = !pick.keep && pick.id !== "none";
    return (
      <div key={slot} className={cn("space-y-3 rounded-xl border p-3", pick.keep ? "border-nebula-edge bg-cosmos/30" : "border-glow/50 bg-cosmos/60")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor={`slot-${slot}`} className="w-20 shrink-0 font-display text-sm font-bold">
            {label}
          </label>
          <select
            id={`slot-${slot}`}
            className={cn(selectClass, "min-w-0 flex-1")}
            value={pick.keep ? KEEP : pick.id}
            onChange={(e) => {
              const v = e.target.value;
              if (v === KEEP) onSlotPick(slot, { ...pick, keep: true });
              else onSlotPick(slot, newPick(slot, v));
            }}
          >
            <option value={KEEP}>As in the art</option>
            {WARDROBE[slot].map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
          {pick.keep && <span className="hidden w-32 shrink-0 truncate text-xs text-dust sm:block">{hint}</span>}
        </div>
        {hasColour && (
          <div className="space-y-3">
            <ColorField
              label={`Colour · ${colorName(pick.color)}`}
              value={pick.color}
              swatches={SWATCHES}
              onChange={(c) => onSlotTweak(slot, { ...pick, color: c })}
            />
            {item.accent && (
              <ColorField
                label={`${item.accentLabel ?? "Second colour"} · ${colorName(pick.accent)}`}
                value={pick.accent}
                swatches={SWATCHES}
                onChange={(c) => onSlotTweak(slot, { ...pick, accent: c })}
              />
            )}
          </div>
        )}
        {!pick.keep && pick.id !== "none" && (
          <input
            className={inputClass}
            value={pick.detail}
            maxLength={200}
            aria-label={`${label} details`}
            placeholder={
              pick.id === "other"
                ? "Describe it: e.g. wizard robe covered in stars"
                : "Add a detail (optional): e.g. with a yolk logo on the chest"
            }
            onChange={(e) => onSlotTweak(slot, { ...pick, detail: e.target.value })}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Section
        title="Quick outfits"
        hint="The doll shows the colours as a rough sketch. The AI draws the real thing from the words."
      >
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!changed} onClick={() => onOutfit(null)}>
            As in the art
          </Chip>
          {OUTFITS.map((o) => (
            <Chip key={o.id} active={wearing(o)} onClick={() => onOutfit(o)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Piece by piece" hint="Leave a piece “As in the art” and the AI keeps what the reference picture shows.">
        <div className="space-y-2.5">{SLOTS.map((s) => slotRow(s.id, s.label, s.hint))}</div>
      </Section>

      <Section
        title="Holding something?"
        hint="A dashed box on the doll marks where it goes. Drag the box to move it, or right-click it for size and more."
      >
        <input
          className={inputClass}
          value={design.item.text}
          maxLength={160}
          aria-label="Held item"
          placeholder="e.g. a game controller"
          onChange={(e) => onItem({ ...design.item, text: e.target.value }, false)}
        />
        <div className="flex flex-wrap gap-1.5">
          {ITEM_IDEAS.map((t) => (
            <Chip
              key={t}
              active={design.item.text === t}
              onClick={() =>
                onItem(design.item.text === t ? { ...design.item, text: "" } : design.item.text.trim() ? { ...design.item, text: t } : itemIn(t, design.item.hand, design.item), true)
              }
            >
              {t.replace(/^an? /, "")}
            </Chip>
          ))}
        </div>
        {design.item.text.trim() && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Where the item is held"
              value={design.item.hand}
              onChange={(hand) => onItem(moveItem(design, hand), true)}
              options={[
                { value: "R", label: "Right hand" },
                { value: "L", label: "Left hand" },
                { value: "both", label: "Both hands" },
                { value: "free", label: "Not held" },
              ]}
            />
            <Chip onClick={() => onItem({ ...design.item, text: "" }, true)}>Remove it</Chip>
          </div>
        )}
      </Section>

      <Section title="Companion" hint="On the doll you can drag the companion anywhere, or right-click it to remove it or put it behind the character.">
        <Segmented
          label="Companion"
          value={design.pet.mode}
          onChange={(mode) => onPet({ ...design.pet, mode }, true)}
          options={[
            { value: "keep", label: petWords ? `Keep the ${petWords.split(" ").pop()}` : "Keep", disabled: !petWords, title: petWords ? undefined : "This character has no pet in the art" },
            { value: "none", label: "No pet" },
            { value: "custom", label: "A different one…" },
          ]}
        />
        {design.pet.mode === "custom" && (
          <input
            className={inputClass}
            value={design.pet.text}
            maxLength={160}
            aria-label="Describe the companion"
            placeholder="e.g. a tiny orange fox with a bandana"
            onChange={(e) => onPet({ ...design.pet, text: e.target.value }, false)}
          />
        )}
        {design.pet.mode !== "none" && (
          <Field label="Where">
            <select
              className={selectClass}
              value={design.pet.spot}
              onChange={(e) => {
                // choosing a named place snaps the companion squarely into it
                if (e.target.value !== "free") onPet(petAtSpot(design.pet, e.target.value as PetSpot), true);
              }}
            >
              {SPOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              {design.pet.spot === "free" && <option value="free">Wherever you dragged it</option>}
            </select>
          </Field>
        )}
      </Section>

      <Section title="Any other details?">
        <textarea
          className={cn(inputClass, "min-h-20")}
          value={design.extra}
          maxLength={400}
          aria-label="Extra outfit details"
          placeholder="e.g. everything slightly muddy after a match, a plaster on one cheek"
          onChange={(e) => onExtra(e.target.value)}
        />
      </Section>
    </div>
  );
}
