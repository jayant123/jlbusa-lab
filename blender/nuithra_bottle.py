"""NUITHRA 50 ml bottle: a heavy glass slab with deep rounded edges, a thick base, a gold collar and a fluted cap.

blender -b -P blender/nuithra_bottle.py -- --lod high|low --out build/bottle-high.raw.glb

Origin = centre of the base on the floor, Z up (Y up in glTF). Meters. Other sizes are scaled at runtime.
Nodes: glass (outer body and neck), liquid, collar, cap.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

W, D, H = 0.056, 0.036, 0.090
BASE = 0.014  # solid glass under the juice
LOD = {'high': dict(seg=8, flutes=40, sub=2), 'low': dict(seg=4, flutes=24, sub=1)}


def rounded_box(name, w, d, h, z0, r_side, r_top, seg, mat, sub):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z = z0 + (v.co.z + 0.5) * h
    vertical = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
    bmesh.ops.bevel(bm, geom=vertical, offset=r_side, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    flat = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6 and len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.5]
    bmesh.ops.bevel(bm, geom=flat, offset=r_top, segments=max(2, seg // 2), profile=0.5, affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat)
    if sub:
        m = o.modifiers.new('Soft', 'SUBSURF')
        m.levels = m.render_levels = sub
    return o


def fluted_cap(name, r, z0, h, flutes, mat, seg):
    pts = []
    n = flutes * 6
    for i in range(n):
        a = 2 * math.pi * i / n
        depth = 0.0008 * (0.5 - 0.5 * math.cos(2 * math.pi * (i % 6) / 6))  # shallow rounded grooves
        rr = r - depth
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    o = C.extrude_poly(name, pts, z0, z0 + h, mat, smooth=True)
    bev = o.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.0016
    bev.segments = seg
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(60)
    return o


def build(lod='high'):
    p = LOD[lod]
    glass = C.material('glass_bottle', (1, 1, 1), roughness=0.03, transmission=1.0, ior=1.5)
    juice = C.material('liquid', (0.8, 0.45, 0.12), roughness=0.05, transmission=1.0, ior=1.34)
    gold = C.material('gold_collar', (0.86, 0.66, 0.38), metallic=1.0, roughness=0.22)
    lacquer = C.material('cap_lacquer', (0.055, 0.012, 0.042), roughness=0.28, coat=1.0, coat_roughness=0.05)
    body = rounded_box('body', W, D, H, 0.0, 0.0115, 0.006, p['seg'], glass, p['sub'])
    neck = C.lathe('neck', [(0, H - 0.002), (0.0075, H - 0.002), (0.0075, H + 0.009), (0.0062, H + 0.010), (0, H + 0.010)], 48, glass)
    glass_o = C.join('glass', [body, neck])
    liquid = rounded_box('liquid', W - 0.012, D - 0.012, (H - BASE - 0.010) * 0.86, BASE, 0.0075, 0.003, p['seg'], juice, p['sub'])
    collar = C.lathe('collar', [(0.0, H + 0.006), (0.0098, H + 0.006), (0.0102, H + 0.0072), (0.0102, H + 0.0118), (0.0098, H + 0.013), (0.0, H + 0.013)], 64, gold)
    cap = fluted_cap('cap', 0.0165, H + 0.013, 0.038, p['flutes'], lacquer, 3)
    return {'glass': glass_o, 'liquid': liquid, 'collar': collar, 'cap': cap}


if __name__ == '__main__':
    a = C.args()
    lod = a.get('lod', 'high')
    C.reset()
    objs = build(lod)
    out = os.path.abspath(a.get('out', f'build/bottle-{lod}.raw.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.export_glb(out, list(objs.values()), images=False)
    print('EXPORTED', out, sorted(objs))
