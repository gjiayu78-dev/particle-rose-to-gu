import './style-v8b.css';
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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x010105, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x010105, 0.022);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 70);
camera.position.set(0.15, 0.12, 8.7);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.58, 0.38, 0.68);
bloom.threshold = 0.68;
bloom.strength = 0.58;
bloom.radius = 0.38;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const root = new THREE.Group();
root.position.set(1.22, 0.08, 0);
scene.add(root);

const BODY_COUNT = 92000;
const SURFACE_COUNT = 30000;
const HALO_COUNT = 12000;
const SPARK_COUNT = 5200;

function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function easeInOut(t) {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function randn() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function heartF(x, d, y) {
  const a = x * x + 2.25 * d * d + y * y - 1;
  return a * a * a - x * x * y * y * y - 0.1125 * d * d * y * y * y;
}
function randomPink(surface = false, halo = false) {
  const c = new THREE.Color();
  if (halo) {
    const t = Math.random();
    c.setRGB(1.0, 0.32 + t * 0.18, 0.64 + t * 0.18);
    return c;
  }
  if (surface) {
    const r = Math.random();
    if (r < 0.42) c.set('#ff4f9f');
    else if (r < 0.76) c.set('#ff73b8');
    else c.set('#ff9ccd');
  } else {
    const r = Math.random();
    if (r < 0.45) c.set('#f72d89');
    else if (r < 0.78) c.set('#ff4fa0');
    else c.set('#ff79b9');
  }
  const j = (Math.random() - 0.5) * 0.055;
  c.r = clamp(c.r + j);
  c.g = clamp(c.g + j * 0.35);
  c.b = clamp(c.b + j * 0.7);
  return c;
}

function sampleHeartPoint(surfaceOnly = false) {
  for (;;) {
    const x = (Math.random() * 2.44 - 1.22);
    const d = (Math.random() * 1.92 - 0.96);
    const y = (Math.random() * 2.46 - 1.12);
    const f = heartF(x, d, y);
    if (surfaceOnly) {
      if (f <= 0.018 && f >= -0.095) return { x, d, y, f };
    } else if (f <= -0.005) {
      return { x, d, y, f };
    }
  }
}

function transformHeart(p, shell = false) {
  const edgeLift = shell ? 1.035 : 1.0;
  const x = p.x * 2.34 * edgeLift;
  const y = (p.y * 2.36 - 0.04) * edgeLift;
  const z = p.d * 1.78 * edgeLift;
  return new THREE.Vector3(x, y, z);
}

function randomStart(target) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 4.4 + Math.random() * 4.8;
  const s = new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * r,
    Math.cos(phi) * r,
    Math.sin(phi) * Math.sin(theta) * r
  );
  s.x += randn() * 0.75;
  s.y += randn() * 0.55;
  s.z += randn() * 0.75;
  if (Math.random() < 0.12) s.lerp(target, 0.18 + Math.random() * 0.12);
  return s;
}

