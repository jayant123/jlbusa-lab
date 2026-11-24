"""Turn the Cycles renders in build/photos into the site's images. python3 tools/nuithra_photos_to_site.py"""
from PIL import Image

SRC, DST = 'build/photos', 'public/nuithra/stills'
NAMES = ['salt-iris', 'fig-night', 'amber-hour', 'smoke-garden', 'vetiver-rain']

def save(im, name, q=82):
    im.convert('RGB').save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)

for n in NAMES:
    im = Image.open(f'{SRC}/{n}.png'); pw, ph = im.size
    z = 1.0 if n == 'salt-iris' else 0.72  # tighter 4:5 crop so the bottle fills the card (the tall spire keeps its full frame)
    cw, ch = pw * z, pw * z * 1.25
    cy = ph * (0.5 if n == 'salt-iris' else 0.56)
    save(im.crop((int(pw / 2 - cw / 2), int(cy - ch / 2), int(pw / 2 + cw / 2), int(cy + ch / 2))).resize((800, 1000), Image.LANCZOS), f'bottle-{n}')
hero = Image.open(f'{SRC}/hero.png')
save(hero.resize((1920, 1200), Image.LANCZOS), 'hero-photo', 80)
W, H = hero.size
def crop43(cx, cy, w):
    h = w * 3 / 4
    return hero.crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))).resize((1200, 900), Image.LANCZOS)
save(crop43(W * 0.5, H * 0.66, W * 0.55), 'discovery')      # the middle three bottles
save(crop43(W * 0.82, H * 0.7, W * 0.38), 'journal-3')      # the two bottles on the right
def crop_product(n, cy=0.55, w=0.95):
    im = Image.open(f'{SRC}/{n}.png'); pw, ph = im.size
    cw = pw * w; chh = cw * 3 / 4
    return im.crop((int(pw / 2 - cw / 2), int(ph * cy - chh / 2), int(pw / 2 + cw / 2), int(ph * cy + chh / 2))).resize((1200, 900), Image.LANCZOS)
save(crop_product('amber-hour'), 'craft')
save(crop_product('salt-iris', 0.42), 'journal-1')
save(crop_product('smoke-garden'), 'journal-2')
print('site images written')
