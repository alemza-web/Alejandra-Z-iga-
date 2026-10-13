// Recreación educativa 3D: sismo de Panamá del 9 de octubre de 2026.
// Toda la escena es una función del tiempo t (segundos): renderAt(t). Así el render
// cuadro por cuadro (render/render.mjs) es determinista y reproducible.
import * as THREE from 'three';

const W = 1080, H = 1920;
const RENDER = new URLSearchParams(location.search).has('render');
if (RENDER) document.body.classList.add('render');

const getJSON = (u) => fetch(u).then((r) => r.json());
const [meta, demBuf, border, tl] = await Promise.all([
  getJSON('../data/panama_dem.json'),
  fetch('../data/panama_dem.bin').then((r) => r.arrayBuffer()),
  getJSON('../data/panama_frontera.geojson'),
  getJSON('../salida/linea_de_tiempo.json'),
]);
const dem = new Int16Array(demBuf);
const S = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
const DURATION = tl.duration;

// ---------------------------------------------------------------- geografía
// 1 unidad = 1 km en horizontal. Vertical exagerada: tierra y profundidad ×5, fondo marino ×3.
const LON0 = (meta.lon_min + meta.lon_max) / 2, LAT0 = (meta.lat_min + meta.lat_max) / 2;
const KX = 110.1, KZ = 110.6, V = 5, VSEA = 3;
const toX = (lon) => (lon - LON0) * KX;
const toZ = (lat) => -(lat - LAT0) * KZ;
const MAP_W = (meta.lon_max - meta.lon_min) * KX, MAP_H = (meta.lat_max - meta.lat_min) * KZ;

function demAt(lon, lat) {
  const fx = (lon - meta.lon_min) / (meta.lon_max - meta.lon_min) * (meta.width - 1);
  const fy = (meta.lat_max - lat) / (meta.lat_max - meta.lat_min) * (meta.height - 1);
  const x0 = Math.max(0, Math.min(meta.width - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(meta.height - 2, Math.floor(fy)));
  const ax = fx - x0, ay = fy - y0, g = (x, y) => dem[y * meta.width + x];
  return (g(x0, y0) * (1 - ax) + g(x0 + 1, y0) * ax) * (1 - ay) + (g(x0, y0 + 1) * (1 - ax) + g(x0 + 1, y0 + 1) * ax) * ay;
}
const yOf = (h) => (h > 0 ? 0.25 + (h / 1000) * V : -0.4 + (h / 1000) * VSEA);
const xToLon = (x) => x / KX + LON0, zToLat = (z) => -z / KZ + LAT0;
const surfY = (x, z) => yOf(demAt(xToLon(x), zToLat(z)));

// Datos verificados (USGS, evento us6000u18k)
const EPI = { lat: 7.587, lon: -80.769, depthKm: 12.6 };
const XE = toX(EPI.lon), ZE = toZ(EPI.lat), YE = surfY(XE, ZE);
const YH = -EPI.depthKm * V; // hipocentro

// ---------------------------------------------------------------- render básico
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02101f);
scene.fog = new THREE.Fog(0x02101f, 500, 1500);
const camera = new THREE.PerspectiveCamera(42, W / H, 1, 4000);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b2440, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-300, 400, -200);
scene.add(sun);

// ---------------------------------------------------------------- textura del relieve
function panamaMask(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  for (const f of border.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      ctx.beginPath();
      for (const ring of poly) ring.forEach(([lo, la], i) => {
        const px = (lo - meta.lon_min) / (meta.lon_max - meta.lon_min) * w;
        const py = (meta.lat_max - la) / (meta.lat_max - meta.lat_min) * h;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.fill('evenodd');
    }
  }
  return c;
}

function ramp(stops, v) {
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], k = (v - a) / (b - a);
      return ca.map((c, j) => c + (cb[j] - c) * k);
    }
  }
  return stops[stops.length - 1][1];
}
const LAND = [[0, [62, 140, 74]], [250, [104, 168, 82]], [900, [178, 164, 104]], [1800, [150, 118, 84]], [2800, [214, 204, 190]], [4000, [245, 245, 245]]];
const SEA = [[-5000, [8, 36, 84]], [-2500, [14, 66, 132]], [-600, [24, 104, 178]], [-80, [40, 150, 205]], [0, [80, 190, 220]]];

