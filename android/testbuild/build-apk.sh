#!/bin/bash
# OFFLINE TEST APK (no Gradle, no ad SDK): aapt + javac + dx + zipalign + apksigner.
#   Ubuntu: apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk-headless
#   ANDROID_JAR      platform jar for resources (default: API 23 from the Ubuntu package)
#   ANDROID_API_JAR  jar with the newer framework classes the Java code compiles against (API 30–36: insets, back callback);
#                    e.g. platforms/android-36/android.jar from the Android SDK
#   KEYSTORE / KS_PASS  signing key for the test build (created on first run)
# The Google Play release (AAB, AdMob rewarded ads, UMP consent) is built from ../app with Gradle: see ../README.md.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
AJAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
APIJAR=${ANDROID_API_JAR:?set ANDROID_API_JAR to an API 36 android.jar}
KS=${KEYSTORE:-test.keystore}; KSPASS=${KS_PASS:-endlessrails}
OUT=build; rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/assets" "$OUT/res"
python3 "$ROOT/tools/make_asset.py" "$ROOT/../endless-rails/src/game.html" "$OUT/assets/index.html"
# resources: the app's, minus the adaptive-icon XML and backup rules that need a newer aapt
cp -r "$ROOT/app/src/main/res/." "$OUT/res/"; rm -rf "$OUT/res/mipmap-anydpi-v26" "$OUT/res/xml"
find "$OUT/res" -name 'ic_launcher_*.png' -delete
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$AJAR" --custom-package com.endlessrails.game
javac --release 8 -nowarn -Xlint:-options -encoding UTF-8 -classpath "$APIJAR" -d "$OUT/classes" \
  "$OUT"/gen/com/endlessrails/game/R.java "$ROOT/app/src/main/java/com/endlessrails/game/MainActivity.java" stub/com/endlessrails/game/AdsBridge.java
dalvik-exchange --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"
aapt package -f -M AndroidManifest.xml -S "$OUT/res" -A "$OUT/assets" -I "$AJAR" -F "$OUT/app.unaligned.apk"
(cd "$OUT" && aapt add -f app.unaligned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/app.unaligned.apk" "$OUT/app.aligned.apk"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" -alias endlessrails -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Endless Rails Test" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass "pass:$KSPASS" --key-pass "pass:$KSPASS" --ks-key-alias endlessrails --out EndlessRails-test.apk "$OUT/app.aligned.apk"
apksigner verify --print-certs EndlessRails-test.apk | head -2
ls -la EndlessRails-test.apk
