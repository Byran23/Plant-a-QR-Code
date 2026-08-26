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

interface CanopyPetal {
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
  canopy: CanopyPetal[];
  fallenPetals: InstanceItem[];
  grassEdges: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Exact color palette sampled from the reference render
const SAKURA_PALETTE = [
  "#ffadc1", // Base sakura pink
  "#ff9eb4", // Vibrant mid petal
  "#ffbfd0", // Light sunlit highlight
  "#f78fa8", // Shadow depth pink
  "#ffd7e2", // White-pink petal edge
  "#ff95ad", // Saturated bloom core
];

const TRUNK_PALETTE = ["#543a2b", "#3d271c", "#634534", "#301d14"];
const BRANCH_COLOR = ["#3a241a", "#4a3022"];
const GRASS_PALETTE = ["#7eb844", "#8ec751", "#6fa338", "#9cd15e"];
const REED_PALETTE = ["#d77ea1", "#e898b7", "#c2698e"];

function generatePixelStylizedSakura(
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

  // Fixed proportions matching the reference
  const H = 7.8;
  const baseTrunkRadius = 0.72;

  // URL length increases floral blossom density without resizing or adding wood limbs
  const textLength = grid.text ? grid.text.length : 16;
  const leafDensityFactor = Math.min(2.5, Math.max(1.0, 1.0 + (textLength - 16) * 0.035));

  // 1. Ribbed Banded Trunk
  const numRings = 18;
  const totalTrunkH = H * 0.52;
  const ringH = totalTrunkH / numRings;

  for (let i = 0; i < numRings; i++) {
    const t = i / numRings;
    const r = THREE.MathUtils.lerp(baseTrunkRadius, baseTrunkRadius * 0.62, Math.pow(t, 0.75));
    data.trunk.push({
      x: 0,
      y: i * ringH + ringH * 0.5,
      z: 0,
      sx: r * 2,
      sy: ringH * 0.94,
      sz: r * 2,
      c: i % 2 === 0 ? 0 : 1,
      u: rng(),
    });
  }

  // 2. Dark Geometric Branches
  const boughCount = 10;
  const boughStartY = H * 0.42;
  const branchAttachmentPoints: THREE.Vector3[] = [];

  for (let i = 0; i < boughCount; i++) {
    const angle = (i / boughCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const isTopSpur = i % 3 === 0;
    const length = isTopSpur ? 2.2 + rng() * 0.8 : 3.4 + rng() * 1.0;
    const slope = isTopSpur ? 0.65 + rng() * 0.25 : 0.28 + rng() * 0.22;
    const steps = Math.ceil(length * 2.8);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, slope, dirZ) || 1);

    let px = 0;
    let py = boughStartY + rng() * 0.9;
    let pz = 0;

    const isBare = rng() < 0.2; // Keep some branches naturally bare

    for (let s = 0; s < steps; s++) {
      const stepT = s / steps;
      px += dirX * inv * 0.36;
      py += slope * inv * 0.36;
      pz += dirZ * inv * 0.36;
      const thickness = Math.max(0.12, 0.42 * (1 - stepT * 0.65));

      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thickness,
        sy: thickness * 1.25,
        sz: thickness,
        rx: (rng() - 0.5) * 0.12,
        ry: angle,
        rz: (rng() - 0.5) * 0.12,
        c: 0,
        u: rng(),
      });