function buildTexture() {
  const w = meta.width, h = meta.height;
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(w, h);
  const mask = panamaMask(w, h).getContext('2d').getImageData(0, 0, w, h).data;
  const cell = 550, sunAz = (315 * Math.PI) / 180, sunAlt = (45 * Math.PI) / 180;
  const lx = Math.sin(sunAz) * Math.cos(sunAlt), ly = Math.cos(sunAz) * Math.cos(sunAlt), lz = Math.sin(sunAlt);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, e = dem[i];
      const dx = (dem[y * w + Math.min(w - 1, x + 1)] - dem[y * w + Math.max(0, x - 1)]) / (2 * cell) * 3;
      const dy = (dem[Math.max(0, y - 1) * w + x] - dem[Math.min(h - 1, y + 1) * w + x]) / (2 * cell) * 3;
      const len = Math.hypot(dx, dy, 1);
      const shade = Math.max(0, (-dx * lx - dy * ly + lz) / len);
      let c;
      if (e > 0) {
        c = ramp(LAND, e);
        const k = 0.55 + 0.6 * shade;
        c = c.map((v) => v * k);
        if (mask[i * 4 + 3] < 128) { // países vecinos: atenuados
          const g = (c[0] + c[1] + c[2]) / 3;
          c = c.map((v) => (v * 0.35 + g * 0.65) * 0.55);
        }
      } else {
        c = ramp(SEA, e).map((v) => v * (0.8 + 0.25 * shade));
      }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
  }
  bctx.putImageData(img, 0, 0);

  // Lienzo final ×2 con el contorno de Panamá luminoso
  const S2 = 2, out = document.createElement('canvas'); out.width = w * S2; out.height = h * S2;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, out.width, out.height);
  ctx.lineJoin = 'round';
  for (const [blur, width, color] of [[14, 5, 'rgba(95,243,255,0.55)'], [4, 2.2, 'rgba(200,255,255,0.95)']]) {
    ctx.shadowColor = '#5ff3ff'; ctx.shadowBlur = blur; ctx.lineWidth = width; ctx.strokeStyle = color;
    for (const f of border.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const ring of poly) {
        ctx.beginPath();
        ring.forEach(([lo, la], i) => {
          const px = (lo - meta.lon_min) / (meta.lon_max - meta.lon_min) * out.width;
          const py = (meta.lat_max - la) / (meta.lat_max - meta.lat_min) * out.height;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Brillo de ondas sobre el terreno y el agua (inyectado en los shaders estándar)
const waveU = { uEpi: { value: new THREE.Vector2(XE, ZE) }, uWaveT: { value: -1 }, uBeacon: { value: 0 } };
function addWaveGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waveU);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform vec2 uEpi;\nuniform float uWaveT;\nuniform float uBeacon;\n' +
      sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float d = distance(vWP.xz, uEpi);
      vec3 glow = vec3(0.0);
      if (uWaveT > 0.0) {
        float rp = uWaveT * 12.0, rs = uWaveT * 7.0;
        float fall = exp(-d / 220.0);
        glow += vec3(0.37, 0.95, 1.0) * exp(-pow((d - rp) / 2.2, 2.0)) * 0.9 * fall;
        glow += vec3(1.0, 0.71, 0.28) * exp(-pow((d - rs) / 4.5, 2.0)) * 1.1 * fall;
      }
      glow += vec3(1.0, 0.45, 0.2) * uBeacon * exp(-d * d / 60.0) * 0.8;
      gl_FragColor.rgb += glow;`);
  };
}

const clipCut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5000); // conserva z <= constante

const NX = 620, NY = 340;
const terrainGeo = new THREE.PlaneGeometry(MAP_W, MAP_H, NX - 1, NY - 1);
terrainGeo.rotateX(-Math.PI / 2);
{
  const pos = terrainGeo.attributes.position;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const sx = Math.round((i / (NX - 1)) * (meta.width - 1)), sy = Math.round((j / (NY - 1)) * (meta.height - 1));
    pos.setY(j * NX + i, yOf(dem[sy * meta.width + sx]));
  }
  terrainGeo.computeVertexNormals();
}
const terrainMat = new THREE.MeshLambertMaterial({ map: buildTexture(), clippingPlanes: [clipCut] });
addWaveGlow(terrainMat);
scene.add(new THREE.Mesh(terrainGeo, terrainMat));

const waterMat = new THREE.MeshPhongMaterial({
  color: 0x1a7fd4, transparent: true, opacity: 0.6, shininess: 90, specular: 0x9fd8ff, clippingPlanes: [clipCut], depthWrite: false,
});
addWaveGlow(waterMat);
const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), waterMat);
water.rotation.x = -Math.PI / 2;
scene.add(water);
const abyss = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: 0x061a38, clippingPlanes: [clipCut] }));
abyss.rotation.x = -Math.PI / 2; abyss.position.y = -16;
scene.add(abyss);

// ---------------------------------------------------------------- utilidades de brillo
function glowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();
const additive = (color, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra,
});
const sprite = (color, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1); return s;
};

// ---------------------------------------------------------------- epicentro (señal luminosa)
const epi = new THREE.Group();
epi.position.set(XE, YE, ZE);
scene.add(epi);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 70, 16, 1, true), additive(0xffb547, 0.6));
beam.position.y = 35; epi.add(beam);
const beamCore = sprite(0xffd28a, 26); beamCore.position.y = 1.5; epi.add(beamCore);
const epiRings = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), additive(0xff8a3c, 0, { side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 1.2; epi.add(m); return m;
});

// ---------------------------------------------------------------- corte del terreno
const CUT_X0 = XE - 150, CUT_X1 = XE + 110, CUT_BOTTOM = -100, NCUT = 260;
const profile = new Float32Array(NCUT);
for (let i = 0; i < NCUT; i++) profile[i] = surfY(CUT_X0 + ((CUT_X1 - CUT_X0) * i) / (NCUT - 1), ZE);

function strataTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const ctx = c.getContext('2d');
  const bands = [[0, '#9b6a3f'], [0.06, '#7d5434'], [0.16, '#6c4630'], [0.3, '#5b3a2b'], [0.48, '#4c2f27'], [0.7, '#3e2522'], [1, '#2f1b1c']];
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  bands.forEach(([k, col]) => g.addColorStop(k, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
  for (let y = 10; y < 512; y += 22 + (y % 7)) ctx.fillRect(0, y, 64, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
const STRATA = strataTexture();
const TOP_REF = 25; // v=1 corresponde a y=TOP_REF
function wallGeometry(topFn, bottomFn) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < NCUT; i++) {
    const x = CUT_X0 + ((CUT_X1 - CUT_X0) * i) / (NCUT - 1), yt = topFn(i), yb = bottomFn(i);
    pos.push(x, yt, 0, x, yb, 0);
    uv.push(i / 20, (yt - CUT_BOTTOM) / (TOP_REF - CUT_BOTTOM), i / 20, (yb - CUT_BOTTOM) / (TOP_REF - CUT_BOTTOM));
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
const cut = new THREE.Group();
cut.position.z = ZE + 0.05;
scene.add(cut);
const wallMat = new THREE.MeshBasicMaterial({ map: STRATA, side: THREE.DoubleSide, transparent: true, opacity: 0 });
cut.add(new THREE.Mesh(wallGeometry((i) => profile[i], () => CUT_BOTTOM), wallMat));
const seaMat = new THREE.MeshBasicMaterial({ color: 0x1a7fd4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
cut.add(new THREE.Mesh(wallGeometry(() => 0, (i) => Math.min(profile[i], 0)), seaMat));
// borde superior luminoso del corte
const edgePts = [];
for (let i = 0; i < NCUT; i++) edgePts.push(new THREE.Vector3(CUT_X0 + ((CUT_X1 - CUT_X0) * i) / (NCUT - 1), Math.max(profile[i], 0) + 0.3, 0.3));
const edgeMat = additive(0x5ff3ff, 0);
cut.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), 400, 0.35, 6), edgeMat));

// Ondas dentro del corte (shader sobre un plano en el mismo plano del corte)
const profTex = new THREE.DataTexture(profile, NCUT, 1, THREE.RedFormat, THREE.FloatType);
profTex.needsUpdate = true; profTex.magFilter = profTex.minFilter = THREE.LinearFilter;
const sectionWaveMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT1: { value: -1 }, uHypo: { value: new THREE.Vector2(XE, YH) }, uProf: { value: profTex }, uX0: { value: CUT_X0 }, uX1: { value: CUT_X1 }, uOp: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec3 vP; uniform float uT1, uX0, uX1, uOp; uniform vec2 uHypo; uniform sampler2D uProf;
    vec3 burst(float t, float d){
      if (t <= 0.0) return vec3(0.0);
      float rp = t * 12.0, rs = t * 7.0, fade = exp(-t * 0.12);
      vec3 c = vec3(0.37, 0.95, 1.0) * (exp(-pow((d - rp) / 1.6, 2.0)) + 0.25 * exp(-pow((d - rp + 6.0) / 3.0, 2.0)));
      c += vec3(1.0, 0.71, 0.28) * 1.2 * exp(-pow((d - rs) / 3.2, 2.0));
      return c * fade;
    }
    void main(){
      float top = texture2D(uProf, vec2((vP.x - uX0) / (uX1 - uX0), 0.5)).r;
      if (vP.y > top || vP.x < uX0 || vP.x > uX1) discard;
      float d = distance(vP.xy, uHypo);
      vec3 c = burst(uT1, d);
      gl_FragColor = vec4(c * uOp, 1.0);
    }`,
});
{
  const g = new THREE.PlaneGeometry(CUT_X1 - CUT_X0, TOP_REF - CUT_BOTTOM);
  g.translate((CUT_X0 + CUT_X1) / 2, (TOP_REF + CUT_BOTTOM) / 2, 0.4);
  cut.add(new THREE.Mesh(g, sectionWaveMat));
}
// Hipocentro y línea punteada hasta el epicentro
const hypo = new THREE.Group();
hypo.position.set(XE, YH, 0.9);
cut.add(hypo);
const hypoCore = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0 }));
const hypoGlow = sprite(0xff5a3c, 26);
hypo.add(hypoCore, hypoGlow);
const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
for (let y = YH + 4; y < YE - 1; y += 4) {
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), dashMat);
  d.position.set(XE, y, 0.9); cut.add(d);
}

