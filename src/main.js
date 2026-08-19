import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#scene');
const codeStage = document.querySelector('#code-stage');
const codeWindow = document.querySelector('#code-window');
const terminalLine = document.querySelector('#terminal-line');
const finalMessage = document.querySelector('#final-message');
const hint = document.querySelector('#hint');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x010103, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.1, 10.2);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.30,
  0.42,
  0.86
);
bloom.threshold = 0.86;
bloom.strength = 0.30;
bloom.radius = 0.42;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const root = new THREE.Group();
root.position.set(1.42, -0.02, 0);
scene.add(root);

const bouquet = new THREE.Group();
root.add(bouquet);

const PALETTE = {
  baby: new THREE.Color('#f8aec8'),
  blush: new THREE.Color('#f6c1d5'),
  rose: new THREE.Color('#ee90b7'),
  soft: new THREE.Color('#ffd6e3'),
  pearl: new THREE.Color('#fff0f4'),
  cream: new THREE.Color('#f6eadf'),
  champagne: new THREE.Color('#dfc6a1'),
  mauve: new THREE.Color('#c77f9d'),
  deep: new THREE.Color('#984d70'),
  leaf: new THREE.Color('#7f8a79')
};

const flowerCenters = [
  [-0.05, 1.55,  0.28, 0.92],
  [-1.00, 1.38,  0.06, 0.78],
  [ 0.92, 1.34,  0.08, 0.80],
  [-0.63, 1.98, -0.18, 0.63],
  [ 0.62, 1.98,  0.12, 0.64],
  [-1.49, 0.84,  0.10, 0.62],
  [ 1.45, 0.80,  0.12, 0.64],
  [-0.58, 0.78,  0.62, 0.68],
  [ 0.55, 0.76,  0.66, 0.70],
  [-1.46, 1.65,  0.38, 0.55],
  [ 1.40, 1.63,  0.40, 0.56],
  [ 0.03, 1.00, -0.58, 0.61],
  [-0.12, 2.30,  0.00, 0.50],
  [-0.08, 0.30,  0.40, 0.55]
];

function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function mix(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function randomUnit() {
  return new THREE.Vector3(randn(), randn(), randn()).normalize();
}
function jitterColor(base, amount = 0.025) {
  const c = base.clone();
  c.r = clamp(c.r + randn() * amount);
  c.g = clamp(c.g + randn() * amount);
  c.b = clamp(c.b + randn() * amount);
  return c;
}

const positions = [];
const starts = [];
const colors = [];
const sizes = [];
const phases = [];
const burstDirs = [];
const fallSeeds = [];

function addPoint(p, color, size = 1.0, scatter = 4.8, burstBias = null) {
  positions.push(p.x, p.y, p.z);
  const startDir = randomUnit();
  const r = scatter * (0.36 + Math.random() * 0.82);
  const s = p.clone().addScaledVector(startDir, r);
  s.x += randn() * 0.46;
  s.y += randn() * 0.40;
  s.z += randn() * 0.46;
  starts.push(s.x, s.y, s.z);
  colors.push(color.r, color.g, color.b);
  sizes.push(size);
  phases.push(Math.random() * Math.PI * 2);

  const out = burstBias ? burstBias.clone().normalize() : p.clone().setY(p.y - 0.55).normalize();
  out.x += randn() * 0.30;
  out.y += 0.30 + Math.random() * 0.55;
  out.z += randn() * 0.30;
  out.normalize();
  burstDirs.push(out.x, out.y, out.z);
  fallSeeds.push(Math.random());
}

function petalSurface(scale, ring, petal, petalCount, u, v, ringPhase) {
  const theta = (petal / petalCount) * Math.PI * 2 + ring * 0.29 + ringPhase;
  const inner = ring / 5;
  const length = scale * (0.42 + ring * 0.105);
  const baseRadius = scale * (0.07 + ring * 0.11);
  const along = Math.pow(u, 0.90);
  const radius = baseRadius + length * along;
  const widthProfile = Math.pow(Math.sin(Math.PI * clamp(u)), 0.72);
  const width = scale * (0.16 + ring * 0.036) * widthProfile * v;
  const cup = scale * (0.27 * (1 - along) + 0.045 * ring);
  const edgeLift = scale * 0.10 * Math.pow(Math.abs(v), 1.6) * Math.pow(u, 1.4);
  const curl = scale * (0.026 + ring * 0.007) * Math.sin(v * Math.PI * 2.6 + ringPhase * 4) * u;
  const ruffle = scale * 0.018 * Math.sin(v * Math.PI * 7 + u * 8 + ring * 0.7) * u * u;
  const radial = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
  const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0);
  const p = radial.multiplyScalar(radius).addScaledVector(tangent, width);
  p.z = cup + edgeLift + curl + ruffle - inner * scale * 0.11;
  const lean = mix(0.08, 0.31, inner);
  const axis = tangent.clone().normalize();
  p.applyAxisAngle(axis, -lean * along);
  return p;
}

