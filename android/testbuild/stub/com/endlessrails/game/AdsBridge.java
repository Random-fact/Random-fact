package com.endlessrails.game;

import android.app.Activity;
import android.webkit.WebView;

/** Test build without the Google Mobile Ads SDK: no ad bridge, so the page treats every extra as available. */
final class AdsBridge {
    static Object create(Activity a, WebView w) { return null; }
    static void destroy(Object o) { }
    static void setForeground(Object o, boolean fg) { }
}
