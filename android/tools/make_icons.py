#!/usr/bin/env python3
"""Launcher icons (legacy + adaptive with a themed/monochrome layer) and the Play Store icon / feature graphic:
rails running to the horizon at dusk, in the game's ink / brass palette."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(root, 'app', 'src', 'main', 'res'); STORE = os.path.join(root, 'store')
S = 1024

def sky(w, h, hz):
    bg = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(bg)
    for y in range(h):
        if y < hz: t = y / hz; c = (int(18 + 70 * t), int(28 + 34 * t), int(52 + 22 * t))
        else: k = (y - hz) / max(1, h - hz); c = (int(20 - 8 * k), int(26 - 10 * k), int(34 - 12 * k))
        d.line([(0, y), (w, y)], fill=c + (255,))
    return bg

def scene(w, h, hz, cx, scale, ground=True):
    """sun glow + sleepers + rails; returns (colour layer RGBA on transparent, alpha mask of the drawn parts)"""
    L = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    g.ellipse([cx - 170 * scale, hz - 170 * scale, cx + 170 * scale, hz + 170 * scale], fill=(232, 163, 61, 150)); glow = glow.filter(ImageFilter.GaussianBlur(70 * scale))
    L = Image.alpha_composite(L, glow); d = ImageDraw.Draw(L)
    d.ellipse([cx - 62 * scale, hz - 62 * scale, cx + 62 * scale, hz + 62 * scale], fill=(255, 214, 140, 255))
    if ground: d.rectangle([0, hz, w, h], fill=(14, 18, 24, 255))
    lerp = lambda a, b, t: a + (b - a) * t
    for i in range(14):
        t = (i / 13) ** 2.1; y = lerp(hz + 6 * scale, h * 1.02, t); half = lerp(10, 470, t) * scale; th = lerp(2, 34, t) * scale
        d.polygon([(cx - half, y - th / 2), (cx + half, y - th / 2), (cx + half * 1.02, y + th / 2), (cx - half * 1.02, y + th / 2)], fill=(92, 80, 68, 255))
    for sg in (-1, 1):
        for wd, col in ((30, (122, 92, 46, 255)), (18, (232, 163, 61, 255))):
            x0, x1 = cx + sg * 4 * scale, cx + sg * 330 * scale; wd *= scale
            d.polygon([(x0 - wd * .05, hz), (x0 + wd * .05, hz), (x1 + wd / 2, h), (x1 - wd / 2, h)], fill=col)
    return L

def full_icon():
    hz = int(S * .56); img = sky(S, S, hz); img = Image.alpha_composite(img, scene(S, S, hz, S * .5, 1)); return img

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); img.save(path)

full = full_icon()
# legacy launcher (Android 7.x): rounded square
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22), fill=255)
leg = full.copy(); leg.putalpha(mask)
DENS = (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4))
for name, k in DENS:
    save(leg.resize((int(48 * k), int(48 * k)), Image.LANCZOS), os.path.join(RES, 'mipmap-' + name, 'ic_launcher.png'))
# adaptive layers: 108 dp canvas, artwork kept inside the 66 dp safe circle
A = 1296  # 108 dp at 12 px/dp, downscaled per density
hz = int(A * .58); scale = .62
bg = sky(A, A, hz); ImageDraw.Draw(bg).rectangle([0, hz, A, A], fill=(14, 18, 24, 255))
fg = scene(A, A, hz, A * .5, scale, ground=False)
# keep the rails inside the safe zone: fade them out towards the bottom edge of the 72 dp visible area
fade = Image.new('L', (A, A), 255); fd = ImageDraw.Draw(fade)
for y in range(int(A * .82), A): fd.line([(0, y), (A, y)], fill=int(255 * max(0, 1 - (y - A * .82) / (A * .1))))
fg.putalpha(Image.composite(fg.getchannel('A'), Image.new('L', (A, A), 0), fade))
mono = Image.new('RGBA', (A, A), (0, 0, 0, 0)); mono.putalpha(fg.getchannel('A').point(lambda v: 255 if v > 90 else 0))
mono = Image.composite(Image.new('RGBA', (A, A), (255, 255, 255, 255)), Image.new('RGBA', (A, A), (0, 0, 0, 0)), mono.getchannel('A'))
for name, k in DENS:
    px = int(108 * k)
    for img, n in ((bg, 'ic_launcher_bg'), (fg, 'ic_launcher_fg'), (mono, 'ic_launcher_mono')):
        save(img.resize((px, px), Image.LANCZOS), os.path.join(RES, 'mipmap-' + name, n + '.png'))
# Play Store: 512 x 512 full-bleed icon (Play applies the mask) and 1024 x 500 feature graphic
save(full.convert('RGB').resize((512, 512), Image.LANCZOS), os.path.join(STORE, 'icon-512.png'))
W, Hh = 1024, 500; hz = int(Hh * .62)
fgimg = sky(W, Hh, hz); fgimg = Image.alpha_composite(fgimg, scene(W, Hh, hz, W * .72, .52))
d = ImageDraw.Draw(fgimg)
def font(px):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, px)
    return ImageFont.load_default()
d.text((64, 150), 'ENDLESS', font=font(92), fill=(233, 228, 216, 255))
d.text((64, 250), 'RAILS', font=font(92), fill=(232, 163, 61, 255))
save(fgimg.convert('RGB'), os.path.join(STORE, 'feature-graphic-1024x500.png'))
print('icons and store graphics written')
