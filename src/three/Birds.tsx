import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "../lib/random";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

interface BirdCfg {
  phase: number;
  speed: number;
  r: number;
  h: number;
  dir: number;
  size: number;
  flapSpeed: number;
  pitchOffset: number;
}

export default function Birds({
  orbit,
  alt,
  season = 0,
  count = 6,
}: {
  orbit: number;
  alt: number;
  season?: number;
  count?: number;
}) {
  const birds = useMemo<BirdCfg[]>(() => {
    const rng = mulberry32(0xb14d5);
    return Array.from({ length: count }, (_, i) => ({
      phase: (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.4,
      speed: 0.16 + rng() * 0.12,
      r: orbit * (0.85 + (i % 3) * 0.18 + rng() * 0.1),
      h: alt + (i % 2 === 0 ? 1 : -1) * (1.2 + rng() * 1.8),
      dir: rng() < 0.8 ? 1 : -1,
      size: 0.85 + rng() * 0.35,
      flapSpeed: 7 + rng() * 3.5,
      pitchOffset: (rng() - 0.5) * 0.1,
    }));
  }, [orbit, alt, count]);

  // Normalized Season: 0 = Sakura/Spring, 1 = Summer, 2 = Autumn, 3 = Winter
  const normalizedSeason = ((season % 4) + 4) % 4;

  // Seasonal plumage palette (Sakura white-doves, Summer swallows, Autumn songbirds, Winter snow buntings)
  const birdColors = useMemo(() => {
    switch (normalizedSeason) {
      case 0: // Sakura: Clean white body with subtle rose tint
        return { body: "#fffbfc", wing: "#fbcfe8", beak: "#fb923c", tail: "#f472b6" };
      case 1: // Summer: Deep navy swallow with warm belly
        return { body: "#f8fafc", wing: "#1e3a8a", beak: "#f59e0b", tail: "#0f172a" };
      case 2: // Autumn: Warm cedar songbird
        return { body: "#fed7aa", wing: "#9a3412", beak: "#d97706", tail: "#7c2d12" };
      case 3: // Winter: Frost white & slate grey
      default:
        return { body: "#f1f5f9", wing: "#64748b", beak: "#f59e0b", tail: "#334155" };
    }
  }, [normalizedSeason]);

  // Reusable Geometries
  const bodyGeo = useMemo(() => new THREE.ConeGeometry(0.24, 0.65, 5), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.16, 12, 12), []);
  const beakGeo = useMemo(() => new THREE.ConeGeometry(0.06, 0.22, 4), []);
  const innerWingGeo = useMemo(() => new THREE.BoxGeometry(0.38, 0.035, 0.26), []);
  const outerWingGeo = useMemo(() => new THREE.BoxGeometry(0.34, 0.025, 0.22), []);
  const tailGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.025, 0.32), []);

  // Materials
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: birdColors.body, roughness: 0.65 }),
    [birdColors.body],
  );
  const wingMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: birdColors.wing, roughness: 0.6 }),
    [birdColors.wing],
  );
  const beakMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: birdColors.beak, roughness: 0.4 }),
    [birdColors.beak],
  );
  const tailMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: birdColors.tail, roughness: 0.7 }),
    [birdColors.tail],
  );

  useEffect(() => {
    return () => {
      bodyGeo.dispose();
      headGeo.dispose();
      beakGeo.dispose();
      innerWingGeo.dispose();
      outerWingGeo.dispose();
      tailGeo.dispose();
      bodyMat.dispose();
      wingMat.dispose();
      beakMat.dispose();
      tailMat.dispose();
    };
  }, [bodyGeo, headGeo, beakGeo, innerWingGeo, outerWingGeo, tailGeo, bodyMat, wingMat, beakMat, tailMat]);

  const rootRefs = useRef<Array<THREE.Group | null>>([]);
  const wingLRefs = useRef<Array<THREE.Group | null>>([]);
  const wingRRefs = useRef<Array<THREE.Group | null>>([]);
  const outerWingLRefs = useRef<Array<THREE.Group | null>>([]);
  const outerWingRRefs = useRef<Array<THREE.Group | null>>([]);
  const intro = useRef(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.85);

    const vis = 1 - smooth01(morph.p);
    const grow = easeOutBack(clamp01(intro.current / 0.7));

    birds.forEach((b, i) => {
      const g = rootRefs.current[i];
      if (!g) return;

      const sc = b.size * vis * grow;
      g.visible = sc > 0.02;
      if (!g.visible) return;

      const a = b.phase + t * b.speed * b.dir;
      const r = b.r + Math.sin(t * 0.45 + b.phase) * 0.8;
      const y = b.h + Math.sin(t * 0.75 + b.phase * 1.5) * 0.75;

      g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);

      // Orientation tangent + banking roll into turn
      const yaw = -a + (b.dir > 0 ? 0 : Math.PI);
      const roll = 0.22 * b.dir + Math.sin(t * 1.2 + b.phase) * 0.06;
      const pitch = b.pitchOffset + Math.sin(t * 0.75 + b.phase * 1.5) * 0.08;
      g.rotation.set(pitch, yaw, roll, "YXZ");
      g.scale.setScalar(Math.max(0.0001, sc));

      // Organic dual-joint wing stroke (inner arm + articulated outer tip)
      const primaryFlap = Math.sin(t * b.flapSpeed + b.phase);
      const innerAngle = primaryFlap * 0.55;
      const outerAngle = Math.sin(t * b.flapSpeed + b.phase - 0.4) * 0.45;

      const wl = wingLRefs.current[i];
      const wr = wingRRefs.current[i];
      const owl = outerWingLRefs.current[i];
      const owr = outerWingRRefs.current[i];

      if (wl) wl.rotation.z = innerAngle;
      if (wr) wr.rotation.z = -innerAngle;
      if (owl) owl.rotation.z = outerAngle;
      if (owr) owr.rotation.z = -outerAngle;
    });
  });

  return (
    <group>
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            rootRefs.current[i] = g;
          }}
        >
          {/* Tapered Aerodynamic Body */}
          <mesh
            geometry={bodyGeo}
            material={bodyMat}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            castShadow
          />

          {/* Head & Eyes */}
          <mesh
            geometry={headGeo}
            material={bodyMat}
            position={[0, 0.08, 0.36]}
            scale={[0.9, 0.95, 1.05]}
          />

          {/* Sharp Beak */}
          <mesh
            geometry={beakGeo}
            material={beakMat}
            position={[0, 0.06, 0.54]}
            rotation={[Math.PI / 2, 0, 0]}
          />

          {/* Feathery Tail Fan */}
          <mesh
            geometry={tailGeo}
            material={tailMat}
            position={[0, 0.04, -0.42]}
            rotation={[-0.12, 0, 0]}
          />

          {/* Articulated Left Wing */}
          <group
            position={[-0.12, 0.06, 0.08]}
            ref={(g) => {
              wingLRefs.current[i] = g;
            }}
          >
            <mesh
              geometry={innerWingGeo}
              material={wingMat}
              position={[-0.18, 0, 0]}
            />
            {/* Outer Wing Tip Joint */}
            <group
              position={[-0.36, 0, 0]}
              ref={(g) => {
                outerWingLRefs.current[i] = g;
              }}
            >
              <mesh
                geometry={outerWingGeo}
                material={wingMat}
                position={[-0.16, 0, -0.02]}
              />
            </group>
          </group>

          {/* Articulated Right Wing */}
          <group
            position={[0.12, 0.06, 0.08]}
            ref={(g) => {
              wingRRefs.current[i] = g;
            }}
          >
            <mesh
              geometry={innerWingGeo}
              material={wingMat}
              position={[0.18, 0, 0]}
            />
            {/* Outer Wing Tip Joint */}
            <group
              position={[0.36, 0, 0]}
              ref={(g) => {
                outerWingRRefs.current[i] = g;
              }}
            >
              <mesh
                geometry={outerWingGeo}
                material={wingMat}
                position={[0.16, 0, -0.02]}
              />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}