import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { QRGrid } from "../lib/qr";
import type { Palette } from "../lib/palettes";
import { mulberry32, pickIndex } from "../lib/random";
import { morph, clamp01, easeOutBack, smooth01 } from "./shared";

interface Tile {
  x: number;
  z: number;
  h: number;
  delay: number;
  base: THREE.Color;
  flat: THREE.Color;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

/**
 * The meadow. In tree mode every tile is grass — the QR pattern is carried
 * entirely by the tree canopy and the garden cover objects, so the code is
 * invisible until the scene flattens (tiles still flip to module-true
 * black/white underneath, guaranteeing a perfect scan).
 */
export default function Ground({
  grid,
  palette,
  seed,
}: {
  grid: QRGrid;
  palette: Palette;
  seed: number;
}) {
  const total = grid.total;
  const count = total * total;
  const half = (total - 1) / 2;

  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.085), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  const mesh = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ intro: 0, lastP: -1, dirty: true });

  const tiles = useMemo<Tile[]>(() => {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const arr: Tile[] = [];
    const grassPool = palette.grass.map((c) => new THREE.Color(c));
    const flatDark = new THREE.Color(palette.qrDark);
    const flatLight = new THREE.Color(palette.qrLight);
    for (let r = 0; r < total; r++) {
      for (let c = 0; c < total; c++) {
        const x = c - half;
        const z = r - half;
        const isDark = grid.data[r * total + c] === 1;
        const base = grassPool[pickIndex(rng, grassPool.length)].clone();
        // organic quilting so the meadow reads as handcrafted, not a barcode
        const quilt = (r + c) % 2 === 0 ? 0.012 : -0.02;
        base.offsetHSL(0, 0, quilt + (rng() - 0.5) * 0.045);
        arr.push({
          x,
          z,
          h: 0.5 + rng() * 0.16,
          delay: (Math.hypot(x, z) / Math.max(1, half * 1.42)) * 0.55,
          base,
          flat: isDark ? flatDark : flatLight,
        });
      }
    }
    return arr;
  }, [grid, palette, seed, total, half]);

  useEffect(() => {
    st.current.dirty = true;
  }, [tiles]);

  useFrame((_, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.05);
    s.intro = Math.min(1, s.intro + dt * 0.85);
    const p = morph.p;
    if (!s.dirty && Math.abs(p - s.lastP) < 0.0004 && s.intro >= 1) return;
    s.dirty = false;
    s.lastP = p;
    const m = mesh.current;
    if (!m) return;
    const q = smooth01(p);
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const grow = easeOutBack((s.intro * 1.55 - t.delay) / 0.55);
      const organic = t.h * grow;
      const sy = Math.max(0.02, organic * (1 - q) + 0.14 * q);
      const sxz = 0.94 * clamp01(grow * 1.4 + q * 2);
      tmp.position.set(t.x, sy / 2, t.z);
      tmp.scale.set(sxz, sy, sxz);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      col.copy(t.base).lerp(t.flat, q);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        key={count}
        ref={mesh}
        args={[geo, mat, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
        dispose={null}
      />
      {/* diorama base plate */}
      <mesh
        geometry={geo}
        position={[0, -0.42, 0]}
        scale={[total + 2.6, 0.85, total + 2.6]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.soil} roughness={0.95} />
      </mesh>
    </group>
  );
}
