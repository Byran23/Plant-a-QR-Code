import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph } from "./shared";

interface Block {
  p: [number, number, number];
  s: [number, number, number];
}

const LAYOUTS: Block[][] = [
  [
    { p: [0, 0, 0], s: [2.5, 1.25, 1.6] },
    { p: [1.7, 0.3, 0.2], s: [1.7, 1, 1.2] },
    { p: [-1.7, 0.2, -0.2], s: [1.8, 1.1, 1.3] },
    { p: [0.3, 0.8, 0], s: [1.5, 0.9, 1.1] },
  ],
  [
    { p: [0, 0, 0], s: [3, 1.1, 1.4] },
    { p: [2, 0.25, -0.1], s: [1.5, 0.85, 1.1] },
    { p: [-2, 0.35, 0.1], s: [1.6, 1, 1.2] },
  ],
  [
    { p: [0, 0, 0], s: [2.1, 1.4, 1.8] },
    { p: [1.4, 0.5, 0.3], s: [1.5, 1, 1.3] },
    { p: [-1.3, 0.45, -0.3], s: [1.4, 1, 1.2] },
    { p: [0.1, 1, 0.1], s: [1.3, 0.8, 1] },
  ],
];

export default function Clouds({ total }: { total: number }) {
  const W = total * 1.05;
  const groups = useRef<Array<THREE.Group | null>>([]);

  const clouds = useMemo(
    () =>
      LAYOUTS.map((blocks, i) => ({
        blocks,
        x: -W + (i * 2 * W) / LAYOUTS.length + (i % 2 ? 6 : -5),
        y: total * 0.46 + (i % 2) * total * 0.13 + i,
        z: -total * 0.3 + i * total * 0.2,
        s: 0.95 + (i % 3) * 0.35,
        speed: 0.35 + (i % 3) * 0.18,
      })),
    [W, total],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1,
        transparent: true,
        opacity: 0.9,
        emissive: "#ffffff",
        emissiveIntensity: 0.05,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const q = morph.p * morph.p * (3 - 2 * morph.p);
    const vis = 1 - q;
    mat.opacity = vis * 0.92;
    const show = mat.opacity > 0.02;
    clouds.forEach((c, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = show;
      if (!show) return;
      c.x += c.speed * dt;
      if (c.x > W + 10) c.x = -W - 10;
      g.position.set(
        c.x,
        c.y + Math.sin(state.clock.elapsedTime * 0.3 + i * 2) * 0.6,
        c.z,
      );
    });
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
            <mesh key={j} geometry={geo} material={mat} position={b.p} scale={b.s} />
          ))}
        </group>
      ))}
    </>
  );
}
