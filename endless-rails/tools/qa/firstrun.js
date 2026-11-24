const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [loc, vp] of [['uk-UA', { width: 1280, height: 720 }], ['de-DE', { width: 390, height: 844 }], ['ja-JP', { width: 844, height: 390 }]]) {
    const ctx = await b.newContext({ locale: loc, viewport: vp, hasTouch: vp.width < 900, isMobile: vp.width < 900 }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 140)); });
    await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForFunction(() => window.__booted, null, { timeout: 180000 }); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ lang: LANG, firstRun: Profile.d.firstRun, scr: Menu.scr, open: Menu.open, save: !!SaveSystem.read(), title: document.querySelector('#menubody h2, #menubody h1') && document.querySelector('#menubody h2, #menubody h1').textContent.slice(0, 40) }));
    await p.screenshot({ path: 'out/firstrun-' + loc + '.png' });
    /* the first journey from the menu with a real click on the main button */
    const btn = await p.$('#menubody button.pri, .go button.pri'); if (btn) await btn.click().catch(() => {}); await p.waitForTimeout(1000);
    const st2 = await p.evaluate(() => ({ scr: Menu.scr, running: G.running, loading: document.getElementById('loading').classList.contains('open') }));
    console.log('FIRST', loc, JSON.stringify(st), JSON.stringify(st2), 'errors', errs.length, errs.slice(0, 3).join(' | ')); await ctx.close(); }
  await b.close(); })();
