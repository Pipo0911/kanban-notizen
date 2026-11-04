# Änderungen

## 1.5.1 · Korrektur iPhone-App
- QR-Code-Verbindung: Nach dem Scan bleibt das Fenster offen. Darin erscheinen die Auswahl „Zusammenführen / Ersetzen“, der Fortschritt und am Ende „✓ Verbunden“ oder eine verständliche Fehlermeldung. Vorher schloss sich die Kamera, und es passierte nichts.
- Beim Zusammenführen werden die Beispiel-Notizen des neuen Geräts weggelassen, damit sie nicht doppelt erscheinen.

## 1.5.1
- **iPhone per QR-Code verbinden:** Der PC zeigt unter Einstellungen → Synchronisation → „QR-Code für weiteres Gerät“ einen QR-Code. Auf dem iPhone in der App „Mit QR-Code verbinden“ tippen und scannen. Kein Code-Abtippen, kein Passwort nötig.
- Der QR-Code verschwindet aus Sicherheitsgründen nach 2 Minuten.
- Wird der QR-Code versehentlich mit der Kamera-App gescannt, erklärt die Seite in Safari, wie es richtig geht.

## 1.5.0
- **Synchronisation zwischen PC und iPhone:**
  - Neue und geänderte Notizen erscheinen nach wenigen Sekunden auf dem anderen Gerät, solange die App dort offen ist.
  - Die Notizen werden auf dem Gerät mit deinem Sync-Passwort verschlüsselt. In der Cloud liegt nur unlesbarer Datensalat.
  - Einrichten unter Einstellungen → Synchronisation: auf dem ersten Gerät „Sync einrichten“, auf dem iPhone „Mit bestehendem Sync verbinden“ mit Sync-Code und Passwort.
  - Ändern beide Geräte dieselbe Notiz, gewinnt die neuere Fassung. Die andere landet im Versionsverlauf.
  - Ohne Internet wird später automatisch abgeglichen.
- Der Sync-Status steht in der Seitenleiste. Antippen gleicht sofort ab.

## iPhone-App: Updates und Feinschliff
- **Updates:** Die App sucht beim Öffnen und stündlich nach neuen Versionen und lädt sie im Hintergrund. Mit „Jetzt aktualisieren“ wird die neue Version übernommen.
- Unter Einstellungen findest du die Version, „Nach Updates suchen“ und „Was ist neu“.
- Eine Leiste mit den Spalten über dem Board zeigt die Anzahl Notizen und springt auf Antippen zur Spalte.
- Über der Tastatur gibt es eine Format-Leiste mit Fett, Kursiv, Überschrift, Liste, Aufgabe, [[Link]] und Code.
- Bei offener Tastatur passt sich der Editor an. Fusszeile und untere Leiste machen Platz.
- Vom linken Rand wischen öffnet das Menü, nach links wischen schliesst es.
- Das App-Icon zeigt als Zahl, wie viele Notizen heute fällig oder überfällig sind (ab iOS 16.4, wenn Mitteilungen erlaubt sind).
- Erinnerungen kommen als iPhone-Mitteilung, solange die App offen ist.
- Grössere Touch-Flächen, keine Textauswahl beim langen Drücken auf Karten.
- In Safari erscheint ein Hinweis, wie du die App auf den Home-Bildschirm legst.

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
