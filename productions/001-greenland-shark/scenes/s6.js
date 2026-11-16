// S6 STORY — inside the lens: glassy layers assemble outward from a glowing core (formed before birth); core pulses on "answer".
import * as THREE from 'three';
import { makeRenderer, PAL, ease, rng } from 'oddlight/core.js';
export async function build({ dur }) {
  const renderer = makeRenderer(1.0);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#041015');
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 50);
  const shellMat = (hue) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 }, uC: { value: hue } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vP=position; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uA; uniform vec3 uC;
      void main(){ float f = pow(1.0-abs(dot(vN,vV)), 3.0); float band = 0.75 + 0.25*sin(vP.y*18.0 + vP.x*6.0);
        gl_FragColor = vec4(uC * f * band * uA, 1.0); }`,
  });
  const shells = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const r = 0.32 + i * 0.16;
    const c = new THREE.Color('#7fd1c7').lerp(new THREE.Color('#cfe8e4'), i / N);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), shellMat(c));
    m.scale.set(1, 0.82, 1);                    // lens-like oblate
    scene.add(m); shells.push(m);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 64, 48), new THREE.MeshBasicMaterial({ color: PAL.sodium.clone().multiplyScalar(1.6) }));
  core.scale.set(1, 0.82, 1); scene.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,170,90,0.9)'); gr.addColorStop(0.3, 'rgba(255,138,31,0.35)'); gr.addColorStop(1, 'rgba(255,138,31,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(halo);
  // drifting motes
  const r = rng(21), n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (r() - 0.5) * 7;
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.015, color: '#4a8f96', transparent: true, opacity: 0.6 })));
  const pulseAt = dur - 0.5 - 0.35 - 0.5;           // ~ on the word "answer" (clip minus transition, tail, word length)
  return { renderer, render(t) {
    const p = ease(t / (dur * 0.62));
    shells.forEach((m, i) => {
      const k = ease((p * (N + 2) - i) / 2.2);
      m.material.uniforms.uA.value = 0.85 * k; m.scale.set(k, 0.82 * k, k); m.rotation.y = t * 0.05 * (i % 2 ? 1 : -1);
    });
    const pulse = Math.exp(-Math.pow((t - pulseAt) / 0.18, 2));
    core.scale.set(1 + pulse * 0.25, (1 + pulse * 0.25) * 0.82, 1 + pulse * 0.25);
    halo.scale.setScalar(1.6 + pulse * 2.4 + 0.1 * Math.sin(t * 2));
    const a = -0.35 + (t / dur) * 0.4;
    cam.position.set(Math.sin(a) * 5.2, 0.6 - t * 0.04, Math.cos(a) * 5.2); cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
  } };
}
