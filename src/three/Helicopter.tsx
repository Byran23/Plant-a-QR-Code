import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { morph, smooth01, clamp01, easeOutBack } from "./shared";

// Create custom swallowtail trailing streamer geometry
function createBannerShapeGeometry(length = 12.0, height = 2.4, segmentsX = 48, segmentsY = 6) {
  const shape = new THREE.Shape();
  const halfH = height / 2;
  const tailNotchDepth = 1.4; // Swallowtail V-cut inward depth

  // 2D Contour: Leading Edge -> Top Rim -> Swallowtail Top Tip -> Inward V-Notch -> Swallowtail Bottom Tip -> Bottom Rim
  shape.moveTo(0, -halfH * 0.75);
  shape.lineTo(0, halfH * 0.75);
  shape.lineTo(length, halfH);
  shape.lineTo(length - tailNotchDepth, 0);
  shape.lineTo(length, -halfH);
  shape.closePath();

  // Create a finely subdivided plane with UVs matching standard 0..1 bounds
  const geo = new THREE.PlaneGeometry(length, height, segmentsX, segmentsY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // Custom vertex repositioning to fit the aerodynamic swallowtail profile
  for (let i = 0; i < pos.count; i++) {
    const rawU = (pos.getX(i) + length / 2) / length; // 0 (front) to 1 (tail)
    const rawV = (pos.getY(i) + halfH) / height;     // 0 (bottom) to 1 (top)

    // Leading edge gentle taper
    const verticalSpread = THREE.MathUtils.lerp(0.75, 1.0, Math.min(1, rawU * 2.5));
    const currentHalfH = halfH * verticalSpread;
    const posY = (rawV - 0.5) * 2 * currentHalfH;

    // Cut inward swallowtail chevron at the back
    let posX = rawU * length;
    if (rawU > 0.85) {
      const uTail = (rawU - 0.85) / 0.15;
      const vDistFromCenter = Math.abs(rawV - 0.5) * 2; // 0 (center) to 1 (edges)
      const notchOffset = (1 - vDistFromCenter) * tailNotchDepth * uTail;
      posX -= notchOffset;
    }

    pos.setXYZ(i, posX, posY, 0);
    uv.setXY(i, rawU, rawV);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  return geo;
}

function createBannerTextures(text: string, primaryColor: string = "#e11d48") {
  const canvasFront = document.createElement("canvas");
  const canvasBack = document.createElement("canvas");
  canvasFront.width = 2048;
  canvasFront.height = 512;
  canvasBack.width = 2048;
  canvasBack.height = 512;

  const renderSide = (canvas: HTMLCanvasElement, isBack: boolean) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clean gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 2048, 0);
    bgGrad.addColorStop(0, "#ffffff");
    bgGrad.addColorStop(0.7, "#fffcfc");
    bgGrad.addColorStop(1, "#fff0f2");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2048, 512);

    // Aerodynamic Border Stripes
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, 2048, 28);
    ctx.fillRect(0, 484, 2048, 28);

    ctx.fillStyle = "#f59e0b"; // Gold accent trim
    ctx.fillRect(0, 28, 2048, 12);
    ctx.fillRect(0, 472, 2048, 12);

    if (isBack) {
      ctx.translate(2048, 0);
      ctx.scale(-1, 1);
    }

    // Bold, centered typography shifted slightly left to avoid tail cutout
    ctx.font = "900 148px 'Roboto', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillText(text, 960 + 4, 256 + 5);

    // Primary Text Fill
    ctx.fillStyle = primaryColor;
    ctx.fillText(text, 960, 256);
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
  alt = 16,
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
  const frontBannerMeshRef = useRef<THREE.Mesh>(null);
  const backBannerMeshRef = useRef<THREE.Mesh>(null);
  const strobeLightRef = useRef<THREE.PointLight>(null);
  const intro = useRef(0);

  // Geometries
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 18, 18), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  const discGeo = useMemo(() => new THREE.CircleGeometry(2.3, 24), []);
  const bannerGeo = useMemo(() => createBannerShapeGeometry(12.2, 2.35, 48, 6), []);
  const spreaderBarGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 2.0, 10), []);

  const { texFront, texBack } = useMemo(
    () => createBannerTextures(bannerText || "Bryan R. Cañaveral", bannerColor || "#e11d48"),
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
    () => new THREE.MeshBasicMaterial({ map: texFront, side: THREE.FrontSide }),
    [texFront],
  );
  const bannerBackMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texBack, side: THREE.BackSide }),
    [texBack],
  );

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      sphereGeo.dispose();
      cylinderGeo.dispose();
      discGeo.dispose();
      bannerGeo.dispose();
      spreaderBarGeo.dispose();
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
    spreaderBarGeo,
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

    // Flight Orbit Mechanics
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

      const bankEuler = new THREE.Euler(0.08, 0, 0.16, "ZYX");
      quat.multiply(new THREE.Quaternion().setFromEuler(bankEuler));

      heli.quaternion.slerp(quat, 0.15);
      heli.scale.setScalar(Math.max(0.0001, 1.15 * scale));
      heli.visible = scale > 0.02;
    }

    // High Speed Rotor Animations
    if (mainRotorRef.current) mainRotorRef.current.rotation.y += dt * 44;
    if (mainRotorBlurRef.current) mainRotorBlurRef.current.rotation.z += dt * 25;
    if (tailRotorRef.current) tailRotorRef.current.rotation.x += dt * 48;

    if (strobeLightRef.current) {
      strobeLightRef.current.intensity = Math.sin(t * 12) > 0.75 ? 2.5 : 0;
    }

    // Progressive Aerodynamic Flutter
    const posAttr = bannerGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getX(i) / 12.2; // 0 (rigid front) to 1.0 (free tail)
      const primaryWave = Math.sin(t * 7.4 - u * 5.2) * (u * u * 0.34);
      const highFreqRipples = Math.cos(t * 15.0 - u * 11.0) * (u * u * 0.08);
      posAttr.setZ(i, primaryWave + highFreqRipples);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group ref={heliGroup}>
      {/* Fuselage */}
      <mesh geometry={sphereGeo} material={liveryWhiteMat} position={[0, -0.1, 0.4]} scale={[0.68, 0.58, 1.25]} />
      <mesh geometry={sphereGeo} material={liveryColorMat} position={[0, 0.12, 0.35]} scale={[0.72, 0.65, 1.2]} />

      {/* Glass */}
      <mesh
        geometry={sphereGeo}
        material={cockpitGlassMat}
        position={[0, 0.16, 1.05]}
        scale={[0.56, 0.5, 0.58]}
      />

      {/* Turbines */}
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

      {/* Decals & Searchlight */}
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

      {/* Tail Boom & Stabilizers */}
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

      {/* Tail Strobe & Rotor */}
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

      {/* --- Rigged Tow Line & Aerodynamic Swallowtail Banner --- */}
      <group position={[0, -0.22, -2.1]}>
        {/* Upper & Lower Bridle Tow Cables */}
        <mesh
          geometry={cylinderGeo}
          material={cableMat}
          position={[0, -0.15, -1.0]}
          rotation={[0.32, 0, 0]}
          scale={[0.018, 2.15, 0.018]}
        />
        <mesh
          geometry={cylinderGeo}
          material={cableMat}
          position={[0, -0.75, -1.0]}
          rotation={[-0.32, 0, 0]}
          scale={[0.018, 2.15, 0.018]}
        />

        {/* Rigged Spreader Bar */}
        <mesh
          geometry={spreaderBarGeo}
          material={metalMat}
          position={[0, -0.45, -2.0]}
        />

        {/* Trailing Streamer Banner */}
        <group position={[0, -0.45, -2.0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh ref={frontBannerMeshRef} geometry={bannerGeo} material={bannerFrontMat} />
          <mesh ref={backBannerMeshRef} geometry={bannerGeo} material={bannerBackMat} />
        </group>
      </group>
    </group>
  );
}