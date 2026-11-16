// S6 STORY — from the expedition camp lantern, the camera rises to reveal the radial (butterfly) fall pattern.
import * as THREE from 'three';
import { makeRenderer, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fallState, camp, flatRadius, STAND_R } from './lib/world.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.72);
  const { scene } = world({ renderer, skyEl: 12, skyAz: 160, fog: 0.0007, fogColor: '#b9b8b4', size: 3000, segments: 360, scorch: 1 });
  const all = treesIn({ x0: -620, x1: 620, z0: -620, z1: 620, spacing: 5.0, seed: 61 });
  const fallen = all.filter((t) => Math.hypot(t.x, t.z) < flatRadius(Math.atan2(t.z, t.x)) + 30);
  const standing = all.filter((t) => Math.hypot(t.x, t.z) >= flatRadius(Math.atan2(t.z, t.x)) + 30);
  const dead = makeForest(fallen, { heightAt, geometry: geo.dead(), material: new THREE.MeshStandardMaterial({ roughness: 0.9, color: '#d9c6a6' }) });
  dead.update(fallState(1e9, 30)); scene.add(dead.mesh);
  const alive = makeForest(standing, { heightAt, geometry: geo.living(2) }); scene.add(alive.mesh);
  scene.add(new THREE.HemisphereLight('#aab6c6', '#2e271c', 0.55));
  const sun = new THREE.DirectionalLight('#ffe0bc', 1.8); sun.position.set(-500, 600, 300); scene.add(sun);
  const cp = camp(); const CX = 360, CZ = 120; cp.group.position.set(CX, heightAt(CX, CZ), CZ); scene.add(cp.group);
  const cam = new THREE.PerspectiveCamera(48, 1080 / 1920, 0.5, 9000);
  const look = new THREE.Vector3();
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const camLow = new THREE.Vector3(CX + 18, heightAt(CX + 18, CZ + 22) + 6, CZ + 22);
    const camHigh = new THREE.Vector3(40, 1150, 120);
    cam.position.lerpVectors(camLow, camHigh, p * p);
    look.lerpVectors(new THREE.Vector3(CX - 6, heightAt(CX, CZ) + 2, CZ - 8), new THREE.Vector3(0, 0, 0), Math.min(1, p * 1.4));
    cam.up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0, -1), THREE.MathUtils.smoothstep(p, 0.55, 1)).normalize();
    cam.lookAt(look);
    cp.light.intensity = 40 * (1 - p);
    scene.fog.density = THREE.MathUtils.lerp(0.0016, 0.00006, Math.min(1, p * 1.5));
    renderer.render(scene, cam);
  } };
}
