import { useEffect, useMemo, useRef, useState } from "react";

import { Doll } from "@/components/creator/Doll";
import { Chip, Field, Section, Segmented, Step, Toggle, inputClass, useFlash } from "@/components/creator/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Box, Design, Target } from "@/lib/creator/design";
import {
  buildSheet,
  canvasToBlob,
  copyImage,
  copyText,
  downloadBlob,
  imageToCanvas,
  slug,
  svgToCanvas,
  type SheetPanel,
} from "@/lib/creator/export";
import type { DollLook } from "@/lib/creator/look";
import { buildPrompt, followUps, type PromptContext } from "@/lib/creator/prompt";
import { PROVIDERS, type ProviderId, type Quality } from "@/lib/creator/providers";
import { solve, type Frame } from "@/lib/creator/rig";
import { DEFAULT_API, loadApi, saveApi, shareLink, type ApiSettings } from "@/lib/creator/storage";
import { cn } from "@/lib/utils";

export interface SendRef {
  key: string;
  label: string;
  thumb: string;
  full: string;
}

interface Props {
  design: Design;
  look: DollLook;
  frame: Frame;
  crop: Box;
  /** display name, e.g. "DarlingDia" */
  name: string;
  /** file-name prefix, e.g. "Dia" */
  prefix: string;
  /** the character pictures to send, main one first (empty until a custom picture is chosen) */
  refs: SendRef[];
  /** an uploaded character's main colours, measured from the picture */
  palette?: string[];
  onTarget: (t: Target) => void;
  onGuide: (g: Design["guide"]) => void;
  /** switch the colour codes in the prompt on or off */
  onColors: (on: boolean) => void;
  /** hand a generated image over to the Finish tab */
  onResult: (blob: Blob, name: string) => void;
  onNeedPicture: () => void;
}

const TARGETS: Record<Target, { label: string; url: string | null; tip: string }> = {
  gemini: {
    label: "Gemini",
    url: "https://gemini.google.com/app",
    tip: "Start a new chat, click in the message box and paste each item in order. If Gemini offers tools, pick the image one.",
  },
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    tip: "Start a new chat, click in the message box and paste each item in order.",
  },
  other: {
    label: "Another app",
    url: null,
    tip: "Any image AI that accepts several reference pictures will do. Attach the pictures in the order shown, then paste the prompt.",
  },
};

