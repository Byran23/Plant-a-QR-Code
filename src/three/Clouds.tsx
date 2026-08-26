import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph } from "./shared";

interface Puff {
  p: [number, number, number];
  s: [number, number, number];
}

// Organic, cloud puffs with varied elevations and depth
const CLOUD_CONFIGS: Puff[][] = [
  [
    { p: [0, 0, 0], s: [3.4, 1.9, 2.2] },
    { p: [2.2, 0.35, 0.3], s: [2.4, 1.5, 1.8] },
    { p: [-2.2, 0.25, -0.3], s: [2.5, 1.6, 1.9] },
    { p: [0.5, 1.1, 0.1], s: [2.2, 1.4, 1.7] },
    { p: [-1.2, 0.85, 0.4], s: [1.8, 1.2, 1.5] },
  ],
  [
    { p: [0, 0, 0], s: [4.0, 1.8, 2.1] },
    { p: [2.6, 0.3, -0.2], s: [2.2, 1.3, 1.6] },
    { p: [-2.6, 0.4, 0.2], s: [2.3, 1.4, 1.7] },
    { p: [0.8, 0.95, -0.2], s: [2.0, 1.3, 1.5] },
  ],
  [
    { p: [0, 0, 0], s: [3.0, 2.0, 2.4] },
    { p: [1.9, 0.65, 0.4], s: [2.1, 1.5, 1.8] },
    { p: [-1.8, 0.6, -0.4], s: [2.0, 1.4, 1.7] },
    { p: [0.2, 1.4, 0.1], s: [1.8, 1.3, 1.5] },
    { p: [1.1, 1.1, -0.3], s: [1.6, 1.1, 1.3] },
  ],
];

export default function Clouds({ total }: { total: number }) {
  const W = total * 1.35;
  const groups = useRef<Array<THREE.Group | null>>([]);

  // High elevation placement to frame the taller tree head
  const clouds = useMemo(
    () =>
      CLOUD_CONFIGS.map((blocks, i) => ({
        blocks,
        x: -W + (i * 2 * W) / CLOUD_CONFIGS.length + (i % 2 ? 8 : -7),
        y: total * 0.72 + (i % 2) * total * 0.16 + i * 1.5,
        z: -total * 0.45 + i * total * 0.3,
        s: 1.1 + (i % 3) * 0.4,
        speed: 0.32 + (i % 3) * 0.16,
      })),
    [W, total],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.92,
        emissive: "#fff2f6",
        emissiveIntensity: 0.08,
      }),
    [],
  );

  // 12-sided Dodecahedron for soft, pillowy cloud puffs
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);

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
    const vis = 1 - q;
    mat.opacity = vis * 0.92;
    const show = mat.opacity > 0.02;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const g = groups.current[i];
      if (!g) continue;

      g.visible = show;
      if (!show) continue;

      c.x += c.speed * dt;
      if (c.x > W + 14) c.x = -W - 14;

      g.position.set(
        c.x,
        c.y + Math.sin(state.clock.elapsedTime * 0.25 + i * 2) * 0.75,
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