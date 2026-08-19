import math
import random
import sys
import time
import numpy as np
import pygame

pygame.init()
pygame.font.init()

INFO = pygame.display.Info()
W = max(1280, INFO.current_w)
H = max(720, INFO.current_h)
FPS = 60
screen = pygame.display.set_mode((W, H), pygame.FULLSCREEN | pygame.DOUBLEBUF)
pygame.display.set_caption("to 故辞安")
clock = pygame.time.Clock()

BG = (1, 1, 2)
EDITOR_W = int(W * 0.37)
VIEW_CENTER = np.array([W * 0.70, H * 0.50], dtype=np.float32)

T_INTRO = 1.0
T_GROW = 13.0
T_SHOW = 10.0
T_FINAL = 7.0
TOTAL = T_INTRO + T_GROW + T_SHOW + T_FINAL

def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))

def smooth(v):
    v = clamp(v)
    return v*v*(3-2*v)

def ease_out(v):
    v = clamp(v)
    return 1-(1-v)**5

def find_font(names, size, bold=False):
    for n in names:
        p = pygame.font.match_font(n, bold=bold)
        if p:
            return pygame.font.Font(p, size)
    return pygame.font.Font(None, size)

code_font = find_font(["Consolas", "Cascadia Mono", "Courier New", "Arial"], max(14, int(H*0.020)))
small_font = find_font(["Consolas", "Arial"], max(12, int(H*0.016)))
title_font = find_font(["Microsoft YaHei", "SimHei", "Noto Sans CJK SC", "Arial Unicode MS"], max(48, int(H*0.07)), True)

CODE_LINES = [
("selector",".banner .content {"),
("prop","    position: relative;"),
("prop","    width: 100%;"),
("prop","    height: 100vh;"),
("prop","    overflow: hidden;"),
("selector","}"),
("blank",""),
("selector",".banner .content h1 {"),
("prop","    margin: 0;"),
("prop","    padding: 0;"),
("prop","    font-size: 3.5em;"),
("prop","    text-transform: uppercase;"),
("prop","    color: #d1d0f0;"),
("selector","}"),
("blank",""),
("selector","h1::after {"),
("prop","    content: '';"),
("prop","    position: absolute;"),
("prop","    top: 0;"),
("prop","    left: 0;"),
("prop","    color: transparent;"),
("prop","    background-image: linear-gradient("),
("prop","        to right, #c23616, #192a56,"),
("prop","        #00d2d3, yellow, #6d214f,"),
("prop","        #2e86de, #4cd137, #e84118);"),
("prop","    background-clip: text;"),
("prop","    -webkit-background-clip: text;"),
("prop","    clip-path: circle(100px at 0% 50%);"),
("prop","    animation: move 5s infinite;"),
("selector","}"),
("blank",""),
("selector","@keyframes move {"),
("prop","    0% { clip-path: circle(100px at 0% 50%); }"),
("prop","   50% { clip-path: circle(100px at 100% 50%); }"),
("prop","  100% { clip-path: circle(100px at 0% 50%); }"),
("selector","}"),
("blank",""),
("comment","// point cloud bouquet"),
("code","const scene = new THREE.Scene();"),
("code","const bouquet = new ParticleBouquet(48000);"),
("code","bouquet.material = 'red-white-pointcloud';"),
("code","bouquet.grow();"),
("code","renderer.render(scene, camera);"),
]

rng = np.random.default_rng(20260214)

def rotate_yz(points, ay, ax):
    cy, sy = math.cos(ay), math.sin(ay)
    cx, sx = math.cos(ax), math.sin(ax)
    p = points.copy()
    x = p[:,0]*cy + p[:,2]*sy
    z = -p[:,0]*sy + p[:,2]*cy
    y = p[:,1]
    y2 = y*cx - z*sx
    z2 = y*sx + z*cx
    return np.column_stack([x,y2,z2]).astype(np.float32)

