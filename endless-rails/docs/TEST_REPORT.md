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

## Update 19 Nov 2026 (12): visual quality overhaul
Backup before the work: git tag `backup-before-visual-overhaul`. Same art style (flat-shaded low-poly, vertex colours, no
bitmap textures except the existing window textures), same mechanics, cameras, trains, events and settings.

### Vegetation
* New tree models for every species (oak/maple/lime, birch, poplar, willow, pine, spruce, fir, cherry, bush): crowns
  of several irregular lobes, darker underneath and lighter on top, so no two trees have the same silhouette; round
  trunks and two branches close to the line; conifers with tiers turned against each other; willows with hanging
  strands; birches with dark bark marks.
* Level of detail per chunk: detailed plants near the camera, simple crowns further away (switch with hysteresis,
  distance by quality: 250 / 330 / 380 / 480 m for Low / Medium / High / Ultra). Low quality builds the simple plants only.
* Wind: every plant sways in the vertex shader, the top more than the bottom, each with its own phase; amplitude
  follows the weather's wind and rain; nothing moves while the game is paused.
* Ground cover next to the line, by biome: grass tufts (with flowers in meadows), ferns in forests, reeds by the
  water, dry shrubs in arid land. Not built on Low.
### Road vehicles
* Bodies are extruded side profiles (bonnet, windscreen, roof, rear window, boot) with glass bands, grille, bumpers,
  mirrors, head and tail lights; new types: hatchback, estate, SUV, pickup (with an open bed); sedans, taxis, police,
  vans, ambulances, minibuses, buses, box trucks, semi-trailers, fire engines, tractors and railway service vans keep
  their own shapes. Paint has a light environment reflection (switched off on Low).
* Wheels are no longer part of the body: every road wheel is one instance of a tyre-rim-spokes-hub model in a single
  instanced mesh (1 draw call for all traffic) and rolls with the distance the vehicle drives. Speeds vary per car.
### Birds
* New `Birds` system: flocks by landscape (gulls over water and river crossings, storks in wetlands, a soaring raptor
  over hills, sparrows and crows at forest edges, swirling starling flocks over fields and towns). Body with head, beak
  (coloured: yellow for gulls, red for storks), light belly and a fanned tail; two-part wings that beat, glide or are
  folded per species. Ground flocks sit near the line and take off when the train comes within ~70 m.
* At most 2 / 3 / 4 / 4 flocks and about 29 / 50 / 72 / 90 birds on Low / Medium / High / Ultra; none at night, in heavy rain or snow, in tunnels;
  2 draw calls in total.
### Trains
* Passenger cars: rubber gaskets around every window, a drip rail over each window and rain gutters along the roof
  (classic cars), side buffers on a red buffer beam at both ends (classic cars; high-speed cars stay smooth). Sliding
  door leaves now have a framed window on both faces.
* Classic locomotive: window gaskets that follow the narrowing nose, radiator louvres along the engine room, a hand
  rail with stanchions, buffer beam with buffers at the rear.
* Freight locomotive: hood door seams and handles, sand boxes over the bogies, sun visors over the windscreen, horns on
  the cab roof. Freight wagons: buffer beams and buffers at both ends, corner ladders on box, tank and hopper wagons, a
  hand-brake wheel, a grime band along the frame.
* Unchanged and still working: rotating wheelsets on every train (instanced), sprung bogies, couplers, gangways, lit
  interiors with seated passengers, steam locomotive motion.
### People
* Build varies (slim to heavy: torso, shoulders and leg spacing), long hair for about a third of the people, skirts,
  backpacks; suitcases, workers' vests and hard hats as before. Three more instanced meshes (10 for up to 220 people).
### Buildings
* Apartment blocks on High/Ultra: a balcony slab with a glass or painted railing on every floor (the cheaper full-height
  balcony column remains on Low/Medium); antenna masts and satellite dishes on flat roofs (Medium and above).
