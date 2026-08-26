import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ForestZone, QRGrid } from "../lib/qr";
import type { Palette } from "../lib/palettes";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

/**
 * Garden camouflage: every dark QR module outside the tree's forest zone is
 * disguised as a bush, rock cluster, flower shrub or fern. Light modules get
 * sparse decoys so the pattern dissolves into a garden. On flatten, each
 * primary cube lands on its module tile and turns QR-dark.
 */

interface CoverVoxel {
  ox: number;
  oy: number;
  oz: number;
  sx: number;
  sy: number;
  sz: number;
  fx: number;
  fz: number;
  pool: number; // 0 bush greens · 1 rocks · 2 accents · 3 tuft greens
  ci: number;
  primary: boolean;
  rot: number;
  u: number;
}

const FLAT_TOP = 0.14;
const FLAT_Y = FLAT_TOP + 0.085;
const tmp = new THREE.Object3D();
const col = new THREE.Color();

function generateCovers(seed: number, grid: QRGrid, zone: ForestZone): CoverVoxel[] {
  const rng = mulberry32(seed ^ 0x51ab9);
  const total = grid.total;
  const half = (total - 1) / 2;
  const items: CoverVoxel[] = [];

  const inZone = (r: number, c: number) =>
    r >= zone.z0 && r < zone.z0 + zone.n && c >= zone.x0 && c < zone.x0 + zone.n;

  // count out-of-zone dark modules to decide how lavish decorations may be
  let darkOut = 0;
  for (let i = 0; i < total * total; i++) {
    if (grid.data[i] === 1) {
      const r = Math.floor(i / total);
      if (!inZone(r, i - r * total)) darkOut++;
    }
  }
  const rich = darkOut <= 680;
  const decoyChance = rich ? 0.16 : 0.07;

  const put = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    pool: number,
    primary: boolean,
  ) =>
    items.push({
      ox: x,
      oy: y,
      oz: z,
      sx,
      sy,
      sz,
      fx: x,
      fz: z,
      pool,
      ci: pickIndex(rng, 3),
      primary,
      rot: (rng() * Math.PI) / 2 - Math.PI / 4,
      u: rng(),
    });

  const jx = () => (rng() - 0.5) * 0.5;
  const TOP = 0.58;

  for (let r = 0; r < total; r++) {
    for (let c = 0; c < total; c++) {
      if (inZone(r, c)) continue;
      const dark = grid.data[r * total + c] === 1;
      const mx = c - half;
      const mz = r - half;

      if (dark) {
        const roll = rng();
        if (roll < 0.34) {
          // leafy bush
          const s = 0.8 + rng() * 0.3;
          put(mx + jx() * 0.5, TOP + s * 0.34, mz + jx() * 0.5, s, s * 0.92, s, 0, true);
          if (rich) {
            const n = 2 + Math.floor(rng() * 2);
            for (let k = 0; k < n; k++) {
              const s2 = 0.34 + rng() * 0.3;
              put(
                mx + jx() * 1.6,
                TOP + s * 0.55 + rng() * 0.35,
                mz + jx() * 1.6,
                s2,
                s2,
                s2,
                0,
                false,
              );
            }
            if (rng() < 0.3) {
              const sb = 0.2;
              put(mx + jx(), TOP + s * 0.95, mz + jx(), sb, sb, sb, 2, false);
            }
          }
        } else if (roll < 0.56) {
          // rock formation
          const s = 0.55 + rng() * 0.38;
          put(mx + jx() * 0.4, TOP + s * 0.24, mz + jx() * 0.4, s, s * 0.6, s, 1, true);
          if (rich && rng() < 0.6) {
            const s2 = 0.24 + rng() * 0.18;
            put(mx + jx() * 1.4, TOP + s2 * 0.2, mz + jx() * 1.4, s2, s2 * 0.6, s2, 1, false);
          }
          if (rich && rng() < 0.35) {
            put(mx + jx(), TOP + s * 0.55, mz + jx(), 0.16, 0.3 + rng() * 0.2, 0.16, 3, false);
          }
        } else if (roll < 0.8) {
          // flowering shrub
          const s = 0.62 + rng() * 0.2;
          put(mx + jx() * 0.5, TOP + s * 0.3, mz + jx() * 0.5, s, s * 0.62, s, 3, true);
          const heads = rich ? 2 + Math.floor(rng() * 2) : 1;
          for (let k = 0; k < heads; k++) {
            const hx = mx + jx() * 1.5;
            const hz = mz + jx() * 1.5;
            const hd = 0.62 + rng() * 0.25;
            put(hx, TOP + hd, hz, 0.08, hd, 0.08, 3, false);
            put(hx, TOP + hd + 0.12, hz, 0.24, 0.2, 0.24, 2, false);
          }
        } else {
          // fern / tall blades
          const h = 0.75 + rng() * 0.35;
          put(mx + jx() * 0.4, TOP + h * 0.42, mz + jx() * 0.4, 0.3, h, 0.3, 3, true);
          if (rich) {
            const n = 2 + Math.floor(rng() * 2);
            for (let k = 0; k < n; k++) {
              const h2 = h * (0.4 + rng() * 0.4);
              put(mx + jx() * 1.3, TOP + h2 * 0.42, mz + jx() * 1.3, 0.14, h2, 0.14, 3, false);
            }
          }
        }
      } else if (rng() < decoyChance) {
        // decoys on light modules — they melt away when the code assembles
        const roll = rng();
        if (roll < 0.38) {
          const s = 0.22 + rng() * 0.16;
          put(mx + jx() * 1.2, TOP + s * 0.2, mz + jx() * 1.2, s, s * 0.55, s, 1, false);
        } else if (roll < 0.72) {
          const hd = 0.5 + rng() * 0.25;
          put(mx + jx() * 1.1, TOP + hd / 2, mz + jx() * 1.1, 0.07, hd, 0.07, 3, false);
          put(mx, TOP + hd + 0.1, mz, 0.22, 0.18, 0.22, 2, false);
        } else {
          put(mx + jx(), TOP + 0.2, mz + jx(), 0.1, 0.4 + rng() * 0.25, 0.1, 3, false);
          put(mx + jx(), TOP + 0.16, mz + jx(), 0.09, 0.32 + rng() * 0.2, 0.09, 3, false);
        }
      }
    }
  }
  return items;
}

