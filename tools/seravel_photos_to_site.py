"""Turn the SERAVEL Cycles renders in build/photos into site images. python3 tools/seravel_photos_to_site.py"""
from PIL import Image

SRC, DST = 'build/photos', 'public/seravel/stills'


def save(im, name, q=82):
    im.convert('RGB').save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)


def crop(im, cx, cy, w, aspect, size):
    pw, ph = im.size
    cw = pw * w
    ch = cw * aspect
    box = (int(pw * cx - cw / 2), int(ph * cy - ch / 2), int(pw * cx + cw / 2), int(ph * cy + ch / 2))
    return im.crop(box).resize(size, Image.LANCZOS)


ring = Image.open(f'{SRC}/solace-ring.png')
save(crop(ring, 0.5, 0.5, 1.0, 1.25, (800, 1000)), 'solace-ring')
save(crop(Image.open(f'{SRC}/halo-pendant.png'), 0.5, 0.56, 0.72, 1.25, (800, 1000)), 'halo-pendant')
save(crop(Image.open(f'{SRC}/tide-hoops.png'), 0.5, 0.5, 1.0, 1.25, (800, 1000)), 'tide-hoops')
hero = Image.open(f'{SRC}/hero.png')
save(hero.resize((1920, 1200), Image.LANCZOS), 'hero-photo', 80)
for src, name in [('workshop', 'workshop'), ('dish', 'journal-1'), ('stones', 'journal-2'), ('claws', 'journal-3')]:
    save(Image.open(f'{SRC}/{src}.png').resize((1200, 900), Image.LANCZOS), name)
print('site images written')
