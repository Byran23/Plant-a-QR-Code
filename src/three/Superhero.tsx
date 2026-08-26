import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// Precision stroke coordinates that trace the letters B -> R -> C in order
const BRC_STROKE_POINTS: [number, number, number][] = [
  // --- Letter 'B' ---
  [-3.8, -0.9, 0],
  [-3.8, -0.45, 0],
  [-3.8, 0.0, 0],
  [-3.8, 0.45, 0],
  [-3.8, 0.9, 0],
  [-3.3, 0.9, 0],
  [-2.85, 0.65, 0],
  [-3.3, 0.45, 0],
  [-2.8, 0.2, 0],
  [-3.3, -0.9, 0],
  [-3.8, -0.9, 0],

  // --- Letter 'R' ---
  [-1.6, -0.9, 0],
  [-1.6, -0.45, 0],
  [-1.6, 0.0, 0],
  [-1.6, 0.45, 0],
  [-1.6, 0.9, 0],
  [-1.15, 0.9, 0],
  [-0.7, 0.55, 0],
  [-1.15, 0.2, 0],
  [-0.95, -0.35, 0],
  [-0.65, -0.9, 0],

  // --- Letter 'C' ---
  [1.7, 0.75, 0],
  [1.25, 0.9, 0],
  [0.65, 0.65, 0],
  [0.45, 0.2, 0],
  [0.45, -0.2, 0],
  [0.65, -0.65, 0],
  [1.25, -0.9, 0],
  [1.7, -0.75, 0],
];

interface SmokePuff {
  baseX: number;
  baseY: number;
  baseZ: number;
  strokeIndex: number;
  scaleVar: number;
  rotSpeed: number;
  phase: number;
}

