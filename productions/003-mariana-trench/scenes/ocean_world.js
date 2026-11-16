// ODDLIGHT 003 — "The Deepest Place on Earth": ONE continuous world for every narration beat (b1–b8).
// Each beat renders the same world at global time g = timeline.t0 + t, so consecutive beats join without a cut in
// space or time. All events are keyed to measured narration words (params.timeline), never to hand-typed seconds.
//   b1 surface · b2 dive + trench reveal (bathymetric view) · b3 Challenger Deep ring · b4 last sunlight, 6,000 m isobath
//   b5 lander + pressure gauge · b6 amphipods at the bait · b7 one snailfish · b8 arrival on the floor, slow drift
import * as THREE from 'three';
import { makeSky } from 'oddlight/nature.js';
import { oceanRenderer, waterColumn, seaSurface, driftParticles, contourMaterial, lightCone, inCone, sedimentTexture } from 'oddlight/ocean.js';
import { heightAt, floorDetail, terrainGeometry } from './lib/trench.js';
import { makeLander } from './lib/lander.js';
import { amphipodSwarm, snailfish } from './lib/fauna.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const sm = (a, b, x) => ss((x - a) / (b - a));
const eio = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = THREE.MathUtils.lerp;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;
const dirPitch = (p) => V(0, Math.sin(deg(p)), -Math.cos(deg(p)));

