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

// Refined, natural blossom palette with light and shadow contrast
const SAKURA_PALETTE = [
  "#fba3ba", // Delicate open petal
  "#f389a4", // Core bloom pink
  "#fcc4d3", // Highlight petal
  "#e87291", // Deeper canopy shadow
  "#fee6ed", // White-pink blossom tip
  "#f2809e", // Mid-tone flower
];

const BARK_PALETTE = [
  "#3a2318",
  "#4c3123",
  "#5a3c2c",
  "#2a180f",
  "#664534",
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
    sy: len * 1.04,
    sz: avgRadius * 2,
    quat,
    c: colorIdx,
    u,
  };
}

function generateNaturalSakura(
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

  const textLength = grid.text ? grid.text.length : 16;
  const lengthScale = Math.min(2.2, Math.max(1.0, 1.0 + (textLength - 16) * 0.022));
  const gridScale = Math.max(1.0, grid.size / 21);
  const scaleMultiplier = Math.max(lengthScale, gridScale);

  const H = 9.6 * scaleMultiplier;
  const baseTrunkRadius = 1.35 * Math.min(1.65, Math.pow(scaleMultiplier, 0.72));

  // 1. Root Flares
  const rootCount = 6;
  for (let i = 0; i < rootCount; i++) {
    const rootAngle = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const spread = baseTrunkRadius * (1.5 + rng() * 0.45);
    const p1 = new THREE.Vector3(
      Math.cos(rootAngle) * spread,
      FLAT_TILE_TOP + 0.02,
      Math.sin(rootAngle) * spread
    );
    const p2 = new THREE.Vector3(
      Math.cos(rootAngle) * (baseTrunkRadius * 0.75),
      H * 0.1,
      Math.sin(rootAngle) * (baseTrunkRadius * 0.75)
    );
    data.woodSegments.push(
      createSegment(p1, p2, baseTrunkRadius * 0.45, baseTrunkRadius * 0.3, 3, rng())
    );
  }

  // 2. Trunk Spline
  const trunkSegments = Math.floor(16 * scaleMultiplier);
  const trunkSpline: { pos: THREE.Vector3; radius: number }[] = [];
  const sCurveAngle = rng() * Math.PI * 2;
  const sCurvePower = 0.3;

  for (let i = 0; i <= trunkSegments; i++) {
    const t = i / trunkSegments;
    const y = t * (H * 0.74);
    const bend = Math.sin(t * Math.PI * 1.1) * sCurvePower * baseTrunkRadius;
    const cx = Math.cos(sCurveAngle) * bend;
    const cz = Math.sin(sCurveAngle) * bend;
    const r = THREE.MathUtils.lerp(baseTrunkRadius, baseTrunkRadius * 0.24, Math.pow(t, 0.78));

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

  // 3. Natural Branch Architecture & Branch Twig Tracking
  const GOLDEN_ANGLE = 2.399963;
  const primaryBoughCount = Math.floor(10 + scaleMultiplier * 5);
  const boughStartIdx = Math.floor(trunkSegments * 0.32);
  const branchClusters: { pos: THREE.Vector3; size: number }[] = [];

  for (let i = 0; i < primaryBoughCount; i++) {
    const tProgress = i / primaryBoughCount;
    const attachIdx = Math.min(
      trunkSegments - 1,
      boughStartIdx + Math.floor(tProgress * (trunkSegments - boughStartIdx))
    );
    const attachPoint = trunkSpline[attachIdx];

    const angle = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.3;
    const isTopCrownLeader = tProgress > 0.62;
    const boughLength = ((isTopCrownLeader ? 2.6 : 4.3) + rng() * (zone.n * 0.36)) * scaleMultiplier;
    const elevation = isTopCrownLeader ? 0.68 + rng() * 0.28 : 0.3 + rng() * 0.25;
    const steps = Math.ceil(boughLength * 3.2);

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const inv = 1 / (Math.hypot(dirX, elevation, dirZ) || 1);

    let currStart = attachPoint.pos.clone();
    let currentRadius = attachPoint.radius * 0.56;

    for (let s = 0; s < steps; s++) {
      const stepT = s / steps;
      const stepLen = 0.38;
      const gravitySag = Math.sin(stepT * Math.PI) * -0.05;
      const currElevation = elevation + gravitySag;

      const nextEnd = new THREE.Vector3(
        currStart.x + (dirX + (rng() - 0.5) * 0.1) * inv * stepLen,
        currStart.y + (currElevation + (rng() - 0.5) * 0.08) * inv * stepLen,
        currStart.z + (dirZ + (rng() - 0.5) * 0.1) * inv * stepLen
      );

      const nextRadius = Math.max(0.08, currentRadius * (1 - stepT * 0.65));
      data.woodSegments.push(
        createSegment(currStart, nextEnd, currentRadius, nextRadius, pickIndex(rng, BARK_PALETTE.length), rng())
      );

      // Distribute crisp flower clusters along the outer half of branches
      if (s >= Math.floor(steps * 0.45) && s % 2 === 0) {
        branchClusters.push({
          pos: nextEnd.clone(),
          size: 0.85 + rng() * 0.4,
        });
      }

      // Secondary and tertiary twigs
      if (s > 2 && s % 2 === 0 && rng() < 0.78) {
        const twigAngle = angle + (rng() > 0.5 ? 0.68 : -0.68) + (rng() - 0.5) * 0.2;
        const twigLen = (0.5 + rng() * 0.4) * scaleMultiplier;
        const twigEnd = new THREE.Vector3(
          nextEnd.x + Math.cos(twigAngle) * twigLen,
          nextEnd.y + (0.32 + rng() * 0.28) * scaleMultiplier,
          nextEnd.z + Math.sin(twigAngle) * twigLen
        );
        data.woodSegments.push(
          createSegment(nextEnd, twigEnd, nextRadius * 0.7, 0.06, 2, rng())
        );

        // Flower cluster resting at the tip of the twig
        branchClusters.push({
          pos: twigEnd.clone(),
          size: 0.95 + rng() * 0.35,
        });
      }

      currStart = nextEnd;
      currentRadius = nextRadius;
    }

    // Terminal branch tip cluster
    branchClusters.push({
      pos: currStart.clone(),
      size: 1.05 + rng() * 0.35,
    });
  }

  // 4. Balanced Blossom Canopy (Layered & Airy, Not a Solid Mass)
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
      ox = anchorPos.x + (rng() - 0.5) * 0.35;
      oy = anchorPos.y + (rng() - 0.5) * 0.3;
      oz = anchorPos.z + (rng() - 0.5) * 0.35;
    } else {
      // Find nearest branch node so QR modules settle naturally on the structure
      let nearestDist = 999;
      let target = branchClusters[0]?.pos || new THREE.Vector3(0, H * 0.7, 0);

      for (const bc of branchClusters) {
        const d = Math.hypot(mx - bc.pos.x, mz - bc.pos.z);
        if (d < nearestDist) {
          nearestDist = d;
          target = bc.pos;
        }
      }

      ox = mx * 0.95 + (rng() - 0.5) * 0.45;
      oy = target.y + (rng() - 0.5) * 0.6;
      oz = mz * 0.95 + (rng() - 0.5) * 0.45;
    }

    const clusterScale = (customSize || (0.85 + rng() * 0.45)) * Math.min(1.25, scaleMultiplier);

    data.canopy.push({
      ox,
      oy,
      oz,
      os: clusterScale,
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

  // 4a. Map QR Data Modules
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

  // 4b. Fill the Branch Nodes Naturally (Moderate density so wood silhouette stays visible)
  for (const bc of branchClusters) {
    pushBlossomCluster(bc.pos.x, bc.pos.z, true, bc.pos, bc.size);
    if (rng() < 0.45) {
      const offsetPos = bc.pos.clone().add(
        new THREE.Vector3((rng() - 0.5) * 0.3, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.3)
      );
      pushBlossomCluster(offsetPos.x, offsetPos.z, true, offsetPos, bc.size * 0.8);
    }
  }

  // 4c. Weeping Hanging Tendrils (Lightly scattered on lower perimeter)
  const droopCount = Math.floor(18 + zone.n * 0.9);
  const crownRadius = Math.max(1.6, zone.n * 0.74 * scaleMultiplier);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = crownRadius * (0.62 + rng() * 0.28);
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    const dropPos = new THREE.Vector3(mx, H * 0.52 + rng() * (H * 0.2), mz);
    pushBlossomCluster(mx, mz, true, dropPos, 0.75 + rng() * 0.3);
  }

  // 5. Ground Fallen Petals
  const petalCount = Math.floor((65 + zone.n * 3.0) * scaleMultiplier);
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

  // 6. Perimeter Grass & Reeds
  const perimeterCount = Math.floor(36 + zone.n * 2.0);
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

  const branchSegmentGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16), []);
  // Faceted dodecahedron geometry creates clean, crisp blossom florets
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.58, 0), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const data = useMemo(
    () => generateNaturalSakura(seed, grid, zone),
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
        {/* Continuous Trunk, Buttress Roots & Branch Network */}
        <OrientedWoodMesh
          items={data.woodSegments}
          colors={BARK_PALETTE}
          geometry={branchSegmentGeo}
          roughness={0.92}
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

      {/* Natural, Layered Blossom Clusters Distributed Along Branch Nodes */}
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