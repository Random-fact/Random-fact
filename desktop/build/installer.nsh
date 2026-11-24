; ENDLESS RAILS installer: "is the game still running?" is answered by trying to open the installed game executable for
; writing. Windows refuses that while the program runs, so the check needs neither PowerShell nor tasklist (the default
; check depends on both and can report a false "is running" on systems where they are restricted or missing).
!macro customCheckAppRunning
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    er_check_running:
      ClearErrors
      FileOpen $R0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" a
      ${If} ${Errors}
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY er_check_running
        Quit
      ${EndIf}
      FileClose $R0
  ${EndIf}
!macroend
