"""Turn the HALRUNE Cycles renders in build/photos into the site's images. python3 tools/halrune_photos_to_site.py"""
from PIL import Image

SRC, DST = 'build/photos', 'public/halrune/stills'

def save(im, name, size, q=80):
    im.convert('RGB').resize(size, Image.LANCZOS).save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)

def crop(im, cx, cy, w, aspect):
    W, H = im.size
    cw, ch = W * w, W * w / aspect
    return im.crop((int(W * cx - cw / 2), int(H * cy - ch / 2), int(W * cx + cw / 2), int(H * cy + ch / 2)))

for n in ('one', 'monitor', 'buds'):
    save(Image.open(f'{SRC}/{n}.png'), n, (800, 1000), 82)
hero = Image.open(f'{SRC}/hero.png')
save(hero, 'hero', (1920, 1200))
save(Image.open(f'{SRC}/exploded.png'), 'exploded', (1200, 900))
save(Image.open(f'{SRC}/wood.png'), 'wood', (1200, 900))
save(crop(hero, 0.5, 0.52, 0.3, 4 / 3), 'journal-1', (1200, 900))
save(crop(Image.open(f'{SRC}/wood.png'), 0.5, 0.5, 0.8, 4 / 3), 'journal-2', (1200, 900))
save(crop(hero, 0.17, 0.52, 0.32, 4 / 3), 'journal-3', (1200, 900))
print('site images written')
