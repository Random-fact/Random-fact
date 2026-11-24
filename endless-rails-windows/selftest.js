// Self-test run by `EndlessRails.exe --selftest` (CI only): walks the menu into a journey
// and reports what it sees back to the host, which writes it to log.txt.
(function () {
  var post = function (m) { try { window.chrome.webview.postMessage('er:log:' + m); } catch (e) { console.log('er:log:' + m); } };
  var find = function (label) {
    var best = null;
    document.querySelectorAll('button, [role=button], a, .btn, li, div').forEach(function (e) {
      if (!e.offsetParent) return;
      var t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.indexOf(label) === -1 || t.length > label.length + 6) return;
      if (!best || best.contains(e)) best = e; // the innermost matching element
    });
    return best;
  };
  var click = function (label) { var e = find(label); if (e) { e.click(); return true; } return false; };
  var info = function () {
    var c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    var d = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return JSON.stringify({ origin: location.origin, size: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, webgl: !!gl,
      renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, three: typeof THREE !== 'undefined' ? THREE.REVISION : null,
      keys: Object.keys(localStorage), canvases: document.querySelectorAll('canvas').length });
  };
  var visible = function () {
    return JSON.stringify([].slice.call(document.querySelectorAll('button')).filter(function (b) { return b.offsetParent; })
      .map(function (b) { return b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40); }).filter(Boolean).slice(0, 30));
  };
  var report = function () {
    post('buttons ' + visible());
    var f = 0, t0 = performance.now();
    (function loop() {
      f++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(loop);
      else post('state ' + JSON.stringify({ running: typeof G !== 'undefined' && !!G.running, mode: typeof G !== 'undefined' ? G.mode : null,
        km: typeof G !== 'undefined' && G.phys ? Math.round((G.phys.dist || 0) / 10) / 100 : null,
        fps: Math.round(f / 3), errors: window.__erErrors || [] }));
    })();
  };

  post('info ' + info());
  post('buttons ' + visible());
  if (find('Continue journey')) {
    // a saved journey from an earlier launch: resume it
    post('click Continue journey ' + click('Continue journey'));
    setTimeout(report, 12000);
    return;
  }
  post('click Continue ' + click('Continue')); // first launch: confirm the language
  setTimeout(function () {
    post('click New journey ' + click('New journey'));
    setTimeout(function () {
      post('click Depart ' + click('Depart'));
      setTimeout(report, 12000);
    }, 3000);
  }, 2000);
})();
