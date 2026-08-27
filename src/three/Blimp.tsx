import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

const LOGO_SRC = "https://i.imgur.com/1xINYng.png";

function createVibrantBlimpTexture(logoImage: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Horizontal Rainbow / Multi-Tone Aurora Envelope Bands
    const rainbowBands = [
      "#ec4899", // Pink (Dorsal top)
      "#8b5cf6", // Violet
      "#3b82f6", // Royal Blue
      "#06b6d4", // Cyan
      "#10b981", // Emerald
      "#84cc16", // Lime
      "#eab308", // Yellow
      "#f97316", // Orange
      "#e11d48", // Crimson
      "#1e1b4b", // Deep Navy Belly
    ];

    const bandH = canvas.height / rainbowBands.length;
    for (let i = 0; i < rainbowBands.length; i++) {
      ctx.fillStyle = rainbowBands[i];
      ctx.fillRect(0, i * bandH, canvas.width, bandH);

      // Subtle seam line between bands for structure
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, i * bandH, canvas.width, 2);
    }

    // 2. Pearlescent Horizon Sheen
    const sheen = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    sheen.addColorStop(0.35, "rgba(255, 255, 255, 0.0)");
    sheen.addColorStop(0.7, "rgba(255, 255, 255, 0.15)");
    sheen.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Golden Trim Accent Stripes
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, canvas.height * 0.32, canvas.width, 6);
    ctx.fillRect(0, canvas.height * 0.68, canvas.width, 6);

    // 4. Logo Medallions on Port & Starboard Sides
    if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
      const badgeDiameter = 270;
      const badgeY = canvas.height * 0.5; // Centered vertically on the airship side

      // Exact horizontal coordinates for Port (25%) and Starboard (75%)
      const sideOffsets = [canvas.width * 0.25, canvas.width * 0.75];

      sideOffsets.forEach((badgeX) => {
        ctx.save();

        // White Circular Base Plaque
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeDiameter / 2, 0, Math.PI * 2);
        ctx.closePath();

        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 18;
        ctx.fill();

        // Dual Gold / Rose Outer Rim
        ctx.lineWidth = 14;
        ctx.strokeStyle = "#f59e0b";
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "#e11d48";
        ctx.stroke();

        // Clip & Render High-Res Logo
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
  const hullGeo = useMemo(() => new THREE.SphereGeometry(1, 36, 28), []);
  const gondolaGeo = useMemo(() => new THREE.BoxGeometry(0.85, 0.45, 2.4), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(0.08, 1.4, 1.1), []);
  const engineGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.55, 12), []);
  const propGeo = useMemo(() => new THREE.BoxGeometry(0.65, 0.04, 0.06), []);

  // Textures & Materials
  const blimpTex = useMemo(() => createVibrantBlimpTexture(logoImg), [logoImg]);

  const hullMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: blimpTex,
        roughness: 0.35,
        metalness: 0.12,
      }),
    [blimpTex],
  );

  const gondolaMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e1b4b",
        roughness: 0.25,
        metalness: 0.6,
      }),
    [],
  );

  const finTopMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ec4899", roughness: 0.3 }), []);
  const finBottomMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3b82f6", roughness: 0.3 }), []);
  const finSideMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#10b981", roughness: 0.3 }), []);

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
      finTopMat.dispose();
      finBottomMat.dispose();
      finSideMat.dispose();
      propMat.dispose();
    };
  }, [hullGeo, gondolaGeo, finGeo, engineGeo, propGeo, blimpTex, hullMat, gondolaMat, finTopMat, finBottomMat, finSideMat, propMat]);

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
      {/* Colorful Streamlined Hull with Port & Starboard Decals */}
      <mesh
        geometry={hullGeo}
        material={hullMat}
        scale={[1.7, 1.7, 4.8]}
        castShadow
      />

      {/* Gondola Cabin Underbelly */}
      <mesh
        geometry={gondolaGeo}
        material={gondolaMat}
        position={[0, -1.75, 0.2]}
        castShadow
      />

      {/* Colorful Stabilizer Fins */}
      <mesh geometry={finGeo} material={finTopMat} position={[0, 1.4, -3.8]} />
      <mesh geometry={finGeo} material={finBottomMat} position={[0, -1.4, -3.8]} />
      <mesh geometry={finGeo} material={finSideMat} position={[1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={finGeo} material={finSideMat} position={[-1.4, 0, -3.8]} rotation={[0, 0, Math.PI / 2]} />

      {/* Propeller Engines */}
      <group position={[-0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={leftPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      <group position={[0.65, -1.75, 0]}>
        <mesh geometry={engineGeo} material={gondolaMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={rightPropRef} geometry={propGeo} material={propMat} position={[0, 0, -0.32]} />
      </group>

      {/* Strobe Beacon Light */}
      <pointLight ref={beaconLightRef} color="#ec4899" distance={6} decay={2} position={[0, -2.1, 0.2]} />
    </group>
  );
}