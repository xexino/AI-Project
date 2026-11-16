// ODDLIGHT cinematic kit (generic, reusable across productions; deterministic, no textures from disk).
// Added for the visual-reference system (Tunguska reference pack, frames 01-07): layered valley mist, textured
// cloud decks, slender spruce variants, fallen trees with upturned root plates, advancing dust walls, smoke and
// a textured incandescent fireball core. Everything is opt-in; existing scenes are unaffected unless they import this.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { valueNoise, fbm, glowTexture, makeForest } from 'oddlight/nature.js';

// ---------- procedural canvas textures ----------
export function noiseTexture({ size = 256, seed = 1, scale = 4, octaves = 5, contrast = 1.8, threshold = 0.45, rgb = [255, 255, 255],
  edgeFade = 0.12, repeat = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = 0.5 + fbm(x / size * scale, y / size * scale, { seed, octaves });
    let a = Math.min(1, Math.max(0, (n - threshold) * contrast));
    if (edgeFade > 0) {                                     // fade towards the borders so planes have no hard edge
      const e = Math.min(x, y, size - 1 - x, size - 1 - y) / (size * edgeFade);
      a *= Math.min(1, e);
    }
    const i = (y * size + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

// ---------- cloud deck: two drifting textured layers seen from below (overcast / broken cloud) ----------
export function cloudDeck(scene, { y = 700, size = 9000, color = '#c3c7cd', shade = '#80858d', coverage = 0.5, seed = 3, center = [0, 0], opacity = 1, fog = true } = {}) {
  const g = new THREE.Group(); const layers = [];
  [[color, 0, 1.0], [shade, 60, 0.8]].forEach(([col, dy, op], k) => {
    const tex = noiseTexture({ size: 512, seed: seed + k * 13, scale: 7 + k * 3, threshold: 0.62 - coverage * 0.5, contrast: 2.2, edgeFade: 0.2 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: opacity * op,
      depthWrite: false, side: THREE.DoubleSide, fog }));
    m.rotation.x = Math.PI / 2; m.position.set(center[0], y + dy, center[1]); m.renderOrder = -1; g.add(m); layers.push(m);
  });
  scene.add(g);
  return { group: g, update(t) { layers.forEach((m, k) => { m.material.map.offset.set(t * 0.0018 * (k + 1), t * 0.0009); }); } };
}

// ---------- layered valley mist: horizontal sheets at fixed heights; hills poke through, valleys fill ----------
export function mistBands(scene, { levels = [0, 6, 12], area = 2400, center = [0, 0], color = '#c9ccd0', opacity = 0.55, seed = 7, drift = 0.6 } = {}) {
  const sheets = levels.map((y, k) => {
    const tex = noiseTexture({ size: 512, seed: seed + k * 31, scale: 5 + k, threshold: 0.38 + k * 0.05, contrast: 1.6, edgeFade: 0.25 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(area, area), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true,
      opacity: opacity * (1 - k * 0.22), depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(center[0], y, center[1]); scene.add(m); return m;
  });
  return { sheets, update(t) { sheets.forEach((m, k) => m.material.map.offset.set(t * 0.002 * drift * (k + 1), -t * 0.001 * drift)); } };
}

// ---------- slender spruce (Picea obovata silhouette): many short drooping, ragged tiers and a spire ----------
export function spruceGeometry({ height = 1, tiers = 11, radius = 0.15, trunk = 0.018, segs = 8, seed = 1, droop = 0.4 } = {}) {
  const parts = [];
  const bark = new THREE.Color('#4a3f35'), dark = new THREE.Color('#1a261d'), light = new THREE.Color('#2f3f2c');
  const paint = (geo, col, jitter = 0.3) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3), p = geo.attributes.position;
    for (let i = 0; i < n; i++) { const v = 1 - jitter / 2 + jitter * valueNoise(p.getX(i) * 53 + i * 0.13, p.getY(i) * 41, seed + 5); a[i * 3] = col.r * v; a[i * 3 + 1] = col.g * v; a[i * 3 + 2] = col.b * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const t = new THREE.CylinderGeometry(trunk * 0.5, trunk, height * 0.9, 5, 1, true); t.translate(0, height * 0.45, 0); parts.push(paint(t, bark, 0.2));
  for (let k = 0; k < tiers; k++) {
    const f = k / (tiers - 1);
    const r = radius * (1 - Math.pow(f, 0.85) * 0.93) * (0.85 + 0.3 * valueNoise(k * 3.7, seed, seed));
    const hh = height * (0.16 - f * 0.06);
    const c = new THREE.ConeGeometry(r, hh, segs, 2, true);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < hh / 2 - 1e-4) {                                // ragged, drooping skirt
        const ang = Math.atan2(p.getZ(i), p.getX(i));
        const j = 0.7 + 0.6 * valueNoise(ang * 2.3 + k * 7.1, k * 1.9, seed);
        p.setX(i, p.getX(i) * j); p.setZ(i, p.getZ(i) * j); p.setY(i, y - droop * hh * j * (y < -hh / 2 + 1e-4 ? 1 : 0.4));
      }
    }
    c.rotateY(valueNoise(k, seed, 2) * 6.28);
    c.translate(0, height * (0.18 + f * 0.74), 0);
    parts.push(paint(c, dark.clone().lerp(light, 0.25 + 0.5 * f + 0.25 * valueNoise(k, seed, 9))));
  }
  const spire = new THREE.ConeGeometry(radius * 0.08, height * 0.12, 5, 1, true); spire.translate(0, height * 0.99, 0); parts.push(paint(spire, light));
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed())); g.computeVertexNormals();
  return g;
}

