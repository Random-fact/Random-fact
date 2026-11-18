#!/usr/bin/env python3
"""Build assets/index.html for the offline test APK: the game page with three.js and the fonts inlined.
(The Gradle build does the same in app/build.gradle.kts, task generateGameAsset.)"""
import base64, json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, '..', 'endless-rails', 'src', 'game.html')
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'assets', 'index.html')
html = open(src, encoding='utf-8').read()
three = open(os.path.join(root, 'vendor', 'three.min.js'), encoding='utf-8').read()
assert '</script' not in three.lower()

# 1) fonts: @font-face rules with embedded woff2 instead of the Google Fonts stylesheet
faces = json.load(open(os.path.join(root, 'vendor', 'fonts', 'fonts.json')))
cache, rules = {}, []
for f in faces:
    if f['file'] not in cache:
        cache[f['file']] = base64.b64encode(open(os.path.join(root, 'vendor', 'fonts', f['file']), 'rb').read()).decode()
    rules.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (f['fam'], f['w'], cache[f['file']], f['ur']))
link_pre = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
link_css = html[html.index('<link rel="stylesheet" href="https://fonts.googleapis.com'):]
link_css = link_css[:link_css.index('>') + 1]
assert link_pre in html
html = html.replace(link_pre, '').replace(link_css, '<style>' + ''.join(rules) + '</style>')

# 2) three.js r128 inline, as data: the page's start-up script runs it after the loading screen has been painted
mark = '<!--@THREE@-->'
assert mark in html, 'three.js placeholder not found in game.html'
bridge = "<script>window.IS_APK = true;</script>\n"
html = html.replace(mark, bridge + '<script type="text/plain" id="er-three">' + three + '</script>')
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'w', encoding='utf-8').write(html)
print('asset written:', dst, len(html.encode('utf-8')), 'bytes')
