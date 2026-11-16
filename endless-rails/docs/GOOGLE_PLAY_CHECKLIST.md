# ENDLESS RAILS — Google Play pre-publication checklist

Status as of 16 Nov 2026. ✅ = done in the project · ⬜ = **you** must do it (account, credentials, hosting, real-device testing).
Requirements change: re-check the linked Google pages on the day you submit.

## 1. Technical requirements
| | Item | Status / where |
|---|---|---|
| ✅ | Target API level **36 (Android 16)** — required for new apps and updates since 31 Aug 2026 | `android/app/build.gradle.kts` (`targetSdk = 36`, `compileSdk = 36`) |
| ✅ | Min SDK 24 (Android 7.0) — WebGL-capable WebView | `minSdk = 24` |
| ✅ | Android App Bundle (AAB) build | `./gradlew bundleRelease` (see `android/README.md`) |
| ✅ | 64-bit: the app has no native code of its own; the WebView and the AdMob SDK are 64-bit ready | — |
| ⬜ | 16 KB memory-page compatibility (required for apps targeting Android 15+): no own native libs; confirm with Android Studio ▸ *Analyze APK* that no `.so` file is flagged | after the first AAB build |
| ✅ | Edge-to-edge (enforced at target 35+): content draws behind bars, safe-area insets passed to the page (`--ins-*`) | `MainActivity.pushInsets` |
| ✅ | Predictive back / back gesture (`enableOnBackInvokedCallback`, `OnBackInvokedCallback` on 13+, `onBackPressed` before) | `MainActivity` |
| ✅ | Large screens / foldables / orientation: no fixed orientation lock (ignored on large screens at API 36 anyway), resizable, config changes handled without restart | manifest |
| ✅ | WebView renderer crash recovery (`onRenderProcessGone`), lifecycle save on pause | `MainActivity` |
| ✅ | Permissions: `INTERNET` (ads only), `VIBRATE`; the ad SDK adds `ACCESS_NETWORK_STATE` and `AD_ID` | manifest |
| ✅ | Release minification (R8) with `@JavascriptInterface` kept | `proguard-rules.pro` |
| ⬜ | Upload key + `keystore.properties`; enrol in **Play App Signing** | `android/README.md` §3 |
| ⬜ | Raise `versionCode` for every upload | `app/build.gradle.kts` |
| ⬜ | Build the AAB in Android Studio (Gradle/Google Maven were not reachable from the environment this project was prepared in, so the Gradle build itself has **not** been run yet) | — |

## 2. Ads (AdMob rewarded only)
| | Item |
|---|---|
| ⬜ | AdMob account, app registered (package `com.endlessrails.game`), **one Rewarded ad unit**; IDs in `android/gradle.properties` (release build fails while empty) |
| ⬜ | AdMob ▸ Privacy & messaging: publish a **GDPR message** (EEA/UK/CH); optionally a US-states message. Test with `ump.testDevice` in a debug build |
| ⬜ | Link AdMob to the Play app after publication; host **app-ads.txt** on the website set in the Play store listing |
| ✅ | No banners/interstitials; rewarded ads only on explicit user action with an explanatory dialog; reward only on `onUserEarnedReward`; failure/unavailable messages; frequency cap (45 s, 15/day); max ad content rating PG; privacy-options entry point in Settings ▸ Privacy |
| ⬜ | Test on real devices: successful reward, early close (no reward), no fill / offline, consent form in EEA (debug geography), privacy options form |

## 3. Play Console — App content
| | Declaration | What to answer (verify against the current form) |
|---|---|---|
| ⬜ | **Privacy policy** URL | Host `endless-rails/docs/privacy-policy.html` (fill the placeholders: developer name, address/country, e-mail, date) on a public HTTPS URL (e.g. GitHub Pages); enter the URL in Play Console and in the store listing |
| ⬜ | **Ads** | *Yes, my app contains ads* |
| ⬜ | **App access** | All functionality is available without special access (no login) |
| ⬜ | **Content rating** (IARC questionnaire) | Category: Game. No violence, no sexual content, no gambling, no user-generated content, no user interaction/chat, no location sharing; natural-disaster *visual* events (volcano, tsunami, tornado) without harm to people. Ads present. Expected result: Everyone / PEGI 3 — the questionnaire decides |
| ⬜ | **Target audience and content** | Recommended: **13+ (or 16+)**. Choosing ages under 13 puts the app in the Families policy (families-certified ad SDK config, child-directed tagging) — not prepared in this build |
| ⬜ | **Data safety** | See section 4 |
| ⬜ | **Advertising ID** declaration | *Yes, the app uses the advertising ID* — purpose: Advertising or marketing (and fraud prevention) |
| ⬜ | Government app / financial features / health / news / COVID | No |
| ⬜ | **Developer account verification** (identity, D-U-N-S for organisations) and, since 30 Sep 2026 in BR/ID/SG/TH, developer verification also governs side-loaded installs | Play Console ▸ account |

## 4. Data safety form (based on the Google Mobile Ads SDK disclosure — re-check Google's current *“Google Mobile Ads SDK data disclosure”* page)
* Does the app collect or share user data? **Yes** (through the AdMob SDK only; the game itself collects nothing).
* Data types (collected **and** shared with Google for advertising):
  * **Location → Approximate location** (derived from IP address) — Advertising or marketing, Fraud prevention / security
  * **App activity → App interactions** (ad interactions) — Advertising or marketing, Analytics
  * **App info and performance → Crash logs, Diagnostics** — Analytics, Fraud prevention
  * **Device or other IDs** (advertising ID, app set ID) — Advertising or marketing, Fraud prevention
* Is data encrypted in transit? **Yes** (SDK uses HTTPS). · Can users request deletion? The game holds no account data; advertising ID can be reset in Android settings; link the privacy policy.
* Collection is **not optional** for watching an ad, but watching ads is optional; personalisation follows consent.
* Game progress stored only on the device is **not** “collected” (it never leaves the device).

## 5. Store listing (all 10 languages prepared)
| | Item | Where |
|---|---|---|
| ✅ | Title (≤30), short (≤80) and full description (≤4000) in en, uk, ru, zh, ro, pt-BR, es, fr, de, ja | `android/store/listing/<lang>.json` |
| ✅ | App icon 512×512 PNG | `android/store/icon-512.png` |
| ✅ | Feature graphic 1024×500 | `android/store/feature-graphic-1024x500.png` |
| ✅ | Phone screenshots (landscape 1920×1080, rendered from the game) | `android/store/screenshots/` |
| ⬜ | Tablet / Chromebook screenshots (recommended), optional promo video (YouTube) | — |
| ⬜ | Category **Simulation** (Games), contact e-mail, website (needed for app-ads.txt) | Play Console |
| ⬜ | Review screenshots on a real device in each language you feature (they were rendered with a software renderer) | — |

## 6. Testing before production
| | Item |
|---|---|
| ⬜ | **New personal developer accounts**: closed test with **at least 12 testers for 14 consecutive days** before applying for production |
| ⬜ | Internal test track first; check the **pre-launch report** (crashes, ANRs, accessibility, screenshots on many devices) |
| ⬜ | Real-device matrix (see `TEST_REPORT.md`, “not tested”): a weak phone (≤3 GB RAM, Mali/Adreno 5xx), a mid-range and a flagship phone, a tablet, a foldable; Android 7, 10, 13, 15, 16; 60-min sessions with battery/heat observation; TalkBack spot-check |
| ⬜ | Android vitals after launch: crash rate < 1.09 %, ANR rate < 0.47 % (bad-behaviour thresholds) |
