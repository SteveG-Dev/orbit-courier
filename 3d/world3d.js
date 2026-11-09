// Orbit Courier 3D: draws planets, pulsars, asteroids, stars and the courier rocket with three.js.
// The game plays on a flat plane (x right, y down). Here that plane is X = x, Y = -y, Z towards the viewer.
// The camera looks straight down -Z, so the plane lines up exactly with the 2D canvas on top, which keeps
// drawing the orbit lines, the trail, text and the HUD in the same coordinates.
import * as THREE from './three.module.min.js';

const H = window.OC3D;
const TAU = Math.PI * 2;
const FOV = 30;

const glCanvas = document.getElementById('gl');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer || !H) dispatchEvent(new Event('world3dfail'));

if (renderer && H){
const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 && matchMedia('(pointer: coarse)').matches;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 30000);

// light: a warm star upper left and slightly in front, a cool fill, a soft rim from behind
scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x120a30, .55));
const key = new THREE.DirectionalLight(0xfff1dc, 3.0); scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x7a9cff, 1.4); scene.add(rim, rim.target);

// ---------- helpers ----------
const col = c => new THREE.Color(c);
const rand = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
function canvasTex(w, h, paint, srgb = true){
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.22, 'rgba(255,255,255,.5)'); r.addColorStop(.55, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const glowMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
const rgbStr = s => `rgb(${s})`;

// ---------- planet surfaces, painted as equirectangular textures ----------
function planetTex(pal, seed){
  return canvasTex(512, 256, (g, w, h) => {
    const r = rand(seed);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal.lo); gr.addColorStop(.25, pal.base); gr.addColorStop(.5, pal.hi); gr.addColorStop(.75, pal.base); gr.addColorStop(1, pal.lo);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (pal.kind === 'gas'){
      for (let i = 0; i < 34; i++){
        const y = r() * h, hh = 2 + r() * 16, a = .08 + r() * .25, light = r() < .5;
        g.fillStyle = light ? `rgba(255,255,255,${a * .7})` : `rgba(0,0,30,${a})`;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / w * TAU * (1 + Math.floor(r() * 3)) + i) * hh * .25);
        g.lineTo(w, y + hh); g.lineTo(0, y + hh); g.closePath(); g.fill();
      }
      for (let i = 0; i < 3; i++){ const x = r() * w, y = h * (.3 + r() * .4), rr = 8 + r() * 18; g.fillStyle = `rgba(${pal.glow},.4)`; g.beginPath(); g.ellipse(x, y, rr * 1.9, rr, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x, y, rr, rr * .45, 0, 0, TAU); g.fill(); }
    } else {
      for (let i = 0; i < 1800; i++){ g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,20'},${r() * .09})`; g.fillRect(r() * w, r() * h, 3, 3); }
      for (let i = 0; i < 55; i++){
        const x = r() * w, y = h * (.1 + r() * .8), cr = 3 + r() * 15;
        g.fillStyle = 'rgba(0,0,15,.28)'; g.beginPath(); g.ellipse(x, y, cr, cr * .9, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, cr, cr * .9, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
    }
  });
}
const ringTex = canvasTex(256, 8, (g, w) => { const r = rand(9); for (let x = 0; x < w; x++){ const a = (.2 + r() * .6) * Math.sin(x / w * Math.PI); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, 0, 1, 8); } });
const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
const ringGeo = new THREE.RingGeometry(1.32, 2.15, 96, 1);
{ const uv = ringGeo.attributes.uv, p = ringGeo.attributes.position; for (let i = 0; i < p.count; i++){ const rr = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (rr - 1.32) / .83, .5); } }

