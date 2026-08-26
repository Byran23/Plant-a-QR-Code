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

// Sampled from the reference: Vibrant, multi-tone layered sakura blossoms
const REFERENCE_SAKURA_PALETTE = [
  "#ff9eb8", // Main mid-tone blossom
  "#ffaec3", // Sunlit highlight pink
  "#f78aa6", // Core shadow rose
  "#ffc2d4", // Light outer petal
  "#fa789a", // Deep inner cluster shadow
  "#ffd6e2", // Blossom tip highlight
];

// Rich warm mahogany / dark cherry bark
const REFERENCE_BARK_PALETTE = [
  "#44271e", // Primary bark
  "#331a12", // Deep trunk shadow
  "#573327", // Mid-tone bark
  "#26130d", // Root flare base shadow
  "#633b2d", // Branch highlight
];

const MEADOW_GRASS = ["#7eb844", "#8ec751", "#6fa338", "#9cd15e"];
const ACCENT_REEDS = ["#d77ea1", "#e898b7", "#c2698e"];

const UP = new THREE.Vector3(0, 1, 0);

function createSegment(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  r1: number,
  r2: number,
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

  const avgRadius = (r1 + r2) * 0.5;

  return {
    x: mid.x,
    y: mid.y,
    z: mid.z,
    sx: avgRadius * 2,
    sy: len * 1.05,
    sz: avgRadius * 2,
    quat,
    c: colorIdx,
    u,
  };
}

function generateReferenceStyleSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone,
  colorPaletteLength: number
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

  // Proportions matching the reference's wide canopy and sweeping root trunk
  const H = 9.6;
  const baseTrunkRadius = 1.45;

  // Density multiplier scaling with URL length
  const textLength = grid.text ? grid.text.length : 16;
  const petalMultiplier = Math.min(3.8, Math.max(1.0, 1.0 + (textLength - 16) * 0.055));

  // 1. Broad Flared Base Roots (Wide anchor as in reference)
  const rootCount = 8;
  for (let i = 0; i < rootCount; i++) {
    const rootAngle = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const spread = baseTrunkRadius * (1.6 + rng() * 0.35);
    const p1 = new THREE.Vector3(
      Math.cos(rootAngle) * spread,
      FLAT_TILE_TOP + 0.02,
      Math.sin(rootAngle) * spread
    );
    const p2 = new THREE.Vector3(
      Math.cos(rootAngle) * (baseTrunkRadius * 0.65),
      H * 0.14,
      Math.sin(rootAngle) * (baseTrunkRadius * 0.65)
    );
    data.woodSegments.push(
      createSegment(p1, p2, baseTrunkRadius * 0.45, baseTrunkRadius * 0.3, 3, rng())
    );
  }

  // 2. Trunk Spline with Smooth Flared Taper
  const trunkSegments = 16;
  const trunkSpline: { pos: THREE.Vector3; radius: number }[] = [];
  const sCurveAngle = rng() * Math.PI * 2;
  const sCurvePower = 0.22;

  for (let i = 0; i <= trunkSegments; i++) {
    const t = i / trunkSegments;
    const y = t * (H * 0.62);
    const bend = Math.sin(t * Math.PI * 0.95) * sCurvePower * baseTrunkRadius;
    const cx = Math.cos(sCurveAngle) * bend;
    const cz = Math.sin(sCurveAngle) * bend;
    // Dramatic taper from the flared base to the fork
    const r = THREE.MathUtils.lerp(baseTrunkRadius, baseTrunkRadius * 0.32, Math.pow(t, 0.6));

    trunkSpline.push({
      pos: new THREE.Vector3(cx, y + FLAT_TILE_TOP, cz),
      radius: r,
    });
  }

  for (let i = 0; i < trunkSpline.length - 1; i++) {
    const p1 = trunkSpline[i].pos;
    const p2 = trunkSpline[i + 1].pos;
    const r1 = trunkSpline[i].radius;
    const r2 = trunkSpline[i + 1].radius;
    data.woodSegments.push(
      createSegment(p1, p2, r1, r2, i % 2 === 0 ? 0 : 1, rng())
    );
  }

  // 3. Sweeping Upward Boughs (Matching the fork and upward reach in reference)
  const primaryBoughCount = 12;
  const boughStartIdx = Math.floor(trunkSegments * 0.4);
  const potentialFlowerSites: { pos: THREE.Vector3; weight: number }[] = [];

  for (let i = 0; i < primaryBoughCount; i++) {
    const tProgress = i / primaryBoughCount;
    const attachIdx = Math.min(
      trunkSegments - 1,
      boughStartIdx + Math.floor(tProgress * (trunkSegments - boughStartIdx))
    );
    const attachPoint = trunkSpline[attachIdx];

    const angle = (i / primaryBoughCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const isTopApex = tProgress > 0.55;
    const boughLength = (isTopApex ? 3.2 : 4.6) + rng() * 0.6;
    const elevation = isTopApex ? 0.72 + rng() * 0.22 : 0.42 + rng() * 0.25;
    const steps = Math.ceil(boughLength * 3.4);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, elevation, dirZ) || 1);

    let currStart = attachPoint.pos.clone();
    let currentRadius = attachPoint.radius * 0.62;

    for (let s = 0; s < steps; s++) {
      const stepT = s / steps;
      const stepLen = 0.36;
      // Slight upward cup shape towards the canopy outer edge
      const sweepCup = Math.sin(stepT * Math.PI * 0.8) * 0.08;
      const currElevation = elevation + sweepCup;

      const nextEnd = new THREE.Vector3(
        currStart.x + (dirX + (rng() - 0.5) * 0.08) * inv * stepLen,
        currStart.y + (currElevation + (rng() - 0.5) * 0.06) * inv * stepLen,
        currStart.z + (dirZ + (rng() - 0.5) * 0.08) * inv * stepLen
      );

      const nextRadius = Math.max(0.08, currentRadius * (1 - stepT * 0.62));
      data.woodSegments.push(
        createSegment(currStart, nextEnd, currentRadius, nextRadius, pickIndex(rng, REFERENCE_BARK_PALETTE.length), rng())
      );

      if (s >= Math.floor(steps * 0.2)) {
        potentialFlowerSites.push({
          pos: nextEnd.clone(),
          weight: 0.7 + stepT * 0.3,
        });
      }

      // Secondary and tertiary twigs branching into the cloud lobes
      if (s > 2 && s % 2 === 0 && rng() < 0.85) {
        const twigAngle = angle + (rng() > 0.5 ? 0.65 : -0.65) + (rng() - 0.5) * 0.2;
        const twigLen = 0.55 + rng() * 0.45;
        const twigEnd = new THREE.Vector3(
          nextEnd.x + Math.cos(twigAngle) * twigLen,
          nextEnd.y + (0.35 + rng() * 0.3),
          nextEnd.z + Math.sin(twigAngle) * twigLen
        );
        data.woodSegments.push(
          createSegment(nextEnd, twigEnd, nextRadius * 0.65, 0.06, 2, rng())
        );

        potentialFlowerSites.push({
          pos: twigEnd.clone(),
          weight: 1.0,
        });
      }

      currStart = nextEnd;
      currentRadius = nextRadius;
    }

    potentialFlowerSites.push({
      pos: currStart.clone(),
      weight: 1.0,
    });
  }

  // 4. Volumetric Dome & Cloud Formation
  const crownRadius = Math.max(1.8, zone.n * 0.78);

  const pushBlossomCluster = (
    mx: number,
    mz: number,
    pale: boolean,
    anchorPos?: THREE.Vector3,
    customSize?: number
  ) => {
    let ox = 0;
    let oy = 0;
    let oz = 0;

    if (anchorPos) {
      ox = anchorPos.x + (rng() - 0.5) * 0.34;
      oy = anchorPos.y + (rng() - 0.5) * 0.28;
      oz = anchorPos.z + (rng() - 0.5) * 0.34;
    } else {
      let nearestDist = 999;
      let target = potentialFlowerSites[0]?.pos || new THREE.Vector3(0, H * 0.7, 0);

      for (const site of potentialFlowerSites) {
        const d = Math.hypot(mx - site.pos.x, mz - site.pos.z);
        if (d < nearestDist) {
          nearestDist = d;
          target = site.pos;
        }
      }

      ox = mx * 0.94 + (rng() - 0.5) * 0.35;
      oy = target.y + (rng() - 0.5) * 0.45;
      oz = mz * 0.94 + (rng() - 0.5) * 0.35;
    }

    const clusterScale = customSize || 0.48 + rng() * 0.2;

    data.canopy.push({
      ox,
      oy,
      oz,
      os: clusterScale,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, Math.max(1, colorPaletteLength)),
      pale,
      rotX: (rng() - 0.5) * 0.8,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.8,
      u: rng(),
    });
  };

  // 4a. QR Data Modules
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

  // 4b. Multi-Layer Floral Florets Directly on Branches
  for (const site of potentialFlowerSites) {
    pushBlossomCluster(site.pos.x, site.pos.z, true, site.pos);

    const extraPuffsPerNode = Math.floor(4 + (petalMultiplier - 1.0) * 4.5);
    for (let p = 0; p < extraPuffsPerNode; p++) {
      const offset = site.pos.clone().add(
        new THREE.Vector3(
          (rng() - 0.5) * 0.44,
          (rng() - 0.5) * 0.36,
          (rng() - 0.5) * 0.44
        )
      );
      pushBlossomCluster(offset.x, offset.z, true, offset, 0.44 + rng() * 0.18);
    }
  }

  // 4c. Volumetric Crown Dome Filler Blossoms
  const fillerCount = Math.floor(140 * petalMultiplier);
  for (let i = 0; i < fillerCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.98;
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    const dome = Math.pow(Math.max(0, 1 - rad / crownRadius), 0.55) * 3.4;
    const fillerPos = new THREE.Vector3(mx, H * 0.58 + dome + (rng() - 0.5) * 0.8, mz);
    pushBlossomCluster(mx, mz, true, fillerPos, 0.46 + rng() * 0.18);
  }

  // 4d. Weeping Hanging Blossom Clusters (Fringes below boughs)
  const droopCount = Math.floor(38 * petalMultiplier);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = crownRadius * (0.64 + rng() * 0.28);
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    const dropPos = new THREE.Vector3(mx, H * 0.52 + rng() * 1.6, mz);
    pushBlossomCluster(mx, mz, true, dropPos, 0.46 + rng() * 0.18);
  }

  // 5. Fallen Ground Petal Decals
  const petalCount = Math.floor(120 * petalMultiplier);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.4 + Math.sqrt(rng()) * (half - 0.8);
    data.fallenPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.35,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.35,
      sx: 0.24 + rng() * 0.16,
      sy: 0.02,
      sz: 0.24 + rng() * 0.16,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, Math.max(1, colorPaletteLength)),
      u: rng(),
    });
  }

  // 6. Perimeter Grass & Accent Reeds
  const perimeterCount = 36;
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
  dark,
}: {
  items: BlossomCluster[];
  colors: THREE.Color[];
  geometry: THREE.BufferGeometry;
  seed: number;
  dark: THREE.Color;
}) {
  const visible = items;
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
        roughness={0.52}
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

  const branchSegmentGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16), []);
  // Compact dodecahedron geometry for dense floret clusters
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.44, 0), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const activeFoliageHexArray = useMemo(() => {
    return palette?.foliage && palette.foliage.length > 0
      ? palette.foliage
      : REFERENCE_SAKURA_PALETTE;
  }, [palette]);

  const data = useMemo(
    () => generateReferenceStyleSakura(seed, grid, zone, activeFoliageHexArray.length),
    [seed, grid, zone, activeFoliageHexArray.length]
  );

  const canopyColors = useMemo(
    () => activeFoliageHexArray.map((c) => new THREE.Color(c)),
    [activeFoliageHexArray]
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
        {/* Sculpted Mahogany Trunk & Boughs */}
        <OrientedWoodMesh
          items={data.woodSegments}
          colors={REFERENCE_BARK_PALETTE}
          geometry={branchSegmentGeo}
          roughness={0.92}
        />
        {/* Ground Drift Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={activeFoliageHexArray}
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

      {/* Volumetric Sakura Blossom Canopy */}
      <CanopyMorphMesh
        items={data.canopy}
        colors={canopyColors}
        geometry={blossomClusterGeo}
        seed={seed}
        dark={qrDark}
      />
    </>
  );
}