; © 2026 Philipp Seewer · Alle Rechte vorbehalten · siehe LICENSE
; Notara hiess früher „Kanban Notizen“. Beim ersten Installieren unter dem neuen Namen
; wird die alte Installation aufgeräumt: Verknüpfungen, Eintrag in „Apps“, Programmordner.
; Die Notizen (Dokumente\Kanban Notizen) und die Einstellungen bleiben unangetastet.
!macro NSIS_HOOK_POSTINSTALL
  StrCpy $R8 "$LOCALAPPDATA\Kanban Notizen"
  ${If} $R8 != $INSTDIR
  ${AndIf} ${FileExists} "$R8\kanban-notizen.exe"
    ; Autostart vom alten Namen übernehmen
    ReadRegStr $R9 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Kanban Notizen"
    ${If} $R9 != ""
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Kanban Notizen"
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Notara" '"$INSTDIR\${MAINBINARYNAME}.exe" --minimized'
    ${EndIf}
    Delete "$SMPROGRAMS\Kanban Notizen.lnk"
    Delete "$SMPROGRAMS\Kanban Notizen\Kanban Notizen.lnk"
    RMDir "$SMPROGRAMS\Kanban Notizen"
    Delete "$DESKTOP\Kanban Notizen.lnk"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kanban Notizen"
    DeleteRegKey HKCU "Software\Philipp Seewer\Kanban Notizen"
    Sleep 1500
    RMDir /r "$R8"
  ${EndIf}
!macroend
