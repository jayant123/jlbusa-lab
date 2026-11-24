"""VANTRIK shoes, modeled from a foot outline: the VK-1 runner and the VK-2 court shoe.

blender -b -P blender/vantrik_shoes.py -- --kind runner|court --lod high|low --out build/runner-high.raw.glb

Blender axes: x runs heel (0) to toe (L), y across the foot (lateral side is -y), z up. In three.js the toe points
to +x, up is +y and the lateral side faces +z (toward the camera).
Parts (object and material names): outsole, midsole, insole, upper, tongue, laces, eyelets, heel_tab, stitch.
Every part is smooth: rounded profiles, dense rings, Catmull-Clark on the quad grids and smooth normals.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

L = 0.285  # a US 9 last, heel to toe
TEX = os.path.join(os.path.dirname(__file__), '..', 'build', 'tex')


def sm(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))) if b != a else float(x >= a)
    return t * t * (3 - 2 * t)


def lerp(a, b, k):
    return a + (b - a) * k


# Half width of the last along its length (t = 0 heel, 1 toe), interpolated smoothly.
W_PTS = [(0, 0.0), (0.02, 0.016), (0.07, 0.027), (0.15, 0.032), (0.32, 0.033), (0.46, 0.034), (0.62, 0.043),
         (0.74, 0.047), (0.84, 0.045), (0.92, 0.036), (0.965, 0.024), (0.99, 0.011), (1.0, 0.0)]


def half_width(t, medial=False):
    for (t0, w0), (t1, w1) in zip(W_PTS, W_PTS[1:]):
        if t0 <= t <= t1:
            k = (t - t0) / (t1 - t0)
            k = k * k * (3 - 2 * k)
            w = lerp(w0, w1, k)
            break
    else:
        w = 0.0
    if medial:  # the arch side pulls in at the waist
        w *= 1 - 0.1 * math.exp(-((t - 0.42) / 0.12) ** 2)
    return w


def outline(n_side):
    """Closed outline: lateral side heel to toe, then medial side toe back to heel. Returns [(x, y, t)]."""
    ts = [0.5 * (i / n_side) + 0.5 * (0.5 - 0.5 * math.cos(math.pi * i / n_side)) for i in range(n_side + 1)]  # a little denser at heel and toe
    pts = [(t * L, -half_width(t), t) for t in ts]
    pts += [(t * L, half_width(t, True), t) for t in reversed(ts[1:-1])]
    return pts


def normals2d(pts):
    out = []
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i - 1][0], pts[i - 1][1]
        x1, y1 = pts[(i + 1) % n][0], pts[(i + 1) % n][1]
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy) or 1
        nx, ny = dy / ln, -dx / ln  # outward for this winding
        cx = pts[i][0] - L / 2
        if nx * cx + ny * pts[i][1] < 0:
            nx, ny = -nx, -ny
        out.append((nx, ny))
    return out


def loft_solid(name, pts, profile, mat):
    """Stack rings around the outline. profile: list of (inset_fn(t), z_fn(t)). Caps the bottom and top flat."""
    nrm = normals2d(pts)
    bm = bmesh.new()
    rings = []
    for inset_fn, z_fn in profile:
        ring = []
        for (x, y, t), (nx, ny) in zip(pts, nrm):
            d = inset_fn(t)
            ring.append(bm.verts.new((x - nx * d, y - ny * d, z_fn(t))))
        rings.append(ring)
    n = len(pts)
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat)
    return o


def rounded_profile(zbot, ztop, r_bot, r_top, inset=lambda t: 0.0, bulge=lambda t: 0.0, steps=6):
    """Side profile of a slab with rounded bottom and top edges and an optional outward bulge in the middle."""
    prof = []
    for i in range(steps + 1):  # bottom edge, from under the sole out to the side
        a = math.pi * 1.5 - (math.pi / 2) * i / steps
        prof.append((lambda t, a=a: inset(t) + r_bot + r_bot * math.cos(a), lambda t, a=a: zbot(t) + r_bot + r_bot * math.sin(a)))
    for k in (0.35, 0.5, 0.65):  # the side wall, bulging out
        prof.append((lambda t, k=k: inset(t) - bulge(t) * math.sin(math.pi * k), lambda t, k=k: lerp(zbot(t) + r_bot, ztop(t) - r_top, k)))
    for i in range(steps + 1):  # top edge, from the side over onto the top
        a = math.pi - (math.pi / 2) * i / steps
        prof.append((lambda t, a=a: inset(t) + r_top + r_top * math.cos(a), lambda t, a=a: ztop(t) - r_top + r_top * math.sin(a)))
    return prof


def knit_normal(path, size=512):
    """A knitted look: rows of V-shaped stitches, as a tangent-space normal map."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    cols, rows = 24, 32
    u = (x * cols) % 1.0
    v = (y * rows + np.abs(u - 0.5) * 0.9) % 1.0
    h = np.sin(np.pi * v) ** 0.6 * (0.55 + 0.45 * np.sin(np.pi * u))
    h += 0.08 * np.sin(x * size * 0.9) * np.sin(y * size * 0.7)
    return _normal_png(path, h, 3.0)


