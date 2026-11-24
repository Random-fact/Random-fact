# Launches dist\EndlessRails.exe twice and checks that it runs, closes cleanly and keeps its saves.
$ErrorActionPreference = 'Stop'
$out = Join-Path $PWD 'smoke-out'
New-Item -ItemType Directory -Force $out | Out-Null
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
$data = Join-Path $env:LOCALAPPDATA 'EndlessRails'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Save-Desktop($name) {
  try {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "desktop screenshot $name ($($b.Width)x$($b.Height))"
  } catch { Write-Host "desktop screenshot failed: $_" }
}

$failed = $null
$script:cdpFailed = $null
foreach ($phase in 'first', 'second') {
  Write-Host "=== $phase launch ==="
  $p = Start-Process -FilePath 'dist\EndlessRails.exe' -PassThru
  try {
    Start-Sleep -Seconds 15
    Save-Desktop "$phase-desktop-early"
    Get-ChildItem env: | Where-Object Name -like 'WEBVIEW2*' | ForEach-Object { Write-Host "  env: $($_.Name)=$($_.Value)" }
    Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { Write-Host "  browser cmdline: $($_.CommandLine)" }
    Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\*','HKLM:\SOFTWARE\Policies\Microsoft\Edge' -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  policy: $($_ | Out-String)" }
    netstat -ano | Select-String ':9222' | ForEach-Object { Write-Host "  netstat: $_" }
    $dtp = Join-Path $data 'WebView2\EBWebView\DevToolsActivePort'
    if (Test-Path $dtp) { Write-Host "  DevToolsActivePort: $((Get-Content $dtp) -join ' ')" } else { Write-Host '  (no DevToolsActivePort file)' }
    node ci/smoke.mjs $phase $out
    $code = $LASTEXITCODE
    Save-Desktop "$phase-desktop-late"
    if ($code -ne 0) { $script:cdpFailed = "smoke.mjs failed in $phase run (exit $code)"; Write-Host "WARN: $cdpFailed" }
    if ($p.HasExited) { throw "EndlessRails.exe exited early (code $($p.ExitCode))" }
    Write-Host "closing main window"
    $null = $p.CloseMainWindow()
    if (-not $p.WaitForExit(10000)) { throw 'EndlessRails.exe did not close within 10 s' }
    Write-Host "exit code $($p.ExitCode)"
    Start-Sleep -Seconds 2
    $hits = Get-ChildItem -Path (Join-Path $data 'WebView2\EBWebView\Default\Local Storage\leveldb') -File -ErrorAction SilentlyContinue |
      Where-Object { [System.Text.Encoding]::Latin1.GetString([System.IO.File]::ReadAllBytes($_.FullName)) -match 'endless-rails-profile-v2' }
    Write-Host "  saved profile found on disk after close: $([bool]$hits) ($($hits.Name -join ', '))"
  } catch {
    $failed = $_
    Write-Host "FAILED: $_"
  } finally {
    if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Select-Object -First 3 | ForEach-Object { Write-Host "  webview2 process alive: $($_.Id)" }
    $logFile = Join-Path $data 'log.txt'
    if (Test-Path $logFile) { Get-Content $logFile | ForEach-Object { Write-Host "  log: $_" } } else { Write-Host '  (no log.txt)' }
  }
  if ($failed) { break }
  Start-Sleep -Seconds 3
}
Get-ChildItem -Recurse -Path (Join-Path $data 'WebView2') -Include '*.ldb','*.log' -ErrorAction SilentlyContinue | Select-Object -First 5 | ForEach-Object { Write-Host "  storage: $($_.FullName)" }
if ($failed) { throw $failed }
if ($cdpFailed) { throw $cdpFailed }
