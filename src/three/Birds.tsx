import { useMemo, useRef } from "react";
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
  flap: number;
}

/**
 * Little voxel birds orbiting the tree crown. They swoop away the moment
 * the scene flattens into the QR code.
 */
export default function Birds({
  orbit,
  alt,
  count = 4,
}: {
  orbit: number;
  alt: number;
  count?: number;
}) {
  const birds = useMemo<BirdCfg[]>(() => {
    const rng = mulberry32(0xB14D5);
    return Array.from({ length: count }, () => ({
      phase: rng() * Math.PI * 2,
      speed: 0.18 + rng() * 0.16,
      r: orbit * (0.82 + rng() * 0.45),
      h: alt + (rng() - 0.5) * 3.2,
      dir: rng() < 0.75 ? 1 : -1,
      size: 0.8 + rng() * 0.4,
      flap: 8 + rng() * 4,
    }));
  }, [orbit, alt, count]);

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fdfdfa", roughness: 0.8 }),
    [],
  );
  const wingMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#46536a", roughness: 0.8 }),
    [],
  );
  const beakMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f5a623", roughness: 0.7 }),
    [],
  );

  const rootRefs = useRef<Array<THREE.Group | null>>([]);
  const wingLRefs = useRef<Array<THREE.Group | null>>([]);
  const wingRRefs = useRef<Array<THREE.Group | null>>([]);
  const intro = useRef(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);
    const vis = 1 - smooth01(morph.p);
    const grow = easeOutBack(clamp01(intro.current / 0.7));

    birds.forEach((b, i) => {
      const g = rootRefs.current[i];
      if (!g) return;
      const sc = b.size * vis * grow;
      g.visible = sc > 0.02;
      if (!g.visible) return;
      const a = b.phase + t * b.speed * b.dir;
      const r = b.r + Math.sin(t * 0.4 + b.phase) * 0.6;
      g.position.set(Math.cos(a) * r, b.h + Math.sin(t * 0.7 + b.phase) * 0.9, Math.sin(a) * r);
      // face along the flight tangent + a gentle bank into the turn
      g.rotation.set(0, -a + (b.dir > 0 ? 0 : Math.PI), 0.18 * b.dir, "YXZ");
      g.scale.setScalar(Math.max(0.0001, sc));
      const w = Math.sin(t * b.flap + b.phase) * 0.62;
      const wl = wingLRefs.current[i];
      const wr = wingRRefs.current[i];
      if (wl) wl.rotation.z = w;
      if (wr) wr.rotation.z = -w;
    });
  });

  return (
    <>
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            rootRefs.current[i] = g;
          }}
        >
          {/* body */}
          <mesh geometry={geo} material={bodyMat} scale={[0.34, 0.3, 0.52]} />
          {/* head */}
          <mesh geometry={geo} material={bodyMat} position={[0, 0.16, 0.3]} scale={[0.24, 0.22, 0.24]} />
          {/* beak */}
          <mesh geometry={geo} material={beakMat} position={[0, 0.14, 0.48]} scale={[0.09, 0.07, 0.16]} />
          {/* tail */}
          <mesh geometry={geo} material={wingMat} position={[0, 0.05, -0.34]} scale={[0.2, 0.06, 0.24]} />
          {/* wings pivot at the shoulders so they can flap */}
          <group
            position={[-0.16, 0.12, 0.02]}
            ref={(g) => {
              wingLRefs.current[i] = g;
            }}
          >
            <mesh geometry={geo} material={wingMat} position={[-0.3, 0, 0]} scale={[0.52, 0.06, 0.34]} />
          </group>
          <group
            position={[0.16, 0.12, 0.02]}
            ref={(g) => {
              wingRRefs.current[i] = g;
            }}
          >
            <mesh geometry={geo} material={wingMat} position={[0.3, 0, 0]} scale={[0.52, 0.06, 0.34]} />
          </group>
        </group>
      ))}
    </>
  );
}
