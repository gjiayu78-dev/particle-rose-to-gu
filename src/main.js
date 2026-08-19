import './style.css';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
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
  alpha: false,
  powerPreference: 'high-performance',
  precision: 'highp'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x010106, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.018);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.12, 10.4);
camera.lookAt(0.6, 0.25, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.26, 0.28, 1.0);
bloom.threshold = 1.0;
bloom.strength = 0.26;
bloom.radius = 0.28;
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xffedf4, 0x0d1020, 1.7));
const key = new THREE.DirectionalLight(0xffdbe8, 3.8); key.position.set(4.0, 5.7, 8.0); scene.add(key);
const fill = new THREE.DirectionalLight(0xd9d4ff, 1.5); fill.position.set(-5.5, 1.8, 4.5); scene.add(fill);
const rim = new THREE.PointLight(0xff9fc6, 10, 18, 2); rim.position.set(2.2, 2.8, 4.0); scene.add(rim);
const warm = new THREE.PointLight(0xffd6ad, 5, 15, 2); warm.position.set(-0.7, -0.5, 3.0); scene.add(warm);

const root = new THREE.Group();
root.position.set(1.62, -0.05, 0);
scene.add(root);
const roseLayer = new THREE.Group();
const stemLayer = new THREE.Group();
const fillerLayer = new THREE.Group();
const fxLayer = new THREE.Group();
root.add(stemLayer, roseLayer, fillerLayer, fxLayer);

function makeRoseMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.38,
    sheen: 0.82,
    sheenColor: new THREE.Color('#ffd8e5'),
    sheenRoughness: 0.48,
    emissive: new THREE.Color('#2a0814'),
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1
  });
}

const roseSpecs = [
  { p:[ 0.00, 1.38, 0.40], s:1.23, c:'#f8b8ca', r:[-0.05, 1.82, 0.02] },
  { p:[-1.05, 1.15, 0.12], s:1.05, c:'#f6c5d3', r:[ 0.05, 1.64,-0.11] },
  { p:[ 1.03, 1.14, 0.13], s:1.06, c:'#f3a8c0', r:[-0.06, 2.00, 0.10] },
  { p:[-0.58, 2.05,-0.08], s:0.88, c:'#ffd5df', r:[ 0.08, 1.72, 0.08] },
  { p:[ 0.60, 2.04, 0.02], s:0.90, c:'#f6aec3', r:[-0.07, 1.94,-0.07] },
  { p:[-1.60, 0.55,-0.05], s:0.83, c:'#fbd5df', r:[ 0.12, 1.55,-0.07] },
  { p:[ 1.58, 0.57,-0.03], s:0.84, c:'#f5b4c7', r:[-0.09, 2.08, 0.08] },
  { p:[-0.57, 0.48, 0.68], s:0.89, c:'#f9c8d4', r:[-0.02, 1.70, 0.02] },
  { p:[ 0.56, 0.47, 0.70], s:0.91, c:'#ffd0db', r:[ 0.05, 1.95,-0.02] },
  { p:[-1.46, 1.60, 0.22], s:0.75, c:'#f4a9c1', r:[ 0.03, 1.58, 0.11] },
  { p:[ 1.43, 1.61, 0.23], s:0.76, c:'#fbd1dc', r:[-0.05, 2.10,-0.09] },
  { p:[ 0.02, 0.88,-0.58], s:0.80, c:'#ffe0e7', r:[ 0.08, 1.85, 0.04] },
  { p:[-0.04, 2.42,-0.16], s:0.70, c:'#f2a6be', r:[-0.08, 1.80, 0.03] }
];

async function loadRoseGeometry() {
  const loader = new OBJLoader();
  const group = await loader.loadAsync('./red_rose3.obj');
  let source = null;
  group.traverse(child => {
    if (child.isMesh && child.name.toLowerCase() === 'rose') source = child;
  });
  if (!source) {
    group.traverse(child => { if (!source && child.isMesh) source = child; });
  }
  if (!source) throw new Error('rose OBJ contains no mesh');

  const geometry = source.geometry.clone();
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center); box.getSize(size);
  geometry.translate(-center.x, -center.y, -center.z);
  const normalizer = 1 / Math.max(size.x, size.y, size.z);
  geometry.scale(normalizer, normalizer, normalizer);
  geometry.computeBoundingSphere();
  console.log('rose geometry', {
    vertices: geometry.attributes.position.count,
    size: [size.x, size.y, size.z]
  });
  return geometry;
}

