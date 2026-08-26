import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph } from "./shared";

interface Puff {
  p: [number, number, number];
  s: [number, number, number];
}

// Organic, overlapping spherical cloud clusters
const CLOUD_CONFIGS: Puff[][] = [
  [
    { p: [0, 0, 0], s: [3.4, 2.0, 2.2] },
    { p: [1.8, -0.15, 0.2], s: [2.3, 1.5, 1.8] },
    { p: [-1.9, -0.1, -0.2], s: [2.4, 1.6, 1.8] },
    { p: [0.4, 0.9, 0.1], s: [2.1, 1.4, 1.6] },
    { p: [-1.0, 0.7, 0.3], s: [1.8, 1.2, 1.5] },
  ],
  [
    { p: [0, 0, 0], s: [4.0, 1.9, 2.1] },
    { p: [2.2, -0.15, -0.2], s: [2.2, 1.3, 1.6] },
    { p: [-2.2, -0.05, 0.2], s: [2.3, 1.4, 1.7] },
    { p: [0.6, 0.85, -0.1], s: [2.0, 1.3, 1.5] },
  ],
  [
    { p: [0, 0, 0], s: [3.0, 2.1, 2.4] },
    { p: [1.6, 0.3, 0.3], s: [2.0, 1.5, 1.7] },
    { p: [-1.5, 0.25, -0.3], s: [1.9, 1.4, 1.6] },
    { p: [0.1, 1.15, 0.1], s: [1.7, 1.3, 1.5] },
    { p: [0.9, 0.9, -0.2], s: [1.5, 1.1, 1.3] },
  ],
  [
    { p: [0, 0, 0], s: [2.8, 1.6, 1.9] },
    { p: [1.4, -0.1, 0.2], s: [1.8, 1.3, 1.5] },
    { p: [-1.4, 0.1, -0.2], s: [1.7, 1.2, 1.4] },
    { p: [0.3, 0.75, 0], s: [1.5, 1.1, 1.3] },
  ],
];

const BASE_OPACITY = 0.42;

export default function Clouds({ total }: { total: number }) {
  const W = Math.max(32, total * 1.5);
  const groups = useRef<Array<THREE.Group | null>>([]);

  const clouds = useMemo(
    () =>
      CLOUD_CONFIGS.map((blocks, i) => {
        const laneX = -W + (i * 2 * W) / CLOUD_CONFIGS.length + (i % 2 ? 6 : -6);
        return {
          blocks,
          x: laneX,
          y: 11.5 + (i % 3) * 2.2,
          z: -total * 0.45 + (i % 2) * (total * 0.35) - 4,
          s: 1.0 + (i % 3) * 0.25,
          speed: 0.42 + (i % 2) * 0.2,
        };
      }),
    [W, total],
  );

  // Soft, semi-transparent ethereal material
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1.0,
        metalness: 0,
        transparent: true,
        opacity: BASE_OPACITY,
        emissive: "#ffeef3",
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
    [],
  );

  // Smooth sphere geometry removes faceted block edges
  const geo = useMemo(() => new THREE.SphereGeometry(1, 18, 18), []);

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
      if (c.x > W + 12) {
        c.x = -W - 12;
      }

      g.position.set(
        c.x,
        c.y + Math.sin(state.clock.elapsedTime * 0.3 + i * 1.8) * 0.45,
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