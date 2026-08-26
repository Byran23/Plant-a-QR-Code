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
  tufts: Voxel[];
  shroomStems: Voxel[]; // used for petas (leaves) on the ground
}

const FLAT_TILE_TOP = 0.14; // matches the ground's flattened tile height

/**
 * A sakura tree.
 */
export function generateSakuraTree(
  seed: number,
  grid: QRGrid,
  zone: ForestZone,
): TreeData {
  const rng = mulberry32(seed);
  const d: TreeData = {
    trunk: [],
    canopy: [],
    tufts: [],
    shroomStems: [],
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

  // trunk — chunky tapered column with a gentle gnarl, using sakura bark colors
  let leanX = 0;
  let leanZ = 0;
  for (let y = 0; y < H; y++) {
    const w = y < 2 ? 3.0 : y < H - 2 ? 2.1 : 1.3;
    leanX += (rng() - 0.5) * 0.14;
    leanZ += (rng() - 0.5) * 0.14;
    // sakura trunk can alternate bark colors for texture, like dark and light grey
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
   * SAKURA CANOPY — every dark module of the forest zone grows as a petal/leaf.
   * We need a very dense, puffy form.
   * ------------------------------------------------------------ */
  const crownY = H + 1.9;
  const t = 1.05; // increased density
  const domeR = (zone.n / 1.7) * t || 1; // make it more spherical and slightly smaller

  const pushCanopy = (mx: number, mz: number, pale: boolean) => {
    const dome = Math.sqrt(
      Math.max(
        0,
        1 - (mx * t * mx * t + mz * t * mz * t) / (domeR * domeR),
      ),
    );
    d.canopy.push({
      ox: mx * t + (rng() * 2 - 1) * 1.6, // slightly wider spread
      oy: crownY + dome * 2.8 + (rng() * 2 - 1) * 1.5, // taller, puffy shape
      oz: mz * t + (rng() * 2 - 1) * 1.6,
      os: 0.8 + rng() * 1.1, // increased petal size variation for fluffy look
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, 4), // multiple sakura pink/white shades
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
  // extra non-data leaves for significant fluff and form
  const extras = Math.ceil(darkCount * 1.2);
  for (let i = 0; i < extras; i++) {
    const mx =
      zone.x0 + Math.floor(rng() * zone.n) - half + (rng() - 0.5);
    const mz =
      zone.z0 + Math.floor(rng() * zone.n) - half + (rng() - 0.5);
    pushCanopy(mx, mz, true);
  }

  // garden decorations on the stone path and around it
  const PATH_Y = 0.28; // height of the pattern stone path tiles
  const GROUND_Y = 0.62; // original ground height
  const margin = zone.n / 2 + 1;
  const target = 18 + Math.floor(rng() * 8); // more details
  let placed = 0;
  let attempts = 150;
  while (placed < target && attempts-- > 0) {
    const ang = rng() * Math.PI * 2;
    const rad =
      margin + rng() * Math.max(1, half - margin - 1.6);
    const x = Math.round(Math.cos(ang) * rad);
    const z = Math.round(Math.sin(ang) * rad);
    if (Math.abs(x) > half - 1.5 || Math.abs(z) > half - 1.5)
      continue;
    const roll = rng();

    // Grass around the path and on the path edge
    if (roll < 0.6) {
      const blades = 2 + Math.floor(rng() * 2);
      for (let j = 0; j < blades; j++) {
        const hb = 0.3 + rng() * 0.45;
        push(
          d.tufts,
          x + (rng() - 0.5) * 0.55,
          (rad > margin + 0.5 ? GROUND_Y : PATH_Y) + hb / 2, // grass on path edge is slightly lower
          z + (rng() - 0.5) * 0.55,
          0.09,
          hb,
          0.09,
          Math.floor(rng() * 2), // 2 grass colors
        );
      }
    }
    // Fallen petals on the path and around the tree base
    if (placed < target / 2 && roll > 0.4) {
      // only place on the path and under tree
      const px = (rng() - 0.5) * zone.n * 0.9;
      const pz = (rng() - 0.5) * zone.n * 0.9;
      const ps = 0.15 + rng() * 0.2;
      push(
        d.shroomStems, // repurpose shroomStems for ground petals
        x * 0.8 + px, // concentrate around tree center
        (rad > margin + 0.5 ? GROUND_Y : PATH_Y) + FLAT_TILE_TOP + 0.01,
        z * 0.8 + pz,
        ps,
        0.02,
        ps,
        pickIndex(rng, 4), // sakura colors
      );
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
      const grow = easeOutBack(
        clamp01((s.intro * 1.35 - v.u * 0.35) / 0.55),
      );
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

export default function SakuraTree({
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

  const geo = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 2, 0.14),
    [],
  );
  const data = useMemo(
    () => generateSakuraTree(seed, grid, zone),
    [seed, grid, zone],
  );

  const thin = <T extends Voxel>(arr: T[]) =>
    arr.filter((v) => v.u < palette.decorDensity);
  const tufts = useMemo(
    () => thin(data.tufts),
    [data, palette.decorDensity],
  );
  // petals on the ground, always visible if palette allows
  const groundPetals = useMemo(
    () => thin(data.shroomStems),
    [data, palette.decorDensity],
  );

  const tuftColors = useMemo(
    () =>
      palette.grass.map((g) =>
        `#${col.set(g).offsetHSL(0, 0.02, -0.16).getHexString()}`,
      ),
    [palette],
  );

  // use sakura foliage colors from palette
  const sakuraFoliageColors = useMemo(
    () => palette.foliage.map((c) => new THREE.Color(c)),
    [palette],
  );
  const groundPetalColors = useMemo(
    () => palette.foliage.map((c) => c),
    [palette],
  );

  const qrDark = useMemo(
    () => new THREE.Color(palette.qrDark),
    [palette],
  );

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
        <Cubes
          items={data.trunk}
          colors={palette.trunk}
          geometry={geo}
          roughness={0.92}
        />
        <Cubes
          items={tufts}
          colors={tuftColors}
          geometry={geo}
          roughness={0.9}
        />
        {/* Fallen petals on the path and ground */}
        <Cubes
          items={groundPetals}
          colors={groundPetalColors}
          geometry={geo}
          roughness={0.8}
        />
      </group>
      {/* the canopy stays — it IS the missing centre of the QR code */}
      <Canopy
        items={data.canopy}
        colors={sakuraFoliageColors}
        geometry={geo}
        seed={seed}
        density={palette.foliageDensity}
        dark={qrDark}
      />
    </>
  );
}