"""HALRUNE products, modelled in code: HALRUNE One headphones, the Monitor bookshelf speaker and the Buds in their case.

blender -b -P blender/halrune_models.py -- --product one|monitor|buds --lod high|low --out build/halrune-one-high.raw.glb

Blender is Z up and the front faces -Y. glTF export turns that into Y up with the front facing +Z.
Every part is its own object with its origin at the product origin (the Buds lid pivots at its hinge), so the page
can move parts apart for the exploded view. Materials carry names the page swaps for its own (wood is per finish).
The same build functions feed the Cycles photos in halrune_photos.py.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

LOD = {'high': dict(seg=72, sub=2, cseg=48), 'low': dict(seg=40, sub=1, cseg=24)}


# --- Helpers -----------------------------------------------------------------------------------------------------
def spin_profile(name, pts, seg, mat, closed=True, axis='Z'):
    """Revolve a 2D profile [(r, h)] into a solid. closed joins the last point back to the first."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for r, h in pts:
            if axis == 'X':
                ring.append(bm.verts.new((h, r * math.cos(a), r * math.sin(a))))
            elif axis == 'Y':
                ring.append(bm.verts.new((r * math.cos(a), h, r * math.sin(a))))
            else:
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), h)))
        rings.append(ring)
    n = len(pts)
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            try:
                bm.faces.new((r0[k], r1[k], r1[k2], r0[k2]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C.obj_from_bmesh(name, bm, mat)


def subsurf(o, level):
    m = o.modifiers.new('Sub', 'SUBSURF')
    m.levels = m.render_levels = level
    return o


def wnormal(o, angle=30):
    """Weighted normals keep large flat faces flat next to rounded edges."""
    try:
        m = o.modifiers.new('WN', 'WEIGHTED_NORMAL')
        m.keep_sharp = True
    except Exception:  # noqa: BLE001
        pass
    return o


def curve_tube(name, points, radius, mat, res=12, bezier=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = res
    cu.use_fill_caps = True
    if bezier:
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(points) - 1)
        for bp, p in zip(sp.bezier_points, points):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp = cu.splines.new('POLY')
        sp.points.add(len(points) - 1)
        for pt, p in zip(sp.points, points):
            pt.co = (*p, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    C.apply_all(o)
    o = bpy.context.view_layer.objects.active
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def strip_arc(name, radius, center_z, a0, a1, width, thick, steps, mat):
    """A band that follows an arc in the XZ plane: a rectangular section, rounded by subdivision."""
    bm = bmesh.new()
    rows = []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        cx, cz = math.cos(a), math.sin(a)
        ring = []
        for (dr, dy) in ((-thick / 2, -width / 2), (thick / 2, -width / 2), (thick / 2, width / 2), (-thick / 2, width / 2)):
            r = radius + dr
            ring.append(bm.verts.new((cx * r, dy, center_z + cz * r)))
        rows.append(ring)
    for i in range(steps):
        a, b = rows[i], rows[i + 1]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C.obj_from_bmesh(name, bm, mat)


def veneer_uv(o, k=3.0):
    """u runs along the grain: up the front, back and sides, front to back on the top and bottom."""
    me = o.data
    uv = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(n.z) > 0.7:
                uv.data[li].uv = (co.y * k, co.x * k)
            elif abs(n.x) > abs(n.y):
                uv.data[li].uv = (co.z * k, co.y * k)
            else:
                uv.data[li].uv = (co.z * k, co.x * k)


def mats():
    M = C.material
    return {
        'wood': M('wood', (0.32, 0.18, 0.1), roughness=0.38, coat=0.4, coat_roughness=0.2),
        'steel': M('steel', (0.82, 0.83, 0.85), metallic=1.0, roughness=0.22),
        'leather': M('leather', (0.06, 0.05, 0.045), roughness=0.55),
        'pad': M('pad', (0.05, 0.05, 0.05), roughness=0.85),
        'stitch': M('stitch', (0.75, 0.72, 0.66), roughness=0.7),
        'grille': M('grille', (0.08, 0.08, 0.085), metallic=1.0, roughness=0.35),
        'baffle': M('baffle', (0.03, 0.03, 0.032), roughness=0.7),
        'driver': M('driver', (0.82, 0.8, 0.76), metallic=0.6, roughness=0.3),
        'magnet': M('magnet', (0.55, 0.56, 0.58), metallic=1.0, roughness=0.15),
        'cable': M('cable', (0.04, 0.04, 0.045), roughness=0.75),
        'cabinet': M('cabinet', (0.32, 0.18, 0.1), roughness=0.4, coat=0.5, coat_roughness=0.15),
        'trim': M('trim', (0.02, 0.02, 0.022), roughness=0.45),
        'cone': M('cone', (0.12, 0.12, 0.12), roughness=0.75),
        'surround': M('surround', (0.03, 0.03, 0.03), roughness=0.6),
        'dome': M('dome', (0.85, 0.83, 0.78), roughness=0.55),
        'ceramic': M('ceramic', (0.86, 0.84, 0.8), roughness=0.3, coat=0.6, coat_roughness=0.1),
        'bud': M('bud', (0.86, 0.84, 0.8), roughness=0.3, coat=0.6, coat_roughness=0.1),
        'tip': M('tip', (0.55, 0.54, 0.52), roughness=0.8),
        'seam': M('seam', (0.05, 0.05, 0.05), roughness=0.6),
        'led': M('led', (0.2, 0.9, 0.5), roughness=0.3, emission=((0.3, 1.0, 0.55), 6)),
        'mark': M('mark', (0.62, 0.6, 0.56), roughness=0.6),
    }


# --- HALRUNE One headphones --------------------------------------------------------------------------------------
CUP_X, BAND_R, BAND_Z = 0.085, 0.088, 0.10


def headphones(lod='high', m=None):
    p, m = LOD[lod], (m or mats())
    out = {}
    for side, s in (('l', -1), ('r', 1)):
        x = CUP_X * s
        # Wood cup: a thick ring with rounded lips. Inner side (toward the head) at -s, outer side at +s.
        prof = [(0.031, -0.016), (0.044, -0.016), (0.0475, -0.011), (0.0485, 0.004), (0.0465, 0.0135), (0.0415, 0.0165), (0.0365, 0.0165), (0.0355, 0.012), (0.0335, -0.012)]
        prof = [(r, x + h * s) for r, h in prof]
        cup = spin_profile(f'cup_{side}', prof, p['seg'], m['wood'], axis='X')
        subsurf(cup, p['sub'])
        out[f'cup_{side}'] = cup
        # Perforated grille, recessed in the outer face. The holes come from the grille texture.
        g = spin_profile(f'grille_{side}', [(0.0, x + 0.0118 * s), (0.0352, x + 0.0118 * s), (0.0356, x + 0.0108 * s), (0.0, x + 0.0108 * s)], p['seg'], m['grille'], axis='X')
        out[f'grille_{side}'] = g
        # Ear pad: a soft torus pressed a little flat, with a stitched seam on its face.
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0345, minor_radius=0.0115, major_segments=p['seg'], minor_segments=p['cseg'] // 2, location=(x - 0.024 * s, 0, 0), rotation=(0, math.pi / 2, 0))
        pad = bpy.context.object
        pad.name = f'pad_{side}'
        pad.scale = (1, 1, 0.78)
        pad.data.materials.append(m['pad'])
        bpy.ops.object.shade_smooth()
        out[pad.name] = pad
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0345, minor_radius=0.0007, major_segments=p['seg'], minor_segments=6, location=(x - 0.0325 * s, 0, 0), rotation=(0, math.pi / 2, 0))
        st = bpy.context.object
        st.name = f'stitch_{side}'
        st.data.materials.append(m['stitch'])
        bpy.ops.object.shade_smooth()
        out[st.name] = st
        # Inside the cup: baffle, driver (diaphragm with a rolled surround) and the magnet behind it.
        bf = spin_profile(f'baffle_{side}', [(0.0, x - 0.006 * s), (0.034, x - 0.006 * s), (0.034, x - 0.003 * s), (0.0, x - 0.003 * s)], p['seg'], m['baffle'], axis='X')
        out[bf.name] = bf
        drv = spin_profile(f'driver_{side}', [(0.0, x - 0.0085 * s), (0.006, x - 0.0083 * s), (0.016, x - 0.006 * s), (0.0235, x - 0.004 * s), (0.0255, x - 0.0052 * s), (0.0272, x - 0.0039 * s), (0.0272, x - 0.0032 * s), (0.0, x - 0.0032 * s)], p['seg'], m['driver'], axis='X')
        subsurf(drv, 1)
        out[drv.name] = drv
        mg = spin_profile(f'magnet_{side}', [(0.0, x + 0.0), (0.0125, x + 0.0), (0.0132, x + 0.0012 * s), (0.0132, x + 0.0068 * s), (0.0125, x + 0.008 * s), (0.0, x + 0.008 * s)], p['seg'], m['magnet'], axis='X')
        out[mg.name] = mg
        # Steel yoke: a fork that arcs over the cup and holds it at front and back pivots.
        arc = [(x, math.cos(t) * 0.0535, math.sin(t) * 0.0535) for t in [i * math.pi / 16 for i in range(17)]]
        yoke = curve_tube(f'yoke_{side}', arc + [(x, 0, 0.075)], 0.0026, m['steel'], res=8, bezier=False)
        out[yoke.name] = yoke
        for yy in (-0.0535, 0.0535):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0042, depth=0.006, location=(x, yy, 0), rotation=(0, math.pi / 2, 0))
            pv = bpy.context.object
            pv.data.materials.append(m['steel'])
            C.bevel(pv, 0.0008, 3)
            out[f'pivot_{side}{"f" if yy < 0 else "b"}'] = pv
        # Slider: a polished rod up into a small block at the band end.
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0021, depth=0.03, location=(x, 0, 0.087))
        rod = bpy.context.object
        rod.name = f'slider_{side}'
        rod.data.materials.append(m['steel'])
        out[rod.name] = rod
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x * (BAND_R / CUP_X), 0, BAND_Z - 0.002))
        blk = bpy.context.object
        blk.name = f'block_{side}'
        blk.scale = (0.012, 0.03, 0.016)
        blk.data.materials.append(m['trim'])
        C.bevel(blk, 0.0025, 4)
        out[blk.name] = blk
    # Headband: a spring-steel arc with a leather strap slung below it.
    band = strip_arc('band_steel', BAND_R, BAND_Z, 0.03, math.pi - 0.03, 0.026, 0.0024, 64 if lod == 'high' else 32, m['steel'])
    subsurf(band, 1)
    out['band_steel'] = band
    strap = strip_arc('band_leather', BAND_R - 0.008, BAND_Z, 0.2, math.pi - 0.2, 0.036, 0.006, 64 if lod == 'high' else 32, m['leather'])
    subsurf(strap, p['sub'])
    out['band_leather'] = strap
    for side, s in (('l', -1), ('r', 1)):
        bpy.ops.mesh.primitive_torus_add(major_radius=BAND_R - 0.008, minor_radius=0.0006, major_segments=96, minor_segments=6, location=(0, 0.0165 * s, BAND_Z), rotation=(math.pi / 2, 0, 0))
        sm = bpy.context.object
        sm.name = f'seam_{side}'
        sm.data.materials.append(m['stitch'])
        # keep only the part under the strap
        bm = bmesh.new()
        bm.from_mesh(sm.data)
        cut = [v for v in bm.verts if v.co.z < BAND_Z + math.sin(0.2) * (BAND_R - 0.008)]
        bmesh.ops.delete(bm, geom=cut, context='VERTS')
        bm.to_mesh(sm.data)
        bm.free()
        out[sm.name] = sm
    # Cable from the left cup, down to a steel 3.5 mm plug.
    cab = curve_tube('cable', [(-CUP_X, -0.004, -0.046), (-CUP_X + 0.004, -0.02, -0.1), (-0.04, -0.06, -0.16), (0.01, -0.07, -0.19)], 0.0019, m['cable'], res=24)
    out['cable'] = cab
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0042, depth=0.028, location=(0.024, -0.072, -0.192), rotation=(0, math.pi / 2 - 0.2, 0))
    plug = bpy.context.object
    plug.name = 'plug'
    plug.data.materials.append(m['steel'])
    C.bevel(plug, 0.001, 3)
    out['plug'] = plug
    return out


