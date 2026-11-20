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
- **Austausch:** Import und Export für Rekordbox (XML), Traktor (NML), Serato, VirtualDJ und M3U8; CSV-Export; vollständiges Backup als JSON.

### Serato

- **Import:** Im Import-Dialog die Datei `database V2` aus dem Ordner `_Serato_` und beliebig viele `.crate`-Dateien aus `_Serato_/Subcrates` gemeinsam auswählen. Übernommen werden Titel, Artist, Album, Genre, BPM, Tonart, Kommentar und die Crates als Playlists.
- **Export:** Erzeugt eine ZIP-Datei mit einer `.crate`-Datei je Playlist. Den enthaltenen Ordner `_Serato_` mit dem vorhandenen `_Serato_`-Ordner zusammenführen (interne Platte: im Ordner „Musik“; externes Laufwerk: im Wurzelverzeichnis), solange Serato geschlossen ist.
- Serato speichert Cues, Beatraster, BPM und Tonart in den Audiodateien selbst. Diese Angaben werden deshalb weder gelesen noch übergeben – übertragen werden die Playlists.

### VirtualDJ

- **Import:** `database.xml` aus dem VirtualDJ-Ordner, dazu bei Bedarf Playlists (`.m3u`, `.vdjfolder`). Übernommen werden Tags, BPM, Tonart, Bewertung, Kommentar, Beatraster-Start und Cues.
- **Export:** Erzeugt eine ZIP-Datei mit `database.xml` und einem Ordner `Playlists`. **Vorher die eigene `database.xml` sichern** – die exportierte Datei ersetzt sie und enthält nur die Titel dieser Bibliothek.

## Grenzen

- Tags werden nur in der Bibliothek geändert, nicht in die Audiodateien zurückgeschrieben.
- Engine DJ wird noch nicht unterstützt.
- Die Exporte für Rekordbox, Traktor, Serato und VirtualDJ sind noch nicht mit der jeweiligen Software gegengeprüft – vor dem ersten Einsatz deren Bibliothek sichern.
- Der Browser kennt keine vollständigen Dateipfade. Für Exporte den Musikordner unter „Einstellungen“ eintragen.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/db.js` | Lokale Datenhaltung (IndexedDB) |
| `js/tags.js` | Metadaten aus Audiodateien lesen |
| `js/analyze.js` | Tempo, Tonart, Wellenform |
| `js/formats.js` | Tonart-Schreibweisen, Import/Export |
| `js/ui.js` | Oberfläche und Abläufe |