// ---------------------------------------------------------------- mecanismo (esquema genérico)
const D = new THREE.Vector3(XE + 20, 48, ZE + 85);
const mech = new THREE.Group(); mech.position.copy(D); scene.add(mech);
const BLK = { L: 90, Hh: 14, Wd: 32 };
const topMat = new THREE.MeshLambertMaterial({ color: 0x6f9e58, transparent: true, opacity: 0 });
const sideMat = new THREE.MeshLambertMaterial({ map: STRATA, transparent: true, opacity: 0 });
function makeBlock(sign) {
  const g = new THREE.BoxGeometry(BLK.L, BLK.Hh, BLK.Wd, 1, 1, 24);
  g.translate(0, -BLK.Hh / 2, (sign * BLK.Wd) / 2 + sign * 0.15);
  const m = new THREE.Mesh(g, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  m.userData = { sign, base: g.attributes.position.array.slice() };
  mech.add(m); return m;
}
const blocks = [makeBlock(-1), makeBlock(1)];
// Franja (como una cerca o un camino) que cruza la falla para ver la deformación
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0 });
const stripes = [-1, 1].map((sign) => {
  const g = new THREE.BoxGeometry(2.4, 0.6, BLK.Wd, 1, 1, 24);
  g.translate(0, 0.3, (sign * BLK.Wd) / 2 + sign * 0.15);
  const m = new THREE.Mesh(g, stripeMat); m.userData = { sign, base: g.attributes.position.array.slice() };
  mech.add(m); return m;
});
const faultGlowMat = additive(0xff5a3c, 0, { side: THREE.DoubleSide });
const faultPlane = new THREE.Mesh(new THREE.PlaneGeometry(BLK.L, BLK.Hh), faultGlowMat);
faultPlane.position.y = -BLK.Hh / 2; mech.add(faultPlane);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x5ff3ff, transparent: true, opacity: 0 });
function arrow(sign) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 22, 12), arrowMat); shaft.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 16), arrowMat); head.rotation.z = -Math.PI / 2; head.position.x = 13;
  g.add(shaft, head); g.scale.x = sign; g.position.set(sign * -8, 4, sign * (BLK.Wd - 6)); mech.add(g); return g;
}
const arrows = [arrow(1), arrow(-1)];
const mechRings = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), additive(0xffb547, 0, { side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 1.4; mech.add(m); return m;
});
const mechLight = new THREE.PointLight(0xffffff, 0, 400); mechLight.position.set(40, 80, 80); mech.add(mechLight);

