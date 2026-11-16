// Hadal fauna, modelled from reference photographs (see references.json): no bioluminescence, seen only in lamp light.
//  - Amphipod (Hirondellea gigas-like): pale, curved, segmented body ~4 cm, antennae, small legs; instanced swarm.
//  - Snailfish (Pseudoliparis-like): tadpole-shaped, large head, small eyes, no scales, pale pink translucent, ~25 cm;
//    the tail undulates. The record fish was an unidentified Pseudoliparis species; this is a generic genus likeness.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function amphipodGeometry(len = 0.042) {
  const parts = [];
  const N = 11;
  for (let i = 0; i < N; i++) {                      // body segments along a C-shaped arc (head at +x)
    const a = -0.9 + 1.8 * (i / (N - 1)), R = len / 1.8;
    const s = new THREE.SphereGeometry(1, 10, 8);
    const w = len * (0.075 + 0.05 * Math.sin(Math.PI * (i + 1) / (N + 1)));
    s.scale(len * 0.07, w * 1.2, w);
    s.rotateZ(-a); s.translate(Math.sin(a) * R, -Math.cos(a) * R * 0.55, 0);
    parts.push(s);
  }
  for (const side of [-1, 1]) {
    const ant = new THREE.CylinderGeometry(0.0007, 0.0004, len * 0.6, 4); ant.rotateZ(Math.PI / 2 - 0.5); ant.translate(len * 0.62, len * 0.05, side * len * 0.03); parts.push(ant);
    for (let k = 0; k < 6; k++) {
      const leg = new THREE.CylinderGeometry(0.0006, 0.0004, len * 0.22, 4); const a = -0.6 + k * 0.22;
      leg.rotateX(side * 0.5); leg.translate(Math.sin(a) * len * 0.5, -len * 0.33, side * len * 0.035); parts.push(leg);
    }
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

export function amphipodSwarm(scene, { n = 36, seed = 11 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mat = new THREE.MeshStandardMaterial({ color: '#d8c0b2', roughness: 0.5, metalness: 0, emissive: '#120c0a' });
  const mesh = new THREE.InstancedMesh(amphipodGeometry(), mat, n); mesh.frustumCulled = false; scene.add(mesh);
  const P = Array.from({ length: n }, () => ({ arrive: rnd(), r: 0.12 + rnd() * 0.28, h: -0.18 + rnd() * 0.42, w: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.9),
    ph: rnd() * 6.283, from: new THREE.Vector3((rnd() - 0.5) * 3, (rnd() - 0.2) * 2, (rnd() - 0.5) * 3), sc: 0.8 + rnd() * 0.4 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), prev = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  const posAt = (p, t, k, center, out) => {
    const a = p.ph + t * p.w;
    out.set(Math.cos(a) * p.r, p.h + 0.04 * Math.sin(t * 2.3 + p.ph), Math.sin(a) * p.r).add(center);
    return out.lerp(v.copy(center).add(p.from), 1 - k);
  };
  return {
    mesh,
    // center: bait position (world); t: seconds; arrive: 0..1 how far the swarm has gathered; visible: 0/1
    update(t, center, arrive, visible = 1) {
      mesh.visible = visible > 0;
      P.forEach((p, i) => {
        const k = THREE.MathUtils.smoothstep(arrive * 1.6 - p.arrive * 0.6, 0, 1);
        const pos = posAt(p, t, k, center, new THREE.Vector3()); posAt(p, t - 0.05, k, center, prev);
        const dir = pos.clone().sub(prev); if (dir.lengthSq() < 1e-10) dir.set(1, 0, 0);
        q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
        q.multiply(new THREE.Quaternion().setFromEuler(e.set(0.4 * Math.sin(t * 9 + p.ph), 0, 0)));
        const g = k > 0.02 ? p.sc : 0.0001;
        m.compose(pos, q, sc.set(g, g, g)); mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export function snailfish(scene, { len = 0.26 } = {}) {
  // body: lofted along +x (head at +x end), radius profile r(u), laterally compressed toward the tail
  const NU = 48, NV = 20, pos = [], idx = [], base = [];
  const r = (u) => u < 0.85 ? len * (0.008 + 0.13 * Math.pow(u / 0.85, 1.3))                 // tail (u=0) -> big head
    : len * 0.138 * Math.sqrt(Math.max(0, 1 - ((u - 0.85) / 0.155) ** 2));                    // rounded snout (u=1)
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, x = (u - 0.62) * len, rr = r(u), squash = 0.55 + 0.45 * u;
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * Math.PI * 2;
      const p = [x, Math.sin(a) * rr * 1.1, Math.cos(a) * rr * squash];
      pos.push(...p); base.push(...p);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * (NV + 1) + j, b = a + NV + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#efc4bb', roughness: 0.38, transparent: true, opacity: 0.88, emissive: '#2a1512', side: THREE.DoubleSide });
  const body = new THREE.Mesh(g, mat);
  const grp = new THREE.Group(); grp.add(body);
  const eyeM = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.2 });
  for (const z of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(len * 0.018, 12, 8), eyeM); e.position.set(len * 0.31, len * 0.045, z * len * 0.098); grp.add(e); }
  const finM = new THREE.MeshStandardMaterial({ color: '#f3d3cc', transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.5 });
  const fins = [];
  for (const z of [-1, 1]) {                         // broad pectoral fins
    const f = new THREE.Mesh(new THREE.CircleGeometry(len * 0.11, 20, 0, Math.PI), finM);
    f.position.set(len * 0.18, -len * 0.02, z * len * 0.06); f.rotation.set(Math.PI / 2 * z, 0.4, 0); grp.add(f); fins.push(f);
  }
  scene.add(grp);
  const P = g.attributes.position;
  return {
    group: grp,
    update(t, beat = 1.4) {
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, amp = len * 0.06 * Math.pow(1 - u, 2.2);
        const off = amp * Math.sin(t * beat * 6.283 - (1 - u) * 5.5);
        for (let j = 0; j <= NV; j++) { const k = (i * (NV + 1) + j) * 3; P.array[k + 2] = base[k + 2] + off; }
      }
      P.needsUpdate = true; g.computeVertexNormals();
      fins.forEach((f, k) => { f.rotation.y = 0.4 + 0.25 * Math.sin(t * 3.1 + k * Math.PI); });
    },
  };
}
