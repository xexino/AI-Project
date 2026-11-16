// S7 PAYOFF — ground level at the centre: bare trunks still standing, stripped of every branch; mist and low sun.
import * as THREE from 'three';
import { makeRenderer, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, inStandZone, BOG_R } from './lib/world.js';
import { particles } from 'oddlight/nature.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.78); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene } = world({ renderer, skyEl: 3.5, skyAz: 250, fog: 0.011, fogColor: '#c9b49a', size: 900, segments: 240 });
  // keep a clear corridor along the camera path and its line of sight (no trunk may fill the lens)
  const corridor = (x, z) => { let best = 1e9; for (let k = 0; k <= 20; k++) { const u = k / 20, cx = 92 - u * 16, cz = 26 + u * 6;
      for (let d = 0; d <= 26; d += 2) { const lx = cx - d * 0.88, lz = cz - d * 0.47; best = Math.min(best, Math.hypot(x - lx, z - lz) + (d < 10 ? 0 : 3)); } } return best; };
  const trunks = treesIn({ x0: -140, x1: 140, z0: -140, z1: 140, spacing: 5.5, seed: 71, scale: [14, 22], keep: (x, z) => Math.hypot(x, z) > BOG_R * 0.55 && Math.hypot(x, z) < 140 && corridor(x, z) > 5 });
  const dead = makeForest(trunks, { heightAt, geometry: geo.dead(), material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, color: '#a59584' }) });
  scene.add(dead.mesh);
  scene.add(new THREE.HemisphereLight('#a5b0c0', '#2c2419', 0.45));
  const sun = new THREE.DirectionalLight('#ffb070', 3.2); sun.position.set(-600, 55, -260); sun.target.position.set(40, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 2000 }); sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const motes = particles(scene, { n: 1600, box: [60, 20, 60], center: [60, 8, 10], size: 0.18, color: '#ffd9a8', opacity: 0.55, fall: 0.25, drift: 1.2, additive: true });
  const cam = new THREE.PerspectiveCamera(44, 1080 / 1920, 0.3, 3000);
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const x = 92 - p * 16, z = 26 + p * 6;
    cam.position.set(x, heightAt(x, z) + 1.7, z); cam.lookAt(x - 60, heightAt(x, z) + 9 + p * 3, z - 32);
    motes.update(t); renderer.render(scene, cam);
  } };
}
