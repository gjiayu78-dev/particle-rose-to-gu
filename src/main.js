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
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x020204, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, 0.12, 9.4);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.48, 0.64, 0.12);
bloom.threshold = 0.12;
bloom.strength = 1.48;
bloom.radius = 0.62;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const root = new THREE.Group();
root.position.x = 1.55;
scene.add(root);

const pointPositions = [];
const pointStarts = [];
const pointColors = [];
const pointSizes = [];
const pointPhases = [];

const PALETTE = {
  coral: new THREE.Color('#ff718b'),
  rose: new THREE.Color('#f24f76'),
  deep: new THREE.Color('#a8284c'),
  blush: new THREE.Color('#ffc1d0'),
  pearl: new THREE.Color('#fff2e8'),
  cream: new THREE.Color('#f3e7d4'),
  gold: new THREE.Color('#c9b47d'),
  leaf: new THREE.Color('#66705d')
};

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
  const v = new THREE.Vector3(randn(), randn(), randn());
  return v.normalize();
}
function colorJitter(base, amount = 0.05) {
  const c = base.clone();
  c.r = clamp(c.r + randn() * amount);
  c.g = clamp(c.g + randn() * amount);
  c.b = clamp(c.b + randn() * amount);
  return c;
}
function rotateXYZ(v, rx, ry, rz) {
  const e = new THREE.Euler(rx, ry, rz, 'XYZ');
  return v.applyEuler(e);
}
function pushPoint(target, color, size = 1, scatter = 4.4) {
  pointPositions.push(target.x, target.y, target.z);
  const dir = randomUnit();
  const radius = scatter * (0.38 + Math.random() * 0.8);
  const start = target.clone().addScaledVector(dir, radius);
  start.x += randn() * 0.55;
  start.y += randn() * 0.45;
  pointStarts.push(start.x, start.y, start.z);
  pointColors.push(color.r, color.g, color.b);
  pointSizes.push(size);
  pointPhases.push(Math.random() * Math.PI * 2);
}

function rosePoint(localScale, ring, petal, petals, u, v, phase) {
  const theta = (petal / petals) * Math.PI * 2 + ring * 0.31 + phase;
  const length = localScale * (0.34 + ring * 0.105);
  const radial = localScale * 0.06 + length * (0.12 + 0.88 * u);
  const widthProfile = Math.pow(Math.sin(Math.PI * clamp(u)), 0.58);
  const width = length * 0.48 * widthProfile * v * (1.0 - ring * 0.018);
  const ruffle = Math.sin(v * Math.PI * 4.0 + u * 7.0 + phase * 5.0) * localScale * 0.024 * u;
  const cup = localScale * (0.20 * (1.0 - u) + 0.085 * Math.sin(Math.PI * u) * (1.0 - v * v));
  const x = radial * Math.cos(theta) - width * Math.sin(theta);
  const y = radial * Math.sin(theta) + width * Math.cos(theta);
  const z = cup + ruffle - ring * localScale * 0.014;
  return new THREE.Vector3(x, y, z);
}

function addRose(center, scale, palette, tilt = [0, 0, 0], count = 6200) {
  const ringCounts = [5, 7, 9, 11, 13];
  const ringWeights = [0.16, 0.19, 0.22, 0.23, 0.20];
  for (let i = 0; i < count; i++) {
    let rPick = Math.random();
    let ring = 0;
    for (let r = 0, acc = 0; r < ringWeights.length; r++) {
      acc += ringWeights[r];
      if (rPick <= acc) { ring = r; break; }
    }
    const petals = ringCounts[ring];
    const petal = Math.floor(Math.random() * petals);
    const u = Math.pow(Math.random(), 0.64);
    const v = Math.max(-1, Math.min(1, randn() * 0.52));
    const p = rosePoint(scale, ring, petal, petals, u, v, ring * 0.19);
    rotateXYZ(p, tilt[0], tilt[1], tilt[2]);
    p.add(center);
    p.x += randn() * scale * 0.012;
    p.y += randn() * scale * 0.012;
    p.z += randn() * scale * 0.018;

    const edge = Math.abs(v);
    const highlightChance = 0.18 + edge * 0.12;
    const base = Math.random() < highlightChance ? palette[1] : palette[0];
    const c = colorJitter(base, 0.035);
    const size = mix(0.62, 1.52, Math.random()) * (ring < 2 ? 0.9 : 1.0);
    pushPoint(p, c, size, 4.8);
  }

  // soft mist around each rose gives the reference its airy cloud edge
  const mistCount = Math.floor(count * 0.20);
  for (let i = 0; i < mistCount; i++) {
    const dir = randomUnit();
    dir.z *= 0.62;
    const radius = scale * (0.48 + Math.random() * 0.78);
    const p = center.clone().addScaledVector(dir.normalize(), radius);
    p.x += randn() * scale * 0.12;
    p.y += randn() * scale * 0.12;
    p.z += randn() * scale * 0.10;
    const c = colorJitter(Math.random() < 0.48 ? palette[1] : PALETTE.pearl, 0.045);
    pushPoint(p, c, 0.48 + Math.random() * 0.62, 5.0);
  }
}

