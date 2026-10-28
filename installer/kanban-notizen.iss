; Einfache Variante OHNE Rust/Tauri: installiert die HTML-App und startet sie
; in Microsoft Edge im App-Modus (eigenes Fenster, ohne Tabs).
; Kompilieren: Datei in Inno Setup (jrsoftware.org) öffnen → Build → Compile (F9).

#define AppVer "1.0.0"

[Setup]
AppId={{7B1F4C2E-9A3D-4E8B-B6C1-2F5D8A9E0C14}
AppName=Kanban Notizen
AppVersion={#AppVer}
AppPublisher=Philipp Seewer
DefaultDirName={localappdata}\Programs\Kanban Notizen (HTML)
DefaultGroupName=Kanban Notizen
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=KanbanNotizen-HTML-Setup-{#AppVer}
SetupIconFile=notizen.ico
UninstallDisplayIcon={app}\notizen.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Verknüpfung auf dem Desktop erstellen"; Flags: unchecked

[Files]
Source: "..\src\index.html"; DestDir: "{app}"; DestName: "Kanban-Notizen.html"; Flags: ignoreversion
Source: "notizen.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Kanban Notizen"; Filename: "{code:EdgePath}"; Parameters: "--app=""file:///{code:AppUrl}"""; WorkingDir: "{app}"; IconFilename: "{app}\notizen.ico"
Name: "{autodesktop}\Kanban Notizen"; Filename: "{code:EdgePath}"; Parameters: "--app=""file:///{code:AppUrl}"""; IconFilename: "{app}\notizen.ico"; Tasks: desktopicon
Name: "{group}\Kanban Notizen deinstallieren"; Filename: "{uninstallexe}"

[Run]
Filename: "{code:EdgePath}"; Parameters: "--app=""file:///{code:AppUrl}"""; Description: "Kanban Notizen jetzt starten"; Flags: nowait postinstall skipifsilent

[Code]
function EdgePath(Param: String): String;
begin
  Result := ExpandConstant('{commonpf32}\Microsoft\Edge\Application\msedge.exe');
  if not FileExists(Result) then
    Result := ExpandConstant('{commonpf}\Microsoft\Edge\Application\msedge.exe');
end;

function AppUrl(Param: String): String;
begin
  Result := ExpandConstant('{app}\Kanban-Notizen.html');
  StringChangeEx(Result, '\', '/', True);
end;
