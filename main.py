import math
import random
import sys
import time
import numpy as np
import pygame

pygame.init(); pygame.font.init()
INFO=pygame.display.Info(); W=max(1280,INFO.current_w); H=max(720,INFO.current_h); FPS=50
screen=pygame.display.set_mode((W,H),pygame.FULLSCREEN|pygame.DOUBLEBUF); pygame.display.set_caption('to 故辞安'); clock=pygame.time.Clock()
BG=(2,3,5); LEFT_BG=(4,6,9); DIVIDER=(26,29,34); LINE_NO=(60,66,74); CODE=(205,211,219); CODE_DIM=(128,138,151); CODE_ACCENT=(224,135,160); CODE_BLUE=(105,173,214); CODE_GREEN=(133,187,132); WIRE=(196,200,205); WHITE=(255,247,244)
LEFT_W=int(W*.38); RIGHT_X=LEFT_W; RIGHT_W=W-LEFT_W; VIEW_CENTER=np.array([RIGHT_X+RIGHT_W*.52,H*.49],dtype=np.float32)
T_FORM_START=1.8; T_FORM_END=10.5; T_HOLD_END=24.0; T_FINAL_END=33.0
rng=np.random.default_rng(20260819); random.seed(20260819)

def ff(names,size,bold=False):
    for n in names:
        p=pygame.font.match_font(n,bold=bold)
        if p:return pygame.font.Font(p,size)
    return pygame.font.Font(None,size)
code_font=ff(['Consolas','Cascadia Mono','Courier New','Microsoft YaHei'],max(15,int(H*.020)))
small_font=ff(['Consolas','Microsoft YaHei','Arial'],max(12,int(H*.016)))
title_font=ff(['Microsoft YaHei','SimHei','Noto Sans CJK SC','Arial Unicode MS'],max(46,int(H*.066)),True)
SOURCE=[
('comment','/* particle-bouquet.css */'),('plain','.banner .content {'),('plain','    display: grid;'),('plain','    grid-template-columns: 38% 62%;'),('plain','    margin: 0;'),('plain','    padding: 0;'),('plain','    background: #020305;'),('plain','    overflow: hidden;'),('plain','}'),('blank',''),
('accent','.bouquet::before {'),('plain',"    content: '';"),('plain','    position: absolute;'),('plain','    inset: 0;'),('blue','    mix-blend-mode: screen;'),('plain','    opacity: .92;'),('plain','}'),('blank',''),
('comment','/* create the point cloud */'),('plain','const scene = new Scene();'),('plain','const box = new WireframeCube(320);'),('plain','const bouquet = new ParticleBouquet({'),('accent','    roses: 10,'),('accent','    fillers: 28,'),('accent','    particles: 52000,'),('plain',"    palette: ['rose','ivory','gold']"),('plain','});'),('blank',''),
('plain','scene.add(box);'),('plain','scene.add(bouquet);'),('plain','bouquet.scatter();'),('blank',''),('green','for (const p of bouquet.particles) {'),('plain','    p.seek(p.target);'),('plain','    p.twinkle = random(.84, 1.0);'),('plain','}'),('blank',''),
('comment','// compile petal surfaces'),('plain','rose.petals.forEach((petal, i) => {'),('plain','    petal.curl = curve(i * 0.18);'),('plain','    petal.open = smoothstep(time);'),('plain','});'),('blank',''),('comment',"// filler / baby's-breath particles"),('plain','filler.density = 0.74;'),('plain',"filler.color = '#fff3e8';"),('plain','filler.noise = simplex3D;'),('blank',''),('blue','camera.orbit({ speed: 0.16 });'),('blue','renderer.setPixelRatio(devicePixelRatio);'),('plain','renderer.render(scene, camera);'),('blank',''),('comment','// keep rendering'),('green','requestAnimationFrame(render);'),('blank',''),('plain','function render(t) {'),('plain','    bouquet.rotateY(t * 0.00016);'),('plain','    bouquet.breathe(Math.sin(t*.0018));'),('plain','    box.follow(bouquet.rotation);'),('plain','    renderer.draw();'),('plain','}'),('blank',''),('comment','// final target'),('accent',"const target = '故辞安';"),('accent','renderFor(target);')]
TYPE_CPS=56.; LINE_DELAY=7

