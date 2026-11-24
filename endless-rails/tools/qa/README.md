# Release QA scripts (Playwright + Chromium, software WebGL)

`npm i playwright` once (Chromium as installed by Playwright). The game page is served from `../../src/` by `run.js`.

| Command | What it checks |
|---|---|
| `node run.js ../../src/game.html out menu:relaudit.js` | modes × trains × 10 cameras and controls, audio lifecycle, saves across reload, frame/render cost per state, UI at 11 sizes. `SECTIONS=modes,audio,saves,cost,ui` picks parts; results in `relaudit.json` (`OUTJSON=` to change) |
| `node run.js ../../src/game.html out menu:revchk.js` | acceleration, braking and reverse for both trains |
| `node run.js ../../src/game.html out menu:names.js` | station names: repeats over 1500 stations in 3 languages, both layouts, seed reproducibility |
| `node run.js ../../src/game.html out menu:pausecost.js` | renders per frame: running, paused with a still / turning camera, menu |
| `node run.js ../../src/game.html out menu:balchk.js` | balloons event: height over the line after the full drift at three route points |
| `node offline.js ../../src/game.html` | the page without network: message and retry button instead of a frozen loading screen |
| `node websmoke.js ENDLESS_RAILS.html` | the standalone web file from `file://`: start, cameras, music, seed reproducibility, save/continue, no network |
| `node firstrun.js ENDLESS_RAILS.html` | first launch with a clean profile in 3 locales / screen shapes: language detected, language screen, first journey screen |
| `node eltest.js <empty-user-data-dir>` | the Windows app code (`../../../desktop`) with the Electron binary of the host: app:// origin, saves and window state across restarts, full screen bridge, permissions (needs `npm ci` and `node node_modules/electron/install.js` in `desktop/`, and an X display, e.g. `Xvfb :77` + `DISPLAY=:77`) |
| `node elf11.js <user-data-dir>` | F11 / Alt+Enter and blocked Ctrl+R with real X key events (`xdotool`) |

The long multi-day soak test is in `../soak/`.