export default function Superhero({
  orbit = 16,
  alt = 16,
}: {
  orbit?: number;
  alt?: number;
}) {
  const heroGroup = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const intro = useRef(0);

  // Voxel & Smoke Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const smokePuffGeo = useMemo(() => new THREE.DodecahedronGeometry(0.55, 1), []);

  // Character Materials
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

  // Soft, billowy skywriting smoke material
  const smokeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1.0,
        metalness: 0,
        transparent: true,
        opacity: 0.58,
        emissive: "#fff8fa",
        emissiveIntensity: 0.12,
        depthWrite: false,
      }),
    [],
  );

  // Multiple volumetric puffs per stroke point to form thick, cloud-like letters
  const smokePuffs = useMemo<SmokePuff[]>(() => {
    const list: SmokePuff[] = [];
    BRC_STROKE_POINTS.forEach((pt, idx) => {
      // 3 clustered puffs per stroke coordinate for dense billowy volume
      for (let k = 0; k < 3; k++) {
        list.push({
          baseX: pt[0] * 1.35 + (Math.random() - 0.5) * 0.35,
          baseY: pt[1] * 1.35 + (Math.random() - 0.5) * 0.35,
          baseZ: pt[2] + (Math.random() - 0.5) * 0.35,
          strokeIndex: idx,
          scaleVar: 0.85 + Math.random() * 0.45,
          rotSpeed: (Math.random() - 0.5) * 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });
    return list;
  }, []);

  const tmp = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      smokePuffGeo.dispose();
      suitBlueMat.dispose();
      capeRedMat.dispose();
      skinMat.dispose();
      goldMat.dispose();
      smokeMat.dispose();
    };
  }, [boxGeo, smokePuffGeo, suitBlueMat, capeRedMat, skinMat, goldMat, smokeMat]);

  useLayoutEffect(() => {
    const m = smokeMeshRef.current;
    if (!m) return;
    for (let i = 0; i < smokePuffs.length; i++) {
      tmp.position.set(0, -999, 0);
      tmp.scale.setScalar(0.0001);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [smokePuffs, tmp]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const totalScale = vis * grow;

    // Flight Orbit Motion
    const hero = heroGroup.current;
    const flightSpeed = 0.48;
    const angle = t * flightSpeed;
    const r = orbit * 1.15;

    const heroX = Math.cos(angle) * r;
    const heroZ = Math.sin(angle) * r;
    const heroY = alt + Math.sin(t * 1.6) * 0.75;

    if (hero) {
      hero.position.set(heroX, heroY, heroZ);
      hero.rotation.set(
        Math.PI / 2.35, // Horizontal flight angle
        -angle - Math.PI / 2,
        0.32, // Aerodynamic banking
        "YXZ",
      );
      hero.scale.setScalar(Math.max(0.0001, 1.25 * totalScale));
      hero.visible = totalScale > 0.02;
    }

    // Billowing cape flutter
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.16 + Math.sin(t * 15) * 0.24;
      capeRef.current.rotation.z = Math.cos(t * 13) * 0.12;
    }

    // Volumetric Smoke Letters Trail
    const smokeMesh = smokeMeshRef.current;
    if (smokeMesh) {
      smokeMat.opacity = vis * 0.58;
      smokeMesh.visible = smokeMat.opacity > 0.01;
      if (!smokeMesh.visible) return;

      // Position the skywritten BRC cloud directly in the hero's wake
      const trailLagAngle = angle - 0.75;
      const cloudCenter = new THREE.Vector3(
        Math.cos(trailLagAngle) * (orbit * 1.08),
        alt + 0.6,
        Math.sin(trailLagAngle) * (orbit * 1.08),
      );

      // Facing the main front camera
      const yawAngle = -trailLagAngle - Math.PI / 2;

      for (let i = 0; i < smokePuffs.length; i++) {
        const puff = smokePuffs[i];

        // Progressive writing wave from B to R to C
        const strokeProgress = puff.strokeIndex / BRC_STROKE_POINTS.length;
        const wave = Math.sin(t * 1.2 - strokeProgress * 4.5);
        const billowGrowth = 1.0 + Math.max(0, wave) * 0.22;

        // Subtle drifting float
        const driftX = Math.sin(t * 0.6 + puff.phase) * 0.18;
        const driftY = Math.cos(t * 0.5 + puff.phase) * 0.18;

        // Rotate offset into the camera view plane
        const localX = (puff.baseX + driftX) * billowGrowth;
        const localY = (puff.baseY + driftY) * billowGrowth;
        const localZ = puff.baseZ;

        const rotatedX = localX * Math.cos(yawAngle) - localZ * Math.sin(yawAngle);
        const rotatedZ = localX * Math.sin(yawAngle) + localZ * Math.cos(yawAngle);

        tmp.position.set(
          cloudCenter.x + rotatedX,
          cloudCenter.y + localY,
          cloudCenter.z + rotatedZ,
        );

        tmp.rotation.set(
          t * puff.rotSpeed,
          t * puff.rotSpeed * 0.8,
          puff.phase,
        );

        const currentPuffScale = puff.scaleVar * billowGrowth * totalScale;
        tmp.scale.setScalar(Math.max(0.0001, currentPuffScale));
        tmp.updateMatrix();

        smokeMesh.setMatrixAt(i, tmp.matrix);
      }
      smokeMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Flying Superhero */}
      <group ref={heroGroup}>
        {/* Torso */}
        <mesh geometry={boxGeo} material={suitBlueMat} scale={[0.48, 0.72, 0.32]} />

        {/* Gold Emblem */}
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

        {/* Forward Leading Fist */}
        <mesh
          geometry={boxGeo}
          material={skinMat}
          position={[0.22, 0.85, 0.08]}
          scale={[0.16, 0.45, 0.16]}
        />

        {/* Trailing Arm */}
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

        {/* Flapping Red Cape */}
        <mesh
          ref={capeRef}
          geometry={boxGeo}
          material={capeRedMat}
          position={[0, -0.2, -0.24]}
          scale={[0.54, 1.15, 0.05]}
        />
      </group>

      {/* Billowy Skywriting Smoke "BRC" */}
      <instancedMesh
        ref={smokeMeshRef}
        args={[smokePuffGeo, smokeMat, smokePuffs.length]}
        frustumCulled={false}
      />
    </>
  );
}