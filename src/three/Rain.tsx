import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01 } from "./shared";

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
}

export default function Rain({ total = 25, count = 260 }: { total?: number; count?: number }) {
  const span = Math.max(26, total * 1.35);
  const H = 22;

  const drops = useMemo<Drop[]>(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * span,
      y: Math.random() * H,
      z: (Math.random() - 0.5) * span,
      speed: 24 + Math.random() * 12,
      len: 0.5 + Math.random() * 0.4,
    }));
  }, [count, span]);

  const geo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 1, 4), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#9bc8eb",
        transparent: true,
        opacity: 0.55,
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

  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));

    mat.opacity = vis * 0.55;
    m.visible = mat.opacity > 0.01;
    if (!m.visible) return;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y -= d.speed * dt;
      if (d.y < 0) d.y = H;

      tmp.position.set(d.x, d.y, d.z);
      tmp.scale.set(1, d.len, 1);
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