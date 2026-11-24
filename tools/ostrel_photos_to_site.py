"""Turn the OSTREL Cycles renders in build/ostrel-photos into the site's images. python3 tools/ostrel_photos_to_site.py"""
from PIL import Image

SRC, DST = 'build/ostrel-photos', 'public/ostrel/stills'


def save(im, name, q=82):
    im.convert('RGB').save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)


def crop(im, cx, cy, w, ratio):
    W, H = im.size
    w = W * w; h = w / ratio
    return im.crop((int(W * cx - w / 2), int(H * cy - h / 2), int(W * cx + w / 2), int(H * cy + h / 2)))


import sys
ONLY = sys.argv[1:]  # e.g. movement caseback: rewrite only images that come from those renders
if not ONLY:
    for k in ('obsidian', 'champagne', 'glacier', 'noir'):
        save(Image.open(f'{SRC}/build-{k}.png').resize((800, 1000), Image.LANCZOS), f'build-{k}')
    hero = Image.open(f'{SRC}/hero.png')
    save(hero.resize((1920, 1200), Image.LANCZOS), 'hero-photo', 80)
if not ONLY or 'movement' in ONLY:
    save(Image.open(f'{SRC}/movement.png').resize((1200, 900), Image.LANCZOS), 'movement-photo')
if not ONLY or 'caseback' in ONLY:
    save(Image.open(f'{SRC}/caseback.png').resize((1200, 900), Image.LANCZOS), 'caseback-photo')
if not ONLY:
    save(crop(hero, 0.62, 0.42, 0.42, 4 / 3).resize((1200, 900), Image.LANCZOS), 'journal-1')
if not ONLY or 'movement' in ONLY:
    save(crop(Image.open(f'{SRC}/movement.png'), 0.4, 0.45, 0.6, 4 / 3).resize((1200, 900), Image.LANCZOS), 'journal-2')
if not ONLY:
    save(crop(Image.open(f'{SRC}/build-glacier.png'), 0.5, 0.5, 1.0, 4 / 3).resize((1200, 900), Image.LANCZOS), 'journal-3')
print('site images written')
