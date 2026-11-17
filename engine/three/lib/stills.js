// ODDLIGHT "stills-2.5D v1": a photograph displaced by its monocular depth map, filmed by a real perspective camera,
// then one shared filmic look pass. Scene modules call buildStill(params) and get the usual {renderer, render(t)}.
// params: { image, depth, crop_x (0..1 framing centre of the 9:16 slice), relief (depth scale),
//           camera: { move: 'push'|'drift'|'arc'|'locked', amount, dir: 1|-1, handheld: 0..1 },
//           focus: { depth: 0..1, rack_to?: 0..1, rack_at?: s }, seed, subframes: 1|2, look: LOOK overrides }
import * as THREE from 'three';

export const LOOK_V1 = {                     // shared grade; numbers recorded in productions/006-*/LOOK.md
  black_lift: 0.02, split_shadow: [-0.012, 0.008, 0.01], split_highlight: [0.02, 0.008, -0.02], halation_px: 1.5, halation_opacity: 0.06,
  grain: 0.018, vignette: 0.08, ca_px: 0.6, barrel: 0.005, exposure: 1.0, gate_weave_px: 0.15, fstop_blur_px: 9,
};

const cubic = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// band-limited 1D value noise (smooth, aperiodic): sum of octaves between ~0.1 and ~0.8 Hz
function noise1(t, seed) {
  const h = (i) => { const x = Math.sin((i + seed * 17.13) * 127.1) * 43758.5453; return x - Math.floor(x); };
  const v = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1; };
  return 0.6 * v(t * 0.15) + 0.3 * v(t * 0.4 + 11) + 0.1 * v(t * 0.8 + 23);
}

