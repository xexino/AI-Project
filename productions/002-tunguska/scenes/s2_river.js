// S2 SETUP — low over the Tunguska river at first light; the fireball passes overhead, its light sweeping the valley.
import * as THREE from 'three';
import { makeRenderer, ease, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fireball } from './lib/world.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.7); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // river: a winding water ribbon along -z, carved into the terrain, banks cleared of trees
  const riverX = (z) => Math.sin(z * 0.006) * 40 + Math.sin(z * 0.017) * 9;
  const vh = (x, z) => { const d = Math.abs(x - riverX(z)); const bank = THREE.MathUtils.smoothstep(d, 26, 90); return THREE.MathUtils.lerp(-5, Math.max(heightAt(x, z) * 0.35, 0) + 6 + d * 0.06, bank); };
  const { scene } = world({ renderer, skyEl: 2.5, skyAz: 95, fog: 0.0028, fogColor: '#9a9aa8', size: 2400, segments: 360, heightFn: vh });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(56, 2200, 1, 200), new THREE.MeshStandardMaterial({ color: '#6b7f8c', roughness: 0.08, metalness: 0.85 }));
  water.rotation.x = -Math.PI / 2; const wp = water.geometry.attributes.position;
  for (let i = 0; i < wp.count; i++) { const z = -wp.getY(i) - 900; wp.setX(i, wp.getX(i) + riverX(z)); }
  water.position.set(0, -1.2, -900); scene.add(water);
  const near = makeForest(treesIn({ x0: -230, x1: 230, z0: -1100, z1: 40, spacing: 3.6, seed: 21, keep: (x, z) => Math.abs(x - riverX(z)) > 48 }), { heightAt: vh, geometry: geo.living(1) });
  scene.add(near.mesh);
  scene.add(new THREE.HemisphereLight('#7f8aa6', '#221c14', 0.45));
  const sun = new THREE.DirectionalLight('#ffb27a', 0.6); sun.position.set(800, 60, -200); scene.add(sun);
  const fireLight = new THREE.DirectionalLight('#ffd6a0', 0); fireLight.castShadow = true; fireLight.shadow.mapSize.set(2048, 2048);
  Object.assign(fireLight.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 1, far: 3000 }); fireLight.shadow.normalBias = 0.8;
  scene.add(fireLight, fireLight.target);
  const fb = fireball(scene, { size: 9, trail: 40, smoke: 70 });
  const A = new THREE.Vector3(260, 520, 300), B = new THREE.Vector3(-140, 260, -1500);
  const path = (t) => new THREE.Vector3().lerpVectors(A, B, ease((t + 0.6) / (dur + 1.2)));
  const cam = new THREE.PerspectiveCamera(52, 1080 / 1920, 0.5, 6000);
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const cz = -20 - p * 30;
    cam.position.set(riverX(cz) + 4, 6 + p * 2, cz); cam.lookAt(riverX(cz - 300) - 10, 40 + p * 90, cz - 400);
    const head = fb.place(path, t, { intensity: 1 });
    fireLight.position.copy(head); fireLight.target.position.set(cam.position.x, 0, cz - 120);
    fireLight.intensity = 2.6 + 0.4 * Math.sin(t * 19);
    renderer.render(scene, cam);
  } };
}