const roseGeometry = await loadRoseGeometry();
const roses = [];
for (let i = 0; i < roseSpecs.length; i++) {
  const spec = roseSpecs[i];
  const mesh = new THREE.Mesh(roseGeometry, makeRoseMaterial(spec.c));
  mesh.position.set(...spec.p);
  mesh.rotation.set(...spec.r);
  mesh.scale.setScalar(0.001);
  mesh.userData = {
    index: i,
    basePos: new THREE.Vector3(...spec.p),
    baseRot: new THREE.Euler(...spec.r),
    baseScale: spec.s * 1.75,
    velocity: new THREE.Vector3(spec.p[0] * 0.55 + randn() * 0.55, 0.65 + Math.random() * 0.7, randn() * 0.75).normalize().multiplyScalar(rand(1.7, 3.0)),
    spin: new THREE.Vector3(rand(-1.9,1.9), rand(-1.9,1.9), rand(-2.2,2.2))
  };
  roseLayer.add(mesh);
  roses.push(mesh);
}

// stems / wrapper: geometry, not a raster bouquet image
const handle = new THREE.Vector3(0.02, -2.20, -0.05);
const stemMat = new THREE.MeshPhysicalMaterial({ color:'#b88493', roughness:0.48, clearcoat:0.12, transparent:true, opacity:0.72 });
for (const spec of roseSpecs) {
  const start = new THREE.Vector3(spec.p[0]*0.82, spec.p[1]-0.42, spec.p[2]-0.16);
  const c1 = start.clone().lerp(handle,0.38).add(new THREE.Vector3(randn()*0.10,0.05,randn()*0.08));
  const c2 = start.clone().lerp(handle,0.72).add(new THREE.Vector3(randn()*0.07,-0.03,randn()*0.06));
  const curve = new THREE.CatmullRomCurve3([start,c1,c2,handle]);
  stemLayer.add(new THREE.Mesh(new THREE.TubeGeometry(curve,56,0.018,8,false),stemMat));
}
const wrapMat = new THREE.MeshPhysicalMaterial({ color:'#f6d5df', roughness:0.62, transparent:true, opacity:0.17, side:THREE.DoubleSide, depthWrite:false });
for (let i=0;i<10;i++) {
  const g = new THREE.PlaneGeometry(1.7,2.50,10,16);
  const a = g.attributes.position;
  for (let j=0;j<a.count;j++) {
    const x=a.getX(j), y=a.getY(j), t=(y+1.25)/2.5;
    a.setX(j,x*(0.20+0.80*t)+Math.sin(y*3.2+i)*0.03);
    a.setZ(j,Math.sin(x*2.5+y*1.8+i)*0.05);
  }
  a.needsUpdate=true; g.computeVertexNormals();
  const sheet = new THREE.Mesh(g,wrapMat.clone());
  sheet.material.opacity=0.07+i*0.014;
  sheet.position.set((i-4.5)*0.055,-1.05,-0.34+i*0.033);
  sheet.rotation.set(0,(i-4.5)*0.045,(i-4.5)*0.035);
  stemLayer.add(sheet);
}

// baby's breath: tiny instanced geometry
const fillerGeo = new THREE.IcosahedronGeometry(0.026,1);
const fillerMat = new THREE.MeshPhysicalMaterial({ color:'#fff4ef', roughness:0.34, clearcoat:0.16, emissive:'#2c1a18', emissiveIntensity:0.08, transparent:true });
const fillerCount=620;
const filler=new THREE.InstancedMesh(fillerGeo,fillerMat,fillerCount);
const im=new THREE.Matrix4(), iq=new THREE.Quaternion(), iv=new THREE.Vector3(), is=new THREE.Vector3(), ic=new THREE.Color();
for(let i=0;i<fillerCount;i++){
  const ang=rand(0,Math.PI*2), rad=Math.pow(Math.random(),0.58)*rand(0.9,2.30), y=rand(0.18,2.40)+randn()*0.09;
  iv.set(Math.cos(ang)*rad*0.90,y,Math.sin(ang)*rad*0.48+rand(-0.30,0.42));
  iq.setFromEuler(new THREE.Euler(rand(0,3),rand(0,3),rand(0,3)));
  const ss=rand(0.55,1.28); is.setScalar(ss); im.compose(iv,iq,is); filler.setMatrixAt(i,im);
  ic.set(Math.random()<0.62?'#fff2ed':Math.random()<0.76?'#f8cbd8':'#e4c49e'); filler.setColorAt(i,ic);
}
filler.instanceColor.needsUpdate=true; fillerLayer.add(filler);

