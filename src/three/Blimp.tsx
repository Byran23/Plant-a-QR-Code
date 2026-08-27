import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

const LOGO_SRC = "https://i.imgur.com/1xINYng.png";

// 4-color palette: Navy Blue (#1e3a8a), Crisp White (#ffffff), Warm Amber/Gold (#f59e0b), Crimson Accent (#e11d48)
function createFourColorBlimpTexture(logoImage: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Navy Blue Upper Dome / Top Half
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.44);

    // 2. Crisp White Lower Hull
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, canvas.height * 0.44, canvas.width, canvas.height * 0.56);

    // 3. Warm Amber/Gold Waist Stripe
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, canvas.height * 0.42, canvas.width, 16);

    // 4. Crimson Red Waist Accent Line
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, canvas.height * 0.54, canvas.width, 14);

    // Side Decals strictly on Port & Starboard (rotated geometry alignment)
    if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
      const badgeDiameter = 280;
      const badgeY = canvas.height * 0.48;

      const flankCenters = [canvas.width * 0.25, canvas.width * 0.75];

      flankCenters.forEach((badgeX) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeDiameter / 2, 0, Math.PI * 2);
        ctx.closePath();

        // White medallion base
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
        ctx.shadowBlur = 14;
        ctx.fill();

        // Gold & Crimson border rings
        ctx.lineWidth = 12;
        ctx.strokeStyle = "#f59e0b";
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "#e11d48";
        ctx.stroke();

        // Draw centered logo
        ctx.clip();
        const pad = 22;
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

  // Rotate hull 90° so UV 0.25 & 0.75 map to side flanks
  const hullGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 48, 36);
    geo.rotateY(Math.PI / 2);
    return geo;
  }, []);

  const gondolaGeo = useMemo(() => new THREE.BoxGeometry(0.85, 0.45, 2.4), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(0.08, 1.4, 1.1), []);
  const engineGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.55, 12), []);
  const propGeo = useMemo(() => new THREE.BoxGeometry(0.65, 0.04, 0.06), []);

  // Textures & Materials
  const blimpTex = useMemo(() => createFourColorBlimpTexture(logoImg), [logoImg]);

  const hullMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: blimpTex,
        roughness: 0.38,
        metalness: 0.1,
      }),
    [blimpTex],
  );

  const gondolaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e3a8a", // Navy Blue
        roughness: 0.35,
        metalness: 0.5,
      }),
    [],
  );

  const finNavyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e3a8a", roughness: 0.4 }), []);
  const finCrimsonMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e11d48", roughness: 0.4 }), []);

  const propMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f59e0b", // Amber/Gold
        roughness: 0.25,
        metalness: 0.6,
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
      finNavyMat.dispose();
      finCrimsonMat.dispose();
      propMat.dispose();
    };
  }, [
    hullGeo,
    gondolaGeo,
    finGeo,
    engineGeo,
    propGeo,
    blimpTex,
    hullMat,
    gondolaMat,
    finNavyMat,
    finCrimsonMat,
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

    const g = blimpGroup.current;
    if (g) {
      const angle = t * speed + Math.PI;
      const x = Math.cos(angle) * orbit;
      const z = Math.sin(angle) * orbit;
      const y = alt + Math.sin(t * 0.4) * 0.6;

      g.position.set(x, y, z);

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
      {/* 4-Color Clean Hull */}
      <mesh
        geometry={hullGeo}
        material={hullMat}
        scale={[1.7, 1.7, 4.8]}
        castShadow
      />

      {/* Control Gondola */}
      <mesh
        geometry={gondolaGeo}
        material={gondolaMat}
        position={[0, -1.75, 0.2]}
        castShadow
      />

      {/* Tail Fins */}
      <mesh geometry={finGeo} material={finNavyMat} position={[0, 1.4, -3.8]} />
      <mesh geometry={finGeo} material={finNavyMat} position={[0, -1.4, -3.8]} />
      <mesh geometry={finGeo} material={finCrimsonMat} position={[1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={finGeo} material={finCrimsonMat} position={[-1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />

      {/* Engines & Props */}
      <group position={[-0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={leftPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      <group position={[0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={rightPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      {/* Flashing Beacon */}
      <pointLight ref={beaconLightRef} color="#e11d48" distance={6} decay={2} position={[0, -2.1, 0.2]} />
    </group>
  );
}