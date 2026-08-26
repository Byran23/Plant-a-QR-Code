import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01 } from "./shared";

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  length: number;
  thickness: number;
}

export default function Rain({
  total = 25,
  count = 450,
}: {
  total?: number;
  count?: number;
}) {
  const span = Math.max(34, total * 1.6);
  const H_TOP = 28;
  const H_BOTTOM = 0;

  const drops = useMemo<Drop[]>(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * span,
      y: Math.random() * H_TOP,
      z: (Math.random() - 0.5) * span,
      speed: 28 + Math.random() * 16,
      length: 1.2 + Math.random() * 0.8,
      thickness: 0.06 + Math.random() * 0.04,
    }));
  }, [count, span]);

  // Box geometry gives flat, solid faces that render reliably without vanishing
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#d0e7ff",
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    [],
  );

  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  // Pre-seed matrix transforms on mount so drops are visible immediately
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      tmp.position.set(d.x, d.y, d.z);
      tmp.scale.set(d.thickness, d.length, d.thickness);
      tmp.rotation.set(0.12, 0, -0.06);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [drops, tmp]);

  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));

    mat.opacity = vis * 0.75;
    m.visible = mat.opacity > 0.01;
    if (!m.visible) return;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y -= d.speed * dt;
      if (d.y < H_BOTTOM) {
        d.y = H_TOP;
        d.x = (Math.random() - 0.5) * span;
        d.z = (Math.random() - 0.5) * span;
      }

      tmp.position.set(d.x, d.y, d.z);
      tmp.scale.set(d.thickness, d.length, d.thickness);
      tmp.rotation.set(0.12, 0, -0.06);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, drops.length]}
      frustumCulled={false}
    />
  );
}