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

interface BlossomCluster {
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
  trunk: InstanceItem[];
  branches: InstanceItem[];
  canopy: BlossomCluster[];
  fallenPetals: InstanceItem[];
  grassEdges: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Professional Stylized Sakura Color Palette
const SAKURA_PALETTE = [
  "#ffb6c9", // Main bloom pink
  "#ffa2bb", // Vibrant mid-petal
  "#ffc8d7", // Sunlit highlight
  "#f78aa5", // Deep inner blossom shadow
  "#ffe8ef", // Petal tip soft white-pink
  "#ff95af", // Core flower tone
];

const BARK_PALETTE = ["#442d22", "#362117", "#53382c", "#2a180f"];
const BRANCH_COLOR = ["#382318", "#452d21"];
const MEADOW_GRASS = ["#7eb844", "#8ec751", "#6fa338", "#9cd15e"];
const ACCENT_REEDS = ["#d77ea1", "#e898b7", "#c2698e"];

function generateArtisticSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone
): SakuraSceneData {
  const rng = mulberry32(seed);
  const data: SakuraSceneData = {
    trunk: [],
    branches: [],
    canopy: [],
    fallenPetals: [],
    grassEdges: [],
    pinkReeds: [],
  };

  const half = (grid.total - 1) / 2;

  // Dynamic growth ratio based on URL string length and grid density
  const textLength = grid.text ? grid.text.length : 16;
  const lengthScale = Math.min(2.4, Math.max(1.0, 1.0 + (textLength - 16) * 0.024));
  const gridScale = Math.max(1.0, grid.size / 21);
  const scaleMultiplier = Math.max(lengthScale, gridScale);

  const H = 9.2 * scaleMultiplier;
  const trunkBaseRadius = 1.45 * Math.min(1.75, Math.pow(scaleMultiplier, 0.72));

  // 1. Organic S-Curved Tapered Trunk
  const numRings = Math.floor(26 * scaleMultiplier);
  const totalTrunkH = H * 0.74;
  const ringH = totalTrunkH / numRings;
  let trunkX = 0;
  let trunkZ = 0;
  const trunkAngle = rng() * Math.PI * 2;
  const leanIntensity = 0.3;

  for (let i = 0; i < numRings; i++) {
    const t = i / numRings;
    const r = THREE.MathUtils.lerp(trunkBaseRadius, trunkBaseRadius * 0.28, Math.pow(t, 0.7));

    trunkX += Math.cos(trunkAngle) * Math.sin(t * Math.PI * 0.85) * leanIntensity * 0.06;
    trunkZ += Math.sin(trunkAngle) * Math.sin(t * Math.PI * 0.85) * leanIntensity * 0.06;

    data.trunk.push({
      x: trunkX,
      y: i * ringH + ringH * 0.5,
      z: trunkZ,
      sx: r * 2,
      sy: ringH * 1.03,
      sz: r * 2,
      rx: Math.sin(t * Math.PI) * 0.04,
      ry: t * 0.8,
      rz: Math.cos(t * Math.PI) * 0.04,
      c: i % 2 === 0 ? pickIndex(rng, 2) : pickIndex(rng, 4),
      u: rng(),
    });
  }

  // 2. Recursive Golden-Angle Branch Architecture
  const limbCount = Math.floor(12 + scaleMultiplier * 6);
  const limbStartY = H * 0.36;
  const GOLDEN_ANGLE = 2.399963;

  for (let i = 0; i < limbCount; i++) {
    const angle = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.3;
    const progressAlongTrunk = i / limbCount;
    const startY = limbStartY + progressAlongTrunk * (H * 0.34);

    const isTopLeader = progressAlongTrunk > 0.55;
    const limbLen = ((isTopLeader ? 2.6 : 4.0) + rng() * (zone.n * 0.36)) * scaleMultiplier;
    const slope = isTopLeader ? 0.65 + rng() * 0.3 : 0.32 + rng() * 0.35;
    const steps = Math.ceil(limbLen * 3.6);

    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const inv = 1 / (Math.hypot(dx, slope, dz) || 1);

    let px = trunkX;
    let py = startY;
    let pz = trunkZ;

    for (let s = 0; s < steps; s++) {
      const p = s / steps;
      px += (dx + (rng() - 0.5) * 0.12) * inv * 0.32;
      py += (slope + (rng() - 0.5) * 0.08) * inv * 0.32;
      pz += (dz + (rng() - 0.5) * 0.12) * inv * 0.32;
      const thickness = Math.max(0.12, (trunkBaseRadius * 0.36) * (1 - p * 0.72));

      data.branches.push({
        x: px,
        y: py,
        z: pz,
        sx: thickness,
        sy: thickness * 1.25,
        sz: thickness,
        rx: (rng() - 0.5) * 0.18,
        ry: angle,
        rz: (rng() - 0.5) * 0.18,
        c: pickIndex(rng, 2),
        u: rng(),
      });

      // Secondary upward anchoring twigs
      if (s > 4 && s % 3 === 0 && rng() < 0.75) {
        let tpx = px;
        let tpy = py;
        let tpz = pz;
        for (let ts = 0; ts < 3; ts++) {
          tpx += (rng() - 0.5) * 0.14;
          tpy += 0.26 * scaleMultiplier;
          tpz += (rng() - 0.5) * 0.14;
          data.branches.push({
            x: tpx,
            y: tpy,
            z: tpz,
            sx: 0.1 * scaleMultiplier,
            sy: 0.13 * scaleMultiplier,
            sz: 0.1 * scaleMultiplier,
            c: 0,
            u: rng(),
          });
        }
      }
    }
  }

  // 3. Multi-Lobe Volumetric Blossom Canopy
  const crownBaseY = totalTrunkH * 0.84;
  const crownRadius = Math.max(1.6, zone.n * 0.76 * scaleMultiplier);

  // 5 discrete volumetric foliage cloud lobe centers
  const numLobes = 5;
  const lobeCenters = Array.from({ length: numLobes }, (_, i) => {
    const ang = i * ((Math.PI * 2) / numLobes) + (rng() - 0.5) * 0.35;
    const rad = crownRadius * (0.35 + rng() * 0.35);
    return {
      x: Math.cos(ang) * rad,
      y: crownBaseY + 1.2 + rng() * 2.2,
      z: Math.sin(ang) * rad,
      radius: crownRadius * (0.45 + rng() * 0.25),
    };
  });

  const pushBlossomLobe = (mx: number, mz: number, pale: boolean, isWeeping = false) => {
    let minDist = 999;
    let nearestLobe = lobeCenters[0];
    for (const lobe of lobeCenters) {
      const d = Math.hypot(mx - lobe.x, mz - lobe.z);
      if (d < minDist) {
        minDist = d;
        nearestLobe = lobe;
      }
    }

    const distNorm = Math.min(1, minDist / nearestLobe.radius);
    const dome = Math.sqrt(Math.max(0, 1 - distNorm * distNorm)) * (3.6 + zone.n * 0.16) * scaleMultiplier;

    const oy = isWeeping
      ? limbStartY + 0.3 + rng() * (H * 0.24)
      : nearestLobe.y + dome + (rng() - 0.5) * 0.85;

    data.canopy.push({
      ox: mx * (isWeeping ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      oy,
      oz: mz * (isWeeping ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      os: (isWeeping ? 0.9 + rng() * 0.45 : 1.35 + rng() * 0.85) * Math.min(1.4, scaleMultiplier),
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, SAKURA_PALETTE.length),
      pale,
      rotX: (rng() - 0.5) * 0.9,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.9,
      u: rng(),
    });
  };

  // Assign QR Code center modules to canopy
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushBlossomLobe(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Volumetric blossom puff fillers
  const fillers = Math.ceil(qrModuleCount * (3.6 + scaleMultiplier * 0.8));
  for (let i = 0; i < fillers; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.98;
    pushBlossomLobe(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Weeping perimeter blossom tendrils
  const droops = Math.floor((30 + zone.n * 1.6) * scaleMultiplier);
  for (let i = 0; i < droops; i++) {
    const angle = (i / droops) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const rad = crownRadius * (0.65 + rng() * 0.32);
    pushBlossomLobe(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Ground Fallen Petals (Organic Drift)
  const petalCount = Math.floor((75 + zone.n * 3.5) * scaleMultiplier);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.5 + Math.sqrt(rng()) * (half - 1.0);
    data.fallenPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.35,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.35,
      sx: 0.28 + rng() * 0.2,
      sy: 0.02,
      sz: 0.28 + rng() * 0.2,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, SAKURA_PALETTE.length),
      u: rng(),
    });
  }

  // 5. Perimeter Meadow Vegetation
  const perimeterCount = Math.floor(38 + zone.n * 2.2);
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
      c: pickIndex(rng, MEADOW_GRASS.length),
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
        c: pickIndex(rng, ACCENT_REEDS.length),
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
  items: BlossomCluster[];
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

      // Interpolates smoothly between volumetric cloud cluster scale and flat square module
      const sxz = v.os + ((v.pale ? 0.0001 : 0.96) - v.os) * q;
      const sy = (v.os * 0.72) + ((v.pale ? 0.0001 : 0.16) - (v.os * 0.72)) * q;

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
        roughness={0.55}
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

  // Production Geometries
  // 12-sided Dodecahedron for natural multi-faceted bloom puffs
  const blossomPuffGeo = useMemo(() => new THREE.DodecahedronGeometry(0.68, 0), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16), []);
  const branchGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(
    () => generateArtisticSakura(seed, grid, zone),
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
        {/* Seamless Tapered Trunk */}
        <InstancedBatch
          items={data.trunk}
          colors={BARK_PALETTE}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Branch Framework */}
        <InstancedBatch
          items={data.branches}
          colors={BRANCH_COLOR}
          geometry={branchGeo}
          roughness={0.88}
        />
        {/* Ground Drift Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={SAKURA_PALETTE}
          geometry={petalDiscGeo}
          roughness={0.6}
        />
        {/* Perimeter Grass Edges */}
        <InstancedBatch
          items={data.grassEdges}
          colors={MEADOW_GRASS}
          geometry={bladeGeo}
          roughness={0.85}
        />
        {/* Accent Floral Reeds */}
        <InstancedBatch
          items={data.pinkReeds}
          colors={ACCENT_REEDS}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      {/* Volumetric Sakura Canopy */}
      <CanopyMorphMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={blossomPuffGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}