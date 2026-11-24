"""SERAVEL photos, path traced in Cycles from the same jewelry geometry as the live 3D.

blender -b -P blender/seravel_photos.py -- --mode product --piece ring --metal "Yellow gold" --stone Diamond --out build/photos/ring.png
blender -b -P blender/seravel_photos.py -- --mode hero --out build/photos/hero.png

The set is a jeweler's tray: deep navy velvet with a soft sheen. A soft key light, two edge strips and a ring of small
lights hidden from the camera give the stones their fire. Stones use real dispersion.
"""
import math
import os
import sys

import bmesh
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


def set_and_lights(spread=0.12, sparks=True, dim=1.0):
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

    area('key', (-0.22, -0.28, 0.3), 0.3, 4 * dim, (1.0, 0.97, 0.94))
    area('fill', (0.3, -0.2, 0.12), 0.3, 0.8, (0.85, 0.9, 1.0))
    area('stripL', (-0.18, 0.02, 0.08), 0.02, 2.5, sy=0.3)
    area('stripR', (0.18, 0.04, 0.08), 0.02, 2.5, sy=0.3)
    area('top', (0, 0.02, 0.35), 0.25, 1.2 * dim)
    # A ring of small bright lights for fire in the stones.
    if not sparks:
        area('soft', (0.0, -0.25, 0.2), 0.4, 3 * dim, (0.9, 0.93, 1.0))
    for i in range(12 if sparks else 0):
        a = (i / 12) * math.tau
        area(f'spark{i}', (math.cos(a) * 0.16, math.sin(a) * 0.16 - 0.04, 0.14 + 0.05 * (i % 3)), 0.006, 0.6 + 0.3 * (i % 2))


FOCUS = {}  # objects the camera should keep sharp (the ring's stone)


def focus_on_stone():
    # Point the focus at the ring's stone so its facets stay crisp. Blender reads the object's world position.
    cam = bpy.context.scene.camera
    if cam and FOCUS.get('stone'):
        cam.data.dof.focus_object = FOCUS['stone']


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
    FOCUS['stone'] = o['stone']
    return place(o, (loc[0], loc[1], loc[2] + J.RING_R + J.BAND_T - 0.0002), (0, 0, math.radians(turn)))


def build_pendant(metal, stone, loc=(0, 0, 0), turn=0):
    o = J.pendant('high', mats_for(metal, stone))
    return place(o, (loc[0], loc[1], loc[2] + 0.0019), (math.radians(-90), 0, math.radians(turn)))


def build_hoops(metal, loc=(0, 0, 0), size='Small', turn=18, grooves=True):
    R = 0.0095 if size == 'Small' else 0.0118
    m = mats_for(metal, 'Diamond')
    a = J.hoop('high', m, R, 'hoopA', grooves)
    b = J.hoop('high', m, R, 'hoopB', grooves)
    place(a, (loc[0] - 0.0125, loc[1], loc[2] + R + 0.0016), (0, 0, math.radians(-turn)))
    place(b, (loc[0] + 0.0125, loc[1], loc[2] + R + 0.0016), (0, 0, math.radians(turn)))


