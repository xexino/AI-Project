// S5 STORY — the turn: extreme close-up on the pale eye; slow push-in toward the pupil.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, marineSnow, easeInOut } from 'oddlight/core.js';
import { makeShark } from './lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.3), scene = underwaterScene(0.12);
  const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.01, 60);
  const shark = makeShark({ amp: 0.05, freq: 1.2 }); scene.add(shark.group);
  shark.group.rotation.set(0, -0.25, 0); shark.update(0); shark.group.updateMatrixWorld(true);
  const eye = shark.eyeWorld();
  const key = new THREE.PointLight('#f0d2b0', 0.5, 4, 1.5); scene.add(key);
  const rim = new THREE.SpotLight('#ff9a48', 10, 10, 0.35, 0.8, 1.4); rim.position.set(eye.x + 1.2, eye.y + 2.5, eye.z - 0.5); rim.target.position.copy(eye); scene.add(rim, rim.target);
  const fill = new THREE.PointLight('#3b7f8c', 3, 8, 1.2); fill.position.set(eye.x - 1, eye.y - 1, eye.z + 1.5); scene.add(fill);
  const snow = marineSnow(scene, { n: 2500, box: [4, 4, 3], center: [eye.x, eye.y, eye.z + 1.3], size: 0.012, fall: 0.06, cold: '#2c5660', warm: '#ffb36b',
    beam: (x, y, z) => Math.max(0, 1 - Math.hypot(x - eye.x - 0.6, y - eye.y - 0.8) / 1.5) });
  return { renderer, render(t) {
    shark.group.position.set(Math.sin(t * 0.4) * 0.01, Math.sin(t * 0.5) * 0.008, 0);
    shark.update(t); shark.group.updateMatrixWorld(true);
    const e = shark.eyeWorld();
    const pupil = shark.eyes[0].localToWorld(new THREE.Vector3(0, 0, 0.06));
    const normal = pupil.clone().sub(e).normalize();
    const p = easeInOut(t / dur);
    const dist = THREE.MathUtils.lerp(1.6, 0.12, p);
    const off = new THREE.Vector3(0.45, 0.2, 0.3).multiplyScalar(1 - p);   // starts oblique, ends square-on
    cam.position.copy(pupil).addScaledVector(normal.clone().add(off).normalize(), dist);
    cam.lookAt(pupil);
    key.position.copy(cam.position).add(new THREE.Vector3(0.15, 0.25, 0));
    key.intensity = 0.5 + 1.1 * p;               // the glint slowly blooms
    snow.update(t); renderer.render(scene, cam);
  } };
}
