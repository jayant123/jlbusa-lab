"""Review stills for a concept. blender -b -P blender/stills.py -- --brand ostrel [--out public/ostrel/stills] [--samples 96]

OSTREL: hero (watch in darkness, light across the bezel), macro movement, exploded view.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import ostrel_watch as W  # noqa: E402

# Axial explosion (meters along the watch axis) used for stills and the reel; the page uses src/ostrel/explode.js.
EXPLODE = {'crystal': 0.030, 'bezel': 0.024, 'hands_second': 0.019, 'hands_minute': 0.016, 'hands_hour': 0.013, 'dial': 0.009,
           'gear_train': 0.0045, 'escape_wheel': 0.0040, 'balance_wheel': 0.0050, 'movement_plate': 0.0, 'case': -0.010, 'crown': -0.010,
           'strap_top': -0.010, 'strap_bottom': -0.010}


def render_setup(samples, w, h):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
    except Exception:
        s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.image_settings.file_format = 'WEBP'
    s.render.image_settings.quality = 90
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.004, 0.005, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    s.world = world


def area(name, loc, rot, size, energy, color=(1, 1, 1), shape='RECTANGLE', size_y=None):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy, l.color, l.shape, l.size = energy, color, shape, size
    if size_y:
        l.size_y = size_y
    o = bpy.data.objects.new(name, l)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return o


def look_at(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=100, fstop=None, focus=None):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.clip_start = 0.001
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus or (Vector(loc) - Vector(target)).length
    c = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(c)
    c.location = loc
    look_at(c, target)
    bpy.context.scene.camera = c
    return c


def ostrel_render_materials():
    """Upgrade exported materials for render: brushed case, sunburst dial."""
    d = bpy.data.materials['dial_finish']
    p = d.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.012, 0.013, 0.016, 1)
    p.inputs['Roughness'].default_value = 0.22
    p.inputs['Anisotropic'].default_value = 0.85
    # Radial tangent for the sunburst.
    nt = d.node_tree
    tan = nt.nodes.new('ShaderNodeTangent')
    tan.direction_type = 'RADIAL'
    tan.axis = 'Z'
    nt.links.new(tan.outputs['Tangent'], p.inputs['Tangent'])
    g = bpy.data.materials['glass_crystal'].node_tree.nodes['Principled BSDF']
    g.inputs['IOR'].default_value = 1.12  # anti-reflective coating look
    c = bpy.data.materials['case_finish']
    pc = c.node_tree.nodes['Principled BSDF']
    pc.inputs['Anisotropic'].default_value = 0.7
    pc.inputs['Roughness'].default_value = 0.28
    tc = c.node_tree.nodes.new('ShaderNodeTangent')
    tc.direction_type = 'RADIAL'
    tc.axis = 'Z'
    c.node_tree.links.new(tc.outputs['Tangent'], pc.inputs['Tangent'])


def set_time(parts, h, m, sec):
    parts['hands_hour'].rotation_euler.z = -math.radians((h % 12) * 30 + m * 0.5)
    parts['hands_minute'].rotation_euler.z = -math.radians(m * 6)
    parts['hands_second'].rotation_euler.z = -math.radians(sec * 6)


def ostrel(out, samples, only=None):
    C.reset()
    parts = W.build('high')
    for k in ('bracelet_top', 'bracelet_bottom'):
        parts[k].hide_render = True
    ostrel_render_materials()
    render_setup(samples, 1600, 1000)
    floor = C.lathe('floor', [(0, -0.012), (0.6, -0.012)], 64, C.material('floor', (0.006, 0.006, 0.007), roughness=0.35))
    s = bpy.context.scene

    # 1. Hero: watch in darkness, a narrow light grazing the bezel.
    set_time(parts, 10, 10, 35)
    area('key', (0.16, 0.02, 0.10), (0, math.radians(58), math.radians(10)), 0.012, 0.9, size_y=0.30)
    area('rim', (-0.14, 0.10, 0.06), (math.radians(-55), math.radians(-48), 0), 0.010, 0.5, (1.0, 0.84, 0.62), size_y=0.22)
    area('fill', (0, -0.10, 0.20), (math.radians(25), 0, 0), 0.20, 0.05)
    area('rake', (-0.05, 0.12, 0.16), (math.radians(-38), math.radians(-14), 0), 0.06, 0.25, (1.0, 0.95, 0.88))
    cam = camera((0.035, -0.125, 0.150), (0.0, -0.004, 0.003), lens=80, fstop=6.3)
    s.render.filepath = os.path.join(out, 'hero.webp')
    if only in (None, 'hero'):
        bpy.ops.render.render(write_still=True)
    if only == 'hero':
        return

    # 2. Macro movement: dial, hands, crystal and bezel lifted away.
    for k in ('dial', 'hands_hour', 'hands_minute', 'hands_second', 'crystal', 'bezel'):
        parts[k].hide_render = True
    for l in ('fill', 'rake'):
        bpy.data.objects[l].hide_render = True
    bpy.data.objects['key'].data.energy = 0.45
    tgt = Vector((-0.003, -0.003, 0.004))
    cam.location = (0.022, -0.055, 0.060)
    look_at(cam, tgt)
    cam.data.lens = 85
    cam.data.dof.aperture_fstop = 11
    cam.data.dof.focus_distance = (cam.location - tgt).length
    s.render.filepath = os.path.join(out, 'movement.webp')
    if only in (None, 'movement'):
        bpy.ops.render.render(write_still=True)
    if only == 'movement':
        return

    # 3. Exploded view, three-quarter from the side.
    for k, o in parts.items():
        o.hide_render = k in ('bracelet_top', 'bracelet_bottom')
        if k in EXPLODE:
            o.location.z += EXPLODE[k]
    floor.hide_render = True
    cam.location = (0.11, -0.13, 0.06)
    look_at(cam, (0, 0, 0.008))
    cam.data.lens = 85
    cam.data.dof.use_dof = False
    s.render.filepath = os.path.join(out, 'exploded.webp')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    a = C.args()
    out = os.path.abspath(a.get('out', f"public/{a.get('brand', 'ostrel')}/stills"))
    os.makedirs(out, exist_ok=True)
    {'ostrel': ostrel}[a.get('brand', 'ostrel')](out, int(a.get('samples', 96)), a.get('only'))
    print('STILLS', out)
