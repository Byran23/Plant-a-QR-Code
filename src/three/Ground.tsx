import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { QRGrid } from "../lib/qr";
import type { Palette } from "../lib/palettes";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

interface Tile {
  x: number;
  z: number;
  h: number;
  delay: number;
  base: THREE.Color;
  flat: THREE.Color;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

// Stone patio tints for 3D ground mode
const STONE_PATIO_COLORS = [
  "#ede7de",
  "#e3ddd2",
  "#f4eee4",
  "#dad3c6",
  "#ede6db",
];

// Fallback outer grass module colors
const GARDEN_GREEN_MODULES = [
  "#529134",
  "#46822b",
  "#5a9d3a",
];

export default function Ground({
  grid,
  palette,
  seed,
}: {
  grid: QRGrid;
  palette: Palette;
  seed: number;
}) {
  const total = grid.total;
  const count = total * total;
  const half = (total - 1) / 2;

  // Normalized Season: 0 = Sakura/Spring, 1 = Summer, 2 = Autumn, 3 = Winter
  const seasonMap: Record<string, number> = {
    spring: 0,
    summer: 1,
    autumn: 2,
    winter: 3,
  };
  const seasonIdx = seasonMap[palette.baseId] ?? 0;
  const isWinter = seasonIdx === 3;

  // Geometries
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12), []);
  const roofGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 4), []);

  // Base Materials
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }),
    [],
  );

  // Doghouse Seasonal Palette
  const houseColors = useMemo(() => {
    switch (seasonIdx) {
      case 0: // Spring / Sakura: Warm cedar wood with pastel rose roof
        return { walls: "#d4a373", roof: "#f472b6", trim: "#fae1dd", bowl: "#fb7185", snowCap: false };
      case 1: // Summer: Vibrant cottage wood with terracotta roof
        return { walls: "#b45309", roof: "#ea580c", trim: "#fef3c7", bowl: "#0ea5e9", snowCap: false };
      case 2: // Autumn: Rich oak walls with pumpkin amber roof
        return { walls: "#78350f", roof: "#c2410c", trim: "#fed7aa", bowl: "#eab308", snowCap: false };
      case 3: // Winter: Frosted timber walls with snow-capped roof
      default:
        return { walls: "#475569", roof: "#1e293b", trim: "#94a3b8", bowl: "#38bdf8", snowCap: true };
    }
  }, [seasonIdx]);

  const houseWallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: houseColors.walls, roughness: 0.8 }),
    [houseColors.walls],
  );
  const houseRoofMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: houseColors.roof, roughness: 0.6 }),
    [houseColors.roof],
  );
  const houseDoorMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#0f172a" }),
    [],
  );
  const snowCapMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 }),
    [],
  );
  const dogGoldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d97706", roughness: 0.75 }),
    [],
  );
  const dogDarkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.75 }),
    [],
  );
  const dogSnoutMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fed7aa", roughness: 0.6 }),
    [],
  );
  const dogNoseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#18181b" }),
    [],
  );
  const bowlMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: houseColors.bowl, roughness: 0.4 }),
    [houseColors.bowl],
  );
  const boneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fef3c7", roughness: 0.6 }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      roofGeo.dispose();
      mat.dispose();
      houseWallMat.dispose();
      houseRoofMat.dispose();
      houseDoorMat.dispose();
      snowCapMat.dispose();
      dogGoldMat.dispose();
      dogDarkMat.dispose();
      dogSnoutMat.dispose();
      dogNoseMat.dispose();
      bowlMat.dispose();
      boneMat.dispose();
    };
  }, [
    geo,
    sphereGeo,
    cylinderGeo,
    roofGeo,
    mat,
    houseWallMat,
    houseRoofMat,
    houseDoorMat,
    snowCapMat,
    dogGoldMat,
    dogDarkMat,
    dogSnoutMat,
    dogNoseMat,
    bowlMat,
    boneMat,
  ]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  const sceneElementsRef = useRef<THREE.Group>(null);
  const dog1Ref = useRef<THREE.Group>(null);
  const dog2Ref = useRef<THREE.Group>(null);
  const dog1TailRef = useRef<THREE.Mesh>(null);
  const dog2TailRef = useRef<THREE.Mesh>(null);
  const st = useRef({ intro: 0, lastP: -1, dirty: true });

  const tiles = useMemo<Tile[]>(() => {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const arr: Tile[] = [];

    const stonePool = STONE_PATIO_COLORS.map((c) => new THREE.Color(c));
    const grassPool = (palette.grass?.length ? palette.grass : GARDEN_GREEN_MODULES).map(
      (c) => new THREE.Color(c),
    );

    const flatBlossomDark = new THREE.Color(palette.qrDark || "#d64f64");
    const flatGardenDark = new THREE.Color(palette.finderDark || "#529134");
    const flatLight = new THREE.Color(palette.qrLight || "#f4efe6");

    const centerRadius = Math.max(3, Math.floor(grid.size * 0.32));

    for (let r = 0; r < total; r++) {
      for (let c = 0; c < total; c++) {
        const x = c - half;
        const z = r - half;
        const distFromCenter = Math.hypot(x, z);
        const isDark = grid.data[r * total + c] === 1;

        let base: THREE.Color;
        if (distFromCenter < half - 1.8) {
          base = stonePool[pickIndex(rng, stonePool.length)].clone();
        } else {
          base = grassPool[pickIndex(rng, grassPool.length)].clone();
          base.offsetHSL(0, 0, (rng() - 0.5) * 0.03);
        }

        let flatColor: THREE.Color;
        if (isDark) {
          flatColor = distFromCenter <= centerRadius ? flatBlossomDark : flatGardenDark;
        } else {
          flatColor = flatLight;
        }

        arr.push({
          x,
          z,
          h: 0.28 + (distFromCenter > half - 2 ? rng() * 0.12 : 0),
          delay: (distFromCenter / Math.max(1, half * 1.42)) * 0.55,
          base,
          flat: flatColor,
        });
      }
    }
    return arr;
  }, [grid, palette, seed, total, half]);

  useEffect(() => {
    st.current.dirty = true;
  }, [tiles]);

  useFrame((state, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    s.intro = Math.min(1, s.intro + dt * 0.85);
    const p = morph?.p ?? 0;
    const q = smooth01(p);
    const vis = Math.max(0, 1 - q);
    const grow = easeOutBack(clamp01(s.intro / 0.7));
    const elemScale = vis * grow;

    // Fade out diorama objects cleanly when morphing into flat QR code
    if (sceneElementsRef.current) {
      sceneElementsRef.current.scale.setScalar(Math.max(0.0001, elemScale));
      sceneElementsRef.current.visible = elemScale > 0.02;
    }

    // --- Dynamic Dogs Behavior ---
    if (isWinter) {
      // Winter Mode: Cozy resting inside / peeking at the doghouse door
      if (dog1Ref.current) {
        dog1Ref.current.position.set(1.95, 0.18, 1.95);
        dog1Ref.current.rotation.set(0, Math.PI * 0.75, 0);
        dog1Ref.current.scale.setScalar(0.7);
      }
      if (dog2Ref.current) {
        dog2Ref.current.position.set(2.15, 0.16, 2.15);
        dog2Ref.current.rotation.set(0, Math.PI * 0.65, -0.08);
        dog2Ref.current.scale.setScalar(0.65);
      }
    } else {
      // Spring / Summer / Autumn: Dogs playing, chasing, and jumping near tree base
      const playSpeed = 1.4;
      const angle1 = t * playSpeed;
      const r1 = 1.8 + Math.sin(t * 2.2) * 0.45;
      const hop1 = Math.abs(Math.sin(t * 5.6)) * 0.16;

      if (dog1Ref.current) {
        dog1Ref.current.position.set(
          Math.cos(angle1) * r1 - 0.2,
          0.18 + hop1,
          Math.sin(angle1) * r1 + 0.3,
        );
        dog1Ref.current.rotation.set(
          -hop1 * 0.8,
          -angle1 - Math.PI / 2,
          Math.sin(t * 6) * 0.1,
          "YXZ",
        );
        dog1Ref.current.scale.setScalar(0.85);
      }

      const angle2 = angle1 - 0.85;
      const r2 = 2.1 + Math.cos(t * 2.2) * 0.35;
      const hop2 = Math.abs(Math.sin(t * 5.6 - 0.8)) * 0.14;

      if (dog2Ref.current) {
        dog2Ref.current.position.set(
          Math.cos(angle2) * r2 - 0.2,
          0.16 + hop2,
          Math.sin(angle2) * r2 + 0.3,
        );
        dog2Ref.current.rotation.set(
          -hop2 * 0.8,
          -angle2 - Math.PI / 2,
          -Math.sin(t * 6) * 0.1,
          "YXZ",
        );
        dog2Ref.current.scale.setScalar(0.78);
      }
    }

    // Fast Tail Wags
    if (dog1TailRef.current) dog1TailRef.current.rotation.y = Math.sin(t * 18) * 0.65;
    if (dog2TailRef.current) dog2TailRef.current.rotation.y = Math.cos(t * 18) * 0.65;

    // Instanced Floor Tiles Transform
    if (!s.dirty && Math.abs(p - s.lastP) < 0.0004 && s.intro >= 1) return;
    s.dirty = false;
    s.lastP = p;
    const m = mesh.current;
    if (!m) return;

    for (let i = 0; i < tiles.length; i++) {
      const tTile = tiles[i];
      const g = easeOutBack((s.intro * 1.55 - tTile.delay) / 0.55);
      const organic = tTile.h * g;
      const sy = Math.max(0.02, organic * (1 - q) + 0.14 * q);
      const sxz = clamp01(g * 1.4) * (0.96 * (1 - q) + 1.002 * q);

      tmp.position.set(tTile.x, sy / 2, tTile.z);
      tmp.scale.set(sxz, sy, sxz);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);

      col.copy(tTile.base).lerp(tTile.flat, q);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Floor Tiles */}
      <instancedMesh
        key={count}
        ref={mesh}
        args={[geo, mat, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />

      {/* Diorama Base Soil Slab */}
      <mesh
        geometry={geo}
        position={[0, -0.42, 0]}
        scale={[total + 2.2, 0.82, total + 2.2]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.soil || "#cfc8bc"} roughness={0.95} />
      </mesh>

      {/* --- Doghouse & Dogs Under Tree Canopy --- */}
      <group ref={sceneElementsRef}>
        {/* Seasonal Doghouse near tree trunk */}
        <group position={[2.2, 0.1, 2.2]} rotation={[0, -Math.PI * 0.75, 0]}>
          {/* Main Cabin Walls */}
          <mesh
            geometry={geo}
            material={houseWallMat}
            position={[0, 0.45, 0]}
            scale={[1.1, 0.8, 1.15]}
            castShadow
            receiveShadow
          />
          {/* Archway Entrance */}
          <mesh
            geometry={geo}
            material={houseDoorMat}
            position={[0, 0.38, 0.58]}
            scale={[0.46, 0.62, 0.04]}
          />
          {/* Pitched Roof */}
          <mesh
            geometry={roofGeo}
            material={houseRoofMat}
            position={[0, 1.06, 0]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[1.05, 0.65, 1.05]}
            castShadow
          />
          {/* Winter Snow Layer on Roof */}
          {houseColors.snowCap && (
            <mesh
              geometry={roofGeo}
              material={snowCapMat}
              position={[0, 1.12, 0]}
              rotation={[0, Math.PI / 4, 0]}
              scale={[1.08, 0.58, 1.08]}
            />
          )}
          {/* Food Bowl & Chew Bone */}
          <mesh
            geometry={cylinderGeo}
            material={bowlMat}
            position={[0.75, 0.08, 0.4]}
            scale={[0.22, 0.12, 0.22]}
          />
          <mesh
            geometry={cylinderGeo}
            material={boneMat}
            position={[0.72, 0.06, -0.2]}
            rotation={[0, 0.6, Math.PI / 2]}
            scale={[0.04, 0.28, 0.04]}
          />
        </group>

        {/* --- Dog 1: Golden Retriever Puppy --- */}
        <group ref={dog1Ref}>
          {/* Body */}
          <mesh geometry={sphereGeo} material={dogGoldMat} scale={[0.24, 0.22, 0.38]} castShadow />
          {/* Head & Snout */}
          <mesh geometry={sphereGeo} material={dogGoldMat} position={[0, 0.18, 0.22]} scale={[0.18, 0.18, 0.18]} />
          <mesh geometry={sphereGeo} material={dogSnoutMat} position={[0, 0.14, 0.33]} scale={[0.11, 0.09, 0.12]} />
          <mesh geometry={sphereGeo} material={dogNoseMat} position={[0, 0.17, 0.39]} scale={[0.04, 0.035, 0.04]} />
          {/* Floppy Ears */}
          <mesh geometry={geo} material={dogDarkMat} position={[-0.14, 0.16, 0.18]} rotation={[0.2, 0, 0.4]} scale={[0.05, 0.14, 0.08]} />
          <mesh geometry={geo} material={dogDarkMat} position={[0.14, 0.16, 0.18]} rotation={[0.2, 0, -0.4]} scale={[0.05, 0.14, 0.08]} />
          {/* Little Legs */}
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[-0.11, -0.15, 0.12]} scale={[0.05, 0.22, 0.05]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[0.11, -0.15, 0.12]} scale={[0.05, 0.22, 0.05]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[-0.11, -0.15, -0.12]} scale={[0.05, 0.22, 0.05]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[0.11, -0.15, -0.12]} scale={[0.05, 0.22, 0.05]} />
          {/* Wagging Tail */}
          <mesh ref={dog1TailRef} geometry={cylinderGeo} material={dogGoldMat} position={[0, 0.08, -0.22]} rotation={[-0.65, 0, 0]} scale={[0.035, 0.22, 0.035]} />
        </group>

        {/* --- Dog 2: Dark Brown Playful Pup --- */}
        <group ref={dog2Ref}>
          {/* Body */}
          <mesh geometry={sphereGeo} material={dogDarkMat} scale={[0.22, 0.2, 0.35]} castShadow />
          {/* Head & Snout */}
          <mesh geometry={sphereGeo} material={dogDarkMat} position={[0, 0.16, 0.2]} scale={[0.16, 0.16, 0.16]} />
          <mesh geometry={sphereGeo} material={dogSnoutMat} position={[0, 0.12, 0.3]} scale={[0.1, 0.08, 0.11]} />
          <mesh geometry={sphereGeo} material={dogNoseMat} position={[0, 0.15, 0.36]} scale={[0.035, 0.03, 0.035]} />
          {/* Pointy Ears */}
          <mesh geometry={roofGeo} material={dogDarkMat} position={[-0.11, 0.24, 0.18]} rotation={[0, 0, 0.3]} scale={[0.07, 0.11, 0.07]} />
          <mesh geometry={roofGeo} material={dogDarkMat} position={[0.11, 0.24, 0.18]} rotation={[0, 0, -0.3]} scale={[0.07, 0.11, 0.07]} />
          {/* Little Legs */}
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[-0.1, -0.14, 0.11]} scale={[0.045, 0.2, 0.045]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[0.1, -0.14, 0.11]} scale={[0.045, 0.2, 0.045]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[-0.1, -0.14, -0.11]} scale={[0.045, 0.2, 0.045]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[0.1, -0.14, -0.11]} scale={[0.045, 0.2, 0.045]} />
          {/* Wagging Tail */}
          <mesh ref={dog2TailRef} geometry={cylinderGeo} material={dogDarkMat} position={[0, 0.07, -0.2]} rotation={[-0.65, 0, 0]} scale={[0.03, 0.2, 0.03]} />
        </group>
      </group>
    </group>
  );
}