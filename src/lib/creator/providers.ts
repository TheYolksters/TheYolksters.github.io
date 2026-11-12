/**
 * YOLKSTER CREATOR — optional "use an API key" path.
 *
 * The everyday workflow is copy-and-paste into the Gemini app or ChatGPT.
 * This file is the upgrade path for later: with a key, the page can send
 * the same pictures and prompt straight to the provider and show the result.
 *
 * Calls go directly from the visitor's browser to the provider — the site
 * has no server, and the key never touches it.
 *
 * STATUS: written against each provider's published API docs (November
 * 2026) and exercised against a stand-in server only, not a live key. If a
 * provider changes its request shape, this is the one file to fix:
 *   Gemini  https://aistudio.google.com/docs/image-generation
 *   OpenAI  https://developers.openai.com/api/reference/resources/images/methods/edit
 */

import type { AspectId } from "@/config/creator";
import { base64ToBlob, blobToBase64 } from "./export";

export type ProviderId = "gemini" | "openai";
export type Quality = "draft" | "standard" | "best";

export interface GenImage {
  /** what the picture is, used to label it for the model */
  role: "character" | "pose";
  blob: Blob;
}

export interface GenRequest {
  prompt: string;
  images: GenImage[];
  aspect: AspectId;
  quality: Quality;
  /** ask for a real alpha channel where the provider supports it */
  transparent: boolean;
}

export interface ProviderModel {
  id: string;
  label: string;
  note: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** where to get a key */
  keyUrl: string;
  keyHint: string;
  models: ProviderModel[];
  /** can it return a transparent background? */
  alpha: boolean;
  generate(req: GenRequest, auth: { key: string; model: string }, signal?: AbortSignal): Promise<Blob[]>;
}

async function failText(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
      detail =
        (typeof json.error === "string" ? json.error : json.error?.message) ?? json.message ?? body.slice(0, 300);
    } catch {
      detail = body.slice(0, 300);
    }
  } catch {
    /* no body */
  }
  if (res.status === 401 || res.status === 403) return `The key was rejected (${res.status}). ${detail}`.trim();
  if (res.status === 429) return `Rate limit or quota reached (429). ${detail}`.trim();
  return `The provider answered ${res.status}. ${detail}`.trim();
}

/** find every base64 image in a response, whatever shape it arrives in */
function findImages(node: unknown, out: { data: string; mime: string }[] = [], depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return out;
  if (Array.isArray(node)) {
    for (const item of node) findImages(item, out, depth + 1);
    return out;
  }
  const o = node as Record<string, unknown>;
  const mime = (o.mime_type ?? o.mimeType) as unknown;
  if (typeof o.data === "string" && o.data.length > 200 && (o.type === "image" || (typeof mime === "string" && mime.startsWith("image/")))) {
    out.push({ data: o.data, mime: typeof mime === "string" ? mime : "image/png" });
  }
  for (const v of Object.values(o)) findImages(v, out, depth + 1);
  return out;
}

// --------------------------------------------------------------- Gemini --

const gemini: Provider = {
  id: "gemini",
  label: "Google Gemini",
  keyUrl: "https://aistudio.google.com/apikey",
  keyHint: "Create a key in Google AI Studio. Restrict it to this site's address if you can.",
  alpha: false,
  models: [
    { id: "gemini-nano-banana-2.1", label: "Nano Banana 2.1", note: "Best all-rounder for keeping a character consistent. About 3–5¢ an image." },
    { id: "gemini-3-pro-image", label: "Nano Banana Pro", note: "Slower and pricier (about 13¢), strongest on tricky poses and detail." },
    { id: "gemini-3.1-flash-image", label: "Nano Banana 2", note: "Previous generation; cheaper." },
  ],
  async generate(req, auth, signal) {
    const input: unknown[] = [];
    let i = 0;
    for (const img of req.images) {
      i += 1;
      input.push({
        type: "text",
        text: `IMAGE ${i} (${img.role === "character" ? "character reference" : "pose guide"}):`,
      });
      input.push({ type: "image", mime_type: img.blob.type || "image/png", data: await blobToBase64(img.blob) });
    }
    input.push({ type: "text", text: req.prompt });
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": auth.key,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: auth.model,
        input,
        response_format: {
          type: "image",
          mime_type: "image/png",
          aspect_ratio: req.aspect,
          image_size: req.quality === "draft" ? "1K" : req.quality === "best" ? "4K" : "2K",
        },
      }),
    });
    if (!res.ok) throw new Error(await failText(res));
    const json = (await res.json()) as Record<string, unknown>;
    // The finished picture is the LAST image: thinking models may emit
    // interim "thought" images first.
    const direct = json.output_image as { data?: string; mime_type?: string } | undefined;
    if (direct?.data) return [base64ToBlob(direct.data, direct.mime_type ?? "image/png")];
    const found = findImages(json);
    if (!found.length) throw new Error("Gemini answered without an image. It may have declined the request; try rewording.");
    const last = found[found.length - 1];
    return [base64ToBlob(last.data, last.mime)];
  },
};

// --------------------------------------------------------------- OpenAI --

/** both sides divisible by 16, as the API requires */
const OPENAI_SIZES: Record<AspectId, [string, string]> = {
  "1:1": ["1024x1024", "2048x2048"],
  "4:3": ["1280x960", "2048x1536"],
  "3:4": ["960x1280", "1536x2048"],
  "16:9": ["1536x864", "2048x1152"],
  "9:16": ["864x1536", "1152x2048"],
};

const openai: Provider = {
  id: "openai",
  label: "OpenAI",
  keyUrl: "https://platform.openai.com/api-keys",
  keyHint: "Needs an API key, and OpenAI may ask you to verify your organisation before image models work.",
  alpha: true,
  models: [
    { id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst", note: "Most precise edits and real transparent backgrounds." },
    { id: "gpt-image-2.6-sunburst", label: "GPT Image 2.6 Sunburst", note: "Newest and faster; check it is enabled on your account." },
    { id: "gpt-image-2.5-flare", label: "GPT Image 2.5 Flare", note: "Quick and cheaper, a little less exact." },
  ],
  async generate(req, auth, signal) {
    const form = new FormData();
    form.append("model", auth.model);
    form.append("prompt", req.prompt);
    req.images.forEach((img, i) => form.append("image[]", img.blob, `${i + 1}-${img.role}.png`));
    form.append("size", OPENAI_SIZES[req.aspect][req.quality === "draft" ? 0 : 1]);
    form.append("quality", req.quality === "draft" ? "low" : req.quality === "best" ? "high" : "medium");
    form.append("background", req.transparent ? "transparent" : "opaque");
    form.append("output_format", "png");
    form.append("n", "1");
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${auth.key}` },
      body: form,
    });
    if (!res.ok) throw new Error(await failText(res));
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const blobs = (json.data ?? []).filter((d) => d.b64_json).map((d) => base64ToBlob(d.b64_json as string, "image/png"));
    if (!blobs.length) throw new Error("OpenAI answered without an image.");
    return blobs;
  },
};

export const PROVIDERS: Record<ProviderId, Provider> = { gemini, openai };
