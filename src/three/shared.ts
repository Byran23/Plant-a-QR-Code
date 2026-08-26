/**
 * Shared, mutable morph state. `p` goes 0 → 1 when the scene flattens
 * from the 3D tree into the scannable top-down QR code.
 * Damped once per frame inside <Rig/> and read by every animated child.
 */
export const morph = { p: 0 };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const smooth01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

export const easeOutBack = (v: number) => {
  const t = clamp01(v);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
