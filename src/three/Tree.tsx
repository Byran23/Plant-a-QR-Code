import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Palette } from "../lib/palettes";
import type { ForestZone, QRGrid } from "../lib/qr";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

interface InstanceItem {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx?: number;
  ry?: number;
  rz?: number;
  c: number;
  u: number;
}

interface CanopyFacetedModule {
  ox: number;
  oy: number;
  oz: number;
  os: number;
  fx: number;
  fz: number;
  ci: number;
  pale: boolean;
  rotX: number;
  rotY: number;
  rotZ: number;
  u: number;
}

interface DioramaData {
  trunk: InstanceItem[];
  branches: InstanceItem[];
  canopy: CanopyFacetedModule[];
  shrubs: InstanceItem[];
  flowerStems: InstanceItem[];
  flowerHeads: InstanceItem[];
  groundPebbles: InstanceItem[];
  birds: InstanceItem[];
  clouds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Color Palette matching the Low-Poly Sakura Diorama
const SAKURA_BLOSSOM_COLORS = [
  "#f7a8b8", // Soft Pink
  "#f497a9", // Medium Blossom Pink
  "#fbc4cf", // Pale Highlight Pink
  "#e88599", // Shadow/Deep Pink
  "#fddde3", // Light Petal White-Pink
];

const TRUNK_WOOD_COLOR = ["#2b1810", "#21120b"];
const SHRUB_COLORS = ["#2d5a3d", "#366a47", "#234730"];
const FLOWER_HEAD_COLORS = ["#f5df6d", "#f0d24f", "#fced93"];
const STEM_COLOR = ["#437841"];
const PEBBLE_COLORS = ["#c2c7b8", "#a6ab9c"];
const BIRD_COLORS = ["#334155", "#475569"];
const CLOUD_COLOR = ["#ffffff"];

function generateSakuraDiorama(
  seed: number,
  grid: QRGrid,
  zone: ForestZone
): DioramaData {
  const rng = mulberry32(seed);
  const data: DioramaData = {
    trunk: [],
    branches: [],
    canopy: [],
    shrubs: [],
    flowerStems: [],
    flowerHeads: [],
    groundPebbles: [],
    birds: [],
    clouds: [],
  };

  const half = (grid.total - 1) / 2;
  const H = 4.8;

  // 1. Organic Tapered Low-Poly Trunk
  const trunkLevels = 10;
  let leanX = 0;
  let leanZ = 0;
  for (let i = 0; i < trunkLevels; i++) {
    const t = i / trunkLevels;
    const radius = THREE.MathUtils.lerp(1.1, 0.48, Math.pow(t, 0.7));
    leanX += (rng() - 0.5) * 0.08;
    leanZ += (rng() - 0.5) * 0.08;
    data.trunk.push({
      x: leanX,
      y: (i + 0.5) * (H / trunkLevels),
      z: leanZ,
      sx: radius * 2,
      sy: (H / trunkLevels) * 1.05,
      sz: radius * 2,
      rx: (rng() - 0.5) * 0.1,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.1,
      c: 0,
      u: rng(),
    });
  }

  // 2. Thick Radiating Branches
  const branchCount = 10;
  const branchBaseY = H * 0.48;
  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const length = 2.4 + rng() * 1.8;
    const slope = 0.22 + rng() * 0.38;
    const steps = Math.ceil(length * 2.5);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, slope, dirZ) || 1);

    let px = 0;
    let py = branchBaseY + rng() * 0.6;
    let pz = 0;

    for (let s = 0; s < steps; s++) {
      px += dirX * inv * 0.38;
      py += slope * inv * 0.38;
      pz += dirZ * inv * 0.38;
      const thick = Math.max(0.18, 0.44 - (s / steps) * 0.28);
      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thick,
        sy: thick * 1.2,
        sz: thick,
        rx: (rng() - 0.5) * 0.15,
        ry: angle,
        rz: (rng() - 0.5) * 0.15,
        c: 0,
        u: rng(),
      });
    }
  }

  // 3. Umbrella-Shaped Low-Poly Canopy Crown
  const crownY = H + 0.5;
  const maxCrownRadius = Math.max(1, zone.n * 0.66);

  const pushCanopyFacet = (
    mx: number,
    mz: number,
    pale: boolean,
    isDrooping = false
  ) => {
    const distRatio = Math.min(1, Math.hypot(mx, mz) / maxCrownRadius);
    // Broad, flat-domed silhouette matching the reference
    const dome = Math.sqrt(Math.max(0, 1 - distRatio * distRatio)) * 1.8;

    const oy = isDrooping
      ? branchBaseY + 0.3 + (rng() - 0.5) * 0.6
      : crownY + dome + (rng() - 0.5) * 0.65;

    data.canopy.push({
      ox: mx * (isDrooping ? 1.08 : 0.96) + (rng() - 0.5) * 0.8,
      oy,
      oz: mz * (isDrooping ? 1.08 : 0.96) + (rng() - 0.5) * 0.8,
      os: isDrooping ? 0.8 + rng() * 0.45 : 1.25 + rng() * 0.75,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, SAKURA_BLOSSOM_COLORS.length),
      pale,
      rotX: rng() * Math.PI * 2,
      rotY: rng() * Math.PI * 2,
      rotZ: rng() * Math.PI * 2,
      u: rng(),
    });
  };

  // QR Modules in tree canopy
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushCanopyFacet(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Dense Low-Poly Faceted Puffs filling the crown volume
  const fillerCount = Math.ceil(qrModuleCount * 2.8);
  for (let i = 0; i < fillerCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * maxCrownRadius * 0.96;
    pushCanopyFacet(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Hanging blossom fringe
  const droopCount = 24 + Math.floor(rng() * 8);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = maxCrownRadius * (0.7 + rng() * 0.28);
    pushCanopyFacet(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Surrounding Dark Green Shrub Clusters & Yellow Wildflowers
  const shrubCount = 42 + Math.floor(rng() * 14);
  for (let i = 0; i < shrubCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = (zone.n * 0.48) + Math.sqrt(rng()) * (half - (zone.n * 0.48) - 1.2);
    const sx = 0.55 + rng() * 0.65;
    const sy = 0.45 + rng() * 0.55;
    const sz = 0.55 + rng() * 0.65;
    const x = Math.cos(angle) * rad + (rng() - 0.5) * 0.5;
    const z = Math.sin(angle) * rad + (rng() - 0.5) * 0.5;

    data.shrubs.push({
      x,
      y: FLAT_TILE_TOP + sy * 0.45,
      z,
      sx,
      sy,
      sz,
      rx: (rng() - 0.5) * 0.3,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.3,
      c: pickIndex(rng, SHRUB_COLORS.length),
      u: rng(),
    });

    // Yellow Wildflowers nestled in the grass/shrubs
    if (rng() < 0.6) {
      const stemH = 0.4 + rng() * 0.35;
      const fx = x + (rng() - 0.5) * 0.4;
      const fz = z + (rng() - 0.5) * 0.4;
      data.flowerStems.push({
        x: fx,
        y: FLAT_TILE_TOP + stemH / 2,
        z: fz,
        sx: 0.06,
        sy: stemH,
        sz: 0.06,
        c: 0,
        u: rng(),
      });
      data.flowerHeads.push({
        x: fx,
        y: FLAT_TILE_TOP + stemH + 0.06,
        z: fz,
        sx: 0.18,
        sy: 0.18,
        sz: 0.18,
        rx: (rng() - 0.5) * 0.2,
        ry: rng() * Math.PI,
        rz: (rng() - 0.5) * 0.2,
        c: pickIndex(rng, FLOWER_HEAD_COLORS.length),
        u: rng(),
      });
    }
  }

  // Small ground stones / pebbles
  const pebbleCount = 28 + Math.floor(rng() * 12);
  for (let i = 0; i < pebbleCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 1.0 + Math.sqrt(rng()) * (half - 1.8);
    const s = 0.2 + rng() * 0.25;
    data.groundPebbles.push({
      x: Math.cos(angle) * rad,
      y: FLAT_TILE_TOP + s * 0.3,
      z: Math.sin(angle) * rad,
      sx: s * 1.2,
      sy: s * 0.6,
      sz: s * 1.1,
      ry: rng() * Math.PI,
      c: pickIndex(rng, PEBBLE_COLORS.length),
      u: rng(),
    });
  }

  // 5. Floating Diorama Elements: Low-Poly Birds & Clouds
  // Flying birds over the canopy
  const birdCount = 3;
  for (let i = 0; i < birdCount; i++) {
    data.birds.push({
      x: -3.5 + i * 2.6 + (rng() - 0.5) * 0.8,
      y: H + 3.8 + (rng() - 0.5) * 0.9,
      z: -2.0 + (rng() - 0.5) * 2.0,
      sx: 0.35,
      sy: 0.08,
      sz: 0.22,
      rx: 0.2,
      ry: -0.6 + (rng() - 0.5) * 0.4,
      rz: 0.15,
      c: 0,
      u: rng(),
    });
  }

  // Blocky floating clouds
  data.clouds.push(
    { x: 5.5, y: H + 5.2, z: -5.0, sx: 2.8, sy: 1.4, sz: 1.8, c: 0, u: 0.1 },
    { x: 6.8, y: H + 5.8, z: -4.8, sx: 2.0, sy: 1.8, sz: 1.6, c: 0, u: 0.2 },
    { x: -6.0, y: H + 6.0, z: -4.0, sx: 3.2, sy: 1.6, sz: 2.0, c: 0, u: 0.3 }
  );

  return data;
}

/* ------------------------------------------------------------------ */

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function LowPolyInstancedGroup({
  items,
  colors,
  geometry,
  roughness = 0.8,
  flatShading = true,
}: {
  items: InstanceItem[];
  colors: string[];
  geometry: THREE.BufferGeometry;
  roughness?: number;
  flatShading?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || items.length === 0) return;
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      tmp.position.set(v.x, v.y, v.z);
      tmp.scale.set(
        Math.max(0.001, v.sx),
        Math.max(0.001, v.sy),
        Math.max(0.001, v.sz)
      );
      tmp.rotation.set(v.rx || 0, v.ry || 0, v.rz || 0);
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
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={roughness} flatShading={flatShading} />
    </instancedMesh>
  );
}

/**
 * Low-Poly Faceted Blossom Canopy with smooth morphing to flat QR matrix
 */
function LowPolyCanopyMesh({
  items,
  colors,
  geometry,
  seed,
  density,
  dark,
}: {
  items: CanopyFacetedModule[];
  colors: THREE.Color[];
  geometry: THREE.BufferGeometry;
  seed: number;
  density: number;
  dark: THREE.Color;
}) {
  const visible = useMemo(
    () => items.filter((v) => !v.pale || v.u < density),
    [items, density]
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
    if (!m || visible.length === 0) return;
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    s.intro = Math.min(1, s.intro + dt * 0.72);
    const p = morph?.p ?? 0;
    if (!s.dirty && Math.abs(p - s.lastP) < 0.0005 && s.intro >= 1) return;
    s.dirty = false;
    s.lastP = p;
    const q = smooth01(p);
    const flatY = FLAT_TILE_TOP + 0.085;

    for (let i = 0; i < visible.length; i++) {
      const v = visible[i];
      const grow = easeOutBack(clamp01((s.intro * 1.35 - v.u * 0.35) / 0.55));

      // Morph from organic 3D cloud to precise module position
      tmp.position.set(
        v.ox + (v.fx - v.ox) * q,
        v.oy + (flatY - v.oy) * q,
        v.oz + (v.fz - v.oz) * q
      );

      // Low-poly faceted blob scale -> flat square tile scale
      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = v.os * 0.7 + ((v.pale ? 0.0001 : 0.16) - v.os * 0.7) * q;

      tmp.scale.set(
        Math.max(0.0001, sxz * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sxz * grow)
      );

      // Unwind 3D random facet rotations into flat planar alignment
      tmp.rotation.set(v.rotX * (1 - q), v.rotY * (1 - q), v.rotZ * (1 - q));

      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);

      col.copy(colors[v.ci % colors.length] || colors[0]);
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
    >
      <meshStandardMaterial roughness={0.6} flatShading />
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

  // Geometries for the low-poly look:
  // 1. Icosahedron (subdivision 0) produces the signature faceted gem/foliage clusters
  const facetedGeo = useMemo(() => new THREE.IcosahedronGeometry(0.68, 0), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.45, 0.55, 1, 7), []);
  const branchGeo = useMemo(() => new THREE.CylinderGeometry(0.25, 0.35, 1, 5), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const flowerHeadGeo = useMemo(() => new THREE.DodecahedronGeometry(0.12, 0), []);

  const data = useMemo(
    () => generateSakuraDiorama(seed, grid, zone),
    [seed, grid, zone]
  );

  const canopyColors = useMemo(
    () =>
      (palette?.foliage?.length ? palette.foliage : SAKURA_BLOSSOM_COLORS).map(
        (c) => new THREE.Color(c)
      ),
    [palette]
  );

  const qrDark = useMemo(
    () => new THREE.Color(palette?.qrDark || "#c84e62"),
    [palette]
  );

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    intro.current = Math.min(1, intro.current + dt * 0.7);
    const p = morph?.p ?? 0;
    const q = smooth01(p);
    const grow = easeOutBack(intro.current / 0.85);
    const sc = Math.max(0.0001, (1 - q) * grow);
    g.scale.setScalar(sc);
    g.visible = sc > 0.015;
  });

  return (
    <>
      {/* Diorama Environment: Trunk, Shrubs, Flowers, Birds & Clouds */}
      <group ref={group}>
        {/* Faceted Low-Poly Trunk */}
        <LowPolyInstancedGroup
          items={data.trunk}
          colors={TRUNK_WOOD_COLOR}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Angular Scaffolding Branches */}
        <LowPolyInstancedGroup
          items={data.branches}
          colors={TRUNK_WOOD_COLOR}
          geometry={branchGeo}
          roughness={0.9}
        />
        {/* Surrounding Dark Green Shrubs */}
        <LowPolyInstancedGroup
          items={data.shrubs}
          colors={SHRUB_COLORS}
          geometry={facetedGeo}
          roughness={0.75}
        />
        {/* Flower Stems */}
        <LowPolyInstancedGroup
          items={data.flowerStems}
          colors={STEM_COLOR}
          geometry={boxGeo}
          roughness={0.9}
        />
        {/* Yellow Flower Heads */}
        <LowPolyInstancedGroup
          items={data.flowerHeads}
          colors={FLOWER_HEAD_COLORS}
          geometry={flowerHeadGeo}
          roughness={0.6}
        />
        {/* Ground Pebbles */}
        <LowPolyInstancedGroup
          items={data.groundPebbles}
          colors={PEBBLE_COLORS}
          geometry={facetedGeo}
          roughness={0.85}
        />
        {/* Floating Low-Poly Birds */}
        <LowPolyInstancedGroup
          items={data.birds}
          colors={BIRD_COLORS}
          geometry={boxGeo}
          roughness={0.5}
        />
        {/* Fluffy Low-Poly Clouds */}
        <LowPolyInstancedGroup
          items={data.clouds}
          colors={CLOUD_COLOR}
          geometry={boxGeo}
          roughness={0.95}
        />
      </group>

      {/* Faceted Blossom Canopy (Morphs cleanly into QR Matrix Tiles) */}
      <LowPolyCanopyMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={facetedGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}