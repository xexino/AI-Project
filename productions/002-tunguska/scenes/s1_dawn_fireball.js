// S1 HOOK — aerial glide over endless taiga before sunrise; a fireball streaks in, lighting the haze.
import * as THREE from 'three';
import { makeRenderer, ease, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fireball } from './lib/world.js';
import { isRefLook, REF, fireballRef, cabinRef } from './lib/world_ref.js';
import { makeSpruceForest, makeFallenForest, cloudDeck, mistBands, dustWall, smokeColumns } from 'oddlight/cinema.js';
export async function build({ dur, params = {} }) {
  const RL = isRefLook(params);                       // visual-reference look (frames 01 + 04)
  const renderer = makeRenderer(0.62); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, sky } = world({ renderer, skyEl: 1.2, skyAz: 70, fog: 0.0019, fogColor: '#8a8aa0', size: 3000, segments: 360 });
  const fx = [];
  if (RL) {
    const near = makeSpruceForest(treesIn({ x0: -260, x1: 260, z0: -700, z1: 120, spacing: 4.2, seed: 7, scale: [13, 24] }), { heightAt, lod: 1 });
    const far = makeSpruceForest(treesIn({ x0: -900, x1: 900, z0: -1500, z1: -700, spacing: 7, seed: 9, scale: [15, 26] }), { heightAt, lod: 2, castShadow: false });
    scene.add(...near.meshes, ...far.meshes);
    fx.push(cloudDeck(scene, { y: 430, size: 5200, center: [0, -1600], color: REF.wilderness.cloud, shade: REF.wilderness.cloudShade, coverage: 0.6, fog: false }));
    fx.push(mistBands(scene, { levels: [-16, -8], area: 1500, center: [0, -560], color: REF.wilderness.mist, opacity: 0.42 }));
  } else {
  const near = makeForest(treesIn({ x0: -260, x1: 260, z0: -700, z1: 120, spacing: 4.2, seed: 7 }), { heightAt, geometry: geo.living(1) });
  const far = makeForest(treesIn({ x0: -900, x1: 900, z0: -1500, z1: -700, spacing: 7, seed: 9, scale: [13, 22] }), { heightAt, geometry: geo.living(2) });
  far.mesh.castShadow = false; scene.add(near.mesh, far.mesh);
  }
  scene.add(new THREE.HemisphereLight('#6d7896', '#1c1812', 0.35));
  const fireLight = new THREE.DirectionalLight('#ffc890', 0); fireLight.castShadow = true; fireLight.shadow.mapSize.set(2048, 2048);
  Object.assign(fireLight.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 1, far: 3000 }); fireLight.shadow.bias = -0.0005; fireLight.shadow.normalBias = 0.8;
  scene.add(fireLight, fireLight.target);
  const fb = RL ? fireballRef(scene, { size: 18, trail: 46, smoke: 70 }) : fireball(scene, { size: 16, trail: 46, smoke: 70 });
  const A = new THREE.Vector3(-300, 760, -2500), B = new THREE.Vector3(330, 170, -2700);
  const t0 = -0.4, t1 = dur * 1.12;                        // already streaking in on the first frame (hook)
  const path = (t) => new THREE.Vector3().lerpVectors(A, B, ease((t - t0) / (t1 - t0)));
  const cam = new THREE.PerspectiveCamera(46, 1080 / 1920, 1, 8000);
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const cz = 80 - p * 140;
    cam.position.set(-10 + p * 25, heightAt(0, cz) + 105 - p * 12, cz); cam.lookAt(40 + p * 30, 40, cz - 900);
    const on = THREE.MathUtils.smoothstep(t, -0.6, 0.15);
    const head = fb.place(path, t, { intensity: on });
    fireLight.position.copy(head); fireLight.target.position.set(cam.position.x, 0, cz - 300);
    fireLight.intensity = on * (2.2 + 0.4 * Math.sin(t * 17));
    scene.fog.color.set(RL ? REF.wilderness.fog : '#8a8aa0').lerp(new THREE.Color('#d0a070'), on * 0.45);
    fx.forEach((f) => f.update(t));
    renderer.render(scene, cam);
  } };
}
