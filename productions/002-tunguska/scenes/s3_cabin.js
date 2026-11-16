// S3 SETUP — a log homestead at the forest edge, lamp in the window; the far horizon flares white.
import * as THREE from 'three';
import { makeRenderer, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, cabin } from './lib/world.js';
import { glowTexture, particles } from 'oddlight/nature.js';
import { isRefLook, REF, fireballRef, cabinRef } from './lib/world_ref.js';
import { makeSpruceForest, makeFallenForest, cloudDeck, mistBands, dustWall, smokeColumns } from 'oddlight/cinema.js';
export async function build({ dur, params = {} }) {
  const RL = isRefLook(params);                       // visual-reference look (frames 02 + 03)
  const renderer = makeRenderer(0.8); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene } = world({ renderer, skyEl: 3, skyAz: 100, fog: 0.004, fogColor: '#9c98a4', size: 1600, segments: 240 });
  const CX = 600, CZ = 400, base = heightAt(CX, CZ);
  const clear = (x, z) => Math.hypot(x - CX, z - CZ) > 26 && !(z > CZ + 4 && Math.abs(x - CX) < 60);
  const fx = [];
  if (RL) {
    const forest = makeSpruceForest(treesIn({ x0: CX - 220, x1: CX + 220, z0: CZ - 420, z1: CZ + 30, spacing: 3.4, seed: 31, keep: clear, scale: [14, 26] }), { heightAt, lod: 1 });
    scene.add(...forest.meshes);
    fx.push(mistBands(scene, { levels: [base - 12, base - 4], area: 1400, center: [CX - 200, CZ - 500], color: REF.cabin.mist, opacity: 0.5 }));
    scene.fog.color.set(REF.cabin.fog);
  } else {
  const forest = makeForest(treesIn({ x0: CX - 220, x1: CX + 220, z0: CZ - 420, z1: CZ + 30, spacing: 3.4, seed: 31, keep: clear }), { heightAt, geometry: geo.living(0) });
  scene.add(forest.mesh);
  }
  const home = RL ? cabinRef() : cabin(); home.group.position.set(CX, base - 0.2, CZ); home.group.rotation.y = 0.35; scene.add(home.group);
  const fence = new THREE.Group(); const fm = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 });
  for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), fm); p.position.set(CX - 16 + i * 2.4, heightAt(CX - 16 + i * 2.4, CZ + 14) + 0.8, CZ + 14); p.castShadow = true; fence.add(p); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(32, 0.12, 0.12), fm); rail.position.set(CX - 0.4, base + 1.2, CZ + 14); fence.add(rail); scene.add(fence);
  scene.add(new THREE.HemisphereLight('#8c95b0', '#2a2218', 0.5));
  const sun = new THREE.DirectionalLight('#ffbd8a', 0.9); sun.position.set(CX + 500, 80, CZ - 300); sun.target.position.set(CX, 0, CZ);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 2000 }); sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  // the flash: a white-hot dome of light on the far horizon (direction of the blast) + a strong directional light
  const flashDir = new THREE.Vector3(-0.85, 0.08, -1).normalize();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(RL ? REF.flash.halo : [[0, 'rgba(255,255,245,1)'], [0.25, 'rgba(255,230,190,0.9)'], [0.6, 'rgba(255,190,120,0.35)'], [1, 'rgba(255,160,90,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  flash.position.set(CX, base, CZ).addScaledVector(flashDir, 1500); scene.add(flash);
  const flashLight = new THREE.DirectionalLight(RL ? REF.flash.light : '#fff0d8', 0); flashLight.position.copy(flash.position); flashLight.target.position.set(CX, 0, CZ); scene.add(flashLight, flashLight.target);
  const smoke = RL ? smokeColumns(scene, { points: [[CX - 2.6, base + 7.5, CZ - 0.6]], height: 34, n: 60, color: '#c8c8c4', opacity: 0.3, size: 3.2 })
    : particles(scene, { n: 60, box: [2, 10, 2], center: [CX - 2.6, base + 13, CZ - 0.6], size: 2.2, color: '#9a9590', opacity: 0.35, fall: -1.2, drift: 0.5 });
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.3, 5000);
  const tFlash = dur * 0.62;
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    cam.position.set(CX + 6 + p * 5, base + 3.2 + p * 0.6, CZ + 34 - p * 7); cam.lookAt(CX - 6, base + 7 + p * 2, CZ - 30);
    const f = Math.max(0, THREE.MathUtils.smoothstep(t, tFlash, tFlash + 0.35) - THREE.MathUtils.smoothstep(t, tFlash + 0.9, dur + 1.0) * 0.4);
    flash.scale.setScalar(120 + f * 1400); flash.material.opacity = f;
    flashLight.intensity = f * 7; sun.intensity = 0.9 * (1 - f * 0.5);
    home.lamp.intensity = (RL ? 16 : 30) * (1 - f * 0.6); smoke.update(t); fx.forEach((m) => m.update(t));
    renderer.toneMappingExposure = 0.8 + f * 1.4;
    renderer.render(scene, cam);
  } };
}