const flowers = [
  { p: [-0.10, 1.56,  0.22], s: 0.88, pal: [PALETTE.coral, PALETTE.blush], tilt: [-0.10, 0.08, 0.04] },
  { p: [-1.16, 1.28, -0.05], s: 0.78, pal: [PALETTE.rose, PALETTE.blush], tilt: [0.06, -0.18, -0.12] },
  { p: [ 1.04, 1.24, -0.08], s: 0.82, pal: [PALETTE.coral, PALETTE.pearl], tilt: [-0.04, 0.18, 0.10] },
  { p: [-0.67, 1.92, -0.34], s: 0.64, pal: [PALETTE.blush, PALETTE.pearl], tilt: [0.08, -0.10, 0.06] },
  { p: [ 0.67, 1.92,  0.18], s: 0.66, pal: [PALETTE.rose, PALETTE.blush], tilt: [-0.10, 0.12, -0.06] },
  { p: [-1.55, 0.72,  0.14], s: 0.64, pal: [PALETTE.pearl, PALETTE.cream], tilt: [0.15, -0.22, -0.10] },
  { p: [ 1.53, 0.70,  0.12], s: 0.67, pal: [PALETTE.pearl, PALETTE.blush], tilt: [-0.08, 0.24, 0.12] },
  { p: [-0.62, 0.72,  0.58], s: 0.68, pal: [PALETTE.coral, PALETTE.pearl], tilt: [-0.02, -0.08, 0.02] },
  { p: [ 0.55, 0.70,  0.62], s: 0.72, pal: [PALETTE.rose, PALETTE.blush], tilt: [0.04, 0.12, -0.02] },
  { p: [-1.55, 1.56,  0.42], s: 0.55, pal: [PALETTE.blush, PALETTE.pearl], tilt: [0.04, -0.28, 0.12] },
  { p: [ 1.46, 1.58,  0.44], s: 0.57, pal: [PALETTE.coral, PALETTE.pearl], tilt: [-0.06, 0.25, -0.08] },
  { p: [ 0.00, 0.94, -0.58], s: 0.62, pal: [PALETTE.pearl, PALETTE.cream], tilt: [0.08, 0.02, 0.06] },
  { p: [-0.18, 2.22,  0.02], s: 0.51, pal: [PALETTE.coral, PALETTE.blush], tilt: [-0.08, 0.00, 0.02] }
];

for (const f of flowers) {
  addRose(new THREE.Vector3(...f.p), f.s, f.pal, f.tilt, f.s > 0.8 ? 7000 : 5300);
}

// airy baby's-breath / bouquet filler clouds
const fillerCenters = [
  [-1.78,1.08,-.28],[-1.28,.46,.26],[-.82,1.34,.78],[-.25,.44,.72],[.35,.42,.74],
  [.92,1.38,.72],[1.66,1.04,-.28],[1.22,.40,.20],[-.98,2.04,.18],[.98,2.05,.05],
  [-1.72,1.72,.10],[1.72,1.70,.12],[-.22,1.60,-.74],[.48,1.48,-.72]
];
for (const fc of fillerCenters) {
  const center = new THREE.Vector3(...fc);
  for (let i = 0; i < 880; i++) {
    const p = center.clone();
    p.x += randn() * 0.32;
    p.y += randn() * 0.27;
    p.z += randn() * 0.27;
    const r = Math.random();
    const base = r < .55 ? PALETTE.pearl : r < .84 ? PALETTE.cream : PALETTE.gold;
    pushPoint(p, colorJitter(base, 0.035), 0.40 + Math.random() * 0.72, 5.4);
  }
}

// stems converge to a narrow handle, matching the reference bouquet silhouette
const handle = new THREE.Vector3(0.03, -2.18, -0.04);
for (const f of flowers) {
  const top = new THREE.Vector3(...f.p);
  top.y -= f.s * 0.30;
  const stemColor = Math.random() < .58 ? PALETTE.cream : PALETTE.deep;
  for (let i = 0; i < 520; i++) {
    const t = Math.random();
    const p = top.clone().lerp(handle, Math.pow(t, 0.83));
    const spread = mix(0.022, 0.06, 1 - t);
    p.x += randn() * spread;
    p.z += randn() * spread;
    p.y += randn() * 0.018;
    pushPoint(p, colorJitter(stemColor, 0.028), 0.45 + Math.random() * 0.7, 4.6);
  }
}

