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

interface CanopyLeaf {
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

interface SakuraSceneData {
  trunkSegments: InstanceItem[];
  branches: InstanceItem[];
  canopyLeaves: CanopyLeaf[];
  groundPetals: InstanceItem[];
  grassBlades: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Authentic Cherry Blossom Hues
const BLOSSOM_PALETTE = [
  "#ffaec3",
  "#ff9eb8",
  "#ffbfd0",
  "#f78fa9",
  "#ffdbe5",
  "#ff8da9",
];

const TRUNK_PALETTE = ["#523a2e", "#3d281c", "#634537", "#342016"];
const BRANCH_COLOR = "#422a1e";
const GRASS_PALETTE = ["#7eb947", "#8ec755", "#6ba33b", "#a1d764"];
const REED_PALETTE = ["#d982ab", "#e89ec2", "#c46e96"];

function generateSakuraScene(seed: number, grid: QRGrid, zone: ForestZone): SakuraSceneData {
  const rng = mulberry32(seed);
  const data: SakuraSceneData = {
    trunkSegments: [],
    branches: [],
    canopyLeaves: [],
    groundPetals: [],
    grassBlades: [],
    pinkReeds: [],
  };

  const half = (grid.total - 1) / 2;
  const H = 6.6;

  // 1. Smooth, Tapered Cylindrical Trunk
  const rings = 16;
  const ringH = (H * 0.46) / rings;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = THREE.MathUtils.lerp(1.15, 0.65, Math.pow(t, 0.75));
    data.trunkSegments.push({
      x: 0,
      y: i * ringH + ringH * 0.5,
      z: 0,
      sx: r * 2,
      sy: ringH * 0.96,
      sz: r * 2,
      c: i % 2 === 0 ? 0 : 1,
      u: rng(),
    });
  }