def make_flower(center, scale, theme, count=3600, seed=0):
    rr = np.random.default_rng(1000+seed)
    ring = rr.integers(0, 5, count)
    petal_num = np.array([6,8,10,12,14])[ring]
    base_ang = rr.integers(0, petal_num) * (2*np.pi/petal_num)
    base_ang += ring * 0.42
    s = np.sqrt(rr.random(count))
    cross = rr.uniform(-1,1,count)
    ring_r = np.array([10,18,27,38,49], dtype=np.float32)[ring]
    plen = np.array([17,24,31,38,45], dtype=np.float32)[ring]
    pwidth = np.array([8,10,13,16,20], dtype=np.float32)[ring]
    radial = ring_r + s*plen
    width = cross * pwidth * np.sin(np.pi*s) * (0.55+0.45*s)
    ang = base_ang + width/(radial+1)*0.48
    x = radial*np.cos(ang)
    y = radial*np.sin(ang)*0.86
    z = 33 - ring*7 - 0.22*radial + 12*(1-s) + 9*np.sin(np.pi*s)
    z += 5*np.cos(cross*np.pi)*s
    x += rr.normal(0,1.0,count)
    y += rr.normal(0,1.0,count)
    z += rr.normal(0,1.0,count)
    pts = np.stack([x,y,z],1).astype(np.float32)*scale
    pts = rotate_yz(pts, rr.uniform(-0.35,0.35), rr.uniform(-0.25,0.25))
    pts += np.array(center, dtype=np.float32)
    cols = np.zeros((count,3), dtype=np.uint8)
    if theme == "red":
        cols[:,0] = rr.integers(215,256,count)
        cols[:,1] = rr.integers(28,95,count)
        cols[:,2] = rr.integers(48,112,count)
    elif theme == "white":
        v = rr.integers(205,256,count)
        cols[:,0] = v
        cols[:,1] = np.clip(v + rr.integers(-18,10,count), 185,255)
        cols[:,2] = np.clip(v + rr.integers(-12,18,count), 190,255)
        idx = rr.random(count)<0.13
        cols[idx] = np.column_stack([rr.integers(240,256,idx.sum()),rr.integers(110,185,idx.sum()),rr.integers(130,200,idx.sum())])
    else:
        cols[:,0] = rr.integers(225,256,count)
        cols[:,1] = rr.integers(110,195,count)
        cols[:,2] = rr.integers(128,205,count)
    return pts, cols

def make_stem(start, end, count, color=(218,210,186), jitter=2.4, seed=0):
    rr = np.random.default_rng(2000+seed)
    t = rr.random(count)
    a = np.array(start, dtype=np.float32)
    b = np.array(end, dtype=np.float32)
    pts = a[None,:]*(1-t[:,None]) + b[None,:]*t[:,None]
    pts += rr.normal(0,jitter,(count,3))
    cols = np.tile(np.array(color,dtype=np.uint8),(count,1))
    return pts.astype(np.float32), cols

def make_cloud(center, radius, count, tone="white", seed=0):
    rr = np.random.default_rng(3000+seed)
    d = rr.normal(size=(count,3))
    d /= np.linalg.norm(d,axis=1,keepdims=True)+1e-6
    r = radius * np.power(rr.random(count), 1/3)
    pts = d*r[:,None] + np.array(center, dtype=np.float32)
    cols = np.zeros((count,3),dtype=np.uint8)
    if tone=="white":
        v = rr.integers(190,255,count)
        cols[:] = np.column_stack([v,v,np.clip(v+rr.integers(-10,18,count),180,255)])
    else:
        cols[:,0]=rr.integers(170,235,count)
        cols[:,1]=rr.integers(130,205,count)
        cols[:,2]=rr.integers(70,135,count)
    return pts.astype(np.float32), cols

def make_wrapper(count=4500):
    rr = np.random.default_rng(4444)
    y = rr.uniform(105,300,count)
    k = (y-105)/(300-105)
    half = 62 + 85*k
    x = rr.uniform(-1,1,count)*half
    z = rr.uniform(-1,1,count)*(18+24*k)
    pts = np.column_stack([x,y,z]).astype(np.float32)
    pts[:,1] += 62
    pts[:,2] -= 6
    cols = np.zeros((count,3),dtype=np.uint8)
    redmask = rr.random(count)<0.34
    cols[~redmask] = np.column_stack([rr.integers(185,240,(~redmask).sum()),rr.integers(180,232,(~redmask).sum()),rr.integers(160,215,(~redmask).sum())])
    cols[redmask] = np.column_stack([rr.integers(175,245,redmask.sum()),rr.integers(30,75,redmask.sum()),rr.integers(45,95,redmask.sum())])
    return pts, cols

