# ENDLESS RAILS 2.0.0 — build instructions

One game source for every platform: `endless-rails/src/game.html` (+ `endless-rails/src/music/*.ogg`). three.js r128
and the fonts are vendored in `android/vendor/` and inlined at build time by each platform's build step.

| Platform | Project | Output |
|---|---|---|
| Android | `android/` (Gradle, AGP 8.13, compile/target SDK 36, min SDK 24) | APK (debug/release), AAB |
| Windows | `desktop/` (Electron 45.2.3 + electron-builder 26.18.1) | NSIS installer, portable .exe |
| Web | `endless-rails/tools/build_standalone.py` | one self-contained HTML |

## Android
Requirements: JDK 17–21, Android SDK Platform 36 + Build-Tools 36, Gradle 8.13+ (or Android Studio).
1. `android/gradle.properties`: `admob.appId`, `admob.rewardedId` (already filled with the project's IDs — see
   `ADMOB.md`). Debug builds always use Google's public test IDs; a release build refuses to start without real IDs.
2. Signing: create `android/keystore.properties` (never commit it):
   ```
   storeFile=/absolute/path/to/release.keystore
   storePassword=...
   keyAlias=...
   keyPassword=...
   ```
   See `SIGNING.md`.
3. Build (from `android/`, with `ANDROID_HOME` set or `local.properties` containing `sdk.dir=`):
   * `gradle assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`
   * `gradle assembleRelease` → `app/build/outputs/apk/release/app-release.apk` (R8-minified, signed)
   * `gradle bundleRelease` → `app/build/outputs/bundle/release/app-release.aab` (upload to Google Play)
   * `gradle lintRelease` → lint report in `app/build/reports/`
   The task `generateGameAsset` turns `game.html` into `assets/index.html` (three.js + fonts inlined) and copies the music.
4. Raise `versionCode` / `versionName` in `app/build.gradle.kts` for every Play upload.

This release was built with Gradle 8.14.3, OpenJDK 21 and SDK platform 36 / build-tools 36.0.0 on Linux.

## Windows
Requirements: Node.js 20+ (22 used). On Windows: `cd desktop && npm ci && npm run dist`.
Output: `desktop/dist/ENDLESS_RAILS_SETUP.exe`, `desktop/dist/ENDLESS_RAILS_PORTABLE.exe`, `desktop/dist/win-unpacked/`.
From Linux/macOS Wine is also required (electron-builder runs the NSIS uninstaller stub with it). Details and code
signing: `desktop/README.md`.

## Web
`python3 endless-rails/tools/build_standalone.py ENDLESS_RAILS.html` → one ≈10 MB file with three.js, fonts and music
inside (works from `file://` and from any static host). `endless-rails/src/game.html` itself can also be hosted next to
its `music/` folder; it then loads three.js from cdnjs and the fonts from Google Fonts (needs internet).

## Tests used for this release
Headless Chromium (Playwright, SwiftShader WebGL) scripts: runtime audit (modes × trains × cameras, controls, audio
lifecycle, saves across reload, UI at 11 screen sizes, frame cost per state), multi-day soak test with error statistics
per system, offline start, and the desktop app driven through Electron (Linux build of the same app code).
Results: `QA/AUDIT_REPORT_UK.md` and `QA/TEST_REPORT.md`.
