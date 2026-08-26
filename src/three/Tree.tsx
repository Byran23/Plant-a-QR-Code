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
  "#ffb3c6",
  "#ff9ebb",
  "#ffc5d3",
  "#fa8fa8",
  "#ffdce5",
  "#ffa0b8",
];

const BARK_COLORS = ["#5c4033", "#43281c", "#6b493b"];
const BRANCH_COLOR = ["#43281c"];
const GRASS_COLORS = ["#82bf4f", "#94ce5e", "#71ab41"];
const REED_COLORS = ["#df8db0", "#ebb0cb", "#cf779f"];

function generateTallBulkySakura(seed: number, grid: QRGrid, zone: ForestZone): TreeSceneData {
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

  // 1. Taller & Substantially Thicker Trunk (Increased height and wider base radius)
  const H = 10.4;
  const numRings = 20;
  const ringH = (H * 0.46) / numRings;

  for (let i = 0; i < numRings; i++) {
    const t = i / numRings;
    const r = THREE.MathUtils.lerp(1.75, 0.88, Math.pow(t, 0.72));
    data.trunk.push({
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

  // 2. Multi-tiered, Dense Branch Scaffolding
  const numBranches = 16;
  const branchStartY = H * 0.38;
  for (let i = 0; i < numBranches; i++) {
    const angle = (i / numBranches) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const length = 3.2 + rng() * 2.4;
    const slope = 0.35 + rng() * 0.45;
    const steps = Math.ceil(length * 3.2);

    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const inv = 1 / (Math.hypot(dx, slope, dz) || 1);

    let px = 0;
    let py = branchStartY + rng() * 1.8;
    let pz = 0;

    for (let s = 0; s < steps; s++) {
      px += dx * inv * 0.34;
      py += slope * inv * 0.34;
      pz += dz * inv * 0.34;
      const thick = Math.max(0.18, 0.52 - (s / steps) * 0.34);
      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thick,
        sy: thick * 1.25,
        sz: thick,
        rx: (rng() - 0.5) * 0.12,
        ry: angle,
        rz: (rng() - 0.5) * 0.12,
        c: 0,
        u: rng(),
      });
    }
  }

  // 3. Voluminous, Lofty Blossom Canopy (Larger radius & elevated peak)
  const crownBaseY = H * 0.7;
  const crownRadius = Math.max(1, zone.n * 0.78);

  const pushPetalCluster = (mx: number, mz: number, pale: boolean, isDroop = false) => {
    const dist = Math.min(1, Math.hypot(mx, mz) / crownRadius);
    // Tall, puffy crown profile
    const domeHeight = Math.pow(Math.max(0, 1 - dist), 0.65) * 4.6;

    const oy = isDroop
      ? branchStartY + 0.3 + rng() * 1.4
      : crownBaseY + domeHeight + (rng() - 0.5) * 1.1;

    data.canopy.push({
      ox: mx * (isDroop ? 1.08 : 0.94) + (rng() - 0.5) * 0.85,
      oy,
      oz: mz * (isDroop ? 1.08 : 0.94) + (rng() - 0.5) * 0.85,
      os: isDroop ? 0.85 + rng() * 0.45 : 1.15 + rng() * 0.85,
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

  // QR Code Modules mapped in tree crown
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushPetalCluster(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Extra voluminous blossom puffs for high foliage density
  const fillers = Math.ceil(qrModuleCount * 3.4);
  for (let i = 0; i < fillers; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.98;
    pushPetalCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Drooping hanging flower tendrils
  const droops = 28 + Math.floor(rng() * 10);
  for (let i = 0; i < droops; i++) {
    const angle = (i / droops) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const rad = crownRadius * (0.68 + rng() * 0.3);
    pushPetalCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Ground Fallen Petals
  const petalCount = 70 + Math.floor(rng() * 25);
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

  // 5. Perimeter Vegetation
  const perimeterCount = 42 + Math.floor(rng() * 12);
  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.4 + (rng() - 0.5) * 1.2;
    const h = 0.4 + rng() * 0.55;
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
      c: pickIndex(rng, GRASS_COLORS.length),
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
        c: pickIndex(rng, REED_COLORS.length),
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
      <meshStandardMaterial roughness={0.65} />
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
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.12, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(() => generateTallBulkySakura(seed, grid, zone), [seed, grid, zone]);

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
        {/* Substantial Cylindrical Trunk */}
        <InstancedBatch
          items={data.trunk}
          colors={BARK_COLORS}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Full-coverage Branch Network */}
        <InstancedBatch
          items={data.branches}
          colors={BRANCH_COLOR}
          geometry={branchGeo}
          roughness={0.9}
        />
        {/* Fallen Ground Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={SAKURA_COLORS}
          geometry={petalDiscGeo}
          roughness={0.6}
        />
        {/* Perimeter Grass Edging */}
        <InstancedBatch
          items={data.grassEdges}
          colors={GRASS_COLORS}
          geometry={bladeGeo}
          roughness={0.85}
        />
        {/* Perimeter Pink Accent Flora */}
        <InstancedBatch
          items={data.pinkReeds}
          colors={REED_COLORS}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      {/* Lofty, Bulky Blossom Canopy */}
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