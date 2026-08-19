import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.querySelector('#scene');
const codeStage = document.querySelector('#code-stage');
const codeWindow = document.querySelector('#code-window');
const terminalLine = document.querySelector('#terminal-line');
const finalMessage = document.querySelector('#final-message');
const hint = document.querySelector('#hint');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
function randn() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// Renderer: actual native-resolution geometry. No bouquet photo / raster layer.
// -----------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  precision: 'highp'
});
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2.5);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x010106, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.017);

// PBR environment gives petals soft studio reflections without an external HDR.
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
scene.environment = pmrem.fromScene(roomEnvironment, 0.04).texture;
roomEnvironment.dispose();
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.18, 10.7);
camera.lookAt(0.65, 0.26, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.30, 0.30, 0.92);
bloom.threshold = 0.92;
bloom.strength = 0.30;
bloom.radius = 0.30;
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xffedf4, 0x0d1020, 1.75));
const key = new THREE.DirectionalLight(0xffd9e7, 3.8);
key.position.set(4.2, 5.8, 8.2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xd9d3ff, 1.35);
fill.position.set(-5.4, 1.4, 4.4);
scene.add(fill);
const rim = new THREE.PointLight(0xff9fc7, 12, 18, 2);
rim.position.set(2.1, 2.9, 3.9);
scene.add(rim);
const warm = new THREE.PointLight(0xffd5aa, 5.5, 15, 2);
warm.position.set(-0.8, -0.6, 3.0);
scene.add(warm);

const root = new THREE.Group();
root.position.set(1.62, -0.05, 0);
scene.add(root);
const roseLayer = new THREE.Group();
const stemLayer = new THREE.Group();
const fillerLayer = new THREE.Group();
const fxLayer = new THREE.Group();
root.add(stemLayer, roseLayer, fillerLayer, fxLayer);

