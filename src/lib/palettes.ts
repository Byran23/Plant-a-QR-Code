import { Color } from "three";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export interface Palette {
  id: SeasonId | "custom";
  baseId: SeasonId;
  label: string;
  /** CSS sky gradient (behind the transparent canvas) */
  sky: [string, string];
  /** Soft radial glow tint */
  glow: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  /** Light-module tiles in tree mode */
  grass: string[];
  /** Dark-module tiles in tree mode */
  dark: string[];
  /** Diorama base plate */
  soil: string;
  trunk: string[];
  foliage: string[];
  accent: string[];
  rock: string;
  foliageDensity: number;
  decorDensity: number;
  /** Flat QR mode tints — dark ink / light paper */
  qrDark: string;
  qrLight: string;
  finderDark: string;
  finderLight: string;
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
    label: "Sakura",
    sky: ["#f9f3ea", "#f5ebec"],
    glow: "rgba(255, 183, 200, 0.4)",
    fog: "#f5ece6",
    hemiSky: "#fff0f3",
    hemiGround: "#e8ded2",
    sun: "#fff8f2",
    grass: ["#89c053", "#9bd45c", "#73ad43", "#e899b8"],
    dark: ["#c84e62", "#b83d51", "#d85d71"],
    soil: "#442b1f",
    trunk: ["#5c4033", "#43281c", "#6b493b"],
    foliage: ["#ffb3c6", "#ff9ebb", "#ffc5d3", "#fa8fa8", "#ffdce5", "#ffa0b8"],
    accent: ["#ff9ebb", "#fa8fa8", "#ffdce5"],
    rock: "#b5b0a3",
    foliageDensity: 1.0,
    decorDensity: 1.0,
    qrDark: "#d64f64",
    qrLight: "#f4efe6",
    finderDark: "#529134",
    finderLight: "#eae4d8",
    particle: {
      kind: "petal",
      colors: ["#ffb3c6", "#ff9ebb", "#ffc5d3", "#fa8fa8", "#ffdce5"],
      count: 48,
    },
  },
  {
    id: "summer",
    baseId: "summer",
    label: "Summer",
    sky: ["#eef8ff", "#e0f2fe"],
    glow: "rgba(255, 240, 173, 0.4)",
    fog: "#e2f0f9",
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
    qrDark: "#235c34",
    qrLight: "#f0f8ef",
    finderDark: "#397d4c",
    finderLight: "#e3f0e1",
    particle: { kind: "firefly", colors: ["#fff7ae", "#ffe66d", "#ffeda0"], count: 36 },
  },
  {
    id: "autumn",
    baseId: "autumn",
    label: "Autumn",
    sky: ["#fff4e6", "#fcefe3"],
    glow: "rgba(255, 173, 92, 0.35)",
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
    qrDark: "#9c3714",
    qrLight: "#fcf4e8",
    finderDark: "#785f20",
    finderLight: "#f2e7d3",
    particle: { kind: "leaf", colors: ["#f97a2b", "#ef523e", "#f6a62c"], count: 48 },
  },
  {
    id: "winter",
    baseId: "winter",
    label: "Winter",
    sky: ["#f1f5fa", "#e8edf5"],
    glow: "rgba(214, 231, 255, 0.4)",
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
    qrDark: "#26364f",
    qrLight: "#f4f8fc",
    finderDark: "#3b5578",
    finderLight: "#e2ecf5",
    particle: { kind: "snow", colors: ["#ffffff", "#f2f7ff"], count: 70 },
  },
];

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

export function resolvePalette(
  season: number,
  customLeaf: string | null,
  customGround: string | null,
): Palette {
  const base = SEASONS[((season % SEASONS.length) + SEASONS.length) % SEASONS.length];
  const isCustom = Boolean(customLeaf || customGround);

  const p: Palette = {
    ...base,
    id: isCustom ? "custom" : base.id,
    label: isCustom ? "Custom" : base.label,
  };

  if (customLeaf) {
    p.qrDark = customLeaf;
    p.foliage = makeShades(customLeaf, [
      [-0.08, 0.02],
      [0, 0],
      [0.08, -0.04],
      [0.16, -0.06],
    ]);
  }

  if (customGround) {
    p.qrLight = customGround;
    p.grass = makeShades(customGround, [
      [0, 0.03],
      [0.08, 0],
      [-0.07, 0.05],
    ]);
  }

  return p;
}