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

const STONE_PATIO_COLORS = [
  "#ede7de",
  "#e3ddd2",
  "#f4eee4",
  "#dad3c6",
  "#ede6db",
];

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

  const seasonMap: Record<string, number> = {
    spring: 0,
    summer: 1,
    autumn: 2,
    winter: 3,
  };
  const seasonIndex = seasonMap[palette.baseId] ?? 0;
  const isWinter = seasonIndex === 3;

  // Base Geometries
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const roofGeo = useMemo(() => new THREE.ConeGeometry(1.6, 1.1, 4), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);

  // Standard Ground Material
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }),
    [],
  );

  // Seasonal Doghouse Palette
  const houseRoofColor = useMemo(() => {
    switch (seasonIndex) {
      case 0: // Spring / Sakura
        return "#fb7185";
      case 1: // Summer
        return "#0284c7";
      case 2: // Autumn
        return "#d97706";
      case 3: // Winter
      default:
        return "#f1f5f9";
    }
  }, [seasonIndex]);

  const houseWallColor = useMemo(() => {
    return isWinter ? "#cbd5e1" : "#854d0e";
  }, [isWinter]);

  // House Materials
  const roofMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: houseRoofColor, roughness: 0.6 }),
    [houseRoofColor],
  );
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: houseWallColor, roughness: 0.8 }),
    [houseWallColor],
  );
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1c1917", roughness: 0.95 }),
    [],
  );
  const snowCapMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
    [],
  );

  // Dogs & Ball Materials
  const dogGoldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.7 }),
    [],
  );
  const dogDarkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.7 }),
    [],
  );
  const earMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.7 }),
    [],
  );
  const noseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#000000" }),
    [],
  );
  const redBallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.4 }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      roofGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      mat.dispose();
      roofMat.dispose();
      wallMat.dispose();
      doorMat.dispose();
      snowCapMat.dispose();
      dogGoldMat.dispose();
      dogDarkMat.dispose();
      earMat.dispose();
      noseMat.dispose();
      redBallMat.dispose();
    };
  }, [
    geo,
    roofGeo,
    sphereGeo,
    cylinderGeo,
    mat,
    roofMat,
    wallMat,
    doorMat,
    snowCapMat,
    dogGoldMat,
    dogDarkMat,
    earMat,
    noseMat,
    redBallMat,
  ]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  const dog1Ref = useRef<THREE.Group>(null);
  const dog2Ref = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const dog1TailRef = useRef<THREE.Mesh>(null);
  const dog2TailRef = useRef<THREE.Mesh>(null);
  const extraDecorGroupRef = useRef<THREE.Group>(null);

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

  // Corner location on the lawn for the doghouse
  const housePos = useMemo<[number, number, number]>(() => {
    const offset = half - 3.2;
    return [offset, 0.45, -offset];
  }, [half]);

  useFrame((state, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    s.intro = Math.min(1, s.intro + dt * 0.85);
    const p = morph?.p ?? 0;
    const q = smooth01(p);
    const vis = Math.max(0, 1 - q);
    const grow = easeOutBack(clamp01(s.intro / 0.7));
    const decorScale = vis * grow;

    // Fade out decor when transitioning into flat QR mode
    if (extraDecorGroupRef.current) {
      extraDecorGroupRef.current.scale.setScalar(Math.max(0.0001, decorScale));
      extraDecorGroupRef.current.visible = decorScale > 0.02;
    }

    // Ground instances update
    if (s.dirty || Math.abs(p - s.lastP) >= 0.0004 || s.intro < 1) {
      s.dirty = false;
      s.lastP = p;
      const m = mesh.current;
      if (m) {
        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          const g = easeOutBack((s.intro * 1.55 - tile.delay) / 0.55);
          const organic = tile.h * g;
          const sy = Math.max(0.02, organic * (1 - q) + 0.14 * q);
          const sxz = clamp01(g * 1.4) * (0.96 * (1 - q) + 1.002 * q);

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

    // Tail wagging animation
    if (dog1TailRef.current) {
      dog1TailRef.current.rotation.y = Math.sin(t * (isWinter ? 4 : 14)) * 0.45;
    }
    if (dog2TailRef.current) {
      dog2TailRef.current.rotation.y = Math.sin(t * (isWinter ? 3 : 16) + 1) * 0.45;
    }

    const d1 = dog1Ref.current;
    const d2 = dog2Ref.current;
    const ball = ballRef.current;

    if (isWinter) {
      // Winter: Cozy inside the doghouse
      if (d1) {
        d1.position.set(housePos[0] - 0.22, 0.46, housePos[2] + 0.25);
        d1.rotation.set(0, 0.25, 0);
      }
      if (d2) {
        d2.position.set(housePos[0] + 0.22, 0.46, housePos[2] + 0.35);
        d2.rotation.set(0, -0.3, 0);
      }
      if (ball) ball.visible = false;
    } else {
      // Spring / Summer / Autumn: Playfully chasing each other and the ball in the yard
      if (ball) {
        ball.visible = true;
        const bAng = t * 1.35;
        const bRad = 4.2;
        const bx = housePos[0] - 3.2 + Math.cos(bAng) * bRad;
        const bz = housePos[2] + 3.2 + Math.sin(bAng) * bRad;
        ball.position.set(bx, 0.52 + Math.abs(Math.sin(t * 7)) * 0.35, bz);
      }

      if (d1) {
        const d1Ang = t * 1.35 - 0.35;
        const d1Rad = 4.0;
        const x1 = housePos[0] - 3.2 + Math.cos(d1Ang) * d1Rad;
        const z1 = housePos[2] + 3.2 + Math.sin(d1Ang) * d1Rad;
        d1.position.set(x1, 0.45 + Math.abs(Math.sin(t * 10)) * 0.18, z1);
        d1.rotation.set(0, -d1Ang - Math.PI / 2, Math.sin(t * 10) * 0.1, "YXZ");
      }

      if (d2) {
        const d2Ang = t * 1.35 - 0.85;
        const d2Rad = 4.4;
        const x2 = housePos[0] - 3.2 + Math.cos(d2Ang) * d2Rad;
        const z2 = housePos[2] + 3.2 + Math.sin(d2Ang) * d2Rad;
        d2.position.set(x2, 0.45 + Math.abs(Math.sin(t * 10 + 1)) * 0.18, z2);
        d2.rotation.set(0, -d2Ang - Math.PI / 2, Math.sin(t * 10 + 1) * 0.1, "YXZ");
      }
    }
  });

  return (
    <group>
      <instancedMesh
        key={count}
        ref={mesh}
        args={[geo, mat, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />

      {/* Diorama base border */}
      <mesh
        geometry={geo}
        position={[0, -0.42, 0]}
        scale={[total + 2.2, 0.82, total + 2.2]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.soil || "#cfc8bc"} roughness={0.95} />
      </mesh>

      {/* Seasonal Doghouse & Dogs */}
      <group ref={extraDecorGroupRef}>
        {/* Doghouse */}
        <group position={housePos}>
          {/* Main Cabin Body */}
          <mesh
            geometry={geo}
            material={wallMat}
            position={[0, 0.45, 0]}
            scale={[1.7, 0.9, 1.7]}
            castShadow
          />
          {/* Pitched Roof */}
          <mesh
            geometry={roofGeo}
            material={roofMat}
            position={[0, 1.25, 0]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[1.2, 1.0, 1.2]}
            castShadow
          />
          {/* Winter Snow Cap on Roof */}
          {isWinter && (
            <mesh
              geometry={roofGeo}
              material={snowCapMat}
              position={[0, 1.32, 0]}
              rotation={[0, Math.PI / 4, 0]}
              scale={[1.22, 0.95, 1.22]}
            />
          )}
          {/* Front Entrance Portal */}
          <mesh
            geometry={geo}
            material={doorMat}
            position={[0, 0.38, 0.86]}
            scale={[0.7, 0.72, 0.05]}
          />
          {/* Porch Plate */}
          <mesh
            geometry={geo}
            material={wallMat}
            position={[0, 0.05, 0.95]}
            scale={[1.5, 0.1, 0.5]}
          />
        </group>

        {/* Dog 1 (Golden Retriever) */}
        <group ref={dog1Ref}>
          {/* Body */}
          <mesh geometry={sphereGeo} material={dogGoldMat} position={[0, 0.16, 0]} scale={[0.24, 0.22, 0.38]} castShadow />
          {/* Head */}
          <mesh geometry={sphereGeo} material={dogGoldMat} position={[0, 0.34, 0.22]} scale={[0.18, 0.18, 0.2]} castShadow />
          {/* Snout */}
          <mesh geometry={geo} material={dogGoldMat} position={[0, 0.3, 0.34]} scale={[0.11, 0.09, 0.14]} />
          <mesh geometry={sphereGeo} material={noseMat} position={[0, 0.33, 0.41]} scale={[0.035, 0.035, 0.035]} />
          {/* Floppy Ears */}
          <mesh geometry={geo} material={earMat} position={[-0.14, 0.32, 0.2]} rotation={[0, 0, 0.3]} scale={[0.05, 0.15, 0.09]} />
          <mesh geometry={geo} material={earMat} position={[0.14, 0.32, 0.2]} rotation={[0, 0, -0.3]} scale={[0.05, 0.15, 0.09]} />
          {/* Legs */}
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[-0.12, 0.05, 0.14]} scale={[0.04, 0.18, 0.04]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[0.12, 0.05, 0.14]} scale={[0.04, 0.18, 0.04]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[-0.12, 0.05, -0.14]} scale={[0.04, 0.18, 0.04]} />
          <mesh geometry={cylinderGeo} material={dogGoldMat} position={[0.12, 0.05, -0.14]} scale={[0.04, 0.18, 0.04]} />
          {/* Wagging Tail */}
          <mesh ref={dog1TailRef} geometry={cylinderGeo} material={dogGoldMat} position={[0, 0.22, -0.24]} rotation={[-0.7, 0, 0]} scale={[0.035, 0.22, 0.035]} />
        </group>

        {/* Dog 2 (Playful Brown Pup) */}
        <group ref={dog2Ref}>
          {/* Body */}
          <mesh geometry={sphereGeo} material={dogDarkMat} position={[0, 0.15, 0]} scale={[0.22, 0.2, 0.35]} castShadow />
          {/* Head */}
          <mesh geometry={sphereGeo} material={dogDarkMat} position={[0, 0.32, 0.2]} scale={[0.16, 0.16, 0.18]} castShadow />
          {/* Snout */}
          <mesh geometry={geo} material={dogDarkMat} position={[0, 0.28, 0.31]} scale={[0.1, 0.08, 0.12]} />
          <mesh geometry={sphereGeo} material={noseMat} position={[0, 0.31, 0.37]} scale={[0.03, 0.03, 0.03]} />
          {/* Pointed Ears */}
          <mesh geometry={geo} material={earMat} position={[-0.11, 0.42, 0.18]} rotation={[0, 0, -0.2]} scale={[0.04, 0.12, 0.08]} />
          <mesh geometry={geo} material={earMat} position={[0.11, 0.42, 0.18]} rotation={[0, 0, 0.2]} scale={[0.04, 0.12, 0.08]} />
          {/* Legs */}
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[-0.1, 0.05, 0.12]} scale={[0.038, 0.18, 0.038]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[0.1, 0.05, 0.12]} scale={[0.038, 0.18, 0.038]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[-0.1, 0.05, -0.12]} scale={[0.038, 0.18, 0.038]} />
          <mesh geometry={cylinderGeo} material={dogDarkMat} position={[0.1, 0.05, -0.12]} scale={[0.038, 0.18, 0.038]} />
          {/* Wagging Tail */}
          <mesh ref={dog2TailRef} geometry={cylinderGeo} material={dogDarkMat} position={[0, 0.22, -0.22]} rotation={[-0.65, 0, 0]} scale={[0.03, 0.2, 0.03]} />
        </group>

        {/* Play Toy Ball */}
        <mesh ref={ballRef} geometry={sphereGeo} material={redBallMat} scale={[0.12, 0.12, 0.12]} castShadow />
      </group>
    </group>
  );
}