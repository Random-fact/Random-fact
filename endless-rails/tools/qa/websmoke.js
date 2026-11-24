/* the release web file from file://: boot, menu, start, drive, cameras, save, reload, continue; seed reproducibility of the track */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, locale: 'uk-UA' }); const p = await ctx.newPage(); const errs = [], net = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 160)); });
  p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) net.push(r.url().slice(0, 80)); });
  const url = 'file://' + path.resolve(process.argv[2]);
  await p.goto(url); await p.waitForFunction(() => window.__booted, null, { timeout: 180000 });
  await p.evaluate(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ mode: 'free', train: 'classic' }); });
  await p.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 300000 });
  await p.evaluate(() => { SettingsManager.v.musicOn = true; Sound.init(); Sound.setVols(); G.thrT = 1; }); await p.waitForTimeout(5000);
  for (let c = 0; c < 10; c++) { await p.evaluate(c => CamMgr.set(c), c); await p.waitForTimeout(300); }
  await p.evaluate(() => CamMgr.set(0));
  const st = await p.evaluate(() => ({ music: !!Music.cur, tracks: Music.bufs.size, s: Math.round(G.phys.s), font: document.fonts.check('16px Oswald') }));
  /* seed reproducibility: the same seed gives the same line, stations and names */
  const rep = await p.evaluate(() => { const snap = () => { const o = {}, r = []; for (let s = 0; s < 60000; s += 5000) { Rail.pose(s, o); r.push([o.x.toFixed(2), o.z.toFixed(2), o.y.toFixed(2)]); } let zi = 0; for (let i = 0; i < 5; i++) { zi = Rail.stnFrom(zi, 1, 1); r.push(Rail.zone(zi).name + Rail.zone(zi).sk); } return JSON.stringify(r); };
    const seed = G.seed, route = Rail.route, lay = Rail.layout; Rail.reset(seed, route, lay); const a = snap(); Rail.reset(seed, route, lay); const b = snap(); Rail.reset(seed + 1, route, lay); const c = snap(); Rail.reset(seed, route, lay); return { same: a === b, differs: a !== c }; });
  await p.evaluate(() => { G.save(); Profile.save(true); }); const s1 = await p.evaluate(() => Math.round(SaveSystem.read().s));
  await p.reload(); await p.waitForFunction(() => window.__booted, null, { timeout: 180000 });
  await p.evaluate(() => startGame({ save: SaveSystem.read() })); await p.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 300000 });
  const s2 = await p.evaluate(() => Math.round(G.phys.s));
  await p.screenshot({ path: 'out/websmoke.png' });
  console.log('WEB', JSON.stringify(Object.assign(st, { seedSame: rep.same, seedDiffers: rep.differs, saved: s1, resumed: s2, network: net.length })));
  console.log('ERRORS', errs.length, errs.slice(0, 8).join(' | ')); await b.close();
})().catch(e => { console.error('WEBSMOKE FAIL', e.message); process.exit(1); });
