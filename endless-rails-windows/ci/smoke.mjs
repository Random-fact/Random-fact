// CI smoke test: drives the running EndlessRails.exe through WebView2's DevTools port.
// Usage: node smoke.mjs <phase: first|second> <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [phase, out] = process.argv.slice(2);
const log = (...a) => console.log(`[${phase}]`, ...a);

async function connect() {
  for (let i = 0; i < 60; i++) {
    try { return await chromium.connectOverCDP('http://127.0.0.1:9222'); } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  throw new Error('could not connect to WebView2 DevTools port');
}

async function shot(page, name) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 55 });
  fs.writeFileSync(`${out}/${phase}-${name}.jpg`, buf);
  log(`screenshot ${name}: ${buf.length} bytes`);
}

const browser = await connect();
const ctx = browser.contexts()[0];
let page = ctx.pages()[0];
for (let i = 0; !page && i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); page = ctx.pages()[0]; }
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.waitForTimeout(12000);
log('url', page.url());
log('info', JSON.stringify(await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return {
    origin: location.origin, ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    webgl: !!gl, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    three: typeof THREE !== 'undefined' ? THREE.REVISION : null,
    storageKeys: Object.keys(localStorage),
  };
})));
await shot(page, '1-start');

if (phase === 'first') {
  for (const [label, wait] of [['Continue', 2000], ['New journey', 4000]]) {
    try { await page.getByText(label, { exact: true }).first().click({ timeout: 5000 }); log('clicked', label); }
    catch (e) { log('could not click', label, e.message.split('\n')[0]); }
    await page.waitForTimeout(wait);
  }
  await shot(page, '2-after-clicks');
  // start the journey if a confirmation / start button is shown
  for (const label of ['Start', 'Start journey', 'Go', 'Continue journey', 'Let\'s go']) {
    const b = page.getByText(label, { exact: true }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); log('clicked', label); break; }
  }
  await page.waitForTimeout(15000);
  await shot(page, '3-journey');
  log('running', await page.evaluate(() => typeof G !== 'undefined' ? JSON.stringify({ running: G.running, mode: G.mode, v: G.phys && G.phys.v }) : 'no G'));
}
log('page errors', JSON.stringify(errors));
await browser.close().catch(() => {});
