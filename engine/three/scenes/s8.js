// S8 PAYOFF — intimacy: the ancient, scarred head passes close; parasite trailing from the eye; warm side light.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, marineSnow, ease } from '../lib/core.js';
import { makeShark } from '../lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.25), scene = underwaterScene(0.07);
  const cam = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.05, 100);
  const shark = makeShark({ amp: 0.1, freq: 1.5 }); scene.add(shark.group);
  const side = new THREE.SpotLight('#ffb27a', 30, 14, 0.5, 0.9, 1.4); scene.add(side, side.target);
  const fill = new THREE.PointLight('#3b7f8c', 18, 12, 1.2); scene.add(fill);
  const snow = marineSnow(scene, { n: 4000, box: [14, 10, 8], center: [0, 0, 1.5], size: 0.025, fall: 0.1, cold: '#2a5560', warm: '#ffb36b',
    beam: (x, y, z) => Math.max(0, 1 - Math.hypot(y - 1.5, z - 2.5) / 3) });
  return { renderer, render(t) {
    const x = 1.2 - t * 0.62;                       // swims toward camera-left, passing
    shark.group.position.set(x, 0, 0); shark.group.rotation.set(0.04, 0.22, 0); shark.update(t); shark.group.updateMatrixWorld(true);
    const head = shark.eyeWorld();
    side.position.set(head.x + 2.5, 2.2, 2.4); side.target.position.copy(head);
    fill.position.set(head.x - 2, -1.5, 3);
    const p = ease(t / dur);
    cam.position.set(-0.4 - p * 0.9, 0.05, 2.9);
    cam.lookAt(head.x - 0.35, head.y - 0.05, head.z);
    snow.update(t); renderer.render(scene, cam);
  } };
}
