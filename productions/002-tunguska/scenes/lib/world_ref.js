// Tunguska "reference_v1" look (visual-reference pack frames 01-07). Only scenes rendered with params.look ===
// 'reference_v1' use this module's builders; the original look is untouched.
import * as THREE from 'three';
import { valueNoise } from 'oddlight/nature.js';
import { fireballCore } from 'oddlight/cinema.js';
import { fireball } from './world.js';

export const isRefLook = (params) => params && params.look === 'reference_v1';

// palettes sampled in the reference metadata (dominant_colors) — used for fog / tints, never as flat fills
export const REF = {
  wilderness: { fog: '#82868b', mist: '#c7c9cb', cloud: '#c7bdae', cloudShade: '#545855' },      // frame 01
  cabin: { fog: '#888e90', mist: '#cfd2d2' },                                                          // frame 02
  flash: { light: '#cfe4ff', halo: [[0, 'rgba(244,250,255,1)'], [0.25, 'rgba(176,204,255,0.85)'], [0.6, 'rgba(117,141,175,0.3)'], [1, 'rgba(117,141,175,0)']] }, // frame 03
  fireball: { warm: '#9f7b64', sky: '#4c4c55' },                                                      // frame 04
  shock: { dust: 'rgba(194,185,172,', fog: '#9c978e' },                                               // frame 05
  flattened: { fog: '#999ea6', cloud: '#999ea6', cloudShade: '#5d5953' },                            // frame 06
  aftermath: { fog: '#7b808b', cloud: '#acb1b9', cloudShade: '#5c5a5e' },                            // frame 07
};

// ---------- hero fireball: the existing fireball() trail/smoke + a granular incandescent core ----------
export function fireballRef(scene, opts = {}) {
  const fb = fireball(scene, { ...opts, trail: (opts.trail || 40) + 20, smoke: (opts.smoke || 60) + 30 });
  const core = fireballCore(opts.size || 10);
  scene.add(core.group);
  return { ...fb, place(path, t, o = {}) {
    const p = fb.place(path, t, { ...o, spacing: (o.spacing ?? 0.035) * 0.85 });
    core.group.position.copy(p); core.group.visible = (o.intensity ?? 1) > 0.05; core.update(t);
    return p;
  } };
}

// ---------- weathered period homestead (frame 02): grey hand-hewn logs, shingles, stone chimney, woodpile ----------
export function cabinRef() {
  const g = new THREE.Group();
  const logGeo = new THREE.CylinderGeometry(0.33, 0.35, 1, 10, 3);
  const paintLog = (len, seed) => { const geo = logGeo.clone(); geo.scale(1, len, 1); const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3);
    const base = new THREE.Color('#6d655b').lerp(new THREE.Color('#4e463d'), valueNoise(seed, 1, 3));
    for (let i = 0; i < n; i++) { const v = 0.78 + 0.42 * valueNoise(p.getY(i) * 9 + seed, Math.atan2(p.getZ(i), p.getX(i)) * 3, 5); a[i * 3] = base.r * v; a[i * 3 + 1] = base.g * v; a[i * 3 + 2] = base.b * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const logMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const W = 9, D = 7, H = 4.2, r = 0.33;
  let seed = 0;
  for (let k = 0; k < Math.round(H / (2 * r)); k++) {
    const y = r + k * 2 * r;
    for (const [len, x, z, rot] of [[W + 1.4, 0, D / 2, 0], [W + 1.4, 0, -D / 2, 0], [D + 1.4, W / 2, 0, Math.PI / 2], [D + 1.4, -W / 2, 0, Math.PI / 2]]) {
      const l = new THREE.Mesh(paintLog(len, seed++), logMat);
      l.rotation.z = Math.PI / 2; l.rotation.y = rot; l.position.set(x, y + (rot ? r : 0), z); l.castShadow = true; l.receiveShadow = true; g.add(l);
    }
  }
  // shingle roof: rows of thin overlapping boards with tonal variation
  const shingleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const rows = 9, roofLen = W + 2.2, slope = D * 0.62 + 0.8;
  for (const s of [1, -1]) {
    const roof = new THREE.Group();
    for (let i = 0; i < rows; i++) {
      const b = new THREE.BoxGeometry(roofLen, 0.06, slope / rows + 0.18, 24, 1, 1);
      const p = b.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let j = 0; j < p.count; j++) { const v = valueNoise(Math.floor((p.getX(j) + roofLen) * 2.2), i * 7 + s, 8); c.set('#8a8177').lerp(new THREE.Color('#5f574e'), v); a[j * 3] = c.r; a[j * 3 + 1] = c.g; a[j * 3 + 2] = c.b; }
      b.setAttribute('color', new THREE.BufferAttribute(a, 3));
      const m = new THREE.Mesh(b, shingleMat); m.position.set(0, i * 0.02, -slope / 2 + (i + 0.5) * slope / rows); m.castShadow = true; m.receiveShadow = true; roof.add(m);
    }
    roof.rotation.x = s > 0 ? 0.62 : -0.62; roof.rotation.y = s > 0 ? 0 : Math.PI;
    roof.position.set(0, H + 1.5, s * D * 0.27); g.add(roof);
  }
  const gable = new THREE.Shape(); gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, 2.5);
  const gMat = new THREE.MeshStandardMaterial({ color: '#5d564d', roughness: 0.95, side: THREE.DoubleSide });
  for (const x of [W / 2 + 0.3, -W / 2 - 0.3]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), gMat); m.rotation.y = Math.PI / 2; m.position.set(x, H, 0); g.add(m); }
  // stone/clay chimney
  const stone = new THREE.MeshStandardMaterial({ color: '#6b6660', roughness: 1 });
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.0 - k * 0.04, 0.42, 1.0 - k * 0.04), stone); b.position.set(-2.8, H + 1.3 + k * 0.42, -1); b.rotation.y = k * 0.07; b.castShadow = true; g.add(b); }
  // small windows with a warm lamp (the single warm light of the shot) and plank door
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(1.8) }));
  win.position.set(1.6, 2.2, D / 2 + 0.36); g.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3b342d', roughness: 0.9 });
  for (const [w, h, x, y] of [[1.4, 0.12, 1.6, 2.7], [1.4, 0.12, 1.6, 1.7], [0.12, 1.1, 1.0, 2.2], [0.12, 1.1, 2.2, 2.2], [0.08, 0.9, 1.6, 2.2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frameMat); m.position.set(x, y, D / 2 + 0.38); g.add(m);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: '#4a4138', roughness: 0.9 })); door.position.set(-2, 1.2, D / 2 + 0.36); g.add(door);
  // woodpile against the gable wall
  const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9 - row; i++) {
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 1.1, 7); const p = geo.attributes.position, a = new Float32Array(p.count * 3);
    for (let j = 0; j < p.count; j++) { const end = Math.abs(p.getY(j)) > 0.5 && Math.hypot(p.getX(j), p.getZ(j)) < 0.16; const c = new THREE.Color(end ? '#b29a77' : '#5a4e42'); a[j * 3] = c.r; a[j * 3 + 1] = c.g; a[j * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    const m = new THREE.Mesh(geo, wood); m.rotation.x = Math.PI / 2; m.position.set(-W / 2 - 0.9, 0.2 + row * 0.32, -2.2 + i * 0.36 + row * 0.18); m.castShadow = true; g.add(m);
  }
  const lamp = new THREE.PointLight('#ffa050', 16, 14, 1.6); lamp.position.set(1.6, 2.2, D / 2 + 1.2); g.add(lamp);
  return { group: g, lamp, window: win };
}
