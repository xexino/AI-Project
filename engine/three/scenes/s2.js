// S2 SETUP — side profile tracking shot, rim light from above, particles parallax.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, iceCeiling, marineSnow, ease } from '../lib/core.js';
import { makeShark } from '../lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.45), scene = underwaterScene(0.06);
  const cam = new THREE.PerspectiveCamera(38, 1080 / 1920, 0.1, 200);
  iceCeiling(scene, { y: 7, holeR: 0 });
  const top = new THREE.SpotLight('#ffb27a', 110, 30, 0.45, 0.9, 1.5); scene.add(top, top.target);
  const fill = new THREE.PointLight('#3b7f8c', 26, 24, 1.2); scene.add(fill);
  const snow = marineSnow(scene, { n: 5000, box: [40, 14, 16], center: [6, 0, 0], size: 0.05, cold: '#24505a' });
  const shark = makeShark({ amp: 0.12 }); scene.add(shark.group);
  return { renderer, render(t) {
    const x = t * 0.85;
    shark.group.position.set(x, Math.sin(t * 0.5) * 0.06, 0); shark.group.rotation.set(0, 0, 0.015);
    shark.update(t);
    top.position.set(x + 0.8, 6, 0.6); top.target.position.set(x, 0, 0);
    fill.position.set(x, -3, 4);
    const pe = ease(t / dur);
    cam.position.set(x + 0.7 - pe * 0.6, -0.8, 9.2); cam.lookAt(x + 0.4, 0.15, 0);
    snow.update(t); renderer.render(scene, cam);
  } };
}
