# Stress test (soak)

Runs the game headless with Playwright + Chromium, steps the game loop by hand (50 ms of game time per frame, drawing
skipped except sampled frames), drives an autopilot (station stops, turnarounds, car/train changes, camera, weather,
language, reloads) and starts every event a target number of times. It records errors per system, broken invariants
(NaN, objects on the rails, camera under the ground, broken track, leftovers after events) and memory over time.

```
npm i playwright          # Chromium as installed by Playwright
node soak.js ../../src/game.html out/w1.json '{"name":"W1","seed":424242,"mode":"free","tr":"classic","days":250,"per":25,"stopEvery":2,"cars":10}'
node soak_agg.js out out/agg.json                 # merged statistics (all w*.json in the folder)
node soak_report.js before/agg.json out/agg.json report.html
```
Options (JSON): seed, mode, tr (classic|hs), dir (1|-1), q (low..ultra), v (cruise m/s), days, maxDays, per (starts per
event), only (list of event ids), stopEvery (stop at every n-th station, 0 = never), pReverse, cars, cams, camEvery,
spawnEvery, maxActive, patience, langs, reloadEvery, dayMin. The 22 Nov 2026 results: docs/stress-test-2026-11-22.html.
