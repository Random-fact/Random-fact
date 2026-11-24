package com.endlessrails.game;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.AssetManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.InputStream;
import java.util.Locale;

/**
 * ENDLESS RAILS: the HTML5 / WebGL game (assets/index.html, fully offline) in a full-screen WebView.
 * Native services offered to the page:
 *   AndroidApp  - vibration, app version, language hint
 *   AndroidTTS  - station announcements through Android TextToSpeech in the game's language
 *   AndroidAds  - voluntary rewarded video (AdMob + UMP consent); only in the Play build (see AdsBridge)
 * The page is served from https://appassets.androidplatform.net (the domain reserved for this purpose), so it runs in a
 * secure context and keeps its localStorage (journey, settings, unlocks) between launches.
 * Uses framework APIs only, so the same file also builds without Gradle (testbuild/build-apk.sh).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String URL = "https://" + HOST + "/assets/index.html";

    private WebView web;
    private Tts tts;
    private Object ads;            // AdsBridge (null in builds without the ad SDK)
    private Object backCallback;   // OnBackInvokedCallback on Android 13+
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        tts = new Tts();
        ads = AdsBridge.create(this, null);   // once per activity (a rebuilt WebView reuses it)
        createWebView();
        registerBack();
        hideSystemUi();
    }

    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(0xff0b1017);
        setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new Client());
        web.addJavascriptInterface(new App(), "AndroidApp");
        web.addJavascriptInterface(tts, "AndroidTTS");
        if (ads != null) web.addJavascriptInterface(ads, "AndroidAds");
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets in) { pushInsets(in); return in; }
        });
        web.loadUrl(URL);
    }

    /** Serves the bundled game from assets; every other host opens in the browser (the game itself makes no requests). */
    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String p = u.getPath();
            if (p == null || !p.startsWith("/assets/")) return notFound();
            String name = p.substring(8);
            if (name.contains("..")) return notFound();
            try {
                InputStream in = getAssets().open(name, AssetManager.ACCESS_STREAMING);
                String mime = name.endsWith(".html") ? "text/html" : name.endsWith(".js") ? "application/javascript" : name.endsWith(".json") ? "application/json" : "application/octet-stream";
                return new WebResourceResponse(mime, "utf-8", in);
            } catch (Exception e) { return notFound(); }
        }

        private WebResourceResponse notFound() { return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null); }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) { web.requestApplyInsets(); }

        /* the WebView renderer can be killed by the system under memory pressure: rebuild it instead of crashing the app */
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (view != web) return true;
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.destroy();
            web = null;
            ui.post(new Runnable() { @Override public void run() { createWebView(); hideSystemUi(); } });
            return true;
        }
    }

    /** Safe-area insets (display cutout, visible system bars) as CSS pixels: the page reads --ins-t/r/b/l. */
    private void pushInsets(WindowInsets in) {
        if (web == null) return;
        float d = getResources().getDisplayMetrics().density;
        int t, r, b, l;
        if (Build.VERSION.SDK_INT >= 30) {
            Insets i = in.getInsets(WindowInsets.Type.displayCutout() | WindowInsets.Type.systemBars());
            t = i.top; r = i.right; b = i.bottom; l = i.left;
        } else {
            t = in.getSystemWindowInsetTop(); r = in.getSystemWindowInsetRight(); b = in.getSystemWindowInsetBottom(); l = in.getSystemWindowInsetLeft();
            if (Build.VERSION.SDK_INT >= 28 && in.getDisplayCutout() != null) {
                t = Math.max(t, in.getDisplayCutout().getSafeInsetTop()); b = Math.max(b, in.getDisplayCutout().getSafeInsetBottom());
                l = Math.max(l, in.getDisplayCutout().getSafeInsetLeft()); r = Math.max(r, in.getDisplayCutout().getSafeInsetRight());
            }
        }
        final String js = String.format(Locale.US, "(function(s){s.setProperty('--ins-t','%.1fpx');s.setProperty('--ins-r','%.1fpx');s.setProperty('--ins-b','%.1fpx');s.setProperty('--ins-l','%.1fpx');})(document.documentElement.style)",
                t / d, r / d, b / d, l / d);
        web.evaluateJavascript(js, null);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else if (web != null) {
            web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    /* Back / back gesture: the page closes its top layer (dialog, settings, menu) or opens the main menu; on the main menu it exits. */
    private void registerBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            OnBackInvokedCallback cb = new OnBackInvokedCallback() { @Override public void onBackInvoked() { handleBack(); } };
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb);
            backCallback = cb;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { handleBack(); }   // Android 7–12

    private void handleBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(function(){try{return window.__back?!!__back():false;}catch(e){return false;}})()", new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); }
        });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("try{window.__lifecycle&&__lifecycle('pause')}catch(e){}", null);
            web.onPause();
        }
        tts.stop();
        AdsBridge.setForeground(ads, false);
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("try{window.__lifecycle&&__lifecycle('resume')}catch(e){}", null);
        }
        AdsBridge.setForeground(ads, true);
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) backCallback);
        AdsBridge.destroy(ads);
        tts.shutdown();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    /** Runs a callback in the page (called from any thread). */
    void js(final String code) {
        ui.post(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript(code, null); } });
    }

    static String q(String s) { return "'" + (s == null ? "" : s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ")) + "'"; }

    /** Small native helpers for the page. */
    private class App {
        /** Screen orientation chosen in the game's settings: "land" (default: landscape, either way round by the sensor)
         *  or "auto" (follows the phone, portrait included). The manifest starts the game in landscape. */
        @JavascriptInterface
        public void setOrientation(final String mode) {
            ui.post(new Runnable() { @Override public void run() {
                setRequestedOrientation("auto".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            } });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                ms = Math.max(5, Math.min(400, ms));
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(ms);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void setLanguage(String code) { tts.lang = code; }
    }

    /** Station announcements: Android TextToSpeech in the language chosen in the game (silently skipped when no voice is installed). */
    private class Tts implements TextToSpeech.OnInitListener {
        private final TextToSpeech t;
        private volatile boolean ready;
        volatile String lang = "";
        private String cur = "";
        private int n;

        Tts() { t = new TextToSpeech(MainActivity.this, this); }

        @Override
        public void onInit(int status) { ready = status == TextToSpeech.SUCCESS; }

        @JavascriptInterface
        public void speak(String text, String locale, int queue, float volume) {
            if (!ready || text == null) return;
            try {
                if (!locale.equals(cur)) {
                    Locale l = Locale.forLanguageTag(locale);
                    if (t.isLanguageAvailable(l) < TextToSpeech.LANG_AVAILABLE) return;
                    t.setLanguage(l); cur = locale;
                }
                Bundle b = new Bundle();
                b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
                t.setSpeechRate(.95f);
                t.speak(text, queue == 1 ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH, b, "er" + (++n));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void stop() { if (ready) try { t.stop(); } catch (Exception ignored) { } }

        void shutdown() { try { t.shutdown(); } catch (Exception ignored) { } }
    }
}
