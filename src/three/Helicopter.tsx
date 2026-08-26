import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// High-clarity 2-sided canvas texture renderer with crisp contrast & high DPI
function createBannerTextures(text: string) {
  const canvasFront = document.createElement("canvas");
  const canvasBack = document.createElement("canvas");
  canvasFront.width = 2048;
  canvasFront.height = 512;
  canvasBack.width = 2048;
  canvasBack.height = 512;

  const renderSide = (canvas: HTMLCanvasElement, isBack: boolean) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 2048, 512);

    // Thick solid borders for visibility
    ctx.fillStyle = "#be123c"; // Crimson red border
    ctx.fillRect(0, 0, 2048, 28);
    ctx.fillRect(0, 484, 2048, 28);

    ctx.fillStyle = "#d97706"; // Golden amber trim
    ctx.fillRect(0, 28, 2048, 14);
    ctx.fillRect(0, 470, 2048, 14);

    if (isBack) {
      ctx.translate(2048, 0);
      ctx.scale(-1, 1);
    }

    // Heavy bold typography
    ctx.font = "900 138px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Thick dark outer stroke for razor-sharp legibility at any distance
    ctx.lineWidth = 22;
    ctx.strokeStyle = "#881337";
    ctx.strokeText(text, 1024, 256);

    // Deep contrasting fill
    ctx.fillStyle = "#e11d48";
    ctx.fillText(text, 1024, 256);

    // Inner bright text highlight core
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(text, 1024, 256);
  };

  renderSide(canvasFront, false);
  renderSide(canvasBack, true);

  const texFront = new THREE.CanvasTexture(canvasFront);
  texFront.minFilter = THREE.LinearFilter;
  texFront.magFilter = THREE.LinearFilter;
  texFront.generateMipmaps = false;
  texFront.needsUpdate = true;

  const texBack = new THREE.CanvasTexture(canvasBack);
  texBack.minFilter = THREE.LinearFilter;
  texBack.magFilter = THREE.LinearFilter;
  texBack.generateMipmaps = false;
  texBack.needsUpdate = true;

  return { texFront, texBack };
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
  const frontBannerMeshRef = useRef<THREE.Mesh>(null);
  const backBannerMeshRef = useRef<THREE.Mesh>(null);
  const intro = useRef(0);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  
  // High-aspect banner geometry scaled for maximum legibility
  const bannerGeo = useMemo(() => new THREE.PlaneGeometry(10.5, 2.6, 32, 6), []);

  const { texFront, texBack } = useMemo(
    () => createBannerTextures("Bryan R. Cañaveral"),
    [],
  );

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e11d48", roughness: 0.35 }),
    [],
  );
  const cockpitGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.1,
        metalness: 0.9,
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

  // Self-illuminated Basic Material so the name remains fully bright and readable from all angles
  const bannerFrontMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texFront,
        side: THREE.FrontSide,
      }),
    [texFront],
  );
  const bannerBackMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texBack,
        side: THREE.BackSide,
      }),
    [texBack],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      bannerGeo.dispose();
      texFront.dispose();
      texBack.dispose();
      bodyMat.dispose();
      cockpitGlassMat.dispose();
      metalMat.dispose();
      rotorBladeMat.dispose();
      yellowAccentMat.dispose();
      ropeMat.dispose();
      bannerFrontMat.dispose();
      bannerBackMat.dispose();
    };
  }, [
    boxGeo,
    sphereGeo,
    cylinderGeo,
    bannerGeo,
    texFront,
    texBack,
    bodyMat,
    cockpitGlassMat,
    metalMat,
    rotorBladeMat,
    yellowAccentMat,
    ropeMat,
    bannerFrontMat,
    bannerBackMat,
  ]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    intro.current = Math.min(1, intro.current + dt * 0.8);

    const p = morph?.p ?? 0;
    const vis = Math.max(0, 1 - smooth01(p));
    const grow = easeOutBack(clamp01(intro.current / 0.7));
    const scale = vis * grow;

    const heli = heliGroup.current;
    if (heli) {
      const flightSpeed = 0.38;
      const angle = t * flightSpeed;
      const r = orbit * 1.15;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = alt + Math.sin(t * 1.4) * 0.45;

      heli.position.set(x, y, z);

      const forwardX = -Math.sin(angle);
      const forwardZ = Math.cos(angle);
      const tangent = new THREE.Vector3(forwardX, 0, forwardZ).normalize();

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        tangent,
      );

      // Controlled banking angle to keep the text facing the camera cleanly
      const bankEuler = new THREE.Euler(0.06, 0, 0.16, "ZYX");
      quat.multiply(new THREE.Quaternion().setFromEuler(bankEuler));

      heli.quaternion.slerp(quat, 0.15);
      heli.scale.setScalar(Math.max(0.0001, 1.15 * scale));
      heli.visible = scale > 0.02;
    }

    if (mainRotorRef.current) {
      mainRotorRef.current.rotation.y += dt * 36;
    }
    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.x += dt * 40;
    }

    // Tamed, flat wave rippling to preserve character geometry and readability
    const posAttr = bannerGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = (posAttr.getX(i) + 5.25) / 10.5; // 0 (tether) to 1 (tail)
      const wave = Math.sin(t * 6 - u * 4.5) * (0.02 + u * 0.22);
      posAttr.setZ(i, wave);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group ref={heliGroup}>
      {/* Fuselage Cabin */}
      <mesh geometry={sphereGeo} material={bodyMat} position={[0, 0, 0.4]} scale={[0.7, 0.75, 1.25]} />

      {/* Cockpit Glass */}
      <mesh
        geometry={sphereGeo}
        material={cockpitGlassMat}
        position={[0, 0.12, 1.05]}
        scale={[0.55, 0.52, 0.55]}
      />

      {/* Side Decorative Accent */}
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

      {/* Tail Rotor */}
      <group position={[0.1, 0.45, -2.25]} ref={tailRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} rotation={[0, 0, Math.PI / 2]} scale={[0.06, 0.12, 0.06]} />
        <mesh geometry={boxGeo} material={rotorBladeMat} scale={[0.02, 0.68, 0.08]} />
      </group>

      {/* Main Rotor Mast */}
      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[0, 0.85, 0.35]}
        scale={[0.08, 0.35, 0.08]}
      />

      {/* Spinning Main Rotor Assembly */}
      <group position={[0, 1.02, 0.35]} ref={mainRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} scale={[0.22, 0.08, 0.22]} />
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
        <mesh
          geometry={cylinderGeo}
          material={metalMat}
          position={[-0.55, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.045, 2.0, 0.045]}
        />
        <mesh
          geometry={cylinderGeo}
          material={metalMat}
          position={[0.55, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.045, 2.0, 0.045]}
        />
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.25, 0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.25, 0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.25, -0.4]} scale={[0.035, 0.45, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.25, -0.4]} scale={[0.035, 0.45, 0.035]} />
      </group>

      {/* High-Contrast Readable Banner */}
      <group position={[0, -0.2, -2.25]}>
        {/* Tow Rig Cables */}
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, -0.2, -0.9]}
          rotation={[0.42, 0, 0]}
          scale={[0.02, 2.0, 0.02]}
        />
        <mesh
          geometry={cylinderGeo}
          material={ropeMat}
          position={[0, -1.0, -0.9]}
          rotation={[-0.42, 0, 0]}
          scale={[0.02, 2.0, 0.02]}
        />

        {/* Double-Faced Front & Back Banners */}
        <group position={[0, -0.6, -7.0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh ref={frontBannerMeshRef} geometry={bannerGeo} material={bannerFrontMat} />
          <mesh ref={backBannerMeshRef} geometry={bannerGeo} material={bannerBackMat} />
        </group>
      </group>
    </group>
  );
}