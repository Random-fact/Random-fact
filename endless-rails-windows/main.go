//go:build windows

// Endless Rails for Windows: a small native window that hosts the game page
// in Microsoft Edge WebView2 (the Chromium engine built into Windows 10/11).
//
// The whole game (index.html with three.js, music and fonts inlined) is
// embedded in the .exe. On start it is unpacked to
// %LOCALAPPDATA%\EndlessRails\app and served from a fixed virtual https origin,
// so localStorage (journey save, profile, settings) persists between launches.
package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

//go:embed game/index.html
var gameHTML []byte

// selftestJS walks through the menus and reports what it sees (used by CI with --selftest).
//
//go:embed selftest.js
var selftestJS string

const (
	appTitle  = "Endless Rails"
	appFolder = "EndlessRails"
	// A reserved .example name: never resolved over the network, gives the
	// page a stable secure origin for localStorage.
	virtualHost = "endless-rails.example"
	runtimeURL  = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

	bgR, bgG, bgB = 0x0b, 0x10, 0x17 // the game's theme colour, avoids a white flash
)

// Win32 constants.
const (
	wsOverlappedWindow = 0x00CF0000
	cwUseDefault       = 0x80000000

	swShowMaximized = 3

	wmDestroy       = 0x0002
	wmMove          = 0x0003
	wmSize          = 0x0005
	wmActivate      = 0x0006
	wmSetFocus      = 0x0007
	wmClose         = 0x0010
	wmGetMinMaxInfo = 0x0024
	wmTimer         = 0x0113
	wmDpiChanged    = 0x02E0
	wmApp           = 0x8000

	wmAppDestroy          = wmApp + 1
	wmAppToggleFullscreen = wmApp + 2

	gwlStyle = -16

	swpNoSize         = 0x0001
	swpNoMove         = 0x0002
	swpNoZOrder       = 0x0004
	swpNoActivate     = 0x0010
	swpFrameChanged   = 0x0020
	swpNoOwnerZOrder  = 0x0200
	monitorDefNearest = 2

	imageIcon     = 1
	lrDefaultSize = 0x0040
	smCxIcon      = 11
	smCyIcon      = 12
	smCxSmIcon    = 49
	smCySmIcon    = 50
	idcArrow      = 32512

	vkReturn = 0x0D
	vkMenu   = 0x12
	vkF11    = 0x7A

	mbYesNo       = 0x00000004
	mbOk          = 0x00000000
	mbIconWarning = 0x00000030
	mbIconError   = 0x00000010
	idYes         = 6

	closeTimerID    = 1
	selftestTimerID = 2
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	pRegisterClassExW   = user32.NewProc("RegisterClassExW")
	pCreateWindowExW    = user32.NewProc("CreateWindowExW")
	pDefWindowProcW     = user32.NewProc("DefWindowProcW")
	pDestroyWindow      = user32.NewProc("DestroyWindow")
	pShowWindow         = user32.NewProc("ShowWindow")
	pUpdateWindow       = user32.NewProc("UpdateWindow")
	pGetMessageW        = user32.NewProc("GetMessageW")
	pTranslateMessage   = user32.NewProc("TranslateMessage")
	pDispatchMessageW   = user32.NewProc("DispatchMessageW")
	pPostQuitMessage    = user32.NewProc("PostQuitMessage")
	pPostMessageW       = user32.NewProc("PostMessageW")
	pLoadImageW         = user32.NewProc("LoadImageW")
	pLoadCursorW        = user32.NewProc("LoadCursorW")
	pGetSystemMetrics   = user32.NewProc("GetSystemMetrics")
	pGetWindowLongPtrW  = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLongPtrW  = user32.NewProc("SetWindowLongPtrW")
	pSetWindowPos       = user32.NewProc("SetWindowPos")
	pGetWindowPlacement = user32.NewProc("GetWindowPlacement")
	pSetWindowPlacement = user32.NewProc("SetWindowPlacement")
	pMonitorFromWindow  = user32.NewProc("MonitorFromWindow")
	pGetMonitorInfoW    = user32.NewProc("GetMonitorInfoW")
	pMessageBoxW        = user32.NewProc("MessageBoxW")
	pSetTimer           = user32.NewProc("SetTimer")
	pKillTimer          = user32.NewProc("KillTimer")
	pGetKeyState        = user32.NewProc("GetKeyState")
	pGetDpiForWindow    = user32.NewProc("GetDpiForWindow")
	pCreateSolidBrush   = gdi32.NewProc("CreateSolidBrush")
	pShellExecuteW      = shell32.NewProc("ShellExecuteW")
	pGetModuleHandleW   = kernel32.NewProc("GetModuleHandleW")
)

