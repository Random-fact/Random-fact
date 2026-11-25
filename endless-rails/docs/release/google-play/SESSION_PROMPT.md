# Task: publish ENDLESS RAILS on Google Play — help me in my browser

Talk to me in **Ukrainian**. You are running on my computer with control of my browser (Claude in Chrome / computer use).
Everything you need is in this folder (`PLAY_PUBLISH_PACK`); I unpacked it on my computer. Read `PLAY_CONSOLE_ANSWERS_UK.md`
before you start filling anything in — it has the answer for every Play Console form.

## The app (already finished — do not change the game)
* **ENDLESS RAILS 2.0.0** — an endless train-driving simulator (HTML5/WebGL game in an Android WebView).
* Package **`com.endlessrails.game`**, versionCode **20000**, versionName **2.0.0**, min SDK 24, target/compile SDK **36**
  (meets the Aug-2026 target-API rule). No native libraries (16 KB page rule not affected).
* Upload file: `upload/ENDLESS_RAILS.aab` — signed with my upload key (SHA-256
  `01:BA:CD:9E:CC:95:99:87:B3:0E:46:57:46:6A:25:2D:9B:24:85:22:10:9D:E1:84:F4:F7:2C:D9:0A:BD:B9:4E`). The keystore itself
  is **not** in this pack and must never be uploaded anywhere — when Play Console offers **Play App Signing**, accept
  “Google-generated key”; my key then serves as the upload key.
* Ads: **AdMob rewarded video only**, shown only when the player chooses it in *Extras*. App ID
  `ca-app-pub-7389308732042512~6246758735`, rewarded unit `ca-app-pub-7389308732042512/4275201510` (already inside the
  AAB). Consent: Google UMP. `upload/ENDLESS_RAILS_debug.apk` shows **only Google test ads** (package
  `com.endlessrails.game.debug`) — use it for any ad check, never the live build.
* Permissions in the AAB: INTERNET, VIBRATE, ACCESS_NETWORK_STATE, AD_ID, ACCESS_ADSERVICES_AD_ID / ATTRIBUTION /
  TOPICS, WAKE_LOCK (the last six come from the Google Mobile Ads SDK). No location, camera, contacts, storage.
* The game itself collects nothing; only the AdMob SDK processes data (see Data safety in the answers file).
* Source code (if you need it): GitHub `Random-fact/Random-fact`, branch `claude/endless-rails-global-audit-u11yd8`
  (`android/`, `endless-rails/docs/release/*.md`, `endless-rails/docs/GOOGLE_PLAY_CHECKLIST.md`). You should not need to
  build anything; if a new AAB is ever required, the versionCode must be raised above 20000 — tell me first.

## What to do, in order (details in PLAY_CONSOLE_ANSWERS_UK.md)
1. **Website + privacy policy.** Ask me for: developer name (as it will appear on Google Play), country, contact
   e-mail. Replace the placeholders in `website/privacy-policy.html` (`[DEVELOPER NAME]`, `[POSTAL ADDRESS OR COUNTRY]`,
   `[CONTACT E-MAIL]`, `[DATE OF PUBLICATION]` and the Ukrainian ones `[ІМ’Я / НАЗВА РОЗРОБНИКА]`, `[АДРЕСА АБО КРАЇНА]`,
   `[E-MAIL]`, `[ДАТА ПУБЛІКАЦІЇ]`) and `[CONTACT E-MAIL]` in `website/index.html`; steps are in
   `website/README_GITHUB_PAGES_UK.md`. Help me publish `website/` with **GitHub Pages** in a repository named
   `<my-github-login>.github.io` (so `app-ads.txt` sits at the domain root). Check that
   `https://<login>.github.io/privacy-policy.html` and `https://<login>.github.io/app-ads.txt` open.
2. **Play Console account** (play.google.com/console/signup). I do the sign-up, the $25 payment, identity/phone
   verification and accept the agreements **myself** — you guide me and wait. Ask me whether the account is personal or
   an organisation (a new personal account needs the 12-tester / 14-day closed test before production).
3. **Create the app**, fill **App content** (privacy policy, app access, ads, content rating, target audience, data
   safety, advertising ID, government/financial/health/news) and the **Main store listing** (texts in `store/listing/`,
   graphics in `store/`, screenshots in `store/screenshots/` — fall back to `store/screenshots-old/` only if needed;
   add the 9 extra languages as translations).
4. **Closed testing track**: countries, testers list (I give you the e-mails or a Google Group), upload
   `upload/ENDLESS_RAILS.aab`, release name `2.0.0`, release notes from the answers file, accept Play App Signing.
   **Before pressing “Start rollout” / “Send for review”, show me a summary and wait for my explicit “yes”.**
   Then give me the opt-in link and the invitation text from `TESTERS_INVITE_UK.md`.
5. **AdMob** (admob.google.com, I am already registered): Privacy & messaging → create and publish a **European
   regulations (GDPR)** message for this app; later link the app to its Play listing; check app-ads.txt status.
6. After 14 days with ≥12 opted-in testers (personal accounts): **Apply for production**, then a production release
   (“Add from library” — the same AAB) — again only after my explicit “yes”.

## Rules
* Never enter, store or repeat my passwords, card data or ID documents; I type those myself. Do not complete payments,
  accept legal agreements, verify identity or create accounts for me — stop and let me do it.
* Never click ads in the live app or on AdMob; never upload the keystore or its passwords anywhere.
* Do not invent facts in declarations. Answers must match the privacy policy and the real app (answers file). If a form
  asks something the answers file does not cover, ask me.
* Google changes Play Console often: if a screen differs from the answers file, describe what you see and propose the
  answer instead of guessing.
* Say plainly what is done and what is still waiting for me (verification, review, the 14-day test).
