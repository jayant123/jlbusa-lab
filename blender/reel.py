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
from stills import EXPLODE, area, ostrel_render_materials  # noqa: E402

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


if __name__ == '__main__':
    a = C.args()
    fr = a.get('frames', f'0-{N - 1}').split('-')
    out = os.path.abspath(a.get('out', f"build/reel-{a.get('brand', 'ostrel')}-{a.get('aspect', 'wide')}"))
    {'ostrel': ostrel}[a.get('brand', 'ostrel')](a.get('aspect', 'wide'), out, int(a.get('samples', 32)), (int(fr[0]), int(fr[1])))
    print('FRAMES', out)
