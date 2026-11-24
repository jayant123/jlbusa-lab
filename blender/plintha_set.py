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
LOD = {'high': dict(seg=3, cuts=2, sub=2), 'mid': dict(seg=2, cuts=2, sub=1), 'low': dict(seg=1, cuts=1, sub=1)}
SUB = [2]  # smoothing level for soft_box, set per LOD in module()
TEX_MEAN = {'Fabric085': 0.40, 'Fabric032': 0.88}  # mean brightness of each scan, so a tint lands on its color


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
            color_mult = tuple(min(4.0, c / TEX_MEAN.get(base, 0.5)) for c in color_mult)
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


def soft_box(name, x0, x1, y0, y1, z0, z1, r, crown, mat, seg, cuts, bulge=None, tilt=0.0):
    """Upholstered cushion: every face pillows outward (most on top and front), then the edges round off.
    tilt leans the cushion back (radians, around its bottom-front edge)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    w, d, h = (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2
    b = bulge if bulge is not None else crown * 0.55
    for v in bm.verts:
        u, q, t = v.co.x * 2, v.co.y * 2, v.co.z * 2  # -1..1 on each axis
        x, y, z = cx + u * w, cy + q * d, cz + t * h
        pu, pq, pt = max(0, 1 - u * u), max(0, 1 - q * q), max(0, 1 - t * t)
        if abs(u) > 0.999: x += math.copysign(b * pq * pt, u)
        if abs(q) > 0.999: y += math.copysign((crown * 0.8 if q < 0 else b) * pu * pt, q)
        if abs(t) > 0.999: z += math.copysign((crown if t > 0 else b * 0.3) * pu * pq, t)
        v.co.x, v.co.y, v.co.z = x, y, z
    if tilt:
        for v in bm.verts:
            ry, rz = v.co.y - y0, v.co.z - z0  # rotate around the front-bottom edge (y0, z0), leaning toward +y
            v.co.y = y0 + ry * math.cos(tilt) + rz * math.sin(tilt)
            v.co.z = z0 - ry * math.sin(tilt) + rz * math.cos(tilt)
    # Keep the pillowed shape inside its footprint so modules still meet edge to edge.
    for axis, lo, hi in ((0, x0, x1), (1, y0, y1)):
        vals = [v.co[axis] for v in bm.verts]
        a, b2 = min(vals), max(vals)
        for v in bm.verts:
            v.co[axis] = lo + (v.co[axis] - a) / (b2 - a) * (hi - lo)
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.35]
    bmesh.ops.bevel(bm, geom=edges, offset=r, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat)
    if SUB[0]:
        m = o.modifiers.new('Soft', 'SUBSURF')
        m.levels = m.render_levels = SUB[0]
    return o


def plinth(name, W, D, mat):
    o = C.extrude_poly(name, [(0.035, -D + 0.035), (W - 0.035, -D + 0.035), (W - 0.035, -0.035), (0.035, -0.035)], 0.0, 0.07, mat)
    C.bevel(o, 0.004, 1)
    return o


def module(kind, m, lod):
    """Low and deep: a dark oak plinth, a firm base, a thick seat cushion and a loose back pillow leaning back."""
    W, D = FOOT[kind]
    s_, c = LOD[lod]['seg'], LOD[lod]['cuts']
    SUB[0] = LOD[lod]['sub']
    up = m['up']
    parts = [plinth(f'{kind}_plinth', W, D, m['oak']), soft_box(f'{kind}_base', 0.002, W - 0.002, -D + 0.002, -0.002, 0.07, 0.25, 0.05, 0.006, up, s_, c, bulge=0.004)]
    arm = 0.21
    al = arm if kind == 'arm_left' else 0.0
    ar = arm if kind == 'arm_right' else 0.0
    seat = dict(r=0.1, crown=0.045, bulge=0.022)
    back = dict(r=0.11, crown=0.018, bulge=0.04)
    if kind == 'ottoman':
        parts.append(soft_box('ottoman_seat', 0.01, W - 0.01, -D + 0.01, -0.01, 0.245, 0.43, mat=up, seg=s_, cuts=c, **seat))
    elif kind == 'corner':
        parts += [soft_box('corner_seat', 0.012, W - 0.27, -D + 0.02, -0.27, 0.245, 0.43, mat=up, seg=s_, cuts=c, **seat),
                  soft_box('corner_back', 0.01, W - 0.01, -0.27, -0.08, 0.25, 0.80, mat=up, seg=s_, cuts=c, tilt=0.12, **back),
                  soft_box('corner_side', W - 0.27, W - 0.02, -D + 0.04, -0.27, 0.25, 0.80, mat=up, seg=s_, cuts=c, **back)]
    else:
        depth_back = -0.27
        parts += [soft_box(f'{kind}_seat', al + 0.012, W - ar - 0.012, -D + 0.02, depth_back, 0.245, 0.43, mat=up, seg=s_, cuts=c, **seat),
                  soft_box(f'{kind}_back', al + 0.012, W - ar - 0.012, depth_back, -0.08, 0.25, 0.80, mat=up, seg=s_, cuts=c, tilt=0.12, **back)]
        if kind == 'chaise':
            parts[-1].scale.z = 1.0
        if al:
            parts.append(soft_box('arm_l', 0.0, arm, -D + 0.005, -0.005, 0.07, 0.64, 0.1, 0.012, up, s_, c, bulge=0.03))
        if ar:
            parts.append(soft_box('arm_r', W - arm, W, -D + 0.005, -0.005, 0.07, 0.64, 0.1, 0.012, up, s_, c, bulge=0.03))
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


def rounded_rect(w, d, r, n=10):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def room(lod):
    """Gallery room: travertine slabs, plaster walls with two tall windows on the left, a stone bench.
    Loose pieces (rug, side table, floor lamp) are separate nodes so the page can place them around any layout."""
    tr = tex_material('travertine', 'Travertine009', (1.0, 0.97, 0.92), 0.5, scale=0.35, normal_strength=0.3)
    pl = tex_material('plaster', 'Plaster001', (0.93, 0.91, 0.87), 0.9, scale=0.5, normal_strength=0.4)
    grout = C.material('grout', (0.36, 0.33, 0.30), roughness=0.9)
    slabs = [C.extrude_poly('floor_base', [(-6.0, -9.0), (12.0, -9.0), (12.0, 1.2), (-6.0, 1.2)], -0.03, -0.004, grout)]
    sw, sd, gap = 1.2, 0.6, 0.004
    y = 1.2
    row = 0
    while y > -9.0:
        x = -6.0 - (sw / 2 if row % 2 else 0)
        while x < 12.0:
            x0, x1 = max(-6.0, x + gap), min(12.0, x + sw - gap)
            y0, y1 = max(-9.0, y - sd + gap), y - gap
            if x1 > x0 and y1 > y0:
                slabs.append(C.extrude_poly(f'slab{row}_{x:.1f}', [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], -0.004, 0.0, tr))
            x += sw
        y -= sd
        row += 1
    for o in slabs[1:]:
        world_uv(o)
    floor = C.join('floor', slabs)
    back = C.extrude_poly('back_wall', [(-6.0, 0.6), (12.0, 0.6), (12.0, 0.75), (-6.0, 0.75)], 0.0, 5.0, pl)
    # Left wall with two tall window openings (sunlight enters here in the day scene).
    lw = []
    edges = [-4.5, -3.7, -2.5, -2.0, -0.8, 0.75]  # wall, window, wall, window, wall
    for i in range(len(edges) - 1):
        y0, y1 = edges[i], edges[i + 1]
        if i in (1, 3):
            lw.append(C.extrude_poly(f'sill{i}', [(-1.6, y0), (-1.45, y0), (-1.45, y1), (-1.6, y1)], 0.0, 0.35, pl))
            lw.append(C.extrude_poly(f'head{i}', [(-1.6, y0), (-1.45, y0), (-1.45, y1), (-1.6, y1)], 2.85, 3.4, pl))
        else:
            lw.append(C.extrude_poly(f'pier{i}', [(-1.6, y0), (-1.45, y0), (-1.45, y1), (-1.6, y1)], 0.0, 3.4, pl))
    bench = C.extrude_poly('stone_bench', [(4.6, 0.12), (6.6, 0.12), (6.6, 0.58), (4.6, 0.58)], 0.0, 0.40, tr)
    C.bevel(bench, 0.008, 2)
    for o in (back, bench, *lw):
        world_uv(o)
    walls = C.join('walls', [back, bench, *lw])

    rugm = tex_material('rug', 'Fabric085', (0.50, 0.47, 0.42), 0.95, scale=3.0, normal_strength=1.0, gray=True)
    rug = C.extrude_poly('rug', rounded_rect(3.4, 2.5, 0.06), 0.0, 0.012, rugm, smooth=False)
    world_uv(rug)
    table = C.lathe('side_table', [(0, 0.0), (0.16, 0.0), (0.16, 0.012), (0.12, 0.03), (0.12, 0.40), (0.25, 0.40), (0.255, 0.405),
                                   (0.255, 0.445), (0.25, 0.45), (0, 0.45)], 48 if lod == 'high' else 24, tr)
    world_uv(table)
    steel = C.material('lamp_steel', (0.03, 0.03, 0.03), metallic=1.0, roughness=0.35)
    shade = C.material('lamp_shade', (0.93, 0.90, 0.84), roughness=0.8)
    pole = C.lathe('lamp_pole', [(0, 0.0), (0.14, 0.0), (0.14, 0.015), (0.012, 0.02), (0.012, 1.50), (0, 1.50)], 24, steel)
    sh = C.lathe('lamp_shade_mesh', [(0.06, 1.38), (0.22, 1.38), (0.17, 1.62), (0.05, 1.62)], 48 if lod == 'high' else 24, shade)
    lamp = C.join('floor_lamp', [pole, sh])
    return {'floor': floor, 'walls': walls, 'rug': rug, 'side_table': table, 'floor_lamp': lamp}


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
