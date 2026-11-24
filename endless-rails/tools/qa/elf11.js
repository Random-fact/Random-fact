const { _electron: electron } = require('playwright'); const { execSync } = require('child_process'); const path = require('path');
const APP = require('path').join(__dirname, '../../../desktop'), UD = process.argv[2];
(async () => {
  const app = await electron.launch({ executablePath: path.join(APP, 'node_modules/electron/dist/electron'), args: [APP, '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--user-data-dir=' + UD], env: Object.assign({}, process.env, { DISPLAY: ':77' }) });
  const w = await app.firstWindow(); await w.waitForFunction(() => window.__booted, null, { timeout: 180000 });
  const isFS = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  await app.evaluate(({ BrowserWindow }) => { const b = BrowserWindow.getAllWindows()[0]; b.focus(); b.webContents.focus(); }); await w.waitForTimeout(800);
  const k = key => execSync('DISPLAY=:77 xdotool key ' + key);
  k('F11'); await w.waitForTimeout(1500); const a = await isFS(); k('F11'); await w.waitForTimeout(1500); const b = await isFS();
  k('alt+Return'); await w.waitForTimeout(1500); const c = await isFS(); k('alt+Return'); await w.waitForTimeout(1500); const d = await isFS();
  /* the page's own Escape handling still works (opens settings) and Ctrl+R does not reload */
  const t0 = await w.evaluate(() => performance.timeOrigin); k('ctrl+r'); await w.waitForTimeout(2000); const t1 = await w.evaluate(() => performance.timeOrigin);
  console.log('F11', a, b, 'ALT+ENTER', c, d, 'CTRL+R reload blocked', t0 === t1);
  await app.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
