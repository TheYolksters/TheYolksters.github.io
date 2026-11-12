import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Small form pieces for the Creator, styled with the site's brand tokens so
 * the tool retints with theme.css like everything else.
 */

export const inputClass =
  "w-full rounded-xl border border-nebula-edge bg-cosmos/70 px-3 py-2 text-sm text-star placeholder:text-dust/60 transition-colors focus-visible:border-yolk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function Section({
  title,
  hint,
  action,
  children,
  className,
  id,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** lets "jump to" links scroll here */
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        {action}
      </div>
      {hint && <p className="text-pretty text-sm leading-relaxed text-dust">{hint}</p>}
      {children}
    </section>
  );
}

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45",
        active
          ? "border-yolk bg-yolk text-primary-foreground"
          : "border-nebula-edge text-dust hover:border-glow/70 hover:text-star",
        className,
      )}
      {...props}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const firstLive = options.find((o) => !o.disabled);
  const hasChoice = options.some((o) => o.value === value && !o.disabled);
  // a proper radio group: one tab stop, arrow keys move the choice
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const live = options.filter((o) => !o.disabled);
    const at = live.findIndex((o) => o.value === value);
    const next = live[(at + step + live.length) % live.length];
    if (!next) return;
    onChange(next.value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)');
    buttons[live.indexOf(next)]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn("inline-flex flex-wrap gap-1 rounded-xl border border-nebula-edge bg-cosmos/50 p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value || (!hasChoice && o === firstLive) ? 0 : -1}
          title={o.title}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-8 rounded-lg px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
            value === o.value ? "bg-yolk text-primary-foreground" : "text-dust hover:bg-nebula hover:text-star",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A caption over a control. By default it is a real <label>, so clicking the
 * caption focuses the input inside. Pass `group` when it wraps a set of
 * buttons instead: a <label> there would "click" the first button whenever
 * the caption was clicked.
 */
export function Field({
  label,
  hint,
  children,
  className,
  group = false,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  group?: boolean;
}) {
  const Wrap = group ? "div" : "label";
  return (
    <Wrap className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-semibold uppercase tracking-wider text-dust">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-relaxed text-dust">{hint}</span>}
    </Wrap>
  );
}

export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** fires continuously while dragging */
  onChange: (v: number) => void;
  /** fires once when the drag or key press ends */
  onCommit?: () => void;
  format?: (v: number) => string;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-dust">
          {label}
        </label>
        <span className="text-xs tabular-nums text-star">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-6 w-full cursor-pointer accent-yolk"
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  swatches: string[];
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wider text-dust">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour`}
          className="size-8 shrink-0 cursor-pointer rounded-lg border border-nebula-edge bg-transparent"
        />
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Use ${c}`}
            aria-pressed={value.toLowerCase() === c.toLowerCase()}
            className={cn(
              "size-6 rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value.toLowerCase() === c.toLowerCase() ? "border-star ring-2 ring-yolk" : "border-nebula-edge",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-yolk"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-star">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-dust">{hint}</span>}
      </span>
    </label>
  );
}

/** a numbered step in the "send to AI" list */
export function Step({ n, title, children }: { n: number; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-yolk font-display text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-display text-base font-bold leading-tight">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** short-lived status line ("Copied!") that screen readers announce */
export function useFlash(ms = 2200): [string, (msg: string) => void] {
  const [msg, setMsg] = React.useState("");
  const timer = React.useRef<number | undefined>(undefined);
  const flash = React.useCallback(
    (m: string) => {
      setMsg(m);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMsg(""), ms);
    },
    [ms],
  );
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  return [msg, flash];
}

/** does a CSS media query match right now? (re-renders when that changes) */
export function useMedia(query: string): boolean {
  const [on, setOn] = React.useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  React.useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return on;
}
