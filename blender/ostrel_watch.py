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
        'applique': C.material('applique_steel', (0.92, 0.92, 0.93), metallic=1.0, roughness=0.08),
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
            C.bevel(o, 0.00045, 2)
            links.append(o)
    return C.join(name, links)


def build(lod='high'):
    seg = SEG[lod]
    m = mats()
    parts = {}

    # Case: curved flank, open in the middle so the movement shows when the dial lifts away.
    case = C.lathe('case_body', [(0.0166, 0.0012), (0.0186, 0.0012), (0.0196, 0.0022), (0.0200, 0.0045), (0.0200, 0.0080),
                                 (0.0196, 0.0092), (0.0172, 0.0092), (0.0166, 0.0085), (0.0166, 0.0012)], seg, m['case'])
    back = C.lathe('caseback', [(0.0120, 0.0016), (0.0186, 0.0016), (0.0184, 0.0004), (0.0172, 0.0), (0.0120, 0.0), (0.0120, 0.0016)], seg, m['case'])
    backglass = C.lathe('caseback_glass', [(0, 0.0012), (0.0122, 0.0012), (0.0122, 0.0002), (0, 0.0002)], seg, m['glass'])
    lugs = [lug(f'lug{i}', sx * 0.0135, sx * 0.0105, sy, m['case']) for i, (sx, sy) in enumerate([(1, 1), (-1, 1), (1, -1), (-1, -1)])]
    parts['case'] = C.join('case', [case, back, backglass, *lugs])

    parts['bezel'] = C.lathe('bezel', [(0.0170, 0.0092), (0.0199, 0.0092), (0.0200, 0.0098), (0.0191, 0.0110), (0.0175, 0.0113),
                                       (0.0170, 0.0107), (0.0170, 0.0092)], seg, m['bezel'])
    parts['crystal'] = C.lathe('crystal', [(0, 0.0125), (0.006, 0.01245), (0.012, 0.0121), (0.0163, 0.0114), (0.0172, 0.0108),
                                           (0.0172, 0.0101), (0, 0.0101)], seg, m['glass'])

    # Dial with applied indices, minute track and wordmark.
    dial = C.lathe('dial_disc', [(0, 0.0064), (0.0166, 0.0064), (0.0168, 0.0062), (0.0168, 0.0060), (0, 0.0060)], seg, m['dial'])
    markers = []
    for h in range(12):
        a = math.pi / 2 - h * math.pi / 6
        widths = [(-0.00055, -0.00005), (0.00005, 0.00055)] if h == 0 else [(-0.00032, 0.00032)]
        for wa, wb in widths:
            pts = [(wa, 0.0134), (wb, 0.0134), (wb, 0.0160), (wa, 0.0160)]
            rot = [(x * math.cos(a - math.pi / 2) - y * math.sin(a - math.pi / 2), x * math.sin(a - math.pi / 2) + y * math.cos(a - math.pi / 2)) for x, y in pts]
            o = C.extrude_poly(f'idx{h}{wa}', rot, 0.0064, 0.00068 + 0.0064, m['applique'])
            if lod != 'low':
                C.bevel(o, 0.00006, 1)
            markers.append(o)
    if lod != 'low':
        for k in range(60):
            if k % 5 == 0:
                continue
            a = math.pi / 2 - k * math.pi / 30
            pts = [(-0.00005, 0.01615), (0.00005, 0.01615), (0.00005, 0.0164), (-0.00005, 0.0164)]
            rot = [(x * math.cos(a - math.pi / 2) - y * math.sin(a - math.pi / 2), x * math.sin(a - math.pi / 2) + y * math.cos(a - math.pi / 2)) for x, y in pts]
            markers.append(C.extrude_poly(f'tick{k}', rot, 0.0064, 0.00642, m['print']))
    word = C.text_mesh('wordmark', 'OSTREL', FONT, 0.0021, 0.0064, m['applique'], extrude=0.00006, y=0.0074, letter_spacing=1.3)
    word.location.z = 0.00644
    sub = C.text_mesh('subline', 'AUTOMATIC', FONT, 0.00072, 0.0064, m['print'], extrude=0.00001, y=-0.0072, letter_spacing=1.6)
    sub.location.z = 0.00641
    parts['dial'] = C.join('dial', [dial, *markers, word, sub])

    # Hands (pointing to 12; rotated at runtime).
    hh = C.extrude_poly('hands_hour', leaf(0.0098, 0.0019, 0.0016), 0.0069, 0.00705, m['hands'])
    hl = C.extrude_poly('hour_lume', leaf(0.0078, 0.0008, -0.0018), 0.00705, 0.0071, m['lume'])
    parts['hands_hour'] = C.join('hands_hour', [hh, hl])
    mh = C.extrude_poly('hands_minute', leaf(0.0148, 0.0014, 0.0018), 0.0072, 0.00735, m['hands'])
    ml = C.extrude_poly('minute_lume', leaf(0.0128, 0.0006, -0.0022), 0.00735, 0.0074, m['lume'])
    parts['hands_minute'] = C.join('hands_minute', [mh, ml])
    sh = C.extrude_poly('hands_second', [(-0.00018, -0.0045), (0.00018, -0.0045), (0.00012, 0.0156), (-0.00012, 0.0156)], 0.0075, 0.00758, m['accent'])
    cw = C.lathe('counterweight', [(0, 0.00758), (0.00065, 0.00758), (0.00065, 0.0075), (0, 0.0075)], 24, m['accent'])
    cw.location.y = -0.0036
    cap = C.lathe('hand_cap', [(0, 0.0078), (0.0005, 0.0078), (0.0007, 0.0076), (0.0007, 0.0066), (0, 0.0066)], 32, m['accent'])
    parts['hands_second'] = C.join('hands_second', [sh, cw, cap])

    # Movement: plate with bridges and jewels, gear train, escape wheel, balance.
    plate = C.lathe('plate', [(0, 0.0034), (0.0158, 0.0034), (0.0160, 0.0031), (0.0160, 0.0018), (0, 0.0018)], seg, m['rhodium'])
    bridges = [C.extrude_poly('bridge_a', [(-0.0150, 0.002), (-0.004, 0.0105), (0.0, 0.0125), (0.0035, 0.0105), (0.002, 0.007), (-0.0135, -0.002)], 0.0034, 0.0039, m['rhodium']),
               C.extrude_poly('bridge_b', [(0.004, -0.012), (0.0145, -0.004), (0.0152, 0.003), (0.0100, 0.0025), (0.0015, -0.0070)], 0.0034, 0.0039, m['rhodium'])]
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

    crown = C.gear('crown', 28, 0.0025, 0.0028, -0.0014, 0.0014, m['case'])
    stem = C.lathe('stem', [(0, 0.0034), (0.0011, 0.0034), (0.0011, -0.0012), (0, -0.0012)], 24, m['case'])
    crown_o = C.join('crown', [crown, stem])
    crown_o.rotation_euler.y = math.pi / 2
    crown_o.location = (0.0216, 0.0, 0.0052)
    parts['crown'] = crown_o

    segs = {'high': 40, 'mid': 24, 'low': 12}[lod]
    parts['strap_top'] = strap_band('strap_top', 1, m['strap'], segs, tip=False, length=0.070)
    parts['strap_bottom'] = strap_band('strap_bottom', -1, m['strap'], segs, tip=True, length=0.082)
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
    C.export_glb(out, list(parts.values()))
    print('EXPORTED', out, sorted(parts))
