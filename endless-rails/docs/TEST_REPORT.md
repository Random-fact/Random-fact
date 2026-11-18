# ENDLESS RAILS 2.0 — work and test report

Date: 16 Nov 2026 · Source: `endless-rails/src/game.html` (single self-contained HTML, ~880 KB) · Android: `android/`

## How it was tested — read this first
* **Environment:** headless Chromium (Playwright) with **SwiftShader software WebGL** on a Linux server, viewports from
  320×568 to 1920×1080, touch/mobile emulation, and the exact inlined page that goes into the APK.
* **Not available here:** real Android phones/tablets, the Android emulator, Google Maven (so the **Gradle build and the AdMob/UMP
  SDKs could not be compiled or run**), real ad traffic, speakers. Everything in the “Not tested” section still needs a person
  with devices. Nothing below claims a device test that did not happen.
* Ads were exercised only through a **mock of the Android bridge inside the test harness**. The game never simulates an ad or a
  reward on its own: without the native SDK, `Ads.enabled()` is false and all extras are simply free.
* Translations (9 languages) were produced by AI translators working from a glossary and were checked automatically
  (all 602 keys, placeholders, no Cyrillic left on any screen). **A native-speaker review is recommended** before release.

## Bugs found and fixed in this update
| # | Problem | Root cause → fix |
|---|---|---|
| 1 | **Trees without trunks** (floating crowns) | (a) conifers got a trunk only within 70 m of the track; (b) broadleaf trunks were a centred box — half underground with a 1–2 m gap below the crown; (c) trees stood on the analytic terrain height, not the coarser rendered mesh, so short trunks were buried on slopes. → Every species now has a base-anchored trunk sunk 0.6 m into the **rendered** surface (`meshH`); new species: spruce, pine, oak/maple (two-lobe crown), birch, poplar, bushes; mountain-station conifers fixed too. |
| 2 | Braking assistant showed “—” and threw an error every frame | stop-mark board was never initialised → `StopMark.init(scene)` at engine start + guard. Found by the lesson test. |
| 3 | Translated text would crash in parts of the code | the i18n function `T()` was shadowed by local variables named `T` (trains, towns) → renamed to `_T()` everywhere. |
| 4 | First menu click crashed the audio | `Sound.voice` name clash (TTS voice vs. new voice-limit helper) → renamed. |
| 5 | Stop graded too early (could award “perfect” to a train still creeping) | grading now happens when the train stands still (v < 0.05 m/s), not when doors may open. |
| 6 | Schedule pointed to the station the train was standing at | timetable target = next station when standing at / leaving a station. |
| 7 | Schedule/challenge could start with 6-km spacing | realistic 10–100 km layout forced for schedule, challenge and lessons. |
| 8 | Dead settings “swap levers”, “vibration” | implemented (CSS layout swap; native vibrator / Vibration API on emergency brake, ATP, stop grades). |
| 9 | Untranslated active-event tag in the HUD | translated. |
| 10 | Layout: lock tag over card titles; 320 px portrait menu overflow; lesson panel over the controls at 568×320 | CSS fixes; verified at 8 screen sizes. |
| 11 | Ad “loading” dialog could stay forever if the SDK never answers | Cancel button. |
| 12 | Reward reported after the ad closed was lost | 1.2 s grace window before declaring “no reward”. |
| 13 | Privacy tab hidden in builds without ads | always available (privacy policy). |
| 14 | Lessons without stop trials recorded “Perfect stop” | no grade for such lessons. |
| 15 | Long sessions: float32 jitter far from the origin; caches growing | floating origin per chunk; periodic trimming of zones, crossings, signals, junction limits, announcements, routes. |
| 16 | Station names like “Гірськськ” | suffix that repeats the end of the first part is skipped. |
| 17 | Braking prediction too expensive for weak phones | adaptive step (0.25 s at speed, 0.1 s near the stop), gradient sampled every 25 m, 7 search iterations. |

## What was built / changed (summary)
* **10 languages** (en, ru, uk, zh-CN, ro, pt-BR, es, fr, de, ja): central catalogue `i18n/*.json` → merged by `tools/build_i18n.py`;
  device-language detection on first launch with a language screen; switch any time (menu or in-game settings), saved;
  English fallback; localized numbers/units; CJK font fallbacks on canvas displays; station names transliterated per script;
  announcements spoken in the chosen language (Android TTS bridge / Web Speech).
* **Menu & UI:** new main menu (journey, training, extras, settings with 6 tabs, language, achievements & statistics, about &
  privacy), loading screen with progress and tips, dialogs, toasts, compact layouts for small/odd screens, Android back handling.
* **Driver training:** 6 progressive lessons on the real physics (`predictStop` / `brakeFor` simulate the same `TrainPhysics`):
  controls; acceleration & mass & holding speed & stopping distance; station approach at 120 km/h from 5 km with recommended
  braking point/time; precise stop with grades and signed distance; braking table 40–250 km/h + trials at 80/120/200;
  real situations (long/short approach, 12-car heavy train on wet rails, gradient station). Braking assistant panel + stop board.
* **Station spacing:** realistic layout (10–20 / 20–50 / 50–100 km, varied) in schedule, challenge and lessons; optional in free modes.
  Timetable from the allowed-speed profile (accelerate / cruise / brake) + 7 % margin + dwell.
* **Rewarded ads & extras:** Extras section (low in the menu); free: free ride, schedule, training, classic train, up to 6 cars,
  all settings & languages. Unlockable: HS train, 8/10/12/15 cars, 3 liveries, scenic, cab, photo, precise-stop challenge, event sandbox.
* **HS train:** Shinkansen-inspired redesign (no real branding): 11.5 m S-profile nose (canopy then convex bullet), wrap-around
  windscreen, flush windows, flank headlights in the stripe, belly pan, coupler-cover line, bogie skirts, full-width gangway covers,
  pantograph with shields, new cab (glass displays, glare shield), matching rear driving car with red tail lamps; liveries.
* **Audio:** Master / Train / Environment / UI / Music volumes; UI sounds; door sounds; 32-voice cap; audio suspended in background.
* **Saves:** profile (language, settings, unlocks, lessons, achievements, statistics) and journey save are both checksummed with a
  backup slot; saved on pause/hide/close and every few seconds; tutorial settings never leak into the profile.