export default function Covers({
  grid,
  zone,
  palette,
  seed,
}: {
  grid: QRGrid;
  zone: ForestZone;
  palette: Palette;
  seed: number;
}) {
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.16), []);
  const items = useMemo(() => generateCovers(seed, grid, zone), [seed, grid, zone]);

  const pools = useMemo(() => {
    const one = new THREE.Color();
    return [
      palette.dark.map((c) => new THREE.Color(c)),
      [new THREE.Color(palette.rock), one.clone().set(palette.rock).offsetHSL(0, 0, 0.09)],
      palette.accent.map((c) => new THREE.Color(c)),
      palette.grass.map((g) => one.clone().set(g).offsetHSL(0, 0.02, -0.16)),
    ];
  }, [palette]);
  const qrDark = useMemo(() => new THREE.Color(palette.qrDark), [palette]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ intro: 0, lastP: -1, dirty: true });

  useEffect(() => {
    st.current.intro = 0;
    st.current.dirty = true;
  }, [seed, grid]);
  useLayoutEffect(() => {
    st.current.dirty = true;
  }, [items, pools]);

  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    s.intro = Math.min(1, s.intro + dt * 0.8);
    const p = morph.p;
    if (!s.dirty && Math.abs(p - s.lastP) < 0.0005 && s.intro >= 1) return;
    s.dirty = false;
    s.lastP = p;
    const q = smooth01(p);

    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      const grow = easeOutBack(clamp01((s.intro * 1.3 - v.u * 0.35) / 0.5));
      tmp.position.set(
        v.ox + (v.fx - v.ox) * q,
        v.oy + (FLAT_Y - v.oy) * q,
        v.oz + (v.fz - v.oz) * q,
      );
      const sx = v.sx + ((v.primary ? 0.96 : 0.0001) - v.sx) * q;
      const sy = v.sy + ((v.primary ? 0.16 : 0.0001) - v.sy) * q;
      const sz = v.sz + ((v.primary ? 0.96 : 0.0001) - v.sz) * q;
      tmp.scale.set(
        Math.max(0.0001, sx * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sz * grow),
      );
      tmp.rotation.set(0, v.rot * (1 - q), 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      const pool = pools[v.pool];
      col.copy(pool[v.ci % pool.length]);
      if (v.primary) col.lerp(qrDark, q);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geo, undefined, items.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    >
      <meshStandardMaterial roughness={0.88} />
    </instancedMesh>
  );
}
