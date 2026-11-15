// S7 PAYOFF — centuries pass. Split cutaway: above the ice, skies and ships change through the eras;
// below, the same shark barely moves. Overlays (year counter, "≈ 400 years") are added in the edit.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, iceCeiling, marineSnow, rng } from '../lib/core.js';
import { makeShark } from '../lib/shark.js';
const W = 1080, H = 1920, SPLIT = 0.46;               // fraction of frame (from top) above water
export async function build({ dur }) {
  const renderer = makeRenderer(1.15); renderer.autoClear = false;
  // ---------- above ----------
  const above = new THREE.Scene();
  const topH = Math.round(H * SPLIT), botH = H - topH - 6;
  const camA = new THREE.PerspectiveCamera(34, W / topH, 0.1, 400);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uDay: { value: 0 }, uDusk: { value: 0 }, uAur: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vW; uniform float uDay; uniform float uDusk; uniform float uAur; uniform float uT;
      void main(){ float h = clamp(vW.y, 0.0, 1.0);
        vec3 night = mix(vec3(0.02,0.05,0.08), vec3(0.01,0.02,0.04), h);
        vec3 day = mix(vec3(0.55,0.62,0.66), vec3(0.22,0.36,0.48), pow(h,0.6));
        vec3 c = mix(night, day, uDay);
        c += vec3(1.0,0.5,0.15) * uDusk * exp(-h*9.0) * 0.9;
        float a = smoothstep(0.15,0.35,h) * (1.0-smoothstep(0.45,0.8,h));
        float rib = 0.5+0.5*sin(vW.x*9.0 + uT*1.5 + sin(vW.z*5.0+uT)*2.0);
        c += vec3(0.15,0.9,0.55) * a * rib * uAur * 0.35;
        gl_FragColor = vec4(c,1.0); }` });
  above.add(new THREE.Mesh(new THREE.SphereGeometry(200, 48, 32), skyMat));
  const sun = new THREE.DirectionalLight('#ffd2a0', 1.2); above.add(sun);
  const amb = new THREE.HemisphereLight('#9fb6c4', '#0a1216', 0.4); above.add(amb);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#16303a', roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; above.add(sea);
  const r = rng(77), floeMat = new THREE.MeshStandardMaterial({ color: '#c9d6d9', roughness: 0.8 });
  for (let i = 0; i < 160; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + r() * 2.2, 0.8 + r() * 2.2, 0.25, 6 + Math.floor(r() * 4)), floeMat);
    f.position.set((r() - 0.5) * 140, 0.05, -r() * 120 + 6); f.rotation.y = r() * 3; f.scale.z = 0.5 + r(); above.add(f);
  }
  const sil = new THREE.MeshStandardMaterial({ color: '#0a0c0e', roughness: 0.9 });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(3) });
  const hullShape = (len, h, bow = 0.8) => { const s = new THREE.Shape(); s.moveTo(-len / 2, h); s.lineTo(len / 2 + bow, h); s.lineTo(len / 2, 0); s.lineTo(-len / 2 + 0.3, 0); s.lineTo(-len / 2 - 0.2, h); return new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false }); };
  const box = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sil); m.position.set(x, y, 0.6); return m; };
  function sailing() { const g = new THREE.Group(); g.add(new THREE.Mesh(hullShape(7, 1.3, 1.6), sil));
    for (const [x, hgt] of [[-2.2, 6], [0.3, 7.5], [2.5, 5.5]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, hgt, 8), sil); m.position.set(x, 1.3 + hgt / 2, 0.6); g.add(m);
      for (let k = 0; k < 3; k++) { const w = 2.6 - k * 0.5, sh = 1.4; const sail = new THREE.Mesh(new THREE.PlaneGeometry(w, sh, 4, 2), new THREE.MeshStandardMaterial({ color: '#1a1714', side: THREE.DoubleSide })); sail.position.set(x, 2.4 + k * 1.6, 0.6); g.add(sail); } }
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12), lampMat); l.position.set(-3.4, 2.1, 0.6); g.add(l); return g; }
  const puffs = [];
  function steam() { const g = new THREE.Group(); g.add(new THREE.Mesh(hullShape(10, 1.6, 1.2), sil));
    g.add(box(5, 1.2, 1.1, -0.5, 2.2)); g.add(box(2, 0.8, 1.0, -0.3, 3.2));
    const fun = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 2.6, 16), sil); fun.position.set(1.2, 3.9, 0.6); g.add(fun);
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshStandardMaterial({ color: '#2a2d30', transparent: true, opacity: 0.55, depthWrite: false })); g.add(p); puffs.push({ p, i }); }
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08), lampMat); l.position.set(-2.5 + i * 0.9, 2.3, 1.25); g.add(l); } return g; }
  function icebreaker() { const g = new THREE.Group(); g.add(new THREE.Mesh(hullShape(12, 2.2, 2.0), sil));
    g.add(box(4.5, 2.4, 1.15, -1.5, 3.4)); g.add(box(2.6, 1.4, 1.1, -1.2, 5.3)); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), sil); mast.position.set(-1.2, 7.4, 0.6); g.add(mast);
    for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07), lampMat); l.position.set(-4.5 + i * 1.0, 2.6 + (i % 3 === 0 ? 1.2 : 0), 1.25); g.add(l); }
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2 + 0.12; beam.position.set(8.5, 5.6, 0.6); g.add(beam); return g; }
  const ships = [sailing(), steam(), icebreaker()];
  ships.forEach((s) => { s.position.set(-40, 0, -2); s.scale.setScalar(1.25); above.add(s); });
  // ---------- below ----------
  const below = underwaterScene(0.05);
  const camB = new THREE.PerspectiveCamera(42, W / botH, 0.1, 200);
  iceCeiling(below, { y: 5, holeR: 0, chunks: 300, rand: rng(41) });
  const filt = new THREE.DirectionalLight('#ffb070', 0.6); filt.position.set(0, 10, 2); below.add(filt);
  const snow = marineSnow(below, { n: 3500, box: [30, 12, 20], center: [0, -1, 0], size: 0.05, fall: 0.15 });
  const shark = makeShark({ amp: 0.09, freq: 1.3 }); below.add(shark.group);
  const era = dur * 0.86 / 3;                                // the three eras share the first ~86%
  return { renderer, render(t) {
    // sky: fast day/night cycle (~1.25 s per day)
    const ph = t / 1.25 * Math.PI * 2;
    const day = Math.max(0, Math.sin(ph)), dusk = Math.exp(-Math.pow(Math.sin(ph), 2) * 18) * (Math.cos(ph) > 0 ? 1 : 0.6);
    skyMat.uniforms.uDay.value = day * 0.85; skyMat.uniforms.uDusk.value = dusk; skyMat.uniforms.uAur.value = Math.max(0, -Math.sin(ph)); skyMat.uniforms.uT.value = t;
    sun.intensity = 0.2 + day * 1.4; sun.position.set(Math.cos(ph) * 50, Math.sin(ph) * 40 + 5, -60);
    amb.intensity = 0.15 + day * 0.5;
    ships.forEach((s, i) => { const lt = (t - i * era) / era; s.visible = lt > -0.05 && lt < 1.05; s.position.x = -10 + lt * 20; });
    for (const { p, i } of puffs) { const a = ((t * 0.9 + i / 14) % 1); p.position.set(1.2 - a * 6, 5.2 + a * 3.2, 0.6); p.scale.setScalar(0.4 + a * 1.8); p.material.opacity = 0.5 * (1 - a); }
    camA.position.set(0, 4.2, 22); camA.lookAt(0, 3.0, -14);
    // below: the shark hardly moves; light flickers with the days
    filt.intensity = 0.15 + day * 0.7 + dusk * 0.3;
    shark.group.position.set(-1.0 + t * 0.12, -1.0, 0); shark.group.rotation.set(0, -0.12, 0); shark.update(t);
    camB.position.set(0.4, -1.6, 9.5); camB.lookAt(0, -0.6, 0);
    snow.update(t);
    // compose
    renderer.setScissorTest(true);
    renderer.setViewport(0, H - topH, W, topH); renderer.setScissor(0, H - topH, W, topH); renderer.clear(); renderer.render(above, camA);
    renderer.setViewport(0, H - topH - 6, W, 6); renderer.setScissor(0, H - topH - 6, W, 6); renderer.setClearColor('#a9c9cf'); renderer.clear();
    renderer.setClearColor('#000000');
    renderer.setViewport(0, 0, W, botH); renderer.setScissor(0, 0, W, botH); renderer.clear(); renderer.render(below, camB);
    renderer.setScissorTest(false);
  } };
}
