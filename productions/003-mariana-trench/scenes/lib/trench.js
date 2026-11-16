// Illustrative Mariana Trench relief (metres, y = -depth). NOT survey data: a smooth V-shaped trench along z with the
// deepest point (Challenger Deep, 10,935 m) at the origin, a shallower arc side (west, x<0), the Pacific plate with
// faint horst-and-graben ridges (east, x>0) and fbm detail. Horizontal distances are compressed ~3x (vertical
// exaggeration) so the trench reads as a trench in a vertical frame.
import * as THREE from 'three';
import { fbm } from 'oddlight/nature.js';

export const DEEPEST = 10935;
const W_WEST = 11000, W_EAST = 14000, FLAT = 1900;

export function axisDepth(z) {
  const a = Math.abs(z);
  return DEEPEST - 1500 * THREE.MathUtils.smoothstep(a, 0, 36000) - 140 * (1 - Math.exp(-((z / 2600) ** 2)))
    + 60 * Math.sin(z / 3100) * THREE.MathUtils.smoothstep(a, 2500, 9000) - 60 * THREE.MathUtils.smoothstep(a, 2500, 9000);
}

export function depthAt(x, z) {
  const axis = axisDepth(z);
  const west = x < 0;
  const u = Math.min(Math.max(0, Math.abs(x) - FLAT) / ((west ? W_WEST : W_EAST) - FLAT), 1);   // flat floor |x| < FLAT
  const plain = west ? 4300 - 1200 * THREE.MathUtils.smoothstep(-x, W_WEST, W_WEST * 3.5)          // arc side shoals westward
    : 5900 + 220 * Math.sin(x / 2300) * THREE.MathUtils.smoothstep(x, W_EAST * 0.7, W_EAST * 1.3);   // Pacific plate ridges
  const f = 1 - (1 - u) ** 2;                       // steep near the axis, flattening outward
  let d = axis + (plain - axis) * f;
  const r = Math.hypot(x, z);
  d += 180 * fbm(x / 5200, z / 5200, { seed: 3, octaves: 5 }) * THREE.MathUtils.smoothstep(r, 600, 4000);
  d += 40 * fbm(x / 900, z / 900, { seed: 8, octaves: 3 }) * THREE.MathUtils.smoothstep(r, 300, 2500);
  return Math.min(d, DEEPEST - 30 * THREE.MathUtils.smoothstep(r, 0, 1500));   // the origin stays the deepest point
}

export const heightAt = (x, z) => -depthAt(x, z);

// fine sediment relief for the close-up floor patch around the landing site (metres)
export const floorDetail = (x, z) => 0.5 * fbm(x / 6, z / 6, { seed: 21, octaves: 4 }) + 1.6 * fbm(x / 45, z / 45, { seed: 22, octaves: 3 });

export function terrainGeometry({ size = 90000, seg = 360, cx = 0, cz = 0, h = heightAt } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, h(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  return g;
}