* **Android:** Gradle project (AGP 8.13, compile/target SDK 36, min SDK 24, AAB, R8), edge-to-edge insets, predictive back,
  renderer-crash recovery, offline asset serving from `appassets.androidplatform.net`, adaptive + themed icon, store kit.

## Ad architecture (deliverable D)
```
game.html                                   Android (Play build)
Menu.offer(extra) ── dialog explains ──►   AndroidAds.showRewarded(id)      AdsBridge.java
Ads.watch(): checks bridge, cooldown 45 s,  ├─ UMP: consent refreshed at launch; form shown when the player first opens Extras
  daily cap 15, readiness                    ├─ MobileAds.initialize() only after canRequestAds()
                                             ├─ RewardedAd.load (retry with back-off), max content rating PG
window.__ads.reward(id)  ◄── onUserEarnedReward ── only here is Profile.unlock(id) called
window.__ads.closed(id)  ◄── onAdDismissedFullScreenContent (no reward → “not unlocked”)
window.__ads.fail(id,…)  ◄── load/show failure → clear message, game continues
window.__ads.ready(bool) ◄── ad loaded / not loaded
Settings ▸ Privacy ▸ “Ad consent settings” → showPrivacyOptionsForm (when UMP requires it)
```
No banners, no interstitials, no ads during driving or lessons, nothing shown without a tap and a confirmation.
**External setup needed:** AdMob account + app + one rewarded ad unit (IDs into `android/gradle.properties`), GDPR message in
AdMob Privacy & messaging, app-ads.txt on your website, hosted privacy policy. Details: `android/README.md`, `GOOGLE_PLAY_CHECKLIST.md`.

## Test scenarios
| # | Scenario | Result | How |
|---|---|---|---|
| 1 | First launch | **Pass** | fresh profile, browser locale ja-JP → Japanese UI, language screen first, then journey screen |
| 2 | Language selection | **Pass** | all 10 languages × 7 menu screens × 6 settings tabs scanned: no untranslated text; zh/ja/de screenshots reviewed |
| 3 | Language change during play | **Pass** | buttons, HUD, camera name, station line, boards re-labelled; world signs rebuilt |
| 4 | Normal mode | **Pass** | drive, 6 cameras, map, AI traffic; desktop + phone portrait + phone landscape; no errors |
| 5 | Training mode | **Pass** | lesson list, locking/unlocking, exit restores player settings |
| 6 | Lessons | **Pass (L1, L3–L6); L2 partial** | L1 by real inputs (9/9 steps); L3–L6 by stepping the real physics with an autopilot: on flat track predicted vs actual stop within 0.01–0.03 m, grades + explanations shown, progress saved. L2 started, not driven to the end |
| 7 | Schedule mode | **Pass** | gaps 10–70 km observed, e.g. 27.9 km → 18.5 min timetable; graded stops (+4.4 m good, −1.3 m excellent, −40 m poor) |
| 8 | Long distance | **Pass (simulated)** | 333 km in jumps with events/cameras: JS heap flat 61 MB, geometries 83–125, textures 11–15, zones/caches bounded |
| 9 | Precise stops | **Pass** | thresholds 1 / 3 / 8 m / platform; challenge scoring 10 stations |
| 10 | HS unlock | **Pass (mock bridge)** | locked card → explanation dialog → reward → unlocked, survives reload |
| 11 | Car count change | **Pass** | 6 free, 8 after unlock; HS with 8 cars: 217 m, 580 t; change blocked while moving / in lessons |
| 12 | Successful rewarded ad | **Pass (mock only)** | reward-then-close and close-then-reward both grant once. **Real AdMob not tested** |
| 13 | Ad failure / unavailable | **Pass (mock)** | early close, no fill, show failure, cooldown, daily limit, cancel — never a reward |
| 14 | Graphics change | **Pass** | LOW 97k → MEDIUM 153k → HIGH 251k → ULTRA 348k triangles; shadows off on LOW; trees/AI scale |
| 15 | Sound settings | **Pass (routing)** | master/UI/music gains reach the audio graph. Audible result not checked (no speakers) |
| 16 | Save / restore | **Pass** | reload → “Continue journey” → same position, mode, train, layout; unlocks and lessons persist |
| 17 | Small screen | **Pass after fixes** | 320×568, 390×844, 568×320 |
| 18 | Unusual aspect ratio | **Pass** | 21:9 1600×686, 20:9 915×412, foldable 884×1104, tablet 1180×820 |
| 19 | Weak device | **Not tested on hardware** | the software renderer was auto-classified LOW and stayed stable; real low-end phones untested |
| 20 | Long play (30–60 min real time) | **Not tested in real time** | covered by the 333 km jump test; thermal/battery behaviour needs a device |

Also verified: the APK page makes **zero network requests** (three.js and fonts inlined) and runs; the offline test APK builds
and is signed (target 36, min 24, only VIBRATE permission); every settings option is wired to behaviour.

## Not tested / needs you
* Real Android devices (weak/mid/flagship, tablet, foldable; Android 7–16), WebView versions, frame rate and heat over 60 min.
* `./gradlew bundleRelease` (Gradle + Google Maven unreachable here), AdMob rewarded ads and the UMP consent form on devices.
* Android TextToSpeech voices per language; vibration; back gesture animation; edge-to-edge on devices with cutouts.
* Native-speaker review of the 9 translations and of the store texts; accessibility with TalkBack.
* Play Console: privacy policy hosting, Data safety, content rating, ads declaration, target audience, closed test
  (12 testers × 14 days for new personal accounts), pre-launch report — see `GOOGLE_PLAY_CHECKLIST.md`.

## Known limits
* WebView + WebGL1 (three.js r128): on very old GPUs the LOW tier is the floor; there is no native renderer.
* Station names are generated (not real places); TTS quality depends on the voices installed on the phone.
* Rewards are stored only on the device (no account/cloud); clearing app data removes unlocks (Android backup restores them if enabled).

---

## Update 17 Nov 2026: cabs, HUD, menus and world
Same environment as above (headless Chromium + SwiftShader). Screens from 320×568 up to 1600×686 (21:9).