# --- HALRUNE Monitor speaker -------------------------------------------------------------------------------------
SPK_W, SPK_D, SPK_H = 0.18, 0.24, 0.30
WOOF_Z, TWEET_Z, PORT_Z = 0.125, 0.245, 0.042


def speaker(lod='high', m=None):
    p, m = LOD[lod], (m or mats())
    out, cutters = {}, []
    # Cabinet: a box with generous rounded veneer edges (bevel applied first, so later cuts see the round).
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, SPK_H / 2))
    cab = bpy.context.object
    cab.name = 'cabinet'
    cab.scale = (SPK_W, SPK_D, SPK_H)
    bpy.ops.object.transform_apply(scale=True)
    cab.data.materials.append(m['cabinet'])
    bv = cab.modifiers.new('Round', 'BEVEL')
    bv.width, bv.segments, bv.profile = 0.016, 8 if lod == 'high' else 4, 0.5
    bpy.context.view_layer.objects.active = cab
    bpy.ops.object.modifier_apply(modifier=bv.name)
    fy = -SPK_D / 2
    # A shallow pocket in the front for the baffle, with rounded corners.
    BW, BH, REC = SPK_W - 0.028, SPK_H - 0.028, 0.004
    def rounded_slab(name, w, h, depth, r, y, mat=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, SPK_H / 2))
        o = bpy.context.object
        o.name = name
        o.scale = (w, depth, h)
        bpy.ops.object.transform_apply(scale=True)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        edges = [e for e in bm.edges if abs(e.verts[0].co.x - e.verts[1].co.x) < 1e-6 and abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=edges, offset=r, segments=6, profile=0.5, affect='EDGES', clamp_overlap=True)
        bm.to_mesh(o.data)
        bm.free()
        if mat:
            o.data.materials.append(mat)
        return o
    pocket = rounded_slab('pocket', BW, BH, REC * 2, 0.008, fy)
    b = cab.modifiers.new('Pocket', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.solver = 'EXACT'; b.object = pocket
    bpy.ops.object.select_all(action='DESELECT'); cab.select_set(True); bpy.context.view_layer.objects.active = cab
    bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(pocket)
    # The baffle: a black satin panel set into the pocket, 1.5 mm behind the veneer face.
    baffle = rounded_slab('baffle_front', BW - 0.001, BH - 0.001, 0.006, 0.0075, fy + 0.0015 + 0.003, m['trim'])
    C.bevel(baffle, 0.0008, 2)
    out['baffle_front'] = baffle
    fy = fy + 0.0015  # drivers sit on the baffle face
    # Cut the openings for the woofer and the port through the cabinet and the baffle.
    for r, z in ((0.0585, WOOF_Z), (0.0128, PORT_Z)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=p['seg'], radius=r, depth=0.064, location=(0, fy, z), rotation=(math.pi / 2, 0, 0))
        cutter = bpy.context.object
        for tgt in (cab, baffle):
            bb = tgt.modifiers.new('Hole', 'BOOLEAN'); bb.operation = 'DIFFERENCE'; bb.solver = 'EXACT'; bb.object = cutter
            bpy.ops.object.select_all(action='DESELECT'); tgt.select_set(True); bpy.context.view_layer.objects.active = tgt
            bpy.ops.object.modifier_move_to_index(modifier=bb.name, index=0)
            bpy.ops.object.modifier_apply(modifier=bb.name)
        bpy.data.objects.remove(cutter)
    # Veneer UVs: the grain runs up the front and sides and front to back on the top.
    veneer_uv(cab)
    wnormal(cab)
    out['cabinet'] = cab
    # Woofer: a black frame, the cone, a rolled rubber surround and a dust cap. Front faces -Y.
    frame = spin_profile('woofer_frame', [(0.058, 0.0), (0.071, 0.0), (0.072, -0.003), (0.068, -0.0045), (0.059, -0.0045), (0.058, -0.002)], p['seg'], m['trim'], axis='Y')
    frame.location = (0, fy, WOOF_Z)
    out['woofer_frame'] = frame
    cone = spin_profile('woofer_cone', [(0.0, 0.022), (0.019, 0.021), (0.035, 0.013), (0.05, 0.004), (0.0535, 0.003), (0.0535, 0.006), (0.019, 0.024), (0.0, 0.025)], p['seg'], m['cone'], axis='Y')
    subsurf(cone, 1)
    cone.location = (0, fy - 0.0005, WOOF_Z)
    out['woofer_cone'] = cone
    bpy.ops.mesh.primitive_torus_add(major_radius=0.056, minor_radius=0.0045, major_segments=p['seg'], minor_segments=p['cseg'] // 2, location=(0, fy - 0.0012, WOOF_Z), rotation=(math.pi / 2, 0, 0))
    sur = bpy.context.object
    sur.name = 'woofer_surround'
    sur.data.materials.append(m['surround'])
    bpy.ops.object.shade_smooth()
    out['woofer_surround'] = sur
    cap = spin_profile('dust_cap', [(0.0, -0.0105), (0.008, -0.0085), (0.0145, -0.0035), (0.0185, 0.003), (0.0185, 0.006), (0.0, 0.006)], p['seg'], m['cone'], axis='Y')
    subsurf(cap, 1)
    cap.location = (0, fy - 0.0005, WOOF_Z + 0.0)
    cap.location.y = fy - 0.0005 + 0.016
    out['dust_cap'] = cap
    # Tweeter: a round faceplate and a soft dome.
    plate = spin_profile('tweeter_plate', [(0.0, 0.0), (0.03, 0.0), (0.031, -0.002), (0.029, -0.004), (0.016, -0.004), (0.0145, -0.002), (0.0, -0.002)], p['seg'], m['trim'], axis='Y')
    subsurf(plate, 1)
    plate.location = (0, fy, TWEET_Z)
    out['tweeter_plate'] = plate
    bpy.ops.mesh.primitive_uv_sphere_add(segments=p['seg'], ring_count=p['cseg'] // 2, radius=0.0135, location=(0, fy - 0.001, TWEET_Z))
    dome = bpy.context.object
    dome.name = 'tweeter_dome'
    dome.scale = (1, 0.75, 1)
    dome.data.materials.append(m['dome'])
    bpy.ops.object.shade_smooth()
    bm = bmesh.new()
    bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.0005], context='VERTS')
    bm.to_mesh(dome.data)
    bm.free()
    out['tweeter_dome'] = dome
    # Port: a flared tube.
    port = spin_profile('port', [(0.0125, 0.03), (0.0125, 0.004), (0.0145, 0.001), (0.0185, -0.0005), (0.0195, -0.001), (0.0195, 0.0), (0.0135, 0.0045), (0.0135, 0.03)], p['seg'], m['trim'], axis='Y', closed=False)
    port.location = (0, fy, PORT_Z)
    out['port'] = port
    # Rubber feet.
    for fx, fyy in ((-0.07, -0.09), (0.07, -0.09), (-0.07, 0.09), (0.07, 0.09)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.009, depth=0.004, location=(fx, fyy, -0.002))
        f = bpy.context.object
        f.data.materials.append(m['surround'])
        C.bevel(f, 0.0012, 3)
        out[f'foot_{len(out)}'] = f
    return out


# --- HALRUNE Buds ------------------------------------------------------------------------------------------------
# The case: a flat rounded rectangle in plan (a superellipse) with softly rounded top and bottom edges.
CASE_A, CASE_B, CASE_H, CASE_SPLIT = 0.032, 0.0225, 0.033, 0.0195
WALL = 0.0016
HINGE = (0, CASE_B - 0.0012, CASE_SPLIT)
SUPER = 4.0  # plan exponent: 2 is an ellipse, higher is squarer


def plan_pt(theta, a, b):
    c, s = math.cos(theta), math.sin(theta)
    e = 2 / SUPER
    return (a * math.copysign(abs(c) ** e, c), b * math.copysign(abs(s) ** e, s))


def side_scale(z, h, rnd=0.0055):
    """1 on the straight sides, curving in over the last few mm at the top and bottom."""
    d = min(z, h - z)
    if d >= rnd:
        return 1.0
    t = 1 - d / rnd
    return math.sqrt(max(0.0, 1 - t * t)) * 0.38 + 0.62 if d > 0 else 0.62


def shell(name, z0, z1, h, mat, lod, inset=0.0, cap_bottom=True, cap_top=True):
    """One half of the case: an outer skin between heights z0 and z1, closed with a flat floor or roof."""
    seg = 96 if lod == 'high' else 56
    rows = 18 if lod == 'high' else 10
    bm = bmesh.new()
    ring = []
    zs = [z0 + (z1 - z0) * (i / rows) for i in range(rows + 1)]
    for z in zs:
        k = side_scale(z, h)
        ring.append([bm.verts.new((*[c * k for c in plan_pt(2 * math.pi * j / seg, CASE_A - inset, CASE_B - inset)], z)) for j in range(seg)])
    for i in range(rows):
        for j in range(seg):
            bm.faces.new((ring[i][j], ring[i][(j + 1) % seg], ring[i + 1][(j + 1) % seg], ring[i + 1][j]))
    caps = []
    if cap_bottom:
        caps.append(bm.faces.new(list(reversed(ring[0]))))
    if cap_top:
        caps.append(bm.faces.new(ring[-1]))
    # Fan the flat caps from their centers so later cuts (the deboss) stay clean.
    if caps:
        bmesh.ops.poke(bm, faces=caps)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat)
    sol = o.modifiers.new('Shell', 'SOLIDIFY')
    sol.thickness = WALL
    sol.offset = -1
    return o


