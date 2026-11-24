"""Shared Blender helpers for the concept models (Blender 5.x, run headless: blender -b -P <script> -- args)."""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {}
    for i, k in enumerate(a):
        if k.startswith('--'):
            out[k[2:]] = a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith('--') else True
    return out


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.unit_settings.scale_length = 1.0
    return s


def set_input(node, names, value):
    for n in names if isinstance(names, (list, tuple)) else [names]:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def material(name, color=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.5, transmission=0.0, ior=1.5,
             coat=0.0, coat_roughness=0.03, anisotropic=0.0, emission=None, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    set_input(p, 'Base Color', (*color, 1.0))
    set_input(p, 'Metallic', metallic)
    set_input(p, 'Roughness', roughness)
    set_input(p, ['Transmission Weight', 'Transmission'], transmission)
    set_input(p, 'IOR', ior)
    set_input(p, ['Coat Weight', 'Clearcoat'], coat)
    set_input(p, ['Coat Roughness', 'Clearcoat Roughness'], coat_roughness)
    set_input(p, 'Anisotropic', anisotropic)
    set_input(p, 'Alpha', alpha)
    if emission:
        set_input(p, ['Emission Color', 'Emission'], (*emission[0], 1.0))
        set_input(p, 'Emission Strength', emission[1])
    return m


def obj_from_bmesh(name, bm, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if mat:
        o.data.materials.append(mat)
    return o


def profile_ring(name, outer, inner, z0, z1, seg, mat=None, chamfer=0.0):
    """A ring (tube) between radii inner..outer and heights z0..z1, optional top/bottom outer chamfer."""
    bm = bmesh.new()
    pts = [(inner, z0), (outer - chamfer, z0), (outer, z0 + chamfer), (outer, z1 - chamfer), (outer - chamfer, z1), (inner, z1)]
    if inner <= 0:
        pts = [(0, z0), (outer - chamfer, z0), (outer, z0 + chamfer), (outer, z1 - chamfer), (outer - chamfer, z1), (0, z1)]
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in pts])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for k in range(len(pts)):
            k2 = (k + 1) % len(pts)
            if inner <= 0 and k == len(pts) - 1:
                continue
            try:
                bm.faces.new((r0[k], r1[k], r1[k2], r0[k2]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bmesh(name, bm, mat)


def lathe(name, pts, seg, mat=None):
    """Revolve a list of (r, z) points around Z."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in pts])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for k in range(len(pts) - 1):
            try:
                bm.faces.new((r0[k], r1[k], r1[k + 1], r0[k + 1]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bmesh(name, bm, mat)


def extrude_poly(name, pts2d, z0, z1, mat=None, smooth=False):
    """Extrude a closed 2D polygon (counter-clockwise) between z0 and z1."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, z0)) for x, y in pts2d]
    top = [bm.verts.new((x, y, z1)) for x, y in pts2d]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    n = len(pts2d)
    for i in range(n):
        bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bmesh(name, bm, mat, smooth=smooth)


def gear(name, teeth, r_root, r_tip, z0, z1, mat=None, hub=0.0, spokes=0):
    """Spur gear outline (trapezoid teeth) extruded; optional hub hole is skipped for low poly."""
    pts = []
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        w = 2 * math.pi / teeth
        pts += [(r_root * math.cos(a), r_root * math.sin(a)),
                (r_tip * math.cos(a + w * 0.2), r_tip * math.sin(a + w * 0.2)),
                (r_tip * math.cos(a + w * 0.45), r_tip * math.sin(a + w * 0.45)),
                (r_root * math.cos(a + w * 0.65), r_root * math.sin(a + w * 0.65))]
    return extrude_poly(name, pts, z0, z1, mat)


def bevel(o, width, segments=2):
    m = o.modifiers.new('Bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(35)
    m.harden_normals = False
    return m


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def apply_all(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')


def text_mesh(name, body, font_path, size, z, mat=None, extrude=0.00005, y=0.0, letter_spacing=1.0):
    font = bpy.data.fonts.load(font_path, check_existing=True)
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = font
    cu.size = size
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = letter_spacing
    cu.resolution_u = 3
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.location = (0, y, z)
    if mat:
        o.data.materials.append(mat)
    apply_all(o)
    return bpy.context.view_layer.objects.active


def export_glb(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_normals=True,
                              export_texcoords=True, export_animations=False, export_extras=False)
