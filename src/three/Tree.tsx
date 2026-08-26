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
  rx?: number;
  ry?: number;
  rz?: number;
  c: number;
  u: number;
}

interface CanopyVoxel {
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

interface TreeData {
  trunkSegments: Voxel[];
  branches: Voxel[];
  canopy: CanopyVoxel[];
  groundPetals: Voxel[];
  grassTufts: Voxel[];
}

const FLAT_TILE_TOP = 0.14;

// Default Sakura color palette fallbacks
const SAKURA_BLOSSOMS = ["#ffb7c5", "#ff9ebb", "#ffaec2", "#fcd5e0", "#ffc4d6"];
const TRUNK_RINGS = ["#5c4033", "#43281c", "#6b493b", "#3b2317"];
const SAKURA_GRASS = ["#89c053", "#9bd45c", "#73ad43", "#e899b8"];

function generateSakuraTree(seed: number, grid: QRGrid, zone: ForestZone): TreeData {
  const rng = mulberry32(seed);
  const d: TreeData = {
    trunkSegments: [],
    branches: [],
    canopy: [],
    groundPetals: [],
    grassTufts: [],
  };

  const half = (grid.total - 1) / 2;
  const H = (zone.n >= 11 ? 7.5 : zone.n >= 7 ? 6.5 : 5.2);

  // 1. Trunk — Stacked ring segments to create the segmented cylindrical bark look
  const rings = 12;
  const ringHeight = (H * 0.55) / rings;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const radius = THREE.MathUtils.lerp(1.4, 0.75, Math.pow(t, 0.8));
    d.trunkSegments.push({
      x: (rng() - 0.5) * 0.05,
      y: i * ringHeight + ringHeight * 0.5,
      z: (rng() - 0.5) * 0.05,
      sx: radius * 2,
      sy: ringHeight * 0.98,
      sz: radius * 2,
      c: i % 2 === 0 ? 0 : (rng() > 0.4 ? 1 : 2),
      u: rng(),
    });
  }

  // 2. Scaffold branches radiating outwards and upwards
  const numBranches = 9 + Math.floor(rng() * 4);
  const branchStartY = H * 0.45;
  for (let i = 0; i < numBranches; i++) {
    const angle = (i / numBranches) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const length = 2.4 + rng() * (zone.n * 0.38);
    const elevation = 0.25 + rng() * 0.45;
    const steps = Math.ceil(length * 2.2);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / Math.hypot(dirX, elevation, dirZ);

    let px = 0;
    let py = branchStartY + rng() * 0.8;
    let pz = 0;

    for (let s = 0; s < steps; s++) {
      px += dirX * inv * 0.45;
      py += elevation * inv * 0.45;
      pz += dirZ * inv * 0.45;
      const thick = Math.max(0.22, 0.55 - (s / steps) * 0.38);
      d.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thick,
        sy: thick * 1.1,
        sz: thick,
        c: 1,
        u: rng(),
      });
    }
  }

  // 3. Canopy — Tiered, fluffy, cloud-like foliage with drooping fringe clusters
  const crownCenterY = H + 0.8;
  const crownRadius = (zone.n * 0.55);

  const pushCanopy = (mx: number, mz: number, pale: boolean, isDrooping = false) => {
    const distSq = (mx * mx + mz * mz) / (crownRadius * crownRadius);
    const domeHeight = Math.sqrt(Math.max(0, 1 - Math.min(1, distSq))) * 2.6;
    
    const oy = isDrooping
      ? branchStartY + 0.3 + (rng() - 0.5) * 0.6
      : crownCenterY + (domeHeight - 0.9) + (rng() - 0.5) * 1.2;

    const spread = isDrooping ? 1.05 : 0.95;

    d.canopy.push({
      ox: mx * spread + (rng() - 0.5) * 0.9,
      oy,
      oz: mz * spread + (rng() - 0.5) * 0.9,
      os: isDrooping ? 0.65 + rng() * 0.4 : 0.85 + rng() * 0.75,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, 5),
      pale,
      rotX: (rng() - 0.5) * 0.35,
      rotY: rng() * Math.PI,
      rotZ: (rng() - 0.5) * 0.35,
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

  // Additional decorative puffs to fill canopy volume
  const extraFluff = Math.ceil(darkCount * 1.6);
  for (let i = 0; i < extraFluff; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.95;
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    pushCanopy(mx, mz, true);
  }

  // Drooping hanging clusters under the crown perimeter
  const droopCount = 14 + Math.floor(rng() * 6);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = crownRadius * (0.65 + rng() * 0.3);
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    pushCanopy(mx, mz, true, true);
  }

  // 4. Ground details — Fallen pink petals on the central stones & perimeter grass
  const petalCount = 42 + Math.floor(rng() * 18);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.8 + Math.sqrt(rng()) * (half - 1.2);
    d.groundPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.3,
      y: FLAT_TILE_TOP + 0.02,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.3,
      sx: 0.22 + rng() * 0.2,
      sy: 0.025,
      sz: 0.22 + rng() * 0.2,
      ry: rng() * Math.PI,
      c: pickIndex(rng, 5),
      u: rng(),
    });
  }

  // Perimeter tufts with mixed grass/sakura hues
  const tuftCount = 28 + Math.floor(rng() * 10);
  for (let i = 0; i < tuftCount; i++) {
    const angle = (i / tuftCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.8 + (rng() - 0.5) * 1.2;
    const h = 0.35 + rng() * 0.45;
    d.grassTufts.push({
      x: Math.cos(angle) * rad,
      y: FLAT_TILE_TOP + h / 2,
      z: Math.sin(angle) * rad,
      sx: 0.12,
      sy: h,
      sz: 0.12,
      ry: rng() * Math.PI,
      c: rng() > 0.3 ? pickIndex(rng, 3) : 3,
      u: rng(),
    });
  }

  return d;
}

