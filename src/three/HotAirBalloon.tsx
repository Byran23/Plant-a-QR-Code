import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// Procedural vertical-striped colorful balloon canvas texture
function createBalloonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const stripes = [
      "#ef4444", // Red
      "#f97316", // Orange
      "#eab308", // Yellow
      "#22c55e", // Green
      "#06b6d4", // Cyan
      "#3b82f6", // Blue
      "#a855f7", // Purple
      "#ec4899", // Pink
    ];

    const stripeW = canvas.width / stripes.length;
    for (let i = 0; i < stripes.length; i++) {
      ctx.fillStyle = stripes[i];
      ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
      // Subtle fabric seam shadow
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(i * stripeW, 0, 4, canvas.height);
      ctx.fillRect((i + 1) * stripeW - 4, 0, 4, canvas.height);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export default function HotAirBalloon({
  orbit = 18,
  alt = 17,
  speed = 0.22,
}: {
  orbit?: number;
  alt?: number;
  speed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const burnerRef = useRef<THREE.PointLight>(null);
  const intro = useRef(0);

  // Geometries
  const balloonGeo = useMemo(() => new THREE.SphereGeometry(1.8, 32, 24), []);
  const basketGeo = useMemo(() => new THREE.BoxGeometry(0.8, 0.6, 0.8), []);
  const burnerGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12), []);
  const cableGeo = useMemo(() => new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), []);
  const collarGeo = useMemo(() => new THREE.TorusGeometry(0.5, 0.08, 12, 24), []);

  // Textures & Materials
  const balloonTex = useMemo(() => createBalloonTexture(), []);
  const balloonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: balloonTex,
        roughness: 0.6,
        metalness: 0.05,
      }),
    [balloonTex],
  );

  const basketMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#854d0e", // Wicker brown
        roughness: 0.95,
        metalness: 0,
      }),
    [],
  );

  const cableMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1c1917",
        roughness: 0.5,
      }),
    [],
  );

  const burnerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#44403c",
        metalness: 0.8,
        roughness: 0.3,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      balloonGeo.dispose();
      basketGeo.dispose();
      burnerGeo.dispose();
      cableGeo.dispose();
      collarGeo.dispose();
      balloonTex.dispose();
      balloonMat.dispose();
      basketMat.dispose();
      cableMat.dispose();
      burnerMat.dispose();
    };
  }, [
    balloonGeo,
    basketGeo,
    burnerGeo,
    cableGeo,
    collarGeo,
    balloonTex,
    balloonMat,
    basketMat,
    cableMat,
    burnerMat,
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
      const y = alt + Math.sin(t * 0.8) * 0.6; // Gentle vertical thermal bobbing

      g.position.set(x, y, z);
      // Gentle sway and slow yaw rotation
      g.rotation.set(
        Math.sin(t * 0.7) * 0.04,
        t * 0.1,
        Math.cos(t * 0.6) * 0.04,
      );
      g.scale.setScalar(Math.max(0.0001, scale));
      g.visible = scale > 0.02;
    }

    // Realistic burner flicker
    if (burnerRef.current) {
      burnerRef.current.intensity = 1.2 + Math.sin(t * 18) * 0.8 + (Math.random() - 0.5) * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Tear-drop styled Hot Air Balloon Envelope */}
      <group position={[0, 1.4, 0]}>
        <mesh
          geometry={balloonGeo}
          material={balloonMat}
          scale={[1.15, 1.45, 1.15]}
        />
        {/* Balloon Collar Ring */}
        <mesh
          geometry={collarGeo}
          material={cableMat}
          position={[0, -1.85, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* Burner & Fire Glow */}
      <group position={[0, -0.6, 0]}>
        <mesh geometry={burnerGeo} material={burnerMat} />
        <pointLight
          ref={burnerRef}
          color="#ff7a00"
          distance={4}
          decay={2}
          intensity={1.5}
        />
      </group>

      {/* 4 Corner Rigging Cables */}
      <mesh geometry={cableGeo} material={cableMat} position={[-0.32, -0.9, -0.32]} rotation={[-0.14, 0, 0.14]} />
      <mesh geometry={cableGeo} material={cableMat} position={[0.32, -0.9, -0.32]} rotation={[-0.14, 0, -0.14]} />
      <mesh geometry={cableGeo} material={cableMat} position={[-0.32, -0.9, 0.32]} rotation={[0.14, 0, 0.14]} />
      <mesh geometry={cableGeo} material={cableMat} position={[0.32, -0.9, 0.32]} rotation={[0.14, 0, -0.14]} />

      {/* Wicker Gondola Basket */}
      <mesh
        geometry={basketGeo}
        material={basketMat}
        position={[0, -1.75, 0]}
        castShadow
      />
    </group>
  );
}