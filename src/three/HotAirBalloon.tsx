import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01 } from "./shared";

// 12-stripe vibrant rainbow canvas texture
function createBalloonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const stripes = [
      "#e11d48", // Rose Red
      "#f97316", // Orange
      "#f59e0b", // Amber
      "#eab308", // Yellow
      "#84cc16", // Lime
      "#10b981", // Emerald
      "#06b6d4", // Cyan
      "#0ea5e9", // Sky Blue
      "#3b82f6", // Royal Blue
      "#6366f1", // Indigo
      "#8b5cf6", // Violet
      "#ec4899", // Pink
    ];

    const stripeW = canvas.width / stripes.length;
    for (let i = 0; i < stripes.length; i++) {
      ctx.fillStyle = stripes[i];
      ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);

      // Shadowed vertical seams for depth
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(i * stripeW, 0, 4, canvas.height);
      ctx.fillRect((i + 1) * stripeW - 4, 0, 4, canvas.height);

      // Horizontal decorative accent bands
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(i * stripeW, canvas.height * 0.38, stripeW, 24);
      ctx.fillRect(i * stripeW, canvas.height * 0.44, stripeW, 14);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Authentic teardrop balloon envelope geometry
function createBalloonEnvelopeGeometry() {
  const points: THREE.Vector2[] = [];
  const segments = 40;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 (throat) to 1 (crown)
    const y = -1.6 + t * 4.4;

    let radius = 0;
    if (t < 0.35) {
      const u = t / 0.35;
      radius = 0.48 + u * 1.35;
    } else if (t < 0.8) {
      const u = (t - 0.35) / 0.45;
      radius = 1.83 + Math.sin(u * Math.PI * 0.5) * 0.42;
    } else {
      const u = (t - 0.8) / 0.2;
      radius = 2.25 * Math.cos(u * Math.PI * 0.5);
    }

    points.push(new THREE.Vector2(Math.max(0.01, radius), y));
  }

  return new THREE.LatheGeometry(points, 36);
}

export default function HotAirBalloon({
  offsetX = 5.5,
  offsetZ = -4.0,
  alt = 22, // Placed high in the sky frame, safely clear of the canopy top (~13)
}: {
  offsetX?: number;
  offsetZ?: number;
  alt?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const burnerRef = useRef<THREE.PointLight>(null);
  const flameMeshRef = useRef<THREE.Mesh>(null);

  // Geometries
  const envelopeGeo = useMemo(() => createBalloonEnvelopeGeometry(), []);
  const collarGeo = useMemo(() => new THREE.TorusGeometry(0.5, 0.06, 12, 32), []);
  const basketGeo = useMemo(() => new THREE.BoxGeometry(0.72, 0.58, 0.72), []);
  const basketRimGeo = useMemo(() => new THREE.BoxGeometry(0.8, 0.08, 0.8), []);
  const burnerGeo = useMemo(() => new THREE.CylinderGeometry(0.14, 0.14, 0.16, 12), []);
  const flameGeo = useMemo(() => new THREE.ConeGeometry(0.12, 0.32, 8), []);
  const cableGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6), []);

  // Textures & Materials
  const balloonTex = useMemo(() => createBalloonTexture(), []);
  const balloonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: balloonTex,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    [balloonTex],
  );

  const wickerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#92400e",
        roughness: 0.95,
        metalness: 0,
      }),
    [],
  );

  const wickerTrimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#78350f",
        roughness: 0.9,
      }),
    [],
  );

  const cableMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#292524",
        roughness: 0.5,
        metalness: 0.5,
      }),
    [],
  );

  const burnerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#52525b",
        metalness: 0.85,
        roughness: 0.25,
      }),
    [],
  );

  const flameMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffbe0b",
      }),
    [],
  );

  useEffect(() => {
    return () => {
      envelopeGeo.dispose();
      collarGeo.dispose();
      basketGeo.dispose();
      basketRimGeo.dispose();
      burnerGeo.dispose();
      flameGeo.dispose();
      cableGeo.dispose();
      balloonTex.dispose();
      balloonMat.dispose();
      wickerMat.dispose();
      wickerTrimMat.dispose();
      cableMat.dispose();
      burnerMat.dispose();
      flameMat.dispose();
    };
  }, [
    envelopeGeo,
    collarGeo,
    basketGeo,
    basketRimGeo,
    burnerGeo,
    flameGeo,
    cableGeo,
    balloonTex,
    balloonMat,
    wickerMat,
    wickerTrimMat,
    cableMat,
    burnerMat,
    flameMat,
  ]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));

    const g = groupRef.current;
    if (g) {
      // Subtle atmospheric horizontal air drift with static locked altitude (no dipping/dropping)
      const driftX = offsetX + Math.sin(t * 0.05) * 0.2;
      const driftZ = offsetZ + Math.cos(t * 0.04) * 0.2;

      g.position.set(driftX, alt, driftZ);
      g.rotation.set(0, t * 0.012, 0);
      g.scale.setScalar(Math.max(0.0001, 1.25 * vis));
      g.visible = vis > 0.02;
    }

    const flicker = Math.sin(t * 14) * 0.2 + Math.cos(t * 22) * 0.1;
    if (burnerRef.current) {
      burnerRef.current.intensity = Math.max(0.4, 1.3 + flicker);
    }
    if (flameMeshRef.current) {
      const fScale = 1 + flicker * 0.2;
      flameMeshRef.current.scale.set(fScale, fScale * 1.2, fScale);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Balloon Envelope */}
      <mesh
        geometry={envelopeGeo}
        material={balloonMat}
        position={[0, 1.2, 0]}
        castShadow
      />

      {/* Throat Collar */}
      <mesh
        geometry={collarGeo}
        material={cableMat}
        position={[0, -0.42, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Burner & Fire Glow */}
      <group position={[0, -0.78, 0]}>
        <mesh geometry={burnerGeo} material={burnerMat} />
        <mesh
          ref={flameMeshRef}
          geometry={flameGeo}
          material={flameMat}
          position={[0, 0.18, 0]}
        />
        <pointLight
          ref={burnerRef}
          color="#ff7900"
          distance={6}
          decay={2}
          intensity={1.5}
        />
      </group>

      {/* 4 Corner Rigging Cables */}
      <mesh geometry={cableGeo} material={cableMat} position={[-0.26, -1.22, -0.26]} rotation={[-0.15, 0, 0.15]} />
      <mesh geometry={cableGeo} material={cableMat} position={[0.26, -1.22, -0.26]} rotation={[-0.15, 0, -0.15]} />
      <mesh geometry={cableGeo} material={cableMat} position={[-0.26, -1.22, 0.26]} rotation={[0.15, 0, 0.15]} />
      <mesh geometry={cableGeo} material={cableMat} position={[0.26, -1.22, 0.26]} rotation={[0.15, 0, -0.15]} />

      {/* Wicker Basket */}
      <group position={[0, -1.88, 0]}>
        <mesh geometry={basketGeo} material={wickerMat} castShadow />
        <mesh geometry={basketRimGeo} material={wickerTrimMat} position={[0, 0.3, 0]} />
      </group>
    </group>
  );
}