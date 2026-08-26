import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// Generate high-resolution canvas texture for the trailing flag banner
function createFlagTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Flag banner gradient background
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#fff1f2");
    grad.addColorStop(1, "#ffe4e6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    // Decorative top & bottom red borders
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, 0, 1024, 18);
    ctx.fillRect(0, 238, 1024, 18);

    // Golden accent inner borders
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 18, 1024, 8);
    ctx.fillRect(0, 230, 1024, 8);

    // Bold Typography
    ctx.font = "bold 96px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text Shadow
    ctx.fillStyle = "rgba(159, 18, 57, 0.25)";
    ctx.fillText(text, 516, 134);

    // Main Text
    ctx.fillStyle = "#9f1239";
    ctx.fillText(text, 512, 130);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export default function Superhero({
  orbit = 16,
  alt = 18,
}: {
  orbit?: number;
  alt?: number;
}) {
  const heroGroup = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const flagMeshRef = useRef<THREE.Mesh>(null);
  const intro = useRef(0);

  // Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  // Segmented plane geometry to allow organic wave/ripple deformation
  const flagGeo = useMemo(() => new THREE.PlaneGeometry(6.4, 1.6, 28, 6), []);

  // Textures
  const flagTex = useMemo(() => createFlagTexture("Bryan R.C."), []);

  // Materials
  const suitBlueMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1d4ed8", roughness: 0.4 }),
    [],
  );
  const capeRedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#dc2626",
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fcd34d", roughness: 0.6 }),
    [],
  );
  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        roughness: 0.2,
        metalness: 0.8,
      }),
    [],
  );
  const flagMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: flagTex,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
    [flagTex],
  );
  const poleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d1d5db",
        metalness: 0.8,
        roughness: 0.2,
      }),
    [],
  );
  const ropeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fef08a",
      }),
    [],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      cylinderGeo.dispose();
      flagGeo.dispose();
      flagTex.dispose();
      suitBlueMat.dispose();
      capeRedMat.dispose();
      skinMat.dispose();
      goldMat.dispose();
      flagMat.dispose();
      poleMat.dispose();
      ropeMat.dispose();
    };
  }, [
    boxGeo,
    cylinderGeo,
    flagGeo,
    flagTex,
    suitBlueMat,
    capeRedMat,
    skinMat,
    goldMat,
    flagMat,
    poleMat,
    ropeMat,
  ]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    // Orbiting superhero flight path
    const hero = heroGroup.current;
    if (hero) {
      const flightSpeed = 0.52;
      const angle = t * flightSpeed;
      const r = orbit * 1.15;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = alt + Math.sin(t * 1.8) * 0.8;

      hero.position.set(x, y, z);
      hero.rotation.set(
        Math.PI / 2.3, // Flying horizontal posture
        -angle - Math.PI / 2,
        0.35, // Bank roll into curve
        "YXZ",
      );
      hero.scale.setScalar(Math.max(0.0001, 1.2 * scale));
      hero.visible = scale > 0.02;
    }

    // Billowing Cape Animation
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.15 + Math.sin(t * 14) * 0.22;
      capeRef.current.rotation.z = Math.cos(t * 12) * 0.1;
    }

    // Organic Wave Deformation for the trailing "Bryan R.C." Flag
    if (flagMeshRef.current) {
      const posAttr = flagGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const u = (posAttr.getX(i) + 3.2) / 6.4; // 0 (tether/front) to 1 (tail/back)
        // Amplitude grows towards the trailing end
        const wave = Math.sin(t * 10 - u * 7) * (0.08 + u * 0.45);
        posAttr.setZ(i, wave);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={heroGroup}>
      {/* --- Superhero Figure --- */}
      {/* Torso */}
      <mesh geometry={boxGeo} material={suitBlueMat} scale={[0.48, 0.72, 0.32]} />

      {/* Golden Chest Emblem */}
      <mesh
        geometry={boxGeo}
        material={goldMat}
        position={[0, 0.12, 0.18]}
        scale={[0.22, 0.22, 0.06]}
      />

      {/* Head */}
      <mesh
        geometry={boxGeo}
        material={skinMat}
        position={[0, 0.52, 0]}
        scale={[0.3, 0.32, 0.3]}
      />

      {/* Extended Right Fist (Leading Hand) */}
      <mesh
        geometry={boxGeo}
        material={skinMat}
        position={[0.22, 0.85, 0.08]}
        scale={[0.16, 0.45, 0.16]}
      />

      {/* Left Hand (Holding Flag Tether) */}
      <mesh
        geometry={boxGeo}
        material={suitBlueMat}
        position={[-0.32, 0.15, -0.04]}
        scale={[0.14, 0.52, 0.14]}
      />

      {/* Legs */}
      <mesh
        geometry={boxGeo}
        material={suitBlueMat}
        position={[-0.14, -0.65, 0]}
        scale={[0.18, 0.65, 0.2]}
      />
      <mesh
        geometry={boxGeo}
        material={suitBlueMat}
        position={[0.14, -0.65, 0]}
        scale={[0.18, 0.65, 0.2]}
      />

      {/* Red Boots */}
      <mesh
        geometry={boxGeo}
        material={capeRedMat}
        position={[-0.14, -0.92, 0.04]}
        scale={[0.19, 0.28, 0.22]}
      />
      <mesh
        geometry={boxGeo}
        material={capeRedMat}
        position={[0.14, -0.92, 0.04]}
        scale={[0.19, 0.28, 0.22]}
      />

      {/* Billowing Cape */}
      <mesh
        ref={capeRef}
        geometry={boxGeo}
        material={capeRedMat}
        position={[0, -0.2, -0.24]}
        scale={[0.54, 1.15, 0.05]}
      />

      {/* --- Trailing Flag with "Bryan R.C." --- */}
      <group position={[-0.34, 0.05, 0]}>
        {/* Tether Rig / Flagpole */}
        <mesh
          geometry={cylinderGeo}
          material={poleMat}
          position={[0, -1.1, 0.1]}
          scale={[0.04, 2.4, 0.04]}
        />
        {/* Top & Bottom Tow Ropes */}
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, 0.12, 0.08]}
          rotation={[0, 0, Math.PI / 4]}
          scale={[0.02, 0.45, 0.02]}
        />
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, -2.15, 0.08]}
          rotation={[0, 0, -Math.PI / 4]}
          scale={[0.02, 0.45, 0.02]}
        />

        {/* Flying Banner */}
        <mesh
          ref={flagMeshRef}
          geometry={flagGeo}
          material={flagMat}
          position={[-3.3, -1.05, 0.1]}
          rotation={[0, Math.PI, 0]}
        />
      </group>
    </group>
  );
}