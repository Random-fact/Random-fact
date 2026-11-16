#!/usr/bin/env python3
"""Validate a translation file against source_uk.json: same keys, no empty values, placeholders preserved."""
import json, re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
src = json.load(open(os.path.join(here, 'source_uk.json'), encoding='utf-8'))
ok = True
for code in sys.argv[1:]:
    p = os.path.join(here, code + '.json')
    try: d = json.load(open(p, encoding='utf-8'))
    except Exception as e: print(code, 'INVALID JSON', e); ok = False; continue
    miss = [k for k in src if k not in d]; extra = [k for k in d if k not in src]
    empty = [k for k in src if k in d and not str(d[k]).strip()]
    ph = [k for k in src if k in d and sorted(re.findall(r'\{\d\}', k)) != sorted(re.findall(r'\{\d\}', d[k]))]
    print(f'{code}: {len(d)} entries, missing {len(miss)}, extra {len(extra)}, empty {len(empty)}, placeholder mismatches {len(ph)}')
    for k in (miss[:5] + ph[:5]): print('   ', repr(k[:80]))
    ok = ok and not (miss or extra or empty or ph)
sys.exit(0 if ok else 1)
