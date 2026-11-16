// S9 EXIT — the shark descends into the dark; the camera tilts up to the light, which narrows to a single glowing dot (brand signature).
import * as THREE from 'three';
import { makeRenderer, underwaterScene, iceCeiling, lightShaft, marineSnow, coneBeam, warmSpot, easeInOut, ease } from 'oddlight/core.js';
import { makeShark } from './lib/shark.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.15), scene = underwaterScene(0.055);
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 200);
  const ice = iceCeiling(scene); const shaft = lightShaft(scene); const spot = warmSpot(scene);
  const bounce = new THREE.PointLight('#ff9a40', 60, 14, 1.4); bounce.position.set(0, 7.6, 0); scene.add(bounce);
  const snow = marineSnow(scene, { beam: coneBeam() });
  const shark = makeShark({ amp: 0.11, freq: 1.6 }); scene.add(shark.group);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,214,160,1)'); gr.addColorStop(0.18, 'rgba(255,160,70,1)'); gr.addColorStop(0.32, 'rgba(255,138,31,0.55)'); gr.addColorStop(1, 'rgba(255,138,31,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })(), transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
  dot.renderOrder = 10; scene.add(dot);
  const fogBase = scene.fog.density;
  return { renderer, render(t) {
    const u = t / dur;
    // shark: descends and turns away
    shark.group.position.set(0.6 - t * 0.25, -1.0 - Math.pow(t, 1.5) * 0.55, 1.0 - t * 0.6);
    shark.group.rotation.set(0, 0.9, -0.35 - u * 0.25); shark.update(t);
    // camera: from the shark, tilt up to the hole
    const tilt = easeInOut((u - 0.12) / 0.6);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0.2, -2.6, 0.5), new THREE.Vector3(0, 9.3, 0), tilt);
    cam.position.set(0, -1.5, 7.5); cam.lookAt(look);
    // light narrows, world dissolves into black, a single dot remains
    const narrow = ease((u - 0.45) / 0.4);
    shaft.group.scale.set(1 - narrow * 0.85, 1, 1 - narrow * 0.85); shaft.update(t, 1 - ease((u - 0.6) / 0.3));
    ice.sky.scale.setScalar(1 - narrow * 0.8);
    spot.angle = 0.22 * (1 - narrow * 0.7);
    scene.fog.density = fogBase + Math.pow(ease((u - 0.62) / 0.3), 2) * 0.6;
    ice.sky.material.color.setScalar(0).add(new THREE.Color('#ffc27a').multiplyScalar(2.2 * (1 - ease((u - 0.7) / 0.2))));
    dot.position.set(0, 9.3, 0);
    const d = cam.position.distanceTo(dot.position);
    const dotA = ease((u - 0.62) / 0.25);
    dot.material.opacity = dotA; dot.scale.setScalar(d * 0.085 * (1 + 0.04 * Math.sin(t * 3)));
    snow.update(t); renderer.render(scene, cam);
  } };
}