function deformBlocks(load, slip) {
  // load: 0→1 acumulación elástica (cerca de la falla la roca está trabada);
  // slip: 0→1 ruptura (todo el bloque se desplaza y la deformación se libera).
  const DISP = 7;
  for (const m of [...blocks, ...stripes]) {
    const pos = m.geometry.attributes.position, base = m.userData.base, s = m.userData.sign;
    for (let i = 0; i < pos.count; i++) {
      const z = Math.abs(base[i * 3 + 2]);
      const elastic = DISP * Math.min(z / BLK.Wd, 1);
      const dx = (elastic * load * (1 - slip) + DISP * slip) * -s;
      pos.setX(i, base[i * 3] + dx);
    }
    pos.needsUpdate = true;
    m.geometry.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------- etiquetas
const LABELS = [
  { id: 'pac', cls: 'sea', html: 'Océano Pacífico', p: [toX(-80.75), 0, toZ(7.1)], show: ['titulo'] },
  { id: 'car', cls: 'sea', html: 'Mar Caribe', p: [toX(-79.6), 0, toZ(9.75)], show: ['titulo'] },
  { id: 'cr', cls: 'country', html: 'COSTA RICA', p: [toX(-82.95), 6, toZ(9.55)], show: ['titulo'] },
  { id: 'col', cls: 'country', html: 'COLOMBIA', p: [toX(-77.35), 6, toZ(7.1)], show: ['titulo'] },
  { id: 'pty', cls: 'city', html: 'Ciudad de Panamá', p: [toX(-79.52), 2, toZ(8.98)], show: ['epicentro'] },
  { id: 'azu', cls: 'country', html: 'Península<br>de Azuero', p: [toX(-80.55), 10, toZ(7.36)], show: ['epicentro'] },
  { id: 'epi', cls: 'key epi below', html: 'Epicentro<small>7,587° N · 80,769° O</small>', p: [XE, YE, ZE + 22], show: ['epicentro'] },
  { id: 'epi2', cls: 'key epi side', html: 'Epicentro<small>punto en la superficie</small>', p: [XE + 4, YE + 3, ZE], show: ['corte'], from: 2 },
  { id: 'hip', cls: 'key hypo', html: 'Hipocentro (foco)<small>≈ 12,6 km bajo tierra</small>', p: [XE + 6, YH, ZE], show: ['corte'], from: 1 },
];
const labelBox = document.getElementById('labels');
for (const L of LABELS) {
  L.el = document.createElement('div'); L.el.className = 'lbl ' + L.cls; L.el.innerHTML = L.html; labelBox.appendChild(L.el);
  L.v = new THREE.Vector3(...L.p);
}

// ---------------------------------------------------------------- tiempo y animación
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a, b, x) => clamp01((x - a) / (b - a));
function window01(t, a, b, fin = 0.6, fout = 0.6) { return Math.min(clamp01((t - a) / fin), clamp01((b - t) / fout)); }
const at = (id, k) => { // instante de la frase k (fraccionario: interpola hacia la siguiente)
  const s = S[id], f = s.frases, i = Math.floor(k), next = i + 1 < f.length ? f[i + 1] : s.end;
  return f[i] + (next - f[i]) * (k - i);
};
const sceneVis = (id, t, fin = 0.6, fout = 0.6) => window01(t, S[id].start, S[id].end, fin, fout);

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const POSES = {
  titulo: { a: [V3(-470, 520, 330), V3(60, -40, -60)], b: [V3(-420, 470, 300), V3(50, -40, -50)], tr: 0 },
  epicentro: { a: [V3(XE - 150, 190, ZE + 210), V3(XE + 12, 0, ZE - 55)], b: [V3(XE - 40, 125, ZE + 165), V3(XE + 6, 0, ZE - 45)], tr: 2.6 },
  corte: { a: [V3(XE + 30, 26, ZE + 235), V3(XE, -34, ZE)], b: [V3(XE - 12, 14, ZE + 215), V3(XE, -36, ZE)], tr: 2.2 },
  mecanismo: { a: [D.clone().add(V3(95, 85, 150)), D.clone().add(V3(0, -6, 0))], b: [D.clone().add(V3(40, 75, 165)), D.clone().add(V3(0, -6, 0))], tr: 2.2 },
  fuentes: { a: [V3(30, 640, 470), V3(-10, 0, 10)], b: [V3(20, 600, 430), V3(-10, 0, 10)], tr: 2.4 },
};
const ORDER = ['titulo', 'epicentro', 'corte', 'mecanismo', 'fuentes'];
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
function poseAt(t) {
  let k = 0;
  for (let i = 0; i < ORDER.length; i++) if (t >= S[ORDER[i]].start) k = i;
  const id = ORDER[k], s = S[id], P = POSES[id];
  const u = clamp01((t - s.start) / (s.end - s.start));
  _p.lerpVectors(P.a[0], P.b[0], u); _t.lerpVectors(P.a[1], P.b[1], u);
  if (k > 0 && P.tr > 0 && t - s.start < P.tr) {
    const prev = POSES[ORDER[k - 1]], e = ease((t - s.start) / P.tr);
    _p.lerpVectors(prev.b[0], _p, e); _t.lerpVectors(prev.b[1], _t, e);
  }
  return [_p, _t];
}

const $ = (id) => document.getElementById(id);
const setPanel = (el, o, dy = 0) => { el.style.opacity = o.toFixed(3); el.style.transform = `translateY(${((1 - o) * dy).toFixed(1)}px)`; };

function renderAt(t) {
  t = Math.max(0, Math.min(DURATION, t));
  const [p, tg] = poseAt(t);
  camera.position.copy(p); camera.lookAt(tg); camera.updateMatrixWorld();

  // --- título
  setPanel($('titulo'), window01(t, 0.2, S.titulo.end + 0.3, 0.8, 0.7), 40);

  // --- epicentro: señal luminosa
  const vEpi = Math.max(window01(t, S.epicentro.start + 0.8, S.corte.end, 1.0, 0.8), 0.5 * sceneVis('fuentes', t));
  const vCut = sceneVis('corte', t);
  beam.material.opacity = 0.55 * vEpi * (1 - 0.6 * vCut) * (0.85 + 0.15 * Math.sin(t * 6));
  beamCore.material.opacity = vEpi;
  beamCore.scale.setScalar(22 + 4 * Math.sin(t * 5));
  epiRings.forEach((r, i) => {
    const ph = ((t * 0.55 + i / 3) % 1);
    r.scale.setScalar(2 + ph * 26); r.material.opacity = vEpi * (1 - ph) * 0.9 * (1 - vCut);
  });
  waveU.uBeacon.value = vEpi * (1 - vCut) * (0.7 + 0.3 * Math.sin(t * 5));

  const dat = $('datos');
  setPanel(dat, window01(t, S.epicentro.start + 1.6, S.epicentro.end + 0.2, 0.7, 0.6), 30);
  dat.querySelectorAll('.row').forEach((r) => {
    const o = smooth(0, 0.5, t - at('epicentro', +r.dataset.at) - 0.2);
    r.style.opacity = o.toFixed(3); r.style.transform = `translateX(${((1 - o) * 30).toFixed(1)}px)`;
  });

  // --- corte
  const cutK = ease(smooth(S.corte.start + 0.6, S.corte.start + 2.4, t)) * (1 - smooth(S.corte.end - 0.3, S.corte.end + 1.2, t));
  clipCut.constant = cutK > 0.001 ? ZE + (1 - cutK) * 420 : 5000;
  const wallO = smooth(0.85, 1, cutK);
  wallMat.opacity = wallO; seaMat.opacity = 0.55 * wallO; edgeMat.opacity = 0.9 * wallO;
  setPanel($('corte-tit'), window01(t, S.corte.start + 0.6, S.corte.end, 0.6, 0.5), 20);
  const vHypo = wallO * smooth(0, 0.6, t - at('corte', 1));
  hypoCore.material.opacity = vHypo; hypoGlow.material.opacity = vHypo * (0.75 + 0.25 * Math.sin(t * 7));
  dashMat.opacity = wallO * smooth(0, 0.8, t - at('corte', 2)) * 0.9;
  const w1 = at('corte', 3) + 0.3;
  sectionWaveMat.uniforms.uT1.value = t - w1;
  sectionWaveMat.uniforms.uOp.value = wallO;
  setPanel($('leyenda-ondas'), window01(t, w1 - 0.2, S.corte.end, 0.5, 0.5), 20);
  // ondas en superficie: llegan al epicentro cuando la onda P alcanza la superficie
  const surfT = t - (w1 + (YE - YH) / 12);
  waveU.uWaveT.value = vCut > 0 && surfT > 0 ? surfT : -1;

  // --- mecanismo
  const vM = window01(t, S.mecanismo.start + 0.8, S.mecanismo.end + 0.2, 0.9, 0.7);
  topMat.opacity = sideMat.opacity = vM; stripeMat.opacity = vM; arrowMat.opacity = vM * 0.95;
  mechLight.intensity = vM * 2.5;
  const tRup = at('mecanismo', 1) + 2.0;
  const load = smooth(S.mecanismo.start + 1.0, tRup, t);
  const slip = ease(smooth(tRup, tRup + 0.35, t));
  deformBlocks(load, slip);
  const after = t - tRup;
  const shake = after > 0 ? Math.exp(-after * 2.2) * 1.4 : 0;
  mech.position.set(D.x + shake * Math.sin(t * 61), D.y + shake * 0.5 * Math.sin(t * 47), D.z + shake * Math.cos(t * 53));
  faultGlowMat.opacity = vM * (after > 0 ? Math.exp(-after * 1.3) : 0.12 * load);
  arrows.forEach((a) => (a.children.forEach((c) => (c.visible = vM > 0.01))));
  mechRings.forEach((r, i) => {
    const ph = after - i * 0.45;
    const on = ph > 0 && ph < 3;
    r.scale.setScalar(1 + ph * 24); r.material.opacity = on ? vM * (1 - ph / 3) : 0;
  });
  setPanel($('mec-tit'), vM, 20);
  setPanel($('mec-pasos'), vM, 20);
  setPanel($('mec-nota'), window01(t, at('mecanismo', 2), S.mecanismo.end + 0.2, 0.6, 0.6), 20);
  $('mec-pasos').querySelectorAll('div').forEach((d) => {
    const on = smooth(0, 0.4, t - at('mecanismo', +d.dataset.at));
    d.style.opacity = (0.25 + 0.75 * on).toFixed(3);
  });

  // --- fuentes
  setPanel($('fuentes'), window01(t, S.fuentes.start + 0.5, DURATION + 1, 0.8, 0.5), 30);
  $('fade').style.opacity = smooth(DURATION - 0.6, DURATION, t).toFixed(3);

  // --- etiquetas proyectadas
  for (const L of LABELS) {
    let o = 0;
    for (const id of L.show) o = Math.max(o, sceneVis(id, t, 0.8, 0.6) * (L.from !== undefined ? smooth(0, 0.6, t - at(id, L.from)) : 1));
    if (L.id === 'hip' || L.id === 'epi2') o *= wallO;
    const v = L.v.clone().project(camera);
    if (v.z > 1) o = 0;
    L.el.style.opacity = o.toFixed(3);
    L.el.style.left = ((v.x * 0.5 + 0.5) * W).toFixed(1) + 'px';
    L.el.style.top = ((-v.y * 0.5 + 0.5) * H).toFixed(1) + 'px';
  }

  renderer.render(scene, camera);
}

window.DURATION = DURATION;
window.renderAt = renderAt;
renderAt(0);
window.sceneReady = true;

// ---------------------------------------------------------------- modo interactivo
if (!RENDER) {
  const stage = $('stage');
  const fit = () => {
    const k = Math.min(innerWidth / W, (innerHeight - 50) / H);
    stage.style.transform = `translate(${(innerWidth - W * k) / 2}px, 0) scale(${k})`;
  };
  addEventListener('resize', fit); fit();
  const audio = new Audio('../salida/narracion.wav');
  const scrub = $('scrub'), play = $('play');
  let manual = 0;
  play.onclick = () => { if (audio.paused) { audio.currentTime = manual; audio.play(); play.textContent = '❚❚ Pausa'; } else { audio.pause(); play.textContent = '▶ Reproducir con narración'; } };
  scrub.oninput = () => { manual = (scrub.value / 1000) * DURATION; audio.currentTime = manual; };
  audio.onended = () => { play.textContent = '▶ Reproducir con narración'; };
  const loop = () => {
    const t = audio.paused ? manual : audio.currentTime;
    if (!audio.paused) { manual = t; scrub.value = Math.round((t / DURATION) * 1000); }
    renderAt(t); requestAnimationFrame(loop);
  };
  loop();
}
