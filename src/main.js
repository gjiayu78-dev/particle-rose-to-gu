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

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  precision: 'highp'
});
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2.5);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x010105, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x010105, 0.012);
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.05, 10.4);
camera.lookAt(0.7, 0.15, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.44, 0.72);
bloom.threshold = 0.72;
bloom.strength = 0.62;
bloom.radius = 0.44;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const root = new THREE.Group();
root.position.set(1.62, 0.02, 0);
scene.add(root);

// -----------------------------------------------------------------------------
// Dense 3D heart point field
// 78k body particles + 24k surface particles + sparse sparkle field.
// No bitmap, no low-resolution mesh, no large dot sprites.
// -----------------------------------------------------------------------------
const BODY_COUNT = 78000;
const SURFACE_COUNT = 24000;
const COUNT = BODY_COUNT + SURFACE_COUNT;
const target = new Float32Array(COUNT * 3);
const start = new Float32Array(COUNT * 3);
const color = new Float32Array(COUNT * 3);
const size = new Float32Array(COUNT);
const phase = new Float32Array(COUNT);
const scatterDir = new Float32Array(COUNT * 3);

const palette = [
  new THREE.Color('#ff4f9a'),
  new THREE.Color('#ff79b7'),
  new THREE.Color('#ff9fca'),
  new THREE.Color('#ffc7df'),
  new THREE.Color('#fff0f7')
];
const tempColor = new THREE.Color();

function heartOutline(t) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [x / 17.2, y / 17.2];
}

function setParticle(i, r, shellBias) {
  const t = Math.random() * Math.PI * 2;
  const [ox, oy] = heartOutline(t);
  const rr = r;
  let x = ox * rr;
  let y = oy * rr;

  // Give the heart real depth. Thickness is greatest toward the middle and
  // naturally collapses at the silhouette edge.
  const depthLimit = 0.10 + 0.68 * Math.pow(Math.max(0, 1 - rr * rr), 0.48);
  let z;
  if (shellBias) {
    const side = Math.random() < 0.5 ? -1 : 1;
    z = side * depthLimit * rand(0.72, 1.0);
  } else {
    z = rand(-depthLimit, depthLimit) * (0.42 + 0.58 * Math.random());
  }

  // Subtle organic irregularity keeps the point cloud from looking computer-flat.
  x += randn() * 0.008;
  y += randn() * 0.008;
  z += randn() * 0.006;

  // Scene scale and slight vertical lift.
  x *= 2.72;
  y = y * 2.72 + 0.14;
  z *= 2.22;

  const k = i * 3;
  target[k] = x;
  target[k + 1] = y;
  target[k + 2] = z;

  // Formation starts from a broad three-dimensional cloud.
  let dx = randn(), dy = randn(), dz = randn();
  const inv = 1 / Math.max(0.0001, Math.hypot(dx, dy, dz));
  dx *= inv; dy *= inv; dz *= inv;
  const d = rand(3.4, 7.4);
  start[k] = x + dx * d + randn() * 0.24;
  start[k + 1] = y + dy * d + randn() * 0.24;
  start[k + 2] = z + dz * d + randn() * 0.24;

  // Direction used during the final dispersal.
  let ex = x * 0.42 + randn() * 0.55;
  let ey = y * 0.32 + rand(0.15, 0.80);
  let ez = z * 0.30 + randn() * 0.55;
  const einv = 1 / Math.max(0.0001, Math.hypot(ex, ey, ez));
  scatterDir[k] = ex * einv;
  scatterDir[k + 1] = ey * einv;
  scatterDir[k + 2] = ez * einv;

  const edge = shellBias ? 1 : rr;
  const pick = Math.random();
  let base;
  if (pick < 0.10) base = palette[4];
  else if (pick < 0.35) base = palette[3];
  else if (pick < 0.67) base = palette[2];
  else if (pick < 0.88) base = palette[1];
  else base = palette[0];
  tempColor.copy(base);
  tempColor.offsetHSL(rand(-0.012, 0.012), rand(-0.035, 0.035), rand(-0.035, 0.035) + edge * 0.012);
  color[k] = tempColor.r;
  color[k + 1] = tempColor.g;
  color[k + 2] = tempColor.b;

  size[i] = shellBias ? rand(0.58, 1.34) : rand(0.42, 1.02);
  phase[i] = rand(0, Math.PI * 2);
}