// surface dust sampled from the actual high-detail triangle rose mesh
const targets=[], starts=[], pcolors=[], psizes=[], pphases=[];
const sp=new THREE.Vector3(), sn=new THREE.Vector3();
for(const rose of roses){
  rose.scale.setScalar(rose.userData.baseScale); rose.updateMatrix();
  const sampler=new MeshSurfaceSampler(rose).build();
  const samples=rose.userData.index<3?2800:1900;
  for(let i=0;i<samples;i++){
    sampler.sample(sp,sn); sp.applyMatrix4(rose.matrix);
    targets.push(sp.x,sp.y,sp.z);
    const dir=new THREE.Vector3(randn(),randn(),randn()).normalize();
    const st=sp.clone().addScaledVector(dir,rand(3.4,7.1)); starts.push(st.x,st.y,st.z);
    const c=new THREE.Color(Math.random()<0.70?'#ffd1dc':Math.random()<0.76?'#fff0ea':'#e7c6a3'); c.offsetHSL(rand(-0.012,0.012),rand(-0.04,0.04),rand(-0.04,0.04));
    pcolors.push(c.r,c.g,c.b); psizes.push(rand(0.52,1.35)); pphases.push(rand(0,Math.PI*2));
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
  uniforms:{uTime:{value:0},uMorph:{value:0},uExplode:{value:0},uPixelRatio:{value:Math.min(window.devicePixelRatio||1,2.5)}},
  vertexShader:`uniform float uTime,uMorph,uExplode,uPixelRatio;attribute vec3 aStart,aColor;attribute float aSize,aPhase;varying vec3 vColor;varying float vAlpha;float ez(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}void main(){float m=ez(uMorph);vec3 p=mix(aStart,position,m);p+=vec3(sin(uTime*.68+aPhase)*.010,cos(uTime*.55+aPhase*1.1)*.009,sin(uTime*.43+aPhase*.7)*.009)*m;float e=uExplode*uExplode;if(e>0.){vec3 d=normalize(position+vec3(.0001));p+=d*(2.2+fract(aPhase*.17)*3.6)*e;p.y-=e*e*2.7;}vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(10.0/max(2.,-mv.z)),1.,2.7);vColor=aColor;vAlpha=(.18+.58*m)*(1.-smoothstep(.58,1.,uExplode));}`,
  fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){vec2 uv=gl_PointCoord-.5;float r2=dot(uv,uv);if(r2>.25)discard;float a=exp(-r2*19.)*vAlpha;gl_FragColor=vec4(vColor,a);}`
});
fxLayer.add(new THREE.Points(pg,pm));

// sparse HDR sparks only; this is the only layer meant to bloom strongly
const sparkCount=980;
const sparkPos=new Float32Array(sparkCount*3),sparkSize=new Float32Array(sparkCount),sparkPhase=new Float32Array(sparkCount),sparkCol=new Float32Array(sparkCount*3);
for(let i=0;i<sparkCount;i++){
  const ang=rand(0,Math.PI*2),rad=Math.pow(Math.random(),0.55)*3.0;
  sparkPos[i*3]=Math.cos(ang)*rad+randn()*0.14;sparkPos[i*3+1]=rand(-1.8,2.65)+randn()*0.10;sparkPos[i*3+2]=Math.sin(ang)*rad*.58+rand(-.65,.80);
  sparkSize[i]=rand(.5,1.45);sparkPhase[i]=rand(0,Math.PI*2);const c=new THREE.Color(Math.random()<.70?'#ffb5cb':Math.random()<.72?'#fff0e5':'#e3c092');sparkCol[i*3]=c.r;sparkCol[i*3+1]=c.g;sparkCol[i*3+2]=c.b;
}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));sg.setAttribute('aSize',new THREE.BufferAttribute(sparkSize,1));sg.setAttribute('aPhase',new THREE.BufferAttribute(sparkPhase,1));sg.setAttribute('aColor',new THREE.BufferAttribute(sparkCol,3));
const sm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{uTime:{value:0},uVis:{value:0},uPixelRatio:{value:Math.min(window.devicePixelRatio||1,2.5)}},vertexShader:`uniform float uTime,uVis,uPixelRatio;attribute float aSize,aPhase;attribute vec3 aColor;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.4+aPhase)*.045;p.y+=cos(uTime*.32+aPhase*1.2)*.038;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixelRatio*(11.0/max(2.,-mv.z)),1.,3.4);vColor=aColor*1.85;vAlpha=uVis*(.18+.82*pow(.5+.5*sin(uTime*2.0+aPhase),6.));}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;gl_FragColor=vec4(vColor,exp(-d*d*28.)*vAlpha);}`});
fxLayer.add(new THREE.Points(sg,sm));

const wireMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.62,toneMapped:false});
const wireBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.9,5.8,4.6)),wireMat);wireBox.position.set(0,.25,-.30);root.add(wireBox);

// curved petal geometry for the final flower-rain phase
function petalGeometry(rows=12,cols=9){
  const pos=[],idx=[];
  for(let i=0;i<rows;i++){
    const u=i/(rows-1),w=Math.pow(Math.sin(Math.PI*Math.pow(u,.82)),.60)*(.54+.46*u);
    for(let j=0;j<cols;j++){
      const v=j/(cols-1)*2-1;pos.push(v*w*.48,(u-.43)*.92,(1-v*v)*.15+Math.sin(u*Math.PI)*.06-Math.pow(u,3)*.09);
    }
  }
  for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j,b=(i+1)*cols+j,c=(i+1)*cols+j+1,d=i*cols+j+1;idx.push(a,b,c,a,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const PETALS=1650;
const petalMat=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.40,clearcoat:.16,side:THREE.DoubleSide,transparent:true,opacity:.98});
const rain=new THREE.InstancedMesh(petalGeometry(),petalMat,PETALS);rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rain.frustumCulled=false;rain.visible=false;
const rainState=[],rq=new THREE.Quaternion(),rmx=new THREE.Matrix4(),rsc=new THREE.Vector3(),rc=new THREE.Color();
for(let i=0;i<PETALS;i++){
  const src=roseSpecs[Math.floor(Math.random()*roseSpecs.length)].p;
  const start=new THREE.Vector3(src[0]+randn()*.25,src[1]+randn()*.22,src[2]+randn()*.22);
  const vel=new THREE.Vector3(start.x*.55+randn()*.72,rand(.30,1.25),start.z*.35+randn()*.90).normalize().multiplyScalar(rand(1.6,4.6));
  rainState.push({start,vel,rot:new THREE.Euler(rand(0,6),rand(0,6),rand(0,6)),spin:new THREE.Vector3(rand(-4.5,4.5),rand(-4.2,4.2),rand(-5.2,5.2)),scale:rand(.075,.19),sway:rand(.3,1.1),phase:rand(0,Math.PI*2)});
  rc.set(Math.random()<.72?'#f7b1c5':Math.random()<.72?'#ffe1e8':'#fff0e7');rain.setColorAt(i,rc);
  rsc.setScalar(.0001);rmx.compose(start,rq,rsc);rain.setMatrixAt(i,rmx);
}
rain.instanceColor.needsUpdate=true;fxLayer.add(rain);

const codeLines=[
  `<span class="comment">// CC0 high-detail rose OBJ · no raster bouquet layer</span>`,
  `<span class="kw">const</span> roseMesh = <span class="kw">await</span> OBJLoader.loadAsync(<span class="str">'red_rose3.obj'</span>);`,
  `<span class="kw">const</span> bouquet = <span class="kw">new</span> THREE.Group();`,
  `<span class="comment">// real triangle petals stay visible; dust is atmosphere only</span>`,
  `<span class="kw">for</span> (<span class="kw">const</span> flower <span class="kw">of</span> layout) {`,
  `  bouquet.add(<span class="fn">cloneHighDetailRose</span>(flower));`,
  `  <span class="fn">sampleSurfaceDust</span>(flower.mesh);`,
  `}`,
  `<span class="kw">const</span> bloom = <span class="kw">new</span> UnrealBloomPass();`,
  `bloom.threshold = <span class="num">1.00</span>;`,
  `bloom.strength = <span class="num">0.26</span>;`,
  `<span class="comment">// no white wash · native-resolution geometry</span>`,
  `<span class="kw">const</span> target = <span class="str target">'故辞安'</span>;`,
  `<span class="fn">rotateTogether</span>(bouquet, wireframe);`,
  `<span class="fn">explodeBouquet</span>();`,
  `<span class="fn">releasePetalRain</span>(<span class="num">1650</span>);`,
  `<span class="fn">renderFor</span>(target);`
];
let cursor=0,nextLine=.4,codeCycle=-1;
function resetCode(){codeWindow.innerHTML='';cursor=0;nextLine=.4;terminalLine.textContent='loading high-detail rose mesh...';}
function updateCode(t,cy){if(cy!==codeCycle){codeCycle=cy;resetCode();}if(t>nextLine&&cursor<codeLines.length){const row=document.createElement('div');row.className='code-line';row.innerHTML=`<span class="ln">${132+cursor}</span><span>${codeLines[cursor]}</span>`;codeWindow.appendChild(row);while(codeWindow.children.length>22)codeWindow.removeChild(codeWindow.firstChild);cursor++;nextLine+=rand(.34,.58);if(cursor===codeLines.length)terminalLine.textContent='render loop active · mesh quality preserved';}}