export function SendPanel({ design, look, frame, crop, name, prefix, refs, palette, onTarget, onGuide, onColors, onResult, onNeedPicture }: Props) {
  const guideRef = useRef<SVGSVGElement>(null);
  const [sheet, setSheet] = useState(false);
  const [edited, setEdited] = useState<{ text: string; from: string } | null>(null);
  const [status, flash] = useFlash(2600);
  const [done, setDone] = useState<string | null>(null);
  const doneTimer = useRef<number | undefined>(undefined);
  const [manualCopy, setManualCopy] = useState(false);
  const [linkText, setLinkText] = useState("");

  const ctx: PromptContext = useMemo(
    () => ({ name, refCount: Math.max(1, refs.length), sheet, palette }),
    [name, refs.length, sheet, palette],
  );
  const hasCodes = design.who !== "custom" || (palette?.length ?? 0) > 0;
  const auto = useMemo(() => buildPrompt(design, ctx), [design, ctx]);
  const prompt = edited?.text ?? auto;
  const stale = !!edited && edited.from !== auto;
  const replies = useMemo(() => followUps(design, ctx), [design, ctx]);
  const target = TARGETS[design.target];
  const sk = solve(design.pose, frame);
  const file = slug(prefix);

  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  const mark = (key: string, msg: string) => {
    setDone(key);
    flash(msg);
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => setDone(null), 2200);
  };

  // ---- the three things that get pasted ------------------------------
  const guideSize = (): [number, number] => {
    const s = 1024 / Math.min(crop.w, crop.h);
    return [Math.round(crop.w * s), Math.round(crop.h * s)];
  };
  const guideCanvas = async () => {
    if (!guideRef.current) throw new Error("The pose guide is not ready yet");
    const [w, h] = guideSize();
    return svgToCanvas(guideRef.current, w, h);
  };
  const makeGuide = async () => canvasToBlob(await guideCanvas());
  const makeRef = async (r: SendRef) => canvasToBlob(await imageToCanvas(r.full, 1536));
  const makeSheet = async () => {
    const panels: SheetPanel[] = [];
    for (let i = 0; i < refs.length; i++) {
      panels.push({
        title: refs.length > 1 ? `CHARACTER ${i + 1}` : "CHARACTER",
        note: "keep this identity and art style",
        canvas: await imageToCanvas(refs[i].full, 1024),
      });
    }
    panels.push({ title: "POSE GUIDE", note: "copy the pose only", canvas: await guideCanvas() });
    return canvasToBlob(buildSheet(panels));
  };

  const copyPic = async (key: string, make: () => Promise<Blob>, fileName: string, what: string) => {
    try {
      const how = await copyImage(make, fileName);
      mark(key, how === "copied" ? `${what} copied. Paste it into the chat.` : `Copying isn't available here, so ${what.toLowerCase()} was downloaded instead.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong making that picture.");
    }
  };
  const savePic = async (key: string, make: () => Promise<Blob>, fileName: string, what: string) => {
    try {
      downloadBlob(await make(), fileName);
      mark(key, `${what} downloaded.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong making that picture.");
    }
  };
  const copyPrompt = async (key: string, text: string, what: string) => {
    if (await copyText(text)) mark(key, `${what} copied.`);
    else {
      setManualCopy(true);
      flash("Copying isn't available here. Select the text and copy it by hand.");
    }
  };

  const picButtons = (key: string, make: () => Promise<Blob>, fileName: string, what: string) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => copyPic(key, make, fileName, what)}>
        {done === key ? "Copied" : "Copy image"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => savePic(`${key}-dl`, make, fileName, what)}>
        {done === `${key}-dl` ? "Saved" : "Download"}
      </Button>
    </div>
  );

  // ---- optional: straight to an API ----------------------------------
  const [api, setApi] = useState<ApiSettings>(DEFAULT_API);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState<{ url: string; blob: Blob; name: string }[]>([]);
  const abort = useRef<AbortController | null>(null);
  const made = useRef<string[]>([]);
  useEffect(() => setApi(loadApi()), []);
  useEffect(
    () => () => {
      abort.current?.abort();
      for (const url of made.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const setApiAnd = (patch: Partial<ApiSettings>) => {
    const next = { ...api, ...patch };
    setApi(next);
    saveApi(next);
  };
  const provider = PROVIDERS[api.provider];
  const generate = async () => {
    if (!refs.length) {
      onNeedPicture();
      return;
    }
    setBusy(true);
    setApiError("");
    abort.current = new AbortController();
    try {
      const images = [];
      for (const r of refs) images.push({ role: "character" as const, blob: await makeRef(r) });
      images.push({ role: "pose" as const, blob: await makeGuide() });
      // each provider gets the wording that suits it (only OpenAI can draw real transparency)
      const text = buildPrompt(
        { ...design, target: api.provider === "openai" ? "chatgpt" : "gemini" },
        { name, refCount: refs.length, sheet: false, palette },
      );
      const blobs = await provider.generate(
        {
          prompt: text,
          images,
          aspect: design.shot.aspect,
          quality: api.quality,
          transparent: design.shot.background === "key" && provider.alpha,
        },
        { key: api.key[api.provider].trim(), model: api.model[api.provider] },
        abort.current.signal,
      );
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      const fresh = blobs.map((blob, i) => ({
        url: URL.createObjectURL(blob),
        blob,
        name: `${file}-${stamp}${i ? `-${i + 1}` : ""}.png`,
      }));
      made.current.push(...fresh.map((f) => f.url));
      setResults((prev) => [...fresh, ...prev]);
      flash("Your image is ready below.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        const msg = err instanceof Error ? err.message : String(err);
        setApiError(
          /Failed to fetch|NetworkError|Load failed/i.test(msg)
            ? "The request never reached the provider. That usually means the browser blocked it (the provider doesn't allow calls straight from a web page) or you're offline. The copy-and-paste route above still works."
            : msg,
        );
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const needsPicture = refs.length === 0;

  return (
    <div className="space-y-8">
      <p role="status" aria-live="polite" className={cn("min-h-5 text-sm font-semibold text-glow", !status && "sr-only")}>
        {status}
      </p>

      <Section title="Where will you paste it?">
        <Segmented
          label="AI app"
          value={design.target}
          onChange={onTarget}
          options={(Object.keys(TARGETS) as Target[]).map((t) => ({ value: t, label: TARGETS[t].label }))}
        />
      </Section>

      {needsPicture ? (
        <div className="rounded-xl border border-yolk/50 bg-yolk/10 p-4 text-sm">
          <p className="font-semibold text-star">Add their picture first.</p>
          <p className="mt-1 text-dust">The AI needs a reference picture of the character before it can redraw them.</p>
          <Button size="sm" className="mt-3" onClick={onNeedPicture}>
            Go to Who
          </Button>
        </div>
      ) : (
        <ol className="space-y-7">
          {sheet ? (
            <Step n={1} title="Copy the reference sheet">
              <p className="text-sm text-dust">
                One picture holding {refs.length > 1 ? "both character pictures" : "the character"} and the pose guide, each in a labelled panel.
              </p>
              {picButtons("sheet", makeSheet, `${file}-reference-sheet.png`, "Reference sheet")}
            </Step>
          ) : (
            <>
              <Step n={1} title={refs.length > 1 ? "Copy the character art, one at a time" : "Copy the character art"}>
                <ul className="space-y-3">
                  {refs.map((r, i) => (
                    <li key={r.key} className="flex items-center gap-3">
                      <img src={r.thumb} alt="" className="size-16 shrink-0 rounded-lg border border-nebula-edge bg-white object-contain" />
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate text-sm text-dust">
                          <span className="font-semibold text-star">Image {i + 1}</span> · {name}, {r.label.toLowerCase()}
                        </p>
                        {picButtons(`ref-${r.key}`, () => makeRef(r), `${file}-reference-${i + 1}.png`, "Character art")}
                      </div>
                    </li>
                  ))}
                </ul>
              </Step>
              <Step n={2} title="Copy the pose guide">
                <div className="flex items-center gap-3">
                  <svg
                    ref={guideRef}
                    viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
                    className="h-16 w-auto max-w-28 shrink-0 rounded-lg border border-nebula-edge bg-white"
                    role="img"
                    aria-label="Pose guide preview"
                  >
                    <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="#ffffff" />
                    <Doll pose={design.pose} sk={sk} look={look} mode={design.guide.style} tint={design.guide.tint} />
                  </svg>
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-sm text-dust">
                      <span className="font-semibold text-star">Image {refs.length + 1}</span> · the pose, nothing else
                    </p>
                    {picButtons("guide", makeGuide, `${file}-pose-guide.png`, "Pose guide")}
                  </div>
                </div>
              </Step>
            </>
          )}

          <Step n={sheet ? 2 : 3} title="Copy the prompt">
            <textarea
              className={cn(inputClass, "min-h-56 font-mono text-xs leading-relaxed")}
              value={prompt}
              spellCheck={false}
              aria-label="Prompt for the AI"
              onFocus={(e) => manualCopy && e.currentTarget.select()}
              onChange={(e) => setEdited({ text: e.target.value, from: edited?.from ?? auto })}
            />
            {stale && (
              <p className="text-xs text-yolk">
                You edited this prompt, and the design has changed since.{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setEdited(null)}>
                  Use the fresh one
                </button>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => copyPrompt("prompt", prompt, "Prompt")}>
                {done === "prompt" ? "Copied" : "Copy prompt"}
              </Button>
              {edited && !stale && (
                <Button size="sm" variant="ghost" onClick={() => setEdited(null)}>
                  Undo my edits
                </Button>
              )}
            </div>
          </Step>

          <Step n={sheet ? 3 : 4} title={`Paste it all into ${target.label} and send`}>
            <p className="text-sm leading-relaxed text-dust">{target.tip}</p>
            {target.url && (
              <a href={target.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Open {target.label} <span aria-hidden="true">↗</span>
              </a>
            )}
          </Step>
        </ol>
      )}

      {/* when the sheet is on, the guide still has to exist in the page so it can be drawn into the sheet */}
      {!needsPicture && sheet && (
        <svg ref={guideRef} viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} className="sr-only" aria-hidden="true">
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="#ffffff" />
          <Doll pose={design.pose} sk={sk} look={look} mode={design.guide.style} tint={design.guide.tint} />
        </svg>
      )}

      {!needsPicture && (
        <Section title="Options">
          <div className="space-y-4">
            <Toggle
              checked={sheet}
              onChange={(v) => {
                setSheet(v);
                setEdited(null);
              }}
              label="Combine the pictures into one sheet"
              hint="One paste instead of several. Separate pictures usually copy the pose a little more faithfully."
            />
            <Toggle
              checked={design.colors}
              onChange={onColors}
              label="Include colour codes"
              hint={
                hasCodes
                  ? "Quotes the exact colours measured from the art, so the yellow can't creep brighter. Leave it on unless you want the AI to recolour things."
                  : "Nothing to quote yet: the colours are measured once you choose a picture."
              }
            />
            <Field label="Pose guide style" group>
              <Segmented
                label="Pose guide style"
                value={design.guide.style}
                onChange={(style) => onGuide({ ...design.guide, style })}
                options={[
                  { value: "mannequin", label: "Grey mannequin" },
                  { value: "dressed", label: "Dressed doll" },
                ]}
              />
            </Field>
            {design.guide.style === "mannequin" && (
              <Toggle
                checked={design.guide.tint}
                onChange={(tint) => onGuide({ ...design.guide, tint })}
                label="Colour-code left and right"
                hint="Blue for the character's right limbs, orange for the left. Helps the AI when arms or legs cross."
              />
            )}
          </div>
        </Section>
      )}

      {!needsPicture && (
        <Section title="If the first try isn't right" hint="Reply in the same chat. Each of these is ready to copy.">
          <ul className="space-y-2">
            {replies.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-nebula-edge bg-cosmos/40 px-3 py-2">
                <span className="min-w-0 text-sm text-star">{r.label}</span>
                <Chip onClick={() => copyPrompt(`fu-${r.id}`, r.text, "Reply")}>{done === `fu-${r.id}` ? "Copied" : "Copy reply"}</Chip>
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-yolk/40 bg-yolk/10 px-3 py-2 text-sm leading-relaxed text-star">
            <strong>Colours creep.</strong> Each time the AI redraws its own picture, the yellow gets a little brighter and more saturated.
            After two or three replies, start a new chat with the original art and a fresh prompt rather than replying again.
          </p>
          <p className="text-sm text-dust">
            Happy with it? Save the picture, then bring it to <strong className="text-star">Finish</strong>.
          </p>
        </Section>
      )}

      <Section title="Send this design to a teammate" hint="The link holds the pose, outfit and shot. They open it and carry on.">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const link = shareLink(design);
            if (await copyText(link)) mark("share", "Link copied.");
            else setLinkText(link);
          }}
        >
          {done === "share" ? "Copied" : "Copy link to this design"}
        </Button>
        {linkText && (
          <input
            readOnly
            className={inputClass}
            value={linkText}
            aria-label="Link to this design: select it and copy"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </Section>

      {/* ---------------------------------------------------- API key -- */}
      <details className="group rounded-2xl border border-nebula-edge bg-cosmos/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>
            <span className="block font-display text-base font-bold">Skip the pasting with an API key</span>
            <span className="block text-xs text-dust">Optional, for later. Nothing here is needed for the steps above.</span>
          </span>
          <span aria-hidden="true" className="text-dust transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="space-y-4 border-t border-nebula-edge p-4">
          <p className="text-sm leading-relaxed text-dust">
            With a key, this page sends the same pictures and prompt for you and shows the result here. The provider bills your key a few
            cents per image. The key stays in this browser and goes only to the provider.
          </p>
          <p className="rounded-lg border border-yolk/40 bg-yolk/10 px-3 py-2 text-xs leading-relaxed text-star">
            Not yet tried with a live key. It was built from each provider's published API guide, so expect to iron out a wrinkle the first
            time you use it.
          </p>
          <Segmented
            label="Provider"
            value={api.provider}
            onChange={(p: ProviderId) => setApiAnd({ provider: p })}
            options={[
              { value: "gemini", label: PROVIDERS.gemini.label },
              { value: "openai", label: PROVIDERS.openai.label },
            ]}
          />
          <Field label="Model" hint={provider.models.find((m) => m.id === api.model[api.provider])?.note}>
            <select
              className={cn(inputClass, "h-9 py-1")}
              value={api.model[api.provider]}
              onChange={(e) => setApiAnd({ model: { ...api.model, [api.provider]: e.target.value } })}
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="API key"
            hint={
              <>
                {provider.keyHint}{" "}
                <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-glow hover:underline">
                  Get a key ↗
                </a>
              </>
            }
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
              value={api.key[api.provider]}
              placeholder="Paste your key"
              onChange={(e) => setApiAnd({ key: { ...api.key, [api.provider]: e.target.value } })}
            />
          </Field>
          <Toggle
            checked={api.remember}
            onChange={(remember) => setApiAnd({ remember })}
            label="Remember the key on this device"
            hint="Off: the key is forgotten when you close the tab. Turn it on only on your own computer."
          />
          <Field label="Quality" group>
            <Segmented
              label="Quality"
              value={api.quality}
              onChange={(quality: Quality) => setApiAnd({ quality })}
              options={[
                { value: "draft", label: "Draft" },
                { value: "standard", label: "Standard" },
                { value: "best", label: "Best" },
              ]}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} disabled={busy || !api.key[api.provider].trim()}>
              {busy ? "Drawing…" : "Generate"}
            </Button>
            {busy && (
              <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            )}
          </div>
          {apiError && (
            <p role="alert" className="rounded-lg border border-live/60 bg-live/15 px-3 py-2 text-sm text-star">
              {apiError}
            </p>
          )}
          {results.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((r) => (
                <li key={r.url} className="overflow-hidden rounded-xl border border-nebula-edge bg-white">
                  <img src={r.url} alt="Generated image" className="w-full" />
                  <div className="flex flex-wrap gap-2 bg-nebula p-2">
                    <Button size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}>
                      Download
                    </Button>
                    <Button size="sm" onClick={() => onResult(r.blob, r.name)}>
                      Finish it
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
