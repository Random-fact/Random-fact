# Endless Rails — Android (APK)

The game page (`../endless-rails/index.html`) in a full-screen WebView. The build inlines three.js and the fonts,
so the app works offline and requests no permissions; station announcements use Android TextToSpeech
(Ukrainian voice) through a small `speechSynthesis` bridge. Saves stay in the app's localStorage.

Build on Ubuntu without Gradle:

    sudo apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk-headless
    ./build-apk.sh            # -> EndlessRails.apk (min Android 7.0, target 34)

Keep `release.keystore` (created on first build, or pass `KEYSTORE=...`): updates must be signed with the same key
to install over an earlier version without losing saves.
