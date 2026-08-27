import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

function createBlimpTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(0, 0, 1024, 256);

    ctx.fillStyle = "#facc15";
    ctx.fillRect(0, 256, 1024, 256);

    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, 220, 1024, 72);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 206, 1024, 14);
    ctx.fillRect(0, 292, 1024, 14);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export default function Blimp({
  orbit = 28,
  alt = 23,
  speed = 0.05, // Slowed down significantly for a realistic glide
}: {
  orbit?: number;
  alt?: number;
  speed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const propLeftRef = useRef<THREE.Mesh>(null);
  const propRightRef = useRef<THREE.Mesh>(null);
  const intro = useRef(0);

  const hullGeo = useMemo(() => new THREE.SphereGeometry(1.6, 32, 24), []);
  const gondolaGeo = useMemo(() => new THREE.BoxGeometry(0.65, 0.45, 1.4), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.9, 0.7), []);
  const propGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.45, 0.08), []);
  const engineGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12), []);

  const blimpTex = useMemo(() => createBlimpTexture(), []);
  const hullMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: blimpTex,
        roughness: 0.4,
        metalness: 0.1,
      }),
    [blimpTex],
  );

  const gondolaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.3,
        metalness: 0.2,
      }),
    [],
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.1,
        metalness: 0.9,
      }),
    [],
  );

  const finMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e11d48",
        roughness: 0.4,
      }),
    [],
  );

  const propMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.5,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      hullGeo.dispose();
      gondolaGeo.dispose();
      finGeo.dispose();
      propGeo.dispose();
      engineGeo.dispose();
      blimpTex.dispose();
      hullMat.dispose();
      gondolaMat.dispose();
      glassMat.dispose();
      finMat.dispose();
      propMat.dispose();
    };
  }, [
    hullGeo,
    gondolaGeo,
    finGeo,
    propGeo,
    engineGeo,
    blimpTex,
    hullMat,
    gondolaMat,
    glassMat,
    finMat,
    propMat,
  ]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    const g = groupRef.current;
    if (g) {
      const angle = t * speed;
      const x = Math.cos(angle) * orbit;
      const z = Math.sin(angle) * orbit;
      const y = alt + Math.sin(t * 0.3) * 0.35;

      g.position.set(x, y, z);

      const forwardX = -Math.sin(angle);
      const forwardZ = Math.cos(angle);
      const tangent = new THREE.Vector3(forwardX, 0, forwardZ).normalize();

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        tangent,
      );

      // Mild, realistic turn banking for heavy airship
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.015, 0, 0.06, "ZYX")));
      g.quaternion.slerp(quat, 0.1);

      g.scale.setScalar(Math.max(0.0001, scale));
      g.visible = scale > 0.02;
    }

    if (propLeftRef.current) propLeftRef.current.rotation.z += dt * 18;
    if (propRightRef.current) propRightRef.current.rotation.z += dt * 18;
  });

  return (
    <group ref={groupRef}>
      <mesh
        geometry={hullGeo}
        material={hullMat}
        scale={[1.1, 1.1, 2.5]}
        castShadow
      />

      <group position={[0, 0, -3.2]}>
        <mesh geometry={finGeo} material={finMat} position={[0, 1.0, 0]} />
        <mesh geometry={finGeo} material={finMat} position={[0, -1.0, 0]} />
        <mesh geometry={finGeo} material={finMat} position={[-1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={finGeo} material={finMat} position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
      </group>

      <group position={[0, -1.25, 0.2]}>
        <mesh geometry={gondolaGeo} material={gondolaMat} />
        <mesh geometry={gondolaGeo} material={glassMat} position={[0, 0.05, 0.35]} scale={[1.02, 0.6, 0.5]} />

        <group position={[-0.45, 0, -0.2]}>
          <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
          <mesh ref={propLeftRef} geometry={propGeo} material={propMat} position={[0, 0, -0.2]} />
        </group>
        <group position={[0.45, 0, -0.2]}>
          <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
          <mesh ref={propRightRef} geometry={propGeo} material={propMat} position={[0, 0, -0.2]} />
        </group>
      </group>
    </group>
  );
}