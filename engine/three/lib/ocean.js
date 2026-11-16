// ODDLIGHT ocean kit (generic, reusable): size-aware renderer, depth-graded water column, animated sea surface,
// camera-anchored drifting particles, a bathymetric "sonar" contour material and an additive light cone.
// Units are metres; depth is -y. Everything is deterministic (no Math.random, time comes from the frame clock).
import * as THREE from 'three';

// Renderer that honours the requested frame size (window.ODDLIGHT) so previews can render at reduced resolution.
export function oceanRenderer({ exposure = 1.0, logDepth = true } = {}) {
  const { width = 1080, height = 1920 } = window.ODDLIGHT || {};
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: logDepth });
  r.setPixelRatio(1); r.setSize(width, height);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = exposure;
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  return { renderer: r, width, height };
}

// Water colour and visibility by depth (m): silver-blue surface -> twilight cobalt -> abyssal navy -> hadal near-black.
const STOPS = [
  [0, '#3d7f9c', 0.0020], [150, '#1e5a84', 0.0022], [600, '#0d2f5e', 0.0026], [1500, '#06173a', 0.0030],
  [4000, '#020a1c', 0.0034], [6000, '#01060f', 0.0040], [11000, '#000204', 0.0045],
];
export function waterColumn(depth, out = new THREE.Color()) {
  const d = Math.max(0, depth);
  let i = 0; while (i < STOPS.length - 2 && d > STOPS[i + 1][0]) i++;
  const [d0, c0, f0] = STOPS[i], [d1, c1, f1] = STOPS[i + 1];
  const k = THREE.MathUtils.clamp((d - d0) / (d1 - d0), 0, 1);
  out.set(c0).lerp(new THREE.Color(c1), k);
  return { color: out, density: f0 + (f1 - f0) * k };
}

// Animated sea surface: summed directional waves in the vertex shader; fresnel sky reflection and a sun glint
// from above, a bright rippled ceiling from below.
// `origin` (x, z): waves are evaluated relative to it, so shader float precision holds far from the world origin.
export function seaSurface(scene, { size = 60000, seg = 256, sunDir = [0.3, 0.25, -1], sky = '#b8c9d6', deep = '#123b52', sun = '#fff1d6', origin = [0, 0], horizon = [2000, 26000] } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const u = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(...sunDir).normalize() }, uSky: { value: new THREE.Color(sky) },
    uDeep: { value: new THREE.Color(deep) }, uSunC: { value: new THREE.Color(sun) }, uCam: { value: new THREE.Vector3() }, uRef: { value: new THREE.Vector2(...origin) }, uHz: { value: new THREE.Vector2(...horizon) } };
  // wave slopes evaluated per pixel; each component fades out once it is smaller than a few pixels (no aliasing)
  const waves = `
    vec2 slope(vec2 p, float t, float dist){ vec2 d=vec2(0.);
      vec4 W[8]; W[0]=vec4(0.8,0.6,110.,1.4); W[1]=vec4(-0.5,0.85,61.,0.8); W[2]=vec4(0.95,-0.2,33.,0.42); W[3]=vec4(0.3,-0.95,19.,0.22);
      W[4]=vec4(-0.85,-0.45,11.,0.12); W[5]=vec4(0.6,0.75,6.3,0.07); W[6]=vec4(-0.2,0.98,3.7,0.035); W[7]=vec4(0.9,-0.6,2.2,0.02);
      for(int i=0;i<8;i++){ vec2 dir=normalize(W[i].xy); float k=6.2831/W[i].z; float ph=k*dot(dir,p)-sqrt(9.8*k)*t;
        float fade=1.-smoothstep(W[i].z*6.,W[i].z*30.,dist); d+=fade*W[i].w*k*cos(ph)*dir; }
      return d; }`;
  const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec3 vW; varying vec3 vN;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec3 p=(modelMatrix*vec4(position,1.)).xyz; vW=p; vN=vec3(0.,1.,0.);
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${waves} uniform vec3 uSun,uSky,uDeep,uSunC,uCam; uniform vec2 uRef,uHz; uniform float uTime; varying vec3 vW; varying vec3 vN;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 v=normalize(uCam-vW); float dist=length(uCam-vW); vec3 n;
        vec2 sl=slope(vW.xz-uRef,uTime,dist); n=normalize(vec3(-sl.x,1.,-sl.y));
        if(uCam.y>0.){ float fr=0.02+0.98*pow(1.-max(dot(n,v),0.),5.); vec3 r=reflect(-v,n);
          vec3 skyR=mix(uSky*0.62,uSky*1.12,pow(1.-clamp(r.y,0.,1.),3.));
          float gl=pow(max(dot(r,uSun),0.),700.)*2.2+pow(max(dot(r,uSun),0.),60.)*0.12;
          vec3 body=uDeep*(0.85+0.3*clamp(sl.x*2.+sl.y,-.5,.5)); vec3 c=mix(body,skyR,fr)+uSunC*gl;
          c=mix(c,uSky*0.92,smoothstep(uHz.x,uHz.y,dist)); gl_FragColor=vec4(c,1.); }
        else { float tr=pow(max(dot(-n,v),0.),3.); vec3 c=mix(uDeep*1.2,uSky*1.25,tr); c+=uSunC*pow(max(dot(-v,-uSun),0.),40.)*0.8;
          c=mix(c,uDeep*0.6,smoothstep(80.,1600.,dist)); gl_FragColor=vec4(c,1.); }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const mesh = new THREE.Mesh(g, m); scene.add(mesh);
  return { mesh, update(t, cam) { u.uTime.value = t; u.uCam.value.copy(cam.position); const cell = size / seg; mesh.position.x = Math.round(cam.position.x / cell) * cell; mesh.position.z = Math.round(cam.position.z / cell) * cell; } };
}