function buildHeartGeometry() {
  const total = BODY_COUNT + SURFACE_COUNT;
  const pos = new Float32Array(total * 3);
  const start = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const phase = new Float32Array(total);
  const velocity = new Float32Array(total * 3);
  const depthTone = new Float32Array(total);

  const fill = (i, surface) => {
    const raw = sampleHeartPoint(surface);
    const p = transformHeart(raw, surface);
    const s = randomStart(p);
    const c = randomPink(surface, false);
    const k = i * 3;
    pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    start[k] = s.x; start[k + 1] = s.y; start[k + 2] = s.z;
    color[k] = c.r; color[k + 1] = c.g; color[k + 2] = c.b;
    size[i] = surface ? 1.18 + Math.random() * 1.32 : 0.72 + Math.random() * 0.82;
    phase[i] = Math.random() * Math.PI * 2;
    const dir = p.clone().normalize();
    dir.x += randn() * 0.18; dir.y += randn() * 0.12; dir.z += randn() * 0.20;
    dir.normalize().multiplyScalar(1.0 + Math.random() * 2.2);
    velocity[k] = dir.x; velocity[k + 1] = dir.y; velocity[k + 2] = dir.z;
    depthTone[i] = clamp((p.z + 1.85) / 3.7);
  };

  for (let i = 0; i < BODY_COUNT; i++) fill(i, false);
  for (let i = BODY_COUNT; i < total; i++) fill(i, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aVelocity', new THREE.BufferAttribute(velocity, 3));
  g.setAttribute('aDepthTone', new THREE.BufferAttribute(depthTone, 1));
  return g;
}

const heartMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.NormalBlending,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uExplode: { value: 0 },
    uOpacity: { value: 1 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
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
    attribute vec3 aVelocity;
    attribute float aDepthTone;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vTwinkle;
    varying float vDepthTone;

    float ease(float t) {
      t = clamp(t, 0.0, 1.0);
      return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0)/2.0;
    }

    void main() {
      float m = ease(uMorph);
      vec3 p = mix(aStart, position, m);
      float breathe = 1.0 + 0.013 * sin(uTime * 1.05 + aPhase);
      p.xy *= breathe;
      p += aVelocity * (uExplode * (2.8 + 2.4 * uExplode));
      p.y -= 1.85 * uExplode * uExplode;
      p.x += sin(aPhase * 2.0 + uTime * 0.7) * 0.22 * uExplode;
      p.z += cos(aPhase * 1.7 + uTime * 0.5) * 0.18 * uExplode;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float perspective = 10.8 / max(4.0, -mv.z);
      gl_PointSize = max(1.0, aSize * uPixelRatio * perspective);
      gl_Position = projectionMatrix * mv;
      vColor = aColor;
      vTwinkle = 0.5 + 0.5 * sin(uTime * 2.35 + aPhase);
      vAlpha = mix(0.18, 0.98, m) * (1.0 - 0.46 * uExplode);
      vDepthTone = aDepthTone;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vTwinkle;
    varying float vDepthTone;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float r2 = dot(uv, uv);
      if (r2 > 0.25) discard;
      float core = exp(-r2 * 18.0);
      float halo = exp(-r2 * 6.0);
      float alpha = (0.72 * core + 0.28 * halo) * vAlpha * uOpacity;
      float depthGlow = 0.82 + 0.28 * vDepthTone;
      vec3 c = vColor * depthGlow * (0.92 + 0.16 * vTwinkle);
      gl_FragColor = vec4(c, alpha);
    }
  `
});

const heart = new THREE.Points(buildHeartGeometry(), heartMaterial);
heart.frustumCulled = false;
root.add(heart);

function buildHalo() {
  const pos = new Float32Array(HALO_COUNT * 3);
  const color = new Float32Array(HALO_COUNT * 3);
  const size = new Float32Array(HALO_COUNT);
  const phase = new Float32Array(HALO_COUNT);
  for (let i = 0; i < HALO_COUNT; i++) {
    const raw = sampleHeartPoint(true);
    const p = transformHeart(raw, true);
    const dir = p.clone().normalize();
    const offset = 0.04 + Math.pow(Math.random(), 1.8) * 0.34;
    p.addScaledVector(dir, offset);
    p.x += randn() * 0.045; p.y += randn() * 0.045; p.z += randn() * 0.055;
    const c = randomPink(false, true);
    const k = i * 3;
    pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    color[k] = c.r; color[k + 1] = c.g; color[k + 2] = c.b;
    size[i] = 1.8 + Math.random() * 2.8;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  return g;
}

const haloMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uExplode: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uExplode;
    uniform float uPixelRatio;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec3 p = position;
      vec3 n = normalize(p + vec3(0.0001));
      p += n * uExplode * (1.8 + 1.6 * sin(aPhase));
      p.y -= 0.9 * uExplode * uExplode;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = max(1.0, aSize * uPixelRatio * (9.0 / max(4.0, -mv.z)));
      gl_Position = projectionMatrix * mv;
      vColor = aColor;
      vAlpha = uOpacity * (0.22 + 0.34 * (0.5 + 0.5 * sin(uTime * 2.4 + aPhase)));
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float r2 = dot(uv, uv);
      if (r2 > 0.25) discard;
      float a = exp(-r2 * 9.0) * vAlpha;
      gl_FragColor = vec4(vColor * 1.28, a);
    }
  `
});
const halo = new THREE.Points(buildHalo(), haloMaterial);
halo.frustumCulled = false;
root.add(halo);