      if (!isBare && s >= Math.floor(steps * 0.35)) {
        branchAttachmentPoints.push(new THREE.Vector3(px, py, pz));
      }
    }
  }

  // 3. Volumetric Petal Cluster Canopy (Layered & Airy)
  const crownBaseY = H * 0.62;
  const crownRadius = Math.max(1.8, zone.n * 0.72);

  const pushBlossomCard = (
    mx: number,
    mz: number,
    pale: boolean,
    anchorPos?: THREE.Vector3,
    customScale?: number
  ) => {
    let ox = 0;
    let oy = 0;
    let oz = 0;

    if (anchorPos) {
      ox = anchorPos.x + (rng() - 0.5) * 0.35;
      oy = anchorPos.y + (rng() - 0.5) * 0.3;
      oz = anchorPos.z + (rng() - 0.5) * 0.35;
    } else {
      const dist = Math.min(1, Math.hypot(mx, mz) / crownRadius);
      const domeH = Math.pow(Math.max(0, 1 - dist), 0.6) * 3.4;

      ox = mx * 0.94 + (rng() - 0.5) * 0.45;
      oy = crownBaseY + domeH + (rng() - 0.5) * 0.7;
      oz = mz * 0.94 + (rng() - 0.5) * 0.45;
    }

    const scale = customScale || 0.62 + rng() * 0.3;

    data.canopy.push({
      ox,
      oy,
      oz,
      os: scale,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, SAKURA_PALETTE.length),
      pale,
      rotX: (rng() - 0.5) * 0.8,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.8,
      u: rng(),
    });
  };

  // 3a. Map Data Modules into QR Grid
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushBlossomCard(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // 3b. Fill Candidate Branch Nodes
  const fillRate = 0.75 * leafDensityFactor;
  for (const node of branchAttachmentPoints) {
    if (rng() < fillRate) {
      pushBlossomCard(node.x, node.z, true, node);
      if (leafDensityFactor > 1.15 && rng() < 0.55 * (leafDensityFactor - 1.0)) {
        const offset = node.clone().add(
          new THREE.Vector3((rng() - 0.5) * 0.28, (rng() - 0.5) * 0.22, (rng() - 0.5) * 0.28)
        );
        pushBlossomCard(offset.x, offset.z, true, offset, 0.48 + rng() * 0.2);
      }
    }
  }

  // 3c. Weeping Hanging Fringe Tendrils
  const droopCount = Math.floor(18 * leafDensityFactor);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = crownRadius * (0.65 + rng() * 0.28);
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    const dropPos = new THREE.Vector3(mx, H * 0.5 + rng() * 1.5, mz);
    pushBlossomCard(mx, mz, true, dropPos, 0.55 + rng() * 0.25);
  }

  // 4. Fallen Petals on Patio Tiles
  const petalCount = Math.floor(65 * leafDensityFactor);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.5 + Math.sqrt(rng()) * (half - 1.0);
    data.fallenPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.35,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.35,
      sx: 0.26 + rng() * 0.18,
      sy: 0.02,
      sz: 0.26 + rng() * 0.18,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, SAKURA_PALETTE.length),
      u: rng(),
    });
  }

  // 5. Perimeter Corner Grass & Floral Reeds
  const perimeterCount = 38;
  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.4 + (rng() - 0.5) * 1.2;
    const h = 0.42 + rng() * 0.58;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;

    data.grassEdges.push({
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

    if (rng() < 0.48) {
      const rh = h * (0.8 + rng() * 0.35);
      data.pinkReeds.push({
        x: x + (rng() - 0.5) * 0.3,
        y: FLAT_TILE_TOP + rh / 2,
        z: z + (rng() - 0.5) * 0.3,
        sx: 0.08,
        sy: rh,
        sz: 0.08,
        rx: (rng() - 0.5) * 0.3,
        ry: rng() * Math.PI,
        rz: (rng() - 0.5) * 0.3,
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
      tmp.rotation.set(v.rx || 0, v.ry || 0, v.rz || 0);
      tmp.scale.set(Math.max(0.001, v.sx), Math.max(0.001, v.sy), Math.max(0.001, v.sz));
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
  items: CanopyPetal[];
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
      const sy = (v.os * 0.65) + ((v.pale ? 0.0001 : 0.16) - (v.os * 0.65)) * q;

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
      <meshStandardMaterial
        roughness={0.56}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
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

  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  // Compact 12-sided dodecahedron for defined floret clusters
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.46, 0), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(
    () => generatePixelStylizedSakura(seed, grid, zone),
    [seed, grid, zone]
  );

  const canopyColors = useMemo(
    () => SAKURA_PALETTE.map((c) => new THREE.Color(c)),
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
        {/* Ribbed Cylindrical Trunk */}
        <InstancedBatch
          items={data.trunk}
          colors={TRUNK_PALETTE}
          geometry={cylinderGeo}
          roughness={0.92}
        />
        {/* Dark Structural Branches */}
        <InstancedBatch
          items={data.branches}
          colors={BRANCH_COLOR}
          geometry={boxGeo}
          roughness={0.88}
        />
        {/* Fallen Petals on Patio */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={SAKURA_PALETTE}
          geometry={petalDiscGeo}
          roughness={0.6}
        />
        {/* Perimeter Grass Edges */}
        <InstancedBatch
          items={data.grassEdges}
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

      {/* Layered, Crisp Blossom Flakes */}
      <CanopyMorphMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={blossomClusterGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}