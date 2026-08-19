import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const canvas = document.querySelector('#scene');
const codeStage = document.querySelector('#code-stage');
const codeWindow = document.querySelector('#code-window');
const terminalLine = document.querySelector('#terminal-line');
const finalMessage = document.querySelector('#final-message');
const hint = document.querySelector('#hint');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', precision: 'highp' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x010106, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.022);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.12, 10.6);
camera.lookAt(0.45, 0.25, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.34, 0.9);
bloom.threshold = 0.90;
bloom.strength = 0.34;
bloom.radius = 0.34;
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xffe9f2, 0x10131b, 1.55));
const key = new THREE.DirectionalLight(0xffd7e5, 3.15); key.position.set(3.8, 5.4, 7.8); scene.add(key);
const fill = new THREE.DirectionalLight(0xd8c8ff, 1.28); fill.position.set(-5.5, 1.5, 4.0); scene.add(fill);
const rim = new THREE.PointLight(0xff9fc0, 14, 18, 2); rim.position.set(2.3, 2.7, 3.4); scene.add(rim);
const warm = new THREE.PointLight(0xffd8a6, 6, 14, 2); warm.position.set(-0.8, -0.6, 3.2); scene.add(warm);

const root = new THREE.Group();
root.position.x = 1.62;
root.position.y = -0.06;
scene.add(root);
const roseLayer = new THREE.Group();
const stemLayer = new THREE.Group();
const fillerLayer = new THREE.Group();
const fxLayer = new THREE.Group();
root.add(stemLayer, roseLayer, fillerLayer, fxLayer);

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function mod(a, b) { return ((a % b) + b) % b; }

const ROSE_A = 1.995653;
const ROSE_B = 1.27689;
const PETAL_NUM = 3.6;

function createRoseGeometry(rows = 132, cols = 184, openness = 1.045) {
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const indices = [];
  const deep = new THREE.Color('#d96d91');
  const mid = new THREE.Color('#f4a8bd');
  const edge = new THREE.Color('#ffe2e9');
  const tmp = new THREE.Color();
  const centerOpen = openness * 0.19;

  for (let i = 0; i < rows; i++) {
    const r = i / (rows - 1);
    const r2 = r * r;
    const yCoeff = ROSE_A * r2 * Math.pow(ROSE_B * r - 1, 2);
    for (let j = 0; j < cols; j++) {
      const q = j / (cols - 1);
      const theta = -2 + q * (20 * Math.PI + 2);
      const folded = 1 - mod(PETAL_NUM * theta, 2 * Math.PI) / Math.PI;
      const inner = 1.25 * folded * folded - 0.25;
      const xPetal = 1 - 0.5 * inner * inner;
      const phiLinear = centerOpen + (openness - centerOpen) * q;
      const phi = (Math.PI / 2) * phiLinear * phiLinear;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const yK = yCoeff * sinPhi;
      const R2 = xPetal * (r * sinPhi + yK * cosPhi);
      const x = R2 * Math.sin(theta);
      const y = R2 * Math.cos(theta);
      const z = xPetal * (r * cosPhi - yK * sinPhi);
      const k = (i * cols + j) * 3;
      positions[k] = x; positions[k + 1] = y; positions[k + 2] = z;
      const depth = clamp((z + 0.25) / 1.1);
      const outer = Math.pow(r, 1.35);
      tmp.copy(deep).lerp(mid, clamp(depth * 0.72 + outer * 0.25));
      tmp.lerp(edge, Math.pow(outer, 2.2) * 0.58);
      colors[k] = tmp.r; colors[k + 1] = tmp.g; colors[k + 2] = tmp.b;
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = (i + 1) * cols + j, c = (i + 1) * cols + j + 1, d = i * cols + j + 1;
      indices.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const roseGeometries = [
  createRoseGeometry(132, 184, 1.02),
  createRoseGeometry(132, 184, 1.055),
  createRoseGeometry(132, 184, 1.085)
];

function makeRoseMaterial(tint) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint), vertexColors: true, roughness: 0.46, metalness: 0.0,
    clearcoat: 0.26, clearcoatRoughness: 0.34, sheen: 0.75, sheenColor: new THREE.Color('#ffd4e1'),
    sheenRoughness: 0.52, emissive: new THREE.Color('#3a0e1c'), emissiveIntensity: 0.10,
    side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: true
  });
}