type wndClassEx struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     uintptr
	hIcon         uintptr
	hCursor       uintptr
	hbrBackground uintptr
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       uintptr
}

type point struct{ x, y int32 }

type rect struct{ left, top, right, bottom int32 }

type msg struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      point
	private uint32
}

type minMaxInfo struct {
	ptReserved, ptMaxSize, ptMaxPosition, ptMinTrackSize, ptMaxTrackSize point
}

type windowPlacement struct {
	length           uint32
	flags            uint32
	showCmd          uint32
	ptMinPosition    point
	ptMaxPosition    point
	rcNormalPosition rect
	rcDevice         rect
}

type monitorInfo struct {
	cbSize    uint32
	rcMonitor rect
	rcWork    rect
	dwFlags   uint32
}

// prefs is the small bit of window state remembered between launches.
type prefs struct {
	Fullscreen bool `json:"fullscreen"`
}

var (
	hwnd      uintptr
	chromium  *edge.Chromium
	ready     bool
	closing   bool
	debugMode bool
	selftest  bool

	fullscreen    bool
	savedPlace    windowPlacement
	havePlacement bool

	dataDir   string
	prefsPath string
)

func main() {
	runtime.LockOSThread()

	for _, a := range os.Args[1:] {
		switch a {
		case "--debug", "-debug":
			debugMode = true
		case "--selftest":
			selftest = true
		}
	}

	base, err := os.UserCacheDir() // %LOCALAPPDATA%
	if err != nil || base == "" {
		base = os.TempDir()
	}
	dataDir = filepath.Join(base, appFolder)
	appDir := filepath.Join(dataDir, "app")
	prefsPath = filepath.Join(dataDir, "window.json")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		fatal(fmt.Sprintf("Не вдалося створити папку даних / Cannot create the data folder:\n%s\n\n%v", appDir, err))
	}
	if f, err := os.Create(filepath.Join(dataDir, "log.txt")); err == nil {
		log.SetOutput(f)
		defer f.Close()
	}
	log.Printf("%s starting, data folder %s", appTitle, dataDir)

	if err := unpackGame(filepath.Join(appDir, "index.html")); err != nil {
		fatal(fmt.Sprintf("Не вдалося підготувати файли гри / Cannot prepare the game files:\n%v", err))
	}

	v, err := webviewloader.GetInstalledVersion()
	if err != nil || v == "" {
		log.Printf("WebView2 runtime not found (version %q, err %v)", v, err)
		askInstallRuntime()
		return
	}
	log.Printf("WebView2 runtime %s", v)

	// Initial colour of the WebView before the page paints (avoids a white flash).
	os.Setenv("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", fmt.Sprintf("FF%02X%02X%02X", bgR, bgG, bgB))

	p := loadPrefs()
	createWindow()

	chromium = edge.NewChromium()
	chromium.DataPath = filepath.Join(dataDir, "WebView2")
	chromium.MessageCallback = onWebMessage
	chromium.AcceleratorKeyCallback = onAcceleratorKey
	if !chromium.Embed(hwnd) {
		log.Printf("WebView2 embedding failed")
		pDestroyWindow.Call(hwnd)
		askInstallRuntime()
		return
	}
	ready = true
	configureWebView()
	chromium.Resize()

	startURL := "https://" + virtualHost + "/index.html"
	if wv3 := chromium.GetICoreWebView2_3(); wv3 != nil {
		if err := wv3.SetVirtualHostNameToFolderMapping(virtualHost, appDir, edge.COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW); err != nil {
			log.Printf("virtual host mapping failed: %v", err)
			startURL = fileURL(filepath.Join(appDir, "index.html"))
		}
	} else {
		startURL = fileURL(filepath.Join(appDir, "index.html"))
	}
	if selftest {
		chromium.Init(`window.__erErrors=[];addEventListener('error',function(e){__erErrors.push(String(e.message))});` +
			`addEventListener('unhandledrejection',function(e){__erErrors.push('promise: '+String(e.reason))});`)
		pSetTimer.Call(hwnd, selftestTimerID, 12000, 0)
	}
	log.Printf("navigating to %s", startURL)
	chromium.Navigate(startURL)
	chromium.Focus()

	if p.Fullscreen {
		setFullscreen(true)
	}

	messageLoop()
	log.Printf("exit")
}

