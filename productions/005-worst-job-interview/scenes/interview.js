// THE WORST JOB INTERVIEW IN HISTORY — cel-shaded 2.5D cartoon. One continuous set; every gesture, lip flap and cut is
// keyed to the measured dialogue (params.timeline). Two original characters: GARY (candidate) and MR. PRYCE (interviewer).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const cl = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp, V = (x, y, z) => new THREE.Vector3(x, y, z);
let GRAD = null;
const T = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD, ...o });
const sph = (r, m, s = [1, 1, 1], seg = 24) => { const x = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m); x.scale.set(...s); x.castShadow = true; return x; };
const box = (w, h, d, m, r = 0.03) => { const x = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m); x.castShadow = x.receiveShadow = true; return x; };
const cyl = (r1, r2, h, m) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), m); x.castShadow = true; return x; };

function eye(r, iris, lidC) {
  const g = new THREE.Group();
  g.add(sph(r, T('#ffffff')));
  const pu = sph(r * 0.42, T(iris), [1, 1, 0.45]); pu.position.z = r * 0.78; g.add(pu);
  const hl = sph(r * 0.12, new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(r * 0.22, r * 0.25, r * 0.98); g.add(hl);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.07, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), T(lidC)); g.add(lid);
  return { g, set(open, look = [0, 0], size = 1) {
    lid.rotation.x = -Math.PI / 2 + (1 - cl(open)) * 1.45 - 0.2; pu.position.set(look[0] * r * 0.32, look[1] * r * 0.3, r * 0.78); pu.scale.setScalar(size); hl.position.set(look[0] * r * 0.32 + r * 0.22, look[1] * r * 0.3 + r * 0.25, r * 0.98);
  } };
}

function person(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = sph(o.w, T(o.suit), [1, o.tall, 0.8]); torso.position.y = o.hip + o.w * o.tall * 0.9; body.add(torso);
  const neckY = o.hip + o.w * o.tall * 1.8;
  const head = new THREE.Group(); head.position.y = neckY + o.head * 0.85; body.add(head);
  head.add(sph(o.head, T(o.skin), o.headS));
  const eL = eye(o.eye, '#1b1b1b', o.skin), eR = eye(o.eye, '#1b1b1b', o.skin);
  eL.g.position.set(-o.eye * 1.15, o.head * 0.18, o.head * 0.78); eR.g.position.set(o.eye * 1.15, o.head * 0.18, o.head * 0.78); head.add(eL.g, eR.g);
  const brows = [-1, 1].map((s) => { const b = box(o.eye * 1.6, o.eye * 0.32, 0.03, T(o.hair), 0.012); b.position.set(s * o.eye * 1.15, o.head * 0.18 + o.eye * 1.35, o.head * 0.86); head.add(b); return b; });
  const mouth = sph(o.head * 0.22, T('#5a1420'), [1.4, 0.18, 0.5]); mouth.position.set(0, -o.head * 0.42, o.head * 0.86); head.add(mouth);
  const nose = sph(o.head * 0.16, T(o.nose || o.skin), [1, 1.1, 1.1]); nose.position.set(0, -o.head * 0.1, o.head * 0.98); head.add(nose);
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * o.w * 0.95, neckY - 0.08, 0); const u = sph(0.065, T(o.suit), [1, 3.4, 1]); u.position.y = -0.2; a.add(u);
    const h = sph(0.065, T(o.skin)); h.position.y = -0.43; a.add(h); body.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Group(); l.position.set(s * o.w * 0.45, o.hip, 0); const u = sph(0.075, T(o.pants || o.suit), [1, o.hip / 0.15, 1]); u.position.y = -o.hip / 2; l.add(u);
    const sh = sph(0.09, T('#2b1d14'), [1, 0.6, 1.6]); sh.position.set(0, -o.hip + 0.04, 0.05); l.add(sh); root.add(l); return l; });
  return { root, body, head, eL, eR, brows, mouth, arms, legs, torso };
}

