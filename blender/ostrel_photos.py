"""OSTREL store photos in Cycles: one per build, a hero, and craft shots of the movement and the caseback.

tools/blender_lock.sh blender -b -P blender/ostrel_photos.py -- --out build/ostrel-photos [--only hero|builds|movement|back] [--samples 144]

The watch is the same model the live 3D uses (blender/ostrel_watch.py). Finishes follow the configurator choices.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import ostrel_watch as W  # noqa: E402
import stills as S  # noqa: E402
import ostrel_movement as MV  # noqa: E402


def lin(h):
    h = h.lstrip('#')
    s = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s)


DIAL = {'Obsidian': ('#0c0d10', 0.4, 0.24), 'Champagne': ('#c4a372', 0.85, 0.26), 'Glacier': ('#c3d1da', 0.55, 0.28)}
CASE = {'Brushed platinum': ('#d8d9dc', 1.0, 0.36, 0.7, 0), 'Polished steel': ('#eceef1', 1.0, 0.1, 0.0, 0), 'Black ceramic': ('#0e0f11', 0.0, 0.22, 0.0, 0.35)}
STRAP = {'Black calf': '#121212', 'Cognac calf': '#4f2510'}
BUILDS = {
    'obsidian': ('Obsidian', 'Brushed platinum', 'Black calf'),
    'champagne': ('Champagne', 'Polished steel', 'Cognac calf'),
    'glacier': ('Glacier', 'Polished steel', 'Steel bracelet'),
    'noir': ('Obsidian', 'Black ceramic', 'Black calf'),
}


def bsdf(name):
    return bpy.data.materials[name].node_tree.nodes['Principled BSDF']


def finish(parts, dial, case, strap):
    c, m, r = DIAL[dial]
    p = bsdf('dial_finish')
    p.inputs['Base Color'].default_value = (*lin(c), 1)
    p.inputs['Metallic'].default_value = m
    p.inputs['Roughness'].default_value = r
    col, met, rough, aniso, coat = CASE[case]
    for name in ('case_finish', 'bezel_finish'):
        q = bsdf(name)
        q.inputs['Base Color'].default_value = (*lin(col), 1)
        q.inputs['Metallic'].default_value = met
        q.inputs['Roughness'].default_value = rough if name == 'case_finish' else min(rough, 0.14)
        q.inputs['Anisotropic'].default_value = aniso
        q.inputs['Coat Weight'].default_value = coat
    bracelet = strap == 'Steel bracelet'
    for k in ('strap_top', 'strap_bottom'):
        parts[k].hide_render = bracelet
    for k in ('bracelet_top', 'bracelet_bottom'):
        parts[k].hide_render = not bracelet
    b = bsdf('bracelet_steel')
    b.inputs['Base Color'].default_value = (0.58, 0.59, 0.61, 1)
    b.inputs['Roughness'].default_value = 0.3
    if not bracelet:
        s = bsdf('strap_finish')
        s.inputs['Base Color'].default_value = (*lin(STRAP[strap]), 1)
        s.inputs['Roughness'].default_value = 0.55


def studio(warm=True):
    """Dark studio: a long soft strip that draws a clean highlight down the case, a warm rim, a low fill."""
    S.area('key', (0.16, 0.02, 0.10), (0, math.radians(58), math.radians(10)), 0.03, 1.4, size_y=0.32)
    S.area('rim', (-0.14, 0.10, 0.06), (math.radians(-55), math.radians(-48), 0), 0.012, 0.7, (1.0, 0.84, 0.62) if warm else (0.9, 0.95, 1.0), size_y=0.24)
    S.area('fill', (0, -0.12, 0.22), (math.radians(28), 0, 0), 0.24, 0.09)
    S.area('rake', (-0.05, 0.12, 0.16), (math.radians(-38), math.radians(-14), 0), 0.08, 0.32, (1.0, 0.95, 0.88))
    for o in bpy.data.objects:
        if o.type == 'LIGHT':
            o.visible_camera = False
    floor = C.lathe('floor', [(0, -0.0125), (0.8, -0.0125)], 96, C.material('floor', (0.006, 0.006, 0.007), roughness=0.3))
    return floor


def main():
    a = C.args()
    out = os.path.abspath(a.get('out', 'build/ostrel-photos'))
    os.makedirs(out, exist_ok=True)
    only = a.get('only')
    samples = int(a.get('samples', 144))
    C.reset()
    parts = W.build('high')
    S.ostrel_render_materials()
    S.set_time(parts, 10, 10, 35)
    S.render_setup(samples, 900, 1125)
    sc = bpy.context.scene
    sc.render.image_settings.file_format = 'PNG'
    studio()

    if only in (None, 'builds'):
        cam = S.camera((0.03, -0.112, 0.168), (0.0, -0.006, 0.002), lens=78, fstop=7.1)
        for key, (dial, case, strap) in BUILDS.items():
            finish(parts, dial, case, strap)
            sc.render.filepath = os.path.join(out, f'build-{key}.png')
            bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)

    if only in (None, 'hero'):
        finish(parts, 'Obsidian', 'Brushed platinum', 'Black calf')
        S.render_setup(samples, 2400, 1500)
        sc.render.image_settings.file_format = 'PNG'
        cam = S.camera((0.05, -0.15, 0.135), (0.0, -0.004, 0.004), lens=62, fstop=6.3)
        cam.data.shift_x = -0.17  # the watch sits right of center. The copy sits on the left.
        sc.render.filepath = os.path.join(out, 'hero.png')
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)

    if only in (None, 'movement'):
        finish(parts, 'Obsidian', 'Brushed platinum', 'Black calf')
        S.render_setup(samples, 1200, 900)
        sc.render.image_settings.file_format = 'PNG'
        hidden = ('dial', 'hands_hour', 'hands_minute', 'hands_second', 'crystal', 'bezel')
        for k in hidden:
            parts[k].hide_render = True
        detail = MV.install(parts)
        # Low, raking light for the movement: dark plate, bright edges on the wheels.
        for name, e in (('key', 0.5), ('fill', 0.0), ('rake', 0.6), ('rim', 0.5)):
            bpy.data.objects[name].data.energy = e
        g = bsdf('gold_wheel'); g.inputs['Base Color'].default_value = (0.62, 0.42, 0.18, 1); g.inputs['Roughness'].default_value = 0.18
        for n in ('movement_rhodium', 'bridge_rhodium'):
            q = bsdf(n); q.inputs['Base Color'].default_value = (0.5, 0.51, 0.53, 1); q.inputs['Roughness'].default_value = 0.22
        tgt = Vector((-0.003, -0.003, 0.004))
        cam = S.camera((0.024, -0.058, 0.062), tgt, lens=90, fstop=10)
        sc.render.filepath = os.path.join(out, 'movement.png')
        bpy.ops.render.render(write_still=True)
        for k in hidden:
            parts[k].hide_render = False
        for o in detail:
            bpy.data.objects.remove(o)
        for k in ('movement_plate', 'gear_train', 'escape_wheel', 'balance_wheel'):
            parts[k].hide_render = False
        bpy.data.objects.remove(cam)

    if only in (None, 'back'):
        # Turn the watch over: the sapphire caseback, the rotor and the serial ring.
        finish(parts, 'Obsidian', 'Polished steel', 'Cognac calf')
        S.render_setup(samples, 1200, 900)
        sc.render.image_settings.file_format = 'PNG'
        for name, e in (('key', 1.4), ('fill', 0.09), ('rake', 0.32), ('rim', 0.7)):
            bpy.data.objects[name].data.energy = e
        extra = MV.install(parts, caseback=True)
        pivot = bpy.data.objects.new('pivot', None)
        bpy.context.collection.objects.link(pivot)
        for o in list(parts.values()) + extra:
            if o.parent is None:
                o.parent = pivot
        pivot.rotation_euler = (0, math.pi, 0)
        pivot.location.z = 0.0
        MV.engrave_back()
        bpy.data.objects['floor'].location.z = -0.0135
        cam = S.camera((0.016, -0.05, 0.11), (0.0, -0.002, -0.004), lens=85, fstop=11)
        sc.render.filepath = os.path.join(out, 'caseback.png')
        bpy.ops.render.render(write_still=True)

    print('PHOTOS', out)


main()
