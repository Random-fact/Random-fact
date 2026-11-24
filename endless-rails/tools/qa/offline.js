const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file://')) return r.continue(); return r.abort('internetdisconnected'); });
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(15000);
  console.log('OFFLINE', JSON.stringify(await p.evaluate(() => ({ booted: !!window.__booted, three: typeof THREE, loadingOpen: document.getElementById('loading').classList.contains('open'), msg: (document.getElementById('load') || {}).textContent, menu: document.getElementById('menu') && getComputedStyle(document.getElementById('menu')).display }))));
  console.log('ERRS', errs.slice(0, 5).join(' | ')); await p.screenshot({ path: 'out/offline.png' }); await b.close(); })();
