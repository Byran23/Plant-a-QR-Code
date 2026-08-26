import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { computeZone, type QRGrid } from "../lib/qr";
import type { Palette } from "../lib/palettes";
import { morph } from "./shared";
import Ground from "./Ground";
import Tree from "./Tree";
import Covers from "./Covers";
import Birds from "./Birds";
import Particles from "./Particles";
import Clouds from "./Clouds";

const HALF_PI = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0);

interface RigState {
  az: number;
  el: number;
  dist: number;
  ty: number;
  azT: number;
  elT: number;
  dT: number;
  dragging: boolean;
  moved: number;
  downAt: number;
  px: number;
  py: number;
}

function Rig({
  rig,
  qr,
  total,
  palette,
  hemi,
}: {
  rig: React.MutableRefObject<RigState>;
  qr: boolean;
  total: number;
  palette: Palette;
  hemi: React.RefObject<THREE.HemisphereLight | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const fogTarget = useMemo(() => new THREE.Color(), []);
  const hemiTarget = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    rig.current.dT = 1;
  }, [qr, rig]);

  useFrame((_, rawDt) => {
    const r = rig.current;
    const dt = Math.min(rawDt, 0.05);

    // global tree -> QR morph value (read by every animated child)
    morph.p = THREE.MathUtils.damp(morph.p, qr ? 1 : 0, 2.6, dt);

    if (!qr && !r.dragging) r.azT += dt * 0.055;

    const tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitA = Math.min(1, size.width / Math.max(1, size.height));
    const fitTree = ((total * 0.62) / (tanF * fitA)) * 1.68;
    const fitQR = (total * 0.64) / tanF;

    const distGoal = (qr ? fitQR : fitTree) * r.dT;
    const elGoal = qr ? 1.545 : r.elT;
    const azGoal = qr ? Math.round(r.az / HALF_PI) * HALF_PI : r.azT;

    r.az = THREE.MathUtils.damp(r.az, azGoal, 3.2, dt);
    r.el = THREE.MathUtils.damp(r.el, elGoal, 3.2, dt);
    r.dist = THREE.MathUtils.damp(r.dist, distGoal, 3.2, dt);
    r.ty = THREE.MathUtils.damp(r.ty, qr ? 0 : Math.min(3.2, total * 0.09), 3.2, dt);

    const ce = Math.cos(r.el);
    camera.position.set(
      Math.sin(r.az) * ce * r.dist,
      Math.sin(r.el) * r.dist + r.ty,
      Math.cos(r.az) * ce * r.dist,
    );

    // blend the up-vector toward the camera's horizontal "north" as we go top-down
    const f = THREE.MathUtils.clamp((r.el - 1.25) / (1.545 - 1.25), 0, 1);
    const up = UP.clone().lerp(new THREE.Vector3(-Math.sin(r.az), 0, -Math.cos(r.az)), f * f * (3 - 2 * f));
    camera.up.copy(up.normalize());
    camera.lookAt(0, r.ty, 0);

    // atmosphere follows palette smoothly
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.lerp(fogTarget.set(palette.fog), 1 - Math.exp(-dt * 3));
      fog.near = r.dist * 1.15;
      fog.far = r.dist * 3.4;
    }
    const h = hemi.current;
    if (h) {
      h.color.lerp(hemiTarget.set(palette.hemiSky), 1 - Math.exp(-dt * 3));
      h.groundColor.lerp(hemiTarget.set(palette.hemiGround), 1 - Math.exp(-dt * 3));
    }
  });

  return null;
}

export default function Scene({
  grid,
  palette,
  seed,
  qr,
  onToggle,
}: {
  grid: QRGrid;
  palette: Palette;
  seed: number;
  qr: boolean;
  onToggle: () => void;
}) {
  const rig = useRef<RigState>({
    az: 0.9,
    el: 0.58,
    dist: 60,
    ty: 1.6,
    azT: 0.9,
    elT: 0.58,
    dT: 1,
    dragging: false,
    moved: 0,
    downAt: 0,
    px: 0,
    py: 0,
  });
  const qrRef = useRef(qr);
  const toggleRef = useRef(onToggle);
  qrRef.current = qr;
  toggleRef.current = onToggle;
  const hemi = useRef<THREE.HemisphereLight>(null);

  const zone = useMemo(() => computeZone(grid.size), [grid]);
  const shadowBound = grid.total * 0.8 + 6;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = rig.current;
    r.dragging = true;
    r.moved = 0;
    r.downAt = performance.now();
    r.px = e.clientX;
    r.py = e.clientY;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("scene-grabbing");
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = rig.current;
    if (!r.dragging) return;
    const dx = e.clientX - r.px;
    const dy = e.clientY - r.py;
    r.moved += Math.abs(dx) + Math.abs(dy);
    r.px = e.clientX;
    r.py = e.clientY;
    if (!qrRef.current) {
      r.azT -= dx * 0.0058;
      r.elT = THREE.MathUtils.clamp(r.elT + dy * 0.0042, 0.22, 1.2);
    }
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = rig.current;
    if (!r.dragging) return;
    r.dragging = false;
    e.currentTarget.classList.remove("scene-grabbing");
    if (r.moved < 8 && performance.now() - r.downAt < 450) toggleRef.current();
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const r = rig.current;
    r.dT = THREE.MathUtils.clamp(r.dT * (1 + e.deltaY * 0.0009), 0.62, 1.9);
  };

  return (
    <div
      className="scene-grab absolute inset-0 z-10 focus:outline-none"
      role="button"
      aria-label={qr ? "QR code view — press Enter to regrow the tree" : "3D tree — press Enter to reveal the QR code"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") toggleRef.current();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onWheel={onWheel}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.5, far: 4000, position: [40, 32, 40] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.06;
        }}
      >
        <Rig rig={rig} qr={qr} total={grid.total} palette={palette} hemi={hemi} />
        <fog attach="fog" args={[palette.fog, 70, 320]} />

        <hemisphereLight ref={hemi} args={[palette.hemiSky, palette.hemiGround, 1.05]} />
        <directionalLight
          position={[grid.total * 0.7, grid.total * 1.1, grid.total * 0.42]}
          intensity={2.4}
          color={palette.sun}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-shadowBound}
          shadow-camera-right={shadowBound}
          shadow-camera-top={shadowBound}
          shadow-camera-bottom={-shadowBound}
          shadow-camera-near={1}
          shadow-camera-far={shadowBound * 5}
          shadow-bias={-0.00055}
        />
        <directionalLight
          position={[-grid.total * 0.6, grid.total * 0.35, -grid.total * 0.55]}
          intensity={0.5}
          color="#cfe2ff"
        />

        <Ground grid={grid} palette={palette} seed={seed} />
        <Covers grid={grid} zone={zone} palette={palette} seed={seed} />
        <Tree seed={seed} palette={palette} grid={grid} zone={zone} />
        <Birds
          orbit={Math.min(zone.n * 0.6 + 3.5, grid.total * 0.42)}
          alt={9 + zone.n * 0.25}
        />
        <Particles palette={palette} spread={grid.total * 0.52} top={grid.total * 0.52 + 5} />
        <Clouds total={grid.total} />
      </Canvas>
    </div>
  );
}
