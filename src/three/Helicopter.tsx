import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// High-resolution canvas texture for the trailing banner
function createBannerTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Banner background gradient
    const grad = ctx.createLinearGradient(0, 0, 1400, 0);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#fff1f2");
    grad.addColorStop(1, "#ffe4e6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1400, 256);

    // Decorative borders
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, 0, 1400, 18);
    ctx.fillRect(0, 238, 1400, 18);

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 18, 1400, 8);
    ctx.fillRect(0, 230, 1400, 8);

    // Bold text styling
    ctx.font = "bold 84px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text drop shadow
    ctx.fillStyle = "rgba(159, 18, 57, 0.25)";
    ctx.fillText(text, 704, 134);

    // Main text
    ctx.fillStyle = "#9f1239";
    ctx.fillText(text, 700, 130);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export default function Helicopter({
  orbit = 16,
  alt = 18,
}: {
  orbit?: number;
  alt?: number;
}) {
  const heliGroup = useRef<THREE.Group>(null);
  const mainRotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);
  const bannerMeshRef = useRef<THREE.Mesh>(null);
  const intro = useRef(0);

  // Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  const bannerGeo = useMemo(() => new THREE.PlaneGeometry(8.2, 1.5, 36, 6), []);

  // Textures
  const bannerTex = useMemo(() => createBannerTexture("Bryan R. Cañaveral"), []);

  // Materials
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e11d48", roughness: 0.35 }),
    [],
  );
  const cockpitGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.15,
        metalness: 0.85,
      }),
    [],
  );
  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.8,
      }),
    [],
  );
  const rotorBladeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.4,
      }),
    [],
  );
  const yellowAccentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        roughness: 0.3,
      }),
    [],
  );
  const ropeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fde047",
      }),
    [],
  );
  const bannerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: bannerTex,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
    [bannerTex],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      bannerGeo.dispose();
      bannerTex.dispose();
      bodyMat.dispose();
      cockpitGlassMat.dispose();
      metalMat.dispose();
      rotorBladeMat.dispose();
      yellowAccentMat.dispose();
      ropeMat.dispose();
      bannerMat.dispose();
    };
  }, [
    boxGeo,
    sphereGeo,
    cylinderGeo,
    bannerGeo,
    bannerTex,
    bodyMat,
    cockpitGlassMat,
    metalMat,
    rotorBladeMat,
    yellowAccentMat,
    ropeMat,
    bannerMat,
  ]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    // Flight orbit path
    const heli = heliGroup.current;
    if (heli) {
      const flightSpeed = 0.45;
      const angle = t * flightSpeed;
      const r = orbit * 1.15;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = alt + Math.sin(t * 1.5) * 0.6;

      heli.position.set(x, y, z);
      heli.rotation.set(
        0.08, // Slight forward pitch
        -angle + Math.PI / 2, // Tangent orientation
        0.18, // Inward roll into turn
        "YXZ",
      );
      heli.scale.setScalar(Math.max(0.0001, 1.15 * scale));
      heli.visible = scale > 0.02;
    }

    // Spin main & tail rotors
    if (mainRotorRef.current) {
      mainRotorRef.current.rotation.y += dt * 32;
    }
    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.x += dt * 36;
    }

    // Natural wave motion for trailing banner
    if (bannerMeshRef.current) {
      const posAttr = bannerGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const u = (posAttr.getX(i) + 4.1) / 8.2; // 0 (tether) to 1 (tail)
        const wave = Math.sin(t * 8 - u * 6.5) * (0.06 + u * 0.42);
        posAttr.setZ(i, wave);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={heliGroup}>
      {/* --- Helicopter Airframe --- */}
      {/* Fuselage Cabin */}
      <mesh geometry={sphereGeo} material={bodyMat} position={[0, 0, 0.4]} scale={[0.7, 0.75, 1.25]} />

      {/* Cockpit Canopy Glass */}
      <mesh
        geometry={sphereGeo}
        material={cockpitGlassMat}
        position={[0, 0.12, 1.05]}
        scale={[0.55, 0.52, 0.55]}
      />

      {/* Side Decorative Accent Stripes */}
      <mesh
        geometry={boxGeo}
        material={yellowAccentMat}
        position={[0, -0.05, 0.35]}
        scale={[0.72, 0.12, 1.4]}
      />

      {/* Tail Boom */}
      <mesh
        geometry={cylinderGeo}
        material={bodyMat}
        position={[0, 0.12, -1.35]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.16, 1.8, 0.16]}
      />

      {/* Tail Fin */}
      <mesh
        geometry={boxGeo}
        material={yellowAccentMat}
        position={[0, 0.42, -2.2]}
        scale={[0.06, 0.65, 0.42]}
      />

      {/* Tail Rotor Hub & Blades */}
      <group position={[0.1, 0.45, -2.25]} ref={tailRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} rotation={[0, 0, Math.PI / 2]} scale={[0.06, 0.12, 0.06]} />
        <mesh geometry={boxGeo} material={rotorBladeMat} scale={[0.02, 0.68, 0.08]} />
      </group>

      {/* Main Rotor Mast & Hub */}
      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[0, 0.85, 0.35]}
        scale={[0.08, 0.35, 0.08]}
      />

      {/* Spinning Main Rotor Assembly */}
      <group position={[0, 1.02, 0.35]} ref={mainRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} scale={[0.22, 0.08, 0.22]} />
        {/* Dual Cross Blades */}
        <mesh geometry={boxGeo} material={rotorBladeMat} scale={[4.2, 0.03, 0.18]} />
        <mesh
          geometry={boxGeo}
          material={rotorBladeMat}
          rotation={[0, Math.PI / 2, 0]}
          scale={[4.2, 0.03, 0.18]}
        />
      </group>

      {/* Landing Skids */}
      <group position={[0, -0.65, 0.35]}>
        {/* Left Skid */}
        <mesh
          geometry={cylinderGeo}
          material={metalMat}
          position={[-0.55, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.045, 2.0, 0.045]}
        />
        {/* Right Skid */}
        <mesh
          geometry={cylinderGeo}
          material={metalMat}
          position={[0.55, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.045, 2.0, 0.045]}
        />
        {/* Struts */}
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.25, 0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.25, 0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.25, -0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.25, -0.4]} scale={[0.035, 0.45, 0.035]} />
      </group>

      {/* --- Trailing Tow Line & Banner --- */}
      <group position={[0, -0.2, -2.25]}>
        {/* Upper & Lower Tow Cables */}
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, -0.15, -0.75]}
          rotation={[0.35, 0, 0]}
          scale={[0.02, 1.6, 0.02]}
        />
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, -0.85, -0.75]}
          rotation={[-0.35, 0, 0]}
          scale={[0.02, 1.6, 0.02]}
        />

        {/* Trailing Banner Mesh */}
        <mesh
          ref={bannerMeshRef}
          geometry={bannerGeo}
          material={bannerMat}
          position={[0, -0.5, -5.6]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      </group>
    </group>
  );
}