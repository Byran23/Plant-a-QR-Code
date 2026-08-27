import { Color } from "three";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export interface Palette {
  id: SeasonId | "editable";
  baseId: SeasonId;
  label: string;
  sky: [string, string];
  glow: string;
  sunGlow: string;
  ridgeFar: string;
  ridgeNear: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  grass: string[];
  dark: string[];
  soil: string;
  trunk: string[];
  foliage: string[];
  accent: string[];
  rock: string;
  foliageDensity: number;
  decorDensity: number;
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
    sky: ["#fbe9ee", "#edd5dc"],
    glow: "rgba(255, 183, 200, 0.45)",
    sunGlow: "rgba(255, 230, 235, 0.9)",
    ridgeFar: "rgba(224, 187, 198, 0.38)",
    ridgeNear: "rgba(209, 168, 180, 0.45)",
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
    sky: ["#bfe3f7", "#e1f3fd"],
    glow: "rgba(255, 226, 130, 0.42)",
    sunGlow: "rgba(255, 248, 204, 0.95)",
    ridgeFar: "rgba(142, 196, 228, 0.42)",
    ridgeNear: "rgba(102, 172, 212, 0.48)",
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
    sky: ["#fae0c9", "#ebd0b9"],
    glow: "rgba(249, 115, 22, 0.35)",
    sunGlow: "rgba(255, 237, 213, 0.9)",
    ridgeFar: "rgba(209, 150, 115, 0.4)",
    ridgeNear: "rgba(184, 117, 78, 0.48)",
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
    sky: ["#e1ecf7", "#cde0f1"],
    glow: "rgba(186, 217, 250, 0.45)",
    sunGlow: "rgba(255, 255, 255, 0.95)",
    ridgeFar: "rgba(176, 200, 224, 0.45)",
    ridgeNear: "rgba(148, 178, 207, 0.52)",
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
  editableLeaf: string | null,
  editableGround: string | null,
  customThemeLabel?: string,
): Palette {
  const base = SEASONS[((season % SEASONS.length) + SEASONS.length) % SEASONS.length];
  const isEditable = Boolean(editableLeaf || editableGround);

  const p: Palette = {
    ...base,
    id: isEditable ? "editable" : base.id,
    label: isEditable ? (customThemeLabel?.trim() || "Editable") : base.label,
  };

  if (editableLeaf) {
    p.qrDark = editableLeaf;
    p.foliage = makeShades(editableLeaf, [
      [-0.08, 0.02],
      [0, 0],
      [0.08, -0.04],
      [0.16, -0.06],
    ]);
  }

  if (editableGround) {
    p.qrLight = editableGround;
    p.grass = makeShades(editableGround, [
      [0, 0.03],
      [0.08, 0],
      [-0.07, 0.05],
    ]);
  }

  return p;
}