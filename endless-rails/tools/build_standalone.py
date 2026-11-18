#!/usr/bin/env python3
"""One self-contained page: the game with three.js, the fonts and the music inside (opens from a file, works offline).
Usage: python3 tools/build_standalone.py [out.html]   (default: endless-rails/EndlessRails.html, ~10 MB)"""
import base64, json, os, sys
root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')); src = root + '/endless-rails/src/game.html'; vend = root + '/android/vendor'
html = open(src, encoding='utf-8').read()
three = open(vend + '/three.min.js', encoding='utf-8').read(); assert '</script' not in three.lower()
faces = json.load(open(vend + '/fonts/fonts.json')); cache, rules = {}, []
for f in faces:
    if f['file'] not in cache: cache[f['file']] = base64.b64encode(open(vend + '/fonts/' + f['file'], 'rb').read()).decode()
    rules.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (f['fam'], f['w'], cache[f['file']], f['ur']))
pre = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'; css = html[html.index('<link rel="stylesheet" href="https://fonts.googleapis.com'):]; css = css[:css.index('>') + 1]
html = html.replace(pre, '').replace(css, '<style>' + ''.join(rules) + '</style>')
mus = {}
for f in sorted(os.listdir(root + '/endless-rails/src/music')):
    if f.endswith('.ogg'): mus[f[:-4]] = 'data:audio/ogg;base64,' + base64.b64encode(open(root + '/endless-rails/src/music/' + f, 'rb').read()).decode()
mark = '<!--@THREE@-->'; assert mark in html
html = html.replace(mark, '<script>window.ER_MUSIC = ' + json.dumps(mus) + ';</script>\n<script type="text/plain" id="er-three">' + three + '</script>')
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'endless-rails', 'EndlessRails.html'); open(out, 'w', encoding='utf-8').write(html); print(out, len(html.encode()), 'bytes')
