# DJ KOLJA ONE · Library

Musikbibliothek für DJs im Branddesign: Titel verwalten, analysieren, in Playlists ordnen und an die DJ-Software übergeben.

Statische Web-App ohne Build-Schritt – `index.html` liegt im Wurzelverzeichnis. Alle Daten bleiben lokal im Browser (IndexedDB); Audiodateien werden weder kopiert noch hochgeladen.

## Starten

- **Mac:** Doppelklick auf `start-mac.command` (öffnet Chrome unter `http://localhost:8778/`).
- **Sonst:** `python3 server.py` und `http://localhost:8778/` öffnen.

Empfohlen ist Chrome oder Edge: Dort merkt sich die App die gewählten Musikordner dauerhaft. In Firefox und Safari müssen die Ordner nach jedem Neustart erneut gewählt werden (die Titel werden dann automatisch wieder zugeordnet).

## Funktionen

- **Bibliothek:** Ordner oder Dateien hinzufügen (auch per Drag & Drop), Tags aus MP3/AIFF/WAV (ID3v2), FLAC und M4A lesen, Suche, sortierbare Tabelle.
- **Bearbeiten:** Einzel- und Mehrfachbearbeitung, Bewertung, Farben, eigene Tags, Suchen & Ersetzen, Titel/Artist aus Dateiname.
- **Analyse:** BPM, Beatraster-Start, Tonart und Wellenform – direkt im Browser.
- **Deck:** Vorhören mit Wellenform, 8 Cue-Punkte (Tasten 1–8, Umschalt löscht), „Passende Titel“ nach Tonart und Tempo.
- **Listen:** Playlists, Smartlists mit Regeln, Ansichten für Duplikate und fehlende Dateien.
- **Austausch:** Import und Export als Rekordbox XML, Traktor NML und M3U8; CSV-Export; vollständiges Backup als JSON.

## Grenzen

- Tags werden nur in der Bibliothek geändert, nicht in die Audiodateien zurückgeschrieben.
- Serato, Engine DJ und VirtualDJ werden noch nicht direkt unterstützt.
- Der Browser kennt keine vollständigen Dateipfade. Für Exporte den Musikordner unter „Einstellungen“ eintragen.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/db.js` | Lokale Datenhaltung (IndexedDB) |
| `js/tags.js` | Metadaten aus Audiodateien lesen |
| `js/analyze.js` | Tempo, Tonart, Wellenform |
| `js/formats.js` | Tonart-Schreibweisen, Import/Export |
| `js/ui.js` | Oberfläche und Abläufe |
