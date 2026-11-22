/* ENDLESS RAILS soak harness, injected into the page. The game loop is stepped by hand (50 ms of game time per frame,
   drawing skipped except for a sampled real render), every event is spawned a target number of times, and errors,
   broken invariants, leaks and misplaced event objects are counted per system. */
(() => {
  const S = window.SOAK = {
    cfg: null, now: 0, f: 0, gt: 0, km: 0, errs: {}, ev: {}, inv: {}, samp: [], gpu: [], acts: { stops: 0, reverse: 0, cars: 0, train: 0, cams: 0, wx: 0, lang: 0, reload: 0, tele: 0, forced: 0, nofit: 0 },
    hold: 0, lastStopZ: -1, nextCam: 0, camI: 0, lastDay: -1, spawnT: 0, wait: {}, consecExc: 0, fatal: '', slow: [], tFrames: 0, lastS: 0, mods: [],
  };
  const U2v = 4.6, BEDWv = 3.4;
  S.modOf = line => { const M = S.mods; let lo = 0, hi = M.length - 1, r = '?'; while (lo <= hi) { const m = (lo + hi) >> 1; if (M[m][0] <= line) { r = M[m][1]; lo = m + 1; } else hi = m - 1; } return r; };
  S.sysFromStack = st => { const re = /game\.html:(\d+):\d+/g; let m; while ((m = re.exec(st || ''))) { return S.modOf(+m[1]) + ':' + m[1]; } return 'unknown'; };
  S.rec = (sys, kind, msg, st) => {
    msg = String(msg); const k = sys.replace(/:\d+$/, '') + '¦' + kind + '¦' + msg.replace(/\d+(\.\d+)?/g, '#').slice(0, 140);
    const e = S.errs[k] || (S.errs[k] = { sys, kind, msg: msg.slice(0, 300), st: String(st || '').split('\n').slice(0, 6).join(' | ').slice(0, 900), n: 0, day0: Env.dayN | 0, t0: Math.round(S.gt), mode: G.mode, cam: CamMgr.id, s0: Math.round(G.phys ? G.phys.s : 0) });
    e.n++;
  };
  S.bad = (name, detail, ex) => { const r = S.inv[name] || (S.inv[name] = { n: 0, by: {}, ex: [] }); r.n++; if (detail) r.by[detail] = (r.by[detail] || 0) + 1; if (ex && r.ex.length < 6) r.ex.push(Object.assign({ day: Env.dayN | 0, t: Math.round(S.gt), s: Math.round(G.phys.s) }, ex)); };
  S.evr = id => S.ev[id] || (S.ev[id] = { started: 0, soak: 0, game: 0, forced: 0, failed: 0, ended: 0, timeout: 0, doneCond: 0, silent: 0, errored: 0, leftovers: 0, limitLeft: 0, maxObjs: 0, dur: [], place: { checked: 0, track: 0, bed: 0, float: 0, buried: 0, minRail: [], ex: [] } });

  /* ---------- error hooks ---------- */
  const oe = console.error, ow = console.warn;
  console.error = function (...a) {
    try { const er = a.find(x => x && x.stack), msg = a.map(x => x && x.message ? x.message : String(x)).join(' '), m = /^event (tick|start)$/.exec(String(a[0]));
      S.rec(m ? 'Events/' + a[1] : S.sysFromStack(er ? er.stack : new Error().stack), 'console.error', msg, er ? er.stack : new Error().stack); } catch (e) { }
    return oe.apply(console, a);
  };
  console.warn = function (...a) { try { const msg = a.map(x => String(x)).join(' '); S.rec(/^THREE\./.test(msg) ? 'three.js' : S.sysFromStack(new Error().stack), 'console.warn', msg, new Error().stack); } catch (e) { } return ow.apply(console, a); };
  window.addEventListener('error', e => S.rec(S.sysFromStack(e.error && e.error.stack), 'window.error', e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => S.rec(S.sysFromStack(e.reason && e.reason.stack), 'promise', String(e.reason && e.reason.message || e.reason), e.reason && e.reason.stack));

  /* ---------- event lifecycle ---------- */
  const B = Events.begin, ST = Events.stop;
  Events.begin = function (def, c) {
    const E = B.call(this, def, c), r = S.evr(def.id);
    if (E) { r.started++; if (S.spawning) r.soak++; else r.game++; if (S.forcing) r.forced++; E.__t0 = S.gt; r.maxObjs = Math.max(r.maxObjs, E.objs.length); if (def.id === 'tree') try { S.placeCheck(E); } catch (e) { S.rec('soak', 'placeCheck', e.message, e.stack); } }
    else r.failed++;
    return E;
  };
  Events.stop = function (E, silent) {
    const r = S.evr(E.def.id);
    if (!silent && !E.__checked && E.objs.length && E.t >= 1 && E.t < 1e9) try { S.placeCheck(E); }   /* natural end only (a forced stop can catch rocks in flight) */ catch (e) { S.rec('soak', 'placeCheck', e.message, e.stack); }
    const objs = E.objs.slice(), temps = (E.temp || []).slice(), err = E.t >= 1e9, timeout = E.t > E.dur;
    ST.call(this, E, silent); r.ended++;
    if (err) r.errored++; else if (silent) r.silent++; else if (timeout) r.timeout++; else r.doneCond++;
    if (E.__t0 != null) r.dur.push(Math.round(S.gt - E.__t0));
    let left = 0; for (const o of objs) if (o.parent) left++; if (left) { r.leftovers += left; S.bad('event objects left in the scene after the event', E.def.id); }
    let tl = 0; for (const t of temps) if (Limits.temp.includes(t)) tl++; if (tl) { r.limitLeft += tl; S.bad('temporary speed limit left after the event', E.def.id); }
  };

  /* ---------- placement of event objects relative to the tracks ---------- */
  S.nearS = (x, z, hint) => {
    const p = {}; let best = hint, bd = 1e18; const d2 = ss => { Rail.pose(ss, p); const dx = x - p.x, dz = z - p.z; return dx * dx + dz * dz; };
    for (let k = -60; k <= 60; k++) { const ss = hint + k * 40, d = d2(ss); if (d < bd) { bd = d; best = ss; } }
    for (let st = 24; st >= .2; st /= 2) for (let k = -3; k <= 3; k++) { if (!k) continue; const ss = best + k * st, d = d2(ss); if (d < bd) { bd = d; best = ss; } }
    Rail.pose(best, p); const c = Math.cos(p.hd), sn = Math.sin(p.hd), along = (x - p.x) * sn + (z - p.z) * c;
    if (Math.abs(along) > 3) return null;   /* not a true perpendicular foot: skip the vertex rather than guess */
    return { s: best, u: -(x - p.x) * c + (z - p.z) * sn, ty: p.y };
  };
  S.placeCheck = E => {
    E.__checked = true; const r = S.evr(E.def.id), P = r.place, c = E.c || Events.ctxNow(G);
    let hint = E.data && isFinite(E.data.s0) ? E.data.s0 : E.data && E.data.z && isFinite(E.data.z.c) ? E.data.z.c : c.s + c.dir * 700; const v = new THREE.Vector3(), h0 = hint; let unres = 0;
    let n = 0, onT = 0, onB = 0, minRail = 1e9, minGround = 1e9, below = 0, worst = null;
    for (const o of E.objs) o.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes || !m.geometry.attributes.position) return;
      let vis = true; for (let q = m; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return;
      m.updateMatrixWorld(true); const pa = m.geometry.attributes.position, stp = Math.max(1, Math.floor(pa.count / 300));
      const mats = m.isInstancedMesh ? Array.from({ length: Math.min(m.count, 40) }, (_, i) => { const M = new THREE.Matrix4(); m.getMatrixAt(i, M); return M.premultiply(m.matrixWorld); }) : [m.matrixWorld];
      for (const M of mats) for (let i = 0; i < pa.count; i += stp) {
        v.fromBufferAttribute(pa, i).applyMatrix4(M); const q = S.nearS(v.x, v.z, hint); if (!q) { unres++; continue; } hint = q.s;
        if (Math.abs(q.u) > 400) continue; n++;
        if (v.y < q.ty + 4.5 && v.y > q.ty - 1.2) {   /* at track level (not in the sky, not buried far below) */
          const dr = Math.min(Math.abs(q.u - .72), Math.abs(q.u + .72), Math.abs(q.u + U2v - .72), Math.abs(q.u + U2v + .72));
          if (q.u > -U2v - 1.6 && q.u < 1.6) { onT++; if (!worst || dr < worst.dr) worst = { dr: +dr.toFixed(2), u: +q.u.toFixed(2), y: +(v.y - q.ty).toFixed(2), s: Math.round(q.s) }; }
          else if (q.u > -U2v - BEDWv && q.u < BEDWv) onB++;
          if (dr < minRail) minRail = dr;
        }
        if (E.def.cat === 'ground') { const gh = v.y - meshH(q.s, q.u); if (gh < minGround) minGround = gh; if (gh < -.6) below++; }
      }
    });
    if (!n) return; P.checked++; P.minRail.push(+minRail.toFixed(2));
    const ex = { day: Env.dayN | 0, s: Math.round(hint), side: E.data && E.data.side, vertsOnTrack: onT, vertsOnBed: onB, minDistToRail: +minRail.toFixed(2), worst };
    if (onT) { P.track++; if (P.ex.length < 8) P.ex.push(ex); S.bad('event object on the rails', E.def.id, ex); }
    else if (onB) { P.bed++; S.bad('event object on the track bed (ballast)', E.def.id, ex); }
    if (E.def.cat === 'ground' && E.def.id === 'tree') { if (minGround > 1.0) { P.float++; S.bad('fallen tree floats above the ground', 'tree', { s: Math.round(hint), minGround: +minGround.toFixed(2) }); } if (below > n * .5) { P.buried++; S.bad('fallen tree mostly under the ground', 'tree', { s: Math.round(hint) }); } }
  };

  /* ---------- spawning: every event cfg.per times; conditions first, a jump ahead (like the sandbox) after waiting ---------- */
  S.spawnTick = () => {
    if (S.gt < S.spawnT) return; S.spawnT = S.gt + S.cfg.spawnEvery;
    if (Events.active.length >= S.cfg.maxActive) return;
    const per = S.cfg.per, c = Events.ctxNow(G);
    const todo = S.defs().filter(d => S.evr(d.id).started < per && !Events.active.some(E => E.def.id === d.id)).sort((a, b) => S.evr(a.id).started - S.evr(b.id).started);
    if (!todo.length) return;
    for (const d of todo) { if (Events.incompat(d)) continue; let ok = false; try { ok = d.ok(c); } catch (e) { } if (ok) { S.spawning = true; Events.begin(d, c); S.spawning = false; S.wait[d.id] = 0; return; } S.wait[d.id] = (S.wait[d.id] || 0) + S.cfg.spawnEvery; }
    const d = todo.filter(d => !Events.incompat(d)).sort((a, b) => (S.wait[b.id] || 0) - (S.wait[a.id] || 0))[0];
    if (!d || (S.wait[d.id] || 0) < S.cfg.patience) return;
    const p = G.phys; let found = null;
    for (let k = 1; k <= 200 && found === null; k++) { const s = p.s + p.dir * k * 400, cc = Object.assign({}, c, { s, bio: Rail.bio(s) }); if (d.id === 'rocket') { const v = Spaceport.nearest(s); if (v) { const q = {}; ptAt(s, 0, q); v.dist = Math.hypot(v.x - q.x, v.z - q.z); } } let ok = false; try { ok = d.ok(cc); } catch (e) { } if (ok) found = s; }
    S.wait[d.id] = 0; S.spawning = true;
    if (found === null) { S.acts.nofit++; S.forcing = true; Events.begin(d, c); S.forcing = false; S.spawning = false; return; }
    p.s = found; WorldGen.flush(p.s - p.dir * G.train.length / 2, p.dir); Stations.reset(); Passengers.clear(); RailTraffic.reset(); G.bio = Rail.bio(p.s); S.acts.tele++; S.lastS = p.s; S.hold = 0;
    Events.begin(d, Events.ctxNow(G)); S.spawning = false;
  };

  S.defs = () => S.cfg.only ? EVDEFS.filter(d => S.cfg.only.includes(d.id)) : EVDEFS;
  /* ---------- driver: cruise, stop at some stations, actions at stops ---------- */
  S.drive = () => {
    const p = G.phys, cfg = S.cfg;
    if (S.hold > 0) { S.hold -= .05; G.cruise = false; G.thrT = 0; G.brkT = .6; if (S.hold <= 0) { G.brkT = 0; G.cruise = true; S.atStop(); } return; }
    const z = Stations.zone, d = Stations.info.dist;
    if (cfg.stopEvery && z && z.zi !== S.lastStopZ && z.zi % cfg.stopEvery === 0 && d > -70 && d < 4000) {
      if (d < -60) { S.lastStopZ = z.zi; G.cruise = true; G.cruiseV = cfg.v; G.brkT = 0; return; }
      if (p.v < .1 && Math.abs(d) < 60) { S.hold = 18 + Math.random() * 14; S.lastStopZ = z.zi; S.acts.stops++; return; }
      const vd = Math.sqrt(2 * .45 * Math.max(0, d - 3));
      if (d < 12 || p.v > vd + .8) { G.cruise = false; G.thrT = 0; G.brkT = d < 12 ? .85 : clamp((p.v - vd) * .3 + .25, .25, .9); }
      else { G.cruise = true; G.cruiseV = Math.max(1.5, Math.min(cfg.v, vd)); G.brkT = 0; }
    } else { G.cruise = true; G.cruiseV = cfg.v; }
  };
  S.atStop = () => {
    const r = Math.random();
    try {
      if (r < S.cfg.pReverse) { G.reverse(); S.acts.reverse++; }
      else if (r < S.cfg.pReverse + .08) { G.setCars(3 + Math.floor(Math.random() * 10)); S.acts.cars++; }
      else if (r < S.cfg.pReverse + .14) { G.setTrain(G.train.type === 'hs' ? 'classic' : 'hs'); S.acts.train++; }
    } catch (e) { S.rec(S.sysFromStack(e.stack), 'exception (stop action)', e.message, e.stack); }
  };
  S.camTick = () => {
    if (S.gt < S.nextCam) return; S.nextCam = S.gt + S.cfg.camEvery * (.6 + Math.random() * .8);
    const ids = S.cfg.cams, id = ids[S.camI++ % ids.length], i = CAMS.findIndex(c => c.id === id); if (i >= 0) { CamMgr.set(i); S.acts.cams++; }
  };
  S.dayTick = () => {
    const d = Env.dayN | 0; if (d === S.lastDay) return; S.lastDay = d;
    if (d % 3 === 0) { const k = WXKEYS[(d / 3) % WXKEYS.length]; Weather.lock = k; Weather.force(k); S.acts.wx++; } else if (d % 3 === 1) Weather.lock = SettingsManager.v.weather;
    if (S.cfg.langs && d > 0 && d % 20 === 0) { const L = ['uk'].concat(LORD), k = L[(d / 20) % L.length]; setLang(k); S.acts.lang++; }
    if (S.cfg.reloadEvery && d > 0 && d % S.cfg.reloadEvery === 0) S.needReload = true;
  };

  /* ---------- invariants ---------- */
  const fin = Number.isFinite;
  S.check = () => {
    const p = G.phys, cp = camera.position, q = camera.quaternion, lp = G.train.items[0].g.position;
    if (!fin(p.s) || !fin(p.v) || !fin(p.dist)) S.bad('train state is NaN', 'phys', { v: String(p.v) });
    if (!fin(lp.x) || !fin(lp.y) || !fin(lp.z)) S.bad('train position is NaN', 'train');
    if (!fin(cp.x) || !fin(cp.y) || !fin(cp.z) || !fin(q.x) || !fin(q.w)) S.bad('camera position/rotation is NaN', CamMgr.id);
    for (const k of ['clock', 'day', 'night', 'fogK', 'rain', 'snow', 'wind', 'tunnel']) if (Env[k] !== undefined && !fin(Env[k])) S.bad('environment value is NaN', k);
    if (Math.abs(p.v) > 160) S.bad('train speed unrealistic (> 576 km/h)', G.train.type, { v: p.v });
    if (S.f % 200 === 0) { const a = {}, b = {}; Rail.pose(p.s, a); Rail.pose(p.s + 50, b); const ch = Math.hypot(b.x - a.x, b.z - a.z); if (ch < 45 || Math.abs(a.hd) > 12) S.bad('track geometry broken (line winds into loops)', p.s < 0 ? 'behind the start' : 'ahead of the start', { chord50: +ch.toFixed(1), hd: +a.hd.toFixed(1) }); }
  };
  S.checkCam = () => {
    const id = CamMgr.id; if (['cab', 'walk', 'pass'].includes(id)) return; const cp = camera.position, p = G.phys, g = CamMgr.ground(cp.x, cp.z, id === 'rear' ? p.s - p.dir * (G.train.length + 11.5) : id === 'chase' || id === 'roof' ? p.s : p.s - p.dir * G.train.length * .45);
    if (g.tin > 0 || Math.abs(g.u) > 600) return; if (cp.y < g.h - .3) S.bad('camera below the ground', id, { dy: +(cp.y - g.h).toFixed(2), u: Math.round(g.u) });
  };
  S.sample = () => {
    const ps = Events.ps, alive = k => { const P = ps[k]; if (!P || !P.age) return 0; let a = 0; for (let i = 0; i < P.age.length; i++) if (P.age[i] < 1e8) a++; return a; };
    S.samp.push({ f: S.f, t: Math.round(S.gt), day: Env.dayN | 0, km: Math.round(S.km / 1000), s: Math.round(G.phys.s), ch: scene.children.length, chunks: WorldGen.chunks.size, ev: Events.active.length, lim: Limits.temp.length, ai: RailTraffic.list.length, veh: Traffic.veh.length, pax: Passengers.list.length, dom: document.getElementsByTagName('*').length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, smoke: alive('smoke'), fire: alive('fire') });
  };
  S.gpuSample = () => {
    try { S.renderAll(); } catch (e) { S.rec(S.sysFromStack(e.stack), 'exception (render)', e.message, e.stack); }
    if (window.gc) gc(); const m = renderer.info.memory;
    S.gpu.push({ f: S.f, day: Env.dayN | 0, geo: m.geometries, tex: m.textures, prog: renderer.info.programs ? renderer.info.programs.length : 0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, ch: scene.children.length });
  };

  /* ---------- setup and stepping ---------- */
  S.setup = (cfg, mods) => {
    S.cfg = cfg; S.mods = mods; S.renderAll = S.renderAll || renderAll; window.__raf = window.__raf || window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0; renderAll = function () { };
    Quality.auto = false; Quality.choose(cfg.q); SettingsManager.v.dayMin = cfg.dayMin; SettingsManager.v.fxEvents = true; G.freezeTime = false; if (cfg.only) Events.timer = 1e12;
    S.now = Math.max(S.now, performance.now() + 200); G.last = S.now; S.lastS = G.phys.s; S.spawnT = S.gt + 20; S.nextCam = S.gt + 10;
  };
  S.run = n => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      S.now += 50; S.f++; S.gt += .05;
      try { S.drive(); S.spawnTick(); S.camTick(); S.dayTick(); } catch (e) { S.rec(S.sysFromStack(e.stack), 'exception (harness action)', e.message, e.stack); }
      const a = performance.now();
      try { frame(S.now); S.consecExc = 0; } catch (e) { S.rec(S.sysFromStack(e.stack), 'exception (frame)', e.message, e.stack); if (++S.consecExc > 3000) { S.fatal = e.message; break; } }
      const dt = performance.now() - a; S.tFrames += dt; if (dt > 120 && S.slow.length < 400) S.slow.push({ ms: Math.round(dt), day: Env.dayN | 0, s: Math.round(G.phys.s), cam: CamMgr.id, ev: Events.active.map(E => E.def.id).join(',') });
      const ds = Math.abs(G.phys.s - S.lastS); if (ds < 60) S.km += ds; S.lastS = G.phys.s;
      if (S.f % 10 === 0) try { S.check(); } catch (e) { S.rec('soak', 'check', e.message, e.stack); }
      if (S.f % 20 === 0) try { S.checkCam(); } catch (e) { S.rec('soak', 'checkCam', e.message, e.stack); }
      if (S.f % 2000 === 0) S.sample();
      if (S.f % 12000 === 0) S.gpuSample();
      if (S.needReload) break;
    }
    const per = S.cfg.per, left = S.defs().filter(d => S.evr(d.id).started < per).length;
    return { f: S.f, day: Env.dayN | 0, gt: Math.round(S.gt), km: Math.round(S.km / 1000), ms: Math.round(performance.now() - t0), left, nerr: Object.values(S.errs).reduce((a, e) => a + e.n, 0), ninv: Object.values(S.inv).reduce((a, e) => a + e.n, 0), reload: !!S.needReload, fatal: S.fatal, act: Events.active.map(E => E.def.id).join(',') };
  };
  S.finish = () => {
    for (const E of Events.active) if (E.t > E.dur + 10) S.bad('event still running long after its duration', E.def.id, { t: Math.round(E.t), dur: E.dur });
    const before = scene.children.length; for (const E of Events.active.slice()) Events.stop(E, true);
    S.sample(); S.gpuSample();
    return { cfg: S.cfg, errs: S.errs, ev: S.ev, inv: S.inv, samp: S.samp, gpu: S.gpu, acts: S.acts, slow: S.slow.sort((a, b) => b.ms - a.ms).slice(0, 25), frames: S.f, gt: Math.round(S.gt), days: Env.dayN | 0, km: Math.round(S.km / 1000), msPerFrame: +(S.tFrames / Math.max(1, S.f)).toFixed(3), childrenBeforeStop: before, childrenAfter: scene.children.length, fatal: S.fatal };
  };
})();