def bud(side, s, m, lod):
    """One earbud: a rounded head, a tapered stem with a steel tip, an angled nozzle and a silicone ear tip."""
    seg = 48 if lod == 'high' else 28
    x, parts = s * 0.0135, []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=0.0074, location=(x, 0.0005, 0.0215))
    head = bpy.context.object
    head.scale = (1, 0.9, 0.82)
    head.data.materials.append(m['bud'])
    bpy.ops.object.shade_smooth()
    # Stem: a lathe that narrows toward a rounded foot.
    stem = spin_profile(f'stem_{side}', [(0.0, 0.0045), (0.0019, 0.0047), (0.0026, 0.0056), (0.0028, 0.0085), (0.0033, 0.0185), (0.0, 0.0185)], seg, m['bud'])
    stem.location = (x, 0.0012, 0)
    subsurf(stem, 1)
    # Steel contact at the foot of the stem.
    ring_ = spin_profile(f'contact_{side}', [(0.0, 0.0044), (0.0019, 0.0044), (0.00205, 0.0050), (0.0, 0.0050)], seg, m['steel'])
    ring_.location = (x, 0.0012, 0)
    # Nozzle angled down and forward, then the ear tip on its end.
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=0.0027, depth=0.0075, location=(x - s * 0.002, -0.0058, 0.0242), rotation=(math.radians(68), math.radians(-s * 14), 0))
    nz = bpy.context.object
    nz.data.materials.append(m['bud'])
    C.bevel(nz, 0.0009, 4)
    bpy.ops.object.shade_smooth()
    tip = spin_profile(f'tipprof_{side}', [(0.0, -0.0035), (0.0028, -0.0033), (0.0043, -0.0021), (0.0047, -0.0002), (0.0038, 0.0012), (0.0026, 0.0014), (0.0, 0.0014)], seg, m['tip'])
    tip.location = (x - s * 0.0031, -0.0101, 0.0262)
    tip.rotation_euler = (math.radians(68 + 90), math.radians(-s * 14), 0)
    subsurf(tip, 1)
    # A touch panel on the outer face of the head.
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=0.0036, depth=0.0005, location=(x + s * 0.0001, 0.0042, 0.0236), rotation=(math.radians(-70), 0, 0))
    pad = bpy.context.object
    pad.data.materials.append(m['steel'])
    C.bevel(pad, 0.0002, 2)
    for o in (stem, ring_, nz, tip, pad):
        parts.append(o)
    head.name = f'bud_{side}'
    return [head] + parts


