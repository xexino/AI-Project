// Free-fall hadal research lander (illustrative): aluminium frame, two buoyancy spheres in yellow hard hats, camera
// housing, two LED lamp heads, a ballast weight, a mesh bait bag and an analogue pressure gauge. The gauge dial carries
// tick marks only (no numbers), so it never adds on-screen text. Units: metres; origin = bottom centre of the frame.
import * as THREE from 'three';

function dialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#d9d6cc'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#262626'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i <= 40; i++) {                      // 270° scale, major tick every 5
    const a = (-225 + i * 270 / 40) * Math.PI / 180, r0 = i % 5 ? 100 : 86;
    g.lineWidth = i % 5 ? 2 : 5; g.strokeStyle = i >= 34 ? '#9b2f22' : '#262626';
    g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeLander(scene, { lampColor = '#dfe9ff' } = {}) {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: '#9aa0a3', roughness: 0.45, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.6, metalness: 0.3 });
  const hat = new THREE.MeshStandardMaterial({ color: '#c99626', roughness: 0.55 });
  const tube = (a, b, r = 0.022) => {
    const v = new THREE.Vector3().subVectors(b, a); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 10), alu);
    m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); g.add(m);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const legs = [V(-0.45, 0, -0.45), V(0.45, 0, -0.45), V(0.45, 0, 0.45), V(-0.45, 0, 0.45)];
  for (let i = 0; i < 4; i++) {
    const a = legs[i], b = legs[(i + 1) % 4];
    tube(a, a.clone().setY(1.75)); tube(a, b); tube(a.clone().setY(0.9), b.clone().setY(0.9)); tube(a.clone().setY(1.75), b.clone().setY(1.75));
  }
  for (const x of [-0.24, 0.24]) {                     // buoyancy spheres in hard hats on top
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hat); s.position.set(x, 1.78, 0); g.add(s);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark); s2.position.set(x, 1.78, 0); g.add(s2);
  }
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 24), dark); cam.rotation.z = Math.PI / 2; cam.position.set(-0.3, 1.25, 0.12); g.add(cam);
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), dark); ballast.position.set(0, -0.06, 0); g.add(ballast);
  // pressure gauge on the +x face
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 40), alu); housing.rotation.z = Math.PI / 2; housing.position.set(0.5, 1.05, 0); g.add(housing);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.115, 48), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.35 }));
  face.rotation.y = Math.PI / 2; face.position.set(0.536, 1.05, 0); g.add(face);
  const needle = new THREE.Group(); needle.position.set(0.54, 1.05, 0); needle.rotation.y = Math.PI / 2;
  const nm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.095, 0.004), new THREE.MeshStandardMaterial({ color: '#111111' })); nm.position.y = 0.04; needle.add(nm);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), dark); hub.rotation.x = Math.PI / 2; needle.add(hub);
  g.add(needle);
  // lamp heads: A down over the bait, B outward (-x) across the water in front of the lander
  const lampA = { at: V(-0.42, 1.55, 0.05), dir: V(-0.35, -1, 0.05).normalize() };
  const lampB = { at: V(-0.42, 1.45, -0.2), dir: V(-1, -0.28, -0.32).normalize() };
  const lights = [];
  for (const L of [lampA, lampB]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 20), dark); head.position.copy(L.at);
    head.quaternion.setFromUnitVectors(V(0, -1, 0), L.dir); g.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(lampColor).multiplyScalar(2.5), fog: false }));
    lens.position.copy(L.at).addScaledVector(L.dir, 0.062); lens.lookAt(lens.position.clone().add(L.dir)); g.add(lens);
    const sp = new THREE.SpotLight(lampColor, 0, 40, 0.55, 0.6, 1.3); sp.position.copy(L.at); sp.target.position.copy(L.at.clone().addScaledVector(L.dir, 5));
    g.add(sp, sp.target); lights.push(sp);
  }
  // bait bag hanging on the -x side
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), new THREE.MeshStandardMaterial({ color: '#3f322a', roughness: 0.95 }));
  bag.scale.set(1, 1.25, 1); bag.position.set(-0.62, 0.38, 0.05); g.add(bag);
  const net = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 9), new THREE.MeshBasicMaterial({ color: '#bfb7a8', wireframe: true, transparent: true, opacity: 0.35 }));
  net.scale.copy(bag.scale); net.position.copy(bag.position); g.add(net);
  tube(V(-0.45, 0.9, 0.05), V(-0.62, 0.5, 0.05), 0.006);
  scene.add(g);
  return {
    group: g, lights, lampA, lampB, bait: bag.position.clone(), gauge: V(0.54, 1.05, 0),
    setGauge(k) { needle.rotation.z = THREE.MathUtils.degToRad(135 - 270 * THREE.MathUtils.clamp(k, 0, 1)); },   // spin in the dial plane
    setLamps(k) { lights[0].intensity = 14 * k; lights[1].intensity = 45 * k; },   // A: close over the bait, B: long throw
    world(v) { return v.clone().applyMatrix4(g.matrixWorld); },
  };
}
