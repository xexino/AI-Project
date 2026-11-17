// THE PIGEON CEO — one continuous cartoon world for every shot, keyed to the measured dialogue (params.timeline).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const cl = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp, V = (x, y, z) => new THREE.Vector3(x, y, z);
const back = (t) => { t = cl(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // overshoot
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
const sph = (r, m, s = [1, 1, 1]) => { const x = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), m); x.scale.set(...s); x.castShadow = true; return x; };
const box = (w, h, d, m, r = 0.04) => { const x = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); x.castShadow = x.receiveShadow = true; return x; };

function eye(r, iris, lid) {
  const g = new THREE.Group();
  const w = sph(r, M('#ffffff', { roughness: 0.2 })); g.add(w);
  const ir = sph(r * 0.55, M(iris, { roughness: 0.3 }), [1, 1, 0.5]); ir.position.z = r * 0.72; g.add(ir);
  const pu = sph(r * 0.3, M('#0a0a0a', { roughness: 0.1 }), [1, 1, 0.5]); pu.position.z = r * 0.9; g.add(pu);
  const hl = sph(r * 0.1, new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(r * 0.25, r * 0.3, r * 0.98); g.add(hl);
  const lidM = M(lid); const top = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidM); g.add(top);
  return { g, ir, pu, top, set(open = 1, look = [0, 0], dil = 1) {
    top.rotation.x = -Math.PI / 2 + (1 - open) * 1.35 - 0.25; ir.position.set(look[0] * r * 0.3, look[1] * r * 0.3, r * 0.72);
    pu.position.set(look[0] * r * 0.35, look[1] * r * 0.35, r * 0.9); pu.scale.setScalar(dil);
  } };
}

function makePigeon() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const grey = M('#8f9bb0', { roughness: 0.7 }), dark = M('#5d6880', { roughness: 0.7 });
  const torso = sph(0.27, grey, [1, 1.12, 0.95]); torso.position.y = 0.36; body.add(torso);
  const suit = sph(0.285, M('#1c2340', { roughness: 0.45 }), [1, 0.82, 0.97]); suit.position.y = 0.3; body.add(suit);
  const shirt = new THREE.Mesh(new THREE.CircleGeometry(0.11, 3), M('#ffffff')); shirt.rotation.z = Math.PI / 2 * 3; shirt.position.set(0, 0.42, 0.262); body.add(shirt);
  const tie = box(0.05, 0.16, 0.02, M('#d42a2a'), 0.01); tie.position.set(0, 0.38, 0.275); body.add(tie);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 12, 32), M('#3fae8c', { metalness: 0.5, roughness: 0.25, emissive: '#2a1a5a', emissiveIntensity: 0.3 }));
  neck.rotation.x = Math.PI / 2; neck.position.y = 0.6; body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.74, 0.04); body.add(head);
  head.add(sph(0.17, grey));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 16), M('#3a3640')); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.2); head.add(beak);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 12), M('#2c2830')); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -0.05, 0.17); head.add(jaw);
  const cere = sph(0.035, M('#f2efe6'), [1.3, 0.7, 1]); cere.position.set(0, 0.02, 0.15); head.add(cere);
  const eL = eye(0.07, '#ff8a1c', '#8f9bb0'), eR = eye(0.07, '#ff8a1c', '#8f9bb0');
  eL.g.position.set(-0.085, 0.05, 0.12); eR.g.position.set(0.085, 0.05, 0.12); eL.g.rotation.y = -0.3; eR.g.rotation.y = 0.3; head.add(eL.g, eR.g);
  const shades = new THREE.Group(); const gl = M('#050505', { metalness: 0.9, roughness: 0.08 });
  for (const x of [-0.085, 0.085]) { const l = box(0.13, 0.08, 0.03, gl, 0.025); l.position.set(x, 0.05, 0.19); shades.add(l); }
  const bridge = box(0.06, 0.015, 0.02, M('#c9a227', { metalness: 1, roughness: 0.2 }), 0.005); bridge.position.set(0, 0.07, 0.2); shades.add(bridge);
  head.add(shades);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: starTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glint.position.set(0.12, 0.1, 0.23); head.add(glint);
  const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.25, 0.48, 0); const f = sph(0.16, M('#1c2340', { roughness: 0.45 }), [0.35, 0.9, 0.7]); f.position.y = -0.12; w.add(f);
    for (let i = 0; i < 3; i++) { const fe = sph(0.07, dark, [0.25, 1, 0.5]); fe.position.set(0, -0.3 - i * 0.02, -0.05 + i * 0.05); w.add(fe); } body.add(w); return w; });
  const tail = new THREE.Group(); for (let i = -2; i <= 2; i++) { const t = sph(0.06, dark, [0.5, 0.2, 1.6]); t.position.set(i * 0.04, 0.16, -0.3); t.rotation.y = i * 0.15; tail.add(t); } body.add(tail);
  const legM = M('#e0707a'); const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * 0.09, 0.1, 0.02);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), legM); sh.position.y = -0.03; l.add(sh);
    for (const a of [-0.5, 0, 0.5]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.08, 6), legM); toe.rotation.x = Math.PI / 2; toe.rotation.y = a; toe.position.set(Math.sin(a) * 0.035, -0.1, Math.cos(a) * 0.035); l.add(toe); }
    root.add(l); return l; });
  return { root, body, head, wings, legs, eL, eR, shades, glint, jaw };
}

function starTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,250,220,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = 'white'; g.fillRect(30, 0, 4, 64); g.fillRect(0, 30, 64, 4);
  return new THREE.CanvasTexture(c);
}

function makeExec(suitC, skinC, hairC, seed) {
  const root = new THREE.Group(); const body = sph(0.36, M(suitC), [1, 1.15, 0.85]); body.position.y = 0.95; root.add(body);
  const shirt = new THREE.Mesh(new THREE.CircleGeometry(0.13, 3), M('#f4f4f4')); shirt.rotation.z = -Math.PI / 2; shirt.position.set(0, 1.18, 0.29); root.add(shirt);
  const tie = box(0.06, 0.2, 0.02, M(seed % 2 ? '#2d6cdf' : '#f2b31b'), 0.01); tie.position.set(0, 1.12, 0.305); root.add(tie);
  const head = new THREE.Group(); head.position.y = 1.55; root.add(head);
  head.add(sph(0.3, M(skinC, { roughness: 0.6 }), [1, 1.05, 0.95]));
  const hair = sph(0.31, M(hairC), [1.02, 0.6, 1]); hair.position.y = 0.12; head.add(hair);
  const eL = eye(0.085, '#3b2a1a', skinC), eR = eye(0.085, '#3b2a1a', skinC); eL.g.position.set(-0.11, 0.04, 0.24); eR.g.position.set(0.11, 0.04, 0.24); head.add(eL.g, eR.g);
  const brows = [-1, 1].map((s) => { const b = box(0.12, 0.025, 0.02, M(hairC), 0.01); b.position.set(s * 0.11, 0.17, 0.27); head.add(b); return b; });
  const mouth = sph(0.07, M('#3a0d12'), [1.2, 0.25, 0.4]); mouth.position.set(0, -0.15, 0.26); head.add(mouth);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.36, 1.18, 0); const u = sph(0.08, M(suitC), [1, 3.2, 1]); u.position.y = -0.22; a.add(u);
    const h = sph(0.07, M(skinC)); h.position.y = -0.48; a.add(h); root.add(a); return a; });
  return { root, head, eL, eR, brows, mouth, arms, body };
}

