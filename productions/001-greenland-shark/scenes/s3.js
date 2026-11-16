// S3 SETUP — vast ice ceiling, the shark small in the lower third; near-static. Slowness and cold.
import * as THREE from 'three';
import { makeRenderer, underwaterScene, iceCeiling, lightShaft, marineSnow, rng } from 'oddlight/core.js';
import { makeShark } from './lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.2), scene = underwaterScene(0.028);
  const cam = new THREE.PerspectiveCamera(55, 1080 / 1920, 0.1, 300);
  const ice = iceCeiling(scene, { y: 9, holeR: 1.6, chunks: 700, extent: 120, rand: rng(29) });
  ice.group.position.set(-9, -2.5, -24);       // distant opening, faint warm glow
  const shaft = lightShaft(scene, { top: 9, len: 20, rTop: 1.6, rBot: 5, strength: 0.16 });
  shaft.group.position.set(-9, -2.5, -24);
  const glow = new THREE.SpotLight('#ff9a48', 1800, 70, 0.3, 0.7, 1.4); glow.position.set(-9, 6.5, -24); glow.target.position.set(-9, -10, -24);
  scene.add(glow, glow.target);
  const under = new THREE.DirectionalLight('#4f8f99', 0.9); under.position.set(4, -10, 8); scene.add(under);
  const iceGlow = new THREE.PointLight('#ff9a48', 120, 30, 1.3); iceGlow.position.set(-9, 4.5, -24); scene.add(iceGlow);
  const snow = marineSnow(scene, { n: 6000, box: [40, 22, 40], center: [0, 0, -6], size: 0.07, fall: 0.1, cold: '#21454e' });
  const shark = makeShark({ amp: 0.1, freq: 1.4 }); scene.add(shark.group);
  return { renderer, render(t) {
    shark.group.position.set(-2.5 + t * 0.22, -3.2, -2); shark.group.rotation.set(0, -0.35, 0);
    shark.update(t);
    cam.position.set(0.0 + t * 0.02, -4.6, 16); cam.lookAt(-1, 2.2, -8);
    shaft.update(t); snow.update(t); renderer.render(scene, cam);
  } };
}
