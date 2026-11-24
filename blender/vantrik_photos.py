"""VANTRIK product and hero photos, path traced in Cycles from the same shoe builder as the live 3D.

blender -b -P blender/vantrik_photos.py -- --job product --kind runner --colors '{"upper":"#d4481c",...}' --out build/photos/x.png
Jobs: product (one shoe, portrait), hero (two shoes on concrete blocks, copy space on the left),
row (four runners side by side), closeup (knit and foam detail).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import vantrik_shoes as S  # noqa: E402


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def principled(m):
    return m.node_tree.nodes['Principled BSDF']


def foam_bump(m, scale=900, strength=0.08):
    nt = m.node_tree
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 4
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    p = principled(m)
    if p.inputs['Normal'].is_linked:  # keep the knit normal map under the bump
        nt.links.new(p.inputs['Normal'].links[0].from_socket, b.inputs['Normal'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])


def shoe(kind, colors, loc=(0, 0, 0), rot=0.0, tag=''):
    objs = S.build(kind, 'photo')
    root = bpy.data.objects.new('shoe' + tag, None)
    bpy.context.collection.objects.link(root)
    for name, o in objs.items():
        o.parent = root
    # Give this shoe its own copies of the materials, then color them.
    done = {}
    for o in objs.values():
        for slot in o.material_slots:
            m = slot.material
            if m.name not in done:
                done[m.name] = m.copy()
            slot.material = done[m.name]
    drive = {'upper': 'upper', 'tongue': 'upper', 'overlay': 'upper', 'midsole': 'midsole', 'outsole': 'outsole', 'laces': 'laces', 'trim': 'trim'}
    for base, m in done.items():
        key = base.split('.')[0]
        p = principled(m)
        if key in drive and colors.get(drive[key]):
            p.inputs['Base Color'].default_value = (*lin(colors[drive[key]]), 1)
        if key == 'stitch':  # thread matches the laces
            p.inputs['Base Color'].default_value = (*[v * 0.92 for v in lin(colors.get('laces', '#eeeeee'))], 1)
        if key == 'overlay' and kind == 'runner':  # the mudguard reads a shade deeper than the knit
            p.inputs['Base Color'].default_value = (*[v * 0.8 for v in lin(colors['upper'])], 1)
        if key in ('upper', 'tongue') and kind == 'runner':
            p.inputs['Sheen Weight'].default_value = 0.55
            p.inputs['Sheen Roughness'].default_value = 0.45
        if key in ('upper', 'overlay') and kind == 'court':
            p.inputs['Coat Weight'].default_value = 0.25
            p.inputs['Coat Roughness'].default_value = 0.35
        if key == 'midsole':
            p.inputs['Roughness'].default_value = 0.6
            foam_bump(m, 1500, 0.06)
        if key == 'outsole':
            foam_bump(m, 2600, 0.1)
    root.location = loc
    root.rotation_euler = (0, 0, rot)
    return root


def concrete(name, tint=(0.62, 0.62, 0.59), rough=0.9):
    m = C.material(name, tint, roughness=rough)
    nt = m.node_tree
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 40
    n.inputs['Detail'].default_value = 8
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*[c * 0.86 for c in tint], 1)
    ramp.color_ramp.elements[1].color = (*[min(1, c * 1.08) for c in tint], 1)
    nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], principled(m).inputs['Base Color'])
    foam_bump(m, 300, 0.12)
    return m


def block(name, size, loc, mat, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    C.bevel(o, bevel, 4)
    o.data.materials.append(mat)
    return o


def studio(dark=False):
    # A seamless sweep of pale concrete, a big soft key from the upper left, a fill and a thin rim behind.
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(concrete('floor', (0.018, 0.018, 0.019) if dark else (0.36, 0.36, 0.34), 0.85 if dark else 0.95))
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 1.6, 2), rotation=(math.pi / 2, 0, 0))
    wall = bpy.context.object
    wall.data.materials.append(concrete('wall', (0.022, 0.022, 0.024) if dark else (0.3, 0.3, 0.29), 1.0))
    world = bpy.data.worlds.new('w')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.55, 0.53, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.02 if dark else 0.12

    def area(name, loc, target, size, power, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA')
        d.shape = 'DISK'
        d.size = size
        d.energy = power
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        o.visible_camera = False
        bpy.context.collection.objects.link(o)

    if dark:
        # A low, moody set: a soft top key, two hard rims from behind and a warm kick from the right.
        area('key', (-0.4, -0.7, 1.3), (0.25, 0.1, 0.08), 0.9, 34, (1.0, 0.96, 0.92))
        area('rimL', (-0.7, 0.9, 0.35), (0.2, 0.1, 0.1), 0.25, 70, (0.85, 0.92, 1.0))
        area('rimR', (1.1, 0.7, 0.3), (0.3, 0.1, 0.1), 0.25, 80, (1.0, 0.82, 0.62))
        area('kick', (1.2, -0.6, 0.15), (0.3, 0.1, 0.1), 0.4, 18, (1.0, 0.6, 0.4))
        return
    area('key', (-0.9, -1.0, 1.4), (0.15, 0, 0.05), 1.6, 70, (1.0, 0.97, 0.93))
    area('fill', (1.4, -1.2, 0.5), (0.15, 0, 0.05), 1.4, 16, (0.92, 0.95, 1.0))
    area('rim', (0.4, 1.0, 0.7), (0.15, 0, 0.05), 0.8, 30)


def camera(loc, target, lens, fstop=8):
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    o = bpy.data.objects.new('cam', cam)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.dof.focus_distance = d.length
    bpy.context.scene.camera = o


def render(out, w, h, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # noqa: BLE001
        print('GPU unavailable', e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.4
    sc.render.filepath = os.path.abspath(out)
    os.makedirs(os.path.dirname(sc.render.filepath), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', sc.render.filepath)


def main():
    a = C.args()
    C.reset()
    job = a.get('job', 'product')
    samples = int(a.get('samples', 144))
    L = S.L
    if job == 'product':
        colors = json.loads(a['colors'])
        shoe(a.get('kind', 'runner'), colors, (-L / 2, 0, 0.04), 0)
        mat = concrete('block', (0.46, 0.46, 0.44))
        block('plinth', (0.42, 0.24, 0.04), (0, 0.02, 0.02), mat)
        studio()
        camera((0.09, -0.64, 0.3), (0.012, 0.0, 0.072), 58)
        render(a['out'], int(a.get('w', 900)), int(a.get('h', 1125)), samples)
    elif job == 'hero':
        mat = concrete('block', (0.032, 0.032, 0.034), 0.85)
        block('b1', (0.4, 0.26, 0.05), (0.2, 0.0, 0.025), mat)
        block('b2', (0.38, 0.24, 0.14), (0.52, 0.28, 0.07), mat)
        shoe('runner', json.loads(a['colors']), (0.2 - L / 2, -0.01, 0.05), math.radians(-8), 'a')
        shoe('court', json.loads(a['colors2']), (0.52 - L / 2, 0.29, 0.14), math.radians(12), 'b')
        studio(dark=True)
        camera((0.12, -1.1, 0.1), (0.2, 0.1, 0.12), 46, 8)
        render(a['out'], int(a.get('w', 2400)), int(a.get('h', 1500)), samples)
    elif job == 'row':
        mat = concrete('block', (0.46, 0.46, 0.44))
        block('long', (1.5, 0.3, 0.04), (0.0, 0.05, 0.02), mat)
        for i, c in enumerate(json.loads(a['colors'])):
            shoe('runner', c, (-0.6 + i * 0.33 - L / 2 + 0.05, 0.02, 0.04), math.radians(-24), str(i))
        studio()
        camera((0.0, -1.85, 0.62), (0.0, 0.05, 0.05), 50, 11)
        render(a['out'], int(a.get('w', 1200)), int(a.get('h', 900)), samples)
    elif job == 'closeup':
        shoe(a.get('kind', 'runner'), json.loads(a['colors']), (-L / 2, 0, 0.0), 0)
        studio()
        t = float(a.get('at', 0.7))
        camera((-L / 2 + t * L + 0.1, -0.36, 0.14), (-L / 2 + t * L, 0, 0.045), 85, 7)
        render(a['out'], int(a.get('w', 1200)), int(a.get('h', 900)), samples)


main()
