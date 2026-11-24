"""Turn the PLINTHA Cycles renders in build/photos into the site's images. python3 tools/plintha_photos_to_site.py"""
from PIL import Image

SRC, DST = 'build/photos', 'public/plintha/stills'


def save(im, name, size=None, q=80):
    im = im.convert('RGB')
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)


def crop43(im, cx, cy, w):
    W, H = im.size
    w = W * w
    h = w * 3 / 4
    return im.crop((int(W * cx - w / 2), int(H * cy - h / 2), int(W * cx + w / 2), int(H * cy + h / 2)))


hero = Image.open(f'{SRC}/hero.png')
save(hero, 'hero', (1920, 1200))
for k in ['armless', 'corner', 'arm_left', 'arm_right', 'chaise', 'ottoman']:
    save(Image.open(f'{SRC}/module-{k}.png'), f'module-{k}', (900, 1125), 82)
for n in ['layout-corner-moss', 'layout-u-ink', 'layout-chaise-sand']:
    save(crop43(Image.open(f'{SRC}/{n}.png'), 0.45, 0.36, 0.66), n, (1200, 900))  # the sofa fills the frame
for f in ['Boucle-Chalk', 'Wool-Moss', 'Linen-Sand', 'Velvet-Ink']:
    save(Image.open(f'{SRC}/fabric-{f}.png'), f'fabric-{f}', (1200, 900))
craft = Image.open(f'{SRC}/craft.png')
save(craft, 'craft', (1200, 900))
save(crop43(hero, 0.32, 0.62, 0.5), 'journal-1', (1200, 900))
save(Image.open(f'{SRC}/fabric-Linen-Sand.png'), 'journal-2', (1200, 900))
save(crop43(craft, 0.5, 0.5, 0.7), 'journal-3', (1200, 900))
print('site images written')
