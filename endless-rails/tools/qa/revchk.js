module.exports = async (page, step, evalq, errs) => {
  for (const tr of ['classic', 'hs']) {
    await evalq(`(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ mode: 'free', train: '${tr}' }); })()`);
    await page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 240000 }); await page.waitForTimeout(800);
    const log = []; const st = async l => log.push(l + ':' + JSON.stringify(await evalq(`[+(G.phys.v * 3.6).toFixed(1), Math.round(G.phys.s), G.phys.dir, +G.phys.throttle.toFixed(2), +G.phys.brake.toFixed(2), G.paused, Stations.state, !!G.phys.emerg, G.atpCut, +G.atpBrake.toFixed(2)]`)));
    await st('start'); await evalq(`(() => { G.brkT = 0; G.thrT = 1; })()`); for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); await st('thr' + i); }
    await evalq(`(() => { G.thrT = 0; G.brkT = 1; })()`); await page.waitForFunction(() => G.phys.v < .05, null, { timeout: 120000 }).catch(() => log.push('no stop')); await st('stopped');
    await evalq(`UI.act('rev')`); await page.waitForTimeout(2500); await st('afterRev');
    await evalq(`(() => { G.brkT = 0; G.thrT = .8; })()`); for (let i = 0; i < 3; i++) { await page.waitForTimeout(1500); await st('back' + i); }
    console.log('REV', tr, log.join(' | '));
  }
};