function planetModel(p){
  const pal = H.palOf(p), g = new THREE.Group(), seed = p.idx * 7919 + Math.floor(p.hue * 100);
  const tex = planetTex(pal, seed);
  const ice = p.kind === 'ice';
  const body = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: ice ? .25 : pal.kind === 'gas' ? .75 : .95, metalness: ice ? .15 : 0, emissive: col(pal.base), emissiveIntensity: .08 }));
  body.rotation.set(.35 + (seed % 7) * .05, 0, -.3);
  g.add(body);
  const halo = new THREE.Sprite(glowMat(col(rgbStr(pal.glow)), .55)); halo.scale.setScalar(3.6); g.add(halo);
  // a thin bright atmosphere on the lit edge
  const atmo = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col(rgbStr(pal.glow)) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uCol * f * 1.4, f); }`,
  }));
  atmo.scale.setScalar(1.12); g.add(atmo);
  let ringMesh = null;
  if (p.ringed){
    ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: ringTex, color: col(rgbStr(pal.glow)).lerp(col(0xffffff), .45), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: .8, emissive: col(rgbStr(pal.glow)), emissiveIntensity: .25 }));
    ringMesh.rotation.set(-1.22, 0, -.35);
    g.add(ringMesh);
  }
  const sparks = [];
  if (ice) for (let k = 0; k < 6; k++){ const s = new THREE.Sprite(glowMat(0xeaffff, .9)); s.userData.k = k; g.add(s); sparks.push(s); }
  g.userData = { body, tex, ringMesh, sparks, spin: .25 + (seed % 5) * .06 };
  scene.add(g);
  return g;
}
function pulsarModel(){
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0xdff8ff, toneMapped: false })); g.add(core);
  const glow = new THREE.Sprite(glowMat(0x7fd8ff, .9)); glow.scale.setScalar(6.5); g.add(glow);
  const glow2 = new THREE.Sprite(glowMat(0xffffff, .8)); glow2.scale.setScalar(2.6); g.add(glow2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beams = new THREE.Group();
  for (const s of [1, -1]){ const b = new THREE.Mesh(new THREE.ConeGeometry(.45, 4.4, 24, 1, true), beamMat); b.position.y = s * 2.2; b.rotation.z = s > 0 ? Math.PI : 0; beams.add(b); }
  beams.rotation.x = .5; g.add(beams);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xdcfaff, transparent: true, depthWrite: false, toneMapped: false })); g.add(pulse);
  g.userData = { beams, pulse, core };
  scene.add(g);
  return g;
}

// ---------- asteroids, stars (coins), the rocket ----------
function jitterGeo(seed, amt){
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), p = g.attributes.position, r = rand(seed), key = new Map();
  for (let i = 0; i < p.count; i++){ const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; if (!key.has(k)) key.set(k, 1 + (r() - .5) * amt); const s = key.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s); }
  g.computeVertexNormals(); return g;
}
const rockGeos = [1, 2, 3, 4].map(s => jitterGeo(s, .55));
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7a72, roughness: .95, flatShading: true });
function rockModel(it){
  const g = new THREE.Group();
  const m = new THREE.Mesh(rockGeos[Math.floor((it.x * 13 + it.y) % 4 + 4) % 4], rockMat); m.rotation.set(it.x, it.y, 0); g.add(m);
  const warn = new THREE.Sprite(glowMat(0xff5d73, .55)); warn.scale.setScalar(4); warn.position.z = -1.2; g.add(warn);
  g.userData = { m };
  scene.add(g); return g;
}
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++){ const rr = i % 2 ? .48 : 1, a = i / 10 * TAU + Math.PI / 2; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; })();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: .32, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 2 }); starGeo.center();
const starMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: .7, roughness: .28, emissive: 0x8a5200, emissiveIntensity: .6 });
function starModel(){ const g = new THREE.Group(); const m = new THREE.Mesh(starGeo, starMat); g.add(m); const gl = new THREE.Sprite(glowMat(0xffc860, .7)); gl.scale.setScalar(4.2); gl.position.z = -.5; g.add(gl); g.userData = { m }; scene.add(g); return g; }

// the courier: nose along +X
const ship = new THREE.Group();
const shipBody = new THREE.Group(); ship.add(shipBody);
{
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4fa, roughness: .35, metalness: .25 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2b02a, roughness: .35, metalness: .55, emissive: 0x4a2a00, emissiveIntensity: .4 });
  const pts = []; for (let i = 0; i <= 16; i++){ const t = i / 16; pts.push(new THREE.Vector2(Math.max(.001, Math.sin(Math.min(1, t * 1.25) * Math.PI * .5) * 4.6 * (1 - Math.pow(t, 3) * .55)), -8 + t * 20.5)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), white); body.rotation.z = -Math.PI / 2; shipBody.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.2, 24), gold); nose.rotation.z = -Math.PI / 2; nose.position.x = 11.3; shipBody.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.25, 2.2, 24), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: .4, emissive: 0xffd166, emissiveIntensity: .4 })); band.rotation.z = Math.PI / 2; band.position.x = -5.2; shipBody.add(band);
  shipBody.userData.band = band;
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-7, 7); fin.lineTo(-8.5, 7); fin.lineTo(-6, 0); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: .8, bevelEnabled: false }); finGeo.translate(0, 3.2, -.4);
  for (let k = 0; k < 3; k++){ const f = new THREE.Mesh(finGeo, gold); f.rotation.x = k / 3 * TAU; f.position.x = 0; shipBody.add(f); }
  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5b7bff, roughness: .1, metalness: .3, emissive: 0x1a2a7a, emissiveIntensity: .6 }));
  glass.scale.set(1.3, 1, 1); glass.position.set(4.2, 0, 3.3); shipBody.add(glass);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 2, 20), new THREE.MeshStandardMaterial({ color: 0x55596a, roughness: .5, metalness: .8 })); nozzle.rotation.z = Math.PI / 2; nozzle.position.x = -8.6; shipBody.add(nozzle);
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const flame = new THREE.Mesh(new THREE.ConeGeometry(2.3, 12, 16, 1, true), flameMat); flame.rotation.z = Math.PI / 2; flame.position.x = -15.5; ship.add(flame);
const flameCore = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfffbe8, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); flameCore.rotation.z = Math.PI / 2; flameCore.position.x = -13; ship.add(flameCore);
const shipGlow = new THREE.Sprite(glowMat(0xffd166, .45)); shipGlow.scale.setScalar(30); ship.add(shipGlow);
ship.visible = false; scene.add(ship);

// deep stars behind the plane: real parallax as the camera climbs
{
  const n = lowEnd ? 1200 : 2400, p = new Float32Array(n * 3), c = new Float32Array(n * 3), r = rand(11);
  for (let i = 0; i < n; i++){
    p[i * 3] = -900 + r() * 2200; p[i * 3 + 1] = -r() * 60000 + 2000; p[i * 3 + 2] = -400 - r() * 3200;
    const k = r(), cc = k < .25 ? col(0xb9ccff) : k < .35 ? col(0xffd6a0) : col(0xffffff), b = .45 + r() * .55; c[i * 3] = cc.r * b; c[i * 3 + 1] = cc.g * b; c[i * 3 + 2] = cc.b * b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
}

// ---------- pools keyed by the game's objects ----------
const live = new Map();          // game object -> 3D group
let gen = 0;
function track(obj, make){ let e = live.get(obj); if (!e){ e = { g: make(obj) }; live.set(obj, e); } e.gen = gen; e.g.visible = true; return e.g; }
function sweep(){ for (const [obj, e] of live) if (e.gen !== gen){ scene.remove(e.g); e.g.traverse(o => { if (o.material && o.material.map && o.material.map !== glowTex && o.material.map !== ringTex) o.material.map.dispose(); }); live.delete(obj); } }

// ---------- per frame ----------
let lastBg = null, bgTex = null;
function render(now, sx = 0, sy = 0, zoom = 1){
  const G = H.G, VW = innerWidth, VH = innerHeight, dpr = H.dpr, k = H.scale;
  if (!VW || !VH) return;
  governor(now);
  const pr = Math.min(dpr, Qs.maxRes), pw = Math.round(VW * pr), ph = Math.round(VH * pr);
  if (glCanvas.width !== pw || glCanvas.height !== ph){ renderer.setPixelRatio(pr); renderer.setSize(VW, VH, false); }
  // the game's own painted nebula is the sky
  const bg = H.backdrop(!G);
  if (bg && bg !== lastBg && bg.width){ lastBg = bg; if (bgTex) bgTex.dispose(); bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex; }

  // camera: the plane maps to the screen exactly like the 2D transform (x + offX, y - camY) * scale
  const camY = G ? G.camY : -now * 12;
  let cx = H.W / 2 - sx, cy = camY + H.viewH / 2 - sy;
  let D = (VH / 2) / (k * Math.tan(FOV * Math.PI / 360));
  if (G && zoom !== 1){ cx = G.x + (cx - G.x) / zoom; cy = G.y + (cy - G.y) / zoom; D /= zoom; }
  camera.aspect = VW / VH; camera.position.set(cx, -cy, D); camera.lookAt(cx, -cy, 0); camera.near = D * .05; camera.far = D + 6000; camera.updateProjectionMatrix();
  key.position.set(cx - 600, -cy + 700, D * .9); key.target.position.set(cx, -cy, 0);
  rim.position.set(cx + 500, -cy - 300, -400); rim.target.position.set(cx, -cy, 0);

  gen++;
  if (G){
    const t = G.t;
    for (const p of G.planets){
      if (p.kind === 'pulsar'){
        const g = track(p, pulsarModel), u = g.userData, pulse = 1 + Math.sin(t * 6) * .06;
        g.position.set(p.x, -p.y, 0); g.scale.setScalar(p.r);
        u.core.scale.setScalar(pulse); u.beams.rotation.z = -t * 2.4;
        const ph = (t * .8) % 1; u.pulse.scale.setScalar(1.35 + ph * .9); u.pulse.material.opacity = (1 - ph) * .7;
      } else {
        const g = track(p, planetModel), u = g.userData;
        g.position.set(p.x, -p.y, 0); g.scale.setScalar(p.r);
        u.body.rotation.y = t * u.spin + p.idx;
        u.sparks.forEach((s, i) => { const a = i * 1.9 + p.idx, d = .35 + (i % 3) * .2; s.position.set(Math.cos(a) * d, Math.sin(a) * d, .95); s.scale.setScalar(.12 + .2 * Math.max(0, Math.sin(t * 3 + i * 1.7))); });
      }
    }
    for (const it of G.items){
      if (it.type === 'coin'){ if (it.got) continue; const g = track(it, starModel), r = 10 + Math.sin(t * 5 + it.ph) * 1.5; g.position.set(it.x, -it.y, 4); g.scale.setScalar(r); g.userData.m.rotation.set(0, t * 2.6 + it.ph, Math.sin(t * 2 + it.ph) * .25); }
      if (it.type === 'rock'){ if (it.gone) continue; const g = track(it, rockModel); g.position.set(it.x, -it.y, 0); g.scale.setScalar(it.r * 1.05); g.userData.m.rotation.set(it.rot * .6, it.rot, it.x); }
    }
    // the courier
    if (G.state !== 'dead'){
      const ang = G.state === 'fly' ? Math.atan2(G.vy, G.vx) : Math.atan2(Math.cos(G.a) * G.dir, -Math.sin(G.a) * G.dir);
      ship.visible = true; ship.position.set(G.x, -G.y, 6); ship.rotation.set(0, 0, -ang); ship.scale.setScalar(1.15 * 1.1);
      shipBody.rotation.x = G.state === 'orbit' ? -G.dir * .55 : Math.sin(t * 3) * .25;            // banks into the turn
      const fl = 1 + Math.sin(t * 45) * .14 + (G.state === 'fly' ? .35 : 0);
      flame.scale.set(1, fl, 1); flameCore.scale.set(1, fl, 1);
      const c = col(H.skinColor(t)); flameMat.color.copy(c).lerp(col(0xffb040), .55); shipGlow.material.color.copy(c);
      shipBody.userData.band.material.color.copy(c); shipBody.userData.band.material.emissive.copy(c);
    } else ship.visible = false;
  } else ship.visible = false;
  sweep();
  renderer.render(scene, camera);
}

// ---------- quality: step down automatically when frames run slow ----------
const Qs = { level: 0, maxRes: 2, ema: 16.7, last: 0, slowFor: 0 };
function setQuality(l){ Qs.level = l; Qs.maxRes = [2, 1.5, 1.25, 1][l]; }
if (/[?&]lowgfx(&|=|$)/.test(location.search)) setQuality(3); else if (lowEnd) setQuality(1);
function governor(now){
  const dt = (now - Qs.last) * 1000; Qs.last = now;
  if (dt <= 0 || dt > 200 || document.hidden) return;
  Qs.ema += (dt - Qs.ema) * .05;
  Qs.slowFor = Qs.ema > 22 ? Qs.slowFor + dt : 0;
  if (Qs.slowFor > 2000 && Qs.level < 3){ setQuality(Qs.level + 1); Qs.slowFor = 0; Qs.ema = 16.7; }
}

glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); window.World3D = null; glCanvas.style.display = 'none'; dispatchEvent(new Event('world3dfail')); });
window.World3D = { ok: true, render, scene, camera, Q: Qs, setQuality };
dispatchEvent(new Event('world3d'));
}
