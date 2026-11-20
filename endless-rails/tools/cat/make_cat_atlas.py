#!/usr/bin/env python3
"""Station cat: the player's original clip (station_cat_source.mp4: 164x192, 49 frames, 10 fps = 100 ms per frame) turned
into a sprite atlas with transparency, without redrawing anything. Steps:
  1. every frame extracted with ffmpeg (no frame dropped or added), upscaled 4x (Lanczos) for clean edges;
  2. the cat cut out of the background by the BiRefNet segmentation model (rembg, model 'birefnet-general-lite');
  3. clean-up: the blue patterned fabric, its navy folds and the green diamond above the cat are removed by colour,
     only the cat's connected shape is kept (small pieces touching it stay), small holes inside it are closed, and a
     5-frame majority mask removes stray background bits that a single frame picked up;
  4. all frames cropped to the same box (the union of the cat over the clip, so its own movement inside the frame is
     kept), scaled to 124x140 cells (about 1.5x the source pixels: nothing of the original is lost), colours bled under
     the transparent margin (no dark fringes when the texture is filtered), packed 8 per row into a 1024x1024 WebP.
Usage: python3 make_cat_atlas.py <work dir> [--inject ../../src/game.html]
Needs: ffmpeg, pip install "rembg[cpu]" scipy pillow numpy (the model downloads on first use)."""
import os, sys, json, subprocess, base64, re
import numpy as np
from PIL import Image
from scipy import ndimage as nd
here = os.path.dirname(os.path.abspath(__file__)); W = sys.argv[1]; os.makedirs(W + '/frames', exist_ok=True)
SRC = os.path.join(here, 'station_cat_source.mp4'); UP = 4
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vsync', '0', W + '/frames/f%03d.png'], check=True)
fs = sorted(os.listdir(W + '/frames')); assert len(fs) == 49, len(fs)
# 2. segmentation
from rembg import remove, new_session
sess = None; RGB, AL = {}, {}; os.makedirs(W + '/seg', exist_ok=True)   # model output cached in <work>/seg (it takes minutes)
for f in fs:
    im = Image.open(W + '/frames/' + f).convert('RGB'); im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS); RGB[f] = np.asarray(im).astype(np.int16)
    cp = W + '/seg/' + f
    if not os.path.exists(cp): sess = sess or new_session('birefnet-general-lite'); remove(im, session=sess).save(cp)
    AL[f] = np.asarray(Image.open(cp).convert('RGBA'))[:, :, 3].astype(np.float32)
# 3. clean-up
def clean(f, cons=None):
    rgb, a = RGB[f], AL[f].copy(); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    blue = ((b > r + 25) & (b > g + 12) & (b > 60)) | ((b > r + 8) & (b > g + 2) & (b < 120))
    green = (g > r + 25) & (g > b + 15)
    a[blue | green] = 0; m = a > 110; lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1)); big = int(np.argmax(sizes)) + 1; keep = lab == big; near = nd.binary_dilation(keep, iterations=4)
        for k in range(1, n + 1):
            if k != big and sizes[k - 1] > 40 and (near & (lab == k)).any(): keep |= lab == k
        holes = nd.binary_fill_holes(keep) & ~keep & ~blue & ~green; hl, hn = nd.label(holes)
        for k in range(1, hn + 1):
            if (hl == k).sum() < 500: keep |= hl == k; a[hl == k] = 255
        a = a * nd.binary_dilation(keep, iterations=2)
    if cons is not None:
        k2 = (a > 110) & cons; l2, n2 = nd.label(k2)
        if n2: sz = nd.sum(k2, l2, range(1, n2 + 1)); k2 = l2 == (int(np.argmax(sz)) + 1); k2 = nd.binary_fill_holes(k2) & (a > 0) | k2
        a = a * nd.binary_dilation(k2, iterations=2)
    return np.clip(a, 0, 255)
M1 = {f: clean(f) > 110 for f in fs}; A = {}
for i, f in enumerate(fs):
    win = [M1[fs[j]] for j in range(max(0, i - 2), min(len(fs), i + 3))]
    A[f] = clean(f, nd.binary_dilation(np.sum(win, axis=0) >= max(2, len(win) // 2 + 1), iterations=22))
# 4. atlas
ys, xs = np.nonzero(np.max([A[f] for f in fs], axis=0) > 40); mg = 10
x0, y0, x1, y1 = xs.min() - mg, ys.min() - mg, xs.max() + mg, ys.max() + mg
CW, CH, GUT, COLS, SZ = 124, 140, 4, 8, 1024; PW, PH = CW + GUT, CH + GUT
atlas = Image.new('RGBA', (SZ, SZ), (0, 0, 0, 0))
for i, f in enumerate(fs):
    rgba = np.dstack([np.clip(RGB[f], 0, 255).astype(np.uint8), A[f].astype(np.uint8)])[y0:y1, x0:x1]
    cell = Image.fromarray(rgba, 'RGBA').resize((CW, CH), Image.LANCZOS); c = np.asarray(cell).copy()
    op = c[:, :, 3] > 8; _, (iy, ix) = nd.distance_transform_edt(~op, return_indices=True); c[~op, :3] = c[iy[~op], ix[~op], :3]   # bleed colours under the margin
    atlas.paste(Image.fromarray(c, 'RGBA'), ((i % COLS) * PW + GUT // 2, (i // COLS) * PH + GUT // 2))
bot = (ys.max() - y0) / (y1 - y0)
meta = {'n': len(fs), 'cols': COLS, 'cw': CW, 'ch': CH, 'pw': PW, 'ph': PH, 'gut': GUT, 'size': SZ, 'ms': 100, 'base': round(float(1 - bot), 4), 'aspect': round(CW / CH, 4)}
atlas.save(W + '/station_cat.webp', 'WEBP', quality=88, method=6, exact=False); json.dump(meta, open(W + '/station_cat.json', 'w'))
print('atlas', os.path.getsize(W + '/station_cat.webp'), 'bytes', meta)
if '--inject' in sys.argv:
    p = sys.argv[sys.argv.index('--inject') + 1]; html = open(p, encoding='utf-8').read()
    uri = 'data:image/webp;base64,' + base64.b64encode(open(W + '/station_cat.webp', 'rb').read()).decode()
    new = 'const CAT_ATLAS = /*@CAT@*/' + json.dumps({'uri': uri, **meta}) + ';\n'
    html2, n = re.subn(r'const CAT_ATLAS = /\*@CAT@\*/.*?;\n', lambda m: new, html, count=1, flags=re.S)
    if n != 1: sys.exit('CAT_ATLAS marker not found in ' + p)
    open(p, 'w', encoding='utf-8').write(html2); print('injected into', p)
