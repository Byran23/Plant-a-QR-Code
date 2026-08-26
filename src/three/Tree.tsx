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

interface CanopyBlossom {
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

interface TreeSceneData {
  trunk: InstanceItem[];
  branches: InstanceItem[];
  canopy: CanopyBlossom[];
  fallenPetals: InstanceItem[];
  grassEdges: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

const SAKURA_COLORS = [
  "#ffaec3",
  "#ff9ebb",
  "#ffc8d6",
  "#f78aa6",
  "#ffe3eb",
  "#ff95b2",
];

const BARK_SHADES = ["#4a3328", "#382318", "#593e31", "#2e1c14"];
const BRANCH_SHADES = ["#382318", "#452d21"];
const GRASS_SHADES = ["#78b344", "#88c251", "#689e3a", "#9fd162"];
const REED_SHADES = ["#d47c9f", "#e694b4", "#bf678c"];

function generateSeamlessSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone
): TreeSceneData {
  const rng = mulberry32(seed);
  const data: TreeSceneData = {
    trunk: [],
    branches: [],
    canopy: [],
    fallenPetals: [],
    grassEdges: [],
    pinkReeds: [],
  };

  const half = (grid.total - 1) / 2;
  const sizeRatio = Math.max(1, grid.size / 21);
  const H = 7.5 * Math.min(1.3, sizeRatio);
  const baseRadius = 1.35 * Math.min(1.25, sizeRatio);

  // 1. Trunk (Continuous tapered column)
  const numRings = 18;
  const ringH = (H * 0.46) / numRings;
  let trunkTopX = 0;
  let trunkTopZ = 0;

  for (let i = 0; i < numRings; i++) {
    const t = i / numRings;
    const r = THREE.MathUtils.lerp(baseRadius, baseRadius * 0.48, Math.pow(t, 0.7));
    const tx = Math.sin(t * Math.PI) * 0.15;
    const tz = Math.cos(t * Math.PI) * 0.12;
    if (i === numRings - 1) {
      trunkTopX = tx;
      trunkTopZ = tz;
    }
    data.trunk.push({
      x: tx,
      y: i * ringH + ringH * 0.5,
      z: tz,
      sx: r * 2,
      sy: ringH * 1.02,
      sz: r * 2,
      c: i % 2 === 0 ? 0 : 1,
      u: rng(),
    });
  }

  // 2. Branch Anchors & Skeleton
  const branchStartY = H * 0.44;
  const numBranches = Math.floor(12 + zone.n * 0.8);
  const branchEndpoints: { x: number; y: number; z: number; angle: number }[] = [];

  for (let i = 0; i < numBranches; i++) {
    const angle = (i / numBranches) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const length = 2.8 + rng() * (zone.n * 0.4);
    const elevation = 0.38 + rng() * 0.42;
    const steps = Math.ceil(length * 3.4);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, elevation, dirZ) || 1);

    let px = trunkTopX;
    let py = branchStartY + rng() * 0.6;
    let pz = trunkTopZ;

