/* =====================================================================
   ENDLESS RAILS — trailer theme, procedural Web Audio version
   96 BPM · C minor · Cm9 – Abmaj7 – Ebmaj7 – Bb7sus (the "Horizon" progression)
   30-bar loop (75 s): intro → pulse → world → drive → dark → lift → outro → intro…
   No audio files: everything is synthesized with Web Audio nodes.

   Usage:
     const theme = new EndlessRailsTheme(audioCtx, { destination: someGainNode });
     theme.start();          // fades in, loops forever
     theme.stop(2);          // fades out over 2 s, cancels scheduled notes
     theme.setVolume(0.6);
   Options:
     destination  AudioNode   where the theme goes   (default ctx.destination)
     volume       number      output gain             (default 0.8)
     fx           boolean     trailer impacts/risers  (default false — calmer for gameplay)
     lookahead    seconds     scheduling window       (default 1.0)
   ===================================================================== */
const EndlessRailsTheme = (() => {
  const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4, LOOP = 30;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);

  const CH = {
    Cm9: [48, 55, 58, 62, 63], Abmaj7: [44, 51, 55, 60, 63], Ebmaj7: [51, 55, 58, 62, 67], Bb7sus: [46, 53, 56, 60, 62],
    Bb: [46, 53, 58, 62, 65], Fm9: [41, 48, 51, 55, 56], Gsus: [43, 50, 55, 60, 62], G: [43, 50, 55, 59, 62],
  };
  const LOOPP = ['Cm9', 'Abmaj7', 'Ebmaj7', 'Bb7sus'], DARK = ['Abmaj7', 'Fm9', 'Cm9', 'Gsus'], LIFT = ['Abmaj7', 'Bb', 'Cm9', 'Ebmaj7'];
  const prog = b =>
    b < 3 ? ['Cm9', 'Cm9', 'Abmaj7'][b] :
    b < 13 ? LOOPP[(b - 3) % 4] :
    b < 17 ? LOOPP[(b - 13) % 4] : b === 17 ? 'Bb7sus' :
    b < 22 ? DARK[(b - 18) % 4] : b === 22 ? 'G' :
    b < 27 ? LIFT[(b - 23) % 4] : b === 27 ? 'Bb' :
    b === 28 ? 'Abmaj7' : 'Bb7sus';
  const sec = b => b < 3 ? 'intro' : b < 8 ? 'ctrl' : b < 13 ? 'world' : b < 18 ? 'trains' : b < 23 ? 'events' : b < 28 ? 'climax' : 'fin';

  const MOTIF = [[0, 72], [1.5, 75], [2, 79], [3, 77]], MOTIF2 = [[0, 75], [1.5, 74], [2, 70], [3, 72]];
  const MEL_WORLD = { 8: [[0, 79], [1.5, 77], [2, 75], [3, 74]], 9: [[0, 75], [2, 72], [3, 70]], 10: [[0, 74], [1.5, 75], [2, 77], [3, 79]], 11: [[0, 77], [1.5, 74], [2, 70]], 12: [[0, 79], [2, 82], [3, 79]] };
  const MEL_CLIMAX = { 23: [[0, 84], [1, 82], [1.5, 79], [2, 82], [3, 84]], 24: [[0, 86], [1.5, 84], [2, 82]], 25: [[0, 87], [1, 86], [1.5, 84], [2, 82], [3, 79]], 26: [[0, 82], [2, 79], [3, 82]], 27: [[0, 84], [1.5, 82], [2, 86], [3, 89]] };
  const OST = [0, 2, 3, 1, 4, 2, 3, 1];
  const PAD_G = { ctrl: .055, world: .07, trains: .07, events: .075, climax: .085, fin: .07 };
  const STR_G = { world: .045, trains: .04, events: .05, climax: .07, fin: .045 };
  const PL_VEL = { ctrl: .8, world: .85, trains: .95, events: 1.0, climax: 1.05 };
  const PL_CUT = { ctrl: 1800, world: 2400, trains: 2800, events: 3000, climax: 3600 };
  // trailer FX: [kind, start bar, duration s, size]
  const FX = [['impact', 1.5, 0, .9], ['riser', 2, 2.5, .6], ['impact', 3, 0, .55], ['whoosh', 7.8, 1.0, .4], ['riser', 12, 2.5, .8], ['impact', 13, 0, 1.0],
              ['riser', 17.52, 1.2, .5], ['impact', 18, 0, .8], ['riser', 21, 5.0, 1.0], ['impact', 23, 0, 1.2], ['whoosh', 27.76, 1.2, .5]];

  return class EndlessRailsTheme {
    constructor(ctx, opts = {}) {
      this.ctx = ctx;
      this.opts = Object.assign({ destination: ctx.destination, volume: 0.8, fx: false, lookahead: 1.0 }, opts);
      this.playing = false; this.timer = null; this.n = 0; this.t0 = 0; this.live = new Set();
      this._build();
    }

    /* ---------------------------------------------------------- graph */
    _bq(type, f, q = Math.SQRT1_2) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    _curve(k) { const n = 2048, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(k * x); } return a; }
    _shaper(k) { const s = this.ctx.createWaveShaper(); s.curve = this.curves[k]; s.oversample = 'none'; return s; }
    _build() {
      const c = this.ctx;
      this.curves = { 1.2: this._curve(1.2), 1.3: this._curve(1.3), 1.4: this._curve(1.4) };
      // gaussian white noise, RMS 1
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
      this.noise = nb;
      // master
      this.out = c.createGain(); this.out.gain.value = 0;
      this.mix = c.createGain(); this.mix.gain.value = 0.62;
      const hp = this._bq('highpass', 28), comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .2;
      this.mix.connect(hp); hp.connect(comp); comp.connect(this.out); this.out.connect(this.opts.destination);
      // reverb
      this.verb = c.createConvolver(); this.verb.normalize = false; this.verb.buffer = this._ir(3.2, 2.6); this.verb.connect(this.mix);
      // vibrato LFOs for pads/strings (in cents)
      this.lfo = [4.6, 5.3].map(f => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = 4.3; o.connect(g); o.start(); return { o, g }; });
      // buses: chain → (delay) → dry + reverb send
      const bus = (gain, wet, chain, delay) => {
        const input = c.createGain(); let n = input;
        for (const f of chain) { n.connect(f); n = f; }
        if (delay) { const t = this._taps(...delay); n.connect(t.in); n = t.out; }
        const dry = c.createGain(); dry.gain.value = gain * (1 - wet * .3); n.connect(dry); dry.connect(this.mix);
        if (wet > 0) { const s = c.createGain(); s.gain.value = gain * wet; n.connect(s); s.connect(this.verb); }
        return input;
      };
      this.padLP = this._bq('lowpass', 2600);
      this.bus = {
        pad: bus(1.0, .35, [this.padLP]),
        str: bus(.9, .45, [this._bq('highpass', 250), this._bq('lowpass', 5200)]),
        pluck: bus(.8, .30, [], [BEAT * .75, .35, .35]),
        keys: bus(.9, .45, [], [BEAT * .75, .45, .6]),
        bass: bus(.9, 0, [this._bq('lowpass', 900)]),
        drums: bus(1.0, .15, []),
        fx: bus(.9, .35, []),
      };
      // shared per-instrument processing (filters / saturation are applied once per instrument, not per note)
      const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[0]; };
      this.pluckLP = this._bq('lowpass', 2600); this.pluckLP.connect(this.bus.pluck);
      this.kickIn = chain(this._shaper(1.4), this._gain(.42), this.bus.drums);
      this.tomIn = chain(this._shaper(1.2), this._gain(.32), this.bus.drums);
      this.tomNoise = chain(this._bq('lowpass', 900), this.tomIn);
      this.snareOut = chain(this._gain(.26), this._pan(.05), this.bus.drums);
      this.snareNoise = chain(this._bq('highpass', 1200), this._bq('lowpass', 8000), this.snareOut);
      this.hatIn = chain(this._bq('highpass', 7000), this._pan(.3), this.bus.drums);
      this.bassIn = chain(this._shaper(1.3), this._gain(.16), this.bus.bass);
    }
    _ir(len, decay) {
      const c = this.ctx, n = Math.floor(len * c.sampleRate), b = c.createBuffer(2, n, c.sampleRate), tau = decay / 6.9, fade = Math.floor(.012 * c.sampleRate);
      const a = Math.exp(-2 * Math.PI * 6000 / c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); let y = 0, e = 0;
        for (let i = 0; i < n; i++) {
          const g = Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
          y = (1 - a) * g * Math.exp(-i / c.sampleRate / tau) + a * y;
          d[i] = i < fade ? y * i / fade : y; e += d[i] * d[i];
        }
        const k = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= k;
      }
      return b;
    }
    // multi-tap ping-pong delay: out = in + Σ in(t-k·dt)·fb^k·mix, alternating L/R weights
    _taps(dt, fb, mix) {
      const c = this.ctx, inp = c.createGain(), out = c.createGain(); inp.connect(out);
      for (let k = 1; k <= 5; k++) {
        const dl = c.createDelay(dt * 5 + .1); dl.delayTime.value = dt * k;
        const sp = c.createChannelSplitter(2), mg = c.createChannelMerger(2), gl = c.createGain(), gr = c.createGain(), w = Math.pow(fb, k) * mix;
        gl.gain.value = w * (k % 2 ? 1 : .6); gr.gain.value = w * (k % 2 ? .6 : 1);
        inp.connect(dl); dl.connect(sp); sp.connect(gl, 0); sp.connect(gr, 1); gl.connect(mg, 0, 0); gr.connect(mg, 0, 1); mg.connect(out);
      }
      return { in: inp, out };
    }

    /* ---------------------------------------------------------- voice helpers */
    _src(node, t0, t1) { node.start(t0); node.stop(t1); this.live.add(node); node.onended = () => { this.live.delete(node); try { node.disconnect(); } catch (e) { } }; return node; }
    _osc(type, f, t0, t1) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return this._src(o, t0, t1); }
    _noise(t0, t1) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t0, Math.random() * 1.5); s.stop(t1); this.live.add(s); s.onended = () => { this.live.delete(s); try { s.disconnect(); } catch (e) { } }; return s; }
    _gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
    _pan(p) { const s = this.ctx.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); return s; }
    _dec(param, t0, peak, tau, att = 0) { param.setValueAtTime(0, t0); if (att > 0) param.linearRampToValueAtTime(peak, t0 + att); else param.setValueAtTime(peak, t0); param.setTargetAtTime(0, t0 + att, tau); }
    _adsr(param, t0, a, d, s, r, n, peak) {
      param.setValueAtTime(0, t0); param.linearRampToValueAtTime(peak, t0 + a); param.linearRampToValueAtTime(peak * s, t0 + a + d);
      param.setValueAtTime(peak * s, t0 + n - r); param.setTargetAtTime(0, t0 + n - r, r / 4);
    }

    _padChord(dest, t0, dur, notes, gain, att = 1.2, rel = 1.6) {
      const n = dur + rel, per = gain / Math.sqrt(notes.length);
      notes.forEach((m, j) => {
        [[-9, -.6], [0, 0], [10, .6]].forEach(([cents, pan], v) => {
          const o = this._osc('sawtooth', mf(m), t0, t0 + n + .05);
          o.detune.value = cents;
          if (v === 1) { const lfo = this.lfo[j % 2].g; lfo.connect(o.detune); const prev = o.onended; o.onended = () => { try { lfo.disconnect(o.detune); } catch (e) { } prev(); }; }
          const g = this._gain(); this._adsr(g.gain, t0, att, .5, .85, rel, n, per);
          const p = this._pan(pan * (.4 + .15 * j)); o.connect(g); g.connect(p); p.connect(dest);
        });
      });
    }
    _pluck(t0, m, vel = 1, dec = .22, pan = 0) {
      const f = mf(m), t1 = t0 + dec * 7, a = this._osc('sawtooth', f, t0, t1), b = this._osc('sine', f, t0, t1);
      const ga = this._gain(.6), gb = this._gain(.4), env = this._gain(), p = this._pan(pan);
      a.connect(ga); b.connect(gb); ga.connect(env); gb.connect(env); env.connect(p); p.connect(this.pluckLP);
      this._dec(env.gain, t0, .11 * vel, dec);
    }
    _bell(t0, m, vel = 1, dec = 1.6, pan = 0) {
      const f = mf(m), p = this._pan(pan), parts = [[1, 1, dec], [2, .45, dec / 3], [3.01, .18, dec * .3 / 1.3], [4.2, .06, 1 / (1 / dec + 1 / .15)]];
      p.connect(this.bus.keys);
      for (const [h, amp, tau] of parts) { const o = this._osc('sine', f * h, t0, t0 + tau * 7 + .05), g = this._gain(); o.connect(g); g.connect(p); this._dec(g.gain, t0, .085 * vel * amp, tau, .003); }
    }
    _bass(t0, m, dur, vel = 1) {
      const f = mf(m), n = dur + .1, t1 = t0 + n + .05;
      const a = this._osc('sine', f, t0, t1), b = this._osc('sine', f * 2, t0, t1), s = this._osc('sawtooth', f, t0, t1);
      const gb = this._gain(.25), gs = this._gain(.05), env = this._gain();
      a.connect(env); b.connect(gb); gb.connect(env); s.connect(gs); gs.connect(env); env.connect(this.bassIn);
      this._adsr(env.gain, t0, .01, .2, .8, .12, n, vel);
    }
    _kick(t0, vel = 1) {
      const o = this._osc('sine', 156, t0, t0 + .7); o.frequency.setValueAtTime(156, t0); o.frequency.setTargetAtTime(46, t0, .035);
      const amp = this._gain(), cl = this._noise(t0, t0 + .05), cg = this._gain();
      this._dec(amp.gain, t0, vel, .32); this._dec(cg.gain, t0, .3 * vel, .004);
      o.connect(amp); amp.connect(this.kickIn); cl.connect(cg); cg.connect(this.kickIn);
    }
    _tom(t0, vel = 1, base = 70, pan = 0) {
      const o = this._osc('sine', base * 2.3, t0, t0 + 1.2); o.frequency.setValueAtTime(base * 2.3, t0); o.frequency.setTargetAtTime(base, t0, .05);
      const amp = this._gain(), nz = this._noise(t0, t0 + .4), ng = this._gain(), p1 = this._pan(pan), p2 = this._pan(pan);
      this._dec(amp.gain, t0, vel, .45); this._dec(ng.gain, t0, .6 * vel, .06);
      o.connect(amp); amp.connect(p1); p1.connect(this.tomIn); nz.connect(ng); ng.connect(p2); p2.connect(this.tomNoise);
    }
    _snare(t0, vel = 1) {
      const nz = this._noise(t0, t0 + .5), ng = this._gain(), o = this._osc('sine', 190, t0, t0 + .4), og = this._gain();
      this._dec(ng.gain, t0, .9 * vel, .13); this._dec(og.gain, t0, .5 * vel, .06);
      nz.connect(ng); ng.connect(this.snareNoise); o.connect(og); og.connect(this.snareOut);
    }
    _hat(t0, vel = 1, open = false) {
      const tau = open ? .09 : .025, nz = this._noise(t0, t0 + tau * 7), g = this._gain();
      this._dec(g.gain, t0, .11 * vel, tau); nz.connect(g); g.connect(this.hatIn);
    }
    _impact(t0, size = 1) {
      const o = this._osc('sine', 108, t0, t0 + 4.5); o.frequency.setValueAtTime(108, t0); o.frequency.setTargetAtTime(38, t0, .07);
      const amp = this._gain(), nz = this._noise(t0, t0 + 1.6), lp = this._bq('lowpass', 2500), ng = this._gain(), sh = this._shaper(1.3), out = this._gain(.5 * size);
      this._dec(amp.gain, t0, .9, 1.1 * size); this._dec(ng.gain, t0, .5, .25);
      o.connect(amp); amp.connect(sh); nz.connect(lp); lp.connect(ng); ng.connect(sh); sh.connect(out); out.connect(this.bus.fx);
    }
    _riser(ts, dur, gain = 1) {
      const N = 64, env = new Float32Array(N), env3 = new Float32Array(N), fr = new Float32Array(N);
      for (let i = 0; i < N; i++) { const x = i / (N - 1); env[i] = Math.pow(x, 2.2) * .5 * gain; env3[i] = Math.pow(x, 3) * .12 * gain; fr[i] = 200 + 900 * x * x; }
      [-.5, .5].forEach(pp => {
        const nz = this._noise(ts, ts + dur + .05), lp = this._bq('lowpass', 300), g = this._gain(), p = this._pan(pp);
        lp.frequency.setValueAtTime(300, ts); lp.frequency.exponentialRampToValueAtTime(9000, ts + dur);
        g.gain.setValueCurveAtTime(env, ts, dur); nz.connect(lp); lp.connect(g); g.connect(p); p.connect(this.bus.fx);
      });
      const o = this._osc('sine', 200, ts, ts + dur + .05), og = this._gain();
      o.frequency.setValueCurveAtTime(fr, ts, dur); og.gain.setValueCurveAtTime(env3, ts, dur); o.connect(og); og.connect(this.bus.fx);
    }
    _whoosh(ts, dur, gain = .6) {
      const N = 64, env = new Float32Array(N);
      for (let i = 0; i < N; i++) env[i] = Math.pow(Math.sin(Math.PI * i / (N - 1)), 2) * gain * .9;
      const nz = this._noise(ts, ts + dur + .05), hp = this._bq('highpass', 400), lp = this._bq('lowpass', 5000), g = this._gain(), p = this._pan(-1);
      p.pan.setValueAtTime(-1, ts); p.pan.linearRampToValueAtTime(1, ts + dur); g.gain.setValueCurveAtTime(env, ts, dur);
      nz.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p); p.connect(this.bus.fx);
    }

    /* ---------------------------------------------------------- arrangement */
    _scheduleBar(n, t0) {
      const b = n % LOOP, s = sec(b), nm = prog(b), ch = CH[nm], T = beat => t0 + beat * BEAT;
      // pads & strings
      if (s === 'intro') {
        this._padChord(this.bus.pad, t0, BAR, ch, .05 + .02 * b, b === 0 ? 2.2 : 1.0);
        if (b === 0) { const f = this.padLP.frequency; f.cancelScheduledValues(t0); f.setValueAtTime(500, t0); f.exponentialRampToValueAtTime(2600, t0 + 3 * BAR); }
      } else {
        this._padChord(this.bus.pad, t0, BAR, ch, PAD_G[s]);
        if (STR_G[s]) this._padChord(this.bus.str, t0, BAR, [ch[2] + 12, ch[3] + 12, ch[4] + 12], STR_G[s], .9);
      }
      // pluck ostinato
      if (b >= 3 && s !== 'fin') {
        const notes = ch.slice(1).sort((x, y) => x - y).concat([ch[1] + 12]), vel = PL_VEL[s];
        this.pluckLP.frequency.setValueAtTime(b === 3 ? 1200 : PL_CUT[s], t0);
        for (let k = 0; k < 8; k++) {
          if (b === 3 && k < 4) continue;
          const m = notes[OST[k] % notes.length] + 12;
          this._pluck(T(k * .5), m, vel * (k % 2 ? .75 : 1), .22, k % 2 ? -.35 : .35);
          if (s === 'events' || s === 'climax') this._pluck(T(k * .5 + .25), m + 12, vel * .35, .12, k % 2 ? .5 : -.5);
        }
      }
      // keys: motif / melodies
      if (b < 3) for (const [bt, m] of (b === 1 ? MOTIF2 : MOTIF)) this._bell(T(bt), m, b ? .8 : .65, 1.6, .2);
      if (MEL_WORLD[b]) for (const [bt, m] of MEL_WORLD[b]) this._bell(T(bt), m, .75, 1.6, -.15);
      if (MEL_CLIMAX[b]) for (const [bt, m] of MEL_CLIMAX[b]) { this._bell(T(bt), m, .9, 1.6, -.1); this._bell(T(bt), m - 12, .45, 1.6, .25); }
      if (b === 28 || b === 29) for (const [bt, m] of (b === 28 ? MOTIF : MOTIF2)) this._bell(T(bt), m, .75, 2.2, .2);
      // bass
      if (b >= 3) {
        const r = ch[0] - 12;
        if (s === 'fin') this._bass(t0, r, BAR, .7);
        else if (s === 'ctrl') for (const k of [0, 2, 3.5]) this._bass(T(k), r, BEAT * (k < 3 ? 1.4 : .45), b > 3 ? .8 : .5);
        else for (let k = 0; k < 8; k++) this._bass(T(k * .5), r + ((k === 3 || k === 7) && (s === 'climax' || s === 'trains') ? 12 : 0), BEAT * .45, k % 2 ? .7 : 1.0);
      }
      // drums
      if (s === 'ctrl') {
        if (b >= 4) { this._kick(T(0), .7); this._kick(T(2.5), .45); }
        if (b >= 5) for (let k = 0; k < 8; k++) this._hat(T(k * .5), k % 2 ? .5 : .3);
        if (b === 7) for (let k = 0; k < 4; k++) this._tom(T(3 + k * .25), .4 + .15 * k, 90, -.3 + .2 * k);
      } else if (s === 'world') {
        this._kick(T(0), .8); this._kick(T(2.5), .55); this._snare(T(1), .35); this._snare(T(3), .45);
        for (let k = 0; k < 16; k++) this._hat(T(k * .25), k % 4 === 2 ? .55 : .28);
      } else if (s === 'trains') {
        for (let k = 0; k < 4; k++) this._kick(T(k), .85);
        this._snare(T(1), .7); this._snare(T(3), .8);
        for (let k = 0; k < 8; k++) this._hat(k % 2 === 0 ? T(k * .5 + .5) : T(k * .5), .5, k % 2 === 0);
        this._tom(T(0), .5, 62);
        if (b === 17) for (let k = 0; k < 16; k++) this._snare(T(2 + k * .125), .3 + .05 * k);
      } else if (s === 'events') {
        for (const k of [0, 1.5, 2.5]) this._tom(T(k), .75, 58, -.2);
        this._kick(T(0), .9); this._kick(T(2), .7); this._snare(T(3), .7);
        for (let k = 0; k < 16; k++) this._hat(T(k * .25), k % 2 ? .45 : .2);
        if (b === 22) {
          for (let k = 0; k < 32; k++) this._snare(T(k * .125), .2 + .04 * k);
          for (let k = 0; k < 8; k++) this._tom(T(k * .5), .6 + .05 * k, 52, (k % 2 ? -1 : 1) * .3);
        }
      } else if (s === 'climax') {
        for (let k = 0; k < 4; k++) this._kick(T(k), 1.0);
        this._snare(T(1), .85); this._snare(T(3), .9); this._tom(T(0), .7, 55); this._tom(T(2.5), .5, 70, .3);
        for (let k = 0; k < 16; k++) this._hat(T(k * .25), k % 2 ? .6 : .3, k % 4 === 2);
        if (b === 27) for (let k = 0; k < 8; k++) this._tom(T(2 + k * .25), .5 + .1 * k, 60 + 6 * k, (k % 2 ? -1 : 1) * .3);
      }
      // optional trailer FX
      if (this.opts.fx) for (const [kind, sb, dur, size] of FX) {
        if (sb < b || sb >= b + 1) continue;
        const ts = t0 + (sb - b) * BAR;
        if (kind === 'impact') this._impact(ts, size); else if (kind === 'riser') this._riser(ts, dur, size); else this._whoosh(ts, dur, size);
      }
    }

    /* ---------------------------------------------------------- transport */
    scheduleUntil(t) { while (this.t0 + this.n * BAR < t) { this._scheduleBar(this.n, this.t0 + this.n * BAR); this.n++; } }
    start(when) {
      if (this.playing) return;
      const c = this.ctx, t = Math.max(c.currentTime + .05, when || 0);
      this.playing = true; this.n = 0; this.t0 = t;
      const g = this.out.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(this.opts.volume, t + 1.5);
      this.scheduleUntil(t + this.opts.lookahead);
      if (typeof setInterval === 'function' && !(c instanceof (window.OfflineAudioContext || function () { }))) {
        this.timer = setInterval(() => this.scheduleUntil(c.currentTime + this.opts.lookahead), 100);
      }
    }
    stop(fade = 2) {
      if (!this.playing) return;
      const c = this.ctx, t = c.currentTime, g = this.out.gain;
      this.playing = false; clearInterval(this.timer); this.timer = null;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
      const end = t + fade + .05;
      for (const s of this.live) { try { s.stop(end); } catch (e) { } }
    }
    setVolume(v, ramp = .3) { this.opts.volume = v; if (!this.playing) return; const t = this.ctx.currentTime, g = this.out.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + ramp); }
    dispose() { this.stop(0.05); setTimeout(() => { for (const l of this.lfo) { try { l.o.stop(); } catch (e) { } } try { this.out.disconnect(); } catch (e) { } }, 200); }
  };
})();
