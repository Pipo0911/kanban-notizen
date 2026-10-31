# Kanban Notizen

Desktop-App für Windows, die Notizen auf Boards organisiert. Dazu gehören Spaces und Kategorien, Wiki-Links mit Rückverweisen, eine Tagesnotiz, Favoriten, ein Papierkorb und ein Versionsverlauf. Ausserdem: Prioritäten, Labels, Checklisten, Termine mit Erinnerung, Wiederholungen, Zeiterfassung, Vorlagen, Screenshots und Drucken/PDF.

Die App läuft komplett offline und speichert in eine JSON-Datei auf deinem PC. Updates installiert sie selbst.

## Funktionen

| Bereich | Was |
|---|---|
| Boards | Spaces mit eigenen Spalten, verschachtelte Kategorien, Ziehen & Ablegen, Filter, Sortierung |
| Notizen | Markdown, Checklisten, Farben, Prioritäten, Labels, Bilder per `Strg`+`V`, Vorlagen |
| Verknüpfen | `[[Titel]]` oder `[[Titel\|Text]]` mit Vorschlägen beim Tippen. Fehlende Notizen entstehen per Klick. Jede Notiz zeigt ihre Rückverweise. Beim Umbenennen werden die Links angepasst. |
| Tagesnotiz | Taste `D`. Eine Notiz pro Tag mit Vorlage, im Editor Vor- und Folgetag. Verlinken mit `[[2026-10-28]]`. |
| Favoriten | Stern im Editor. Favoriten stehen oben in der Seitenleiste und in der Suche. |
| Sicherheit | Papierkorb (30 Tage), Versionsverlauf (20 Stände pro Notiz), tägliche Backups, Rückgängig |
| Planung | Heute & Termine, Erinnerungen, Wiederholungen, Zeiterfassung mit CSV-Export |

## Ordnerstruktur

```
kanban-notizen/
├─ src/                            Oberfläche (Desktop-App und Web-App)
│  ├─ manifest.webmanifest, sw.js  Web-App: Name, Icons, Offline-Betrieb
│  ├─ index.html                   Grundgerüst, lädt CSS und Module
│  ├─ css/app.css                  Gestaltung (hell/dunkel)
│  └─ js/                          Module, in dieser Reihenfolge geladen:
│     ├─ core.js                   Hilfsfunktionen, Konstanten, Symbole
│     ├─ model.js                  Datenmodell, Normalisierung, Übernahme alter Versionen
│     ├─ storage.js                Speichern in die Datei, Desktop-Verhalten, Updates
│     ├─ helpers.js                Toast, Dialoge, Export, Markdown
│     ├─ tasks.js                  Wiederholungen, Zeiterfassung, Erinnerungen
│     ├─ layout.js                 Seitenleiste, Kopfzeile, Filter, Kategorien
│     ├─ board.js / views.js       Karten, Board, Alle Notizen, Archiv, Heute
│     ├─ editor.js                 Notiz-Editor
│     ├─ spaces.js                 Spalten und Spaces
│     ├─ reports.js                Zeitbericht, Drucken, Markdown-Export
│     ├─ settings.js               Einstellungen, Import
│     ├─ palette.js                Suche und Befehle (Strg+K)
│     ├─ links.js                  Wiki-Links, Rückverweise, Tagesnotiz, Favoriten
│     ├─ trash.js                  Papierkorb, Versionsverlauf
│     └─ main.js                   Tastatur, Klicks, Start
├─ src-tauri/                      Desktop-Hülle (Rust)
│  ├─ src/lib.rs                   Datei lesen/schreiben, Tages-Backups, Exporte
│  ├─ tauri.conf.json              Name, Version, Fenster, Installer, Updater
│  ├─ capabilities/default.json    Rechte des Fensters
│  └─ icons/                       App-Icons
├─ .github/workflows/              Build und Release auf GitHub
├─ CHANGELOG.md
└─ package.json                    Tauri-CLI
```

Die Module sind klassische Skripte ohne Build-Schritt. Sie teilen sich den globalen Gültigkeitsbereich, deshalb ist die Reihenfolge in `index.html` wichtig.

## iPhone (Web-App)

Dieselbe Oberfläche läuft auch als Web-App auf GitHub Pages: **https://pipo0911.github.io/kanban-notizen/**

1. Die Adresse auf dem iPhone in **Safari** öffnen.
2. Auf **Teilen** tippen, dann auf **Zum Home-Bildschirm**.
3. Die App startet jetzt im Vollbild und funktioniert auch offline.

Gut zu wissen:
- Die Notizen bleiben auf dem iPhone. Sie werden nicht automatisch mit dem PC abgeglichen.
- Zum Übertragen in eine Richtung dient **Einstellungen → Backup & Import**: auf dem einen Gerät „Backup speichern“, auf dem anderen „Backup wiederherstellen“.
- Jeder Push auf `main`, der etwas unter `src/` ändert, veröffentlicht die Web-App neu (`.github/workflows/pages.yml`). Die App meldet eine neue Version mit „Jetzt neu laden“.
- Einmalig muss im Repo unter **Settings → Pages** die Quelle **GitHub Actions** eingestellt sein.

## Neue Version veröffentlichen

1. Die Version in **allen drei** Dateien gleich erhöhen: `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`.
2. Einen Eintrag in `CHANGELOG.md` schreiben.
3. Committen und auf `main` pushen:

```powershell
git commit -am "Version 1.5.0"
git push
```

GitHub Actions merkt die neue Version und erstellt das Release `v1.5.0` mit Installern und `latest.json`. Installierte Apps melden das Update dann selbst. Ein Push ohne Versionsänderung baut nur einen Test-Installer (unter **Actions → Artifacts**).

Für die Update-Signatur braucht das Repo die Secrets `TAURI_SIGNING_PRIVATE_KEY` und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Wo liegen die Notizen?

- Standard: `Dokumente\Kanban Notizen\kanban-notizen.json`
- Tägliche Sicherungen: im Unterordner `Backups\` (die letzten 30 Tage)
- Ändern unter **Einstellungen → Speicherort**, z. B. in einen OneDrive-Ordner
- Deinstallieren löscht die Notizen **nicht**

## Lokal entwickeln

Die Oberfläche lässt sich zum schnellen Testen direkt im Browser öffnen (`src/index.html`). Sie speichert dann im Browser, wie die Web-App.

Für die echte App:

1. [Node.js LTS](https://nodejs.org) und [Rust](https://rustup.rs) installieren
2. „Visual Studio Build Tools“ mit **Desktopentwicklung mit C++** installieren
3. Im Projektordner:

```powershell
npm install
npm run dev      # App im Entwicklungsmodus starten
npm run build    # Installer bauen → src-tauri\target\release\bundle\
```

## Hinweis zur Signatur

Die Installer haben keine Code-Signatur. Beim ersten Start zeigt Windows SmartScreen deshalb „Der Computer wurde durch Windows geschützt“. Über **Weitere Informationen → Trotzdem ausführen** geht es weiter. Updates sind trotzdem mit einem eigenen Schlüssel signiert und werden vor der Installation geprüft.
