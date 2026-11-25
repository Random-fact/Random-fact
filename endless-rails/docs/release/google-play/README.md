# Google Play publication kit

The same files as `PLAY_PUBLISH_PACK.zip` (handed to the developer), minus the binaries:
* `START_HERE_UK.md` — what the kit is and how to start a browser-enabled Claude session
* `SESSION_PROMPT.md` — first message for that session (context, order of work, safety rules)
* `PLAY_CONSOLE_ANSWERS_UK.md` — answers for every Play Console form
* `TESTERS_INVITE_UK.md` — invitation text for the closed test
* `website/` — developer site for GitHub Pages (add `../../privacy-policy.html` and `../../app-ads.txt`)

Binaries: `ENDLESS_RAILS.aab` and the debug APK are built from `android/` (see `../BUILD.md`) and are in the release
archive. Store graphics: `android/store/` (icon, feature graphic, screenshots 1920×1080 from 2.0.0), texts:
`android/store/listing/*.json`.
