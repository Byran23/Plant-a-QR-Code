import * as QRCode from "qrcode";

/** Quiet zone (in modules) around the real QR matrix — scanners want 4. */
export const QUIET = 4;

export interface QRGrid {
  /** real module count per side (without quiet zone) */
  size: number;
  /** total tiles per side including quiet zone */
  total: number;
  /** row-major 0/1, 1 = dark module */
  data: Uint8Array;
  text: string;
}

export function buildGrid(text: string): QRGrid {
  // Using 'H' (High - ~30% recovery) so artistic canopy/decorations remain robustly scannable
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const total = size + QUIET * 2;
  const data = new Uint8Array(total * total);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) data[(r + QUIET) * total + (c + QUIET)] = 1;
    }
  }
  return { size, total, data, text };
}

/**
 * The central patch of the matrix that the tree's canopy is responsible for.
 * Coordinates are in total-grid space (including the quiet zone).
 */
export interface ForestZone {
  x0: number;
  z0: number;
  n: number;
}

export function computeZone(size: number): ForestZone {
  const center = (size - 1) / 2;
  // Expands the canopy zone to cover more of the central QR matrix
  // while staying safely inside the 3 finder patterns (7x7 corner targets)
  let w = Math.min(Math.floor(size / 2) - 6, 8);
  if (w < 1) w = Math.max(1, Math.floor(size / 2) - 1);
  const n = Math.max(3, 2 * w + 1);
  const start = center - (n - 1) / 2 + QUIET;
  return { x0: start, z0: start, n };
}

/** Download a clean, high-resolution PNG with custom sakura styling defaults. */
export async function downloadPng(
  text: string,
  dark = "#d35252", // Sakura QR dark tone matching the rendered palette
  light = "#f5f3e9", // Warm stone-white background matching the floor tiles
): Promise<void> {
  const url = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1200,
    color: { dark, light },
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = "sakura-qr-tree.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ------------------------------------------------------------------ */
/* Shareable hash state — everything lives client-side, in the URL.    */
/* ------------------------------------------------------------------ */

export interface ShareState {
  url: string | null;
  season: number | null;
  leaf: string | null;
  ground: string | null;
  salt: number;
}

const HEX = /^#?([0-9a-f]{6})$/i;

export function readHash(): ShareState {
  const out: ShareState = { url: null, season: null, leaf: null, ground: null, salt: 0 };
  try {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return out;
    const p = new URLSearchParams(raw);
    const u = p.get("u");
    if (u) out.url = u;
    const s = p.get("s");
    if (s !== null && !Number.isNaN(Number(s))) out.season = Number(s);
    const lf = p.get("lf");
    if (lf && HEX.test(lf)) out.leaf = `#${lf.replace("#", "").toLowerCase()}`;
    const gd = p.get("gd");
    if (gd && HEX.test(gd)) out.ground = `#${gd.replace("#", "").toLowerCase()}`;
    const r = p.get("r");
    if (r !== null && !Number.isNaN(Number(r))) out.salt = Number(r);
  } catch {
    /* ignore malformed hashes */
  }
  return out;
}

export function writeHash(s: ShareState): void {
  const p = new URLSearchParams();
  if (s.url) p.set("u", s.url);
  if (s.season !== null) p.set("s", String(s.season));
  if (s.leaf) p.set("lf", s.leaf.replace("#", ""));
  if (s.ground) p.set("gd", s.ground.replace("#", ""));
  if (s.salt) p.set("r", String(s.salt));
  window.history.replaceState(null, "", `#${p.toString()}`);
}