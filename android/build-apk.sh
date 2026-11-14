#!/bin/bash
# Builds EndlessRails.apk without Gradle: aapt + javac + dx + zipalign + apksigner (Ubuntu packages:
#   apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk-headless)
# Signing key: $KEYSTORE (default ./release.keystore, created on first run; keep it to be able to install updates over old versions).
set -euo pipefail
cd "$(dirname "$0")"
AJAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
KS=${KEYSTORE:-release.keystore}; KSPASS=${KS_PASS:-endlessrails}
OUT=build
rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/classes"
python3 tools/make_asset.py ../endless-rails/index.html assets/index.html
[ -f res/mipmap-xxxhdpi/ic_launcher.png ] || python3 tools/make_icons.py
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$AJAR"
javac --release 8 -nowarn -Xlint:-options -encoding UTF-8 -classpath "$AJAR" -d "$OUT/classes" "$OUT"/gen/com/endlessrails/game/R.java src/com/endlessrails/game/*.java
dalvik-exchange --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$AJAR" -F "$OUT/app.unaligned.apk"
(cd "$OUT" && aapt add -f app.unaligned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/app.unaligned.apk" "$OUT/app.aligned.apk"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" -alias endlessrails -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Endless Rails, O=Endless Rails" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass "pass:$KSPASS" --key-pass "pass:$KSPASS" --ks-key-alias endlessrails --out EndlessRails.apk "$OUT/app.aligned.apk"
apksigner verify --print-certs EndlessRails.apk | head -3
ls -la EndlessRails.apk