  // 2. Multi-Branch Wooden Scaffold
  const branchCount = 14;
  const branchBaseY = H * 0.4;
  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const length = 2.4 + rng() * 2.2;
    const slope = 0.28 + rng() * 0.48;
    const steps = Math.ceil(length * 3);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, slope, dirZ) || 1);

    let px = 0;
    let py = branchBaseY + rng() * 0.8;
    let pz = 0;

    for (let s = 0; s < steps; s++) {
      px += dirX * inv * 0.32;
      py += slope * inv * 0.32;
      pz += dirZ * inv * 0.32;
      const thick = Math.max(0.12, 0.38 - (s / steps) * 0.26);
      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thick,
        sy: thick * 1.3,
        sz: thick,
        rx: (rng() - 0.5) * 0.2,
        ry: angle,
        rz: (rng() - 0.5) * 0.2,
        c: 0,
        u: rng(),
      });
    }
  }

  // 3. Dense, Organic Fluffy Canopy
  const crownY = H + 0.5;
  const maxCrownRadius = Math.max(1, zone.n * 0.65);

  const pushCanopyLeaf = (mx: number, mz: number, pale: boolean, isDrooping = false) => {
    const distRatio = Math.min(1, Math.hypot(mx, mz) / maxCrownRadius);
    // Multi-lobe organic dome shape
    const domeNoise = Math.sin(mx * 1.2) * Math.cos(mz * 1.2) * 0.4;
    const dome = Math.sqrt(Math.max(0, 1 - distRatio * distRatio)) * 3.2 + domeNoise;

    const oy = isDrooping
      ? branchBaseY + 0.2 + rng() * 1.1
      : crownY + (dome - 1.3) + (rng() - 0.5) * 1.0;

    data.canopyLeaves.push({
      ox: mx * (isDrooping ? 1.06 : 0.94) + (rng() - 0.5) * 0.9,
      oy,
      oz: mz * (isDrooping ? 1.06 : 0.94) + (rng() - 0.5) * 0.9,
      os: isDrooping ? 0.7 + rng() * 0.4 : 0.95 + rng() * 0.75,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, BLOSSOM_PALETTE.length),
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
        pushCanopyLeaf(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Dense extra blossom clusters to build the full rounded silhouette
  const fillerCount = Math.ceil(qrModuleCount * 3.0);
  for (let i = 0; i < fillerCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * maxCrownRadius * 0.98;
    pushCanopyLeaf(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Weeping hanging fringe clusters
  const droopCount = 28 + Math.floor(rng() * 10);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = maxCrownRadius * (0.65 + rng() * 0.3);
    pushCanopyLeaf(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Ground Fallen Petals
  const petalCount = 75 + Math.floor(rng() * 30);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.5 + Math.sqrt(rng()) * Math.max(1, half - 0.8);
    data.groundPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.4,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.4,
      sx: 0.24 + rng() * 0.18,
      sy: 0.02,
      sz: 0.24 + rng() * 0.18,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, BLOSSOM_PALETTE.length),
      u: rng(),
    });
  }

  // 5. Spiky Grass & Floral Accents
  const perimeterTufts = 45 + Math.floor(rng() * 15);
  for (let i = 0; i < perimeterTufts; i++) {
    const angle = (i / perimeterTufts) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.4 + (rng() - 0.5) * 1.5;
    const h = 0.4 + rng() * 0.55;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;

    data.grassBlades.push({
      x,
      y: FLAT_TILE_TOP + h / 2,
      z,
      sx: 0.1,
      sy: h,
      sz: 0.1,
      rx: (rng() - 0.5) * 0.25,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.25,
      c: pickIndex(rng, GRASS_PALETTE.length),
      u: rng(),
    });

    if (rng() < 0.5) {
      const rh = h * (0.8 + rng() * 0.4);
      data.pinkReeds.push({
        x: x + (rng() - 0.5) * 0.35,
        y: FLAT_TILE_TOP + rh / 2,
        z: z + (rng() - 0.5) * 0.35,
        sx: 0.08,
        sy: rh,
        sz: 0.08,
        rx: (rng() - 0.5) * 0.35,
        ry: rng() * Math.PI,
        rz: (rng() - 0.5) * 0.35,
        c: pickIndex(rng, REED_PALETTE.length),
        u: rng(),
      });
    }
  }

  return data;
}

/* ------------------------------------------------------------------ */

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function InstancedBatch({
  items,
  colors,
  geometry,
  roughness = 0.8,
}: {
  items: InstanceItem[];
  colors: string[];
  geometry: THREE.BufferGeometry;
  roughness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || items.length === 0) return;
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      tmp.position.set(v.x, v.y, v.z);
      tmp.scale.set(Math.max(0.001, v.sx), Math.max(0.001, v.sy), Math.max(0.001, v.sz));
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
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}

/**
 * Organic blossom cloud canopy that morphs from low-poly petal clusters
 * into flat QR module squares.
 */
function OrganicCanopyMesh({
  items,
  colors,
  geometry,
  seed,
  density,
  dark,
}: {
  items: CanopyLeaf[];
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

      // Morph from 3D clustered canopy down to flat module position
      tmp.position.set(
        v.ox + (v.fx - v.ox) * q,
        v.oy + (flatY - v.oy) * q,
        v.oz + (v.fz - v.oz) * q,
      );

      // In tree mode: organic aspect ratio; on flatten: flat square tile
      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = (v.os * 0.75) + ((v.pale ? 0.0001 : 0.16) - (v.os * 0.75)) * q;

      tmp.scale.set(
        Math.max(0.0001, sxz * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sxz * grow),
      );

      // Interpolate rotation to face perfectly aligned when flat
      tmp.rotation.set(
        v.rotX * (1 - q),
        v.rotY * (1 - q),
        v.rotZ * (1 - q),
      );

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
      <meshStandardMaterial roughness={0.6} metalness={0.05} />
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

  // Faceted 12-sided dodecahedron for organic, non-boxy blossom clusters
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.65, 0), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), []);
  const branchGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.4, 1, 6), []);
  const petalGeo = useMemo(() => new THREE.CylinderGeometry(0.35, 0.35, 0.05, 5), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.12, 1, 4), []);

  const data = useMemo(() => generateSakuraScene(seed, grid, zone), [seed, grid, zone]);

  const canopyColors = useMemo(
    () => BLOSSOM_PALETTE.map((c) => new THREE.Color(c)),
    [],
  );
  const qrDark = useMemo(() => new THREE.Color(palette?.qrDark || "#c84e62"), [palette]);

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
      <group ref={group}>
        {/* Ribbed Trunk */}
        <InstancedBatch
          items={data.trunkSegments}
          colors={TRUNK_PALETTE}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Angular Wood Branches */}
        <InstancedBatch
          items={data.branches}
          colors={[BRANCH_COLOR]}
          geometry={branchGeo}
          roughness={0.88}
        />
        {/* 5-Sided Ground Petals */}
        <InstancedBatch
          items={data.groundPetals}
          colors={BLOSSOM_PALETTE}
          geometry={petalGeo}
          roughness={0.55}
        />
        {/* Tapered Grass Blades */}
        <InstancedBatch
          items={data.grassBlades}
          colors={GRASS_PALETTE}
          geometry={bladeGeo}
          roughness={0.85}
        />
        {/* Accent Floral Reeds */}
        <InstancedBatch
          items={data.pinkReeds}
          colors={REED_PALETTE}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      {/* Non-square, organic faceted blossom canopy */}
      <OrganicCanopyMesh
        items={data.canopyLeaves}
        colors={canopyColors}
        geometry={blossomClusterGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}