    for (let s = 0; s < steps; s++) {
      const progress = s / steps;
      px += dirX * inv * 0.32;
      py += elevation * inv * 0.32;
      pz += dirZ * inv * 0.32;
      const thickness = Math.max(0.14, 0.48 * (1 - progress * 0.7));

      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thickness,
        sy: thickness * 1.25,
        sz: thickness,
        rx: (rng() - 0.5) * 0.15,
        ry: angle,
        rz: (rng() - 0.5) * 0.15,
        c: 0,
        u: rng(),
      });
    }
    branchEndpoints.push({ x: px, y: py, z: pz, angle });
  }

  // 3. Canopy — Anchored directly to branches without any air gap
  const crownRadius = Math.max(1.2, zone.n * 0.72);

  const pushCanopyBlossom = (mx: number, mz: number, pale: boolean) => {
    // Find closest branch endpoint to cluster around
    let nearestDist = 999;
    let target = branchEndpoints[0];
    for (const b of branchEndpoints) {
      const d = Math.hypot(mx - b.x, mz - b.z);
      if (d < nearestDist) {
        nearestDist = d;
        target = b;
      }
    }

    // Height calculated directly from branch height to prevent floating separation
    const distRatio = Math.min(1, Math.hypot(mx, mz) / crownRadius);
    const naturalDome = Math.sqrt(Math.max(0, 1 - distRatio * distRatio)) * 1.8;
    const oy = target.y + naturalDome * 0.6 + (rng() - 0.5) * 0.85;

    data.canopy.push({
      ox: mx * 0.94 + (rng() - 0.5) * 0.75,
      oy,
      oz: mz * 0.94 + (rng() - 0.5) * 0.75,
      os: 1.15 + rng() * 0.75,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, SAKURA_COLORS.length),
      pale,
      rotX: (rng() - 0.5) * 0.8,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.8,
      u: rng(),
    });
  };

  // QR Modules in Canopy
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushCanopyBlossom(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Volume filler blossoms nestled throughout the branch canopy
  const fillers = Math.ceil(qrModuleCount * 3.2);
  for (let i = 0; i < fillers; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.96;
    pushCanopyBlossom(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // 4. Ground Petals
  const petalCount = 65 + Math.floor(rng() * 20);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.6 + Math.sqrt(rng()) * (half - 1.2);
    data.fallenPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.35,
      y: FLAT_TILE_TOP + 0.015,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.35,
      sx: 0.26 + rng() * 0.2,
      sy: 0.02,
      sz: 0.26 + rng() * 0.2,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, SAKURA_COLORS.length),
      u: rng(),
    });
  }

  // 5. Perimeter Grass Edges
  const perimeterCount = 38 + Math.floor(rng() * 10);
  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.4 + (rng() - 0.5) * 1.2;
    const h = 0.38 + rng() * 0.45;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;

    data.grassEdges.push({
      x,
      y: FLAT_TILE_TOP + h / 2,
      z,
      sx: 0.1,
      sy: h,
      sz: 0.1,
      rx: (rng() - 0.5) * 0.2,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.2,
      c: pickIndex(rng, GRASS_SHADES.length),
      u: rng(),
    });

    if (rng() < 0.45) {
      const rh = h * (0.8 + rng() * 0.35);
      data.pinkReeds.push({
        x: x + (rng() - 0.5) * 0.3,
        y: FLAT_TILE_TOP + rh / 2,
        z: z + (rng() - 0.5) * 0.3,
        sx: 0.08,
        sy: rh,
        sz: 0.08,
        rx: (rng() - 0.5) * 0.25,
        ry: rng() * Math.PI,
        rz: (rng() - 0.5) * 0.25,
        c: pickIndex(rng, REED_SHADES.length),
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

function CanopyMorphMesh({
  items,
  colors,
  geometry,
  seed,
  density,
  dark,
}: {
  items: CanopyBlossom[];
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

      tmp.position.set(
        v.ox + (v.fx - v.ox) * q,
        v.oy + (flatY - v.oy) * q,
        v.oz + (v.fz - v.oz) * q
      );

      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = (v.os * 0.6) + ((v.pale ? 0.0001 : 0.16) - (v.os * 0.6)) * q;

      tmp.scale.set(
        Math.max(0.0001, sxz * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sxz * grow)
      );

      tmp.rotation.set(
        v.rotX * (1 - q),
        v.rotY * (1 - q),
        v.rotZ * (1 - q)
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
      <meshStandardMaterial roughness={0.62} metalness={0.02} side={THREE.DoubleSide} />
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

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), []);
  const branchGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 0.1, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(() => generateSeamlessSakura(seed, grid, zone), [seed, grid, zone]);

  const canopyColors = useMemo(
    () => SAKURA_COLORS.map((c) => new THREE.Color(c)),
    []
  );
  const qrDark = useMemo(() => new THREE.Color(palette?.qrDark || "#d64f64"), [palette]);

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
        <InstancedBatch
          items={data.trunk}
          colors={BARK_SHADES}
          geometry={trunkGeo}
          roughness={0.92}
        />
        <InstancedBatch
          items={data.branches}
          colors={BRANCH_SHADES}
          geometry={branchGeo}
          roughness={0.88}
        />
        <InstancedBatch
          items={data.fallenPetals}
          colors={SAKURA_COLORS}
          geometry={petalDiscGeo}
          roughness={0.6}
        />
        <InstancedBatch
          items={data.grassEdges}
          colors={GRASS_SHADES}
          geometry={bladeGeo}
          roughness={0.85}
        />
        <InstancedBatch
          items={data.pinkReeds}
          colors={REED_SHADES}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      <CanopyMorphMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={petalDiscGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}