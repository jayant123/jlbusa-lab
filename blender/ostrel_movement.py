"""Render-only detail for the OSTREL movement and caseback (photos only, the live GLB is unchanged).

Replaces the simple movement parts with: spoked gold wheels with pinions, a balance with a spiral hairspring,
bridges with Côtes de Genève and polished chamfers, a perlage plate, blued screws, red jewels in polished sinks
and a pallet fork. Adds the gold rotor under the sapphire caseback and the engraved ring text.
Positions and heights match blender/ostrel_watch.py.
"""
import math
import os

import bmesh
import bpy

import common as C

FONT = os.path.join(os.path.dirname(__file__), 'fonts', 'Archivo-Expanded-Medium.ttf')


# --- Materials --------------------------------------------------------------------------------------------------
def _nodes(m):
    nt = m.node_tree
    return nt, nt.nodes['Principled BSDF']


def _bump(nt, p, height_socket, strength, distance):
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    nt.links.new(height_socket, b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])


def _object_coords(nt, scale):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs['Vector']


def cotes(name, color, rough=0.2, stripe=0.0024):
    """Côtes de Genève: broad parallel waves with a brushed sheen across them."""
    m = C.material(name, color, metallic=1.0, roughness=rough, anisotropic=0.55)
    nt, p = _nodes(m)
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'X'
    w.wave_profile = 'SIN'
    w.inputs['Scale'].default_value = 1.0
    w.inputs['Distortion'].default_value = 0.0
    nt.links.new(_object_coords(nt, 1.0 / (stripe * 6.28)), w.inputs['Vector'])
    _bump(nt, p, w.outputs['Fac'], 1.0, 0.00016)
    return m