### What changed
| # | Request | What was wrong → what was done |
|---|---|---|
| 1 | Classic cab | The old cab was a box with a pane of glass in front of the camera, and from some angles you saw sky, then glass again. → Rebuilt: an opaque inner shell that follows the body, one windscreen split by a centre pillar with gaskets (one glass layer, no overlapping transparent surfaces), side and corner windows, a sloped instrument desk with gauges and a display, an assistant console, an inclined panel holding the traction and brake levers, seats, a rear wall and door, a ceiling light and a handrail. The camera was moved to the driver's seat with a slight downward look. |
| 2 | Info bar overlapping other panels | Panels were positioned with fixed offsets and collided on some screens. → The HUD is now a 3-column grid sized from the measured control area (lever and button tops). Each panel is compact and keeps its information. |
| 3 | Roads | Roads started in front of the train and ended in mid-air. → Roads now run to the edge of the loaded land (±1 km) or stop at a slope or water. A blocked end gets a destination (farm, sawmill, quarry, depot, harbour, military base). Villages and industrial zones get exit roads. Cars follow these lanes, and trees keep clear of them. |
| 4 | Training panel | Compact panel with step number and a × button in its header. It sits in the centre column, not over the controls, in both orientations. The levers are mounted on a cab panel, not floating. |
| 5, 9, 13 | Menus, events menu | One sheet model for all menus. The header (title and close) never scrolls; only the body scrolls. The sheet sits above the buttons, starts below the station card or the top info rows, and closes with × or the system Back gesture. The events sheet is at the screen edge, and the HUD reflows next to it: two columns, or one column on narrow landscape screens. |
| 6 | Braking assistant | Smaller panel (distance, predicted stop, scale, advice) in the right column (landscape) or below the clock (portrait). |
| 7 | Station names | Now on a framed double-sided board standing on two posts on the platform, not floating in the air. |
| 8 | Rain in the cab | Drops are drawn on the 3D windscreen. Their number depends on rain strength and speed. Drops run down with gravity and drift with speed and side wind, leaving trails. The wipers sweep a real sector, leave a light wet streak and some edge residue. Other cameras unchanged: no lens drops in chase/orbit, window drops in passenger/walk cameras as before. |
| 10 | Photo mode | “Hide panel” now shows a small semi-transparent “Show UI” button in a corner. It restores the interface without moving the camera and works repeatedly. It also brings back a HUD hidden with “Hide HUD”. |
| 11 | Portrait | Speed and station at the top, then pressure/signal, clock, assistant and lesson. Controls are at the thumb-reachable bottom with safe-area insets. The camera view is shifted so the track and horizon are not hidden behind the controls. |
| 12 | HS cab | The odd step between the side windows and the narrowing windscreen was removed. The windscreen keeps one width and gets a pillar and gaskets. Added: desk side consoles, two mirrored wipers, and an opaque shell up to the nose tip (no seeing the track through the nose). |

### Tests run (all at 6 sizes: 889×400, 640×320, 1180×820, 390×844, 360×640, 884×1104; layout retest also at 533×320, 568×320, 915×412, 1600×686, 320×568)
| Scenario | Result | How |
|---|---|---|
| Classic train, cab camera | **Pass** | screenshots at every size; overlap check of all HUD panels, levers and buttons (0 overlaps, nothing off-screen, no clipped button text) |
| HS train, cab camera | **Pass** | same; earlier close-ups from 6 head positions: no see-through, no geometry in front of the camera |
| Rain in the cab with wipers | **Pass** | heavy rain at 72 km/h: 45–76 drops on the 3D glass; wiper sweep measured by stepping the simulation: classic 66 % → 82 % of the swept area clear, HS 16 % → 56 % (two wipers) |
| Rain in external cameras | **Pass (unchanged)** | chase camera: 3D rain only, the cab glass is hidden, no screen overlay |
| Training with all hints | **Pass** | lesson 3 at 2.6 km with braking assistant + lesson panel + station banner: no overlaps at any size; also with the menu open |
| Traction and brake in the cab | **Pass** | throttle 60 % / brake 50 % → both cab levers rotate (`thrL`/`brkL`), HUD bars and percentages follow |
| Each main menu open/close | **Pass** | in-game menu (close button stays in place after scrolling the body to the end), settings (inner scroll, close visible), event log, main menu ↔ continue, dialog with a long text at 320×568, 640×320 and 1280×720 (title and buttons stay on screen, text scrolls, closes) |
| Events menu | **Pass** | opens at the edge, header button visible after scrolling, closes, HUD reflows |
| Photo mode hide / restore | **Pass** | hide → “Show UI” visible → restore, twice; photo camera position unchanged |
| Landscape / portrait / sizes | **Pass after fixes** | Found and fixed during this run: (1) at 640×320 the events sheet squeezed the centre column to ~60 px; the HUD now switches to the compact row layout there. (2) On the smallest landscape phones (533–568×320) the events sheet now sits at the right edge, above the brake lever. (3) The menu sheet half-covered the clock row in portrait and the station card on tablets; it now starts below them. (4) The “⚙ Events” tab covered the station card; it now flows in the right column and hides while a menu is open. (5) At 320×568 the events sheet hid the banner; its height is now computed from the room under the HUD. (6) After a rainy trip, a new journey with the same train kept the old drops on a dry windscreen; the glass is now cleared at journey start. |
| Regression (basic, mobile, landscape journeys) | **Pass** | no page errors |
| Test APK | **Pass (page only)** | rebuilt and signed; the inlined page from the APK runs offline: 0 network requests, 0 errors, fonts inlined, rain drops on the cab glass. Not installed on a device here |

### Limits (honest)
* All of the above was checked in a software renderer, not on a phone. The wiper and rain timing was verified by stepping the
  simulation, because the software renderer runs slower than real time. Smoothness on real devices still needs checking.
* Rain drops are drawn into one 512 px canvas texture per windscreen. On a large tablet the drops are slightly soft.
* Roads are generated per chunk. Beyond the loaded land (~1 km to each side) they continue only as far as the terrain is
  built, and they fade into the distance fog rather than ending visibly.