// -----------------------------------------------------------------------------
// High-resolution rose made from 56 independent curved petal surfaces.
// Every petal is a smooth 18x14 grid with cup, roll, edge curl and rounded tip.
// The petals are merged into one real triangle mesh per rose variation.
// -----------------------------------------------------------------------------
function createPetalGeometry(params, random) {
  const rows = 18;
  const cols = 14;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const indices = [];

  const deep = new THREE.Color(params.deep || '#d57498');
  const body = new THREE.Color(params.body || '#f2aec2');
  const edge = new THREE.Color(params.edge || '#ffe3ea');
  const c = new THREE.Color();

  const asym = (random() - 0.5) * 0.08;
  const wavePhase = random() * Math.PI * 2;
  const waveAmp = 0.010 + random() * 0.018;

  for (let iy = 0; iy < rows; iy++) {
    const u = iy / (rows - 1); // petal base -> tip
    // Broad rounded upper petal instead of a pointed or oval card.
    const bulb = Math.pow(Math.sin(Math.PI * (0.055 + u * 0.79)), 0.58);
    const baseOpen = 0.13 + 0.87 * Math.pow(u, 0.56);
    const halfWidth = params.width * bulb * baseOpen;

    for (let ix = 0; ix < cols; ix++) {
      const v = ix / (cols - 1) * 2 - 1;
      const av = Math.abs(v);
      const side = v + asym * Math.sin(Math.PI * u);

      let x = side * halfWidth;
      // Round the two upper corners so the silhouette resembles a real rose petal.
      let y = params.length * (u - params.rounding * av * av * Math.pow(u, 3.7));

      // Cup in the middle, edge roll, and a slight outward-backward curl at the tip.
      const cup = params.cup * (1 - v * v) * Math.sin(Math.PI * Math.pow(u, 0.92));
      const edgeCurl = params.edgeCurl * Math.pow(av, 1.75) * Math.pow(u, 1.7);
      const tipCurl = params.tipCurl * Math.pow(u, 3.25) * (0.52 + 0.48 * (1 - v * v));
      const ripple = waveAmp * Math.sin(v * Math.PI * 2.4 + wavePhase) * Math.pow(u, 2.0);
      let z = cup + edgeCurl - tipCurl + ripple;

      // Tiny longitudinal fold keeps highlights from looking perfectly synthetic.
      z += params.fold * Math.exp(-v * v * 12) * Math.sin(Math.PI * u);
      x += Math.sin(u * Math.PI) * (random() - 0.5) * 0.002;

      const k = (iy * cols + ix) * 3;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;

      const tipLight = Math.pow(u, 1.75) * 0.33;
      const rimLight = Math.pow(av, 2.4) * Math.pow(u, 1.2) * 0.34;
      c.copy(deep).lerp(body, 0.28 + u * 0.58);
      c.lerp(edge, clamp(tipLight + rimLight));
      c.offsetHSL((random() - 0.5) * 0.002, 0, (random() - 0.5) * 0.006);
      colors[k] = c.r;
      colors[k + 1] = c.g;
      colors[k + 2] = c.b;
    }
  }

  for (let iy = 0; iy < rows - 1; iy++) {
    for (let ix = 0; ix < cols - 1; ix++) {
      const a = iy * cols + ix;
      const b = (iy + 1) * cols + ix;
      const cc = (iy + 1) * cols + ix + 1;
      const d = iy * cols + ix + 1;
      indices.push(a, b, cc, a, cc, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function createLayeredRose(seed = 1) {
  const random = rng(seed);
  const parts = [];
  const rings = [
    { count: 8,  radius: 0.045, length: 0.48, width: 0.24, tilt: 1.12, cup: 0.125, edgeCurl: 0.015, tipCurl: 0.020, fold: 0.035, rounding: 0.050, z: 0.120 },
    { count: 10, radius: 0.120, length: 0.60, width: 0.34, tilt: 0.91, cup: 0.150, edgeCurl: 0.025, tipCurl: 0.035, fold: 0.030, rounding: 0.055, z: 0.090 },
    { count: 12, radius: 0.225, length: 0.73, width: 0.46, tilt: 0.69, cup: 0.160, edgeCurl: 0.040, tipCurl: 0.060, fold: 0.025, rounding: 0.063, z: 0.050 },
    { count: 14, radius: 0.355, length: 0.84, width: 0.59, tilt: 0.46, cup: 0.145, edgeCurl: 0.065, tipCurl: 0.095, fold: 0.018, rounding: 0.072, z: 0.005 },
    { count: 12, radius: 0.500, length: 0.91, width: 0.70, tilt: 0.27, cup: 0.110, edgeCurl: 0.095, tipCurl: 0.140, fold: 0.012, rounding: 0.082, z: -0.055 }
  ];

  const obj = new THREE.Object3D();
  const qz = new THREE.Quaternion();
  const qt = new THREE.Quaternion();
  const qtwist = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const ringOffset = random() * Math.PI * 2;
    for (let pi = 0; pi < ring.count; pi++) {
      const a = ringOffset + pi / ring.count * Math.PI * 2 + (random() - 0.5) * 0.16;
      const scaleJitter = 0.92 + random() * 0.16;
      const petal = createPetalGeometry({
        length: ring.length * scaleJitter,
        width: ring.width * (0.92 + random() * 0.16),
        cup: ring.cup * (0.90 + random() * 0.18),
        edgeCurl: ring.edgeCurl * (0.82 + random() * 0.34),
        tipCurl: ring.tipCurl * (0.82 + random() * 0.34),
        fold: ring.fold,
        rounding: ring.rounding,
        deep: ri < 2 ? '#cb668c' : '#d97b9c',
        body: ri < 2 ? '#e996b1' : '#f1afc2',
        edge: '#ffe1e9'
      }, random);

      const rr = ring.radius * (0.88 + random() * 0.20);
      obj.position.set(Math.cos(a) * rr, Math.sin(a) * rr, ring.z + (random() - 0.5) * 0.025);
      qz.setFromAxisAngle(zAxis, a - Math.PI / 2);
      qt.setFromAxisAngle(xAxis, ring.tilt + (random() - 0.5) * 0.10);
      qtwist.setFromAxisAngle(yAxis, (random() - 0.5) * (0.10 + ri * 0.015));
      obj.quaternion.copy(qz).multiply(qt).multiply(qtwist);
      obj.scale.set(1, 1, 1);
      obj.updateMatrix();
      petal.applyMatrix4(obj.matrix);
      parts.push(petal);
    }
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  // Normalize the actual petal bouquet to radius 1 for predictable scene layout.
  const radius = merged.boundingSphere.radius || 1;
  merged.scale(1 / radius, 1 / radius, 1 / radius);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

const roseGeometries = [createLayeredRose(317), createLayeredRose(911), createLayeredRose(2027)];

function makeRoseMaterial(tint) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint),
    vertexColors: true,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
    sheen: 0.95,
    sheenColor: new THREE.Color('#ffd9e4'),
    sheenRoughness: 0.47,
    iridescence: 0.04,
    iridescenceIOR: 1.3,
    emissive: new THREE.Color('#280812'),
    emissiveIntensity: 0.05,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1
  });
}

// A rounded dome with front/middle/back depth, not a flat flower wall.
const roseSpecs = [
  { p:[ 0.00, 1.40, 0.42], s:1.05, c:'#ffd4df', g:2, r:[-0.03, 0.03, 0.01] },
  { p:[-0.94, 1.20, 0.15], s:0.93, c:'#f8bfd0', g:1, r:[ 0.07,-0.13,-0.08] },
  { p:[ 0.96, 1.18, 0.16], s:0.95, c:'#f6b1c6', g:0, r:[-0.06, 0.14, 0.08] },
  { p:[-0.53, 2.03,-0.08], s:0.80, c:'#ffdae4', g:2, r:[ 0.07,-0.08, 0.08] },
  { p:[ 0.54, 2.05, 0.00], s:0.82, c:'#f7b2c7', g:1, r:[-0.06, 0.08,-0.06] },
  { p:[-1.54, 0.66,-0.12], s:0.76, c:'#fbd2dd', g:0, r:[ 0.11,-0.21,-0.06] },
  { p:[ 1.55, 0.66,-0.10], s:0.77, c:'#f8bacb', g:2, r:[-0.09, 0.20, 0.08] },
  { p:[-0.52, 0.52, 0.70], s:0.80, c:'#fbc8d6', g:1, r:[-0.02,-0.06, 0.02] },
  { p:[ 0.53, 0.50, 0.73], s:0.82, c:'#ffd0db', g:0, r:[ 0.04, 0.08,-0.02] },
  { p:[-1.37, 1.61, 0.24], s:0.69, c:'#f5adc2', g:2, r:[ 0.03,-0.20, 0.10] },
  { p:[ 1.36, 1.62, 0.24], s:0.70, c:'#fbd1dc', g:1, r:[-0.04, 0.20,-0.08] },
  { p:[ 0.02, 0.88,-0.55], s:0.71, c:'#ffe0e6', g:0, r:[ 0.06, 0.02, 0.03] },
  { p:[-0.04, 2.42,-0.18], s:0.64, c:'#f5afc4', g:2, r:[-0.07, 0.02, 0.02] }
];

const roses = [];
for (let i = 0; i < roseSpecs.length; i++) {
  const spec = roseSpecs[i];
  const mesh = new THREE.Mesh(roseGeometries[spec.g], makeRoseMaterial(spec.c));
  mesh.position.set(...spec.p);
  mesh.rotation.set(...spec.r);
  mesh.scale.setScalar(0.001);
  mesh.renderOrder = 2;
  mesh.userData = {
    index: i,
    basePos: new THREE.Vector3(...spec.p),
    baseRot: new THREE.Euler(...spec.r),
    baseScale: spec.s,
    velocity: new THREE.Vector3(spec.p[0] * 0.60 + randn() * 0.48, 0.60 + Math.random() * 0.68, randn() * 0.70).normalize().multiplyScalar(rand(1.7, 2.9)),
    spin: new THREE.Vector3(rand(-1.75,1.75), rand(-1.75,1.75), rand(-2.0,2.0))
  };
  roseLayer.add(mesh);
  roses.push(mesh);
}

// -----------------------------------------------------------------------------
// Narrow stems and gauze wrapping. Kept visually secondary to the flower heads.
// -----------------------------------------------------------------------------
const handle = new THREE.Vector3(0.02, -2.25, -0.04);
const stemMat = new THREE.MeshPhysicalMaterial({
  color:'#bf8f9b', roughness:0.50, clearcoat:0.12, transparent:true, opacity:0.67
});
for (const spec of roseSpecs) {
  const start = new THREE.Vector3(spec.p[0] * 0.77, spec.p[1] - spec.s * 0.45, spec.p[2] - 0.18);
  const c1 = start.clone().lerp(handle,0.38).add(new THREE.Vector3(randn()*0.09,0.04,randn()*0.07));
  const c2 = start.clone().lerp(handle,0.72).add(new THREE.Vector3(randn()*0.06,-0.03,randn()*0.05));
  const curve = new THREE.CatmullRomCurve3([start,c1,c2,handle]);
  stemLayer.add(new THREE.Mesh(new THREE.TubeGeometry(curve,52,0.014,7,false),stemMat));
}

// A translucent tapered gauze cone replaces the blocky wrapper sheets.
const wrapGeo = new THREE.CylinderGeometry(0.24, 0.62, 2.15, 48, 10, true);
wrapGeo.scale(1, 1, 0.72);
const wrapMat = new THREE.MeshPhysicalMaterial({
  color:'#ffdce6', roughness:0.67, transparent:true, opacity:0.10,
  side:THREE.DoubleSide, depthWrite:false, sheen:0.45, sheenColor:new THREE.Color('#fff0f4')
});
const wrap = new THREE.Mesh(wrapGeo, wrapMat);
wrap.position.set(0,-1.18,-0.15);
stemLayer.add(wrap);

// -----------------------------------------------------------------------------
// Fine baby's-breath points. No bead-like icosahedrons.
// -----------------------------------------------------------------------------
const fillerCount = 3400;
const fPos = new Float32Array(fillerCount * 3);
const fCol = new Float32Array(fillerCount * 3);
const fSize = new Float32Array(fillerCount);
const fc = new THREE.Color();
for (let i = 0; i < fillerCount; i++) {
  const a = rand(0, Math.PI * 2);
  const rad = Math.pow(Math.random(), 0.62) * rand(1.05, 2.28);
  const y = rand(0.20, 2.36) + randn() * 0.08;
  fPos[i*3] = Math.cos(a) * rad * 0.88;
  fPos[i*3+1] = y;
  fPos[i*3+2] = Math.sin(a) * rad * 0.45 + rand(-0.34,0.38);
  fc.set(Math.random() < 0.66 ? '#fff1ed' : Math.random() < 0.78 ? '#f7cfda' : '#e5c59e');
  fCol[i*3]=fc.r; fCol[i*3+1]=fc.g; fCol[i*3+2]=fc.b;
  fSize[i]=rand(0.38,1.08);
}
const fillerGeo = new THREE.BufferGeometry();
fillerGeo.setAttribute('position', new THREE.BufferAttribute(fPos,3));
fillerGeo.setAttribute('aColor', new THREE.BufferAttribute(fCol,3));
fillerGeo.setAttribute('aSize', new THREE.BufferAttribute(fSize,1));
const fillerMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.NormalBlending, toneMapped:false,
  uniforms:{uPixelRatio:{value:pixelRatio()},uOpacity:{value:1}},
  vertexShader:`uniform float uPixelRatio;attribute vec3 aColor;attribute float aSize;varying vec3 vColor;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(9.5/max(2.,-mv.z)),1.,2.45);vColor=aColor;vA=.72;}`,
  fragmentShader:`uniform float uOpacity;varying vec3 vColor;varying float vA;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;gl_FragColor=vec4(vColor,exp(-r2*19.)*vA*uOpacity);}`
});
const filler = new THREE.Points(fillerGeo,fillerMat);
fillerLayer.add(filler);