/* ------------------------------------------------------------------ */

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function InstancedElements({
  items,
  colors,
  geometry,
  roughness = 0.85,
}: {
  items: Voxel[];
  colors: string[];
  geometry: THREE.BufferGeometry;
  roughness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      tmp.position.set(v.x, v.y, v.z);
      tmp.scale.set(v.sx, v.sy, v.sz);
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
      dispose={null}
    >
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}

function CanopyCloud({
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
      tmp.rotation.set(
        v.rotX * (1 - q),
        v.rotY * (1 - q),
        v.rotZ * (1 - q),
      );
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
      <meshStandardMaterial roughness={0.75} />
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

  const boxGeo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.16), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 10), []);

  const data = useMemo(() => generateSakuraTree(seed, grid, zone), [seed, grid, zone]);

  const canopyColors = useMemo(
    () => (palette.foliage?.length ? palette.foliage : SAKURA_BLOSSOMS).map((c) => new THREE.Color(c)),
    [palette],
  );
  const trunkColors = useMemo(
    () => (palette.trunk?.length ? palette.trunk : TRUNK_RINGS),
    [palette],
  );
  const petalColors = useMemo(
    () => (palette.foliage?.length ? palette.foliage : SAKURA_BLOSSOMS),
    [palette],
  );
  const tuftColors = useMemo(
    () => (palette.grass?.length ? palette.grass : SAKURA_GRASS),
    [palette],
  );
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
      <group ref={group}>
        {/* Cylindrical banded bark */}
        <InstancedElements
          items={data.trunkSegments}
          colors={trunkColors}
          geometry={cylinderGeo}
          roughness={0.92}
        />
        {/* Wood scaffold branches */}
        <InstancedElements
          items={data.branches}
          colors={trunkColors}
          geometry={boxGeo}
          roughness={0.9}
        />
        {/* Fallen petals on the pavement tiles */}
        <InstancedElements
          items={data.groundPetals}
          colors={petalColors}
          geometry={boxGeo}
          roughness={0.7}
        />
        {/* Perimeter accent tufts */}
        <InstancedElements
          items={data.grassTufts}
          colors={tuftColors}
          geometry={boxGeo}
          roughness={0.9}
        />
      </group>

      {/* Blossom canopy and morph modules */}
      <CanopyCloud
        items={data.canopy}
        colors={canopyColors}
        geometry={boxGeo}
        seed={seed}
        density={palette.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}