export async function buildStill({ dur, params }) {
  const { width = 1080, height = 1920 } = window.ODDLIGHT || {};
  const L = { ...LOOK_V1, ...(params.look || {}) };
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; document.body.appendChild(renderer.domElement);
  const loader = new THREE.TextureLoader();
  const img = await loader.loadAsync('/project/' + params.image); img.colorSpace = THREE.SRGBColorSpace;
  const dep = await loader.loadAsync('/project/' + params.depth); dep.colorSpace = THREE.NoColorSpace;
  for (const t of [img, dep]) { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; }
  const ia = img.image.width / img.image.height, fa = width / height;
  const H = 1.0, Wd = H * ia;                                     // image plane: 1 unit tall
  const over = 1.12;                                               // overscan; outside [0,1] UVs the texture mirrors (edge stretch)
  const geo = new THREE.PlaneGeometry(Wd * over, H * over, 320, Math.round(320 / ia));
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * over + 0.5, (uv.getY(i) - 0.5) * over + 0.5);
  const relief = params.relief ?? 0.12;
  const common = { uImg: { value: img }, uDep: { value: dep }, uRelief: { value: relief } };
  const vs = `uniform sampler2D uDep; uniform float uRelief; varying vec2 vUv; varying float vD;
    void main(){ vUv=uv; float d=texture2D(uDep, uv).r; vD=d; vec3 p=position; p.z += d*uRelief; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
  const colorMat = new THREE.ShaderMaterial({ uniforms: common, vertexShader: vs,
    fragmentShader: `uniform sampler2D uImg; varying vec2 vUv; void main(){ gl_FragColor=vec4(texture2D(uImg,vUv).rgb,1.); }   // sRGB texture is decoded to linear by the GPU` });
  const depthMat = new THREE.ShaderMaterial({ uniforms: common, vertexShader: vs, fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(vD,vD,vD,1.); }` });
  const mesh = new THREE.Mesh(geo, colorMat); const scene = new THREE.Scene(); scene.add(mesh);
  const cropX = ((params.crop_x ?? 0.5) - 0.5) * Wd;                // the vertical slice of the 16:9 master
  mesh.position.x = -cropX;
  const vfov = 40, dist = (H * 0.5) / Math.tan(THREE.MathUtils.degToRad(vfov / 2)) * 0.92;   // fills the frame height with a little margin for moves
  const camera = new THREE.PerspectiveCamera(vfov, fa, 0.01, 50);
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
  const rtA = new THREE.WebGLRenderTarget(width, height, rtOpts), rtB = new THREE.WebGLRenderTarget(width, height, rtOpts), rtD = new THREE.WebGLRenderTarget(width, height, rtOpts);
  const cam = params.camera || { move: 'locked' }, seed = params.seed ?? 1, sub = params.subframes ?? 2;
  const focus = params.focus || { depth: 0.6 };
  function place(t) {
    const k = cubic(t / dur), a = cam.amount ?? 0.03, dir = cam.dir ?? 1, hh = cam.move === 'locked' ? 0 : (cam.handheld ?? 1);
    let x = 0, y = 0, z = dist, yaw = 0;
    if (cam.move === 'push') z = dist * (1 - a * k);
    if (cam.move === 'drift') x = dir * a * Wd * 0.25 * (k - 0.5) * 2 * (fa / ia);
    if (cam.move === 'arc') { x = dir * a * 0.6 * (k - 0.5) * 2; yaw = -x * 0.35; }
    // handheld micro-motion: 0.2-0.5 px translation, <=0.05 deg rotation (noise, not a wave); px -> world at the image plane
    const px = H / height;
    x += hh * 0.4 * px * noise1(t, seed); y += hh * 0.35 * px * noise1(t, seed + 5);
    const roll = hh * THREE.MathUtils.degToRad(0.05) * noise1(t, seed + 9);
    camera.position.set(x, y, z); camera.lookAt(x + Math.sin(yaw) * z, y, 0); camera.rotateZ(roll); camera.updateMatrixWorld();
  }
  // look pass: DOF from the depth pass, halation, filmic tonemap, black lift, split tone, grain, vignette, CA, barrel, gate weave
  const post = new THREE.ShaderMaterial({ uniforms: { uA: { value: rtA.texture }, uB: { value: rtB.texture }, uD: { value: rtD.texture }, uRes: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 }, uFocus: { value: 0.6 }, uWeave: { value: new THREE.Vector2() }, uMix: { value: sub > 1 ? 0.5 : 0.0 },
      uL: { value: [L.black_lift, L.halation_px, L.halation_opacity, L.grain, L.vignette, L.ca_px, L.barrel, L.fstop_blur_px] },
      uSS: { value: new THREE.Vector3(...L.split_shadow) }, uSH: { value: new THREE.Vector3(...L.split_highlight) }, uExp: { value: L.exposure } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `uniform sampler2D uA,uB,uD; uniform vec2 uRes,uWeave; uniform float uTime,uFocus,uMix,uL[8],uExp; uniform vec3 uSS,uSH; varying vec2 vUv;
      vec3 src(vec2 uv){ return mix(texture2D(uA,uv).rgb, texture2D(uB,uv).rgb, uMix); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*43.1)*43758.5453); }
      vec3 filmic(vec3 x){ x*=uExp; vec3 a=x*(2.51*x+0.03), b=x*(2.43*x+0.59)+0.14; return clamp(a/b,0.,1.); }   // ACES fit, long shoulder
      void main(){
        vec2 c=vUv-0.5; float r2=dot(c,c); vec2 uv=0.5+c*(1.0-uL[6]*r2*4.0) + uWeave/uRes;          // barrel + gate weave
        float d=texture2D(uD,uv).r; float coc=clamp(abs(d-uFocus)*3.0,0.,1.)*uL[7];                // circle of confusion (px)
        vec3 col=vec3(0.); float wsum=0.;
        for(int i=0;i<12;i++){ float a=float(i)*0.5235988+0.26; vec2 o=vec2(cos(a),sin(a))*coc/uRes;  // hexagonal-ish taps -> polygonal bokeh
          vec3 s=src(uv+o); float w=1.0+0.25*dot(s,vec3(1.0)); col+=s*w; wsum+=w; }
        col=(src(uv)*1.5+col)/(1.5+wsum);
        vec2 ca=c*uL[5]*2.0/uRes; col.r=mix(col.r, src(uv+ca).r, 0.8); col.b=mix(col.b, src(uv-ca).b, 0.8);     // CA at the corners
        vec3 hal=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*0.785398; vec3 s=src(uv+vec2(cos(a),sin(a))*uL[1]*2.0/uRes); hal+=max(s-0.7,0.); }
        col+=hal/8.0*vec3(1.0,0.35,0.25)*uL[2]*6.0;                                                     // red-weighted halation
        col=filmic(col);
        col*=1.0-uL[4]*smoothstep(0.15,0.75,r2*2.0);                                                        // vignette (linear)
        col=pow(clamp(col,0.,1.),vec3(1.0/2.2));                                                           // to display; the rest is display-referred
        float lum=dot(col,vec3(0.2126,0.7152,0.0722));
        col+=uSS*(1.0-smoothstep(0.0,0.5,lum))+uSH*smoothstep(0.5,1.0,lum);                                // split tone (<±4%)
        col=uL[0]+col*(1.0-uL[0]);                                                                          // lifted blacks: 2% of display
        float g=(hash(gl_FragCoord.xy)-0.5)*uL[3]*2.0*(1.2-0.6*abs(lum-0.45)*2.0); col+=g;                 // luma grain, midtone-weighted
        gl_FragColor=vec4(clamp(col,0.,1.),1.);
      }` });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post); const pscene = new THREE.Scene(); pscene.add(quad); const pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  function render(t) {
    place(t); mesh.material = colorMat; renderer.setRenderTarget(rtA); renderer.render(scene, camera);
    if (sub > 1) { place(t + 1 / 96); renderer.setRenderTarget(rtB); renderer.render(scene, camera); place(t); }   // 2 subframes ~ 1/48 s shutter
    mesh.material = depthMat; renderer.setRenderTarget(rtD); renderer.render(scene, camera);
    const f = focus.rack_to != null ? focus.depth + (focus.rack_to - focus.depth) * cubic((t - (focus.rack_at ?? dur / 2)) / 0.9 + 0.5) : focus.depth;
    post.uniforms.uFocus.value = f; post.uniforms.uTime.value = t * 24.0;
    post.uniforms.uWeave.value.set(L.gate_weave_px * noise1(t * 6, seed + 3), L.gate_weave_px * noise1(t * 6, seed + 7));
    renderer.setRenderTarget(null); renderer.render(pscene, pcam);
  }
  return { renderer, render };
}