const roseSpecs = [
  { p: [ 0.00, 1.46,  0.34], s: 1.16, r: [-0.02, 0.03, 0.03], c: '#ffd1dd', g: 2 },
  { p: [-1.05, 1.21, 0.08], s: 1.02, r: [ 0.10,-0.17,-0.10], c: '#f8b3c7', g: 1 },
  { p: [ 1.05, 1.19, 0.06], s: 1.04, r: [-0.07, 0.17, 0.12], c: '#ffc2d2', g: 1 },
  { p: [-0.57, 2.08,-0.10], s: 0.87, r: [ 0.08,-0.09, 0.09], c: '#fbd0db', g: 0 },
  { p: [ 0.58, 2.06, 0.00], s: 0.89, r: [-0.08, 0.10,-0.08], c: '#f4a7bf', g: 2 },
  { p: [-1.62, 0.58,-0.08], s: 0.82, r: [ 0.14,-0.26,-0.08], c: '#ffd7e1', g: 0 },
  { p: [ 1.59, 0.60,-0.08], s: 0.84, r: [-0.11, 0.25, 0.10], c: '#f9b8ca', g: 1 },
  { p: [-0.56, 0.53, 0.62], s: 0.87, r: [-0.03,-0.08, 0.03], c: '#f9c3d2', g: 2 },
  { p: [ 0.55, 0.50, 0.65], s: 0.90, r: [ 0.05, 0.11,-0.02], c: '#ffcbd8', g: 1 },
  { p: [-1.46, 1.62, 0.22], s: 0.74, r: [ 0.04,-0.28, 0.13], c: '#f5b0c6', g: 0 },
  { p: [ 1.43, 1.63, 0.22], s: 0.76, r: [-0.06, 0.27,-0.10], c: '#ffd2dc', g: 2 },
  { p: [ 0.02, 0.92,-0.58], s: 0.78, r: [ 0.08, 0.02, 0.04], c: '#ffe0e7', g: 0 },
  { p: [-0.06, 2.46,-0.18], s: 0.68, r: [-0.09, 0.02, 0.03], c: '#f5a7be', g: 1 }
];

const roses = [];
for (let i = 0; i < roseSpecs.length; i++) {
  const spec = roseSpecs[i];
  const material = makeRoseMaterial(spec.c);
  const mesh = new THREE.Mesh(roseGeometries[spec.g], material);
  mesh.position.set(...spec.p); mesh.rotation.set(...spec.r); mesh.scale.setScalar(spec.s * 0.01); mesh.renderOrder = 1;
  mesh.userData = {
    index: i, basePos: new THREE.Vector3(...spec.p), baseRot: new THREE.Euler(...spec.r), baseScale: spec.s,
    velocity: new THREE.Vector3(spec.p[0] * 0.72 + randn() * 0.45, 0.55 + Math.abs(spec.p[1]) * 0.15 + Math.random() * 0.5, randn() * 0.65).normalize().multiplyScalar(rand(1.6, 2.9)),
    spin: new THREE.Vector3(rand(-1.7, 1.7), rand(-1.7, 1.7), rand(-1.7, 1.7))
  };
  roseLayer.add(mesh); roses.push(mesh);
}

const handle = new THREE.Vector3(0.02, -2.27, -0.06);
const stemMaterial = new THREE.MeshPhysicalMaterial({ color: '#c6919d', roughness: 0.48, metalness: 0.0, clearcoat: 0.15, transparent: true, opacity: 0.78 });
const ribbonMaterial = new THREE.MeshPhysicalMaterial({ color: '#f7d8df', roughness: 0.58, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false });

for (const spec of roseSpecs) {
  const start = new THREE.Vector3(spec.p[0] * 0.86, spec.p[1] - spec.s * 0.46, spec.p[2] - 0.18);
  const mid1 = start.clone().lerp(handle, 0.38).add(new THREE.Vector3(randn() * 0.12, 0.06, randn() * 0.09));
  const mid2 = start.clone().lerp(handle, 0.73).add(new THREE.Vector3(randn() * 0.08, -0.03, randn() * 0.06));
  const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, handle]);
  stemLayer.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 54, 0.019, 8, false), stemMaterial));
}

