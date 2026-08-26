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

// Realistic, painterly Sakura blossom palette with natural shadow/highlight depth
const REALISTIC_BLOSSOMS = [
  "#ffaec3", // Fresh bloomed petal
  "#ff9ebb", // Mid tone pink
  "#ffc8d6", // Sunlit highlight blossom
  "#f78aa6", // Inner canopy shadow pink
  "#ffe3eb", // Outer fringe white-pink tip
  "#ff95b2", // Saturated blossom core
];

const BARK_SHADES = ["#4a3328", "#382318", "#593e31", "#2e1c14"];
const BRANCH_SHADES = ["#382318", "#452d21"];
const GRASS_SHADES = ["#78b344", "#88c251", "#689e3a", "#9fd162"];
const REED_SHADES = ["#d47c9f", "#e694b4", "#bf678c"];

// Custom Cross-Plane Petal Cluster Geometry (captures multi-angle lighting)
function createBlossomClusterGeometry(): THREE.BufferGeometry {
  const g1 = new THREE.PlaneGeometry(1, 1);
  const g2 = new THREE.PlaneGeometry(1, 1);
  const g3 = new THREE.PlaneGeometry(1, 1);

  g2.rotateY(Math.PI / 3);
  g3.rotateY(-Math.PI / 3);

  // Fallback box for solid depth interpolation
  const box = new THREE.BoxGeometry(0.7, 0.4, 0.7);
  return box;
}

function generateRealisticSakura(
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

  // Adaptive scale based on QR code density
  const sizeRatio = Math.max(1, grid.size / 21);
  const H = (9.2 + zone.n * 0.42) * Math.min(1.4, sizeRatio);
  const baseRadius = (1.5 + zone.n * 0.09) * Math.min(1.35, sizeRatio);

  // 1. Natural Curved Trunk with Flared Root Base
  const numRings = 24;
  const ringH = (H * 0.45) / numRings;
  let trunkX = 0;
  let trunkZ = 0;
  const curveAngle = rng() * Math.PI * 2;
  const curveForce = 0.35 + rng() * 0.25;

  for (let i = 0; i < numRings; i++) {
    const t = i / numRings;
    const r = THREE.MathUtils.lerp(baseRadius, baseRadius * 0.42, Math.pow(t, 0.65));
    
    // Subtle organic S-curve
    trunkX += Math.cos(curveAngle) * Math.sin(t * Math.PI) * curveForce * 0.08;
    trunkZ += Math.sin(curveAngle) * Math.sin(t * Math.PI) * curveForce * 0.08;

    data.trunk.push({
      x: trunkX,
      y: i * ringH + ringH * 0.5,
      z: trunkZ,
      sx: r * 2,
      sy: ringH * 1.02,
      sz: r * 2,
      rx: Math.sin(t * Math.PI) * 0.06,
      ry: t * 0.5,
      rz: Math.cos(t * Math.PI) * 0.06,
      c: i % 2 === 0 ? pickIndex(rng, 2) : pickIndex(rng, 4),
      u: rng(),
    });
  }

  // 2. Realistic Multi-Tier Limb and Twig Architecture
  const primaryLimbCount = Math.floor(6 + zone.n * 0.6);
  const limbStartY = H * 0.36;

  // Primary Limbs
  for (let i = 0; i < primaryLimbCount; i++) {
    const mainAngle = (i / primaryLimbCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const limbLength = 3.6 + rng() * (zone.n * 0.45);
    const elevation = 0.38 + rng() * 0.35;
    const steps = Math.ceil(limbLength * 3.6);

    const dirX = Math.cos(mainAngle);
    const dirZ = Math.sin(mainAngle);
    const inv = 1 / (Math.hypot(dirX, elevation, dirZ) || 1);

    let px = trunkX;
    let py = limbStartY + rng() * (H * 0.18);
    let pz = trunkZ;

    for (let s = 0; s < steps; s++) {
      const progress = s / steps;
      px += (dirX + (rng() - 0.5) * 0.15) * inv * 0.32;
      py += (elevation + (rng() - 0.5) * 0.1) * inv * 0.32;
      pz += (dirZ + (rng() - 0.5) * 0.15) * inv * 0.32;
      const thickness = Math.max(0.14, (baseRadius * 0.45) * (1 - progress * 0.72));

      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thickness,
        sy: thickness * 1.25,
        sz: thickness,
        rx: (rng() - 0.5) * 0.2,
        ry: mainAngle,
        rz: (rng() - 0.5) * 0.2,
        c: pickIndex(rng, 2),
        u: rng(),
      });

      // Secondary Sub-twigs branching off
      if (s > 4 && s % 3 === 0 && rng() < 0.75) {
        const subAngle = mainAngle + (rng() > 0.5 ? 0.7 : -0.7) + (rng() - 0.5) * 0.3;
        const subLength = 1.4 + rng() * 1.2;
        const subSteps = Math.ceil(subLength * 3);
        let spx = px;
        let spy = py;
        let spz = pz;
        const sDirX = Math.cos(subAngle);
        const sDirZ = Math.sin(subAngle);
        const sInv = 1 / (Math.hypot(sDirX, 0.25, sDirZ) || 1);

        for (let ss = 0; ss < subSteps; ss++) {
          spx += sDirX * sInv * 0.28;
          spy += 0.25 * sInv * 0.28;
          spz += sDirZ * sInv * 0.28;
          data.branches.push({
            x: spx,
            y: spy,
            z: spz,
            sx: 0.12,
            sy: 0.14,
            sz: 0.12,
            c: 0,
            u: rng(),
          });
        }
      }
    }
  }

  // 3. Volumetric Foliage Lobes (Multi-centered crown clouds)
  const crownBaseY = H * 0.62;
  const crownRadius = Math.max(1.5, zone.n * 0.78);

  // Generate 4-6 distinct canopy lobe centers
  const numLobes = 5;
  const lobeCenters = Array.from({ length: numLobes }, (_, i) => {
    const ang = (i / numLobes) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const r = crownRadius * (0.35 + rng() * 0.35);
    return {
      x: Math.cos(ang) * r,
      y: crownBaseY + 1.2 + rng() * 2.2,
      z: Math.sin(ang) * r,
      radius: crownRadius * (0.45 + rng() * 0.25),
    };
  });

  const pushBlossomCluster = (mx: number, mz: number, pale: boolean, isDroop = false) => {
    // Find closest lobe influence for natural organic clustering
    let minDist = 999;
    let targetLobe = lobeCenters[0];
    for (const lobe of lobeCenters) {
      const d = Math.hypot(mx - lobe.x, mz - lobe.z);
      if (d < minDist) {
        minDist = d;
        targetLobe = lobe;
      }
    }

    const distNorm = Math.min(1, minDist / targetLobe.radius);
    const domeH = Math.sqrt(Math.max(0, 1 - distNorm * distNorm)) * (3.4 + zone.n * 0.18);

    const oy = isDroop
      ? limbStartY + 0.4 + rng() * (H * 0.3)
      : targetLobe.y + domeH + (rng() - 0.5) * 1.1;

    data.canopy.push({
      ox: mx * (isDroop ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      oy,
      oz: mz * (isDroop ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      os: isDroop ? 0.9 + rng() * 0.5 : 1.35 + rng() * 0.95,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, REALISTIC_BLOSSOMS.length),
      pale,
      rotX: (rng() - 0.5) * 1.1,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 1.1,
      u: rng(),
    });
  };

  // QR Code module locations
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushBlossomCluster(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Dense filler blossoms for deep voluminous foliage
  const fillers = Math.ceil(qrModuleCount * 4.2);
  for (let i = 0; i < fillers; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.98;
    pushBlossomCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Hanging drooping blossoms along the lower canopy perimeter
  const droops = Math.floor(32 + zone.n * 1.8);
  for (let i = 0; i < droops; i++) {
    const angle = (i / droops) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const rad = crownRadius * (0.65 + rng() * 0.32);
    pushBlossomCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Scattered Ground Petals (Organic Drift Pattern)
  const petalCount = Math.floor(80 + zone.n * 4.0);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.5 + Math.sqrt(rng()) * (half - 1.0);
    data.fallenPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.4,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.4,
      sx: 0.28 + rng() * 0.22,
      sy: 0.02,
      sz: 0.28 + rng() * 0.22,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, REALISTIC_BLOSSOMS.length),
      u: rng(),
    });
  }

  // 5. Perimeter Vegetation
  const perimeterCount = Math.floor(40 + zone.n * 2.2);
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
      c: pickIndex(rng, GRASS_SHADES.length),
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