// -----------------------------------------------------------------------------
// Atmosphere dust sampled FROM the actual multi-petal rose surfaces.
// It stays tiny; the real mesh provides the floral form.
// -----------------------------------------------------------------------------
const targets=[], starts=[], pcolors=[], psizes=[], pphases=[];
const sp=new THREE.Vector3(), sn=new THREE.Vector3();
for(const rose of roses){
  rose.scale.setScalar(rose.userData.baseScale);
  rose.updateMatrix();
  const sampler=new MeshSurfaceSampler(rose).build();
  const samples=rose.userData.index<3?3000:2050;
  for(let i=0;i<samples;i++){
    sampler.sample(sp,sn);
    sp.applyMatrix4(rose.matrix);
    targets.push(sp.x,sp.y,sp.z);
    const dir=new THREE.Vector3(randn(),randn(),randn()).normalize();
    const st=sp.clone().addScaledVector(dir,rand(3.5,7.2));
    starts.push(st.x,st.y,st.z);
    const c=new THREE.Color(Math.random()<0.72?'#ffd2dc':Math.random()<0.76?'#fff0eb':'#e7c7a4');
    c.offsetHSL(rand(-0.012,0.012),rand(-0.04,0.04),rand(-0.04,0.04));
    pcolors.push(c.r,c.g,c.b);
    psizes.push(rand(0.45,1.16));
    pphases.push(rand(0,Math.PI*2));
  }
  rose.scale.setScalar(0.001);
}
const pg=new THREE.BufferGeometry();
pg.setAttribute('position',new THREE.Float32BufferAttribute(targets,3));
pg.setAttribute('aStart',new THREE.Float32BufferAttribute(starts,3));
pg.setAttribute('aColor',new THREE.Float32BufferAttribute(pcolors,3));
pg.setAttribute('aSize',new THREE.Float32BufferAttribute(psizes,1));
pg.setAttribute('aPhase',new THREE.Float32BufferAttribute(pphases,1));
const pm=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,toneMapped:false,
  uniforms:{uTime:{value:0},uMorph:{value:0},uExplode:{value:0},uPixelRatio:{value:pixelRatio()}},
  vertexShader:`uniform float uTime,uMorph,uExplode,uPixelRatio;attribute vec3 aStart,aColor;attribute float aSize,aPhase;varying vec3 vColor;varying float vAlpha;float ez(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}void main(){float mm=ez(uMorph);vec3 p=mix(aStart,position,mm);p+=vec3(sin(uTime*.68+aPhase)*.009,cos(uTime*.54+aPhase*1.1)*.008,sin(uTime*.43+aPhase*.7)*.008)*mm;float e=uExplode*uExplode;if(e>0.){vec3 d=normalize(position+vec3(.0001));p+=d*(2.2+fract(aPhase*.17)*3.6)*e;p.y-=e*e*2.65;}vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(9.4/max(2.,-mv.z)),1.,2.45);vColor=aColor;vAlpha=(.16+.54*mm)*(1.-smoothstep(.56,1.,uExplode));}`,
  fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;gl_FragColor=vec4(vColor,exp(-r2*20.)*vAlpha);}`
});
fxLayer.add(new THREE.Points(pg,pm));

// Sparse HDR sparkle layer only. This is what bloom sees.
const sparkCount=900;
const sparkPos=new Float32Array(sparkCount*3),sparkSize=new Float32Array(sparkCount),sparkPhase=new Float32Array(sparkCount),sparkCol=new Float32Array(sparkCount*3);
for(let i=0;i<sparkCount;i++){
  const a=rand(0,Math.PI*2),rad=Math.pow(Math.random(),.56)*3.05;
  sparkPos[i*3]=Math.cos(a)*rad+randn()*.14;
  sparkPos[i*3+1]=rand(-1.75,2.68)+randn()*.09;
  sparkPos[i*3+2]=Math.sin(a)*rad*.58+rand(-.64,.78);
  sparkSize[i]=rand(.45,1.25);sparkPhase[i]=rand(0,Math.PI*2);
  const c=new THREE.Color(Math.random()<.70?'#ffb6cb':Math.random()<.72?'#fff0e7':'#e3c193');
  sparkCol[i*3]=c.r;sparkCol[i*3+1]=c.g;sparkCol[i*3+2]=c.b;
}
const sg=new THREE.BufferGeometry();
sg.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));sg.setAttribute('aSize',new THREE.BufferAttribute(sparkSize,1));sg.setAttribute('aPhase',new THREE.BufferAttribute(sparkPhase,1));sg.setAttribute('aColor',new THREE.BufferAttribute(sparkCol,3));
const sm=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{uTime:{value:0},uVis:{value:0},uPixelRatio:{value:pixelRatio()}},
  vertexShader:`uniform float uTime,uVis,uPixelRatio;attribute float aSize,aPhase;attribute vec3 aColor;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.4+aPhase)*.043;p.y+=cos(uTime*.32+aPhase*1.2)*.036;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(10.5/max(2.,-mv.z)),1.,3.1);vColor=aColor*1.85;vAlpha=uVis*(.16+.84*pow(.5+.5*sin(uTime*2.+aPhase),6.));}`,
  fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;gl_FragColor=vec4(vColor,exp(-d*d*29.)*vAlpha);}`
});
fxLayer.add(new THREE.Points(sg,sm));