// unpackGame writes the embedded page next to the WebView2 data, only when it changed.
func unpackGame(path string) error {
	if old, err := os.ReadFile(path); err == nil && bytes.Equal(old, gameHTML) {
		return nil
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, gameHTML, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func fileURL(p string) string {
	return (&url.URL{Scheme: "file", Path: "/" + filepath.ToSlash(p)}).String()
}

func createWindow() {
	hinst, _, _ := pGetModuleHandleW.Call(0)
	className, _ := windows.UTF16PtrFromString("EndlessRailsWindow")
	title, _ := windows.UTF16PtrFromString(appTitle)
	iconName, _ := windows.UTF16PtrFromString("APP")

	cx, _, _ := pGetSystemMetrics.Call(smCxIcon)
	cy, _, _ := pGetSystemMetrics.Call(smCyIcon)
	scx, _, _ := pGetSystemMetrics.Call(smCxSmIcon)
	scy, _, _ := pGetSystemMetrics.Call(smCySmIcon)
	icon, _, _ := pLoadImageW.Call(hinst, uintptr(unsafe.Pointer(iconName)), imageIcon, cx, cy, 0)
	iconSm, _, _ := pLoadImageW.Call(hinst, uintptr(unsafe.Pointer(iconName)), imageIcon, scx, scy, 0)
	cursor, _, _ := pLoadCursorW.Call(0, idcArrow)
	brush, _, _ := pCreateSolidBrush.Call(uintptr(bgR) | uintptr(bgG)<<8 | uintptr(bgB)<<16)

	wc := wndClassEx{
		lpfnWndProc:   windows.NewCallback(wndProc),
		hInstance:     hinst,
		hIcon:         icon,
		hCursor:       cursor,
		hbrBackground: brush,
		lpszClassName: className,
		hIconSm:       iconSm,
	}
	wc.cbSize = uint32(unsafe.Sizeof(wc))
	if r, _, err := pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc))); r == 0 {
		fatal(fmt.Sprintf("RegisterClassEx: %v", err))
	}

	var err error
	hwnd, _, err = pCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(title)),
		wsOverlappedWindow,
		cwUseDefault, cwUseDefault, cwUseDefault, cwUseDefault,
		0, 0, hinst, 0,
	)
	if hwnd == 0 {
		fatal(fmt.Sprintf("CreateWindowEx: %v", err))
	}
	// The first ShowWindow may be overridden by the launcher's STARTUPINFO; the second one sticks.
	pShowWindow.Call(hwnd, swShowMaximized)
	pShowWindow.Call(hwnd, swShowMaximized)
	pUpdateWindow.Call(hwnd)
}