export async function build({ params }) {
  const TL = params.timeline;
  if (!TL) throw new Error('ocean_world needs "uses_timeline": true');
  const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s.start]));
  const key = (w) => w.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  const word = (scene, w) => { const x = TL.words.find((q) => q.scene === scene && key(q.word) === w); if (!x) throw new Error(`word '${w}' not in ${scene}`); return x.start; };
  const B2 = S.b2, B3 = S.b3, B4 = S.b4, B5 = S.b5, B6 = S.b6, B7 = S.b7, B8 = S.b8, E = S.end ?? TL.duration;
  const wSeafloor = word('b2', 'seafloor'), wChall = word('b3', 'challenger'), wTen = word('b3', 'ten');
  const wIt = word('b4', 'it'), wBelow = word('b4', 'below'), wSix = word('b4', 'six'), wHadal = word('b4', 'hadal');
  const wMore = word('b5', 'more'), wThousand = word('b5', 'thousand');
  const wLife = word('b6', 'life'), wFish = word('b7', 'fish'), wEight = word('b7', 'eight');
  const wBottom = word('b8', 'bottom'), wIncomplete = word('b8', 'incomplete');
  const tLand = wIncomplete + 0.6;
  const Z0 = 34000;                                   // surface start, on the trench axis 34 km from Challenger Deep

  const { renderer, width, height } = oceanRenderer({ exposure: 1.0 });
  const observer = new THREE.PointLight('#c9d6e6', 0, 6, 1.4);   // dim light near the viewer (documentary camera light) so the hero reads
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.02, 160000);
  scene.fog = new THREE.FogExp2('#000000', 0.002);
  scene.add(new THREE.AmbientLight('#0c1a2a', 0.06), observer);

  // sky + sea surface (b1, start of b2)
  const sky = makeSky({ elevation: 30, azimuth: 65, turbidity: 4, rayleigh: 1.2, mie: 0.004 }); scene.add(sky.sky);
  const sea = seaSurface(scene, { sunDir: sky.sun.toArray(), sky: '#a9bfcd', deep: '#0b3550', origin: [0, Z0], size: 9000, seg: 600, horizon: [1200, 4200] });
  const sunBeams = [[-60, -260], [90, -420], [-170, -520], [30, -150], [160, -300], [-20, -640]]
    .map(([x, dz], i) => ({ o: V(x, 0, Z0 - 9 * B2 + dz), c: lightCone(scene, { length: 300 + 40 * i, radius: 18 + 6 * i, color: '#a8d8ea', strength: 0.16 }) }));
  const farBeam = lightCone(scene, { length: 1100, radius: 230, color: '#b4dcf0', strength: 1.4 });

  // trench: physically lit relief + additive bathymetric contours on the same geometry
  const tg = terrainGeometry({ size: 90000, seg: 360 });
  const cont = contourMaterial({ minor: 250, major: 1000, far: 70000, additive: false });   // the trench is only ever seen as bathymetry
  const contours = new THREE.Mesh(tg, cont.material); contours.renderOrder = 2; scene.add(contours);
  cont.uniforms.uIso.value = 6000; cont.uniforms.uRingR.value = 1500; cont.uniforms.uBasinDepth.value = 10700;
  // close-up sediment patch around the landing site (fine relief)
  const fg = terrainGeometry({ size: 260, seg: 260, h: (x, z) => heightAt(x, z) + floorDetail(x, z) });
  const fc = new Float32Array(fg.attributes.position.count * 3), c = new THREE.Color();
  for (let i = 0; i < fg.attributes.position.count; i++) {
    const x = fg.attributes.position.getX(i), z = fg.attributes.position.getZ(i);
    const n = 0.85 + 0.3 * (floorDetail(x * 3.1, z * 3.1) + 1) / 3;
    c.set('#8a9184').multiplyScalar(n); fc[i * 3] = c.r; fc[i * 3 + 1] = c.g; fc[i * 3 + 2] = c.b;
  }
  fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const sed = sedimentTexture({ base: [150, 156, 140] }); sed.repeat.set(65, 65);
  const floorPatch = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, map: sed, bumpMap: sed, bumpScale: 2.5, roughness: 0.97 })); scene.add(floorPatch);
  const floorY = (x, z) => heightAt(x, z) + floorDetail(x, z);

  // lander, fauna, particles
  const L = makeLander(scene, { lampColor: '#d2efe9' });
  const swarm = amphipodSwarm(scene);
  const fish = snailfish(scene);
  const coneA = lightCone(scene, { length: 6, radius: 2.4, color: '#bfe8e2', strength: 0.08 }), coneB = lightCone(scene, { length: 14, radius: 5.2, color: '#bfe8e2', strength: 0.11 });
  const tmpO = V(0, 0, 0), tmpD = V(0, 0, 0), tmpO2 = V(0, 0, 0), tmpD2 = V(0, 0, 0);
  const litA = inCone(tmpO, tmpD, 0.5, 6), litB = inCone(tmpO2, tmpD2, 0.5, 14);
  const snow = driftParticles(scene, { n: 2600, box: [22, 22, 22], size: 0.03, color: '#b6d6d0', lit: (x, y, z) => Math.max(litA(x, y, z), litB(x, y, z)) });

  // ---------- camera choreography ----------
  // phase A (b1–b4): free camera, travelling -z along the trench axis toward Challenger Deep at the origin
  const pA2 = V(0, 40 - 1.2 * B2, Z0 - 9 * B2);
  const pB3 = V(0, -2500, 25500), pB4 = V(0, -5600, 8600), pB5 = V(0, -7000, 3600);
  const basinLook = V(0, -10400, 0), beamPt = V(300, -520, 5400), downLook = V(0, -9200, -2500);
  function phaseA(g) {
    if (g < B2) {
      const p = V(0, 40 - 1.2 * g, Z0 - 9 * g);
      return { p, d: dirPitch(lerp(-8, -30, ss(g / B2))) };
    }
    if (g < B3) {
      const k = (g - B2) / (B3 - B2);
      const p = V(0, lerp(pA2.y, pB3.y, eio(k)), lerp(pA2.z, pB3.z, ss(k)));
      const dA = dirPitch(lerp(-30, -56, sm(0, 0.16, k)));          // oblique, so the sun shafts read as rays
      const dB = basinLook.clone().sub(p).normalize();
      return { p, d: dA.lerp(dB, sm(0.32, 0.95, k)).normalize() };
    }
    if (g < B4) {
      const k = (g - B3) / (B4 - B3);
      return { p: pB3.clone().lerp(pB4, eio(k)), d: basinLook.clone().sub(pB3.clone().lerp(pB4, eio(k))).normalize() };
    }
    const tx = wSix + 0.3;                           // the camera crosses 6,000 m as 'six thousand' is spoken
    const y = g < tx ? lerp(pB4.y, -6000, ss((g - B4) / (tx - B4))) : lerp(-6000, pB5.y, ss((g - tx) / (B5 - tx)));
    const p = V(0, y, lerp(pB4.z, pB5.z, ss((g - B4) / (B5 - B4))));
    const base = basinLook.clone().sub(p).normalize().lerp(downLook.clone().sub(p).normalize(), sm(B4, B5, g)).normalize();
    const up = beamPt.clone().sub(p).normalize();
    const u = sm(B4 - 0.1, B4 + 0.7, g) * (1 - sm(wIt + 0.3, wBelow + 0.3, g));
    return { p, d: base.lerp(up, u).normalize() };
  }
  const endA = phaseA(B5 - 1e-4);
  // phase B (b5–b8): camera relative to the descending lander
  const O5 = V(6, 22, 12);
  const L5 = endA.p.clone().sub(O5);
  const yFloor0 = floorY(0, 0) + 0.06;
  const knots = [[B5, L5.y], [B6, -7480], [wFish, -8240], [wEight, -8336], [B8, -8420], [tLand, yFloor0]];
  function landerY(g) {
    if (g >= tLand) return yFloor0;
    for (let i = 0; i < knots.length - 1; i++) {
      const [a, ya] = knots[i], [b, yb] = knots[i + 1];
      if (g <= b) { const k = (g - a) / (b - a); return lerp(ya, yb, i === knots.length - 2 ? 1 - Math.pow(1 - clamp01(k), 2.2) : clamp01(k)); }
    }
    return yFloor0;
  }
  const landerPos = (g) => V(lerp(L5.x, 0, sm(B5, tLand, g)), landerY(g), lerp(L5.z, 0, sm(B5, tLand, g)));
  const gaugeO = V(1.3, 1.12, 0.28), baitO = V(-1.3, 0.78, 1.0), fishO = V(-2.1, 1.2, 1.5), descO = V(-3.0, 3.2, 2.6);
  const gaugeA = L.gauge.clone(), baitA = L.bait.clone(), fishA = V(-1.6, 0.95, -0.6);
  // move around the lander on a cylinder (never through its frame)
  function orbit(a, b, k) {
    const ra = Math.hypot(a.x, a.z), rb = Math.hypot(b.x, b.z), aa = Math.atan2(a.z, a.x); let ab = Math.atan2(b.z, b.x);
    const r = lerp(ra, rb, k) + 0.5 * Math.sin(Math.PI * k), an = lerp(aa, ab, k);
    return V(Math.cos(an) * r, lerp(a.y, b.y, k), Math.sin(an) * r);
  }
  function phaseB(g) {
    let O, A;
    if (g < B6) {
      const k = eio(sm(B5, wMore, g)); O = O5.clone().lerp(gaugeO, k); A = V(0, 1, 0).lerp(gaugeA, sm(B5 + 0.5, wMore, g));
    } else if (g < B7) {
      const k = sm(B6, B6 + 1.6, g); O = orbit(gaugeO, baitO, k).applyAxisAngle(V(0, 1, 0), 0.28 * sm(B6 + 1.6, B7, g)); A = gaugeA.clone().lerp(baitA, k);
    } else if (g < B8) {
      const k = sm(B7, B7 + 1.4, g); O = baitO.clone().applyAxisAngle(V(0, 1, 0), 0.28).lerp(fishO, k);
      A = baitA.clone().lerp(fishA, k).add(V(0, -0.5 * sm(wEight + 2.2, B8, g), 0));
    } else if (g < tLand) {
      const k = eio(sm(B8, B8 + 1.2, g)); O = fishO.clone().lerp(descO, k); A = fishA.clone().add(V(0, -0.5, 0)).lerp(V(0, 0.4, 0), k);
    } else {
      // after touchdown: the camera slips past the lander and drifts forward over the lit sediment
      const k = sm(tLand, E, g), m = eio(sm(tLand, tLand + 3.2, g));
      // after touchdown: a slow pull-back and rise; the lander's pool of light becomes a small island in the dark
      O = descO.clone().lerp(V(-3.4, 2.6, 3.4), m).lerp(V(-9.5, 7.5, 10.5), eio(k));
      A = V(0, 0.4, 0).lerp(V(-0.6, 0.0, -0.4), m);
    }
    const lp = landerPos(g), p = lp.clone().add(O);
    p.y = Math.max(p.y, floorY(p.x, p.z) + 0.6);
    let d = lp.clone().add(A).sub(p).normalize();
    const blend = sm(B5, B5 + 1.4, g);
    if (blend < 1) d = endA.d.clone().lerp(d, blend).normalize();
    return { p, d, lp };
  }

  // the fish crosses the frame in camera space (the camera rides with the lander, so this is also lander space)
  const fishPath = (g) => {
    const cam = phaseB(g);
    const right = cam.d.clone().cross(V(0, 1, 0)).normalize(), up = right.clone().cross(cam.d).normalize();
    const k = sm(wFish - 0.3, B8 + 0.4, g);
    return cam.p.clone().addScaledVector(cam.d, 1.45 + 0.12 * Math.sin(k * 3)).addScaledVector(right, lerp(-0.5, 0.44, k)).addScaledVector(up, -0.05 + 0.05 * Math.sin(k * 4));
  };

  const col = new THREE.Color();
  function render(t) {
    const g = (TL.t0 || 0) + t;
    const deep = g >= B5;
    const st = deep ? phaseB(g) : phaseA(g);
    camera.position.copy(st.p); camera.lookAt(st.p.clone().add(st.d)); camera.updateMatrixWorld();
    const depth = -camera.position.y;
    // atmosphere / water
    const above = camera.position.y > 0;
    sky.sky.visible = above; sky.sky.position.copy(camera.position);
    const wc = waterColumn(depth, col);
    scene.background = above ? null : wc.color.clone();
    scene.fog.color.copy(above ? new THREE.Color('#b9c8d2') : wc.color.clone().lerp(new THREE.Color('#02100f'), sm(B5, B5 + 1.0, g)));
    scene.fog.density = above ? 0.00004 : lerp(wc.density, 0.045, sm(B5, B5 + 1.0, g));
    renderer.toneMappingExposure = above ? 0.5 : lerp(0.9, 1.25, sm(B5, B5 + 1, g));
    observer.position.copy(camera.position).add(V(0, 0.3, 0)); observer.intensity = deep ? 2.6 : 0;
    sea.mesh.visible = depth < 2500; sea.update(g, camera);
    sunBeams.forEach(({ o, c: cb }) => cb.set(o, o.clone().add(V(0.12, -1, 0.05)), (1 - sm(150, 700, depth)) * sm(B2, B2 + 0.6, g)));
    farBeam.set(beamPt.clone().setY(0), beamPt.clone().setY(-1100), (1 - sm(word('b4', 'above'), wIt + 0.35, g)) * sm(B2 + 1, B3, g));
    // trench views
    const op = sm(wSeafloor - 0.3, wSeafloor + 1.6, g) * (1 - sm(wHadal, B5 + 0.8, g));
    cont.uniforms.uOpacity.value = op; contours.visible = op > 0.002;
    cont.uniforms.uCam.value.copy(camera.position);
    const ringFade = 1 - sm(B4, B4 + 1.5, g);
    cont.uniforms.uRingP.value = sm(wChall, wChall + 1.6, g) * (ringFade > 0.01 ? 1 : 0);
    cont.uniforms.uBasin.value = sm(wTen, wTen + 0.8, g) * ringFade;
    cont.uniforms.uIsoK.value = sm(wSix - 0.1, wSix + 0.35, g) * (1 - sm(wSix + 1.6, B5 + 0.4, g));
    floorPatch.visible = depth > 10000;
    // lander and lamps
    const lp = deep ? st.lp : landerPos(B5);
    L.group.position.copy(lp); L.group.visible = g > B5 - 0.05; L.group.updateMatrixWorld();
    L.setLamps(deep ? 1 : 0);
    L.setGauge(0.08 + 0.84 * eio(sm(wThousand - 0.2, wThousand + 0.9, g)));
    const aO = L.world(L.lampA.at), aT = L.world(L.lampA.at.clone().addScaledVector(L.lampA.dir, 5));
    const bO = L.world(L.lampB.at), bT = L.world(L.lampB.at.clone().addScaledVector(L.lampB.dir, 5));
    const ck = deep ? 1 - sm(tLand - 1.2, tLand, g) : 0; coneA.set(aO, aT, ck); coneB.set(bO, bT, ck);
    tmpO.copy(aO); tmpD.copy(aT).sub(aO).normalize(); tmpO2.copy(bO); tmpD2.copy(bT).sub(bO).normalize();
    // fauna
    swarm.update(g, L.world(L.bait), sm(wLife, wLife + 4.5, g), g > B6 - 0.2 && g < B8 + 0.6 ? 1 : 0);
    fish.group.visible = g > wFish - 0.35 && g < B8 + 0.4;
    if (fish.group.visible) {
      // orient by its motion relative to the camera (the shared descent is not the fish's own swimming direction)
      const c0 = phaseB(g), c1 = phaseB(g + 0.05), p0 = fishPath(g), rel = fishPath(g + 0.05).sub(c1.p).sub(p0.clone().sub(c0.p));
      fish.group.position.copy(p0);
      fish.group.quaternion.setFromUnitVectors(V(1, 0, 0), rel.normalize());
      fish.update(g);
    }
    snow.update(g, camera, { brightness: deep ? 1 : 0.8 });
    renderer.render(scene, camera);
  }
  return { renderer, render };
}
