# Änderungen

## Web-App fürs iPhone
- Die App läuft als Web-App auf GitHub Pages und lässt sich über Safari auf den Home-Bildschirm legen. Sie läuft auch offline.
- Für das Handy angepasst:
  - untere Leiste mit Board, Heute, Neu, Tag und Suchen;
  - einklappbare Filter;
  - Editor im Vollbild;
  - Rücksicht auf Notch und Home-Balken;
  - kein Zoomen beim Tippen.
- Exporte öffnen auf dem iPhone das Teilen-Menü, z. B. zum Ablegen in „Dateien“.

## 1.4.0

**Neu**
- **Wiki-Links:** Mit `[[Titel]]` oder `[[Titel|Text]]` verlinkst du andere Notizen.
  - Nach `[[` schlägt der Editor passende Notizen vor.
  - Ein Klick auf einen Link öffnet die Notiz. Gibt es sie noch nicht, wird sie erstellt.
  - Mit „‹ Zurück“ kommst du zur vorherigen Notiz.
- **Rückverweise:** Jede Notiz zeigt, welche anderen Notizen auf sie verlinken.
- **Links beim Umbenennen:** Benennst du eine Notiz um, werden die Links in anderen Notizen angepasst.
- **Tagesnotiz:** Mit der Taste `D` oder über die Seitenleiste öffnest du die Notiz des Tages.
  - Space und Vorlage legst du unter Einstellungen fest.
  - Im Editor blätterst du zum Vor- oder Folgetag.
  - Unveränderte Tagesnotizen werden nicht gespeichert.
- **Favoriten:** Mit dem Stern im Editor markierst du eine Notiz. Favoriten erscheinen oben in der Seitenleiste und in der Suche.
- **Papierkorb:**
  - Gelöschte Notizen lassen sich 30 Tage lang wiederherstellen.
  - Das gilt auch für Notizen aus gelöschten Spaces und aus dem geleerten Archiv.
- **Versionsverlauf:** Pro Notiz werden bis zu 20 frühere Stände gespeichert, mit Vorschau und Wiederherstellen.

**Geändert**
- Die App ist jetzt eine reine Desktop-App. Die HTML-/Browser-Variante (Inno Setup) wurde entfernt.
- Exporte (Backup, CSV, Markdown, JSON) öffnen den Windows-Dialog „Speichern unter“.
- Der Code ist in einzelne Module aufgeteilt (`src/css`, `src/js`).
- Das Dateiformat hat jetzt Version 5. Ältere Dateien werden automatisch übernommen.

## 1.3.0
- Die App fühlt sich am Desktop an wie ein natürliches Programm: Das Fenster wackelt nicht mehr beim Scrollen, es gibt kein Browser-Menü und kein Zoomen.
- Fenstergrösse und -position bleiben erhalten. Die App startet nur einmal.

## 1.2.0
- Meldung, sobald eine neue Version verfügbar ist, und Knopf „Jetzt aktualisieren“.

## 1.1.0
- Automatische Updates über GitHub Releases.