### Fixes found on the way
* Photo mode: on the first frame after switching to it the free camera was still at the world origin (it was placed
  after it had been used); anything measuring distance from the camera saw it there (e.g. birds were removed). The camera
  is now placed before use.
* Console warnings removed: `vertexColors` passed as undefined and `toNonIndexed()` on already non-indexed templates.
### Graphics settings
* The four tiers (Low / Medium / High / Ultra, plus Auto by device with frame-rate adaptation) already scaled draw
  distance, fog, shadows (off / 1024 / 2048 / 4096), tree density, scene detail, particles, precipitation, window
  texture resolution, anisotropy, lighting model, traffic, AI trains, passengers and clouds. New knobs tied to them:
  detailed-vegetation distance and ground cover, car-paint and train reflections (off on Low), bird counts, per-floor
  balconies (High+), roof clutter (Medium+).

### Checks (SwiftShader software rendering in headless Chromium; no phone or GPU was available)
* Visual: tree close-ups per species and biome; car showroom (16 types, both rows) with the instanced wheels; live
  traffic: wheel instances = 2 × axles of every car, spin follows the speed; bird close-up of every species and
  flocks over water/fields; train showroom (classic, high-speed, freight, steam: front, side, bogie views); people
  line-up front and back; time of day (06:12, 12:00, 18:54, 22:30) in the country and in a city.
* Performance, High, same seed and positions, AI trains off, after 2.6 s per view (counts include the far land pass):
  triangles −9 % … +66 % per view against the version before this work (desert/sakura views about the same; forest
  views gain the most: in an autumn forest about +37 % triangles per loaded chunk), draw calls −12 … +24 per view.
  Part of the spread is how many chunks had been built at that moment (it differs between runs). Low tier: 61–157 k
  triangles per view. CPU per frame in this harness stays at 1–2 ms; chunk build time 15–23 ms (unchanged). Real GPU
  frame times could not be measured here.
* Memory: JS heap 78 MB vs 69 MB in the same session before the work; long run of 354 km: heap steady at 111 MB,
  geometries 86–155 and textures 14–15 with no growth.
* Regression, all passed with no page errors (the only console error is the blocked web-font request offline):
  boot/desktop/phone/landscape scenarios; HUD and menus at 8 screen sizes (no overlaps, sheets close); dialogs at
  3 sizes; continue/save; quick menu pausing; menu scroll memory; photo-mode texts in 10 languages; stress jumps over
  130 km; events (balloons, meteorite, retro train, eclipse) with AI steam and freight trains.
* `modes.js`, an old test for the earlier menu layout, times out on its first click on both the previous and the
  current version (it is out of date, not a regression).
* APK rebuilt (offline test build, signed, `apksigner verify` OK): served like the app's asset loader it boots, plays
  the theme and makes no network request, no errors. Standalone page: boots offline, music plays, no errors.

