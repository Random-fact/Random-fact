module.exports = async (page, step, evalq, errs) => {
  await evalq(`(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ mode: 'free', train: 'classic' }); })()`);
  await page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 240000 }); await page.waitForTimeout(1500);
  await evalq(`(() => { window.__c = { n: 0, r: 0 }; const f = window.frame, ra = window.renderAll; window.frame = function (t) { __c.n++; f(t); }; window.renderAll = function () { __c.r++; return ra.apply(this, arguments); }; })()`);
  const meas = async (label, js, ms = 6000) => { await evalq(js); await page.waitForTimeout(2500); await evalq(`__c.n = 0; __c.r = 0;`); await page.waitForTimeout(ms); const r = await evalq(`[__c.n, __c.r]`); console.log('PCOST', label, 'frames', r[0], 'renders', r[1], 'ratio', (r[1] / r[0]).toFixed(2)); };
  await meas('running', `G.userPause = false`);
  await meas('paused, camera still', `G.userPause = true`);
  await meas('paused, camera turning', `(() => { window.__spin = setInterval(() => { const L = CamMgr.look.cab; if (L) L.yaw += .02; }, 16); })()`);
  await evalq(`clearInterval(__spin); G.userPause = false;`);
  await meas('main menu', `G.toMenu()`);
  console.log('ERRS', errs.length);
};
