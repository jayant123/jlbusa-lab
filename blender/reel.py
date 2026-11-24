"""Concept reel frames. blender -b -P blender/reel.py -- --brand ostrel --aspect wide|tall --out build/reel-ostrel-wide [--samples 32] [--frames 1-480]

OSTREL storyboard (24 fps, 20 s = 480 frames):
  0-3 s   darkness, a light sweeps across the bezel, slow push-in
  3-9 s   the watch opens: crystal, bezel, hands, dial lift in sequence while the camera swings to the side
  9-13 s  macro on the movement: balance oscillating, escape wheel stepping
  13-17 s reassembly, camera returns to the hero angle
  17-20 s hold, fade to black (end card text is added by tools/make_reel.sh)
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import ostrel_watch as W  # noqa: E402
import plintha_set as PS  # noqa: E402
from stills import EXPLODE, area, ostrel_render_materials  # noqa: E402

# PLINTHA storyboard (24 fps, 20 s): an empty sunlit gallery, the modules drop onto their plinths one by one,
# a low glide along the plinths and the fabric, then the light turns to evening. End card from 18.2 s.

FPS, N = 24, 480
ORDER = ['crystal', 'bezel', 'hands_second', 'hands_minute', 'hands_hour', 'dial', 'balance_wheel', 'gear_train', 'escape_wheel']


def ease(x):
    x = min(1, max(0, x))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def progress(f):
    if f < 72:
        return 0.0
    if f < 216:
        return ease((f - 72) / 144)
    if f < 312:
        return 1.0
    if f < 408:
        return 1 - ease((f - 312) / 96)
    return 0.0


def part_offset(k, p):
    i = ORDER.index(k) if k in ORDER else -1
    d = 0.25 if i < 0 else i * 0.045
    return EXPLODE.get(k, 0) * ease(min(1, max(0, (p - d) / (1 - d - 0.12))))


CAM = [  # frame, location, target, lens
    (0, (0.0, -0.090, 0.110), (0, 0.0, 0.004), 95),
    (72, (0.035, -0.125, 0.150), (0, -0.004, 0.003), 80),
    (216, (0.150, -0.160, 0.085), (0, 0, 0.012), 80),
    (250, (0.022, -0.055, 0.060), (-0.003, -0.003, 0.004), 85),
    (312, (0.016, -0.048, 0.052), (-0.004, -0.004, 0.004), 85),
    (408, (0.035, -0.125, 0.150), (0, -0.004, 0.003), 80),
    (480, (0.028, -0.110, 0.135), (0, -0.004, 0.003), 80),
]


def cam_at(f):
    for (f0, p0, t0, l0), (f1, p1, t1, l1) in zip(CAM, CAM[1:]):
        if f <= f1:
            k = ease((f - f0) / (f1 - f0))
            lerp = lambda a, b: tuple(x + (y - x) * k for x, y in zip(a, b))
            return lerp(p0, p1), lerp(t0, t1), l0 + (l1 - l0) * k
    return CAM[-1][1], CAM[-1][2], CAM[-1][3]


def setup(aspect, samples):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    ee = s.eevee
    for k, v in (('taa_render_samples', samples), ('use_raytracing', True), ('use_shadows', True)):
        try:
            setattr(ee, k, v)
        except Exception:
            pass
    s.render.resolution_x, s.render.resolution_y = (1920, 1080) if aspect == 'wide' else (1080, 1920)
    s.render.fps = FPS
    s.frame_start, s.frame_end = 0, N - 1
    s.render.image_settings.file_format = 'PNG'
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.004, 0.005, 1)
    s.world = world


def ostrel(aspect, out, samples, frames):
    C.reset()
    parts = W.build('high')
    for k in ('bracelet_top', 'bracelet_bottom'):
        parts[k].hide_render = True
    ostrel_render_materials()
    # EEVEE renders the refractive crystal as dark glass. Use reflection-only glass, as the web scene does.
    gm = bpy.data.materials['glass_crystal']
    gp = gm.node_tree.nodes['Principled BSDF']
    C.set_input(gp, ['Transmission Weight', 'Transmission'], 0.0)
    C.set_input(gp, 'Alpha', 0.06)
    C.set_input(gp, 'Roughness', 0.02)
    C.set_input(gp, ['Coat Weight', 'Clearcoat'], 1.0)
    C.set_input(gp, 'Base Color', (1, 1, 1, 1))
    try:
        gm.surface_render_method = 'BLENDED'
    except Exception:
        gm.blend_method = 'BLEND'
    setup(aspect, samples)
    C.lathe('floor', [(0, -0.012), (0.6, -0.012)], 64, C.material('floor', (0.006, 0.006, 0.007), roughness=0.35))
    key = area('key', (-0.20, 0.02, 0.10), (0, math.radians(-58), 0), 0.012, 0.9, size_y=0.30)
    area('rim', (-0.14, 0.10, 0.06), (math.radians(-55), math.radians(-48), 0), 0.010, 0.5, (1.0, 0.84, 0.62), size_y=0.22)
    area('rake', (-0.05, 0.12, 0.16), (math.radians(-38), math.radians(-14), 0), 0.06, 0.25, (1.0, 0.95, 0.88))
    cd = bpy.data.cameras.new('cam')
    cd.clip_start = 0.001
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 6.3
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    base = {k: o.location.z for k, o in parts.items()}
    s = bpy.context.scene
    lo, hi = frames
    os.makedirs(out, exist_ok=True)
    for f in range(lo, hi + 1):
        p = progress(f)
        lift = 0.06 * (ease((f - 216) / 34) if f < 290 else 1 - ease((f - 290) / 22)) if 216 <= f < 312 else 0.0
        for k, o in parts.items():
            o.location.z = base[k] + part_offset(k, p) + (lift if k in ('dial', 'crystal', 'bezel', 'hands_hour', 'hands_minute', 'hands_second') else 0)
        t = f / FPS
        parts['hands_hour'].rotation_euler.z = -math.radians(10 * 30 + 10 * 0.5)
        parts['hands_minute'].rotation_euler.z = -math.radians(10 * 6)
        parts['hands_second'].rotation_euler.z = -math.radians((35 + math.floor(t * 8) / 8) * 6)
        parts['balance_wheel'].rotation_euler.z = math.sin(t * math.pi * 8) * 1.4
        parts['escape_wheel'].rotation_euler.z = -math.floor(t * 8) * (math.pi / 15) * 0.5
        parts['gear_train'].rotation_euler.z = -t * 0.05
        key.location.x = -0.20 + 0.36 * ease(min(1, f / 72))
        loc, tgt, lens = cam_at(f)
        cam.location = loc
        d = Vector(tgt) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cd.lens = lens * (0.82 if aspect == 'tall' else 1.0)
        cd.dof.focus_distance = d.length
        macro = (ease((f - 216) / 34) if f < 290 else 1 - ease((f - 290) / 22)) if 216 <= f < 312 else 0.0
        fade = -8 * ease((f - 440) / 36) if f > 440 else (-6 * (1 - ease(f / 30)) if f < 30 else 0)
        s.view_settings.exposure = fade - 0.35 - 1.6 * macro
        s.frame_set(f)
        s.render.filepath = os.path.join(out, f'f{f:04d}.png')
        bpy.ops.render.render(write_still=True)


PCAM = [  # frame, location, target, lens (Blender axes: z up, front is -y)
    (0, (-1.2, -6.6, 1.5), (1.9, -0.6, 0.45), 26),
    (80, (-0.7, -5.4, 1.3), (1.9, -0.7, 0.4), 28),
    (210, (-0.5, -4.9, 1.25), (1.9, -0.8, 0.4), 30),
    (262, (0.2, -2.3, 0.34), (1.3, -0.95, 0.22), 45),
    (318, (1.4, -1.9, 0.62), (1.6, -0.6, 0.42), 52),
    (410, (-0.5, -5.3, 1.6), (1.9, -0.8, 0.4), 30),
    (480, (-0.35, -5.0, 1.5), (1.9, -0.8, 0.4), 30),
]
PLAN = [('arm_left', (0.0, 0.0), 0), ('armless', (1.05, 0.0), 0), ('armless', (1.95, 0.0), 0), ('corner', (2.85, 0.0), 0),
        ('armless', (3.85, -1.0), -math.pi / 2), ('arm_right', (3.85, -1.9), -math.pi / 2), ('ottoman', (1.3, -1.55), 0)]


def pcam_at(f):
    for (f0, p0, t0, l0), (f1, p1, t1, l1) in zip(PCAM, PCAM[1:]):
        if f <= f1:
            k = ease((f - f0) / (f1 - f0))
            lerp = lambda a, b: tuple(x + (y - x) * k for x, y in zip(a, b))
            return lerp(p0, p1), lerp(t0, t1), l0 + (l1 - l0) * k
    return PCAM[-1][1], PCAM[-1][2], PCAM[-1][3]


def plintha(aspect, out, samples, frames):
    C.reset()
    m = PS.mats('Boucle Chalk')
    proto = {k: PS.module(k, m, 'high') for k in PS.FOOT}
    for o in proto.values():
        o.hide_render = True
    r = PS.room('high')
    r['rug'].location = (2.0, -2.05, 0)
    r['side_table'].location = (-0.42, -0.55, 0)
    r['floor_lamp'].location = (-0.85, 0.25, 0)
    C.extrude_poly('ceiling', [(-1.45, -9.0), (12.0, -9.0), (12.0, 1.2), (-1.45, 1.2)], 3.4, 3.5, C.material('ceiling', (0.9, 0.89, 0.86), roughness=0.9))
    placed = []
    for kind, (x, y), rz in PLAN:
        o = proto[kind].copy()
        bpy.context.collection.objects.link(o)
        o.hide_render = False
        o.location = (x, y, 0)
        o.rotation_euler.z = rz
        placed.append(o)
    setup(aspect, samples)
    s = bpy.context.scene
    s.view_settings.look = 'AgX - Base Contrast'
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.70, 0.66, 0.60, 1)
    bg = s.world.node_tree.nodes['Background'].inputs['Strength']
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.angle = math.radians(2.5)
    sun.color = (1.0, 0.95, 0.86)
    so = bpy.data.objects.new('sun', sun)
    bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(57), 0, math.radians(-62))
    fill = area('fill', (1.5, -5.0, 2.2), (math.radians(70), 0, 0), 3.0, 120, (0.92, 0.95, 1.0))
    lamp = area('lamp', (-0.85, 0.25, 1.5), (0, 0, 0), 0.4, 0, (1.0, 0.68, 0.38), shape='DISK')
    low = area('lamp_low', (-0.8, -1.9, 0.6), (math.radians(90), 0, math.radians(-60)), 0.3, 0, (1.0, 0.62, 0.32), shape='DISK')
    cd = bpy.data.cameras.new('cam')
    cd.clip_start = 0.01
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(cam)
    s.camera = cam
    lo, hi = frames
    os.makedirs(out, exist_ok=True)
    for f in range(lo, hi + 1):
        for i, o in enumerate(placed):
            k = ease((f - (84 + i * 16)) / 22)
            o.location.z = 0.9 * (1 - k)
            o.hide_render = f < 84 + i * 16
        rk = ease((f - 60) / 40)
        r['rug'].scale = (max(0.001, rk), 1, 1)
        ev = ease((f - 330) / 70)
        sun.energy = 8.0 * (1 - ev)
        bg.default_value = 0.5 * (1 - ev) + 0.03 * ev
        fill.data.energy = 120 * (1 - ev) + 6 * ev
        lamp.data.energy = 60 * ev
        low.data.energy = 25 * ev
        loc, tgt, lens = pcam_at(f)
        cam.location = loc
        d = Vector(tgt) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cd.lens = lens * (0.8 if aspect == 'tall' else 1.0)
        cd.dof.focus_distance = d.length
        fade = -8 * ease((f - 440) / 36) if f > 440 else (-6 * (1 - ease(f / 24)) if f < 24 else 0)
        s.view_settings.exposure = fade
        s.frame_set(f)
        s.render.filepath = os.path.join(out, f'f{f:04d}.png')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    a = C.args()
    fr = a.get('frames', f'0-{N - 1}').split('-')
    out = os.path.abspath(a.get('out', f"build/reel-{a.get('brand', 'ostrel')}-{a.get('aspect', 'wide')}"))
    {'ostrel': ostrel, 'plintha': plintha}[a.get('brand', 'ostrel')](a.get('aspect', 'wide'), out, int(a.get('samples', 32)), (int(fr[0]), int(fr[1])))
    print('FRAMES', out)
