"""NUITHRA product and hero photos, path traced in Cycles from the same cuts as the live 3D page.

blender -b -P blender/nuithra_photos.py -- --json build/nuithra_cuts.json --mode product --handle nuithra-amber-hour --out build/photos/amber.png
blender -b -P blender/nuithra_photos.py -- --json build/nuithra_cuts.json --mode hero --out build/photos/hero.png

Each bottle: a hollow shell of thick clear glass with beveled facet edges, the perfume inside (glass surface over a
colored volume), a cut-stone stopper, and a metal collar set with real glass crystals. The set: black polished stone,
a dark wall with a warm glow and tall light slits, a warm light behind the bottles whose light passes through the
glass onto the stone (shadow caustics).
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {}
    for i in range(0, len(a) - 1, 2):
        out[a[i].lstrip('-')] = a[i + 1]
    return out


def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# --- Geometry ----------------------------------------------------------------------------------------------------
def ring_pts(ring, n, sx, sz, rot):
    y, r = ring[0], ring[1]
    tw = ring[2] if len(ring) > 2 else 0
    pts = []
    for i in range(n):
        a = ((i + tw) / n) * math.pi * 2 + rot
        # three.js: x = sin(a), z = cos(a), y up. Blender: x, -z -> y, y -> z. Front (+z three) is -y Blender.
        x, z = math.sin(a) * r * sx, math.cos(a) * r * sz
        pts.append((x, -z, y))
    return pts


def gem_bmesh(bm, rings, n, sx=1, sz=1, rot=0, top=True, bottom=True):
    rows = [[bm.verts.new(p) for p in ring_pts(r, n, sx, sz, rot)] for r in rings]
    for k in range(len(rings) - 1):
        A, B = rows[k], rows[k + 1]
        ta = rings[k][2] if len(rings[k]) > 2 else 0
        tb = rings[k + 1][2] if len(rings[k + 1]) > 2 else 0
        for i in range(n):
            a0, a1, b0, b1 = A[i], A[(i + 1) % n], B[i], B[(i + 1) % n]
            if abs(ta - tb) < 1e-6:
                bm.faces.new((a0, a1, b1, b0))
            elif tb > ta:
                bm.faces.new((a0, a1, b0)); bm.faces.new((a1, b1, b0))
            else:
                bm.faces.new((a0, a1, b1)); bm.faces.new((a0, b1, b0))
    if bottom:
        bm.faces.new(list(reversed(rows[0])))
    if top:
        bm.faces.new(rows[-1])
    return rows


def radius_at(rings, y):
    for k in range(len(rings) - 1):
        y0, r0 = rings[k][0], rings[k][1]
        y1, r1 = rings[k + 1][0], rings[k + 1][1]
        if y0 <= y <= y1:
            return r0 + (r1 - r0) * ((y - y0) / max(1e-6, y1 - y0))
    return rings[-1][1]


def inner_rings(rings, y0, y1, wall):
    ys = [y0] + [r[0] for r in rings if y0 < r[0] < y1] + [y1]
    out = []
    for y in ys:
        tw = 0
        for r in rings:
            if r[0] <= y:
                tw = r[2] if len(r) > 2 else 0
        out.append([y, max(0.0015, radius_at(rings, y) - wall), tw])
    return out


def mesh_obj(name, bm, mat, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def bevel(o, width, angle=25):
    m = o.modifiers.new('Bevel', 'BEVEL')
    m.width = width
    m.segments = 3
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m


# --- Materials ---------------------------------------------------------------------------------------------------
def principled(name, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    for k, v in kw.items():
        key = {'color': 'Base Color', 'metal': 'Metallic', 'rough': 'Roughness', 'ior': 'IOR', 'trans': 'Transmission Weight',
               'disp': 'Dispersion', 'coat': 'Coat Weight', 'emit': 'Emission Color', 'emit_k': 'Emission Strength'}[k]
        if key in b.inputs:
            b.inputs[key].default_value = (*v, 1) if isinstance(v, tuple) else v
    return m


def glass(name, color=(1, 1, 1), ior=1.5, disp=0.0, rough=0.0):
    return principled(name, color=color, metal=0, rough=rough, ior=ior, trans=1.0, disp=disp)


def liquid(name, rgb, density=22):
    # A clear surface over a colored volume: the deeper the perfume, the richer the color.
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Transmission Weight'].default_value = 1
    b.inputs['Roughness'].default_value = 0
    b.inputs['IOR'].default_value = 1.36
    vol = nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value = (*[c ** 0.62 for c in rgb], 1)  # lighter, same hue: thick glass absorbs a lot
    vol.inputs['Density'].default_value = density
    nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    return m


def emitter(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], o.inputs['Surface'])
    return m


def wall_material():
    # Near black at the top, a warm band of light low behind the shelf.
    m = bpy.data.materials.new('wall')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    r = ramp.color_ramp
    r.elements[0].position = 0.0; r.elements[0].color = (1.0, 0.6, 0.32, 1)
    r.elements[1].position = 0.2; r.elements[1].color = (0.002, 0.0015, 0.0015, 1)
    mid = r.elements.new(0.06); mid.color = (0.2, 0.05, 0.025, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.4
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


METAL = {'gold': (0.98, 0.78, 0.45), 'silver': (0.93, 0.94, 0.97), 'gunmetal': (0.28, 0.29, 0.31)}


# --- One bottle --------------------------------------------------------------------------------------------------
def build_bottle(cut, sc, where, mats):
    rings, n = cut['rings'], cut['n']
    o = cut.get('opts', {})
    sx, sz, rot = o.get('sx', 1), o.get('sz', 1), o.get('rot', 0)
    L = cut['liquid']
    top = cut['top']
    wall = L['wall']
    parts = []

    # Glass: the outer cut and an inner cavity that runs from the solid base up into the neck.
    bm = bmesh.new()
    gem_bmesh(bm, rings, n, sx, sz, rot)
    cav = inner_rings(rings, L['base'] - 0.001, top - 0.004, wall)
    cav[-1][1] = min(cav[-1][1], 0.0045)
    before = set(bm.faces)
    gem_bmesh(bm, cav, n, sx, sz, rot)
    cavity_faces = [f for f in bm.faces if f not in before]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.reverse_faces(bm, faces=cavity_faces)
    me = bpy.data.meshes.new('glass')
    bm.to_mesh(me)
    bm.free()
    g = bpy.data.objects.new('glass', me)
    bpy.context.collection.objects.link(g)
    g.data.materials.append(mats['glass'])
    bevel(g, 0.00035)
    parts.append(g)

    # The perfume, a hair inside the cavity, up to the fill line.
    bm = bmesh.new()
    gem_bmesh(bm, inner_rings(rings, L['base'] - 0.0008, L['fill'], wall + 0.0002), n, sx, sz, rot)
    parts.append(mesh_obj('liquid', bm, mats['liquid']))

    # Collar: a gold band with rows of crystals and a lip.
    rows, cr = cut['collar']['rows'], cut['collar']['r']
    band = 0.0011 + rows * 0.0022
    base_z = top - 0.002
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=cr, depth=band, location=(0, 0, base_z + band / 2))
    col = bpy.context.object; col.data.materials.append(mats['metal'])
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=cr * 1.12, depth=0.0012, location=(0, 0, base_z + band + 0.0006))
    lip = bpy.context.object; lip.data.materials.append(mats['metal'])
    bpy.ops.object.shade_smooth()
    parts += [col, lip]
    per = round((2 * math.pi * cr) / 0.0021)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.001)
    proto = bpy.context.object
    proto.scale = (1, 1, 0.7)
    proto.data.materials.append(mats['crystal'])
    for k in range(rows):
        for i in range(per):
            a = ((i + (k % 2) * 0.5) / per) * math.pi * 2
            c = proto.copy()
            c.location = (math.sin(a) * (cr + 0.0003), -math.cos(a) * (cr + 0.0003), base_z + 0.0012 + k * 0.0022)
            c.rotation_euler = (math.pi / 2, 0, a)
            bpy.context.collection.objects.link(c)
            parts.append(c)
    bpy.data.objects.remove(proto)

    # The stone stopper.
    st = cut['stone']
    so = st.get('opts', {})
    bm = bmesh.new()
    gem_bmesh(bm, st['rings'], st['n'], so.get('sx', 1), so.get('sz', 1), so.get('rot', 0))
    s = mesh_obj('stone', bm, mats['stone'])
    s.location.z = base_z + band + 0.0012
    bevel(s, 0.0002)
    parts.append(s)

    root = bpy.data.objects.new('bottle', None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
        p.visible_shadow = True
        p.cycles.is_caustics_caster = True
    root.location = where[0]
    root.rotation_euler = (0, 0, where[1])
    return root


def bottle_mats(sc):
    rgb = hex_rgb(sc['glass'])
    stone = sc['stone']
    if stone == 'onyx':
        stone_m = principled('onyx', color=(0.01, 0.009, 0.01), rough=0.04, coat=1.0)
    else:
        srgb = hex_rgb(stone)
        srgb = tuple(c ** 0.6 for c in srgb)
        stone_m = glass('stone', color=tuple(0.35 + 0.65 * c for c in srgb), ior=1.72, disp=0.6)
        vol = stone_m.node_tree.nodes.new('ShaderNodeVolumeAbsorption')
        vol.inputs['Color'].default_value = (*srgb, 1)
        vol.inputs['Density'].default_value = 40
        stone_m.node_tree.links.new(vol.outputs[0], stone_m.node_tree.nodes['Material Output'].inputs['Volume'])
    return {
        'glass': glass('glass', ior=1.52, disp=0.25),
        'liquid': liquid('liquid', rgb),
        'stone': stone_m,
        'metal': principled('metal', color=METAL[sc['metal']], metal=1.0, rough=0.14),
        'crystal': glass('crystal', ior=2.3, disp=1.0),
    }


# --- Set ---------------------------------------------------------------------------------------------------------
def build_set(hero):
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(principled('stone_floor', color=(0.012, 0.009, 0.01), rough=0.07))
    floor.cycles.is_caustics_receiver = True
    # Wall: a curved backdrop behind the shelf.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.6, 0.45))
    wall = bpy.context.object
    wall.scale = (3.2, 1, 0.9)
    wall.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    wall.data.materials.append(wall_material())
    # Tall slits of light in the wall. They show in the glass as long bright reflections and refractions.
    slit = emitter('slit', (1.0, 0.88, 0.76), 2.5)
    for x in ([-0.42, -0.14, 0.14, 0.42] if hero else [-0.12, 0.12]):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 0.58, 0.42))
        o = bpy.context.object
        o.scale = (0.01, 1, 0.75)
        o.rotation_euler = (math.pi / 2, 0, 0)
        o.data.materials.append(slit)
        o.visible_camera = False  # seen only through the glass, never as a bar in the picture or the floor
        o.visible_glossy = False

    world = bpy.context.scene.world or bpy.data.worlds.new('w')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.003, 0.003, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1

    def area(name, loc, rot, size, color, power, caustics=False, shape='RECTANGLE', size_y=None):
        d = bpy.data.lights.new(name, 'AREA')
        d.shape = shape
        d.size = size
        if size_y:
            d.size_y = size_y
        d.color = color
        d.energy = power
        d.cycles.is_caustics_light = caustics
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        o.visible_camera = False
        bpy.context.collection.objects.link(o)
        return o

    # Warm light behind and above: it passes through the bottles and lays their color on the stone.
    sp = bpy.data.lights.new('back', 'SPOT')
    sp.energy = 60 if hero else 30
    sp.color = (1.0, 0.78, 0.55)
    sp.spot_size = math.radians(70)
    sp.spot_blend = 0.6
    sp.shadow_soft_size = 0.01
    sp.cycles.is_caustics_light = True
    spo = bpy.data.objects.new('back', sp)
    spo.location = (0, 0.42, 0.36)
    spo.rotation_euler = (math.radians(-55), 0, 0)
    bpy.context.collection.objects.link(spo)
    # Soft key from the front left and two tall strips for edge highlights.
    area('key', (-0.45, -0.55, 0.55), (math.radians(55), 0, math.radians(-38)), 1.0, (1.0, 0.95, 0.9), 16)
    area('stripL', (-0.32, -0.05, 0.14), (math.radians(90), 0, math.radians(-90)), 0.03, (1, 0.96, 0.92), 6, size_y=0.5)
    area('stripR', (0.32, -0.05, 0.14), (math.radians(90), 0, math.radians(90)), 0.03, (1, 0.9, 0.8), 5, size_y=0.5)
    area('top', (0, 0, 0.7), (0, 0, 0), 0.9, (1, 1, 1), 1.2)


def camera(loc, target, lens):
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    cam.dof.use_dof = True
    o = bpy.data.objects.new('cam', cam)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.dof.focus_distance = d.length
    cam.dof.aperture_fstop = 5.6
    bpy.context.scene.camera = o
    return o


def setup_render(res_x, res_y, samples):
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
        print('GPU unavailable, using CPU', e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 24
    sc.cycles.transmission_bounces = 24
    sc.cycles.glossy_bounces = 8
    sc.cycles.volume_bounces = 4
    sc.cycles.caustics_reflective = True
    sc.cycles.caustics_refractive = True
    sc.cycles.blur_glossy = 0.4
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'


def main():
    a = args()
    data = json.load(open(a['json']))
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    mode = a.get('mode', 'product')
    samples = int(a.get('samples', 384))
    if mode == 'hero':
        order = data['order']
        spacing = 0.115
        for i, h in enumerate(order):
            sc = data['scents'][h]
            k = i - 2
            build_bottle(data['cuts'][sc['shape']], sc, ((k * spacing, k * k * 0.012, 0), math.radians(-8 * k)), bottle_mats(sc))
        build_set(True)
        camera((0, -0.86, 0.14), (0, 0, 0.1), 58)
        setup_render(int(a.get('w', 2400)), int(a.get('h', 1500)), samples)
    else:
        sc = data['scents'][a['handle']]
        build_bottle(data['cuts'][sc['shape']], sc, ((0, 0, 0), math.radians(float(a.get('turn', -18)))), bottle_mats(sc))
        build_set(False)
        cut = data['cuts'][sc['shape']]
        h = cut['top'] + 0.05
        camera((0.03, -0.46, 0.09), (0, 0, h * 0.5), 85)
        setup_render(int(a.get('w', 1200)), int(a.get('h', 1500)), samples)
    out = os.path.abspath(a['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


main()