function buildSparks() {
  const pos = new Float32Array(SPARK_COUNT * 3);
  const phase = new Float32Array(SPARK_COUNT);
  const size = new Float32Array(SPARK_COUNT);
  const color = new Float32Array(SPARK_COUNT * 3);
  for (let i = 0; i < SPARK_COUNT; i++) {
    const raw = sampleHeartPoint(true);
    const p = transformHeart(raw, true);
    const dir = p.clone().normalize();
    p.addScaledVector(dir, 0.05 + Math.random() * 0.22);
    const k = i * 3;
    pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 1.5 + Math.random() * 3.6;
    const c = Math.random() < 0.16 ? new THREE.Color('#ffe5f2') : new THREE.Color('#ff79bd');
    color[k] = c.r; color[k + 1] = c.g; color[k + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  return g;
}

const sparkMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uExplode: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uExplode;
    uniform float uPixelRatio;
    attribute float aPhase;
    attribute float aSize;
    attribute vec3 aColor;
    varying float vA;
    varying vec3 vColor;
    void main() {
      vec3 p = position;
      vec3 n = normalize(p + vec3(0.0001));
      p += n * uExplode * (3.0 + 1.3 * sin(aPhase * 1.7));
      p.y -= 1.3 * uExplode * uExplode;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float pulse = pow(max(0.0, sin(uTime * 3.4 + aPhase)), 8.0);
      gl_PointSize = max(1.0, aSize * uPixelRatio * (10.5 / max(4.0, -mv.z)) * (0.78 + pulse * 1.45));
      gl_Position = projectionMatrix * mv;
      vA = uOpacity * (0.12 + pulse * 0.88) * (1.0 - 0.34 * uExplode);
      vColor = aColor;
    }
  `,
  fragmentShader: `
    varying float vA;
    varying vec3 vColor;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float r2 = dot(uv, uv);
      if (r2 > 0.25) discard;
      float a = exp(-r2 * 13.0) * vA;
      gl_FragColor = vec4(vColor * 1.55, a);
    }
  `
});
const sparks = new THREE.Points(buildSparks(), sparkMaterial);
sparks.frustumCulled = false;
root.add(sparks);

const bgGeometry = new THREE.BufferGeometry();
const bgCount = 1700;
const bgPos = new Float32Array(bgCount * 3);
const bgSize = new Float32Array(bgCount);
for (let i = 0; i < bgCount; i++) {
  bgPos[i*3] = (Math.random() - 0.5) * 17;
  bgPos[i*3+1] = (Math.random() - 0.5) * 10;
  bgPos[i*3+2] = -1.5 - Math.random() * 6.5;
  bgSize[i] = 0.6 + Math.random() * 1.6;
}
bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
bgGeometry.setAttribute('aSize', new THREE.BufferAttribute(bgSize, 1));
const bgMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
  vertexShader: `
    uniform float uTime; uniform float uPixelRatio; attribute float aSize; varying float vA;
    void main(){ vec3 p=position; p.y += sin(uTime*0.18 + position.x*0.7)*0.08; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=aSize*uPixelRatio*(6.5/max(4.0,-mv.z)); gl_Position=projectionMatrix*mv; vA=0.08+0.10*(0.5+0.5*sin(uTime*0.7+position.x*3.0)); }
  `,
  fragmentShader: `
    varying float vA; void main(){ vec2 uv=gl_PointCoord-.5; float r2=dot(uv,uv); if(r2>.25) discard; float a=exp(-r2*10.0)*vA; gl_FragColor=vec4(1.0,0.30,0.63,a); }
  `
});
const bgStars = new THREE.Points(bgGeometry, bgMaterial);
scene.add(bgStars);

const codeLines = [
  `<span class="comment">// V8 · volumetric pink particle heart</span>`,
  `<span class="kw">const</span> BODY = <span class="num">92000</span>;`,
  `<span class="kw">const</span> SURFACE = <span class="num">30000</span>;`,
  `<span class="kw">const</span> HALO = <span class="num">12000</span>;`,
  `<span class="kw">const</span> SPARKS = <span class="num">5200</span>;`,
  ``,
  `<span class="kw">function</span> <span class="fn">heartField</span>(x, depth, y) {`,
  `  <span class="kw">const</span> q = x*x + 2.25*depth*depth + y*y - <span class="num">1.0</span>;`,
  `  <span class="kw">return</span> q*q*q - x*x*y*y*y`,
  `    - <span class="num">0.1125</span>*depth*depth*y*y*y;`,
  `}`,
  ``,
  `<span class="comment">// denser shell + deeper volume</span>`,
  `<span class="fn">sampleVolume</span>(BODY);`,
  `<span class="fn">sampleSurface</span>(SURFACE);`,
  `<span class="fn">addSoftHalo</span>(HALO);`,
  `<span class="fn">addPinkSparkles</span>(SPARKS);`,
  ``,
  `<span class="comment">// no wireframe · restrained bloom</span>`,
  `bloom.threshold = <span class="num">0.68</span>;`,
  `bloom.strength = <span class="num">0.58</span>;`,
  `heart.depthScale = <span class="num">1.78</span>;`,
  `heart.color = <span class="str">"#ff4fa0"</span>;`,
  ``,
  `<span class="kw">const</span> target = <span class="target">"故辞安"</span>;`,
  `<span class="fn">morphFromCloud</span>(target);`,
  `<span class="fn">rotateSlowly</span>(heart);`,
  `<span class="fn">explodeToPinkRain</span>(heart);`,
  `<span class="log">// rendering…</span>`
];