function dot(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// Particles in a box that follows the camera (wrapping), drifting slowly: marine snow, plankton specks.
// lit(x,y,z) -> 0..1 lets particles brighten inside a light cone.
export function driftParticles(scene, { n = 1800, box = [40, 40, 40], size = 0.08, color = '#9fb7c4', lit = null, seed = 7, drift = [0.02, 0.06, 0.01] } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) base[i] = rnd();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const c0 = new THREE.Color(color);
  return {
    points: pts, material: mat,
    update(t, cam, { brightness = 1, origin = null } = {}) {
      const o = origin || cam.position;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 3; k++) {
          const span = box[k]; const raw = base[i * 3 + k] * span - t * drift[k] - o.getComponent(k);
          pos[i * 3 + k] = o.getComponent(k) + (((raw % span) + span) % span) - span / 2;
        }
        const w = lit ? lit(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) : 0;
        const b = brightness * (0.18 + 0.82 * w) * (0.6 + 0.4 * base[i * 3]);
        col[i * 3] = c0.r * b; col[i * 3 + 1] = c0.g * b; col[i * 3 + 2] = c0.b * b;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}

// Bathymetric visualisation: dark relief with depth contours (every `minor` m, bold every `major` m), an optional
// highlighted isobath, a ring drawn progressively around a point and a distance fade. Additive, so it can be laid over
// a physically lit copy of the same terrain and faded in/out with uOpacity. additive=false draws it as the opaque
// terrain itself (no coplanar copy, so no z-fighting); uOpacity then fades it to black.
export function contourMaterial({ minor = 250, major = 1000, line = '#64d2de', base = '#0a2533', far = 60000, additive = true } = {}) {
  const u = {
    uOpacity: { value: 1 }, uMinor: { value: minor }, uMajor: { value: major }, uLine: { value: new THREE.Color(line) },
    uBase: { value: new THREE.Color(base) }, uFar: { value: far }, uCam: { value: new THREE.Vector3() },
    uIso: { value: 6000 }, uIsoK: { value: 0 }, uRingC: { value: new THREE.Vector2() }, uRingR: { value: 2000 }, uRingP: { value: 0 },
    uBasin: { value: 0 }, uBasinDepth: { value: 10600 }, uBg: { value: new THREE.Color(0, 0, 0) }, uLightDir: { value: new THREE.Vector3(0.4, 1, 0.3).normalize() },
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: additive, depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    vertexShader: `varying vec3 vW; varying vec3 vN;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uOpacity,uMinor,uMajor,uFar,uIso,uIsoK,uRingR,uRingP,uBasin,uBasinDepth; uniform vec3 uLine,uBase,uCam,uLightDir,uBg; uniform vec2 uRingC;
      varying vec3 vW; varying vec3 vN;
      #include <logdepthbuf_pars_fragment>
      float iso(float d, float step, float px){ float f=abs(fract(d/step+0.5)-0.5)*step; return 1.-smoothstep(0., px, f); }
      void main(){
        #include <logdepthbuf_fragment>
        float d=-vW.y; float px=max(fwidth(d),0.5)*1.2;
        float shade=0.25+0.75*max(dot(normalize(vN),uLightDir),0.);
        vec3 tint=mix(vec3(0.16,0.42,0.50),vec3(0.03,0.08,0.20),smoothstep(5500.,10900.,d));   // shallower = lighter teal
        vec3 c=(uBase+tint*0.55)*shade;
        float l=iso(d,uMinor,px)*0.35+iso(d,uMajor,px*1.6)*0.85;
        c+=uLine*l*0.55;
        float isoL=1.-smoothstep(0.,px*3.,abs(d-uIso)); c+=uLine*isoL*uIsoK*1.8;
        vec2 q=vW.xz-uRingC; float r=length(q); float ang=(atan(q.y,q.x)+3.14159265)/6.2831853;
        float ring=(1.-smoothstep(0.,uRingR*0.035,abs(r-uRingR)))*step(ang,uRingP); c+=vec3(1.0,0.92,0.72)*ring*1.6;
        c+=uLine*0.08*uBasin*smoothstep(uBasinDepth-150.,uBasinDepth+250.,d)*(1.-smoothstep(uRingR*0.8,uRingR*1.4,r));
        float fade=1.-smoothstep(uFar*0.45,uFar,length(uCam-vW));
        gl_FragColor=vec4(uOpacity<0.0 ? c : mix(uBg, c*fade, uOpacity),1.);   // fades from/to the water colour
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  return { material: m, uniforms: u };
}

// Additive light cone (volumetric look) from `origin` toward `dir`; brightest at the lamp, fading with distance.
export function lightCone(scene, { length = 14, radius = 4.5, color = '#d8e8ff', strength = 0.18 } = {}) {
  const g = new THREE.ConeGeometry(radius, length, 48, 1, true); g.translate(0, -length / 2, 0); g.rotateX(-Math.PI / 2);
  const u = { uC: { value: new THREE.Color(color) }, uS: { value: strength }, uL: { value: length } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying float vZ; varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vZ=position.z; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uS,uL; varying float vZ; varying vec3 vN; varying vec3 vV;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float e=pow(abs(dot(normalize(vN),normalize(vV))),1.4); float f=exp(-2.6*vZ/uL);
        gl_FragColor=vec4(uC*e*f*uS,1.); }` });
  const mesh = new THREE.Mesh(g, m); scene.add(mesh);
  return { mesh, set(origin, target, k = 1) { mesh.position.copy(origin); mesh.lookAt(target); u.uS.value = strength * k; mesh.visible = k > 0.001; } };
}

