# DJ KOLJA ONE · Library

Musikbibliothek für DJs im Branddesign: Titel verwalten, analysieren, in Playlists ordnen und an die DJ-Software übergeben.

Statische Web-App ohne Build-Schritt – `index.html` liegt im Wurzelverzeichnis. Alle Daten bleiben lokal im Browser (IndexedDB); Audiodateien werden weder kopiert noch hochgeladen.

## Starten

- **Mac:** Doppelklick auf `start-mac.command` (öffnet Chrome unter `http://localhost:8778/`).
- **Sonst:** `python3 server.py` und `http://localhost:8778/` öffnen.

Empfohlen ist Chrome oder Edge: Dort merkt sich die App die gewählten Musikordner dauerhaft. In Firefox und Safari müssen die Ordner nach jedem Neustart erneut gewählt werden (die Titel werden dann automatisch wieder zugeordnet).

## Funktionen

- **Bibliothek:** Ordner oder Dateien hinzufügen (auch per Drag & Drop), Tags und Cover aus MP3/AIFF/WAV (ID3v2), FLAC und M4A lesen, Suche, sortierbare Tabelle.
- **Tabelle:** Rechtsklick auf die Kopfzeile blendet Spalten ein und aus (u. a. Energie, Wiedergaben, Kommentar, Dateityp), Ziehen ändert die Reihenfolge, der rechte Rand die Breite. Die Sortierung wird je Ansicht gemerkt.
- **Bearbeiten:** Einzel- und Mehrfachbearbeitung, Bewertung, Farben, eigene Tags, Suchen & Ersetzen, Titel/Artist aus Dateiname, Groß-/Kleinschreibung bereinigen, Artist und Titel tauschen. **Rückgängig** mit Strg/⌘+Z.
- **Tags in Dateien schreiben:** Titel, Artist, Album, Genre, Jahr, BPM, Tonart und Kommentar in MP3 (ID3v2.3/2.4) und FLAC. Cover und fremde Angaben bleiben erhalten. Nur in Chrome/Edge und nur für Ordner, die über „Musik hinzufügen“ gewählt wurden.
- **Analyse:** BPM, Beatraster-Start, Tonart, Wellenform, Lautheit und eine geschätzte Energie (1–10) – direkt im Browser.
- **Deck:** Vorhören mit Wellenform und Cover, 8 Hot Cues (Tasten 1–8, Umschalt löscht), Memory-Cues, Loops (4–32 Beats), Cue-Namen und -Farben, Cue-Vorschläge. Beatraster korrigieren (BPM, ÷2/×2, verschieben, „Beat hier“) mit Klick zum Prüfen. „Passende Titel“ nach Tonart und Tempo. Optional Lautstärke-Angleichung.
- **Listen:** Playlists mit Ordnern („Ordner / Name“) und frei ziehbarer Reihenfolge, Smartlists mit Regeln und Obergrenze, Ansichten für zuletzt Gespieltes, Duplikate und fehlende Dateien. Duplikate lassen sich zusammenführen.
- **Sicherung:** tägliche automatische Sicherung im Browser (die letzten 7, unter „Einstellungen“ wiederherstellbar) und vollständiges Backup als JSON-Datei.
- **Darstellung:** dunkles und helles Design.
- **Austausch:** Import und Export für Rekordbox (XML), Traktor (NML), Serato, VirtualDJ und M3U8; CSV-Export. Loops und Memory-Cues gehen nach Rekordbox und Traktor mit.

### Serato

- **Import:** Im Import-Dialog die Datei `database V2` aus dem Ordner `_Serato_` und beliebig viele `.crate`-Dateien aus `_Serato_/Subcrates` gemeinsam auswählen. Übernommen werden Titel, Artist, Album, Genre, BPM, Tonart, Kommentar und die Crates als Playlists.
- **Export:** Erzeugt eine ZIP-Datei mit einer `.crate`-Datei je Playlist. Den enthaltenen Ordner `_Serato_` mit dem vorhandenen `_Serato_`-Ordner zusammenführen (interne Platte: im Ordner „Musik“; externes Laufwerk: im Wurzelverzeichnis), solange Serato geschlossen ist.
- Serato speichert Cues, Beatraster, BPM und Tonart in den Audiodateien selbst. Diese Angaben werden deshalb weder gelesen noch übergeben – übertragen werden die Playlists.

### VirtualDJ

- **Import:** `database.xml` aus dem VirtualDJ-Ordner, dazu bei Bedarf Playlists (`.m3u`, `.vdjfolder`). Übernommen werden Tags, BPM, Tonart, Bewertung, Kommentar, Beatraster-Start und Cues.
- **Export:** Erzeugt eine ZIP-Datei mit `database.xml` und einem Ordner `Playlists`. **Vorher die eigene `database.xml` sichern** – die exportierte Datei ersetzt sie und enthält nur die Titel dieser Bibliothek.

## Grenzen

- Tags schreiben geht für MP3 und FLAC, nicht für M4A, WAV und AIFF. Dateien mit ungewöhnlichen Tag-Varianten werden übersprungen statt verändert.
- Cues und Beatraster werden nicht in die Audiodateien geschrieben. Nach Serato gehen deshalb nur Playlists sowie – über die geschriebenen Tags – BPM und Tonart.
- Das Beatraster hat ein festes Tempo je Titel; wechselnde Tempi werden nicht abgebildet.
- Dateien umbenennen oder verschieben kann die App nicht. Verschobene Dateien werden wieder zugeordnet, wenn der neue Ordner hinzugefügt wird.
- Kein direkter Abgleich mit der DJ-Software: Der Austausch läuft über Export- und Importdateien. Engine DJ wird nicht unterstützt.
- Rückgängig gilt für Bearbeitungen in der Bibliothek, nicht für Importe und nicht für geschriebene Dateien.
- Der Browser kennt keine vollständigen Dateipfade. Für Exporte den Musikordner unter „Einstellungen“ eintragen.
- Die Exporte für Rekordbox, Traktor, Serato und VirtualDJ sind noch nicht mit der jeweiligen Software gegengeprüft – vor dem ersten Einsatz deren Bibliothek sichern.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/db.js` | Lokale Datenhaltung (IndexedDB) |
| `js/tags.js` | Metadaten und Cover aus Audiodateien lesen |
| `js/tagwrite.js` | Metadaten in MP3 und FLAC schreiben |
| `js/analyze.js` | Tempo, Tonart, Wellenform |
| `js/formats.js` | Tonart-Schreibweisen, Import/Export |
| `js/ui.js` | Oberfläche und Abläufe |
