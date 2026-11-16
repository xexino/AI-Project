// Tunguska world (project-specific): terrain, epicentre, the butterfly-shaped fall zone, forests before/after,
// fireball, homestead and expedition camp. Scale: 1 unit ≈ a few metres; stylised, not to geographic scale.
import * as THREE from 'three';
import { fbm, valueNoise, makeTerrain, makeSky, makeForest, coniferGeometry, sunLight, skyEnvironment, glowTexture } from 'oddlight/nature.js';

export const EPI = new THREE.Vector2(0, 0);
export const BOG_R = 55, STAND_R = 105;
export const flatRadius = (theta) => 430 * (1 + 0.24 * Math.cos(2 * (theta - 0.6)) + 0.06 * Math.sin(5 * theta));

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = fbm(x * 0.0025, z * 0.0025, { seed: 3, octaves: 4 }) * 38 + fbm(x * 0.012, z * 0.012, { seed: 8, octaves: 3 }) * 6;
  const bog = THREE.MathUtils.smoothstep(r, BOG_R * 0.6, BOG_R * 2.2);  // ground zero is a flat marsh basin
  return THREE.MathUtils.lerp(-3, h, bog);
}

const C = (h) => new THREE.Color(h);
export function terrainColor(snow = 0, scorch = 0) {
  const moss = C('#3f4230'), earth = C('#4d4030'), bog = C('#34402f'), snowC = C('#e8eef2'), burnt = C('#2a2620');
  return (x, y, z, ny, c) => {
    const n = fbm(x * 0.04, z * 0.04, { seed: 4, octaves: 3 });
    c.copy(moss).lerp(earth, THREE.MathUtils.clamp(0.5 + n, 0, 1) * 0.6);
    const r = Math.hypot(x, z);
    if (r < BOG_R * 1.6) c.lerp(bog, 1 - THREE.MathUtils.smoothstep(r, BOG_R * 0.7, BOG_R * 1.6));
    if (scorch > 0) { const lim = flatRadius(Math.atan2(z, x)); c.lerp(burnt, scorch * (1 - THREE.MathUtils.smoothstep(r, lim - 30, lim + 50)) * (0.75 + 0.25 * n)); }
    if (snow > 0) c.lerp(snowC, THREE.MathUtils.clamp(snow * (0.75 + 0.5 * ny) + n * 0.2, 0, 1));
    return c;
  };
}

export function world({ renderer, size = 1800, segments = 300, skyEl = 4, skyAz = 120, fog = 0.0016, fogColor = '#c4b3a0', snow = 0, scorch = 0, env = true, envIntensity = 0.45, heightFn = heightAt } = {}) {
  const scene = new THREE.Scene();
  const sk = makeSky({ elevation: skyEl, azimuth: skyAz }); scene.add(sk.sky);
  if (env) { scene.environment = skyEnvironment(renderer, sk.sky); scene.environmentIntensity = envIntensity; }
  scene.fog = new THREE.FogExp2(fogColor, fog);
  const ground = makeTerrain({ size, segments, heightFn, colorFn: terrainColor(snow, scorch) });
  scene.add(ground);
  return { scene, sky: sk, ground };
}

// deterministic tree list in a window [x0,x1]x[z0,z1]
export function treesIn({ x0, x1, z0, z1, spacing = 4, seed = 7, keep = () => true, scale = [11, 20] }) {
  const out = [];
  for (let x = x0; x < x1; x += spacing) for (let z = z0; z < z1; z += spacing) {
    const jx = (valueNoise(x * 3.1, z * 1.7, seed) - 0.5) * spacing * 0.95, jz = (valueNoise(z * 2.3, x * 2.9, seed + 1) - 0.5) * spacing * 0.95;
    const px = x + jx, pz = z + jz;
    if (valueNoise(px * 0.02, pz * 0.02, seed + 9) < 0.27) continue;          // natural clearings
    if (!keep(px, pz)) continue;
    const k = valueNoise(px * 7.7, pz * 5.3, seed + 3);
    out.push({ x: px, z: pz, s: scale[0] + k * (scale[1] - scale[0]), rot: valueNoise(pz * 4.1, px * 6.3, seed + 4) * 6.283, tint: valueNoise(px * 9.1, pz * 8.7, seed + 5) });
  }
  return out;
}

export const theta = (x, z) => Math.atan2(z - EPI.y, x - EPI.x);
export const inFallZone = (x, z) => { const r = Math.hypot(x, z); return r > STAND_R && r < flatRadius(theta(x, z)); };
export const inStandZone = (x, z) => Math.hypot(x, z) <= STAND_R && Math.hypot(x, z) > BOG_R * 0.7;

// fallen-ness for a shockwave of radius R (0 = standing, 1 = flat); trees fall away from the epicentre
export function fallState(R, softness = 30) {
  return (i, t) => {
    const r = Math.hypot(t.x, t.z);
    if (r <= STAND_R) return null;
    const lim = flatRadius(theta(t.x, t.z));
    if (r > lim + 40) return null;
    const edge = THREE.MathUtils.smoothstep(r, lim - 40, lim + 40);          // partial damage near the edge
    const f = THREE.MathUtils.clamp((R - r) / softness, 0, 1) * (1 - edge * 0.85);
    return f > 0 ? { fall: f, dir: theta(t.x, t.z) } : null;
  };
}