function chooseRoseBase(ring, edge) {
  const r = Math.random();
  if (r < 0.06) return PALETTE.mauve;
  if (ring <= 1 && r < 0.44) return PALETTE.rose;
  if (edge > 0.72 && r < 0.60) return PALETTE.pearl;
  if (r < 0.42) return PALETTE.baby;
  if (r < 0.74) return PALETTE.blush;
  return PALETTE.soft;
}

function addRose(center, scale, count = 5400, tilt = [0, 0, 0]) {
  const ringPetals = [5, 7, 9, 11, 13, 15];
  const ringWeights = [0.13, 0.15, 0.17, 0.19, 0.19, 0.17];
  const euler = new THREE.Euler(...tilt, 'XYZ');
  for (let i = 0; i < count; i++) {
    let pick = Math.random();
    let ring = ringWeights.length - 1;
    let acc = 0;
    for (let r = 0; r < ringWeights.length; r++) {
      acc += ringWeights[r];
      if (pick <= acc) { ring = r; break; }
    }
    const petalCount = ringPetals[ring];
    const petal = Math.floor(Math.random() * petalCount);
    const u = Math.pow(Math.random(), 0.64);
    const v = clamp(randn() * 0.48, -1, 1);
    const p = petalSurface(scale, ring, petal, petalCount, u, v, ring * 0.17);
    p.applyEuler(euler).add(center);
    p.x += randn() * scale * 0.010;
    p.y += randn() * scale * 0.010;
    p.z += randn() * scale * 0.014;
    const base = chooseRoseBase(ring, Math.abs(v));
    const color = jitterColor(base, 0.022);
    const pointSize = mix(0.62, 1.34, Math.random()) * (ring <= 1 ? 0.88 : 1.0);
    const burstBias = p.clone().sub(center).add(new THREE.Vector3(0, 0.30, 0));
    addPoint(p, color, pointSize, 5.0, burstBias);
  }
  for (let i = 0; i < Math.floor(count * 0.10); i++) {
    const dir = randomUnit();
    dir.z *= 0.72;
    const p = center.clone().addScaledVector(dir.normalize(), scale * (0.55 + Math.random() * 0.62));
    p.x += randn() * scale * 0.06;
    p.y += randn() * scale * 0.06;
    p.z += randn() * scale * 0.06;
    const base = Math.random() < 0.68 ? PALETTE.soft : PALETTE.pearl;
    addPoint(p, jitterColor(base, 0.025), 0.38 + Math.random() * 0.48, 5.2, dir);
  }
}

const flowerTilts = [
  [-.08,.05,.02],[.04,-.18,-.08],[-.02,.15,.07],[.08,-.08,.04],[-.08,.10,-.04],
  [.14,-.20,-.08],[-.08,.22,.10],[-.03,-.06,.01],[.04,.10,-.02],[.03,-.25,.10],
  [-.05,.23,-.07],[.08,.02,.05],[-.06,.00,.02],[.02,.00,.00]
];