---

## Update 17 Nov 2026 (2): fixes from the device screenshots
Device in the screenshots: about 834×375 CSS px landscape. All checks below were repeated at that size too.

| Screenshot finding | Cause → fix |
|---|---|
| Looking back from the cab showed the outside through an arch above the rear wall (both trains) | The rear wall was rectangular, but the roof is rounded, so the arch between them stayed open. → The rear wall now fills the whole body section, with a framed door to the engine room / saloon. The classic cab also has side doors inside. |
| Seats were plain blue boxes | New seats: floor plate, column, cushion, reclined backrest, headrest, armrests, darker upholstery. HS: a central driver's seat and an instructor seat. |
| Classic cab, marked “###”: the corner windows and the pillar strip next to the windscreen looked like holes | One **panoramic windscreen** (no centre pillar) that wraps round the corners with slim corner seams. Behind it: padded A-pillars, then side windows with a sliding-window divider. Every window has **one** faint glass layer, so glass reads as glass. The exterior was changed to match (pillar between the side window and the wrap-round glass). Wipers and rain glass were moved to the single pane. |
| HS: very large side window and sky visible when looking up | The side window is now beside the driver and the same size inside and outside, with gaskets. The roof header over the driver is longer (inside and outside). |
| Menu (red frame): not at the edge, covered the welcome banner | In landscape the in-game menu and the events sheet stand at the **right screen edge, above the brake lever**. The HUD makes room: the station card moves under the speed card and becomes one line. On narrow screens the HUD rows sit between the traction lever and the sheet. In portrait the menu starts under all HUD rows, with a reserved line for banners. If a lesson needs more room than the screen has, the HUD rows **scroll** instead of overlapping or being cut. Lesson titles and event tags wrap instead of being cut with “…”. Layout is re-measured as soon as a panel changes size. |
| “Живлення” bubble over the buttons | Not part of the game: this text does not exist in any of its 10 languages. It is an Android system hint (power/side key), probably from taking the screenshot. |

| Test | Result |
|---|---|
| Look-around from both cabs (front, sides, back, up, down) at 834×375 | **Pass**: closed room from every angle, nothing seen through the body |
| Exterior views of both locomotives | **Pass**: windows match the interior openings |
| Layout at 834×375, 889×400, 640×320, 568×320, 915×412, 1180×820, 390×844, 320×568, 360×640, 884×1104 (free, events, in-game menu, lesson, lesson + menu) | **Pass**: 0 overlaps, 0 cut or squeezed panels. The HUD rows scroll only where the screen is too small for everything: lesson + open menu on 320–640 px tall screens, and the events sandbox with an achievement card at 320×568 and 360×640 |
| Wipers on the panoramic pane (stepped simulation) | **Pass**: classic 76 % of the pane cleared (top corners and the outer edges stay wet, as with real parallel wipers); HS 56 % |
| Full scenarios at 834×375, 390×844, 1180×820 (cabs, levers, rain in cab and outside, every menu, events, photo hide/restore) | **Pass** |
| Regression (desktop, phone portrait, phone landscape journeys), dialogs at 3 sizes | **Pass**, no page errors |
| Test APK rebuilt; its inlined page offline | **Pass**: 0 network requests, 0 errors |

## Update 18 Nov 2026: photo-mode translations
* Three photo-panel texts (“Time of day”, “Hide panel”, “Exit”) were missing from the translation catalogue, so they stayed
  in Ukrainian in every language. They are now translated into all 9 languages (catalogue: 599 strings).
* `tools/build_i18n.py` now scans the page for every `data-t` / `data-tt` text and literal `_T('…')` call and stops with a
  list when one is not in the catalogue, so this cannot slip through again.
* Check: photo mode opened in en, ru, zh, ro, pt, es, fr, de, ja, with the panel shown and hidden. A scan of all visible text,
  titles and the weather list finds no Ukrainian text left (Russian shows Russian).

## Update 18 Nov 2026 (2): menu no longer jumps to the top
* Cause: every choice in the main menu (train, mode, cars, station spacing, language) rebuilt the screen and forced the
  scroll position to the top; the horizontal section strip on phones jumped back to its start too.
* Fix: a rebuild on the same screen restores the scroll position of the list and of the section strip. Switching to
  another screen or opening the menu again starts at the top, as expected. The settings tabs and the language grid keep
  their position the same way. The dialog's first button takes focus without scrolling anything.
* Check at 390×844, 834×375, 360×640 and 1280×720: scrolled down to the trains, picked a train, then a mode. The list stayed
  where it was. At 390×844 it moved up 48 px only because the list became shorter (the HS train has fewer options) and the
  browser clamps to the new end. The section strip kept its position; switching screens started at the top.

## Update 18 Nov 2026 (3): loading screen
* Before: an almost empty black screen with a thin bar that moved in four jumps (5 → 30 → 75 → 100 %). The heaviest part,
  building the world, ran as one block, so on a phone the screen could stand still for seconds. On the first start the
  graphics were initialised before the loading screen appeared, so the menu froze after the tap.
* Now:
  * The loading screen appears immediately; graphics start-up is its first step.
  * The world is built one chunk per step with a painted frame in between, so the bar, the percentage and the step text
    really move: 10 % → 20 % → about 12 chunk steps up to 82 % → 92 % “Preparing the cab” → 100 % after the first frame
    (shader compile) is rendered.
  * Design: a line with the mode and the train (or “Driver training”), an animated track with a train, the step text with
    a percentage, and a “Tip” card whose tip changes every 5 s. Movement uses compositor animations that keep running
    while the main thread is busy, and is switched off for “reduce motion”. Safe areas are respected; a compact layout is
    used on low landscape screens.
  * Translations: 3 new texts in 9 languages (catalogue 602).
* Check: first start at 834×375 (uk), 390×844 (en, schedule + HS), 1280×720 (ja, lesson), 568×320 (de). Continuing a
  saved journey restores position, mode and train; a lesson starts. Desktop/phone regression passes with no page errors.

## Update 18 Nov 2026 (4): loading screen at app start
* Before: when the app was opened, the browser first compiled and ran three.js (about 600 KB) and the game code (about
  760 KB) and only then painted anything. On a phone the player saw a blank dark screen for several seconds.
