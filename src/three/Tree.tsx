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

interface DriftPetal {
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  swaySpeed: number;
  phase: number;
  size: number;
  colorIdx: number;
}

interface TreeSceneData {
  woodSegments: OrientedSegment[];
  rocks: InstanceItem[];
  canopy: BlossomCluster[];
  fallenPetals: InstanceItem[];
  driftingPetals: DriftPetal[];
  grassEdges: InstanceItem[];
  pinkReeds: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Rich, luminous palette with warm coral and deep rose highlights
const GUSHY_SAKURA_PALETTE = [
  "#ff9ebb", // Vibrant soft bloom
  "#ffb6cd", // Velvet highlight petal
  "#f77f9f", // Saturated floral core
  "#ffc8d9", // Ethereal translucent tip
  "#ea658b", // Deep under-canopy rose
  "#ffe2ec", // Pure light blossom froth
  "#ff8fae", // Rosy mid-tone
];

const TWISTED_WOOD_PALETTE = [
  "#4a352c",
  "#3a251d",
  "#5a4237",
  "#2c1b14",
  "#684e42",
];

const ROCK_PALETTE = ["#9ea3a8", "#888e94", "#b0b6bc", "#757c82"];
const MEADOW_GRASS = ["#6b9438", "#7da644", "#5d8230", "#8cb852"];
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

function generateGushyBonsaiSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone,
  colorPaletteLength: number
): TreeSceneData {
  const rng = mulberry32(seed);
  const data: TreeSceneData = {
    woodSegments: [],
    rocks: [],
    canopy: [],
    fallenPetals: [],
    driftingPetals: [],
    grassEdges: [],
    pinkReeds: [],
  };

  const half = (grid.total - 1) / 2;
  const H = 9.4;
  const baseTrunkRadius = 1.35;

  const textLength = grid.text ? grid.text.length : 16;
  const petalMultiplier = Math.min(4.0, Math.max(1.0, 1.0 + (textLength - 16) * 0.06));

  // 1. Root Base
  const rootCount = 7;
  for (let i = 0; i < rootCount; i++) {
    const rootAngle = (i / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const spread = baseTrunkRadius * (1.65 + rng() * 0.35);
    const p1 = new THREE.Vector3(
      Math.cos(rootAngle) * spread,
      FLAT_TILE_TOP + 0.02,
      Math.sin(rootAngle) * spread
    );
    const p2 = new THREE.Vector3(
      Math.cos(rootAngle) * (baseTrunkRadius * 0.68),
      H * 0.12,
      Math.sin(rootAngle) * (baseTrunkRadius * 0.68)
    );
    data.woodSegments.push(
      createSegment(p1, p2, baseTrunkRadius * 0.42, baseTrunkRadius * 0.28, 3, rng())
    );
  }

  // 2. Twisted Bonsai Trunk
  const trunkSegments = 18;
  const trunkSpline: { pos: THREE.Vector3; radius: number }[] = [];
  const twistAngleOffset = rng() * Math.PI * 2;

  for (let i = 0; i <= trunkSegments; i++) {
    const t = i / trunkSegments;
    const y = t * (H * 0.64);
    const twistRad = Math.sin(t * Math.PI * 1.35) * (baseTrunkRadius * 0.72);
    const ang = twistAngleOffset + t * Math.PI * 1.25;
    const cx = Math.cos(ang) * twistRad;
    const cz = Math.sin(ang) * twistRad * 0.65;
    const r = THREE.MathUtils.lerp(baseTrunkRadius, baseTrunkRadius * 0.3, Math.pow(t, 0.62));

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
      createSegment(p1, p2, r1, r2, i % 2 === 0 ? 0 : 2, rng())
    );

    if (i < trunkSegments - 3) {
      const strandOffset = new THREE.Vector3(
        (rng() - 0.5) * r1 * 0.4,
        0,
        (rng() - 0.5) * r1 * 0.4
      );
      data.woodSegments.push(
        createSegment(
          p1.clone().add(strandOffset),
          p2.clone().add(strandOffset),
          r1 * 0.45,
          r2 * 0.45,
          1,
          rng()
        )
      );
    }
  }

  // 3. Volumetric Bonsai Cloud Pad Anchors
  const cloudCenters = [
    { x: 0.2, y: H * 0.88, z: -0.1, radius: 2.4, weight: 1.5 },
    { x: -2.4, y: H * 0.65, z: 0.3, radius: 1.6, weight: 1.1 },
    { x: -3.1, y: H * 0.46, z: 0.6, radius: 1.35, weight: 0.9 },
    { x: 2.6, y: H * 0.52, z: 0.4, radius: 1.45, weight: 1.0 },
  ];

  const potentialFlowerSites: { pos: THREE.Vector3; weight: number; cloudIdx: number }[] = [];

  cloudCenters.forEach((cloud, cIdx) => {
    const attachIdx = cIdx === 0 ? trunkSegments - 2 : Math.floor(trunkSegments * (0.55 + cIdx * 0.12));
    const startPoint = trunkSpline[Math.min(trunkSegments - 1, attachIdx)];
    const targetPos = new THREE.Vector3(cloud.x, cloud.y - 0.5, cloud.z);
    const steps = 7;

    let currStart = startPoint.pos.clone();
    let currRadius = startPoint.radius * 0.65;

    for (let s = 1; s <= steps; s++) {
      const progress = s / steps;
      const arch = Math.sin(progress * Math.PI) * 0.35;
      const nextEnd = new THREE.Vector3().lerpVectors(startPoint.pos, targetPos, progress);
      nextEnd.y += arch;
      nextEnd.x += (rng() - 0.5) * 0.15;
      nextEnd.z += (rng() - 0.5) * 0.15;

      const nextRadius = Math.max(0.08, currRadius * (1 - progress * 0.55));
      data.woodSegments.push(
        createSegment(currStart, nextEnd, currRadius, nextRadius, pickIndex(rng, TWISTED_WOOD_PALETTE.length), rng())
      );

      if (progress > 0.35) {
        potentialFlowerSites.push({
          pos: nextEnd.clone(),
          weight: progress,
          cloudIdx: cIdx,
        });
      }

      if (s > 2 && s % 2 === 0) {
        const twigEnd = nextEnd.clone().add(
          new THREE.Vector3((rng() - 0.5) * 0.6, (rng() - 0.5) * 0.4 + 0.2, (rng() - 0.5) * 0.6)
        );
        data.woodSegments.push(
          createSegment(nextEnd, twigEnd, nextRadius * 0.6, 0.06, 1, rng())
        );
        potentialFlowerSites.push({
          pos: twigEnd.clone(),
          weight: 1.0,
          cloudIdx: cIdx,
        });
      }

      currStart = nextEnd;
      currRadius = nextRadius;
    }
  });

  // 4. Ultra-Gushy Blossom Puffs with Soft Overlap
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
      ox = anchorPos.x + (rng() - 0.5) * 0.32;
      oy = anchorPos.y + (rng() - 0.5) * 0.28;
      oz = anchorPos.z + (rng() - 0.5) * 0.32;
    } else {
      let minDist = 999;
      let targetCloud = cloudCenters[0];
      for (const cloud of cloudCenters) {
        const d = Math.hypot(mx - cloud.x, mz - cloud.z);
        if (d < minDist) {
          minDist = d;
          targetCloud = cloud;
        }
      }

      const distNorm = Math.min(1, minDist / targetCloud.radius);
      const dome = Math.sqrt(Math.max(0, 1 - distNorm * distNorm)) * 1.9;

      ox = mx * 0.92 + (rng() - 0.5) * 0.35;
      oy = targetCloud.y + dome + (rng() - 0.5) * 0.6;
      oz = mz * 0.92 + (rng() - 0.5) * 0.35;
    }

    const clusterScale = customSize || (0.48 + rng() * 0.2);

    data.canopy.push({
      ox,
      oy,
      oz,
      os: clusterScale,
      fx: mx,
      fz: mz,
      ci: pickIndex(rng, Math.max(1, colorPaletteLength)),
      pale,
      rotX: (rng() - 0.5) * 0.9,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.9,
      u: rng(),
    });
  };

  // QR Code Modules
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushBlossomCluster(gc - half, gr - half, false);
      }
    }
  }

  // Heavy floral density layered onto branch waypoints
  for (const site of potentialFlowerSites) {
    pushBlossomCluster(site.pos.x, site.pos.z, true, site.pos);

    const puffs = Math.floor(5 + (petalMultiplier - 1.0) * 4.8);
    for (let p = 0; p < puffs; p++) {
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

  // Deep cloud dome fills
  cloudCenters.forEach((cloud) => {
    const count = Math.floor(60 * cloud.weight * petalMultiplier);
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = Math.sqrt(rng()) * cloud.radius;
      const mx = cloud.x + Math.cos(ang) * rad;
      const mz = cloud.z + Math.sin(ang) * rad;
      const dome = Math.pow(Math.max(0, 1 - rad / cloud.radius), 0.52) * 1.6;
      const fillerPos = new THREE.Vector3(mx, cloud.y + dome + (rng() - 0.5) * 0.45, mz);
      pushBlossomCluster(mx, mz, true, fillerPos, 0.46 + rng() * 0.18);
    }
  });

  // 5. Air Petal Drift Swirl (Cascading ambient particles)
  const driftCount = 48;
  for (let i = 0; i < driftCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.6 + Math.sqrt(rng()) * 3.4;
    data.driftingPetals.push({
      baseX: Math.cos(angle) * rad,
      baseY: 0.8 + rng() * (H * 0.85),
      baseZ: Math.sin(angle) * rad,
      speed: 0.4 + rng() * 0.5,
      swaySpeed: 1.2 + rng() * 1.5,
      phase: rng() * Math.PI * 2,
      size: 0.16 + rng() * 0.12,
      colorIdx: pickIndex(rng, Math.max(1, colorPaletteLength)),
    });
  }

  // 6. Base Boulders
  const rockPositions = [
    { x: -0.9, y: FLAT_TILE_TOP + 0.18, z: 1.1, sx: 0.65, sy: 0.42, sz: 0.55 },
    { x: 1.1, y: FLAT_TILE_TOP + 0.16, z: 0.9, sx: 0.55, sy: 0.35, sz: 0.48 },
    { x: 0.2, y: FLAT_TILE_TOP + 0.12, z: 1.5, sx: 0.45, sy: 0.28, sz: 0.4 },
    { x: -1.3, y: FLAT_TILE_TOP + 0.14, z: -0.6, sx: 0.48, sy: 0.3, sz: 0.42 },
  ];
  rockPositions.forEach((rk) => {
    data.rocks.push({
      x: rk.x,
      y: rk.y,
      z: rk.z,
      sx: rk.sx,
      sy: rk.sy,
      sz: rk.sz,
      rx: (rng() - 0.5) * 0.3,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.3,
      c: pickIndex(rng, ROCK_PALETTE.length),
      u: rng(),
    });
  });

  // 7. Ground Fallen Petals (Covering the root flare bedding)
  const petalCount = Math.floor(130 * petalMultiplier);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.3 + Math.sqrt(rng()) * (half - 0.6);
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

  // 8. Grass & Floral Reeds
  const perimeterCount = 42;
  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const rad = half - 1.4 + (rng() - 0.5) * 1.2;
    const h = 0.42 + rng() * 0.58;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;

    data.grassEdges.push({
      x,
      y: FLAT_TILE_TOP + h / 2,
      z,
      sx: 0.12,
      sy: h,
      sz: 0.12,
      rx: (rng() - 0.5) * 0.25,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.25,
      c: pickIndex(rng, MEADOW_GRASS.length),
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
        roughness={0.48}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function DriftingPetalsMesh({
  items,
  colors,
  geometry,
}: {
  items: DriftPetal[];
  colors: THREE.Color[];
  geometry: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m || items.length === 0) return;
    const dt = Math.min(rawDt, 0.05);
    timeRef.current += dt;
    const p = morph?.p ?? 0;
    const hideFactor = clamp01(1 - p * 3);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const t = timeRef.current * item.speed + item.phase;
      
      // Cascading downward fall loop
      const y = ((item.baseY - (timeRef.current * item.speed * 0.8)) % 8.0);
      const actualY = y < 0.2 ? y + 8.0 : y;
      
      const swayX = Math.sin(t * item.swaySpeed) * 0.45;
      const swayZ = Math.cos(t * item.swaySpeed * 0.8) * 0.45;

      tmp.position.set(item.baseX + swayX, actualY, item.baseZ + swayZ);
      tmp.rotation.set(t * 0.6, t * 0.8, Math.sin(t) * 0.5);
      tmp.scale.setScalar(item.size * hideFactor);
      tmp.updateMatrix();

      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, colors[item.colorIdx % colors.length] || colors[0]);
    }

    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={0.45} side={THREE.DoubleSide} />
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
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(0.6, 0), []);
  const blossomClusterGeo = useMemo(() => new THREE.DodecahedronGeometry(0.46, 0), []);
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.52, 0.52, 0.08, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.1, 1, 4), []);

  const activeFoliageHexArray = useMemo(() => {
    return palette?.foliage && palette.foliage.length > 0
      ? palette.foliage
      : GUSHY_SAKURA_PALETTE;
  }, [palette]);

  const data = useMemo(
    () => generateGushyBonsaiSakura(seed, grid, zone, activeFoliageHexArray.length),
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
        {/* Corkscrew Twisted Bonsai Trunk & Arching Boughs */}
        <OrientedWoodMesh
          items={data.woodSegments}
          colors={TWISTED_WOOD_PALETTE}
          geometry={branchSegmentGeo}
          roughness={0.92}
        />
        {/* Garden Boulders at Base */}
        <InstancedBatch
          items={data.rocks}
          colors={ROCK_PALETTE}
          geometry={rockGeo}
          roughness={0.95}
        />
        {/* Ground Drift Petals */}
        <InstancedBatch
          items={data.fallenPetals}
          colors={activeFoliageHexArray}
          geometry={petalDiscGeo}
          roughness={0.55}
        />
        {/* Ambient Drifting Swirling Petals */}
        <DriftingPetalsMesh
          items={data.driftingPetals}
          colors={canopyColors}
          geometry={petalDiscGeo}
        />
        {/* Wild Meadow Grass */}
        <InstancedBatch
          items={data.grassEdges}
          colors={MEADOW_GRASS}
          geometry={bladeGeo}
          roughness={0.85}
        />
        {/* Accent Flora Reeds */}
        <InstancedBatch
          items={data.pinkReeds}
          colors={ACCENT_REEDS}
          geometry={bladeGeo}
          roughness={0.7}
        />
      </group>

      {/* Overflowing Tiered Blossom Cloud Pads */}
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