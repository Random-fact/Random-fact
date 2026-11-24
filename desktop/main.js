/* ENDLESS RAILS for Windows: the game page (app/index.html, three.js and fonts inside, music next to it) in its own window.
   The files are served from a private app:// origin, so the page runs in a secure context, its fetch() of the music works
   and its localStorage (journey, settings, progress) is kept in the user's profile between launches.
   F11 or Alt+Enter: full screen. The window size, position and full-screen state are remembered. */
'use strict';
const { app, BrowserWindow, Menu, protocol, net, session, shell, screen, ipcMain } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, 'app');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);

/* a portable copy keeps its data next to the .exe when that folder is writable (electron-builder sets PORTABLE_EXECUTABLE_DIR) */
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const d = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'ENDLESS_RAILS_DATA');
  try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); app.setPath('userData', d); } catch (e) { /* read-only medium: the default profile folder is used */ }
}
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) || {}; } catch (e) { return {}; } }
function writeState() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify({ bounds: win.getNormalBounds(), max: win.isMaximized(), full: win.isFullScreen() })); } catch (e) { }
}
/* only restore a position that is still on one of the connected screens */
function onScreen(b) {
  return b && screen.getAllDisplays().some(d => { const a = d.workArea; return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y >= a.y - 20 && b.y < a.y + a.height - 80; });
}

function createWindow() {
  const st = readState();
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 360, show: false, backgroundColor: '#0b1017', title: 'ENDLESS RAILS',
    icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: true, devTools: !app.isPackaged }
  });
  if (st.bounds && onScreen(st.bounds)) win.setBounds(st.bounds);
  if (st.max) win.maximize();
  if (st.full) win.setFullScreen(true);
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.key === 'F11' || (inp.alt && inp.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    /* no reload / zoom / dev tools shortcuts in the game window */
    if ((inp.control || inp.meta) && ['r', 'R', '+', '-', '=', '0'].includes(inp.key)) e.preventDefault();
    if (inp.key === 'F5' || (app.isPackaged && (inp.key === 'F12' || ((inp.control || inp.meta) && inp.shift && /^[ijc]$/i.test(inp.key))))) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.setZoomFactor(1); win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => { });
  /* the renderer can crash (driver reset, out of memory): reload the game instead of leaving a dead window; the journey
     is saved by the page every few seconds */
  win.webContents.on('render-process-gone', (e, d) => { if (d.reason !== 'clean-exit' && win && !win.isDestroyed()) setTimeout(() => win && !win.isDestroyed() && win.loadURL('app://game/index.html'), 800); });
  for (const ev of ['resize', 'move']) win.on(ev, () => { clearTimeout(win._st); win._st = setTimeout(writeState, 600); });
  win.on('close', writeState);
  win.on('closed', () => { win = null; });
  win.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', req => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url).pathname); } catch (e) { return new Response('Bad request', { status: 400 }); }
    const f = path.normalize(path.join(ROOT, rel));
    if (!f.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });
  /* the game needs no camera, microphone, location or notifications: only full screen is allowed */
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'fullscreen'));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'fullscreen');
  ipcMain.handle('er:fullscreen', (e, on) => { if (win) win.setFullScreen(on === undefined ? !win.isFullScreen() : !!on); return win ? win.isFullScreen() : false; });
  ipcMain.handle('er:quit', () => { writeState(); app.quit(); });
  createWindow();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
