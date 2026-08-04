import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Must mirror the variables in src/styles/theme.css */
const TOKENS = [
  { cssVar: "--brand-yolk", label: "Yolk Gold", hint: "Primary — buttons & highlights" },
  { cssVar: "--brand-yolk-bright", label: "Bright Yolk", hint: "Hovers & glows" },
  { cssVar: "--brand-yolk-deep", label: "Deep Yolk", hint: "Gradients & emphasis" },
  { cssVar: "--brand-sky", label: "Shield Glow", hint: "Secondary — links & accents" },
  { cssVar: "--brand-nova", label: "Nebula Purple", hint: "Background wisps" },
  { cssVar: "--brand-cosmos", label: "Cosmos", hint: "Page background" },
  { cssVar: "--brand-nebula", label: "Nebula", hint: "Cards & panels" },
  { cssVar: "--brand-nebula-edge", label: "Nebula Edge", hint: "Borders & dividers" },
  { cssVar: "--brand-star", label: "Starlight", hint: "Main text" },
  { cssVar: "--brand-dust", label: "Space Dust", hint: "Muted text" },
  { cssVar: "--brand-live", label: "Live Red", hint: "Stream badges (Phase 3)" },
] as const;

type Colors = Record<string, string>;

function readCurrentColors(): Colors {
  const styles = getComputedStyle(document.documentElement);
  const colors: Colors = {};
  for (const t of TOKENS) {
    colors[t.cssVar] = styles.getPropertyValue(t.cssVar).trim() || "#000000";
  }
  return colors;
}

export default function ThemePlayground() {
  const [colors, setColors] = useState<Colors | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    setColors(readCurrentColors());
  }, []);

  if (!colors) {
    return (
      <p className="text-sm text-dust">Loading the paint buckets…</p>
    );
  }

  const setColor = (cssVar: string, value: string) => {
    document.documentElement.style.setProperty(cssVar, value);
    setColors((prev) => ({ ...prev!, [cssVar]: value }));
  };

  const reset = () => {
    for (const t of TOKENS) {
      document.documentElement.style.removeProperty(t.cssVar);
    }
    setColors(readCurrentColors());
  };

  const themeCss = `:root {\n${TOKENS.map(
    (t) => `  ${t.cssVar}: ${colors[t.cssVar]};`,
  ).join("\n")}\n}`;

  const copyCss = async () => {
    try {
      // navigator.clipboard is undefined outside secure contexts (e.g. a
      // LAN-IP preview) and writeText can reject — fall back to manual copy.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(themeCss);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="space-y-12">
      {/* Pickers */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Paint buckets</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Reset
            </Button>
            <Button size="sm" onClick={copyCss}>
              {copyState === "copied" ? "Copied!" : "Copy CSS"}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-dust">
          Tweak away — the whole page restyles live. Happy? Hit{" "}
          <strong className="text-star">Copy CSS</strong> and paste the block
          over the <code>:root</code> in{" "}
          <code className="text-glow">src/styles/theme.css</code>.
        </p>

        {copyState === "failed" && (
          <div className="mt-4">
            <p className="text-sm text-dust">
              Automatic copy isn't available here — select the block below and
              copy it manually:
            </p>
            <textarea
              readOnly
              value={themeCss}
              rows={TOKENS.length + 2}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Theme CSS to copy"
              className="mt-2 w-full rounded-xl border border-nebula-edge bg-nebula p-3 font-mono text-xs text-star"
            />
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOKENS.map((t) => (
            <label
              key={t.cssVar}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-nebula-edge bg-card p-3 transition-colors hover:border-glow/60"
            >
              <input
                type="color"
                value={colors[t.cssVar]}
                onChange={(e) => setColor(t.cssVar, e.target.value)}
                aria-label={`${t.label} color`}
                className="size-10 shrink-0 cursor-pointer rounded-lg border border-nebula-edge bg-transparent"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t.label}</span>
                <span className="block truncate text-xs text-dust">
                  {t.hint} · <code>{colors[t.cssVar]}</code>
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Live samples */}
      <section>
        <h2 className="font-display text-2xl font-bold">Live preview</h2>
        <p className="mt-1 text-sm text-dust">
          The same components used across the site, wearing your colors.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Buttons &amp; badges</CardTitle>
                <Badge variant="glow">Sample</Badge>
              </div>
              <CardDescription>Every variant in one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="glow">Glow</Badge>
                <Badge variant="live">● Live</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Roster card</CardTitle>
                <Badge variant="glow">The Wildcard</Badge>
              </div>
              <CardDescription>KoalaKyle</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-dust">
                Always in good spirits and permanently ready to hit the W-key —
                relentless energy that keeps the enemy guessing. This is{" "}
                <a href="#" className="font-semibold text-glow hover:underline">
                  what a link looks like
                </a>
                , and <strong className="text-star">this is emphasis</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
