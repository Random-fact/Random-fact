package com.endlessrails.game;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentDebugSettings;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Voluntary rewarded video ads (Google AdMob) with the Google User Messaging Platform (UMP) consent flow.
 *
 * Rules implemented here and in the page (Ads / Menu.offer in game.html):
 *  - an ad is shown ONLY when the player presses "Unlock by watching an ad" in Extras, after a dialog that explains it;
 *  - the reward is granted ONLY when the SDK calls onUserEarnedReward (window.__ads.reward); closing early grants nothing;
 *  - no banners, no interstitials, nothing during driving or lessons; frequency limits are enforced by the page.
 * Consent: the consent status is refreshed silently at every launch. If the user still has to answer the consent
 * message (EEA / UK / Switzerland), the form is shown only when they first open Extras (prepare()), never during play.
 * Ads are initialised and requested only after canRequestAds() is true.
 *
 * Page callbacks: __ads.ready(bool) · __ads.reward(id) · __ads.closed(id) · __ads.fail(id, 'load'|'show')
 */
public class AdsBridge {
    private final Activity act;
    private final MainActivity main;
    private final ConsentInformation consent;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final AtomicBoolean started = new AtomicBoolean(false);
    /* a loaded rewarded ad is valid for one hour (AdMob); an older one is dropped and a fresh one requested */
    private static final long AD_TTL_MS = 55L * 60 * 1000;
    private volatile RewardedAd ad;
    private volatile long adAt;
    private volatile boolean destroyed;
    private boolean loading, sdkReady;
    private long retryMs = 15000;
    private final Runnable retry = new Runnable() { @Override public void run() { load(); } };

    static Object create(Activity a, WebView w) { return new AdsBridge(a); }
    static void destroy(Object o) {
        if (!(o instanceof AdsBridge)) return;
        AdsBridge b = (AdsBridge) o; b.destroyed = true; b.ad = null; b.ui.removeCallbacksAndMessages(null);
    }
    /** App in the background: no ad requests are retried until it is back (saves data and battery). */
    static void setForeground(Object o, boolean fg) {
        if (!(o instanceof AdsBridge)) return;
        AdsBridge b = (AdsBridge) o;
        if (!fg) b.ui.removeCallbacks(b.retry);
        else b.ui.post(new Runnable() { @Override public void run() { if (b.ad == null || !b.fresh()) { b.ad = null; b.load(); } } });
    }

    private boolean fresh() { return ad != null && System.currentTimeMillis() - adAt < AD_TTL_MS; }

    private AdsBridge(Activity a) {
        act = a; main = (MainActivity) a;
        consent = UserMessagingPlatform.getConsentInformation(a);
        ConsentRequestParameters.Builder p = new ConsentRequestParameters.Builder();
        if (BuildConfig.DEBUG && !BuildConfig.UMP_TEST_DEVICE.isEmpty()) {
            /* debug builds: simulate the EEA so the consent form can be tested (add your device's hashed id in gradle.properties) */
            p.setConsentDebugSettings(new ConsentDebugSettings.Builder(a)
                    .setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA)
                    .addTestDeviceHashedId(BuildConfig.UMP_TEST_DEVICE).build());
        }
        consent.requestConsentInfoUpdate(a, p.build(),
                new ConsentInformation.OnConsentInfoUpdateSuccessListener() { @Override public void onConsentInfoUpdateSuccess() { if (consent.canRequestAds()) startSdk(); } },
                new ConsentInformation.OnConsentInfoUpdateFailureListener() { @Override public void onConsentInfoUpdateFailure(com.google.android.ump.FormError e) { if (consent.canRequestAds()) startSdk(); } });
        if (consent.canRequestAds()) startSdk(); // consent from an earlier session
    }

    private void startSdk() {
        if (!started.compareAndSet(false, true)) return;
        new Thread(new Runnable() {
            @Override public void run() {
                MobileAds.setRequestConfiguration(MobileAds.getRequestConfiguration().toBuilder()
                        .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG).build());
                MobileAds.initialize(act, status -> ui.post(new Runnable() { @Override public void run() { sdkReady = true; load(); } }));
            }
        }).start();
    }

    private void load() {
        if (destroyed || !sdkReady || loading || fresh() || act.isFinishing()) return;
        ad = null; loading = true; ui.removeCallbacks(retry);
        RewardedAd.load(act, BuildConfig.REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd a) { loading = false; if (destroyed) return; ad = a; adAt = System.currentTimeMillis(); retryMs = 15000; main.js("window.__ads&&__ads.ready(true)"); }
            @Override public void onAdFailedToLoad(LoadAdError e) {
                loading = false; ad = null; if (destroyed) return; main.js("window.__ads&&__ads.ready(false)");
                /* no fill / offline: try again later with a growing pause (15 s … 10 min) */
                ui.postDelayed(retry, retryMs);
                retryMs = Math.min(retryMs * 2, 10 * 60 * 1000);
            }
        });
    }

    /* ---- called by the page (binder thread) ---- */
    @JavascriptInterface public boolean isEnabled() { return true; }
    @JavascriptInterface public boolean isReady() { return fresh(); }

    @JavascriptInterface
    public void preload() { ui.post(new Runnable() { @Override public void run() { if (consent.canRequestAds()) { startSdk(); load(); } } }); }

    /** The player opened Extras: show the consent form now if it is still required, then load an ad. */
    @JavascriptInterface
    public void prepare() {
        ui.post(new Runnable() {
            @Override public void run() {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(act, e -> { if (consent.canRequestAds()) { startSdk(); load(); } main.js("window.Menu&&Menu.refreshExtras()"); });
            }
        });
    }

    @JavascriptInterface
    public void showRewarded(final String id) {
        ui.post(new Runnable() {
            @Override public void run() {
                final String qid = MainActivity.q(id);
                if (!fresh()) { ad = null; main.js("__ads.fail(" + qid + ",'load')"); load(); return; }
                RewardedAd a = ad; ad = null;
                a.setFullScreenContentCallback(new FullScreenContentCallback() {
                    @Override public void onAdDismissedFullScreenContent() { main.js("__ads.closed(" + qid + ")"); load(); }
                    @Override public void onAdFailedToShowFullScreenContent(AdError e) { main.js("__ads.fail(" + qid + ",'show')"); load(); }
                });
                a.show(act, item -> main.js("__ads.reward(" + qid + ")"));
            }
        });
    }

    @JavascriptInterface
    public boolean isPrivacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    @JavascriptInterface
    public void showPrivacyOptions() {
        ui.post(new Runnable() { @Override public void run() { UserMessagingPlatform.showPrivacyOptionsForm(act, e -> main.js("window.Menu&&Menu.refreshExtras()")); } });
    }
}