def build_bouquet():
    pieces=[]; colors=[]
    flowers = [
        ((-105,-115,8),1.02,"red"),((-30,-142,15),1.15,"white"),((55,-122,-15),1.10,"red"),
        ((120,-72,5),0.96,"white"),((-88,-45,-20),0.97,"white"),((-5,-48,20),1.08,"pink"),
        ((80,-35,12),0.94,"red"),((145,-8,-22),0.80,"white"),((-145,-5,16),0.78,"red"),((25,12,-10),0.86,"white")]
    for i,(c,s,tone) in enumerate(flowers):
        p,c0 = make_flower(c,s,tone, count=3300 if i<7 else 2500, seed=i)
        pieces.append(p); colors.append(c0)
    base = np.array([0,250,0],dtype=np.float32)
    for i,(c,s,tone) in enumerate(flowers):
        top=np.array(c,dtype=np.float32)+np.array([0,30,0],dtype=np.float32)
        p,c0 = make_stem(top, base+np.array([rng.uniform(-20,20),rng.uniform(-25,25),rng.uniform(-10,10)]), 650, seed=i)
        pieces.append(p); colors.append(c0)
    clouds = [((-170,-65,5),58,1800,"white"),((165,-55,-5),65,1900,"white"),((-130,25,-10),58,1600,"gold"),((120,30,6),60,1700,"gold"),((0,-180,-5),50,1500,"white")]
    for i,(c,r,n,tone) in enumerate(clouds):
        p,c0=make_cloud(c,r,n,tone,i); pieces.append(p); colors.append(c0)
    p,c0=make_wrapper(4600); pieces.append(p); colors.append(c0)
    pts=np.concatenate(pieces,axis=0); cols=np.concatenate(colors,axis=0)
    pts[:,1] -= 25
    return pts.astype(np.float32), cols

TARGET3D, COLORS = build_bouquet()
N=len(TARGET3D)
START3D = np.empty_like(TARGET3D)
left_mask = rng.random(N)<0.56
START3D[left_mask,0] = rng.uniform(-620,-250,left_mask.sum())
START3D[~left_mask,0] = rng.uniform(-520,520,(~left_mask).sum())
START3D[:,1] = rng.uniform(-380,380,N)
START3D[:,2] = rng.uniform(-520,520,N)
PHASE = rng.uniform(0,2*np.pi,N).astype(np.float32)