// Fine sediment: mottled grain + soft blotches (map) and the same field as a bump map; tiles every few metres.
export function sedimentTexture({ size = 512, seed = 5, base = [104, 98, 89] } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const img = g.createImageData(size, size);
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const blot = []; for (let i = 0; i < 70; i++) blot.push([rnd() * size, rnd() * size, 6 + rnd() * 40, (rnd() - 0.5) * 0.35]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0.88 + 0.24 * rnd();
    for (const [bx, by, br, bv] of blot) { const dx = Math.min(Math.abs(x - bx), size - Math.abs(x - bx)), dy = Math.min(Math.abs(y - by), size - Math.abs(y - by)); const d = Math.hypot(dx, dy); if (d < br) v += bv * (1 - d / br); }
    const i = (y * size + x) * 4; img.data[i] = base[0] * v; img.data[i + 1] = base[1] * v; img.data[i + 2] = base[2] * v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// beam(x,y,z) helper for particles: 0..1 inside a cone from `o` along unit `d` with half-angle `a`, range `len`.
export function inCone(o, d, a = 0.45, len = 14) {
  const v = new THREE.Vector3();
  return (x, y, z) => {
    v.set(x - o.x, y - o.y, z - o.z); const along = v.dot(d); if (along <= 0 || along > len) return 0;
    const off = Math.sqrt(Math.max(v.lengthSq() - along * along, 0)); const r = along * Math.tan(a);
    return THREE.MathUtils.smoothstep(r - off, -0.2, r * 0.5) * Math.exp(-1.8 * along / len);
  };
}
