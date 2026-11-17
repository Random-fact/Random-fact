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
  (all 596 keys, placeholders, no Cyrillic left on any screen). **A native-speaker review is recommended** before release.

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