def buds(lod='high', m=None):
    m = m or mats()
    out = {}
    base = shell('case_base', 0.0, CASE_SPLIT, CASE_H, m['ceramic'], lod, cap_top=False)
    out['case_base'] = base
    # The lid sits a hair inside the base line, which leaves a fine step at the seam.
    lid = shell('case_lid', CASE_SPLIT + 0.0003, CASE_H, CASE_H, m['ceramic'], lod, inset=0.00035, cap_bottom=False)
    # Debossed mark: cut 0.25 mm into the lid top. The cut faces take a slightly darker glaze.
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.modifier_apply(modifier='Shell')
    font = os.path.join(os.path.dirname(__file__), 'fonts', 'Archivo-Expanded-Medium.ttf')
    mark = C.text_mesh('mark', 'HALRUNE', font, 0.0036, CASE_H, m['mark'], extrude=0.00025, letter_spacing=1.25)
    lid.data.materials.append(m['mark'])
    bo = lid.modifiers.new('Deboss', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'; bo.object = mark
    try:
        bo.material_mode = 'TRANSFER'
    except Exception:  # noqa: BLE001
        pass
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.modifier_apply(modifier=bo.name)
    bpy.data.objects.remove(mark)
    # Pivot the lid at the hinge so the page can open it.
    from mathutils import Matrix
    lid.data.transform(Matrix.Translation(Vector(lid.location) - Vector(HINGE)))
    lid.location = HINGE
    wnormal(lid)
    out['case_lid'] = lid
    # The seam: a thin dark groove where lid meets base.
    k = side_scale(CASE_SPLIT, CASE_H)
    pts = [(*[c * k * 1.0005 for c in plan_pt(2 * math.pi * j / 128, CASE_A, CASE_B)], CASE_SPLIT + 0.00015) for j in range(129)]
    out['seam'] = curve_tube('seam', pts, 0.00026, m['seam'], res=2, bezier=False)
    # Hinge: three steel knuckles on the back across the seam.
    for i, xx in enumerate((-0.0085, 0.0, 0.0085)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0013, depth=0.0055, location=(xx, CASE_B - 0.0002, CASE_SPLIT), rotation=(0, math.pi / 2, 0))
        h = bpy.context.object
        h.name = f'hinge_{i}'
        h.data.materials.append(m['steel'])
        C.bevel(h, 0.0004, 3)
        out[f'hinge_{i}'] = h
    # A small pill-shaped status light on the front, just under the seam.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -CASE_B * side_scale(CASE_SPLIT - 0.004, CASE_H) - 0.0001, CASE_SPLIT - 0.004))
    led = bpy.context.object
    led.name = 'status_light'
    led.scale = (0.0042, 0.0008, 0.0013)
    bpy.ops.object.transform_apply(scale=True)
    led.data.materials.append(m['led'])
    C.bevel(led, 0.00055, 4)
    out['status_light'] = led
    # The buds, standing stem-down in their wells with heads and tips above the seam.
    for side, s in (('l', -1), ('r', 1)):
        parts = bud(side, s, m, lod)
        head = parts[0]
        for o in parts[1:]:
            o.parent = head
            o.matrix_parent_inverse = head.matrix_world.inverted()
        head.location.z -= 0.0012  # sit a little lower so the tips clear the closed lid
        out[head.name] = head
        for o in parts[1:]:
            out[o.name] = o
    return out


BUILD = {'one': headphones, 'monitor': speaker, 'buds': buds}


def uv_all(objs):
    for o in objs:
        if o.type != 'MESH' or len(o.data.uv_layers):
            continue
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.cube_project(cube_size=0.12)
        bpy.ops.object.mode_set(mode='OBJECT')


if __name__ == '__main__':
    a = C.args()
    C.reset()
    product, lod = a.get('product', 'one'), a.get('lod', 'high')
    objs = BUILD[product](lod)
    uv_all(list(objs.values()))
    out = os.path.abspath(a.get('out', f'build/halrune-{product}-{lod}.raw.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.export_glb(out, list(objs.values()), images=False)
    print('EXPORTED', out, len(objs))
