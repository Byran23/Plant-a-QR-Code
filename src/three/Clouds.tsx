import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph } from "./shared";

interface Puff {
  p: [number, number, number];
  s: [number, number, number];
}

// Gentle, organic cumulus puffs
const CLOUD_CONFIGS: Puff[][] = [
  [
    { p: [0, 0, 0], s: [3.2, 1.8, 2.0] },
    { p: [1.6, -0.15, 0.2], s: [2.1, 1.4, 1.6] },
    { p: [-1.7, -0.1, -0.2], s: [2.2, 1.4, 1.6] },
    { p: [0.3, 0.8, 0.1], s: [1.9, 1.2, 1.4] },
  ],
  [
    { p: [0, 0, 0], s: [3.6, 1.7, 1.9] },
    { p: [1.9, -0.15, -0.2], s: [2.0, 1.2, 1.5] },
    { p: [-1.9, -0.05, 0.2], s: [2.0, 1.3, 1.5] },
    { p: [0.5, 0.75, -0.1], s: [1.8, 1.1, 1.3] },
  ],
  [
    { p: [0, 0, 0], s: [2.8, 1.9, 2.1] },
    { p: [1.4, 0.25, 0.3], s: [1.8, 1.3, 1.5] },
    { p: [-1.3, 0.2, -0.3], s: [1.7, 1.2, 1.4] },
    { p: [0.1, 1.0, 0.1], s: [1.5, 1.1, 1.3] },
  ],
  [
    { p: [0, 0, 0], s: [2.6, 1.5, 1.7] },
    { p: [1.3, -0.1, 0.2], s: [1.6, 1.1, 1.3] },
    { p: [-1.3, 0.1, -0.2], s: [1.5, 1.0, 1.2] },
  ],
];

const BASE_OPACITY = 0.38;

export default function Clouds({ total }: { total: number }) {
  // Moderate horizontal travel span to keep clouds in comfortable mid-range visibility
  const W = Math.max(22, total * 0.95);
  const groups = useRef<Array<THREE.Group | null>>([]);

  // Positioned safely above the tree canopy (Y: 16.5 - 19.5) and at comfortable mid-depths
  const clouds = useMemo(
    () =>
      CLOUD_CONFIGS.map((blocks, i) => {
        const laneX = -W + (i * 2 * W) / CLOUD_CONFIGS.length + (i % 2 ? 3 : -3);
        return {
          blocks,
          x: laneX,
          y: 16.5 + (i % 3) * 1.4,
          z: -total * 0.35 + (i % 2) * (total * 0.25) - 3,
          s: 0.9 + (i % 3) * 0.2,
          speed: 0.35 + (i % 2) * 0.15,
        };
      }),
    [W, total],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1.0,
        metalness: 0,
        transparent: true,
        opacity: BASE_OPACITY,
        emissive: "#ffeef3",
        emissiveIntensity: 0.15,
        depthWrite: false,
      }),
    [],
  );

  const geo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = morph?.p ?? 0;
    const q = p * p * (3 - 2 * p);
    const vis = Math.max(0, 1 - q);

    mat.opacity = vis * BASE_OPACITY;
    const show = mat.opacity > 0.01;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const g = groups.current[i];
      if (!g) continue;

      g.visible = show;
      if (!show) continue;

      c.x += c.speed * dt;
      if (c.x > W + 8) {
        c.x = -W - 8;
      }

      g.position.set(
        c.x,
        c.y + Math.sin(state.clock.elapsedTime * 0.25 + i * 1.8) * 0.35,
        c.z,
      );
    }
  });

  return (
    <>
      {clouds.map((c, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g;
          }}
          position={[c.x, c.y, c.z]}
          scale={c.s}
        >
          {c.blocks.map((b, j) => (
            <mesh
              key={j}
              geometry={geo}
              material={mat}
              position={b.p}
              scale={b.s}
              castShadow={false}
              receiveShadow={false}
            />
          ))}
        </group>
      ))}
    </>
  );
}