export const geo = {
  living: (lod = 0) => coniferGeometry(lod === 0 ? { tiers: 7, segs: 8 } : lod === 1 ? { tiers: 4, segs: 6 } : { tiers: 2, segs: 5 }),
  dead: () => coniferGeometry({ stripped: true, trunk: 0.03 }),
};

export function deadMaterial(snow = 0) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: new THREE.Color('#9a8a7a').lerp(new THREE.Color('#ffffff'), snow) });
}

// ---------- fireball: core, glow, hot trail and smoke trail ----------
export function fireball(scene, { size = 6, trail = 40, smoke = 60 } = {}) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.35, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d8').multiplyScalar(4), fog: false }));
  const glowT = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.scale.setScalar(size * 9); g.add(core, glow);
  scene.add(g);
  const hot = [], sm = [];
  const smokeT = glowTexture([[0, 'rgba(120,110,100,0.55)'], [0.5, 'rgba(110,100,92,0.25)'], [1, 'rgba(100,95,90,0)']], 128);
  for (let i = 0; i < trail; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); scene.add(s); hot.push(s); }
  for (let i = 0; i < smoke; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, depthWrite: false, transparent: true })); scene.add(s); sm.push(s); }
  // path(t) -> Vector3 ; place head at time t with trail behind it
  return { group: g, place(path, t, { intensity = 1, spacing = 0.035, smokeSpacing = 0.06 } = {}) {
    const p = path(t); g.position.copy(p);
    glow.material.opacity = intensity; core.visible = intensity > 0.05;
    glow.scale.setScalar(size * 9 * (0.85 + 0.15 * Math.sin(t * 23)));
    hot.forEach((s, i) => { const q = path(t - (i + 1) * spacing); s.position.copy(q); const k = 1 - i / hot.length; s.scale.setScalar(size * 5 * k + 1); s.material.opacity = 0.55 * k * k * intensity; });
    sm.forEach((s, i) => { const q = path(t - (i + 2) * smokeSpacing); s.position.copy(q); const k = 1 - i / sm.length; s.scale.setScalar(size * (2.5 + (1 - k) * 9)); s.material.opacity = 0.45 * k * Math.min(1, intensity * 3); });
    return p;
  } };
}

// ---------- homestead (log cabin) ----------
export function cabin({ logColor = '#5b4330', roofColor = '#3a2c22' } = {}) {
  const g = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({ color: logColor, roughness: 0.9 });
  const W = 9, D = 7, H = 4.2, r = 0.32;
  for (let k = 0; k < Math.round(H / (2 * r)); k++) {
    const y = r + k * 2 * r;
    for (const [len, x, z, rot] of [[W + 1.2, 0, D / 2, 0], [W + 1.2, 0, -D / 2, 0], [D + 1.2, W / 2, 0, Math.PI / 2], [D + 1.2, -W / 2, 0, Math.PI / 2]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 10), logMat);
      l.rotation.z = Math.PI / 2; l.rotation.y = rot; l.position.set(x, y + (rot ? r : 0), z); l.castShadow = true; l.receiveShadow = true; g.add(l);
    }
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, D * 0.62 + 0.6), roofMat);
    p.rotation.x = -Math.PI / 2 + s * 0.62; p.position.set(0, H + 1.55, s * D * 0.27); p.castShadow = true; g.add(p);
  }
  const gable = new THREE.Shape(); gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, 2.5);
  for (const x of [W / 2, -W / 2]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), logMat); m.rotation.y = Math.PI / 2; m.position.set(x, H, 0); g.add(m); }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(2.2) }));
  win.position.set(1.6, 2.2, D / 2 + 0.36); g.add(win);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.1), new THREE.MeshStandardMaterial({ color: '#2a2018' })); frame.position.set(1.6, 2.2, D / 2 + 0.3); g.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.8 })); door.position.set(-2, 1.2, D / 2 + 0.36); g.add(door);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.95 })); chim.position.set(-2.8, H + 2.2, -1); chim.castShadow = true; g.add(chim);
  const lamp = new THREE.PointLight('#ffa050', 30, 18, 1.6); lamp.position.set(1.6, 2.2, D / 2 + 1.2); g.add(lamp);
  return { group: g, lamp, window: win };
}

// ---------- expedition camp: canvas tent + lantern ----------
export function camp() {
  const g = new THREE.Group();
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.2, 4, 1), new THREE.MeshStandardMaterial({ color: '#b9ab8e', roughness: 0.9 }));
  tent.rotation.y = Math.PI / 4; tent.position.y = 1.6; tent.castShadow = true; g.add(tent);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc070').multiplyScalar(3) }));
  lantern.position.set(2.6, 1.0, 1.4); g.add(lantern);
  const light = new THREE.PointLight('#ffa050', 40, 25, 1.5); light.position.copy(lantern.position); g.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(4); halo.position.copy(lantern.position); g.add(halo);
  return { group: g, light, halo };
}

export { makeForest, sunLight };