### Not done / known limits
* No new bitmap textures or imported 3D models: everything is still generated geometry with vertex colours (the
  game's style). Real PBR materials, normal maps or photo textures would need asset files that are not in the project.
* Trains have no level of detail: the new small parts (gaskets, buffers, ladders) are drawn at every distance.
* Road vehicles do not steer their front wheels or lean; cars standing in car parks keep their older simple shapes.
* Birds do not land on trees or wires (ground flocks only); no flocks crossing exactly over the line on purpose.
* People: no new animations (sitting, phone, waving); faces are not modelled.
* Lighting, weather, meteors, volcano, rockets, lightning and fog were reviewed in screenshots only and left as they
  were (they already had their own systems); no bloom or post-processing was added.
* Not tested on a phone or a desktop GPU: frame rates on real devices are unknown.

## Update 19 Nov 2026 (13): previous trees back; roads without breaks or false crossings
### Trees
* At the player's request the new tree models of update (12) are removed and the previous ones are back, exactly as
  they were (same code, in the same chunk mesh, casting shadows as before). The grass, ferns, reeds and dry shrubs next
  to the line stay (they sway in the wind and are shown within 250 / 330 / 380 / 480 m by quality tier).
### Roads that seemed to cross the rails without a level crossing (cause and fix)
* Villages drew a short lane from the village street to 12 m from the track every 78 m, on both sides at the same place:
  pairs of road stubs facing each other across the tracks. Removed: the only road to the tracks is the level crossing's.
  Towns keep short streets between their inner and outer streets, staggered between the two sides (39 m apart), and
  houses keep off them.
* The roads that leave a village, town or industrial area also came in pairs facing each other at each end. Now each
  end has one exit on each side of the line, 150 m apart along it (156 m in industrial areas); the street of that side
  runs on to it (`Rail.exits`, used by the scenery, the road network and the traffic alike). An exit that would run
  through an engine depot moves out beyond it.
* Check over 5 worlds (260 settlements, 1040 exits): no pair of exits closer than 140 m, none on a depot, no road start
  facing another across the line except at level crossings and bridges. Winding roads never come within 15 m of the
  track (3 worlds, every road).
### Roads broken into dashes (cause and fix)
* The rendered ground is a mesh of rows every 8 m along the line and columns from 2 m to 500 m apart; roads ran in
  straight pieces of 12–40 m between points on that mesh, so wherever the ground folded between two points the road
  went under it: measured in two worlds, ~32 % of the road pieces sank partly under the ground (by up to 164 m where a
  long piece cut through a ridge).
* Now: pieces are at most 12 / 24 / 32 m of real length (near / middle / far), and within 1 km of the line every piece
  is split exactly where its centre or an edge crosses a row, a column or a cell diagonal, so it lies on the ground
  plane by plane; further out each edge and the centre are lifted only where the ground rises above the straight line
  (average lift 0.3 m). Result: 1–5 % of pieces touch the ground somewhere (mostly by centimetres), 0.4–0.9 % by more
  than 0.3 m, all 1–3 km away.
* Road and street surfaces (winding roads, crossings, village / town / city streets, exit roads) use their own material
  with a depth offset, so they stay in front of the ground at any distance; before, beyond ~600 m the depth buffer could
  not separate the 7 cm between road and ground and roads flickered into dashes.
* Cost: road surfaces 5–18 k triangles per view (High), one extra draw call per chunk; chunk build 21 → 27 ms on
  average over 12 chunks (roads ~4 ms per road, the rest grass and town balconies), built in the background.
* The part of a level crossing's road that lies over the tracks keeps the ordinary material (rails and crossing panels
  stay on top), and the white stop lines are drawn with the road material so they stay visible on it.
* Views checked: top-down over 6 settlement ends, high oblique views over a village, a town and a forest region
  (like the cinematic camera), a close and a raised view of a village level crossing (compared with the previous
  version: same crossing, stop lines and rails visible, the lane stub beside it gone).
* Regression after the change, all passed with no page errors: boot (desktop, phone), long run 334 km (heap steady at
  69 MB), stress jumps, events with AI trains, HUD at 8 screen sizes, continue/save, quick menu. Village traffic uses the
  new exits (4 exit lines, cars drive out on them). The old `traffic.js` finds no cars at its underpass on the previous
  version either (out of date). APK (offline: no network request, no errors, music) and standalone page rebuilt and
  checked.
* Not changed: in a city the cross streets still end at the street along the line (T-junctions) on both sides; roads
  still end 3.3 km out at the edge of the detailed land; on the inner side of tight curves (radius 620–3200 m) the far
  part of a road can come back closer to the line (it never reaches it); not tested on a phone.

## Update 19 Nov 2026 (14): camera look — natural axes, horizontal inversion, full turns
* One convention for every camera: the view follows the finger or mouse — drag up to look up, drag right to look
  right (before, the cab, carriage-window, roof, rear, walking and photo cameras worked the other way round: drag up
  looked down and drag right turned left, while the chase and free cameras already followed the finger). The gamepad's
  right stick follows the same rule.
