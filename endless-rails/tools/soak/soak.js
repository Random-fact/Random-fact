// usage: node soak.js <game.html> <out.json> '<cfg json>'
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const html = path.resolve(process.argv[2]), outFile = path.resolve(process.argv[3]);
const cfg = Object.assign({ name: 'w', seed: 424242, mode: 'free', tr: 'classic', dir: 1, s: 3000, days: 250, per: 25, dayMin: 2, v: 33, q: 'medium', stopEvery: 2, pReverse: .1, cams: ['cab', 'chase', 'cine', 'orbit', 'walk', 'pass', 'roof', 'rear', 'map'], camEvery: 45, spawnEvery: 6, maxActive: 3, patience: 240, langs: false, reloadEvery: 0 }, JSON.parse(process.argv[4] || '{}'));
const THREE_JS = fs.readFileSync(path.join(__dirname, '../../../android/vendor/three.min.js'));
const log = (...a) => { const s = `[${cfg.name} ${new Date().toISOString().slice(11, 19)}] ` + a.join(' '); console.log(s); };
/* top-level declarations of the game file -> system names for stack lines */
const mods = []; fs.readFileSync(html, 'utf8').split('\n').forEach((l, i) => { const m = /^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/.exec(l); if (m) mods.push([i + 1, m[1]]); });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc --max-old-space-size=4096'] });
  const ctx = await browser.newContext({ locale: 'uk-UA', viewport: { width: 400, height: 225 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const outside = [];
  page.on('pageerror', e => outside.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('crash', () => outside.push('PAGE CRASH'));
  await page.route('**/three.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_JS }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort()); await page.route('**/fonts.gstatic.com/**', r => r.abort());
  const root = path.dirname(html), MIME = { html: 'text/html', ogg: 'audio/ogg', json: 'application/json', js: 'application/javascript' };
  await page.route('http://game.test/**', r => { const rel = decodeURIComponent(new URL(r.request().url()).pathname).slice(1), f = path.join(root, rel); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: MIME[f.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  await page.goto('http://game.test/' + path.basename(html));
  await page.waitForFunction(() => window.__booted, null, { timeout: 120000 });
  const ready = () => page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 180000 });
  const start = save => page.evaluate(({ c, save }) => { Profile.d.firstRun = false; setLang('uk'); if (!save) SaveSystem.clear(); startGame({ save: save || { s: c.s, seed: c.seed, dir: c.dir, mode: c.mode, tr: c.tr, layout: 'dense', v: 0, clock: 9 } }); }, { c: cfg, save });
  await start(null); await ready();
  await page.evaluate(fs.readFileSync(path.join(__dirname, 'soak_inpage.js'), 'utf8'));
  await page.evaluate(({ c, mods }) => { SOAK.setup(c, mods); if (c.cars) G.setCars(c.cars); const i = CAMS.findIndex(x => x.id === c.cams[0]); if (i >= 0) CamMgr.set(i); if (c.mode === 'scenic') G.cruise = true; }, { c: cfg, mods });
  const t0 = Date.now(); let last = 0, r;
  while (true) {
    r = await page.evaluate(n => SOAK.run(n), 2000).catch(e => ({ crash: e.message }));
    if (r.crash) { log('EVAL FAILED', r.crash); break; }
    if (Date.now() - last > 60000) { last = Date.now(); log(`day ${r.day} km ${r.km} frames ${r.f} left-events ${r.left} errors ${r.nerr} invariants ${r.ninv} batch ${r.ms}ms active[${r.act}]`); }
    if (r.fatal) { log('FATAL', r.fatal); break; }
    if (r.reload) {
      /* save and continue the journey from the save, like the player reopening the game */
      await page.evaluate(() => { G.save(); SOAK.needReload = false; SOAK.acts.reload++; window.requestAnimationFrame = window.__raf; window.__save = SaveSystem.read(); });
      await page.evaluate(() => { Profile.d.firstRun = false; startGame({ save: window.__save }); });
      await ready().catch(e => log('reload not ready', e.message));
      await page.evaluate(() => SOAK.setup(SOAK.cfg, SOAK.mods));
      continue;
    }
    if (r.day >= cfg.days && r.left === 0) break;
    if (r.day >= (cfg.maxDays || cfg.days * 1.6)) { log('stopping: events left', r.left); break; }
  }
  const res = await page.evaluate(() => SOAK.finish()).catch(e => ({ finishError: e.message }));
  res.outside = outside; res.wallS = Math.round((Date.now() - t0) / 1000); res.last = r;
  fs.writeFileSync(outFile, JSON.stringify(res));
  log('DONE', `days ${res.days} km ${res.km} frames ${res.frames} wall ${res.wallS}s ms/frame ${res.msPerFrame}`);
  await browser.close();
})().catch(e => { console.error('RUNNER', e); process.exit(1); });
