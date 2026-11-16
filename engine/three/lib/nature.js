// ODDLIGHT nature kit (generic, reusable across productions):
// deterministic noise, heightfield terrain, physically-based sky, instanced conifer forest with per-tree
// state (standing / falling / stripped), snow and dust particles, and shadow-casting sun.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- noise ----------
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function valueNoise(x, y, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, { octaves = 5, seed = 1, lac = 2.0, gain = 0.5 } = {}) {
  let amp = 0.5, f = 1, sum = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * (valueNoise(x * f, y * f, seed + i * 17) * 2 - 1); f *= lac; amp *= gain; }
  return sum;
}

// ---------- terrain ----------
// heightFn(x, z) -> y. Colour by slope/height via colorFn(x, y, z, n) -> THREE.Color
export function makeTerrain({ size = 400, segments = 256, heightFn, colorFn, roughness = 0.95 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, segments, segments); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, heightFn(x, z)); }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    colorFn(p.getX(i), p.getY(i), p.getZ(i), n.getY(i), c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }));
  m.receiveShadow = true;
  return m;
}

// ---------- sky ----------
export function makeSky({ elevation = 4, azimuth = 120, turbidity = 8, rayleigh = 2.2, mie = 0.006, mieG = 0.86 } = {}) {
  const sky = new Sky(); sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = turbidity; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie; u.mieDirectionalG.value = mieG;
  const sun = new THREE.Vector3();
  const set = (el, az) => { sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(az)); u.sunPosition.value.copy(sun); };
  set(elevation, azimuth);
  return { sky, sun, set };
}

// ---------- conifer geometry (trunk + stacked tiers), merged; vertex colour bakes bark vs needles ----------
export function coniferGeometry({ height = 1, tiers = 6, radius = 0.26, trunk = 0.025, segs = 7, seed = 3, stripped = false } = {}) {
  const parts = [];
  const bark = new THREE.Color('#4a3a2e'), needle = new THREE.Color('#1b2a20'), needleTip = new THREE.Color('#2b3b29');
  const paint = (geo, color) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3), pp = geo.attributes.position; for (let i = 0; i < n; i++) { const v = 0.82 + 0.36 * valueNoise(pp.getX(i) * 40 + i * 0.37, pp.getY(i) * 31, seed + 2); a[i * 3] = color.r * v; a[i * 3 + 1] = color.g * v; a[i * 3 + 2] = color.b * v; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const th = stripped ? height : height * 0.84;               // living trees: trunk ends inside the top tier
  const t = new THREE.CylinderGeometry(trunk * 0.6, trunk, th, 6, 1, true); t.translate(0, th / 2, 0); parts.push(paint(t, bark));
  if (!stripped) {
    for (let k = 0; k < tiers; k++) {
      const f = k / tiers, r = radius * (1 - f * 0.82), hh = height * 0.26;
      const c = new THREE.ConeGeometry(r, hh, segs, 1, true);
      // jitter rim for a less perfect silhouette
      const pp = c.attributes.position;
      for (let i = 0; i < pp.count; i++) if (pp.getY(i) < 0) { const j = 0.82 + 0.36 * valueNoise(i * 1.7, k * 3.1, seed); pp.setX(i, pp.getX(i) * j); pp.setZ(i, pp.getZ(i) * j); pp.setY(i, pp.getY(i) - 0.012 * j); }
      c.translate(0, height * (0.22 + f * 0.68) + hh * 0.1, 0);
      parts.push(paint(c, needle.clone().lerp(needleTip, f)));
    }
  } else {
    for (let k = 0; k < 5; k++) { // broken stubs of branches
      const s = new THREE.CylinderGeometry(trunk * 0.25, trunk * 0.35, radius * 0.5, 4); s.rotateZ(Math.PI / 2 - 0.3); s.rotateY(k * 2.1);
      s.translate(Math.cos(k * 2.1) * radius * 0.18, height * (0.35 + k * 0.1), -Math.sin(k * 2.1) * radius * 0.18); parts.push(paint(s, bark));
    }
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed ? p.toNonIndexed() : p)); g.computeVertexNormals();
  return g;
}