func configureWebView() {
	if s, err := chromium.GetSettings(); err == nil && s != nil {
		_ = s.PutAreDefaultContextMenusEnabled(debugMode)
		_ = s.PutAreDevToolsEnabled(debugMode)
		_ = s.PutIsStatusBarEnabled(false)
		_ = s.PutIsZoomControlEnabled(false)
		_ = s.PutAreBrowserAcceleratorKeysEnabled(debugMode) // no F5 / Ctrl+P / Ctrl+F etc.
		_ = s.PutIsPinchZoomEnabled(false)
		_ = s.PutIsSwipeNavigationEnabled(false)
	}
	if c := chromium.GetController(); c != nil {
		if c2 := c.GetICoreWebView2Controller2(); c2 != nil {
			_ = c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: bgR, G: bgG, B: bgB})
		}
	}
}

func messageLoop() {
	var m msg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

// saveScript asks the game to write the journey and the profile before the window goes away.
const saveScript = `(function(){
try{if(typeof G!=='undefined'&&G&&G.save)G.save();}catch(e){}
try{if(typeof Profile!=='undefined'&&Profile&&Profile.save)Profile.save(true);}catch(e){}
try{window.chrome.webview.postMessage('er:closed');}catch(e){}
})();`

func wndProc(h, m, wp, lp uintptr) uintptr {
	switch m {
	case wmSize:
		if chromium != nil {
			chromium.Resize()
		}
		return 0
	case wmMove:
		if chromium != nil {
			_ = chromium.NotifyParentWindowPositionChanged()
		}
	case wmActivate:
		if wp&0xFFFF != 0 && ready {
			chromium.Focus()
		}
	case wmSetFocus:
		if ready {
			chromium.Focus()
		}
		return 0
	case wmGetMinMaxInfo:
		mmi := (*minMaxInfo)(unsafe.Pointer(lp))
		s := dpiScale(h)
		mmi.ptMinTrackSize = point{int32(800 * s), int32(500 * s)}
		return 0
	case wmDpiChanged:
		if fullscreen {
			fitToMonitor(h)
		} else {
			r := (*rect)(unsafe.Pointer(lp))
			pSetWindowPos.Call(h, 0, uintptr(r.left), uintptr(r.top),
				uintptr(r.right-r.left), uintptr(r.bottom-r.top), swpNoZOrder|swpNoActivate)
		}
		return 0
	case wmClose:
		if closing || !ready {
			pDestroyWindow.Call(h)
			return 0
		}
		closing = true
		chromium.Eval(saveScript)
		pSetTimer.Call(h, closeTimerID, 1500, 0) // fallback if the page does not answer
		return 0
	case wmTimer:
		if wp == closeTimerID {
			pKillTimer.Call(h, closeTimerID)
			pDestroyWindow.Call(h)
			return 0
		}
		if wp == selftestTimerID {
			pKillTimer.Call(h, selftestTimerID)
			log.Printf("selftest: running")
			chromium.Eval(selftestJS)
			return 0
		}
	case wmAppDestroy:
		pKillTimer.Call(h, closeTimerID)
		pDestroyWindow.Call(h)
		return 0
	case wmAppToggleFullscreen:
		setFullscreen(!fullscreen)
		savePrefs(prefs{Fullscreen: fullscreen})
		return 0
	case wmDestroy:
		if ready {
			closeController(chromium.GetController())
			ready = false
		}
		pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(h, m, wp, lp)
	return r
}

func onWebMessage(s string) {
	switch {
	case s == "er:closed" && closing:
		pPostMessageW.Call(hwnd, wmAppDestroy, 0, 0)
	case strings.HasPrefix(s, "er:log:"):
		log.Printf("page: %s", strings.TrimPrefix(s, "er:log:"))
	}
}

// onAcceleratorKey handles F11 and Alt+Enter (fullscreen); everything else goes to the game.
func onAcceleratorKey(vk uint) bool {
	alt, _, _ := pGetKeyState.Call(vkMenu)
	if vk == vkF11 || (vk == vkReturn && int16(alt) < 0) {
		pPostMessageW.Call(hwnd, wmAppToggleFullscreen, 0, 0)
		return true
	}
	return false
}

func setFullscreen(on bool) {
	if on == fullscreen {
		return
	}
	style, _, _ := pGetWindowLongPtrW.Call(hwnd, gwlStyleArg())
	if on {
		savedPlace = windowPlacement{}
		savedPlace.length = uint32(unsafe.Sizeof(savedPlace))
		r, _, _ := pGetWindowPlacement.Call(hwnd, uintptr(unsafe.Pointer(&savedPlace)))
		havePlacement = r != 0
		pSetWindowLongPtrW.Call(hwnd, gwlStyleArg(), style&^wsOverlappedWindow)
		fullscreen = true
		fitToMonitor(hwnd)
	} else {
		pSetWindowLongPtrW.Call(hwnd, gwlStyleArg(), style|wsOverlappedWindow)
		fullscreen = false
		if havePlacement {
			pSetWindowPlacement.Call(hwnd, uintptr(unsafe.Pointer(&savedPlace)))
		}
		pSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0,
			swpNoMove|swpNoSize|swpNoZOrder|swpNoOwnerZOrder|swpFrameChanged)
		if !havePlacement {
			pShowWindow.Call(hwnd, swShowMaximized)
		}
	}
	if chromium != nil {
		chromium.Resize()
	}
}

func fitToMonitor(h uintptr) {
	mon, _, _ := pMonitorFromWindow.Call(h, monitorDefNearest)
	mi := monitorInfo{}
	mi.cbSize = uint32(unsafe.Sizeof(mi))
	pGetMonitorInfoW.Call(mon, uintptr(unsafe.Pointer(&mi)))
	r := mi.rcMonitor
	pSetWindowPos.Call(h, 0, uintptr(r.left), uintptr(r.top),
		uintptr(r.right-r.left), uintptr(r.bottom-r.top), swpNoOwnerZOrder|swpFrameChanged)
}

// gwlStyleArg returns GWL_STYLE (-16) as the bit pattern Windows expects in a uintptr.
func gwlStyleArg() uintptr {
	v := int32(gwlStyle)
	return uintptr(v)
}

func dpiScale(h uintptr) float64 {
	if pGetDpiForWindow.Find() != nil {
		return 1
	}
	d, _, _ := pGetDpiForWindow.Call(h)
	if d == 0 {
		return 1
	}
	return float64(d) / 96
}

// closeController calls ICoreWebView2Controller::Close (vtable slot 24) so the
// browser process shuts down cleanly and flushes localStorage to disk.
func closeController(c *edge.ICoreWebView2Controller) {
	if c == nil {
		return
	}
	vtbl := *(**[25]uintptr)(unsafe.Pointer(c))
	syscall.SyscallN(vtbl[24], uintptr(unsafe.Pointer(c)))
}

func loadPrefs() prefs {
	var p prefs
	if b, err := os.ReadFile(prefsPath); err == nil {
		_ = json.Unmarshal(b, &p)
	}
	return p
}

func savePrefs(p prefs) {
	if b, err := json.Marshal(p); err == nil {
		_ = os.WriteFile(prefsPath, b, 0o644)
	}
}

func messageBox(text string, flags uintptr) uintptr {
	t, _ := windows.UTF16PtrFromString(text)
	c, _ := windows.UTF16PtrFromString(appTitle)
	r, _, _ := pMessageBoxW.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), flags)
	return r
}

func askInstallRuntime() {
	const text = "Для роботи Endless Rails потрібен компонент Microsoft Edge WebView2 Runtime " +
		"(у Windows 11 він вже є, у Windows 10 зазвичай теж).\n" +
		"Відкрити сторінку завантаження зараз?\n\n" +
		"Endless Rails needs the Microsoft Edge WebView2 Runtime.\n" +
		"Open the download page now?"
	if messageBox(text, mbYesNo|mbIconWarning) == idYes {
		verb, _ := windows.UTF16PtrFromString("open")
		u, _ := windows.UTF16PtrFromString(runtimeURL)
		pShellExecuteW.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(u)), 0, 0, 1)
	}
}

func fatal(text string) {
	log.Print(text)
	messageBox(text, mbOk|mbIconError)
	os.Exit(1)
}
