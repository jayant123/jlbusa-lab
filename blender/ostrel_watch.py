"""OSTREL Meridian 40: parametric watch model, exported as named parts for the scroll explosion.

blender -b -P blender/ostrel_watch.py -- --lod high|mid|low --out public/ostrel/watch-high.glb

Units are meters (40 mm case = 0.040). Z is the watch axis here; glTF export turns it into +Y.
Materials named *_finish are swapped at runtime per configurator choice (case, dial, strap).
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

FONT = os.path.join(os.path.dirname(__file__), 'fonts', 'Archivo-Expanded-Medium.ttf')
SEG = {'high': 192, 'mid': 96, 'low': 48}


def mats():
    return {
        'case': C.material('case_finish', (0.80, 0.80, 0.82), metallic=1.0, roughness=0.32, anisotropic=0.6),
        'bezel': C.material('bezel_finish', (0.86, 0.86, 0.88), metallic=1.0, roughness=0.12),
        'dial': C.material('dial_finish', (0.018, 0.018, 0.02), metallic=0.3, roughness=0.28, coat=0.6, anisotropic=0.5),
        'applique': C.material('applique_steel', (0.95, 0.95, 0.96), metallic=1.0, roughness=0.26),
        'index': C.material('index_steel', (0.92, 0.92, 0.93), metallic=1.0, roughness=0.08),  # applied hour markers (their lume plots glow at night)
        'print': C.material('dial_print', (0.86, 0.84, 0.80), roughness=0.6),
        'hands': C.material('hands_steel', (0.92, 0.92, 0.93), metallic=1.0, roughness=0.1),
        'lume': C.material('lume', (0.90, 0.93, 0.86), roughness=0.55),
        'accent': C.material('seconds_accent', (0.86, 0.66, 0.38), metallic=1.0, roughness=0.25),
        'glass': C.material('glass_crystal', (1.0, 1.0, 1.0), roughness=0.02, transmission=1.0, ior=1.77),
        'rhodium': C.material('movement_rhodium', (0.78, 0.79, 0.80), metallic=1.0, roughness=0.38),
        'gold': C.material('gold_wheel', (0.93, 0.74, 0.45), metallic=1.0, roughness=0.22),
        'steel': C.material('blued_steel', (0.12, 0.18, 0.42), metallic=1.0, roughness=0.18),
        'ruby': C.material('jewel_ruby', (0.55, 0.02, 0.06), roughness=0.05, transmission=0.6, ior=1.76),
        'strap': C.material('strap_finish', (0.02, 0.02, 0.022), roughness=0.62),
        'bracelet': C.material('bracelet_steel', (0.82, 0.82, 0.84), metallic=1.0, roughness=0.3, anisotropic=0.6),
        'bridge': C.material('bridge_rhodium', (0.80, 0.81, 0.82), metallic=1.0, roughness=0.3),
        'stitch': C.material('strap_stitch', (0.52, 0.47, 0.40), roughness=0.85),
        'hole': C.material('strap_hole', (0.004, 0.004, 0.004), roughness=1.0),
        'date': C.material('date_disc', (0.92, 0.91, 0.88), roughness=0.5),
        'date_ink': C.material('date_print', (0.02, 0.02, 0.02), roughness=0.6),
    }


def lug(name, x0, x1, sign, mat):
    prof = [(0.0150, 0.0036), (0.0150, 0.0082), (0.0185, 0.0080), (0.0215, 0.0071), (0.0238, 0.0058), (0.0246, 0.0046),
            (0.0242, 0.0034), (0.0225, 0.0029), (0.0190, 0.0031)]
    bm = bmesh.new()
    a = [bm.verts.new((x0, sign * y, z)) for y, z in prof]
    b = [bm.verts.new((x1, sign * y, z)) for y, z in prof]
    bm.faces.new(a[::-1] if sign > 0 else a)
    bm.faces.new(b if sign > 0 else b[::-1])
    n = len(prof)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, mat, smooth=True)
    C.bevel(o, 0.0007, 4)
    return o


def faceted(name, stations, z0, thick, ridge_k, steel, lume=None, lume_span=None, lume_f=0.5):
    """A polished, faceted hand or index along +Y. stations: [(y, half_width)] from tail to tip.
    The top has a centre ridge with two sloped facets. A lume band runs down the middle between lume_span[0] and
    lume_span[1]. Steel stays on the facets either side, so the lume reads as an inlay."""
    st = sorted(stations)
    if lume_span:
        for yl in lume_span:
            for i in range(len(st) - 1):
                (ya, wa), (yb, wb) = st[i], st[i + 1]
                if ya < yl < yb:
                    st.insert(i + 1, (yl, wa + (wb - wa) * (yl - ya) / (yb - ya)))
                    break
    bm = bmesh.new()
    rows = []
    for y, w in st:
        zt = z0 + thick
        r = w * ridge_k
        f = lume_f
        rows.append([bm.verts.new(v) for v in [(-w, y, z0), (-w, y, zt), (-w * f, y, zt + r * (1 - f)), (0, y, zt + r),
                                                (w * f, y, zt + r * (1 - f)), (w, y, zt), (w, y, z0)]])
    faces = []
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        ym = (st[i][0] + st[i + 1][0]) / 2
        in_lume = lume_span and lume_span[0] <= ym <= lume_span[1]
        for k in range(6):
            mi = 1 if in_lume and k in (2, 3) else 0
            faces.append(((a[k], b[k], b[k + 1], a[k + 1]), mi))
        faces.append(((a[6], b[6], b[0], a[0]), 0))
    faces.append((tuple(rows[0]), 0))
    faces.append((tuple(rows[-1][::-1]), 0))
    for vs, mi in faces:
        try:
            bm.faces.new(vs).material_index = mi
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-9)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = C.obj_from_bmesh(name, bm, steel, smooth=False)
    if lume:
        o.data.materials.append(lume)
    return o


def rotated(o, angle):
    o.rotation_euler.z = angle
    return o


def cyl(name, r, h, loc, rot, mat, seg=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.view_layer.objects.active
    o.scale = size
    o.name = name
    o.data.materials.append(mat)
    return o


def strap_path(length, segs):
    """Centre line of a strap: (y, z, half width, thickness) per station."""
    out = []
    for i in range(segs + 1):
        t = i / segs
        y = 0.0205 + t * length
        out.append((t, y, 0.0052 - 2.4 * (y - 0.0205) ** 2 - 0.004 * t, 0.0036 - 0.0008 * t))
    return out


def strap_extras(name, sign, m, length, tip, lod, width0=0.0200, width1=0.0165):
    """Edge stitching, keepers and holes (tip strap) or a tang buckle (short strap)."""
    if lod == 'low':
        return []
    out = []
    path = strap_path(length, 400)
    def at(y):
        for (t, yy, z, th) in path:
            if yy >= y:
                w = (width0 + (width1 - width0) * t) / 2
                return t, z, th, w
        t, yy, z, th = path[-1]
        return t, z, th, (width0 + (width1 - width0) * t) / 2
    step = 0.0021 if lod == 'high' else 0.0032
    y = 0.0225
    stop = 0.0205 + length - (0.010 if tip else 0.004)
    n = 0
    while y < stop:
        t, z, th, w = at(y)
        slope = -4.8 * (y - 0.0205) - 0.004 / length
        for sx in (-1, 1):
            out.append(box(f'{name}_st{n}_{sx}', (0.00026, 0.00105, 0.00012), (sx * (w - 0.0010), sign * y, z + th / 2 - 0.00005), m['stitch'],
                           rot=(sign * math.atan(slope), 0, 0)))
            if lod == 'high':
                C.bevel(out[-1], 0.00004, 1)
        n += 1
        y += step
    if tip:
        for k, yk in enumerate([0.064, 0.070, 0.076, 0.082]):
            t, z, th, w = at(yk)
            out.append(cyl(f'{name}_hole{k}', 0.0007, 0.0002, (0, sign * yk, z + th / 2 + 0.00003), (0, 0, 0), m['hole'], 20))
        for k, yk in enumerate([0.034, 0.041]):
            t, z, th, w = at(yk)
            slope = -4.8 * (yk - 0.0205) - 0.004 / length
            out.append(box(f'{name}_keeper{k}', (2 * w + 0.0008, 0.0024, th + 0.0008), (0, sign * yk, z), m['strap'], rot=(sign * math.atan(slope), 0, 0)))
            C.bevel(out[-1], 0.00035, 3)
    else:
        yk = 0.0205 + length
        t, z, th, w = at(yk - 0.0005)
        slope = -4.8 * (yk - 0.0205) - 0.004 / length
        ang = sign * math.atan(slope)
        rad = 0.00062
        bar = w + 0.0012
        parts = [cyl(f'{name}_bk_end', rad, 2 * bar, (0, sign * (yk + 0.0052), z - 0.0035 * abs(slope)), (0, math.pi / 2, 0), m['bezel'])]
        for sx in (-1, 1):
            parts.append(cyl(f'{name}_bk_side{sx}', rad, 0.0058, (sx * bar, sign * (yk + 0.0024), z - 0.0016 * abs(slope)), (ang + math.pi / 2, 0, 0), m['bezel']))
        parts.append(cyl(f'{name}_bk_pin', rad * 0.55, 2 * bar, (0, sign * (yk - 0.0004), z), (0, math.pi / 2, 0), m['bezel']))
        parts.append(box(f'{name}_bk_tongue', (0.0007, 0.0058, 0.0005), (0, sign * (yk + 0.0024), z + 0.0004 - 0.0016 * abs(slope)), m['bezel'], rot=(ang, 0, 0)))
        out += parts
    return out


def wrap_pivots(parts):
    """Each part becomes an empty at its pivot holding the mesh. Mesh compression rewrites mesh node transforms.
    The empty keeps the pivot, so turning a hand at runtime turns it about the watch axis."""
    out = []
    for name, o in parts.items():
        o.name = name + '_mesh'
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        e.location = o.location.copy()
        o.parent = e
        o.location = (0, 0, 0)
        out += [e, o]
    return out


def leaf(length, width, tail=0.0):
    """Hand outline pointing +Y: tapered sword with a short tail."""
    w = width / 2
    return [(-w * 0.55, -tail), (w * 0.55, -tail), (w, length * 0.18), (w * 0.8, length * 0.72), (0, length), (-w * 0.8, length * 0.72), (-w, length * 0.18)]


def strap_band(name, sign, mat, segs, width0=0.0200, width1=0.0165, length=0.078, tip=True):
    """Curved strap from the lugs outward, tapering, thinning and bending down."""
    bm = bmesh.new()
    sections = []
    for i in range(segs + 1):
        t = i / segs
        y = 0.0205 + t * length
        z = 0.0052 - 2.4 * (y - 0.0205) ** 2 - 0.004 * t
        w = (width0 + (width1 - width0) * t) / 2
        if tip and t > 0.9:  # round the tip
            k = (t - 0.9) / 0.1
            w *= math.cos(k * math.pi / 2) ** 0.5 if k < 1 else 0.15
        th = 0.0036 - 0.0008 * t
        r = min(0.0009, th * 0.45)
        ring = []
        for (px, pz) in [(-w + r, th / 2), (w - r, th / 2), (w, th / 2 - r), (w, -th / 2 + r), (w - r, -th / 2), (-w + r, -th / 2), (-w, -th / 2 + r), (-w, th / 2 - r)]:
            ring.append(bm.verts.new((px, sign * y, z + pz)))
        sections.append(ring)
    for i in range(segs):
        a, b = sections[i], sections[i + 1]
        for k in range(8):
            f = (a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k])
            bm.faces.new(f if sign > 0 else f[::-1])
    bm.faces.new(sections[0][::-1] if sign > 0 else sections[0])
    bm.faces.new(sections[-1] if sign > 0 else sections[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return C.obj_from_bmesh(name, bm, mat)


def bracelet(name, sign, m, segs):
    links = []
    n = 9
    for i in range(n):
        t0, t1 = i / n, (i + 0.92) / n
        y0, y1 = 0.0205 + t0 * 0.072, 0.0205 + t1 * 0.072
        yc = (y0 + y1) / 2
        z = 0.0052 - 2.4 * (yc - 0.0205) ** 2 - 0.004 * (yc - 0.0205) / 0.072
        w = 0.0100 - 0.0016 * t0
        for x0, x1, mat in [(-w, -w * 0.34, m['bracelet']), (-w * 0.32, w * 0.32, m['bezel']), (w * 0.34, w, m['bracelet'])]:
            o = C.extrude_poly(f'{name}_l{i}_{x0:.4f}', [(x0, sign * y0), (x1, sign * y0), (x1, sign * y1), (x0, sign * y1)][::1 if sign > 0 else -1],
                               z - 0.0018, z + 0.0018, mat)
            C.bevel(o, 0.0008, 4)  # rounded link edges, as on a finished bracelet
            links.append(o)
    return C.join(name, links)


def build(lod='high'):
    seg = SEG[lod]
    m = mats()
    parts = {}

    # Case: curved flank, open in the middle so the movement shows when the dial lifts away.
    case = C.lathe('case_body', [(0.0196, 0.0022), (0.0200, 0.0045), (0.0200, 0.0080)], seg, m['case'])
    chamfers = [C.lathe('case_chamfer_lo', [(0.0166, 0.0012), (0.0186, 0.0012), (0.0196, 0.0022)], seg, m['bezel']),
                C.lathe('case_chamfer_hi', [(0.0200, 0.0080), (0.0196, 0.0092), (0.0172, 0.0092), (0.0166, 0.0085), (0.0166, 0.0012)], seg, m['bezel'])]
    notches = []
    if lod != 'low':
        for i in range(6):
            a = i * math.pi / 3 + math.pi / 6
            notches.append(box(f'notch{i}', (0.0011, 0.0006, 0.0005), (0.01855 * math.cos(a), 0.01855 * math.sin(a), 0.0003), m['bezel'], rot=(0, 0, a)))
    back = C.lathe('caseback', [(0.0120, 0.0016), (0.0186, 0.0016), (0.0184, 0.0004), (0.0172, 0.0), (0.0120, 0.0), (0.0120, 0.0016)], seg, m['case'])
    backglass = C.lathe('caseback_glass', [(0, 0.0012), (0.0122, 0.0012), (0.0122, 0.0002), (0, 0.0002)], seg, m['glass'])
    lugs = [lug(f'lug{i}', sx * 0.0135, sx * 0.0105, sy, m['case']) for i, (sx, sy) in enumerate([(1, 1), (-1, 1), (1, -1), (-1, -1)])]
    for o in lugs:  # the rounded lug edges are polished, the flat tops stay brushed
        o.data.materials.append(m['bezel'])
        o.modifiers['Bevel'].material = 1
        o.modifiers['Bevel'].segments = 5 if lod == 'high' else 3
    parts['case'] = C.join('case', [case, *chamfers, back, backglass, *lugs, *notches])

    parts['bezel'] = C.lathe('bezel', [(0.0170, 0.0092), (0.0199, 0.0092), (0.0200, 0.0098), (0.0191, 0.0110), (0.0175, 0.0113),
                                       (0.0170, 0.0107), (0.0170, 0.0092)], seg, m['bezel'])
    parts['crystal'] = C.lathe('crystal', [(0, 0.0125), (0.006, 0.01245), (0.012, 0.0121), (0.0163, 0.0114), (0.0172, 0.0108),
                                           (0.0172, 0.0101), (0, 0.0101)], seg, m['glass'])

    # Dial with applied indices, minute track and wordmark.
    dial = C.lathe('dial_disc', [(0, 0.0064), (0.0166, 0.0064), (0.0168, 0.0062), (0.0168, 0.0060), (0, 0.0060)], seg, m['dial'])
    markers = []
    for h in range(12):
        a = math.pi / 2 - h * math.pi / 6
        if h == 3:
            continue  # the date window takes the place of the 3 o'clock index
        for dx in ([-0.0003, 0.0003] if h == 0 else [0.0]):
            st = [(0.0134, 0.00026), (0.01345, 0.00028), (0.0159, 0.00028), (0.0160, 0.00026)]
            o = faceted(f'idx{h}_{dx}', st, 0.0064, 0.00045, 0.55, m['index'], m['lume'], (0.0137, 0.0157), 0.5)
            o.location.x = dx
            C.apply_all(o)
            o = bpy.context.view_layer.objects.active
            o.rotation_euler.z = a - math.pi / 2
            if lod != 'low':
                C.bevel(o, 0.00003, 1)
            markers.append(o)
    # Date window at 3: a polished frame around a white date wheel.
    fx0, fx1, fh = 0.0137, 0.0158, 0.00085
    date = [C.extrude_poly('date_disc', [(fx0, -fh), (fx1, -fh), (fx1, fh), (fx0, fh)], 0.0064, 0.00641, m['date'])]
    for nm, pts in [('fr_t', [(fx0 - 0.0002, fh), (fx1 + 0.0002, fh), (fx1 + 0.0002, fh + 0.0002), (fx0 - 0.0002, fh + 0.0002)]),
                    ('fr_b', [(fx0 - 0.0002, -fh - 0.0002), (fx1 + 0.0002, -fh - 0.0002), (fx1 + 0.0002, -fh), (fx0 - 0.0002, -fh)]),
                    ('fr_l', [(fx0 - 0.0002, -fh), (fx0, -fh), (fx0, fh), (fx0 - 0.0002, fh)]),
                    ('fr_r', [(fx1, -fh), (fx1 + 0.0002, -fh), (fx1 + 0.0002, fh), (fx1, fh)])]:
        fr = C.extrude_poly(nm, pts, 0.0064, 0.00668, m['applique'])
        if lod != 'low':
            C.bevel(fr, 0.00004, 1)
        date.append(fr)
    num = C.text_mesh('date_num', '24', FONT, 0.0011, 0.00642, m['date_ink'], extrude=0.000005, y=0.0)
    num.location.x = (fx0 + fx1) / 2
    date.append(num)
    markers += date
    # Printed chapter ring: two fine circles that frame the minute track.
    if lod != 'low':
        for r in (0.01608, 0.01648):
            markers.append(C.lathe(f'chapter{r}', [(r, 0.006405), (r + 0.00004, 0.006405)], seg, m['print']))
    if lod != 'low':
        for k in range(60):
            if k % 5 == 0:
                continue
            a = math.pi / 2 - k * math.pi / 30
            pts = [(-0.00005, 0.01615), (0.00005, 0.01615), (0.00005, 0.0164), (-0.00005, 0.0164)]
            rot = [(x * math.cos(a - math.pi / 2) - y * math.sin(a - math.pi / 2), x * math.sin(a - math.pi / 2) + y * math.cos(a - math.pi / 2)) for x, y in pts]
            markers.append(C.extrude_poly(f'tick{k}', rot, 0.0064, 0.00642, m['print']))
    word = C.text_mesh('wordmark', 'OSTREL', FONT, 0.0021, 0.0064, m['applique'], extrude=0.00011, y=0.0074, letter_spacing=1.3)
    word.location.z = 0.00651
    sub = C.text_mesh('subline', 'AUTOMATIC', FONT, 0.00072, 0.0064, m['print'], extrude=0.00001, y=-0.0072, letter_spacing=1.6)
    sub.location.z = 0.00641
    parts['dial'] = C.join('dial', [dial, *markers, word, sub])

    # Hands (pointing to 12; turned at runtime). Faceted polished steel with a centre ridge and lume inlays.
    n = 16 if lod != 'low' else 8
    def taper(tail, tail_w, max_y, max_w, tip, tip_w=0.00002, hub_w=None):
        pts = [(tail, tail_w)]
        for i in range(1, n):
            y = tail + (tip - tail) * i / n
            if y <= max_y:
                k = (y - tail) / (max_y - tail)
                w = tail_w + (max_w - tail_w) * math.sin(k * math.pi / 2)
            else:
                k = (y - max_y) / (tip - max_y)
                w = max_w + (tip_w - max_w) * k ** 1.15
            pts.append((y, w))
        pts.append((tip, tip_w))
        return pts
    hh = faceted('hands_hour', taper(-0.0017, 0.00035, 0.0024, 0.00095, 0.0098), 0.0069, 0.00012, 0.32, m['hands'], m['lume'], (0.0019, 0.0082), 0.55)
    hb = C.lathe('hour_boss', [(0, 0.00702), (0.0011, 0.00702), (0.00115, 0.00698), (0.00115, 0.0069), (0, 0.0069)], 48, m['hands'])
    parts['hands_hour'] = C.join('hands_hour', [hh, hb])
    mh = faceted('hands_minute', taper(-0.0020, 0.00028, 0.0032, 0.00072, 0.0150), 0.00732, 0.00011, 0.32, m['hands'], m['lume'], (0.0027, 0.0132), 0.55)
    mb = C.lathe('minute_boss', [(0, 0.00743), (0.0009, 0.00743), (0.00095, 0.0074), (0.00095, 0.00732), (0, 0.00732)], 48, m['hands'])
    parts['hands_minute'] = C.join('hands_minute', [mh, mb])
    sh = faceted('hands_second', [(-0.0048, 0.00012), (0.0, 0.00013), (0.0156, 0.00004)], 0.0076, 0.00007, 0.4, m['accent'])
    cw = C.lathe('counterweight', [(0, 0.00771), (0.00058, 0.00771), (0.00066, 0.00766), (0.00066, 0.0076), (0, 0.0076)], 40, m['accent'])
    cw.location.y = -0.0040
    tipdot = C.lathe('second_lume', [(0, 0.00768), (0.00026, 0.00768), (0.00026, 0.00762), (0, 0.00762)], 24, m['lume'])
    tipdot.location.y = 0.0128
    cap = C.lathe('hand_cap', [(0, 0.00795), (0.00025, 0.00793), (0.00048, 0.00785), (0.00062, 0.0077), (0.00062, 0.0066), (0, 0.0066)], 48, m['accent'])
    parts['hands_second'] = C.join('hands_second', [sh, cw, tipdot, cap])

    # Movement: plate with bridges and jewels, gear train, escape wheel, balance.
    plate = C.lathe('plate', [(0, 0.0034), (0.0158, 0.0034), (0.0160, 0.0031), (0.0160, 0.0018), (0, 0.0018)], seg, m['rhodium'])
    bridges = [C.extrude_poly('bridge_a', [(-0.0150, 0.002), (-0.004, 0.0105), (0.0, 0.0125), (0.0035, 0.0105), (0.002, 0.007), (-0.0135, -0.002)], 0.0034, 0.0039, m['bridge']),
               C.extrude_poly('bridge_b', [(0.004, -0.012), (0.0145, -0.004), (0.0152, 0.003), (0.0100, 0.0025), (0.0015, -0.0070)], 0.0034, 0.0039, m['bridge'])]
    for b in bridges:
        C.bevel(b, 0.0002, 2 if lod != 'low' else 1)
    jewels = []
    jpos = [(0, 0), (0.0060, 0.0060), (-0.0020, 0.0072), (-0.0030, -0.0090), (-0.0092, -0.0048), (0.0100, -0.0040), (-0.0060, 0.0040), (0.0040, -0.0080)]
    for i, (x, y) in enumerate(jpos if lod != 'low' else jpos[:5]):
        j = C.lathe(f'jewel{i}', [(0, 0.00405), (0.00028, 0.00405), (0.00045, 0.0039), (0.00045, 0.0034), (0, 0.0034)], 24, m['ruby'])
        j.location.x, j.location.y = x, y
        jewels.append(j)
    screws = []
    for i, (x, y) in enumerate([(-0.0120, 0.0005), (0.0010, 0.0108), (0.0120, -0.0030), (0.0060, -0.0095)]):
        s = C.lathe(f'screw{i}', [(0, 0.00415), (0.00045, 0.00412), (0.0006, 0.0040), (0.0006, 0.0039), (0, 0.0039)], 24, m['steel'])
        s.location.x, s.location.y = x, y
        screws.append(s)
    parts['movement_plate'] = C.join('movement_plate', [plate, *bridges, *jewels, *screws])

    g1 = C.gear('center_wheel', 64 if lod != 'low' else 40, 0.0056, 0.0060, 0.0040, 0.00425, m['gold'])
    g2 = C.gear('third_wheel', 50 if lod != 'low' else 32, 0.0040, 0.0043, 0.00435, 0.0046, m['gold'])
    g2.location.x, g2.location.y = 0.0060, 0.0060
    g3 = C.gear('fourth_wheel', 40 if lod != 'low' else 28, 0.0032, 0.0035, 0.0047, 0.00495, m['gold'])
    g3.location.x, g3.location.y = -0.0020, 0.0072
    parts['gear_train'] = C.join('gear_train', [g1, g2, g3])

    esc = C.gear('escape_wheel', 15, 0.0017, 0.0024, 0.0040, 0.00425, m['steel'])
    esc.location.x, esc.location.y = -0.0030, -0.0090
    C.apply_all(esc)
    parts['escape_wheel'] = bpy.context.view_layer.objects.active
    parts['escape_wheel'].name = 'escape_wheel'

    rim = C.lathe('balance_rim', [(0.0036, 0.0046), (0.0042, 0.0046), (0.0042, 0.0041), (0.0036, 0.0041), (0.0036, 0.0046)], seg // 2, m['gold'])
    spokes = [C.extrude_poly(f'spoke{i}', [(-0.0002, 0), (0.0002, 0), (0.0002, 0.0037), (-0.0002, 0.0037)], 0.0042, 0.00445, m['gold']) for i in range(3)]
    for i, sp in enumerate(spokes):
        sp.rotation_euler.z = i * 2 * math.pi / 3
    hub = C.lathe('balance_hub', [(0, 0.0047), (0.0005, 0.0047), (0.0005, 0.0040), (0, 0.0040)], 24, m['gold'])
    spring = []
    if lod != 'low':
        for k in range(6):
            r = 0.0010 + k * 0.00035
            spring.append(C.lathe(f'hair{k}', [(r, 0.00455), (r + 0.00006, 0.00455), (r + 0.00006, 0.00452), (r, 0.00452), (r, 0.00455)], 48, m['steel']))
    bal = C.join('balance_wheel', [rim, *spokes, hub, *spring])
    bal.location.x, bal.location.y = -0.0092, -0.0048
    parts['balance_wheel'] = bal

    teeth = {'high': 44, 'mid': 32, 'low': 20}[lod]
    crown = C.gear('crown', teeth, 0.00255, 0.0028, 0.0003, 0.0023, m['case'])
    if lod != 'low':
        C.bevel(crown, 0.00006, 1)
    rims = [C.lathe('crown_in', [(0, 0.0), (0.0026, 0.0), (0.0029, 0.0002), (0.0029, 0.0003), (0, 0.0003)], 64, m['bezel']),
            C.lathe('crown_out', [(0, 0.0023), (0.0029, 0.0023), (0.0029, 0.0024), (0.0026, 0.00265), (0.0012, 0.0028), (0, 0.00283)], 64, m['bezel']),
            C.lathe('crown_logo', [(0.0011, 0.00283), (0.0015, 0.0028), (0.0015, 0.00292), (0.0011, 0.00295), (0.0011, 0.00283)], 48, m['applique']),
            C.lathe('crown_tube', [(0, -0.0013), (0.0013, -0.0013), (0.0013, 0.0), (0, 0.0)], 32, m['bezel'])]
    crown_o = C.join('crown', [crown, *rims])
    crown_o.rotation_euler.y = math.pi / 2
    crown_o.location = (0.0213, 0.0, 0.0052)
    parts['crown'] = crown_o

    segs = {'high': 40, 'mid': 24, 'low': 12}[lod]
    st = strap_band('strap_top', 1, m['strap'], segs, tip=False, length=0.070)
    parts['strap_top'] = C.join('strap_top', [st, *strap_extras('strap_top', 1, m, 0.070, False, lod)])
    sb = strap_band('strap_bottom', -1, m['strap'], segs, tip=True, length=0.082)
    parts['strap_bottom'] = C.join('strap_bottom', [sb, *strap_extras('strap_bottom', -1, m, 0.082, True, lod)])
    parts['bracelet_top'] = bracelet('bracelet_top', 1, m, segs)
    parts['bracelet_bottom'] = bracelet('bracelet_bottom', -1, m, segs)
    return parts


if __name__ == '__main__':
    a = C.args()
    lod = a.get('lod', 'high')
    C.reset()
    parts = build(lod)
    out = os.path.abspath(a.get('out', f'public/ostrel/watch-{lod}.glb'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    C.export_glb(out, wrap_pivots(parts))
    print('EXPORTED', out, sorted(parts))
