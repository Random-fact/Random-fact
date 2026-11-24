/* Builds app/index.html from the game page (three.js and the fonts inlined, like the Android asset task) and copies the
   music next to it, so the desktop app runs fully offline from its own files. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), SRC = path.join(ROOT, 'endless-rails', 'src'), VEND = path.join(ROOT, 'android', 'vendor'), OUT = path.resolve(__dirname, '..', 'app');
let html = fs.readFileSync(path.join(SRC, 'game.html'), 'utf8');
const three = fs.readFileSync(path.join(VEND, 'three.min.js'), 'utf8'); if (/<\/script/i.test(three)) throw new Error('three.min.js must not contain </script');
const faces = JSON.parse(fs.readFileSync(path.join(VEND, 'fonts', 'fonts.json'), 'utf8')), cache = {};
const rules = faces.map(f => { cache[f.file] = cache[f.file] || fs.readFileSync(path.join(VEND, 'fonts', f.file)).toString('base64'); return `@font-face{font-family:'${f.fam}';font-style:normal;font-weight:${f.w};font-display:swap;src:url(data:font/woff2;base64,${cache[f.file]}) format('woff2');unicode-range:${f.ur}}`; }).join('');
const pre = '<link rel="preconnect" href="https://fonts.googleapis.com">\n', i = html.indexOf('<link rel="stylesheet" href="https://fonts.googleapis.com');
if (i < 0 || !html.includes(pre)) throw new Error('font links not found in game.html');
html = html.slice(0, i) + '<style>' + rules + '</style>' + html.slice(html.indexOf('>', i) + 1); html = html.replace(pre, '');
const mark = '<!--@THREE@-->'; if (!html.includes(mark)) throw new Error('three.js placeholder not found');
html = html.replace(mark, () => '<script>window.IS_DESKTOP = true;</script><script type="text/plain" id="er-three">' + three + '</script>');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of fs.readdirSync(path.join(SRC, 'music'))) if (f.endsWith('.ogg')) fs.copyFileSync(path.join(SRC, 'music', f), path.join(OUT, 'music', f));
console.log('app/index.html', fs.statSync(path.join(OUT, 'index.html')).size, 'bytes; music', fs.readdirSync(path.join(OUT, 'music')).length, 'files');
