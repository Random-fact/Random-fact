/* The four older generative tracks of Endless Rails (Ambient Drift, Lo-fi Station, Midnight Synth, Horizon), exactly as the
   game generated them before the music moved to prepared files. Only used by render.html to write the music files.
   Math.random is replaced by a seeded generator so the files can be reproduced. */
const LCH = { mn7: [0, 3, 7, 10], mj7: [0, 4, 7, 11], dom: [0, 4, 7, 10], mn9: [0, 3, 7, 10, 14], sus: [0, 5, 7, 10] };
const PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
const LTRACKS = {
  drift: { name: 'Ambient Drift', bpm: 54, root: 57, prog: [[0, 'mn9'], [-4, 'mj7'], [3, 'mj7'], [-2, 'sus']], lp: 1100 },
  lofi: { name: 'Lo-fi Station', bpm: 74, root: 50, prog: [[0, 'mn7'], [5, 'mn7'], [-2, 'dom'], [-4, 'mj7']], lp: 1400 },
  night: { name: 'Midnight Synth', bpm: 88, root: 52, prog: [[0, 'mn7'], [-4, 'mj7'], [3, 'mj7'], [-2, 'dom']], lp: 1700 },
  cine: { name: 'Horizon', bpm: 58, root: 48, prog: [[0, 'mn7'], [-4, 'mj7'], [3, 'mj7'], [-2, 'dom']], lp: 1900 },
};
const lmf = m => 440 * Math.pow(2, (m - 69) / 12);
const Legacy = {
  ctx: null, white: null,
  osc(type, f, t0, dur, g, a, dest, lpf) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f; const gn = c.createGain(); gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(g, t0 + a); gn.gain.setTargetAtTime(0, t0 + dur * .7, dur * .18);
    let n = o; if (lpf) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lpf; o.connect(fl); n = fl; } n.connect(gn); gn.connect(dest); o.start(t0); o.stop(t0 + dur * 1.6 + .3);
  },
  pluck(f, t0, g, dest, dec, type) {
    const c = this.ctx, o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = f; const gn = c.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.0003, t0 + dec); o.connect(gn); gn.connect(dest); o.start(t0); o.stop(t0 + dec + .1);
  },
  noise(t0, dur, f, g, dest) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.white; const fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = f; const gn = c.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.0003, t0 + dur); s.connect(fl); fl.connect(gn); gn.connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  },
  bar(t, t0) {
    const d = t.def, id = t.id, ch = d.prog[t.bar % d.prog.length], notes = LCH[ch[1]].map(i => d.root + ch[0] + i), beat = 60 / d.bpm, barLen = beat * 4, bus = t.bus, r = Math.random;
    for (const n of notes) { const f = lmf(n + (id === 'cine' ? 0 : 0)); this.osc('triangle', f, t0, barLen * 1.05, id === 'night' ? .022 : .03, barLen * .4, bus, d.lp); this.osc('sawtooth', f * 1.004, t0, barLen * 1.05, .01, barLen * .45, bus, d.lp * .6); }
    if (id !== 'drift') this.osc('sine', lmf(d.root + ch[0] - 12), t0, beat * 3, .09, .05, bus);
    if (id === 'drift') { for (let i = 0; i < 3; i++) if (r() < .75) this.pluck(lmf(d.root + 12 + PENT[Math.floor(r() * PENT.length)]), t0 + beat * (i * 1.3 + r()), .05, bus, 3.2, 'sine'); }
    if (id === 'lofi') {
      for (let b = 0; b < 4; b++) { const tb = t0 + b * beat; if (b % 2 === 0) this.pluck(60, tb, .22, bus, .35); else this.noise(tb, .12, 1800, .05, bus); this.noise(tb + beat * .5 + beat * .08, .04, 7000, .03, bus); if (b === 0 || b === 2) for (const n of notes) this.pluck(lmf(n + 12), tb + (r() < .5 ? 0 : beat * .66), .018, bus, 1.1, 'triangle'); if (r() < .45) this.pluck(lmf(d.root + 12 + PENT[Math.floor(r() * 7)]), tb + beat * .5, .04, bus, 1.4, 'sine'); }
      if (r() < .9) this.noise(t0, barLen, 3000, .006, bus);
    }
    if (id === 'night') { for (let i = 0; i < 16; i++) { const n = notes[(i * 3 + (i >> 2)) % notes.length] + (i % 8 > 3 ? 12 : 0) + 12; this.pluck(lmf(n), t0 + i * beat / 4, .035 + (i % 4 === 0 ? .02 : 0), bus, .5, 'sawtooth'); } for (let b = 0; b < 4; b += 2) this.pluck(55, t0 + b * beat, .2, bus, .4); }
    if (id === 'cine') { this.osc('sine', lmf(d.root - 12 + ch[0]), t0, barLen * 1.2, .08, barLen * .6, bus); if (r() < .7) this.pluck(lmf(d.root + 12 + PENT[Math.floor(r() * PENT.length)]), t0 + beat * (1 + r() * 2), .06, bus, 4, 'sine'); if (t.bar % 4 === 3) for (const n of notes) this.osc('sawtooth', lmf(n + 12), t0, barLen * 1.3, .012, barLen * .9, bus, 1600); }
  }
};
