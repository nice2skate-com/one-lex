# DJ KOLJA ONE · Library

Musikbibliothek für DJs im Branddesign: Titel verwalten, analysieren, in Playlists ordnen und an die DJ-Software übergeben.

Statische Web-App ohne Build-Schritt – `index.html` liegt im Wurzelverzeichnis. Alle Daten bleiben lokal im Browser (IndexedDB); Audiodateien werden weder kopiert noch hochgeladen.

## Starten

- **Mac:** Doppelklick auf `start-mac.command` (öffnet Chrome unter `http://localhost:8778/`).
- **Sonst:** `python3 server.py` und `http://localhost:8778/` öffnen.

### Desktop-App (empfohlen für die tägliche Arbeit)

Im Ordner `desktop/` liegt eine Electron-Hülle um dieselbe Oberfläche. Sie kennt vollständige Dateipfade, schreibt Tags ohne Rückfragen des Browsers, kann Dateien umbenennen und gleicht direkt mit der DJ-Software ab.

```bash
cd desktop
npm install
npm start
```

`npm run dist` baut ein Installationspaket (Mac: DMG, Windows: Installer); dieser Schritt ist noch nicht erprobt.

### Im Browser

Empfohlen ist Chrome oder Edge: Dort merkt sich die App die gewählten Musikordner dauerhaft. In Firefox und Safari müssen die Ordner nach jedem Neustart erneut gewählt werden (die Titel werden dann automatisch wieder zugeordnet).

## Funktionen

- **Bibliothek:** Ordner oder Dateien hinzufügen (auch per Drag & Drop), Tags und Cover aus MP3/AIFF/WAV (ID3v2), FLAC und M4A lesen, Suche, sortierbare Tabelle.
- **Tabelle:** Rechtsklick auf die Kopfzeile blendet Spalten ein und aus (u. a. Energie, Wiedergaben, Kommentar, Dateityp), Ziehen ändert die Reihenfolge, der rechte Rand die Breite. Die Sortierung wird je Ansicht gemerkt.
- **Bearbeiten:** Einzel- und Mehrfachbearbeitung, Bewertung, Farben, eigene Tags, Suchen & Ersetzen, Titel/Artist aus Dateiname, Groß-/Kleinschreibung bereinigen, Artist und Titel tauschen. **Rückgängig** mit Strg/⌘+Z.
- **Tags in Dateien schreiben:** Titel, Artist, Album, Genre, Jahr, BPM, Tonart und Kommentar in MP3, FLAC, M4A, WAV und AIFF. Cover und fremde Angaben bleiben erhalten. In der Desktop-App immer, im Browser nur in Chrome/Edge und nur für Ordner, die über „Musik hinzufügen“ gewählt wurden.
- **Analyse:** BPM, Beatraster-Start, Tonart, Wellenform, Lautheit und eine geschätzte Energie (1–10) – direkt im Browser.
- **Deck:** Vorhören mit Wellenform und Cover, 8 Hot Cues (Tasten 1–8, Umschalt löscht), Memory-Cues, Loops (4–32 Beats), Cue-Namen und -Farben, Cue-Vorschläge. Beatraster korrigieren (BPM, ÷2/×2, verschieben, „Beat hier“, Tempowechsel) mit Klick zum Prüfen; Zoom auf einen 8-Sekunden-Ausschnitt mit jedem Beat. Cues, die Serato in MP3-Dateien abgelegt hat, werden beim Hinzufügen übernommen. „Passende Titel“ nach Tonart und Tempo. Optional Lautstärke-Angleichung.
- **Listen:** Playlists mit Ordnern („Ordner / Name“) und frei ziehbarer Reihenfolge, Smartlists mit Regeln, Regelgruppen und Obergrenze, Ansichten für zuletzt Gespieltes, Duplikate und fehlende Dateien. Duplikate lassen sich zusammenführen.
- **Sicherung:** tägliche automatische Sicherung im Browser (die letzten 7, unter „Einstellungen“ wiederherstellbar) und vollständiges Backup als JSON-Datei.
- **Darstellung:** dunkles und helles Design, anpassbare Tastenkürzel, Sprache Deutsch oder Englisch (Einstellungen; ohne Auswahl richtet sie sich nach der Sprache des Browsers).
- **Online ergänzen:** fehlendes Album, Jahr und Genre aus dem freien Katalog musicbrainz.org nachtragen (Werkzeuge). Gesendet werden nur Artist und Titel der ausgewählten Titel.
- **Nur Desktop-App:** Dateien nach Muster umbenennen; direkter Abgleich mit Serato, VirtualDJ, Traktor und rekordbox sowie Einlesen des Verlaufs gespielter Titel aus Serato, VirtualDJ und Traktor (Import / Export → „Direkter Abgleich“).
- **Austausch:** Import und Export für Rekordbox (XML), Traktor (NML), Serato, VirtualDJ und M3U8; CSV-Export. Loops und Memory-Cues gehen nach Rekordbox und Traktor mit.

