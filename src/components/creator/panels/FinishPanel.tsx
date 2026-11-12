import { useCallback, useEffect, useRef, useState } from "react";

import { Field, Range, Section, Segmented, Toggle, inputClass, useFlash } from "@/components/creator/ui";
import { Button } from "@/components/ui/button";
import { DEFAULT_CUTOUT, cutout, type CutoutOptions, type CutoutResult } from "@/lib/creator/cutout";
import { canvasToBlob, downloadBlob, loadImage, slug } from "@/lib/creator/export";
import { cn } from "@/lib/utils";

/**
 * FINISH — bring the AI's picture back and get a file that is ready to use:
 *  - a transparent cutout for overlays, thumbnails and stickers, or
 *  - a square white "-clean" file that drops into Images/ for the roster.
 * Everything happens in the browser; the picture is not uploaded anywhere.
 */

interface Props {
  /** "Dia" */
  prefix: string;
  /** "Wave" */
  tag: string;
  /** "roster" files default to the white mode, everything else to the cutout */
  preferRoster: boolean;
  /** a picture handed over from the Send tab's API results */
  incoming: { blob: Blob; name: string } | null;
  onIncomingUsed: () => void;
}

type Mode = "cutout" | "roster";
type Backing = "checker" | "navy" | "white" | "pink";

const MAX_SIDE = 3072;

const BACKING: Record<Backing, { label: string; style: React.CSSProperties }> = {
  checker: {
    label: "Checker",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(45deg, #cfd3dc 25%, transparent 25%, transparent 75%, #cfd3dc 75%), linear-gradient(45deg, #cfd3dc 25%, transparent 25%, transparent 75%, #cfd3dc 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 10px 10px",
    },
  },
  navy: { label: "Site navy", style: { background: "radial-gradient(circle at 50% 40%, #273065, #161c3d 62%)" } },
  white: { label: "White", style: { backgroundColor: "#ffffff" } },
  pink: { label: "Hot pink", style: { backgroundColor: "#ff2bd6" } },
};