* Now:
  * The loading screen is part of the page and is **painted first**: title and animated track with the train.
  * A small start-up script then runs three.js and the game code, each in its own task with a painted frame in
    between, so the bar moves: 4 → 10 → 40 → 65 % → 75 % “Starting graphics…” (in the player's language once it is
    known) → 100 % → menu (or the language screen on the very first start).
  * The web page loads three.js from the CDN; the APK build puts it inline as data. Both `android/tools/make_asset.py`
    and the Gradle task `generateGameAsset` were updated to the new `<!--@THREE@-->` placeholder. The Gradle task could
    not be run here (same limitation as before).
* Check: the APK page cold-started with the CPU slowed down 6× (phone-like): the start-up screen was on screen after
  0.37 s, the progress changed 10 → 40 → 65 → 75 → 100 %, then the menu opened, with no errors. First start with a
  Japanese locale opens the language screen in Japanese. Full regression passed after the change: desktop / phone /
  landscape journeys, dialogs, continue, lessons, menu scroll, photo-mode translations, offline APK page with 0 requests.

## Update 18 Nov 2026 (5): volcano and objects in the air
**Volcano (both screenshots).**
* Ash column without the mountain: the event can pick a volcano that the train then leaves behind (150 s at up to
  1000 km/h in the sandbox). The ash particles are drawn at any distance, but the cone was hidden beyond 6.3 km.
  → An erupting volcano stays in view as long as its column does: it is projected onto the same 5.3 km sphere as the
  particles, so the column always rises from its crater. A quiet volcano fades into the haze towards 6.3 km instead of
  popping out.
* Cone in the air: volcanoes stand 1.6–2.4 km from the line, but the ground was generated only to 1.1 km, and the cone
  ignored the fog while the ground at that distance is almost fully fogged.
  → The ground now continues to 3.4 km on both sides. The cone stands on the lowest rendered ground under its foot and
  continues into it. Its fog is height-graded: full haze at its foot, like the ground around it; half haze at the top,
  so it stays visible.

**The same kind of error elsewhere (whole world checked).**
* Spaceport: it also stood beyond the ground, on a floating disc. Now it uses the flattest of 6 candidate places in its
  region on real ground, with a low earthwork whose 1:5 sides take the local ground colour. Where no level place
  exists, there is no spaceport. It uses the same height-graded haze; the rocket launch works.
* 15 placements used the smooth analytic ground height, while the visible ground is a coarser mesh. Between mesh
  points the two differ by up to several metres on hills, so objects floated or sank. Now they use the rendered
  ground, and the lowest point under the footprint for buildings and landmarks. Affected: rocks, bushes and flowers,
  mountain boulders, desert cacti and dry bushes, swamp trees and reeds, town landmarks (church, clock tower,
  stadium, castle, TV tower, water tower, mill), industrial buildings, city blocks, village houses, level-crossing
  details, road-bridge abutments, cars at road crossings, animals, and event objects (landslide rocks, fallen tree
  and others).
* Swamp trees looked like bare posts with detached shadows. They now stand on the ground and look like dead trees:
  leaning trunk, broken top, bare branches, sometimes a sparse crown. There are fewer of them.
* Generation artefacts found during the sweep:
  * Long coloured stripes of flowers, fields and sand on distant ground, and lakes stretched into straight bands at
    300–1000 m. Cause: mesh columns hundreds of metres apart. Fix: mid-distance columns at most ~250 m apart; fine
    detail fades with distance; only large landforms remain beyond ~1 km.
  * A journey save without a clock value made the sky colour NaN; it now falls back to the morning.
* Check:
  * Elevated views of 14 zone and biome types with a fixed world seed (city, village, industrial, station, bridge,
    tunnel, junction, mountains, coast, swamp, desert, forest, fields, lakes).
  * Volcano from the track, from 120 m up, from 900 m, from 5.6–6.2 km, from the HS cab at 274 km/h, through a city.
  * Spaceport from the track, from above, near the site, and during a launch.
  * Regression (desktop / phone journeys, dialogs, continue, lessons, full scenarios at 834×375 and 390×844).
  * Offline APK page: 0 requests, 0 errors.
  * The terrain mesh grew by about 9 k triangles in total (≈ +30 % terrain vertices); draw calls unchanged.

## Update 18 Nov 2026 (6): the train stops and falls silent in menus
* Causes:
  * The in-game menu (MENU button) did not pause the game at all, so the train really kept driving under it.
  * In the main menu, in settings and while paused, the simulation did stop, but the continuous train sounds
    (motor, wheels, wind, surroundings) kept playing at the speed the train had.
  * After leaving a lesson for the menu, no frame updated the sound any more, so the last train sound went on.
* Fixes:
  * The game stands still whenever the in-game menu, settings, the event log or the main menu covers it. The player's
    own Pause is kept separately: closing a menu does not unpause a game the player had paused.
  * The events sandbox panel is a control panel for driving and does not stop the train.
  * While the game stands still, the train and surroundings sound buses fade out in about 0.3 s, the horn stops and a
    station announcement being spoken is cancelled. Interface sounds and music stay.
  * With no journey running, the train sound stays silent.
* Check (834×375):
  * Driving at 72 km/h, then the in-game menu: the position did not change in 1.5 s and the train sound was 0.
    After closing, the train drove on and the sound came back.
  * Main menu: the train stands still and is silent; Continue resumes.
  * The player's pause survived opening and closing the menu and settings.
  * Settings and the event log pause and resume.
  * Lesson → menu: silent.
  * Events panel: the train keeps driving.
  * Regression and full scenarios pass.

## Update 18 Nov 2026 (7): biome system
* World structure:
  * The line runs through regions of 7–20 km, each one of nine biomes: cherry blossom (sakura), grand mountain range,
    dense evergreen forest, golden grasslands, desert and canyons, alpine meadows, wetlands and lakes, autumn forest,
    and the mixed temperate land of the earlier versions. Neighbours follow geography (mountains ↔ alpine meadows,
    evergreen forest or desert; desert ↔ grasslands, alpine slopes or mountains; wetlands ↔ forests, plains, sakura…).
    The same region never repeats back to back or within three regions; a biome that has not been seen for a while
    becomes more likely, so all nine come back on a long trip.
  * Everything is deterministic from the world seed and is computed per point along the line, so chunks stay continuous
    and the same world comes back after a restart.
  * Between two regions there is a 2.6 km transition (4 km into and out of the mountains). Weights change with a
    smoothstep; every tree belongs to one of the two regions with these weights, so the species mix changes gradually.