def sm(x):x=max(0.,min(1.,x));return x*x*(3-2*x)
def eo(x):x=max(0.,min(1.,x));return 1-(1-x)**4

def rose(center,scale=1.,base=(245,105,125),pale=.2,seed=1):
    rg=np.random.default_rng(seed); ps=[]; cs=[]
    rings=[(0,5,3,14,10,95),(1,7,7,18,13,110),(2,9,12,23,16,125),(3,12,18,28,20,135),(4,15,25,33,24,145)]
    for ring,npets,br,L,ww,npts in rings:
        off=rg.uniform(0,math.tau)
        for j in range(npets):
            a=off+j*math.tau/npets+rg.normal(0,.055); s=rg.random(npts); v=rg.uniform(-1,1,npts); wp=np.sin(np.pi*np.clip(s,0,1))**.72
            tang=v*ww*wp; radial=br+L*(.15+.85*s); curl=11*(1-s)**2-7*s+4.8*np.abs(v)**1.7*(s**1.5)+rg.normal(0,.65,npts)
            xx=radial*np.cos(a)-tang*np.sin(a); yy=radial*np.sin(a)+tang*np.cos(a); zz=curl+(4-ring)*2.2
            q=np.stack([xx,yy,zz],axis=1)*scale+np.array(center); ps.append(q.astype(np.float32))
            edge=np.clip(np.abs(v),0,1); tip=np.clip(s,0,1); wh=np.clip(pale+.38*edge+.16*tip,0,.78); b=np.array(base,dtype=np.float32); c=b[None,:]*(1-wh[:,None])+np.array([255,239,232],dtype=np.float32)[None,:]*wh[:,None]; c+=rg.normal(0,7,c.shape); cs.append(np.clip(c,0,255).astype(np.uint8))
    n=650; a=rg.uniform(0,math.tau,n); rad=rg.normal(39*scale,11*scale,n); zz=rg.normal(-2*scale,11*scale,n); haze=np.stack([rad*np.cos(a)+center[0],rad*np.sin(a)+center[1],zz+center[2]],axis=1).astype(np.float32); hc=np.tile(np.array([255,212,205],dtype=np.uint8),(n,1)); hc=np.clip(hc.astype(np.int16)+rg.integers(-25,26,size=hc.shape),0,255).astype(np.uint8); ps.append(haze);cs.append(hc)
    return np.concatenate(ps),np.concatenate(cs)

def filler(center,r=22,n=620,seed=1,tone='ivory'):
    rg=np.random.default_rng(seed); d=rg.normal(size=(n,3)); d/=np.linalg.norm(d,axis=1,keepdims=True)+1e-6; rr=r*np.power(rg.random(n),.58); p=d*rr[:,None]+np.array(center); p[:,2]*=.78; p[:,2]+=center[2]*.22
    b=np.array([228,214,171] if tone=='gold' else [245,158,166] if tone=='rose' else [246,241,224],dtype=np.float32); c=np.clip(b+rg.normal(0,13,(n,3)),110,255).astype(np.uint8); return p.astype(np.float32),c

def branch(start,end,n=700,seed=1,color=(210,206,184),fuzz=4.2):
    rg=np.random.default_rng(seed); t=rg.random(n); a=np.array(start,dtype=np.float32); b=np.array(end,dtype=np.float32); p=a[None,:]*(1-t[:,None])+b[None,:]*t[:,None]; p[:,0]+=np.sin(t*math.pi)*rg.normal(0,7,n); p[:,2]+=np.sin(t*math.pi)*rg.normal(0,5,n); p+=rg.normal(0,fuzz,(n,3)); base=np.array(color,dtype=np.float32); c=np.clip(base+rg.normal(0,15,(n,3)),50,255).astype(np.uint8); return p.astype(np.float32),c

