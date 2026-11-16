// S9 PAYOFF — high above the clouds: a glowing rock streaks in and bursts several kilometres above the forest.
// Sync: the burst happens on the narrated word "exploded" (scene-local word timings are provided by the engine).
import * as THREE from 'three';
import { makeRenderer, ease, easeInOut } from 'oddlight/core.js';
import { world, treesIn, geo, makeForest, heightAt, fireball } from './lib/world.js';
import { glowTexture, valueNoise } from 'oddlight/nature.js';
export async function build({ dur, params = {} }) {
  const renderer = makeRenderer(0.66);
  const { scene } = world({ renderer, skyEl: 9, skyAz: 120, fog: 0.00035, fogColor: '#a9b8cc', size: 9000, segments: 300 });
  const forest = makeForest(treesIn({ x0: -900, x1: 900, z0: -2600, z1: -400, spacing: 11, seed: 91, scale: [22, 34] }), { heightAt, geometry: geo.living(2) });
  forest.mesh.castShadow = false; scene.add(forest.mesh);
  scene.add(new THREE.HemisphereLight('#b4c4da', '#2c2619', 0.6));
  const sun = new THREE.DirectionalLight('#fff0dc', 1.7); sun.position.set(800, 900, 600); scene.add(sun);
  // cloud deck: soft sprites
  const cloudT = glowTexture([[0, 'rgba(255,255,255,0.95)'], [0.45, 'rgba(245,247,250,0.55)'], [1, 'rgba(240,244,250,0)']], 128);
  for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudT, transparent: true, depthWrite: false, opacity: 0.55 + valueNoise(i, 2, 5) * 0.4 }));
    s.position.set((valueNoise(i, 1, 7) - 0.5) * 3400, 820 + valueNoise(i, 3, 9) * 120, -400 - valueNoise(4, i, 8) * 3600); s.scale.set(380 + valueNoise(i, 5, 2) * 500, 120 + valueNoise(i, 6, 3) * 120, 1); scene.add(s); }
  // the rock: lumpy, dark, glowing on its leading face
  const rg = new THREE.IcosahedronGeometry(10, 3); const rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i); v.multiplyScalar(0.8 + 0.35 * valueNoise(v.x * 0.3 + 5, v.y * 0.3 + v.z * 0.2, 4)); rp.setXYZ(i, v.x, v.y, v.z); }
  rg.computeVertexNormals();
  const rock = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#3a332d', roughness: 0.9, emissive: '#ff7a20', emissiveIntensity: 0.6 })); scene.add(rock);
  const fb = fireball(scene, { size: 26, trail: 60, smoke: 80 });
  const burstWord = (params.words || []).find((w) => w.word.toLowerCase().startsWith('exploded'));
  const tB = burstWord ? burstWord.start : dur * 0.4;
  const BURST = new THREE.Vector3(0, 640, -1700);
  const A = new THREE.Vector3(-900, 2200, -1100);
  const path = (t) => new THREE.Vector3().lerpVectors(A, BURST, ease(Math.min(1, (t + 0.4) / (tB + 0.4))));
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,250,1)'], [0.25, 'rgba(255,240,215,0.9)'], [0.6, 'rgba(255,190,120,0.3)'], [1, 'rgba(255,170,90,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  flash.position.copy(BURST); scene.add(flash);
  const dome = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,240,220,0)'], [0.62, 'rgba(255,236,210,0.0)'], [0.8, 'rgba(255,236,210,0.55)'], [0.9, 'rgba(255,230,200,0.25)'], [1, 'rgba(255,230,200,0)']]), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  dome.position.copy(BURST); scene.add(dome);
  const flashLight = new THREE.PointLight('#fff2dc', 0, 0, 2); flashLight.position.copy(BURST); scene.add(flashLight);
  // altitude marker: dashed line from the burst down to the ground
  const lineGeo = new THREE.BufferGeometry().setFromPoints([BURST, new THREE.Vector3(BURST.x, heightAt(BURST.x, BURST.z), BURST.z)]);
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: '#ffd6a0', dashSize: 18, gapSize: 12, transparent: true, opacity: 0, fog: false }));
  line.computeLineDistances(); scene.add(line);
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 1, 20000);
  return { renderer, render(t) {
    const p = easeInOut(t / dur);
    // after the burst the camera sinks through the cloud deck toward the forest below the blast
    const down = easeInOut((t - tB - 0.6) / Math.max(0.1, dur - tB - 0.6));
    cam.position.set(260 - p * 60 - down * 80, 1650 - p * 150 - down * 1000, 420 - p * 200 + down * 120);
    cam.lookAt(BURST.x - 40 + p * 30, BURST.y - 120 - p * 100 - down * 520, BURST.z + down * 150);
    const pre = t < tB;
    const head = fb.place(path, Math.min(t, tB), { intensity: pre ? 1 : Math.max(0, 1 - (t - tB) * 4), spacing: 0.03, smokeSpacing: 0.05 });
    rock.position.copy(head); rock.visible = pre; rock.rotation.set(t * 0.7, t * 1.1, 0);
    const k = Math.max(0, t - tB);
    const f = pre ? 0 : Math.exp(-k * 1.6);
    flash.scale.setScalar(pre ? 1 : 300 + k * 900); flash.material.opacity = pre ? 0 : Math.min(1, f * 1.3);
    flashLight.intensity = f * 3e6;
    dome.scale.setScalar(pre ? 0.01 : 80 + k * 900); dome.material.opacity = pre ? 0 : Math.exp(-k * 0.7);
    line.material.opacity = THREE.MathUtils.smoothstep(k, 0.6, 1.4) * 0.9;
    renderer.toneMappingExposure = 0.66 + f * 1.1;
    renderer.render(scene, cam);
  } };
}
