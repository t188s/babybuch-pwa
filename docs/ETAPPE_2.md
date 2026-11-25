# Etappe 2 – Bericht, CSV, Kalender

Entscheidungen 23.11.2026:

| Thema | Entscheidung |
|---|---|
| Bericht | Seite zum Ansehen, „Drucken“ bzw. „Als PDF sichern“ über das Teilen-Menü – wie auf dem Pi |
| Ablage | erstellte Berichte auf dem Handy, die letzten 50; **nicht** im Backup |
| CSV | Export **und** Import – der Import liest auch die CSV-Dateien der Pi-Version (Umzug vom Pi möglich) |
| Kalender | Vorsorge-Termine wie Pi; **neu:** nach dem Anlegen einer regelmäßigen Gabe fragt die App, ob sie täglich (je Uhrzeit, Erinnerung zur Uhrzeit) in den Kalender soll |

## Stand

- [x] **Kalender** (0.3.0) – `js/pwa/kalender.js`. Termin-Datei identisch mit `/kalender.ics` des Pi 3.0.2 (geprüft),
      Serientermin für Gaben. Noch auf echten Handys prüfen: iPhone öffnet „Zum Kalender hinzufügen“, Android lädt die Datei.
- [x] **CSV-Export** (0.9.0) – `js/lokal/api/dateien.js` + `js/lokal/pi/rechnen.js` (WHO aus app.py erzeugt: `werkzeuge/who_uebernehmen.py`). 54 von 54 Dateien byte-gleich mit dem Pi (tests/vergleich_mit_pi.py). Zusätzlich flasche/abpumpen/beikost.csv; alle Tabellen unter Kinder, Backup & Abgleich.
  Alt: – Pi `app.py` Teil 7 (Zeile ~1897–2100, 3.0.2): stillen, windeln, gewicht, groesse, fieber, symptome,
      medikamente, gaben, impfungen, uheft, Vorlagen. Ziel: `js/lokal/csv/export.js`; Weiche fängt `a[href^="export/"]` ab
      und gibt die Datei über Teilen-Menü/Download aus (UTF-8 mit BOM, `;`, CRLF wie Pi).
- [x] **CSV-Import** (0.9.1) – `js/lokal/api/einlesen.js`. 15 Import-Anfragen mit kniffligen Dateien (Excel-Datum+Zeit in einer Spalte, Komma/Tab/Semikolon, Anführungszeichen mit Zeilenumbruch, falsche Dateiart, Doppelte) gleich wie Pi; Rundreise Export→Import geprüft.
  Alt: – Pi `import_auswerten` + `/api/import/<art>` (Zeile ~2100–2355): Vorschau, Doppelte überspringen,
      alte Formate (0.3–1.x), Excel/Numbers-tolerant. Ziel: `js/lokal/csv/import.js`, Route `import/:art` ersetzt den Platzhalter
      in `js/lokal/api/sonstiges.js`. Testdatei-Regeln aus der Pi-Wunschliste (8 Zeilen mit allen Fallstricken) übernehmen.
- [x] **Bericht** (0.10.0) – `bericht.html` + `js/pwa/bericht-seite.js`, `js/lokal/bericht/{naiv,grafiken,daten,vorlage}.js`. 7 Berichte (tests/vergleich_mit_pi.py) und 6 große Berichte mit 4 Monaten Daten (tests/bericht_gross_mit_pi.py) inhaltlich und grafisch gleich mit Pi 3.0.2. Öffnet im selben Fenster (iPhone: gleiche Daten), „Teilen“ als HTML-Datei, Ablage der letzten 50 unter Kinder, Backup & Abgleich.
  Alt: Pi `app.py` Teil 8 (Zeile ~2356–3010) + `templates/bericht.html` (Jinja, 453 Zeilen):
      Daten (`bericht()`), Grafiken (`svg_rhythmus`, `svg_zeitleiste`, `svg_balken`, `svg_wachstum`, `trend_eimer`) und Vorlage
      nach JavaScript. Ziel: `bericht.html` (statische Seite der Web-App, liest dieselben Parameter wie `/bericht?…`),
      `js/lokal/bericht/{daten,grafiken,vorlage}.js`. `pi_uebernehmen.py`: Link `bericht?` → `bericht.html?`.
      Ablage (letzte 50) in IndexedDB, Liste in „Kinder, Backup & Abgleich“; Route `berichte` liefert sie.
- [x] **Bericht: Fläschchen, Abpumpen, Beikost** (0.10.0) – erscheint automatisch, wenn es im Zeitraum Einträge gibt.
  Alt: (seit Web 0.7.0, gibt es auf dem Pi noch nicht) – eigener Berichtsteil
      „ernaehrung“ (Kennzahlen wie Auswertung › Fläschchen, Beikost-Liste mit „zum ersten Mal“); Daten über `js/kern/ernaehrung.js`.
- [x] **Vergleichstest** erweitert (CSV 54/54, Import 15/15, Bericht 7/7 + 6/6 groß)
  Alt:: CSV-Export und Bericht gegen den Pi-Server (gleiche Daten → gleicher Text bzw. gleiche Zahlen).
