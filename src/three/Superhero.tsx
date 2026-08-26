import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// 3D Voxel coordinate offsets to trace out "B R C"
const BRC_OFFSETS: [number, number, number][] = [
  // --- B ---
  [-3.6, 0.0, 0], [-3.6, 0.4, 0], [-3.6, 0.8, 0], [-3.6, 1.2, 0], [-3.6, 1.6, 0],
  [-3.2, 1.6, 0], [-2.8, 1.4, 0], [-3.2, 0.8, 0], [-2.8, 0.4, 0], [-3.2, 0.0, 0],
  // --- R ---
  [-1.6, 0.0, 0], [-1.6, 0.4, 0], [-1.6, 0.8, 0], [-1.6, 1.2, 0], [-1.6, 1.6, 0],
  [-1.2, 1.6, 0], [-0.8, 1.2, 0], [-1.2, 0.8, 0], [-1.0, 0.4, 0], [-0.7, 0.0, 0],
  // --- C ---
  [0.8, 1.4, 0], [0.4, 1.6, 0], [0.0, 1.2, 0], [0.0, 0.8, 0], [0.0, 0.4, 0],
  [0.4, 0.0, 0], [0.8, 0.2, 0],
];

export default function Superhero({
  orbit = 16,
  alt = 18,
}: {
  orbit?: number;
  alt?: number;
}) {
  const heroGroup = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const intro = useRef(0);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const trailParticleGeo = useMemo(() => new THREE.SphereGeometry(0.18, 8, 8), []);

  // Materials
  const suitBlueMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1d4ed8", roughness: 0.4 }),
    [],
  );
  const capeRedMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.5, side: THREE.DoubleSide }),
    [],
  );
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fcd34d", roughness: 0.6 }),
    [],
  );
  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.2, metalness: 0.8 }),
    [],
  );
  const trailMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fef08a",
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      trailParticleGeo.dispose();
      suitBlueMat.dispose();
      capeRedMat.dispose();
      skinMat.dispose();
      goldMat.dispose();
      trailMat.dispose();
    };
  }, [boxGeo, trailParticleGeo, suitBlueMat, capeRedMat, skinMat, goldMat, trailMat]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    // Flight Orbit Motion
    const hero = heroGroup.current;
    if (hero) {
      const flightSpeed = 0.55;
      const angle = t * flightSpeed;
      const r = orbit * 1.15;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = alt + Math.sin(t * 1.8) * 0.8;

      hero.position.set(x, y, z);
      // Face forward along flight direction with superhero tilt
      hero.rotation.set(
        Math.PI / 2.3, // Flying horizontal posture
        -angle - Math.PI / 2,
        0.35, // Bank roll
        "YXZ",
      );
      hero.scale.setScalar(Math.max(0.0001, 1.2 * scale));
      hero.visible = scale > 0.02;
    }

    // Dynamic Flapping Cape
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.15 + Math.sin(t * 14) * 0.22;
      capeRef.current.rotation.z = Math.cos(t * 12) * 0.1;
    }

    // Glowing "BRC" trail following superhero wake
    const trailMesh = trailMeshRef.current;
    if (trailMesh && hero) {
      trailMat.opacity = vis * (0.65 + Math.sin(t * 4) * 0.2);
      trailMesh.visible = trailMat.opacity > 0.01;

      const trailFollowAngle = t * 0.55 - 0.45;
      const trailCenter = new THREE.Vector3(
        Math.cos(trailFollowAngle) * (orbit * 1.15),
        alt + 1.2,
        Math.sin(trailFollowAngle) * (orbit * 1.15),
      );

      const pulse = 1 + Math.sin(t * 3) * 0.12;

      for (let i = 0; i < BRC_OFFSETS.length; i++) {
        const offset = BRC_OFFSETS[i];
        
        // Orient characters towards the central camera view
        tmp.position.set(
          trailCenter.x + offset[0] * 0.65 * pulse,
          trailCenter.y + offset[1] * 0.65 * pulse,
          trailCenter.z + offset[2] * 0.65,
        );
        tmp.scale.setScalar(Math.max(0.0001, (0.28 + (i % 2) * 0.08) * scale));
        tmp.updateMatrix();
        trailMesh.setMatrixAt(i, tmp.matrix);
      }
      trailMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Superhero Figure */}
      <group ref={heroGroup}>
        {/* Torso */}
        <mesh geometry={boxGeo} material={suitBlueMat} scale={[0.48, 0.72, 0.32]} />
        
        {/* Golden Emblem on Chest */}
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

        {/* Extended Fist (Right Leading Hand) */}
        <mesh
          geometry={boxGeo}
          material={skinMat}
          position={[0.22, 0.85, 0.08]}
          scale={[0.16, 0.45, 0.16]}
        />

        {/* Side Hand (Left Arm) */}
        <mesh
          geometry={boxGeo}
          material={suitBlueMat}
          position={[-0.32, 0.15, -0.04]}
          scale={[0.14, 0.52, 0.14]}
        />

        {/* Flying Legs */}
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

        {/* Billowing Red Cape */}
        <mesh
          ref={capeRef}
          geometry={boxGeo}
          material={capeRedMat}
          position={[0, -0.2, -0.24]}
          scale={[0.54, 1.15, 0.05]}
        />
      </group>

      {/* Floating Sparkle Trail Forming "BRC" */}
      <instancedMesh
        ref={trailMeshRef}
        args={[trailParticleGeo, trailMat, BRC_OFFSETS.length]}
        frustumCulled={false}
      />
    </>
  );
}