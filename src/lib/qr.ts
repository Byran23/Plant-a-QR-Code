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
 * Ultra-compact URL-safe encoder/masker:
 * Cleans http/https boilerplate where possible and strips padding.
 */
export function maskUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  let clean = rawUrl.trim();

  // Strip standard prefixes to shave characters
  let prefixFlag = "0";
  if (clean.startsWith("https://")) {
    prefixFlag = "s";
    clean = clean.slice(8);
  } else if (clean.startsWith("http://")) {
    prefixFlag = "h";
    clean = clean.slice(7);
  }

  try {
    const b64 = btoa(encodeURIComponent(clean))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `${prefixFlag}${b64}`;
  } catch {
    return encodeURIComponent(rawUrl);
  }
}

export function unmaskUrl(masked: string): string {
  if (!masked) return "";
  const prefixFlag = masked[0];
  const payload = masked.slice(1);

  let prefix = "";
  if (prefixFlag === "s") prefix = "https://";
  else if (prefixFlag === "h") prefix = "http://";

  try {
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const decoded = decodeURIComponent(atob(base64));
    return prefix ? `${prefix}${decoded}` : decoded;
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
 * Reads compact hash parameters
 */
export function readHash(): ShareState {
  if (typeof window === "undefined") return { salt: 0 };
  const rawHash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(rawHash || window.location.search);

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
 * Writes compressed parameters to the hash
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