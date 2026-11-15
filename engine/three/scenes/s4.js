// S4 STORY — the problem: no bones to count. Dark lab table, single warm desk lamp (the "odd light").
import * as THREE from 'three';
import { makeRenderer, marineSnow, ease, rng } from '../lib/core.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.05);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#06090b'); scene.fog = new THREE.Fog('#06090b', 6, 16);
  const cam = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 50);
  scene.add(new THREE.HemisphereLight('#20333a', '#000000', 0.25));
  // table
  const woodTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#2a1d14'; g.fillRect(0, 0, 512, 512); const r = rng(5);
    for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(${20 + r() * 30},${12 + r() * 16},${6 + r() * 8},${0.25 + r() * 0.3})`; g.lineWidth = 1 + r() * 3;
      g.beginPath(); const y = r() * 512; g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 }));
  table.rotation.x = -Math.PI / 2; scene.add(table);
  // desk lamp
  const metal = new THREE.MeshStandardMaterial({ color: '#1b1e20', roughness: 0.4, metalness: 0.7 });
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 40), metal); base.position.y = 0.03; lamp.add(base);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 12), metal); arm1.position.set(0, 0.8, 0); arm1.rotation.z = 0.35; lamp.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 12), metal); arm2.position.set(-0.55, 1.75, 0); arm2.rotation.z = -1.1; lamp.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.45, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#16191b', roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
  shade.position.set(0.0, 2.05, 0); lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd09a').multiplyScalar(3) }));
  bulb.position.set(0.0, 1.86, 0); lamp.add(bulb);
  lamp.position.set(-1.5, 0, -0.9); scene.add(lamp);
  const spot = new THREE.SpotLight('#ffa860', 32, 12, 0.75, 0.6, 1.2); spot.position.set(-1.5, 1.85, -0.9); spot.target.position.set(0.3, 0, 0.4);
  scene.add(spot, spot.target);
  // notebook with tally marks, crossed out (no readable text)
  const nbTex = (() => { const c = document.createElement('canvas'); c.width = 768; c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = '#e4dccb'; g.fillRect(0, 0, 768, 1024); g.strokeStyle = 'rgba(70,110,130,0.35)'; g.lineWidth = 2;
    for (let y = 90; y < 1024; y += 46) { g.beginPath(); g.moveTo(40, y); g.lineTo(728, y); g.stroke(); }
    g.strokeStyle = '#2a2622'; g.lineCap = 'round'; const r = rng(9);
    for (let row = 0; row < 7; row++) { const y0 = 140 + row * 120;
      for (let grp = 0; grp < 3 + (row % 3); grp++) { const x0 = 80 + grp * 150; g.lineWidth = 5;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x0 + k * 22 + r() * 3, y0 - 34); g.lineTo(x0 + k * 22 + r() * 3, y0 + 30); g.stroke(); }
        g.beginPath(); g.moveTo(x0 - 10, y0 + 22); g.lineTo(x0 + 82, y0 - 26); g.stroke(); }
      g.strokeStyle = '#8a2a1a'; g.lineWidth = 7; g.beginPath(); g.moveTo(60, y0 + 4 + r() * 6); g.lineTo(660, y0 - 4 - r() * 6); g.stroke(); g.strokeStyle = '#2a2622'; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const nb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 2.0), [metal, metal, new THREE.MeshStandardMaterial({ map: nbTex, roughness: 0.9 }), metal, metal, metal]);
  nb.material[0] = nb.material[1] = nb.material[4] = nb.material[5] = new THREE.MeshStandardMaterial({ color: '#d8d0bf', roughness: 0.9 });
  nb.position.set(0.55, 0.02, 0.6); nb.rotation.y = -0.18; scene.add(nb);
  // specimen dish with a pale cartilage disc (no growth rings to count)
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe3e6', transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1 });
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 48, 1, true), glass); dish.position.set(-0.55, 0.04, 1.0); scene.add(dish);
  const dishBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.01, 48), glass); dishBase.position.set(-0.55, 0.005, 1.0); scene.add(dishBase);
  const cart = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 40), new THREE.MeshPhysicalMaterial({ color: '#d9d4c4', roughness: 0.35, transmission: 0, sheen: 0.5, clearcoat: 0.6 }));
  cart.position.set(-0.55, 0.05, 1.0); scene.add(cart);
  for (const [x, z] of [[-1.15, 0.2], [-1.0, 0.0]]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 24, 1, true), glass); v.position.set(x, 0.28, z); scene.add(v);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 24), new THREE.MeshStandardMaterial({ color: '#6f8f8a', transparent: true, opacity: 0.55 })); liq.position.set(x, 0.15, z); scene.add(liq);
  }
  // dust motes in the lamp light
  const motes = marineSnow(scene, { n: 900, box: [3, 2.2, 3], center: [-0.4, 1.0, 0.2], size: 0.012, fall: 0.03, cold: '#3a3632', warm: '#ffc58a',
    beam: (x, y, z) => Math.max(0, 1 - Math.hypot(x + 0.6, z - 0.1) / 1.4) });
  return { renderer, render(t) {
    const pe = ease(t / dur);
    cam.position.set(-0.6 + pe * 0.9, 3.4 - pe * 0.25, 3.6 - pe * 0.3);
    cam.lookAt(0.0 + pe * 0.5, 0, 0.55);
    spot.intensity = 32 * (1 + 0.03 * Math.sin(t * 7.0) * Math.sin(t * 3.1));
    motes.update(t); renderer.render(scene, cam);
  } };
}