* Settings → Controls: "Invert camera vertically" (as before) and new "Invert camera horizontally", both off by
  default, translated in all 10 languages. A vertical inversion saved by an older version meant the opposite, so older
  saves start from the new default once.
* Full turns: the cab, roof, rear, carriage-window and walking cameras had their turn limited (±171° in the cab, ±180°
  on the roof, at the rear and walking, ±80° at the carriage window); now they turn all the way round in either
  direction without stopping, and look up / down to ±83° (was 46–69°). The chase, free and photo cameras keep turning
  without limit as before.
* The row of the carriage-window camera is left free of passengers (turning round, a face right beside the camera
  filled the view).
* Check (simulated drags in every camera, default and with both inversions): drag up raises the view and drag right
  turns it right in all 8 look cameras; with the inversions both flip; 26 drags to the right turn every camera
  536–969° continuously. Views looking backwards in the cab (classic and high-speed: rear wall, door, seats) and across
  the carriage. Settings tab shows both options (Ukrainian, English). Regression: boot desktop / phone, HUD at 8
  sizes, quick menu, continue/save, photo-mode texts — no page errors. APK and standalone page rebuilt and checked
  offline. Not tested on a phone.

## Update 20 Nov 2026 (15): the station cat (secret event)
### The animation: the player's own clip, not a remake
* Source: the attached clip `tools/cat/station_cat_source.mp4` — 164×192 px, 49 frames, 10 frames/s (every frame
  100 ms, 4.9 s loop), checked with ffprobe. All 49 frames are used in their order; nothing is redrawn, added or dropped.
* The cat is cut out of the clip's background (blue patterned seat, dark garden, the green diamond floating above it)
  by `tools/cat/make_cat_atlas.py`: BiRefNet segmentation (rembg, `birefnet-general-lite`) on 4× upscaled frames,
  then colour clean-up of the fabric and the diamond, the cat's connected shape only, small holes closed, and a 5-frame
  majority mask against stray background bits. All frames share one crop box, so the cat's own movement inside the clip
  (head bobbing, leaning) is kept exactly; colours are bled under the transparent margin (no dark fringe when filtered).
* Packed into a 1024×1024 WebP atlas (8×7 cells of 124×140 px — about 1.5× the source pixels, so no detail of the clip is
  lost; 222 KB, ~4 MB of video memory) and embedded in the page (`CAT_ATLAS`), so the web page, the APK and the
  standalone page all carry it without extra files.
* Playback: frame = elapsed real time / 100 ms, looped over the 49 frames — the clip's pace exactly, independent of the
  frame rate (no drift, no slowing down or speeding up; at low frame rates some frames are simply not drawn, the timing
  stays right); it keeps playing while the game is paused or in photo mode. Measured: the frame shown matched the clock
  in 26 of 27 samples (the other was on the boundary of the next frame), the texture window matched the frame in 27/27.
* Shown as a camera-facing picture (always seen from the front, the way the clip was filmed), aspect kept, 0.61 m tall
  (the cat about 0.58 m), with a soft contact shadow; unlit material so the clip's own colours stay, dimmed by daylight
  (lit by the platform lamps at night).
