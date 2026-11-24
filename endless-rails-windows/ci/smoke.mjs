// CI smoke test: drives the running EndlessRails.exe through WebView2's DevTools port.
// Usage: node smoke.mjs <phase: first|second> <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [phase, out] = process.argv.slice(2);
const t0 = Date.now();
const log = (...a) => console.log(`[${phase} +${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
setTimeout(() => { log('WATCHDOG: giving up after 150 s'); process.exit(2); }, 150000).unref();

async function connect() {
  for (let i = 0; i < 40; i++) {
    try { return await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); }
    catch (e) { if (i % 5 === 0) log('connect attempt', i, e.message.split('\n')[0]); await new Promise(r => setTimeout(r, 1000)); }
  }
  throw new Error('could not connect to WebView2 DevTools port');
}

async function shot(page, name) {
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 55, timeout: 15000 });
    fs.writeFileSync(`${out}/${phase}-${name}.jpg`, buf);
    log(`screenshot ${name}: ${buf.length} bytes`);
  } catch (e) { log(`screenshot ${name} failed:`, e.message.split('\n')[0]); }
}

const browser = await connect();
log('connected');
const ctx = browser.contexts()[0];
let page = ctx && ctx.pages()[0];
for (let i = 0; !page && i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); page = browser.contexts()[0]?.pages()[0]; }
if (!page) throw new Error('no page');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
log('url', page.url());
await page.waitForTimeout(12000);
const info = await Promise.race([
  page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return {
      origin: location.origin, ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
      webgl: !!gl, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      three: typeof THREE !== 'undefined' ? THREE.REVISION : null,
      storageKeys: Object.keys(localStorage),
      loader: (document.getElementById('ldpct') || {}).textContent,
    };
  }),
  new Promise(r => setTimeout(() => r('evaluate timed out'), 15000)),
]);
log('info', JSON.stringify(info));
await shot(page, '1-start');

if (phase === 'first') {
  for (const [label, wait] of [['Continue', 2000], ['New journey', 4000]]) {
    try { await page.getByText(label, { exact: true }).first().click({ timeout: 5000 }); log('clicked', label); }
    catch (e) { log('could not click', label, e.message.split('\n')[0]); }
    await page.waitForTimeout(wait);
  }
  await shot(page, '2-after-clicks');
  const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).filter(Boolean).slice(0, 30)).catch(e => e.message);
  log('visible buttons', JSON.stringify(buttons));
  for (const label of ['Start', 'Start journey', 'Go', 'Depart', 'Let\'s go']) {
    const b = page.getByText(label, { exact: true }).first();
    if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 5000 }).catch(() => {}); log('clicked', label); break; }
  }
  await page.waitForTimeout(15000);
  await shot(page, '3-journey');
  log('state', await page.evaluate(() => typeof G !== 'undefined' ? JSON.stringify({ running: G.running, mode: G.mode, v: G.phys && G.phys.v }) : 'no G').catch(e => e.message));
}
log('page errors', JSON.stringify(errors));
process.exit(0); // just disconnect; never close the app's browser from here
