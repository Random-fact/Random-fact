/* Drives the desktop app (desktop/main.js, preload.js, app/) with the Linux Electron binary: launch, boot, start a journey,
   F11 full screen, save, quit, relaunch and check the journey and settings came back; window state file. */
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = require('path').join(__dirname, '../../../desktop'), UD = process.argv[2];
(async () => {
  const errs = [];
  const launch = async () => { const app = await electron.launch({ executablePath: path.join(APP, 'node_modules/electron/dist/electron'), args: [APP, '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--user-data-dir=' + UD], env: Object.assign({}, process.env, { DISPLAY: ':77' }), timeout: 120000 });
    const w = await app.firstWindow({ timeout: 120000 }); w.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); }); w.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); return [app, w]; };
  let [app, w] = await launch();
  console.log('URL', w.url());
  await w.waitForFunction(() => window.__booted, null, { timeout: 180000 });
  const info = await w.evaluate(() => ({ desk: !!window.IS_DESKTOP, bridge: typeof DesktopApp, plat: window.DesktopApp && DesktopApp.platform, secure: isSecureContext, origin: location.origin, three: typeof THREE, font: document.fonts.check('16px Oswald'), size: innerWidth + 'x' + innerHeight }));
  console.log('BOOT', JSON.stringify(info));
  const title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()); console.log('TITLE', title);
  await w.screenshot({ path: path.join(UD, 'el_menu.png') });
  await w.evaluate(() => { Profile.d.firstRun = false; SaveSystem.clear(); SettingsManager.v.master = .42; SettingsManager.v.invertX = true; setLang('fr'); Profile.save(true); startGame({ mode: 'free', train: 'hs' }); });
  await w.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 300000 });
  await w.evaluate(() => { G.thrT = 1; }); await w.waitForTimeout(6000);
  const run = await w.evaluate(() => ({ s: Math.round(G.phys.s), kmh: +(G.phys.v * 3.6).toFixed(1), music: Music.voices.length, actx: Sound.ctx && Sound.ctx.state, tracks: Music.bufs.size }));
  console.log('RUN', JSON.stringify(run));
  await w.screenshot({ path: path.join(UD, 'el_game.png') });
  /* F11 → full screen and back */
  await w.keyboard.press('F11'); await w.waitForTimeout(1500); const fs1 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  await w.keyboard.press('F11'); await w.waitForTimeout(1500); const fs2 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  const viaBridge = await w.evaluate(() => DesktopApp.toggleFullscreen(true)); await w.waitForTimeout(1200); await w.evaluate(() => DesktopApp.toggleFullscreen(false)); await w.waitForTimeout(1200);
  console.log('FULLSCREEN F11 on/off', fs1, fs2, 'bridge', viaBridge);
  /* blocked things: a permission request and navigation away */
  const perm = await w.evaluate(() => navigator.permissions.query({ name: 'geolocation' }).then(r => r.state).catch(e => 'err ' + e.message));
  console.log('PERM geolocation', perm);
  const before = await w.evaluate(() => { G.save(); Profile.save(true); const s = SaveSystem.read(); return { s: Math.round(s.s), seed: s.seed, train: G.train.type, lang: LANG, master: SettingsManager.v.master, invertX: SettingsManager.v.invertX }; });
  console.log('BEFORE', JSON.stringify(before));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 30, width: 1100, height: 640 })); await w.waitForTimeout(1200);
  await app.close();
  console.log('STATEFILE', fs.existsSync(path.join(UD, 'window-state.json')) ? fs.readFileSync(path.join(UD, 'window-state.json'), 'utf8') : 'missing');
  [app, w] = await launch();
  await w.waitForFunction(() => window.__booted, null, { timeout: 180000 });
  const after = await w.evaluate(() => { const s = SaveSystem.read(); return { s: s && Math.round(s.s), seed: s && s.seed, lang: LANG, master: SettingsManager.v.master, invertX: SettingsManager.v.invertX, contShown: !!s }; });
  const b2 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  console.log('AFTER', JSON.stringify(after), 'bounds', JSON.stringify(b2));
  await w.evaluate(() => startGame({ save: SaveSystem.read() })); await w.waitForFunction(() => G.running && !document.getElementById('loading').classList.contains('open'), null, { timeout: 300000 });
  console.log('RESUMED', JSON.stringify(await w.evaluate(() => ({ s: Math.round(G.phys.s), seed: G.seed, train: G.train.type }))));
  await app.close();
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
})().catch(e => { console.error('ELTEST FAIL', e.message); process.exit(1); });
