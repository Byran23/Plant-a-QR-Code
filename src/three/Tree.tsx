import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Palette } from "../lib/palettes";
import type { ForestZone, QRGrid } from "../lib/qr";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

interface Voxel {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  c: number;
  u: number;
}

/**
 * A canopy cube. If `pale` is false it *is* one dark QR module: in tree mode
 * it floats organically in the crown, and on flatten it descends exactly onto
 * its module tile and turns QR-dark. Decorative (`pale`) cubes vanish instead.
 */
interface CanopyVoxel {
  ox: number;
  oy: number;
  oz: number;
  os: number;
  fx: number;
  fz: number;
  ci: number;
  pale: boolean;
  rot: number;
  u: number;
}

interface TreeData {
  trunk: Voxel[];
  canopy: CanopyVoxel[];
  flowerHeads: Voxel[];
  flowerStems: Voxel[];
  tufts: Voxel[];
  rocks: Voxel[];
  shroomStems: Voxel[];
  shroomCaps: Voxel[];
}

const FLAT_TILE_TOP = 0.14; // matches the ground's flattened tile height

function generateTree(seed: number, grid: QRGrid, zone: ForestZone): TreeData {
  const rng = mulberry32(seed);
  const d: TreeData = {
    trunk: [],
    canopy: [],
    flowerHeads: [],
    flowerStems: [],
    tufts: [],
    rocks: [],
    shroomStems: [],
    shroomCaps: [],
  };
  const push = (
    arr: Voxel[],
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: number,
  ) => arr.push({ x, y, z, sx, sy, sz, c, u: rng() });

  const half = (grid.total - 1) / 2;
  const H = (zone.n >= 11 ? 8 : zone.n >= 7 ? 7 : 5) + Math.floor(rng() * 2);

  // trunk — chunky tapered column with a gentle gnarl
  let leanX = 0;
  let leanZ = 0;
  for (let y = 0; y < H; y++) {
    const w = y < 2 ? 3.0 : y < H - 2 ? 2.1 : 1.3;
    leanX += (rng() - 0.5) * 0.14;
    leanZ += (rng() - 0.5) * 0.14;
    push(d.trunk, leanX, y + 0.5, leanZ, w, 1.04, w, rng() < 0.5 ? 0 : 1);
  }
  // root flares
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + rng() * 0.8;
    push(
      d.trunk,
      Math.cos(a) * 1.72,
      0.34,
      Math.sin(a) * 1.72,
      0.72 + rng() * 0.3,
      0.66,
      0.72 + rng() * 0.3,
      1,
    );
  }

  // branches — golden-angle spiral scaffolding inside the crown
  const GOLDEN = 2.399963;
  const K = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < K; i++) {
    const az = i * GOLDEN + rng() * 0.7;
    const startY = H * (0.45 + rng() * 0.45);
    const slope = 0.35 + rng() * 0.55;
    const len = 2.6 + rng() * (zone.n * 0.44);
    const dx = Math.cos(az);
    const dz = Math.sin(az);
    const inv = 1 / Math.hypot(dx, slope, dz);
    let px = 0;
    let py = startY + 0.5;
    let pz = 0;
    const steps = Math.ceil(len * 1.6);
    for (let s = 0; s < steps; s++) {
      px += dx * inv * 0.75;
      py += slope * inv * 0.75;
      pz += dz * inv * 0.75;
      const size = Math.max(0.38, 0.85 - s * 0.07);
      push(d.trunk, px, py, pz, size, size, size, 1);
    }
  }

  /* --------------------------------------------------------------
   * CANOPY — every dark module of the forest zone grows as a leaf.
   * The organic position keeps the module's horizontal direction
   * (squished toward the crown) so the treetop, seen from above,
   * already hints at the code it will complete.
   * ------------------------------------------------------------ */
  const crownY = H + 1.9;
  const t = 0.92; // silhouette fidelity to the module map
  const domeR = (zone.n / 2) * t || 1;
  const pushCanopy = (mx: number, mz: number, pale: boolean) => {
    const dome = 1 - Math.min(1, (mx * t * mx * t + mz * t * mz * t) / (domeR * domeR));
    d.canopy.push({
      ox: mx * t + (rng() * 2 - 1) * 1.35,
      oy: crownY + dome * 1.9 + (rng() * 2 - 1) * 1.9,
      oz: mz * t + (rng() * 2 - 1) * 1.35,
      os: 0.68 + rng() * 0.75,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, 4),
      pale,
      rot: rng() * Math.PI,
      u: rng(),
    });
  };

  let darkCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid.data[gr * grid.total + gc] === 1) {
        pushCanopy(gc - half, gr - half, false);
        darkCount++;
      }
    }
  }
  // extra non-data leaves for fluff — they vanish when the code assembles
  const extras = Math.ceil(darkCount * 0.5);
  for (let i = 0; i < extras; i++) {
    const mx = zone.x0 + Math.floor(rng() * zone.n) - half + (rng() - 0.5);
    const mz = zone.z0 + Math.floor(rng() * zone.n) - half + (rng() - 0.5);
    pushCanopy(mx, mz, true);
  }

  // garden decorations sprinkled over the QR meadow (outside the clearing)
  const GROUND_Y = 0.62;
  const margin = zone.n / 2 + 1;
  const target = 6 + Math.floor(rng() * 4);
  let placed = 0;
  let attempts = 90;
  while (placed < target && attempts-- > 0) {
    const ang = rng() * Math.PI * 2;
    const rad = margin + rng() * Math.max(1, half - margin - 1.6);
    const x = Math.round(Math.cos(ang) * rad);
    const z = Math.round(Math.sin(ang) * rad);
    if (Math.abs(x) > half - 1.5 || Math.abs(z) > half - 1.5) continue;
    const roll = rng();
    if (roll < 0.16) {
      const n = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < n; j++) {
        const s = 0.38 + rng() * 0.42;
        push(
          d.rocks,
          x + (rng() - 0.5) * 0.7,
          GROUND_Y + s * 0.32,
          z + (rng() - 0.5) * 0.7,
          s,
          s * 0.72,
          s,
          0,
        );
      }
    } else if (roll < 0.3) {
      push(d.shroomStems, x, GROUND_Y + 0.13, z, 0.17, 0.3, 0.17, 0);
      push(d.shroomCaps, x, GROUND_Y + 0.34, z, 0.46, 0.24, 0.46, 0);
    } else if (roll < 0.68) {
      const h = 0.3 + rng() * 0.22;
      push(d.flowerStems, x, GROUND_Y + h / 2, z, 0.09, h, 0.09, 0);
      push(d.flowerHeads, x, GROUND_Y + h + 0.1, z, 0.27, 0.22, 0.27, Math.floor(rng() * 3));
      if (rng() < 0.35) {
        const ox = (rng() - 0.5) * 0.6;
        const oz = (rng() - 0.5) * 0.6;
        const h2 = h * (0.7 + rng() * 0.3);
        push(d.flowerStems, x + ox, GROUND_Y + h2 / 2, z + oz, 0.08, h2, 0.08, 0);
        push(
          d.flowerHeads,
          x + ox,
          GROUND_Y + h2 + 0.09,
          z + oz,
          0.23,
          0.19,
          0.23,
          Math.floor(rng() * 3),
        );
      }
    } else {
      const blades = 2 + Math.floor(rng() * 2);
      for (let j = 0; j < blades; j++) {
        const hb = 0.3 + rng() * 0.45;
        push(
          d.tufts,
          x + (rng() - 0.5) * 0.55,
          GROUND_Y + hb / 2,
          z + (rng() - 0.5) * 0.55,
          0.09,
          hb,
          0.09,
          Math.floor(rng() * 2),
        );
      }
    }
    placed++;
  }
  return d;
}

