import { useRef } from "react";

import { CHARACTERS, type CharacterId } from "@/config/creator";
import { Field, Section, Toggle, inputClass } from "@/components/creator/ui";
import type { Design, RefKey } from "@/lib/creator/design";
import { measuredColours } from "@/lib/creator/prompt";
import { cn } from "@/lib/utils";

/** the real character art for one member, as URLs the page prepared at build time */
export interface PersonArt {
  id: Exclude<CharacterId, "custom">;
  name: string;
  role: string;
  art: { key: RefKey; label: string; thumb: string; full: string }[];
}

/** a picture the user uploaded for "someone new" (lives only in this tab) */
export interface CustomArt {
  url: string;
  fileName: string;
  /** its main colours, measured in the browser (empty until that finishes) */
  palette: string[];
}

/** a colour chip: the swatch, what it is, and the code the prompt will quote */
function Swatch({ hex, part }: { hex: string; part?: string }) {
  return (
    <li className="flex items-center gap-1.5 rounded-lg border border-nebula-edge bg-cosmos/40 py-1 pl-1 pr-2">
      <span className="size-5 shrink-0 rounded-md border border-black/20" style={{ backgroundColor: hex }} aria-hidden="true" />
      <span className="min-w-0 text-[11px] leading-tight">
        {part && <span className="block truncate font-semibold text-star">{part}</span>}
        <span className="block font-mono uppercase text-dust">{hex}</span>
      </span>
    </li>
  );
}

interface Props {
  design: Design;
  people: PersonArt[];
  custom: CustomArt | null;
  onWho: (who: CharacterId) => void;
  onRefs: (refs: RefKey[]) => void;
  onCustomFile: (file: File) => void;
  onText: (patch: Partial<Pick<Design, "customName" | "customAbout">>) => void;
}

export function WhoPanel({ design, people, custom, onWho, onRefs, onCustomFile, onText }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const person = people.find((p) => p.id === design.who);
  const main = design.refs[0];
  const both = design.refs.length > 1;

  const card = (id: CharacterId, name: string, role: string, thumb: string | null) => {
    const on = design.who === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => onWho(id)}
        className={cn(
          "group flex flex-col items-center gap-2 rounded-2xl border bg-cosmos/40 p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on ? "border-yolk shadow-[0_0_24px_-10px_var(--brand-yolk)]" : "border-nebula-edge hover:-translate-y-0.5 hover:border-glow/60",
        )}
      >
        <span className={cn("flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl", thumb ? "bg-white" : "border border-dashed border-nebula-edge bg-nebula")}>
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-contain" loading="lazy" />
          ) : (
            <span className="font-display text-4xl font-bold text-dust" aria-hidden="true">
              +
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold">{name}</span>
          <span className="block truncate text-[11px] text-dust">{role}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <Section title="Who are we dressing?" hint="Their real art is what teaches the AI the face and the drawing style.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {people.map((p) => card(p.id, p.name, p.role, p.art[0]?.thumb ?? null))}
          {card("custom", "Someone new", "Upload their art", custom?.url ?? null)}
        </div>
      </Section>

      {person && (
        <Section
          title="Which picture goes to the AI?"
          hint="The main picture sets the outfit the AI starts from. Anything you don't change in Outfit stays as it is there."
        >
          <div className="grid grid-cols-2 gap-3">
            {person.art.map((a) => {
              const isMain = main === a.key;
              const sent = design.refs.includes(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={isMain}
                  onClick={() => onRefs(both ? [a.key, ...person.art.map((x) => x.key).filter((k) => k !== a.key)] : [a.key])}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border bg-white text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isMain ? "border-yolk" : "border-nebula-edge hover:border-glow/60",
                    !sent && "opacity-60",
                  )}
                >
                  <img src={a.thumb} alt={`${person.name}, ${a.label.toLowerCase()} art`} className="aspect-square w-full object-contain" loading="lazy" />
                  <span className="flex items-center justify-between gap-2 bg-nebula px-3 py-2">
                    <span className="font-display text-sm font-bold text-star">{a.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        isMain ? "bg-yolk text-primary-foreground" : sent ? "bg-glow/15 text-glow" : "text-dust",
                      )}
                    >
                      {isMain ? "Main" : sent ? "Also sent" : "Not sent"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {person.art.length > 1 && (
            <Toggle
              checked={both}
              onChange={(v) => onRefs(v ? [main, ...person.art.map((x) => x.key).filter((k) => k !== main)] : [main])}
              label="Send both pictures"
              hint="A second view helps the AI lock onto the face. It costs one more paste."
            />
          )}
        </Section>
      )}

      {person && (
        <Section
          title="Their exact colours"
          hint="Measured from the art, not guessed. The prompt quotes these codes so the AI can't drift toward a brighter yellow."
        >
          <ul className="flex flex-wrap gap-1.5">
            {measuredColours(design).map((c) => (
              <Swatch key={c.part} hex={c.hex} part={c.part} />
            ))}
          </ul>
        </Section>
      )}

      {design.who === "custom" && (
        <Section
          title="Their reference picture"
          hint="A clear, full-body picture on a plain background works best. It stays in this browser tab: nothing is uploaded until you paste it into the AI yourself."
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Choose a reference picture"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCustomFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-10 items-center rounded-xl border border-nebula-edge px-4 font-display text-sm font-bold transition-colors hover:border-glow hover:text-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {custom ? "Choose a different picture" : "Choose a picture"}
            </button>
            {custom && <span className="min-w-0 truncate text-xs text-dust">{custom.fileName}</span>}
          </div>
          {custom && custom.palette.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs leading-relaxed text-dust">
                Main colours measured from this picture. The prompt quotes them so the AI keeps them.
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Colours measured from the picture">
                {custom.palette.map((c) => (
                  <Swatch key={c} hex={c} />
                ))}
              </ul>
            </div>
          )}
          <Field label="Name">
            <input
              className={inputClass}
              value={design.customName}
              maxLength={60}
              placeholder="e.g. CaptainCluck"
              onChange={(e) => onText({ customName: e.target.value })}
            />
          </Field>
          <Field label="What must stay the same?" hint="Optional. Name the features the AI should never change.">
            <textarea
              className={cn(inputClass, "min-h-20")}
              value={design.customAbout}
              maxLength={400}
              placeholder="e.g. a chibi pink chick with blue eyes, a bow on the head tuft and freckles"
              onChange={(e) => onText({ customAbout: e.target.value })}
            />
          </Field>
        </Section>
      )}

      {design.who !== "custom" && CHARACTERS[design.who].pet && (
        <p className="text-sm text-dust">
          {person?.name} comes with a {CHARACTERS[design.who].pet?.words}. Drag it anywhere on the doll, right-click it to remove it, or use{" "}
          <strong className="text-star">Outfit</strong>.
        </p>
      )}
    </div>
  );
}
