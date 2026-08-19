import math
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import pygame

# ============================================================
# Code Rose Confession
# 双击程序后：代码持续运行 -> 粒子玫瑰生成 -> 花瓣雨 -> to 故辞安
# ============================================================

pygame.mixer.pre_init(44100, -16, 2, 512)
pygame.init()
pygame.font.init()

# ---------- 基本配置 ----------
INFO = pygame.display.Info()
W = max(1280, INFO.current_w)
H = max(720, INFO.current_h)
FPS = 50

screen = pygame.display.set_mode((W, H), pygame.FULLSCREEN | pygame.DOUBLEBUF)
pygame.display.set_caption("to 故辞安")
clock = pygame.time.Clock()

# 颜色
BG = (3, 5, 12)
PANEL_BG = (7, 11, 21)
PANEL_BORDER = (35, 48, 70)
TEXT = (194, 218, 236)
DIM = (89, 110, 130)
GREEN = (94, 231, 145)
CYAN = (92, 210, 255)
PINK = (255, 84, 139)
WHITE = (255, 244, 248)
RED = (255, 42, 92)

# 时间轴
T_BOOT = 1.6
T_CODE = 11.5
T_BLOOM = 6.0
T_RAIN = 8.0
T_FINAL = 7.0
TOTAL = T_BOOT + T_CODE + T_BLOOM + T_RAIN + T_FINAL

# 面板
PANEL_X = int(W * 0.035)
PANEL_Y = int(H * 0.075)
PANEL_W = int(W * 0.43)
PANEL_H = int(H * 0.85)
ROSE_CENTER = np.array([W * 0.735, H * 0.50], dtype=np.float32)

# ---------- 字体 ----------
def find_font(names, size, bold=False):
    for name in names:
        p = pygame.font.match_font(name, bold=bold)
        if p:
            return pygame.font.Font(p, size)
    return pygame.font.Font(None, size)

code_font = find_font(
    ["Consolas", "Microsoft YaHei", "Noto Sans Mono CJK SC", "Arial"],
    max(15, int(H * 0.021))
)
small_font = find_font(
    ["Consolas", "Microsoft YaHei", "Arial"],
    max(13, int(H * 0.017))
)
title_font = find_font(
    ["Microsoft YaHei", "SimHei", "Noto Sans CJK SC", "Arial Unicode MS"],
    max(46, int(H * 0.068)), True
)

# ---------- 代码内容 ----------
CODE_LINES = [
    ("comment", "# valentine_render.py"),
    ("code",    "from universe import Particle, Rose, Memory"),
    ("code",    "from heart import heartbeat"),
    ("blank",   ""),
    ("code",    "scene = Universe(background='midnight')"),
    ("code",    "rose = Rose(particles=32768)"),
    ("code",    "rose.material = 'crystal_red'"),
    ("code",    "rose.glow = 0.86"),
    ("blank",   ""),
    ("code",    "for particle in rose.particles:"),
    ("code",    "    particle.seek(rose.surface)"),
    ("log",     "[render] locating every particle ..."),
    ("log",     "[render]  4096 / 32768"),
    ("log",     "[render] 12288 / 32768"),
    ("log",     "[render] 24576 / 32768"),
    ("log",     "[render] 32768 / 32768  OK"),
    ("blank",   ""),
    ("code",    "scene.add(rose)"),
    ("code",    "rose.bloom(duration=6.0)"),
    ("log",     "[shader] bloom pass compiled"),
    ("log",     "[camera] orbit enabled"),
    ("blank",   ""),
    ("code",    "petals = rose.release_petals(count=520)"),
    ("code",    "scene.add(petals)"),
    ("log",     "[physics] petal rain started"),
    ("log",     "[light] soft crimson glow: ON"),
    ("blank",   ""),
    ("code",    "target = '故辞安'"),
    ("code",    "scene.focus(target)"),
    ("log",     "[system] target locked"),
    ("blank",   ""),
    ("code",    "render_for(target)"),
]

TYPE_SPEED = 44.0
LINE_PAUSE = 0.18

