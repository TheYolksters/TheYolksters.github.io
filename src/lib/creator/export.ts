/**
 * YOLKSTER CREATOR — getting pictures and text OUT of the page:
 * SVG → PNG, the one-paste reference sheet, clipboard and downloads.
 *
 * Browser-only (canvas, clipboard). Nothing here talks to a server.
 */

export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image"))), type, quality),
  );

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = src;
  });
}

/**
 * Render an on-page <svg> to a canvas. The SVG must be self-contained
 * (presentation attributes only, no external images or page CSS) — the
 * doll is drawn that way for exactly this reason.
 */
export async function svgToCanvas(svg: SVGSVGElement, width: number, height: number, background = "#ffffff") {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  const xml = new XMLSerializer().serializeToString(clone);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/** load a picture (URL or object URL) onto a white canvas, optionally shrunk */
export async function imageToCanvas(src: string, maxSide = 1536, background: string | null = "#ffffff") {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface SheetPanel {
  /** big label: "CHARACTER" */
  title: string;
  /** small label: "keep identity and style" */
  note: string;
  canvas: HTMLCanvasElement;
}

/**
 * One image holding every reference, each in a labelled panel, so the whole
 * pack is a single paste. The labels match the words the prompt uses.
 */
export function buildSheet(panels: SheetPanel[]): HTMLCanvasElement {
  const H = 1024;
  const HEAD = 84;
  const GAP = 20;
  const PAD = 20;
  const widths = panels.map((p) => Math.round((p.canvas.width / p.canvas.height) * H));
  const W = PAD * 2 + widths.reduce((a, b) => a + b, 0) + GAP * (panels.length - 1);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = PAD * 2 + HEAD + H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.fillStyle = "#eef0f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = PAD;
  panels.forEach((p, i) => {
    const w = widths[i];
    ctx.fillStyle = "#1c2340";
    ctx.fillRect(x, PAD, w, HEAD);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.font = "bold 34px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(p.title, x + 22, PAD + HEAD * 0.36, w - 44);
    ctx.font = "22px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#c9d2f0";
    ctx.fillText(p.note, x + 22, PAD + HEAD * 0.74, w - 44);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, PAD + HEAD, w, H);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(p.canvas, x, PAD + HEAD, w, H);
    ctx.strokeStyle = "#1c2340";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, PAD + 1.5, w - 3, HEAD + H - 3);
    x += w + GAP;
  });
  return canvas;
}

// ---------------------------------------------------- clipboard / files --

export type CopyResult = "copied" | "downloaded";

/**
 * Put a PNG on the clipboard. Where the browser refuses (older Firefox, an
 * insecure LAN address, a denied permission) the image is downloaded
 * instead, so the user always ends up with the picture one way or another.
 */
export async function copyImage(make: () => Promise<Blob>, fallbackName: string): Promise<CopyResult> {
  const canClip =
    typeof navigator !== "undefined" && !!navigator.clipboard && typeof ClipboardItem !== "undefined";
  if (canClip) {
    try {
      // Safari only allows clipboard writes inside the click itself, so the
      // ClipboardItem is created right away with a promise for the pixels.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": make() })]);
      return "copied";
    } catch {
      /* fall through to a download */
    }
  }
  downloadBlob(await make(), fallbackName);
  return "downloaded";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("no clipboard");
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function base64ToBlob(b64: string, type = "image/png"): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}

/** a safe file name piece */
export const slug = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "yolkster";