for (let i = 0; i < 8; i++) {
  const g = new THREE.PlaneGeometry(1.65 + i * 0.035, 2.55, 9, 14);
  const p = g.attributes.position;
  for (let v = 0; v < p.count; v++) {
    const x = p.getX(v), y = p.getY(v), yn = (y + 1.275) / 2.55, taper = 0.24 + 0.76 * yn;
    p.setX(v, x * taper + Math.sin(y * 3.5 + i) * 0.035); p.setZ(v, Math.sin(x * 2.8 + y * 1.7 + i) * 0.045);
  }
  p.needsUpdate = true; g.computeVertexNormals();
  const rm = ribbonMaterial.clone(); rm.opacity = 0.10 + i * 0.022;
  const sheet = new THREE.Mesh(g, rm);
  sheet.position.set((i - 3.5) * 0.07, -1.08, -0.30 + i * 0.035); sheet.rotation.z = (i - 3.5) * 0.045; sheet.rotation.y = (i - 3.5) * 0.055;
  stemLayer.add(sheet);
}

const fillerGeo = new THREE.IcosahedronGeometry(0.032, 1);
const fillerMat = new THREE.MeshPhysicalMaterial({ color: '#fff0e9', emissive: '#4b3028', emissiveIntensity: 0.12, roughness: 0.38, clearcoat: 0.18, transparent: true });
const fillerCount = 520;
const filler = new THREE.InstancedMesh(fillerGeo, fillerMat, fillerCount);
const fillerMatrix = new THREE.Matrix4(); const fillerColor = new THREE.Color();
for (let i = 0; i < fillerCount; i++) {
  const a = rand(0, Math.PI * 2), rad = Math.pow(Math.random(), 0.58) * rand(0.9, 2.25), y = rand(0.2, 2.38) + randn() * 0.10;
  const x = Math.cos(a) * rad * (0.82 + 0.18 * (2.4 - y) / 2.4), z = Math.sin(a) * rad * 0.48 + rand(-0.35, 0.42), s = rand(0.50, 1.25);
  fillerMatrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), rand(0, 3))), new THREE.Vector3(s, s, s));
  filler.setMatrixAt(i, fillerMatrix);
  const roll = Math.random(); fillerColor.set(roll < 0.62 ? '#fff3ee' : roll < 0.86 ? '#f8cfdb' : '#e8cba6'); filler.setColorAt(i, fillerColor);
}
filler.instanceColor.needsUpdate = true; fillerLayer.add(filler);

const targetPos = [], startPos = [], pColors = [], pSizes = [], pPhase = [];
const tempP = new THREE.Vector3(), tempN = new THREE.Vector3();
for (const rose of roses) {
  rose.scale.setScalar(rose.userData.baseScale); rose.updateMatrix();
  const sampler = new MeshSurfaceSampler(rose).build();
  const samples = rose.userData.index < 3 ? 2450 : 1750;
  for (let i = 0; i < samples; i++) {
    sampler.sample(tempP, tempN); tempP.applyMatrix4(rose.matrix); const target = tempP.clone();
    targetPos.push(target.x, target.y, target.z);
    const dir = new THREE.Vector3(randn(), randn(), randn()).normalize(); const start = target.clone().addScaledVector(dir, rand(3.3, 6.8)); startPos.push(start.x, start.y, start.z);
    const c = new THREE.Color(Math.random() < 0.72 ? '#ffd0dc' : Math.random() < 0.76 ? '#fff1ed' : '#e7c8a8'); c.offsetHSL(rand(-0.012, 0.012), rand(-0.04, 0.04), rand(-0.05, 0.05));
    pColors.push(c.r, c.g, c.b); pSizes.push(rand(0.72, 1.75)); pPhase.push(rand(0, Math.PI * 2));
  }
  rose.scale.setScalar(rose.userData.baseScale * 0.01);
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(targetPos, 3));
particleGeometry.setAttribute('aStart', new THREE.Float32BufferAttribute(startPos, 3));
particleGeometry.setAttribute('aColor', new THREE.Float32BufferAttribute(pColors, 3));
particleGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(pSizes, 1));
particleGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(pPhase, 1));
const particleMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, toneMapped: false,
  uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uExplode: { value: 0 }, uOpacity: { value: 1 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2.5) } },
  vertexShader: `uniform float uTime; uniform float uMorph; uniform float uExplode; uniform float uPixelRatio; attribute vec3 aStart; attribute vec3 aColor; attribute float aSize; attribute float aPhase; varying vec3 vColor; varying float vAlpha; float ease(float x){x=clamp(x,0.0,1.0);return x*x*(3.0-2.0*x);} void main(){float mm=ease(uMorph);vec3 p=mix(aStart,position,mm);p+=vec3(sin(uTime*.72+aPhase)*.014,cos(uTime*.59+aPhase*1.17)*.012,sin(uTime*.47+aPhase*.71)*.012)*mm;if(uExplode>0.0){vec3 d=normalize(position+vec3(.0001));float e=uExplode*uExplode;p+=d*(2.2+fract(aPhase*.159)*3.2)*e;p.y-=e*e*2.6;}vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;float perspective=11.0/max(2.0,-mv.z);gl_PointSize=clamp(aSize*uPixelRatio*perspective,1.0,3.4);vColor=aColor;vAlpha=(.28+.62*mm)*(1.0-smoothstep(.62,1.0,uExplode));}`,
  fragmentShader: `uniform float uOpacity; varying vec3 vColor; varying float vAlpha; void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;float soft=exp(-r2*16.0);gl_FragColor=vec4(vColor,soft*vAlpha*uOpacity);}`
});
const surfaceParticles = new THREE.Points(particleGeometry, particleMaterial); fxLayer.add(surfaceParticles);