def grain_normal(path, size=512, seed=3):
    """Fine pebbled leather grain."""
    rng = np.random.default_rng(seed)
    h = rng.random((size, size)).astype(np.float32)
    for _ in range(3):  # blur into soft pebbles
        h = (h + np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1)) / 5
    return _normal_png(path, h, 6.0)


def _normal_png(path, h, k):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * k
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * k
    nz = np.ones_like(h)
    ln = np.sqrt(gx * gx + gy * gy + nz * nz)
    rgb = np.stack([(-gx / ln) * 0.5 + 0.5, (gy / ln) * 0.5 + 0.5, (nz / ln) * 0.5 + 0.5, np.ones_like(h)], -1)
    size = h.shape[0]
    img = bpy.data.images.new(os.path.basename(path), size, size, alpha=True)
    img.pixels = rgb[::-1].reshape(-1).tolist()
    img.filepath_raw = path
    img.file_format = 'PNG'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save()
    img.colorspace_settings.name = 'Non-Color'
    return img


def with_normal(mat, img, strength=0.6):
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = strength
    nt.links.new(tex.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    return mat


def subsurf(o, levels):
    if levels:
        m = o.modifiers.new('Smooth', 'SUBSURF')
        m.levels = m.render_levels = levels
    return o


# --- Shoe definitions ----------------------------------------------------------------------------------------------
KINDS = {
    'runner': dict(
        zb=lambda t: 0.014 * sm(0.7, 1.0, t) ** 1.5 + 0.005 * sm(0.07, 0.0, t),
        outsole=0.0035,
        stack=lambda t: 0.033 - 0.011 * sm(0.22, 0.78, t),
        flare=lambda t: 0.0035 * sm(0.3, 0.0, t) + 0.0015,
        upper_h=lambda t: 0.064 + 0.008 * sm(0.1, 0.0, t) + 0.012 * sm(0.3, 0.5, t) - 0.05 * sm(0.5, 0.9, t) - 0.02 * sm(0.9, 1.0, t),
        knit=True, mid_r=0.006,
    ),
    'court': dict(
        zb=lambda t: 0.006 * sm(0.8, 1.0, t) ** 2,
        outsole=0.003,
        stack=lambda t: 0.026,
        flare=lambda t: 0.0,
        upper_h=lambda t: 0.056 + 0.006 * sm(0.1, 0.0, t) + 0.014 * sm(0.3, 0.5, t) - 0.042 * sm(0.5, 0.9, t) - 0.022 * sm(0.9, 1.0, t),
        knit=False, mid_r=0.0025,
    ),
}


def build(kind='runner', lod='high'):
    K = KINDS[kind]
    hi = lod in ('high', 'photo')
    SUB = {'photo': 2, 'high': 1, 'low': 1}[lod]
    n_side = 64 if hi else 36
    pts = outline(n_side)
    mats = {
        'outsole': C.material('outsole', (0.05, 0.05, 0.05), roughness=0.75),
        'midsole': C.material('midsole', (0.86, 0.84, 0.8), roughness=0.55),
        'insole': C.material('insole', (0.2, 0.2, 0.22), roughness=0.9),
        'upper': C.material('upper', (0.8, 0.78, 0.74), roughness=0.85 if K['knit'] else 0.42, coat=0.0 if K['knit'] else 0.3),
        'tongue': C.material('tongue', (0.8, 0.78, 0.74), roughness=0.85),
        'laces': C.material('laces', (0.9, 0.9, 0.88), roughness=0.8),
        'eyelets': C.material('eyelets', (0.75, 0.75, 0.76), metallic=1.0, roughness=0.3),
        'heel_tab': C.material('heel_tab', (0.12, 0.12, 0.12), roughness=0.6),
        'stitch': C.material('stitch', (0.92, 0.9, 0.85), roughness=0.8),
    }
    if K['knit']:
        with_normal(mats['upper'], knit_normal(os.path.join(TEX, 'vantrik_knit.png')), 0.9)
    else:
        with_normal(mats['upper'], grain_normal(os.path.join(TEX, 'vantrik_grain.png')), 0.35)

    zb, so, stack, flare = K['zb'], K['outsole'], K['stack'], K['flare']
    z_mid0 = lambda t: zb(t) + so
    z_top = lambda t: zb(t) + so + stack(t)
    objs = {}

    # Outsole: a thin rubber plate with rounded edges.
    objs['outsole'] = loft_solid('outsole', pts, rounded_profile(zb, z_mid0, 0.0012, 0.0008, inset=lambda t: 0.0006 - flare(t) * 0.6, steps=4), mats['outsole'])
    # Midsole: the foam, flared at the heel and rounded top and bottom.
    objs['midsole'] = loft_solid('midsole', pts, rounded_profile(lambda t: z_mid0(t) - 0.0004, z_top, 0.002, K['mid_r'], inset=(lambda t: -flare(t) * 0.4) if kind == 'runner' else (lambda t: -0.0025), bulge=flare, steps=6 if hi else 4), mats['midsole'])
    # Insole: a thin pad that sits on the midsole inside the upper.
    objs['insole'] = loft_solid('insole', pts, rounded_profile(lambda t: z_top(t) - 0.0005, lambda t: z_top(t) + 0.003, 0.001, 0.0015, inset=lambda t: 0.006, steps=3), mats['insole'])

    # Tread: rounded lugs on the bottom of the outsole (runner) or a herringbone of bars (court).
    tread = []
    for (x, y, t) in pts[:: (3 if hi else 5)]:
        pass
    bm = bmesh.new()
    step = 0.011
    for xi in np.arange(0.012, L - 0.008, step):
        t = xi / L
        w = half_width(t) - 0.006
        for yi in np.arange(-w, w + 1e-6, step):
            if kind == 'runner':
                r = bmesh.ops.create_cone(bm, cap_ends=True, segments=10 if hi else 6, radius1=0.0036, radius2=0.003, depth=0.0018)
            else:
                r = bmesh.ops.create_cube(bm, size=1.0)
                bmesh.ops.scale(bm, vec=(0.0085, 0.0022, 0.0016), verts=r['verts'])
                bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(35 if int(xi / step) % 2 else -35), 3, 'Z'), verts=r['verts'])
            bmesh.ops.translate(bm, vec=(xi, yi + (step / 2 if int(xi / step) % 2 else 0), zb(t) - 0.0007), verts=r['verts'])
    lugs = C.obj_from_bmesh('tread', bm, mats['outsole'])
    objs['outsole'] = C.join('outsole', [objs['outsole'], lugs])

    # Upper: lofted along the foot from cross-section arches. Each slice is a rounded arch from the lateral edge of
    # the sole, over the foot, down to the medial edge. Around the collar and the throat the top of the arch is cut
    # away (phi_open), which leaves a smooth U-shaped opening. Over the toe the arch is whole.
    H = K['upper_h']
    cols = 72 if hi else 40
    half = 14 if hi else 8  # rows per side of the arch
    pw = 2.6  # superellipse power: a rounded box, not a circle

    def phi_open(t):
        # Higher at the back of the heel, lowest at the ankle bones, then a narrow throat that closes at the toe box.
        collar = lerp(0.72, 0.95, sm(0.0, 0.2, t))
        return lerp(lerp(collar, 0.36, sm(0.24, 0.4, t)), 0.0, sm(0.64, 0.73, t))

    def arch_pt(t, phi):
        w = 0.0 if t <= 0 or t >= 1 else half_width(t, phi > 0) + 0.0004
        sn, cs = math.sin(phi), math.cos(phi)
        e = 2 / lerp(pw, 2.0, sm(0.7, 1.0, t))  # boxy at the heel, round at the toe
        y = w * math.copysign(abs(sn) ** e, sn)
        z = z_top(t) - 0.002 + H(t) * abs(cs) ** e
        return (t * L, y, z)

    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    ts = [0.5 * (i / cols) + 0.5 * (0.5 - 0.5 * math.cos(math.pi * i / cols)) for i in range(cols + 1)]
    grid, top_lat, top_med = [], [], []
    for t in ts:
        po = phi_open(t)
        col = []
        for r in range(half + 1):  # lateral: from the sole edge up to the opening edge
            u = r / half
            col.append(arch_pt(t, -(math.pi / 2) + (math.pi / 2 - po) * u))
        for r in range(half + 1):  # medial: from the opening edge down to the sole edge
            u = r / half
            col.append(arch_pt(t, po + (math.pi / 2 - po) * u))
        top_lat.append((col[half], t)); top_med.append((col[half + 1], t))
        grid.append([bm.verts.new(c) for c in col])
    nrows = len(grid[0])
    for i in range(cols):
        for r in range(nrows - 1):
            if r == half and phi_open(ts[i]) > 1e-4 and phi_open(ts[i + 1]) > 1e-4:
                continue  # the opening between the two walls
            f = bm.faces.new((grid[i][r], grid[i + 1][r], grid[i + 1][r + 1], grid[i][r + 1]))
            for loop, (ii, rr) in zip(f.loops, ((i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1))):
                loop[uv].uv = (ts[ii] * 7.0, rr / (nrows - 1) * 4.0)
    # Where the arch is whole the two middle rows meet at the top: weld them.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    up = C.obj_from_bmesh('upper', bm, mats['upper'])
    sol = up.modifiers.new('Thick', 'SOLIDIFY')
    sol.thickness = 0.003 if kind == 'runner' else 0.0022
    sol.offset = -1
    subsurf(up, SUB)
    objs['upper'] = up

    # A padded roll along the whole opening edge: the collar round the heel and both edges of the throat.
    loop = [Vector(c) for c, t in reversed(top_lat) if 0.0 < t <= 0.6] + [Vector(c) for c, t in top_med if 0.0 < t <= 0.6]
    cu = bpy.data.curves.new('collar', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.0032 if kind == 'runner' else 0.0022
    cu.bevel_resolution = 4 if hi else 2
    cu.resolution_u = 6
    sp = cu.splines.new('POLY')
    sp.points.add(len(loop) - 1)
    for pnt, co in zip(sp.points, loop):
        pnt.co = (co.x + 0.0008, co.y * 0.96, co.z - 0.0012, 1)
    sp.type = 'BEZIER' if False else 'POLY'
    co_ = bpy.data.objects.new('collar', cu)
    bpy.context.collection.objects.link(co_)
    co_.data.materials.append(mats['upper'])
    C.apply_all(co_)
    collar = bpy.context.view_layer.objects.active
    sm_ = collar.modifiers.new('Smooth', 'SMOOTH'); sm_.iterations = 6
    for poly in collar.data.polygons:
        poly.use_smooth = True
    objs['upper'] = C.join('upper', [objs['upper'], collar])

    # Heel counter: a second layer wrapped round the heel, colored with the heel tab. It climbs to near the collar
    # at the back and sweeps down to the sole by mid-foot.
    bm = bmesh.new()
    hcols, hrows = (28, 10) if hi else (16, 6)
    hg = []
    for i in range(hcols + 1):
        t = 0.27 * i / hcols
        f = lerp(0.92, 0.0, sm(0.06, 0.27, t)) * (1 - 0.15 * sm(0.0, 0.08, t))
        col = []
        for side in (-1, 1):
            po = phi_open(t)
            for r in range(hrows + 1):
                u = r / hrows * f
                ph = side * ((math.pi / 2) - (math.pi / 2 - po) * u)
                x, y, z = arch_pt(t, ph)
                col.append((x - 0.0032 * (1 - sm(0.0, 0.06, t)), y * 1.07 + side * 0.0022, z))
        hg.append([bm.verts.new(c) for c in col])
    n2 = hrows + 1
    for i in range(hcols):
        for side in range(2):
            for r in range(hrows):
                a0 = side * n2 + r
                f_ = bm.faces.new((hg[i][a0], hg[i + 1][a0], hg[i + 1][a0 + 1], hg[i][a0 + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    hc = C.obj_from_bmesh('heel_counter', bm, mats['heel_tab'])
    s4 = hc.modifiers.new('Thick', 'SOLIDIFY'); s4.thickness = 0.0016; s4.offset = 1
    subsurf(hc, SUB)
    objs['heel_tab'] = None  # filled below; the counter joins the pull tab

    # Lace holes along the throat edges.

    pairs = []
    n_holes = 5 if kind == 'runner' else 6
    for k in range(n_holes):
        tt = lerp(0.41, 0.665, k / (n_holes - 1))
        a = Vector(min(top_lat, key=lambda p: abs(p[1] - tt))[0])
        b = Vector(min(top_med, key=lambda p: abs(p[1] - tt))[0])
        pairs.append((a, b))

    # Tongue: a padded strip under the laces that stands up out of the collar.
    bm = bmesh.new()
    tr, tc = 12, 8
    tv = []
    for i in range(tr + 1):
        t = lerp(0.3, 0.7, i / tr)
        row = []
        half_w = min(0.5, phi_open(t) + 0.16)
        for j in range(tc + 1):
            k = lerp(-1.0, 1.0, j / tc)
            x, y, z = arch_pt(t, k * half_w)
            # Raised in the middle, tucked just inside the upper at its edges.
            lift = (0.0015 + 0.014 * sm(0.38, 0.3, t)) * (1 - k * k) - 0.003 * k * k
            row.append(bm.verts.new((x - 0.004 * sm(0.36, 0.3, t), y * (1 - 0.06 * k * k), z + lift)))
        tv.append(row)
    for i in range(tr):
        for j in range(tc):
            bm.faces.new((tv[i][j], tv[i][j + 1], tv[i + 1][j + 1], tv[i + 1][j]))
    tg = C.obj_from_bmesh('tongue', bm, mats['upper' if kind == 'court' else 'tongue'])
    s2 = tg.modifiers.new('Thick', 'SOLIDIFY'); s2.thickness = 0.0045; s2.offset = -1
    subsurf(tg, SUB)
    objs['tongue'] = tg

    # Eyelets: metal rings at each lace hole, tilted with the throat. Laces: round cord, criss-crossed over the
    # tongue from the toe end up, with a straight bar at the bottom pair.
    eyelets = []
    for a, b in pairs:
        for p in (a, b):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.0026, minor_radius=0.0008, major_segments=20 if hi else 10, minor_segments=8 if hi else 5,
                                             location=p, rotation=(math.radians(-60 if p.y < 0 else 60), 0, 0))
            eyelets.append(bpy.context.object)
    objs['eyelets'] = C.join('eyelets', eyelets)
    objs['eyelets'].data.materials.clear(); objs['eyelets'].data.materials.append(mats['eyelets'])
    for p in objs['eyelets'].data.polygons:
        p.use_smooth = True
    cu = bpy.data.curves.new('laces', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.0017
    cu.bevel_resolution = 4 if hi else 2
    cu.resolution_u = 16 if hi else 6

    def span(p0, p1, rise):
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(2)
        mid = (p0 + p1) / 2
        mid.z += rise
        for bp, co in zip(sp.bezier_points, (p0, mid, p1)):
            bp.co = co
            bp.handle_left_type = bp.handle_right_type = 'AUTO'

    lift = Vector((0, 0, 0.0012))
    ordered = sorted(pairs, key=lambda ab: -ab[0].x)  # toe end first

    def rise(p0, p1):  # clear the tongue: from the eyelets up over its center
        t = ((p0.x + p1.x) / 2) / L
        return arch_pt(t, 0.0)[2] + 0.0075 - (p0.z + p1.z) / 2

    span(ordered[0][0] + lift, ordered[0][1] + lift, rise(*ordered[0]))
    for (a0, b0), (a1, b1) in zip(ordered, ordered[1:]):
        span(a0 + lift, b1 + lift, rise(a0, b1))
        span(b0 + lift, a1 + lift, rise(b0, a1) + 0.0012)
    lo = bpy.data.objects.new('laces', cu)
    bpy.context.collection.objects.link(lo)
    lo.data.materials.append(mats['laces'])
    C.apply_all(lo)
    objs['laces'] = bpy.context.view_layer.objects.active

    # Heel tab: a pull loop against the back of the collar, standing a little above it.
    bm = bmesh.new()
    zt = arch_pt(0.03, phi_open(0.03))[2]
    hv = []
    for i in range(11):
        k = i / 10
        z = zt - 0.026 + 0.04 * k
        x = -0.0018 - 0.0035 * math.sin(math.pi * k) - 0.002 * k
        hv.append([bm.verts.new((x, yy, z)) for yy in (-0.0105, 0.0105)])
    for i in range(10):
        bm.faces.new((hv[i][0], hv[i][1], hv[i + 1][1], hv[i + 1][0]))
    ht = C.obj_from_bmesh('heel_tab', bm, mats['heel_tab'])
    s3 = ht.modifiers.new('Thick', 'SOLIDIFY'); s3.thickness = 0.0028; s3.offset = 1
    subsurf(ht, SUB)
    objs['heel_tab'] = C.join('heel_tab', [ht, hc])

    # Stitching: short dashes around the top of the sole (court) or along the toe of the midsole (runner).
    bm = bmesh.new()
    nrm2 = normals2d(pts)
    for i, ((x, y, t), (nx, ny)) in enumerate(zip(pts, nrm2)):
        if i % 2:
            continue
        z = z_top(t) - (0.005 if kind == 'court' else 0.009)
        if kind == 'runner' and not (0.55 < t < 0.98):
            continue
        out = 0.0007 + (flare(t) * 0.4 if kind == 'runner' else 0.0004)
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(0.0028, 0.0007, 0.0007), verts=r['verts'])
        ang = math.atan2(-nx, ny)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(ang, 3, 'Z'), verts=r['verts'])
        bmesh.ops.translate(bm, vec=(x + nx * out, y + ny * out, z), verts=r['verts'])
    st = C.obj_from_bmesh('stitch', bm, mats['stitch'])
    objs['stitch'] = st
    return objs


if __name__ == '__main__':
    a = C.args()
    C.reset()
    objs = build(a.get('kind', 'runner'), a.get('lod', 'high'))
    out = os.path.abspath(a.get('out', 'build/shoe.raw.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if a.get('preview'):
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'MATERIAL'
        sc.render.resolution_x, sc.render.resolution_y = 1200, 700
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        bpy.context.collection.objects.link(cam)
        from mathutils import Vector
        az = float(a.get('az', -60))
        cam.location = Vector((L / 2 + 0.5 * math.sin(math.radians(az)), -0.5 * math.cos(math.radians(az)), 0.22))
        cam.rotation_euler = (Vector((L / 2, 0, 0.04)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = 50
        sc.camera = cam
        sc.render.filepath = a['preview']
        bpy.ops.render.render(write_still=True)
    else:
        C.export_glb(out, list(objs.values()), images=True)
    print('EXPORTED', out, sorted(objs))