export async function build({ params }) {
  const TL = params.timeline; const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s.start]));
  const W = (sc, w) => { const x = TL.words.find((q) => q.scene === sc && q.word.toLowerCase().replace(/[^a-z']/g, '') === w); return x ? x.start : S[sc]; };
  const { width = 1080, height = 1920 } = window.ODDLIGHT || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7c98b');
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 200);
  scene.add(new THREE.HemisphereLight('#fff4e0', '#6a4a3a', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6); sun.position.set(-3, 7, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -4, near: 0.5, far: 25 }); sun.shadow.bias = -0.0005; scene.add(sun);
  const rim = new THREE.DirectionalLight('#8fd0ff', 1.2); rim.position.set(4, 3, -6); scene.add(rim);
  const alarm = new THREE.PointLight('#ff2020', 0, 14, 1.2); alarm.position.set(0, 3.2, 0); scene.add(alarm);
  // room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), M('#b06a3c', { roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), M('#7a1f3d', { roughness: 0.9 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, -0.4); rug.receiveShadow = true; scene.add(rug);
  const wallM = M('#2e5c6e', { roughness: 0.8 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), wallM); backWall.position.set(0, 3, -3.4); scene.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallM); sideWall.rotation.y = Math.PI / 2; sideWall.position.set(-5.2, 3, 1); scene.add(sideWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallM); rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(4.6, 3, 1); scene.add(rightWall);
  // giant window with city skyline
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), new THREE.MeshBasicMaterial({ map: skyTex() })); sky.position.set(0, 2.3, -3.38); scene.add(sky);
  for (let i = 0; i < 26; i++) { const h = 0.6 + ((i * 37) % 11) / 6; const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.6 + (i % 4) * 0.03, 0.35, 0.28 + (i % 3) * 0.06) }));
    b.position.set(-4.4 + i * 0.35, 0.5 + h / 2, -3.36); scene.add(b); }
  for (const x of [-4.5, -1.5, 1.5, 4.5]) { const m = box(0.12, 3.8, 0.12, M('#1a1a1a', { metalness: 0.6 })); m.position.set(x, 2.3, -3.3); scene.add(m); }
  // door (left wall) and logo
  const doorPivot = new THREE.Group(); doorPivot.position.set(-5.15, 0, 0.9); scene.add(doorPivot);
  const door = box(0.08, 2.4, 1.2, M('#6b3a1e', { roughness: 0.4 })); door.position.set(0, 1.2, 0.6); doorPivot.add(door);
  const knob = sph(0.05, M('#e8c050', { metalness: 1, roughness: 0.2 })); knob.position.set(0.08, 1.15, 1.05); doorPivot.add(knob);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: textTex('PIGEON CORP™', '#ffd34d', 'rgba(0,0,0,0)'), transparent: true })); logo.position.set(-4.0, 4.6, -3.37); scene.add(logo);
  // conference table, chairs, mugs, papers, sandwich
  const table = box(5.4, 0.12, 1.7, M('#4a2412', { roughness: 0.25, metalness: 0.1 }), 0.05); table.position.set(0, 0.76, -0.4); scene.add(table);
  for (const x of [-2.2, 2.2]) { const l = box(0.15, 0.72, 1.2, M('#2b1408')); l.position.set(x, 0.36, -0.4); scene.add(l); }
  const ceoChair = new THREE.Group(); const seat = box(0.9, 0.18, 0.85, M('#b3121e', { roughness: 0.35 }), 0.08); seat.position.y = 0.55; ceoChair.add(seat);
  const backr = box(0.9, 1.5, 0.2, M('#b3121e', { roughness: 0.35 }), 0.1); backr.position.set(0, 1.25, -0.4); ceoChair.add(backr);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45), M('#888', { metalness: 1 })); pole.position.y = 0.25; ceoChair.add(pole);
  ceoChair.position.set(-3.4, 0, -0.4); ceoChair.rotation.y = Math.PI / 2; scene.add(ceoChair);
  const mugs = []; for (const x of [-1.4, 0.2, 1.7]) { const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.15, 20), M('#ffffff', { roughness: 0.2 })); mg.position.set(x + 0.3, 0.9, -0.75); mg.castShadow = true; scene.add(mg); mugs.push(mg); }
  const sandwich = new THREE.Group(); [['#e8b46a', 0.05], ['#5bbf3a', 0.02], ['#e23b2a', 0.025], ['#ffd23f', 0.02], ['#c98b4a', 0.05]].reduce((y, [c, h]) => {
    const l = box(0.34, h, 0.24, M(c, { roughness: 0.6 }), Math.min(0.02, h / 2.2)); l.position.y = y + h / 2; sandwich.add(l); return y + h; }, 0);
  sandwich.position.set(2.2, 0.83, -0.25); scene.add(sandwich);
  // emergency button on the right wall
  const btnPlate = box(0.5, 0.5, 0.06, M('#f2d21b'), 0.03); btnPlate.position.set(4.56, 1.25, -0.6); btnPlate.rotation.y = -Math.PI / 2; scene.add(btnPlate);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 32), M('#e3121b', { emissive: '#600', roughness: 0.3 })); btn.rotation.z = Math.PI / 2; btn.position.set(4.5, 1.25, -0.6); scene.add(btn);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: textTex('DO NOT PRESS', '#ffffff', '#c0121b') })); sign.rotation.y = -Math.PI / 2; sign.position.set(4.58, 1.7, -0.6); scene.add(sign);
  // characters
  const P = makePigeon(); scene.add(P.root);
  const execs = [makeExec('#4a4f5a', '#f1c7a5', '#3a2a1e', 1), makeExec('#7a5232', '#c98d64', '#141414', 2), makeExec('#2f4f7f', '#f5d6c0', '#d9d9d9', 3)];
  execs.forEach((e, i) => { e.root.position.set([-1.4, 0.2, 1.7][i], 0, -1.35); scene.add(e.root); const ch = box(0.7, 0.9, 0.15, M('#20202a'), 0.06); ch.position.set(e.root.position.x, 0.9, -1.75); scene.add(ch); });
  // sprinkler water + flying papers
  const DROPS = 900, dpos = new Float32Array(DROPS * 6), dseed = new Float32Array(DROPS * 3);
  for (let i = 0; i < DROPS; i++) { dseed[i * 3] = (i * 0.618) % 1; dseed[i * 3 + 1] = (i * 0.414) % 1; dseed[i * 3 + 2] = (i * 0.732) % 1; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const water = new THREE.LineSegments(dgeo, new THREE.LineBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.8 })); water.frustumCulled = false; scene.add(water);
  const papers = []; const pm = M('#ffffff', { side: THREE.DoubleSide, roughness: 0.9 });
  for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), pm); p.castShadow = true; p.userData = { a: i * 2.399, r: 0.6 + (i % 7) * 0.45, h: 1 + (i % 5) * 0.5, sp: 0.6 + (i % 3) * 0.4 }; scene.add(p); papers.push(p); }

  const B = { s2: S.s2, s3: S.s3, s4: S.s4, s5: S.s5, s6: S.s6, end: S.end };
  const tLunch = W('s4', 'lunch'), tMine = W('s5', 'mine'), tPress = B.s5 + 2.6, tUp = W('s6', 'up'), tDown = W('s6', 'down');
  const tJump = B.s3 + 0.15, tLand = B.s3 + 0.75, tDive = B.s5 + 0.35, tGrab = B.s5 + 1.7;
  // pigeon path
  function pigeonState(g) {
    const s = { pos: V(-4.9, 0, 1.4), yaw: Math.PI / 2, sq: 1, wing: 0, bob: 0, shades: 0, beak: 0, look: [0, 0], lid: 1, flip: 0, wet: 0 };
    const strut = (a, b, from, to) => { const k = ss(a, b, g); s.pos.lerpVectors(from, to, k); const ph = g * 9.5; s.bob = Math.sin(ph) * 0.06 * (k > 0 && k < 1 ? 1 : 0.3); s.sq = 1 + Math.abs(Math.sin(ph)) * 0.04; return ph; };
    if (g < B.s3) {
      const ph = strut(0.6, B.s3 - 0.6, V(-4.9, 0, 1.4), V(-0.9, 0, 1.2));
      s.yaw = Math.PI / 2 - 0.55 - 0.25 * ss(B.s2 + 0.3, B.s2 + 0.9, g); s.legPh = ph;
      if (g < 0.6) s.sq = 1 + 0.25 * Math.sin(g * 18) * Math.exp(-g * 4);              // door-burst wobble
      const lw = ss(B.s2 + 0.6, B.s2 + 1.0, g) * (1 - ss(B.s2 + 2.0, B.s2 + 2.4, g));    // lowers the shades: "I am your new CEO"
      s.shades = lw; s.yaw = lerp(s.yaw, 0.05, lw); s.look = [0, 0.2 * lw];
    } else if (g < B.s5) {
      const k = ss(tJump, tLand, g); s.pos.set(lerp(-0.9, 0, k), 0.82 * Math.min(1, k * 1.2) + Math.sin(Math.PI * k) * 0.9, lerp(1.2, 0.15, k)); s.yaw = lerp(0.3, 0, k);
      s.sq = g < tJump ? 1 - 0.25 * ss(B.s3, tJump, g) : g < tLand ? 1 + 0.25 * Math.sin(Math.PI * k) : 1 - 0.28 * Math.exp(-(g - tLand) * 9) * Math.cos((g - tLand) * 20);
      if (g > tLand) s.pos.y = 0.82;
      s.wing = Math.sin(Math.PI * k) * 1.1;
      const slam = g - tLunch; if (slam > -0.35 && slam < 0.6) { s.wing = slam < 0 ? -2.2 * ss(-0.35, -0.05, slam) : -2.2 + 2.6 * ss(0, 0.5, slam); s.sq = slam > 0 ? 1 - 0.18 * Math.exp(-slam * 10) : 1; }
      s.beak = g > W('s4', 'steal') && g < tLunch + 0.3 ? 0.3 : 0;
    } else if (g < B.s6) {
      const slow = (x) => x;                                                                // positions below are already slow-mo spaced
      const k1 = ss(tDive, tGrab, g), k2 = ss(tGrab, tPress, g), k3 = ss(tPress, tPress + 0.6, g);
      const p0 = V(0, 0.82, 0.15), p1 = V(2.15, 1.05, -0.2), p2 = V(4.3, 1.25, -0.6);
      s.pos.copy(p0).lerp(p1, slow(k1)).lerp(p2, k2); s.pos.y += Math.sin(Math.PI * k1) * 0.55 - k3 * 1.0;
      if (g > tPress) s.pos.x = lerp(4.3, 3.9, k3);
      s.yaw = -Math.PI / 2 * ss(tDive - 0.2, tDive + 0.2, g) + 0.0; s.flip = k1 * Math.PI * 2 * (g < tGrab ? 1 : 1);
      s.sq = g > tPress && g < tPress + 0.25 ? 0.55 : 1 + 0.2 * Math.sin(g * 6);
      s.wing = Math.sin(g * 14) * 1.2 * (1 - k3); s.beak = g > tMine - 0.1 && g < tMine + 0.6 ? 0.5 : 0; s.lid = g > tPress ? 0.55 : 1;
      if (g > tPress + 0.6) { s.pos.y = Math.max(0, s.pos.y); s.flip = 0; }
    } else {
      s.pos.set(-3.25, 0.66, -0.4); s.yaw = Math.PI / 2; s.sq = 1 - 0.03 * Math.sin(g * 2); s.shades = 0.2; s.wet = 1;
      s.beak = (g > W('s6', 'quarterly') && g < tDown + 0.4) ? 0.15 + 0.15 * Math.abs(Math.sin(g * 14)) : 0;
    }
    return s;
  }
  function render(t) {
    const g = (TL.t0 || 0) + t;
    const s = pigeonState(g);
    P.root.position.copy(s.pos); P.root.rotation.y = s.yaw; P.body.rotation.z = 0; P.body.rotation.x = s.flip || 0;
    P.body.scale.set(1 / Math.sqrt(s.sq), s.sq, 1 / Math.sqrt(s.sq));
    P.head.position.z = 0.04 + s.bob * 1.8; P.head.rotation.x = -s.bob * 1.5;
    P.wings[0].rotation.z = s.wing * 0.8; P.wings[1].rotation.z = -s.wing * 0.8;
    P.shades.position.y = -0.07 * s.shades; P.shades.rotation.z = s.wet ? 0.12 : 0;
    P.jaw.rotation.x = Math.PI / 2 + s.beak;
    const blink = (Math.sin(g * 2.3) > 0.985) ? 0.1 : s.lid; P.eL.set(blink, s.look, 1); P.eR.set(blink, s.look, 1);
    const ph = s.legPh || 0; P.legs[0].rotation.x = Math.sin(ph) * 0.5 * (g < B.s3 - 0.6 ? 1 : 0); P.legs[1].rotation.x = -Math.sin(ph) * 0.5 * (g < B.s3 - 0.6 ? 1 : 0);
    const gl = Math.exp(-Math.pow((g - (B.s2 + 1.0)) / 0.18, 2)) + Math.exp(-Math.pow((g - tUp) / 0.2, 2)); P.glint.scale.setScalar(0.01 + gl * 1.6); P.glint.rotation.z = g * 3;
    // door bursts open
    const dk = ss(0.1, 0.35, g); doorPivot.rotation.y = -1.9 * back(dk) + 0.08 * Math.sin(g * 25) * Math.exp(-(g - 0.35) * 5) * (g > 0.35 ? 1 : 0);
    // executives
    const fear = ss(B.s3 + 0.2, B.s3 + 1.0, g), shock = Math.exp(-Math.max(0, g - tLunch) * 3) * (g > tLunch ? 1 : 0), chaos = ss(tPress, tPress + 0.4, g) * (g < B.s6 ? 1 : 0.3);
    execs.forEach((e, i) => {
      const shake = (0.012 * fear + 0.05 * shock + 0.03 * chaos) * Math.sin(g * (40 + i * 7));
      e.root.position.x = [-1.4, 0.2, 1.7][i] + shake; e.root.position.y = 0.25 * shock * Math.abs(Math.sin((g - tLunch) * 9));
      const open = 1 + 0.35 * fear + 0.4 * shock + 0.3 * chaos; e.eL.g.scale.setScalar(open); e.eR.g.scale.setScalar(open);
      e.eL.set(1, [0.2 * Math.sin(g + i), 0.1], 1 - 0.45 * fear); e.eR.set(1, [0.2 * Math.sin(g + i), 0.1], 1 - 0.45 * fear);
      e.brows.forEach((b, j) => { b.rotation.z = (j ? -1 : 1) * (0.5 * fear + 0.3 * shock); b.position.y = 0.17 + 0.05 * (fear + shock); });
      e.mouth.scale.set(1.2 - 0.3 * (shock + chaos), 0.25 + 1.4 * Math.max(shock, chaos, 0.2 * fear), 0.4);
      e.arms.forEach((a, j) => { a.rotation.z = (j ? 1 : -1) * (0.2 + 2.4 * Math.max(shock * 0.8, chaos)) * (0.9 + 0.1 * Math.sin(g * 20)); });
      e.head.rotation.z = 0.15 * Math.sin(g * 3 + i) * fear;
    });
    // exec 3 lunges for the sandwich
    const lunge = ss(tDive + 0.4, tGrab, g) * (1 - ss(tPress, tPress + 0.5, g)); execs[2].arms[0].rotation.x = -1.6 * lunge; execs[2].root.position.z = -1.35 + 0.35 * lunge;
    // sandwich: on table, then carried by the pigeon
    if (g > tGrab && g < B.s6) sandwich.position.copy(s.pos).add(V(0.1, 0.15, 0.25)); else if (g >= B.s6) sandwich.position.copy(s.pos).add(V(0.32, 0.12, 0.1)); else sandwich.position.set(2.2, 0.83, -0.25);
    sandwich.rotation.y = g > tGrab ? g * 2 * (g < B.s6 ? 1 : 0) : 0;
    btn.position.x = 4.5 + (g > tPress ? 0.05 : 0);
    // mugs jump on the slam
    mugs.forEach((m, i) => { m.position.y = 0.9 + 0.35 * shock * Math.abs(Math.sin((g - tLunch) * 9 + i)); m.rotation.z = 0.4 * shock * Math.sin(g * 10 + i); });
    // alarm + sprinklers + papers
    const on = g > tPress ? 1 : 0, wet = ss(tPress + 0.1, tPress + 0.6, g);
    alarm.intensity = on * (g < B.s6 + 0.5 ? 18 * (0.5 + 0.5 * Math.sin(g * 14)) : 4 * (0.5 + 0.5 * Math.sin(g * 6)));
    const rain = wet * (g < B.s6 + 2 ? 1 : 1 - ss(B.s6 + 2, B.s6 + 4, g));
    for (let i = 0; i < DROPS; i++) {
      const x = -5 + dseed[i * 3] * 9.5, z = -3.2 + dseed[i * 3 + 1] * 6, y = 4.2 - (((dseed[i * 3 + 2] * 4.2 + g * 6.5) % 4.2));
      const o = i * 6, show = (dseed[i * 3] < rain ? 1 : 0); dpos[o] = x; dpos[o + 1] = y * show + (1 - show) * -5; dpos[o + 2] = z; dpos[o + 3] = x; dpos[o + 4] = (y + 0.18) * show + (1 - show) * -5; dpos[o + 5] = z;
    }
    dgeo.attributes.position.needsUpdate = true;
    papers.forEach((p, i) => { const u = p.userData, k = Math.max(0, g - tPress), fl = k > 0 ? 1 : 0;
      const a = u.a + k * u.sp * 2, y = 0.85 + fl * (u.h * Math.min(1, k * 2.5) * Math.exp(-k * 0.25)) ;
      p.position.set(fl ? Math.cos(a) * u.r * Math.min(1, k * 1.5) + 0.5 : -1.8 + (i % 8) * 0.5, fl ? Math.max(0.02, y) : 0.83 + (i % 5) * 0.004, fl ? Math.sin(a) * u.r * Math.min(1, k * 1.5) - 0.4 : -0.1 - (i % 3) * 0.3);
      p.rotation.set(fl ? k * 3 + i : -Math.PI / 2, fl ? k * 2 : 0, fl ? k * 4 + i : i * 0.3);
      if (g > B.s6) { const st = ss(B.s6 - 0.2, B.s6 + 0.3, g); p.position.y = lerp(p.position.y, 0.02, st); p.rotation.x = lerp(p.rotation.x, -Math.PI / 2, st); p.rotation.y *= 1 - st; } });   // papers have settled for the punchline
    // camera
    const C = cam(g, s); camera.position.copy(C.p); camera.lookAt(C.l); camera.fov = C.fov || 42; camera.updateProjectionMatrix();
    if (shock > 0.05) camera.position.add(V(Math.sin(g * 60) * 0.03 * shock, Math.cos(g * 47) * 0.03 * shock, 0));
    renderer.render(scene, camera);
  }
  function cam(g, s) {
    if (g < B.s2) { const k = ss(0, B.s2, g); return { p: V(lerp(-3.0, -2.6, k), lerp(0.25, 0.5, k), lerp(3.4, 3.0, k)), l: V(lerp(-4.8, s.pos.x, ss(0.6, 2.0, g)), 0.55, lerp(1.5, s.pos.z, ss(0.6, 2.0, g))), fov: 45 }; }
    if (g < B.s3) { const k = ss(B.s2, B.s2 + 1.2, g); const h = s.pos.clone().add(V(0, 0.8, 0)); return { p: h.clone().add(V(lerp(1.4, 0.2, k), lerp(0.15, 0.05, k), lerp(1.8, 1.45, k))), l: h.clone().add(V(0, -0.05, 0)), fov: lerp(42, 34, k) }; }
    if (g < B.s4) { const k = ss(B.s3, B.s4, g); return { p: V(0, lerp(1.9, 1.7, k), lerp(4.6, 4.0, k)), l: V(0, 1.0, -0.6), fov: 46 }; }
    if (g < B.s5) { const k = ss(B.s4, B.s5, g); return { p: V(lerp(0.5, 0.2, k), 0.95, lerp(1.9, 1.6, k)), l: V(0, 1.25, 0.1), fov: 40 }; }
    if (g < tGrab) { const h = s.pos.clone(); return { p: V(h.x - 0.4, 1.4, 2.3), l: h.clone().add(V(0.3, 0.1, 0)), fov: 40 }; }
    if (g < tPress) { const k = ss(tGrab, tPress, g); return { p: V(lerp(2.3, 2.7, k), 1.6, 2.0), l: V(lerp(3.3, 4.0, k), 1.2, -0.45), fov: 50 }; }   // the button is in frame before he hits it
    if (g < B.s6) { const k = ss(tPress, tPress + 1.2, g); return { p: V(lerp(2.2, 0.3, k), lerp(1.5, 2.4, k), lerp(1.6, 5.2, k)), l: V(lerp(4.0, 0.6, k), 1.2, -0.5), fov: 48 }; }
    const k = ss(B.s6, B.end, g); return { p: V(lerp(-0.8, -1.55, k), lerp(1.3, 1.1, k), lerp(0.7, -0.05, k)), l: V(-3.25, 1.0, -0.4), fov: lerp(44, 38, k) };
  }
  return { renderer, render };
}

function skyTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#4aa8ff'); gr.addColorStop(0.6, '#ffc58a'); gr.addColorStop(1, '#ff8f6b'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textTex(text, fg, bg) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = fg; g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 135);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