export function FinishPanel({ prefix, tag, preferRoster, incoming, onIncomingUsed }: Props) {
  const [source, setSource] = useState<{ width: number; height: number; fileName: string; shrunk: boolean } | null>(null);
  const [mode, setMode] = useState<Mode>(preferRoster ? "roster" : "cutout");
  const [opts, setOpts] = useState<CutoutOptions>(DEFAULT_CUTOUT);
  const [fixes, setFixes] = useState<{ kind: "keep" | "remove"; p: number }[]>([]);
  const [backing, setBacking] = useState<Backing>("navy");
  const [trim, setTrim] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ removed: number; bounds: CutoutResult["bounds"] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, flash] = useFlash(3200);
  const [tagText, setTagText] = useState(tag);

  const pixels = useRef<ImageData | null>(null); // the picture as loaded
  const result = useRef<CutoutResult | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const job = useRef(0);

  useEffect(() => setTagText(tag), [tag]);

  // ---- loading -------------------------------------------------------
  const loadBlob = useCallback(async (blob: Blob, fileName: string) => {
    setError("");
    if (!blob.type.startsWith("image/")) {
      setError("That file isn't a picture. Use a PNG, JPG or WebP.");
      return;
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas is not available in this browser");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      pixels.current = ctx.getImageData(0, 0, w, h);
      result.current = null;
      setFixes([]);
      setStats(null);
      setSource({ width: w, height: h, fileName, shrunk: scale < 1 });
    } catch {
      setError("That picture couldn't be opened. Try saving it again as a PNG.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    if (!incoming) return;
    void loadBlob(incoming.blob, incoming.name);
    onIncomingUsed();
  }, [incoming, loadBlob, onIncomingUsed]);

  // paste anywhere while this tab is open
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void loadBlob(f, f.name || "pasted-image.png");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadBlob]);

  // ---- processing ----------------------------------------------------
  useEffect(() => {
    const src = pixels.current;
    const canvas = preview.current;
    if (!source || !src || !canvas) return;
    const id = ++job.current;
    setBusy(true);
    // let the "Working…" state paint before the heavy loop
    const t = window.setTimeout(() => {
      if (id !== job.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = src.width;
      canvas.height = src.height;
      if (mode === "cutout") {
        const res = cutout(src, {
          ...opts,
          keep: fixes.filter((f) => f.kind === "keep").map((f) => f.p),
          remove: fixes.filter((f) => f.kind === "remove").map((f) => f.p),
        });
        result.current = res;
        ctx.putImageData(new ImageData(res.pixels.data as Uint8ClampedArray<ArrayBuffer>, src.width, src.height), 0, 0);
        setStats({ removed: res.removed, bounds: res.bounds });
      } else {
        result.current = null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, src.width, src.height);
        const tmp = document.createElement("canvas");
        tmp.width = src.width;
        tmp.height = src.height;
        tmp.getContext("2d")?.putImageData(src, 0, 0);
        ctx.drawImage(tmp, 0, 0);
        setStats(null);
      }
      setBusy(false);
    }, 30);
    return () => window.clearTimeout(t);
  }, [source, mode, opts, fixes]);

  // click a patch to fix it
  const onPreviewClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const res = result.current;
    if (mode !== "cutout" || !res || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * res.pixels.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * res.pixels.height);
    if (x < 0 || y < 0 || x >= res.pixels.width || y >= res.pixels.height) return;
    const p = y * res.pixels.width + x;
    const gone = res.pixels.data[p * 4 + 3] < 128;
    setFixes((f) => [...f, { kind: gone ? "keep" : "remove", p }]);
    flash(gone ? "Put that patch back, if it was an enclosed gap." : "Removed that patch.");
  };

  // ---- saving --------------------------------------------------------
  const safeTag = slug(tagText || "Pose");
  const cutoutName = `${slug(prefix)}_${safeTag}-cutout.png`;
  const rosterName = `${slug(prefix)}_Chibi_${safeTag}-clean.png`;

  const save = async () => {
    const canvas = preview.current;
    const src = pixels.current;
    if (!canvas || !src) return;
    try {
      if (mode === "cutout") {
        const b = result.current?.bounds;
        if (!b) {
          setError("Nothing is left after removing the backdrop. Lower the strength and try again.");
          return;
        }
        let out = canvas;
        if (trim) {
          const pad = Math.round(Math.max(b.w, b.h) * 0.03) + 4;
          const x = Math.max(0, b.x - pad);
          const y = Math.max(0, b.y - pad);
          const w = Math.min(canvas.width - x, b.w + pad * 2);
          const h = Math.min(canvas.height - y, b.h + pad * 2);
          out = document.createElement("canvas");
          out.width = w;
          out.height = h;
          out.getContext("2d")?.drawImage(canvas, x, y, w, h, 0, 0, w, h);
        }
        downloadBlob(await canvasToBlob(out), cutoutName);
        flash(`Saved ${cutoutName}`);
      } else {
        // square it on white, like the current -clean files
        const side = Math.max(canvas.width, canvas.height);
        const out = document.createElement("canvas");
        out.width = side;
        out.height = side;
        const ctx = out.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, side, side);
        ctx.drawImage(canvas, Math.round((side - canvas.width) / 2), Math.round((side - canvas.height) / 2));
        downloadBlob(await canvasToBlob(out), rosterName);
        flash(`Saved ${rosterName}`);
      }
    } catch {
      setError("The file couldn't be saved. Try again.");
    }
  };

  const setOpt = (patch: Partial<CutoutOptions>) => setOpts((o) => ({ ...o, ...patch }));

  return (
    <div className="space-y-8">
      <Section
        title="Bring the picture back"
        hint="Save the AI's picture, then drop it here. It is finished in your browser and never uploaded."
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Choose the AI's picture"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadBlob(f, f.name);
            e.target.value = "";
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void loadBlob(f, f.name);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-yolk bg-yolk/10" : "border-nebula-edge bg-cosmos/30",
          )}
        >
          <p className="text-sm text-dust">
            {source ? (
              <>
                <span className="font-semibold text-star">{source.fileName}</span> · {source.width} × {source.height}
                {source.shrunk && " (shrunk to fit)"}
              </>
            ) : (
              "Drop a picture here, paste one with Ctrl+V, or"
            )}
          </p>
          <Button size="sm" variant={source ? "outline" : "default"} onClick={() => fileInput.current?.click()}>
            {source ? "Choose a different picture" : "Choose a picture"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-live/60 bg-live/15 px-3 py-2 text-sm text-star">
            {error}
          </p>
        )}
      </Section>

      {source && (
        <>
          <Section title="What do you need?">
            <Segmented
              label="Output"
              value={mode}
              onChange={setMode}
              options={[
                { value: "cutout", label: "Transparent cutout" },
                { value: "roster", label: "Roster file (white)" },
              ]}
            />
            <p className="text-sm leading-relaxed text-dust">
              {mode === "cutout"
                ? "Removes the flat backdrop so the character can sit on stream overlays, thumbnails and banners."
                : "Squares the picture on white and names it like the current art, ready for Images/ and the prep-images script."}
            </p>
          </Section>

          <Section
            title="Preview"
            action={
              mode === "cutout" ? (
                <Segmented
                  label="Preview background"
                  value={backing}
                  onChange={setBacking}
                  options={(Object.keys(BACKING) as Backing[]).map((b) => ({ value: b, label: BACKING[b].label }))}
                />
              ) : undefined
            }
          >
            <div
              className="relative overflow-hidden rounded-2xl border border-nebula-edge"
              style={mode === "cutout" ? BACKING[backing].style : { backgroundColor: "#ffffff" }}
            >
              <canvas
                ref={preview}
                onClick={onPreviewClick}
                className={cn("block h-auto w-full", mode === "cutout" && "cursor-crosshair")}
                role="img"
                aria-label={mode === "cutout" ? "Cutout preview. Click a patch to remove it or put it back." : "Roster file preview"}
              />
              {busy && (
                <span className="absolute left-3 top-3 rounded-full bg-cosmos/85 px-3 py-1 text-xs font-semibold text-star">Working…</span>
              )}
            </div>
            <p role="status" aria-live="polite" className={cn("min-h-5 text-sm font-semibold text-glow", !status && "sr-only")}>
              {status}
            </p>
            {mode === "cutout" && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-dust">
                  <strong className="text-star">Spot a mistake? Click it.</strong> Click a leftover patch of backdrop to remove it. Click a hole
                  that should be part of the character, like a white shirt panel, to put it back.
                </p>
                {fixes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setFixes((f) => f.slice(0, -1))}>
                      Undo last click
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFixes([])}>
                      Clear {fixes.length} {fixes.length === 1 ? "fix" : "fixes"}
                    </Button>
                  </div>
                )}
                <Range
                  label="Strength"
                  value={opts.tolerance}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setOpt({ tolerance: v })}
                  format={(v) => (v === 50 ? "normal" : v < 50 ? "gentler" : "stronger")}
                />
                <Toggle
                  checked={opts.dropShadow}
                  onChange={(v) => setOpt({ dropShadow: v })}
                  label="Remove the ground shadow"
                />
                <Toggle
                  checked={opts.pockets}
                  onChange={(v) => setOpt({ pockets: v })}
                  label="Clear enclosed gaps"
                  hint="Backdrop trapped inside the character, such as between an arm and the body."
                />
                <Toggle checked={trim} onChange={setTrim} label="Trim the empty space around the character" />
              </div>
            )}
          </Section>

          <Section title="Save it">
            <Field label="Name tag" hint={`Saves as ${mode === "cutout" ? cutoutName : rosterName}. The first part follows whoever is picked under Who.`}>
              <input className={inputClass} value={tagText} maxLength={40} onChange={(e) => setTagText(e.target.value)} />
            </Field>
            <Button onClick={save} disabled={busy}>
              {mode === "cutout" ? "Download cutout" : "Download roster file"}
            </Button>
            {mode === "cutout" && stats && (
              <p className="text-xs text-dust">{Math.round(stats.removed * 100)}% of the picture became transparent.</p>
            )}
            {mode === "roster" && (
              <p className="text-sm leading-relaxed text-dust">
                To put it on the site: save the file into <code className="text-glow">Images/</code>, point the member's entry in{" "}
                <code className="text-glow">scripts/prep-images.mjs</code> at it, then run{" "}
                <code className="text-glow">node scripts/prep-images.mjs</code>.
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
