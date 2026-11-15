// ODDLIGHT shared 3D world: renderer, palette, deterministic RNG, underwater set pieces.
import * as THREE from 'three';

export const W = 1080, H = 1920, FPS = 24;
export const PAL = {
  ink: new THREE.Color('#05141a'),
  inkDeep: new THREE.Color('#020a0d'),
  sodium: new THREE.Color('#ff8a1f'),
  beam: new THREE.Color('#ffa850'),
  bone: new THREE.Color('#ede6d6'),
  teal: new THREE.Color('#1f4e57'),
  signal: new THREE.Color('#7fd1c7'),
};

export function makeRenderer(exposure = 1.15) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = exposure;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  return r;
}

export function rng(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const ease = (a) => { a = Math.min(Math.max(a, 0), 1); return a * a * (3 - 2 * a); };
export const easeInOut = (a) => { a = Math.min(Math.max(a, 0), 1); return a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2; };
export const lerp = THREE.MathUtils.lerp;

export function underwaterScene(fog = 0.055) {
  const scene = new THREE.Scene();
  scene.background = PAL.ink.clone();
  scene.fog = new THREE.FogExp2(PAL.ink.clone(), fog);
  scene.add(new THREE.HemisphereLight('#2a5a66', '#020608', 0.35));
  const rim = new THREE.DirectionalLight('#3f8f9a', 0.25); rim.position.set(-4, 6, -6); scene.add(rim);
  return scene;
}

// Ice ceiling with an optional round hole at the origin.
export function iceCeiling(scene, { y = 9, holeR = 1.35, rand = rng(11), chunks = 260, extent = 60 } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-extent, -extent); shape.lineTo(extent, -extent); shape.lineTo(extent, extent); shape.lineTo(-extent, extent);
  if (holeR > 0) { const h = new THREE.Path(); h.absarc(0, 0, holeR, 0, Math.PI * 2, true); shape.holes.push(h); }
  const ice = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64),
    new THREE.MeshStandardMaterial({ color: '#0d2a33', roughness: 0.55, side: THREE.DoubleSide }));
  ice.rotation.x = Math.PI / 2; ice.position.y = y; g.add(ice);
  const chunkMat = new THREE.MeshStandardMaterial({ color: '#12343d', roughness: 0.7 });
  for (let i = 0; i < chunks; i++) {
    const s = 0.4 + rand() * 1.6;
    const r = holeR + 0.4 + s * 1.2 + rand() * 26, a = rand() * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), chunkMat);
    m.position.set(Math.cos(a) * r, y - s * 0.35, Math.sin(a) * r);
    m.scale.y = 0.35; m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(m);
  }
  let sky = null;
  if (holeR > 0) {
    sky = new THREE.Mesh(new THREE.CircleGeometry(holeR + 0.25, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(2.2), fog: false }));
    sky.rotation.x = Math.PI / 2; sky.position.y = y + 0.3; g.add(sky);
  }
  scene.add(g);
  return { group: g, sky };
}

// Additive volumetric light cone. top at y=top, length len.
export function lightShaft(scene, { top = 9, len = 18, rTop = 1.3, rBot = 4.2, strength = 0.24, color = PAL.beam } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: color.clone() }, uBoost: { value: 1 }, uStrength: { value: strength } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uTime; uniform vec3 uColor; uniform float uBoost; uniform float uStrength;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float len  = smoothstep(0.0, 0.95, vUv.y);
        float ripple = 0.85 + 0.15*sin(vUv.x*40.0 + uTime*1.3) * sin(vUv.y*9.0 - uTime*0.7);
        float glow = mix(0.55, 1.0, vUv.y);
        gl_FragColor = vec4(uColor * edge * len * ripple * glow * uStrength * uBoost, 1.0);
      }`,
  });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 96, 1, true), mat);
  outer.position.y = top - len / 2;
  const innerMat = mat.clone(); innerMat.uniforms.uBoost.value = 0.8;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.55, rBot * 0.52, len, 96, 1, true), innerMat);
  inner.position.y = top - len / 2;
  const g = new THREE.Group(); g.add(outer, inner); scene.add(g);
  return {
    group: g,
    update(t, boost = 1) {
      for (const m of [mat, innerMat]) m.uniforms.uTime.value = t;
      mat.uniforms.uBoost.value = boost * (1 + 0.15 * Math.sin(t * 0.9));
      innerMat.uniforms.uBoost.value = 0.8 * boost;
    },
  };
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Marine snow. beam(x,y,z) -> 0..1 warmth, so particles glow inside light.
export function marineSnow(scene, { n = 4500, box = [30, 20, 24], center = [0, 0, 0], size = 0.06, fall = 0.18, rand = rng(3),
  cold = '#1d3e46', warm = '#ffb36b', beam = () => 0 } = {}) {
  const pos = new Float32Array(n * 3), base = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) base[i * 3 + k] = center[k] + (rand() - 0.5) * box[k];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts);
  const cC = new THREE.Color(cold), cW = new THREE.Color(warm), tmp = new THREE.Color();
  const hy = box[1] / 2;
  return {
    points: pts,
    update(t) {
      for (let j = 0; j < n; j++) {
        const x = base[j * 3] + Math.sin(t * 0.3 + j) * 0.08;
        let y = base[j * 3 + 1] - center[1] - t * fall; y = ((y + hy) % box[1] + box[1]) % box[1] - hy + center[1];
        const z = base[j * 3 + 2];
        pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
        tmp.copy(cC).lerp(cW, beam(x, y, z));
        col[j * 3] = tmp.r; col[j * 3 + 1] = tmp.g; col[j * 3 + 2] = tmp.b;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}

// warmth of a point inside a vertical cone beam centred on x=z=0 between yTop and yTop-len.
export const coneBeam = (yTop = 9, len = 18, rTop = 1.3, rBot = 4.2) => (x, y, z) => {
  const rad = Math.hypot(x, z), r = rTop + (yTop - y) / len * (rBot - rTop);
  return THREE.MathUtils.smoothstep(r - rad, -0.4, 0.6);
};

export function warmSpot(scene, { pos = [0, 9, 0], target = [0, -6, 0], intensity = 900, angle = 0.22, color = PAL.sodium } = {}) {
  const s = new THREE.SpotLight(color, intensity, 40, angle, 0.6, 1.6);
  s.position.set(...pos); s.target.position.set(...target);
  scene.add(s, s.target);
  return s;
}