function RealisticCanopyMesh({
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

      // Interpolates from natural fluffy blossom cluster scale to flat QR tile
      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = (v.os * 0.65) + ((v.pale ? 0.0001 : 0.16) - (v.os * 0.65)) * q;

      tmp.scale.set(
        Math.max(0.0001, sxz * grow),
        Math.max(0.0001, sy * grow),
        Math.max(0.0001, sxz * grow)
      );

      // Rotate flat during QR assembly
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
        roughness={0.58}
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

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16), []);
  const branchGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const blossomGeo = useMemo(() => createBlossomClusterGeometry(), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(() => generateRealisticSakura(seed, grid, zone), [seed, grid, zone]);

  const canopyColors = useMemo(
    () => REALISTIC_BLOSSOMS.map((c) => new THREE.Color(c)),
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
        {/* Organic Curved Trunk */}
        <InstancedBatch
          items={data.trunk}
          colors={BARK_SHADES}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Multi-tier Branch Architecture */}
        <InstancedBatch
          items={data.branches}
          colors={BRANCH_SHADES}
          geometry={branchGeo}
          roughness={0.88}
        />
        {/* Ground Drift Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={REALISTIC_BLOSSOMS}
          geometry={petalDiscGeo}
          roughness={0.6}
        />
        {/* Perimeter Grass Blades */}
        <InstancedBatch
          items={data.grassEdges}
          colors={GRASS_SHADES}
          geometry={bladeGeo}
          roughness={0.85}
        />
        {/* Accent Reeds */}
        <InstancedBatch
          items={data.pinkReeds}
          colors={REED_SHADES}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      {/* Lush, Multi-lobed Blossom Canopy */}
      <RealisticCanopyMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={blossomGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}