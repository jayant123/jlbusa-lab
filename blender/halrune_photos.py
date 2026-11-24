"""HALRUNE photos, path traced in Cycles from the same models as the live 3D (halrune_models.py).

tools/blender_lock.sh blender -b -P blender/halrune_photos.py -- --mode product --product one --finish Walnut --out build/photos/one.png
modes: product (one | monitor | buds), hero (the listening room), exploded (headphones apart), wood (a close look at a cup)
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import halrune_models as H  # noqa: E402

WOOD = {  # light, dark, grain scale, roughness
    'Walnut': ((0.2, 0.105, 0.055), (0.07, 0.035, 0.018), 0.32),
    'Ash': ((0.62, 0.5, 0.36), (0.42, 0.31, 0.2), 0.4),
    'Graphite': ((0.075, 0.075, 0.08), (0.025, 0.025, 0.028), 0.36),
    'Oak': ((0.5, 0.36, 0.21), (0.3, 0.2, 0.11), 0.42),
    'Black': ((0.03, 0.03, 0.032), (0.012, 0.012, 0.013), 0.3),
}
CERAMIC = {'Stone': (0.62, 0.6, 0.56), 'Ink': (0.03, 0.04, 0.07)}


def nodes(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes['Principled BSDF']


def wood(name, finish, straight=False, uv=False):
    """Wood grain from a distorted wave texture: long rings with fine pores. straight: flat-sawn grain for boards."""
    light, dark, rough = WOOD[finish]
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    tc = n.new('ShaderNodeTexCoord')
    mp = n.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (14, 14, 160)
    wave = n.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS' if straight else 'RINGS'
    if straight:
        wave.bands_direction = 'Y'
        mp.inputs['Scale'].default_value = (0.6, 22, 3)
    if uv:  # veneer: follow the UVs, whose u runs along the grain
        wave.wave_type = 'BANDS'
        wave.bands_direction = 'Y'
        mp.inputs['Scale'].default_value = (1.5, 9, 1)
    wave.inputs['Scale'].default_value = 1.2
    wave.inputs['Distortion'].default_value = 7
    wave.inputs['Detail'].default_value = 4
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 900
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['Factor'].default_value = 0.12
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    l.new(tc.outputs['UV' if uv else 'Object'], mp.inputs['Vector'])
    l.new(mp.outputs['Vector'], wave.inputs['Vector'])
    l.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    l.new(ramp.outputs['Color'], mix.inputs['A'])
    l.new(noise.outputs['Color'], mix.inputs['B'])
    l.new(mix.outputs['Result'], b.inputs['Base Color'])
    l.new(noise.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = 0.35
    b.inputs['Coat Roughness'].default_value = 0.18
    return m


def leather(name, color, rough=0.5, scale=1600, strength=0.25):
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    vor = n.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = scale
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    l.new(vor.outputs['Distance'], bump.inputs['Height'])
    l.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def velour(name):
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    b.inputs['Base Color'].default_value = (0.035, 0.035, 0.037, 1)
    b.inputs['Roughness'].default_value = 0.95
    b.inputs['Sheen Weight'].default_value = 0.8
    b.inputs['Sheen Tint'].default_value = (0.6, 0.6, 0.62, 1)
    return m


def grille(name):
    """Perforated steel: a square grid of round holes in the cup's YZ plane."""
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    b.inputs['Base Color'].default_value = (0.1, 0.1, 0.105, 1)
    b.inputs['Metallic'].default_value = 1
    b.inputs['Roughness'].default_value = 0.38
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    l.new(tc.outputs['Object'], sep.inputs[0])
    dist = None
    parts = []
    for ax in ('Y', 'Z'):
        mul = n.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 420
        fr = n.new('ShaderNodeMath'); fr.operation = 'FRACT'
        sub = n.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = 0.5
        sq = n.new('ShaderNodeMath'); sq.operation = 'POWER'; sq.inputs[1].default_value = 2
        l.new(sep.outputs[ax], mul.inputs[0]); l.new(mul.outputs[0], fr.inputs[0]); l.new(fr.outputs[0], sub.inputs[0]); l.new(sub.outputs[0], sq.inputs[0])
        parts.append(sq)
    add = n.new('ShaderNodeMath'); add.operation = 'ADD'
    l.new(parts[0].outputs[0], add.inputs[0]); l.new(parts[1].outputs[0], add.inputs[1])
    lt = n.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.09
    l.new(add.outputs[0], lt.inputs[0])
    tr = n.new('ShaderNodeBsdfTransparent')
    mix = n.new('ShaderNodeMixShader')
    out = n['Material Output']
    l.new(lt.outputs[0], mix.inputs['Fac'])
    l.new(b.outputs['BSDF'], mix.inputs[1])
    l.new(tr.outputs['BSDF'], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs['Surface'])
    return m


