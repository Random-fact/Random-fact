#!/usr/bin/env python3
"""Build assets/index.html for the APK: the game page with three.js and the fonts inlined (works fully offline)
and a bridge that maps the Web Speech API onto Android TextToSpeech."""
import base64, json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, '..', 'endless-rails', 'index.html')
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'assets', 'index.html')
html = open(src, encoding='utf-8').read()
three = open(os.path.join(root, 'vendor', 'three.min.js'), encoding='utf-8').read()
assert '</script' not in three.lower()

# 1) fonts: @font-face rules with embedded woff2 instead of the Google Fonts stylesheet
faces = json.load(open(os.path.join(root, 'vendor', 'fonts', 'fonts.json')))
cache, rules = {}, []
for f in faces:
    if f['file'] not in cache:
        cache[f['file']] = base64.b64encode(open(os.path.join(root, 'vendor', 'fonts', f['file']), 'rb').read()).decode()
    rules.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (f['fam'], f['w'], cache[f['file']], f['ur']))
link_pre = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
link_css = html[html.index('<link rel="stylesheet" href="https://fonts.googleapis.com'):]
link_css = link_css[:link_css.index('>') + 1]
assert link_pre in html
html = html.replace(link_pre, '').replace(link_css, '<style>' + ''.join(rules) + '</style>')

# 2) three.js r128 inline
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
assert cdn in html
bridge = r"""<script>
/* Android app: Web Speech synthesis -> Android TextToSpeech (WebView has no speechSynthesis) */
window.IS_APK = true;
(function () {
  if (!window.AndroidTTS) return;
  var id = 0, cbs = {};
  window.__ttsDone = function (i) { var u = cbs[i]; delete cbs[i]; if (u && u.onend) { try { u.onend(); } catch (e) { } } };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = 'uk-UA'; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = null; };
  var S = {
    get speaking() { return AndroidTTS.speaking(); }, get pending() { return false; },
    speak: function (u) { var i = String(++id); cbs[i] = u; AndroidTTS.speak(String(u.text), +u.rate || 1, +u.pitch || 1, u.volume == null ? 1 : +u.volume, i); },
    cancel: function () { AndroidTTS.stop(); cbs = {}; },
    getVoices: function () { return AndroidTTS.hasUk() ? [{ lang: 'uk-UA', name: 'Android', default: true }] : []; }
  };
  try { Object.defineProperty(window, 'speechSynthesis', { value: S, configurable: true, writable: true }); } catch (e) { window.speechSynthesis = S; }
})();
</script>
"""
html = html.replace(cdn, bridge + '<script>' + three + '</script>')
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'w', encoding='utf-8').write(html)
print('asset written:', dst, len(html.encode('utf-8')), 'bytes')
