module.exports = async (page, step, evalq, errs) => {
  await evalq(`(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ mode: 'free', train: 'classic' }); })()`);
  await page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 240000 });
  for (const lang of ['uk', 'en', 'ja']) {
    const r = await evalq(`(() => { setLang('${lang}'); const seen = new Map(), out = { n: 0, dup: 0, minGapKm: 1e9, minGapStations: 1e9, combos: NAME_A.length * NAME_B.length, ex: [] }; let s = 0, k = 0;
      for (let i = 0; i < 1500; i++) { const z = Rail.nextStation(s, 1); if (!z || z.c <= s) break; s = z.c + 600; k++; const nm = z.name; if (!nm) { out.ex.push('noname ' + z.zi); continue; } if (seen.has(nm)) { const p = seen.get(nm); out.dup++; const g = (z.c - p.c) / 1000; if (g < out.minGapKm) { out.minGapKm = +g.toFixed(1); out.minGapStations = k - p.k; } if (out.ex.length < 4) out.ex.push(nm + ' @' + Math.round(p.c / 1000) + '/' + Math.round(z.c / 1000) + 'km'); } seen.set(nm, { c: z.c, k }); }
      out.n = k; out.km = Math.round(s / 1000); return out; })()`);
    console.log('NAMES', lang, JSON.stringify(r));
  }
  /* intercity (sparse) layout and the stretch behind the start, plus reproducibility for the same seed */
  const r2 = await evalq(`(() => { setLang('uk'); const res = {}; for (const lay of ['sparse', 'dense']) { Rail.reset(4242, Rail.route, lay); const seen = new Map(); let dup = 0, minGap = 1e9, k = 0; let zi = 0; const first = [];
      for (let i = 0; i < 600; i++) { zi = Rail.stnFrom(zi, 1, 1); k++; const nm = Rail.zone(zi).name; if (first.length < 3) first.push(nm); if (seen.has(nm)) { dup++; minGap = Math.min(minGap, k - seen.get(nm)); } seen.set(nm, k); }
      let zb = 0, prev = Rail.zone(0).name, adjBack = 0; for (let i = 0; i < 300; i++) { zb = Rail.stnFrom(zb, -1, 1); const nm = Rail.zone(zb).name; if (nm === prev) adjBack++; prev = nm; }
      Rail.reset(4242, Rail.route, lay); let zz = 0; const again = []; for (let i = 0; i < 3; i++) { zz = Rail.stnFrom(zz, 1, 1); again.push(Rail.zone(zz).name); }
      res[lay] = { stations: k, dup, minGapStations: minGap, adjacentSameBehind: adjBack, reproducible: JSON.stringify(first) === JSON.stringify(again), first }; } return res; })()`);
  console.log('NAMES2', JSON.stringify(r2));
};