for (let i = 0; i < BODY_COUNT; i++) {
  // sqrt gives a natural dense fill while still preserving the heart silhouette.
  const r = Math.sqrt(Math.random()) * 0.965;
  setParticle(i, r, false);
}
for (let i = BODY_COUNT; i < COUNT; i++) {
  // Thin high-density shell for a crisp contour at full screen.
  const r = rand(0.955, 1.002);
  setParticle(i, r, true);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(target, 3));
geometry.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterDir, 3));

const material = new THREE.ShaderMaterial({
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
    uPixelRatio: { value: pixelRatio() }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uMorph;
    uniform float uExplode;
    uniform float uPixelRatio;
    attribute vec3 aStart;
    attribute vec3 aColor;
    attribute vec3 aScatter;
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vAlpha;

    float ease(float x){ x=clamp(x,0.0,1.0); return x*x*(3.0-2.0*x); }

    void main(){
      float m=ease(uMorph);
      vec3 p=mix(aStart,position,m);

      // Micro motion only after the heart has formed.
      float breathe=1.0+0.014*sin(uTime*2.0);
      p.xy*=mix(1.0,breathe,m);
      p+=vec3(
        sin(uTime*.54+aPhase)*.006,
        cos(uTime*.47+aPhase*1.17)*.006,
        sin(uTime*.39+aPhase*.73)*.007
      )*m;

      float e=ease(uExplode);
      p+=aScatter*(2.0+fract(aPhase*.173)*4.8)*e*e;
      p.y-=e*e*e*1.75;

      vec4 mv=modelViewMatrix*vec4(p,1.0);
      gl_Position=projectionMatrix*mv;
      float perspective=10.4/max(2.0,-mv.z);
      gl_PointSize=clamp(aSize*uPixelRatio*perspective,1.0,3.15);
      vColor=aColor;
      vAlpha=(0.34+0.58*m)*(1.0-smoothstep(.66,1.0,e));
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vec2 uv=gl_PointCoord-.5;
      float r2=dot(uv,uv);
      if(r2>.25) discard;
      float soft=exp(-r2*17.0);
      gl_FragColor=vec4(vColor,soft*vAlpha*uOpacity);
    }
  `
});
const heart = new THREE.Points(geometry, material);
root.add(heart);

// Fine additive sparkles across the heart surface.
const SPARK_COUNT = 4200;
const sparkPos = new Float32Array(SPARK_COUNT * 3);
const sparkColor = new Float32Array(SPARK_COUNT * 3);
const sparkSize = new Float32Array(SPARK_COUNT);
const sparkPhase = new Float32Array(SPARK_COUNT);
for (let i = 0; i < SPARK_COUNT; i++) {
  const t = Math.random() * Math.PI * 2;
  const [ox, oy] = heartOutline(t);
  const r = rand(0.82, 1.015);
  const depthLimit = 0.10 + 0.68 * Math.pow(Math.max(0, 1 - r*r), 0.48);
  const k = i * 3;
  sparkPos[k] = ox * r * 2.72 + randn()*0.012;
  sparkPos[k+1] = oy * r * 2.72 + 0.14 + randn()*0.012;
  sparkPos[k+2] = rand(-depthLimit, depthLimit) * 2.22;
  const c = new THREE.Color(Math.random()<0.62 ? '#ffd2e5' : Math.random()<0.76 ? '#fff3f9' : '#ff78b5');
  sparkColor[k]=c.r; sparkColor[k+1]=c.g; sparkColor[k+2]=c.b;
  sparkSize[i]=rand(0.48,1.35);
  sparkPhase[i]=rand(0,Math.PI*2);
}
const sparkGeometry = new THREE.BufferGeometry();
sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPos,3));
sparkGeometry.setAttribute('aColor', new THREE.BufferAttribute(sparkColor,3));
sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sparkSize,1));
sparkGeometry.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhase,1));
const sparkMaterial = new THREE.ShaderMaterial({
  transparent:true,
  depthWrite:false,
  blending:THREE.AdditiveBlending,
  toneMapped:false,
  uniforms:{
    uTime:{value:0},
    uVisible:{value:0},
    uExplode:{value:0},
    uPixelRatio:{value:pixelRatio()}
  },
  vertexShader:`
    uniform float uTime,uVisible,uExplode,uPixelRatio;
    attribute vec3 aColor;
    attribute float aSize,aPhase;
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vec3 p=position;
      float e=smoothstep(0.0,1.0,uExplode);
      p*=1.0+e*1.15;
      p.y-=e*e*1.3;
      vec4 mv=modelViewMatrix*vec4(p,1.0);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(aSize*uPixelRatio*(11.2/max(2.0,-mv.z)),1.0,4.0);
      float tw=pow(.5+.5*sin(uTime*2.4+aPhase),7.0);
      vColor=aColor*1.75;
      vAlpha=uVisible*(.12+.88*tw)*(1.0-smoothstep(.62,1.0,e));
    }
  `,
  fragmentShader:`
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vec2 uv=gl_PointCoord-.5;
      float d=length(uv);
      if(d>.5) discard;
      gl_FragColor=vec4(vColor,exp(-d*d*28.0)*vAlpha);
    }
  `
});
root.add(new THREE.Points(sparkGeometry,sparkMaterial));

// Sparse ambient particles around the box for depth; they never become a halo.
const AMBIENT_COUNT = 4200;
const ambientPos = new Float32Array(AMBIENT_COUNT * 3);
const ambientCol = new Float32Array(AMBIENT_COUNT * 3);
const ambientSize = new Float32Array(AMBIENT_COUNT);
const ambientPhase = new Float32Array(AMBIENT_COUNT);
for(let i=0;i<AMBIENT_COUNT;i++){
  const k=i*3;
  ambientPos[k]=rand(-3.2,3.2);
  ambientPos[k+1]=rand(-3.0,3.0);
  ambientPos[k+2]=rand(-2.3,2.3);
  const c=new THREE.Color(Math.random()<0.72?'#f58ab8':'#ffe6f2');
  ambientCol[k]=c.r;ambientCol[k+1]=c.g;ambientCol[k+2]=c.b;
  ambientSize[i]=rand(.30,.80);
  ambientPhase[i]=rand(0,Math.PI*2);
}
const ag=new THREE.BufferGeometry();
ag.setAttribute('position',new THREE.BufferAttribute(ambientPos,3));
ag.setAttribute('aColor',new THREE.BufferAttribute(ambientCol,3));
ag.setAttribute('aSize',new THREE.BufferAttribute(ambientSize,1));
ag.setAttribute('aPhase',new THREE.BufferAttribute(ambientPhase,1));
const am=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{uTime:{value:0},uAlpha:{value:.15},uPixelRatio:{value:pixelRatio()}},
  vertexShader:`uniform float uTime,uPixelRatio;attribute vec3 aColor;attribute float aSize,aPhase;varying vec3 vColor;varying float vA;void main(){vec3 p=position;p.y+=sin(uTime*.19+aPhase)*.08;p.x+=cos(uTime*.16+aPhase*.7)*.05;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(9.0/max(2.,-mv.z)),1.,2.2);vColor=aColor;vA=.22+.22*sin(uTime*.8+aPhase)*.5;}`,
  fragmentShader:`uniform float uAlpha;varying vec3 vColor;varying float vA;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;gl_FragColor=vec4(vColor,exp(-r2*22.)*vA*uAlpha);}`
});
root.add(new THREE.Points(ag,am));

// Thin white 3D frame retains the original reference composition.
const wireMat = new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.48, toneMapped:false });
const wireBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.25,6.15,4.85)), wireMat);
wireBox.position.set(0,0.16,-0.18);
root.add(wireBox);

const codeLines = [
  `<span class="comment">// V8 · high-density pink particle heart</span>`,
  `<span class="kw">const</span> BODY = <span class="num">78000</span>;`,
  `<span class="kw">const</span> SURFACE = <span class="num">24000</span>;`,
  `<span class="kw">const</span> HEART_PARTICLES = BODY + SURFACE;`,
  `<span class="comment">// 3D volume + crisp surface shell</span>`,
  `<span class="kw">for</span> (<span class="kw">let</span> i = <span class="num">0</span>; i < HEART_PARTICLES; i++) {`,
  `  <span class="fn">sampleHeartVolume</span>(i);`,
  `  <span class="fn">assignPinkGradient</span>(i);`,
  `}`,
  `<span class="fn">morphFromCloud</span>(heart);`,
  `<span class="fn">addMicroSparkles</span>(<span class="num">4200</span>);`,
  `<span class="fn">rotateTogether</span>(heart, wireframe);`,
  `<span class="comment">// final phase: release the heart into particles</span>`,
  `<span class="fn">disperse</span>(heart);`,
  `<span class="kw">const</span> target = <span class="str target">'故辞安'</span>;`,
  `<span class="fn">renderFor</span>(target);`,
  `<span class="log">✓ 102000 heart particles ready</span>`
];
let codeCursor=0,nextCodeAt=.45,codeCycle=-1;
function resetCode(){
  codeWindow.innerHTML='';codeCursor=0;nextCodeAt=.45;
  terminalLine.textContent='initializing GPU heart field...';
}
function updateCode(t,cycle){
  if(cycle!==codeCycle){codeCycle=cycle;resetCode();}
  if(t>nextCodeAt&&codeCursor<codeLines.length){
    const row=document.createElement('div');
    row.className='code-line';
    row.innerHTML=`<span class="ln">${88+codeCursor}</span><span>${codeLines[codeCursor]}</span>`;
    codeWindow.appendChild(row);
    while(codeWindow.children.length>22)codeWindow.removeChild(codeWindow.firstChild);
    codeCursor++;
    nextCodeAt+=rand(.32,.56);
    if(codeCursor===codeLines.length)terminalLine.textContent='render loop active · waiting for final transition';
  }
}

