"""SERAVEL jewelry: the Solace ring, the Halo pendant and the Tide hoops.

blender -b -P blender/seravel_jewelry.py -- --piece ring|pendant|hoops --lod high|low --out build/ring-high.raw.glb

Meters. Blender Z up (glTF Y up). Ring: the band stands in the XZ plane with the stone on top, facing the camera on -Y.
Node names the page relies on: ring = band, head, stone. pendant = setting, stone, halo, chain. hoops = hoop.
Materials: metal, stone, pave. The page recolors them per option.
The build functions are imported by seravel_photos.py so the photos use the same geometry.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

LOD = {'high': dict(seg=160, prof=10, sub=2, tube=48, curve=6, link=(14, 8), hoop=(2800, 72)),
       'low': dict(seg=72, prof=6, sub=1, tube=20, curve=3, link=(8, 5), hoop=(240, 14))}

RING_R = 0.00865      # inner radius, US size 7 (17.3 mm)
BAND_T = 0.00165      # band thickness
BAND_W = 0.0021       # band width
STONE_D = 0.0065      # 1 carat round brilliant


def mats():
    return {
        'metal': C.material('metal', (0.95, 0.78, 0.42), metallic=1.0, roughness=0.12),
        'stone': C.material('stone', (1, 1, 1), transmission=1.0, ior=2.42, roughness=0.0),
        'pave': C.material('pave', (1, 1, 1), transmission=1.0, ior=2.42, roughness=0.0),
    }


# --- Stones ------------------------------------------------------------------------------------------------------
def brilliant(name, d, mat, table_up=True):
    """A round brilliant from the convex hull of its facet corners: table, stars, upper girdle, girdle, lower girdle, culet.
    Proportions follow a standard round brilliant: table 57 %, crown 16 %, pavilion 43 % of the diameter."""
    r = d / 2
    crown, pav, girdle = 0.16 * d, 0.43 * d, 0.012 * d
    pts = []
    for i in range(8):  # table
        a = (i / 8) * math.tau
        pts.append((0.57 * r * math.cos(a), 0.57 * r * math.sin(a), girdle / 2 + crown))
    for i in range(8):  # star facet tips sit between the table corners
        a = ((i + 0.5) / 8) * math.tau
        pts.append((0.78 * r * math.cos(a), 0.78 * r * math.sin(a), girdle / 2 + crown * 0.55))
    for i in range(16):  # girdle, top and bottom
        a = (i / 16) * math.tau
        pts.append((r * math.cos(a), r * math.sin(a), girdle / 2))
        pts.append((r * math.cos(a), r * math.sin(a), -girdle / 2))
    for i in range(8):  # lower girdle facets
        a = ((i + 0.5) / 8) * math.tau
        pts.append((0.6 * r * math.cos(a), 0.6 * r * math.sin(a), -girdle / 2 - pav * 0.55))
    pts.append((0, 0, -girdle / 2 - pav))  # culet
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.delete(bm, geom=[g for g in res['geom_interior'] + res['geom_unused'] if g.is_valid], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat, smooth=False)
    if not table_up:
        o.rotation_euler = (math.radians(-90), 0, 0)
    return o


def stone_dims(d):
    return {'crown': 0.16 * d + 0.006 * d, 'pav': 0.43 * d + 0.006 * d}


# --- Ring --------------------------------------------------------------------------------------------------------
def revolve_closed(name, prof, seg, mat, axis='Y'):
    """Revolve a closed (r, h) profile around the Y axis. The band then lies in the XZ plane."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = (i / seg) * math.tau
        rings.append([bm.verts.new((r * math.cos(a), h, r * math.sin(a))) for r, h in prof])
    n = len(prof)
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for k in range(n):
            bm.faces.new((A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C.obj_from_bmesh(name, bm, mat)


def band_profile(steps):
    """Comfort fit: a softly domed outside, a gently rounded inside, rounded corners."""
    pts = []
    w, t = BAND_W / 2, BAND_T
    for i in range(steps + 1):  # outside dome, left to right
        u = i / steps
        y = -w + 2 * w * u
        pts.append((RING_R + t - 0.00025 * (2 * u - 1) ** 2, y))
    for i in range(steps + 1):  # inside, right to left, slightly convex toward the finger
        u = i / steps
        y = w - 2 * w * u
        pts.append((RING_R + 0.00012 * (1 - (2 * u - 1) ** 2), y))
    return pts


def tube_along(name, pts, radius, mat, res, taper=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
        if taper:
            sp.points[i].radius = taper[i]
    sp.use_endpoint_u = True
    sp.order_u = 3
    sp.resolution_u = 10
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def ring(lod='high', m=None):
    p = LOD[lod]
    m = m or mats()
    band = revolve_closed('band', band_profile(p['prof']), p['seg'], m['metal'])
    sub = band.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = p['sub']
    top = RING_R + BAND_T
    sd = stone_dims(STONE_D)
    zg = top + sd['pav'] + 0.0007  # girdle height
    stone = brilliant('stone', STONE_D, m['stone'])
    stone.location = (0, 0, zg)
    r = STONE_D / 2
    parts = []
    # Four claws. Each one leaves the shoulder of the band, rises past the pavilion to the girdle and bends
    # over the crown in a small rounded tip. Seen from the side they make a tulip shape.
    for i in range(4):
        a = math.radians(45 + 90 * i)
        ca, sa = math.cos(a), math.sin(a)
        base = 0.0016
        path = [(base * ca, base * sa * 0.55, top - 0.00035), (r * 0.62 * ca, r * 0.62 * sa, zg - sd['pav'] * 0.5),
                (r * 0.98 * ca, r * 0.98 * sa, zg - 0.00025), (r * 1.03 * ca, r * 1.03 * sa, zg + 0.0004),
                (r * 0.93 * ca, r * 0.93 * sa, zg + 0.00085)]
        parts.append(tube_along(f'claw{i}', path, 0.0003, m['metal'], p['curve'], taper=[1.3, 1.0, 0.85, 0.75, 0.62]))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=p['tube'] // 2, ring_count=p['tube'] // 4, radius=0.00021,
                                             location=(r * 0.93 * ca, r * 0.93 * sa, zg + 0.00085))
        tip = bpy.context.object
        tip.data.materials.append(m['metal'])
        bpy.ops.object.shade_smooth()
        parts.append(tip)
    # One fine rail under the girdle ties the claws together.
    bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.8, minor_radius=0.00022, major_segments=p['seg'] // 2, minor_segments=p['tube'] // 3, location=(0, 0, zg - 0.0011))
    t_o = bpy.context.object
    t_o.data.materials.append(m['metal'])
    bpy.ops.object.shade_smooth()
    parts.append(t_o)
    head = C.join('head', parts)
    bpy.ops.object.shade_smooth()
    return {'band': band, 'head': head, 'stone': stone}


# --- Pendant -----------------------------------------------------------------------------------------------------
def pendant(lod='high', m=None):
    p = LOD[lod]
    m = m or mats()
    d = 0.0052
    cz = 0.0
    stone = brilliant('stone', d, m['stone'])
    stone.rotation_euler = (math.radians(-90), 0, 0)  # table faces the camera (-Y)
    stone.location = (0, 0, cz)
    parts = []
    # Bezel around the center stone, a halo ring of small stones, and a bail on top.
    for (R, t, y) in [(d / 2 + 0.00018, 0.0003, 0.0002), (d / 2 + 0.0015, 0.0005, 0.0006)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=t, major_segments=p['seg'] // 2, minor_segments=p['tube'] // 3,
                                         rotation=(math.radians(90), 0, 0), location=(0, y, cz))
        o = bpy.context.object; o.data.materials.append(m['metal']); bpy.ops.object.shade_smooth(); parts.append(o)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0011, minor_radius=0.00032, major_segments=p['tube'], minor_segments=p['tube'] // 3,
                                     rotation=(0, math.radians(90), 0), location=(0, 0.0004, cz + d / 2 + 0.0026))
    o = bpy.context.object; o.data.materials.append(m['metal']); bpy.ops.object.shade_smooth(); parts.append(o)
    setting = C.join('setting', parts)
    bpy.ops.object.shade_smooth()
    halo = []
    n = 16
    for i in range(n):
        a = (i / n) * math.tau
        s = brilliant(f'h{i}', 0.0011, m['pave'])
        s.rotation_euler = (math.radians(-90), 0, 0)
        s.location = (math.cos(a) * (d / 2 + 0.0009), -0.0003, cz + math.sin(a) * (d / 2 + 0.0009))
        halo.append(s)
    halo_o = C.join('halo', halo)
    # Cable chain: alternating oval links that rise from the bail to both sides.
    lu, lv = p['link']
    links = []
    bail = Vector((0, 0.0004, cz + d / 2 + 0.0026))
    def path(side, t):
        return Vector((side * (0.0004 + 0.03 * t), bail.y, bail.z + 0.0012 + 0.055 * t ** 1.6))
    for side in (-1, 1):
        # Walk the path at a fixed link pitch.
        t, k, last = 0.0, 0, path(side, 0.0)
        while t < 1.0 and k < 60:
            t2 = t
            while t2 < 1.0 and (path(side, t2) - last).length < 0.00125:
                t2 += 0.002
            cur = path(side, t2)
            tan = (cur - last).normalized()
            nrm = Vector((0, 1, 0)) if k % 2 == 0 else tan.cross(Vector((0, 1, 0))).normalized()
            third = nrm.cross(tan).normalized()
            rot = Matrix((tan, third, nrm)).transposed().to_4x4()  # torus: x along the chain, z = ring normal
            mid = (cur + last) / 2
            bpy.ops.mesh.primitive_torus_add(major_radius=0.0006, minor_radius=0.00015, major_segments=lu, minor_segments=lv)
            o = bpy.context.object
            o.matrix_world = Matrix.Translation(mid) @ rot @ Matrix.Diagonal((1.45, 1.0, 1.0, 1.0))
            o.data.materials.append(m['metal'])
            links.append(o)
            last, t, k = cur, t2, k + 1
    chain = C.join('chain', links)
    bpy.ops.object.shade_smooth()
    return {'setting': setting, 'stone': stone, 'halo': halo_o, 'chain': chain}


# --- Hoops -------------------------------------------------------------------------------------------------------
def hoop(lod='high', m=None, R=0.0095, name='hoop', grooves=True):
    """A polished hollow hoop: an oval tube with evenly spaced wave flutes that twist along it, closed with a hinged
    clasp at the top (a hinge knuckle on one end, a post on the other that clicks into a catch)."""
    p = LOD[lod]
    m = m or mats()
    nu, nv = p['hoop']
    tube = 0.00155
    flutes = 28                  # grooves around the hoop
    half = 0.17                  # half the groove width, as a share of one flute period
    gap = 0.11                   # opening at the top for the clasp
    bm = bmesh.new()
    grid = []
    for i in range(nu + 1):
        t = i / nu
        th = math.pi / 2 + gap / 2 + (math.tau - gap) * t
        cen = Vector((R * math.cos(th), 0, R * math.sin(th)))
        nrm = Vector((math.cos(th), 0, math.sin(th)))
        ends = min(1.0, min(t, 1 - t) / 0.03)  # flutes fade out where the clasp sits
        row = []
        for j in range(nv):
            ph = (j / nv) * math.tau
            # One continuous round tube. Each flute is a shallow, narrow rounded line cut into it: about 6 % of the tube
            # radius deep and 8 % of a flute period wide. The outline stays a circle because the grooves sit only on
            # the front face, which is the face seen from the side.
            f = (t * flutes) % 1.0
            dist = min(f, 1 - f) / 0.04
            g = 0.5 + 0.5 * math.cos(math.pi * dist) if dist < 1 else 0.0
            face = max(0.0, -math.sin(ph)) ** 2   # the front face toward the camera (-Y)
            rr = tube * (1 - 0.06 * g * face * ends * (1 if grooves else 0))
            pos = cen + nrm * (math.cos(ph) * rr) + Vector((0, 1, 0)) * (math.sin(ph) * rr)
            row.append(bm.verts.new(pos))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i][(j + 1) % nv], grid[i + 1][(j + 1) % nv], grid[i + 1][j]))
    for row in (grid[0], grid[-1]):
        c = bm.verts.new(sum((v.co for v in row), Vector()) / len(row))
        for j in range(nv):
            bm.faces.new((row[j], row[(j + 1) % nv], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    body = C.obj_from_bmesh(name + '_body', bm, m['metal'])
    sm = body.modifiers.new('Smooth', 'SUBSURF')
    sm.levels = sm.render_levels = 1
    parts = [body]
    # Hinge knuckle on one end, a slim post across the gap and a catch on the other end.
    a0, a1 = math.pi / 2 + gap / 2, math.pi / 2 - gap / 2
    def at(a, k=1.0):
        return Vector((R * k * math.cos(a), 0, R * k * math.sin(a)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=p['tube'], radius=tube * 0.95, depth=tube * 2.0, location=at(a0), rotation=(math.pi / 2, 0, 0))
    k = bpy.context.object; k.data.materials.append(m['metal']); bpy.ops.object.shade_smooth(); C.bevel(k, tube * 0.25, 3); parts.append(k)
    bpy.ops.mesh.primitive_cylinder_add(vertices=p['tube'], radius=tube * 0.9, depth=tube * 1.6, location=at(a1), rotation=(math.pi / 2, 0, 0))
    k2 = bpy.context.object; k2.data.materials.append(m['metal']); bpy.ops.object.shade_smooth(); C.bevel(k2, tube * 0.25, 3); parts.append(k2)
    mid = (at(a0) + at(a1)) / 2
    d = at(a1) - at(a0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=p['tube'] // 2, radius=0.00038, depth=d.length * 1.05, location=mid)
    post = bpy.context.object
    post.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    post.data.materials.append(m['metal']); bpy.ops.object.shade_smooth(); parts.append(post)
    o = C.join(name, parts)
    bpy.ops.object.shade_smooth()
    return {'hoop': o}


if __name__ == '__main__':
    a = C.args()
    piece, lod = a.get('piece', 'ring'), a.get('lod', 'high')
    C.reset()
    objs = {'ring': ring, 'pendant': pendant, 'hoops': hoop}[piece](lod)
    out = os.path.abspath(a.get('out', f'build/{piece}-{lod}.raw.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.export_glb(out, list(objs.values()), images=False)
    print('EXPORTED', out, sorted(objs))