// White 3D frame rotates with the bouquet as in the reference.
const wireMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.60,toneMapped:false});
const wireBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.9,5.8,4.6)),wireMat);
wireBox.position.set(0,.25,-.30);
root.add(wireBox);

// -----------------------------------------------------------------------------
// Final petal rain: real curved petal meshes, not ellipse sprites.
// -----------------------------------------------------------------------------
function createRainPetal(rows=14,cols=10){
  const pos=[],idx=[];
  for(let iy=0;iy<rows;iy++){
    const u=iy/(rows-1);
    const bulb=Math.pow(Math.sin(Math.PI*(.06+u*.79)),.60);
    const half=.46*bulb*(.16+.84*Math.pow(u,.55));
    for(let ix=0;ix<cols;ix++){
      const v=ix/(cols-1)*2-1,av=Math.abs(v);
      const x=v*half;
      const y=(u-.43)*.92-.055*av*av*Math.pow(u,3.6);
      const z=(1-v*v)*.13*Math.sin(Math.PI*u)+.07*Math.pow(av,1.8)*u*u-.10*Math.pow(u,3.1);
      pos.push(x,y,z);
    }
  }
  for(let iy=0;iy<rows-1;iy++)for(let ix=0;ix<cols-1;ix++){
    const a=iy*cols+ix,b=(iy+1)*cols+ix,c=(iy+1)*cols+ix+1,d=iy*cols+ix+1;
    idx.push(a,b,c,a,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const PETALS=1750;
const petalMat=new THREE.MeshPhysicalMaterial({
  color:'#ffffff',roughness:.44,clearcoat:.14,sheen:.72,sheenColor:new THREE.Color('#ffd6e1'),side:THREE.DoubleSide,transparent:true,opacity:.98
});
const rain=new THREE.InstancedMesh(createRainPetal(),petalMat,PETALS);
rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rain.frustumCulled=false;rain.visible=false;
const rainState=[],rq=new THREE.Quaternion(),rmx=new THREE.Matrix4(),rsc=new THREE.Vector3(),rc=new THREE.Color();
for(let i=0;i<PETALS;i++){
  const src=roseSpecs[Math.floor(Math.random()*roseSpecs.length)].p;
  const start=new THREE.Vector3(src[0]+randn()*.24,src[1]+randn()*.21,src[2]+randn()*.22);
  const vel=new THREE.Vector3(start.x*.56+randn()*.74,rand(.28,1.28),start.z*.36+randn()*.92).normalize().multiplyScalar(rand(1.6,4.7));
  rainState.push({start,vel,rot:new THREE.Euler(rand(0,6),rand(0,6),rand(0,6)),spin:new THREE.Vector3(rand(-4.6,4.6),rand(-4.3,4.3),rand(-5.2,5.2)),scale:rand(.070,.175),sway:rand(.30,1.12),phase:rand(0,Math.PI*2)});
  rc.set(Math.random()<.72?'#f7b2c7':Math.random()<.75?'#ffe0e8':'#fff0e7');
  rc.offsetHSL(rand(-.010,.010),rand(-.03,.03),rand(-.025,.025));rain.setColorAt(i,rc);
  rsc.setScalar(.0001);rmx.compose(start,rq,rsc);rain.setMatrixAt(i,rmx);
}
rain.instanceColor.needsUpdate=true;fxLayer.add(rain);

const codeLines=[
  `<span class="comment">// V7 · layered high-resolution rose mesh</span>`,
  `<span class="kw">const</span> PETALS_PER_ROSE = <span class="num">56</span>;`,
  `<span class="kw">const</span> PETAL_GRID = <span class="num">18 * 14</span>;`,
  `<span class="comment">// every petal = real curved triangle surface</span>`,
  `<span class="kw">const</span> rose = <span class="fn">buildLayeredRose</span>({`,
  `  cup: <span class="num">true</span>, edgeCurl: <span class="num">true</span>, roundedTip: <span class="num">true</span>`,
  `});`,
  `<span class="fn">applyPhysicalPetalMaterial</span>(rose);`,
  `<span class="fn">sampleSurfaceDust</span>(rose);`,
  `<span class="kw">const</span> bloom = <span class="kw">new</span> UnrealBloomPass();`,
  `bloom.threshold = <span class="num">0.92</span>;`,
  `bloom.strength = <span class="num">0.30</span>;`,
  `<span class="comment">// mesh defines flower; particles only add dreamlike atmosphere</span>`,
  `<span class="kw">const</span> target = <span class="str target">'故辞安'</span>;`,
  `<span class="fn">morphIntoBouquet</span>();`,
  `<span class="fn">rotateTogether</span>(bouquet, wireframe);`,
  `<span class="fn">explodeBouquet</span>();`,
  `<span class="fn">releasePetalRain</span>(<span class="num">1750</span>);`,
  `<span class="fn">renderFor</span>(target);`
];
let cursor=0,nextLine=.42,codeCycle=-1;
function resetCode(){codeWindow.innerHTML='';cursor=0;nextLine=.42;terminalLine.textContent='building layered petal geometry...';}
function updateCode(t,cy){
  if(cy!==codeCycle){codeCycle=cy;resetCode();}
  if(t>nextLine&&cursor<codeLines.length){
    const row=document.createElement('div');row.className='code-line';row.innerHTML=`<span class="ln">${132+cursor}</span><span>${codeLines[cursor]}</span>`;codeWindow.appendChild(row);
    while(codeWindow.children.length>22)codeWindow.removeChild(codeWindow.firstChild);
    cursor++;nextLine+=rand(.34,.58);
    if(cursor===codeLines.length)terminalLine.textContent='render loop active · petal geometry at native resolution';
  }
}

function updateRain(e){
  if(e<=0){rain.visible=false;return;}
  rain.visible=true;const t=e*8.7;
  for(let i=0;i<PETALS;i++){
    const st=rainState[i],p=st.start.clone().addScaledVector(st.vel,t*.56);
    p.y-=0.5*.72*t*t;
    p.x+=Math.sin(t*1.05+st.phase)*st.sway*.22;
    p.z+=Math.cos(t*.84+st.phase)*st.sway*.16;
    rq.setFromEuler(new THREE.Euler(st.rot.x+st.spin.x*t,st.rot.y+st.spin.y*t,st.rot.z+st.spin.z*t));
    const grow=smoothstep(0,.10,e),fade=1-smoothstep(.83,1,e),sc=st.scale*grow*(.72+.28*fade);
    rsc.set(sc,sc*(.90+Math.sin(st.phase)*.08),sc);rmx.compose(p,rq,rsc);rain.setMatrixAt(i,rmx);
  }
  rain.instanceMatrix.needsUpdate=true;petalMat.opacity=.98*(1-smoothstep(.83,1,e));
}

const clock=new THREE.Clock(),CYCLE=42;let lastCycle=-1;
function animate(){
  requestAnimationFrame(animate);
  const elapsed=clock.getElapsedTime(),cy=Math.floor(elapsed/CYCLE),t=elapsed%CYCLE;
  if(cy!==lastCycle){lastCycle=cy;codeStage.classList.remove('fade-out');finalMessage.classList.remove('show');hint.style.opacity='1';}
  updateCode(t,cy);

  const morph=smoothstep(1.6,11.6,t);
  const reveal=smoothstep(3.4,12.3,t);
  const spark=smoothstep(6.0,13.5,t)*(1-smoothstep(29,34,t));
  const explode=smoothstep(26.2,33.8,t);
  pm.uniforms.uTime.value=elapsed;pm.uniforms.uMorph.value=morph;pm.uniforms.uExplode.value=explode;
  sm.uniforms.uTime.value=elapsed;sm.uniforms.uVis.value=spark;

  for(const rose of roses){
    const i=rose.userData.index;
    const appear=smoothstep(i*.035,.52+i*.035,reveal);
    const e=smoothstep(.02+i*.003,.64+i*.002,explode);
    const base=rose.userData.basePos;
    rose.position.copy(base).addScaledVector(rose.userData.velocity,e*e*2.05);
    rose.position.y-=e*e*e*.80;
    rose.rotation.set(
      rose.userData.baseRot.x+rose.userData.spin.x*e*1.08,
      rose.userData.baseRot.y+rose.userData.spin.y*e*1.08,
      rose.userData.baseRot.z+rose.userData.spin.z*e*1.08
    );
    const sc=rose.userData.baseScale*Math.max(.001,appear)*(1-smoothstep(.48,.92,e));
    rose.scale.setScalar(sc);
    rose.material.opacity=appear*(1-smoothstep(.43,.90,e));
  }

  stemLayer.visible=explode<.67;
  fillerMat.uniforms.uOpacity.value=1-smoothstep(.32,.88,explode);
  updateRain(explode);

  // slow combined bouquet + box movement
  root.rotation.y=Math.sin(elapsed*.22)*.12+elapsed*.022;
  root.rotation.x=Math.sin(elapsed*.17)*.021;
  wireMat.opacity=.60*(1-smoothstep(.72,1,explode));

  if(t>31)codeStage.classList.add('fade-out');
  if(t>35.8){finalMessage.classList.add('show');hint.style.opacity='0';}
  composer.render();
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());renderer.setSize(window.innerWidth,window.innerHeight,false);
  composer.setPixelRatio(pixelRatio());composer.setSize(window.innerWidth,window.innerHeight);
  pm.uniforms.uPixelRatio.value=pixelRatio();sm.uniforms.uPixelRatio.value=pixelRatio();fillerMat.uniforms.uPixelRatio.value=pixelRatio();
});