// forest made of several spruce variants (reduces visible repetition); same API as makeForest: {meshes, update(stateFn)}
export function makeSpruceForest(trees, { heightAt, variants = 3, lod = 0, material, castShadow = true } = {}) {
  const spec = lod === 0 ? { tiers: 12, segs: 8 } : lod === 1 ? { tiers: 8, segs: 6 } : { tiers: 5, segs: 5 };
  const groups = Array.from({ length: variants }, () => []);
  trees.forEach((t, i) => groups[Math.floor(valueNoise(t.x * 0.37, t.z * 0.41, 77) * variants) % variants].push(t));
  material = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const forests = groups.map((g, k) => makeForest(g, { heightAt, material,
    geometry: spruceGeometry({ ...spec, seed: 11 + k * 17, radius: 0.13 + 0.03 * k, droop: 0.3 + 0.1 * k }) }));
  forests.forEach((f) => { f.mesh.castShadow = castShadow; });
  return { meshes: forests.map((f) => f.mesh), forests, update(stateFn) { forests.forEach((f) => f.update(stateFn)); } };
}

// ---------- fallen tree with an upturned root plate, splintered top and branch stubs ----------
// Built upright (base at origin, +y up) so makeForest's fall rotation lays it down and stands the root plate on edge.
export function fallenTreeGeometry({ height = 1, trunk = 0.028, plate = 0.09, seed = 1, barkColor = '#6b6157', woodColor = '#b49a76', soilColor = '#3a2f25' } = {}) {
  const parts = [];
  const paint = (geo, hex, jitter = 0.35) => { const col = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3), p = geo.attributes.position;
    for (let i = 0; i < n; i++) { const v = 1 - jitter / 2 + jitter * valueNoise(p.getX(i) * 61 + i * 0.7, p.getY(i) * 47 + p.getZ(i) * 13, seed); a[i * 3] = col.r * v; a[i * 3 + 1] = col.g * v; a[i * 3 + 2] = col.b * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const len = height * (0.72 + 0.2 * valueNoise(seed, 3, 1));
  const t = new THREE.CylinderGeometry(trunk * 0.6, trunk, len, 7, 4, false);
  const tp = t.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const w = 1 + 0.08 * Math.sin(y * 40 + seed); tp.setX(i, tp.getX(i) * w); tp.setZ(i, tp.getZ(i) * w); }
  t.translate(0, len / 2, 0); parts.push(paint(t, barkColor));
  const sp = new THREE.ConeGeometry(trunk * 0.62, trunk * 3.2, 6, 1, true); const spp = sp.attributes.position;
  for (let i = 0; i < spp.count; i++) if (spp.getY(i) > 0) { spp.setX(i, spp.getX(i) + (valueNoise(i, seed, 4) - 0.5) * trunk); spp.setY(i, spp.getY(i) * (0.4 + valueNoise(i, seed, 5))); }
  sp.translate(0, len + trunk * 1.2, 0); parts.push(paint(sp, woodColor, 0.2));                         // splintered break
  for (let k = 0; k < 6; k++) { const s = new THREE.CylinderGeometry(trunk * 0.12, trunk * 0.2, trunk * 4.5, 4); s.rotateZ(Math.PI / 2 - 0.5); s.rotateY(k * 2.4 + seed);
    s.translate(Math.cos(k * 2.4 + seed) * trunk, len * (0.3 + k * 0.1), -Math.sin(k * 2.4 + seed) * trunk); parts.push(paint(s, barkColor)); }
  const rp = new THREE.IcosahedronGeometry(plate, 2); const rpp = rp.attributes.position;              // root plate (soil + roots)
  for (let i = 0; i < rpp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rpp, i); const k = 0.75 + 0.5 * valueNoise(v.x * 30 + seed, v.z * 30, 6);
    rpp.setXYZ(i, v.x * k, v.y * 0.32 * k, v.z * k); }
  rp.translate(0, plate * 0.05, 0); parts.push(paint(rp, soilColor, 0.5));
  for (let k = 0; k < 7; k++) { const r = new THREE.CylinderGeometry(trunk * 0.05, trunk * 0.18, plate * 1.1, 3); r.rotateZ(Math.PI / 2 + (valueNoise(k, seed, 7) - 0.5));
    r.rotateY(k * 0.9 + seed); r.translate(Math.cos(k * 0.9 + seed) * plate * 0.75, -plate * 0.05, -Math.sin(k * 0.9 + seed) * plate * 0.75); parts.push(paint(r, '#4a3a2c')); }
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed())); g.computeVertexNormals();
  return g;
}

