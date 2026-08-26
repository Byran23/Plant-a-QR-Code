import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Palette } from "../lib/palettes";
import type { ForestZone, QRGrid } from "../lib/qr";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

interface OrientedSegment {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  quat: THREE.Quaternion;
  c: number;
  u: number;
}

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

interface TreeSceneData {
  woodSegments: OrientedSegment[];
  canopy: BlossomCluster[];
  fallenPetals: InstanceItem[];
  grassEdges: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Curated Studio-Grade Sakura Blossom Palette
const BLOSSOM_PALETTE = [
  "#ffb6c9", // Fresh open blossom
  "#ffa2bb", // Mid-tone core pink
  "#ffc8d7", // Sunlit highlight petal
  "#f78aa5", // Inner shadow rose
  "#ffe8ef", // Translucent petal tip
  "#ff95af", // Saturated bloom center
];

const WOOD_PALETTE = ["#432d22", "#382319", "#4e3528", "#2c1a11"];
const MEADOW_GRASS = ["#7eb844", "#8ec751", "#6fa338", "#9cd15e"];
const ACCENT_REEDS = ["#d77ea1", "#e898b7", "#c2698e"];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Creates a smoothly connected wooden segment between two 3D points
 * with accurate orientation and radial scale.
 */
function createSegment(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radius: number,
  colorIdx: number,
  u: number
): OrientedSegment {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

  const quat = new THREE.Quaternion();
  if (len > 0.0001) {
    const normDir = dir.clone().normalize();
    quat.setFromUnitVectors(UP, normDir);
  }

  return {
    x: mid.x,
    y: mid.y,
    z: mid.z,
    sx: radius * 2,
    sy: len,
    sz: radius * 2,
    quat,
    c: colorIdx,
    u,
  };
}

function generateArtisanSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone
): TreeSceneData {
  const rng = mulberry32(seed);
  const data: TreeSceneData = {
    woodSegments: [],
    canopy: [],
    fallenPetals: [],
    grassEdges: [],
    pinkReeds: [],
  };

  const half = (grid.total - 1) / 2;

  // Responsive growth based on URL complexity
  const textLength = grid.text ? grid.text.length : 16;
  const lengthScale = Math.min(2.4, Math.max(1.0, 1.0 + (textLength - 16) * 0.024));
  const gridScale = Math.max(1.0, grid.size / 21);
  const scaleMultiplier = Math.max(lengthScale, gridScale);

  const H = 9.4 * scaleMultiplier;
  const baseRadius = 1.35 * Math.min(1.7, Math.pow(scaleMultiplier, 0.72));

  // 1. Organic Root Buttresses (Base Flaring)
  const rootCount = 5;
  for (let i = 0; i < rootCount; i++) {
    const rootAngle = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const spread = baseRadius * (1.6 + rng() * 0.4);
    const p1 = new THREE.Vector3(
      Math.cos(rootAngle) * spread,
      FLAT_TILE_TOP + 0.04,
      Math.sin(rootAngle) * spread
    );
    const p2 = new THREE.Vector3(
      Math.cos(rootAngle) * (baseRadius * 0.8),
      H * 0.12,
      Math.sin(rootAngle) * (baseRadius * 0.8)
    );
    data.woodSegments.push(
      createSegment(p1, p2, baseRadius * 0.42, pickIndex(rng, WOOD_PALETTE.length), rng())
    );
  }

  // 2. Smooth Spline Curved Trunk
  const trunkSteps = Math.floor(14 * scaleMultiplier);
  const trunkPoints: { pos: THREE.Vector3; radius: number }[] = [];
  let currX = 0;
  let currZ = 0;
  const sCurveAngle = rng() * Math.PI * 2;
  const sCurveStrength = 0.28;

  for (let i = 0; i <= trunkSteps; i++) {
    const t = i / trunkSteps;
    const y = t * (H * 0.72);
    currX = Math.cos(sCurveAngle) * Math.sin(t * Math.PI * 0.9) * sCurveStrength * baseRadius;
    currZ = Math.sin(sCurveAngle) * Math.sin(t * Math.PI * 0.9) * sCurveStrength * baseRadius;
    const r = THREE.MathUtils.lerp(baseRadius, baseRadius * 0.26, Math.pow(t, 0.75));

    trunkPoints.push({
      pos: new THREE.Vector3(currX, y + FLAT_TILE_TOP, currZ),
      radius: r,
    });
  }

  for (let i = 0; i < trunkPoints.length - 1; i++) {
    const p1 = trunkPoints[i].pos;
    const p2 = trunkPoints[i + 1].pos;
    const r = (trunkPoints[i].radius + trunkPoints[i + 1].radius) * 0.5;
    data.woodSegments.push(
      createSegment(p1, p2, r, i % 2 === 0 ? 0 : 1, rng())
    );
  }

  // 3. Multi-Tiered Golden-Angle Branch Network
  const GOLDEN_ANGLE = 2.399963;
  const primaryBoughCount = Math.floor(10 + scaleMultiplier * 5);
  const boughStartIdx = Math.floor(trunkSteps * 0.35);
  const branchEndpoints: THREE.Vector3[] = [];

  for (let i = 0; i < primaryBoughCount; i++) {
    const tProgress = i / primaryBoughCount;
    const attachIdx = Math.min(
      trunkSteps - 1,
      boughStartIdx + Math.floor(tProgress * (trunkSteps - boughStartIdx))
    );
    const attachPoint = trunkPoints[attachIdx];

    const angle = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.35;
    const isTopApex = tProgress > 0.65;
    const boughLength = ((isTopApex ? 2.6 : 4.2) + rng() * (zone.n * 0.36)) * scaleMultiplier;
    const elevation = isTopApex ? 0.65 + rng() * 0.3 : 0.32 + rng() * 0.28;
    const steps = Math.ceil(boughLength * 2.8);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, elevation, dirZ) || 1);

    let start = attachPoint.pos.clone();
    let parentRadius = attachPoint.radius * 0.55;

    for (let s = 0; s < steps; s++) {
      const stepT = s / steps;
      const stepLen = 0.42;
      const end = new THREE.Vector3(
        start.x + (dirX + (rng() - 0.5) * 0.12) * inv * stepLen,
        start.y + (elevation + (rng() - 0.5) * 0.08) * inv * stepLen,
        start.z + (dirZ + (rng() - 0.5) * 0.12) * inv * stepLen
      );

      const r = Math.max(0.1, parentRadius * (1 - stepT * 0.68));
      data.woodSegments.push(
        createSegment(start, end, r, pickIndex(rng, WOOD_PALETTE.length), rng())
      );

      // Tertiary twigs branching upward into foliage
      if (s > 2 && s % 2 === 0 && rng() < 0.72) {
        const twigAngle = angle + (rng() > 0.5 ? 0.65 : -0.65) + (rng() - 0.5) * 0.2;
        const twigEnd = new THREE.Vector3(
          end.x + Math.cos(twigAngle) * 0.45 * scaleMultiplier,
          end.y + (0.35 + rng() * 0.25) * scaleMultiplier,
          end.z + Math.sin(twigAngle) * 0.45 * scaleMultiplier
        );
        data.woodSegments.push(
          createSegment(end, twigEnd, 0.08 * scaleMultiplier, 1, rng())
        );
        branchEndpoints.push(twigEnd);
      }

      start = end;
    }
    branchEndpoints.push(start);
  }

  // 4. Volumetric Blossom Foliage Lobes
  const crownBaseY = H * 0.68;
  const crownRadius = Math.max(1.6, zone.n * 0.78 * scaleMultiplier);

  const numLobes = 6;
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

  const pushBlossomCluster = (mx: number, mz: number, pale: boolean, isWeeping = false) => {
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
      ? crownBaseY * 0.65 + rng() * (H * 0.22)
      : nearestLobe.y + dome + (rng() - 0.5) * 0.85;

    data.canopy.push({
      ox: mx * (isWeeping ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      oy,
      oz: mz * (isWeeping ? 1.06 : 0.94) + (rng() - 0.5) * 0.75,
      os: (isWeeping ? 0.95 + rng() * 0.45 : 1.35 + rng() * 0.85) * Math.min(1.4, scaleMultiplier),
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, BLOSSOM_PALETTE.length),
      pale,
      rotX: (rng() - 0.5) * 0.9,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.9,
      u: rng(),
    });
  };

  // Map QR Code center modules to canopy
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

  // Volumetric blossom puff fillers
  const fillers = Math.ceil(qrModuleCount * (3.6 + scaleMultiplier * 0.8));
  for (let i = 0; i < fillers; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.98;
    pushBlossomCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Weeping perimeter blossom tendrils
  const droops = Math.floor((30 + zone.n * 1.6) * scaleMultiplier);
  for (let i = 0; i < droops; i++) {
    const angle = (i / droops) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const rad = crownRadius * (0.65 + rng() * 0.32);
    pushBlossomCluster(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 5. Ground Fallen Petals (Organic Drift)
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
      c: pickIndex(rng, BLOSSOM_PALETTE.length),
      u: rng(),
    });
  }

  // 6. Perimeter Grass & Reeds
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

/**
 * Renders smoothly oriented branch and trunk segments with quaternion rotation
 */
function OrientedWoodMesh({
  items,
  colors,
  geometry,
  roughness = 0.88,
}: {
  items: OrientedSegment[];
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
      tmp.quaternion.copy(v.quat);
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
      <meshStandardMaterial roughness={roughness} metalness={0.02} />
    </instancedMesh>
  );
}

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
        roughness={0.54}
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

  // High-poly smooth cylinder for oriented branches
  const branchSegmentGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), []);
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.68, 0), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(
    () => generateArtisanSakura(seed, grid, zone),
    [seed, grid, zone]
  );

  const canopyColors = useMemo(
    () => BLOSSOM_PALETTE.map((c) => new THREE.Color(c)),
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
        {/* Connected Organic Trunk, Buttress Roots & Branch System */}
        <OrientedWoodMesh
          items={data.woodSegments}
          colors={WOOD_PALETTE}
          geometry={branchSegmentGeo}
          roughness={0.9}
        />
        {/* Ground Drift Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={BLOSSOM_PALETTE}
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

      {/* Volumetric Blossom Canopy */}
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