// S5 STORY — nineteen winters: the flattened forest under passing seasons; snow settles on the fallen trunks.
import * as THREE from 'three';
import { makeRenderer, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fallState, inFallZone, terrainColor, deadMaterial } from './lib/world.js';
import { particles } from 'oddlight/nature.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.75); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, sky, ground } = world({ renderer, skyEl: 8, skyAz: 200, fog: 0.0024, fogColor: '#a8acb4', size: 1600, segments: 260 });
  const trees = treesIn({ x0: 120, x1: 420, z0: -60, z1: 260, spacing: 3.6, seed: 51 });
  const mat = deadMaterial(0);
  const dead = makeForest(trees, { heightAt, geometry: geo.dead(), material: mat }); scene.add(dead.mesh);
  dead.update(fallState(1e9, 30));
  scene.add(new THREE.HemisphereLight('#a7b4c6', '#2d261c', 0.5));
  const sun = new THREE.DirectionalLight('#ffd8b0', 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 2000 }); sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const snowFx = particles(scene, { n: 4000, box: [160, 90, 160], center: [270, 60, 110], size: 0.5, color: '#f4f6fa', opacity: 0.85, fall: 7, drift: 2.2 });
  const colors = ground.geometry.attributes.color, pos = ground.geometry.attributes.position, nrm = ground.geometry.attributes.normal;
  const paint = (snow) => { const fn = terrainColor(snow), c = new THREE.Color(); for (let i = 0; i < pos.count; i++) { fn(pos.getX(i), pos.getY(i), pos.getZ(i), nrm.getY(i), c); colors.setXYZ(i, c.r, c.g, c.b); } colors.needsUpdate = true; };
  const cam = new THREE.PerspectiveCamera(44, 1080 / 1920, 0.5, 5000);
  let lastSnow = -1;
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const seasons = t / dur * 3.2;                           // a few cycles summer -> winter
    const winter = Math.max(0, Math.sin(seasons * Math.PI * 2 - 1.2)), snow = Math.min(1, winter * 1.2 + p * 0.25);
    const s = Math.round(snow * 20) / 20; if (s !== lastSnow) { paint(s); lastSnow = s; }
    mat.color.set('#9a8a7a').lerp(new THREE.Color('#e9eef3'), s * 0.75);
    snowFx.material.opacity = 0.85 * winter; snowFx.update(t);
    const el = 6 + 22 * (1 - winter); sky.set(el, 200 + p * 30);
    sun.position.set(270 + Math.cos(0.6) * 600, Math.sin(el * Math.PI / 180) * 600 + 40, 110 - 400); sun.target.position.set(270, 0, 110);
    sun.intensity = 0.8 + 1.0 * (1 - winter);
    scene.fog.color.set('#a8acb4').lerp(new THREE.Color('#d8dde4'), winter * 0.6);
    cam.position.set(210 + p * 20, heightAt(220, 210) + 30 - p * 6, 210 - p * 30); cam.lookAt(300, 0, 60);
    renderer.render(scene, cam);
  } };
}