### The event
* One cat per game day (a day counter was added: it advances when the clock passes midnight, saved with the journey).
  Each new day the cat moves to one of the next three stations ahead (within 70 km), chosen from the world seed and the
  day; it never appears in trains, cabs or carriages, only on the main platform (beside the player's track).
* Its spot: 1.65 m in from the platform edge, between the yellow line and the line of overhead-line masts, at least 4 m
  from anything standing there (masts, clocks, platform number boards, footbridge pillar and stairs) and 2 m from
  benches, bins, lamps and boards at the back; under open sky where possible (not under canopies, shelter roofs or the
  footbridge). Passengers keep 7 m clear of it along the platform (waiting, strolling, getting off).
* Only one cat exists, only while its station is within 1.8 km; it and its texture are released 3 s after the station is
  left behind and loaded again when needed. Checked 3 times in a row: always exactly 2 objects (cat + shadow), the
  texture count goes back down, nothing accumulates.
* Saved with the journey: game day, station, spot and the next shot; after a restart the same cat is back (checked).
* Event sandbox: a "Station cat" button puts today's cat on the next station ahead and brings the train near it with the
  cinematic camera on (for trying it out; translated in all 10 languages).
### The cinematic camera always films it
* Every frame the cinematic camera asks whether the cat is due: its station is being approached (from where the
  station is still fully drawn — at most 520 m, less on lower quality, so the camera never looks at half-dissolved
  scenery), passed or stopped at, and the cat has not had its shot during this visit (again after 70 s of standing).
  Then the running shot ends, a cat shot starts through the usual fade, and the normal shots continue afterwards.
  Recorded in a scenic ride: low → side → cat (515 m before the station) → front → fly.
* Five shots, taking turns from visit to visit; each is planned from where the cat actually sits, in the station's
  straight local frame, with several variants (side, height, offset):
  1. close-up intro — a slow dolly along the platform to the face and headphones (cat 60 % of the frame height);
  2. station wide shot — high and wide over the platform end with the station in view, then lower and closer until the
     cat leads the frame (16 % at the end);
  3. train & cat — low from the back of the platform, looking towards the side where the train stands or comes from,
     so the cat is in front and the train behind it;
  4. side / over-the-shoulder — just behind and beside the cat, sliding slowly round it, station and tracks beyond;
  5. hero shot — 20 cm above the platform looking up, slowly circling the cat, on the sun side when possible.
* A variant is used only if, at five moments of its move, the camera stands in free space (over the platform where it
  is over it, above the ground elsewhere, at least 1 m from anything standing on the platform, so no post fills the
  edge of the frame), sees the cat's head and body past every obstacle of
  the platform (the same boxes the station builder uses: masts and wire arms, lamps, canopies, clocks, boards, benches,
  footbridge, shelter roofs) and past the train, and the whole cat stays inside the frame with a margin, computed with
  the real camera's aspect and lens. If the due shot cannot be filmed at that spot another one is used; if none passes,
  the two close shots are tried with the frame check only, so the cat is never skipped.
* Portrait screens: the game's lens shift (aim point at 35 % of the height) is compensated in cat shots, so the cat sits
  in the middle of the screen, clear of the top panels.
* Depth of field is not available in this renderer (no post-processing), so the close-up has none.
### Checks
* Feasibility at 10 stations (halt, regional, mountain, river, freight) × 4 spots each: shots 1, 4 and 5 possible
  everywhere; shot 3 when the train is near; shot 2 sometimes blocked by a canopy or footbridge (then another shot).
* All five shots filmed at 4 stations of different kinds (and again after tuning, plus a portrait 390×844 run): at the
  start, middle and end of each move the whole cat was inside the frame and 9 of 9 rays from the camera to points of the
  cat reached it (measured against the real scene: chunks, trains, people).
* Day, night (22:30, platform lamps), landscape and portrait views; runtime errors: none.
* Game day: the clock run through midnight on its own (23:54 → 00:01) stepped the day counter once and the cat got the
  new day's assignment. Sandbox button (English UI): label and banner translated, cinematic camera on, cat 1.1 km ahead.
* Regression with the event in place, no page errors: boot desktop / phone, HUD at 8 sizes, continue/save, quick menu,
  photo-mode texts in 10 languages, long run 328 km (heap steady at 38 MB), stress jumps, events with AI trains.
  APK (offline, no network request, no errors) and standalone page rebuilt; both carry the atlas.
* Not done: tests on a real phone; the animation was checked frame by frame in the atlas and by the clock in the game,
  not by recording the screen at 60 frames/s.

## Update 20 Nov 2026 (16): the cat never takes over the camera; cinematic accents on random days
* The cat no longer changes the player's camera anywhere. (The only place that did was the event-sandbox button,
  which switched to the cinematic camera; it now only places the cat and brings the train near it.) With the cab,
  chase or any other camera the train simply passes the cat's station.
