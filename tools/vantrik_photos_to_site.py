"""Turn the VANTRIK Cycles renders in build/photos into site images. python3 tools/vantrik_photos_to_site.py"""
import os
from PIL import Image

SRC, DST = 'build/photos', 'public/vantrik/photos'
os.makedirs(DST, exist_ok=True)

def save(src, name, size=None, q=80):
    im = Image.open(f'{SRC}/{src}.png').convert('RGB')
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(f'{DST}/{name}.webp', 'WEBP', quality=q, method=6)

for k in ['runner-bone', 'runner-ember', 'runner-night', 'runner-moss', 'court-chalk', 'court-navy', 'court-oxblood', 'custom']:
    save(k, k)
save('hero', 'hero', (1920, 1200))
save('made', 'made')
save('knit', 'journal-1')
save('heel', 'journal-2')
im = Image.open(f'{SRC}/row.png').convert('RGB'); w, h = im.size
cw, ch = w * 0.92, w * 0.92 * 0.75
im.crop((int(w / 2 - cw / 2), int(h * 0.62 - ch / 2), int(w / 2 + cw / 2), int(h * 0.62 + ch / 2))).resize((1200, 900), Image.LANCZOS).save(f'{DST}/journal-3.webp', 'WEBP', quality=80, method=6)
print('site images written')
