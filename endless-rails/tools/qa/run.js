// usage: node run.js <html> <outdir> [scenario]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] || '.'), scen = process.argv[4] || 'basic';
const THREE_JS = fs.readFileSync(path.join(__dirname, '../../../android/vendor/three.min.js'));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const vp = scen.startsWith('mobile') ? { width: 390, height: 844 } : scen.startsWith('land') ? { width: 844, height: 390 } : { width: 1280, height: 720 };
  const ctx = await browser.newContext({ locale: process.env.LOCALE || 'uk-UA', viewport: vp, deviceScaleFactor: 1, hasTouch: scen.startsWith('mobile') || scen.startsWith('land'), isMobile: scen.startsWith('mobile') || scen.startsWith('land') });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.route('**/three.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_JS }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  /* the page is served over http (like the app's asset loader), so relative files such as music/*.ogg load */
  const root = path.dirname(html), fs2 = require('fs'), MIME = { html: 'text/html', ogg: 'audio/ogg', json: 'application/json', js: 'application/javascript' };
  await page.route('http://game.test/**', r => { const rel = decodeURIComponent(new URL(r.request().url()).pathname).slice(1), f = path.join(root, rel); if (!fs2.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: MIME[f.split('.').pop()] || 'application/octet-stream', body: fs2.readFileSync(f) }); });
  await page.goto('http://game.test/' + path.basename(html));
  await page.waitForFunction(() => window.__booted, null, { timeout: 90000 }).catch(() => errs.push('BOOT: not finished'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, '00-start.png') });
  const step = async (name, ms) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(out, name + '.png') }); };
  const evalq = async (js) => { try { return await page.evaluate(js); } catch (e) { errs.push('EVAL: ' + e.message); } };
  if (process.env.LANGQ) await page.evaluate(l => { setLang(l); }, process.env.LANGQ);
  if (scen.startsWith('menu')) { const fn = require(path.resolve(scen.slice(5))); await fn(page, step, evalq, errs); console.log('ERRORS (' + errs.length + '):\n' + errs.slice(0, 40).join('\n')); await browser.close(); return; }
  await page.evaluate(() => { Profile.d.firstRun = false; Menu.show('journey'); });
  await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '00b-journey.png') });
  await page.click('.go button.pri');
  await page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await step('01-cab', 500);
  if (scen === 'basic' || scen.startsWith('mobile') || scen.startsWith('land')) {
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
    await step('02-moving', 4000);
    for (const [i, n] of [[3, 'chase'], [4, 'cine'], [8, 'orbit'], [7, 'rear'], [3, 'pass']]) { await page.keyboard.press('Digit' + i); await step('03-cam-' + n, 1800); }
    await page.keyboard.press('Digit0'); await step('04-map', 1500);
  }
  if (scen.startsWith('script:')) { const fn = require(path.resolve(scen.slice(7))); await fn(page, step, evalq, errs); }
  if (scen.startsWith('eval:')) { const r = await evalq(scen.slice(5)); console.log('EVAL RESULT', JSON.stringify(r)); await step('05-eval', 3000); }
  const info = await evalq(`(() => ({ s: G.phys.s, v: G.phys.v, chunks: WorldGen.chunks.size, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: renderer.info.programs.length, q: Quality.level, objs: scene.children.length }))()`);
  console.log('INFO', JSON.stringify(info));
  console.log('ERRORS (' + errs.length + '):\n' + errs.slice(0, 40).join('\n'));
  await browser.close();
})();
