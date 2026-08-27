import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

const LOGO_SRC = "https://i.imgur.com/1xINYng.png";

function createBlimpTexture(logoImage: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Airship silver/white envelope gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, "#f8fafc");
    bgGrad.addColorStop(0.5, "#e2e8f0");
    bgGrad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic Navy & Crimson belly stripes
    ctx.fillStyle = "#1e3a8a"; // Navy Blue
    ctx.fillRect(0, canvas.height * 0.68, canvas.width, 42);

    ctx.fillStyle = "#e11d48"; // Rose/Crimson
    ctx.fillRect(0, canvas.height * 0.74, canvas.width, 24);

    ctx.fillStyle = "#f59e0b"; // Gold Trim
    ctx.fillRect(0, canvas.height * 0.65, canvas.width, 10);

    // Paint Logo Decals onto Port & Starboard flanks
    if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
      const badgeDiameter = 280;
      const badgeY = canvas.height * 0.42;

      // Positions for left and right flanks of the cylindrical projection
      const flankPositions = [canvas.width * 0.25, canvas.width * 0.75];

      flankPositions.forEach((badgeX) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeDiameter / 2, 0, Math.PI * 2);
        ctx.closePath();

        // White circular base plate
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
        ctx.shadowBlur = 16;
        ctx.fill();

        // Gold outer ring
        ctx.lineWidth = 12;
        ctx.strokeStyle = "#f59e0b";
        ctx.stroke();

        // Clip & draw logo
        ctx.clip();
        const pad = 24;
        ctx.drawImage(
          logoImage,
          badgeX - badgeDiameter / 2 + pad,
          badgeY - badgeDiameter / 2 + pad,
          badgeDiameter - pad * 2,
          badgeDiameter - pad * 2,
        );
        ctx.restore();
      });
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export default function Blimp({
  orbit = 36,
  alt = 24,
  speed = 0.045,
}: {
  orbit?: number;
  alt?: number;
  speed?: number;
}) {
  const blimpGroup = useRef<THREE.Group>(null);
  const leftPropRef = useRef<THREE.Mesh>(null);
  const rightPropRef = useRef<THREE.Mesh>(null);
  const beaconLightRef = useRef<THREE.PointLight>(null);
  const intro = useRef(0);

  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = LOGO_SRC;
    img.onload = () => setLogoImg(img);
  }, []);

  // Geometries
  const hullGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  const gondolaGeo = useMemo(() => new THREE.BoxGeometry(0.85, 0.45, 2.4), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(0.08, 1.4, 1.1), []);
  const engineGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.55, 12), []);
  const propGeo = useMemo(() => new THREE.BoxGeometry(0.65, 0.04, 0.06), []);

  // Textures & Materials
  const blimpTex = useMemo(() => createBlimpTexture(logoImg), [logoImg]);

  const hullMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: blimpTex,
        roughness: 0.38,
        metalness: 0.15,
      }),
    [blimpTex],
  );

  const gondolaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.3,
        metalness: 0.6,
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
        color: "#f59e0b",
        roughness: 0.3,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      hullGeo.dispose();
      gondolaGeo.dispose();
      finGeo.dispose();
      engineGeo.dispose();
      propGeo.dispose();
      blimpTex.dispose();
      hullMat.dispose();
      gondolaMat.dispose();
      finMat.dispose();
      propMat.dispose();
    };
  }, [hullGeo, gondolaGeo, finGeo, engineGeo, propGeo, blimpTex, hullMat, gondolaMat, finMat, propMat]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    const g = blimpGroup.current;
    if (g) {
      const angle = t * speed + Math.PI;
      const x = Math.cos(angle) * orbit;
      const z = Math.sin(angle) * orbit;
      const y = alt + Math.sin(t * 0.4) * 0.6;

      g.position.set(x, y, z);

      // Tangent alignment
      const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).normalize();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

      g.scale.setScalar(Math.max(0.0001, 1.4 * scale));
      g.visible = scale > 0.02;
    }

    if (leftPropRef.current) leftPropRef.current.rotation.z += dt * 36;
    if (rightPropRef.current) rightPropRef.current.rotation.z += dt * 36;

    if (beaconLightRef.current) {
      beaconLightRef.current.intensity = Math.sin(t * 8) > 0.5 ? 2.5 : 0;
    }
  });

  return (
    <group ref={blimpGroup}>
      {/* Aerodynamic Airship Hull */}
      <mesh
        geometry={hullGeo}
        material={hullMat}
        scale={[1.7, 1.7, 4.8]}
        castShadow
      />

      {/* Control Gondola Underbelly */}
      <mesh
        geometry={gondolaGeo}
        material={gondolaMat}
        position={[0, -1.75, 0.2]}
        castShadow
      />

      {/* Tail Fins (Top, Bottom, Left, Right) */}
      <mesh geometry={finGeo} material={finMat} position={[0, 1.4, -3.8]} />
      <mesh geometry={finGeo} material={finMat} position={[0, -1.4, -3.8]} />
      <mesh geometry={finGeo} material={finMat} position={[1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={finGeo} material={finMat} position={[-1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />

      {/* Gondola Propeller Engines */}
      <group position={[-0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={leftPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      <group position={[0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={rightPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      {/* Night Beacon Light */}
      <pointLight ref={beaconLightRef} color="#ef4444" distance={5} decay={2} position={[0, -2.1, 0.2]} />
    </group>
  );
}