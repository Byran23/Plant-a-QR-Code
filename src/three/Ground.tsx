import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
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

// Stone patio tints for 3D ground mode
const STONE_PATIO_COLORS = [
  "#ede7de",
  "#e3ddd2",
  "#f4eee4",
  "#dad3c6",
  "#ede6db",
];

// Fallback outer grass module colors
const GARDEN_GREEN_MODULES = [
  "#529134",
  "#46822b",
  "#5a9d3a",
];

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

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }),
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

    const stonePool = STONE_PATIO_COLORS.map((c) => new THREE.Color(c));
    const grassPool = (palette.grass?.length ? palette.grass : GARDEN_GREEN_MODULES).map(
      (c) => new THREE.Color(c),
    );

    // Flattened QR colors
    const flatBlossomDark = new THREE.Color(palette.qrDark || "#d64f64");
    const flatGardenDark = new THREE.Color(palette.finderDark || "#529134");
    const flatLight = new THREE.Color(palette.qrLight || "#f4efe6");

    // Center zone radius threshold (tree footprint)
    const centerRadius = Math.max(3, Math.floor(grid.size * 0.32));

    for (let r = 0; r < total; r++) {
      for (let c = 0; c < total; c++) {
        const x = c - half;
        const z = r - half;
        const distFromCenter = Math.hypot(x, z);
        const isDark = grid.data[r * total + c] === 1;

        // 3D Tree Mode Tile Appearance
        let base: THREE.Color;
        if (distFromCenter < half - 1.8) {
          base = stonePool[pickIndex(rng, stonePool.length)].clone();
        } else {
          base = grassPool[pickIndex(rng, grassPool.length)].clone();
          base.offsetHSL(0, 0, (rng() - 0.5) * 0.03);
        }

        // Flattened QR Mode Color Assignment
        let flatColor: THREE.Color;
        if (isDark) {
          flatColor = distFromCenter <= centerRadius ? flatBlossomDark : flatGardenDark;
        } else {
          flatColor = flatLight;
        }

        arr.push({
          x,
          z,
          h: 0.28 + (distFromCenter > half - 2 ? rng() * 0.12 : 0),
          delay: (distFromCenter / Math.max(1, half * 1.42)) * 0.55,
          base,
          flat: flatColor,
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
    const p = morph?.p ?? 0;
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

      // Seamless tile width: 1.002 in flat QR mode (q = 1) eliminates subpixel grid seams
      const sxz = clamp01(grow * 1.4) * (0.96 * (1 - q) + 1.002 * q);

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
      />
      {/* Diorama base border */}
      <mesh
        geometry={geo}
        position={[0, -0.42, 0]}
        scale={[total + 2.2, 0.82, total + 2.2]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.soil || "#cfc8bc"} roughness={0.95} />
      </mesh>
    </group>
  );
}