def build():
    ps=[];cs=[]; blooms=[((-92,-105,5),.90,(235,92,111),.18),((-45,-118,-12),.98,(247,125,142),.24),((8,-118,8),1.02,(242,112,130),.20),((60,-108,-10),.92,(250,148,155),.30),((100,-82,14),.77,(235,92,108),.22),((-72,-58,-20),.86,(247,148,158),.34),((-15,-66,18),.92,(239,93,116),.20),((44,-55,24),.86,(250,154,164),.34),((83,-44,-18),.72,(236,112,129),.25),((-18,-20,-24),.76,(250,174,178),.40)]
    sd=10
    for ce,sc,co,pa in blooms:p,c=rose(ce,sc,co,pa,sd);sd+=1;ps.append(p);cs.append(c)
    fills=[(-118,-76,8,29,'ivory'),(-110,-28,-18,31,'ivory'),(-72,-18,30,30,'ivory'),(-35,-78,36,22,'ivory'),(15,-75,-34,26,'ivory'),(65,-76,36,25,'ivory'),(112,-52,-4,31,'ivory'),(102,-5,18,33,'ivory'),(55,0,-28,32,'ivory'),(4,8,40,35,'ivory'),(-48,10,-35,36,'ivory'),(-92,5,20,31,'ivory'),(-73,43,-12,26,'gold'),(-25,45,30,28,'gold'),(28,42,-25,28,'gold'),(75,40,20,25,'gold')]
    for i,(x,y,z,r,t) in enumerate(fills):p,c=filler((x,y,z),r,720,100+i,t);ps.append(p);cs.append(c)
    h=(0,190,0); ends=[(-110,-50,8),(-80,-85,-10),(-50,-30,20),(-15,-70,-25),(15,-62,25),(45,-38,-14),(85,-62,12),(108,-18,-8),(-75,20,17),(-25,32,-15),(30,30,22),(78,20,-18)]
    for i,e in enumerate(ends):p,c=branch(h,e,720,300+i,(210,205,183),3.7);ps.append(p);cs.append(c)
    for i,ce in enumerate([(-80,45,5),(-45,58,-20),(-5,55,18),(42,58,-20),(78,47,10),(0,80,-2)]):p,c=filler(ce,34,820,500+i,'ivory');ps.append(p);cs.append(c)
    rg=np.random.default_rng(777);n=5200;y=rg.uniform(95,245,n);f=(y-95)/150;r=58*(1-f)+22*f;a=rg.uniform(0,math.tau,n);x=np.cos(a)*r*rg.uniform(.2,1,n);z=np.sin(a)*r*rg.uniform(.2,1,n);x+=7*np.sin(y/27);p=np.stack([x,y,z],axis=1).astype(np.float32);c=np.zeros((n,3),dtype=np.uint8);c[:,0]=np.clip(rg.normal(164,35,n),70,235);c[:,1]=np.clip(rg.normal(55,20,n),20,115);c[:,2]=np.clip(rg.normal(73,27,n),25,145);m=rg.random(n)<.28;c[m]=np.clip(rg.normal([225,213,192],[18,18,20],(m.sum(),3)),80,255).astype(np.uint8);ps.append(p);cs.append(c)
    return np.concatenate(ps).astype(np.float32),np.concatenate(cs).astype(np.uint8)
TARGET,COLORS=build();N=len(TARGET);START=np.empty_like(TARGET);START[:,0]=rng.uniform(-175,175,N);START[:,1]=rng.uniform(-220,235,N);START[:,2]=rng.uniform(-165,165,N);PHASE=rng.uniform(0,math.tau,N).astype(np.float32);DELAY=rng.uniform(0,.50,N).astype(np.float32)