CUBE = np.array([[-235,-235,-190],[235,-235,-190],[235,265,-190],[-235,265,-190],[-235,-235,190],[235,-235,190],[235,265,190],[-235,265,190]],dtype=np.float32)
EDGES=[(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]

def project(points3d, ay, ax=-0.08, zoom=1.0):
    cy,sy=math.cos(ay),math.sin(ay); cx,sx=math.cos(ax),math.sin(ax)
    x=points3d[:,0]*cy + points3d[:,2]*sy
    z=-points3d[:,0]*sy + points3d[:,2]*cy
    y=points3d[:,1]
    y2=y*cx-z*sx; z2=y*sx+z*cx
    depth=np.maximum(950+z2,250); persp=950/depth
    scale=min(W/1600,H/900)*1.05*zoom
    return VIEW_CENTER[0]+x*persp*scale, VIEW_CENTER[1]+y2*persp*scale, z2, persp

particle_surface=pygame.Surface((W,H)); glow_surface=pygame.Surface((W,H),pygame.SRCALPHA)

def draw_points(points, ay, fade=1.0, zoom=1.0):
    particle_surface.fill((0,0,0)); glow_surface.fill((0,0,0,0))
    xs,ys,zs,persp=project(points,ay,zoom=zoom)
    xi=xs.astype(np.int32); yi=ys.astype(np.int32)
    mask=(xi>=0)&(xi<W)&(yi>=0)&(yi<H); idx=np.nonzero(mask)[0]
    arr=pygame.surfarray.pixels3d(particle_surface)
    boost=np.clip(0.72+0.40*np.clip((persp[idx]-0.72)/0.42,0,1),0,1.2)*fade
    c=np.clip(COLORS[idx].astype(np.float32)*boost[:,None],0,255).astype(np.uint8)
    arr[xi[idx],yi[idx]]=c
    near=idx[persp[idx]>1.05]
    if len(near):
        nx=xi[near]; ny=yi[near]; nc=np.clip(COLORS[near].astype(np.float32)*fade*1.07,0,255).astype(np.uint8)
        arr[nx,ny]=nc; arr[np.clip(nx+1,0,W-1),ny]=nc; arr[nx,np.clip(ny+1,0,H-1)]=nc
    del arr
    screen.blit(particle_surface,(0,0),special_flags=pygame.BLEND_RGB_ADD)
    for i in idx[::130]:
        col=COLORS[i]; pygame.draw.circle(glow_surface,(int(col[0]),int(col[1]),int(col[2]),24),(int(xs[i]),int(ys[i])),5)
    screen.blit(glow_surface,(0,0),special_flags=pygame.BLEND_RGBA_ADD)

def draw_cube(ay, fade=1.0, zoom=1.0):
    xs,ys,_,_=project(CUBE,ay,zoom=zoom); pts=[(int(xs[i]),int(ys[i])) for i in range(8)]
    v=int(185*fade)
    for a,b in EDGES: pygame.draw.line(screen,(v,v,v),pts[a],pts[b],1)
    pygame.draw.line(screen,(225,225,225),pts[3],pts[7],2)

def draw_editor(t, fade=1.0):
    overlay=pygame.Surface((EDITOR_W,H),pygame.SRCALPHA); overlay.fill((5,7,9,int(235*fade)))
    pygame.draw.line(overlay,(20,25,29,int(255*fade)),(EDITOR_W-1,0),(EDITOR_W-1,H),1)
    pygame.draw.rect(overlay,(8,11,14,int(255*fade)),(0,0,48,H))
    for y in [90,150,210,270,330,390]: pygame.draw.circle(overlay,(150,158,165,int(210*fade)),(24,y),8,1)
    line_h=code_font.get_linesize()+2; total_h=len(CODE_LINES)*line_h
    scroll=max(0,(t-1.2)*21); start_y=35-int(scroll%total_h)
    lines=CODE_LINES*3; y=start_y; num=41+int(scroll/line_h)
    for kind,text in lines:
        if y>H+line_h: break
        if y>-line_h:
            n=small_font.render(str(num),True,(55,64,70)); n.set_alpha(int(220*fade)); overlay.blit(n,(58,y+2))
            color=(215,218,220) if kind=="selector" else (185,190,194) if kind=="prop" else (90,135,96) if kind=="comment" else (195,205,214)
            if text:
                s=code_font.render(text,True,color); s.set_alpha(int(255*fade)); overlay.blit(s,(94,y))
        y+=line_h; num+=1
    pygame.draw.rect(overlay,(14,18,22,int(95*fade)),(48,int(H*0.52),EDITOR_W-48,line_h))
    screen.blit(overlay,(0,0))

def draw_final(alpha):
    alpha=clamp(alpha); surf=title_font.render("to 故辞安",True,(255,244,247)); glow=title_font.render("to 故辞安",True,(255,92,128))
    glow.set_alpha(int(85*alpha)); surf.set_alpha(int(255*alpha)); center=(int(W*0.70),int(H*0.84))
    for dx,dy in [(-3,0),(3,0),(0,-3),(0,3)]: screen.blit(glow,glow.get_rect(center=(center[0]+dx,center[1]+dy)))
    screen.blit(surf,surf.get_rect(center=center))

start=time.perf_counter(); running=True
while running:
    dt=min(0.035,clock.tick(FPS)/1000.0); t=time.perf_counter()-start
    for e in pygame.event.get():
        if e.type==pygame.QUIT: running=False
        elif e.type==pygame.KEYDOWN:
            if e.key in (pygame.K_ESCAPE,pygame.K_q): running=False
            elif e.key==pygame.K_SPACE: start=time.perf_counter()
    screen.fill(BG)
    t1=T_INTRO; t2=t1+T_GROW; t3=t2+T_SHOW
    editor_fade=1.0
    if t>t3: editor_fade=1.0-smooth((t-t3)/2.2)
    if editor_fade>0.01: draw_editor(t,editor_fade)
    ay=0.08+0.10*math.sin(t*0.22); zoom=1.0+0.025*math.sin(t*0.36)
    if t<t1:
        draw_cube(ay,0.65,zoom)
    elif t<t2:
        p=ease_out((t-t1)/T_GROW); cur=START3D*(1-p)+TARGET3D*p; swirl=(1-p)
        cur[:,0]+=np.sin(PHASE+t*1.7)*(62*swirl); cur[:,1]+=np.cos(PHASE*1.23+t*1.2)*(48*swirl); cur[:,2]+=np.sin(PHASE*0.77+t*1.05)*(70*swirl)
        draw_cube(ay,0.82,zoom); draw_points(cur,ay,1.0,zoom)
    else:
        formed=TARGET3D.copy(); formed[:,2]+=0.8*np.sin(PHASE+t*1.8)
        bouquet_fade=1.0
        if t>t3: bouquet_fade=1.0-0.22*smooth((t-t3)/2.6)
        draw_cube(ay,0.88,zoom); draw_points(formed,ay,bouquet_fade,zoom)
    if t>t3: draw_final(smooth((t-t3)/1.8))
    if t>TOTAL: start=time.perf_counter()
    pygame.display.flip()
pygame.quit(); sys.exit()
