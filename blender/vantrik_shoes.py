"""VANTRIK shoes, modeled from a foot outline: the VK-1 runner and the VK-2 court shoe.

blender -b -P blender/vantrik_shoes.py -- --kind runner|court --lod high|low --out build/runner-high.raw.glb

Blender axes: x runs heel (0) to toe (L), y across the foot (lateral side is -y), z up. In three.js the toe points
to +x, up is +y and the lateral side faces +z (toward the camera).
Parts (object names): outsole, midsole, insole, upper (with the padded collar), overlay (mudguard or toe cap),
trim (heel counter, eyestays, side stripe, heel tab, tongue loop), tongue, label, laces, eyelets, stitch and perf
(court toe-box holes).
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
    cols, rows = 12, 16
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
# Heights in meters. zb: the underside of the sole (toe spring and heel bevel). sole: outsole thickness. stack: foam
# under the foot. bed: where the foot sits. wall: how far the sole rises past the bed up the side of the upper.
KINDS = {
    'runner': dict(
        zb=lambda t: 0.016 * sm(0.6, 1.0, t) ** 1.6 + 0.007 * sm(0.07, 0.0, t) ** 1.4,
        sole=0.004,
        stack=lambda t: 0.034 - 0.012 * sm(0.22, 0.8, t),
        wall=lambda t: 0.003 + 0.006 * sm(0.3, 0.05, t),
        flare=lambda t: 0.004 * sm(0.32, 0.0, t) + 0.0012,
        upper_h=lambda t: 0.064 + 0.009 * sm(0.1, 0.0, t) + 0.012 * sm(0.3, 0.5, t) - 0.05 * sm(0.5, 0.9, t) - 0.021 * sm(0.9, 1.0, t),
        holes=7,
    ),
    'court': dict(
        zb=lambda t: 0.008 * sm(0.74, 1.0, t) ** 1.8 + 0.0015 * sm(0.04, 0.0, t),
        sole=0.0035,
        stack=lambda t: 0.016,
        wall=lambda t: 0.013,
        flare=lambda t: 0.0,
        upper_h=lambda t: 0.058 + 0.007 * sm(0.1, 0.0, t) + 0.013 * sm(0.3, 0.5, t) - 0.042 * sm(0.5, 0.9, t) - 0.022 * sm(0.9, 1.0, t),
        holes=7,
    ),
}
EPS = 1e-6


def side_profile(zbot, ztop, rb, rt, inset, steps, rows):
    """Profile rings round a slab: rounded bottom edge, a side wall of `rows` rings, rounded top edge.
    inset(t, k): how far each ring sits in from the outline (k = 0 at the bottom of the wall, 1 at the top)."""
    prof = []
    for i in range(steps + 1):
        a = math.pi * 1.5 - (math.pi / 2) * i / steps
        prof.append((lambda t, a=a: inset(t, 0.0) + rb + rb * math.cos(a), lambda t, a=a: zbot(t) + rb + rb * math.sin(a)))
    for j in range(1, rows):
        k = j / rows
        prof.append((lambda t, k=k: inset(t, k), lambda t, k=k: lerp(zbot(t) + rb, ztop(t) - rt, k)))
    for i in range(steps + 1):
        a = math.pi - (math.pi / 2) * i / steps
        prof.append((lambda t, a=a: inset(t, 1.0) + rt + rt * math.cos(a), lambda t, a=a: ztop(t) - rt + rt * math.sin(a)))
    return prof


def dash_strip(bm, pts, normals, length=0.0024, gap=0.0016, w=0.0006, lift=0.0004):
    """Stitches: short raised dashes along a polyline sitting on a surface."""
    acc, on, start = 0.0, True, None
    seg = []
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        d = (b - a).length
        if d < 1e-9:
            continue
        acc += d
        if on and acc >= length:
            seg.append((start or a, b, normals[i]))
            on, acc, start = False, 0.0, None
        elif not on and acc >= gap:
            on, acc, start = True, 0.0, b
    for a, b, n in seg:
        mid = (a + b) / 2
        dvec = (b - a)
        ln = max(dvec.length, 1e-6)
        if ln > length * 1.8:  # a jump in the line (a seam or the end of a loop), not a stitch
            continue
        r = bmesh.ops.create_cube(bm, size=1.0)
        # Build a little box along the stitch direction.
        ax = dvec / ln
        up = n.normalized()
        side = ax.cross(up).normalized()
        m = Matrix((ax * ln, side * w, up * w * 0.9)).transposed()
        bmesh.ops.transform(bm, matrix=m.to_4x4(), verts=r['verts'])
        bmesh.ops.translate(bm, vec=mid + up * lift, verts=r['verts'])


def build(kind='runner', lod='high'):
    K = KINDS[kind]
    hi = lod in ('high', 'photo')
    SUB = {'photo': 2, 'high': 1, 'low': 1}[lod]
    n_side = {'photo': 150, 'high': 104, 'low': 64}[lod]
    pts = outline(n_side)
    runner = kind == 'runner'
    mats = {
        'outsole': C.material('outsole', (0.05, 0.05, 0.05), roughness=0.8),
        'midsole': C.material('midsole', (0.86, 0.84, 0.8), roughness=0.55),
        'insole': C.material('insole', (0.18, 0.18, 0.2), roughness=0.9),
        'upper': C.material('upper', (0.8, 0.78, 0.74), roughness=0.82 if runner else 0.42, coat=0.0 if runner else 0.25),
        'overlay': C.material('overlay', (0.8, 0.78, 0.74), roughness=0.35 if runner else 0.4, coat=0.35 if runner else 0.3),
        'tongue': C.material('tongue', (0.8, 0.78, 0.74), roughness=0.85),
        'label': C.material('label', (0.03, 0.03, 0.035), roughness=0.7),
        'laces': C.material('laces', (0.9, 0.9, 0.88), roughness=0.8),
        'eyelets': C.material('eyelets', (0.75, 0.75, 0.76), metallic=1.0, roughness=0.3),
        'trim': C.material('trim', (0.12, 0.12, 0.12), roughness=0.5, coat=0.2),
        'stitch': C.material('stitch', (0.92, 0.9, 0.85), roughness=0.8),
        'perf': C.material('perf', (0.02, 0.02, 0.02), roughness=0.9),
    }
    if runner:
        with_normal(mats['upper'], knit_normal(os.path.join(TEX, 'vantrik_knit.png')), 1.35)
        with_normal(mats['tongue'], knit_normal(os.path.join(TEX, 'vantrik_knit.png')), 0.8)
    else:
        g = grain_normal(os.path.join(TEX, 'vantrik_grain.png'))
        for k in ('upper', 'overlay', 'tongue'):
            with_normal(mats[k], g, 0.45)

    zb, so, stack, flare, wall = K['zb'], K['sole'], K['stack'], K['flare'], K['wall']
    z_mid0 = lambda t: zb(t) + so
    z_bed = lambda t: zb(t) + so + stack(t)
    z_top = lambda t: z_bed(t) + wall(t)
    objs = {}

    # --- Sole ---------------------------------------------------------------------------------------------------
    def mid_inset(t, k):
        base = -flare(t) * 0.4 if runner else -0.0028
        v = base - flare(t) * math.sin(math.pi * k) * 0.8
        if runner:
            # Horizontal ripples on the heel sidewall and vertical flex grooves under the forefoot.
            v += 0.0011 * sm(0.5, 0.2, t) * (0.5 + 0.5 * math.cos(2 * math.pi * 3 * k)) * sm(0.05, 0.2, k) * sm(0.95, 0.8, k)
            for tg in (0.6, 0.665, 0.73, 0.795):
                v += 0.0012 * math.exp(-((t - tg) / 0.006) ** 2) * sm(0.62, 0.3, k)
        else:
            # A cupsole: one groove round the wall below the stitch line.
            v += 0.0013 * math.exp(-((k - 0.36) / 0.07) ** 2)
        return v

    objs['midsole'] = loft_solid('midsole', pts, side_profile(lambda t: z_mid0(t) - 0.0004, z_top, 0.0018, 0.004 if runner else 0.0016,
                                                              mid_inset, 5 if hi else 3, 14 if hi else 7), mats['midsole'])

    # Outsole: a rubber layer that wraps up the toe and the heel, with lug teeth showing on the side.
    def wrap(t):
        return (0.013 * sm(0.86, 1.0, t) + 0.008 * sm(0.08, 0.0, t)) if runner else 0.002 * sm(0.9, 1.0, t)

    def out_inset(t, k):
        teeth = 0.0012 * max(0.0, math.sin(2 * math.pi * 34 * t)) * sm(0.6, 0.2, k)
        return mid_inset(t, 0.0) - 0.0009 - teeth

    objs['outsole'] = loft_solid('outsole', pts, side_profile(zb, lambda t: z_mid0(t) + wrap(t), 0.0012, 0.0008, out_inset, 3, 5 if hi else 3), mats['outsole'])
    # Lugs on the bottom: hexes on the runner, a herringbone on the court.
    bm = bmesh.new()
    step = 0.0095 if runner else 0.008
    for xi in np.arange(0.012, L - 0.008, step):
        t = xi / L
        w = half_width(t) - 0.006
        for yi in np.arange(-w, w + 1e-6, step):
            if runner:
                r = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0036, radius2=0.0029, depth=0.002)
            else:
                r = bmesh.ops.create_cube(bm, size=1.0)
                bmesh.ops.scale(bm, vec=(0.0075, 0.0018, 0.0014), verts=r['verts'])
                bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(38 if int(xi / step) % 2 else -38), 3, 'Z'), verts=r['verts'])
            bmesh.ops.translate(bm, vec=(xi, yi + (step / 2 if int(xi / step) % 2 else 0), zb(t) - 0.0008), verts=r['verts'])
    lugs = C.obj_from_bmesh('tread', bm, mats['outsole'], smooth=False)
    objs['outsole'] = C.join('outsole', [objs['outsole'], lugs])
    objs['insole'] = loft_solid('insole', pts, rounded_profile(lambda t: z_bed(t) - 0.0005, lambda t: z_bed(t) + 0.003, 0.001, 0.0015, inset=lambda t: 0.006, steps=3), mats['insole'])

    # --- Upper --------------------------------------------------------------------------------------------------
    # Lofted from cross-section arches: each slice runs from the lateral edge of the sole, over the foot, to the
    # medial edge. The collar and the throat cut the top of the arch away (phi_open).
    H = K['upper_h']
    cols = {'photo': 96, 'high': 72, 'low': 40}[lod]
    half = {'photo': 16, 'high': 12, 'low': 7}[lod]
    pw = 2.6

    def phi_open(t):
        collar = lerp(0.72, 0.95, sm(0.0, 0.2, t))
        return lerp(lerp(collar, 0.36, sm(0.24, 0.4, t)), 0.0, sm(0.64, 0.73, t))

    def arch_pt(t, phi):
        t = min(1.0, max(0.0, t))
        w = 0.0 if t <= 0 or t >= 1 else half_width(t, phi > 0) + 0.0004
        hh = H(t)
        if not runner:  # creases across the vamp where the foot bends
            c = 0.0009 * math.exp(-((t - 0.69) / 0.02) ** 2) * (1 - abs(phi) / (math.pi / 2)) * (0.5 + 0.5 * math.sin(phi * 14))
            w += c
            hh += c
        sn, cs = math.sin(phi), math.cos(phi)
        e = 2 / lerp(pw, 2.0, sm(0.7, 1.0, t))
        y = w * math.copysign(abs(sn) ** e, sn)
        z = z_bed(t) - 0.002 + hh * abs(cs) ** e
        return Vector((t * L, y, z))

    def apos(t, a, side):  # a = 0 at the opening edge (or the center line), 1 at the sole
        po = phi_open(t)
        return side * (po + (math.pi / 2 - po) * a)

    def surf(t, a, side):
        t = min(0.9985, max(0.0015, t))
        p = arch_pt(t, apos(t, a, side))
        e = 0.002
        dt = arch_pt(t + e, apos(t + e, a, side)) - arch_pt(t - e, apos(t - e, a, side))
        a0, a1 = max(0.0, a - 0.02), min(1.0, a + 0.02)
        da = arch_pt(t, apos(t, a1, side)) - arch_pt(t, apos(t, a0, side))
        n = dt.cross(da)
        if n.length < 1e-9:
            n = Vector((0, side, 0.3))
        n.normalize()
        ref = p - Vector((t * L, 0, z_bed(t) + 0.3 * H(t)))
        if n.dot(ref) < 0:
            n = -n
        return p, n

    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    ts = [0.5 * (i / cols) + 0.5 * (0.5 - 0.5 * math.cos(math.pi * i / cols)) for i in range(cols + 1)]
    grid, top_lat, top_med = [], [], []
    for t in ts:
        po = phi_open(t)
        col = []
        for r in range(half + 1):
            col.append(arch_pt(t, -(math.pi / 2) + (math.pi / 2 - po) * r / half))
        for r in range(half + 1):
            col.append(arch_pt(t, po + (math.pi / 2 - po) * r / half))
        top_lat.append((col[half].copy(), t)); top_med.append((col[half + 1].copy(), t))
        grid.append([bm.verts.new(c) for c in col])
    nrows = len(grid[0])
    for i in range(cols):
        for r in range(nrows - 1):
            if r == half and phi_open(ts[i]) > 1e-4 and phi_open(ts[i + 1]) > 1e-4:
                continue
            f = bm.faces.new((grid[i][r], grid[i + 1][r], grid[i + 1][r + 1], grid[i][r + 1]))
            for loop, (ii, rr) in zip(f.loops, ((i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1))):
                loop[uv].uv = (ts[ii] * 8.0, rr / (nrows - 1) * 3.0)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=EPS)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    up = C.obj_from_bmesh('upper', bm, mats['upper'])
    UT = 0.0028 if runner else 0.0022
    sol = up.modifiers.new('Thick', 'SOLIDIFY'); sol.thickness = UT; sol.offset = 0  # centered, so panels can sit just outside it
    subsurf(up, SUB)

    # Padded collar: a roll round the opening, fatter at the two ankle bolsters.
    loop = [(c, t) for c, t in reversed(top_lat) if 0.0 < t <= 0.66] + [(c, t) for c, t in top_med if 0.0 < t <= 0.66]
    cu = bpy.data.curves.new('collar', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.0026 if runner else 0.002
    cu.bevel_resolution = 4 if hi else 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(loop) - 1)
    for pnt, (co, t) in zip(sp.points, loop):
        pnt.co = (co.x + 0.0008, co.y * 0.96, co.z - 0.001, 1)
        pnt.radius = 1.0 + 0.9 * math.exp(-((t - 0.16) / 0.05) ** 2) - 0.45 * sm(0.3, 0.42, t)
    co_ = bpy.data.objects.new('collar', cu)
    bpy.context.collection.objects.link(co_)
    co_.data.materials.append(mats['upper'] if runner else mats['overlay'])
    C.apply_all(co_)
    collar = bpy.context.view_layer.objects.active
    m_ = collar.modifiers.new('Smooth', 'SMOOTH'); m_.iterations = 8
    for poly in collar.data.polygons:
        poly.use_smooth = True
    objs['upper'] = C.join('upper', [up, collar])

    # --- Overlays: each panel sits on the upper, has a thickness and a row of stitches along its edge -----------
    stitch_bm = bmesh.new()

    def panel(name, mat, fn, nu, nv, off=None, thick=0.0012, sides=(-1, 1), stitch=('v0',), inset=0.0016):
        off = UT / 2 + 0.0005 if off is None else off
        bm = bmesh.new()
        outward = {}
        for side in sides:
            g = []
            for i in range(nu + 1):
                row = []
                for j in range(nv + 1):
                    t, a = fn(i / nu, j / nv)
                    p, n = surf(t, min(1.0, max(0.0, a)), side)
                    v = bm.verts.new(p + n * off)
                    outward[v] = n
                    row.append(v)
                g.append(row)
            for i in range(nu):
                for j in range(nv):
                    f = bm.faces.new((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]))
                    f.normal_update()
                    # Faces must face away from the foot so the thickness grows outward, on top of the upper.
                    if f.normal.dot(sum((outward[v] for v in f.verts), Vector())) < 0:
                        f.normal_flip()
            # Stitch rows just inside the chosen edges.
            for edge in stitch:
                line, nrm = [], []
                steps = 120
                for s in range(steps + 1):
                    u = s / steps
                    if edge == 'v0': uu, vv = u, inset * 40
                    elif edge == 'v1': uu, vv = u, 1 - inset * 40
                    elif edge == 'u0': uu, vv = inset * 40, u
                    else: uu, vv = 1 - inset * 40, u
                    t, a = fn(uu, vv)
                    p, n = surf(t, min(1.0, max(0.0, a)), side)
                    line.append(p + n * (off + thick)); nrm.append(n)
                dash_strip(stitch_bm, line, nrm)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        o = C.obj_from_bmesh(name, bm, mat)
        s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = thick; s.offset = 1
        subsurf(o, SUB)
        return o

    q = 1 if hi else 2
    overlays, trims = [], []
    # Heel counter: climbs near the collar at the back and sweeps down to the sole by mid-foot.
    hc_top = lambda t: lerp(0.94, 0.0, sm(0.06, 0.3, t))
    trims.append(panel('counter', mats['trim'] if runner else mats['overlay'],
                       lambda u, v: (lerp(0.0015, 0.3, u), lerp(1 - hc_top(lerp(0.0015, 0.3, u)), 1.0, v)), 30 // q, 8 // q))
    # Eyestay: a strip along each side of the throat that carries the eyelets.
    trims.append(panel('eyestay', mats['trim'] if runner else mats['overlay'],
                       lambda u, v: (lerp(0.33, 0.69, u), v * 0.24 * sm(0.0, 0.08, u) * sm(1.0, 0.86, u) + 0.002), 30 // q, 4, stitch=('v1',)))
    if runner:
        # Mudguard: a smooth band low round the toe and the forefoot.
        mg = lambda t: 0.36 * sm(0.48, 0.62, t) + 0.12 * sm(0.78, 0.96, t)
        overlays.append(panel('mudguard', mats['overlay'], lambda u, v: (lerp(0.48, 0.999, u), lerp(1 - mg(lerp(0.48, 0.999, u)), 1.0, v)), 40 // q, 6 // q))
    else:
        # Toe cap with a curved back edge, and a perforated toe box behind it.
        overlays.append(panel('toecap', mats['overlay'], lambda u, v: (lerp(0.79 + 0.06 * v * v, 0.999, u), v), 18 // q, 14 // q, stitch=('u0',)))
    # Side stripe: a diagonal band on both sides, wider in the middle.
    def stripe(u, v):
        t = lerp(0.22, 0.6, u)
        c = lerp(0.8, 0.3, u)
        w = 0.2 * sm(0.0, 0.12, u) * sm(1.0, 0.88, u) + 0.02
        return t, c + (v - 0.5) * w
    trims.append(panel('stripe', mats['trim'], stripe, 32 // q, 4, stitch=('v0', 'v1'), inset=0.004))

    # Perforations on the court toe box.
    if not runner:
        pb = bmesh.new()
        for t in np.arange(0.7, 0.785, 0.0115):
            for a in np.arange(0.06, 0.62, 0.085):
                for side in (-1, 1):
                    p, n = surf(t, a, side)
                    r = bmesh.ops.create_icosphere(pb, subdivisions=2 if hi else 1, radius=0.0009)
                    bmesh.ops.scale(pb, vec=(1, 1, 0.5), verts=r['verts'])
                    bmesh.ops.translate(pb, vec=p + n * (UT / 2 + 0.0003), verts=r['verts'])
        objs['perf'] = C.obj_from_bmesh('perf', pb, mats['perf'])

    objs['overlay'] = C.join('overlay', overlays)

    # Lace holes along the eyestays.
    pairs = []
    for k in range(K['holes']):
        tt = lerp(0.4, 0.665, k / (K['holes'] - 1))
        pa, na = surf(tt, 0.11, -1)
        pb_, nb = surf(tt, 0.11, 1)
        pairs.append((pa + na * (UT / 2 + 0.0034), pb_ + nb * (UT / 2 + 0.0034), na, nb))

    # Tongue: padded, under the laces, with a woven label and a pull loop at the top.
    bm = bmesh.new()
    tr, tc = 14, 8
    tv = []
    for i in range(tr + 1):
        t = lerp(0.29, 0.71, i / tr)
        row = []
        half_w = min(0.5, phi_open(t) + 0.16)
        for j in range(tc + 1):
            k = lerp(-1.0, 1.0, j / tc)
            p = arch_pt(t, k * half_w)
            lift = (0.0015 + 0.016 * sm(0.38, 0.29, t)) * (1 - k * k) - 0.003 * k * k
            row.append(bm.verts.new((p.x - 0.005 * sm(0.36, 0.29, t), p.y * (1 - 0.06 * k * k), p.z + lift)))
        tv.append(row)
    for i in range(tr):
        for j in range(tc):
            bm.faces.new((tv[i][j], tv[i][j + 1], tv[i + 1][j + 1], tv[i + 1][j]))
    tg = C.obj_from_bmesh('tongue', bm, mats['tongue'] if runner else mats['upper'])
    s2 = tg.modifiers.new('Thick', 'SOLIDIFY'); s2.thickness = 0.005; s2.offset = -1
    subsurf(tg, SUB)
    objs['tongue'] = tg
    tt = 0.335
    tp = arch_pt(tt, 0.0)
    ztongue = tp.z + 0.0015 + 0.016 * sm(0.38, 0.29, tt)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(tp.x - 0.005 * sm(0.36, 0.29, tt), 0, ztongue + 0.0006))
    lab = bpy.context.object
    lab.name = 'label'
    lab.data.name = 'label'
    lab.scale = (0.014, 0.019, 0.0012)
    lab.rotation_euler = (0, math.radians(-22), 0)
    C.bevel(lab, 0.0004, 2)
    lab.data.materials.append(mats['label'])
    cu = bpy.data.curves.new('loop', 'CURVE')
    cu.dimensions = '3D'; cu.bevel_depth = 0.0011; cu.bevel_resolution = 2
    spl = cu.splines.new('BEZIER'); spl.bezier_points.add(2)
    x0 = tp.x - 0.007
    for bp, co in zip(spl.bezier_points, ((x0 + 0.004, 0, ztongue + 0.003), (x0 - 0.006, 0, ztongue + 0.012), (x0 - 0.002, 0, ztongue - 0.001))):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    lo_ = bpy.data.objects.new('loop', cu); bpy.context.collection.objects.link(lo_); lo_.data.materials.append(mats['trim'])
    C.apply_all(lo_)
    loop_o = bpy.context.view_layer.objects.active
    objs['label'] = lab

    # Eyelets and laces, criss-crossed over the tongue from the toe end up.
    eyes = []
    for pa, pb_, na, nb in pairs:
        for p, n in ((pa, na), (pb_, nb)):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.0025, minor_radius=0.0007, major_segments=20 if hi else 10, minor_segments=8 if hi else 5, location=p)
            o = bpy.context.object
            o.rotation_euler = Vector((0, 0, 1)).rotation_difference(n).to_euler()
            eyes.append(o)
    objs['eyelets'] = C.join('eyelets', eyes)
    objs['eyelets'].data.materials.clear(); objs['eyelets'].data.materials.append(mats['eyelets'])
    for p in objs['eyelets'].data.polygons:
        p.use_smooth = True
    cu = bpy.data.curves.new('laces', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.0017 if runner else 0.0014
    cu.bevel_resolution = 4 if hi else 2
    cu.resolution_u = 16 if hi else 6

    def span(p0, p1):
        t = ((p0.x + p1.x) / 2) / L
        mid = (p0 + p1) / 2
        mid.z = arch_pt(t, 0.0).z + 0.0072 + 0.012 * sm(0.42, 0.36, t)
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(2)
        for bp, co in zip(sp.bezier_points, (p0, mid, p1)):
            bp.co = co
            bp.handle_left_type = bp.handle_right_type = 'AUTO'

    ordered = sorted(pairs, key=lambda ab: -ab[0].x)
    span(ordered[0][0], ordered[0][1])
    for (a0, b0, _, _), (a1, b1, _, _) in zip(ordered, ordered[1:]):
        span(a0, b1)
        span(b0, a1)
    lo = bpy.data.objects.new('laces', cu)
    bpy.context.collection.objects.link(lo)
    lo.data.materials.append(mats['laces'])
    C.apply_all(lo)
    objs['laces'] = bpy.context.view_layer.objects.active

    # Heel pull tab above the back of the collar.
    bm = bmesh.new()
    zt = arch_pt(0.03, phi_open(0.03)).z
    hv = []
    for i in range(11):
        k = i / 10
        z = zt - 0.024 + 0.038 * k
        x = -0.004 - 0.0035 * math.sin(math.pi * k) - 0.002 * k
        hv.append([bm.verts.new((x, yy, z)) for yy in (-0.0095, 0.0095)])
    for i in range(10):
        bm.faces.new((hv[i][0], hv[i][1], hv[i + 1][1], hv[i + 1][0]))
    ht = C.obj_from_bmesh('heel_tab', bm, mats['trim'])
    s3 = ht.modifiers.new('Thick', 'SOLIDIFY'); s3.thickness = 0.0026; s3.offset = 1
    subsurf(ht, SUB)
    objs['trim'] = C.join('trim', [ht, loop_o] + trims)

    objs['stitch'] = C.obj_from_bmesh('stitch', stitch_bm, mats['stitch'], smooth=False)
    # Sole stitching: a row round the cupsole (court) or along the toe of the midsole (runner).
    stitch_bm = bmesh.new()
    nrm2 = normals2d(pts)
    line, nl = [], []
    for (x, y, t), (nx, ny) in zip(pts, nrm2):
        if runner and not (0.56 < t < 0.97):
            if line:
                dash_strip(stitch_bm, line, nl)
                line, nl = [], []
            continue
        z = z_top(t) - (0.0055 if not runner else 0.009)
        k = (z - z_mid0(t)) / max(1e-6, z_top(t) - z_mid0(t))
        out = -mid_inset(t, k) + 0.0003
        line.append(Vector((x + nx * out, y + ny * out, z)))
        nl.append(Vector((nx, ny, 0)))
    if line:
        if not runner:
            line.append(line[0]); nl.append(nl[0])
        dash_strip(stitch_bm, line, nl)
    objs['sole_stitch'] = C.obj_from_bmesh('sole_stitch', stitch_bm, mats['stitch'], smooth=False)
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