export function makeFallenForest(trees, { heightAt, variants = 3, material, plate = 1 } = {}) {
  const groups = Array.from({ length: variants }, () => []);
  trees.forEach((t) => groups[Math.floor(valueNoise(t.x * 0.53, t.z * 0.29, 91) * variants) % variants].push(t));
  material = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const forests = groups.map((g, k) => makeForest(g, { heightAt, material, geometry: fallenTreeGeometry({ seed: 3 + k * 19, plate: (0.075 + 0.025 * k) * plate }) }));
  return { meshes: forests.map((f) => f.mesh), forests, update(stateFn) { forests.forEach((f) => f.update(stateFn)); } };
}

// ---------- advancing dust wall: soft billboards on a ring of radius R ----------
export function dustWall(scene, { count = 90, height = 140, color = 'rgba(190,176,152,', seed = 5, groundAt = () => 0 } = {}) {
  const tex = glowTexture([[0, color + '0.85)'], [0.45, color + '0.45)'], [1, color + '0)']], 128);
  const sprites = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { a: (i / count) * Math.PI * 2 + (valueNoise(i, seed, 1) - 0.5) * 0.08, h: 0.6 + 0.8 * valueNoise(i, seed, 2), j: valueNoise(i, seed, 3) };
    scene.add(s); sprites.push(s);
  }
  return { sprites, update(R, alpha, t = 0) {
    for (const s of sprites) {
      const { a, h, j } = s.userData; const r = R * (0.96 + 0.06 * j);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, hh = height * h * (0.5 + 0.5 * Math.min(1, R / 200));
      s.position.set(x, groundAt(x, z) + hh * 0.42, z); s.scale.set(hh * (0.45 + 0.35 * j), hh * (0.8 + 0.5 * Math.sin(a * 7 + j * 9) ** 2), 1);
      s.material.opacity = alpha * (0.55 + 0.45 * j) * (R > 2 ? 1 : 0); s.material.rotation = t * 0.1 * (j - 0.5);
    }
  } };
}

// ---------- rising smoke columns (thin wisps, no flames) ----------
export function smokeColumns(scene, { points = [], height = 40, n = 50, color = '#9b9b98', opacity = 0.22, size = 6, seed = 9 } = {}) {
  const tex = glowTexture([[0, 'rgba(255,255,255,0.8)'], [0.5, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']], 64);
  const all = [];
  points.forEach(([x, y, z], ci) => { for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { x, y, z, ph: (i / n + valueNoise(i, ci, seed) * 0.1) % 1, ci }; scene.add(s); all.push(s); } });
  return { update(t) { for (const s of all) { const { x, y, z, ph, ci } = s.userData; const a = (ph + t * 0.06) % 1;
    s.position.set(x + Math.sin(a * 6 + ci) * a * 6 + a * a * 18, y + a * height, z + Math.cos(a * 5 + ci) * a * 4);
    s.scale.setScalar(size * (0.4 + a * 2.2)); s.material.opacity = opacity * Math.sin(Math.PI * a); } } };
}

// ---------- incandescent fireball core: granular emissive surface + layered scattering halo ----------
export function fireballCore(size = 10, seed = 4) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); const img = g.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const n = 0.5 + fbm(x / 22, y / 22, { seed, octaves: 5 }); const k = Math.min(1, Math.max(0, n));
    const i = (y * 256 + x) * 4; img.data[i] = 255; img.data[i + 1] = 150 + 105 * k; img.data[i + 2] = 60 + 180 * k * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.25, 0.9), fog: false, toneMapped: true });
  const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 40, 24), mat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,245,225,0.95)'], [0.18, 'rgba(255,190,110,0.75)'], [0.42, 'rgba(255,130,50,0.28)'], [1, 'rgba(255,110,30,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.setScalar(size * 4.2);
  const grp = new THREE.Group(); grp.add(core, halo);
  return { group: grp, update(t) { core.rotation.y = t * 1.7; core.rotation.x = t * 0.6; halo.scale.setScalar(size * 4.2 * (0.95 + 0.05 * Math.sin(t * 29))); } };
}
