// S4 STORY — high aerial: a white flash, then a dust ring races outward and the forest falls in its path, radially.
import * as THREE from 'three';
import { makeRenderer, ease, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fallState, inFallZone, STAND_R } from './lib/world.js';
import { glowTexture } from 'oddlight/nature.js';
import { isRefLook, REF, fireballRef, cabinRef } from './lib/world_ref.js';
import { makeSpruceForest, makeFallenForest, cloudDeck, mistBands, dustWall, smokeColumns } from 'oddlight/cinema.js';
export async function build({ dur, params = {} }) {
  const RL = isRefLook(params);                       // visual-reference look (frame 05)
  const renderer = makeRenderer(0.85);
  const { scene } = world({ renderer, skyEl: 7, skyAz: 120, fog: 0.00032, fogColor: '#b8b0a4', size: 3200, segments: 380 });
  const trees = treesIn({ x0: -640, x1: 640, z0: -640, z1: 640, spacing: 5.2, seed: 41, scale: [12, 20] });
  const forest = makeForest(trees, { heightAt, geometry: geo.living(2) }); forest.mesh.castShadow = false; scene.add(forest.mesh);
  scene.add(new THREE.HemisphereLight('#a9b6c9', '#30281c', 0.55));
  const sun = new THREE.DirectionalLight('#ffd0a0', 1.2); sun.position.set(600, 300, 400); scene.add(sun);
  // shock ring: a soft dusty annulus that expands with the wave front
  const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uR: { value: 1 }, uW: { value: 40 }, uA: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform float uR; uniform float uW; uniform float uA;
      void main(){ float r = length(vP.xy); float d = (r - uR) / uW; float a = exp(-d*d*2.0) * (r < uR ? 0.55 : 1.0);
        float th = atan(vP.y, vP.x); float n = 0.7 + 0.18*sin(th*11.0 + r*0.031) + 0.12*sin(th*29.0 - r*0.05 + 1.7) + 0.08*sin(th*53.0 + 0.4);
        gl_FragColor = vec4(vec3(0.84,0.78,0.70), a * n * uA); }` });
  const ring = new THREE.Mesh(new THREE.CircleGeometry(900, 160), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 28; scene.add(ring);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,250,1)'], [0.3, 'rgba(255,235,200,0.85)'], [1, 'rgba(255,200,150,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  flash.position.set(0, 300, 0); scene.add(flash);
  const flashLight = new THREE.PointLight('#fff2dc', 0, 0, 2); flashLight.position.set(0, 300, 0); scene.add(flashLight);
  const dust = RL ? dustWall(scene, { count: 170, height: 230, color: REF.shock.dust, groundAt: heightAt }) : null;
  if (RL) scene.fog.color.set(REF.shock.fog);
  const cam = new THREE.PerspectiveCamera(48, 1080 / 1920, 1, 9000);
  const tw = 0.35; const tint = new THREE.Color(), live = new THREE.Color(1, 1, 1), downC = new THREE.Color(2.6, 2.2, 1.7);                                           // wave starts after the flash
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    const ang = 0.9 + p * 0.25;
    if (RL) { cam.position.set(Math.cos(ang) * 1120, 520 - p * 50, Math.sin(ang) * 1120); cam.lookAt(-Math.cos(ang) * 120, -20, -Math.sin(ang) * 120); }
    else { cam.position.set(Math.cos(ang) * 980, 820 - p * 60, Math.sin(ang) * 980); cam.lookAt(0, -40, 0); }
    const R = Math.max(0, (t - tw) / (dur * 0.86 - tw)) ** 0.8 * 620;
    const fs = fallState(R, 34); forest.update(fs);
    for (let i = 0; i < trees.length; i++) { const st = fs(i, trees[i]); const k = st ? st.fall : 0;
      tint.copy(live).lerp(downC, k).multiplyScalar(0.75 + 0.5 * trees[i].tint); forest.mesh.setColorAt(i, tint); }
    forest.mesh.instanceColor.needsUpdate = true;
    ringMat.uniforms.uR.value = Math.max(R, 1); ringMat.uniforms.uW.value = 30 + R * 0.08; ringMat.uniforms.uA.value = t < tw ? 0 : Math.max(0, 1 - R / 700);
    if (dust) dust.update(R, t < tw ? 0 : Math.max(0, 1 - R / 760) * 0.55, t);
    const f = Math.exp(-Math.max(0, t) * 2.2);
    flash.scale.setScalar(200 + (1 - f) * 600); flash.material.opacity = f; flashLight.intensity = f * 5e5;
    renderer.toneMappingExposure = 0.7 + f * 1.2;
    renderer.render(scene, cam);
  } };
}
