// usage: node soak_agg.js <dir with w1..w4.json> [out.json]  -> merged statistics
const fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]), out = process.argv[3];
const W = fs.readdirSync(dir).filter(f => /^w\d\.json$/.test(f)).sort().map(f => Object.assign(JSON.parse(fs.readFileSync(path.join(dir, f))), { file: f }));
/* top-level code module -> player-facing system */
const SYS = [
  [/^(WorldGen|Chunk|Builder|terr|meshH|ptAt|Rail|Roads|ZoneDecor|FarLand|Veg|Trees|groundMin|objFade|evictZoneTex|housekeep)/, 'World generation'],
  [/^(Events|EVDEFS|slide|tempLimit|fallenTreeSpot|rocksGroup|PartSys|planeModel|Aviation)/, 'Events'],
  [/^(RailTraffic)/, 'AI trains'], [/^(Traffic)/, 'Road traffic'], [/^(Passengers|StationLife|Stations|StopEval)/, 'Stations and passengers'],
  [/^(CamMgr|camTunnel)/, 'Cameras'], [/^(StationCat)/, 'Station cat'], [/^(Sound|Music|Audio)/, 'Audio'], [/^(UI|Guide|applyI18n|setLang|_T|Loading)/, 'Interface'],
  [/^(Weather|DayNight|sky|precip|Env|CabGlass|EnvMap|Beam|GlowPts)/, 'Weather, sky, light'], [/^(Train|Phys|G$|frame|Limits|Junctions|Signals)/, 'Train, physics, signals'],
  [/^(SaveSystem|Profile|Stats|Achievements|startGame)/, 'Saves and profile'], [/^(Birds|Wildlife)/, 'Animals'], [/^three/, 'three.js (engine)'], [/^soak/, 'test harness'],
];
const sysOf = s => { if (/^Events\//.test(s)) return 'Events'; const m = s.replace(/:\d+$/, ''); for (const [re, n] of SYS) if (re.test(m)) return n; return 'Other (' + m + ')'; };
const R = { worlds: [], errors: [], bySystem: {}, events: {}, invariants: {}, placement: {}, perf: {}, totals: { days: 0, km: 0, frames: 0, gameHours: 0, starts: 0, wall: 0 } };
for (const w of W) {
  R.worlds.push({ name: w.cfg && w.cfg.name, mode: w.cfg && w.cfg.mode, train: w.cfg && w.cfg.tr, days: w.days, km: w.km, frames: w.frames, gameH: +(w.gt / 3600).toFixed(1), msPerFrame: w.msPerFrame, wallS: w.wallS, acts: w.acts, fatal: w.fatal || '', outside: (w.outside || []).length, childrenAfter: w.childrenAfter, finishError: w.finishError || '' });
  R.totals.days += w.days || 0; R.totals.km += w.km || 0; R.totals.frames += w.frames || 0; R.totals.gameHours += (w.gt || 0) / 3600; R.totals.wall = Math.max(R.totals.wall, w.wallS || 0);
  for (const e of Object.values(w.errs || {})) {
    const sys = sysOf(e.sys), k = sys + '|' + e.kind + '|' + e.msg.replace(/\d+(\.\d+)?/g, '#').slice(0, 120);
    const x = R.errors.find(q => q.key === k) || (R.errors.push({ key: k, sys, where: e.sys, kind: e.kind, msg: e.msg, st: e.st, n: 0, worlds: [] }), R.errors[R.errors.length - 1]);
    x.n += e.n; x.worlds.push(w.cfg.name + ' (day ' + e.day0 + ')');
    R.bySystem[sys] = R.bySystem[sys] || { errors: 0, warnings: 0, invariants: 0, kinds: 0 }; if (/warn/.test(e.kind)) R.bySystem[sys].warnings += e.n; else R.bySystem[sys].errors += e.n; R.bySystem[sys].kinds++;
  }
  for (const [name, v] of Object.entries(w.inv || {})) {
    const x = R.invariants[name] || (R.invariants[name] = { n: 0, by: {}, ex: [] }); x.n += v.n; for (const [k, c] of Object.entries(v.by)) x.by[k] = (x.by[k] || 0) + c; for (const e of v.ex) if (x.ex.length < 8) x.ex.push(Object.assign({ world: w.cfg.name }, e));
    const sys = /camera/.test(name) ? 'Cameras' : /track geometry/.test(name) ? 'World generation' : /event|tree/.test(name) ? 'Events' : /environment/.test(name) ? 'Weather, sky, light' : 'Train, physics, signals';
    R.bySystem[sys] = R.bySystem[sys] || { errors: 0, warnings: 0, invariants: 0, kinds: 0 }; R.bySystem[sys].invariants += v.n;
  }
  for (const [id, v] of Object.entries(w.ev || {})) {
    const x = R.events[id] || (R.events[id] = { started: 0, soak: 0, game: 0, forced: 0, failed: 0, ended: 0, timeout: 0, doneCond: 0, silent: 0, errored: 0, leftovers: 0, limitLeft: 0, maxObjs: 0, durs: [], place: { checked: 0, track: 0, bed: 0, float: 0, buried: 0, minRail: [], ex: [] } });
    for (const k of ['started', 'soak', 'game', 'forced', 'failed', 'ended', 'timeout', 'doneCond', 'silent', 'errored', 'leftovers', 'limitLeft']) x[k] += v[k] || 0;
    x.maxObjs = Math.max(x.maxObjs, v.maxObjs || 0); x.durs.push(...(v.dur || []));
    const P = v.place || {}; for (const k of ['checked', 'track', 'bed', 'float', 'buried']) x.place[k] += P[k] || 0; x.place.minRail.push(...(P.minRail || [])); for (const e of P.ex || []) if (x.place.ex.length < 6) x.place.ex.push(Object.assign({ world: w.cfg.name }, e));
  }
  R.perf[w.cfg.name] = { msPerFrame: w.msPerFrame, slow: (w.slow || []).slice(0, 8), heap: (w.gpu || []).map(g => g.heap), geo: (w.gpu || []).map(g => g.geo), tex: (w.gpu || []).map(g => g.tex), prog: (w.gpu || []).map(g => g.prog), children: (w.samp || []).map(s => s.ch), dom: (w.samp || []).map(s => s.dom), chunks: (w.samp || []).map(s => s.chunks) };
}
for (const x of Object.values(R.events)) { const d = x.durs.sort((a, b) => a - b); x.durMed = d.length ? d[Math.floor(d.length / 2)] : 0; x.durMax = d.length ? d[d.length - 1] : 0; delete x.durs; const m = x.place.minRail.sort((a, b) => a - b); x.place.minRailMin = m.length ? m[0] : null; x.place.minRailMed = m.length ? m[Math.floor(m.length / 2)] : null; delete x.place.minRail; R.totals.starts += x.started; }
R.errors.sort((a, b) => b.n - a.n); R.totals.gameHours = +R.totals.gameHours.toFixed(1);
if (out) fs.writeFileSync(out, JSON.stringify(R, null, 1));
/* console summary */
console.log('TOTALS', JSON.stringify(R.totals));
for (const w of R.worlds) console.log('WORLD', JSON.stringify(w));
console.log('BY SYSTEM'); for (const [k, v] of Object.entries(R.bySystem)) console.log('  ', k.padEnd(28), JSON.stringify(v));
console.log('ERRORS (distinct ' + R.errors.length + ')'); for (const e of R.errors.slice(0, 40)) console.log('  ', String(e.n).padStart(6), e.sys.padEnd(24), e.kind.padEnd(16), e.where.padEnd(22), e.msg.slice(0, 150));
console.log('INVARIANTS'); for (const [k, v] of Object.entries(R.invariants)) console.log('  ', String(v.n).padStart(6), k, JSON.stringify(v.by).slice(0, 300));
console.log('EVENTS id started(soak/game/forced) failed ended timeout/done/silent errored leftovers limitLeft place(track/bed/checked, minRail min/med) dur med/max');
for (const [id, x] of Object.entries(R.events).sort()) console.log('  ', id.padEnd(11), String(x.started).padStart(4), `(${x.soak}/${x.game}/${x.forced})`, 'f' + x.failed, 'e' + x.ended, `${x.timeout}/${x.doneCond}/${x.silent}`, 'err' + x.errored, 'left' + x.leftovers, 'lim' + x.limitLeft, `place ${x.place.track}/${x.place.bed}/${x.place.checked} min ${x.place.minRailMin} med ${x.place.minRailMed}`, x.place.float ? 'float' + x.place.float : '', `dur ${x.durMed}/${x.durMax}`);