def rot(p,ay,ax=-.08):
    cy,sy=math.cos(ay),math.sin(ay);cx,sx=math.cos(ax),math.sin(ax);x=p[:,0];y=p[:,1];z=p[:,2];x1=x*cy+z*sy;z1=-x*sy+z*cy;y2=y*cx-z1*sx;z2=y*sx+z1*cx;return np.stack([x1,y2,z2],axis=1)
def proj(p,center,scale=1):d=np.maximum(780+p[:,2],210);q=780/d;return center[0]+p[:,0]*q*scale,center[1]+p[:,1]*q*scale,q
CUBE=np.array([[-180,-230,-175],[180,-230,-175],[180,245,-175],[-180,245,-175],[-180,-230,175],[180,-230,175],[180,245,175],[-180,245,175]],dtype=np.float32);EDGES=[(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
particle_surface=pygame.Surface((W,H));glow_surface=pygame.Surface((W,H),pygame.SRCALPHA)
def wire(angle,center,alpha=1,scale=1):
    q=rot(CUBE,angle);x,y,_=proj(q,center,min(W/1600,H/900)*1.14*scale);col=tuple(int(v*alpha) for v in WIRE)
    for a,b in EDGES:pygame.draw.aaline(screen,col,(int(x[a]),int(y[a])),(int(x[b]),int(y[b])))
def points(p,angle,center,alpha=1,scale=1):
    particle_surface.fill((0,0,0));glow_surface.fill((0,0,0,0));q=rot(p,angle);sc=min(W/1600,H/900)*1.14*scale;x,y,per=proj(q,center,sc);xi=x.astype(np.int32);yi=y.astype(np.int32);v=(xi>=LEFT_W+1)&(xi<W-2)&(yi>=1)&(yi<H-2);idx=np.nonzero(v)[0]
    if len(idx)==0:return
    arr=pygame.surfarray.pixels3d(particle_surface);dg=np.clip(.74+.38*np.clip((per[idx]-.72)/.48,0,1),0,1.25);tw=.92+.08*np.sin(PHASE[idx]+pygame.time.get_ticks()*.0021);g=np.clip(dg*tw*alpha,0,1.25);cc=np.clip(COLORS[idx].astype(np.float32)*g[:,None],0,255).astype(np.uint8);arr[xi[idx],yi[idx]]=cc;near=idx[per[idx]>1.04]
    if len(near):nx=xi[near];ny=yi[near];nc=np.clip(COLORS[near].astype(np.float32)*alpha*1.04,0,255).astype(np.uint8);arr[nx,ny]=nc;arr[np.clip(nx+1,0,W-1),ny]=nc
    del arr;screen.blit(particle_surface,(0,0),special_flags=pygame.BLEND_RGB_ADD)
    for i in idx[::260]:c=COLORS[i];pygame.draw.circle(glow_surface,(int(c[0]),int(c[1]),int(c[2]),int(18*alpha)),(int(x[i]),int(y[i])),4)
    screen.blit(glow_surface,(0,0),special_flags=pygame.BLEND_RGBA_ADD)

def typed(t):
    av=max(0,t)*TYPE_CPS;out=[];used=0;cy=sum(len(s)+LINE_DELAY for _,s in SOURCE);virt=SOURCE*max(2,int(av//cy)+2)
    for k,s in virt:
        if av>=used+len(s):out.append((k,s))
        else:
            r=int(av-used)
            if r>0:out.append((k,s[:r]))
            break
        used+=len(s)+LINE_DELAY
    return out

def editor(t,alpha=1):
    left=pygame.Surface((LEFT_W,H),pygame.SRCALPHA);left.fill((*LEFT_BG,int(255*alpha)));pygame.draw.line(left,(*DIVIDER,int(255*alpha)),(LEFT_W-1,0),(LEFT_W-1,H),1);rail=int(LEFT_W*.055);gutter=int(LEFT_W*.115);pygame.draw.rect(left,(6,8,11,int(255*alpha)),(0,0,rail,H))
    for yy in np.linspace(H*.16,H*.84,7):pygame.draw.circle(left,(82,88,96,int(190*alpha)),(rail//2,int(yy)),max(3,int(H*.006)),1)
    pygame.draw.line(left,(18,22,27,int(255*alpha)),(rail,0),(rail,H),1);ls=typed(t);lh=code_font.get_linesize()+2;top=int(H*.055);mx=max(5,(H-top-20)//lh);st=max(0,len(ls)-mx);ls=ls[st:];num=st+1;y=top;cm={'plain':CODE,'comment':CODE_DIM,'accent':CODE_ACCENT,'blue':CODE_BLUE,'green':CODE_GREEN,'blank':CODE}
    for k,s in ls:
        if k=='blank':y+=lh;num+=1;continue
        ln=small_font.render(f'{num:>3}',True,LINE_NO);ln.set_alpha(int(220*alpha));left.blit(ln,(gutter-ln.get_width()-10,y+2));sf=code_font.render(s,True,cm.get(k,CODE));sf.set_alpha(int(245*alpha));left.blit(sf,(gutter+10,y));y+=lh;num+=1
    if int(t*2)%2==0 and y<H-15:pygame.draw.rect(left,(220,224,230,int(200*alpha)),(gutter+10,y+2,8,lh-6))
    screen.blit(left,(0,0))
def final(alpha):
    a=max(0,min(1,alpha));txt=title_font.render('to 故辞安',True,WHITE);txt.set_alpha(int(255*a));gl=title_font.render('to 故辞安',True,(255,164,180));gl.set_alpha(int(48*a));cx=int(W*.5);cy=int(H*.87)
    for ox,oy in [(-3,0),(3,0),(0,-3),(0,3)]:screen.blit(gl,gl.get_rect(center=(cx+ox,cy+oy)))
    screen.blit(txt,txt.get_rect(center=(cx,cy)))
start=time.perf_counter();run=True
while run:
    clock.tick(FPS);t=time.perf_counter()-start
    for e in pygame.event.get():
        if e.type==pygame.QUIT:run=False
        elif e.type==pygame.KEYDOWN:
            if e.key in (pygame.K_ESCAPE,pygame.K_q):run=False
            elif e.key==pygame.K_SPACE:start=time.perf_counter()
    screen.fill(BG);fp=sm((t-T_HOLD_END)/3.2) if t>T_HOLD_END else 0.;ca=1-fp
    if ca>.01:editor(t,ca)
    center=VIEW_CENTER.copy();center[0]=VIEW_CENTER[0]*(1-fp)+W*.50*fp;center[1]=VIEW_CENTER[1]*(1-fp)+H*.46*fp;scale=1+.16*fp;form=0 if t<T_FORM_START else eo((t-T_FORM_START)/(T_FORM_END-T_FORM_START));angle=max(0,t-T_FORM_START)*.155;wa=.85*(1-.72*fp)
    if wa>.02:wire(angle,center,wa,scale)
    if form<1:
        local=np.clip((form-DELAY)/(1-DELAY+1e-5),0,1);local=local*local*(3-2*local);cur=START*(1-local[:,None])+TARGET*local[:,None];tb=1-local;cur[:,0]+=np.sin(PHASE+t*2.1)*(34*tb);cur[:,1]+=np.cos(PHASE*1.3+t*1.7)*(29*tb);cur[:,2]+=np.sin(PHASE*.73+t*1.2)*(39*tb)
    else:
        cur=TARGET.copy();b=1+.005*math.sin(t*1.8);cur[:,:2]*=b
    points(cur,angle,center,1,scale)
    if fp>.05:final(sm((fp-.05)/.72))
    pygame.display.flip()
    if t>T_FINAL_END:start=time.perf_counter()
pygame.quit();sys.exit()