function updateRain(e){
  if(e<=0){rain.visible=false;return;}rain.visible=true;const t=e*8.7;
  for(let i=0;i<PETALS;i++){
    const st=rainState[i],p=st.start.clone().addScaledVector(st.vel,t*.56);p.y-=0.5*.72*t*t;p.x+=Math.sin(t*1.05+st.phase)*st.sway*.22;p.z+=Math.cos(t*.84+st.phase)*st.sway*.16;
    rq.setFromEuler(new THREE.Euler(st.rot.x+st.spin.x*t,st.rot.y+st.spin.y*t,st.rot.z+st.spin.z*t));const grow=smoothstep(0,.10,e),fade=1-smoothstep(.83,1,e),sc=st.scale*grow*(.72+.28*fade);rsc.set(sc,sc*(.90+Math.sin(st.phase)*.08),sc);rmx.compose(p,rq,rsc);rain.setMatrixAt(i,rmx);
  }
  rain.instanceMatrix.needsUpdate=true;petalMat.opacity=.98*(1-smoothstep(.83,1,e));
}

const clock=new THREE.Clock(),CYCLE=42;let lastCycle=-1;
function animate(){
  requestAnimationFrame(animate);
  const elapsed=clock.getElapsedTime(),cy=Math.floor(elapsed/CYCLE),t=elapsed%CYCLE;
  if(cy!==lastCycle){lastCycle=cy;codeStage.classList.remove('fade-out');finalMessage.classList.remove('show');hint.style.opacity='1';}
  updateCode(t,cy);
  const morph=smoothstep(1.6,11.6,t),reveal=smoothstep(3.4,12.2,t),spark=smoothstep(6.0,13.5,t)*(1-smoothstep(29,34,t)),explode=smoothstep(26.2,33.8,t);
  pm.uniforms.uTime.value=elapsed;pm.uniforms.uMorph.value=morph;pm.uniforms.uExplode.value=explode;sm.uniforms.uTime.value=elapsed;sm.uniforms.uVis.value=spark;
  for(const rose of roses){
    const i=rose.userData.index,appear=smoothstep(i*.035,.52+i*.035,reveal),e=smoothstep(.02+i*.003,.64+i*.002,explode),base=rose.userData.basePos;
    rose.position.copy(base).addScaledVector(rose.userData.velocity,e*e*2.1);rose.position.y-=e*e*e*.8;
    rose.rotation.set(rose.userData.baseRot.x+rose.userData.spin.x*e*1.1,rose.userData.baseRot.y+rose.userData.spin.y*e*1.1,rose.userData.baseRot.z+rose.userData.spin.z*e*1.1);
    const sc=rose.userData.baseScale*Math.max(.001,appear)*(1-smoothstep(.50,.94,e));rose.scale.setScalar(sc);rose.material.opacity=appear*(1-smoothstep(.45,.91,e));
  }
  stemLayer.visible=explode<.66;filler.material.opacity=1-smoothstep(.35,.90,explode);filler.visible=filler.material.opacity>.02;updateRain(explode);
  root.rotation.y=Math.sin(elapsed*.22)*.13+elapsed*.023;root.rotation.x=Math.sin(elapsed*.17)*.022;wireMat.opacity=.62*(1-smoothstep(.72,1,explode));
  if(t>31)codeStage.classList.add('fade-out');if(t>35.8){finalMessage.classList.add('show');hint.style.opacity='0';}
  composer.render();
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));renderer.setSize(window.innerWidth,window.innerHeight,false);composer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));composer.setSize(window.innerWidth,window.innerHeight);pm.uniforms.uPixelRatio.value=Math.min(window.devicePixelRatio||1,2.5);sm.uniforms.uPixelRatio.value=Math.min(window.devicePixelRatio||1,2.5);
});