* The cinematic camera gives the cat its own shot only on accent days, and only if the player is already watching through
  it. Accent days are chosen from the world seed: the first within the first 8 game days, then each one 3–8 days after
  the last accent that was actually filmed. A due accent waits until the cinematic camera has filmed it (if the player
  is not in that camera when passing, it comes on the next pass in the cinematic camera). The cat still sits on a
  platform every day; the schedule (last and next accent day) is saved with the journey.
* The sandbox button makes the current day an accent day, so the shot can be tried by switching to the cinematic camera.
* Checks: schedule over 80 days for 3 seeds with the accent filmed whenever due — first accent on day 0–7, gaps 3–8 days
  (never more than 8); with 40 % of the due days missed (player not in the cinematic camera) the accent comes on the next
  filmed pass. Cab camera on an accent day: the camera stayed "cab" the whole time, nothing was filmed and the accent
  stayed due. Cinematic camera on a non-accent day: only usual shots. Cinematic camera on an accent day: the cat shot ran
  and the next accent was set 5 days later. Save and reload: schedule unchanged.

## Update 20 Nov 2026 (17): camera inversion works the same in every camera
* Cause: the top-down map camera had its vertical axis the other way round from every other camera (drag up tilted the
  map view further down), so with the same settings it felt inverted there and the vertical-inversion option seemed to
  work backwards. The gamepad's right stick also could not tilt the map at all.
* Fix: the map uses the common look convention ("up" tilts the view up towards the horizon, "right" turns it right);
  the right stick tilts it too. The inversion settings are applied in one place (the input layer) for every camera.
* Check (measured from the camera's actual orientation, not from internal values): 9 player-controlled cameras (cab,
  free look in the train, carriage window, roof, rear, chase, free external, photo, map) × 4 settings (none, horizontal
  only, vertical only, both) × 2 inputs (finger/mouse drag, gamepad right stick) × 6 game modes (free, cabin, photo,
  developer, scenic, driver training). Result: all 432 cases as expected — "right" turns right and "up" looks up by
  default, horizontal inversion flips only left/right, vertical only up/down. Before the fix the map row was the only
  one that differed. The cinematic camera has no manual look (it films by itself) and is unchanged.
* Not done: a check on a real phone and with a real gamepad (the stick was simulated through the Gamepad API).

## Update 20 Nov 2026 (18): warning about the station cat
* When the station where the cat sits today is 1.6 km ahead or less, the game shows an event card like the other events:
  cat icon, "Station cat", "A cat is sitting at <station> station today · <distance>", tag "daily event". It comes once
  per cat (once per game day), with every camera, in the player's language; it is added to the events log, and it is
  spoken when voice announcements for events are on (otherwise a chime). Not in driver training (no cat there). The
  event-sandbox button shows it again for the newly placed cat.
* Small fix on the same card: the empty tag frame that appeared under every plain notification (e.g. stop grades) is
  hidden when there is no tag.
* Checks: cab camera — no card at 3 km, 1.8 km, 1.65 km; card at 1.5 km with the station's name and distance, one log
  entry; after passing the station and coming back to 1.2 km no second card. Next game day, chase camera — a new cat at
  another station, one new card at 1.4 km. English, photo camera, third day — translated card at 1.3 km. Sandbox button —
  card at 1.3 km. Driver training — no cat, no card. Screenshots at 834×375 (the card does not cover the HUD).
  New strings translated into all 10 languages (617 strings, validator: 0 missing / 0 placeholder mismatches).

