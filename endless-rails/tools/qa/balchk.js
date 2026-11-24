module.exports = async (page, step, evalq, errs) => {
  for (const [s0, dir] of [[360000, 1], [5000, 1], [-200000, -1]]) {
    await evalq(`(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ save: { s: ${s0}, seed: 777002, dir: ${dir}, mode: 'free', tr: 'classic', layout: 'dense', v: 0, clock: 12 } }); })()`);
    await page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 300000 });
    const r = await evalq(`(() => { const out = []; for (let k = 0; k < 6; k++) {
        Env.wind = .1; Env.rain = 0; const def = EVDEFS.find(d => d.id === 'balloons'), c = Events.ctxNow(G); const E = Events.begin(def, c); if (!E) { out.push('nostart'); continue; }
        const first = E.data.list.map(b => [Math.round(b.g.position.x), Math.round(b.g.position.y), Math.round(b.g.position.z), Math.round(b.floor)]);
        for (let t = 0; t < 150; t += .1) { E.t += .1; E.def.tick(E, .1, Events.ctxNow(G)); }
        const res = E.data.list.map(b => { const p = b.g.position, q = {}; let best = 1e18, bs = 0; for (let ss = G.phys.s - 8000; ss <= G.phys.s + 8000; ss += 10) { Rail.pose(ss, q); const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < best) { best = d; bs = ss; } } Rail.pose(bs, q); return { hd: Math.round(Math.sqrt(best)), above: Math.round(p.y - q.y), s: Math.round(bs) }; });
        out.push({ train: Math.round(G.phys.s), first: first.slice(0, 2), res }); Events.stop(E, true); }
      return out; })()`);
    console.log('BAL', s0, JSON.stringify(r).slice(0, 1500));
  }
};
