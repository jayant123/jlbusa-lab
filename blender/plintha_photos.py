"""PLINTHA store photos, path traced in Cycles from the same modules as the live configurator (photo LOD adds
piping and soft creases).

tools/blender_lock.sh blender -b -P blender/plintha_photos.py -- --shot hero --out build/photos/hero.png
Shots: hero, module:<kind>, layout:<preset>:<fabric>, fabric:<fabric>, craft. Optional --samples, --w, --h.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import plintha_set as PS  # noqa: E402

# Same layouts as src/plintha/edit.js PRESETS: main run left to right, return run toward the viewer, ottomans.
PRESETS = {
    'showroom': (['arm_left', 'armless', 'armless', 'corner'], ['armless', 'arm_right'], 1),
    'corner': (['arm_left', 'armless', 'armless', 'corner'], ['armless', 'arm_right'], 0),
    'u': (['chaise', 'armless', 'armless', 'corner'], ['armless', 'arm_right'], 0),
    'chaise': (['arm_left', 'armless', 'armless', 'chaise'], [], 0),
    'straight': (['arm_left', 'armless', 'arm_right'], [], 0),
}


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a) - 1, 2)}


def setup(samples, w, h):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        s.cycles.device = 'GPU'
    except Exception:  # noqa: BLE001
        s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.cycles.max_bounces = 10
    s.render.resolution_x, s.render.resolution_y = w, h
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    s.world = world
    return world.node_tree.nodes['Background']


def area(name, loc, rot, size, energy, color=(1, 1, 1), size_y=None, shape='RECTANGLE'):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy, d.color, d.size, d.shape = energy, color, size, shape
    if size_y:
        d.size_y = size_y
    o = bpy.data.objects.new(name, d)
    o.location, o.rotation_euler = loc, rot
    o.visible_camera = False
    bpy.context.collection.objects.link(o)
    return o


def camera(loc, target, lens, fstop=None):
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.clip_start = 0.01
    o = bpy.data.objects.new('cam', cd)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = d.length
    bpy.context.scene.camera = o
    return o


def place_layout(proto, main, ret, ottomans):
    """Stand copies of the module prototypes in a layout. Returns its floor bounds (x0, x1, y0, y1)."""
    def put(kind, loc, rz=0.0):
        o = proto[kind].copy()
        bpy.context.collection.objects.link(o)
        o.hide_render = False
        o.location = loc
        o.rotation_euler.z = rz
        return o
    x = 0.0
    for k in main:
        put(k, (x, 0, 0)); x += PS.FOOT[k][0]
    main_w = x
    y = -PS.FOOT['corner'][1]
    for k in ret:
        put(k, (x, y, 0), -math.pi / 2); y -= PS.FOOT[k][0]
    front = max(PS.FOOT[k][1] for k in main) if main else 0
    w, gap = PS.FOOT['ottoman'][0], 0.1
    span = ottomans * w + (ottomans - 1) * gap
    for i in range(ottomans):
        put('ottoman', (main_w / 2 - span / 2 + i * (w + gap), -(front + 0.45), 0))
    y_min = min(-front - (0.45 + 0.9 if ottomans else 0), y)
    return 0.0, main_w, y_min, 0.0


PHOTO_MATS = {'scale': 1.35, 'normal': 1.1}
# Same weave scan for every fabric, as on the live page (the other scan is a checked cloth).
for _f in ('Linen Sand', 'Velvet Ink'):
    PS.FABRICS[_f] = ('Fabric085',) + PS.FABRICS[_f][1:]


def velvet_sheen():
    m = bpy.data.materials.get('upholstery')
    if not m:
        return
    p = m.node_tree.nodes['Principled BSDF']
    if 'Sheen Weight' in p.inputs:
        p.inputs['Sheen Weight'].default_value = 1.0
        p.inputs['Sheen Roughness'].default_value = 0.35
        p.inputs['Sheen Tint'].default_value = (0.55, 0.62, 0.85, 1)


def room_scene(fabric, preset):
    m = PS.mats(fabric, scale=PHOTO_MATS['scale'], normal=PHOTO_MATS['normal'])
    proto = {k: PS.module(k, m, 'photo') for k in PS.FOOT}
    for o in proto.values():
        o.hide_render = True
    r = PS.room('high')
    b = place_layout(proto, *PRESETS[preset])
    cx = (b[0] + b[1]) / 2
    r['rug'].location = (cx, (b[2] + b[3]) / 2 - 0.55, 0)
    r['side_table'].location = (-0.42, -0.55, 0)
    r['floor_lamp'].location = (-0.85, 0.25, 0)
    C.extrude_poly('ceiling', [(-1.45, -9.0), (12.0, -9.0), (12.0, 1.2), (-1.45, 1.2)], 3.4, 3.5, C.material('ceiling', (0.9, 0.89, 0.86), roughness=0.9))
    return b


def daylight(bg):
    bg.inputs['Color'].default_value = (0.70, 0.66, 0.60, 1)
    bg.inputs['Strength'].default_value = 0.5
    sun = bpy.data.lights.new('sun_day', 'SUN')
    sun.energy, sun.angle, sun.color = 9.5, math.radians(2.0), (1.0, 0.9, 0.76)
    so = bpy.data.objects.new('sun_day', sun)
    bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(52), 0, math.radians(-54))  # low sun through the left windows and across the sofa
    area('fill', (1.5, -5.0, 2.2), (math.radians(70), 0, 0), 3.0, 120, (0.92, 0.95, 1.0))


def studio(bg):
    """A pale stone cyclorama with soft studio light, for product shots of single modules."""
    bg.inputs['Color'].default_value = (0.82, 0.80, 0.77, 1)
    bg.inputs['Strength'].default_value = 0.35
    stone = C.material('studio_stone', (0.42, 0.405, 0.385), roughness=0.85)
    # Floor that sweeps up into a back wall.
    import bmesh
    bm = bmesh.new()
    prof = [(-4.0, 0.0)]
    for i in range(13):
        a = math.radians(90 * i / 12)
        prof.append((1.2 + 0.8 * math.sin(a), 0.8 - 0.8 * math.cos(a)))
    prof.append((2.0, 3.5))
    rows = []
    for x in (-5.0, 5.0):
        rows.append([bm.verts.new((x, y, z)) for (y, z) in [(p[0], p[1]) for p in prof]])
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    me = bpy.data.meshes.new('cyc')
    bm.to_mesh(me)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new('cyc', me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(stone)
    area('key', (-2.4, -1.6, 2.4), (math.radians(52), 0, math.radians(-58)), 1.6, 520, (1.0, 0.96, 0.9))
    area('fill', (2.6, -2.2, 1.2), (math.radians(72), 0, math.radians(50)), 2.5, 60, (0.9, 0.94, 1.0))
    area('rim', (1.4, 1.6, 2.0), (math.radians(-55), 0, math.radians(150)), 1.2, 220, (1.0, 0.95, 0.88))


def oak_wood():
    """Smoked oak: near-black brown with long grain lines and a little variation along the board."""
    m = bpy.data.materials.get('oak_plinth')
    if not m:
        return
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.3, 0.3, 1.0)  # stretch the grain along the board
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = 70.0
    wave.inputs['Distortion'].default_value = 9.0
    wave.inputs['Detail'].default_value = 6.0
    wave.inputs['Detail Scale'].default_value = 2.0
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 6.0
    mix = nt.nodes.new('ShaderNodeMath')
    mix.operation = 'MULTIPLY'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = (0.006, 0.0035, 0.002, 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (0.032, 0.019, 0.011, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], mix.inputs[0])
    nt.links.new(noise.outputs['Fac'], mix.inputs[1])
    nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.0004
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = 0.38
    if 'Coat Weight' in p.inputs:
        p.inputs['Coat Weight'].default_value = 0.25
        p.inputs['Coat Roughness'].default_value = 0.3


def boucle_loops(strength=1.0):
    """Boucle: irregular loops of yarn. Two layers of scattered rings (Voronoi distance turned into a ring height),
    their positions wobbled by noise so no two loops are alike. The rings replace the fine weave scan as the
    surface relief, and the loop shadows darken the color a little."""
    m = bpy.data.materials.get('upholstery')
    if not m:
        return
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 140.0
    noise.inputs['Detail'].default_value = 3.0
    warp = nt.nodes.new('ShaderNodeVectorMath')
    warp.operation = 'MULTIPLY_ADD'
    warp.inputs[1].default_value = (0.0035, 0.0035, 0.0035)
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Color'], warp.inputs[0])
    nt.links.new(tc.outputs['Object'], warp.inputs[2])

    def ring_layer(scale, radius, width, offset):
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Location'].default_value = offset
        nt.links.new(warp.outputs['Vector'], mp.inputs['Vector'])
        vor = nt.nodes.new('ShaderNodeTexVoronoi')
        vor.feature = 'F1'
        vor.inputs['Scale'].default_value = scale
        vor.inputs['Randomness'].default_value = 1.0
        nt.links.new(mp.outputs['Vector'], vor.inputs['Vector'])
        sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = radius
        ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'
        dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'DIVIDE'; dv.inputs[1].default_value = width
        inv = nt.nodes.new('ShaderNodeMapRange')
        inv.inputs['From Min'].default_value = 0.0
        inv.inputs['From Max'].default_value = 1.0
        inv.inputs['To Min'].default_value = 1.0
        inv.inputs['To Max'].default_value = 0.0
        inv.interpolation_type = 'SMOOTHSTEP'
        nt.links.new(vor.outputs['Distance'], sub.inputs[0])
        nt.links.new(sub.outputs[0], ab.inputs[0])
        nt.links.new(ab.outputs[0], dv.inputs[0])
        nt.links.new(dv.outputs[0], inv.inputs['Value'])
        return inv.outputs['Result']

    # Four overlapping layers of loops so the yarn covers the whole surface with no flat gaps.
    rings = [ring_layer(sc, 0.24, 0.17, off) for sc, off in ((210.0, (0, 0, 0)), (250.0, (0.37, 0.11, 0.53)), (290.0, (0.71, 0.43, 0.19)), (330.0, (0.13, 0.67, 0.91)))]
    mx = rings[0]
    for r in rings[1:]:
        m_ = nt.nodes.new('ShaderNodeMath'); m_.operation = 'MAXIMUM'
        nt.links.new(mx, m_.inputs[0]); nt.links.new(r, m_.inputs[1])
        mx = m_.outputs[0]
    mx = type('S', (), {'outputs': [mx]})()
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = 0.0012
    nt.links.new(mx.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    # Shadow between the loops: darken the color where there is no yarn.
    base = p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].links else None
    if base is not None:
        shade = nt.nodes.new('ShaderNodeMapRange')
        shade.inputs['To Min'].default_value = 0.8
        shade.inputs['To Max'].default_value = 1.0
        nt.links.new(mx.outputs[0], shade.inputs['Value'])
        mul = nt.nodes.new('ShaderNodeMix')
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1.0
        nt.links.new(base, mul.inputs[6])
        nt.links.new(shade.outputs['Result'], mul.inputs[7])
        nt.links.new(mul.outputs[2], p.inputs['Base Color'])


def rug_weave():
    """The rug: a flat weave in two close tones with a fine rib and a soft band near the edge."""
    m = bpy.data.materials.get('rug')
    if not m:
        return
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    rib = nt.nodes.new('ShaderNodeTexWave')
    rib.wave_type = 'BANDS'
    rib.bands_direction = 'X'
    rib.inputs['Scale'].default_value = 260.0
    rib.inputs['Distortion'].default_value = 0.4
    checker = nt.nodes.new('ShaderNodeTexChecker')
    checker.inputs['Scale'].default_value = 90.0
    checker.inputs['Color1'].default_value = (0.32, 0.30, 0.27, 1)
    checker.inputs['Color2'].default_value = (0.27, 0.25, 0.225, 1)
    for n in (rib, checker):
        nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.25
    nt.links.new(checker.outputs['Color'], mix.inputs[6])
    nt.links.new(rib.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.5
    bump.inputs['Distance'].default_value = 0.001
    nt.links.new(rib.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = 0.95


def render(out):
    oak_wood()
    rug_weave()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.context.scene.render.filepath = os.path.abspath(out)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


def main():
    a = args()
    shot, out = a['shot'], a['out']
    samples = int(a.get('samples', 128))
    kind, *rest = shot.split(':')
    C.reset()  # wipes the file, so it runs before any setup
    if kind == 'hero':
        bg = setup(samples, int(a.get('w', 2400)), int(a.get('h', 1500)))
        room_scene('Boucle Chalk', 'showroom')
        boucle_loops(0.8)
        daylight(bg)
        camera((-0.75, -5.6, 1.2), (2.05, -0.9, 0.5), 27, 8)
    elif kind == 'layout':
        preset, fabric = rest
        bg = setup(samples, int(a.get('w', 1200)), int(a.get('h', 900)))
        b = room_scene(fabric, preset)
        daylight(bg)
        cx, cy = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2
        span = max(b[1] - b[0], b[3] - b[2])
        camera((cx - 1.9, cy - 2.1 - span * 0.55, 1.25), (cx + 0.1, cy + 0.2, 0.38), 28, 8)
    elif kind == 'fabric':
        fabric = rest[0]
        bg = setup(samples, int(a.get('w', 1200)), int(a.get('h', 900)))
        PHOTO_MATS.update(scale=5.0, normal=2.2)
        room_scene(fabric, 'straight')
        if fabric == 'Boucle Chalk':
            boucle_loops()
        if fabric == 'Velvet Ink':
            velvet_sheen()
        bg.inputs['Color'].default_value = (0.6, 0.57, 0.53, 1)
        bg.inputs['Strength'].default_value = 0.12
        # A low light from the side grazes the cushion so every thread casts a tiny shadow.
        area('rake', (0.18, -1.62, 0.46), (math.radians(90), 0, math.radians(-38)), 0.6 if fabric == 'Boucle Chalk' else 0.3, 32, (1.0, 0.95, 0.88))
        area('soft', (1.3, -1.9, 1.2), (math.radians(60), 0, math.radians(35)), 1.5, 40, (0.92, 0.95, 1.0))
        # Close on the front edge of the middle seat cushion: the piped seam and the top surface.
        camera((0.62, -1.24, 0.5), (0.72, -0.93, 0.425), 100, 8)
    elif kind == 'craft':
        bg = setup(samples, int(a.get('w', 1200)), int(a.get('h', 900)))
        room_scene('Wool Moss', 'straight')
        daylight(bg)
        camera((-0.42, -1.55, 0.1), (0.12, -0.95, 0.07), 85, 3.2)
    elif kind == 'module':
        mod = rest[0]
        bg = setup(samples, int(a.get('w', 900)), int(a.get('h', 1125)))
        studio(bg)
        fab = a.get('fabric', 'Boucle Chalk')
        m = PS.mats(fab, scale=1.35, normal=1.1)
        o = PS.module(mod, m, 'photo')
        if fab == 'Boucle Chalk':
            boucle_loops(0.8)
        W, D = PS.FOOT[mod]
        t = math.radians(0)
        cx, cy = W / 2, -D / 2  # module center in its own frame (origin = back-left floor corner)
        o.rotation_euler.z = t
        o.location = (-(cx * math.cos(t) - cy * math.sin(t)), -(cx * math.sin(t) + cy * math.cos(t)), 0)
        size = max(W, D)
        camera((-1.25 * size - 0.5, -1.9 * size - 0.8, 1.15), (0.05, -0.05, 0.33), 55, 9)
    else:
        raise SystemExit(f'unknown shot {shot}')
    render(out)


main()
