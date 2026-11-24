/* Release runtime audit: modes x trains x cameras, controls, audio lifecycle, saves across reload, frame cost per state, UI layout.
   usage: node run.js <html> <outdir> menu:tests/relaudit.js   (SECTIONS=modes,audio,saves,cost,ui to pick) */
module.exports = async (page, step, evalq, errs) => {
  const want = (process.env.SECTIONS || 'modes,audio,saves,cost,ui').split(',');
  const R = {}; const mark = () => errs.length; const since = n => errs.slice(n).map(e => e.split('\n')[0].slice(0, 200));
  const ready = () => page.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 240000 });
  const start = async (mode, train) => { await evalq(`(() => { Profile.d.firstRun = false; SaveSystem.clear(); startGame({ mode: '${mode}', train: '${train}' }); })()`); await ready(); await page.waitForTimeout(800); };
  const sane = () => evalq(`(() => { const c = camera.position, p = G.phys; return { ok: isFinite(c.x + c.y + c.z + p.s + p.v), s: Math.round(p.s), kmh: Math.round(p.v * 3.6), cam: CamMgr.id }; })()`);

  if (want.includes('modes')) {
    R.modes = [];
    const modes = await evalq(`MODES.map(m => m.id)`);
    let i = 0;
    for (const m of modes) for (const tr of ['classic', 'hs']) {
      if ((i++ % 2) && m !== 'free' && m !== 'dev') continue;   /* every mode once, free + dev with both trains */
      const n0 = mark(); await start(m, tr);
      const st0 = await evalq(`[G.mode, G.train.type, Unlocks.train('hs')]`);
      await evalq(`(() => { G.thrT = 1; G.brkT = 0; })()`); await page.waitForTimeout(2500);
      for (let c = 0; c < 10; c++) { await evalq(`CamMgr.set(${c})`); await page.waitForTimeout(450); }
      await evalq(`CamMgr.set(0)`);
      for (const a of ['lights', 'wipers', 'cabin', 'cruise', 'cruise', 'emerg', 'emerg', 'lights', 'wipers', 'cabin']) { await evalq(`UI.act('${a}')`); await page.waitForTimeout(120); }
      await evalq(`(() => { G.horn = true; })()`); await page.waitForTimeout(500); await evalq(`(() => { G.horn = false; })()`);
      await evalq(`UI.act('pause')`); await page.waitForTimeout(700); const ps = await evalq(`[G.paused, Math.round(G.phys.s)]`); await page.waitForTimeout(700); const ps2 = await evalq(`Math.round(G.phys.s)`); await evalq(`UI.act('pause')`);
      /* stop and reverse */
      await evalq(`(() => { G.thrT = 0; G.brkT = 1; G.phys.v = 0; })()`); await page.waitForTimeout(600); await evalq(`UI.act('rev')`); await page.waitForTimeout(2200);
      const dir = await evalq(`G.phys.dir`);
      await evalq(`(() => { G.brkT = 0; G.thrT = .6; })()`); await page.waitForTimeout(1500);
      const s = await sane();
      R.modes.push({ mode: m, train: tr, got: st0, pausedHeld: ps[0] && ps[1] === ps2, dirAfterRev: dir, sane: s, errors: since(n0) });
      console.log('MODE', m, tr, JSON.stringify(st0), 'pauseHolds', ps[0] && ps[1] === ps2, 'dir', dir, JSON.stringify(s), 'errs', since(n0).length);
    }
  }

  if (want.includes('audio')) {
    const n0 = mark(); await start('free', 'classic');
    const A = {};
    await evalq(`(() => { SettingsManager.v.musicOn = true; Sound.init(); Sound.setVols(); G.thrT = .5; })()`);
    await page.waitForFunction(() => Music.cur, null, { timeout: 20000 }).catch(() => { });
    A.musicStarts = await evalq(`!!Music.cur && Music.cur.id`); A.ctx = await evalq(`Sound.ctx && Sound.ctx.state`);
    await evalq(`UI.act('music')`); await page.waitForTimeout(1500);
    A.offVoices = await evalq(`[SettingsManager.v.musicOn, Music.voices.length, !!Music.cur]`);
    for (let k = 0; k < 6; k++) { await evalq(`UI.act('music')`); await page.waitForTimeout(250); }   /* rapid toggles: on/off x3 → off */
    await page.waitForTimeout(1500); A.afterToggles = await evalq(`[SettingsManager.v.musicOn, Music.voices.length, !!Music.cur]`);
    await evalq(`UI.act('music')`); await page.waitForFunction(() => Music.cur, null, { timeout: 20000 }).catch(() => { }); await page.waitForTimeout(3000);
    A.backOn = await evalq(`[!!Music.cur, Music.voices.filter(v => !v.dead).length]`);
    await evalq(`UI.act('track')`); await page.waitForTimeout(4000); A.nextTrack = await evalq(`[Music.cur && Music.cur.id, Music.voices.filter(v => !v.dead).length]`);
    /* app hidden (Android onStop / tab switch / minimise) and back */
    await evalq(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); })()`);
    await page.waitForTimeout(800); A.hidden = await evalq(`[Sound.ctx.state, G.paused, G.autoPaused || false]`);
    await evalq(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); })()`);
    await page.waitForTimeout(1200); A.shown = await evalq(`[Sound.ctx.state, G.paused]`);
    await evalq(`UI.act('pause')`); await page.waitForTimeout(1200); A.resumed = await evalq(`[G.paused, Sound.held]`);
    /* menu: train sounds held, music keeps playing */
    await evalq(`G.toMenu()`); await page.waitForTimeout(1200); A.menu = await evalq(`[Sound.held, !!Music.cur, G.inMenu]`);
    await evalq(`Menu.cont()`); await page.waitForTimeout(1500); A.cont = await evalq(`[Sound.held, G.inMenu, G.paused]`);
    /* master volume 0 → master gain 0 */
    await evalq(`(() => { SettingsManager.v.master = 0; G.applySetting('master', 0); })()`); await page.waitForTimeout(600); A.master0 = await evalq(`[+Sound.master.gain.value.toFixed(3), +Sound.musM.gain.value.toFixed(3)]`);
    await evalq(`(() => { SettingsManager.v.master = 1; G.applySetting('master', 1); })()`);
    A.errors = since(n0); R.audio = A; console.log('AUDIO', JSON.stringify(A));
  }

  if (want.includes('saves')) {
    const n0 = mark(); await start('free', 'hs');
    await evalq(`(() => { const v = SettingsManager.v; v.master = .37; v.music = .21; v.sfx = .44; v.invertX = true; v.invertY = true; v.fov = 77; v.gfx = 'low'; v.dayMin = 20; v.musicOn = false; Quality.choose('low'); setLang('de'); SettingsManager.save && SettingsManager.save(); })()`);
    await evalq(`(() => { G.thrT = 1; })()`); await page.waitForTimeout(6000); await evalq(`CamMgr.set(3)`); await page.waitForTimeout(500);
    const before = await evalq(`(() => { G.save(); Profile.save(true); const s = SaveSystem.read(); return { seed: s.seed, s: Math.round(s.s), cam: s.cam, mode: s.mode, train: G.train.type, wx: s.wx, clock: +(+s.clock).toFixed(2), lang: LANG, set: JSON.stringify([SettingsManager.v.master, SettingsManager.v.music, SettingsManager.v.sfx, SettingsManager.v.invertX, SettingsManager.v.invertY, SettingsManager.v.fov, SettingsManager.v.gfx, SettingsManager.v.dayMin, SettingsManager.v.musicOn]), km: +Profile.d.stats.km.toFixed(3) }; })()`);
    await page.reload(); await page.waitForFunction(() => window.__booted, null, { timeout: 120000 }); await page.waitForTimeout(1000);
    const menuAfter = await evalq(`({ lang: LANG, set: JSON.stringify([SettingsManager.v.master, SettingsManager.v.music, SettingsManager.v.sfx, SettingsManager.v.invertX, SettingsManager.v.invertY, SettingsManager.v.fov, SettingsManager.v.gfx, SettingsManager.v.dayMin, SettingsManager.v.musicOn]), km: +Profile.d.stats.km.toFixed(3), contVisible: !!SaveSystem.read() })`);
    await evalq(`(() => { startGame({ save: SaveSystem.read() }); })()`); await ready(); await page.waitForTimeout(800);
    const after = await evalq(`({ seed: G.seed, s: Math.round(G.phys.s), cam: CamMgr.idx, mode: G.mode, train: G.train.type, wx: Weather.key, clock: +Env.clock.toFixed(2) })`);
    R.saves = { before, menuAfter, after, errors: since(n0) }; console.log('SAVES', JSON.stringify(R.saves));
    await evalq(`(() => { const v = SettingsManager.v; v.invertX = false; v.invertY = false; v.gfx = 'auto'; v.musicOn = true; v.master = 1; v.music = .55; v.sfx = .8; v.fov = 70; v.dayMin = 30; setLang('uk'); SettingsManager.save && SettingsManager.save(); })()`);
  }

  if (want.includes('cost')) {
    const n0 = mark(); await start('free', 'classic');
    await evalq(`(() => { window.__cost = { ms: 0, n: 0, r: 0 }; const f = window.frame, ra = window.renderAll; window.frame = function (t) { const a = performance.now(); f(t); __cost.ms += performance.now() - a; __cost.n++; }; window.renderAll = function () { __cost.r++; return ra.apply(this, arguments); }; })()`);
    const meas = async (label, setup, ms = 5000) => { await evalq(setup); await page.waitForTimeout(1500); await evalq(`(() => { __cost.ms = 0; __cost.n = 0; __cost.r = 0; __cost.t0 = performance.now(); })()`); await page.waitForTimeout(ms); return evalq(`(() => { const T = (performance.now() - __cost.t0) / 1000; return { state: '${label}', busyMsPerS: +(__cost.ms / T).toFixed(1), framesPerS: +(__cost.n / T).toFixed(1), rendersPerS: +(__cost.r / T).toFixed(1) }; })()`); };
    R.cost = [];
    R.cost.push(await meas('moving 90 km/h', `(() => { G.userPause = false; G.cruise = true; G.cruiseV = 25; G.phys.v = 25; })()`));
    R.cost.push(await meas('stopped', `(() => { G.cruise = false; G.thrT = 0; G.brkT = 1; G.phys.v = 0; })()`));
    R.cost.push(await meas('paused', `(() => { G.userPause = true; UI.mark('pause', true); })()`));
    R.cost.push(await meas('main menu', `(() => { G.userPause = false; G.toMenu(); })()`));
    await evalq(`Menu.cont()`);
    for (const c of R.cost) console.log('COST', JSON.stringify(c)); R.costErrors = since(n0);
  }

  if (want.includes('ui')) {
    const n0 = mark(); await start('free', 'classic'); await evalq(`(() => { G.thrT = .5; })()`);
    R.ui = [];
    const sizes = [[360, 640], [390, 844], [412, 915], [834, 375], [844, 390], [915, 412], [1024, 768], [1280, 720], [1920, 1080], [2560, 1080], [800, 1280]];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(900);
      const r = await evalq(`(() => {
        const W = innerWidth, H = innerHeight, vis = e => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
        const out = [], over = [], clip = [];
        for (const e of document.querySelectorAll('#hud *, #ctl *, #camchips *')) { if (!vis(e) || e.closest('.sheet, #more, #settings, #evlog, #dev')) continue; const r = e.getBoundingClientRect(); if (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2) out.push((e.id || e.className || e.tagName) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); if ((e.tagName === 'BUTTON' || e.tagName === 'SPAN' || e.tagName === 'B') && e.children.length === 0 && e.scrollWidth > e.clientWidth + 3 && getComputedStyle(e).overflow !== 'visible') clip.push((e.id || e.textContent).slice(0, 30)); }
        const blocks = ['speedcard', 'info', 'stn', 'guide', 'ctl', 'btns', 'thr', 'brk', 'camchips', 'evcard', 'banner', 'lesson'].map(id => [id, document.getElementById(id)]).filter(([i, e]) => e && vis(e));
        for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) { const A = blocks[a][1], B = blocks[b][1]; if (A.contains(B) || B.contains(A)) continue; const p = A.getBoundingClientRect(), q = B.getBoundingClientRect(); const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left), oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (ox > 4 && oy > 4) over.push(blocks[a][0] + '×' + blocks[b][0] + ' ' + Math.round(ox) + 'x' + Math.round(oy)); }
        return { size: W + 'x' + H, pageScroll: document.documentElement.scrollWidth > W + 1 || document.documentElement.scrollHeight > H + 1, outside: out.slice(0, 6), overlaps: over, clipped: clip.slice(0, 6) };
      })()`);
      R.ui.push(r); console.log('UI', JSON.stringify(r)); await step('ui-' + w + 'x' + h, 100);
      /* the menu and settings at this size */
      await evalq(`UI.act('more')`); await step('ui-' + w + 'x' + h + '-more', 400); await evalq(`UI.act('more')`);
      await evalq(`UI.act('settings')`); await step('ui-' + w + 'x' + h + '-settings', 400); await evalq(`UI.act('closeset')`);
    }
    await evalq(`G.toMenu()`);
    for (const [w, h] of [[360, 640], [834, 375], [1280, 720]]) { await page.setViewportSize({ width: w, height: h }); for (const s of ['journey', 'training', 'extras', 'ach', 'settings']) { await evalq(`Menu.show('${s}')`); await step(`menu-${w}x${h}-${s}`, 350); } }
    R.uiErrors = since(n0);
  }
  require('fs').writeFileSync(process.env.OUTJSON || 'relaudit.json', JSON.stringify(R, null, 1));
};
