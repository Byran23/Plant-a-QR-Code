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

interface CanopyLeafNode {
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
  trunkMeshItems: InstanceItem[];
  branchMeshItems: InstanceItem[];
  canopyNodes: CanopyLeafNode[];
  groundPetals: InstanceItem[];
  grassClusters: InstanceItem[];
}

const FLAT_TILE_TOP = 0.14;

// Professional botanic Cherry Blossom color palette
const SAKURA_PALETTE = [
  "#ffb0c7", // Sakura mid-petal
  "#ffa1bc", // Vibrant petal center
  "#ffc8d7", // Soft bright petal tip
  "#f389a4", // Shadow underside petal
  "#ffe8ef", // Translucent white-pink petal edge
  "#ff95b3", // Saturated blossom core
];

const BARK_SHADES = ["#432d24", "#352119", "#52372c", "#2c1a13"];
const BRANCH_SHADES = ["#39251c", "#2f1d16", "#482f24"];
const GRASS_SHADES = ["#689f38", "#7cb342", "#558b2f", "#8bc34a"];

/**
 * Procedural low-poly Sakura generation utilizing botanical L-System branch recursion.
 */
function generateBotanicalSakura(
  seed: number,
  grid: QRGrid,
  zone: ForestZone
): TreeSceneData {
  const rng = mulberry32(seed);
  const data: TreeSceneData = {
    trunkMeshItems: [],
    branchMeshItems: [],
    canopyNodes: [],
    groundPetals: [],
    grassClusters: [],
  };

  const half = (grid.total - 1) / 2;
  const sizeRatio = Math.max(1, grid.size / 21);

  // Proportional tree architecture
  const H = (7.8 + zone.n * 0.42) * Math.min(1.35, sizeRatio);
  const trunkBaseRadius = (1.1 + zone.n * 0.06) * Math.min(1.3, sizeRatio);
  const trunkTopRadius = trunkBaseRadius * 0.48;

  // 1. Natural Trunk with Natural Curvature (Continuous Spline)
  const trunkSteps = 16;
  const trunkStepH = (H * 0.46) / trunkSteps;
  let trunkX = 0;
  let trunkZ = 0;
  const trunkSpline: THREE.Vector3[] = [];

  for (let i = 0; i <= trunkSteps; i++) {
    const t = i / trunkSteps;
    const r = THREE.MathUtils.lerp(trunkBaseRadius, trunkTopRadius, Math.pow(t, 0.75));
    trunkX += Math.sin(i * 0.55 + seed) * 0.05 + (rng() - 0.5) * 0.04;
    trunkZ += Math.cos(i * 0.48 + seed) * 0.05 + (rng() - 0.5) * 0.04;
    const y = i * trunkStepH;

    trunkSpline.push(new THREE.Vector3(trunkX, y, trunkZ));

    if (i < trunkSteps) {
      data.trunkMeshItems.push({
        x: trunkX,
        y: y + trunkStepH * 0.5,
        z: trunkZ,
        sx: r * 2,
        sy: trunkStepH * 1.05,
        sz: r * 2,
        rx: (rng() - 0.5) * 0.06,
        ry: rng() * Math.PI,
        rz: (rng() - 0.5) * 0.06,
        c: i % 2 === 0 ? 0 : 1,
        u: rng(),
      });
    }
  }

  // 2. Recursive L-System Branch Hierarchy with Terminal Blossom Buds
  const branchOrigins: THREE.Vector3[] = [];
  const numMainBoughs = Math.floor(7 + zone.n * 0.6);
  const boughStartY = H * 0.38;

  function growBranch(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    thickness: number,
    depth: number
  ) {
    const segments = Math.max(3, Math.ceil(length * 3.5));
    const stepLen = length / segments;
    let curr = start.clone();
    const dir = direction.clone().normalize();

    for (let s = 0; s < segments; s++) {
      const prog = s / segments;
      const tThick = THREE.MathUtils.lerp(thickness, thickness * 0.45, prog);
      const next = curr.clone().addScaledVector(dir, stepLen);

      // Natural gravitational sag and random divergence
      dir.y -= 0.02 * (1 - prog);
      dir.x += (rng() - 0.5) * 0.08;
      dir.z += (rng() - 0.5) * 0.08;
      dir.normalize();

      const mid = curr.clone().lerp(next, 0.5);

      // Compute Euler rotation aligned to branch segment direction
      const dummy = new THREE.Object3D();
      dummy.position.copy(mid);
      dummy.lookAt(next);

      data.branchMeshItems.push({
        x: mid.x,
        y: mid.y,
        z: mid.z,
        sx: tThick,
        sy: tThick * 1.15,
        sz: stepLen * 1.05,
        rx: dummy.rotation.x,
        ry: dummy.rotation.y,
        rz: dummy.rotation.z,
        c: pickIndex(rng, BRANCH_SHADES.length),
        u: rng(),
      });

      curr = next;
    }

    branchOrigins.push(curr.clone());

    // Sub-branching split
    if (depth > 0) {
      const splits = 2 + (rng() > 0.65 ? 1 : 0);
      for (let k = 0; k < splits; k++) {
        const spreadAngle = ((k / splits) * Math.PI - Math.PI / 2) * 0.85 + (rng() - 0.5) * 0.5;
        const subDir = dir
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
        subDir.y += 0.25 + rng() * 0.35;
        subDir.normalize();

        growBranch(
          curr,
          subDir,
          length * (0.62 + rng() * 0.2),
          thickness * 0.6,
          depth - 1
        );
      }
    }
  }

  // Generate primary boughs
  for (let i = 0; i < numMainBoughs; i++) {
    const angle = (i / numMainBoughs) * Math.PI * 2 + (rng() - 0.5) * 0.45;
    const startIdx = Math.min(
      trunkSpline.length - 1,
      Math.floor(trunkSteps * 0.65 + (i / numMainBoughs) * (trunkSteps * 0.35))
    );
    const origin = trunkSpline[startIdx] || new THREE.Vector3(0, boughStartY, 0);

    const boughDir = new THREE.Vector3(
      Math.cos(angle),
      0.35 + rng() * 0.4,
      Math.sin(angle)
    ).normalize();

    growBranch(
      origin.clone(),
      boughDir,
      2.6 + rng() * (zone.n * 0.42),
      0.45 + zone.n * 0.02,
      2
    );
  }

  // 3. Volumetric Leaf Clusters (Gaussian Crown distribution + Canopy Droop)
  const crownCenterY = H + 0.5;
  const crownRadius = Math.max(1.5, zone.n * 0.68);

  const pushCanopyNode = (mx: number, mz: number, pale: boolean, isDroop = false) => {
    const dist = Math.min(1, Math.hypot(mx, mz) / crownRadius);
    const domeCurve = Math.pow(Math.max(0, 1 - dist), 0.6) * (3.8 + zone.n * 0.2);

    const oy = isDroop
      ? boughStartY + 0.3 + rng() * 1.5
      : crownCenterY + domeCurve + (rng() - 0.5) * 1.2;

    data.canopyNodes.push({
      ox: mx * (isDroop ? 1.08 : 0.95) + (rng() - 0.5) * 0.85,
      oy,
      oz: mz * (isDroop ? 1.08 : 0.95) + (rng() - 0.5) * 0.85,
      os: isDroop ? 0.75 + rng() * 0.4 : 1.1 + rng() * 0.75,
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

  // Map QR matrix data nodes directly into crown foliage
  let qrModuleCount = 0;
  for (let r = 0; r < zone.n; r++) {
    for (let c = 0; c < zone.n; c++) {
      const gr = zone.z0 + r;
      const gc = zone.x0 + c;
      if (grid?.data && grid.data[gr * grid.total + gc] === 1) {
        pushCanopyNode(gc - half, gr - half, false);
        qrModuleCount++;
      }
    }
  }

  // Foliage clusters seeded at actual branch endpoints
  for (const endPoint of branchOrigins) {
    const clusterPuffs = 4 + Math.floor(rng() * 4);
    for (let p = 0; p < clusterPuffs; p++) {
      const rx = (rng() - 0.5) * 1.4;
      const ry = (rng() - 0.5) * 1.2;
      const rz = (rng() - 0.5) * 1.4;
      data.canopyNodes.push({
        ox: endPoint.x + rx,
        oy: endPoint.y + ry,
        oz: endPoint.z + rz,
        os: 0.85 + rng() * 0.55,
        fx: endPoint.x + rx,
        fz: endPoint.z + rz,
        ci: pickIndex(rng, SAKURA_PALETTE.length),
        pale: true,
        rotX: rng() * Math.PI,
        rotY: rng() * Math.PI,
        rotZ: rng() * Math.PI,
        u: rng(),
      });
    }
  }

  // Volumetric fill for smooth organic silhouette
  const extraFoliage = Math.ceil(qrModuleCount * 2.8);
  for (let i = 0; i < extraFoliage; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * crownRadius * 0.95;
    pushCanopyNode(Math.cos(angle) * rad, Math.sin(angle) * rad, true);
  }

  // Drooping weeping tendrils
  const droopCount = Math.floor(22 + zone.n * 1.2);
  for (let i = 0; i < droopCount; i++) {
    const angle = (i / droopCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = crownRadius * (0.68 + rng() * 0.3);
    pushCanopyNode(Math.cos(angle) * rad, Math.sin(angle) * rad, true, true);
  }

  // 4. Ground Petal Accumulation (Physically accurate drift density under tree footprint)
  const petalCount = Math.floor(75 + zone.n * 3.8);
  for (let i = 0; i < petalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const rad = 0.5 + Math.pow(rng(), 0.6) * (half - 1.2);
    data.groundPetals.push({
      x: Math.cos(angle) * rad + (rng() - 0.5) * 0.35,
      y: FLAT_TILE_TOP + 0.012,
      z: Math.sin(angle) * rad + (rng() - 0.5) * 0.35,
      sx: 0.24 + rng() * 0.18,
      sy: 0.015,
      sz: 0.24 + rng() * 0.18,
      ry: rng() * Math.PI * 2,
      c: pickIndex(rng, SAKURA_PALETTE.length),
      u: rng(),
    });
  }

  // 5. Perimeter Meadow Flora
  const perimeterCount = Math.floor(40 + zone.n * 2.2);
  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const rad = half - 1.5 + (rng() - 0.5) * 1.3;
    const h = 0.38 + rng() * 0.5;
    data.grassClusters.push({
      x: Math.cos(angle) * rad,
      y: FLAT_TILE_TOP + h / 2,
      z: Math.sin(angle) * rad,
      sx: 0.1,
      sy: h,
      sz: 0.1,
      rx: (rng() - 0.5) * 0.22,
      ry: rng() * Math.PI,
      rz: (rng() - 0.5) * 0.22,
      c: pickIndex(rng, GRASS_SHADES.length),
      u: rng(),
    });
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
  roughness = 0.75,
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
      tmp.scale.set(
        Math.max(0.001, v.sx),
        Math.max(0.001, v.sy),
        Math.max(0.001, v.sz)
      );
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

/**
 * Photorealistic multi-layered Sakura Leaf-Cloud.
 * Blends organic 3D leaf clusters down to the precise QR matrix plane on flatten.
 */
function BotanicalCanopyMesh({
  items,
  colors,
  geometry,
  seed,
  density,
  dark,
}: {
  items: CanopyLeafNode[];
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
      const sy = v.os * 0.55 + ((v.pale ? 0.0001 : 0.16) - v.os * 0.55) * q;

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
      <meshStandardMaterial roughness={0.6} />
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

  // Geometric Primitives tuned for natural foliage & organic bark
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), []);
  const branchGeo = useMemo(() => new THREE.CylinderGeometry(0.35, 0.45, 1, 6), []);
  // 6-sided disc creating natural overlapping petal sheets
  const petalDiscGeo = useMemo(() => new THREE.CylinderGeometry(0.48, 0.48, 0.12, 6), []);
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.09, 1, 4), []);

  const data = useMemo(
    () => generateBotanicalSakura(seed, grid, zone),
    [seed, grid, zone]
  );

  const canopyColors = useMemo(
    () => SAKURA_PALETTE.map((c) => new THREE.Color(c)),
    []
  );
  const qrDark = useMemo(
    () => new THREE.Color(palette?.qrDark || "#d64f64"),
    [palette]
  );

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
        {/* Curving Natural Trunk */}
        <InstancedBatch
          items={data.trunkMeshItems}
          colors={BARK_SHADES}
          geometry={trunkGeo}
          roughness={0.92}
        />
        {/* Branch Hierarchy */}
        <InstancedBatch
          items={data.branchMeshItems}
          colors={BRANCH_SHADES}
          geometry={branchGeo}
          roughness={0.88}
        />
        {/* Scattered Ground Petals */}
        <InstancedBatch
          items={data.groundPetals}
          colors={SAKURA_PALETTE}
          geometry={petalDiscGeo}
          roughness={0.58}
        />
        {/* Perimeter Meadow Grass */}
        <InstancedBatch
          items={data.grassClusters}
          colors={GRASS_SHADES}
          geometry={bladeGeo}
          roughness={0.85}
        />
      </group>

      {/* Volumetric Sakura Blossom Crown */}
      <BotanicalCanopyMesh
        items={data.canopyNodes}
        colors={canopyColors}
        geometry={petalDiscGeo}
        seed={seed}
        density={palette?.foliageDensity ?? 1.0}
        dark={qrDark}
      />
    </>
  );
}