function poster(text1, text2) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 768; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, '#0b1a4a'); gr.addColorStop(1, '#5a2a8a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 768);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect((i * 97) % 512, (i * 53) % 520, 3, 3); }
  g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(360, 220, 90, 0, 7); g.fill(); g.fillStyle = '#ffd88a'; g.beginPath(); g.arc(330, 195, 30, 0, 7); g.fill();
  g.fillStyle = '#e8e8f0'; g.beginPath(); g.moveTo(150, 520); g.lineTo(190, 360); g.lineTo(230, 520); g.fill(); g.fillStyle = '#e23b3b'; g.fillRect(170, 520, 40, 40);
  g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText(text1, 256, 640); g.font = 'bold 34px sans-serif'; g.fillText(text2, 256, 700);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function label(text, fg, bg, w = 512, h = 128, size = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function build({ params }) {
  const TL = params.timeline; const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
  const st = (id) => S[id].start, en = (id) => S[id].start + S[id].slot;
  const key = (w) => w.toLowerCase().replace(/[^a-z']/g, '');
  const W = (sc, w) => { const x = TL.words.find((q) => q.scene === sc && key(q.word) === w); return x ? x.start : st(sc); };
  const { width = 1080, height = 1920 } = window.ODDLIGHT || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const gc = document.createElement('canvas'); gc.width = 4; gc.height = 1; const gg = gc.getContext('2d'); ['#555', '#999', '#ddd', '#fff'].forEach((c, i) => { gg.fillStyle = c; gg.fillRect(i, 0, 1, 1); });
  GRAD = new THREE.CanvasTexture(gc); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#ffe9c2');
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
  scene.add(new THREE.AmbientLight('#ffffff', 0.9));
  const key1 = new THREE.DirectionalLight('#fff3dd', 2.2); key1.position.set(2.5, 5, 4); key1.castShadow = true; key1.shadow.mapSize.set(1024, 1024);
  Object.assign(key1.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 15 }); scene.add(key1);
  // set: warm office, window, space poster, plant, clock
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), T('#c9a27a')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), T('#7fc4c9')); wall.position.set(0, 3, -2.2); wall.receiveShadow = true; scene.add(wall);
  const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), T('#f2b880')); wall2.rotation.y = Math.PI / 2; wall2.position.set(-2.6, 3, 1); scene.add(wall2);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.9), T('#5aa7ad')); stripe.position.set(0, 0.45, -2.19); scene.add(stripe);
  const post = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), new THREE.MeshBasicMaterial({ map: poster('JOIN US', 'SPACE AGENCY') })); post.position.set(0.9, 2.1, -2.18); scene.add(post);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), T('#bfe9ff', { emissive: '#7fc8ff', emissiveIntensity: 0.4 })); win.position.set(-1.0, 2.2, -2.18); scene.add(win);
  const clockF = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), T('#ffffff')); clockF.position.set(2.1, 2.6, -2.17); scene.add(clockF);
  const hand = box(0.02, 0.16, 0.01, T('#222')); hand.geometry.translate(0, 0.07, 0); hand.position.set(2.1, 2.6, -2.15); scene.add(hand);
  const pot = cyl(0.18, 0.13, 0.35, T('#d0603c')); pot.position.set(-2.0, 0.18, -1.7); scene.add(pot);
  for (let i = 0; i < 7; i++) { const lf = sph(0.12, T('#3fa34d'), [0.5, 2.0, 0.3]); lf.position.set(-2.0 + Math.sin(i * 0.9) * 0.12, 0.6, -1.7 + Math.cos(i * 0.9) * 0.12); lf.rotation.z = Math.sin(i * 0.9) * 0.5; scene.add(lf); }
  const desk = box(2.0, 0.1, 1.0, T('#8a4b2a'), 0.04); desk.position.set(0.55, 0.78, -0.6); scene.add(desk);
  const deskFront = box(1.9, 0.72, 0.06, T('#6b3720'), 0.02); deskFront.position.set(0.55, 0.38, -0.12); scene.add(deskFront);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: label('MR. PRYCE', '#2b1a10', '#e8c66a', 512, 128, 60) })); plate.position.set(0.55, 0.9, -0.24); plate.rotation.x = -0.3; scene.add(plate);
  const clip = box(0.3, 0.02, 0.4, T('#c58b4b')); clip.position.set(0.85, 0.85, -0.5); scene.add(clip);
  const paper = box(0.26, 0.01, 0.34, T('#ffffff')); paper.position.set(0.85, 0.865, -0.5); scene.add(paper);
  const mug = cyl(0.06, 0.05, 0.13, T('#ffffff')); mug.position.set(0.1, 0.9, -0.75); scene.add(mug);
  const chairI = box(0.6, 1.1, 0.12, T('#2c3e66'), 0.05); chairI.position.set(0.55, 1.0, -1.45); scene.add(chairI);
  // the candidate's chair (which he will miss)
  const chairC = new THREE.Group(); const cs = box(0.5, 0.08, 0.5, T('#d94f3d'), 0.03); cs.position.y = 0.48; chairC.add(cs);
  const cb = box(0.5, 0.55, 0.07, T('#d94f3d'), 0.03); cb.position.set(0, 0.78, -0.22); chairC.add(cb);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const l = cyl(0.02, 0.02, 0.46, T('#444')); l.position.set(x, 0.23, z); chairC.add(l); }
  chairC.position.set(0.0, 0, 0.85); chairC.rotation.y = Math.PI; scene.add(chairC);
  // MR. PRYCE: tall, thin, grey, glasses, permanently tired
  const P = person({ w: 0.24, tall: 1.6, hip: 0.5, head: 0.24, headS: [0.85, 1.25, 0.9], eye: 0.06, skin: '#e9c6a6', suit: '#2f3a4f', hair: '#9a9a9a', pants: '#2f3a4f', nose: '#d9a689' });
  const hairP = sph(0.24, T('#b0b0b0'), [0.88, 0.5, 0.9]); hairP.position.y = 0.2; P.head.add(hairP);
  const glasses = new THREE.Group(); for (const x of [-0.07, 0.07]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 24), T('#222')); r.position.set(x, 0.045, 0.235); glasses.add(r); } P.head.add(glasses);
  const tieP = box(0.05, 0.22, 0.02, T('#8a1c2b'), 0.01); tieP.position.set(0, 1.2, 0.19); P.body.add(tieP);
  P.root.position.set(0.55, 0, -1.1); scene.add(P.root);
  P.legs.forEach((l) => { l.rotation.x = -Math.PI / 2; l.position.y = 0.5; });   // seated
  P.body.position.y = 0.02;
  const sweat = sph(0.03, T('#8fd4ff', { transparent: true, opacity: 0.9 }), [1, 1.5, 1]); sweat.position.set(0.18, 0.12, 0.15); P.head.add(sweat);
  // GARY: short, round, huge head, pompadour, colander helmet, cardboard "ASTRONOT" badge
  const G = person({ w: 0.27, tall: 1.05, hip: 0.42, head: 0.33, headS: [1.05, 1, 1], eye: 0.095, skin: '#ffcf9e', suit: '#ff7a1a', hair: '#5a3210', pants: '#ff7a1a', nose: '#ff9e7a' });
  const pomp = sph(0.2, T('#5a3210'), [1.3, 0.7, 1.5]); pomp.position.set(0, 0.33, 0.1); G.head.add(pomp);
  const colander = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), T('#c9ced6')); colander.position.y = 0.06; colander.castShadow = true; G.head.add(colander);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI), T('#9aa0a8')); handle.position.set(0.34, 0.12, 0); handle.rotation.y = Math.PI / 2; G.head.add(handle);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: label('ASTRONOT', '#1c2a6b', '#f7e7c4', 512, 160, 84) })); badge.position.set(0.0, 0.85, 0.235); badge.rotation.x = -0.15; G.body.add(badge);
  const backpack = box(0.36, 0.42, 0.18, T('#b98a57'), 0.02); backpack.position.set(0, 0.8, -0.27); G.body.add(backpack);
  for (const x of [-0.1, 0.1]) { const b = cyl(0.06, 0.06, 0.38, T('#56c1e8', { transparent: true, opacity: 0.85 })); b.position.set(x, 0.82, -0.42); G.body.add(b); }
  G.root.position.set(-0.45, 0, 0.75); scene.add(G.root);
  const dots = []; for (let i = 0; i < 3; i++) { const s = sph(0.035, T('#ffe14a')); scene.add(s); dots.push(s); }      // dizzy stars after the fall

  // who speaks when (lip flap from measured words)
  const talk = (who, g) => { for (const w of TL.words) { if (w.scene[0] !== who) continue; if (g >= w.start - 0.02 && g <= w.end + 0.02) return 0.35 + 0.65 * Math.abs(Math.sin((g - w.start) * 17)); } return 0; };
  const tFallStart = W('c4', 'well') + 0.55, tImpact = W('c4', 'well') + 1.25, tUp = st('i6') - 0.1;
  const tHired = W('i7', "you're"), tFacePlant = W('c8', 'appointment') + 0.75;

  function render(t) {
    const g = (TL.t0 || 0) + t;
    const fatigue = cl(g / 56);                                       // Mr. Pryce slowly loses the will to live
    // ---------- GARY ----------
    let gx = -0.45, gz = 0.75, gy = 0, tilt = 0, yaw = 0.55, sq = 1, armL = 0.35, armR = 0.35, armRx = 0, browUp = 0.15, look = [0.3, 0.05], open = 1, mouthW = 1;
    const idle = Math.sin(g * 2.2) * 0.02;
    // confident hands-on-hips, chest out; punchline eyebrow waggle
    for (const id of ['c1', 'c2', 'c3', 'c6', 'c7', 'c8']) { const a = st(id), b = en(id); if (g > a && g < b) browUp = 0.15 + 0.35 * Math.abs(Math.sin(g * 6)) * ss(a, a + 0.3, g); }
    if (g > st('c3') && g < en('c3')) { armR = 2.6 * Math.abs(Math.sin((g - st('c3')) * 2.2)); armL = 0.4 + 0.8 * ss(W('c3', 'funeral') - 0.4, W('c3', 'funeral'), g); look = [0.15, 0.25]; }
    if (g > st('c1') && g < en('c1')) { armR = 2.4; sq = 1 + 0.08 * Math.sin((g - st('c1')) * 20) * Math.exp(-(g - st('c1')) * 3); }   // thumbs-up "Absolutely."
    // the chair gag
    if (g > tFallStart - 0.4 && g < tUp + 0.6) {
      const turn = ss(tFallStart - 0.4, tFallStart, g); yaw = lerp(0.55, -0.35, turn);
      const drop = ss(tFallStart, tImpact, g); gx = lerp(-0.45, -0.75, drop); gz = lerp(0.75, 0.95, drop); gy = -0.0;
      tilt = lerp(0, -1.45, Math.pow(drop, 1.6)); sq = g > tImpact && g < tImpact + 0.35 ? 1 - 0.3 * Math.exp(-(g - tImpact) * 12) * Math.cos((g - tImpact) * 40) : 1;
      armL = armR = 0.35 + 2.2 * Math.sin(Math.PI * drop); open = g > tImpact && g < tImpact + 1.2 ? 0.55 : 1; look = [0, 0.4];
      if (g > W('c5', 'demonstration') - 0.6 && g < en('c5')) { armR = 2.9; browUp = 0.5; }     // thumbs up from the floor
      const up = ss(tUp, tUp + 0.6, g); tilt = lerp(tilt, 0, up); gx = lerp(gx, -0.45, up); gz = lerp(gz, 0.75, up); sq = up > 0 && up < 1 ? 1 + 0.2 * Math.sin(Math.PI * up) : sq;
    }
    if (g > st('c6') && g < en('c6')) { gz = 0.75 - 0.15 * ss(st('c6'), st('c6') + 0.6, g); armRx = -1.3 * ss(W('c6', 'tell') - 0.3, W('c6', 'tell'), g); armR = 0.5; browUp = -0.2; look = [0.35, 0.1]; }
    if (g > st('i7') && g < st('c7')) { browUp = 0.15 + 0.4 * (Math.sin(g * 9) > 0.6 ? 1 : 0); look = [0.35, 0.05]; }                 // smug eyebrow waggle in the silence
    if (g > st('c7') && g < en('c7')) { const k = (g - st('c7')) / 0.9; gy = Math.max(0, Math.sin(Math.PI * cl(k)) * 0.35); armL = armR = 2.8; sq = 1 + 0.18 * Math.sin(Math.PI * cl(k)); }
    if (g > st('c8')) { const a = st('c8'); armL = armR = 0.35 + 1.0 * ss(a + 0.2, a + 0.6, g) * (1 - ss(W('c8', 'dentist'), W('c8', 'dentist') + 0.5, g)); browUp = 0.5 * ss(a, a + 0.4, g); look = [0.1, 0.2]; }
    G.root.position.set(gx, gy, gz); G.root.rotation.y = yaw; G.root.rotation.x = tilt;
    G.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); G.body.position.y = idle;
    G.arms[0].rotation.z = -armL; G.arms[1].rotation.z = armR; G.arms[1].rotation.x = armRx;
    G.legs[0].rotation.x = tilt < -0.5 ? 1.2 : 0; G.legs[1].rotation.x = tilt < -0.5 ? 0.6 : 0;
    G.brows.forEach((b, i) => { b.position.y = 0.33 * 0.18 + 0.095 * 1.35 + browUp * 0.06; b.rotation.z = (i ? -1 : 1) * browUp * 0.25; });
    const gt = talk('c', g); G.mouth.scale.set(1.4 * mouthW, 0.18 + 1.1 * gt, 0.5);
    const gBlink = (Math.sin(g * 1.7 + 1) > 0.992) ? 0.05 : open; G.eL.set(gBlink, look, 1.15); G.eR.set(gBlink, look, 1.15);
    G.head.rotation.z = Math.sin(g * 1.3) * 0.05 + (gt > 0 ? Math.sin(g * 5) * 0.06 : 0);
    const dz = g > tImpact && g < tUp ? 1 : 0; dots.forEach((d, i) => { const a = g * 4 + i * 2.09; d.visible = !!dz; d.position.set(gx - 0.35 + Math.cos(a) * 0.25, 0.32, gz + 0.2 + Math.sin(a) * 0.25); });
    // ---------- MR. PRYCE ----------
    const pt = talk('i', g);
    let pLid = 0.85 - 0.4 * fatigue, pBrow = -0.05, pLook = [-0.3, -0.05], pHead = 0, pPitch = 0, pArm = 0.25;
    if (g > W('c2', 'ikea') && g < en('i3')) { pBrow = 0.45; pLid = 0.95; }                                                       // single raised eyebrow
    if (g > tImpact - 0.2 && g < st('c5') + 0.5) { pLook = [-0.4, -0.55]; pPitch = 0.35; pLid = 0.6; }                           // looks down at Gary on the floor
    if (g > st('c6') && g < st('c7')) { pLid = lerp(0.5, 0.3, ss(st('i7'), tHired, g)); pLook = [-0.3, 0]; }                    // the long stare
    const twitch = g > st('i7') + 0.8 && g < tHired ? (Math.sin(g * 40) > 0.7 ? 0.25 : 0) : 0;
    sweat.visible = g > st('i7') + 0.5 && g < en('i8'); sweat.position.y = 0.12 - ((g * 0.15) % 0.12);
    let plant = 0; if (g > tFacePlant - 0.35) { plant = ss(tFacePlant - 0.35, tFacePlant, g); }                                // face-plant on the desk
    P.head.rotation.x = pPitch + plant * 1.25; P.body.rotation.x = plant * 0.55; P.head.rotation.y = 0.35;
    P.root.rotation.y = -0.45 + 0.05 * Math.sin(g * 0.7);
    P.eL.set(pLid - twitch, pLook, 0.85); P.eR.set(pLid, pLook, 0.85);
    P.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * -0.15 + (i === 1 ? pBrow : 0); b.position.y = 0.24 * 0.18 + 0.06 * 1.35 + (i === 1 ? pBrow * 0.08 : 0); });
    P.mouth.scale.set(1.1, 0.12 + 0.75 * pt, 0.5);
    P.arms[1].rotation.z = pArm + (pt > 0 ? 0.25 * Math.sin(g * 3) : 0); P.arms[0].rotation.z = -pArm; P.arms[1].rotation.x = -0.9; P.arms[0].rotation.x = -0.9;
    hand.rotation.z = -g * 0.8;
    // ---------- camera: shot / reverse shot / reaction ----------
    const Gh = V(gx, 1.15 + gy, gz), Ph = V(0.55, 1.45, -1.1);
    const shot = (id) => g >= st(id) && g < en(id);
    let p, l, fov = 38;
    if (shot('i1')) { const k = ss(st('i1'), en('i1'), g); p = V(lerp(1.6, 1.2, k), lerp(1.7, 1.55, k), lerp(4.6, 3.7, k)); l = V(0.0, 1.05, -0.2); fov = 44; }
    else if (shot('c1') || shot('c2')) { p = Gh.clone().add(V(0.55, 0.02, 1.15)); l = Gh.clone().add(V(0, 0.02, 0)); fov = 34; }
    else if (shot('i2') || shot('i3') || shot('i8')) { p = Ph.clone().add(V(-0.5, 0.0, 1.05)); l = Ph.clone().add(V(0, -0.02, 0)); fov = 30; }
    else if (shot('c3')) { const k = ss(st('c3'), en('c3'), g); p = V(lerp(1.3, 0.75, k), 1.4, lerp(2.4, 1.7, k)); l = Gh.clone().add(V(0, 0.05, 0)); fov = 36; }
    else if (shot('i4')) { p = V(-0.6, 1.5, 2.2); l = Ph; fov = 32; }
    else if (shot('c4')) { const k = ss(tFallStart - 0.5, tImpact + 0.3, g); p = V(lerp(1.0, 1.6, k), lerp(1.5, 1.3, k), lerp(2.8, 3.4, k)); l = V(lerp(-0.2, gx, k), lerp(1.0, 0.45, k), lerp(0.4, gz, k)); fov = lerp(42, 48, k); }
    else if (shot('i5')) { const k = ss(st('i5'), en('i5'), g); p = V(-0.9, 1.2, 1.4).lerp(V(-0.6, 1.3, 0.9), k); l = Ph; fov = 30; }
    else if (shot('c5')) { p = V(gx + 0.6, 1.5, gz + 1.5); l = V(gx, 0.3, gz); fov = 40; }
    else if (shot('i6')) { p = V(1.4, 1.6, 3.4); l = V(0.0, 1.1, -0.2); fov = 42; }
    else if (shot('c6')) { const k = ss(st('c6'), en('c6'), g); p = Gh.clone().add(V(0.5, 0.02, lerp(1.2, 0.8, k))); l = Gh.clone().add(V(0, 0.03, 0)); fov = lerp(36, 30, k); }
    else if (shot('i7')) { const k = ss(st('i7'), tHired, g); p = V(-0.2, 1.48, lerp(1.8, 0.45, k)); l = Ph.clone().add(V(0, 0.02, 0)); fov = lerp(36, 26, k); }
    else if (shot('c7')) { p = V(1.0, 1.4, 3.6); l = V(-0.2, 1.1, 0.2); fov = 42; }
    else if (shot('c8')) { const wide = g > tFacePlant - 0.6; p = wide ? V(1.3, 1.6, 3.6) : Gh.clone().add(V(0.55, 0.02, 1.15)); l = wide ? V(0.2, 1.0, -0.5) : Gh.clone().add(V(0, 0.02, 0)); fov = wide ? 44 : 32; }
    else { p = V(1.3, 1.6, 3.6); l = V(0.2, 1.0, -0.5); fov = 44; }
    camera.position.copy(p); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix();
    if (g > tImpact && g < tImpact + 0.3) camera.position.y += 0.03 * Math.sin(g * 80);
    if (g > tFacePlant && g < tFacePlant + 0.25) camera.position.y += 0.025 * Math.sin(g * 80);
    renderer.render(scene, camera);
  }
  return { renderer, render };
}