// ---------- forest (instanced) ----------
// trees: [{x, z, s (scale), rot, tint}] ; state per frame via update(fn(i, tree) -> {fall: 0..1, dir: angle, stripped: bool})
export function makeForest(trees, { heightAt, geometry, strippedGeometry, material } = {}) {
  geometry = geometry || coniferGeometry();
  material = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: false });
  const mesh = new THREE.InstancedMesh(geometry, material, trees.length);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const color = new THREE.Color();
  trees.forEach((t, i) => { color.setScalar(1).multiplyScalar(0.75 + 0.5 * (t.tint ?? 0.5)); mesh.setColorAt(i, color); });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tq = new THREE.Quaternion();
  const ys = trees.map((t) => heightAt(t.x, t.z));
  function update(stateFn) {
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i], st = stateFn ? stateFn(i, t) : null;
      pos.set(t.x, ys[i] - 0.02 * t.s, t.z); sc.setScalar(t.s);
      q.setFromEuler(e.set(0, t.rot, 0));
      if (st && st.fall > 0) { // topple away from direction 'dir' (radians, in xz-plane)
        axis.set(Math.cos(st.dir + Math.PI / 2), 0, Math.sin(st.dir + Math.PI / 2)).normalize();
        tq.setFromAxisAngle(axis, -st.fall * (Math.PI / 2 - 0.06)); q.premultiply(tq);
      }
      if (st && st.hidden) sc.setScalar(0.0001);
      m.compose(pos, q, sc); mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(null);
  return { mesh, update, trees };
}

// scatter trees with Poisson-ish jitter on a grid, deterministic
export function scatter({ area = 300, spacing = 2.2, seed = 5, keep = () => true, center = [0, 0] } = {}) {
  const out = [], half = area / 2;
  for (let gx = -half; gx < half; gx += spacing) for (let gz = -half; gz < half; gz += spacing) {
    const jx = (hash2(gx * 10 | 0, gz * 10 | 0, seed) - 0.5) * spacing * 0.9, jz = (hash2(gz * 10 | 0, gx * 10 | 0, seed + 1) - 0.5) * spacing * 0.9;
    const x = center[0] + gx + jx, z = center[1] + gz + jz;
    const dens = valueNoise(x * 0.03, z * 0.03, seed + 9);
    if (dens < 0.28 || !keep(x, z)) continue;
    out.push({ x, z, s: 9 + hash2(gx | 0, gz | 0, seed + 3) * 9, rot: hash2(gz | 0, gx | 0, seed + 4) * 6.283, tint: hash2(gx * 3 | 0, gz * 7 | 0, seed + 5) });
  }
  return out;
}

export function sunLight(scene, { color = '#ffd2a0', intensity = 3, dir = [1, 0.3, 0.4], shadowSize = 200, mapSize = 2048, target = [0, 0, 0] } = {}) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(target[0] + dir[0] * 300, target[1] + dir[1] * 300, target[2] + dir[2] * 300);
  l.target.position.set(...target);
  l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize);
  const c = l.shadow.camera; c.left = -shadowSize; c.right = shadowSize; c.top = shadowSize; c.bottom = -shadowSize; c.near = 1; c.far = 900;
  l.shadow.bias = -0.0004; l.shadow.normalBias = 0.6;
  scene.add(l, l.target);
  return l;
}

// ---------- image-based lighting from the procedural sky (soft ambient + reflections) ----------
export function skyEnvironment(renderer, sky) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene(); const clone = sky.clone(); s.add(clone);
  const rt = pm.fromScene(s, 0, 1, 6000);
  pm.dispose();
  return rt.texture;
}

// ---------- glow sprite texture (radial) ----------
export function glowTexture(stops = [[0, 'rgba(255,240,210,1)'], [0.2, 'rgba(255,170,80,0.9)'], [0.45, 'rgba(255,120,30,0.35)'], [1, 'rgba(255,100,20,0)']], size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- generic particle field (snow, dust, embers) ----------
export function particles(scene, { n = 3000, box = [100, 60, 100], center = [0, 30, 0], size = 0.4, color = '#ffffff', opacity = 0.8,
  fall = 2.0, drift = 0.6, seed = 11, additive = false } = {}) {
  const pos = new Float32Array(n * 3), base = new Float32Array(n * 3);
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) base[i * 3 + k] = center[k] + (r() - 0.5) * box[k];
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size, color, map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 64),
    transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(geo, mat); scene.add(pts);
  const hy = box[1] / 2;
  return { points: pts, material: mat, update(t) {
    for (let i = 0; i < n; i++) {
      let y = base[i * 3 + 1] - center[1] - t * fall; y = ((y + hy) % box[1] + box[1]) % box[1] - hy + center[1];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.7 + i) * drift; pos[i * 3 + 1] = y; pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.5 + i * 1.3) * drift;
    }
    geo.attributes.position.needsUpdate = true;
  } };
}
