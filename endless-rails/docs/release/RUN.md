# ENDLESS RAILS 2.0.0 — how to install and run

## Android (phones and tablets, Android 7.0+)
| File | What it is |
|---|---|
| `Android/ENDLESS_RAILS.apk` | **Release build**, signed with the project's release key, real AdMob IDs (rewarded video, only in *Extras*). Install for normal play. |
| `Android/ENDLESS_RAILS_debug.apk` | Debug build (package `com.endlessrails.game.debug`, installs next to the release), **Google test ads** only — for testing ads and consent. |
| `Android/ENDLESS_RAILS.aab` | Android App Bundle for upload to Google Play (same code and key as the release APK). |

Install an APK: copy it to the phone → open it → allow “Install unknown apps” for the file manager / browser when asked.
Or with a computer: `adb install -r ENDLESS_RAILS.apk`.
* The test APKs handed out during development were a separate app (package `com.endlessrails.game.test`): the release
  (`com.endlessrails.game`) installs **next to** it, not over it, and starts with a fresh journey. Uninstall the old test
  app when you no longer need it (its progress is not transferred).
* The game starts in landscape; *Settings ▸ Graphics ▸ Screen orientation* allows portrait. Back gesture closes menus,
  then opens the main menu; on the main menu it exits.
* Internet is needed only for the optional ads and the consent form; the game itself runs offline.

## Windows 10 / 11 (64-bit)
| File | What it is |
|---|---|
| `Windows/ENDLESS_RAILS_SETUP.exe` | Installer: choose “only for me” (no admin rights) or “all users”, choose the folder; creates Desktop and Start-menu shortcuts and an uninstaller (Settings ▸ Apps). |
| `Windows/ENDLESS_RAILS_PORTABLE.exe` | No installation: run it from any folder or USB stick. Saves go to `ENDLESS_RAILS_DATA` next to the .exe (or the user profile if that folder is read-only). |

* The files are **not code-signed**: SmartScreen shows “Windows protected your PC” → *More info* → *Run anyway*.
* **F11** or **Alt+Enter**: full screen / window. The window size and position are remembered.
* Controls: keyboard — ↑/↓ or W/S power, Space brake, X emergency brake, H horn, L lights, K wipers, G cruise control,
  C next camera (1–9 pick one, 0 map), R reset camera, P pause, M music, V hide HUD, Esc settings (full list in the
  in-game guide); mouse drag to look around, wheel to zoom; gamepads are supported.
* Saves: `%APPDATA%\ENDLESS RAILS` (installer version). Uninstalling keeps them; delete that folder to reset.
* Needs a GPU with WebGL 2 / Direct3D 11 (any GPU from the last ~10 years; integrated graphics work, choose a lower
  graphics quality in *Settings ▸ Graphics* if the frame rate is low).

## Web (any modern browser: Chrome, Edge, Firefox, Safari; desktop and Android)
`Web/ENDLESS_RAILS.html` is one self-contained file (≈10 MB: the game, three.js, fonts and music inside).
* **Offline:** double-click it (opens as `file://`), or copy it to a phone and open it in Chrome. Saves are kept by the
  browser for that file.
* **Online:** upload the file to any static web host (rename it to `index.html` if you like). No server code needed.
* Browsers start sound only after the first tap/click (autoplay rule). Full screen: the browser's own full-screen mode
  (F11 on desktop). The web version has no ads: every extra is free.