### Serato

- **Import:** Im Import-Dialog die Datei `database V2` aus dem Ordner `_Serato_` und beliebig viele `.crate`-Dateien aus `_Serato_/Subcrates` gemeinsam auswählen. Übernommen werden Titel, Artist, Album, Genre, BPM, Tonart, Kommentar und die Crates als Playlists.
- **Export:** Erzeugt eine ZIP-Datei mit einer `.crate`-Datei je Playlist. Den enthaltenen Ordner `_Serato_` mit dem vorhandenen `_Serato_`-Ordner zusammenführen (interne Platte: im Ordner „Musik“; externes Laufwerk: im Wurzelverzeichnis), solange Serato geschlossen ist.
- Serato speichert Cues, Beatraster, BPM und Tonart in den Audiodateien selbst. Diese Angaben werden deshalb weder gelesen noch übergeben – übertragen werden die Playlists.

### VirtualDJ

- **Import:** `database.xml` aus dem VirtualDJ-Ordner, dazu bei Bedarf Playlists (`.m3u`, `.vdjfolder`). Übernommen werden Tags, BPM, Tonart, Bewertung, Kommentar, Beatraster-Start und Cues.
- **Export:** Erzeugt eine ZIP-Datei mit `database.xml` und einem Ordner `Playlists`. **Vorher die eigene `database.xml` sichern** – die exportierte Datei ersetzt sie und enthält nur die Titel dieser Bibliothek.

### Direkter Abgleich (Desktop-App)

| Programm | Einlesen | Schreiben |
| --- | --- | --- |
| Serato | `database V2` und Crates aus `_Serato_` (Musikordner und externe Laufwerke) | Playlists als Crates in das `_Serato_` des jeweiligen Laufwerks |
| VirtualDJ | `database.xml` und `Playlists` | Datenbank wird ergänzt, fremde Einträge bleiben; Playlists als M3U |
| Traktor | `collection.nml` der neuesten Traktor-Version | `ONE Library.nml` im Traktor-Ordner, in Traktor über „Import Another Collection“ |
| rekordbox | `Dokumente/ONE Library/rekordbox.xml` (dorthin aus rekordbox exportieren) | dieselbe Datei; in rekordbox einmalig als „rekordbox xml“ eintragen |

Jede Datei, die dabei ersetzt wird, wird vorher als Kopie mit der Endung `.one-sicherung-…` daneben abgelegt. Die DJ-Software sollte währenddessen geschlossen sein.

## Grenzen

- Cues für Serato lassen sich beim Tags-Schreiben mitschreiben (MP3, WAV, AIFF; nur wenn die Datei noch keine Serato-Cues hat). Das ist als experimentell gekennzeichnet, weil es nicht mit Serato gegengeprüft ist. Das Beatraster wird nicht in Dateien geschrieben.
- Dateien mit ungewöhnlichen Tag-Varianten werden beim Schreiben übersprungen statt verändert.
- rekordbox und Traktor lassen sich nicht direkt beschreiben (verschlüsselte bzw. programmeigene Datenbank); der Abgleich läuft dort über eine Austauschdatei. Engine DJ wird nicht unterstützt.
- Umbenennen und direkter Abgleich gibt es nur in der Desktop-App.
- Rückgängig gilt für Bearbeitungen in der Bibliothek, nicht für Importe, geschriebene oder umbenannte Dateien.
- Im Browser sind keine vollständigen Dateipfade bekannt; für Exporte den Musikordner unter „Einstellungen“ eintragen.
- Nicht enthalten: Streaming-Dienste. Weitere Sprachen brauchen je eine Datei in `js/lang/` nach dem Vorbild von `en.js`.
- Der Austausch mit Rekordbox, Traktor, Serato und VirtualDJ ist noch nicht mit der jeweiligen Software gegengeprüft – vor dem ersten Einsatz deren Bibliothek sichern.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/db.js` | Lokale Datenhaltung (IndexedDB) |
| `js/tags.js` | Metadaten und Cover aus Audiodateien lesen |
| `js/tagwrite.js` | Metadaten in MP3, FLAC, M4A, WAV und AIFF schreiben |
| `js/analyze.js` | Tempo, Tonart, Wellenform |
| `js/formats.js` | Tonart-Schreibweisen, Import/Export |
| `js/ui.js` | Oberfläche und Abläufe |
| `js/i18n.js`, `js/lang/` | Sprachumschaltung und Sprachpakete |
| `desktop/` | Desktop-App (Electron): Dateizugriff, Umbenennen, direkter Abgleich |
