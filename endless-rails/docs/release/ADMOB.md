# ENDLESS RAILS — AdMob and consent (UMP)

## Ad IDs used
| Build | App ID | Rewarded ad unit | Where it comes from |
|---|---|---|---|
| **Release** (`ENDLESS_RAILS.apk`, `.aab`) | `ca-app-pub-7389308732042512~6246758735` | `ca-app-pub-7389308732042512/4275201510` | `android/gradle.properties` (`admob.appId`, `admob.rewardedId`) — the IDs given by the developer |
| **Debug** (`ENDLESS_RAILS_debug.apk`) | `ca-app-pub-3940256099942544~3347511713` | `ca-app-pub-3940256099942544/5224354917` | Google's public **test** IDs, hard-wired in `app/build.gradle.kts` for every debug build |
| Web, Windows | — | — | no ad SDK: every extra is free |

Checked in the built files: the release APK's manifest carries the real App ID and its code the real rewarded unit;
the debug APK carries only the test IDs. `app-ads.txt` line (host it at the root of the developer website given in Play
Console): `google.com, pub-7389308732042512, DIRECT, f08c47fec0942fa0` (file: `endless-rails/docs/app-ads.txt`).

## Format and placement
* **Rewarded video only.** No banners, interstitials or rewarded interstitials: the game has no natural break where they
  would not interrupt driving, and none were added.
* An ad is requested to be *shown* only when the player opens **Extras** and presses “Unlock by watching an ad”, after a
  dialog that explains the reward. Never during driving, lessons or events; nothing covers the HUD.
* The reward (a permanent unlock: HS train, longer consists, modes, liveries) is granted **only** in
  `onUserEarnedReward`. Closing early grants nothing and says so. A reward that arrives just after the close callback is
  still honoured (1.2 s window). Frequency limit: one video per 45 s, 15 per day. Max ad content rating: PG.
* Failures (no fill, offline, show error) give a clear message; loading retries with a growing pause (15 s … 10 min),
  never while the app is in the background. A loaded ad older than 55 min is dropped and reloaded (AdMob ads expire
  after one hour). Game sound is suspended while an ad is on screen and resumed after.
* Ads never block the start: the SDK is initialised on a background thread, the game runs offline.

## Consent (GDPR / UK / Switzerland, US states)
* At every launch `requestConsentInfoUpdate` refreshes the consent status. Ads are initialised and requested **only after**
  `canRequestAds()` is true.
* If the consent form is required and not yet answered, it is shown when the player first opens **Extras** (not during
  play). *Settings ▸ Privacy ▸ Ad consent settings* reopens the privacy-options form whenever UMP says an entry point is
  required.
* You must create and publish the messages in **AdMob ▸ Privacy & messaging** (European regulations message; optionally US
  state regulations). Without a published message the form cannot appear.
* Test the EEA flow with the debug APK: run it once, copy the hashed device ID that the UMP SDK prints in logcat
  (`adb logcat | grep -i "ConsentDebugSettings"`), put it in `ump.testDevice=` in `gradle.properties`, rebuild debug —
  the device is then treated as being in the EEA.

## What was not verified here
There is no Android device or emulator in the environment this release was built in, so **real ad loading, the reward
flow on a device, the consent form and the privacy-options form were not exercised**. The code paths were reviewed and
the page-side logic was tested with a mock of the native bridge. Test on a real device with the debug APK before
publishing (checklist in `GOOGLE_PLAY_CHECKLIST.md` §2). This document does not claim GDPR or Google Play policy
compliance — that needs the Play Console review and your own legal check.

## Never
* Never tap your own live ads (use the debug APK — it only ever shows test ads).
* Never put the test IDs in a release, or the real IDs in a debug build (the Gradle script enforces both).
