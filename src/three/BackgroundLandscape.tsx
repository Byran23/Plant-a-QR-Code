import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Palette } from "../lib/palettes";
import { morph, smooth01 } from "./shared";

export default function BackgroundLandscape({
  total,
  palette,
}: {
  total: number;
  palette: Palette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const orbRef = useRef<THREE.Mesh>(null);

  // Scale bounds according to grid size
  const R_DISTANT = Math.max(90, total * 3.2);
  const R_HILLS = Math.max(65, total * 2.4);

  // Mountain ridge & rolling hill geometries
  const mountainGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 6), []);
  const hillGeo = useMemo(() => new THREE.SphereGeometry(1, 18, 14), []);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(1, 24, 24), []);

  // Material shaders tinted dynamically by palette
  const distantMountainMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.rock,
        roughness: 0.98,
        metalness: 0,
        flatShading: true,
      }),
    [palette.rock],
  );

  const hillMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.grass[1] ?? palette.grass[0],
        roughness: 0.92,
        metalness: 0,
      }),
    [palette.grass],
  );

  const orbMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: palette.sun,
      }),
    [palette.sun],
  );

  // Procedural mountain peaks
  const mountains = useMemo(() => {
    const arr = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.08 : -0.08);
      const rad = R_DISTANT + (i % 3) * 6;
      arr.push({
        x: Math.cos(angle) * rad,
        z: Math.sin(angle) * rad,
        scale: [18 + (i % 4) * 6, 26 + (i % 5) * 8, 18 + (i % 4) * 6] as [number, number, number],
      });
    }
    return arr;
  }, [R_DISTANT]);

  // Midground rolling foothills
  const hills = useMemo(() => {
    const arr = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.15;
      const rad = R_HILLS + (i % 2) * 5;
      arr.push({
        x: Math.cos(angle) * rad,
        z: Math.sin(angle) * rad,
        scale: [24 + (i % 3) * 6, 12 + (i % 4) * 3, 24 + (i % 3) * 6] as [number, number, number],
      });
    }
    return arr;
  }, [R_HILLS]);

  useEffect(() => {
    return () => {
      mountainGeo.dispose();
      hillGeo.dispose();
      orbGeo.dispose();
      distantMountainMat.dispose();
      hillMat.dispose();
      orbMat.dispose();
    };
  }, [mountainGeo, hillGeo, orbGeo, distantMountainMat, hillMat, orbMat]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));

    const g = groupRef.current;
    if (g) {
      g.visible = vis > 0.01;
      g.scale.setScalar(Math.max(0.0001, vis));
    }
  });

  return (
    <group ref={groupRef} position={[0, -2.5, 0]}>
      {/* Distant Mountains Ridge */}
      {mountains.map((m, i) => (
        <mesh
          key={`mtn-${i}`}
          geometry={mountainGeo}
          material={distantMountainMat}
          position={[m.x, m.scale[1] / 2 - 2, m.z]}
          scale={m.scale}
          receiveShadow={false}
          castShadow={false}
        />
      ))}

      {/* Midground Rolling Hills */}
      {hills.map((h, i) => (
        <mesh
          key={`hill-${i}`}
          geometry={hillGeo}
          material={hillMat}
          position={[h.x, -2, h.z]}
          scale={h.scale}
          receiveShadow={false}
          castShadow={false}
        />
      ))}

      {/* Atmospheric Celestial Orb */}
      <mesh
        ref={orbRef}
        geometry={orbGeo}
        material={orbMat}
        position={[R_DISTANT * 0.55, 34, -R_DISTANT * 0.7]}
        scale={[7.5, 7.5, 7.5]}
      />
    </group>
  );
}