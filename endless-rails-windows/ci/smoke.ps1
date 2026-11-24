# Builds nothing; launches dist\EndlessRails.exe twice and checks that it runs, closes cleanly and keeps its saves.
$ErrorActionPreference = 'Stop'
$out = Join-Path $PWD 'smoke-out'
New-Item -ItemType Directory -Force $out | Out-Null
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
$data = Join-Path $env:LOCALAPPDATA 'EndlessRails'

foreach ($phase in 'first', 'second') {
  Write-Host "=== $phase launch ==="
  $p = Start-Process -FilePath 'dist\EndlessRails.exe' -PassThru
  node ci/smoke.mjs $phase $out
  if ($LASTEXITCODE -ne 0) { throw "smoke.mjs failed in $phase run" }
  if ($p.HasExited) { throw "EndlessRails.exe exited early (code $($p.ExitCode))" }
  Write-Host "closing main window"
  $null = $p.CloseMainWindow()
  if (-not $p.WaitForExit(10000)) { throw 'EndlessRails.exe did not close within 10 s' }
  Write-Host "exit code $($p.ExitCode)"
  Get-Content (Join-Path $data 'log.txt') | ForEach-Object { Write-Host "  log: $_" }
  Start-Sleep -Seconds 3
}
Get-ChildItem -Recurse -Path (Join-Path $data 'WebView2') -Include '*.ldb','*.log' -ErrorAction SilentlyContinue | Select-Object -First 5 | ForEach-Object { Write-Host "  storage: $($_.FullName)" }