# --- Extra scenes ------------------------------------------------------------------------------------------------
def wood(light=False):
    """Walnut: long dark grain lines stretched along X, with fine pores in the bump."""
    m = principled('walnut', color=(0.1, 0.05, 0.025), rough=0.42)
    nt = m.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (4, 70, 70)  # grain runs along X
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.0
    noise.inputs['Detail'].default_value = 8
    noise.inputs['Distortion'].default_value = 1.5
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.inputs['Scale'].default_value = 1.4
    wave.inputs['Distortion'].default_value = 9
    wave.inputs['Detail'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    lo, hi = ((0.11, 0.06, 0.03), (0.3, 0.17, 0.08)) if light else ((0.035, 0.017, 0.008), (0.16, 0.085, 0.04))
    ramp.color_ramp.elements[0].color = (*lo, 1)
    ramp.color_ramp.elements[1].color = (*hi, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY'
    nt.links.new(wave.outputs['Fac'], mix.inputs[0]); nt.links.new(noise.outputs['Fac'], mix.inputs[1])
    nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    pores = nt.nodes.new('ShaderNodeTexNoise'); pores.inputs['Scale'].default_value = 900
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.08
    nt.links.new(pores.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    return m


def box(name, size, loc, mat, rot=(0, 0, 0), bev=0.0006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    C.bevel(o, bev, 3)
    return o


def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=64, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if bev:
        C.bevel(o, bev, 3)
    return o


def workshop_scene():
    """A jeweler's bench seen low across its edge: a walnut bench pin with its V cut, clamped to the bench by a steel
    anchor, the ring resting on the pin, a steel ring mandrel, two needle files and a loupe lying flat."""
    bench_m = wood()
    pin_m = wood(light=True)
    steel = principled('steel', color=(0.6, 0.61, 0.63), metal=1.0, rough=0.22)
    black = principled('black', color=(0.02, 0.02, 0.022), rough=0.4)
    lens = principled('lens', color=(1, 1, 1), trans=1.0, ior=1.52, rough=0.0)
    # Bench top: its front edge runs along X at y = 0. It sits on the velvet sweep, which reads as the dark room.
    box('bench', (0.5, 0.3, 0.035), (0, 0.15, 0.0175), bench_m, bev=0.002)
    z = 0.035
    # Bench pin: a tapered walnut wedge pushed out over the edge, sloping down, with a V cut in its nose.
    bm = bmesh.new()
    pts = [(-0.025, -0.035, 0.0), (0.025, -0.035, 0.0), (0.03, 0.06, 0.0), (-0.03, 0.06, 0.0)]
    bot = [bm.verts.new((x, y, zz)) for x, y, zz in pts]
    top = [bm.verts.new((x, y, 0.009 if y < 0 else 0.016)) for x, y, _ in pts]
    bm.faces.new(bot[::-1]); bm.faces.new(top)
    for i in range(4):
        bm.faces.new((bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pin = C.obj_from_bmesh('pin', bm, pin_m, smooth=False)
    C.bevel(pin, 0.0012, 3)
    pin.location = (0, 0, z)
    # V cut: subtract a wedge from the nose.
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.02, depth=0.05, location=(0, -0.042, z + 0.008), rotation=(0, 0, math.radians(90)))
    cut = bpy.context.object
    cut.hide_render = True
    mod = pin.modifiers.new('V', 'BOOLEAN'); mod.object = cut; mod.operation = 'DIFFERENCE'
    # Steel anchor clamped over the pin's back end.
    box('anchor', (0.07, 0.016, 0.006), (0, 0.045, z + 0.019), steel, bev=0.0012)
    for x in (-0.03, 0.03):
        cyl(f'screw{x}', 0.0035, 0.012, (x, 0.045, z + 0.024), steel, bev=0.0006)
    # The ring rests on the pin, tilted, stone up.
    ring = build_ring('Yellow gold', 'Diamond', (0, 0, 0), 0)
    ring.location = (0.006, -0.012, z + 0.0108 + J.RING_R + J.BAND_T - 0.0004)  # band resting on the pin top
    ring.rotation_euler = (math.radians(8), 0, math.radians(28))
    # Ring mandrel: a long tapered steel rod with a walnut handle, lying on the bench.
    cone_r0, cone_r1 = 0.0115, 0.0065
    bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=cone_r0, radius2=cone_r1, depth=0.26, location=(-0.07, 0.12, z + cone_r0), rotation=(0, math.radians(90), math.radians(12)))
    mand = bpy.context.object; mand.data.materials.append(steel); bpy.ops.object.shade_smooth()
    cyl('mand_handle', 0.014, 0.09, (-0.07 - 0.17 * math.cos(math.radians(12)), 0.12 - 0.17 * math.sin(math.radians(12)), z + 0.014), pin_m, rot=(0, math.radians(90), math.radians(12)), bev=0.002)
    # Needle files lying flat.
    for k, (x, y, ang) in enumerate([(0.07, 0.02, -18), (0.085, 0.035, -10)]):
        cyl(f'file{k}', 0.0013, 0.075, (x, y, z + 0.0014), steel, rot=(0, math.radians(90), math.radians(ang)), verts=6)
        hx = x + 0.052 * math.cos(math.radians(ang)); hy = y + 0.052 * math.sin(math.radians(ang))
        cyl(f'handle{k}', 0.0032, 0.03, (hx, hy, z + 0.0032), black, rot=(0, math.radians(90), math.radians(ang)), bev=0.0006)
    # A loupe lying flat: black barrel and glass.
    cyl('loupe', 0.012, 0.014, (-0.06, 0.03, z + 0.007), black, bev=0.0008)
    cyl('loupe_lens', 0.0095, 0.0145, (-0.06, 0.03, z + 0.0072), lens)
    # Warm low raking light from the left. Dim fill from the front.
    sun = bpy.data.lights.new('rake', 'AREA'); sun.size = 0.12; sun.energy = 9; sun.color = (1.0, 0.78, 0.52)
    so = bpy.data.objects.new('rake', sun); so.location = (-0.35, -0.05, z + 0.06)
    so.rotation_euler = (Vector((0, 0.03, z)) - Vector(so.location)).to_track_quat('-Z', 'Y').to_euler()
    so.visible_camera = False
    bpy.context.collection.objects.link(so)
    camera((0.05, -0.135, z + 0.05), (0.006, -0.012, z + 0.022), 60, 10.0)


def dish_scene():
    """The ring in a small dark ceramic dish, a soft polishing cloth folded beside it."""
    ceramic = principled('ceramic', color=(0.0022, 0.0024, 0.003), rough=0.35)
    bowl = J.revolve_closed('dish', [(0.0, 0.0), (0.03, 0.0), (0.034, 0.0008), (0.037, 0.009), (0.036, 0.0098), (0.0335, 0.0094),
                                     (0.031, 0.0032), (0.0, 0.0028)], 160, ceramic)
    bowl.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()
    # Polishing cloth: a soft grey-beige square with gentle folds, beside the dish.
    cloth = principled('cloth', color=(0.045, 0.036, 0.028), rough=1.0, sheen=0.3, sheen_tint=(0.8, 0.75, 0.7), sheen_rough=0.5, spec=0.1)
    bpy.ops.mesh.primitive_plane_add(size=0.08, location=(0.088, 0.03, 0.0))
    cl = bpy.context.object
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=60); bpy.ops.object.mode_set(mode='OBJECT')
    for v in cl.data.vertices:
        x, y = v.co.x, v.co.y
        v.co.z = 0.0035 + 0.0028 * max(0.0, math.sin(x * 70 + y * 25)) ** 2 + 0.0015 * math.sin(y * 110) * math.cos(x * 40)
    cl.rotation_euler = (0, 0, math.radians(18))
    cl.modifiers.new('Thick', 'SOLIDIFY').thickness = 0.0008
    cl.data.materials.append(cloth)
    bpy.ops.object.shade_smooth()
    r = build_ring('Yellow gold', 'Diamond', (0, 0, 0), 0)
    r.location = (0.002, 0.0, 0.0031 + 0.0016)
    r.rotation_euler = (math.radians(90), math.radians(-12), math.radians(20))
    camera((-0.005, -0.12, 0.08), (0.03, 0.01, 0.004), 65, 9.0)


def stones_scene():
    """Three loose stones side by side, tables up, on velvet."""
    for k, (name, x) in enumerate([('Diamond', -0.0095), ('Sapphire', 0.0), ('Emerald', 0.0095)]):
        st = J.brilliant(name, J.STONE_D, stone_mat(name, name.lower()))
        st.location = (x, 0, J.stone_dims(J.STONE_D)['pav'] * 0.5)
        st.rotation_euler = (math.radians(22), 0, math.radians(10 * k))
    camera((0.0, -0.07, 0.045), (0.0, 0.0, 0.002), 100, 13)


def claws_scene():
    """A macro from above and to the side: the four claws holding the stone."""
    build_ring('Yellow gold', 'Diamond', (0, 0, 0), 45)
    camera((0.006, -0.018, 0.046), (0, 0, 0.0238), 100, 14)


def main():
    a = C.args()
    C.reset()
    mode = a.get('mode', 'product')
    samples = int(a.get('samples', 512))
    metal, stone = a.get('metal', 'Yellow gold'), a.get('stone', 'Diamond')
    set_and_lights(sparks=not ((mode == 'product' and a.get('piece') == 'hoops') or mode in ('workshop', 'dish', 'hero')), dim={'workshop': 0.25, 'dish': 0.35}.get(mode, 1.0))
    if mode in ('workshop', 'dish', 'stones', 'claws'):
        {'workshop': workshop_scene, 'dish': dish_scene, 'stones': stones_scene, 'claws': claws_scene}[mode]()
        render_settings(int(a.get('w', 1200)), int(a.get('h', 900)), samples)
    elif mode == 'hero':
        build_ring('Yellow gold', 'Diamond', (0.014, 0.0, 0), 30)
        build_pendant('White gold', 'Sapphire', (-0.006, -0.018, 0), -20)
        build_hoops('Rose gold', (0.04, 0.034, 0), turn=-12, grooves=False)  # out of focus here: fine grooves would only read as dots
        camera((0.004, -0.15, 0.062), (0.016, 0.006, 0.01), 80, 16)
        focus_on_stone()
        render_settings(int(a.get('w', 2400)), int(a.get('h', 1500)), samples)
    else:
        piece = a.get('piece', 'ring')
        if piece == 'ring':
            build_ring(metal, stone, turn=float(a.get('turn', 25)))
            if a.get('cam') == 'macro':
                camera((0.012, -0.036, 0.046), (0, 0, 0.0232), 100, 11)
            else:
                camera((0.016, -0.085, 0.06), (0, 0, 0.017), 100, 22)
            focus_on_stone()
        elif piece == 'pendant':
            build_pendant(metal, stone)
            camera((0.0, -0.11, 0.06), (0, 0.006, 0.002), 100, 8.0)
        else:
            build_hoops(metal, size=a.get('size', 'Small'))
            camera((0.0, -0.185, 0.055), (0.0, 0.0, 0.0115), 90, 16.0)
        render_settings(int(a.get('w', 900)), int(a.get('h', 1125)), samples)
    out = os.path.abspath(a['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


main()
