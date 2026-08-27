import QRCode from "qrcode";

export interface QRGrid {
  text: string;
  size: number;
  total: number;
  data: Uint8Array;
}

export interface ShareState {
  url?: string;
  season?: number;
  leaf?: string | null;
  ground?: string | null;
  salt: number;
  label?: string;
  bannerText?: string;
  bannerColor?: string;
}

/**
 * URL-safe Base64 obfuscation/masking
 */
export function maskUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const encoded = btoa(encodeURIComponent(rawUrl));
    // Make URL-safe and trim padding
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return encodeURIComponent(rawUrl);
  }
}

export function unmaskUrl(masked: string): string {
  if (!masked) return "";
  try {
    // Restore base64 standard characters
    let base64 = masked.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return decodeURIComponent(atob(base64));
  } catch {
    try {
      return decodeURIComponent(masked);
    } catch {
      return masked;
    }
  }
}

export function buildGrid(text: string): QRGrid {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      data[r * size + c] = qr.modules.get(r, c) ? 1 : 0;
    }
  }
  return { text, size, total: size, data };
}

export function computeZone(size: number) {
  return { n: size };
}

export async function downloadPng(text: string, darkColor: string, lightColor: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, {
    width: 1024,
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `qrcode-${Date.now()}.png`;
  a.click();
}

/**
 * Reads hash/query parameters, supporting both masked (m) and legacy (u) URLs
 */
export function readHash(): ShareState {
  if (typeof window === "undefined") return { salt: 0 };
  const rawHash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(rawHash || window.location.search);

  // Read masked link first, fallback to raw `u` if present
  const maskedParam = params.get("m");
  const rawParam = params.get("u");
  const resolvedUrl = maskedParam ? unmaskUrl(maskedParam) : rawParam ?? undefined;

  const s = params.get("s");
  const lf = params.get("lf");
  const gd = params.get("gd");
  const r = params.get("r");
  const lbl = params.get("lbl");
  const bt = params.get("bt");
  const bc = params.get("bc");

  return {
    url: resolvedUrl,
    season: s !== null ? Number(s) : undefined,
    leaf: lf ? `#${lf}` : null,
    ground: gd ? `#${gd}` : null,
    salt: r !== null ? Number(r) : 0,
    label: lbl ?? undefined,
    bannerText: bt ?? undefined,
    bannerColor: bc ? `#${bc}` : undefined,
  };
}

/**
 * Writes share parameters to URL hash using the masked parameter `m`
 */
export function writeHash(state: ShareState) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();

  if (state.url) {
    params.set("m", maskUrl(state.url));
  }
  if (state.season !== undefined && state.season !== 0) {
    params.set("s", String(state.season));
  }
  if (state.leaf) {
    params.set("lf", state.leaf.replace("#", ""));
  }
  if (state.ground) {
    params.set("gd", state.ground.replace("#", ""));
  }
  if (state.salt) {
    params.set("r", String(state.salt));
  }
  if (state.label && state.label !== "Editable") {
    params.set("lbl", state.label);
  }
  if (state.bannerText && state.bannerText !== "Bryan R. Cañaveral") {
    params.set("bt", state.bannerText);
  }
  if (state.bannerColor && state.bannerColor !== "#e11d48") {
    params.set("bc", state.bannerColor.replace("#", ""));
  }

  const hashStr = params.toString();
  if (hashStr) {
    window.history.replaceState(null, "", `#${hashStr}`);
  } else {
    window.history.replaceState(null, "", window.location.pathname);
  }
}