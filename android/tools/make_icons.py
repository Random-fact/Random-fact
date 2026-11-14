#!/usr/bin/env python3
"""Launcher icon: rails running to the horizon at dusk, in the game's ink / brass palette."""
from PIL import Image, ImageDraw, ImageFilter
import os
S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bg = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(bg)
for y in range(S):  # dusk sky over dark ground
    t = y / S
    if t < .56: c = (int(18 + 120 * t), int(28 + 60 * t), int(52 + 40 * t))
    else: k = (t - .56) / .44; c = (int(20 - 10 * k), int(26 - 12 * k), int(34 - 14 * k))
    d.line([(0, y), (S, y)], fill=c + (255,))
hz = int(S * .56)
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
g.ellipse([S * .5 - 170, hz - 170, S * .5 + 170, hz + 170], fill=(232, 163, 61, 150)); glow = glow.filter(ImageFilter.GaussianBlur(70))
bg = Image.alpha_composite(bg, glow); d = ImageDraw.Draw(bg)
d.ellipse([S * .5 - 62, hz - 62, S * .5 + 62, hz + 62], fill=(255, 214, 140, 255))
d.rectangle([0, hz, S, S], fill=(14, 18, 24, 255))
vx, vy = S * .5, hz
def lerp(a, b, t): return a + (b - a) * t
# sleepers
for i in range(14):
    t = (i / 13) ** 2.1; y = lerp(vy + 6, S * 1.02, t); half = lerp(10, 470, t); th = lerp(2, 34, t)
    d.polygon([(vx - half, y - th / 2), (vx + half, y - th / 2), (vx + half * 1.02, y + th / 2), (vx - half * 1.02, y + th / 2)], fill=(92, 80, 68, 255))
# rails
for sg in (-1, 1):
    for w, col in ((30, (122, 92, 46, 255)), (18, (232, 163, 61, 255))):
        x0, x1 = vx + sg * 4, vx + sg * 330
        d.polygon([(x0 - w * .05, vy), (x0 + w * .05, vy), (x1 + w / 2, S), (x1 - w / 2, S)], fill=col)
img = bg
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22), fill=255)
img.putalpha(mask)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for name, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    p = os.path.join(root, 'res', 'mipmap-' + name); os.makedirs(p, exist_ok=True)
    img.resize((px, px), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
img.resize((512, 512), Image.LANCZOS).save(os.path.join(root, 'icon-512.png'))
print('icons written')