const sparkCount = 1250;
const sparkPositions = new Float32Array(sparkCount * 3), sparkSizes = new Float32Array(sparkCount), sparkPhase = new Float32Array(sparkCount), sparkColors = new Float32Array(sparkCount * 3);
for (let i = 0; i < sparkCount; i++) {
  const a = rand(0, Math.PI * 2), rad = Math.pow(Math.random(), 0.55) * 3.2;
  sparkPositions[i*3] = Math.cos(a) * rad + randn() * 0.18; sparkPositions[i*3+1] = rand(-1.95, 2.75) + randn() * 0.12; sparkPositions[i*3+2] = Math.sin(a) * rad * 0.62 + rand(-0.8, 0.9);
  sparkSizes[i] = rand(0.65, 1.8); sparkPhase[i] = rand(0, Math.PI * 2);
  const c = new THREE.Color(Math.random() < 0.70 ? '#ffb7cc' : Math.random() < 0.72 ? '#fff2e7' : '#e4c39a'); sparkColors[i*3] = c.r; sparkColors[i*3+1] = c.g; sparkColors[i*3+2] = c.b;
}
const sparkGeometry = new THREE.BufferGeometry();
sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3)); sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1)); sparkGeometry.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhase, 1)); sparkGeometry.setAttribute('aColor', new THREE.BufferAttribute(sparkColors, 3));
const sparkMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uTime: { value: 0 }, uVisibility: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2.5) } },
  vertexShader: `uniform float uTime;uniform float uVisibility;uniform float uPixelRatio;attribute float aSize;attribute float aPhase;attribute vec3 aColor;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.42+aPhase)*.055;p.y+=cos(uTime*.35+aPhase*1.2)*.045;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(12.0/max(2.0,-mv.z)),1.0,4.2);vColor=aColor*1.9;vAlpha=uVisibility*(.25+.75*pow(.5+.5*sin(uTime*2.2+aPhase),5.0));}`,
  fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;float a=exp(-d*d*24.0)*vAlpha;gl_FragColor=vec4(vColor,a);}`
});
fxLayer.add(new THREE.Points(sparkGeometry, sparkMaterial));

const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(5.9, 5.85, 4.7));
const boxMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.66, toneMapped: false });
const wireBox = new THREE.LineSegments(boxGeo, boxMat); wireBox.position.set(0, 0.25, -0.32); root.add(wireBox);

function createPetalGeometry(rows = 10, cols = 8) {
  const pos = [], idx = [];
  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1), width = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.82)), 0.62) * (0.58 + 0.42 * u);
    for (let j = 0; j < cols; j++) {
      const v = j / (cols - 1) * 2 - 1, x = v * width * 0.48, y = (u - 0.42) * 0.92, z = (1 - v*v) * 0.13 + Math.sin(u*Math.PI) * 0.055 - Math.pow(u, 3) * 0.08;
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) { const a=i*cols+j,b=(i+1)*cols+j,c=(i+1)*cols+j+1,d=i*cols+j+1; idx.push(a,b,c,a,c,d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const petalGeo = createPetalGeometry();
const petalMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.42, clearcoat: 0.20, side: THREE.DoubleSide, transparent: true, opacity: 0.98 });
const PETAL_COUNT = 1450;
const petalRain = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_COUNT); petalRain.instanceMatrix.setUsage(THREE.DynamicDrawUsage); petalRain.frustumCulled = false; petalRain.visible = false;
const petalState = [], q = new THREE.Quaternion(), matrix = new THREE.Matrix4(), sVec = new THREE.Vector3(), petalC = new THREE.Color();
for (let i = 0; i < PETAL_COUNT; i++) {
  const source = roseSpecs[Math.floor(Math.random()*roseSpecs.length)].p;
  const start = new THREE.Vector3(source[0]+randn()*0.28, source[1]+randn()*0.25, source[2]+randn()*0.24);
  const radial = new THREE.Vector3(start.x*0.55+randn()*0.70, rand(0.25,1.25), start.z*0.35+randn()*0.85).normalize();
  const scale = rand(0.075,0.18);
  petalState.push({ start, vel: radial.multiplyScalar(rand(1.6,4.4)), rot: new THREE.Euler(rand(0,6),rand(0,6),rand(0,6)), spin: new THREE.Vector3(rand(-4.2,4.2),rand(-4.0,4.0),rand(-5.0,5.0)), scale, sway: rand(0.35,1.15), phase: rand(0,Math.PI*2) });
  petalC.set(Math.random()<0.70 ? '#f8b1c6' : Math.random()<0.74 ? '#ffe1e8' : '#fff0e7'); petalC.offsetHSL(rand(-0.012,0.012),rand(-0.05,0.04),rand(-0.05,0.04)); petalRain.setColorAt(i, petalC);
  sVec.setScalar(0.0001); matrix.compose(start,q,sVec); petalRain.setMatrixAt(i,matrix);
}
petalRain.instanceColor.needsUpdate = true; fxLayer.add(petalRain);

const codeLines = [
  `<span class="comment">// high-resolution rose mesh / V7</span>`,
  `<span class="kw">const</span> ROSE_RESOLUTION = <span class="num">132 * 184</span>;`,
  `<span class="kw">const</span> petals = <span class="fn">buildParametricRose</span>(ROSE_RESOLUTION);`,
  `<span class="comment">// real triangles first; particles are only atmosphere</span>`,
  `<span class="kw">const</span> bouquet = <span class="kw">new</span> THREE.Group();`,
  `<span class="kw">for</span> (<span class="kw">const</span> flower <span class="kw">of</span> roses) {`,
  `  bouquet.add(<span class="fn">createRoseMesh</span>(flower));`,
  `  <span class="fn">sampleSurfaceDust</span>(flower.mesh, <span class="num">1800</span>);`,
  `}`,
  `<span class="kw">const</span> bloom = <span class="kw">new</span> UnrealBloomPass();`,
  `bloom.threshold = <span class="num">0.90</span>;`,
  `bloom.strength = <span class="num">0.34</span>;`,
  `<span class="comment">// only sparse HDR sparkles bloom</span>`,
  `<span class="kw">const</span> target = <span class="str target">'故辞安'</span>;`,
  `<span class="fn">morphIntoBouquet</span>(surfaceParticles);`,
  `<span class="fn">rotateTogether</span>(bouquet, wireframe);`,
  `<span class="comment">// final transition</span>`,
  `<span class="fn">explodeRoseMeshes</span>();`,
  `<span class="fn">releasePetalRain</span>(<span class="num">1450</span>);`,
  `<span class="fn">renderFor</span>(target);`,
  `<span class="log">✓ mesh detail preserved at native display resolution</span>`
];
let codeCursor = 0, nextCodeAt = 0, codeCycle = -1;
function resetCode() { codeWindow.innerHTML = ''; codeCursor = 0; nextCodeAt = 0.5; terminalLine.textContent = 'initializing high-resolution mesh pipeline...'; }
function updateCode(t, cycle) {
  if (cycle !== codeCycle) { codeCycle = cycle; resetCode(); }
  if (t > nextCodeAt && codeCursor < codeLines.length) {
    const row = document.createElement('div'); row.className = 'code-line'; row.innerHTML = `<span class="ln">${132 + codeCursor}</span><span>${codeLines[codeCursor]}</span>`; codeWindow.appendChild(row);
    while (codeWindow.children.length > 22) codeWindow.removeChild(codeWindow.firstChild);
    codeCursor++; nextCodeAt += rand(0.33, 0.62);
    if (codeCursor === codeLines.length) terminalLine.textContent = 'render loop active · waiting for final transition';
  }
}

