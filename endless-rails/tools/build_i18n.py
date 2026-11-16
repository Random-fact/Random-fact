#!/usr/bin/env python3
"""Merge i18n/<lang>.json into src/game.html (const I18N = /*@I18N@*/{...};).
Each entry: I18N[ukrainian source] = [en, ru, zh, ro, pt, es, fr, de, ja]; a missing translation is stored as "" and
falls back to English, then to the Ukrainian source, at runtime. Run after editing any translation file."""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
ORDER = ['en', 'ru', 'zh', 'ro', 'pt', 'es', 'fr', 'de', 'ja']   # must match LORD in game.html
src = json.load(open(os.path.join(root, 'i18n', 'source_uk.json'), encoding='utf-8'))
tr = {}
for c in ORDER:
    p = os.path.join(root, 'i18n', c + '.json')
    tr[c] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    if not tr[c]: print('warning: no translations for', c)
table = {k: [tr[c].get(k, '') for c in ORDER] for k in src}
# trim trailing empties to keep the page small
for k, v in table.items():
    while v and not v[-1]: v.pop()
blob = json.dumps(table, ensure_ascii=False, separators=(',', ':'))
assert '</script' not in blob.lower()
html_p = os.path.join(root, 'src', 'game.html'); html = open(html_p, encoding='utf-8').read()
html2, n = re.subn(r'const I18N = /\*@I18N@\*/.*?;\n', lambda m: 'const I18N = /*@I18N@*/' + blob + ';\n', html, count=1, flags=re.S)
if n != 1: sys.exit('I18N marker not found')
m = re.search(r"const LORD = (\[[^\]]*\])", html2)
assert m and json.loads(m.group(1).replace("'", '"')) == ORDER, 'LORD order in game.html differs from ORDER'
open(html_p, 'w', encoding='utf-8').write(html2)
done = {c: sum(1 for k in src if tr[c].get(k)) for c in ORDER}
print('I18N merged:', len(src), 'strings;', ', '.join(f'{c} {done[c]}' for c in ORDER))
