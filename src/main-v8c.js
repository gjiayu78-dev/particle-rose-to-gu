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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x010105, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0.1, 0.04, 9.35);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.54, 0.34, 0.70);
bloom.threshold = 0.70;
bloom.strength = 0.54;
bloom.radius = 0.34;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const root = new THREE.Group();
root.position.set(1.28, -0.02, 0);
scene.add(root);

const BODY = 94000;
const SURFACE = 36000;
const HALO = 11000;
const SPARKS = 4300;

const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const ease = t => { t=clamp(t); return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; };
function randn(){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function field(x,d,y){ const q=x*x+2.25*d*d+y*y-1; return q*q*q-x*x*y*y*y-0.1125*d*d*y*y*y; }
function sample(shell=false){
  for(;;){
    const x=Math.random()*2.44-1.22;
    const d=Math.random()*1.92-.96;
    const y=Math.random()*2.46-1.12;
    const f=field(x,d,y);
    if(shell ? (f<=.018 && f>=-.088) : f<=-.004) return {x,d,y};
  }
}
function toWorld(p, shell=false){
  const s=shell?1.025:1;
  return new THREE.Vector3(p.x*2.08*s, (p.y*2.12-.03)*s, p.d*1.78*s);
}
function pink(shell=false){
  const c=new THREE.Color(); const r=Math.random();
  if(shell){ if(r<.46)c.set('#ff4f9f'); else if(r<.82)c.set('#ff72b7'); else c.set('#ff9bcb'); }
  else { if(r<.48)c.set('#f82f88'); else if(r<.82)c.set('#ff4d9d'); else c.set('#ff70b2'); }
  return c;
}
function startFor(p){
  const u=new THREE.Vector3(randn(),randn(),randn()).normalize();
  return p.clone().addScaledVector(u, 4.2+Math.random()*4.6).add(new THREE.Vector3(randn()*.45,randn()*.35,randn()*.5));
}

function makeHeart(){
  const n=BODY+SURFACE;
  const pos=new Float32Array(n*3), st=new Float32Array(n*3), col=new Float32Array(n*3), vel=new Float32Array(n*3);
  const size=new Float32Array(n), phase=new Float32Array(n), type=new Float32Array(n);
  for(let i=0;i<n;i++){
    const shell=i>=BODY; const p=toWorld(sample(shell),shell); const s=startFor(p); const c=pink(shell); const k=i*3;
    pos[k]=p.x;pos[k+1]=p.y;pos[k+2]=p.z; st[k]=s.x;st[k+1]=s.y;st[k+2]=s.z;
    col[k]=c.r;col[k+1]=c.g;col[k+2]=c.b; size[i]=shell?1.18+Math.random()*1.18:.72+Math.random()*.74; phase[i]=Math.random()*6.283; type[i]=shell?1:0;
    const v=p.clone().normalize().add(new THREE.Vector3(randn()*.13,randn()*.09,randn()*.15)).normalize().multiplyScalar(.9+Math.random()*2.1);
    vel[k]=v.x;vel[k+1]=v.y;vel[k+2]=v.z;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aStart',new THREE.BufferAttribute(st,3)); g.setAttribute('aColor',new THREE.BufferAttribute(col,3));
  g.setAttribute('aVelocity',new THREE.BufferAttribute(vel,3)); g.setAttribute('aSize',new THREE.BufferAttribute(size,1)); g.setAttribute('aPhase',new THREE.BufferAttribute(phase,1)); g.setAttribute('aType',new THREE.BufferAttribute(type,1));
  return g;
}

const heartMat=new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, depthTest:true, blending:THREE.NormalBlending, toneMapped:false,
  uniforms:{uTime:{value:0},uMorph:{value:0},uExplode:{value:0},uOpacity:{value:1},uPixelRatio:{value:Math.min(devicePixelRatio,2)}},
  vertexShader:`
    uniform float uTime,uMorph,uExplode,uPixelRatio; attribute vec3 aStart,aColor,aVelocity; attribute float aSize,aPhase,aType; varying vec3 vColor; varying float vAlpha,vType,vPulse;
    float E(float t){t=clamp(t,0.,1.);return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;}
    void main(){float m=E(uMorph);vec3 p=mix(aStart,position,m);float breath=1.+.012*sin(uTime*1.15+aPhase);p.xy*=breath;p+=aVelocity*uExplode*(2.8+2.0*uExplode);p.y-=1.7*uExplode*uExplode;
      vec4 mv=modelViewMatrix*vec4(p,1.);float scale=10.5/max(4.2,-mv.z);gl_PointSize=max(1.,aSize*uPixelRatio*scale);gl_Position=projectionMatrix*mv;
      vColor=aColor;vType=aType;vPulse=.5+.5*sin(uTime*2.4+aPhase);vAlpha=mix(.12,.98,m)*(1.-.48*uExplode);}
  `,
  fragmentShader:`
    uniform float uOpacity; varying vec3 vColor; varying float vAlpha,vType,vPulse;
    void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;float core=exp(-r2*18.);float soft=exp(-r2*6.5);float a=(.76*core+.24*soft)*vAlpha*uOpacity;
      vec3 c=vColor*(.94+.13*vPulse+vType*.10);gl_FragColor=vec4(c,a);}
  `
});
const heart=new THREE.Points(makeHeart(),heartMat); heart.frustumCulled=false; root.add(heart);

