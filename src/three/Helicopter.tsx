import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

function createBannerSideTexture(text: string, primaryColor: string = "#e11d48", isBack: boolean = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Subtle swallowtail notch at the trailing edge
  ctx.save();
  ctx.beginPath();
  if (!isBack) {
    // Front Face: Leading edge on Left (0), Swallowtail on Right (2400)
    ctx.moveTo(0, 0);
    ctx.lineTo(2400, 0);
    ctx.lineTo(2260, 180); // Compact 140px notch
    ctx.lineTo(2400, 360);
    ctx.lineTo(0, 360);
  } else {
    // Back Face: Leading edge on Right (2400), Swallowtail on Left (0)
    ctx.moveTo(2400, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(140, 180); // Compact 140px notch
    ctx.lineTo(0, 360);
    ctx.lineTo(2400, 360);
  }
  ctx.closePath();
  ctx.clip();

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 2400, 0);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(0.5, "#fffdfa");
  bgGrad.addColorStop(1, "#fff1f2");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 2400, 360);

  // Top / Bottom borders
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 2400, 18);
  ctx.fillRect(0, 342, 2400, 18);

  ctx.fillStyle = "#f59e0b"; // Gold Trim
  ctx.fillRect(0, 18, 2400, 8);
  ctx.fillRect(0, 334, 2400, 8);

  // Leading edge grommet strip
  ctx.fillStyle = primaryColor;
  if (!isBack) {
    ctx.fillRect(0, 0, 20, 360);
  } else {
    ctx.fillRect(2380, 0, 20, 360);
  }

  // Text rendered left-to-right on both faces (never reversed/flipped)
  ctx.font = "900 128px 'Roboto', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const centerX = !isBack ? 1140 : 1260;

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillText(text, centerX + 3, 183);

  // Text Fill
  ctx.fillStyle = primaryColor;
  ctx.fillText(text, centerX, 180);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Compact swallowtail geometry