let codeIndex = 0;
function appendCode() {
  if (!codeWindow || codeIndex >= codeLines.length) return;
  const row = document.createElement('div');
  row.className = 'code-line';
  row.innerHTML = `<span class="ln">${88 + codeIndex}</span><span>${codeLines[codeIndex] || '&nbsp;'}</span>`;
  codeWindow.appendChild(row);
  codeWindow.scrollTop = codeWindow.scrollHeight;
  codeIndex++;
}
const codeTimer = setInterval(() => {
  appendCode();
  if (codeIndex >= codeLines.length) clearInterval(codeTimer);
}, 380);

const clock = new THREE.Clock();
const CYCLE = 34.0;
let previewHold = new URLSearchParams(location.search).has('preview') || navigator.userAgent.includes('Electron');

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const t = elapsed % CYCLE;

  const morph = easeInOut(smoothstep(2.0, 9.5, t));
  const explode = t < 23.5 ? 0 : easeInOut(smoothstep(23.5, 29.3, t));
  heartMaterial.uniforms.uTime.value = elapsed;
  heartMaterial.uniforms.uMorph.value = morph;
  heartMaterial.uniforms.uExplode.value = explode;
  heartMaterial.uniforms.uOpacity.value = t > 29.5 ? 1 - smoothstep(29.5, 31.2, t) : 1;
  haloMaterial.uniforms.uTime.value = elapsed;
  haloMaterial.uniforms.uOpacity.value = morph * (1 - smoothstep(28.2, 31.0, t));
  haloMaterial.uniforms.uExplode.value = explode;
  sparkMaterial.uniforms.uTime.value = elapsed;
  sparkMaterial.uniforms.uOpacity.value = morph * (1 - smoothstep(29.0, 31.0, t));
  sparkMaterial.uniforms.uExplode.value = explode;
  bgMaterial.uniforms.uTime.value = elapsed;

  const hold = smoothstep(8.5, 10.5, t) * (1 - smoothstep(23.0, 25.0, t));
  root.rotation.y = -0.18 + elapsed * 0.085 * hold + explode * 0.52;
  root.rotation.x = -0.035 + Math.sin(elapsed * 0.31) * 0.045 * hold;
  root.rotation.z = Math.sin(elapsed * 0.22) * 0.025 * hold;
  const pulse = 1 + Math.sin(elapsed * 1.12) * 0.012 * hold;
  root.scale.setScalar(pulse);

  if (terminalLine) {
    if (t < 3) terminalLine.textContent = 'initializing volumetric heart field…';
    else if (t < 10) terminalLine.textContent = 'assembling 134k pink particles…';
    else if (t < 23.5) terminalLine.textContent = 'heart locked · depth + sparkle pass active';
    else terminalLine.textContent = 'release → pink particle rain';
  }

  if (codeStage) {
    const fade = smoothstep(21.5, 25.5, t);
    codeStage.style.opacity = String(0.46 * (1 - fade));
  }
  if (hint) hint.style.opacity = t > 21 ? '0' : '0.16';
  if (finalMessage) {
    const show = smoothstep(29.6, 31.7, t);
    finalMessage.style.opacity = String(show);
    finalMessage.style.transform = `translate(-50%, -50%) scale(${0.94 + show * 0.06})`;
  }

  composer.render();
}

appendCode();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  const pr = Math.min(window.devicePixelRatio, 2);
  heartMaterial.uniforms.uPixelRatio.value = pr;
  haloMaterial.uniforms.uPixelRatio.value = pr;
  sparkMaterial.uniforms.uPixelRatio.value = pr;
  bgMaterial.uniforms.uPixelRatio.value = pr;
});