function makeHalo(){
  const pos=new Float32Array(HALO*3), col=new Float32Array(HALO*3), size=new Float32Array(HALO), phase=new Float32Array(HALO);
  for(let i=0;i<HALO;i++){let p=toWorld(sample(true),true);const dir=p.clone().normalize();p.addScaledVector(dir,.05+Math.pow(Math.random(),1.7)*.28);p.add(new THREE.Vector3(randn()*.035,randn()*.035,randn()*.045));const c=new THREE.Color(Math.random()<.18?'#ffe0f0':'#ff61aa');const k=i*3;
    pos[k]=p.x;pos[k+1]=p.y;pos[k+2]=p.z;col[k]=c.r;col[k+1]=c.g;col[k+2]=c.b;size[i]=1.5+Math.random()*2.5;phase[i]=Math.random()*6.283;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aColor',new THREE.BufferAttribute(col,3));g.setAttribute('aSize',new THREE.BufferAttribute(size,1));g.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));return g;
}
const haloMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{uTime:{value:0},uOpacity:{value:0},uExplode:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio,2)}},
  vertexShader:`uniform float uTime,uOpacity,uExplode,uPixelRatio;attribute vec3 aColor;attribute float aSize,aPhase;varying vec3 vColor;varying float vA;void main(){vec3 p=position;vec3 n=normalize(p+vec3(.0001));p+=n*uExplode*(1.8+sin(aPhase));p.y-=uExplode*uExplode;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=max(1.,aSize*uPixelRatio*(8.5/max(4.2,-mv.z)));gl_Position=projectionMatrix*mv;vColor=aColor;vA=uOpacity*(.16+.30*(.5+.5*sin(uTime*2.5+aPhase)));}`,
  fragmentShader:`varying vec3 vColor;varying float vA;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;gl_FragColor=vec4(vColor*1.25,exp(-r2*9.)*vA);}`});
const halo=new THREE.Points(makeHalo(),haloMat);halo.frustumCulled=false;root.add(halo);

function makeSparks(){
  const pos=new Float32Array(SPARKS*3),col=new Float32Array(SPARKS*3),size=new Float32Array(SPARKS),phase=new Float32Array(SPARKS);
  for(let i=0;i<SPARKS;i++){const p=toWorld(sample(true),true).multiplyScalar(1.03);const c=new THREE.Color(Math.random()<.13?'#fff0f7':'#ff83bd');const k=i*3;pos[k]=p.x;pos[k+1]=p.y;pos[k+2]=p.z;col[k]=c.r;col[k+1]=c.g;col[k+2]=c.b;size[i]=1.4+Math.random()*3.4;phase[i]=Math.random()*6.283;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aColor',new THREE.BufferAttribute(col,3));g.setAttribute('aSize',new THREE.BufferAttribute(size,1));g.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));return g;
}
const sparkMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{uTime:{value:0},uOpacity:{value:0},uExplode:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio,2)}},
  vertexShader:`uniform float uTime,uOpacity,uExplode,uPixelRatio;attribute vec3 aColor;attribute float aSize,aPhase;varying vec3 vColor;varying float vA;void main(){vec3 p=position;vec3 n=normalize(p+vec3(.0001));p+=n*uExplode*(2.6+1.1*sin(aPhase));p.y-=1.1*uExplode*uExplode;vec4 mv=modelViewMatrix*vec4(p,1.);float pulse=pow(max(0.,sin(uTime*3.2+aPhase)),8.);gl_PointSize=max(1.,aSize*uPixelRatio*(9.5/max(4.2,-mv.z))*(.8+1.2*pulse));gl_Position=projectionMatrix*mv;vColor=aColor;vA=uOpacity*(.08+.80*pulse)*(1.-.32*uExplode);}`,
  fragmentShader:`varying vec3 vColor;varying float vA;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;gl_FragColor=vec4(vColor*1.55,exp(-r2*13.)*vA);}`});