# ---------- 粒子玫瑰 ----------
def build_rose_points(n_head=11500, n_stem=1700, n_leaf=1700):
    rng = np.random.default_rng(20260819)
    layers = np.array([0,1,2,3,4,5,6,7])
    probs = np.array([0.08,0.10,0.12,0.14,0.15,0.15,0.14,0.12])
    L = rng.choice(layers, size=n_head, p=probs)
    theta = rng.uniform(0, math.tau, n_head)
    u = np.sqrt(rng.random(n_head))

    base = 32 + L * 17
    petal_count = np.maximum(3, 10 - L)
    phase = L * 0.72
    ripple = 0.78 + 0.22 * np.cos(petal_count * theta + phase)
    r = base * u * ripple

    x = r * np.cos(theta)
    y = r * np.sin(theta) * 0.82
    z = (
        74 - L * 9
        - 0.22 * r
        + 12 * np.sin(petal_count * theta + phase) * (u ** 2)
        + rng.normal(0, 2.0, n_head)
    )

    inner = L <= 2
    x[inner] *= 0.70
    y[inner] *= 0.70
    z[inner] += (3 - L[inner]) * 12

    head = np.stack([x, y, z], axis=1).astype(np.float32)

    sy = rng.uniform(60, 390, n_stem)
    a = rng.uniform(0, math.tau, n_stem)
    rr = rng.uniform(0, 6.5, n_stem)
    sx = np.cos(a) * rr + 6 * np.sin(sy / 78)
    sz = np.sin(a) * rr
    stem = np.stack([sx, sy, sz], axis=1).astype(np.float32)

    def leaf(count, side, y0, spread):
        t = rng.random(count)
        s = rng.uniform(-1, 1, count)
        prof = np.sqrt(np.maximum(0, 1 - ((t - 0.5) / 0.5) ** 2))
        ly = y0 + (t - 0.5) * 145
        lx = side * (24 + 50 * prof * (0.2 + 0.8 * np.abs(s)))
        lx += side * (t - 0.5) * spread
        lz = s * 17 * prof
        return np.stack([lx, ly, lz], axis=1).astype(np.float32)

    leaf_a = leaf(n_leaf // 2, -1, 215, 95)
    leaf_b = leaf(n_leaf - n_leaf // 2, +1, 292, 84)

    pts = np.concatenate([head, stem, leaf_a, leaf_b], axis=0)
    pts[:, 1] -= 72

    colors = np.zeros((len(pts), 3), dtype=np.uint8)
    depth = L / 7.0
    colors[:n_head, 0] = np.clip(245 - depth * 45 + rng.normal(0, 6, n_head), 170, 255)
    colors[:n_head, 1] = np.clip(24 + (1-depth) * 24 + rng.normal(0, 4, n_head), 12, 80)
    colors[:n_head, 2] = np.clip(70 + (1-depth) * 55 + rng.normal(0, 7, n_head), 45, 150)
    hi = rng.choice(n_head, size=max(1, n_head//30), replace=False)
    colors[hi] = np.array([255, 174, 205], dtype=np.uint8)
    colors[n_head:n_head+n_stem] = np.array([44, 132, 78], dtype=np.uint8)
    colors[n_head+n_stem:] = np.array([56, 156, 92], dtype=np.uint8)

    return pts, colors, n_head

TARGET3D, COLORS, HEAD_END = build_rose_points()
N = len(TARGET3D)
rng = np.random.default_rng(42)

START3D = np.empty_like(TARGET3D)
START3D[:, 0] = rng.uniform(-420, 420, N)
START3D[:, 1] = rng.uniform(-330, 330, N)
START3D[:, 2] = rng.uniform(-360, 360, N)
PHASE = rng.uniform(0, math.tau, N).astype(np.float32)

# ---------- 花瓣雨 ----------
PETALS = []
for _ in range(520):
    depth = random.random()
    PETALS.append({
        "x": random.uniform(W*0.48, W*1.06),
        "y": random.uniform(-H*1.8, -10),
        "vx": random.uniform(-0.45, 0.45),
        "vy": random.uniform(0.75, 2.2) * (0.6 + depth),
        "size": random.uniform(2.5, 7.0) * (0.65 + depth),
        "phase": random.uniform(0, math.tau),
        "angle": random.uniform(0, math.tau),
        "spin": random.uniform(-0.05, 0.05),
    })

# ---------- 星空 ----------
STARS = []
for _ in range(260):
    STARS.append((
        random.randrange(0, W),
        random.randrange(0, H),
        random.choice([1,1,1,2]),
        random.uniform(0, math.tau),
        random.uniform(0.4, 1.4)
    ))

# ---------- 动画辅助 ----------
def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))

def smoothstep(v):
    v = clamp(v)
    return v*v*(3-2*v)

def ease_out(v):
    v = clamp(v)
    return 1-(1-v)**4

def project(points3d, angle_y, angle_x=-0.15, scale=1.0, zoom=1.0):
    cy, sy = math.cos(angle_y), math.sin(angle_y)
    cx, sx = math.cos(angle_x), math.sin(angle_x)

    x = points3d[:,0]
    y = points3d[:,1]
    z = points3d[:,2]

    x1 = x*cy + z*sy
    z1 = -x*sy + z*cy
    y2 = y*cx - z1*sx
    z2 = y*sx + z1*cx

    depth = 800 + z2
    depth = np.maximum(depth, 230)
    persp = 800 / depth

    sx2 = ROSE_CENTER[0] + x1*persp*scale*zoom
    sy2 = ROSE_CENTER[1] + y2*persp*scale*zoom
    return sx2, sy2, z2, persp

particle_surface = pygame.Surface((W, H))
glow_surface = pygame.Surface((W, H), pygame.SRCALPHA)

def draw_particles(points3d, angle, gather=1.0, fade=1.0, zoom=1.0):
    particle_surface.fill((0,0,0))
    glow_surface.fill((0,0,0,0))

    scale = min(W/1600.0, H/900.0) * 1.12
    xs, ys, zs, persp = project(points3d, angle, scale=scale, zoom=zoom)
    xi = xs.astype(np.int32)
    yi = ys.astype(np.int32)
    mask = (xi>=1)&(xi<W-1)&(yi>=1)&(yi<H-1)
    idx = np.nonzero(mask)[0]

    arr = pygame.surfarray.pixels3d(particle_surface)
    brightness = np.clip((0.76 + 0.33*np.clip((persp[idx]-0.7)/0.45,0,1))*fade, 0, 1.35)
    c = np.clip(COLORS[idx].astype(np.float32)*brightness[:,None], 0, 255).astype(np.uint8)
    arr[xi[idx], yi[idx]] = c

    near = idx[persp[idx] > 1.08]
    if len(near):
        nx = xi[near]; ny = yi[near]
        nc = np.clip(COLORS[near].astype(np.float32)*fade*1.10,0,255).astype(np.uint8)
        arr[nx, ny] = nc
        arr[np.clip(nx+1,0,W-1), ny] = nc
        arr[nx, np.clip(ny+1,0,H-1)] = nc
    del arr

    screen.blit(particle_surface, (0,0), special_flags=pygame.BLEND_RGB_ADD)

    sample = idx[::85]
    for i in sample:
        col = COLORS[i]
        pygame.draw.circle(
            glow_surface,
            (int(col[0]), int(col[1]), int(col[2]), int(34*fade)),
            (int(xs[i]), int(ys[i])),
            7 if persp[i] < 1.08 else 10
        )
    screen.blit(glow_surface, (0,0), special_flags=pygame.BLEND_RGBA_ADD)

def draw_stars(t, alpha=1.0):
    for x,y,r,p,s in STARS:
        tw = 0.45+0.55*math.sin(t*s*2.4+p)**2
        v = int((55+145*tw)*alpha)
        pygame.draw.circle(screen, (v,v,min(255,v+18)), (x,y), r)

def draw_petals(dt, intensity):
    for p in PETALS:
        p["phase"] += dt*(0.6+intensity)
        p["angle"] += p["spin"]*dt*60
        p["x"] += (p["vx"] + math.sin(p["phase"])*0.34)*dt*60
        p["y"] += p["vy"]*dt*60*(0.65+0.55*intensity)

        if p["y"] > H+30:
            p["y"] = random.uniform(-H*0.65, -10)
            p["x"] = random.uniform(W*0.48, W*1.05)

        s = p["size"]
        surf = pygame.Surface((max(8,int(s*5)), max(8,int(s*4))), pygame.SRCALPHA)
        rr = surf.get_rect()
        body = pygame.Rect(rr.w//4, rr.h//4, rr.w//2, rr.h//2)
        pygame.draw.ellipse(surf, (255,55,112,int(190*intensity)), body)
        core = body.inflate(-max(1,body.w//3), -max(1,body.h//3))
        pygame.draw.ellipse(surf, (255,145,178,int(95*intensity)), core)
        rot = pygame.transform.rotate(surf, math.degrees(p["angle"]))
        screen.blit(rot, rot.get_rect(center=(int(p["x"]),int(p["y"]))))

# ---------- 代码打字机 ----------
def build_typed_state(elapsed):
    available = max(0.0, elapsed - T_BOOT)
    chars_budget = int(available * TYPE_SPEED)
    lines = []
    used = 0

    for kind, text in CODE_LINES:
        cost = len(text) + int(TYPE_SPEED * LINE_PAUSE)
        if chars_budget >= used + len(text):
            lines.append((kind, text))
        else:
            remain = chars_budget - used
            if remain > 0:
                lines.append((kind, text[:remain]))
            break
        used += cost
    return lines

def draw_code_panel(t, fade=1.0):
    shadow = pygame.Surface((PANEL_W+20, PANEL_H+20), pygame.SRCALPHA)
    pygame.draw.rect(shadow, (0,0,0,int(120*fade)), shadow.get_rect(), border_radius=18)
    screen.blit(shadow, (PANEL_X-10, PANEL_Y-6))

    panel = pygame.Surface((PANEL_W, PANEL_H), pygame.SRCALPHA)
    pygame.draw.rect(panel, (*PANEL_BG, int(244*fade)), panel.get_rect(), border_radius=16)
    pygame.draw.rect(panel, (*PANEL_BORDER, int(230*fade)), panel.get_rect(), 1, border_radius=16)

    pygame.draw.rect(panel, (10,16,28,int(250*fade)), (0,0,PANEL_W,46), border_radius=16)
    pygame.draw.rect(panel, (10,16,28,int(250*fade)), (0,28,PANEL_W,18))
    for i,c in enumerate([(255,95,87),(255,189,46),(38,202,74)]):
        pygame.draw.circle(panel, c, (22+i*20,23), 6)
    title = small_font.render("valentine_render.py  —  running", True, (132,155,176))
    title.set_alpha(int(255*fade))
    panel.blit(title, (82, 13))

    typed = build_typed_state(t)
    line_h = code_font.get_linesize()+2
    visible_h = PANEL_H-72
    max_lines = max(1, visible_h//line_h)
    typed = typed[-max_lines:]

    y = 58
    for kind, text in typed:
        if kind == "comment":
            color = (99,131,152)
        elif kind == "log":
            color = GREEN
        elif kind == "blank":
            y += line_h
            continue
        else:
            color = TEXT

        surf = code_font.render(text, True, color)
        surf.set_alpha(int(255*fade))
        panel.blit(surf, (18, y))
        y += line_h

    if fade > 0.05 and int(t*2)%2 == 0:
        pygame.draw.rect(panel, (120,225,255,int(220*fade)), (18,y+2,9,line_h-6))

    screen.blit(panel, (PANEL_X,PANEL_Y))

def draw_final_text(alpha, pulse=1.0):
    alpha = clamp(alpha)
    text = "to 故辞安"

    base = title_font.render(text, True, WHITE)
    if abs(pulse-1.0)>0.001:
        base = pygame.transform.smoothscale(
            base,
            (max(1,int(base.get_width()*pulse)), max(1,int(base.get_height()*pulse)))
        )
    glow = title_font.render(text, True, (255,57,118))
    if abs(pulse-1.0)>0.001:
        glow = pygame.transform.smoothscale(
            glow,
            (max(1,int(glow.get_width()*pulse)), max(1,int(glow.get_height()*pulse)))
        )

    cx,cy = int(W*0.5), int(H*0.5)
    glow.set_alpha(int(90*alpha))
    for ox,oy in [(-5,0),(5,0),(0,-5),(0,5),(-3,-3),(3,3)]:
        screen.blit(glow, glow.get_rect(center=(cx+ox,cy+oy)))
    base.set_alpha(int(255*alpha))
    screen.blit(base, base.get_rect(center=(cx,cy)))

# ---------- 主循环 ----------
start_time = time.perf_counter()
running = True

while running:
    dt = min(0.035, clock.tick(FPS)/1000.0)
    t = time.perf_counter() - start_time

    for e in pygame.event.get():
        if e.type == pygame.QUIT:
            running = False
        elif e.type == pygame.KEYDOWN:
            if e.key in (pygame.K_ESCAPE, pygame.K_q):
                running = False
            elif e.key == pygame.K_SPACE:
                start_time = time.perf_counter()

    screen.fill(BG)
    draw_stars(t, 0.55 if t < T_BOOT else 0.90)

    t1 = T_BOOT
    t2 = t1 + T_CODE
    t3 = t2 + T_BLOOM
    t4 = t3 + T_RAIN

    halo = pygame.Surface((W,H), pygame.SRCALPHA)
    halo_power = 0.0 if t < t1 else smoothstep((t-t1)/4.0)
    if halo_power > 0:
        pygame.draw.circle(
            halo,
            (170,8,58,int(21*halo_power)),
            (int(ROSE_CENTER[0]),int(ROSE_CENTER[1]-20)),
            int(min(W,H)*0.31)
        )
        screen.blit(halo,(0,0),special_flags=pygame.BLEND_RGBA_ADD)

    code_fade = 1.0
    if t > t4:
        code_fade = 1.0 - smoothstep((t-t4)/2.4)
    if code_fade > 0.01:
        draw_code_panel(t, code_fade)

    if t > t1:
        if t < t2:
            p = ease_out((t-t1)/T_CODE)
            cur = START3D*(1-p) + TARGET3D*p
            turb = (1-p)
            cur[:,0] += np.sin(PHASE+t*1.8)*(48*turb)
            cur[:,1] += np.cos(PHASE*1.2+t*1.5)*(35*turb)
            cur[:,2] += np.sin(PHASE*0.7+t*1.1)*(55*turb)
            draw_particles(cur, angle=t*0.10, gather=p, fade=1.0, zoom=0.96+0.04*p)
        else:
            q = t-t2
            rose = TARGET3D.copy()
            breathe = 1+0.010*math.sin(q*1.7)
            rose[:HEAD_END,:2] *= breathe

            zoom = 1.0
            if t > t3:
                zoom = 1.0 + 0.12*smoothstep((t-t3)/T_RAIN)

            rose_fade = 1.0
            if t > t4:
                rose_fade = 1.0 - smoothstep((t-t4)/3.1)

            if rose_fade > 0.015:
                draw_particles(rose, angle=q*0.27, fade=rose_fade, zoom=zoom)

    if t > t3:
        rain_p = smoothstep((t-t3)/1.8)
        rain_fade = 1.0
        if t > t4:
            rain_fade = 1.0 - smoothstep((t-t4)/3.2)
        if rain_fade > 0.02:
            draw_petals(dt, rain_p*rain_fade)

    if t > t4:
        p = smoothstep((t-t4)/2.0)
        pulse = 0.96 + 0.04*p + 0.008*math.sin((t-t4)*1.7)
        draw_final_text(p, pulse)

    if t > TOTAL:
        start_time = time.perf_counter()

    pygame.display.flip()

pygame.quit()
