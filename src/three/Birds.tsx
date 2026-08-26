import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "../lib/random";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

interface BirdCfg {
  phase: number;
  speed: number;
  r: number;
  h: number;
  dir: number;
  size: number;
  flap: number;
}

export default function Birds({
  orbit,
  alt,
  season = 0,
  count = 4,
}: {
  orbit: number;
  alt: number;
  season?: number;
  count?: number;
}) {
  const birds = useMemo<BirdCfg[]>(() => {
    const rng = mulberry32(0xb14d5);
    return Array.from({ length: count }, () => ({
      phase: rng() * Math.PI * 2,
      speed: 0.18 + rng() * 0.16,
      r: orbit * (0.82 + rng() * 0.45),
      h: alt + (rng() - 0.5) * 3.2,
      dir: rng() < 0.75 ? 1 : -1,
      size: 0.8 + rng() * 0.4,
      flap: 8 + rng() * 4,
    }));
  }, [orbit, alt, count]);

  // Normalized Season index: 0 = Sakura, 1 = Summer, 2 = Autumn, 3 = Winter
  const normalizedSeason = ((season % 4) + 4) % 4;
  const isBalloonSeason = normalizedSeason === 0 || normalizedSeason === 1; // Sakura & Summer

  // Reusable Base Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);

  // Bird Materials
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fdfdfa", roughness: 0.8 }),
    [],
  );
  const wingMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#46536a", roughness: 0.8 }),
    [],
  );
  const beakMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f5a623", roughness: 0.7 }),
    [],
  );

  // Plane Materials
  const planeWhiteMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f0f3f6", roughness: 0.4 }),
    [],
  );
  const planeRedMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e63946", roughness: 0.5 }),
    [],
  );
  const planeGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1d3557",
        roughness: 0.2,
        metalness: 0.8,
      }),
    [],
  );

  // Hot Air Balloon Materials (Sakura / Summer)
  const balloonMainMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: normalizedSeason === 0 ? "#ff8fa3" : "#f4a261",
        roughness: 0.6,
      }),
    [normalizedSeason],
  );
  const balloonAccentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: normalizedSeason === 0 ? "#fff0f3" : "#e76f51",
        roughness: 0.6,
      }),
    [normalizedSeason],
  );
  const basketMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8d6e63", roughness: 0.9 }),
    [],
  );

  // Blimp Materials (Autumn / Winter)
  const blimpBodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: normalizedSeason === 2 ? "#e9ecef" : "#dbe4ee",
        roughness: 0.5,
        metalness: 0.15,
      }),
    [normalizedSeason],
  );
  const blimpStripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: normalizedSeason === 2 ? "#d97706" : "#0284c7",
        roughness: 0.6,
      }),
    [normalizedSeason],
  );

  const rootRefs = useRef<Array<THREE.Group | null>>([]);
  const wingLRefs = useRef<Array<THREE.Group | null>>([]);
  const wingRRefs = useRef<Array<THREE.Group | null>>([]);
  const planeRef = useRef<THREE.Group>(null);
  const skyCraftRef = useRef<THREE.Group>(null);
  const intro = useRef(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);
    const vis = 1 - smooth01(morph.p);
    const grow = easeOutBack(clamp01(intro.current / 0.7));

    // 1. Birds Animation
    birds.forEach((b, i) => {
      const g = rootRefs.current[i];
      if (!g) return;
      const sc = b.size * vis * grow;
      g.visible = sc > 0.02;
      if (!g.visible) return;
      const a = b.phase + t * b.speed * b.dir;
      const r = b.r + Math.sin(t * 0.4 + b.phase) * 0.6;
      g.position.set(
        Math.cos(a) * r,
        b.h + Math.sin(t * 0.7 + b.phase) * 0.9,
        Math.sin(a) * r,
      );
      g.rotation.set(0, -a + (b.dir > 0 ? 0 : Math.PI), 0.18 * b.dir, "YXZ");
      g.scale.setScalar(Math.max(0.0001, sc));
      const w = Math.sin(t * b.flap + b.phase) * 0.62;
      const wl = wingLRefs.current[i];
      const wr = wingRRefs.current[i];
      if (wl) wl.rotation.z = w;
      if (wr) wr.rotation.z = -w;
    });

    // 2. Occasional Airplane Flight Cross
    const pGroup = planeRef.current;
    if (pGroup) {
      const planeCycle = 38; // Crosses every 38 seconds
      const planeProgress = (t % planeCycle) / planeCycle;
      const span = orbit * 5.5;
      const currentX = (planeProgress - 0.5) * span;

      pGroup.position.set(
        currentX,
        alt + 6.5 + Math.sin(t * 0.5) * 0.4,
        -orbit * 1.8 + Math.cos(t * 0.3) * 1.2,
      );
      pGroup.rotation.set(0.05, Math.PI / 2 + 0.15, 0.08);
      const planeSc = Math.max(0.0001, 1.1 * vis * grow);
      pGroup.scale.setScalar(planeSc);
      pGroup.visible = planeSc > 0.02 && planeProgress > 0.05 && planeProgress < 0.95;
    }

    // 3. Floating Hot Air Balloon / Blimp
    const craftGroup = skyCraftRef.current;
    if (craftGroup) {
      const craftSpeed = 0.045;
      const craftAngle = t * craftSpeed + 1.2;
      const craftRadius = orbit * 2.2;
      const bobbing = Math.sin(t * 0.8) * 0.6;

      craftGroup.position.set(
        Math.cos(craftAngle) * craftRadius,
        alt + 4.2 + bobbing,
        Math.sin(craftAngle) * craftRadius,
      );

      // Face motion direction with gentle drift tilt
      craftGroup.rotation.set(
        Math.sin(t * 0.5) * 0.04,
        -craftAngle + Math.PI / 2,
        Math.cos(t * 0.6) * 0.04,
      );

      const craftSc = Math.max(0.0001, 1.25 * vis * grow);
      craftGroup.scale.setScalar(craftSc);
      craftGroup.visible = craftSc > 0.02;
    }
  });

  return (
    <>
      {/* Little Orbiting Birds */}
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            rootRefs.current[i] = g;
          }}
        >
          <mesh geometry={boxGeo} material={bodyMat} scale={[0.34, 0.3, 0.52]} />
          <mesh
            geometry={boxGeo}
            material={bodyMat}
            position={[0, 0.16, 0.3]}
            scale={[0.24, 0.22, 0.24]}
          />
          <mesh
            geometry={boxGeo}
            material={beakMat}
            position={[0, 0.14, 0.48]}
            scale={[0.09, 0.07, 0.16]}
          />
          <mesh
            geometry={boxGeo}
            material={wingMat}
            position={[0, 0.05, -0.34]}
            scale={[0.2, 0.06, 0.24]}
          />
          <group
            position={[-0.16, 0.12, 0.02]}
            ref={(g) => {
              wingLRefs.current[i] = g;
            }}
          >
            <mesh
              geometry={boxGeo}
              material={wingMat}
              position={[-0.3, 0, 0]}
              scale={[0.52, 0.06, 0.34]}
            />
          </group>
          <group
            position={[0.16, 0.12, 0.02]}
            ref={(g) => {
              wingRRefs.current[i] = g;
            }}
          >
            <mesh
              geometry={boxGeo}
              material={wingMat}
              position={[0.3, 0, 0]}
              scale={[0.52, 0.06, 0.34]}
            />
          </group>
        </group>
      ))}

      {/* Crossing Airplane */}
      <group ref={planeRef}>
        {/* Fuselage */}
        <mesh
          geometry={cylinderGeo}
          material={planeWhiteMat}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.28, 2.2, 0.28]}
        />
        {/* Nose Cone */}
        <mesh
          geometry={sphereGeo}
          material={planeRedMat}
          position={[0, 0, 1.1]}
          scale={[0.27, 0.27, 0.45]}
        />
        {/* Cockpit Window */}
        <mesh
          geometry={boxGeo}
          material={planeGlassMat}
          position={[0, 0.16, 0.72]}
          scale={[0.22, 0.14, 0.32]}
        />
        {/* Main Wings */}
        <mesh
          geometry={boxGeo}
          material={planeWhiteMat}
          position={[0, 0, 0.1]}
          scale={[2.8, 0.05, 0.58]}
        />
        {/* Wingtips */}
        <mesh
          geometry={boxGeo}
          material={planeRedMat}
          position={[-1.4, 0.08, 0.1]}
          scale={[0.06, 0.2, 0.52]}
        />
        <mesh
          geometry={boxGeo}
          material={planeRedMat}
          position={[1.4, 0.08, 0.1]}
          scale={[0.06, 0.2, 0.52]}
        />
        {/* Tail Horizontal Stabilizer */}
        <mesh
          geometry={boxGeo}
          material={planeWhiteMat}
          position={[0, 0.05, -0.95]}
          scale={[0.95, 0.04, 0.32]}
        />
        {/* Tail Fin */}
        <mesh
          geometry={boxGeo}
          material={planeRedMat}
          position={[0, 0.32, -0.95]}
          scale={[0.05, 0.52, 0.38]}
        />
      </group>

      {/* Floating Seasonal Craft: Hot Air Balloon vs Blimp */}
      <group ref={skyCraftRef}>
        {isBalloonSeason ? (
          /* Hot Air Balloon (Sakura & Summer) */
          <group scale={1.1}>
            <mesh
              geometry={sphereGeo}
              material={balloonMainMat}
              position={[0, 1.35, 0]}
              scale={[1.15, 1.45, 1.15]}
            />
            <mesh
              geometry={cylinderGeo}
              material={balloonAccentMat}
              position={[0, 0.52, 0]}
              scale={[0.55, 0.4, 0.55]}
            />
            {/* Basket Ropes */}
            <mesh
              geometry={cylinderGeo}
              material={basketMat}
              position={[0.2, 0.16, 0.2]}
              scale={[0.02, 0.42, 0.02]}
            />
            <mesh
              geometry={cylinderGeo}
              material={basketMat}
              position={[-0.2, 0.16, 0.2]}
              scale={[0.02, 0.42, 0.02]}
            />
            <mesh
              geometry={cylinderGeo}
              material={basketMat}
              position={[0.2, 0.16, -0.2]}
              scale={[0.02, 0.42, 0.02]}
            />
            <mesh
              geometry={cylinderGeo}
              material={basketMat}
              position={[-0.2, 0.16, -0.2]}
              scale={[0.02, 0.42, 0.02]}
            />
            {/* Passenger Basket */}
            <mesh
              geometry={boxGeo}
              material={basketMat}
              position={[0, -0.12, 0]}
              scale={[0.42, 0.32, 0.42]}
            />
          </group>
        ) : (
          /* Airship / Blimp (Autumn & Winter) */
          <group scale={1.2}>
            {/* Main Hull */}
            <mesh
              geometry={sphereGeo}
              material={blimpBodyMat}
              scale={[0.92, 0.95, 2.3]}
            />
            {/* Side Accent Stripe */}
            <mesh
              geometry={boxGeo}
              material={blimpStripeMat}
              position={[0, 0, 0]}
              scale={[0.96, 0.18, 2.1]}
            />
            {/* Gondola / Cabin */}
            <mesh
              geometry={boxGeo}
              material={planeGlassMat}
              position={[0, -0.88, 0.1]}
              scale={[0.34, 0.26, 0.9]}
            />
            {/* Tail Fins */}
            <mesh
              geometry={boxGeo}
              material={blimpStripeMat}
              position={[0, 0.45, -1.9]}
              scale={[0.06, 0.65, 0.55]}
            />
            <mesh
              geometry={boxGeo}
              material={blimpStripeMat}
              position={[0, -0.45, -1.9]}
              scale={[0.06, 0.65, 0.55]}
            />
            <mesh
              geometry={boxGeo}
              material={blimpStripeMat}
              position={[0.45, 0, -1.9]}
              scale={[0.65, 0.06, 0.55]}
            />
            <mesh
              geometry={boxGeo}
              material={blimpStripeMat}
              position={[-0.45, 0, -1.9]}
              scale={[0.65, 0.06, 0.55]}
            />
          </group>
        )}
      </group>
    </>
  );
}