// gauzy wrapping/fibers around the lower bouquet
for (let i = 0; i < 7200; i++) {
  const t = Math.random();
  const y = mix(-0.25, -2.05, t);
  const radius = mix(1.28, 0.25, t) * (0.45 + Math.random() * 0.7);
  const a = Math.random() * Math.PI * 2;
  const p = new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.48);
  p.x += randn() * 0.05;
  p.y += randn() * 0.045;
  p.z += randn() * 0.045;
  const base = Math.random() < .64 ? PALETTE.pearl : PALETTE.deep;
  pushPoint(p, colorJitter(base, 0.04), 0.42 + Math.random() * 0.65, 4.5);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(pointStarts, 3));
geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(pointColors, 3));
geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(pointSizes, 1));
geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(pointPhases, 1));

const particleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.NormalBlending,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uOpacity: { value: 1 }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uMorph;
    uniform float uPixelRatio;
    attribute vec3 aStart;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vTwinkle;

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    void main() {
      float p = uMorph * uMorph * (3.0 - 2.0 * uMorph);
      vec3 delta = aStart - position;
      float spin = (1.0 - p) * (2.2 + 0.9 * sin(aPhase * 1.7));
      delta.xz = rot(spin) * delta.xz;
      vec3 pos = position + delta * (1.0 - p);

      float turbulence = (1.0 - p);
      pos.x += sin(uTime * 1.3 + aPhase * 2.1) * 0.12 * turbulence;
      pos.y += cos(uTime * 1.1 + aPhase * 1.4) * 0.10 * turbulence;
      pos.z += sin(uTime * 0.9 + aPhase) * 0.10 * turbulence;

      float settled = smoothstep(0.80, 1.0, p);
      pos += vec3(
        sin(uTime * 0.72 + aPhase * 2.0),
        cos(uTime * 0.66 + aPhase * 1.3),
        sin(uTime * 0.58 + aPhase * 0.7)
      ) * 0.006 * settled;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      float depthScale = 32.0 / max(2.8, -mvPosition.z);
      gl_PointSize = clamp(aSize * uPixelRatio * depthScale, 1.15, 9.5);
      gl_Position = projectionMatrix * mvPosition;
      vColor = aColor;
      vTwinkle = 0.92 + 0.08 * sin(uTime * 2.0 + aPhase * 3.0);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
      vec2 q = gl_PointCoord - vec2(0.5);
      float r2 = dot(q, q);
      if (r2 > 0.25) discard;
      float gaussian = exp(-r2 * 16.0);
      float core = exp(-r2 * 72.0);
      float alpha = gaussian * 0.88 * uOpacity;
      vec3 color = vColor * (0.80 + core * 0.72) * vTwinkle;
      gl_FragColor = vec4(color, alpha);
    }
  `
});

const bouquet = new THREE.Points(geometry, particleMaterial);
root.add(bouquet);

// white rotating 3D reference box
const boxGeometry = new THREE.BoxGeometry(5.75, 5.65, 4.9);
const edges = new THREE.EdgesGeometry(boxGeometry);
const boxMaterial = new THREE.LineBasicMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0.54 });
const box = new THREE.LineSegments(edges, boxMaterial);
box.position.y = 0.05;
root.add(box);

// faint center axis lines mimic the source render without creating a glowing ring/background
const axisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
const axisGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, -2.85, 0), new THREE.Vector3(0, 2.85, 0),
  new THREE.Vector3(-2.85, 0, 0), new THREE.Vector3(2.85, 0, 0)
]);
const axes = new THREE.LineSegments(axisGeo, axisMat);
root.add(axes);

const CODE = [
  ['comment', '// GPU rose field — fragment/vertex pipeline'],
  ['code', '<span class="kw">import</span> * <span class="kw">as</span> THREE <span class="kw">from</span> <span class="str">\'three\'</span>;'],
  ['code', '<span class="kw">const</span> renderer = <span class="kw">new</span> THREE.<span class="fn">WebGLRenderer</span>({ powerPreference: <span class="str">\'high-performance\'</span> });'],
  ['code', 'renderer.toneMapping = THREE.ACESFilmicToneMapping;'],
  ['code', '<span class="kw">const</span> bloom = <span class="kw">new</span> <span class="fn">UnrealBloomPass</span>(viewport, <span class="num">1.48</span>, <span class="num">0.62</span>, <span class="num">0.12</span>);'],
  ['blank', ''],
  ['code', '<span class="kw">const</span> particles = <span class="num">120000</span>;'],
  ['code', '<span class="kw">const</span> palette = [coral, blush, pearl, cream, gold];'],
  ['code', '<span class="kw">for</span> (<span class="kw">const</span> flower <span class="kw">of</span> bouquet) {'],
  ['code', '  flower.<span class="fn">samplePetalSurface</span>();'],
  ['code', '  flower.<span class="fn">addGaussianMist</span>();'],
  ['code', '}'],
  ['log', '[gpu] petal target texture ........ ready'],
  ['log', '[gpu] gaussian point shader ....... ready'],
  ['log', '[gpu] bloom / tone mapping ........ ready'],
  ['blank', ''],
  ['code', '<span class="kw">function</span> <span class="fn">seekTarget</span>(p, target, t) {'],
  ['code', '  <span class="kw">return</span> <span class="fn">mix</span>(p, target, <span class="fn">smoothstep</span>(<span class="num">0.0</span>, <span class="num">1.0</span>, t));'],
  ['code', '}'],
  ['log', '[compute] particles  16384 / 120000'],
  ['log', '[compute] particles  49152 / 120000'],
  ['log', '[compute] particles  81920 / 120000'],
  ['log', '[compute] particles 120000 / 120000  OK'],
  ['blank', ''],
  ['code', 'box.rotation.y += delta * <span class="num">0.13</span>;'],
  ['code', 'bouquet.rotation.y = box.rotation.y;'],
  ['code', '<span class="kw">const</span> target = <span class="target str">\'故辞安\'</span>;'],
  ['code', '<span class="fn">renderFor</span>(target);'],
  ['log', '[render] target locked ............ 故辞安'],
  ['log', '[render] final frame .............. composing'],
  ['code', '<span class="kw">while</span> (true) { <span class="fn">requestAnimationFrame</span>(render); }'],
  ['comment', '// every particle has arrived exactly where it belongs']
];

let renderedCodeIndex = 0;
let lineNumber = 31;
let lastCycle = 0;
function resetCode() {
  codeWindow.innerHTML = '';
  renderedCodeIndex = 0;
  lineNumber = 31;
  codeStage.classList.remove('fade-out');
  finalMessage.classList.remove('show');
  hint.style.opacity = '1';
}
function addCodeLine(item) {
  const [type, html] = item;
  const line = document.createElement('div');
  line.className = 'code-line';
  if (type === 'blank') {
    line.innerHTML = `<span class="ln">${lineNumber++}</span><span>&nbsp;</span>`;
  } else if (type === 'comment') {
    line.innerHTML = `<span class="ln">${lineNumber++}</span><span class="comment">${html}</span>`;
  } else if (type === 'log') {
    line.innerHTML = `<span class="ln">${lineNumber++}</span><span class="log">${html}</span>`;
  } else {
    line.innerHTML = `<span class="ln">${lineNumber++}</span><span>${html}</span>`;
  }
  codeWindow.appendChild(line);
  if (codeWindow.children.length > 24) codeWindow.removeChild(codeWindow.firstElementChild);
  codeWindow.scrollTop = codeWindow.scrollHeight;
}

const clock = new THREE.Clock();
const cycleLength = 34;
let elapsedTotal = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsedTotal += dt;
  const t = elapsedTotal % cycleLength;

  if (t < lastCycle) resetCode();
  lastCycle = t;

  const revealTarget = Math.min(CODE.length, Math.floor(Math.max(0, t - 0.25) * 2.15));
  while (renderedCodeIndex < revealTarget) addCodeLine(CODE[renderedCodeIndex++]);

  const morph = smoothstep(2.0, 11.7, t);
  particleMaterial.uniforms.uMorph.value = morph;
  particleMaterial.uniforms.uTime.value = elapsedTotal;

  let rootX = 1.55;
  if (t > 22.0) rootX = mix(1.55, 0.0, smoothstep(22.0, 25.0, t));
  root.position.x = rootX;

  const formed = smoothstep(8.5, 12.0, t);
  const orbitSpeed = mix(0.055, 0.105, formed);
  root.rotation.y = -0.22 + elapsedTotal * orbitSpeed;
  root.rotation.x = -0.035 + Math.sin(elapsedTotal * 0.22) * 0.025;

  const finalPhase = smoothstep(23.0, 26.0, t);
  camera.position.z = mix(9.4, 8.7, finalPhase);
  camera.position.y = mix(0.12, 0.20, finalPhase);
  camera.lookAt(0, 0.0, 0);

  boxMaterial.opacity = mix(0.54, 0.24, finalPhase);
  axisMat.opacity = mix(0.15, 0.04, finalPhase);
  particleMaterial.uniforms.uOpacity.value = mix(1.0, 0.62, smoothstep(25.5, 28.0, t));

  if (t >= 22.2) codeStage.classList.add('fade-out');
  if (t >= 24.6) {
    finalMessage.classList.add('show');
    hint.style.opacity = '0';
  }

  const pct = Math.round(morph * 100);
  terminalLine.textContent = morph < 1 ? `GPU particle convergence ${pct.toString().padStart(3, ' ')}%` : 'bouquet field stable · bloom pass active';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});