const clock = new THREE.Clock(), CYCLE = 42.0; let lastCycle = -1;
function updatePetalRain(explodeT) {
  if (explodeT <= 0) { petalRain.visible = false; return; }
  petalRain.visible = true; const t = explodeT * 8.8;
  for (let i = 0; i < PETAL_COUNT; i++) {
    const st = petalState[i], p = st.start.clone().addScaledVector(st.vel, t * 0.56);
    p.y -= 0.5 * 0.72 * t * t; p.x += Math.sin(t*1.05 + st.phase) * st.sway * 0.23; p.z += Math.cos(t*0.83 + st.phase) * st.sway * 0.17;
    q.setFromEuler(new THREE.Euler(st.rot.x + st.spin.x*t, st.rot.y + st.spin.y*t, st.rot.z + st.spin.z*t));
    const growth = smoothstep(0,0.10,explodeT), fade = 1 - smoothstep(0.82,1.0,explodeT), sc = st.scale * growth * (0.72 + fade*0.28);
    sVec.set(sc, sc*(0.90+Math.sin(st.phase)*0.08), sc); matrix.compose(p,q,sVec); petalRain.setMatrixAt(i,matrix);
  }
  petalRain.instanceMatrix.needsUpdate = true; petalMat.opacity = 0.98 * (1 - smoothstep(0.82, 1.0, explodeT));
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime(), cycleIndex = Math.floor(elapsed / CYCLE), t = elapsed % CYCLE;
  if (cycleIndex !== lastCycle) { lastCycle = cycleIndex; codeStage.classList.remove('fade-out'); finalMessage.classList.remove('show'); hint.style.opacity = '1'; }
  updateCode(t, cycleIndex);
  const morph = smoothstep(1.6, 11.8, t), meshReveal = smoothstep(3.6, 12.8, t), sparkleVis = smoothstep(6.2, 14.0, t) * (1 - smoothstep(29.0, 34.0, t)), explode = smoothstep(26.2, 33.8, t);
  particleMaterial.uniforms.uTime.value = elapsed; particleMaterial.uniforms.uMorph.value = morph; particleMaterial.uniforms.uExplode.value = explode;
  sparkMaterial.uniforms.uTime.value = elapsed; sparkMaterial.uniforms.uVisibility.value = sparkleVis;
  for (const rose of roses) {
    const i = rose.userData.index, stagger = i * 0.045, appear = smoothstep(0.0 + stagger, 0.52 + stagger, meshReveal), e = smoothstep(0.02 + i*0.004, 0.64 + i*0.002, explode), base = rose.userData.basePos;
    rose.position.copy(base).addScaledVector(rose.userData.velocity, e*e*2.15); rose.position.y -= e*e*e*0.78;
    rose.rotation.set(rose.userData.baseRot.x + rose.userData.spin.x*e*1.15, rose.userData.baseRot.y + rose.userData.spin.y*e*1.15, rose.userData.baseRot.z + rose.userData.spin.z*e*1.15);
    const sc = rose.userData.baseScale * Math.max(0.001, appear) * (1 - smoothstep(0.50,0.94,e)); rose.scale.setScalar(sc); rose.material.opacity = appear * (1 - smoothstep(0.44,0.91,e));
  }
  const stemFade = 1 - smoothstep(0.15,0.72,explode);
  stemLayer.visible = stemFade > 0.01;
  filler.material.opacity = 1 - smoothstep(0.35,0.90,explode); filler.visible = filler.material.opacity > 0.02;
  updatePetalRain(explode);
  root.rotation.y = Math.sin(elapsed * 0.22) * 0.15 + elapsed * 0.025; root.rotation.x = Math.sin(elapsed * 0.17) * 0.025;
  wireBox.material.opacity = 0.66 * (1 - smoothstep(0.72,1.0,explode));
  if (t > 31.0) codeStage.classList.add('fade-out');
  if (t > 35.8) { finalMessage.classList.add('show'); hint.style.opacity = '0'; }
  composer.render();
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5)); renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5)); composer.setSize(window.innerWidth, window.innerHeight);
  particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2.5); sparkMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2.5);
});
