# Kanban Notizen

Notizen in Spalten organisieren – mit Spaces und Kategorien, Prioritäten, Labels, Checklisten, Terminen mit Erinnerung, Wiederholungen, Zeiterfassung, Vorlagen, Screenshots und Drucken/PDF. Läuft komplett offline.

Das Projekt liefert die App in zwei Formen:

| Variante | Was | Braucht |
|---|---|---|
| **Desktop-App** (Tauri) | eigenes Programm mit Installer, speichert direkt in eine Datei, tägliche Backups | nichts lokal – GitHub baut den Installer |
| **HTML-Variante** (Inno Setup) | installiert die HTML-Datei und startet sie in Edge im App-Modus | Inno Setup auf dem PC |

Die Datei `src/index.html` läuft ausserdem direkt per Doppelklick im Browser.

## Ordnerstruktur

```
kanban-notizen/
├─ src/index.html                  Die App (HTML, CSS, JavaScript in einer Datei)
├─ src-tauri/                      Desktop-Hülle (Rust)
│  ├─ src/lib.rs                   Speichern in Datei, Tages-Backups
│  ├─ tauri.conf.json              Name, Version, Fenster, Installer-Einstellungen
│  ├─ capabilities/default.json    Rechte des Fensters
│  └─ icons/                       App-Icons
├─ installer/kanban-notizen.iss    Inno-Setup-Skript (HTML-Variante)
├─ .github/workflows/              Automatischer Build des Windows-Installers
└─ package.json                    Tauri-CLI
```

## 1. Git-Repo anlegen und hochladen

Im Ordner `kanban-notizen` eine Eingabeaufforderung oder PowerShell öffnen:

```powershell
git init -b main
git add .
git commit -m "Erste Version Kanban Notizen"
```

Auf github.com ein **neues, leeres Repository** `kanban-notizen` erstellen (ohne README), dann:

```powershell
git remote add origin https://github.com/DEIN-NAME/kanban-notizen.git
git push -u origin main
```

## 2. Installer bauen lassen

Nach dem Push startet unter **Actions** automatisch „Windows-Installer bauen“ (ca. 10–15 Minuten beim ersten Mal).
Danach den Lauf öffnen → unten bei **Artifacts** → `KanbanNotizen-Windows` herunterladen. Darin:

- `Kanban Notizen_1.0.0_x64-setup.exe` – **empfohlen**, installiert ohne Adminrechte ins Benutzerprofil
- `Kanban Notizen_1.0.0_x64_de-DE.msi` – MSI, z. B. für Verteilung über Intune

## 3. Neue Version veröffentlichen (manuell)

1. Version erhöhen in `src-tauri/tauri.conf.json` (und gleich in `package.json` und `src-tauri/Cargo.toml`)
2. Committen, dann ein Tag setzen und pushen:

```powershell
git commit -am "Version 1.1.0"
git tag v1.1.0
git push --follow-tags
```

GitHub erstellt dann ein **Release** mit den Installern zum Download.
Beim Installieren einer neuen Version wird die alte automatisch ersetzt – die Notizen bleiben erhalten.

## Automatische Updates

Die Desktop-App sucht beim Start und alle 6 Stunden nach einer neuen Version und bietet sie per Klick an.
So veröffentlichst du ein Update:

1. Version erhöhen in `src-tauri/tauri.conf.json`, `package.json` und `src-tauri/Cargo.toml` (z. B. `1.2.0`)
2. Committen und pushen:

```powershell
git commit -am "Version 1.2.0"
git push
```

Sobald auf `main` eine Version ankommt, für die es noch kein Release gibt, baut GitHub automatisch ein Release mit signierten Update-Dateien und `latest.json`.
Voraussetzungen: Das Repo ist **öffentlich**, und die Secrets `TAURI_SIGNING_PRIVATE_KEY` und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` sind eingetragen.
Den privaten Schlüssel sicher aufbewahren – ohne ihn lassen sich keine Updates mehr signieren.

## Wo liegen die Notizen?

- Standard: `Dokumente\Kanban Notizen\kanban-notizen.json`
- Tägliche Sicherungen: `Dokumente\Kanban Notizen\Backups\` (die letzten 30 Tage)
- Ändern unter **Einstellungen → Speicherort**, z. B. in einen OneDrive-Ordner
- Deinstallieren löscht die Notizen **nicht**

Bestehende Notizen aus der HTML-Version übernimmst du dort über **Einstellungen → Backup & Import → Backup herunterladen** und in der Desktop-App über **Backup wiederherstellen**.

## Lokal entwickeln (optional)

Nur nötig, wenn du die Desktop-App auf deinem PC selbst bauen oder testen willst:

1. [Node.js LTS](https://nodejs.org) installieren
2. [Rust](https://rustup.rs) installieren (Standardoptionen)
3. „Visual Studio Build Tools“ mit **Desktopentwicklung mit C++** installieren
4. Im Projektordner:

```powershell
npm install
npm run dev      # App im Entwicklungsmodus starten
npm run build    # Installer bauen → src-tauri\target\release\bundle\
```

Änderungen an der App selbst machst du in `src/index.html`.

## HTML-Variante mit Inno Setup

1. [Inno Setup](https://jrsoftware.org/isinfo.php) installieren
2. `installer/kanban-notizen.iss` öffnen → **Build → Compile** (F9)
3. Ergebnis: `installer/output/KanbanNotizen-HTML-Setup-1.0.0.exe`

## Hinweis zur Signatur

Die Installer sind nicht signiert. Windows SmartScreen zeigt beim ersten Start „Der Computer wurde durch Windows geschützt“ – über **Weitere Informationen → Trotzdem ausführen** geht es weiter. Für eine Verteilung an andere braucht es ein Code-Signing-Zertifikat.
