# ENDLESS RAILS — Windows (Electron)

The game page (`../endless-rails/src/game.html`) in its own desktop window. `tools/prepare.js` builds `app/index.html`
with three.js and the fonts inlined (the same transformation as the Android asset task) and copies the music next to
it, so the app runs fully offline.

```
desktop/
├─ main.js              main process: window, app:// file protocol, window state, F11 / Alt+Enter full screen
├─ preload.js           window.DesktopApp (platform, toggleFullscreen, quit) for the page
├─ build/icon.ico/.png  application icon (from android/store/icon-512.png)
├─ build/installer.nsh  installer: "game still running?" check by file lock (no PowerShell / tasklist needed)
├─ tools/prepare.js     game page + music → app/
├─ tools/after-pack.js  sets the .exe icon and version info with resedit (no Wine needed for that)
└─ package.json         Electron 45.2.3, electron-builder 26.18.1: NSIS installer + portable .exe (x64)
```

## Behaviour
* Window 1280×720 by default (min 640×360), resizable; size, position, maximised and full-screen state are remembered
  (`%APPDATA%\ENDLESS RAILS\window-state.json`). **F11** or **Alt+Enter** toggles full screen.
* The page is served from `app://game/` (a private, secure origin): saves (journey, settings, progress) are kept in the
  user profile (`%APPDATA%\ENDLESS RAILS`). The portable version keeps them in `ENDLESS_RAILS_DATA` next to the .exe
  when that folder is writable, otherwise in the profile.
* No menu bar, no reload/zoom/dev-tools shortcuts in the packaged app; links open in the default browser; all web
  permissions (camera, microphone, location, notifications…) are refused except full screen.
* One instance at a time (a second launch focuses the running window). A crashed renderer is reloaded (the journey is
  saved by the game every 5 s).
* Keyboard and mouse controls are the game's own (see the in-game guide); gamepads work through the Gamepad API.
* Not code-signed: Windows SmartScreen shows “Windows protected your PC” on first start → *More info* → *Run anyway*.
  For public distribution sign both .exe files with an Authenticode certificate (electron-builder `win.signtoolOptions`
  / `CSC_LINK`), then set `signAndEditExecutable` back to `true`.

## Build
Windows (recommended): Node.js 20+ → `npm ci` → `npm run dist` → `dist/ENDLESS_RAILS_SETUP.exe`, `dist/ENDLESS_RAILS_PORTABLE.exe`.

Linux/macOS: the same, plus Wine (electron-builder runs the NSIS uninstaller stub with Wine). In the container this
release was built in, Wine only started with a clean environment:
`env -i HOME=$HOME PATH=/usr/bin:/bin:$(dirname $(which node)) WINEPREFIX=... npx electron-builder --win nsis portable --x64`.

`npm start` runs the app from source (prepares `app/` first).