## Update 20 Nov 2026 (19): free external camera — vertical axis reversed (player's request)
* In the free external camera (orbit) "up" (drag up, stick up) now raises the camera over the train, so the view tilts
  down; before it lowered the camera (view tilted up), like the chase camera. Horizontal is unchanged. The
  vertical-inversion setting still flips it (with it on, drag up lowers the camera). All other cameras unchanged.
* Check (same method as in section 17, free mode, drag and gamepad, 4 settings): orbit "right/down" by default,
  horizontal inversion "left/down", vertical inversion "right/up", both "left/up"; chase, cab and map unchanged
  ("right/up" by default).

## Update 22 Nov 2026 (20): stress test — 1000+ game days, every event 100+ times
### How it was run
* Four worlds in parallel, each 400 game days (1,600 per run): free journey (classic, 10 cars), scenic (HS, cinematic
  camera), event sandbox (HS, starting backwards, turnarounds), timetable (classic, 12 cars, a stop at every station).
  The game loop was stepped by hand (50 ms of game time per frame, drawing skipped except sampled real frames for GPU
  resource counts); one game day = 2 min of game time to fit the run. An autopilot drove with cruise control, stopped at
  stations (doors, passengers), turned round, changed cars and trains at stops, switched cameras every ~45 s, cycled the
  weather, switched the language and reloaded from the save. Every event was started 100+ times (rocket: see below);
  where an event's conditions were not near, the test jumped ahead like the sandbox button.
* Collected: page errors, console errors and warnings (with the system from the stack), exceptions, NaN in train/camera/
  environment, event objects left in the scene, temporary speed limits left behind, event objects on the rails or
  ballast (every vertex mapped to track coordinates), fallen tree floating/buried, camera below the ground, broken track
  geometry, heap / GPU geometries / textures / scene objects / DOM nodes over time.
### Found and fixed (first run → final run)
1. Track behind the start wound into knots: the heading pull-back term had the wrong sign in the backward integration
   (s < 0); heading at -40 km 260-1380 rad, loops a few metres wide. Reached by turning round and driving back past the
   start. Fixed (sign flips for s < 0; the line for s >= 0 is unchanged). Final run: 0 broken-track samples.
2. Fallen tree lay across both tracks (the template cylinder grows against the yaw; height taken from the rail, not the
   ground): 81 of 136 on the rails + 8 on the ballast, 17 mostly buried. Now root ~25 m out, top 9.5 m from the outer
   rail, on the terrain, spot away from crossings, roads, junction tracks, bridges, tunnels, stations. Final: 0 of 125,
   nearest point 5.5 m from a rail.
3. Roadworks: lamps, cones and workers on the track-2 side stood on track 2 (single-track layout): 223 of 223. Final:
   0 of 221 (cones/lamps on the ballast shoulder 2 m from the rail, intended).
4. Landslide / rockfall / avalanche: the easing curve ended at 1.8, every rock flew 80 % past its stop, across both
   tracks; stops on the track-2 side were 3.4 m from it. Final: 0 of 332, nearest 6.7 m from a rail.
5. Rear-of-train camera below the ground on curves in cuttings (159 samples); cinematic/photo/orbit camera occasionally
   below the ground (13); the camera ground search reached only ±290 m. Rear camera clamped (searched from the tail),
   cinematic path clamped, search ±1.1 km. Final: 0.
6. "ResizeObserver loop" browser error on layout changes (24). Layout deferred to the next frame. Final: 0.
### Final run summary
* 1,600 game days, 3,826 km, 3,461 event starts, 397 station stops, 56 turnarounds, 39 reloads from the save:
  0 JavaScript errors or warnings, 0 exceptions, 0 NaN, 0 event objects left behind, 0 temporary limits left behind,
  0 objects on the rails, 0 cameras under the ground, 0 broken track. Heap, GPU geometries and scene objects fluctuate
  within a band and do not grow (no leak seen).
