"""PLINTHA modular sofa set and room. Every module stands on a recessed dark oak plinth (the brand's idea).

blender -b -P blender/plintha_set.py -- --lod high|mid|low --what modules|room --out build/x.glb

Module origin = back-left floor corner; width along +X, depth toward the front (-Y in Blender, +Z in glTF).
Materials: 'upholstery' (fabric, tiled in world meters; swapped at runtime), 'oak_plinth', room 'travertine', 'plaster'.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

TEX = os.path.join(os.path.dirname(__file__), 'textures')
FOOT = {'armless': (0.90, 1.00), 'corner': (1.00, 1.00), 'arm_left': (1.05, 1.00), 'arm_right': (1.05, 1.00), 'chaise': (0.90, 1.65), 'ottoman': (0.90, 0.90)}
LOD = {'high': dict(seg=5, cuts=6), 'mid': dict(seg=3, cuts=4), 'low': dict(seg=2, cuts=2)}


def tex_material(name, base, color_mult=(1, 1, 1), rough=0.8, scale=1.0, normal_strength=0.6, gray=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs['UV'], mapping.inputs['Vector'])
    col = os.path.join(TEX, f'{base}_1K-JPG_Color.jpg')
    if os.path.exists(col):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(col, check_existing=True)
        nt.links.new(mapping.outputs['Vector'], t.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        if gray:  # fabric scans: keep only their weave; the color comes from the tint
            bw = nt.nodes.new('ShaderNodeRGBToBW')
            nt.links.new(t.outputs['Color'], bw.inputs['Color'])
            nt.links.new(bw.outputs['Val'], mix.inputs[6])
            color_mult = tuple(min(4.0, c * 1.9) for c in color_mult)
        else:
            nt.links.new(t.outputs['Color'], mix.inputs[6])
        mix.inputs[7].default_value = (*color_mult, 1)
        nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    nrm = os.path.join(TEX, f'{base}_1K-JPG_NormalGL.jpg')
    if os.path.exists(nrm):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(nrm, check_existing=True)
        t.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(mapping.outputs['Vector'], t.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = rough
    return m


FABRICS = {  # name: (texture, tint, roughness, sheen)
    'Boucle Chalk': ('Fabric085', (0.93, 0.91, 0.86), 0.95),
    'Wool Moss': ('Fabric085', (0.42, 0.47, 0.33), 0.92),
    'Linen Sand': ('Fabric032', (0.80, 0.72, 0.58), 0.85),
    'Velvet Ink': ('Fabric032', (0.10, 0.13, 0.22), 0.55),
}


def soft_box(name, x0, x1, y0, y1, z0, z1, r, crown, mat, seg, cuts):
    """Upholstered box: rounded edges, a gentle crown on top and on the front face."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co.x = x0 + (v.co.x + 0.5) * (x1 - x0)
        v.co.y = y0 + (v.co.y + 0.5) * (y1 - y0)
        v.co.z = z0 + (v.co.z + 0.5) * (z1 - z0)
    cx, cy, w, d = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    for v in bm.verts:
        u, q = (v.co.x - cx) / w, (v.co.y - cy) / d
        if v.co.z > z1 - 1e-6:
            v.co.z += crown * max(0, 1 - u * u) * max(0, 1 - q * q)
        if v.co.y < y0 + 1e-6:  # front face bulges forward a little
            t = (v.co.z - z0) / (z1 - z0)
            v.co.y -= crown * 0.6 * max(0, 1 - u * u) * math.sin(math.pi * min(1, max(0, t)))
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.5]
    bmesh.ops.bevel(bm, geom=edges, offset=r, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C.obj_from_bmesh(name, bm, mat)


def plinth(name, W, D, mat):
    o = C.extrude_poly(name, [(0.035, -D + 0.035), (W - 0.035, -D + 0.035), (W - 0.035, -0.035), (0.035, -0.035)], 0.0, 0.07, mat)
    C.bevel(o, 0.004, 1)
    return o


def module(kind, m, lod):
    W, D = FOOT[kind]
    s, c = LOD[lod]['seg'], LOD[lod]['cuts']
    up = m['up']
    parts = [plinth(f'{kind}_plinth', W, D, m['oak']), soft_box(f'{kind}_base', 0, W, -D, 0, 0.07, 0.27, 0.045, 0.004, up, s, c)]
    al = 0.15 if kind == 'arm_left' else 0.0
    ar = 0.15 if kind == 'arm_right' else 0.0
    if kind == 'ottoman':
        parts.append(soft_box('ottoman_seat', 0.01, W - 0.01, -D + 0.01, -0.01, 0.27, 0.45, 0.085, 0.032, up, s, c))
    elif kind == 'corner':
        parts += [soft_box('corner_seat', 0.01, W - 0.25, -D + 0.02, -0.25, 0.27, 0.45, 0.085, 0.032, up, s, c),
                  soft_box('corner_back', 0.01, W - 0.01, -0.24, -0.01, 0.27, 0.75, 0.11, 0.045, up, s, c),
                  soft_box('corner_side', W - 0.24, W - 0.01, -D + 0.02, -0.25, 0.27, 0.75, 0.11, 0.045, up, s, c)]
    else:
        parts += [soft_box(f'{kind}_seat', al + 0.01, W - ar - 0.01, -D + 0.02, -0.25, 0.27, 0.45, 0.085, 0.032, up, s, c),
                  soft_box(f'{kind}_back', al + 0.01, W - ar - 0.01, -0.24, -0.01, 0.27, 0.75, 0.11, 0.045, up, s, c)]
        if al:
            parts.append(soft_box('arm_l', 0.0, 0.15, -D, 0, 0.07, 0.60, 0.07, 0.015, up, s, c))
        if ar:
            parts.append(soft_box('arm_r', W - 0.15, W, -D, 0, 0.07, 0.60, 0.07, 0.015, up, s, c))
    o = C.join(kind, parts)
    world_uv(o)
    return o


def world_uv(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=0.5, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def mats(fabric='Boucle Chalk'):
    tex, tint, rough = FABRICS[fabric]
    return {
        'up': tex_material('upholstery', tex, tint, rough, scale=1.0, normal_strength=0.8, gray=True),
        'oak': C.material('oak_plinth', (0.06, 0.04, 0.03), roughness=0.45),
    }


def room(lod):
    tr = tex_material('travertine', 'Travertine009', (1.0, 0.97, 0.92), 0.55, scale=0.5, normal_strength=0.3)
    pl = tex_material('plaster', 'Plaster001', (0.93, 0.90, 0.85), 0.9, scale=0.5, normal_strength=0.4)
    floor = C.extrude_poly('floor', [(-6.0, -9.0), (12.0, -9.0), (12.0, 1.2), (-6.0, 1.2)], -0.02, 0.0, tr)
    back = C.extrude_poly('back_wall', [(-6.0, 0.6), (12.0, 0.6), (12.0, 0.75), (-6.0, 0.75)], 0.0, 5.0, pl)
    left = C.extrude_poly('left_wall', [(-1.6, -4.5), (-1.45, -4.5), (-1.45, 0.75), (-1.6, 0.75)], 0.0, 3.4, pl)
    step = C.extrude_poly('stone_ledge', [(2.9, 0.1), (5.4, 0.1), (5.4, 0.6), (2.9, 0.6)], 0.0, 0.42, tr)
    C.bevel(step, 0.01, 2)
    for o in (floor, back, left, step):
        world_uv(o)
    walls = C.join('walls', [back, left, step])
    return {'floor': floor, 'walls': walls}


if __name__ == '__main__':
    a = C.args()
    lod, what = a.get('lod', 'high'), a.get('what', 'modules')
    C.reset()
    if what == 'modules':
        m = mats()
        objs = {k: module(k, m, lod) for k in FOOT}
    else:
        objs = room(lod)
    out = os.path.abspath(a.get('out', f'build/{what}-{lod}.raw.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.export_glb(out, list(objs.values()), images=False)
    print('EXPORTED', out, sorted(objs))
