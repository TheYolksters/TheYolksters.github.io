/**
 * YOLKSTER CREATOR — remembering things in the browser.
 *
 * - the current design is autosaved, so a reload picks up where you were
 * - a design can be packed into a link and sent to a teammate
 * - an API key (optional) lives in THIS browser only and is never part of a
 *   share link or of the site
 */

import { repairDesign, type Design } from "./design";
import type { ProviderId, Quality } from "./providers";

const DESIGN_KEY = "yolkster-creator:design:v1";
const API_KEY = "yolkster-creator:api:v1";
const HASH = "d=";

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback; // private windows and blocked storage throw
  }
};

// base64url of UTF-8 JSON
const pack = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unpack = (packed: string) => {
  const b64 = packed.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** a design from the page address, if someone opened a share link */
export function designFromHash(hash: string): Design | null {
  const h = hash.replace(/^#/, "");
  if (!h.startsWith(HASH)) return null;
  return safe(() => repairDesign(JSON.parse(unpack(h.slice(HASH.length)))), null);
}

export function shareLink(d: Design): string {
  const url = new URL(window.location.href);
  url.hash = HASH + pack(JSON.stringify(d));
  return url.toString();
}

export const loadDesign = (): Design | null =>
  safe(() => {
    const raw = window.localStorage.getItem(DESIGN_KEY);
    return raw ? repairDesign(JSON.parse(raw)) : null;
  }, null);

export const saveDesign = (d: Design) =>
  safe(() => window.localStorage.setItem(DESIGN_KEY, JSON.stringify(d)), undefined);

export const clearDesign = () => safe(() => window.localStorage.removeItem(DESIGN_KEY), undefined);

// ------------------------------------------------------------------ API --

export interface ApiSettings {
  provider: ProviderId;
  model: Record<ProviderId, string>;
  key: Record<ProviderId, string>;
  quality: Quality;
  /** keep the key after the tab closes */
  remember: boolean;
}

export const DEFAULT_API: ApiSettings = {
  provider: "gemini",
  model: { gemini: "gemini-nano-banana-2.1", openai: "gpt-image-2.5-sunburst" },
  key: { gemini: "", openai: "" },
  quality: "standard",
  remember: false,
};

export function loadApi(): ApiSettings {
  const read = (store: Storage | undefined) =>
    safe(() => {
      const raw = store?.getItem(API_KEY);
      return raw ? (JSON.parse(raw) as Partial<ApiSettings>) : null;
    }, null);
  const saved = read(safe(() => window.localStorage, undefined)) ?? read(safe(() => window.sessionStorage, undefined));
  if (!saved) return DEFAULT_API;
  return {
    provider: saved.provider === "openai" ? "openai" : "gemini",
    model: { ...DEFAULT_API.model, ...(saved.model ?? {}) },
    key: { ...DEFAULT_API.key, ...(saved.key ?? {}) },
    quality: saved.quality === "draft" || saved.quality === "best" ? saved.quality : "standard",
    remember: saved.remember === true,
  };
}

/** "remember" keeps the key on this device; otherwise it is gone when the tab closes */
export function saveApi(s: ApiSettings) {
  safe(() => {
    const json = JSON.stringify(s);
    if (s.remember) {
      window.localStorage.setItem(API_KEY, json);
      window.sessionStorage.removeItem(API_KEY);
    } else {
      window.sessionStorage.setItem(API_KEY, json);
      window.localStorage.removeItem(API_KEY);
    }
  }, undefined);
}
