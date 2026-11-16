// Animated still: one image per beat, brought to life with a slow eased push-in / pan, drifting marine snow in front
// of it (parallax depth cue) and a gentle light "breathing". Deterministic. Used by the AI-stills experiment.
// params: { image: "<path under the scene root>", move: { zoom: [z0, z1], pan: [[x0, y0], [x1, y1]] }, snow: 0..1 }
import * as THREE from 'three';

const ease = (a) => { a = Math.min(Math.max(a, 0), 1); return a * a * (3 - 2 * a); };

function dot() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

export async function build({ dur, params }) {
  const { width = 1080, height = 1920 } = window.ODDLIGHT || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#000000');
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(-aspect / 2, aspect / 2, 0.5, -0.5, 0.1, 10); camera.position.z = 5;
  const tex = await new THREE.TextureLoader().loadAsync('/project/' + params.image);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  const ia = tex.image.width / tex.image.height;
  const cover = ia > aspect ? [ia, 1] : [aspect, aspect / ia];            // fill the frame, crop the excess
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(cover[0], cover[1]), mat); scene.add(img);
  // marine snow in front of the image: two depth layers drifting at different speeds (parallax)
  const layers = [];
  const snow = params.snow ?? 1;
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const [n, size, speed, alpha] of [[260, 0.004, 0.012, 0.55], [90, 0.009, 0.03, 0.4]]) {
    const pos = new Float32Array(n * 3), base = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { base[i * 2] = rnd(); base[i * 2 + 1] = rnd(); pos[i * 3 + 2] = 1; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dot(), transparent: true, opacity: alpha * snow, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    pts.material.size = size * height;                                   // pixels
    scene.add(pts); layers.push({ pts, pos, base, n, speed });
  }
  const mv = params.move || {};
  const [z0, z1] = mv.zoom || [1.0, 1.1];
  const [[px0, py0], [px1, py1]] = mv.pan || [[0, 0], [0, 0]];
  function render(t) {
    const k = ease(t / Math.max(dur, 0.001));
    const z = z0 + (z1 - z0) * k;
    img.scale.set(z, z, 1);
    img.position.set(px0 + (px1 - px0) * k, py0 + (py1 - py0) * k, 0);
    const b = 0.96 + 0.04 * Math.sin(t * 1.3);
    mat.color.setRGB(b, b, b);
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        const x = ((L.base[i * 2] + Math.sin(t * 0.4 + i) * 0.004) % 1) * aspect - aspect / 2;
        const y = (((L.base[i * 2 + 1] + t * L.speed) % 1) + 1) % 1 - 0.5;
        L.pos[i * 3] = x; L.pos[i * 3 + 1] = y;
      }
      L.pts.geometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  return { renderer, render };
}