function createBannerMeshGeometry(width = 15.0, height = 1.75, segX = 48, segY = 6) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const halfW = width / 2;
  const halfH = height / 2;
  const notchDepth = width * 0.055; // Subtle, realistic notch depth

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // u = 0 at leading edge, 1 at tail
    const u = (x + halfW) / width;

    if (u > 0.88) {
      const tailFraction = (u - 0.88) / 0.12;
      const distFromCenterY = 1 - Math.abs(y) / halfH;
      const indent = tailFraction * distFromCenterY * notchDepth;
      pos.setX(i, x - indent);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

export default function Helicopter({
  orbit = 16,
  alt = 18,
  bannerText = "Bryan R. Cañaveral",
  bannerColor = "#e11d48",
}: {
  orbit?: number;
  alt?: number;
  bannerText?: string;
  bannerColor?: string;
}) {
  const heliGroup = useRef<THREE.Group>(null);
  const mainRotorRef = useRef<THREE.Group>(null);
  const mainRotorBlurRef = useRef<THREE.Mesh>(null);
  const tailRotorRef = useRef<THREE.Group>(null);
  const bannerMeshRef = useRef<THREE.Mesh>(null);
  const strobeLightRef = useRef<THREE.PointLight>(null);
  const intro = useRef(0);

  // Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 18, 18), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  const discGeo = useMemo(() => new THREE.CircleGeometry(2.3, 24), []);
  const bannerGeo = useMemo(() => createBannerMeshGeometry(15.0, 1.75, 48, 6), []);

  // Textures
  const texFront = useMemo(
    () => createBannerSideTexture(bannerText || "Bryan R. Cañaveral", bannerColor || "#e11d48", false),
    [bannerText, bannerColor],
  );
  const texBack = useMemo(
    () => createBannerSideTexture(bannerText || "Bryan R. Cañaveral", bannerColor || "#e11d48", true),
    [bannerText, bannerColor],
  );

  // Materials
  const liveryColorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bannerColor, roughness: 0.3, metalness: 0.2 }),
    [bannerColor],
  );
  const liveryWhiteMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35, metalness: 0.1 }),
    [],
  );
  const cockpitGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.1,
        metalness: 0.95,
      }),
    [],
  );
  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.85,
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
  const rotorBlurMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#64748b",
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const goldAccentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        roughness: 0.25,
        metalness: 0.7,
      }),
    [],
  );
  const searchlightMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fef08a",
      }),
    [],
  );
  const navRedMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ef4444" }), []);
  const navGreenMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#22c55e" }), []);
  const cableMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#e2e8f0" }), []);

  const bannerFrontMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texFront,
        side: THREE.FrontSide,
        transparent: true,
      }),
    [texFront],
  );
  const bannerBackMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texBack,
        side: THREE.BackSide,
        transparent: true,
      }),
    [texBack],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      discGeo.dispose();
      bannerGeo.dispose();
      texFront.dispose();
      texBack.dispose();
      liveryColorMat.dispose();
      liveryWhiteMat.dispose();
      cockpitGlassMat.dispose();
      metalMat.dispose();
      rotorBladeMat.dispose();
      rotorBlurMat.dispose();
      goldAccentMat.dispose();
      searchlightMat.dispose();
      navRedMat.dispose();
      navGreenMat.dispose();
      cableMat.dispose();
      bannerFrontMat.dispose();
      bannerBackMat.dispose();
    };
  }, [
    boxGeo,
    sphereGeo,
    cylinderGeo,
    discGeo,
    bannerGeo,
    texFront,
    texBack,
    liveryColorMat,
    liveryWhiteMat,
    cockpitGlassMat,
    metalMat,
    rotorBladeMat,
    rotorBlurMat,
    goldAccentMat,
    searchlightMat,
    navRedMat,
    navGreenMat,
    cableMat,
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

    // Helicopter Orbit
    const heli = heliGroup.current;
    if (heli) {
      const flightSpeed = 0.38;
      const angle = t * flightSpeed;
      const r = orbit * 1.15;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = alt + Math.sin(t * 1.5) * 0.45;

      heli.position.set(x, y, z);

      const forwardX = -Math.sin(angle);
      const forwardZ = Math.cos(angle);
      const tangent = new THREE.Vector3(forwardX, 0, forwardZ).normalize();

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        tangent,
      );

      // Controlled bank angle
      const bankEuler = new THREE.Euler(0.08, 0, 0.16, "ZYX");
      quat.multiply(new THREE.Quaternion().setFromEuler(bankEuler));

      heli.quaternion.slerp(quat, 0.15);
      heli.scale.setScalar(Math.max(0.0001, 1.15 * scale));
      heli.visible = scale > 0.02;
    }

    // Rotor mechanics
    if (mainRotorRef.current) mainRotorRef.current.rotation.y += dt * 44;
    if (mainRotorBlurRef.current) mainRotorBlurRef.current.rotation.z += dt * 25;
    if (tailRotorRef.current) tailRotorRef.current.rotation.x += dt * 48;

    if (strobeLightRef.current) {
      strobeLightRef.current.intensity = Math.sin(t * 12) > 0.75 ? 2.5 : 0;
    }

    // Natural banner aerodynamic wave: 0 at the leading bar, smooth ripple toward the tail
    const posAttr = bannerGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = (posAttr.getX(i) + 7.5) / 15.0; // 0 (lead) to 1 (tail)
      const wave = Math.sin(t * 6.8 - u * 5.2) * (Math.pow(Math.max(0, u), 1.6) * 0.28);
      posAttr.setZ(i, wave);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group ref={heliGroup}>
      {/* Fuselage */}
      <mesh geometry={sphereGeo} material={liveryWhiteMat} position={[0, -0.1, 0.4]} scale={[0.68, 0.58, 1.25]} />
      <mesh geometry={sphereGeo} material={liveryColorMat} position={[0, 0.12, 0.35]} scale={[0.72, 0.65, 1.2]} />

      <mesh
        geometry={sphereGeo}
        material={cockpitGlassMat}
        position={[0, 0.16, 1.05]}
        scale={[0.56, 0.5, 0.58]}
      />

      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[-0.24, 0.52, 0.25]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.13, 0.7, 0.13]}
      />
      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[0.24, 0.52, 0.25]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.13, 0.7, 0.13]}
      />

      <mesh
        geometry={boxGeo}
        material={goldAccentMat}
        position={[0, 0.02, 0.32]}
        scale={[0.74, 0.08, 1.35]}
      />

      <mesh
        geometry={cylinderGeo}
        material={searchlightMat}
        position={[0, -0.22, 1.4]}
        rotation={[Math.PI / 3, 0, 0]}
        scale={[0.1, 0.08, 0.1]}
      />

      {/* Tail Assembly */}
      <mesh
        geometry={cylinderGeo}
        material={liveryColorMat}
        position={[0, 0.14, -1.35]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.15, 1.85, 0.15]}
      />

      <mesh
        geometry={boxGeo}
        material={liveryWhiteMat}
        position={[0, 0.46, -2.22]}
        scale={[0.06, 0.72, 0.44]}
      />
      <mesh
        geometry={boxGeo}
        material={goldAccentMat}
        position={[0, 0.22, -2.0]}
        scale={[0.75, 0.03, 0.2]}
      />

      <pointLight ref={strobeLightRef} color="#ffffff" distance={4} decay={2} position={[0, 0.84, -2.25]} />
      <mesh geometry={sphereGeo} material={searchlightMat} position={[0, 0.82, -2.25]} scale={[0.04, 0.04, 0.04]} />

      <group position={[0.11, 0.48, -2.28]} ref={tailRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} rotation={[0, 0, Math.PI / 2]} scale={[0.06, 0.14, 0.06]} />
        <mesh geometry={boxGeo} material={rotorBladeMat} scale={[0.02, 0.72, 0.08]} />
        <mesh geometry={boxGeo} material={goldAccentMat} scale={[0.02, 0.14, 0.09]} position={[0, 0.3, 0]} />
        <mesh geometry={boxGeo} material={goldAccentMat} scale={[0.02, 0.14, 0.09]} position={[0, -0.3, 0]} />
      </group>

      {/* Main Rotor */}
      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[0, 0.86, 0.35]}
        scale={[0.07, 0.38, 0.07]}
      />
      <mesh
        geometry={cylinderGeo}
        material={metalMat}
        position={[0, 0.76, 0.35]}
        scale={[0.22, 0.06, 0.22]}
      />

      <group position={[0, 1.04, 0.35]} ref={mainRotorRef}>
        <mesh geometry={cylinderGeo} material={metalMat} scale={[0.24, 0.09, 0.24]} />
        <mesh geometry={boxGeo} material={rotorBladeMat} scale={[4.5, 0.025, 0.16]} />
        <mesh geometry={boxGeo} material={rotorBladeMat} rotation={[0, Math.PI / 2, 0]} scale={[4.5, 0.025, 0.16]} />
      </group>

      <mesh
        ref={mainRotorBlurRef}
        geometry={discGeo}
        material={rotorBlurMat}
        position={[0, 1.05, 0.35]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Landing Skids */}
      <group position={[0, -0.66, 0.35]}>
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.56, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.045, 2.1, 0.045]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.56, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.045, 2.1, 0.045]} />
        
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.26, 0.42]} scale={[0.035, 0.48, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.26, 0.42]} scale={[0.035, 0.48, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[-0.32, 0.26, -0.38]} scale={[0.035, 0.48, 0.035]} />
        <mesh geometry={cylinderGeo} material={metalMat} position={[0.32, 0.26, -0.38]} scale={[0.035, 0.48, 0.035]} />

        <mesh geometry={sphereGeo} material={navRedMat} position={[-0.58, 0.06, 0.9]} scale={[0.045, 0.045, 0.045]} />
        <mesh geometry={sphereGeo} material={navGreenMat} position={[0.58, 0.06, 0.9]} scale={[0.045, 0.045, 0.045]} />
      </group>

      {/* Tow Rigging & Direct-Readable Banner */}
      <group position={[0, -0.25, -2.2]}>
        {/* Main Tow Line */}
        <mesh
          geometry={cylinderGeo}
          material={cableMat}
          position={[0, -0.3, -1.0]}
          rotation={[0.32, 0, 0]}
          scale={[0.018, 2.2, 0.018]}
        />

        {/* Bridles */}
        <mesh
          geometry={cylinderGeo}
          material={cableMat}
          position={[0, -0.35, -2.2]}
          rotation={[0.48, 0, 0]}
          scale={[0.016, 1.2, 0.016]}
        />
        <mesh
          geometry={cylinderGeo}
          material={cableMat}
          position={[0, -1.05, -2.2]}
          rotation={[-0.48, 0, 0]}
          scale={[0.016, 1.2, 0.016]}
        />

        {/* Leading Spreader Bar */}
        <mesh
          geometry={cylinderGeo}
          material={metalMat}
          position={[0, -0.7, -2.8]}
          scale={[0.035, 1.9, 0.035]}
        />

        {/* Banner with Independent Front/Back Faces */}
        <group position={[0, -0.7, -10.3]} rotation={[0, Math.PI / 2, 0]}>
          <mesh ref={bannerMeshRef} geometry={bannerGeo} material={bannerFrontMat} />
          <mesh geometry={bannerGeo} material={bannerBackMat} />
        </group>
      </group>
    </group>
  );
}