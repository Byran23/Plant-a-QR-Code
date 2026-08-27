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

  // Normalized season index: 0 = Sakura/Spring, 1 = Summer, 2 = Autumn, 3 = Winter
  const seasonMap: Record<string, number> = {
    spring: 0,
    summer: 1,
    autumn: 2,
    winter: 3,
  };
  const seasonIndex = seasonMap[palette.baseId] ?? 0;
  const isWinter = seasonIndex === 3;

  // Shared Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const roofGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 4), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12), []);

  // Ground Material
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }),
    [],
  );

  // Seasonal Doghouse Materials
  const houseWallMat = useMemo(() => {
    switch (seasonIndex) {
      case 0: // Sakura: Soft painted rose-cream cedar
        return new THREE.MeshStandardMaterial({ color: "#f7e1d7", roughness: 0.7 });
      case 1: // Summer: Bright sunny wood
        return new THREE.MeshStandardMaterial({ color: "#e9c46a", roughness: 0.6 });
      case 2: // Autumn: Rich warm timber
        return new THREE.MeshStandardMaterial({ color: "#8d5b4c", roughness: 0.8 });
      case 3: // Winter: Sturdy log cabin style
      default:
        return new THREE.MeshStandardMaterial({ color: "#5a3e36", roughness: 0.85 });
    }
  }, [seasonIndex]);

  const houseRoofMat = useMemo(() => {
    switch (seasonIndex) {
      case 0: // Sakura: Pastel pink tiled roof
        return new THREE.MeshStandardMaterial({ color: "#e56b81", roughness: 0.5 });
      case 1: // Summer: Vibrant terracotta teal roof
        return new THREE.MeshStandardMaterial({ color: "#2a9d8f", roughness: 0.5 });
      case 2: // Autumn: Warm burnt amber roof
        return new THREE.MeshStandardMaterial({ color: "#c85a17", roughness: 0.6 });
      case 3: // Winter: Frosted slate roof
      default:
        return new THREE.MeshStandardMaterial({ color: "#3a4a58", roughness: 0.7 });
    }
  }, [seasonIndex]);

  const houseInteriorMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#1c1917" }),
    [],
  );
  const snowCapMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 }),
    [],
  );

  // Dog Characters Materials (Golden Retriever & Playful Beagle)
  const dog1CoatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f4a261", roughness: 0.65 }),
    [],
  );
  const dog2CoatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e76f51", roughness: 0.65 }),
    [],
  );
  const dogWhiteMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fffbf0", roughness: 0.65 }),
    [],
  );
  const dogDarkMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#261c14" }),
    [],
  );
  const collarRedMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#e63946" }),
    [],
  );
  const collarBlueMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#1d3557" }),
    [],
  );
  const ballMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e63946", roughness: 0.4 }),
    [],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      roofGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      groundMat.dispose();
      houseWallMat.dispose();
      houseRoofMat.dispose();
      houseInteriorMat.dispose();
      snowCapMat.dispose();
      dog1CoatMat.dispose();
      dog2CoatMat.dispose();
      dogWhiteMat.dispose();
      dogDarkMat.dispose();
      collarRedMat.dispose();
      collarBlueMat.dispose();
      ballMat.dispose();
    };
  }, [
    boxGeo,
    roofGeo,
    sphereGeo,
    cylinderGeo,
    groundMat,
    houseWallMat,
    houseRoofMat,
    houseInteriorMat,
    snowCapMat,
    dog1CoatMat,
    dog2CoatMat,
    dogWhiteMat,
    dogDarkMat,
    collarRedMat,
    collarBlueMat,
    ballMat,
  ]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ intro: 0, lastP: -1, dirty: true });

  // References for dogs & accessories
  const doghouseGroupRef = useRef<THREE.Group>(null);
  const dog1Ref = useRef<THREE.Group>(null);
  const dog2Ref = useRef<THREE.Group>(null);
  const dog1TailRef = useRef<THREE.Mesh>(null);
  const dog2TailRef = useRef<THREE.Mesh>(null);
  const ballRef = useRef<THREE.Mesh>(null);

  // Position doghouse safely under canopy perimeter (not near center trunk x=0, z=0)
  const HOUSE_POS = useMemo(() => new THREE.Vector3(-4.2, 0.18, 3.8), []);

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

    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(s.intro / 0.7));
    const scale = vis * grow;

    // 1. Update Diorama Tiles
    if (s.dirty || Math.abs(p - s.lastP) >= 0.0004 || s.intro < 1) {
      s.dirty = false;
      s.lastP = p;
      const m = mesh.current;
      if (m) {
        const q = smooth01(p);
        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          const tileGrow = easeOutBack((s.intro * 1.55 - tile.delay) / 0.55);
          const organic = tile.h * tileGrow;
          const sy = Math.max(0.02, organic * (1 - q) + 0.14 * q);
          const sxz = clamp01(tileGrow * 1.4) * (0.96 * (1 - q) + 1.002 * q);

          tmp.position.set(tile.x, sy / 2, tile.z);
          tmp.scale.set(sxz, sy, sxz);
          tmp.rotation.set(0, 0, 0);
          tmp.updateMatrix();
          m.setMatrixAt(i, tmp.matrix);

          col.copy(tile.base).lerp(tile.flat, q);
          m.setColorAt(i, col);
        }
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }

    // 2. Doghouse Scaling & Visibility
    if (doghouseGroupRef.current) {
      doghouseGroupRef.current.scale.setScalar(Math.max(0.0001, scale));
      doghouseGroupRef.current.visible = scale > 0.02;
    }

    // 3. Dogs Behavioral Animation (Playing outside vs Shelter inside during Winter)
    const dog1 = dog1Ref.current;
    const dog2 = dog2Ref.current;
    const ball = ballRef.current;

    if (dog1 && dog2) {
      dog1.scale.setScalar(Math.max(0.0001, scale));
      dog2.scale.setScalar(Math.max(0.0001, scale));
      dog1.visible = scale > 0.02;
      dog2.visible = scale > 0.02;

      if (isWinter) {
        // Winter Mode: Both dogs cozy inside the doghouse doorway
        dog1.position.set(HOUSE_POS.x - 0.22, HOUSE_POS.y + 0.12, HOUSE_POS.z + 0.42);
        dog1.rotation.set(0, 0.25, 0);

        dog2.position.set(HOUSE_POS.x + 0.22, HOUSE_POS.y + 0.12, HOUSE_POS.z + 0.38);
        dog2.rotation.set(0, -0.22, 0);

        if (ball) ball.visible = false;
      } else {
        // Spring / Summer / Autumn: Dogs chasing each other playfully around the yard
        const chaseR = 2.4;
        const chaseSpeed = 1.6;
        const angle1 = t * chaseSpeed;
        const angle2 = t * chaseSpeed - 0.65; // Dog 2 following Dog 1

        const d1x = HOUSE_POS.x + 2.2 + Math.cos(angle1) * chaseR;
        const d1z = HOUSE_POS.z + Math.sin(angle1) * chaseR * 0.75;
        const d1y = HOUSE_POS.y + Math.abs(Math.sin(t * 7.5)) * 0.24;

        dog1.position.set(d1x, d1y, d1z);
        dog1.rotation.set(0, -angle1 - Math.PI / 2, Math.sin(t * 7.5) * 0.08);

        const d2x = HOUSE_POS.x + 2.2 + Math.cos(angle2) * chaseR;
        const d2z = HOUSE_POS.z + Math.sin(angle2) * chaseR * 0.75;
        const d2y = HOUSE_POS.y + Math.abs(Math.sin(t * 7.5 + 0.4)) * 0.24;

        dog2.position.set(d2x, d2y, d2z);
        dog2.rotation.set(0, -angle2 - Math.PI / 2, Math.sin(t * 7.5 + 0.4) * 0.08);

        // Bouncing Red Ball between them
        if (ball) {
          ball.visible = scale > 0.02;
          const ballAngle = angle1 + 0.4;
          ball.position.set(
            HOUSE_POS.x + 2.2 + Math.cos(ballAngle) * (chaseR + 0.3),
            HOUSE_POS.y + 0.08 + Math.abs(Math.sin(t * 9)) * 0.35,
            HOUSE_POS.z + Math.sin(ballAngle) * (chaseR * 0.75 + 0.2),
          );
        }
      }
    }

    // Tail Wagging
    if (dog1TailRef.current) {
      dog1TailRef.current.rotation.y = Math.sin(t * 18) * 0.45;
    }
    if (dog2TailRef.current) {
      dog2TailRef.current.rotation.y = Math.cos(t * 18) * 0.45;
    }
  });

  return (
    <group>
      {/* Diorama Ground Tiles */}
      <instancedMesh
        key={count}
        ref={mesh}
        args={[boxGeo, groundMat, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />

      {/* Base Border Plate */}
      <mesh
        geometry={boxGeo}
        position={[0, -0.42, 0]}
        scale={[total + 2.2, 0.82, total + 2.2]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.soil || "#cfc8bc"} roughness={0.95} />
      </mesh>

      {/* --- Seasonal Doghouse --- */}
      <group ref={doghouseGroupRef} position={[HOUSE_POS.x, HOUSE_POS.y, HOUSE_POS.z]}>
        {/* Foundation Deck */}
        <mesh
          geometry={boxGeo}
          material={houseWallMat}
          position={[0, 0.06, 0]}
          scale={[1.6, 0.12, 1.8]}
          castShadow
          receiveShadow
        />

        {/* Cabin Walls */}
        <mesh
          geometry={boxGeo}
          material={houseWallMat}
          position={[0, 0.65, 0]}
          scale={[1.35, 1.05, 1.45]}
          castShadow
        />

        {/* Doorway Hollow Entrance */}
        <mesh
          geometry={boxGeo}
          material={houseInteriorMat}
          position={[0, 0.48, 0.73]}
          scale={[0.62, 0.78, 0.08]}
        />

        {/* Pitched Roof */}
        <mesh
          geometry={roofGeo}
          material={houseRoofMat}
          position={[0, 1.42, 0]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[1.3, 0.75, 1.3]}
          castShadow
        />

        {/* Winter Snow Cap on Roof */}
        {isWinter && (
          <mesh
            geometry={roofGeo}
            material={snowCapMat}
            position={[0, 1.46, 0]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[1.35, 0.78, 1.35]}
          />
        )}

        {/* Dog Bowl */}
        <mesh
          geometry={cylinderGeo}
          material={houseRoofMat}
          position={[0.72, 0.08, 0.82]}
          scale={[0.18, 0.12, 0.18]}
        />
      </group>

      {/* --- Dog 1 (Golden Pup) --- */}
      <group ref={dog1Ref}>
        {/* Body */}
        <mesh geometry={sphereGeo} material={dog1CoatMat} position={[0, 0.26, 0]} scale={[0.22, 0.2, 0.38]} castShadow />
        {/* Chest Fluff */}
        <mesh geometry={sphereGeo} material={dogWhiteMat} position={[0, 0.22, 0.12]} scale={[0.16, 0.16, 0.2]} />
        {/* Head */}
        <mesh geometry={sphereGeo} material={dog1CoatMat} position={[0, 0.44, 0.28]} scale={[0.19, 0.19, 0.22]} />
        {/* Snout */}
        <mesh geometry={boxGeo} material={dogWhiteMat} position={[0, 0.4, 0.42]} scale={[0.12, 0.1, 0.14]} />
        {/* Nose */}
        <mesh geometry={sphereGeo} material={dogDarkMat} position={[0, 0.44, 0.5]} scale={[0.04, 0.035, 0.035]} />
        {/* Floppy Ears */}
        <mesh geometry={boxGeo} material={dog2CoatMat} position={[-0.16, 0.42, 0.25]} rotation={[0, 0, -0.35]} scale={[0.06, 0.18, 0.1]} />
        <mesh geometry={boxGeo} material={dog2CoatMat} position={[0.16, 0.42, 0.25]} rotation={[0, 0, 0.35]} scale={[0.06, 0.18, 0.1]} />
        {/* Collar */}
        <mesh geometry={cylinderGeo} material={collarRedMat} position={[0, 0.36, 0.22]} scale={[0.15, 0.04, 0.15]} />
        {/* Legs */}
        <mesh geometry={cylinderGeo} material={dog1CoatMat} position={[-0.12, 0.1, 0.16]} scale={[0.045, 0.2, 0.045]} />
        <mesh geometry={cylinderGeo} material={dog1CoatMat} position={[0.12, 0.1, 0.16]} scale={[0.045, 0.2, 0.045]} />
        <mesh geometry={cylinderGeo} material={dog1CoatMat} position={[-0.12, 0.1, -0.16]} scale={[0.045, 0.2, 0.045]} />
        <mesh geometry={cylinderGeo} material={dog1CoatMat} position={[0.12, 0.1, -0.16]} scale={[0.045, 0.2, 0.045]} />
        {/* Wagging Tail */}
        <group position={[0, 0.32, -0.2]}>
          <mesh ref={dog1TailRef} geometry={boxGeo} material={dog1CoatMat} position={[0, 0.1, -0.1]} rotation={[0.5, 0, 0]} scale={[0.045, 0.2, 0.045]} />
        </group>
      </group>

      {/* --- Dog 2 (Playful Tri-color Pup) --- */}
      <group ref={dog2Ref}>
        {/* Body */}
        <mesh geometry={sphereGeo} material={dog2CoatMat} position={[0, 0.22, 0]} scale={[0.19, 0.18, 0.32]} castShadow />
        {/* Belly White */}
        <mesh geometry={sphereGeo} material={dogWhiteMat} position={[0, 0.18, 0.08]} scale={[0.14, 0.14, 0.18]} />
        {/* Head */}
        <mesh geometry={sphereGeo} material={dog2CoatMat} position={[0, 0.38, 0.24]} scale={[0.16, 0.16, 0.19]} />
        {/* Snout */}
        <mesh geometry={boxGeo} material={dogWhiteMat} position={[0, 0.34, 0.36]} scale={[0.1, 0.09, 0.12]} />
        {/* Nose */}
        <mesh geometry={sphereGeo} material={dogDarkMat} position={[0, 0.38, 0.43]} scale={[0.035, 0.03, 0.03]} />
        {/* Ears */}
        <mesh geometry={boxGeo} material={dogDarkMat} position={[-0.14, 0.36, 0.22]} rotation={[0, 0, -0.3]} scale={[0.05, 0.15, 0.09]} />
        <mesh geometry={boxGeo} material={dogDarkMat} position={[0.14, 0.36, 0.22]} rotation={[0, 0, 0.3]} scale={[0.05, 0.15, 0.09]} />
        {/* Collar */}
        <mesh geometry={cylinderGeo} material={collarBlueMat} position={[0, 0.3, 0.18]} scale={[0.13, 0.035, 0.13]} />
        {/* Legs */}
        <mesh geometry={cylinderGeo} material={dogWhiteMat} position={[-0.1, 0.08, 0.13]} scale={[0.04, 0.17, 0.04]} />
        <mesh geometry={cylinderGeo} material={dogWhiteMat} position={[0.1, 0.08, 0.13]} scale={[0.04, 0.17, 0.04]} />
        <mesh geometry={cylinderGeo} material={dogWhiteMat} position={[-0.1, 0.08, -0.13]} scale={[0.04, 0.17, 0.04]} />
        <mesh geometry={cylinderGeo} material={dogWhiteMat} position={[0.1, 0.08, -0.13]} scale={[0.04, 0.17, 0.04]} />
        {/* Wagging Tail */}
        <group position={[0, 0.28, -0.17]}>
          <mesh ref={dog2TailRef} geometry={boxGeo} material={dogWhiteMat} position={[0, 0.09, -0.09]} rotation={[0.45, 0, 0]} scale={[0.04, 0.18, 0.04]} />
        </group>
      </group>

      {/* Playing Ball */}
      <mesh ref={ballRef} geometry={sphereGeo} material={ballMat} scale={[0.09, 0.09, 0.09]} castShadow />
    </group>
  );
}