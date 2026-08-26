import { Color } from "three";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export interface Palette {
  id: SeasonId | "custom";
  baseId: SeasonId;
  label: string;
  /** CSS sky gradient (behind the transparent canvas) */
  sky: [string, string];
  /** soft radial glow tint */
  glow: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  /** light-module tiles in tree mode */
  grass: string[];
  /** dark-module tiles in tree mode */
  dark: string[];
  /** diorama base plate */
  soil: string;
  trunk: string[];
  foliage: string[];
  accent: string[];
  rock: string;
  foliageDensity: number;
  decorDensity: number;
  /** flat QR mode tints — dark ink / light paper, season-tinted but
   *  always with enough luminance contrast to stay scannable */
  qrDark: string;
  qrLight: string;
  particle: {
    kind: "petal" | "firefly" | "leaf" | "snow";
    colors: string[];
    count: number;
  };
}

export const SEASONS: Palette[] = [
  {
    id: "spring",
    baseId: "spring",
    label: "Spring",
    sky: ["#bfe6ff", "#ffeef4"],
    glow: "rgba(255, 183, 213, 0.5)",
    fog: "#dcedf6",
    hemiSky: "#d9ecff",
    hemiGround: "#b9a68f",
    sun: "#fff2d9",
    grass: ["#94cf8e", "#a6d99b", "#85c47e"],
    dark: ["#3c6b46", "#2f5839", "#467550"],
    soil: "#6f4f38",
    trunk: ["#7d5537", "#8f6543"],
    foliage: ["#ffc2d6", "#ff9ec0", "#f783ac", "#ffd9e4"],
    accent: ["#fff6a8", "#ffffff", "#ffd166"],
    rock: "#a8b2ab",
    foliageDensity: 1,
    decorDensity: 1.25,
    qrDark: "#33202c",
    qrLight: "#fff6f9",
    particle: { kind: "petal", colors: ["#ffc2d6", "#ffb3ca", "#ffd9e4"], count: 70 },
  },
  {
    id: "summer",
    baseId: "summer",
    label: "Summer",
    sky: ["#7cc4ff", "#e6f8ff"],
    glow: "rgba(255, 240, 173, 0.55)",
    fog: "#cfeaf9",
    hemiSky: "#d6efff",
    hemiGround: "#a3977c",
    sun: "#fff6de",
    grass: ["#79c76c", "#8fd582", "#68b85d"],
    dark: ["#2b5233", "#24472b", "#336039"],
    soil: "#6b4c34",
    trunk: ["#6f4c2f", "#7f5a38"],
    foliage: ["#2fae5f", "#3ec96f", "#24924c", "#6fdd8b"],
    accent: ["#ff6b6b", "#ffffff", "#ffd93d"],
    rock: "#9aa69c",
    foliageDensity: 1,
    decorDensity: 1,
    qrDark: "#14261c",
    qrLight: "#f3fbf1",
    particle: { kind: "firefly", colors: ["#fff7ae", "#ffe66d", "#ffeda0"], count: 42 },
  },
  {
    id: "autumn",
    baseId: "autumn",
    label: "Autumn",
    sky: ["#ffd9a3", "#ffeadd"],
    glow: "rgba(255, 173, 92, 0.5)",
    fog: "#f6e2cd",
    hemiSky: "#ffe8c9",
    hemiGround: "#8f7a5c",
    sun: "#ffe9c2",
    grass: ["#cfae62", "#dabb74", "#c2a355"],
    dark: ["#5d462f", "#513d2a", "#6a5238"],
    soil: "#59402c",
    trunk: ["#6a4630", "#5a3b28"],
    foliage: ["#f97a2b", "#ef523e", "#f6a62c", "#d14a24"],
    accent: ["#e6494d", "#fff1c9", "#ffffff"],
    rock: "#99928a",
    foliageDensity: 0.9,
    decorDensity: 0.9,
    qrDark: "#301c0e",
    qrLight: "#fdf3e2",
    particle: { kind: "leaf", colors: ["#f97a2b", "#ef523e", "#f6a62c"], count: 62 },
  },
  {
    id: "winter",
    baseId: "winter",
    label: "Winter",
    sky: ["#a9c3e6", "#eef4fb"],
    glow: "rgba(214, 231, 255, 0.6)",
    fog: "#dde8f2",
    hemiSky: "#e8f0fb",
    hemiGround: "#8b95a8",
    sun: "#f2f6ff",
    grass: ["#f2f6fb", "#e7eef8", "#ffffff"],
    dark: ["#3b4560", "#313a52", "#454f6c"],
    soil: "#4b4152",
    trunk: ["#5f4638", "#4e3a2e"],
    foliage: ["#ffffff", "#e8f0fb", "#dbe7f7"],
    accent: ["#dbe7f5", "#ffffff", "#c7d8ee"],
    rock: "#9aa7ba",
    foliageDensity: 0.3,
    decorDensity: 0.45,
    qrDark: "#1d2536",
    qrLight: "#f5f9ff",
    particle: { kind: "snow", colors: ["#ffffff", "#f2f7ff"], count: 95 },
  },
];

/** Build a small family of shades around one hex colour. */
export function makeShades(hex: string, tweaks: Array<[number, number]>): string[] {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return tweaks.map(([dl, ds]) => {
    const n = new Color().setHSL(
      hsl.h,
      Math.min(1, Math.max(0, hsl.s + ds)),
      Math.min(0.95, Math.max(0.06, hsl.l + dl)),
    );
    return `#${n.getHexString()}`;
  });
}

/**
 * Resolve the effective palette: a season plus optional user-picked
 * foliage / ground colours. Custom colours flip the palette to "Custom".
 */
export function resolvePalette(
  season: number,
  customLeaf: string | null,
  customGround: string | null,
): Palette {
  const base = SEASONS[((season % SEASONS.length) + SEASONS.length) % SEASONS.length];
  if (!customLeaf && !customGround) return base;
  const p: Palette = { ...base, id: "custom", label: "Custom" };

  // keep the QR scannable: preserve hue/sat of the user's colours but pin
  // the lightness to a high-contrast ink / paper pair
  const ink = new Color(customLeaf ?? base.qrDark);
  const ihsl = { h: 0, s: 0, l: 0 };
  ink.getHSL(ihsl);
  p.qrDark = `#${new Color().setHSL(ihsl.h, Math.min(0.55, ihsl.s * 0.8 + 0.12), 0.145).getHexString()}`;
  const paper = new Color(customGround ?? base.qrLight);
  const phsl = { h: 0, s: 0, l: 0 };
  paper.getHSL(phsl);
  p.qrLight = `#${new Color().setHSL(phsl.h, Math.min(0.35, phsl.s * 0.55), 0.945).getHexString()}`;

  if (customLeaf) {
    p.foliage = makeShades(customLeaf, [
      [-0.12, 0.02],
      [0, 0],
      [0.1, -0.04],
      [0.2, -0.08],
    ]);
  }
  if (customGround) {
    p.grass = makeShades(customGround, [
      [0, 0.03],
      [0.08, 0],
      [-0.07, 0.05],
    ]);
    p.dark = makeShades(customGround, [
      [-0.34, 0.06],
      [-0.4, 0.08],
      [-0.28, 0.04],
    ]);
  }
  return p;
}
