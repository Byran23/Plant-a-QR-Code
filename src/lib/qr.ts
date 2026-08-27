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

const SEP = "\x1e"; // Record separator for minimum byte overhead

/**
 * Packs all state variables into a single URL-safe string.
 * Structure: [flags, url, bannerText, label, leafHex, groundHex, bannerColorHex, salt]
 */
export function packState(state: ShareState): string {
  let url = (state.url || "").trim();
  let proto = 0; // 0: raw, 1: https://, 2: http://, 3: https://www.

  if (url.startsWith("https://www.")) {
    proto = 3;
    url = url.slice(12);
  } else if (url.startsWith("https://")) {
    proto = 1;
    url = url.slice(8);
  } else if (url.startsWith("http://")) {
    proto = 2;
    url = url.slice(7);
  }

  const s = state.season ?? 0;
  const bt = state.bannerText && state.bannerText !== "Bryan R. Cañaveral" ? state.bannerText.trim() : "";
  const lbl = state.label && state.label !== "Editable" ? state.label.trim() : "";
  const lf = state.leaf ? state.leaf.replace("#", "") : "";
  const gd = state.ground ? state.ground.replace("#", "") : "";
  const bc = state.bannerColor && state.bannerColor.toLowerCase() !== "#e11d48" ? state.bannerColor.replace("#", "") : "";
  const r = state.salt ? state.salt.toString(36) : "";

  // Combine into a compact array, trimming empty trailing elements
  const items = [`${proto}${s}`, url, bt, lbl, lf, gd, bc, r];
  while (items.length > 2 && items[items.length - 1] === "") {
    items.pop();
  }

  const raw = items.join(SEP);
  try {
    return btoa(encodeURIComponent(raw))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch {
    return encodeURIComponent(raw);
  }
}

/**
 * Unpacks the ultra-compact `#z=` payload back to ShareState
 */
export function unpackState(packed: string): Partial<ShareState> {
  if (!packed) return {};
  try {
    let base64 = packed.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const raw = decodeURIComponent(atob(base64));
    const parts = raw.split(SEP);

    const flags = parts[0] || "00";
    const proto = parseInt(flags[0] || "0", 10);
    const season = parseInt(flags.slice(1) || "0", 10);

    let url = parts[1] || "";
    if (url) {
      if (proto === 1) url = `https://${url}`;
      else if (proto === 2) url = `http://${url}`;
      else if (proto === 3) url = `https://www.${url}`;
    }

    const bannerText = parts[2] || undefined;
    const label = parts[3] || undefined;
    const leaf = parts[4] ? `#${parts[4]}` : null;
    const ground = parts[5] ? `#${parts[5]}` : null;
    const bannerColor = parts[6] ? `#${parts[6]}` : undefined;
    const salt = parts[7] ? parseInt(parts[7], 36) : 0;

    return { url, season, bannerText, label, leaf, ground, bannerColor, salt };
  } catch {
    return {};
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

export function readHash(): ShareState {
  if (typeof window === "undefined") return { salt: 0 };
  const rawHash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(rawHash || window.location.search);

  const z = params.get("z");
  if (z) {
    const unpacked = unpackState(z);
    return {
      url: unpacked.url,
      season: unpacked.season,
      leaf: unpacked.leaf ?? null,
      ground: unpacked.ground ?? null,
      salt: unpacked.salt ?? 0,
      label: unpacked.label,
      bannerText: unpacked.bannerText,
      bannerColor: unpacked.bannerColor,
    };
  }

  // Fallback for legacy parameters
  const rawParam = params.get("u");
  const s = params.get("s");
  const lf = params.get("lf");
  const gd = params.get("gd");
  const r = params.get("r");
  const bt = params.get("bt");
  const bc = params.get("bc");
  const lbl = params.get("lbl");

  return {
    url: rawParam ?? undefined,
    season: s !== null ? Number(s) : undefined,
    leaf: lf ? `#${lf}` : null,
    ground: gd ? `#${gd}` : null,
    salt: r !== null ? Number(r) : 0,
    label: lbl ?? undefined,
    bannerText: bt ?? undefined,
    bannerColor: bc ? `#${bc}` : undefined,
  };
}

export function writeHash(state: ShareState) {
  if (typeof window === "undefined") return;
  const packed = packState(state);
  if (packed) {
    window.history.replaceState(null, "", `#z=${packed}`);
  } else {
    window.history.replaceState(null, "", window.location.pathname);
  }
}