* What a biome changes:
  * Relief: high ridged peaks (up to ~1.6 km above the line) and foothills in the mountains, distant ranges seen from the
    alpine and evergreen regions, mesas and terraces in the canyon variant of the desert, dunes, lakes in the wetlands,
    gentle hills on the grasslands. Snow line and bare-rock zone depend on altitude, lower in cold regions.
  * Ground colours: golden grass, alpine green with flower spots near the line, fallen petals and leaves under the
    groves, sandstone strata, mud in the swamps.
  * Vegetation: spruce/fir/pine forests, cherry trees and cherry alleys, oak/maple/birch in autumn colours, willows and
    dead snags in the wetlands, cacti and sandstone pillars in the desert, hay bales on the plains.
  * Settlements and zones: house styles per region (Japanese-style in sakura regions with pagodas and torii, adobe in
    the desert, mountain chalets), more tunnels and gorge bridges in the mountains, more bridges in the wetlands.
  * Particles: drifting cherry petals and autumn leaves around the camera (never inside the cab or carriage).
* Seeing far:
  * A far landscape layer (polar grid to 38 km) is drawn first with the sky, then the detailed chunks on top. It uses
    the same height and colour functions as the chunks, shows forests as a canopy layer, and is cut out exactly
    (per pixel, in world space) under the detailed chunks. It is rebuilt in the background in small slices (1.5–2.5 ms
    per frame) when the camera has moved 900 m.
  * Height fog: haze is thick in the valley and thin higher up, so mountain ranges stay visible above it from many km.
  * No pop-in: the objects of the newest chunks (houses, trees, poles) appear with a dither over ~400 m at the edge of
    the generated area instead of appearing at once; the oldest chunks behind fade the same way before they are dropped.
* Bugs found and fixed while testing:
  * The far layer's triangles faced downwards: from above it was invisible and from the ground only the back sides of
    distant hills showed (dark silhouettes). Fixed the winding; mountains and plains are now lit correctly far away.
  * The cut-out under the near chunks interpolated line coordinates over huge far triangles and could cut wrong holes.
    Replaced by an exact per-pixel test against the line polyline.
  * Canopy beyond the tree belt started with a steep edge (dark line at ~300 m) and covered sparse orchards fully;
    now it rises over 230–520 m and covers only the share of the ground the crowns hide.
  * Alpine green and flower spots were too saturated; far cherry canopy looked like snow; autumn far canopy too bright.
* Check (Chromium + SwiftShader, software rendering; frame times there are not meaningful for phones):
  * All nine biomes from the cab and from a free camera 60 m up; approach views 6 km before mountains, sakura, alpine
    and autumn regions: the mountain range is visible on the horizon before the region starts.
  * Transitions grassland→autumn, evergreen→mountains, alpine→sakura, wetland→grassland, desert→mountains at
    −2.6 … +2.6 km from the border: weights 0.03 → 0.31 → 0.69 → 0.97, no visible seam.
  * All 10 cameras (cab, walk, carriage window, chase, cinematic, roof, rear, free orbit, photo, map) in a mountain
    region at 834×375, and cab/chase/orbit/map in portrait 390×844 (lens shift): far layer and chunks line up.
  * High view towards the generation edge: no hole, no gap between near and far land.
  * Variety: 4 seeds × 400 km: all nine biomes in every seed, no region repeated back to back.
  * Performance against the previous build, same seed and places (10 views, high and low tier): draw calls −15 … +11,
    triangles similar or lower (far layer adds ~3.7 k triangles in one draw call); chunk build 15–21 ms as before.
  * Long run 391 km: memory flat (heap 73 MB, geometries 90–135), no growth.
  * Regression: UI scenarios at 834×375 and 390×844 (no overlaps), dialogs, continue/save, pause in menus (train
    stops, sound off), menu scroll, photo-mode translations in 9 languages, driver lessons, desktop/phone/landscape.
* Not checked: a real phone (GPU fill rate of the far layer and the dither on a mobile GPU).

## Update 18 Nov 2026 (8): the main theme is the default music
* The "Endless Rails" trailer theme (96 BPM, C minor, 30-bar loop of 75 s, fully synthesized with Web Audio, no audio
  files) is now the game's music by default:
  * it starts on the first tap in the main menu (browsers allow sound only after a gesture) and carries on into the
    journey without restarting; it keeps playing in menus and pause like the music did before;
  * it loops; the "next track" button still plays the four older tracks, and after one of them (2.5–4.5 min) the theme
    comes back; with music switched off nothing is scheduled; switching it on starts the theme again;
  * trailer impacts/risers stay off (calmer for driving); level: about the same as the train sound at 108 km/h with the
    default volumes (music bus −29 dB, train −28…−29 dB).
* Adaptations for phones (the melody, chords, rhythm and arrangement are unchanged):
  * oscillators that always sound together at the same pitch are merged into one oscillator with the summed spectrum
    (pluck = 0.6 saw + 0.4 sine, bass = sine + octave + a little saw); all voices of a pad chord share one envelope;
    bell partials stop when they are ~48 dB down instead of ~61 dB. Spectrum per instrument and per section matches the
    original within about 1 dB.
  * Audio-thread cost in the densest part (climax): from 2.9× to 3.5–4.0× faster than real time (offline render in
    Chromium on a 2.3 GHz Xeon core); the opening sections 1.6×.
  * Low graphics tier (weak devices): lighter arrangement — no string layer, no quiet octave doublings, two pad voices
    instead of three, shorter reverb, three delay taps instead of five: climax 5.9–7.1× real time, same loudness.
  * The notes of a bar are created in six parts on successive 100 ms timer ticks, 1.6 s ahead: the longest main-thread
    task is 2.6 ms (bar 22 drum fill), typically 0.3 ms, instead of up to 5 ms for a whole bar. A bar whose time already
    passed (main thread stalled) is skipped instead of firing all its notes at once.
