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
 * Ultra-compact single payload packer:
 * Combines URL, Banner Text, and Theme Label into a single masked string separated by delimiters (\x1f / Unit Separator).
 */
export function packData(rawUrl: string, bannerText?: string, label?: string): string {
  if (!rawUrl && !bannerText && !label) return "";

  let cleanUrl = (rawUrl || "").trim();
  let prefixFlag = "0";
  if (cleanUrl.startsWith("https://")) {
    prefixFlag = "s";
    cleanUrl = cleanUrl.slice(8);
  } else if (cleanUrl.startsWith("http://")) {
    prefixFlag = "h";
    cleanUrl = cleanUrl.slice(7);
  }

  const bt = (bannerText && bannerText !== "Bryan R. Cañaveral") ? bannerText.trim() : "";
  const lbl = (label && label !== "Editable") ? label.trim() : "";

  // Pack as: [prefixFlag][cleanUrl] ~ [bt] ~ [lbl]
  const rawPayload = `${prefixFlag}${cleanUrl}\x1f${bt}\x1f${lbl}`;

  try {
    return btoa(encodeURIComponent(rawPayload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch {
    return encodeURIComponent(rawPayload);
  }
}

/**
 * Unpacks the combined masked string into { url, bannerText, label }
 */
export function unpackData(packed: string): { url?: string; bannerText?: string; label?: string } {
  if (!packed) return {};

  try {
    let base64 = packed.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const decoded = decodeURIComponent(atob(base64));
    const parts = decoded.split("\x1f");

    const urlPart = parts[0] || "";
    const bannerText = parts[1] || undefined;
    const label = parts[2] || undefined;

    let url: string | undefined = undefined;
    if (urlPart) {
      const prefixFlag = urlPart[0];
      const cleanUrl = urlPart.slice(1);
      let prefix = "";
      if (prefixFlag === "s") prefix = "https://";
      else if (prefixFlag === "h") prefix = "http://";
      url = prefix ? `${prefix}${cleanUrl}` : cleanUrl;
    }

    return { url, bannerText, label };
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

/**
 * Reads hash parameters, extracting the joined payload from `m`
 */
export function readHash(): ShareState {
  if (typeof window === "undefined") return { salt: 0 };
  const rawHash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(rawHash || window.location.search);

  const maskedParam = params.get("m");
  const unpacked = maskedParam ? unpackData(maskedParam) : {};

  const resolvedUrl = unpacked.url ?? params.get("u") ?? undefined;
  const resolvedBannerText = unpacked.bannerText ?? params.get("bt") ?? undefined;
  const resolvedLabel = unpacked.label ?? params.get("lbl") ?? undefined;

  const s = params.get("s");
  const lf = params.get("lf");
  const gd = params.get("gd");
  const r = params.get("r");
  const bc = params.get("bc");

  return {
    url: resolvedUrl,
    season: s !== null ? Number(s) : undefined,
    leaf: lf ? `#${lf}` : null,
    ground: gd ? `#${gd}` : null,
    salt: r !== null ? Number(r) : 0,
    label: resolvedLabel,
    bannerText: resolvedBannerText,
    bannerColor: bc ? `#${bc}` : undefined,
  };
}

/**
 * Writes unified packed state to the browser hash
 */
export function writeHash(state: ShareState) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();

  // Pack URL, bannerText, and label into a single `m` key
  if (state.url || state.bannerText || state.label) {
    const packed = packData(state.url || "", state.bannerText, state.label);
    if (packed) params.set("m", packed);
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
  if (state.bannerColor && state.bannerColor.toLowerCase() !== "#e11d48") {
    params.set("bc", state.bannerColor.replace("#", ""));
  }

  const hashStr = params.toString();
  if (hashStr) {
    window.history.replaceState(null, "", `#${hashStr}`);
  } else {
    window.history.replaceState(null, "", window.location.pathname);
  }
}