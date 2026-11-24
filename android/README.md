# ENDLESS RAILS — Android

The game is one self-contained HTML5/WebGL page (`../endless-rails/src/game.html`, all 10 languages inside).
This project wraps it in a full-screen WebView and adds the native parts: safe-area insets, back gesture,
lifecycle saves, Android TextToSpeech for station announcements, vibration and the voluntary rewarded ads
(Google AdMob + Google UMP consent).

```
android/
├─ settings.gradle.kts, build.gradle.kts, gradle.properties   Gradle project (AGP 8.13, compile/target SDK 36, min SDK 24)
├─ app/
│  ├─ build.gradle.kts           build types, signing, AdMob IDs, task generateGameAsset (inlines three.js + fonts → assets/index.html)
│  ├─ proguard-rules.pro
│  └─ src/main/
│     ├─ AndroidManifest.xml
│     ├─ java/com/endlessrails/game/MainActivity.java   WebView host (framework APIs only)
│     ├─ java/com/endlessrails/game/AdsBridge.java      rewarded ads + consent → window.AndroidAds
│     └─ res/                                           adaptive + themed launcher icon, theme, backup rules
├─ store/                        Play listing graphics (512 icon, 1024×500 feature graphic, screenshots)
├─ testbuild/                    offline test APK without Gradle and without the ad SDK (all extras unlocked)
├─ tools/                        make_asset.py (test build), make_icons.py
└─ vendor/                       three.js r128 (MIT) and the Oswald / Manrope web fonts (OFL), inlined at build time
```

## Build the Google Play release (Android Studio)

Verified on 24 Nov 2026: `assembleDebug`, `assembleRelease`, `bundleRelease` and `lintRelease` build with Gradle 8.14.3,
AGP 8.13.0, SDK platform 36 / build-tools 36.0.0, play-services-ads 25.5.0 and UMP 4.0.0 (command line, OpenJDK 21).

1. Install Android Studio (current stable) with Android SDK Platform 36. Open the `android/` folder.
   If Studio asks to create the Gradle wrapper or to upgrade the Android Gradle plugin, accept (the AGP Upgrade
   Assistant handles AGP 9.x). Without Studio: `gradle wrapper --gradle-version 8.13`, then use `./gradlew`.
2. AdMob (see “Ads” below): put your IDs in `gradle.properties` (`admob.appId`, `admob.rewardedId`).
   A release build refuses to run while they are empty; debug builds always use Google's public test IDs.
3. Upload key: create a keystore once (Build ▸ Generate Signed App Bundle, or `keytool -genkeypair -v -keystore
   upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`) and a `keystore.properties` file next to
   `settings.gradle.kts`:
   ```
   storeFile=/absolute/path/upload-keystore.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   Never commit the keystore or this file (both are in `.gitignore`). Enrol in **Play App Signing** (default for new apps):
   Google keeps the app signing key, you keep the upload key.
4. `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab` (upload this to Play Console).
   For a quick device test: `./gradlew installDebug` (package `com.endlessrails.game.debug`, test ads).
5. Before each release: raise `versionCode` (and `versionName`) in `app/build.gradle.kts`.

## Ads (rewarded video only)

* Create an AdMob account, add the app (Android, package `com.endlessrails.game`), create **one Rewarded ad unit**,
  copy the App ID and ad-unit ID into `gradle.properties`.
* AdMob ▸ Privacy & messaging: create a **European regulations (GDPR) message** (and, if you want, a US state
  regulations message); the UMP SDK shows it. The form is shown only when the player first opens *Extras*, and the
  *Privacy* settings tab offers “Ad consent settings” whenever UMP says a privacy-options entry point is required.
* Host an `app-ads.txt` on the developer website listed in Play Console (AdMob ▸ Apps ▸ app-ads.txt shows the line).
* Behaviour: no banners, no interstitials, nothing during driving or lessons. An ad starts only after the player presses
  “Unlock by watching an ad” and confirms a dialog explaining the reward. The unlock is granted only on
  `onUserEarnedReward`; closing early grants nothing; failures show a clear message. Unlocks are stored permanently on the
  device. Limits: one video per 45 s, 15 per day. Max ad content rating: PG.
* Permissions: the app declares `INTERNET` and `VIBRATE`; the ads SDK merges in `ACCESS_NETWORK_STATE`, `AD_ID`,
  `ACCESS_ADSERVICES_*` and `WAKE_LOCK`. WorkManager's `FOREGROUND_SERVICE` is removed in the manifest (not used).
* Optional hardening: AdMob server-side verification (SSV) of rewards needs a server; not used (rewards are cosmetic /
  convenience content, stored only on the device).

## Offline test APK (no Gradle)

`testbuild/build-apk.sh` builds `EndlessRails-test.apk` with aapt/javac/dx/apksigner (Ubuntu packages listed in the
script). It contains no ad SDK, so every extra is unlocked, and it is signed with a test key — use it for device
testing only, never upload it to Play.
