import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Palette } from "../lib/palettes";
import { mulberry32, pickIndex } from "../lib/random";
import { morph } from "./shared";

interface Particle {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  sway: number;
  size: number;
  spin: number;
  ci: number;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

export default function Particles({
  palette,
  spread,
  top,
}: {
  palette: Palette;
  spread: number;
  top: number;
}) {
  const { kind, colors, count } = palette.particle;

  const particles = useMemo<Particle[]>(() => {
    const rng = mulberry32(0xc0ffee ^ count * 131);
    return Array.from({ length: count }, () => ({
      x: (rng() * 2 - 1) * spread,
      y: rng() * top,
      z: (rng() * 2 - 1) * spread,
      phase: rng() * Math.PI * 2,
      speed: 0.55 + rng() * 0.9,
      sway: 0.35 + rng() * 0.75,
      size: 0.16 + rng() * 0.22,
      spin: (rng() - 0.5) * 2.4,
      ci: pickIndex(rng, colors.length),
    }));
  }, [count, colors.length, spread, top, kind]);

  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.42), []);
  const mat = useMemo(() => {
    if (kind === "firefly") {
      return new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    }
    return new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.95,
      roughness: 0.6,
    });
  }, [kind]);

  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < particles.length; i++) {
      col.set(colors[particles[i].ci]);
      m.setColorAt(i, col);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [particles, colors]);

  useFrame((state, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const q = morph.p * morph.p * (3 - 2 * morph.p);
    const vis = 1 - q;
    const fade =
      kind === "firefly"
        ? vis * (0.5 + 0.45 * Math.sin(t * 2.1))
        : vis * (kind === "snow" ? 0.85 : 0.95);
    mat.opacity = fade;
    m.visible = fade > 0.02;
    if (!m.visible) return;

    const fall = kind === "snow" ? 0.55 : kind === "petal" ? 0.85 : 0.7;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (kind === "firefly") {
        p.x += Math.sin(t * 0.6 + p.phase) * dt * p.sway;
        p.z += Math.cos(t * 0.5 + p.phase * 1.3) * dt * p.sway;
        p.y += Math.sin(t * 0.8 + p.phase * 2.1) * dt * 0.4;
        if (p.y < 1) p.y = 1;
        if (p.y > top * 0.7) p.y = top * 0.7;
        if (Math.abs(p.x) > spread) p.x *= 0.98;
        if (Math.abs(p.z) > spread) p.z *= 0.98;
      } else {
        p.y -= p.speed * fall * dt;
        p.x += Math.sin(t * (kind === "snow" ? 0.9 : 1.4) + p.phase) * dt * p.sway;
        p.z += Math.cos(t * 1.1 + p.phase) * dt * p.sway * 0.7;
        if (p.y < 0.15) {
          p.y = top * (0.85 + ((i * 37) % 100) / 400);
          p.x = Math.sin(p.phase * 91.7 + t) * spread * 0.9;
          p.z = Math.cos(p.phase * 57.3 + t * 0.7) * spread * 0.9;
        }
      }
      const pulse = kind === "firefly" ? 0.65 + 0.35 * Math.sin(t * 3 + p.phase) : 1;
      tmp.position.set(p.x, p.y, p.z);
      if (kind === "petal" || kind === "leaf") {
        tmp.rotation.set(t * p.spin, p.phase + t * 0.6, 0);
        tmp.scale.set(p.size * pulse, p.size * 0.35 * pulse, p.size * 1.35 * pulse);
      } else {
        tmp.rotation.set(0, 0, 0);
        tmp.scale.setScalar(p.size * pulse);
      }
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={kind + count}
      ref={mesh}
      args={[geo, mat, particles.length]}
      frustumCulled={false}
      dispose={null}
    />
  );
}
