import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { QRGrid } from "../lib/qr";
import type { Palette } from "../lib/palettes";
import { morph, smooth01 } from "./shared";

export default function Ground({
  grid,
  palette,
  seed,
}: {
  grid: QRGrid;
  palette: Palette;
  seed: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const total = grid.total;
  const S = total * 0.5;

  // Seamless single solid slab base plate without wireframe or grid edges
  const baseGeo = useMemo(() => new THREE.BoxGeometry(total + 2, 0.4, total + 2), [total]);
  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.qrLight,
        roughness: 0.9,
        metalness: 0,
      }),
    [palette.qrLight],
  );

  // Full-size tile box with 0 gap/seam margin (scale: 1.0) so no line borders show
  const tileGeo = useMemo(() => new THREE.BoxGeometry(1.0, 0.2, 1.0), []);
  const tileMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.grass[0] ?? palette.qrLight,
        roughness: 0.85,
        metalness: 0,
      }),
    [palette.grass, palette.qrLight],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    return () => {
      baseGeo.dispose();
      baseMat.dispose();
      tileGeo.dispose();
      tileMat.dispose();
    };
  }, [baseGeo, baseMat, tileGeo, tileMat]);

  // Set tile instances without spacing seams
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let idx = 0;
    for (let x = 0; x < total; x++) {
      for (let z = 0; z < total; z++) {
        dummy.position.set(x - S + 0.5, -0.1, z - S + 0.5);
        dummy.scale.set(1.002, 1, 1.002); // slight micro-overlap to eliminate subpixel gap lines
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [total, S, dummy]);

  useFrame(() => {
    const p = morph?.p ?? 0;
    const q = smooth01(p);
    // Smoothly blend floor material color when morphing to flat QR
    tileMat.color.lerp(
      new THREE.Color(q > 0.5 ? palette.qrLight : palette.grass[0] ?? palette.qrLight),
      0.15,
    );
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Base Foundation Slab */}
      <mesh
        geometry={baseGeo}
        material={baseMat}
        position={[0, -0.3, 0]}
        receiveShadow
      />

      {/* Surface Tile Layer (Without Seams/Borders) */}
      <instancedMesh
        ref={meshRef}
        args={[tileGeo, tileMat, total * total]}
        receiveShadow
      />
    </group>
  );
}