def perlage(name, color, cell=0.0009):
    """Perlage: rows of small circular grains on the main plate."""
    m = C.material(name, color, metallic=1.0, roughness=0.32)
    nt, p = _nodes(m)
    v = nt.nodes.new('ShaderNodeTexVoronoi')
    v.feature = 'F1'
    v.inputs['Randomness'].default_value = 0.15
    nt.links.new(_object_coords(nt, 1.0 / cell), v.inputs['Vector'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 18.0
    sn = nt.nodes.new('ShaderNodeMath'); sn.operation = 'SINE'
    nt.links.new(v.outputs['Distance'], mul.inputs[0])
    nt.links.new(mul.outputs[0], sn.inputs[0])
    _bump(nt, p, sn.outputs[0], 0.25, 0.00002)
    return m


def mats():
    return {
        'plate': perlage('mv_plate', (0.42, 0.43, 0.45)),
        'bridge': cotes('mv_bridge', (0.2, 0.205, 0.215), rough=0.3, stripe=0.0017),
        'polish': C.material('mv_polish', (0.95, 0.95, 0.96), metallic=1.0, roughness=0.04),
        'gold': C.material('mv_gold', (0.83, 0.6, 0.3), metallic=1.0, roughness=0.16),
        'rotor': cotes('mv_rotor', (0.85, 0.63, 0.32), rough=0.18, stripe=0.0018),
        'blue': C.material('mv_blue', (0.05, 0.11, 0.42), metallic=1.0, roughness=0.12),
        'ruby': C.material('mv_ruby', (0.45, 0.005, 0.03), roughness=0.05, coat=1.0),
        'steel': C.material('mv_steel', (0.82, 0.82, 0.84), metallic=1.0, roughness=0.12),
        'slot': C.material('mv_slot', (0.01, 0.01, 0.015), roughness=0.5),
        'engrave': C.material('mv_engrave', (0.02, 0.02, 0.022), metallic=0.6, roughness=0.6),
    }


# --- Parts ------------------------------------------------------------------------------------------------------
def _cyl(name, r, z0, z1, mat, seg=48):
    return C.lathe(name, [(0, z1), (r, z1), (r, z0), (0, z0)], seg, mat)


def _subtract(o, cutter):
    mod = o.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(cutter)


def wheel(name, teeth, r_root, r_tip, z0, z1, m, arms=4, x=0.0, y=0.0):
    """A spoked train wheel: toothed rim, thin arms, a hub and a steel pinion below."""
    g = C.gear(name, teeth, r_root, r_tip, z0, z1, m['gold'])
    _subtract(g, _cyl(name + '_cut', r_root * 0.8, z0 - 0.001, z1 + 0.001, None, 64))
    parts = [g, _cyl(name + '_hub', r_root * 0.2, z0, z1 + 0.00008, m['gold'], 32)]
    w = max(0.00018, r_root * 0.07)
    for i in range(arms):
        a = C.extrude_poly(f'{name}_arm{i}', [(-w / 2, r_root * 0.15), (w / 2, r_root * 0.15), (w / 2, r_root * 0.82), (-w / 2, r_root * 0.82)], z0, z1, m['gold'])
        a.rotation_euler.z = i * 2 * math.pi / arms + 0.3
        parts.append(a)
    pin = C.gear(name + '_pinion', 8, r_root * 0.12, r_root * 0.17, z0 - 0.0007, z0, m['steel'])
    parts.append(pin)
    for p in parts:
        C.bevel(p, 0.00002, 1)
    o = C.join(name, parts)
    o.location.x, o.location.y = x, y
    return o


def screw(name, x, y, z, m):
    head = C.lathe(name, [(0, z + 0.00028), (0.00035, z + 0.00025), (0.00058, z + 0.00012), (0.0006, z), (0, z)], 32, m['blue'])
    slot = C.extrude_poly(name + '_slot', [(-0.00055, -0.00004), (0.00055, -0.00004), (0.00055, 0.00004), (-0.00055, 0.00004)], z + 0.00016, z + 0.00032, m['slot'])
    slot.rotation_euler.z = (x * 997 + y * 313) % 3.0
    o = C.join(name, [head, slot])
    o.location.x, o.location.y = x, y
    return o


def jewel(name, x, y, z, m):
    sink = C.lathe(name + '_sink', [(0.00045, z - 0.00012), (0.0011, z + 0.00002), (0.0012, z + 0.00002), (0.0012, z - 0.0002), (0.00045, z - 0.0002)], 48, m['polish'])
    stone = C.lathe(name, [(0, z + 0.00007), (0.00025, z + 0.00006), (0.0004, z + 0.00002), (0.00045, z - 0.0002), (0, z - 0.0002)], 32, m['ruby'])
    o = C.join(name, [sink, stone])
    o.location.x, o.location.y = x, y
    return o


def hairspring(name, x, y, z, m, turns=11, r0=0.0006, r1=0.0031):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.000022
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    n = turns * 48
    sp.points.add(n - 1)
    for i in range(n):
        t = i / (n - 1)
        a = t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        sp.points[i].co = (math.cos(a) * r, math.sin(a) * r, z, 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(m['blue'])
    o.location.x, o.location.y = x, y
    return o


def balance(m, x, y):
    rim = C.lathe('bal_rim', [(0.0036, 0.0046), (0.0042, 0.0046), (0.0042, 0.0041), (0.0036, 0.0041)], 96, m['gold'])
    parts = [rim]
    for i in range(3):
        s = C.extrude_poly(f'bal_spoke{i}', [(-0.00016, 0.0004), (0.00016, 0.0004), (0.00016, 0.0037), (-0.00016, 0.0037)], 0.0042, 0.0044, m['gold'])
        s.rotation_euler.z = i * 2 * math.pi / 3
        parts.append(s)
    for i in range(8):  # timing screws around the rim
        a = i * math.pi / 4
        sc = C.lathe(f'bal_sc{i}', [(0, 0.00026), (0.0002, 0.00024), (0.00022, 0), (0, 0)], 16, m['gold'])
        sc.rotation_euler = (0, math.pi / 2, a)
        sc.location = (math.cos(a) * 0.0042, math.sin(a) * 0.0042, 0.00435)
        parts.append(sc)
    parts.append(_cyl('bal_hub', 0.0005, 0.004, 0.0047, m['gold'], 32))
    for p in parts:
        C.bevel(p, 0.00002, 1)
    o = C.join('balance_detail', parts)
    o.location.x, o.location.y = x, y
    return [o, hairspring('hairspring', x, y, 0.00452, m)]


def pallet_fork(m):
    pts = [(-0.0034, -0.0077), (-0.0072, -0.0055), (-0.0074, -0.0051), (-0.0068, -0.0050), (-0.0035, -0.0071), (-0.0022, -0.0067), (-0.0021, -0.0072)]
    fork = C.extrude_poly('pallet_fork', pts, 0.0042, 0.00445, m['steel'])
    C.bevel(fork, 0.00003, 1)
    stones = []
    for i, (px, py) in enumerate([(-0.0036, -0.0077), (-0.0021, -0.0070)]):
        s = C.extrude_poly(f'pallet_stone{i}', [(-0.00012, -0.00025), (0.00012, -0.00025), (0.00012, 0.00025), (-0.00012, 0.00025)], 0.00418, 0.00447, m['ruby'])
        s.location = (px, py, 0)
        stones.append(s)
    return [fork, *stones]


def bridge(name, pts, m):
    o = C.extrude_poly(name, pts, 0.0034, 0.0039, m['bridge'])
    o.data.materials.append(m['polish'])
    b = C.bevel(o, 0.00016, 3)
    b.material = 1  # anglage: the chamfered edges are polished bright
    return o


def movement(m):
    objs = [C.lathe('mv_plate', [(0, 0.0034), (0.0158, 0.0034), (0.0160, 0.0031), (0.0160, 0.0018), (0, 0.0018)], 128, m['plate'])]
    objs += [bridge('mv_bridge_a', [(-0.0150, 0.002), (-0.004, 0.0105), (0.0, 0.0125), (0.0035, 0.0105), (0.002, 0.007), (-0.0135, -0.002)], m),
             bridge('mv_bridge_b', [(0.004, -0.012), (0.0145, -0.004), (0.0152, 0.003), (0.0100, 0.0025), (0.0015, -0.0070)], m)]
    for i, (x, y) in enumerate([(0.0060, 0.0060), (-0.0020, 0.0072), (0.0100, -0.0040), (-0.0060, 0.0040), (0.0040, -0.0080), (-0.0105, 0.0010)]):
        objs.append(jewel(f'mv_jewel{i}', x, y, 0.0039, m))
    for i, (x, y) in enumerate([(-0.0120, 0.0005), (0.0010, 0.0108), (0.0120, -0.0030), (0.0060, -0.0095), (-0.0070, 0.0068)]):
        objs.append(screw(f'mv_screw{i}', x, y, 0.0039, m))
    objs.append(wheel('mv_center', 64, 0.0056, 0.0060, 0.0040, 0.00425, m, arms=4))
    objs.append(wheel('mv_third', 50, 0.0040, 0.0043, 0.00435, 0.0046, m, arms=4, x=0.0060, y=0.0060))
    objs.append(wheel('mv_fourth', 40, 0.0032, 0.0035, 0.0047, 0.00495, m, arms=4, x=-0.0020, y=0.0072))
    esc = C.gear('mv_escape', 15, 0.0017, 0.0024, 0.0040, 0.00425, m['steel'])
    _subtract(esc, _cyl('mv_escape_cut', 0.0013, 0.003, 0.005, None, 48))
    hub = _cyl('mv_escape_hub', 0.0003, 0.004, 0.0043, m['steel'], 24)
    arms = [C.extrude_poly(f'mv_esc_arm{i}', [(-0.0001, 0.0002), (0.0001, 0.0002), (0.0001, 0.0014), (-0.0001, 0.0014)], 0.004, 0.00425, m['steel']) for i in range(4)]
    for i, a in enumerate(arms):
        a.rotation_euler.z = i * math.pi / 2
    e = C.join('mv_escape', [esc, hub, *arms])
    e.location.x, e.location.y = -0.0030, -0.0090
    objs.append(e)
    objs += balance(m, -0.0092, -0.0048)
    objs += pallet_fork(m)
    return objs


def rotor(m):
    """The gold winding rotor under the sapphire caseback, with its bearing and a cut-out name."""
    pts = [(math.cos(a) * 0.0116, math.sin(a) * 0.0116) for a in [math.pi * i / 64 for i in range(65)]]
    pts += [(math.cos(a) * 0.0042, math.sin(a) * 0.0042) for a in [math.pi - math.pi * i / 24 for i in range(25)]]
    r = C.extrude_poly('rotor', pts, 0.00125, 0.00165, m['rotor'])
    r.data.materials.append(m['polish'])
    b = C.bevel(r, 0.00012, 3)
    b.material = 1
    hub = C.lathe('rotor_hub', [(0, 0.0017), (0.0016, 0.0017), (0.0018, 0.00135), (0.0018, 0.0012), (0, 0.0012)], 64, m['polish'])
    sc = [screw(f'rotor_screw{i}', math.cos(a) * 0.0009, math.sin(a) * 0.0009, 0.00125, m) for i, a in enumerate([0.4, 2.5, 4.6])]
    for s in sc:  # screws face the caseback (downward)
        s.rotation_euler.x = math.pi
        s.location.z = 0.0025
    o = C.join('rotor', [r, hub])
    o.rotation_euler.z = 0.55
    return [o, *sc]


ENGRAVING = 'OSTREL · MERIDIAN 40 · Nº 0417 · SAPPHIRE · 100 M · AUTOMATIC · '


def engraving_ring(m, text=ENGRAVING, radius=0.0155, size=0.0016, z=0.00003):
    """Letters engraved around the caseback ring. Built after the watch is turned over, flat on the back face,
    so they read clockwise from the camera above with no mirroring."""
    font = bpy.data.fonts.load(FONT, check_existing=True)
    step = 2 * math.pi / len(text)
    out = []
    for i, ch in enumerate(text):
        if ch == ' ':
            continue
        cu = bpy.data.curves.new(f'eng{i}', 'FONT')
        cu.body = ch
        cu.font = font
        cu.size = size
        cu.extrude = 0.000015
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        o = bpy.data.objects.new(f'eng{i}', cu)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(m['engrave'])
        a = math.pi / 2 - i * step
        o.location = (math.cos(a) * radius, math.sin(a) * radius, z)
        o.rotation_euler = (0, 0, a - math.pi / 2)  # letter tops point outward
        out.append(o)
    return out


def install(parts, caseback=False):
    """Hide the simple movement and add the detailed one. caseback=True also adds the rotor and the engraving."""
    for k in ('movement_plate', 'gear_train', 'escape_wheel', 'balance_wheel'):
        parts[k].hide_render = True
    m = mats()
    objs = movement(m)
    if caseback:
        objs += rotor(m)
    return objs


def engrave_back(z=0.00003):
    """Call after the watch is turned over (back face up at z = 0)."""
    return engraving_ring(mats(), z=z)