* Events below 100 starts: the rocket (72 over both runs) — a launch needs a spaceport, present in about one 30-km
  region in three; no errors in any launch. The fallen tree finds a spot in 86 % of the places where its forest
  condition holds (the test's many retries at the same unsuitable spot inflate its failure count).
* Not done: real phones, real audio output, hardware GPU; the full statistics page (per system, per event, stability)
  was delivered separately as EndlessRails-stress-test.html.

## Update 22 Nov 2026 (21): HS headlights, wipers, real birds in the birds event
* HS headlights: the lamps were 5 × 12 cm slits in the nose flanks and could hardly be seen. Now each side has a
  teardrop lens that follows the curve of the nose (wider at the front) in a dark bezel, with a daytime-running strip
  above it. The beam used to start in the air 0.6 m in front of the nose tip with its brightest part right there; it now
  starts inside the nose level with the lamps (the hull hides the start) and fades in over the first ~4 m (both trains).
  The white bar seen from the cab "where the light starts" was the 2.4 m glow sprites of the own headlights showing
  through the gap under the nose: the own headlight glows are no longer drawn for the cab and inside-train cameras
  (outside views keep them).
* Wipers (both trains): a hub on the frame below the glass, a tapered arm standing off the glass and a blade (carrier +
  rubber) lying on it, instead of a bare stick. Classic: the hubs moved from inside the pane to the frame below it, so the
  arms come out of the bottom edge. HS: each wiper sweeps only its own half and stops just short of upright (they used to
  swing 9° past upright and run over each other). The rain on the glass is cleared from the real arm position as before.
* Birds event: real birds with flapping wings instead of black particle dots: a V of geese (new species: grey-brown,
  slow wing beat), or near water a loose flock of gulls. The crossing is timed so the flock passes 45-85 m ahead of the
  train just as it arrives (from the train speed), 12-17 m up (over the overhead wires, in view through the windscreen).
  Bird instance limit raised from 90 to 150 so the event flock is never cut short by ambient flocks.
* Checks: screenshots of the HS nose by day and night, the cab at night (clear, fog, rain) before/after, both cabs'
  wipers through the whole sweep, the birds event filmed from the cab and the chase camera. Short soak (52 game days,
  HS train, 8 cars, all events, 15 station stops, 3 turnarounds, 5 reloads, 2 language switches): 0 errors, no objects on
  the rails, no camera under the ground; boot without errors; APK (offline) and standalone page rebuilt.

## Update 23 Nov 2026 (22): HS headlights after the player's reference; passengers in the cars like those on the platforms
* HS headlights redone after the player's reference photo of a modern high-speed train: on each side of the front of the
  nose (85-99 % of the nose length, about mid-height) a slim "eye" light strip, pointed at the rear and widest towards
  the front, set in a gloss-black band that follows the curve of the nose and tapers back along it. The strips are lifted
  off the hull along its true normal, so both eyes are visible head-on (near the tip the nose faces forward). The previous
  lamps sat low on the flanks next to the bogie, where they could not be seen from the front.
* The light comes from the lamps: one beam cone starts at each headlight (both trains; the classic beams start at its two
  lower lamps), each a little narrower so the pair is as bright as the old single cone; the fade-in is now about 1 m.
* Passengers in the cars: they were a coloured box with a ball on top. They are now seated people built from the same
  shapes as the people on the platforms (torso, neck, head, hair, long hair, arms, legs) and dressed by the same rules
  (clothes, skin and hair colours, build, skirts): hips on the cushion, back to the backrest, hands on the lap, knees bent,
  feet on the floor. The shapes are shared code (personGeo), slightly coarser inside the cars: about 200 triangles each,
  a 15-car train about 50 k triangles more; on low graphics the cars hold half as many passengers.
* Checks: HS nose from the front, both front quarters and the side, by day (lights on/off), at dusk and at night; the
  player's reference beside the new nose; car interiors (walk camera) and windows from outside, classic and HS, before /
  after; boot without errors; short soak (36 game days, HS, 12 cars, all events, 10 station stops, 4 reloads): 0 errors.