def glaze(name, color):
    """Matte glazed ceramic: a satin base, a soft sheen and a faint speckle."""
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Coat Weight'].default_value = 0.5
    b.inputs['Coat Roughness'].default_value = 0.28
    b.inputs['Sheen Weight'].default_value = 0.3
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2600
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.03
    l.new(noise.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def finish_mats(finish='Walnut', color='Stone'):
    M = C.material
    cer = CERAMIC.get(color, CERAMIC['Stone'])
    return {
        'wood': wood('wood', finish), 'cabinet': wood('cabinet', finish, uv=True),
        'steel': M('steel', (0.85, 0.86, 0.88), metallic=1.0, roughness=0.2),
        'leather': leather('leather', (0.05, 0.04, 0.035)),
        'pad': velour('pad'),
        'stitch': M('stitch', (0.62, 0.58, 0.5), roughness=0.75),
        'grille': grille('grille'),
        'baffle': M('baffle', (0.025, 0.025, 0.027), roughness=0.7),
        'driver': M('driver', (0.8, 0.78, 0.72), metallic=0.7, roughness=0.25),
        'magnet': M('magnet', (0.6, 0.6, 0.62), metallic=1.0, roughness=0.12),
        'cable': leather('cable', (0.03, 0.03, 0.033), 0.7, 3000, 0.4),
        'trim': M('trim', (0.018, 0.018, 0.02), roughness=0.4),
        'cone': leather('cone', (0.08, 0.08, 0.08), 0.85, 900, 0.15),
        'surround': M('surround', (0.02, 0.02, 0.02), roughness=0.55),
        'dome': M('dome', (0.8, 0.78, 0.72), roughness=0.6),
        'ceramic': glaze('ceramic', cer),
        'mark': M('mark', tuple(c * 0.82 for c in cer), roughness=0.6),
        'bud': M('bud', cer, roughness=0.28, coat=0.7, coat_roughness=0.06),
        'tip': M('tip', (0.16, 0.16, 0.165), roughness=0.75),
        'seam': M('seam', (0.03, 0.03, 0.03), roughness=0.6),
        'led': M('led', (0.2, 0.9, 0.5), roughness=0.3, emission=((0.3, 1.0, 0.55), 8)),
    }


def emit(name, color, k):
    m = bpy.data.materials.new(name)
    n, l, b = nodes(m)
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = k
    return m


def area(name, loc, target, size, color, power, size_y=None, cam=False):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape = 'RECTANGLE'
    d.size = size
    d.size_y = size_y or size
    d.color = color
    d.energy = power
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    o.visible_camera = cam
    bpy.context.collection.objects.link(o)
    return o


def studio():
    """A graphite sweep, a soft key, a cool fill and the brand's signal-orange rim from behind."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    sweep = bpy.context.object
    bm_data = sweep.data
    # curve the back up: make a cove from a subdivided strip
    bpy.ops.object.delete()
    import bmesh
    bm = bmesh.new()
    rows = []
    for i in range(40):
        t = i / 39
        if t < 0.5:
            y, z = -1.2 + t * 2 * 1.4, 0.0
        else:
            a = (t - 0.5) * 2 * (math.pi / 2)
            y, z = 0.2 + math.sin(a) * 0.4, (1 - math.cos(a)) * 0.4
        rows.append([bm.verts.new((x, y, z)) for x in (-2, 2)])
        if t >= 1:
            pass
    rows.append([bm.verts.new((x, 0.6, 2)) for x in (-2, 2)])
    for i in range(len(rows) - 1):
        bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    sw = C.obj_from_bmesh('sweep', bm, C.material('graphite', (0.02, 0.021, 0.022), roughness=0.6))
    area('key', (-0.55, -0.6, 0.65), (0, 0, 0.08), 0.9, (1, 0.96, 0.92), 9)
    area('fill', (0.7, -0.4, 0.25), (0, 0, 0.08), 1.0, (0.85, 0.9, 1.0), 2.5)
    area('rim', (0.35, 0.45, 0.4), (0, 0, 0.12), 0.25, (1.0, 0.45, 0.18), 9, 0.8)
    area('top', (0, -0.05, 0.9), (0, 0, 0), 0.8, (1, 1, 1), 2)
    world()


def world(k=0.15):
    w = bpy.data.worlds.new('w')
    bpy.context.scene.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.021, 0.022, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = k


def room():
    """The listening room: a wall of oak slats, a walnut credenza, a warm lamp glow and a dark floor."""
    oak = wood('slat', 'Oak', True)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(C.material('floor', (0.05, 0.045, 0.04), roughness=0.35))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.62, 1.2), rotation=(math.pi / 2, 0, 0))
    wallb = bpy.context.object
    wallb.scale = (6, 2.4, 1)
    wallb.data.materials.append(C.material('wallback', (0.02, 0.02, 0.021), roughness=0.9))
    for i in range(-40, 41):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(i * 0.045, 0.6, 1.2))
        s = bpy.context.object
        s.scale = (0.028, 0.03, 2.4)
        s.data.materials.append(oak)
        C.bevel(s, 0.002, 2)
    # Credenza.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.25, 0.26))
    cr = bpy.context.object
    cr.scale = (1.8, 0.45, 0.52)
    bpy.ops.object.transform_apply(scale=True)
    cr.data.materials.append(wood('credenza', 'Walnut', True))
    C.bevel(cr, 0.012, 4)
    # A warm strip of light under the slats' top and a lamp glow to the right.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(1.25, 0.5, 0.95), rotation=(math.pi / 2, 0, 0))
    lamp = bpy.context.object
    lamp.scale = (0.5, 0.9, 1)
    lamp.data.materials.append(emit('lampglow', (1, 0.62, 0.3), 2.5))
    lamp.visible_camera = True
    area('key', (-0.9, -1.0, 1.4), (0, 0.2, 0.6), 1.4, (1, 0.95, 0.9), 18)
    area('fill', (1.2, -1.2, 0.9), (0, 0.2, 0.6), 1.6, (0.8, 0.88, 1.0), 7)
    area('warm', (1.1, 0.2, 1.3), (0, 0.3, 0.6), 0.6, (1.0, 0.55, 0.25), 11)
    area('rim', (-0.6, 0.45, 1.1), (0, 0.3, 0.7), 0.4, (1.0, 0.45, 0.18), 9)
    world(0.08)


def place(objs, loc=(0, 0, 0), rot=0.0, scale=1.0):
    root = bpy.data.objects.new('root', None)
    bpy.context.collection.objects.link(root)
    for o in objs.values():
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, rot)
    root.scale = (scale, scale, scale)
    return root


def stand(loc):
    st = C.material('stand', (0.82, 0.83, 0.85), metallic=1, roughness=0.25)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.07, depth=0.012, location=(loc[0], loc[1], loc[2] + 0.006))
    b = bpy.context.object
    b.data.materials.append(wood('standbase', 'Walnut'))
    C.bevel(b, 0.003, 3)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.005, depth=0.21, location=(loc[0], loc[1], loc[2] + 0.117))
    bpy.context.object.scale.z = 0.25 / 0.21
    bpy.context.object.location.z = loc[2] + 0.137
    bpy.context.object.data.materials.append(st)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.006, location=(loc[0], loc[1], loc[2] + 0.219), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object
    t.data.materials.append(leather('saddle', (0.05, 0.04, 0.035)))
    bpy.ops.object.shade_smooth()
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(t.data)
    _bm.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.002], context='VERTS')  # keep the upper arc
    bm.to_mesh(t.data); bm.free()
    return loc[2] + 0.27


def explode(objs):
    """Move the headphone parts apart along each cup's axis, as on the page. Negative moves toward the head."""
    off = {'pad': -0.075, 'stitch': -0.075, 'driver': -0.032, 'baffle': -0.012, 'magnet': 0.022, 'grille': 0.06}
    for name, o in objs.items():
        for k, d in off.items():
            if name.startswith(k + '_'):
                o.location.x += d * (-1 if name.endswith('_l') else 1)


def camera(loc, target, lens, fstop=4.0):
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    cam.dof.use_dof = True
    o = bpy.data.objects.new('cam', cam)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.dof.focus_distance = d.length
    cam.dof.aperture_fstop = fstop
    bpy.context.scene.camera = o


def setup(w, h, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # noqa: BLE001
        print('CPU', e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 12
    sc.cycles.transparent_max_bounces = 16
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'


def main():
    a = C.args()
    C.reset()
    mode, prod = a.get('mode', 'product'), a.get('product', 'one')
    finish = a.get('finish', 'Walnut')
    samples = int(a.get('samples', 144))
    if mode == 'product':
        studio()
        m = finish_mats(finish, a.get('color', 'Stone'))
        objs = H.BUILD[prod]('high', m)
        if prod == 'one':
            for n in ('cable', 'plug'):
                bpy.data.objects.remove(objs.pop(n))
            place(objs, (0, 0, 0.205), math.radians(-28))
            camera((0.06, -1.0, 0.27), (0, 0, 0.2), 70)
        elif prod == 'monitor':
            place(objs, (0, 0, 0), math.radians(-24))
            camera((0.1, -0.9, 0.3), (0, 0, 0.15), 62)
        else:
            objs['case_lid'].rotation_euler.x = 0 if a.get('closed') else math.radians(-100)
            place(objs, (0, 0, 0), math.radians(-22), 3.0)
            camera((0.06, -0.62, 0.34), (0, 0, 0.055), 70)
        setup(int(a.get('w', 900)), int(a.get('h', 1125)), samples)
    elif mode == 'exploded':
        studio()
        m = finish_mats(finish)
        objs = H.headphones('high', m)
        for n in ('cable', 'plug'):
            bpy.data.objects.remove(objs.pop(n))
        explode(objs)
        place(objs, (0, 0, 0.205), math.radians(-14))
        camera((0.02, -0.6, 0.27), (0, 0, 0.2), 50)
        setup(int(a.get('w', 1200)), int(a.get('h', 900)), samples)
    elif mode == 'wood':
        studio()
        m = finish_mats(finish)
        objs = H.headphones('high', m)
        for n in ('cable', 'plug'):
            bpy.data.objects.remove(objs.pop(n))
        place(objs, (0, 0, 0.205), 0)
        camera((0.3, -0.16, 0.27), (0.098, 0, 0.205), 90, 4)
        setup(int(a.get('w', 1200)), int(a.get('h', 900)), samples)
    else:  # hero: the listening room
        room()
        top = 0.52
        for x, rot in ((-0.62, 12), (0.62, -12)):
            place(H.speaker('high', finish_mats('Walnut')), (x, 0.25, top), math.radians(rot))
        z = stand((0.0, 0.18, top))
        hp = H.headphones('high', finish_mats('Walnut'))
        for n in ('cable', 'plug'):
            bpy.data.objects.remove(hp.pop(n))
        place(hp, (0.0, 0.18, z - (H.BAND_Z + H.BAND_R) - 0.004), math.radians(-12))
        bud = H.buds('high', finish_mats('Walnut', 'Stone'))
        bud['case_lid'].rotation_euler.x = math.radians(-100)
        place(bud, (0.24, 0.08, top), math.radians(-25))
        camera((0, -1.75, 1.04), (0, 0.18, 0.68), 40, 5.6)
        setup(int(a.get('w', 2400)), int(a.get('h', 1500)), samples)
    out = os.path.abspath(a['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out)


main()
