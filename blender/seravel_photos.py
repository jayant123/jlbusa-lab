"""SERAVEL photos, path traced in Cycles from the same jewelry geometry as the live 3D.

blender -b -P blender/seravel_photos.py -- --mode product --piece ring --metal "Yellow gold" --stone Diamond --out build/photos/ring.png
blender -b -P blender/seravel_photos.py -- --mode hero --out build/photos/hero.png

The set is a jeweler's tray: deep navy velvet with a soft sheen. A soft key light, two edge strips and a ring of small
lights hidden from the camera give the stones their fire. Stones use real dispersion.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import seravel_jewelry as J  # noqa: E402

METAL = {'Yellow gold': (1.0, 0.74, 0.32), 'White gold': (0.86, 0.87, 0.88), 'Rose gold': (0.98, 0.62, 0.48)}
STONE = {'Diamond': ((1, 1, 1), 2.42, 0, 1.0), 'Sapphire': ((0.12, 0.25, 0.95), 1.77, 260, 0.4), 'Emerald': ((0.12, 0.75, 0.38), 1.57, 220, 0.3)}


def principled(name, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    names = {'color': 'Base Color', 'metal': 'Metallic', 'rough': 'Roughness', 'ior': 'IOR', 'trans': 'Transmission Weight',
             'disp': 'Dispersion', 'sheen': 'Sheen Weight', 'sheen_tint': 'Sheen Tint', 'sheen_rough': 'Sheen Roughness', 'aniso': 'Anisotropic', 'spec': 'Specular IOR Level'}
    for k, v in kw.items():
        key = names[k]
        if key in b.inputs:
            b.inputs[key].default_value = (*v, 1) if isinstance(v, tuple) else v
    return m


def metal_mat(metal):
    return principled('metal', color=METAL[metal], metal=1.0, rough=0.07)


def stone_mat(stone, name='stone'):
    col, ior, density, disp = STONE[stone]
    m = principled(name, color=(1, 1, 1), trans=1.0, ior=ior, rough=0.0, disp=disp)
    if density:
        nt = m.node_tree
        v = nt.nodes.new('ShaderNodeVolumeAbsorption')
        v.inputs['Color'].default_value = (*col, 1)
        v.inputs['Density'].default_value = density
        nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    return m


def velvet():
    m = principled('velvet', color=(0.0015, 0.002, 0.006), rough=1.0, sheen=0.0, spec=0.06)
    nt = m.node_tree
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 900
    # the velvet should read dark navy, never pale
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    return m


def set_and_lights(spread=0.12):
    # A seamless sweep of velvet: floor curving up into a back wall.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    floor = bpy.context.object
    floor.scale = (0.6, 0.6, 1)
    floor.data.materials.append(velvet())
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=30)
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in floor.data.vertices:  # curve the back half up into a wall
        if v.co.y > 0.05:
            d = v.co.y - 0.05
            v.co.z = d * d * 6
    bpy.ops.object.shade_smooth()

    world = bpy.context.scene.world or bpy.data.worlds.new('w')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.002, 0.0025, 0.004, 1)

    def area(name, loc, size, power, color=(1, 1, 1), sy=None, look=(0, 0, 0.008), camera=False):
        d = bpy.data.lights.new(name, 'AREA')
        d.shape = 'RECTANGLE'
        d.size = size
        d.size_y = sy or size
        d.energy = power
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        o.visible_camera = camera
        bpy.context.collection.objects.link(o)
        return o

    area('key', (-0.22, -0.28, 0.3), 0.3, 4, (1.0, 0.97, 0.94))
    area('fill', (0.3, -0.2, 0.12), 0.3, 0.8, (0.85, 0.9, 1.0))
    area('stripL', (-0.18, 0.02, 0.08), 0.02, 2.5, sy=0.3)
    area('stripR', (0.18, 0.04, 0.08), 0.02, 2.5, sy=0.3)
    area('top', (0, 0.02, 0.35), 0.25, 1.2)
    # A ring of small bright lights for fire in the stones.
    for i in range(12):
        a = (i / 12) * math.tau
        area(f'spark{i}', (math.cos(a) * 0.16, math.sin(a) * 0.16 - 0.04, 0.14 + 0.05 * (i % 3)), 0.006, 0.6 + 0.3 * (i % 2))


def camera(loc, target, lens, fstop=4.0):
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    cam.clip_start = 0.001  # close-ups sit nearer than the default 10 cm
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    o = bpy.data.objects.new('cam', cam)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.dof.focus_distance = d.length
    bpy.context.scene.camera = o


def render_settings(w, h, samples):
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
    sc.cycles.max_bounces = 32
    sc.cycles.transmission_bounces = 32
    sc.cycles.glossy_bounces = 12
    sc.cycles.caustics_reflective = True
    sc.cycles.caustics_refractive = True
    sc.cycles.blur_glossy = 0.3
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'


def mats_for(metal, stone):
    return {'metal': metal_mat(metal), 'stone': stone_mat(stone), 'pave': stone_mat('Diamond', 'pave')}


def place(objs, loc, rot):
    root = bpy.data.objects.new('root', None)
    bpy.context.collection.objects.link(root)
    for o in objs.values():
        o.parent = root
    root.location = loc
    root.rotation_euler = rot
    return root


def build_ring(metal, stone, loc=(0, 0, 0), turn=25):
    o = J.ring('high', mats_for(metal, stone))
    return place(o, (loc[0], loc[1], loc[2] + J.RING_R + J.BAND_T - 0.0002), (0, 0, math.radians(turn)))


def build_pendant(metal, stone, loc=(0, 0, 0), turn=0):
    o = J.pendant('high', mats_for(metal, stone))
    return place(o, (loc[0], loc[1], loc[2] + 0.0019), (math.radians(-90), 0, math.radians(turn)))


def build_hoops(metal, loc=(0, 0, 0), size='Small'):
    R = 0.0095 if size == 'Small' else 0.0118
    m = mats_for(metal, 'Diamond')
    a = J.hoop('high', m, R, 'hoopA')
    b = J.hoop('high', m, R, 'hoopB')
    place(a, (loc[0] - 0.0125, loc[1] - 0.002, loc[2] + R + 0.0016), (0, 0, math.radians(-24)))
    place(b, (loc[0] + 0.0125, loc[1] + 0.004, loc[2] + R + 0.0016), (0, 0, math.radians(24)))


def main():
    a = C.args()
    C.reset()
    mode = a.get('mode', 'product')
    samples = int(a.get('samples', 160))
    metal, stone = a.get('metal', 'Yellow gold'), a.get('stone', 'Diamond')
    set_and_lights()
    if mode == 'hero':
        build_ring('Yellow gold', 'Diamond', (0.014, 0.0, 0), 30)
        build_pendant('White gold', 'Sapphire', (-0.006, -0.018, 0), -20)
        build_hoops('Rose gold', (0.04, 0.034, 0))
        camera((0.004, -0.15, 0.062), (0.016, 0.006, 0.01), 80, 6.3)
        render_settings(int(a.get('w', 2400)), int(a.get('h', 1500)), samples)
    else:
        piece = a.get('piece', 'ring')
        if piece == 'ring':
            build_ring(metal, stone, turn=float(a.get('turn', 25)))
            if a.get('cam') == 'macro':
                camera((0.012, -0.036, 0.046), (0, 0, 0.0232), 100, 11)
            else:
                camera((0.016, -0.085, 0.06), (0, 0, 0.017), 100, 9)
        elif piece == 'pendant':
            build_pendant(metal, stone)
            camera((0.0, -0.11, 0.06), (0, 0.006, 0.002), 100, 8.0)
        else:
            build_hoops(metal, size=a.get('size', 'Small'))
            camera((0.0, -0.13, 0.05), (0.0, 0.001, 0.011), 90, 8.0)
        render_settings(int(a.get('w', 900)), int(a.get('h', 1125)), samples)
    out = os.path.abspath(a['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


main()