/* ------------------------------------------------------------------ */

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function Cubes({
  items,
  colors,
  geometry,
  roughness = 0.85,
  shadow = true,
}: {
  items: Voxel[];
  colors: string[];
  geometry: THREE.BufferGeometry;
  roughness?: number;
  shadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      tmp.position.set(v.x, v.y, v.z);
      tmp.scale.set(v.sx, v.sy, v.sz);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      col.set(colors[v.c % colors.length]);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items, colors]);

  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled={false}
      dispose={null}
    >
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The leaf-cloud that carries the code. Unlike the trunk/decor group, this
 * mesh never disappears — on flatten, each data leaf lands on its module.
 */
function Canopy({
  items,
  colors,
  geometry,
  seed,
  density,
  dark,
}: {
  items: CanopyVoxel[];
  colors: THREE.Color[];
  geometry: THREE.BufferGeometry;
  seed: number;
  density: number;
  dark: THREE.Color;
}) {
  const visible = useMemo(
    () => items.filter((v) => !v.pale || v.u < density),
    [items, density],
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ intro: 0, lastP: -1, dirty: true });

  useEffect(() => {
    st.current.intro = 0;
    st.current.dirty = true;
  }, [seed]);
  useLayoutEffect(() => {
    st.current.dirty = true;
  }, [visible, colors]);

  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    s.intro = Math.min(1, s.intro + dt * 0.72);
    const p = morph.p;
    if (!s.dirty && Math.abs(p - s.lastP) < 0.0005 && s.intro >= 1) return;
    s.dirty = false;
    s.lastP = p;
    const q = smooth01(p);
    const flatY = FLAT_TILE_TOP + 0.085;

    for (let i = 0; i < visible.length; i++) {
      const v = visible[i];
      const grow = easeOutBack(clamp01((s.intro * 1.35 - v.u * 0.35) / 0.55));
      tmp.position.set(
        v.ox + (v.fx - v.ox) * q,
        v.oy + (flatY - v.oy) * q,
        v.oz + (v.fz - v.oz) * q,
      );
      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = v.os + ((v.pale ? 0.0001 : 0.16) - v.os) * q;
      tmp.scale.set(
        Math.max(0.0001, sxz * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sxz * grow),
      );
      tmp.rotation.set(0, v.rot * (1 - q), 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      col.copy(colors[v.ci % colors.length]);
      if (!v.pale) col.lerp(dark, q);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  if (visible.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, visible.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    >
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */

export default function Tree({
  seed,
  palette,
  grid,
  zone,
}: {
  seed: number;
  palette: Palette;
  grid: QRGrid;
  zone: ForestZone;
}) {
  const group = useRef<THREE.Group>(null);
  const intro = useRef(0);

  useEffect(() => {
    intro.current = 0;
  }, [seed]);

  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.14), []);
  const data = useMemo(() => generateTree(seed, grid, zone), [seed, grid, zone]);

  const thin = <T extends Voxel>(arr: T[]) => arr.filter((v) => v.u < palette.decorDensity);
  const flowerHeads = useMemo(() => thin(data.flowerHeads), [data, palette.decorDensity]);
  const flowerStems = useMemo(() => thin(data.flowerStems), [data, palette.decorDensity]);
  const tufts = useMemo(() => thin(data.tufts), [data, palette.decorDensity]);
  const rocks = useMemo(() => thin(data.rocks), [data, palette.decorDensity]);
  const shroomStems = useMemo(() => thin(data.shroomStems), [data, palette.decorDensity]);
  const shroomCaps = useMemo(() => thin(data.shroomCaps), [data, palette.decorDensity]);

  const tuftColors = useMemo(
    () => palette.grass.map((g) => `#${col.set(g).offsetHSL(0, 0.02, -0.16).getHexString()}`),
    [palette],
  );
  const canopyColors = useMemo(() => palette.foliage.map((c) => new THREE.Color(c)), [palette]);
  const qrDark = useMemo(() => new THREE.Color(palette.qrDark), [palette]);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    intro.current = Math.min(1, intro.current + dt * 0.7);
    const q = smooth01(morph.p);
    const grow = easeOutBack(intro.current / 0.85);
    const sc = Math.max(0.0001, (1 - q) * grow);
    g.scale.setScalar(sc);
    g.visible = sc > 0.015;
  });

  return (
    <>
      {/* trunk + decor collapse away when the code assembles */}
      <group ref={group}>
        <Cubes items={data.trunk} colors={palette.trunk} geometry={geo} roughness={0.92} />
        <Cubes items={flowerStems} colors={["#4c8a4a"]} geometry={geo} roughness={0.9} />
        <Cubes items={flowerHeads} colors={palette.accent} geometry={geo} roughness={0.7} />
        <Cubes items={tufts} colors={tuftColors} geometry={geo} roughness={0.9} />
        <Cubes items={rocks} colors={[palette.rock]} geometry={geo} roughness={0.95} />
        <Cubes items={shroomStems} colors={["#fdf3e3"]} geometry={geo} roughness={0.85} />
        <Cubes items={shroomCaps} colors={[palette.accent[0]]} geometry={geo} roughness={0.6} />
      </group>
      {/* the canopy stays — it IS the missing centre of the QR code */}
      <Canopy
        items={data.canopy}
        colors={canopyColors}
        geometry={geo}
        seed={seed}
        density={palette.foliageDensity}
        dark={qrDark}
      />
    </>
  );
}
