package com.endlessrails.game;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Locale;

/** Endless Rails: the HTML game in a full-screen WebView, with Android TextToSpeech for station announcements. */
public class MainActivity extends Activity {
    private WebView web;
    private Speech speech;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        /* draw under the display cutout (API 28+), set by reflection because we compile against API 23 */
        try {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
            getWindow().setAttributes(lp);
        } catch (Exception ignored) { }

        web = new WebView(this);
        web.setBackgroundColor(0xff0b1017);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                if (u != null && !"endless-rails.app".equals(u.getHost())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }
        });
        speech = new Speech();
        web.addJavascriptInterface(speech, "AndroidTTS");
        /* the page is self-contained (three.js and fonts inlined); a fixed https origin keeps localStorage saves between launches */
        web.loadDataWithBaseURL("https://endless-rails.app/", readAsset("index.html"), "text/html", "utf-8", null);
        hideSystemUi();
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(1 << 21);
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) {
            return "<h1 style='color:#fff;background:#0b1017;font-family:sans-serif'>Endless Rails: " + e + "</h1>";
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        /* save the journey and silence the game while the app is in the background */
        web.evaluateJavascript("try{G.save();if(Sound.ctx)Sound.ctx.suspend();}catch(e){}", null);
        speech.stop();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("try{if(Sound.ctx&&G.running)Sound.ctx.resume();}catch(e){}", null);
        hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        /* Back opens / closes the settings (pause) while driving; on the start screen it leaves the app */
        web.evaluateJavascript("(function(){try{if(typeof G!=='undefined'&&G.running){var s=document.getElementById('settings');"
                + "if(s.classList.contains('open'))UI.act('closeset');else UI.act('settings');return 'menu';}}catch(e){}return 'exit';})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        if (v == null || v.contains("exit")) finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        speech.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /** Bridge used by the page's speechSynthesis polyfill. Ukrainian voice only: without it the game shows the text banners. */
    private class Speech implements TextToSpeech.OnInitListener {
        private final TextToSpeech tts;
        private volatile boolean ready, uk;

        Speech() {
            tts = new TextToSpeech(MainActivity.this, this);
        }

        @Override
        public void onInit(int status) {
            if (status != TextToSpeech.SUCCESS) return;
            Locale ukLoc = new Locale("uk", "UA");
            int r = tts.isLanguageAvailable(ukLoc);
            if (r >= TextToSpeech.LANG_AVAILABLE) { tts.setLanguage(ukLoc); uk = true; }
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { done(id); }
                @Override public void onError(String id) { done(id); }
            });
            ready = true;
            if (!uk) runOnUiThread(new Runnable() {
                @Override public void run() {
                    Toast.makeText(MainActivity.this, "Для голосових оголошень встановіть український голос у налаштуваннях синтезу мовлення", Toast.LENGTH_LONG).show();
                }
            });
        }

        private void done(final String id) {
            runOnUiThread(new Runnable() {
                @Override public void run() { web.evaluateJavascript("window.__ttsDone&&__ttsDone('" + id.replaceAll("[^0-9]", "") + "')", null); }
            });
        }

        @JavascriptInterface
        public void speak(String text, float rate, float pitch, float volume, String id) {
            if (!ready || !uk) { done(id); return; }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle b = new Bundle();
            b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
            tts.speak(text, TextToSpeech.QUEUE_ADD, b, id);
        }

        @JavascriptInterface
        public void stop() { if (ready) tts.stop(); }

        @JavascriptInterface
        public boolean speaking() { return ready && tts.isSpeaking(); }

        @JavascriptInterface
        public boolean hasUk() { return uk; }

        void shutdown() { try { tts.shutdown(); } catch (Exception ignored) { } }
    }
}
