// S8 PAYOFF — crane down over the flat marsh at ground zero: still water, no hole.
import * as THREE from 'three';
import { makeRenderer, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, BOG_R } from './lib/world.js';
import { valueNoise } from 'oddlight/nature.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.72);
  const { scene } = world({ renderer, skyEl: 5, skyAz: 240, fog: 0.006, fogColor: '#b9ab98', size: 900, segments: 240 });
  const pools = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({ color: '#6c7c86', roughness: 0.05, metalness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, r = 8 + (i * 7.3) % (BOG_R * 0.8);
    const m = new THREE.Mesh(new THREE.CircleGeometry(3 + valueNoise(i, 3, 5) * 7, 24), water);
    m.rotation.x = -Math.PI / 2; m.scale.y = 0.6 + valueNoise(i, 9, 2) * 0.6; m.position.set(Math.cos(a) * r, heightAt(Math.cos(a) * r, Math.sin(a) * r) + 0.08, Math.sin(a) * r); pools.add(m);
  }
  scene.add(pools);
  const tuftGeo = new THREE.ConeGeometry(0.22, 0.7, 4); const tuftMat = new THREE.MeshStandardMaterial({ color: '#5e5634', roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 9000); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 9000; i++) { const x = (valueNoise(i * 0.37, 1, 11) - 0.5) * 160, z = (valueNoise(1, i * 0.41, 12) - 0.5) * 160; const s = 0.5 + valueNoise(i * 0.7, i * 0.3, 3) * 0.9;
    m4.compose(new THREE.Vector3(x, heightAt(x, z) + 0.4 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); tufts.setMatrixAt(i, m4); }
  scene.add(tufts);
  const trunks = makeForest(treesIn({ x0: -150, x1: 150, z0: -150, z1: 150, spacing: 6, seed: 81, scale: [13, 20], keep: (x, z) => Math.hypot(x, z) > BOG_R * 0.9 }),
    { heightAt, geometry: geo.dead(), material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, color: '#a59584' }) });
  scene.add(trunks.mesh);
  scene.add(new THREE.HemisphereLight('#aab4c4', '#2a2419', 0.6));
  const sun = new THREE.DirectionalLight('#ffc890', 1.8); sun.position.set(-400, 120, -200); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(46, 1080 / 1920, 0.3, 3000);
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    cam.position.set(24 - p * 10, 70 - p * 62, 70 - p * 40); cam.lookAt(0, heightAt(0, 0) + p * 2, -10 - p * 20);
    renderer.render(scene, cam);
  } };
}