const clock = new THREE.Clock();
const CYCLE = 39.0;
let lastCycle = -1;
function animate(){
  requestAnimationFrame(animate);
  const elapsed=clock.getElapsedTime();
  const cycleIndex=Math.floor(elapsed/CYCLE);
  const t=elapsed%CYCLE;

  if(cycleIndex!==lastCycle){
    lastCycle=cycleIndex;
    codeStage.classList.remove('fade-out');
    finalMessage.classList.remove('show');
    hint.style.opacity='1';
  }
  updateCode(t,cycleIndex);

  const morph=smoothstep(1.5,10.8,t);
  const sparkle=smoothstep(6.0,12.0,t)*(1-smoothstep(27.0,31.0,t));
  const explode=smoothstep(26.0,32.5,t);

  material.uniforms.uTime.value=elapsed;
  material.uniforms.uMorph.value=morph;
  material.uniforms.uExplode.value=explode;
  sparkMaterial.uniforms.uTime.value=elapsed;
  sparkMaterial.uniforms.uVisible.value=sparkle;
  sparkMaterial.uniforms.uExplode.value=explode;
  am.uniforms.uTime.value=elapsed;
  am.uniforms.uAlpha.value=.12+.08*morph;

  // Slow 3D presentation. Heart and frame move as one object.
  root.rotation.y=Math.sin(elapsed*.19)*.16+elapsed*.022;
  root.rotation.x=Math.sin(elapsed*.14)*.030;
  root.rotation.z=Math.sin(elapsed*.11)*.012;
  wireMat.opacity=.48*(1-smoothstep(.72,1.0,explode));

  if(t>29.7)codeStage.classList.add('fade-out');
  if(t>34.2){
    finalMessage.classList.add('show');
    hint.style.opacity='0';
  }

  composer.render();
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  composer.setPixelRatio(pixelRatio());
  composer.setSize(window.innerWidth,window.innerHeight);
  material.uniforms.uPixelRatio.value=pixelRatio();
  sparkMaterial.uniforms.uPixelRatio.value=pixelRatio();
  am.uniforms.uPixelRatio.value=pixelRatio();
});
