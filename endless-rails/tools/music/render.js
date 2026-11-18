#!/usr/bin/env node
/* Writes the game's music files: node render.js [outDir]   (needs Playwright with Chromium, and ffmpeg with libopus)
   Each file is a seamless loop: Ogg Opus, 48 kHz stereo, ~128 kbit/s, all at the same loudness. */
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'src', 'music')), TARGET = -20;   /* dBFS RMS */
const JOBS = [['theme', null, 0], ['drift', 'drift', 16], ['lofi', 'lofi', 24], ['night', 'night', 28], ['cine', 'cine', 16]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'render.html'));
  const meta = {};
  for (const [name, id, bars] of JOBS) {
    const r = id ? await p.evaluate(([i, n, t]) => renderLegacy(i, n, t), [id, bars, TARGET]) : await p.evaluate(t => renderTheme(t), TARGET);
    const pcm = path.join(OUT, name + '.pcm'), ogg = path.join(OUT, name + '.ogg');
    fs.writeFileSync(pcm, Buffer.from(r.b64, 'base64'));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcm, '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-application', 'audio', '-metadata', 'title=Endless Rails — ' + name, ogg]);
    fs.unlinkSync(pcm);
    meta[name] = { samples: r.samples, seconds: +(r.samples / 48000).toFixed(4), rmsDb: r.rmsDb, peak: r.peak, bytes: fs.statSync(ogg).size };
    console.log(name, JSON.stringify(meta[name]));
  }
  fs.writeFileSync(path.join(OUT, 'music.json'), JSON.stringify(meta, null, 1) + '\n');
  await b.close();
})();
