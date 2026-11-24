# Launches dist\EndlessRails.exe --selftest twice on a real Windows machine and checks that:
#  - WebView2 starts, the game loads with WebGL and a journey can be started from the menu,
#  - the window closes cleanly, and the journey save is still there on the second launch.
$ErrorActionPreference = 'Stop'
$out = Join-Path $PWD 'smoke-out'
New-Item -ItemType Directory -Force $out | Out-Null
$data = Join-Path $env:LOCALAPPDATA 'EndlessRails'
$logFile = Join-Path $data 'log.txt'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Save-Desktop($name) {
  try {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } catch { Write-Host "desktop screenshot failed: $_" }
}

$problems = @()
foreach ($phase in 'first', 'second') {
  Write-Host "=== $phase launch ==="
  $p = Start-Process -FilePath 'dist\EndlessRails.exe' -ArgumentList '--selftest' -PassThru
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline -and -not $p.HasExited) {
    Start-Sleep -Seconds 3
    if ((Test-Path $logFile) -and (Select-String -Path $logFile -Pattern 'page: state ' -Quiet)) { break }
  }
  Save-Desktop "$phase-desktop"
  if ($p.HasExited) { $problems += "${phase}: exited early (code $($p.ExitCode))" }
  else {
    $null = $p.CloseMainWindow()
    if (-not $p.WaitForExit(10000)) { $problems += "${phase}: did not close within 10 s"; Stop-Process -Id $p.Id -Force }
    else { Write-Host "exit code $($p.ExitCode)" }
  }
  $log = if (Test-Path $logFile) { Get-Content $logFile } else { @() }
  $log | ForEach-Object { Write-Host "  log: $_" }
  $state = $log | Where-Object { $_ -match 'page: state (.*)$' } | Select-Object -Last 1
  if (-not $state) { $problems += "${phase}: no self-test result" }
  else {
    $j = ($state -replace '.*page: state ', '') | ConvertFrom-Json
    if (-not $j.running) { $problems += "${phase}: journey is not running" }
    if ($j.errors.Count -gt 0) { $problems += "${phase}: page errors: $($j.errors -join '; ')" }
  }
  if (-not ($log -match '"webgl":true')) { $problems += "${phase}: no WebGL" }
  if ($phase -eq 'second' -and -not ($log -match 'page: info .*endless-rails-v1')) { $problems += 'second: journey save from the first launch is missing' }
  Start-Sleep -Seconds 3
}
if ($problems.Count) { $problems | ForEach-Object { Write-Host "PROBLEM: $_" }; throw 'smoke test failed' }
Write-Host 'SMOKE TEST PASSED'
