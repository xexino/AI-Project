// S1 HOOK — under the ice, a silhouette glides into the single warm shaft.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, iceCeiling, lightShaft, marineSnow, coneBeam, warmSpot, ease } from 'oddlight/core.js';
import { makeShark } from './lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.15), scene = underwaterScene();
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 200);
  iceCeiling(scene); const shaft = lightShaft(scene);
  const spot = warmSpot(scene);
  const bounce = new THREE.PointLight('#ff9a40', 60, 14, 1.4); bounce.position.set(0, 7.6, 0); scene.add(bounce);
  const snow = marineSnow(scene, { beam: coneBeam() });
  const shark = makeShark(); scene.add(shark.group);
  return { renderer, render(t) {
    shark.group.position.set(-4.0 + t * 1.05, 1.0 + Math.sin(t * 0.6) * 0.08, 0.9);
    shark.group.rotation.set(-0.14, 0.08, -0.04); shark.group.scale.setScalar(1.05);
    shark.update(t);
    const pe = ease(t / dur);
    cam.position.set(0.35, -6.4 + pe * 0.25, 10.5 - pe * 0.55); cam.lookAt(0, 1.6, 0);
    spot.intensity = 900 + 250 * Math.exp(-Math.pow(shark.group.position.x, 2) / 4);
    shaft.update(t); snow.update(t);
    renderer.render(scene, cam);
  } };
}
