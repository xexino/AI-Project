// S10 EXIT — dusk over the regrown taiga today; the last sunlight collapses into the single ODDLIGHT dot,
// which lands at the screen centre where the end card's i-dot appears.
import * as THREE from 'three';
import { makeRenderer, ease, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt } from './lib/world.js';
import { glowTexture } from 'oddlight/nature.js';
export async function build({ dur }) {
  const renderer = makeRenderer(0.7);
  const { scene, sky } = world({ renderer, skyEl: 1.5, skyAz: 265, fog: 0.0016, fogColor: '#c49a7a', size: 3000, segments: 300 });
  const forest = makeForest(treesIn({ x0: -320, x1: 320, z0: -1300, z1: 60, spacing: 4.4, seed: 101, scale: [8, 17] }), { heightAt, geometry: geo.living(1) });
  forest.mesh.castShadow = false; scene.add(forest.mesh);
  scene.add(new THREE.HemisphereLight('#8a94b4', '#241c14', 0.4));
  const sun = new THREE.DirectionalLight('#ff9a50', 1.3); sun.position.set(-900, 40, -800); scene.add(sun);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,214,160,1)'], [0.18, 'rgba(255,160,70,1)'], [0.32, 'rgba(255,138,31,0.55)'], [1, 'rgba(255,138,31,0)']]), transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
  dot.renderOrder = 10; scene.add(dot);
  const SUNP = new THREE.Vector3(-1400, 60, -2600);
  const cam = new THREE.PerspectiveCamera(46, 1080 / 1920, 1, 9000);
  const fog0 = scene.fog.density;
  // fade to the brand ink colour (#05141a), never to crushed black, so the cut to the end card is seamless
  const inkMat = new THREE.MeshBasicMaterial({ color: '#05141a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), inkMat); ink.position.z = -1.01; ink.renderOrder = 5; cam.add(ink); scene.add(cam);
  return { renderer, render(t) {
    const u = t / dur, p = easeInOut(u);
    const el = 1.5 - u * 3.2; sky.set(el, 265);
    sun.intensity = Math.max(0, 1.3 * (1 - u * 1.4));
    cam.position.set(30 - p * 20, heightAt(0, -p * 200) + 75 - p * 20, 40 - p * 220);
    const look = new THREE.Vector3(-120, 30, -900).lerp(SUNP, ease((u - 0.35) / 0.45));
    cam.lookAt(look);
    const dark = ease((u - 0.55) / 0.33);
    scene.fog.density = fog0 + dark * dark * 0.05; scene.fog.color.set('#c49a7a').lerp(new THREE.Color('#05141a'), dark);
    renderer.toneMappingExposure = 0.7 * (1 - dark * 0.5); inkMat.opacity = Math.min(1, dark * 1.05);
    dot.position.copy(SUNP); const d = cam.position.distanceTo(SUNP);
    dot.material.opacity = ease((u - 0.5) / 0.3); dot.scale.setScalar(d * 0.085 * (1 + 0.04 * Math.sin(t * 3)));
    renderer.render(scene, cam);
  } };
}
