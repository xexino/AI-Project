// Procedural Greenland shark (stylized): stout lathe body, small set-back dorsals,
// weak lower tail lobe, small pale eyes with a trailing eye parasite. Length along +x (snout at +L/2).
import * as THREE from 'three';

export function makeShark({ L = 6.0, girth = 1.35, amp = 0.13, freq = 2.1, detail = 72 } = {}) {
  const radius = (u) => (u <= 0 || u >= 1) ? 0 : 0.78 * girth * Math.pow(u, 0.62) * Math.pow(1 - u, 0.2);
  const rAt = (x) => radius((x + L / 2) / L);
  const YS = 0.9; // vertical squash

  const prof = [];
  for (let i = 0; i <= 90; i++) { const u = i / 90; prof.push(new THREE.Vector2(Math.max(radius(u), 0.0005), u * L)); }
  const geo = new THREE.LatheGeometry(prof, detail);
  geo.rotateZ(-Math.PI / 2); geo.translate(-L / 2, 0, 0); geo.scale(1, YS, 1);

  // mottled skin, paler belly, a few old scars
  const P = geo.attributes.position, col = new Float32Array(P.count * 3);
  const dark = new THREE.Color('#2f2924'), mid = new THREE.Color('#4f463d'), belly = new THREE.Color('#6d675e'), scar = new THREE.Color('#8a8276');
  const c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const n = 0.5 + 0.5 * Math.sin(x * 7.1 + z * 3.3) * Math.sin(z * 6.7 - y * 4.1) * Math.cos(x * 2.3 + y * 9.0);
    const n2 = 0.5 + 0.5 * Math.sin(x * 23.0 + y * 17.0) * Math.cos(z * 19.0 - x * 5.0);
    c.copy(dark).lerp(mid, n * 0.7 + n2 * 0.15).lerp(belly, THREE.MathUtils.smoothstep(-y, -0.05, 0.4) * 0.55);
    const s1 = Math.abs(Math.sin(x * 3.1 + z * 2.2 + 0.7)) < 0.025 && x > -1.5 && x < 1.8 && y > -0.1;
    const s2 = Math.abs(Math.sin(x * 2.4 - z * 3.5 + 2.0)) < 0.02 && x > 0.2 && x < 2.4;
    if (s1 || s2) c.lerp(scar, 0.55);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const rest = geo.attributes.position.array.slice();
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.04 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, skin); group.add(body);

  const finMat = new THREE.MeshStandardMaterial({ color: '#352e28', roughness: 0.8 });
  const finGeo = (pts, thick = 0.03) => {
    const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p);
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2 });
    g.translate(0, 0, -thick / 2); return g;
  };
  const attached = []; // {obj, station, y, z, follow}
  const attach = (obj, station, y, z, follow = 0) => { group.add(obj); attached.push({ obj, station, y, z, follow, baseRotY: obj.rotation.y }); };

  // dorsal fins (small, set far back as in Somniosus)
  const d1 = new THREE.Mesh(finGeo([[0, 0], [0.55, 0], [0.16, 0.36], [0.04, 0.33]]), finMat);
  attach(d1, -0.55, rAt(-0.55) * YS - 0.04, 0, 0.4);
  const d2 = new THREE.Mesh(finGeo([[0, 0], [0.45, 0], [0.13, 0.28], [0.03, 0.26]]), finMat);
  attach(d2, -1.55, rAt(-1.55) * YS - 0.04, 0, 0.7);
  // pectorals
  const pg = finGeo([[0, 0], [0.62, 0], [0.04, -0.78], [-0.1, -0.62]]);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(pg, finMat); m.rotation.set(side * -1.1, side * 0.25, 0);
    attach(m, 1.25, -rAt(1.25) * YS * 0.45, side * rAt(1.25) * 0.82);
  }
  // tail: long upper lobe, weak lower lobe
  const tg = finGeo([[0, 0], [-1.25, 1.2], [-1.05, 1.08], [-0.48, 0.16], [-0.62, -0.5], [-0.45, -0.46], [0, -0.06]], 0.035);
  const tail = new THREE.Mesh(tg, finMat); attach(tail, -L / 2 + 0.12, 0.02, 0, 1.3);

  // eyes + parasite (Ommatokoita), placed on the body surface
  const eyeTex = (() => {
    // cloudy, fibrous pale iris (Greenland shark eyes are often clouded) with a soft dark pupil
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'); const C = S / 2;
    const base = g.createRadialGradient(C, C, 0, C, C, C);
    base.addColorStop(0, '#6d817f'); base.addColorStop(0.55, '#8fa3a0'); base.addColorStop(0.9, '#53625f'); base.addColorStop(1, '#1d2526');
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    let sd = 13; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { const a = r() * Math.PI * 2, r0 = C * (0.2 + r() * 0.15), r1 = C * (0.6 + r() * 0.35);
      g.strokeStyle = r() < 0.5 ? `rgba(200,214,210,${0.05 + r() * 0.12})` : `rgba(30,40,42,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.quadraticCurveTo(C + Math.cos(a + 0.08) * (r0 + r1) / 2, C + Math.sin(a + 0.08) * (r0 + r1) / 2, C + Math.cos(a + 0.03) * r1, C + Math.sin(a + 0.03) * r1); g.stroke(); }
    const pupil = g.createRadialGradient(C, C, 0, C, C, C * 0.34);
    pupil.addColorStop(0, 'rgba(5,8,9,1)'); pupil.addColorStop(0.72, 'rgba(8,12,13,1)'); pupil.addColorStop(1, 'rgba(8,12,13,0)');
    g.save(); g.translate(C, C); g.scale(1, 0.8); g.translate(-C, -C); g.fillStyle = pupil; g.beginPath(); g.arc(C, C, C * 0.34, 0, Math.PI * 2); g.fill(); g.restore();
    const haze = g.createRadialGradient(C * 0.8, C * 0.75, 0, C, C, C);
    haze.addColorStop(0, 'rgba(220,230,226,0.28)'); haze.addColorStop(0.6, 'rgba(220,230,226,0.08)'); haze.addColorStop(1, 'rgba(220,230,226,0)');
    g.fillStyle = haze; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // eye: one sphere, iris projected onto its front (planar UVs), set into the head so only a cap shows
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
  const eyeGeo = new THREE.SphereGeometry(0.06, 48, 32);
  { const p = eyeGeo.attributes.position, uv = eyeGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.12 + 0.5, p.getY(i) / 0.12 + 0.5); }
  const eyeX = L / 2 - 0.55, eyeR = rAt(eyeX), ang = 0.32, inset = (eyeR - 0.028) / eyeR;
  const eyes = [];
  for (const side of [1, -1]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.rotation.set(-side * ang * 0.6, side > 0 ? 0 : Math.PI, 0);
    attach(e, eyeX, Math.sin(ang) * eyeR * YS * inset, side * Math.cos(ang) * eyeR * inset);
    eyes.push(e);
  }
  const paraMat = new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.6, emissive: '#2a2622' });
  const parasite = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.08, -0.02, 0.03), new THREE.Vector3(-0.18, -0.05, 0.03), new THREE.Vector3(-0.27, -0.06, 0.01)]);
  parasite.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 8), paraMat));
  attach(parasite, eyeX, Math.sin(ang) * eyeR * YS * inset - 0.02, Math.cos(ang) * eyeR * inset + 0.055);

  const wave = (x, t) => { const k = (L / 2 - x) / L; return amp * Math.pow(k, 1.8) * Math.sin(2.2 * x - t * freq); };

  return {
    group, eyes, parasite, L, rAt,
    eyeWorld: (target = new THREE.Vector3()) => eyes[0].getWorldPosition(target),
    update(t) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, rest[i * 3 + 2] + wave(rest[i * 3], t));
      p.needsUpdate = true; geo.computeVertexNormals();
      for (const a of attached) {
        const z = wave(a.station, t), slope = (wave(a.station + 0.05, t) - z) / 0.05;
        a.obj.position.set(a.station, a.y, a.z + z);
        if (a.follow) a.obj.rotation.y = a.baseRotY - Math.atan(slope) * a.follow;
      }
      parasite.rotation.z = Math.sin(t * 1.7) * 0.15; parasite.rotation.y = Math.sin(t * 1.1) * 0.2;
    },
  };
}