flowerCenters.forEach((f, i) => {
  const center = new THREE.Vector3(f[0], f[1], f[2]);
  const count = f[3] > 0.82 ? 6500 : f[3] > 0.68 ? 5600 : 4700;
  addRose(center, f[3], count, flowerTilts[i]);
});

const fillerCenters = [
  [-1.75,1.12,-.28],[-1.26,.48,.27],[-.84,1.34,.78],[-.25,.42,.72],[.35,.40,.74],
  [.90,1.36,.72],[1.63,1.02,-.28],[1.20,.42,.20],[-.96,2.08,.18],[.98,2.07,.05],
  [-1.68,1.73,.10],[1.68,1.70,.12],[-.20,1.60,-.74],[.48,1.48,-.72]
];
for (const fc of fillerCenters) {
  const center = new THREE.Vector3(...fc);
  for (let i = 0; i < 560; i++) {
    const p = center.clone();
    p.x += randn() * 0.30;
    p.y += randn() * 0.25;
    p.z += randn() * 0.25;
    const r = Math.random();
    const base = r < .52 ? PALETTE.cream : r < .82 ? PALETTE.soft : PALETTE.champagne;
    addPoint(p, jitterColor(base, 0.022), 0.34 + Math.random() * 0.42, 5.25);
  }
}

const handle = new THREE.Vector3(0.02, -2.10, -0.04);
for (const f of flowerCenters) {
  const top = new THREE.Vector3(f[0], f[1] - f[3] * 0.28, f[2]);
  for (let i = 0; i < 300; i++) {
    const t = Math.random();
    const p = top.clone().lerp(handle, Math.pow(t, 0.84));
    const spread = mix(0.018, 0.050, 1 - t);
    p.x += randn() * spread;
    p.z += randn() * spread;
    p.y += randn() * 0.014;
    const base = Math.random() < .68 ? PALETTE.cream : PALETTE.champagne;
    addPoint(p, jitterColor(base, 0.018), 0.35 + Math.random() * 0.42, 4.6);
  }
}

for (let i = 0; i < 4300; i++) {
  const t = Math.random();
  const y = mix(-0.16, -2.02, t);
  const radius = mix(1.10, 0.20, t) * (0.52 + Math.random() * 0.55);
  const a = Math.random() * Math.PI * 2;
  const p = new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.46);
  p.x += randn() * 0.035;
  p.y += randn() * 0.035;
  p.z += randn() * 0.035;
  const base = Math.random() < .76 ? PALETTE.pearl : PALETTE.soft;
  addPoint(p, jitterColor(base, 0.02), 0.30 + Math.random() * 0.40, 4.6);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 3));
geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
geometry.setAttribute('aBurst', new THREE.Float32BufferAttribute(burstDirs, 3));
geometry.setAttribute('aFallSeed', new THREE.Float32BufferAttribute(fallSeeds, 1));

const particleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.NormalBlending,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uExplode: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.65) },
    uOpacity: { value: 0.80 }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uMorph;
    uniform float uExplode;
    uniform float uPixelRatio;
    attribute vec3 aStart;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    attribute vec3 aBurst;
    attribute float aFallSeed;
    varying vec3 vColor;
    varying float vAlpha;
    float easeOut(float x) { return 1.0 - pow(1.0 - clamp(x, 0.0, 1.0), 3.0); }
    void main() {
      float m = smoothstep(0.0, 1.0, uMorph);
      vec3 start = aStart;
      float swirl = (1.0 - m);
      start.x += sin(uTime * 0.55 + aPhase * 1.7) * 0.20 * swirl;
      start.y += cos(uTime * 0.43 + aPhase) * 0.16 * swirl;
      start.z += sin(uTime * 0.50 + aPhase * 0.8) * 0.20 * swirl;
      vec3 p = mix(start, position, m);
      float e = easeOut(uExplode);
      float fall = max(0.0, uExplode - 0.18);
      vec3 burst = aBurst * (4.2 + aFallSeed * 2.7) * e;
      burst.y += (0.45 + aFallSeed * 1.2) * sin(3.14159 * min(uExplode, 1.0));
      burst.y -= (5.0 + aFallSeed * 4.0) * fall * fall;
      burst.x += sin(aPhase * 5.0 + uTime * (1.0 + aFallSeed)) * 0.33 * fall;
      burst.z += cos(aPhase * 4.0 + uTime * (0.8 + aFallSeed)) * 0.28 * fall;
      p += burst;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float perspective = 120.0 / max(1.0, -mv.z);
      gl_PointSize = clamp(aSize * uPixelRatio * perspective, 0.75, 3.8);
      gl_Position = projectionMatrix * mv;
      vColor = aColor;
      vAlpha = mix(0.88, 0.54, e);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 q = gl_PointCoord - vec2(0.5);
      float d2 = dot(q, q);
      if (d2 > 0.25) discard;
      float soft = exp(-d2 * 14.0);
      float edge = smoothstep(0.25, 0.02, d2);
      float alpha = soft * edge * uOpacity * vAlpha;
      gl_FragColor = vec4(vColor, alpha);
    }
  `
});

const particlePoints = new THREE.Points(geometry, particleMaterial);
bouquet.add(particlePoints);

const sparkPositions = [];
const sparkColors = [];
for (let i = 0; i < 1900; i++) {
  const a = Math.random() * Math.PI * 2;
  const rr = 0.8 + Math.random() * 2.25;
  const y = -0.1 + Math.random() * 2.65;
  sparkPositions.push(Math.cos(a) * rr, y, Math.sin(a) * rr * 0.58);
  const c = Math.random() < 0.72 ? PALETTE.soft : PALETTE.champagne;
  sparkColors.push(c.r, c.g, c.b);
}
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute('color', new THREE.Float32BufferAttribute(sparkColors, 3));
const sparkMat = new THREE.PointsMaterial({
  size: 0.022,
  vertexColors: true,
  transparent: true,
  opacity: 0.36,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});
const sparkles = new THREE.Points(sparkGeo, sparkMat);
bouquet.add(sparkles);

const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(5.55, 5.35, 5.00));
const boxMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 });
const wireBox = new THREE.LineSegments(boxGeo, boxMat);
wireBox.position.y = 0.18;
root.add(wireBox);

const petalShape = new THREE.Shape();
petalShape.moveTo(0, 0.52);
petalShape.bezierCurveTo(-0.38, 0.34, -0.42, -0.04, 0, -0.52);
petalShape.bezierCurveTo(0.42, -0.04, 0.38, 0.34, 0, 0.52);
const petalGeo = new THREE.ShapeGeometry(petalShape, 5);
petalGeo.scale(0.12, 0.16, 0.12);
const petalMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide,
  depthWrite: false,
  vertexColors: false,
  toneMapped: false
});
const PETAL_COUNT = 720;
const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_COUNT);
petalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
petalMesh.frustumCulled = false;
scene.add(petalMesh);

const petalStates = [];
const petalDummy = new THREE.Object3D();
const petalColors = [PALETTE.baby, PALETTE.blush, PALETTE.soft, PALETTE.pearl, PALETTE.rose];
for (let i = 0; i < PETAL_COUNT; i++) {
  const f = flowerCenters[Math.floor(Math.random() * flowerCenters.length)];
  const local = new THREE.Vector3(
    f[0] + randn() * f[3] * 0.20,
    f[1] + randn() * f[3] * 0.20,
    f[2] + randn() * f[3] * 0.16
  );
  const world = local.clone().add(new THREE.Vector3(1.42, -0.02, 0));
  const dir = local.clone().sub(new THREE.Vector3(0, 0.9, 0)).normalize();
  dir.x += randn() * 0.38;
  dir.y = 0.55 + Math.random() * 1.0;
  dir.z += randn() * 0.38;
  dir.normalize();
  petalStates.push({
    base: world,
    pos: world.clone(),
    vel: dir.multiplyScalar(1.8 + Math.random() * 3.1),
    spin: new THREE.Vector3(randn() * 1.6, randn() * 2.2, randn() * 1.5),
    phase: Math.random() * Math.PI * 2,
    scale: 0.55 + Math.random() * 1.05,
    color: petalColors[Math.floor(Math.random() * petalColors.length)].clone(),
    delay: Math.random() * 0.65
  });
  petalMesh.setColorAt(i, petalStates[i].color);
}
petalMesh.instanceColor.needsUpdate = true;

function updatePetalRain(explodeTime) {
  const visible = explodeTime > 0;
  petalMat.opacity = visible ? Math.min(0.78, explodeTime * 0.72) : 0;
  for (let i = 0; i < PETAL_COUNT; i++) {
    const s = petalStates[i];
    const age = Math.max(0, explodeTime - s.delay);
    if (age <= 0) s.pos.copy(s.base);
    else {
      s.pos.copy(s.base);
      s.pos.addScaledVector(s.vel, age);
      s.pos.y -= 2.15 * age * age;
      s.pos.x += Math.sin(age * 2.4 + s.phase) * (0.15 + age * 0.07);
      s.pos.z += Math.cos(age * 1.8 + s.phase) * (0.12 + age * 0.05);
    }
    petalDummy.position.copy(s.pos);
    petalDummy.rotation.set(
      s.spin.x * age + Math.sin(age * 2.0 + s.phase) * 0.35,
      s.spin.y * age,
      s.spin.z * age + Math.cos(age * 2.4 + s.phase) * 0.45
    );
    const flutterScale = s.scale * (0.86 + 0.14 * Math.sin(age * 4.0 + s.phase));
    petalDummy.scale.setScalar(flutterScale);
    petalDummy.updateMatrix();
    petalMesh.setMatrixAt(i, petalDummy.matrix);
  }
  petalMesh.instanceMatrix.needsUpdate = true;
}

const CODE = [
  ['comment', '// dreamy bouquet — GPU particle pipeline'],
  ['code', '<span class="kw">import</span> * <span class="kw">as</span> THREE <span class="kw">from</span> <span class="str">\'three\'</span>;'],
  ['code', '<span class="kw">const</span> renderer = <span class="kw">new</span> THREE.<span class="fn">WebGLRenderer</span>({ powerPreference: <span class="str">\'high-performance\'</span> });'],
  ['code', 'renderer.toneMapping = THREE.ACESFilmicToneMapping;'],
  ['blank', ''],
  ['code', '<span class="kw">const</span> palette = [babyPink, blush, pearl, champagne];'],
  ['code', '<span class="kw">const</span> bloom = <span class="kw">new</span> <span class="fn">UnrealBloomPass</span>(viewport, <span class="num">0.30</span>, <span class="num">0.42</span>, <span class="num">0.86</span>);'],
  ['log', '[render] bloom exposure protected .... OK'],
  ['blank', ''],
  ['code', '<span class="kw">for</span> (<span class="kw">const</span> rose <span class="kw">of</span> bouquet) {'],
  ['code', '  rose.<span class="fn">samplePetalSurface</span>();'],
  ['code', '  rose.<span class="fn">addDreamMist</span>();'],
  ['code', '}'],
  ['log', '[gpu] rose petal targets ........... ready'],
  ['log', '[gpu] soft gaussian particles ...... ready'],
  ['log', '[gpu] pearl / blush palette ........ ready'],
  ['blank', ''],
  ['code', '<span class="kw">const</span> particles = <span class="num">95000</span> + filler;'],
  ['code', '<span class="kw">const</span> target = <span class="target str">\'故辞安\'</span>;'],
  ['code', '<span class="fn">converge</span>(particles, bouquet);'],
  ['log', '[compute] convergence  25%'],
  ['log', '[compute] convergence  50%'],
  ['log', '[compute] convergence  75%'],
  ['log', '[compute] convergence 100%  OK'],
  ['blank', ''],
  ['code', 'bouquet.<span class="fn">orbitSlowly</span>();'],
  ['code', '<span class="kw">await</span> <span class="fn">holdMoment</span>(<span class="num">12</span>);'],
  ['code', '<span class="kw">const</span> petals = bouquet.<span class="fn">explodeIntoPetalRain</span>();'],
  ['log', '[physics] petals released .......... 720'],
  ['log', '[physics] gravity / flutter ........ active'],
  ['code', '<span class="fn">renderFor</span>(target);'],
  ['comment', '// some flowers are meant to become a whole sky']
];

let renderedCodeIndex = 0;
let lineNumber = 132;
let lastCycle = 0;
function resetCode() {
  codeWindow.innerHTML = '';
  renderedCodeIndex = 0;
  lineNumber = 132;
  codeStage.classList.remove('fade-out');
  finalMessage.classList.remove('show');
  hint.style.opacity = '1';
}
function addCodeLine(item) {
  const [type, html] = item;
  const line = document.createElement('div');
  line.className = 'code-line';
  if (type === 'blank') line.innerHTML = `<span class="ln">${lineNumber++}</span><span>&nbsp;</span>`;
  else if (type === 'comment') line.innerHTML = `<span class="ln">${lineNumber++}</span><span class="comment">${html}</span>`;
  else if (type === 'log') line.innerHTML = `<span class="ln">${lineNumber++}</span><span class="log">${html}</span>`;
  else line.innerHTML = `<span class="ln">${lineNumber++}</span><span>${html}</span>`;
  codeWindow.appendChild(line);
  if (codeWindow.children.length > 24) codeWindow.removeChild(codeWindow.firstElementChild);
  codeWindow.scrollTop = codeWindow.scrollHeight;
}

const clock = new THREE.Clock();
const CYCLE = 40.0;
let elapsedTotal = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsedTotal += dt;
  const t = elapsedTotal % CYCLE;
  if (t < lastCycle) resetCode();
  lastCycle = t;

  const revealTarget = Math.min(CODE.length, Math.floor(Math.max(0, t - 0.30) * 1.72));
  while (renderedCodeIndex < revealTarget) addCodeLine(CODE[renderedCodeIndex++]);

  const morph = smoothstep(1.8, 11.5, t);
  const explode = smoothstep(27.0, 31.0, t);
  particleMaterial.uniforms.uMorph.value = morph;
  particleMaterial.uniforms.uExplode.value = explode;
  particleMaterial.uniforms.uTime.value = elapsedTotal;

  const centerShift = smoothstep(25.0, 28.2, t);
  root.position.x = mix(1.42, 0.0, centerShift);
  const formed = smoothstep(8.0, 12.0, t);
  root.rotation.y = -0.22 + elapsedTotal * mix(0.025, 0.055, formed);
  root.rotation.x = -0.04 + Math.sin(elapsedTotal * 0.18) * 0.022;
  bouquet.rotation.z = Math.sin(elapsedTotal * 0.15) * 0.012;

  sparkMat.opacity = mix(0.34, 0.08, smoothstep(26.0, 29.0, t));
  boxMat.opacity = mix(0.42, 0.10, smoothstep(26.0, 31.0, t));

  const explodeTime = Math.max(0, t - 27.0);
  updatePetalRain(explodeTime);

  const finalPhase = smoothstep(29.0, 33.0, t);
  camera.position.z = mix(10.2, 9.5, finalPhase);
  camera.position.y = mix(0.10, 0.18, finalPhase);
  camera.lookAt(0, 0.0, 0);

  if (t >= 25.7) codeStage.classList.add('fade-out');
  if (t >= 31.8) {
    finalMessage.classList.add('show');
    hint.style.opacity = '0';
  }

  if (explode < 0.02) {
    const pct = Math.round(morph * 100);
    terminalLine.textContent = morph < 1
      ? `GPU bouquet convergence ${pct.toString().padStart(3, ' ')}%`
      : 'dream bouquet stable · pink palette protected';
  } else {
    terminalLine.textContent = `petal rain ${Math.round(explode * 100).toString().padStart(3, ' ')}% · gravity active`;
  }

  composer.render();
  requestAnimationFrame(animate);
}

resetCode();
animate();

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pixelRatio = Math.min(window.devicePixelRatio, 1.65);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  composer.setSize(w, h);
  particleMaterial.uniforms.uPixelRatio.value = pixelRatio;
});