* Check:
  * Menu: no sound before the first tap, theme after it; journey start: the same theme continues (bar 6 → 7).
  * Music off: 0 voices left; on: theme from the start; next track → "Midnight Synth"; after its time → theme again.
  * 3.5 minutes of driving (almost three loops): 53–121 live voices depending on the section, queue empty, JS heap flat
    at 51 MB.
  * Regression: pause in menus, UI scenarios at 834×375 and 390×844, dialogs, continue, desktop journey.
* Not checked: the sound on a real phone (only the offline render and the browser's audio clock were measured).

## Update 18 Nov 2026 (9): final technical audit, optimisation and world quality
Backup before the stage: git tag `backup-before-final-audit` (commit a90dc98).

### Audit
Four parallel code audits (world placement, audio, memory/lifecycle/per-frame cost, traffic/people/cameras), each
finding checked against the code and, where possible, measured with the game's own code. The fixes below come from them.

### Bugs fixed
* **Train driving into a volcano with a town inside.** A volcano's position was fixed once from the route as it was;
  flipping a switch re-routes the line beyond the junction, so the new line could run through the cone (in a simulation
  57 of 114 cases with a flip before a volcano). Now: exclusion zones — a volcano is placed only where no point of the
  line within ±20 km comes closer than its foot (1.45·base radius) plus 700 m, and away from other landmarks; the
  spaceport likewise (1250 m, ±15 km). After a switch flip, landmarks beyond the junction are placed again against
  the new route. Check (4 seeds, 14 regions each, then 4 switch flips): 0 landmarks closer than allowed, before and
  after flips; the closest is 1.34× the exclusion radius.
* **Track positions became NaN** after a switch flip at a junction beyond the computed part of the route (the arrays
  were grown with holes). Rerouting now only shortens.
* **All people were drawn black**: their colour buffer was created with size 0. Fixed (also every passenger before).
* **Alighting passengers floated** 1.3 m in the air behind the platform; they now walk to the station entrance at
  the back edge of the platform.
* **Cars through city stations**: traffic lanes are cut where they would cross the station area (as the drawn streets).
* **Cars queuing on the rails** at city level crossings behind a red light: no traffic light at the junction right
  behind a crossing.
* **Traffic lights missing** at most junctions: 40 poles (10 junctions) go to the nearest lit junctions within 320 m.
* **Town stations**: cars drive on the drawn streets (±34 / ±80 m), not on the verge.
* **Village houses and industrial objects on crossing roads**; **trees inside village houses**: lots and objects keep
  the crossing road free; no wild trees in the rows of houses.
* **Chase / orbit camera thrown onto the mountain** when turned inside a tunnel: the camera stays inside the tube's
  cross-section. Tunnel haze is dark instead of bright sky colour.
* **'Carriage window' camera inside a seated passenger's head**: that window seat stays free.
* **Station-name textures and materials leaked** on every new journey / language change and could show the previous
  language; volcano / spaceport meshes and the rocket were not disposed on reset. Fixed.

### Audio (rebuilt)
* One audio graph with categories, each with its own volume in Settings → Sound: engine, wheels and rails, horn,
  brakes and air, doors and cab alerts, nature and stations, weather, other traffic, natural events, plus announcement
  voice (translations in all 10 languages).
* Volume applied once (one-shots no longer multiplied by the slider and the bus again); all volume changes ramp.
* Nothing is generated while the game is held (pause, menus): measured 0 audio nodes in 3 s of pause.
* Page hidden: the train sound is held and speech stopped before the context is suspended (no burst on return).
* Speech: a station announcement may interrupt, other messages queue behind it; music (−8 dB) and surroundings
  (−4 dB) duck under speech; nothing is spoken while held.
* One-shot voices capped at 32 (also joints, clanks, other trains' horns); interface sounds are never dropped.
* Thunder no longer cut off; horn preview in Settings audible; external cameras far from the train hear it quieter;
  each new journey starts from silence; a failing audio start can no longer break the game loop.

### Music from prepared files
* `src/music/*.ogg`: the main theme (from its composition code, unchanged) and the four older tracks, rendered once
  offline into seamless loops (Ogg Opus 128 kbit/s, 48 kHz, −20 dBFS RMS; 6.0 MB together). Nothing is synthesized at
  run time any more. Chromium decodes them sample-exactly (test impulse at sample 1000 decodes at 1000; lengths exact);
  the jump at each loop seam is 0.03–1.2× an ordinary sample step (no click).
* One track plays at a time (12 rapid "next track" requests → 1 voice, 1 decoded buffer); 2.5 s crossfades; at most the
  playing and the next track stay decoded; failed loads back off (20 s, 40 s … then stop).
* Packaged by Gradle and by the test-APK script into `assets/music`. Regenerate with `tools/music/render.js`.

### Background world generation
* Chunks beyond the visible window are pre-built while the train stands, while paused (no game time passes) and with
  spare frame time while moving; they wait outside the scene and are taken when the train gets there.
  Priorities: chunks at the train (at once) → visible window nearest first → pre-generation. Main menu: none.
* Budget: by mode (stopped 7 ms, pause 4 ms, photo 3 ms, moving 4–8 ms growing with speed) × headroom from frame
  rate and battery (Battery API where available); cache size 3–8 chunks by tier, halved on ≤ 2 GB RAM or low battery.
* Measured: 5 chunks pre-built in 10 s of pause with the train and the clock unchanged; cache hits when driving on;
  nothing built in the main menu.
* Settings that change chunks (quality tier, language, train) rebuild them one by one instead of all in one frame.
* A finished chunk no longer keeps its build buffers (they stayed referenced through a closure).

### Less work per frame
Rain and snow (8000 lines / points) not drawn in dry weather; particle systems skip their slots when nothing is alive;
people meshes are not uploaded when nobody is on a platform, and crowds of stations left behind are dropped;
rendering at half rate while paused; fewer audio automation events per second.

### World
* Cities: some blocks are squares with a fountain (centre), parks (lawn, paths, trees, benches, lamps) or car parks
  (bay lines, parked cars); zebra crossings at the central junctions; bus stops with shelters every second block.
* People: shoulders-wide torso with a neck, oval head, hair in natural colours (or a hard hat), arms swinging against
  the legs (the hand with a suitcase stays down), everyday clothing colours, smooth turning, step rate tied to speed.

### Checks
* Regression: UI scenarios at 834×375 and 390×844 (no overlaps), dialogs, continue/save, pause in menus, menu
  scroll, photo-mode translations in 9 languages, sound settings with 15 sliders (en, de: no overflow), driver lessons.
* Long run 350 km: JS heap flat at 30 MB (73 MB in the same test before this stage), geometries 78–104.
* Same seed and places against the previous build (10 views): draw calls −11 … 0, triangles lower or equal
  (dry weather), one view +4.7 k (people).
* Offline APK served like the app's asset loader: 0 network requests, 0 errors, theme playing from assets/music.
* All measured in Chromium with software rendering (SwiftShader): frame times there say nothing about phones and are
  not reported; FPS, GPU load and battery were not measured on a device.

### Not done in this stage (remaining)
* No worker threads: the generator shares the whole world state and three.js objects must be created on the main
  thread, so background generation is time-sliced on the main thread; GPU upload of a pre-built chunk still happens
  when it enters the scene.
* Train and carriage models were not remodelled; villages got fixes but no new buildings (shops, farms, bus stops);
  no new road types (motorways, roundabouts, flyovers).
* Known placement issues still open: city blocks can overlap on tight curves; tunnels can be cut through low ridges on
  flat land; river valleys under bridges are rectangular and gorges have water; roads to farms/sawmills can end on a
  slope; wildfire / landslide / tsunami events do not check what they land on; helicopters can fly through high peaks.
* Traffic: side streets end next to the line (cars turn there), 90° turns at speed, no right of way at unlit junctions,
  cars appear 170 m away in view. Cameras: no collision with buildings for cinematic shots at stations.
* Not tested on a real phone.

## Update 18 Nov 2026 (10): open tunnel portals, long rivers, road network
### Tunnels
* Cause of the "wall" in front of the portal: the land is a height map, and between the last row of the cutting (track
  level) and the first row of the mountain it rose as a steep face that stood 0–16 m behind the portal — right in the
  arch opening. From afar the opening looked closed, and the train drove through that face.
* Fix in the terrain mesh: over the opening (±7 m around the tube axis) those cells are left out; the mountain is closed
  by a slope that starts just below the top of the headwall (hidden behind it). Entrance and exit are open: from afar
  the dark tube with its lamps is seen through the arch; at night the lit tunnel shows in the dark slope.
* A light stripe ran over the whole mountain along each tunnel (ballast, cutting and "track side" ground colours were
  applied over the tunnel). Over a tunnel the ground is now coloured as ordinary mountainside.
* Lighting fades in and out with the existing tunnel transition; tunnel reverb on train sounds as before.

### Rivers
* Every river is one long winding channel (`Rivers`): it crosses the line under its bridge and continues on both
  sides through the whole detailed land and the far landscape (no start or end in view). Bends on three scales grow
  with the distance from the line (up to ~700 m) and never reach the towns along the line; the width changes along the
  course; banks are shallow on low land and form valleys or gorges in high land. Chunks and the far layer evaluate the
  same functions, so the river continues between chunks without seams.
* Widths: most rivers 80–140 m; big rivers 220–440 m; in low wet land some crossings are bays or estuaries 0.6–1.2 km
  wide that open out further away.
* Long bridges for wide water: repeated 60–90 m spans on piers with cutwaters standing in the water — continuous steel
  truss, a row of concrete arches, or a girder viaduct — besides the earlier single-span truss, arch and beam bridges.
  Measured in one world: bridges of 1.2 km (truss) over a 1 km bay; the train rides over open water.
### Roads
* Every road leaving the line (level crossings, underpasses, overbridges, village and industrial exits, the road along
  the river) is part of one network (`Roads`): straight for its first 60 m, then it winds with the land (tighter in the
  mountains), crosses rivers on road bridges with piers and railings, and runs 3.3 km out to the edge of the detailed
  land, where it fades into the haze. The road along a river follows its bank.
* Destinations along it: a farm, sawmill, harbour or quarry a few hundred metres out (beside the road, not at a dead
  end), and a hamlet or village of 6–13 houses 1.3–2.8 km away, some with a church.
* Trees and rocks keep off the winding roads; cars follow the curves (heading along the road, on bridge decks over water).
* Level of detail: 12 m segments near the line, 24 m and 40 m further out; centre line and shoulders only where they
  can be seen. Roads cost ~8 k triangles in a typical view.

### Checks
* Portals from 90 m and 420 m in front, from the side, from the cab, entry and exit, day and night: the opening is open.
* Rivers: high views across and along a gorge river, a big river and a 1 km bay; cab and chase views on the long
  bridge. Roads: high and low views of a crossing road, a village exit and the river road; a top view of a crossing.
* Long run 330 km: no errors, memory steady. UI scenarios at 834×375 and 390×844. Landmark exclusion zones still
  respected (4 seeds, with switch flips).
* Not done: rivers do not change the shape of the far ground between the far-layer rings (narrow rivers far away are
  coarse or invisible); no road tunnels or serpentines with hairpins; a few roads still run straight on flat land
  for a long way; tunnels can still be placed under low ridges on flat land. Not tested on a phone.

## Update 18 Nov 2026 (11): landscape screen by default
* Android: the activity starts in landscape (`sensorLandscape`: either way round, following the sensor) instead of
  following the phone. Checked in the built APK manifest (screenOrientation = 6).
* Settings → Graphics → Screen orientation: "Landscape" (default) or "Like the phone (portrait too)". The choice is
  applied at once through the app (`AndroidApp.setOrientation`) and at every start; all portrait layouts stay available.
* Browser / standalone page: the game asks for a landscape lock; browsers grant it only in full screen, so it is
  requested again on entering full screen. Outside full screen a browser keeps following the phone.
* Check: default → native "land" + landscape lock requested; switching the setting → native "auto" + unlock.
  Labels translated in all 10 languages. Not tested on a phone.