const sparks=new THREE.Points(makeSparks(),sparkMat);sparks.frustumCulled=false;root.add(sparks);

const code=[
`<span class="comment">// V8 · saturated volumetric pink heart</span>`,`<span class="kw">const</span> BODY = <span class="num">94000</span>;`,`<span class="kw">const</span> SURFACE = <span class="num">36000</span>;`,`<span class="kw">const</span> HALO = <span class="num">11000</span>;`,`<span class="kw">const</span> SPARKS = <span class="num">4300</span>;`,``,
`<span class="kw">function</span> <span class="fn">heartField</span>(x, depth, y) {`,`  <span class="kw">const</span> q = x*x + 2.25*depth*depth + y*y - <span class="num">1.0</span>;`,`  <span class="kw">return</span> q*q*q - x*x*y*y*y`, `    - <span class="num">0.1125</span>*depth*depth*y*y*y;`,`}`,``,
`<span class="comment">// full body + bright shell + dreamy halo</span>`,`<span class="fn">sampleVolume</span>(BODY);`,`<span class="fn">sampleSurface</span>(SURFACE);`,`<span class="fn">addHalo</span>(HALO);`,`<span class="fn">addSparkles</span>(SPARKS);`,``,
`<span class="comment">// keep the heart front-readable</span>`,`heart.rotationY = <span class="fn">softSway</span>(<span class="num">±0.24</span>);`,`heart.depth = <span class="num">1.78</span>;`,`heart.pink = <span class="str">"#ff4d9d"</span>;`,`bloom.strength = <span class="num">0.54</span>;`,``,
`<span class="kw">const</span> target = <span class="target">"故辞安"</span>;`,`<span class="fn">morphFromCloud</span>(target);`,`<span class="fn">explodeToPinkRain</span>(heart);`,`<span class="log">// rendering…</span>`];
let ci=0;function addCode(){if(!codeWindow||ci>=code.length)return;const row=document.createElement('div');row.className='code-line';row.innerHTML=`<span class="ln">${88+ci}</span><span>${code[ci]||'&nbsp;'}</span>`;codeWindow.appendChild(row);codeWindow.scrollTop=codeWindow.scrollHeight;ci++;}
addCode();const codeTimer=setInterval(()=>{addCode();if(ci>=code.length)clearInterval(codeTimer);},390);

const clock=new THREE.Clock(), CYCLE=34;
function animate(){requestAnimationFrame(animate);const elapsed=clock.getElapsedTime(),t=elapsed%CYCLE;
  const morph=ease(smooth(2,9.3,t)), explode=t<23.7?0:ease(smooth(23.7,29.3,t));
  heartMat.uniforms.uTime.value=elapsed;heartMat.uniforms.uMorph.value=morph;heartMat.uniforms.uExplode.value=explode;heartMat.uniforms.uOpacity.value=t>29.4?1-smooth(29.4,31.2,t):1;
  haloMat.uniforms.uTime.value=elapsed;haloMat.uniforms.uOpacity.value=morph*(1-smooth(28.3,30.8,t));haloMat.uniforms.uExplode.value=explode;
  sparkMat.uniforms.uTime.value=elapsed;sparkMat.uniforms.uOpacity.value=morph*(1-smooth(29,31,t));sparkMat.uniforms.uExplode.value=explode;

  const hold=smooth(8.8,10.2,t)*(1-smooth(23.0,24.5,t));
  root.rotation.y=Math.sin((elapsed-15)*0.26)*0.24*hold;
  root.rotation.x=Math.sin((elapsed-15)*0.19)*0.055*hold;
  root.rotation.z=Math.sin((elapsed-15)*0.14)*0.018*hold;
  const pulse=1+Math.sin(elapsed*1.08)*0.011*hold;root.scale.setScalar(pulse);

  if(terminalLine){if(t<3)terminalLine.textContent='initializing GPU heart field…';else if(t<9.5)terminalLine.textContent='assembling 145k pink particles…';else if(t<23.7)terminalLine.textContent='heart locked · glow + depth active';else terminalLine.textContent='release → pink particle rain';}
  if(codeStage)codeStage.style.opacity=String(.34*(1-smooth(21.5,25,t)));
  if(hint)hint.style.opacity=t>21?'0':'.12';
  if(finalMessage){const show=smooth(29.7,31.6,t);finalMessage.style.opacity=String(show);finalMessage.style.transform=`translate(-50%,-50%) scale(${.94+show*.06})`;}
  composer.render();
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);const pr=Math.min(devicePixelRatio,2);heartMat.uniforms.uPixelRatio.value=pr;haloMat.uniforms.uPixelRatio.value=pr;sparkMat.uniforms.uPixelRatio.value=pr;});
